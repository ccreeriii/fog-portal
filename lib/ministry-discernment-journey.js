'use strict';

const {
    isActiveMinistryRole
} = require('./ministry-service-journey');

const SOURCE_TYPES = new Set([
    'profile',
    'adult_intake',
    'accelerated_transition',
    'new_application'
]);

const TERMINAL_STATUSES = new Set([
    'completed',
    'withdrawn',
    'not_recommended'
]);

const mutationQueues = new WeakMap();

function discernmentError(code, message) {
    return Object.assign(
        new Error(message),
        { code }
    );
}

function normalizeId(value) {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

function normalizeText(value) {
    return typeof value === 'string'
        ? value.trim()
        : '';
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(
            sql,
            params,
            function onRun(err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        );
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(
            sql,
            params,
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(row || null);
            }
        );
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(
            sql,
            params,
            (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(rows || []);
            }
        );
    });
}

async function rollbackQuietly(db) {
    try {
        await run(db, 'ROLLBACK');
    } catch (_) {
        // Preserve original failure.
    }
}

async function withMutationQueue(db, operation) {
    const previous =
        mutationQueues.get(db) ||
        Promise.resolve();

    let tracked;

    const current = previous
        .catch(() => {})
        .then(operation);

    tracked = current.finally(() => {
        if (mutationQueues.get(db) === tracked) {
            mutationQueues.delete(db);
        }
    });

    mutationQueues.set(db, tracked);

    return tracked;
}

