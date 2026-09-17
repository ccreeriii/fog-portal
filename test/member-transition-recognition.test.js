'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3');

const Recognition =
    require('../lib/member-transition-recognition');

const migration = fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'migrations',
        '20260917_member_transition_intake_v1.sql'
    ),
    'utf8'
);

function openDatabase() {
    const directory = fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            'fog-transition-recognition-'
        )
    );

    const filename =
        path.join(directory, 'test.db');

    const db =
        new sqlite3.Database(filename);

    return {
        db,

        close: () =>
            new Promise(resolve => {
                db.close(() => {
                    fs.rmSync(
                        directory,
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

function run(db, sql, params = []) {
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
                        lastID: this.lastID,
                        changes: this.changes
                    });
                }
            );
        }
    );
}

function get(db, sql, params = []) {
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

                    resolve(row || null);
                }
            );
        }
    );
}

function all(db, sql, params = []) {
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

                    resolve(rows || []);
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
            commitment_intent TEXT
        );

        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT
        );

        CREATE TABLE ministries (
            id INTEGER PRIMARY KEY,
            name TEXT
        );

        CREATE TABLE ministry_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ministry_id INTEGER,
            youth_id INTEGER,
            role TEXT,
            assigned_at TEXT,
            sub_role TEXT,
            is_priority INTEGER DEFAULT 0,
            intent_message TEXT,
            UNIQUE(ministry_id, youth_id)
        );

        CREATE TABLE growth_journey_phases (
            id INTEGER PRIMARY KEY,
            phase_key TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            phase_order INTEGER NOT NULL,
            journey_segment TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE growth_tasks (
            id INTEGER PRIMARY KEY,
            phase_id INTEGER NOT NULL,
            task_key TEXT,
            title TEXT,
            evidence_type TEXT,
            classification TEXT,
            applies_to_existing TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE growth_phase_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            phase_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'not_started',
            progress_percent REAL NOT NULL DEFAULT 0,
            essential_completed INTEGER NOT NULL DEFAULT 0,
            essential_total INTEGER NOT NULL DEFAULT 0,
            started_at TEXT,
            completed_at TEXT,
            completion_basis TEXT,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(youth_id, phase_id)
        );

        CREATE TABLE growth_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            task_id INTEGER,
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
            commitment_intent
        )
        VALUES (
            1,
            'Historical Adult',
            NULL
        );

        INSERT INTO users (
            id,
            username
        )
        VALUES (
            50,
            'shepherd@example.test'
        );

        INSERT INTO ministries (
            id,
            name
        )
        VALUES
            (10, 'Seraphs'),
            (20, 'Levites');

        INSERT INTO ministry_members (
            ministry_id,
            youth_id,
            role,
            assigned_at,
            is_priority
        )
        VALUES (
            10,
            1,
            'Member',
            '2024-01-01',
            0
        );

        INSERT INTO growth_journey_phases (
            id,
            phase_key,
            title,
            phase_order,
            journey_segment,
            is_active
        )
        VALUES
            (1, 'encounter', 'Encounter', 1, 'membership', 1),
            (2, 'belong',    'Belong',    2, 'membership', 1),
            (3, 'commit',    'Commit',    3, 'membership', 1),
            (4, 'discern',   'Discern',   4, 'servant', 1),
            (5, 'form',      'Form',      5, 'servant', 1),
            (6, 'serve',     'Serve',     6, 'servant', 1),
            (7, 'be_sent',   'Be Sent',   7, 'servant', 1);

        INSERT INTO growth_tasks (
            id,
            phase_id,
            task_key,
            title,
            evidence_type,
            classification,
            applies_to_existing,
            is_active
        )
        VALUES
            (101, 1, 'encounter-test', 'Encounter Test', 'test', 'essential', 'new_only', 1),
            (102, 2, 'belong-test',    'Belong Test',    'test', 'essential', 'new_only', 1),
            (103, 3, 'commit-test',    'Commit Test',    'test', 'essential', 'new_only', 1),
            (104, 4, 'discern-test',   'Discern Test',   'test', 'essential', 'new_only', 1),
            (105, 5, 'form-test',      'Form Test',      'test', 'essential', 'new_only', 1),
            (106, 6, 'serve-test',     'Serve Test',     'test', 'essential', 'new_only', 1),
            (107, 7, 'sent-test',      'Sent Test',      'test', 'essential', 'new_only', 1);
        `
    );

    await exec(db, migration);
    await exec(db, migration);
}

async function seedContext(
    db,
    {
        intakeKind = 'adult_historical',
        intakeStatus = 'approved',
        reviewDecision = 'approved',
        standing = 'formal_member',
        phases = [
            'encounter',
            'belong',
            'commit'
        ]
    } = {}
) {
    const intake = await run(
        db,
        `
        INSERT INTO member_transition_intakes (
            youth_id,
            intake_kind,
            status,
            service_state,
            answers_json,
            submitted_at
        )
        VALUES (
            1,
            ?,
            ?,
            'current',
            '{}',
            CURRENT_TIMESTAMP
        )
        `,
        [
            intakeKind,
            intakeStatus
        ]
    );

    const review = await run(
        db,
        `
        INSERT INTO member_transition_reviews (
            intake_id,
            reviewer_user_id,
            reviewer_name,
            decision,
            proposed_standing,
            proposed_phases_json,
            decision_json,
            review_notes
        )
        VALUES (
            ?,
            50,
            'Shepherd Reviewer',
            ?,
            ?,
            ?,
            '{}',
            'Historical review test.'
        )
        `,
        [
            intake.lastID,
            reviewDecision,
            standing,
            JSON.stringify(phases)
        ]
    );

    return {
        intakeId: intake.lastID,
        reviewId: review.lastID
    };
}

function recognize(
    db,
    context,
    now = new Date(
        '2026-09-17T10:00:00.000Z'
    )
) {
    return Recognition.recognizeApprovedIntake(
        db,
        context.intakeId,
        {
            reviewId: context.reviewId,
            actorUserId: 50,
            actorName: 'Shepherd Reviewer',
            now
        }
    );
}

test(
    'submitted but not approved intake cannot be recognized',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db,
                {
                    intakeStatus: 'submitted'
                }
            );

        await assert.rejects(
            recognize(
                fixture.db,
                context
            ),
            error =>
                error &&
                error.code ===
                    'INTAKE_NOT_APPROVED'
        );

        const count = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM member_transition_recognitions
            `
        );

        assert.equal(count.count, 0);
    }
);

