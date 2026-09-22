'use strict';

const CommunityIntent =
    require('./member-transition-community-intent');

const MinistryJourney =
    require('./ministry-service-journey');

const Discernment =
    require('./ministry-discernment-journey');

const initQueues = new WeakMap();

const TERMINAL_DISCERNMENT_STATUSES =
    new Set([
        'completed',
        'withdrawn',
        'not_recommended'
    ]);

function httpError(
    code,
    message,
    status = 400
) {
    return Object.assign(
        new Error(message),
        {
            code,
            status
        }
    );
}

function normalizeId(value) {
    const id = Number(value);

    return Number.isSafeInteger(id) &&
        id > 0
        ? id
        : null;
}

function normalizeText(value) {
    return typeof value === 'string'
        ? value.trim()
        : '';
}

function run(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.run(
                sql,
                params,
                function onRun(error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        lastID:
                            this.lastID,
                        changes:
                            this.changes
                    });
                }
            );
        }
    );
}

function get(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.get(
                sql,
                params,
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        row || null
                    );
                }
            );
        }
    );
}

function all(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.all(
                sql,
                params,
                (error, rows) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        rows || []
                    );
                }
            );
        }
    );
}

async function rollbackQuietly(db) {
    try {
        await run(
            db,
            'ROLLBACK'
        );
    } catch (_) {
        // Preserve original error.
    }
}

async function withInitQueue(
    db,
    operation
) {
    const previous =
        initQueues.get(db) ||
        Promise.resolve();

    let tracked;

    const current =
        previous
            .catch(() => {})
            .then(operation);

    tracked =
        current.finally(() => {
            if (
                initQueues.get(db) ===
                tracked
            ) {
                initQueues.delete(db);
            }
        });

    initQueues.set(
        db,
        tracked
    );

    return tracked;
}

function actorFromRequest(req) {
    const auth =
        req && req.auth
            ? req.auth
            : {};

    const memberName =
        auth.member &&
        normalizeText(
            auth.member.name
        );

    return {
        youthId:
            normalizeId(
                auth.youthId
            ),

        userId:
            normalizeId(
                auth.userId
            ),

        actorName:
            memberName ||
            normalizeText(
                auth.username
            ) ||
            'Member'
    };
}

function sendJson(
    res,
    status,
    payload
) {
    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private'
    );

    res.setHeader(
        'Pragma',
        'no-cache'
    );

    return res
        .status(status)
        .json(payload);
}

function mapError(error) {
    const code =
        error &&
        typeof error.code ===
            'string'
            ? error.code
            : 'TRANSITION_REQUEST_FAILED';

    const explicitStatus =
        error &&
        Number.isInteger(
            error.status
        )
            ? error.status
            : null;

    if (explicitStatus) {
        return {
            status:
                explicitStatus,
            code
        };
    }

    if (
        code.includes(
            'OWNER_MISMATCH'
        ) ||
        code ===
            'CASE_OWNER_MISMATCH'
    ) {
        return {
            status: 403,
            code
        };
    }

    if (
        code.includes(
            'NOT_FOUND'
        )
    ) {
        return {
            status: 404,
            code
        };
    }

    if (
        code.includes(
            'CONFLICT'
        ) ||
        code ===
            'ACTIVE_DISCERNMENT_PRIORITY_CONFLICT' ||
        code ===
            'PRIORITY_MINISTRY_REQUIRED' ||
        code ===
            'CASE_CLOSED' ||
        code ===
            'INTAKE_CLOSED'
    ) {
        return {
            status: 409,
            code
        };
    }

    return {
        status: 400,
        code
    };
}

async function currentIntake(
    db,
    youthId
) {
    return get(
        db,
        `
        SELECT *
        FROM member_transition_intakes
        WHERE youth_id = ?
        ORDER BY
            CASE
                WHEN status = 'closed'
                THEN 1
                ELSE 0
            END ASC,
            id DESC
        LIMIT 1
        `,
        [youthId]
    );
}