async function appendEvent(
    db,
    {
        caseId,
        eventType,
        actorUserId = null,
        actorName,
        visibility = 'leadership',
        details = {}
    }
) {
    const actor = normalizeText(actorName);

    if (!actor) {
        throw discernmentError(
            'ACTOR_REQUIRED',
            'An authenticated actor is required.'
        );
    }

    if (!['member', 'leadership'].includes(visibility)) {
        throw discernmentError(
            'INVALID_EVENT_VISIBILITY',
            'Invalid discernment event visibility.'
        );
    }

    return run(
        db,
        `
        INSERT INTO ministry_discernment_events (
            case_id,
            event_type,
            actor_user_id,
            actor_name,
            visibility,
            details_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
            caseId,
            eventType,
            normalizeId(actorUserId),
            actor,
            visibility,
            JSON.stringify(details || {})
        ]
    );
}

async function getOpenCase(
    db,
    youthId,
    ministryId
) {
    return get(
        db,
        `
        SELECT *
        FROM ministry_discernment_cases
        WHERE youth_id = ?
          AND ministry_id = ?
          AND status NOT IN (
                'completed',
                'withdrawn',
                'not_recommended'
          )
        ORDER BY id DESC
        LIMIT 1
        `,
        [youthId, ministryId]
    );
}

async function openDiscernmentCase(
    db,
    {
        youthId,
        ministryId,
        sourceType,
        sourceIntakeId = null,
        intentText,
        availability = null,
        giftsText = null,
        growthHopesText = null,
        wantsLeaderConversation = true,
        actorUserId = null,
        actorName
    }
) {
    const memberId = normalizeId(youthId);
    const targetMinistryId = normalizeId(ministryId);
    const intakeId = normalizeId(sourceIntakeId);
    const intent = normalizeText(intentText);
    const actor = normalizeText(actorName);

    if (!memberId || !targetMinistryId) {
        throw discernmentError(
            'INVALID_DISCERNMENT_TARGET',
            'A valid member and ministry are required.'
        );
    }

    if (!SOURCE_TYPES.has(sourceType)) {
        throw discernmentError(
            'INVALID_SOURCE_TYPE',
            'Invalid ministry discernment source.'
        );
    }

    if (!intent) {
        throw discernmentError(
            'INTENT_REQUIRED',
            'Please share your desire to begin ministry discernment.'
        );
    }

    if (!actor) {
        throw discernmentError(
            'ACTOR_REQUIRED',
            'An authenticated member identity is required.'
        );
    }

    return withMutationQueue(
        db,
        async () => {
            await run(db, 'BEGIN IMMEDIATE');

            try {
                const existing =
                    await getOpenCase(
                        db,
                        memberId,
                        targetMinistryId
                    );

                if (existing) {
                    await run(db, 'ROLLBACK');

                    return {
                        opened: false,
                        idempotent: true,
                        case: existing
                    };
                }

                const membership = await get(
                    db,
                    `
                    SELECT
                        id,
                        ministry_id,
                        youth_id,
                        role,
                        COALESCE(is_priority,0) AS is_priority
                    FROM ministry_members
                    WHERE youth_id = ?
                      AND ministry_id = ?
                    `,
                    [
                        memberId,
                        targetMinistryId
                    ]
                );

                if (!membership) {
                    throw discernmentError(
                        'CURRENT_MINISTRY_REQUIRED',
                        'Existing-servant discernment requires a current ministry relationship.'
                    );
                }

                if (!isActiveMinistryRole(membership.role)) {
                    throw discernmentError(
                        'CURRENT_MINISTRY_REQUIRED',
                        'Pending applications cannot use the existing-servant discernment pathway.'
                    );
                }

                if (
                    Number(membership.is_priority) !== 1
                ) {
                    throw discernmentError(
                        'PRIORITY_MINISTRY_REQUIRED',
                        'Choose this ministry as your Priority Ministry before beginning discernment.'
                    );
                }

                if (intakeId) {
                    const intake = await get(
                        db,
                        `
                        SELECT id, youth_id
                        FROM member_transition_intakes
                        WHERE id = ?
                        `,
                        [intakeId]
                    );

                    if (
                        !intake ||
                        Number(intake.youth_id) !==
                            memberId
                    ) {
                        throw discernmentError(
                            'INVALID_SOURCE_INTAKE',
                            'Transition intake does not belong to this member.'
                        );
                    }
                }

                const inserted = await run(
                    db,
                    `
                    INSERT INTO ministry_discernment_cases (
                        youth_id,
                        ministry_id,
                        source_intake_id,
                        source_type,
                        status,
                        intent_text,
                        availability,
                        gifts_text,
                        growth_hopes_text,
                        wants_leader_conversation,
                        priority_at_open
                    )
                    VALUES (
                        ?, ?, ?, ?, 'intent_submitted',
                        ?, ?, ?, ?, ?, 1
                    )
                    `,
                    [
                        memberId,
                        targetMinistryId,
                        intakeId,
                        sourceType,
                        intent,
                        normalizeText(availability) || null,
                        normalizeText(giftsText) || null,
                        normalizeText(growthHopesText) || null,
                        wantsLeaderConversation ? 1 : 0
                    ]
                );

                await appendEvent(
                    db,
                    {
                        caseId: inserted.lastID,
                        eventType: 'intent_submitted',
                        actorUserId,
                        actorName: actor,
                        visibility: 'member',
                        details: {
                            intent_text: intent,
                            priority_at_open: true
                        }
                    }
                );

                const saved = await get(
                    db,
                    `
                    SELECT *
                    FROM ministry_discernment_cases
                    WHERE id = ?
                    `,
                    [inserted.lastID]
                );

                await run(db, 'COMMIT');

                return {
                    opened: true,
                    idempotent: false,
                    case: saved
                };
            } catch (error) {
                await rollbackQuietly(db);
                throw error;
            }
        }
    );
}

async function mutateCase(
    db,
    {
        caseId,
        youthId = null,
        allowedStatuses,
        nextStatus,
        eventType,
        actorUserId = null,
        actorName,
        visibility = 'leadership',
        details = {}
    }
) {
    const normalizedCaseId = normalizeId(caseId);
    const normalizedYouthId = normalizeId(youthId);
    const actor = normalizeText(actorName);

    if (!normalizedCaseId) {
        throw discernmentError(
            'INVALID_CASE',
            'A valid discernment case is required.'
        );
    }

    if (!actor) {
        throw discernmentError(
            'ACTOR_REQUIRED',
            'An authenticated actor is required.'
        );
    }

    return withMutationQueue(
        db,
        async () => {
            await run(db, 'BEGIN IMMEDIATE');

            try {
                const current = await get(
                    db,
                    `
                    SELECT *
                    FROM ministry_discernment_cases
                    WHERE id = ?
                    `,
                    [normalizedCaseId]
                );

                if (!current) {
                    throw discernmentError(
                        'CASE_NOT_FOUND',
                        'Ministry discernment case not found.'
                    );
                }

                if (
                    normalizedYouthId &&
                    Number(current.youth_id) !==
                        normalizedYouthId
                ) {
                    throw discernmentError(
                        'CASE_OWNER_MISMATCH',
                        'This discernment case belongs to another member.'
                    );
                }

                if (
                    TERMINAL_STATUSES.has(
                        current.status
                    )
                ) {
                    throw discernmentError(
                        'CASE_CLOSED',
                        'This ministry discernment case is already closed.'
                    );
                }

                if (
                    !allowedStatuses.includes(
                        current.status
                    )
                ) {
                    throw discernmentError(
                        'INVALID_DISCERNMENT_TRANSITION',
                        `Cannot move discernment from ${current.status} to ${nextStatus}.`
                    );
                }

                const closedAt =
                    TERMINAL_STATUSES.has(nextStatus)
                        ? 'CURRENT_TIMESTAMP'
                        : 'NULL';

                const update = await run(
                    db,
                    `
                    UPDATE ministry_discernment_cases
                    SET
                        status = ?,
                        updated_at = CURRENT_TIMESTAMP,
                        closed_at = ${closedAt}
                    WHERE id = ?
                      AND status = ?
                    `,
                    [
                        nextStatus,
                        normalizedCaseId,
                        current.status
                    ]
                );

                if (update.changes !== 1) {
                    throw discernmentError(
                        'CASE_UPDATE_CONFLICT',
                        'Discernment case changed unexpectedly.'
                    );
                }

                await appendEvent(
                    db,
                    {
                        caseId: normalizedCaseId,
                        eventType,
                        actorUserId,
                        actorName: actor,
                        visibility,
                        details
                    }
                );

                const saved = await get(
                    db,
                    `
                    SELECT *
                    FROM ministry_discernment_cases
                    WHERE id = ?
                    `,
                    [normalizedCaseId]
                );

                await run(db, 'COMMIT');

                return saved;
            } catch (error) {
                await rollbackQuietly(db);
                throw error;
            }
        }
    );
}

async function completeConsultation(
    db,
    options
) {
    return mutateCase(
        db,
        {
            ...options,
            allowedStatuses: [
                'intent_submitted',
                'consultation_pending'
            ],
            nextStatus: 'consultation_complete',
            eventType: 'leader_consultation_completed',
            visibility: 'leadership'
        }
    );
}

async function beginAssessment(
    db,
    options
) {
    return mutateCase(
        db,
        {
            ...options,
            allowedStatuses: [
                'consultation_complete'
            ],
            nextStatus: 'assessment_pending',
            eventType: 'assessment_started',
            visibility: 'leadership'
        }
    );
}

async function completeAssessment(
    db,
    options
) {
    return mutateCase(
        db,
        {
            ...options,
            allowedStatuses: [
                'assessment_pending'
            ],
            nextStatus: 'assessment_complete',
            eventType: 'assessment_completed',
            visibility: 'leadership'
        }
    );
}

async function recommend(
    db,
    {
        recommended,
        ...options
    }
) {
    return mutateCase(
        db,
        {
            ...options,
            allowedStatuses: [
                'consultation_complete',
                'assessment_complete'
            ],
            nextStatus:
                recommended
                    ? 'recommended'
                    : 'not_recommended',
            eventType:
                recommended
                    ? 'recommended'
                    : 'not_recommended',
            visibility: 'leadership',
            details: {
                ...(options.details || {}),
                assessment_required:
                    options.assessmentRequired === true
            }
        }
    );
}

async function completeDiscernment(
    db,
    options
) {
    return mutateCase(
        db,
        {
            ...options,
            allowedStatuses: [
                'recommended'
            ],
            nextStatus: 'completed',
            eventType: 'discernment_completed',
            visibility: 'leadership'
        }
    );
}

async function withdrawDiscernment(
    db,
    options
) {
    return mutateCase(
        db,
        {
            ...options,
            allowedStatuses: [
                'intent_submitted',
                'consultation_pending',
                'consultation_complete',
                'assessment_pending',
                'assessment_complete',
                'recommended'
            ],
            nextStatus: 'withdrawn',
            eventType: 'discernment_withdrawn',
            visibility: 'member'
        }
    );
}

async function listCaseEvents(
    db,
    caseId
) {
    const id = normalizeId(caseId);

    if (!id) {
        return [];
    }

    return all(
        db,
        `
        SELECT *
        FROM ministry_discernment_events
        WHERE case_id = ?
        ORDER BY id ASC
        `,
        [id]
    );
}

module.exports = Object.freeze({
    SOURCE_TYPES,
    openDiscernmentCase,
    completeConsultation,
    beginAssessment,
    completeAssessment,
    recommend,
    completeDiscernment,
    withdrawDiscernment,
    listCaseEvents
});
