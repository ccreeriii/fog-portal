'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3');

const Http =
    require('../lib/member-transition-http');

const CommunityIntent =
    require('../lib/member-transition-community-intent');

const V1 = fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'migrations',
        '20260917_member_transition_intake_v1.sql'
    ),
    'utf8'
);

const V2 = fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'migrations',
        '20260917_member_transition_community_confirmation_v2.sql'
    ),
    'utf8'
);

function openDatabase() {
    const dir = fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            'fog-transition-http-'
        )
    );

    const filename =
        path.join(
            dir,
            'test.db'
        );

    const db =
        new sqlite3.Database(
            filename
        );

    return {
        db,

        close: () =>
            new Promise(resolve => {
                db.close(() => {
                    fs.rmSync(
                        dir,
                        {
                            recursive: true,
                            force: true
                        }
                    );

                    resolve();
                });
            })
    };
}

function exec(db, sql) {
    return new Promise(
        (resolve, reject) => {
            db.exec(
                sql,
                error =>
                    error
                        ? reject(error)
                        : resolve()
            );
        }
    );
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

async function setup(db) {
    await exec(
        db,
        `
        PRAGMA foreign_keys = ON;

        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            account_tier TEXT,
            commitment_intent TEXT
        );

        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            youth_id INTEGER,
            username TEXT,
            permissions TEXT
        );

        CREATE TABLE ministries (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE ministry_members (
            id INTEGER PRIMARY KEY,
            ministry_id INTEGER,
            youth_id INTEGER,
            role TEXT,
            assigned_at TEXT,
            sub_role TEXT,
            is_priority INTEGER DEFAULT 0,
            intent_message TEXT,
            UNIQUE(
                ministry_id,
                youth_id
            )
        );

        CREATE TABLE growth_legacy_transitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            standing_class TEXT NOT NULL,
            completion_basis TEXT,
            phases_grandfathered_json TEXT,
            applied_at TEXT
        );

        CREATE TABLE growth_phase_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER,
            phase_id INTEGER,
            status TEXT,
            completion_basis TEXT
        );

        CREATE TABLE growth_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER,
            evidence_type TEXT,
            source_key TEXT
        );

        CREATE TABLE activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            action TEXT,
            details TEXT,
            created_at TEXT
        );

        INSERT INTO youth (
            id,
            name,
            account_tier,
            commitment_intent
        )
        VALUES
            (
                1,
                'Accelerated Member',
                'Committed Member',
                'Original historical declaration.'
            ),
            (
                2,
                'Unrelated Member',
                'Member',
                NULL
            );

        INSERT INTO users (
            id,
            youth_id,
            username,
            permissions
        )
        VALUES (
            50,
            1,
            'member@example.test',
            '[]'
        );

        INSERT INTO ministries (
            id,
            name
        )
        VALUES
            (10, 'Seraphs'),
            (20, 'Levites');

        INSERT INTO ministry_members (
            id,
            ministry_id,
            youth_id,
            role,
            assigned_at,
            is_priority
        )
        VALUES
            (
                101,
                10,
                1,
                'Core Member',
                '2025-01-01',
                0
            ),
            (
                102,
                20,
                1,
                'Member',
                '2025-01-01',
                0
            );

        INSERT INTO growth_legacy_transitions (
            youth_id,
            standing_class,
            completion_basis,
            phases_grandfathered_json,
            applied_at
        )
        VALUES (
            1,
            'active_servant',
            'legacy_service_standing',
            '["encounter","belong","commit","discern","form"]',
            '2026-09-01T00:00:00.000Z'
        );
        `
    );

    await exec(db, V1);
    await exec(db, V2);
}

test(
    'accelerated member state initially requires transition initialization',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        const state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.eligible,
            true
        );

        assert.equal(
            state.requires_initialization,
            true
        );

        assert.equal(
            state.next_action,
            'initialize_transition'
        );

        assert.equal(
            state.intake,
            null
        );
    }
);

