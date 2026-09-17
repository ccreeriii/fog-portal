'use strict';

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const test =
    require('node:test');

const Leadership =
    require(
        '../lib/member-transition-leadership-http'
    );

function createApp() {
    const routes = [];

    const app = {
        get(
            route,
            ...handlers
        ) {
            routes.push({
                method: 'GET',
                route,
                handlers
            });
        },

        post(
            route,
            ...handlers
        ) {
            routes.push({
                method: 'POST',
                route,
                handlers
            });
        }
    };

    return {
        app,
        routes
    };
}

function permissionFactory() {
    return permissions => {
        const middleware =
            function testPermission(
                req,
                res,
                next
            ) {
                return next();
            };

        middleware.permissions =
            [...permissions];

        return middleware;
    };
}

function fakeDb({
    intake = null,
    caseRow = null
} = {}) {
    return {
        get(
            sql,
            params,
            callback
        ) {
            if (
                sql.includes(
                    'FROM member_transition_intakes i'
                )
            ) {
                callback(
                    null,
                    intake
                );

                return;
            }

            if (
                sql.includes(
                    'FROM ministry_discernment_cases c'
                )
            ) {
                callback(
                    null,
                    caseRow
                );

                return;
            }

            callback(
                null,
                null
            );
        },

        all(
            sql,
            params,
            callback
        ) {
            callback(
                null,
                []
            );
        }
    };
}

function responseHarness() {
    let statusCode = 200;
    let payload = null;

    const res = {
        setHeader() {},

        status(code) {
            statusCode =
                code;

            return this;
        },

        json(value) {
            payload =
                value;

            return value;
        }
    };

    return {
        res,

        result() {
            return {
                statusCode,
                payload
            };
        }
    };
}

function findRoute(
    routes,
    method,
    route
) {
    const found =
        routes.find(
            item =>
                item.method === method &&
                item.route === route
        );

    if (!found) {
        throw new Error(
            `Missing route: ${method} ${route}`
        );
    }

    return found;
}

function register({
    db = fakeDb(),
    domains = {}
} = {}) {
    const {
        app,
        routes
    } =
        createApp();

    Leadership
        .registerMemberTransitionLeadershipRoutes({
            app,
            db,
            requireAllPermissions:
                permissionFactory(),

            getActorName:
                req =>
                    req.auth &&
                    req.auth.member &&
                    req.auth.member.name,

            domains
        });

    return {
        routes,
        db
    };
}

test(
    'leadership transition routes use the canonical split permission matrix',
    () => {
        const {
            routes
        } =
            register();

        assert.equal(
            routes.length,
            15
        );

        for (
            const route
            of routes
        ) {
            const middleware =
                route.handlers[0];

            assert.ok(
                Array.isArray(
                    middleware.permissions
                )
            );

            if (
                route.route.startsWith(
                    '/api/admin/member-transitions'
                )
            ) {
                assert.deepEqual(
                    middleware.permissions,
                    [
                        'access_discipleship',
                        'edit_entries'
                    ]
                );

                continue;
            }

            if (
                route.route.startsWith(
                    '/api/admin/ministry-discernment'
                )
            ) {
                assert.deepEqual(
                    middleware.permissions,
                    [
                        'access_ministries',
                        'edit_entries'
                    ]
                );

                continue;
            }

            assert.fail(
                `Unexpected leadership route: ${route.route}`
            );
        }
    }
);

test(
    'Adult Intake initialization targets an existing Directory member and does not create accounts or claims',
    () => {
        const source =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'lib',
                    'member-transition-leadership-http.js'
                ),
                'utf8'
            );

        assert.ok(
            source.includes(
                "'adult_historical'"
            )
        );

        assert.equal(
            source.includes(
                "INSERT INTO youth"
            ),
            false
        );

        assert.equal(
            source.includes(
                '/api/admin/account-claims'
            ),
            false
        );

        assert.equal(
            source.includes(
                'issue('
            ),
            false
        );
    }
);

