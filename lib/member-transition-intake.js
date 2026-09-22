'use strict';

const INTAKE_VERSION = 'member-transition-v1';

const INTAKE_KINDS = new Set([
    'adult_historical',
    'accelerated_confirmation'
]);

const SERVICE_STATES = new Set([
    'none',
    'current',
    'former',
    'interested'
]);

const REVIEW_DECISIONS = new Set([
    'approved',
    'needs_changes',
    'declined'
]);

const PROPOSED_STANDINGS = new Set([
    'none',
    'formal_member',
    'active_servant',
    'uncertain'
]);

function transitionError(code, message) {
    return Object.assign(new Error(message), { code });
}

function normalizeId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) return reject(err);
            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

async function rollbackQuietly(db) {
    try {
        await run(db, 'ROLLBACK');
    } catch (_) {
        // Preserve the original error.
    }
}

async function withImmediateTransaction(db, work) {
    await run(db, 'BEGIN IMMEDIATE');
    try {
        const result = await work();
        await run(db, 'COMMIT');
        return result;
    } catch (err) {
        await rollbackQuietly(db);
        throw err;
    }
}

async function requireYouth(db, youthId) {
    const id = normalizeId(youthId);
    if (!id) {
        throw transitionError(
            'INVALID_MEMBER',
            'A valid member is required.'
        );
    }

    const member = await get(
        db,
        'SELECT id, name FROM youth WHERE id = ?',
        [id]
    );

    if (!member) {
        throw transitionError(
            'MEMBER_NOT_FOUND',
            'Member not found.'
        );
    }

    return member;
}

async function requireOwnedIntake(db, intakeId, youthId) {
    const normalizedIntakeId = normalizeId(intakeId);
    const normalizedYouthId = normalizeId(youthId);

    if (!normalizedIntakeId || !normalizedYouthId) {
        throw transitionError(
            'INVALID_INTAKE',
            'A valid transition intake is required.'
        );
    }

    const intake = await get(
        db,
        `SELECT *
         FROM member_transition_intakes
         WHERE id = ?
           AND youth_id = ?`,
        [normalizedIntakeId, normalizedYouthId]
    );

    if (!intake) {
        throw transitionError(
            'INTAKE_NOT_FOUND',
            'Transition intake not found.'
        );
    }

    return intake;
}

async function createIntake(db, {
    youthId,
    intakeKind,
    intakeVersion = INTAKE_VERSION
}) {
    const member = await requireYouth(db, youthId);

    if (!INTAKE_KINDS.has(intakeKind)) {
        throw transitionError(
            'INVALID_INTAKE_KIND',
            'Unsupported transition intake type.'
        );
    }

    await run(
        db,
        `INSERT OR IGNORE INTO member_transition_intakes
            (youth_id, intake_version, intake_kind)
         VALUES (?, ?, ?)`,
        [member.id, intakeVersion, intakeKind]
    );

    return get(
        db,
        `SELECT *
         FROM member_transition_intakes
         WHERE youth_id = ?
           AND intake_version = ?
           AND intake_kind = ?`,
        [member.id, intakeVersion, intakeKind]
    );
}

function normalizeReportedMinistry(item) {
    if (!item || typeof item !== 'object') {
        throw transitionError(
            'INVALID_MINISTRY_HISTORY',
            'Invalid ministry history entry.'
        );
    }

    const ministryId = item.ministry_id == null
        ? null
        : normalizeId(item.ministry_id);

    const name = typeof item.ministry_name_snapshot === 'string'
        ? item.ministry_name_snapshot.trim()
        : '';

    const serviceState = item.service_state;

    if (!name) {
        throw transitionError(
            'MINISTRY_NAME_REQUIRED',
            'A ministry name is required.'
        );
    }

    if (!['current', 'former'].includes(serviceState)) {
        throw transitionError(
            'INVALID_MINISTRY_SERVICE_STATE',
            'Invalid ministry service state.'
        );
    }

    return {
        ministry_id: ministryId,
        ministry_name_snapshot: name,
        service_state: serviceState,
        reported_role:
            typeof item.reported_role === 'string'
                ? item.reported_role.trim() || null
                : null,
        started_when:
            typeof item.started_when === 'string'
                ? item.started_when.trim() || null
                : null,
        assignment_kind:
            ['formal', 'informal', 'unsure'].includes(item.assignment_kind)
                ? item.assignment_kind
                : null,
        wants_discernment: item.wants_discernment ? 1 : 0,
        selected_priority: item.selected_priority ? 1 : 0,
        notes:
            typeof item.notes === 'string'
                ? item.notes.trim() || null
                : null
    };
}