async function latestLegacyTransition(
    db,
    youthId
) {
    return get(
        db,
        `
        SELECT
            id,
            standing_class,
            completion_basis,
            phases_grandfathered_json,
            applied_at
        FROM growth_legacy_transitions
        WHERE youth_id = ?
          AND standing_class IN (
                'formal_member',
                'active_servant'
          )
        ORDER BY
            applied_at DESC,
            id DESC
        LIMIT 1
        `,
        [youthId]
    );
}

async function ensureAcceleratedIntake(
    db,
    {
        youthId,
        actorName
    }
) {
    const memberId =
        normalizeId(youthId);

    const actor =
        normalizeText(
            actorName
        ) || 'Member';

    if (!memberId) {
        throw httpError(
            'AUTH_MEMBER_REQUIRED',
            'Authenticated member identity is required.',
            401
        );
    }

    return withInitQueue(
        db,
        async () => {
            await run(
                db,
                'BEGIN IMMEDIATE'
            );

            try {
                const existing =
                    await currentIntake(
                        db,
                        memberId
                    );

                if (existing) {
                    await run(
                        db,
                        'ROLLBACK'
                    );

                    return {
                        created: false,
                        idempotent: true,
                        intake:
                            existing
                    };
                }

                const member =
                    await get(
                        db,
                        `
                        SELECT id
                        FROM youth
                        WHERE id = ?
                        `,
                        [memberId]
                    );

                if (!member) {
                    throw httpError(
                        'MEMBER_NOT_FOUND',
                        'Member record not found.',
                        404
                    );
                }

                const legacy =
                    await latestLegacyTransition(
                        db,
                        memberId
                    );

                if (!legacy) {
                    throw httpError(
                        'TRANSITION_NOT_ELIGIBLE',
                        'This member does not require accelerated transition onboarding.',
                        409
                    );
                }

                const insert =
                    await run(
                        db,
                        `
                        INSERT OR IGNORE
                        INTO member_transition_intakes (
                            youth_id,
                            intake_kind,
                            status,
                            answers_json
                        )
                        VALUES (
                            ?,
                            'accelerated_confirmation',
                            'draft',
                            '{}'
                        )
                        `,
                        [memberId]
                    );

                const saved =
                    await currentIntake(
                        db,
                        memberId
                    );

                if (!saved) {
                    throw httpError(
                        'INTAKE_INITIALIZATION_FAILED',
                        'Transition intake could not be initialized.',
                        500
                    );
                }

                if (
                    insert.changes === 1
                ) {
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
                            'MEMBER_TRANSITION_INITIALIZED',
                            ?,
                            CURRENT_TIMESTAMP
                        )
                        `,
                        [
                            actor,
                            `Initialized accelerated transition intake for Member ID ${memberId}`
                        ]
                    );
                }

                await run(
                    db,
                    'COMMIT'
                );

                return {
                    created:
                        insert.changes === 1,
                    idempotent:
                        insert.changes !== 1,
                    intake:
                        saved
                };
            } catch (error) {
                await rollbackQuietly(
                    db
                );

                throw error;
            }
        }
    );
}

function sanitizedDeclaration(
    declaration
) {
    if (!declaration) {
        return null;
    }

    return {
        id:
            Number(
                declaration.id
            ),

        choice:
            declaration.choice,

        statement_text:
            declaration
                .statement_text ||
            null,

        created_at:
            declaration.created_at
    };
}

function sanitizedCase(
    row
) {
    if (!row) {
        return null;
    }

    return {
        id:
            Number(row.id),

        ministry_id:
            Number(
                row.ministry_id
            ),

        source_type:
            row.source_type,

        status:
            row.status,

        intent_text:
            row.intent_text,

        availability:
            row.availability ||
            null,

        gifts_text:
            row.gifts_text ||
            null,

        growth_hopes_text:
            row.growth_hopes_text ||
            null,

        wants_leader_conversation:
            Number(
                row.wants_leader_conversation
            ) === 1,

        priority_at_open:
            Number(
                row.priority_at_open
            ) === 1,

        opened_at:
            row.opened_at,

        updated_at:
            row.updated_at,

        closed_at:
            row.closed_at ||
            null
    };
}

async function buildMemberTransitionState(
    db,
    youthId
) {
    const memberId =
        normalizeId(youthId);

    if (!memberId) {
        throw httpError(
            'AUTH_MEMBER_REQUIRED',
            'Authenticated member identity is required.',
            401
        );
    }

    const member =
        await get(
            db,
            `
            SELECT
                id,
                name,
                account_tier
            FROM youth
            WHERE id = ?
            `,
            [memberId]
        );

    if (!member) {
        throw httpError(
            'MEMBER_NOT_FOUND',
            'Member record not found.',
            404
        );
    }

    const intake =
        await currentIntake(
            db,
            memberId
        );

    const legacy =
        await latestLegacyTransition(
            db,
            memberId
        );

    const declaration =
        intake
            ? await CommunityIntent
                .latestDeclaration(
                    db,
                    intake.id
                )
            : null;

    const candidates =
        await MinistryJourney
            .listPriorityCandidates(
                db,
                memberId
            );

    const priorities =
        candidates.filter(
            item =>
                Number(
                    item.is_priority
                ) === 1
        );

    const openCases =
        await all(
            db,
            `
            SELECT *
            FROM ministry_discernment_cases
            WHERE youth_id = ?
              AND status NOT IN (
                    'completed',
                    'withdrawn',
                    'not_recommended'
              )
            ORDER BY
                opened_at DESC,
                id DESC
            `,
            [memberId]
        );

    const priority =
        priorities.length === 1
            ? priorities[0]
            : null;

    const priorityCase =
        priority
            ? openCases.find(
                item =>
                    Number(
                        item.ministry_id
                    ) ===
                    Number(
                        priority.ministry_id
                    )
            ) || null
            : null;

    const memberVisibleEvents =
        priorityCase
            ? await all(
                db,
                `
                SELECT
                    id,
                    event_type,
                    details_json,
                    created_at
                FROM ministry_discernment_events
                WHERE case_id = ?
                  AND visibility = 'member'
                ORDER BY id ASC
                `,
                [priorityCase.id]
            )
            : [];

    const transitionEligible =
        Boolean(
            intake ||
            legacy
        );

    const requiresInitialization =
        !intake &&
        Boolean(legacy);

    const communityConfirmed =
        Boolean(
            declaration &&
            declaration.choice ===
                'yes'
        );

    const priorityConflict =
        priorities.length > 1;

    const needsPriority =
        candidates.length > 0 &&
        priorities.length !== 1;

    const servingHistorically =
        Boolean(
            (
                legacy &&
                legacy.standing_class ===
                    'active_servant'
            ) ||
            (
                intake &&
                intake.service_state ===
                    'current'
            )
        );

    const adultHistoricalIntake =
        Boolean(
            intake &&
            intake.intake_kind ===
                'adult_historical'
        );

    let nextAction = 'none';

    if (
        intake &&
        intake.status === 'closed'
    ) {
        nextAction =
            'transition_closed';
    } else if (
        transitionEligible &&
        requiresInitialization
    ) {
        nextAction =
            'initialize_transition';
    } else if (
        adultHistoricalIntake &&
        [
            'draft',
            'needs_changes'
        ].includes(
            intake.status
        )
    ) {
        nextAction =
            'adult_intake_questionnaire';
    } else if (
        adultHistoricalIntake &&
        intake.status ===
            'submitted'
    ) {
        nextAction =
            'adult_intake_submitted';
    } else if (
        adultHistoricalIntake &&
        intake.status ===
            'under_review'
    ) {
        nextAction =
            'adult_intake_under_review';
    } else if (
        adultHistoricalIntake &&
        intake.status ===
            'approved'
    ) {
        nextAction =
            'adult_intake_awaiting_recognition';
    } else if (
        intake &&
        !communityConfirmed
    ) {
        nextAction =
            'community_intent';
    } else if (
        intake &&
        needsPriority
    ) {
        nextAction =
            'priority_ministry';
    } else if (
        intake &&
        priority &&
        !priorityCase
    ) {
        nextAction =
            'ministry_discernment';
    } else if (
        intake &&
        priorityCase
    ) {
        nextAction =
            'discernment_in_progress';
    } else if (
        intake &&
        servingHistorically &&
        candidates.length === 0
    ) {
        nextAction =
            'awaiting_ministry_verification';
    } else if (
        intake
    ) {
        nextAction =
            'transition_current';
    }

    return {
        eligible:
            transitionEligible,

        requires_initialization:
            requiresInitialization,

        member: {
            id:
                Number(member.id),
            name:
                member.name,
            account_tier:
                member.account_tier ||
                null
        },

        historical_transition:
            legacy
                ? {
                    standing_class:
                        legacy
                            .standing_class,
                    completion_basis:
                        legacy
                            .completion_basis,
                    applied_at:
                        legacy
                            .applied_at
                }
                : null,

        intake:
            intake
                ? {
                    id:
                        Number(
                            intake.id
                        ),
                    intake_kind:
                        intake
                            .intake_kind,
                    status:
                        intake.status,
                    community_intent_choice:
                        intake
                            .community_intent_choice ||
                        null,
                    service_state:
                        intake
                            .service_state ||
                        null,
                    submitted_at:
                        intake
                            .submitted_at ||
                        null,
                    recognized_at:
                        intake
                            .recognized_at ||
                        null
                }
                : null,

        community: {
            confirmed:
                communityConfirmed,
            latest:
                sanitizedDeclaration(
                    declaration
                )
        },

        ministries: {
            eligible_count:
                candidates.length,

            priority_conflict:
                priorityConflict,

            needs_priority:
                needsPriority,

            priority:
                priority || null,

            candidates
        },

        discernment: {
            open_case:
                sanitizedCase(
                    priorityCase
                ),

            member_visible_events:
                memberVisibleEvents.map(
                    event => ({
                        id:
                            Number(
                                event.id
                            ),

                        event_type:
                            event.event_type,

                        details_json:
                            event.details_json,

                        created_at:
                            event.created_at
                    })
                )
        },

        next_action:
            nextAction
    };
}

async function requireCurrentIntake(
    db,
    youthId
) {
    const intake =
        await currentIntake(
            db,
            youthId
        );

    if (!intake) {
        throw httpError(
            'TRANSITION_INTAKE_REQUIRED',
            'Start your transition journey first.',
            409
        );
    }

    if (
        intake.status === 'closed'
    ) {
        throw httpError(
            'INTAKE_CLOSED',
            'This transition journey is already closed.',
            409
        );
    }

    return intake;
}

async function requireConfirmedCommunityIntent(
    db,
    intake
) {
    const declaration =
        await CommunityIntent
            .latestDeclaration(
                db,
                intake.id
            );

    if (
        !declaration ||
        declaration.choice !== 'yes'
    ) {
        throw httpError(
            'COMMUNITY_INTENT_REQUIRED',
            'Confirm your desire to journey with FOG before continuing.',
            409
        );
    }

    return declaration;
}

function registerMemberTransitionRoutes({
    app,
    db,
    requireAuth
}) {
    if (
        !app ||
        typeof app.get !==
            'function' ||
        typeof app.post !==
            'function'
    ) {
        throw new Error(
            'Express app is required.'
        );
    }

    if (
        !db ||
        typeof db.get !==
            'function'
    ) {
        throw new Error(
            'SQLite database is required.'
        );
    }

    if (
        typeof requireAuth !==
        'function'
    ) {
        throw new Error(
            'requireAuth middleware is required.'
        );
    }

    async function handle(
        req,
        res,
        operation
    ) {
        try {
            const identity =
                actorFromRequest(req);

            if (!identity.youthId) {
                return sendJson(
                    res,
                    401,
                    {
                        success: false,
                        error:
                            'Authenticated member identity is required.'
                    }
                );
            }

            return await operation(
                identity
            );
        } catch (error) {
            const mapped =
                mapError(error);

            console.error(
                '[Member Transition]',
                error &&
                error.code
                    ? error.code
                    : error
            );

            return sendJson(
                res,
                mapped.status,
                {
                    success: false,
                    code:
                        mapped.code,
                    error:
                        error &&
                        error.message
                            ? error.message
                            : 'Transition request failed.'
                }
            );
        }
    }

    app.get(
        '/api/member-transition/me',
        requireAuth,
        async (req, res) =>
            handle(
                req,
                res,
                async identity => {
                    const state =
                        await buildMemberTransitionState(
                            db,
                            identity.youthId
                        );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            state
                        }
                    );
                }
            )
    );

    app.post(
        '/api/member-transition/me/initialize',
        requireAuth,
        async (req, res) =>
            handle(
                req,
                res,
                async identity => {
                    const initialized =
                        await ensureAcceleratedIntake(
                            db,
                            {
                                youthId:
                                    identity.youthId,
                                actorName:
                                    identity.actorName
                            }
                        );

                    const state =
                        await buildMemberTransitionState(
                            db,
                            identity.youthId
                        );

                    return sendJson(
                        res,
                        initialized.created
                            ? 201
                            : 200,
                        {
                            success: true,
                            initialized,
                            state
                        }
                    );
                }
            )
    );


    /*
     * Existing Adult Member Intake
     *
     * These routes are intentionally self-scoped. The canonical
     * member identity comes only from req.auth.youthId; browser
     * payloads cannot nominate another member or acting identity.
     *
     * Questionnaire history remains self-reported until leadership
     * review + recognition. These routes do not create Growth
     * standing, canonical Community Intent, ministry membership,
     * or canonical Priority Ministry.
     */
    const AdultIntakeDomain =
        require(
            './member-transition-intake'
        );

    const adultIntakeHttpError =
        (
            message,
            code,
            status
        ) => {
            const error =
                new Error(
                    message
                );

            error.code =
                code;

            error.status =
                status;

            return error;
        };

    const adultIntakeErrorStatus =
        error => {
            if (
                Number.isInteger(
                    error &&
                    error.status
                )
            ) {
                return error.status;
            }

            const code =
                error &&
                error.code;

            if (
                code ===
                    'INTAKE_NOT_FOUND' ||
                code ===
                    'MEMBER_NOT_FOUND'
            ) {
                return 404;
            }

            if (
                code ===
                    'INTAKE_NOT_EDITABLE' ||
                code ===
                    'ADULT_INTAKE_REQUIRED' ||
                code ===
                    'INTAKE_CLOSED'
            ) {
                return 409;
            }

            if (
                typeof code ===
                    'string' &&
                (
                    code.startsWith(
                        'INVALID_'
                    ) ||
                    code ===
                        'PRIORITY_REQUIRED' ||
                    code ===
                        'DUPLICATE_MINISTRY'
                )
            ) {
                return 400;
            }

            return 500;
        };

    const sendAdultIntakeError =
        (
            res,
            error
        ) => {
            const status =
                adultIntakeErrorStatus(
                    error
                );

            if (status >= 500) {
                console.error(
                    '[MEMBER_TRANSITION_ADULT_INTAKE]',
                    error
                );
            }

            return res
                .status(
                    status
                )
                .json({
                    success:
                        false,

                    code:
                        (
                            error &&
                            error.code
                        ) ||
                        'ADULT_INTAKE_ERROR',

                    error:
                        status >= 500
                            ? 'Adult intake could not be processed.'
                            : (
                                error &&
                                error.message
                            ) ||
                              'Adult intake could not be processed.'
                });
        };

    const authenticatedAdultYouthId =
        req => {
            const youthId =
                Number(
                    req.auth &&
                    req.auth.youthId
                );

            if (
                !Number.isInteger(
                    youthId
                ) ||
                youthId <= 0
            ) {
                throw adultIntakeHttpError(
                    'Authentication required.',
                    'AUTHENTICATION_REQUIRED',
                    401
                );
            }

            return youthId;
        };

    const loadOwnedAdultIntake =
        async req => {
            const youthId =
                authenticatedAdultYouthId(
                    req
                );

            const intake =
                await get(
                    db,
                    `
                    SELECT *
                    FROM member_transition_intakes
                    WHERE youth_id = ?
                      AND intake_version = ?
                      AND intake_kind =
                            'adult_historical'
                    ORDER BY id DESC
                    LIMIT 1
                    `,
                    [
                        youthId,
                        AdultIntakeDomain
                            .INTAKE_VERSION
                    ]
                );

            if (!intake) {
                throw adultIntakeHttpError(
                    'Your historical member intake has not been opened by leadership yet.',
                    'ADULT_INTAKE_REQUIRED',
                    409
                );
            }

            return {
                youthId,
                intake
            };
        };

    const parseAdultAnswers =
        intake => {
            try {
                const parsed =
                    JSON.parse(
                        intake.answers_json ||
                        '{}'
                    );

                return (
                    parsed &&
                    typeof parsed ===
                        'object' &&
                    !Array.isArray(
                        parsed
                    )
                )
                    ? parsed
                    : {};
            } catch (_) {
                return {};
            }
        };

    const adultIntakePayload =
        req => {
            const body =
                req.body &&
                typeof req.body ===
                    'object' &&
                !Array.isArray(
                    req.body
                )
                    ? req.body
                    : {};

            const answers =
                body.answers ===
                    undefined
                    ? {}
                    : body.answers;

            const ministries =
                body.reported_ministries ===
                    undefined
                    ? []
                    : body
                        .reported_ministries;

            if (
                !answers ||
                typeof answers !==
                    'object' ||
                Array.isArray(
                    answers
                )
            ) {
                throw adultIntakeHttpError(
                    'Questionnaire answers must be an object.',
                    'INVALID_ANSWERS',
                    400
                );
            }

            if (
                !Array.isArray(
                    ministries
                )
            ) {
                throw adultIntakeHttpError(
                    'Reported ministries must be an array.',
                    'INVALID_REPORTED_MINISTRIES',
                    400
                );
            }

            if (
                ministries.length > 25
            ) {
                throw adultIntakeHttpError(
                    'Too many reported ministries.',
                    'INVALID_REPORTED_MINISTRIES',
                    400
                );
            }

            const serviceState =
                body.service_state ===
                    undefined
                    ? null
                    : body
                        .service_state;

            const bytes =
                Buffer.byteLength(
                    JSON.stringify({
                        service_state:
                            serviceState,
                        answers,
                        reported_ministries:
                            ministries
                    }),
                    'utf8'
                );

            if (
                bytes >
                64 * 1024
            ) {
                throw adultIntakeHttpError(
                    'Questionnaire data is too large.',
                    'INTAKE_PAYLOAD_TOO_LARGE',
                    413
                );
            }

            return {
                serviceState,
                answers,
                ministries
            };
        };

    app.get(
        '/api/member-transition/me/intake',
        requireAuth,
        async (req, res) => {
            try {
                const {
                    youthId,
                    intake
                } =
                    await loadOwnedAdultIntake(
                        req
                    );

                const ministries =
                    await AdultIntakeDomain
                        .getReportedMinistries(
                            db,
                            intake.id
                        );

                const state =
                    await buildMemberTransitionState(
                        db,
                        youthId
                    );

                return res
                    .status(200)
                    .json({
                        success: true,

                        intake: {
                            id:
                                Number(
                                    intake.id
                                ),

                            intake_kind:
                                intake
                                    .intake_kind,

                            status:
                                intake.status,

                            service_state:
                                intake
                                    .service_state ||
                                null,

                            answers:
                                parseAdultAnswers(
                                    intake
                                ),

                            submitted_at:
                                intake
                                    .submitted_at ||
                                null,

                            review_started_at:
                                intake
                                    .review_started_at ||
                                null,

                            updated_at:
                                intake
                                    .updated_at ||
                                null
                        },

                        reported_ministries:
                            ministries,

                        next_action:
                            state
                                .next_action
                    });
            } catch (error) {
                return sendAdultIntakeError(
                    res,
                    error
                );
            }
        }
    );

    app.post(
        '/api/member-transition/me/intake/draft',
        requireAuth,
        async (req, res) => {
            try {
                const {
                    youthId,
                    intake
                } =
                    await loadOwnedAdultIntake(
                        req
                    );

                const payload =
                    adultIntakePayload(
                        req
                    );

                const saved =
                    await AdultIntakeDomain
                        .saveDraftIntake(
                            db,
                            {
                                intakeId:
                                    intake.id,

                                youthId,

                                serviceState:
                                    payload
                                        .serviceState,

                                answers:
                                    payload
                                        .answers,

                                reportedMinistries:
                                    payload
                                        .ministries
                            }
                        );

                const state =
                    await buildMemberTransitionState(
                        db,
                        youthId
                    );

                return res
                    .status(200)
                    .json({
                        success: true,
                        saved: true,
                        intake: {
                            id:
                                Number(
                                    saved.id
                                ),
                            status:
                                saved.status,
                            service_state:
                                saved
                                    .service_state ||
                                null
                        },
                        next_action:
                            state
                                .next_action
                    });
            } catch (error) {
                return sendAdultIntakeError(
                    res,
                    error
                );
            }
        }
    );

    app.post(
        '/api/member-transition/me/intake/submit',
        requireAuth,
        async (req, res) => {
            try {
                const {
                    youthId,
                    intake
                } =
                    await loadOwnedAdultIntake(
                        req
                    );

                const payload =
                    adultIntakePayload(
                        req
                    );

                const actorName =
                    (
                        req.auth &&
                        req.auth.member &&
                        typeof req.auth
                            .member.name ===
                            'string' &&
                        req.auth.member
                            .name.trim()
                    )
                        ? req.auth
                            .member.name
                            .trim()
                        : (
                            req.auth &&
                            typeof req.auth
                                .username ===
                                'string'
                        )
                            ? req.auth
                                .username
                            : 'FOG Member';

                const submitted =
                    await AdultIntakeDomain
                        .submitIntake(
                            db,
                            {
                                intakeId:
                                    intake.id,

                                youthId,

                                serviceState:
                                    payload
                                        .serviceState,

                                answers:
                                    payload
                                        .answers,

                                reportedMinistries:
                                    payload
                                        .ministries,

                                actorName
                            }
                        );

                const state =
                    await buildMemberTransitionState(
                        db,
                        youthId
                    );

                return res
                    .status(200)
                    .json({
                        success: true,
                        submitted: true,
                        intake: {
                            id:
                                Number(
                                    submitted.id
                                ),
                            status:
                                submitted.status,
                            submitted_at:
                                submitted
                                    .submitted_at ||
                                null
                        },
                        next_action:
                            state
                                .next_action
                    });
            } catch (error) {
                return sendAdultIntakeError(
                    res,
                    error
                );
            }
        }
    );

    app.post(
        '/api/member-transition/me/community-intent',
        requireAuth,
        async (req, res) =>
            handle(
                req,
                res,
                async identity => {
                    const intake =
                        await requireCurrentIntake(
                            db,
                            identity.youthId
                        );

                    const result =
                        await CommunityIntent
                            .submitCommunityDeclaration(
                                db,
                                {
                                    youthId:
                                        identity.youthId,

                                    intakeId:
                                        intake.id,

                                    choice:
                                        req.body &&
                                        req.body.choice,

                                    statementText:
                                        req.body &&
                                        req.body
                                            .statement_text,

                                    actorUserId:
                                        identity.userId,

                                    actorName:
                                        identity.actorName
                                }
                            );

                    const state =
                        await buildMemberTransitionState(
                            db,
                            identity.youthId
                        );

                    return sendJson(
                        res,
                        result.submitted
                            ? 201
                            : 200,
                        {
                            success: true,
                            result,
                            state
                        }
                    );
                }
            )
    );

    app.post(
        '/api/member-transition/me/priority/:mappingId',
        requireAuth,
        async (req, res) =>
            handle(
                req,
                res,
                async identity => {
                    const mappingId =
                        normalizeId(
                            req.params &&
                            req.params
                                .mappingId
                        );

                    if (!mappingId) {
                        throw httpError(
                            'INVALID_PRIORITY_TARGET',
                            'A valid ministry membership is required.'
                        );
                    }

                    const intake =
                        await requireCurrentIntake(
                            db,
                            identity.youthId
                        );

                    await requireConfirmedCommunityIntent(
                        db,
                        intake
                    );

                    const result =
                        await MinistryJourney
                            .setPriorityMinistry(
                                db,
                                {
                                    youthId:
                                        identity.youthId,

                                    mappingId,

                                    actorUserId:
                                        identity.userId,

                                    actorName:
                                        identity.actorName,

                                    source:
                                        'member_profile',

                                    reason:
                                        'Member selected Priority Ministry during transition.'
                                }
                            );

                    const state =
                        await buildMemberTransitionState(
                            db,
                            identity.youthId
                        );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            result,
                            state
                        }
                    );
                }
            )
    );

    app.post(
        '/api/member-transition/me/discernment',
        requireAuth,
        async (req, res) =>
            handle(
                req,
                res,
                async identity => {
                    const intake =
                        await requireCurrentIntake(
                            db,
                            identity.youthId
                        );

                    await requireConfirmedCommunityIntent(
                        db,
                        intake
                    );

                    const candidates =
                        await MinistryJourney
                            .listPriorityCandidates(
                                db,
                                identity.youthId
                            );

                    const priorities =
                        candidates.filter(
                            item =>
                                Number(
                                    item.is_priority
                                ) === 1
                        );

                    if (
                        priorities.length !== 1
                    ) {
                        throw httpError(
                            'PRIORITY_MINISTRY_REQUIRED',
                            'Choose exactly one Priority Ministry before beginning discernment.',
                            409
                        );
                    }

                    const priority =
                        priorities[0];

                    const sourceType =
                        intake.intake_kind ===
                            'adult_historical'
                            ? 'adult_intake'
                            : 'accelerated_transition';

                    const result =
                        await Discernment
                            .openDiscernmentCase(
                                db,
                                {
                                    youthId:
                                        identity.youthId,

                                    ministryId:
                                        priority.ministry_id,

                                    sourceType,

                                    sourceIntakeId:
                                        intake.id,

                                    intentText:
                                        req.body &&
                                        req.body
                                            .intent_text,

                                    availability:
                                        req.body &&
                                        req.body
                                            .availability,

                                    giftsText:
                                        req.body &&
                                        req.body
                                            .gifts_text,

                                    growthHopesText:
                                        req.body &&
                                        req.body
                                            .growth_hopes_text,

                                    wantsLeaderConversation:
                                        !(
                                            req.body &&
                                            req.body
                                                .wants_leader_conversation ===
                                                false
                                        ),

                                    actorUserId:
                                        identity.userId,

                                    actorName:
                                        identity.actorName
                                }
                            );

                    const state =
                        await buildMemberTransitionState(
                            db,
                            identity.youthId
                        );

                    return sendJson(
                        res,
                        result.opened
                            ? 201
                            : 200,
                        {
                            success: true,
                            result,
                            state
                        }
                    );
                }
            )
    );

    app.post(
        '/api/member-transition/me/discernment/:caseId/withdraw',
        requireAuth,
        async (req, res) =>
            handle(
                req,
                res,
                async identity => {
                    const caseId =
                        normalizeId(
                            req.params &&
                            req.params.caseId
                        );

                    if (!caseId) {
                        throw httpError(
                            'INVALID_CASE',
                            'A valid discernment case is required.'
                        );
                    }

                    await requireCurrentIntake(
                        db,
                        identity.youthId
                    );

                    const result =
                        await Discernment
                            .withdrawDiscernment(
                                db,
                                {
                                    caseId,

                                    youthId:
                                        identity.youthId,

                                    actorUserId:
                                        identity.userId,

                                    actorName:
                                        identity.actorName,

                                    details: {
                                        reason:
                                            normalizeText(
                                                req.body &&
                                                req.body.reason
                                            ) ||
                                            null
                                    }
                                }
                            );

                    const state =
                        await buildMemberTransitionState(
                            db,
                            identity.youthId
                        );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            result,
                            state
                        }
                    );
                }
            )
    );
}

module.exports = Object.freeze({
    actorFromRequest,
    buildMemberTransitionState,
    ensureAcceleratedIntake,
    registerMemberTransitionRoutes
});