test(
    'accelerated initialization is idempotent and creates exactly one intake',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        const first =
            await Http
                .ensureAcceleratedIntake(
                    fixture.db,
                    {
                        youthId: 1,
                        actorName:
                            'Accelerated Member'
                    }
                );

        const second =
            await Http
                .ensureAcceleratedIntake(
                    fixture.db,
                    {
                        youthId: 1,
                        actorName:
                            'Accelerated Member'
                    }
                );

        assert.equal(
            first.created,
            true
        );

        assert.equal(
            second.idempotent,
            true
        );

        const intakes =
            await get(
                fixture.db,
                `
                SELECT COUNT(*) AS count
                FROM member_transition_intakes
                WHERE youth_id = 1
                `
            );

        assert.equal(
            intakes.count,
            1
        );

        const logs =
            await get(
                fixture.db,
                `
                SELECT COUNT(*) AS count
                FROM activity_logs
                WHERE action =
                    'MEMBER_TRANSITION_INITIALIZED'
                `
            );

        assert.equal(
            logs.count,
            1
        );
    }
);

test(
    'non-transition member cannot initialize accelerated transition',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        await assert.rejects(
            Http.ensureAcceleratedIntake(
                fixture.db,
                {
                    youthId: 2,
                    actorName:
                        'Unrelated Member'
                }
            ),
            error =>
                error &&
                error.code ===
                    'TRANSITION_NOT_ELIGIBLE'
        );
    }
);

test(
    'state progresses from Community confirmation to Priority selection without overwriting historical intent',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        const initialized =
            await Http
                .ensureAcceleratedIntake(
                    fixture.db,
                    {
                        youthId: 1,
                        actorName:
                            'Accelerated Member'
                    }
                );

        let state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.next_action,
            'community_intent'
        );

        await CommunityIntent
            .submitCommunityDeclaration(
                fixture.db,
                {
                    youthId: 1,

                    intakeId:
                        initialized
                            .intake
                            .id,

                    choice:
                        'yes',

                    statementText:
                        'I desire to continue journeying with FOG.',

                    actorUserId:
                        50,

                    actorName:
                        'Accelerated Member'
                }
            );

        state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.community.confirmed,
            true
        );

        assert.equal(
            state.next_action,
            'priority_ministry'
        );

        const member =
            await get(
                fixture.db,
                `
                SELECT commitment_intent
                FROM youth
                WHERE id = 1
                `
            );

        assert.equal(
            member.commitment_intent,
            'Original historical declaration.'
        );
    }
);

test(
    'member state never exposes leadership-only discernment events',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        const initialized =
            await Http
                .ensureAcceleratedIntake(
                    fixture.db,
                    {
                        youthId: 1,
                        actorName:
                            'Accelerated Member'
                    }
                );

        await CommunityIntent
            .submitCommunityDeclaration(
                fixture.db,
                {
                    youthId: 1,
                    intakeId:
                        initialized
                            .intake
                            .id,
                    choice:
                        'yes',
                    actorUserId:
                        50,
                    actorName:
                        'Accelerated Member'
                }
            );

        await run(
            fixture.db,
            `
            UPDATE ministry_members
            SET is_priority = 1
            WHERE id = 101
            `
        );

        const opened =
            await require(
                '../lib/ministry-discernment-journey'
            ).openDiscernmentCase(
                fixture.db,
                {
                    youthId: 1,
                    ministryId: 10,
                    sourceType:
                        'accelerated_transition',
                    sourceIntakeId:
                        initialized
                            .intake
                            .id,
                    intentText:
                        'I desire to discern.',
                    actorUserId:
                        50,
                    actorName:
                        'Accelerated Member'
                }
            );

        await run(
            fixture.db,
            `
            INSERT INTO ministry_discernment_events (
                case_id,
                event_type,
                actor_name,
                visibility,
                details_json
            )
            VALUES
                (
                    ?,
                    'member_note',
                    'Accelerated Member',
                    'member',
                    '{}'
                ),
                (
                    ?,
                    'private_leader_note',
                    'Leader',
                    'leadership',
                    '{"private":true}'
                )
            `,
            [
                opened.case.id,
                opened.case.id
            ]
        );

        const state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        const types =
            state
                .discernment
                .member_visible_events
                .map(
                    item =>
                        item.event_type
                );

        assert.ok(
            types.includes(
                'member_note'
            )
        );

        assert.equal(
            types.includes(
                'private_leader_note'
            ),
            false
        );
    }
);

