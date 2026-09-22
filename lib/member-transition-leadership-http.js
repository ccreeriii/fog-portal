'use strict';

const TransitionIntake =
    require('./member-transition-intake');

const TransitionRecognition =
    require('./member-transition-recognition');

const MinistryDiscernment =
    require('./ministry-discernment-journey');

const MAX_STRUCTURED_JSON_BYTES = 16 * 1024;
const MAX_NOTES_LENGTH = 8000;

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
    const id =
        Number(value);

    return Number.isSafeInteger(id) &&
        id > 0
        ? id
        : null;
}

function normalizeText(
    value,
    maxLength = MAX_NOTES_LENGTH
) {
    if (typeof value !== 'string') {
        return '';
    }

    const text =
        value.trim();

    if (
        text.length >
        maxLength
    ) {
        throw httpError(
            'TEXT_TOO_LONG',
            'Submitted text is too long.'
        );
    }

    return text;
}

function normalizeStructuredObject(
    value,
    label = 'Details'
) {
    if (
        value === null ||
        value === undefined
    ) {
        return {};
    }

    if (
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        throw httpError(
            'INVALID_STRUCTURED_DATA',
            `${label} must be an object.`
        );
    }

    let encoded;

    try {
        encoded =
            JSON.stringify(value);
    } catch (_) {
        throw httpError(
            'INVALID_STRUCTURED_DATA',
            `${label} could not be saved.`
        );
    }

    if (
        Buffer.byteLength(
            encoded,
            'utf8'
        ) >
        MAX_STRUCTURED_JSON_BYTES
    ) {
        throw httpError(
            'STRUCTURED_DATA_TOO_LARGE',
            `${label} is too large.`
        );
    }

    return value;
}

function safeJson(value, fallback) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return fallback;
    }

    if (
        typeof value === 'object'
    ) {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
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

function actorFromRequest(
    req,
    getActorName
) {
    const auth =
        req && req.auth
            ? req.auth
            : {};

    const userId =
        normalizeId(
            auth.userId
        );

    let actorName = '';

    if (
        typeof getActorName ===
        'function'
    ) {
        actorName =
            normalizeText(
                getActorName(req),
                250
            );
    }

    if (!actorName) {
        actorName =
            normalizeText(
                auth.member &&
                auth.member.name,
                250
            ) ||
            normalizeText(
                auth.username,
                250
            ) ||
            (
                normalizeId(
                    auth.youthId
                )
                    ? `Member ${normalizeId(auth.youthId)}`
                    : ''
            );
    }

    if (!actorName) {
        throw httpError(
            'ACTOR_REQUIRED',
            'Authenticated leadership identity is required.',
            403
        );
    }

    return {
        userId,
        actorName
    };
}

function mapError(error) {
    const code =
        error &&
        typeof error.code ===
            'string'
            ? error.code
            : 'LEADERSHIP_TRANSITION_REQUEST_FAILED';

    if (
        error &&
        Number.isInteger(
            error.status
        )
    ) {
        return {
            status:
                error.status,
            code
        };
    }

    const notFound =
        new Set([
            'INTAKE_NOT_FOUND',
            'MEMBER_NOT_FOUND',
            'CASE_NOT_FOUND'
        ]);

    if (
        notFound.has(code) ||
        code.endsWith(
            '_NOT_FOUND'
        )
    ) {
        return {
            status: 404,
            code
        };
    }

    const conflicts =
        new Set([
            'INTAKE_NOT_REVIEWABLE',
            'INTAKE_NOT_APPROVED',
            'APPROVED_REVIEW_REQUIRED',
            'RECOGNITION_NOT_REQUIRED',
            'PROPOSAL_BELOW_EXISTING_STANDING',
            'PHASE_PAUSED',
            'PHASE_UPDATE_CONFLICT',
            'INTAKE_UPDATE_CONFLICT',
            'CASE_CLOSED',
            'INVALID_DISCERNMENT_TRANSITION',
            'CASE_UPDATE_CONFLICT'
        ]);

    if (
        conflicts.has(code)
    ) {
        return {
            status: 409,
            code
        };
    }

    if (
        code ===
            'CASE_OWNER_MISMATCH'
    ) {
        return {
            status: 403,
            code
        };
    }

    const clientError =
        code.startsWith('INVALID_') ||
        code.endsWith('_REQUIRED') ||
        code === 'TEXT_TOO_LONG' ||
        code === 'STRUCTURED_DATA_TOO_LARGE';

    if (clientError) {
        return {
            status: 400,
            code
        };
    }

    /*
     * Unknown database, filesystem, programming, and infrastructure
     * failures are server errors. Never misclassify them as bad
     * member/leadership input.
     */
    return {
        status: 500,
        code
    };
}

async function loadIntake(
    db,
    intakeId
) {
    const id =
        normalizeId(
            intakeId
        );

    if (!id) {
        throw httpError(
            'INVALID_INTAKE',
            'A valid transition intake is required.'
        );
    }

    const intake =
        await get(
            db,
            `
            SELECT
                i.*,
                y.name AS member_name,
                y.email AS member_email,
                y.qr_code AS member_code
            FROM member_transition_intakes i
            JOIN youth y
              ON y.id = i.youth_id
            WHERE i.id = ?
            `,
            [id]
        );

    if (!intake) {
        throw httpError(
            'INTAKE_NOT_FOUND',
            'Transition intake not found.',
            404
        );
    }

    return intake;
}

async function loadDiscernmentCase(
    db,
    caseId
) {
    const id =
        normalizeId(
            caseId
        );

    if (!id) {
        throw httpError(
            'INVALID_CASE',
            'A valid discernment case is required.'
        );
    }

    const row =
        await get(
            db,
            `
            SELECT
                c.*,
                y.name AS member_name,
                m.name AS ministry_name
            FROM ministry_discernment_cases c
            JOIN youth y
              ON y.id = c.youth_id
            JOIN ministries m
              ON m.id = c.ministry_id
            WHERE c.id = ?
            `,
            [id]
        );

    if (!row) {
        throw httpError(
            'CASE_NOT_FOUND',
            'Ministry discernment case not found.',
            404
        );
    }

    return row;
}

function sanitizeIntake(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,

        id:
            Number(row.id),

        youth_id:
            Number(
                row.youth_id
            ),

        answers:
            safeJson(
                row.answers_json,
                {}
            )
    };
}

