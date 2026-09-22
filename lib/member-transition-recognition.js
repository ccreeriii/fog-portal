'use strict';

const RECOGNITION_BASIS =
    'transition_review_recognized';

const RECOGNITION_PHASES = Object.freeze({
    none: Object.freeze([]),

    formal_member: Object.freeze([
        'encounter',
        'belong',
        'commit'
    ]),

    active_servant: Object.freeze([
        'encounter',
        'belong',
        'commit',
        'discern',
        'form'
    ])
});

const recognitionQueues = new WeakMap();

function recognitionError(code, message) {
    return Object.assign(
        new Error(message),
        { code }
    );
}

function positiveId(value) {
    const id = Number(value);

    return Number.isSafeInteger(id) && id > 0
        ? id
        : null;
}

function normalizeActor(value) {
    return typeof value === 'string' &&
        value.trim()
        ? value.trim()
        : null;
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(
            sql,
            params,
            function onRun(error) {
                if (error) {
                    reject(error);
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
            (error, row) => {
                if (error) {
                    reject(error);
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
            (error, rows) => {
                if (error) {
                    reject(error);
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
        // Preserve original error.
    }
}

async function withRecognitionQueue(
    db,
    operation
) {
    if (
        !db ||
        typeof db.run !== 'function'
    ) {
        throw recognitionError(
            'DATABASE_REQUIRED',
            'A database connection is required.'
        );
    }

    const previous =
        recognitionQueues.get(db) ||
        Promise.resolve();

    let tracked;

    const current = previous
        .catch(() => {})
        .then(operation);

    tracked = current.finally(() => {
        if (
            recognitionQueues.get(db) ===
            tracked
        ) {
            recognitionQueues.delete(db);
        }
    });

    recognitionQueues.set(db, tracked);

    return tracked;
}

function parsePhaseProposal(raw) {
    let parsed;

    try {
        parsed = JSON.parse(raw || '[]');
    } catch (_) {
        throw recognitionError(
            'INVALID_PHASE_PROPOSAL',
            'Approved phase proposal is invalid.'
        );
    }

    if (
        !Array.isArray(parsed) ||
        parsed.some(
            item =>
                typeof item !== 'string'
        )
    ) {
        throw recognitionError(
            'INVALID_PHASE_PROPOSAL',
            'Approved phase proposal is invalid.'
        );
    }

    return parsed;
}

function exactSequence(left, right) {
    return (
        left.length === right.length &&
        left.every(
            (value, index) =>
                value === right[index]
        )
    );
}

async function loadCanonicalPhases(db) {
    return all(
        db,
        `
        SELECT
            phase.id,
            phase.phase_key,
            phase.phase_order,
            SUM(
                CASE
                    WHEN task.id IS NOT NULL
                     AND task.classification = 'essential'
                     AND task.is_active = 1
                    THEN 1
                    ELSE 0
                END
            ) AS essential_total
        FROM growth_journey_phases phase
        LEFT JOIN growth_tasks task
          ON task.phase_id = phase.id
        WHERE phase.is_active = 1
        GROUP BY
            phase.id,
            phase.phase_key,
            phase.phase_order
        ORDER BY phase.phase_order
        `
    );
}

async function journeySnapshot(
    db,
    youthId
) {
    return all(
        db,
        `
        SELECT
            phase.phase_key,
            phase.phase_order,

            COALESCE(
                progress.status,
                'not_started'
            ) AS status,

            COALESCE(
                progress.progress_percent,
                0
            ) AS progress_percent,

            progress.started_at,
            progress.completed_at,
            progress.completion_basis

        FROM growth_journey_phases phase

        LEFT JOIN growth_phase_progress progress
          ON progress.phase_id = phase.id
         AND progress.youth_id = ?

        WHERE phase.is_active = 1

        ORDER BY phase.phase_order
        `,
        [youthId]
    );
}

function highestCompletedOrder(snapshot) {
    return snapshot.reduce(
        (highest, phase) => {
            if (
                phase.status === 'completed'
            ) {
                return Math.max(
                    highest,
                    Number(phase.phase_order) || 0
                );
            }

            return highest;
        },
        0
    );
}

async function loadApprovedContext(
    db,
    intakeId,
    reviewId
) {
    const intake = await get(
        db,
        `
        SELECT *
        FROM member_transition_intakes
        WHERE id = ?
        `,
        [intakeId]
    );

    if (!intake) {
        throw recognitionError(
            'INTAKE_NOT_FOUND',
            'Transition intake not found.'
        );
    }

    const review = await get(
        db,
        `
        SELECT *
        FROM member_transition_reviews
        WHERE id = ?
          AND intake_id = ?
          AND decision = 'approved'
        `,
        [reviewId, intakeId]
    );

    if (!review) {
        throw recognitionError(
            'APPROVED_REVIEW_REQUIRED',
            'An approved leadership review is required.'
        );
    }

    return {
        intake,
        review
    };
}

async function recognizeApprovedIntake(
    db,
    intakeId,
    {
        reviewId,
        actorUserId = null,
        actorName,
        now = new Date()
    } = {}
) {
    const normalizedIntakeId =
        positiveId(intakeId);

    const normalizedReviewId =
        positiveId(reviewId);

    const normalizedActorUserId =
        positiveId(actorUserId);

    const actor =
        normalizeActor(actorName);

    if (!normalizedIntakeId) {
        throw recognitionError(
            'INVALID_INTAKE',
            'A valid transition intake is required.'
        );
    }

    if (!normalizedReviewId) {
        throw recognitionError(
            'INVALID_REVIEW',
            'A valid approved review is required.'
        );
    }

    if (!actor) {
        throw recognitionError(
            'ACTOR_REQUIRED',
            'Recognition requires an authenticated leadership identity.'
        );
    }

    const recognizedAt =
        now instanceof Date
            ? now.toISOString()
            : new Date(now).toISOString();

    if (
        !recognizedAt ||
        recognizedAt === 'Invalid Date'
    ) {
        throw recognitionError(
            'INVALID_TIMESTAMP',
            'A valid recognition timestamp is required.'
        );
    }

    return withRecognitionQueue(
        db,
        async () => {
            await run(
                db,
                'BEGIN IMMEDIATE'
            );

            try {
                const existing =
                    await get(
                        db,
                        `
                        SELECT *
                        FROM member_transition_recognitions
                        WHERE intake_id = ?
                        LIMIT 1
                        `,
                        [normalizedIntakeId]
                    );

                if (existing) {
                    await run(
                        db,
                        'ROLLBACK'
                    );

                    return {
                        recognized: false,
                        idempotent: true,
                        recognition: existing
                    };
                }

                const {
                    intake,
                    review
                } =
                    await loadApprovedContext(
                        db,
                        normalizedIntakeId,
                        normalizedReviewId
                    );

                if (
                    intake.intake_kind ===
                    'accelerated_confirmation'
                ) {
                    throw recognitionError(
                        'RECOGNITION_NOT_REQUIRED',
                        'Accelerated members already retain their recognized historical Growth standing.'
                    );
                }

                if (
                    intake.intake_kind !==
                    'adult_historical'
                ) {
                    throw recognitionError(
                        'INVALID_RECOGNITION_KIND',
                        'This intake type cannot establish historical standing.'
                    );
                }

                if (intake.status !== 'approved') {
                    throw recognitionError(
                        'INTAKE_NOT_APPROVED',
                        'Leadership approval is required before recognition.'
                    );
                }

                const standing =
                    review.proposed_standing;

                if (
                    !Object.prototype
                        .hasOwnProperty.call(
                            RECOGNITION_PHASES,
                            standing
                        )
                ) {
                    throw recognitionError(
                        'INVALID_RECOGNIZED_STANDING',
                        'The approved standing cannot be recognized automatically.'
                    );
                }

                const expectedPhases =
                    RECOGNITION_PHASES[
                        standing
                    ];

                const proposedPhases =
                    parsePhaseProposal(
                        review.proposed_phases_json
                    );

                if (
                    !exactSequence(
                        proposedPhases,
                        expectedPhases
                    )
                ) {
                    throw recognitionError(
                        'PHASE_PROPOSAL_MISMATCH',
                        'The approved phase proposal does not match the canonical standing.'
                    );
                }

                const canonical =
                    await loadCanonicalPhases(db);

                const byKey =
                    new Map(
                        canonical.map(
                            phase => [
                                phase.phase_key,
                                phase
                            ]
                        )
                    );

                for (
                    const phaseKey
                    of expectedPhases
                ) {
                    if (!byKey.has(phaseKey)) {
                        throw recognitionError(
                            'PHASE_NOT_FOUND',
                            `Canonical phase is missing: ${phaseKey}`
                        );
                    }
                }

                const before =
                    await journeySnapshot(
                        db,
                        intake.youth_id
                    );

                const targetMaxOrder =
                    expectedPhases.length
                        ? Number(
                            byKey.get(
                                expectedPhases[
                                    expectedPhases.length - 1
                                ]
                            ).phase_order
                        )
                        : 0;

                if (
                    highestCompletedOrder(before) >
                    targetMaxOrder
                ) {
                    throw recognitionError(
                        'PROPOSAL_BELOW_EXISTING_STANDING',
                        'The approved proposal is below the member’s existing completed Growth standing.'
                    );
                }

                const appliedPhases = [];

                for (
                    const phaseKey
                    of expectedPhases
                ) {
                    const phase =
                        byKey.get(phaseKey);

                    const existingProgress =
                        await get(
                            db,
                            `
                            SELECT *
                            FROM growth_phase_progress
                            WHERE youth_id = ?
                              AND phase_id = ?
                            `,
                            [
                                intake.youth_id,
                                phase.id
                            ]
                        );

                    if (
                        existingProgress &&
                        existingProgress.status ===
                            'completed'
                    ) {
                        continue;
                    }

                    if (
                        existingProgress &&
                        existingProgress.status ===
                            'paused'
                    ) {
                        throw recognitionError(
                            'PHASE_PAUSED',
                            `Historical recognition requires manual review because ${phaseKey} is paused.`
                        );
                    }

                    const essentialTotal =
                        Number(
                            phase.essential_total
                        ) || 0;

                    /*
                     * Historical recognition completes the PHASE,
                     * not the individual Essential tasks.
                     *
                     * Never manufacture task completion evidence or
                     * inflate essential_completed merely because the
                     * historical phase is being recognized.
                     */
                    const existingEssentialCompleted =
                        existingProgress
                            ? Number(
                                existingProgress.essential_completed
                            ) || 0
                            : 0;

                    const write =
                        await run(
                            db,
                            `
                            INSERT INTO growth_phase_progress (
                                youth_id,
                                phase_id,
                                status,
                                progress_percent,
                                essential_completed,
                                essential_total,
                                started_at,
                                completed_at,
                                completion_basis,
                                updated_at
                            )
                            VALUES (
                                ?,
                                ?,
                                'completed',
                                100,
                                ?,
                                ?,
                                ?,
                                ?,
                                ?,
                                ?
                            )

                            ON CONFLICT(
                                youth_id,
                                phase_id
                            )
                            DO UPDATE SET
                                status = 'completed',

                                progress_percent = MAX(
                                    growth_phase_progress.progress_percent,
                                    excluded.progress_percent
                                ),

                                essential_completed = MAX(
                                    growth_phase_progress.essential_completed,
                                    excluded.essential_completed
                                ),

                                essential_total = MAX(
                                    growth_phase_progress.essential_total,
                                    excluded.essential_total
                                ),

                                started_at = COALESCE(
                                    growth_phase_progress.started_at,
                                    excluded.started_at
                                ),

                                completed_at = COALESCE(
                                    growth_phase_progress.completed_at,
                                    excluded.completed_at
                                ),

                                completion_basis =
                                    CASE
                                        WHEN growth_phase_progress.status = 'completed'
                                        THEN growth_phase_progress.completion_basis
                                        ELSE excluded.completion_basis
                                    END,

                                updated_at =
                                    excluded.updated_at

                            WHERE
                                growth_phase_progress.status
                                NOT IN (
                                    'completed',
                                    'paused'
                                )
                            `,
                            [
                                intake.youth_id,
                                phase.id,
                                existingEssentialCompleted,
                                essentialTotal,
                                recognizedAt,
                                recognizedAt,
                                RECOGNITION_BASIS,
                                recognizedAt
                            ]
                        );

                    if (write.changes !== 1) {
                        throw recognitionError(
                            'PHASE_UPDATE_CONFLICT',
                            `Growth phase changed during recognition: ${phaseKey}`
                        );
                    }

                    appliedPhases.push(
                        phaseKey
                    );
                }

                const after =
                    await journeySnapshot(
                        db,
                        intake.youth_id
                    );

                const idempotencyKey =
                    `member-transition-v1:intake:${normalizedIntakeId}`;

                const recognition =
                    await run(
                        db,
                        `
                        INSERT INTO member_transition_recognitions (
                            intake_id,
                            review_id,
                            youth_id,
                            recognized_standing,
                            completion_basis,
                            recognized_phases_json,
                            previous_journey_json,
                            resulting_journey_json,
                            recognized_by_user_id,
                            recognized_by_name,
                            recognized_at,
                            idempotency_key
                        )
                        VALUES (
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?
                        )
                        `,
                        [
                            normalizedIntakeId,
                            normalizedReviewId,
                            intake.youth_id,
                            standing,
                            RECOGNITION_BASIS,
                            JSON.stringify(
                                expectedPhases
                            ),
                            JSON.stringify(
                                before
                            ),
                            JSON.stringify(
                                after
                            ),
                            normalizedActorUserId,
                            actor,
                            recognizedAt,
                            idempotencyKey
                        ]
                    );

                const intakeUpdate =
                    await run(
                        db,
                        `
                        UPDATE member_transition_intakes
                        SET
                            status = 'recognized',
                            recognized_at = ?,
                            updated_at = ?
                        WHERE id = ?
                          AND status = 'approved'
                        `,
                        [
                            recognizedAt,
                            recognizedAt,
                            normalizedIntakeId
                        ]
                    );

                if (
                    intakeUpdate.changes !== 1
                ) {
                    throw recognitionError(
                        'INTAKE_UPDATE_CONFLICT',
                        'Transition intake changed during recognition.'
                    );
                }

                await run(
                    db,
                    `
                    INSERT INTO activity_logs (
                        username,
                        action,
                        details,
                        created_at
                    )
                    VALUES (
                        ?,
                        'MEMBER_TRANSITION_RECOGNIZED',
                        ?,
                        ?
                    )
                    `,
                    [
                        actor,
                        `Recognized ${standing} historical standing for Member ID ${intake.youth_id} from Transition Intake ${normalizedIntakeId}`,
                        recognizedAt
                    ]
                );

                const saved =
                    await get(
                        db,
                        `
                        SELECT *
                        FROM member_transition_recognitions
                        WHERE id = ?
                        `,
                        [recognition.lastID]
                    );

                await run(
                    db,
                    'COMMIT'
                );

                return {
                    recognized: true,
                    idempotent: false,
                    standing,
                    recognizedPhases:
                        [...expectedPhases],
                    appliedPhases,
                    recognition: saved,
                    journey: after
                };
            } catch (error) {
                await rollbackQuietly(db);
                throw error;
            }
        }
    );
}

module.exports = Object.freeze({
    RECOGNITION_BASIS,
    RECOGNITION_PHASES,
    recognizeApprovedIntake
});