test(
    'accelerated confirmation cannot re-grandfather historical Growth standing',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db,
                {
                    intakeKind:
                        'accelerated_confirmation'
                }
            );

        await assert.rejects(
            recognize(
                fixture.db,
                context
            ),
            error =>
                error &&
                error.code ===
                    'RECOGNITION_NOT_REQUIRED'
        );

        const progress = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM growth_phase_progress
            `
        );

        assert.equal(progress.count, 0);
    }
);

test(
    'uncertain proposed standing cannot be automatically recognized',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db,
                {
                    standing: 'uncertain',
                    phases: []
                }
            );

        await assert.rejects(
            recognize(
                fixture.db,
                context
            ),
            error =>
                error &&
                error.code ===
                    'INVALID_RECOGNIZED_STANDING'
        );
    }
);

test(
    'phase proposal must exactly match canonical recognized standing',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db,
                {
                    standing: 'formal_member',
                    phases: [
                        'encounter',
                        'commit'
                    ]
                }
            );

        await assert.rejects(
            recognize(
                fixture.db,
                context
            ),
            error =>
                error &&
                error.code ===
                    'PHASE_PROPOSAL_MISMATCH'
        );
    }
);

test(
    'formal member recognition completes only membership phases without inventing task evidence',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db
            );

        const result =
            await recognize(
                fixture.db,
                context
            );

        assert.equal(
            result.recognized,
            true
        );

        assert.deepEqual(
            result.recognizedPhases,
            [
                'encounter',
                'belong',
                'commit'
            ]
        );

        const progress = await all(
            fixture.db,
            `
            SELECT
                phase.phase_key,
                p.status,
                p.essential_completed,
                p.essential_total,
                p.completion_basis
            FROM growth_phase_progress p
            JOIN growth_journey_phases phase
              ON phase.id = p.phase_id
            WHERE p.youth_id = 1
            ORDER BY phase.phase_order
            `
        );

        assert.equal(progress.length, 3);

        assert.deepEqual(
            progress.map(
                row => row.phase_key
            ),
            [
                'encounter',
                'belong',
                'commit'
            ]
        );

        for (const row of progress) {
            assert.equal(
                row.status,
                'completed'
            );

            assert.equal(
                row.essential_completed,
                0
            );

            assert.equal(
                row.essential_total,
                1
            );

            assert.equal(
                row.completion_basis,
                'transition_review_recognized'
            );
        }

        const evidence = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM growth_evidence
            WHERE youth_id = 1
            `
        );

        assert.equal(
            evidence.count,
            0
        );

        const member = await get(
            fixture.db,
            `
            SELECT commitment_intent
            FROM youth
            WHERE id = 1
            `
        );

        assert.equal(
            member.commitment_intent,
            null
        );

        const ministry = await get(
            fixture.db,
            `
            SELECT
                role,
                is_priority
            FROM ministry_members
            WHERE youth_id = 1
              AND ministry_id = 10
            `
        );

        assert.equal(
            ministry.role,
            'Member'
        );

        assert.equal(
            ministry.is_priority,
            0
        );

        const intake = await get(
            fixture.db,
            `
            SELECT
                status,
                recognized_at
            FROM member_transition_intakes
            WHERE id = ?
            `,
            [context.intakeId]
        );

        assert.equal(
            intake.status,
            'recognized'
        );

        assert.ok(
            intake.recognized_at
        );
    }
);