function sanitizeReview(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,

        id:
            Number(row.id),

        intake_id:
            Number(
                row.intake_id
            ),

        proposed_phases:
            safeJson(
                row.proposed_phases_json,
                []
            ),

        decision_data:
            safeJson(
                row.decision_json,
                {}
            )
    };
}

function sanitizeEvent(row) {
    if (!row) {
        return null;
    }

    return {
        ...row,

        id:
            Number(row.id),

        case_id:
            Number(
                row.case_id
            ),

        details:
            safeJson(
                row.details_json,
                {}
            )
    };
}

function registerMemberTransitionLeadershipRoutes({
    app,
    db,
    requireAllPermissions,
    getActorName = null,
    domains = {}
}) {
    if (
        !app ||
        typeof app.get !== 'function' ||
        typeof app.post !== 'function'
    ) {
        throw new Error(
            'Express app is required.'
        );
    }

    if (
        !db ||
        typeof db.get !== 'function' ||
        typeof db.all !== 'function'
    ) {
        throw new Error(
            'SQLite database is required.'
        );
    }

    if (
        typeof requireAllPermissions !==
        'function'
    ) {
        throw new Error(
            'requireAllPermissions is required.'
        );
    }

    const intakeDomain =
        domains.intake ||
        TransitionIntake;

    const recognitionDomain =
        domains.recognition ||
        TransitionRecognition;

    const discernmentDomain =
        domains.discernment ||
        MinistryDiscernment;

    const growthLeadership =
        requireAllPermissions([
            'access_discipleship',
            'edit_entries'
        ]);

    const ministryLeadership =
        requireAllPermissions([
            'access_ministries',
            'edit_entries'
        ]);

    async function handle(
        req,
        res,
        operation
    ) {
        try {
            return await operation();
        } catch (error) {
            const mapped =
                mapError(error);

            console.error(
                '[Transition Leadership]',
                mapped.code
            );

            const safeMessage =
                mapped.status >= 500
                    ? 'Leadership transition request failed.'
                    : (
                        error &&
                        error.message
                            ? error.message
                            : 'Leadership transition request failed.'
                    );

            return sendJson(
                res,
                mapped.status,
                {
                    success: false,
                    code:
                        mapped.code,
                    error:
                        safeMessage
                }
            );
        }
    }

    /*
     * ----------------------------------------------------------
     * ADULT / HISTORICAL MEMBER TRANSITION — DISCIPLESHIP
     * ----------------------------------------------------------
     */

    app.get(
        '/api/admin/member-transitions',
        growthLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    const rows =
                        await all(
                            db,
                            `
                            SELECT
                                i.id,
                                i.youth_id,
                                i.intake_version,
                                i.intake_kind,
                                i.status,
                                i.community_intent_choice,
                                i.service_state,
                                i.submitted_at,
                                i.review_started_at,
                                i.recognized_at,
                                i.created_at,
                                i.updated_at,
                                y.name AS member_name,
                                y.email AS member_email,
                                y.qr_code AS member_code,

                                (
                                    SELECT r.id
                                    FROM member_transition_reviews r
                                    WHERE r.intake_id = i.id
                                    ORDER BY r.id DESC
                                    LIMIT 1
                                ) AS latest_review_id,

                                (
                                    SELECT r.decision
                                    FROM member_transition_reviews r
                                    WHERE r.intake_id = i.id
                                    ORDER BY r.id DESC
                                    LIMIT 1
                                ) AS latest_review_decision,

                                (
                                    SELECT r.proposed_standing
                                    FROM member_transition_reviews r
                                    WHERE r.intake_id = i.id
                                    ORDER BY r.id DESC
                                    LIMIT 1
                                ) AS proposed_standing,

                                (
                                    SELECT rec.id
                                    FROM member_transition_recognitions rec
                                    WHERE rec.intake_id = i.id
                                    LIMIT 1
                                ) AS recognition_id

                            FROM member_transition_intakes i
                            JOIN youth y
                              ON y.id = i.youth_id
                            ORDER BY
                                i.updated_at DESC,
                                i.id DESC
                            `
                        );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            intakes:
                                rows
                        }
                    );
                }
            )
    );

    app.get(
        '/api/admin/member-transitions/:intakeId',
        growthLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    const intake =
                        await loadIntake(
                            db,
                            req.params.intakeId
                        );

                    const [
                        ministries,
                        reviews,
                        declarations,
                        recognition
                    ] =
                        await Promise.all([
                            all(
                                db,
                                `
                                SELECT *
                                FROM member_transition_reported_ministries
                                WHERE intake_id = ?
                                ORDER BY
                                    selected_priority DESC,
                                    id ASC
                                `,
                                [intake.id]
                            ),

                            all(
                                db,
                                `
                                SELECT *
                                FROM member_transition_reviews
                                WHERE intake_id = ?
                                ORDER BY id ASC
                                `,
                                [intake.id]
                            ),

                            all(
                                db,
                                `
                                SELECT *
                                FROM member_transition_community_declarations
                                WHERE intake_id = ?
                                ORDER BY id ASC
                                `,
                                [intake.id]
                            ),

                            get(
                                db,
                                `
                                SELECT *
                                FROM member_transition_recognitions
                                WHERE intake_id = ?
                                LIMIT 1
                                `,
                                [intake.id]
                            )
                        ]);

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,

                            intake:
                                sanitizeIntake(
                                    intake
                                ),

                            reported_ministries:
                                ministries,

                            reviews:
                                reviews.map(
                                    sanitizeReview
                                ),

                            community_declarations:
                                declarations,

                            recognition:
                                recognition ||
                                null
                        }
                    );
                }
            )
    );

    app.post(
        '/api/admin/member-transitions/members/:youthId/adult-intake',
        growthLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    actorFromRequest(
                        req,
                        getActorName
                    );

                    const youthId =
                        normalizeId(
                            req.params.youthId
                        );

                    if (!youthId) {
                        throw httpError(
                            'INVALID_MEMBER',
                            'A valid member is required.'
                        );
                    }

                    const existing =
                        await get(
                            db,
                            `
                            SELECT *
                            FROM member_transition_intakes
                            WHERE youth_id = ?
                              AND intake_version = ?
                              AND intake_kind =
                                    'adult_historical'
                            LIMIT 1
                            `,
                            [
                                youthId,
                                intakeDomain
                                    .INTAKE_VERSION
                            ]
                        );

                    if (existing) {
                        return sendJson(
                            res,
                            200,
                            {
                                success: true,
                                created: false,
                                idempotent: true,
                                intake:
                                    sanitizeIntake(
                                        existing
                                    )
                            }
                        );
                    }

                    const intake =
                        await intakeDomain
                            .createIntake(
                                db,
                                {
                                    youthId,
                                    intakeKind:
                                        'adult_historical'
                                }
                            );

                    return sendJson(
                        res,
                        201,
                        {
                            success: true,
                            created: true,
                            idempotent: false,
                            intake:
                                sanitizeIntake(
                                    intake
                                )
                        }
                    );
                }
            )
    );

    app.post(
        '/api/admin/member-transitions/:intakeId/review/start',
        growthLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    actorFromRequest(
                        req,
                        getActorName
                    );

                    const intake =
                        await loadIntake(
                            db,
                            req.params.intakeId
                        );

                    const reviewed =
                        await intakeDomain
                            .beginReview(
                                db,
                                {
                                    intakeId:
                                        intake.id,

                                    youthId:
                                        intake.youth_id
                                }
                            );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            intake:
                                sanitizeIntake(
                                    reviewed
                                )
                        }
                    );
                }
            )
    );

    app.post(
        '/api/admin/member-transitions/:intakeId/review/needs-changes',
        growthLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    const actor =
                        actorFromRequest(
                            req,
                            getActorName
                        );

                    const intake =
                        await loadIntake(
                            db,
                            req.params.intakeId
                        );

                    const decisionData =
                        normalizeStructuredObject(
                            req.body &&
                            req.body.decision_data,
                            'Review details'
                        );

                    const review =
                        await intakeDomain
                            .recordReview(
                                db,
                                {
                                    intakeId:
                                        intake.id,

                                    youthId:
                                        intake.youth_id,

                                    reviewerUserId:
                                        actor.userId,

                                    reviewerName:
                                        actor.actorName,

                                    decision:
                                        'needs_changes',

                                    proposedStanding:
                                        null,

                                    proposedPhases:
                                        [],

                                    decisionData,

                                    notes:
                                        normalizeText(
                                            req.body &&
                                            req.body.notes
                                        ) ||
                                        null
                                }
                            );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            review:
                                sanitizeReview(
                                    review
                                )
                        }
                    );
                }
            )
    );

    app.post(
        '/api/admin/member-transitions/:intakeId/review/approve',
        growthLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    const actor =
                        actorFromRequest(
                            req,
                            getActorName
                        );

                    const intake =
                        await loadIntake(
                            db,
                            req.params.intakeId
                        );

                    const proposedStanding =
                        normalizeText(
                            req.body &&
                            req.body
                                .proposed_standing,
                            100
                        );

                    if (!proposedStanding) {
                        throw httpError(
                            'PROPOSED_STANDING_REQUIRED',
                            'Choose the historical standing being approved.'
                        );
                    }

                    /*
                     * If the recognition domain knows this standing,
                     * use its canonical phase sequence rather than
                     * trusting the browser to construct one.
                     *
                     * Other proposal types still pass through the
                     * intake domain's validation and remain unable
                     * to bypass recognition validation.
                     */
                    const proposedPhases =
                        Object.prototype
                            .hasOwnProperty.call(
                                recognitionDomain
                                    .RECOGNITION_PHASES ||
                                    {},
                                proposedStanding
                            )
                            ? [
                                ...recognitionDomain
                                    .RECOGNITION_PHASES[
                                        proposedStanding
                                    ]
                            ]
                            : [];

                    const decisionData =
                        normalizeStructuredObject(
                            req.body &&
                            req.body.decision_data,
                            'Review details'
                        );

                    const review =
                        await intakeDomain
                            .recordReview(
                                db,
                                {
                                    intakeId:
                                        intake.id,

                                    youthId:
                                        intake.youth_id,

                                    reviewerUserId:
                                        actor.userId,

                                    reviewerName:
                                        actor.actorName,

                                    decision:
                                        'approved',

                                    proposedStanding,

                                    proposedPhases,

                                    decisionData,

                                    notes:
                                        normalizeText(
                                            req.body &&
                                            req.body.notes
                                        ) ||
                                        null
                                }
                            );

                    /*
                     * IMPORTANT:
                     * Approval does NOT call recognition.
                     * Recognition is an explicit separate endpoint.
                     */
                    return sendJson(
                        res,
                        200,
                        {
                            success: true,

                            review:
                                sanitizeReview(
                                    review
                                ),

                            recognition_pending:
                                true
                        }
                    );
                }
            )
    );

    app.post(
        '/api/admin/member-transitions/:intakeId/reviews/:reviewId/recognize',
        growthLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    const actor =
                        actorFromRequest(
                            req,
                            getActorName
                        );

                    const intakeId =
                        normalizeId(
                            req.params.intakeId
                        );

                    const reviewId =
                        normalizeId(
                            req.params.reviewId
                        );

                    if (!intakeId) {
                        throw httpError(
                            'INVALID_INTAKE',
                            'A valid transition intake is required.'
                        );
                    }

                    if (!reviewId) {
                        throw httpError(
                            'INVALID_REVIEW',
                            'A valid approved review is required.'
                        );
                    }

                    const result =
                        await recognitionDomain
                            .recognizeApprovedIntake(
                                db,
                                intakeId,
                                {
                                    reviewId,

                                    actorUserId:
                                        actor.userId,

                                    actorName:
                                        actor.actorName
                                }
                            );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            result
                        }
                    );
                }
            )
    );

    /*
     * ----------------------------------------------------------
     * MINISTRY DISCERNMENT — MINISTRY LEADERSHIP
     * ----------------------------------------------------------
     */

    app.get(
        '/api/admin/ministry-discernment',
        ministryLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    const cases =
                        await all(
                            db,
                            `
                            SELECT
                                c.*,
                                y.name AS member_name,
                                y.qr_code AS member_code,
                                m.name AS ministry_name
                            FROM ministry_discernment_cases c
                            JOIN youth y
                              ON y.id = c.youth_id
                            JOIN ministries m
                              ON m.id = c.ministry_id
                            ORDER BY
                                CASE
                                    WHEN c.status IN (
                                        'completed',
                                        'withdrawn',
                                        'not_recommended'
                                    )
                                    THEN 1
                                    ELSE 0
                                END ASC,
                                c.updated_at DESC,
                                c.id DESC
                            `
                        );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            cases
                        }
                    );
                }
            )
    );

    app.get(
        '/api/admin/ministry-discernment/:caseId',
        ministryLeadership,
        async (req, res) =>
            handle(
                req,
                res,
                async () => {
                    const discernmentCase =
                        await loadDiscernmentCase(
                            db,
                            req.params.caseId
                        );

                    const events =
                        await discernmentDomain
                            .listCaseEvents(
                                db,
                                discernmentCase.id
                            );

                    return sendJson(
                        res,
                        200,
                        {
                            success: true,
                            case:
                                discernmentCase,
                            events:
                                events.map(
                                    sanitizeEvent
                                )
                        }
                    );
                }
            )
    );

    async function mutateDiscernment(
        req,
        res,
        mutation,
        extra = {}
    ) {
        return handle(
            req,
            res,
            async () => {
                const actor =
                    actorFromRequest(
                        req,
                        getActorName
                    );

                const caseId =
                    normalizeId(
                        req.params.caseId
                    );

                if (!caseId) {
                    throw httpError(
                        'INVALID_CASE',
                        'A valid discernment case is required.'
                    );
                }

                const details =
                    normalizeStructuredObject(
                        req.body &&
                        req.body.details,
                        'Discernment details'
                    );

                const result =
                    await mutation(
                        db,
                        {
                            caseId,

                            actorUserId:
                                actor.userId,

                            actorName:
                                actor.actorName,

                            details,

                            ...extra
                        }
                    );

                return sendJson(
                    res,
                    200,
                    {
                        success: true,
                        case:
                            result
                    }
                );
            }
        );
    }

    app.post(
        '/api/admin/ministry-discernment/:caseId/consultation/complete',
        ministryLeadership,
        async (req, res) =>
            mutateDiscernment(
                req,
                res,
                discernmentDomain
                    .completeConsultation
            )
    );

    app.post(
        '/api/admin/ministry-discernment/:caseId/assessment/start',
        ministryLeadership,
        async (req, res) =>
            mutateDiscernment(
                req,
                res,
                discernmentDomain
                    .beginAssessment
            )
    );

    app.post(
        '/api/admin/ministry-discernment/:caseId/assessment/complete',
        ministryLeadership,
        async (req, res) =>
            mutateDiscernment(
                req,
                res,
                discernmentDomain
                    .completeAssessment
            )
    );

    app.post(
        '/api/admin/ministry-discernment/:caseId/recommendation',
        ministryLeadership,
        async (req, res) => {
            if (
                !req.body ||
                typeof req.body.recommended !==
                    'boolean'
            ) {
                return sendJson(
                    res,
                    400,
                    {
                        success: false,
                        code:
                            'RECOMMENDATION_REQUIRED',
                        error:
                            'Recommendation must be explicitly yes or no.'
                    }
                );
            }

            return mutateDiscernment(
                req,
                res,
                discernmentDomain
                    .recommend,
                {
                    recommended:
                        req.body.recommended,

                    assessmentRequired:
                        req.body
                            .assessment_required ===
                            true
                }
            );
        }
    );

    app.post(
        '/api/admin/ministry-discernment/:caseId/complete',
        ministryLeadership,
        async (req, res) =>
            mutateDiscernment(
                req,
                res,
                discernmentDomain
                    .completeDiscernment
            )
    );

    app.post(
        '/api/admin/ministry-discernment/:caseId/withdraw',
        ministryLeadership,
        async (req, res) =>
            mutateDiscernment(
                req,
                res,
                discernmentDomain
                    .withdrawDiscernment
            )
    );
}

module.exports = Object.freeze({
    actorFromRequest,
    registerMemberTransitionLeadershipRoutes
});