function enforceReportedPriority(ministries) {
    const current = ministries.filter(
        item => item.service_state === 'current'
    );

    for (const item of ministries) {
        if (item.service_state !== 'current') {
            item.selected_priority = 0;
        }
    }

    if (current.length === 1) {
        current[0].selected_priority = 1;
        return ministries;
    }

    if (current.length > 1) {
        const selected = current.filter(
            item => item.selected_priority === 1
        );

        if (selected.length !== 1) {
            throw transitionError(
                'PRIORITY_REQUIRED',
                'Choose exactly one priority ministry.'
            );
        }
    }

    return ministries;
}

function assertNoDuplicateMinistries(ministries) {
    const seen = new Set();

    for (const ministry of ministries) {
        const key = ministry.ministry_id
            ? `id:${ministry.ministry_id}`
            : `name:${ministry.ministry_name_snapshot.toLowerCase()}`;

        if (seen.has(key)) {
            throw transitionError(
                'DUPLICATE_MINISTRY',
                'The same ministry was reported more than once.'
            );
        }

        seen.add(key);
    }
}


async function saveDraftIntake(db, {
    intakeId,
    youthId,
    serviceState = null,
    answers = {},
    reportedMinistries = []
}) {
    if (
        serviceState !== null &&
        !SERVICE_STATES.has(serviceState)
    ) {
        throw transitionError(
            'INVALID_SERVICE_STATE',
            'Invalid service state.'
        );
    }

    if (
        !answers ||
        typeof answers !== 'object' ||
        Array.isArray(answers)
    ) {
        throw transitionError(
            'INVALID_ANSWERS',
            'Questionnaire answers must be an object.'
        );
    }

    if (!Array.isArray(reportedMinistries)) {
        throw transitionError(
            'INVALID_REPORTED_MINISTRIES',
            'Reported ministries must be an array.'
        );
    }

    const ministries =
        reportedMinistries.map(
            normalizeReportedMinistry
        );

    /*
     * Drafts intentionally do NOT enforce Priority Ministry yet.
     * A member may save an incomplete questionnaire and continue
     * later. Final submitIntake() remains authoritative and
     * requires exactly one reported priority when applicable.
     */
    assertNoDuplicateMinistries(
        ministries
    );

    return withImmediateTransaction(
        db,
        async () => {
            const intake =
                await requireOwnedIntake(
                    db,
                    intakeId,
                    youthId
                );

            if (
                ![
                    'draft',
                    'needs_changes'
                ].includes(
                    intake.status
                )
            ) {
                throw transitionError(
                    'INTAKE_NOT_EDITABLE',
                    'This transition intake can no longer be edited.'
                );
            }

            await run(
                db,
                `DELETE FROM
                    member_transition_reported_ministries
                 WHERE intake_id = ?`,
                [intake.id]
            );

            for (
                const ministry
                of ministries
            ) {
                await run(
                    db,
                    `INSERT INTO
                        member_transition_reported_ministries (
                            intake_id,
                            ministry_id,
                            ministry_name_snapshot,
                            service_state,
                            reported_role,
                            started_when,
                            assignment_kind,
                            wants_discernment,
                            selected_priority,
                            notes
                        )
                     VALUES (
                        ?, ?, ?, ?, ?, ?,
                        ?, ?, ?, ?
                     )`,
                    [
                        intake.id,
                        ministry.ministry_id,
                        ministry
                            .ministry_name_snapshot,
                        ministry.service_state,
                        ministry.reported_role,
                        ministry.started_when,
                        ministry.assignment_kind,
                        ministry.wants_discernment,
                        ministry.selected_priority,
                        ministry.notes
                    ]
                );
            }

            await run(
                db,
                `UPDATE member_transition_intakes
                 SET service_state = ?,
                     answers_json = ?,
                     updated_at =
                        CURRENT_TIMESTAMP
                 WHERE id = ?
                   AND youth_id = ?`,
                [
                    serviceState,
                    JSON.stringify(
                        answers
                    ),
                    intake.id,
                    youthId
                ]
            );

            return get(
                db,
                `SELECT *
                 FROM member_transition_intakes
                 WHERE id = ?`,
                [intake.id]
            );
        }
    );
}