test(
    'active servant historical recognition stops at Form',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db,
                {
                    standing:
                        'active_servant',
                    phases: [
                        'encounter',
                        'belong',
                        'commit',
                        'discern',
                        'form'
                    ]
                }
            );

        const result =
            await recognize(
                fixture.db,
                context
            );

        assert.equal(
            result.recognized,
            true
        );

        const completed = await all(
            fixture.db,
            `
            SELECT phase.phase_key
            FROM growth_phase_progress p
            JOIN growth_journey_phases phase
              ON phase.id = p.phase_id
            WHERE p.youth_id = 1
              AND p.status = 'completed'
            ORDER BY phase.phase_order
            `
        );

        assert.deepEqual(
            completed.map(
                row => row.phase_key
            ),
            [
                'encounter',
                'belong',
                'commit',
                'discern',
                'form'
            ]
        );

        assert.equal(
            completed.some(
                row =>
                    row.phase_key ===
                    'serve'
            ),
            false
        );

        assert.equal(
            completed.some(
                row =>
                    row.phase_key ===
                    'be_sent'
            ),
            false
        );
    }
);

test(
    'existing genuine completed phase preserves original basis and timestamps',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await run(
            fixture.db,
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
                1,
                1,
                'completed',
                100,
                1,
                1,
                '2025-01-01T00:00:00.000Z',
                '2025-01-10T00:00:00.000Z',
                'leadership_approved',
                '2025-01-10T00:00:00.000Z'
            )
            `
        );

        const context =
            await seedContext(
                fixture.db
            );

        await recognize(
            fixture.db,
            context
        );

        const encounter = await get(
            fixture.db,
            `
            SELECT *
            FROM growth_phase_progress
            WHERE youth_id = 1
              AND phase_id = 1
            `
        );

        assert.equal(
            encounter.completion_basis,
            'leadership_approved'
        );

        assert.equal(
            encounter.started_at,
            '2025-01-01T00:00:00.000Z'
        );

        assert.equal(
            encounter.completed_at,
            '2025-01-10T00:00:00.000Z'
        );

        const recognized = await all(
            fixture.db,
            `
            SELECT
                phase.phase_key,
                p.completion_basis
            FROM growth_phase_progress p
            JOIN growth_journey_phases phase
              ON phase.id = p.phase_id
            WHERE p.youth_id = 1
            ORDER BY phase.phase_order
            `
        );

        assert.deepEqual(
            recognized,
            [
                {
                    phase_key:
                        'encounter',
                    completion_basis:
                        'leadership_approved'
                },
                {
                    phase_key:
                        'belong',
                    completion_basis:
                        'transition_review_recognized'
                },
                {
                    phase_key:
                        'commit',
                    completion_basis:
                        'transition_review_recognized'
                }
            ]
        );
    }
);

test(
    'paused historical phase fails closed and rolls back earlier writes',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await run(
            fixture.db,
            `
            INSERT INTO growth_phase_progress (
                youth_id,
                phase_id,
                status,
                progress_percent,
                essential_completed,
                essential_total,
                started_at,
                completion_basis
            )
            VALUES (
                1,
                2,
                'paused',
                20,
                0,
                1,
                '2026-01-01',
                'pastoral_pause'
            )
            `
        );

        const context =
            await seedContext(
                fixture.db
            );

        await assert.rejects(
            recognize(
                fixture.db,
                context
            ),
            error =>
                error &&
                error.code ===
                    'PHASE_PAUSED'
        );

        const phases = await all(
            fixture.db,
            `
            SELECT
                phase_id,
                status
            FROM growth_phase_progress
            WHERE youth_id = 1
            ORDER BY phase_id
            `
        );

        assert.deepEqual(
            phases,
            [
                {
                    phase_id: 2,
                    status: 'paused'
                }
            ]
        );

        const recognition = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM member_transition_recognitions
            `
        );

        assert.equal(
            recognition.count,
            0
        );

        const intake = await get(
            fixture.db,
            `
            SELECT status
            FROM member_transition_intakes
            WHERE id = ?
            `,
            [context.intakeId]
        );

        assert.equal(
            intake.status,
            'approved'
        );
    }
);