test(
    'HTTP registration protects every member transition endpoint with requireAuth',
    () => {
        const registered = [];

        const app = {
            get(
                route,
                ...handlers
            ) {
                registered.push({
                    method:
                        'GET',
                    route,
                    handlers
                });
            },

            post(
                route,
                ...handlers
            ) {
                registered.push({
                    method:
                        'POST',
                    route,
                    handlers
                });
            }
        };

        const requireAuth =
            function transitionTestAuth(
                req,
                res,
                next
            ) {
                return next();
            };

        const fakeDb = {
            get() {},
            all() {},
            run() {}
        };

        Http.registerMemberTransitionRoutes({
            app,
            db: fakeDb,
            requireAuth
        });

        assert.equal(
            registered.length,
            9
        );

        for (
            const route
            of registered
        ) {
            assert.equal(
                route.handlers[0],
                requireAuth
            );

            assert.ok(
                route.route.startsWith(
                    '/api/member-transition/me'
                )
            );
        }

        assert.equal(
            registered.some(
                route =>
                    route.route.includes(
                        ':youthId'
                    ) ||
                    route.route.includes(
                        ':memberId'
                    )
            ),
            false
        );
    }
);

test(
    'controller source derives ownership from req.auth and has no body youth_id binding',
    () => {
        const source =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'lib',
                    'member-transition-http.js'
                ),
                'utf8'
            );

        assert.ok(
            source.includes(
                'auth.youthId'
            )
        );

        assert.equal(
            source.includes(
                'req.body.youth_id'
            ),
            false
        );

        assert.equal(
            source.includes(
                '/api/member-transition/:'
            ),
            false
        );
    }
);

function createMemberTransitionHarness(db) {
    const routes =
        new Map();

    const app = {
        get(
            route,
            ...handlers
        ) {
            routes.set(
                `GET ${route}`,
                handlers
            );
        },

        post(
            route,
            ...handlers
        ) {
            routes.set(
                `POST ${route}`,
                handlers
            );
        }
    };

    function requireAuth(
        req,
        res,
        next
    ) {
        return next();
    }

    Http.registerMemberTransitionRoutes({
        app,
        db,
        requireAuth
    });

    async function invoke(
        method,
        route,
        {
            auth = {
                youthId: 1,
                userId: 50,
                username:
                    'member@example.test',
                member: {
                    name:
                        'Accelerated Member'
                }
            },
            body = {},
            params = {}
        } = {}
    ) {
        const handlers =
            routes.get(
                `${method} ${route}`
            );

        if (!handlers) {
            throw new Error(
                `Route not registered: ${method} ${route}`
            );
        }

        let statusCode = 200;
        let payload = null;

        const req = {
            auth,
            body,
            params
        };

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

        const handler =
            handlers[
                handlers.length - 1
            ];

        await handler(
            req,
            res
        );

        return {
            statusCode,
            payload
        };
    }

    return {
        invoke
    };
}

