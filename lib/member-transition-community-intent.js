'use strict';

const ALLOWED_CHOICES = new Set([
    'yes',
    'discerning',
    'not_now'
]);

const ALLOWED_INTAKE_KINDS = new Set([
    'accelerated_confirmation',
    'adult_historical'
]);

const declarationQueues = new WeakMap();

function declarationError(code, message) {
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

async function rollbackQuietly(db) {
    try {
        await run(db, 'ROLLBACK');
    } catch (_) {
        // Preserve original error.
    }
}

async function withDeclarationQueue(
    db,
    operation
) {
    const previous =
        declarationQueues.get(db) ||
        Promise.resolve();

    let tracked;

    const current = previous
        .catch(() => {})
        .then(operation);

    tracked = current.finally(() => {
        if (
            declarationQueues.get(db) ===
            tracked
        ) {
            declarationQueues.delete(db);
        }
    });

    declarationQueues.set(db, tracked);

    return tracked;
}

async function latestDeclaration(
    db,
    intakeId
) {
    return get(
        db,
        `
        SELECT *
        FROM member_transition_community_declarations
        WHERE intake_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [intakeId]
    );
}

async function submitCommunityDeclaration(
    db,
    {
        youthId,
        intakeId,
        choice,
        statementText = null,
        actorUserId = null,
        actorName,
        now = new Date()
    }
) {
    const memberId = normalizeId(youthId);
    const transitionIntakeId =
        normalizeId(intakeId);
    const actorId =
        normalizeId(actorUserId);
    const normalizedChoice =
        normalizeText(choice);
    const statement =
        normalizeText(statementText);
    const actor =
        normalizeText(actorName);

    if (
        !memberId ||
        !transitionIntakeId
    ) {
        throw declarationError(
            'INVALID_DECLARATION_TARGET',
            'A valid member and transition intake are required.'
        );
    }

    if (
        !ALLOWED_CHOICES.has(
            normalizedChoice
        )
    ) {
        throw declarationError(
            'INVALID_COMMUNITY_INTENT_CHOICE',
            'Invalid Community Intent choice.'
        );
    }

    if (!actor) {
        throw declarationError(
            'ACTOR_REQUIRED',
            'An authenticated member identity is required.'
        );
    }

    const submittedAt =
        now instanceof Date
            ? now.toISOString()
            : new Date(now).toISOString();

    if (
        !submittedAt ||
        submittedAt === 'Invalid Date'
    ) {
        throw declarationError(
            'INVALID_TIMESTAMP',
            'A valid declaration timestamp is required.'
        );
    }

    return withDeclarationQueue(
        db,
        async () => {
            await run(
                db,
                'BEGIN IMMEDIATE'
            );

            try {
                const intake = await get(
                    db,
                    `
                    SELECT
                        id,
                        youth_id,
                        intake_kind,
                        status,
                        community_intent_choice
                    FROM member_transition_intakes
                    WHERE id = ?
                    `,
                    [transitionIntakeId]
                );

                if (!intake) {
                    throw declarationError(
                        'INTAKE_NOT_FOUND',
                        'Transition intake not found.'
                    );
                }

                if (
                    Number(intake.youth_id) !==
                    memberId
                ) {
                    throw declarationError(
                        'INTAKE_OWNER_MISMATCH',
                        'This transition intake belongs to another member.'
                    );
                }

                if (
                    !ALLOWED_INTAKE_KINDS.has(
                        intake.intake_kind
                    )
                ) {
                    throw declarationError(
                        'INVALID_INTAKE_KIND',
                        'This intake cannot receive a transition Community confirmation.'
                    );
                }

                if (
                    intake.status === 'closed'
                ) {
                    throw declarationError(
                        'INTAKE_CLOSED',
                        'This transition intake is already closed.'
                    );
                }

                const previous =
                    await latestDeclaration(
                        db,
                        transitionIntakeId
                    );

                if (
                    previous &&
                    previous.choice ===
                        normalizedChoice &&
                    normalizeText(
                        previous.statement_text
                    ) === statement
                ) {
                    await run(
                        db,
                        'ROLLBACK'
                    );

                    return {
                        submitted: false,
                        idempotent: true,
                        declaration: previous
                    };
                }

                const inserted =
                    await run(
                        db,
                        `
                        INSERT INTO
                            member_transition_community_declarations (
                                intake_id,
                                youth_id,
                                choice,
                                statement_text,
                                previous_declaration_id,
                                actor_user_id,
                                actor_name,
                                created_at
                            )
                        VALUES (
                            ?, ?, ?, ?, ?, ?, ?, ?
                        )
                        `,
                        [
                            transitionIntakeId,
                            memberId,
                            normalizedChoice,
                            statement || null,
                            previous
                                ? Number(previous.id)
                                : null,
                            actorId,
                            actor,
                            submittedAt
                        ]
                    );

                const intakeUpdate =
                    await run(
                        db,
                        `
                        UPDATE member_transition_intakes
                        SET
                            community_intent_choice = ?,
                            updated_at = ?
                        WHERE id = ?
                          AND youth_id = ?
                        `,
                        [
                            normalizedChoice,
                            submittedAt,
                            transitionIntakeId,
                            memberId
                        ]
                    );

                if (
                    intakeUpdate.changes !== 1
                ) {
                    throw declarationError(
                        'INTAKE_UPDATE_CONFLICT',
                        'Transition intake changed unexpectedly.'
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
                        'MEMBER_TRANSITION_COMMUNITY_INTENT',
                        ?,
                        ?
                    )
                    `,
                    [
                        actor,
                        `Member ID ${memberId} submitted transition Community Intent choice '${normalizedChoice}' for Intake ${transitionIntakeId}`,
                        submittedAt
                    ]
                );

                const saved = await get(
                    db,
                    `
                    SELECT *
                    FROM member_transition_community_declarations
                    WHERE id = ?
                    `,
                    [inserted.lastID]
                );

                await run(
                    db,
                    'COMMIT'
                );

                return {
                    submitted: true,
                    idempotent: false,
                    declaration: saved
                };
            } catch (error) {
                await rollbackQuietly(db);
                throw error;
            }
        }
    );
}

module.exports = Object.freeze({
    ALLOWED_CHOICES,
    submitCommunityDeclaration,
    latestDeclaration
});