test(
    'weaker historical proposal cannot overwrite stronger existing completed standing',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await run(
            fixture.db,
            `
            INSERT INTO growth_phase_progress (
                youth_id,
                phase_id,
                status,
                progress_percent,
                essential_completed,
                essential_total,
                completed_at,
                completion_basis
            )
            VALUES (
                1,
                6,
                'completed',
                100,
                1,
                1,
                '2026-05-01',
                'leadership_approved'
            )
            `
        );

        const context =
            await seedContext(
                fixture.db,
                {
                    standing:
                        'formal_member'
                }
            );

        await assert.rejects(
            recognize(
                fixture.db,
                context
            ),
            error =>
                error &&
                error.code ===
                    'PROPOSAL_BELOW_EXISTING_STANDING'
        );

        const serve = await get(
            fixture.db,
            `
            SELECT
                status,
                completion_basis
            FROM growth_phase_progress
            WHERE youth_id = 1
              AND phase_id = 6
            `
        );

        assert.equal(
            serve.status,
            'completed'
        );

        assert.equal(
            serve.completion_basis,
            'leadership_approved'
        );
    }
);

test(
    'recognition replay is idempotent and creates one audit record',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db
            );

        const first =
            await recognize(
                fixture.db,
                context
            );

        const second =
            await recognize(
                fixture.db,
                context
            );

        assert.equal(
            first.recognized,
            true
        );

        assert.equal(
            second.recognized,
            false
        );

        assert.equal(
            second.idempotent,
            true
        );

        const recognition = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM member_transition_recognitions
            `
        );

        assert.equal(
            recognition.count,
            1
        );

        const activity = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM activity_logs
            WHERE action =
                'MEMBER_TRANSITION_RECOGNIZED'
            `
        );

        assert.equal(
            activity.count,
            1
        );
    }
);

test(
    'simultaneous recognition attempts serialize to one canonical recognition',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const context =
            await seedContext(
                fixture.db
            );

        const results =
            await Promise.all([
                recognize(
                    fixture.db,
                    context
                ),
                recognize(
                    fixture.db,
                    context
                )
            ]);

        assert.equal(
            results.filter(
                result =>
                    result.recognized === true
            ).length,
            1
        );

        assert.equal(
            results.filter(
                result =>
                    result.idempotent === true
            ).length,
            1
        );

        const recognition = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM member_transition_recognitions
            `
        );

        assert.equal(
            recognition.count,
            1
        );

        const progress = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM growth_phase_progress
            WHERE youth_id = 1
            `
        );

        assert.equal(
            progress.count,
            3
        );
    }
);