test(
    'leadership approval records the approved proposal but never performs recognition automatically',
    async () => {
        let recordedReview =
            null;

        let recognitionCalls =
            0;

        const intakeRow = {
            id: 12,
            youth_id: 44,
            intake_kind:
                'adult_historical',
            intake_version:
                'member-transition-v1',
            status:
                'under_review',
            answers_json:
                '{}',
            member_name:
                'Historical Member',
            member_email:
                null,
            member_code:
                'FOG-MEMBER-044'
        };

        const fakeIntakeDomain = {
            INTAKE_VERSION:
                'member-transition-v1',

            async recordReview(
                db,
                options
            ) {
                recordedReview =
                    options;

                return {
                    id: 90,
                    intake_id:
                        options.intakeId,
                    reviewer_user_id:
                        options
                            .reviewerUserId,
                    reviewer_name:
                        options
                            .reviewerName,
                    decision:
                        options.decision,
                    proposed_standing:
                        options
                            .proposedStanding,
                    proposed_phases_json:
                        JSON.stringify(
                            options
                                .proposedPhases
                        ),
                    decision_json:
                        '{}',
                    review_notes:
                        options.notes,
                    created_at:
                        '2026-09-17'
                };
            }
        };

        const fakeRecognitionDomain = {
            RECOGNITION_PHASES: {
                formal_member: [
                    'encounter',
                    'belong',
                    'commit'
                ]
            },

            async recognizeApprovedIntake() {
                recognitionCalls += 1;

                return {
                    recognized: true
                };
            }
        };

        const {
            routes
        } =
            register({
                db:
                    fakeDb({
                        intake:
                            intakeRow
                    }),

                domains: {
                    intake:
                        fakeIntakeDomain,

                    recognition:
                        fakeRecognitionDomain,

                    discernment: {
                        listCaseEvents:
                            async () => []
                    }
                }
            });

        const route =
            findRoute(
                routes,
                'POST',
                '/api/admin/member-transitions/:intakeId/review/approve'
            );

        const harness =
            responseHarness();

        const req = {
            params: {
                intakeId: '12'
            },

            body: {
                proposed_standing:
                    'formal_member',

                /*
                 * Browser-supplied phase sequence must not
                 * override the canonical recognition map.
                 */
                proposed_phases: [
                    'wrong-phase'
                ],

                notes:
                    'Historical membership verified.'
            },

            auth: {
                userId: 7,

                youthId: 3,

                member: {
                    name:
                        'Growth Leader'
                }
            }
        };

        await route.handlers[
            route.handlers.length - 1
        ](
            req,
            harness.res
        );

        const response =
            harness.result();

        assert.equal(
            response.statusCode,
            200
        );

        assert.equal(
            response.payload.success,
            true
        );

        assert.equal(
            response.payload
                .recognition_pending,
            true
        );

        assert.equal(
            recognitionCalls,
            0
        );

        assert.equal(
            recordedReview.decision,
            'approved'
        );

        assert.equal(
            recordedReview
                .proposedStanding,
            'formal_member'
        );

        assert.deepEqual(
            recordedReview
                .proposedPhases,
            [
                'encounter',
                'belong',
                'commit'
            ]
        );

        assert.equal(
            recordedReview
                .reviewerUserId,
            7
        );

        assert.equal(
            recordedReview
                .reviewerName,
            'Growth Leader'
        );
    }
);

test(
    'historical recognition is a separate explicit leadership action',
    async () => {
        let recognitionCall =
            null;

        const fakeRecognitionDomain = {
            RECOGNITION_PHASES: {},

            async recognizeApprovedIntake(
                db,
                intakeId,
                options
            ) {
                recognitionCall = {
                    intakeId,
                    options
                };

                return {
                    recognized: true,
                    idempotent: false
                };
            }
        };

        const {
            routes
        } =
            register({
                domains: {
                    intake: {
                        INTAKE_VERSION:
                            'member-transition-v1'
                    },

                    recognition:
                        fakeRecognitionDomain,

                    discernment: {
                        listCaseEvents:
                            async () => []
                    }
                }
            });

        const route =
            findRoute(
                routes,
                'POST',
                '/api/admin/member-transitions/:intakeId/reviews/:reviewId/recognize'
            );

        const harness =
            responseHarness();

        await route.handlers[
            route.handlers.length - 1
        ](
            {
                params: {
                    intakeId: '20',
                    reviewId: '30'
                },

                body: {},

                auth: {
                    userId: 9,
                    youthId: 2,

                    member: {
                        name:
                            'Discipleship Leader'
                    }
                }
            },
            harness.res
        );

        const response =
            harness.result();

        assert.equal(
            response.statusCode,
            200
        );

        assert.equal(
            response.payload
                .result
                .recognized,
            true
        );

        assert.equal(
            recognitionCall.intakeId,
            20
        );

        assert.equal(
            recognitionCall
                .options
                .reviewId,
            30
        );

        assert.equal(
            recognitionCall
                .options
                .actorUserId,
            9
        );

        assert.equal(
            recognitionCall
                .options
                .actorName,
            'Discipleship Leader'
        );
    }
);