test(
    'Priority Ministry mutation is blocked until Community Intent is affirmatively confirmed',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        await Http
            .ensureAcceleratedIntake(
                fixture.db,
                {
                    youthId: 1,
                    actorName:
                        'Accelerated Member'
                }
            );

        const harness =
            createMemberTransitionHarness(
                fixture.db
            );

        const response =
            await harness.invoke(
                'POST',
                '/api/member-transition/me/priority/:mappingId',
                {
                    params: {
                        mappingId:
                            '101'
                    }
                }
            );

        assert.equal(
            response.statusCode,
            409
        );

        assert.equal(
            response.payload.code,
            'COMMUNITY_INTENT_REQUIRED'
        );

        const priority = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_members
            WHERE youth_id = 1
              AND is_priority = 1
            `
        );

        assert.equal(
            priority.count,
            0
        );

        const history =
            await get(
                fixture.db,
                `
                SELECT COUNT(*) AS count
                FROM ministry_priority_history
                `
            );

        assert.equal(
            history.count,
            0
        );
    }
);

test(
    'Ministry Discernment mutation is blocked before Community confirmation even when other prerequisites could be supplied',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        await Http
            .ensureAcceleratedIntake(
                fixture.db,
                {
                    youthId: 1,
                    actorName:
                        'Accelerated Member'
                }
            );

        await run(
            fixture.db,
            `
            UPDATE ministry_members
            SET is_priority = 1
            WHERE id = 101
            `
        );

        const harness =
            createMemberTransitionHarness(
                fixture.db
            );

        const response =
            await harness.invoke(
                'POST',
                '/api/member-transition/me/discernment',
                {
                    body: {
                        intent_text:
                            'I desire to discern my continued service.'
                    }
                }
            );

        assert.equal(
            response.statusCode,
            409
        );

        assert.equal(
            response.payload.code,
            'COMMUNITY_INTENT_REQUIRED'
        );

        const cases =
            await get(
                fixture.db,
                `
                SELECT COUNT(*) AS count
                FROM ministry_discernment_cases
                `
            );

        assert.equal(
            cases.count,
            0
        );
    }
);

test(
    'closed transition intake blocks all member transition mutations and presents a closed state',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        const initialized =
            await Http
                .ensureAcceleratedIntake(
                    fixture.db,
                    {
                        youthId: 1,
                        actorName:
                            'Accelerated Member'
                    }
                );

        await CommunityIntent
            .submitCommunityDeclaration(
                fixture.db,
                {
                    youthId: 1,

                    intakeId:
                        initialized
                            .intake
                            .id,

                    choice: 'yes',

                    statementText:
                        'I desire to continue journeying with FOG.',

                    actorUserId:
                        50,

                    actorName:
                        'Accelerated Member'
                }
            );

        const MinistryJourney =
            require(
                '../lib/ministry-service-journey'
            );

        await MinistryJourney
            .setPriorityMinistry(
                fixture.db,
                {
                    youthId: 1,
                    mappingId: 101,
                    actorUserId: 50,
                    actorName:
                        'Accelerated Member',
                    source:
                        'member_profile',
                    reason:
                        'Test transition priority.'
                }
            );

        const Discernment =
            require(
                '../lib/ministry-discernment-journey'
            );

        const opened =
            await Discernment
                .openDiscernmentCase(
                    fixture.db,
                    {
                        youthId: 1,
                        ministryId: 10,

                        sourceType:
                            'accelerated_transition',

                        sourceIntakeId:
                            initialized
                                .intake
                                .id,

                        intentText:
                            'I desire to discern my continued service.',

                        actorUserId:
                            50,

                        actorName:
                            'Accelerated Member'
                    }
                );

        await run(
            fixture.db,
            `
            UPDATE member_transition_intakes
            SET status = 'closed'
            WHERE id = ?
            `,
            [
                initialized
                    .intake
                    .id
            ]
        );

        const harness =
            createMemberTransitionHarness(
                fixture.db
            );

        const attempts = [
            await harness.invoke(
                'POST',
                '/api/member-transition/me/community-intent',
                {
                    body: {
                        choice:
                            'discerning'
                    }
                }
            ),

            await harness.invoke(
                'POST',
                '/api/member-transition/me/priority/:mappingId',
                {
                    params: {
                        mappingId:
                            '102'
                    }
                }
            ),

            await harness.invoke(
                'POST',
                '/api/member-transition/me/discernment',
                {
                    body: {
                        intent_text:
                            'Another discernment attempt.'
                    }
                }
            ),

            await harness.invoke(
                'POST',
                '/api/member-transition/me/discernment/:caseId/withdraw',
                {
                    params: {
                        caseId:
                            String(
                                opened
                                    .case
                                    .id
                            )
                    }
                }
            )
        ];

        for (
            const response
            of attempts
        ) {
            assert.equal(
                response.statusCode,
                409
            );

            assert.equal(
                response.payload.code,
                'INTAKE_CLOSED'
            );
        }

        const discernment =
            await get(
                fixture.db,
                `
                SELECT status
                FROM ministry_discernment_cases
                WHERE id = ?
                `,
                [
                    opened
                        .case
                        .id
                ]
            );

        assert.equal(
            discernment.status,
            'intent_submitted'
        );

        const state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.next_action,
            'transition_closed'
        );
    }
);

test(
    'adult historical intake remains in questionnaire and review states before fresh Community confirmation',
    async t => {
        const fixture =
            openDatabase();

        t.after(
            fixture.close
        );

        await setup(
            fixture.db
        );

        const AdultIntake =
            require(
                '../lib/member-transition-intake'
            );

        const intake =
            await AdultIntake
                .createIntake(
                    fixture.db,
                    {
                        youthId: 1,
                        intakeKind:
                            'adult_historical'
                    }
                );

        let state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.next_action,
            'adult_intake_questionnaire'
        );

        await AdultIntake
            .saveDraftIntake(
                fixture.db,
                {
                    intakeId:
                        intake.id,
                    youthId: 1,
                    serviceState:
                        'none',
                    answers: {
                        connection_status:
                            'existing_member',
                        current_invitation:
                            'community'
                    },
                    reportedMinistries:
                        []
                }
            );

        const draft =
            await get(
                fixture.db,
                `SELECT *
                 FROM member_transition_intakes
                 WHERE id = ?`,
                [intake.id]
            );

        assert.equal(
            draft.status,
            'draft'
        );

        assert.equal(
            JSON.parse(
                draft.answers_json
            ).connection_status,
            'existing_member'
        );

        await AdultIntake
            .submitIntake(
                fixture.db,
                {
                    intakeId:
                        intake.id,
                    youthId: 1,
                    serviceState:
                        'none',
                    answers: {
                        connection_status:
                            'existing_member',
                        current_invitation:
                            'community',
                        attestation_confirmed:
                            true
                    },
                    reportedMinistries:
                        [],
                    actorName:
                        'Historical Adult'
                }
            );

        state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.next_action,
            'adult_intake_submitted'
        );

        const audit =
            await get(
                fixture.db,
                `SELECT COUNT(*) AS count
                 FROM activity_logs
                 WHERE action =
                    'MEMBER_TRANSITION_INTAKE_SUBMITTED'`
            );

        assert.equal(
            audit.count,
            1
        );

        await run(
            fixture.db,
            `UPDATE member_transition_intakes
             SET status = 'under_review'
             WHERE id = ?`,
            [intake.id]
        );

        state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.next_action,
            'adult_intake_under_review'
        );

        await run(
            fixture.db,
            `UPDATE member_transition_intakes
             SET status = 'approved'
             WHERE id = ?`,
            [intake.id]
        );

        state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.next_action,
            'adult_intake_awaiting_recognition'
        );

        await run(
            fixture.db,
            `UPDATE member_transition_intakes
             SET status = 'recognized'
             WHERE id = ?`,
            [intake.id]
        );

        state =
            await Http
                .buildMemberTransitionState(
                    fixture.db,
                    1
                );

        assert.equal(
            state.next_action,
            'community_intent'
        );
    }
);

test(
    'member Adult Intake routes are authenticated and self-scoped',
    () => {
        const source =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'lib',
                    'member-transition-http.js'
                ),
                'utf8'
            );

        for (
            const route
            of [
                '/api/member-transition/me/intake',
                '/api/member-transition/me/intake/draft',
                '/api/member-transition/me/intake/submit'
            ]
        ) {
            assert.ok(
                source.includes(
                    route
                )
            );
        }

        const start =
            source.indexOf(
                'Existing Adult Member Intake'
            );

        const end =
            source.indexOf(
                "'/api/member-transition/me/community-intent'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const region =
            source.slice(
                start,
                end
            );

        assert.match(
            region,
            /req\.auth[\s\S]*?youthId/
        );

        assert.doesNotMatch(
            region,
            /req\.body[\s\S]{0,80}youth_id/
        );

        assert.doesNotMatch(
            region,
            /req\.body[\s\S]{0,80}actor/
        );
    }
);