async function submitIntake(db, {
    intakeId,
    youthId,
    serviceState = null,
    answers = {},
    reportedMinistries = [],
    actorName = null
}) {
    if (
        serviceState !== null &&
        !SERVICE_STATES.has(serviceState)
    ) {
        throw transitionError(
            'INVALID_SERVICE_STATE',
            'Invalid service state.'
        );
    }

    if (
        !answers ||
        typeof answers !== 'object' ||
        Array.isArray(answers)
    ) {
        throw transitionError(
            'INVALID_ANSWERS',
            'Questionnaire answers must be an object.'
        );
    }

    if (!Array.isArray(reportedMinistries)) {
        throw transitionError(
            'INVALID_REPORTED_MINISTRIES',
            'Reported ministries must be an array.'
        );
    }

    const ministries = reportedMinistries.map(
        normalizeReportedMinistry
    );

    assertNoDuplicateMinistries(ministries);
    enforceReportedPriority(ministries);

    return withImmediateTransaction(db, async () => {
        const intake = await requireOwnedIntake(
            db,
            intakeId,
            youthId
        );

        if (!['draft', 'needs_changes'].includes(intake.status)) {
            throw transitionError(
                'INTAKE_NOT_EDITABLE',
                'This transition intake can no longer be submitted.'
            );
        }

        await run(
            db,
            `DELETE FROM member_transition_reported_ministries
             WHERE intake_id = ?`,
            [intake.id]
        );

        for (const ministry of ministries) {
            await run(
                db,
                `INSERT INTO member_transition_reported_ministries (
                    intake_id,
                    ministry_id,
                    ministry_name_snapshot,
                    service_state,
                    reported_role,
                    started_when,
                    assignment_kind,
                    wants_discernment,
                    selected_priority,
                    notes
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    intake.id,
                    ministry.ministry_id,
                    ministry.ministry_name_snapshot,
                    ministry.service_state,
                    ministry.reported_role,
                    ministry.started_when,
                    ministry.assignment_kind,
                    ministry.wants_discernment,
                    ministry.selected_priority,
                    ministry.notes
                ]
            );
        }

        await run(
            db,
            `UPDATE member_transition_intakes
             SET status = 'submitted',
                 service_state = ?,
                 answers_json = ?,
                 submitted_at = CURRENT_TIMESTAMP,
                 review_started_at = NULL,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?
               AND youth_id = ?`,
            [
                serviceState,
                JSON.stringify(answers),
                intake.id,
                youthId
            ]
        );

        const actor =
            typeof actorName === 'string'
                ? actorName.trim()
                : '';

        if (actor) {
            await run(
                db,
                `INSERT INTO activity_logs (
                    username,
                    action,
                    details,
                    created_at
                 ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [
                    actor,
                    'MEMBER_TRANSITION_INTAKE_SUBMITTED',
                    JSON.stringify({
                        intake_id:
                            Number(intake.id),
                        youth_id:
                            Number(youthId),
                        intake_kind:
                            intake.intake_kind
                    })
                ]
            );
        }

        return get(
            db,
            'SELECT * FROM member_transition_intakes WHERE id = ?',
            [intake.id]
        );
    });
}

async function beginReview(db, {
    intakeId,
    youthId
}) {
    return withImmediateTransaction(db, async () => {
        const intake = await requireOwnedIntake(
            db,
            intakeId,
            youthId
        );

        if (!['submitted', 'under_review'].includes(intake.status)) {
            throw transitionError(
                'INTAKE_NOT_REVIEWABLE',
                'This transition intake is not ready for review.'
            );
        }

        await run(
            db,
            `UPDATE member_transition_intakes
             SET status = 'under_review',
                 review_started_at =
                    COALESCE(review_started_at, CURRENT_TIMESTAMP),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [intake.id]
        );

        return get(
            db,
            'SELECT * FROM member_transition_intakes WHERE id = ?',
            [intake.id]
        );
    });
}

async function recordReview(db, {
    intakeId,
    youthId,
    reviewerUserId = null,
    reviewerName,
    decision,
    proposedStanding = null,
    proposedPhases = [],
    decisionData = {},
    notes = null
}) {
    if (!REVIEW_DECISIONS.has(decision)) {
        throw transitionError(
            'INVALID_REVIEW_DECISION',
            'Invalid review decision.'
        );
    }

    const reviewer = typeof reviewerName === 'string'
        ? reviewerName.trim()
        : '';

    if (!reviewer) {
        throw transitionError(
            'REVIEWER_REQUIRED',
            'Reviewer identity is required.'
        );
    }

    if (
        proposedStanding !== null &&
        !PROPOSED_STANDINGS.has(proposedStanding)
    ) {
        throw transitionError(
            'INVALID_PROPOSED_STANDING',
            'Invalid proposed standing.'
        );
    }

    if (!Array.isArray(proposedPhases)) {
        throw transitionError(
            'INVALID_PROPOSED_PHASES',
            'Proposed phases must be an array.'
        );
    }

    return withImmediateTransaction(db, async () => {
        const intake = await requireOwnedIntake(
            db,
            intakeId,
            youthId
        );

        if (!['submitted', 'under_review'].includes(intake.status)) {
            throw transitionError(
                'INTAKE_NOT_REVIEWABLE',
                'This transition intake is not ready for review.'
            );
        }

        const inserted = await run(
            db,
            `INSERT INTO member_transition_reviews (
                intake_id,
                reviewer_user_id,
                reviewer_name,
                decision,
                proposed_standing,
                proposed_phases_json,
                decision_json,
                review_notes
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                intake.id,
                normalizeId(reviewerUserId),
                reviewer,
                decision,
                proposedStanding,
                JSON.stringify(proposedPhases),
                JSON.stringify(decisionData || {}),
                typeof notes === 'string'
                    ? notes.trim() || null
                    : null
            ]
        );

        const nextStatus =
            decision === 'approved'
                ? 'approved'
                : decision === 'needs_changes'
                    ? 'needs_changes'
                    : 'closed';

        await run(
            db,
            `UPDATE member_transition_intakes
             SET status = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [nextStatus, intake.id]
        );

        return get(
            db,
            'SELECT * FROM member_transition_reviews WHERE id = ?',
            [inserted.lastID]
        );
    });
}

async function getReportedMinistries(db, intakeId) {
    const id = normalizeId(intakeId);
    if (!id) return [];

    return all(
        db,
        `SELECT *
         FROM member_transition_reported_ministries
         WHERE intake_id = ?
         ORDER BY selected_priority DESC, id ASC`,
        [id]
    );
}

module.exports = Object.freeze({
    INTAKE_VERSION,
    createIntake,
    saveDraftIntake,
    submitIntake,
    beginReview,
    recordReview,
    getReportedMinistries
});