test(
    'Ministry leadership recommendation preserves explicit decision and canonical actor',
    async () => {
        let recommendation =
            null;

        const {
            routes
        } =
            register({
                domains: {
                    intake: {
                        INTAKE_VERSION:
                            'member-transition-v1'
                    },

                    recognition: {
                        RECOGNITION_PHASES:
                            {}
                    },

                    discernment: {
                        async recommend(
                            db,
                            options
                        ) {
                            recommendation =
                                options;

                            return {
                                id:
                                    options
                                        .caseId,
                                status:
                                    options
                                        .recommended
                                        ? 'recommended'
                                        : 'not_recommended'
                            };
                        },

                        listCaseEvents:
                            async () => []
                    }
                }
            });

        const route =
            findRoute(
                routes,
                'POST',
                '/api/admin/ministry-discernment/:caseId/recommendation'
            );

        const harness =
            responseHarness();

        await route.handlers[
            route.handlers.length - 1
        ](
            {
                params: {
                    caseId: '55'
                },

                body: {
                    recommended:
                        true,

                    assessment_required:
                        false,

                    details: {
                        notes:
                            'Ready to continue.'
                    }
                },

                auth: {
                    userId: 11,
                    youthId: 8,

                    member: {
                        name:
                            'Ministry Leader'
                    }
                }
            },
            harness.res
        );

        const response =
            harness.result();

        assert.equal(
            response.statusCode,
            200
        );

        assert.equal(
            response.payload
                .case
                .status,
            'recommended'
        );

        assert.equal(
            recommendation.caseId,
            55
        );

        assert.equal(
            recommendation.recommended,
            true
        );

        assert.equal(
            recommendation
                .assessmentRequired,
            false
        );

        assert.equal(
            recommendation
                .actorUserId,
            11
        );

        assert.equal(
            recommendation
                .actorName,
            'Ministry Leader'
        );

        assert.deepEqual(
            recommendation.details,
            {
                notes:
                    'Ready to continue.'
            }
        );
    }
);

test(
    'recommendation requires an explicit yes or no instead of treating missing input as rejection',
    async () => {
        let mutationCalls =
            0;

        const {
            routes
        } =
            register({
                domains: {
                    intake: {
                        INTAKE_VERSION:
                            'member-transition-v1'
                    },

                    recognition: {
                        RECOGNITION_PHASES:
                            {}
                    },

                    discernment: {
                        async recommend() {
                            mutationCalls += 1;
                        },

                        listCaseEvents:
                            async () => []
                    }
                }
            });

        const route =
            findRoute(
                routes,
                'POST',
                '/api/admin/ministry-discernment/:caseId/recommendation'
            );

        const harness =
            responseHarness();

        await route.handlers[
            route.handlers.length - 1
        ](
            {
                params: {
                    caseId: '55'
                },

                body: {},

                auth: {
                    userId: 11,

                    member: {
                        name:
                            'Ministry Leader'
                    }
                }
            },
            harness.res
        );

        const response =
            harness.result();

        assert.equal(
            response.statusCode,
            400
        );

        assert.equal(
            response.payload.code,
            'RECOMMENDATION_REQUIRED'
        );

        assert.equal(
            mutationCalls,
            0
        );
    }
);

test(
    'unexpected database failures return a generic 500 without exposing internal details',
    async () => {
        const databaseError =
            Object.assign(
                new Error(
                    'sensitive sqlite implementation detail'
                ),
                {
                    code:
                        'SQLITE_ERROR'
                }
            );

        const db = {
            get(
                sql,
                params,
                callback
            ) {
                callback(
                    databaseError
                );
            },

            all(
                sql,
                params,
                callback
            ) {
                callback(
                    databaseError
                );
            }
        };

        const {
            routes
        } =
            register({
                db
            });

        const route =
            findRoute(
                routes,
                'GET',
                '/api/admin/member-transitions'
            );

        const harness =
            responseHarness();

        await route.handlers[
            route.handlers.length - 1
        ](
            {
                auth: {
                    userId: 7,
                    youthId: 3,
                    member: {
                        name:
                            'Growth Leader'
                    }
                }
            },
            harness.res
        );

        const response =
            harness.result();

        assert.equal(
            response.statusCode,
            500
        );

        assert.equal(
            response.payload.success,
            false
        );

        assert.equal(
            response.payload.code,
            'SQLITE_ERROR'
        );

        assert.equal(
            response.payload.error,
            'Leadership transition request failed.'
        );

        assert.equal(
            JSON.stringify(
                response.payload
            ).includes(
                'sensitive sqlite implementation detail'
            ),
            false
        );
    }
);
