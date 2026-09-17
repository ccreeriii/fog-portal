'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3');

const Discernment =
    require('../lib/ministry-discernment-journey');

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
            'fog-ministry-discernment-'
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
    return new Promise((resolve, reject) => {
        db.exec(
            sql,
            err => err ? reject(err) : resolve()
        );
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(
            sql,
            params,
            (err, row) => {
                if (err) return reject(err);
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
                if (err) return reject(err);
                resolve(rows || []);
            }
        );
    });
}

async function setup(db) {
    await exec(db, `
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
            UNIQUE(ministry_id, youth_id)
        );

        CREATE TABLE growth_phase_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER,
            phase_id INTEGER,
            status TEXT,
            completion_basis TEXT
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
        VALUES
            (1, 'Existing Servant', NULL),
            (2, 'Other Servant', NULL);

        INSERT INTO users (
            id,
            username
        )
        VALUES
            (50, 'member@example.test'),
            (60, 'leader@example.test');

        INSERT INTO ministries (
            id,
            name
        )
        VALUES
            (10, 'Seraphs'),
            (20, 'Levites'),
            (30, 'Lighthouse');

        INSERT INTO ministry_members (
            id,
            ministry_id,
            youth_id,
            role,
            assigned_at,
            is_priority
        )
        VALUES
            (101, 10, 1, 'Core Member', '2024-01-01', 1),
            (102, 20, 1, 'Member', '2025-01-01', 0),
            (103, 30, 1, 'Applicant', '2026-01-01', 0),
            (201, 10, 2, 'Member', '2025-01-01', 1);
    `);

    await exec(db, migration);
    await exec(db, migration);
}

function openCase(
    db,
    overrides = {}
) {
    return Discernment.openDiscernmentCase(
        db,
        {
            youthId: 1,
            ministryId: 10,
            sourceType: 'accelerated_transition',
            intentText:
                'I desire to prayerfully discern my continued service.',
            availability:
                'Regularly available',
            giftsText:
                'Music and encouragement',
            growthHopesText:
                'To grow in humility and service.',
            wantsLeaderConversation: true,
            actorUserId: 50,
            actorName: 'Existing Servant',
            ...overrides
        }
    );
}

function leaderOptions(
    caseId,
    overrides = {}
) {
    return {
        caseId,
        actorUserId: 60,
        actorName: 'Ministry Leader',
        details: {
            note: 'Pastoral discernment note.'
        },
        ...overrides
    };
}

test(
    'existing servant can begin discernment in the Priority Ministry without changing ministry role',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const before = await get(
            fixture.db,
            `
            SELECT role, is_priority
            FROM ministry_members
            WHERE id = 101
            `
        );

        const result =
            await openCase(fixture.db);

        assert.equal(result.opened, true);
        assert.equal(
            result.case.status,
            'intent_submitted'
        );

        const after = await get(
            fixture.db,
            `
            SELECT role, is_priority
            FROM ministry_members
            WHERE id = 101
            `
        );

        assert.deepEqual(after, before);

        const events =
            await Discernment.listCaseEvents(
                fixture.db,
                result.case.id
            );

        assert.equal(events.length, 1);
        assert.equal(
            events[0].event_type,
            'intent_submitted'
        );
    }
);

test(
    'secondary ministry cannot begin required discernment before becoming Priority',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await assert.rejects(
            openCase(
                fixture.db,
                {
                    ministryId: 20
                }
            ),
            error =>
                error &&
                error.code ===
                    'PRIORITY_MINISTRY_REQUIRED'
        );
    }
);

test(
    'Applicant cannot use existing-servant discernment pathway',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await assert.rejects(
            openCase(
                fixture.db,
                {
                    ministryId: 30
                }
            ),
            error =>
                error &&
                error.code ===
                    'CURRENT_MINISTRY_REQUIRED'
        );
    }
);

test(
    'double submission for the same open case is idempotent',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const first =
            await openCase(fixture.db);

        const second =
            await openCase(fixture.db);

        assert.equal(first.opened, true);
        assert.equal(
            second.idempotent,
            true
        );

        const cases = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_discernment_cases
            `
        );

        assert.equal(cases.count, 1);

        const events = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_discernment_events
            `
        );

        assert.equal(events.count, 1);
    }
);

test(
    'discernment follows consultation then optional assessment then recommendation and completion',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const opened =
            await openCase(fixture.db);

        const caseId =
            opened.case.id;

        let current =
            await Discernment.completeConsultation(
                fixture.db,
                leaderOptions(caseId)
            );

        assert.equal(
            current.status,
            'consultation_complete'
        );

        current =
            await Discernment.beginAssessment(
                fixture.db,
                leaderOptions(caseId)
            );

        assert.equal(
            current.status,
            'assessment_pending'
        );

        current =
            await Discernment.completeAssessment(
                fixture.db,
                leaderOptions(caseId)
            );

        assert.equal(
            current.status,
            'assessment_complete'
        );

        current =
            await Discernment.recommend(
                fixture.db,
                {
                    ...leaderOptions(caseId),
                    recommended: true,
                    assessmentRequired: true
                }
            );

        assert.equal(
            current.status,
            'recommended'
        );

        current =
            await Discernment.completeDiscernment(
                fixture.db,
                leaderOptions(caseId)
            );

        assert.equal(
            current.status,
            'completed'
        );

        assert.ok(current.closed_at);

        const events =
            await Discernment.listCaseEvents(
                fixture.db,
                caseId
            );

        assert.deepEqual(
            events.map(
                event => event.event_type
            ),
            [
                'intent_submitted',
                'leader_consultation_completed',
                'assessment_started',
                'assessment_completed',
                'recommended',
                'discernment_completed'
            ]
        );
    }
);

test(
    'assessment may be skipped when leadership recommends directly after consultation',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const opened =
            await openCase(fixture.db);

        await Discernment.completeConsultation(
            fixture.db,
            leaderOptions(opened.case.id)
        );

        const recommended =
            await Discernment.recommend(
                fixture.db,
                {
                    ...leaderOptions(
                        opened.case.id
                    ),
                    recommended: true,
                    assessmentRequired: false
                }
            );

        assert.equal(
            recommended.status,
            'recommended'
        );
    }
);

test(
    'invalid discernment sequence fails closed',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const opened =
            await openCase(fixture.db);

        await assert.rejects(
            Discernment.completeAssessment(
                fixture.db,
                leaderOptions(
                    opened.case.id
                )
            ),
            error =>
                error &&
                error.code ===
                    'INVALID_DISCERNMENT_TRANSITION'
        );

        const current = await get(
            fixture.db,
            `
            SELECT status
            FROM ministry_discernment_cases
            WHERE id = ?
            `,
            [opened.case.id]
        );

        assert.equal(
            current.status,
            'intent_submitted'
        );
    }
);

test(
    'discernment never changes Community Intent, Growth progress, ministry role, or Priority',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const opened =
            await openCase(fixture.db);

        await Discernment.completeConsultation(
            fixture.db,
            leaderOptions(opened.case.id)
        );

        await Discernment.recommend(
            fixture.db,
            {
                ...leaderOptions(
                    opened.case.id
                ),
                recommended: true,
                assessmentRequired: false
            }
        );

        await Discernment.completeDiscernment(
            fixture.db,
            leaderOptions(opened.case.id)
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

        const progress = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM growth_phase_progress
            `
        );

        assert.equal(
            progress.count,
            0
        );

        const ministry = await get(
            fixture.db,
            `
            SELECT role, is_priority
            FROM ministry_members
            WHERE id = 101
            `
        );

        assert.equal(
            ministry.role,
            'Core Member'
        );

        assert.equal(
            ministry.is_priority,
            1
        );
    }
);

test(
    'member cannot mutate another member discernment case',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const opened =
            await openCase(fixture.db);

        await assert.rejects(
            Discernment.withdrawDiscernment(
                fixture.db,
                {
                    caseId: opened.case.id,
                    youthId: 2,
                    actorUserId: 50,
                    actorName: 'Other Servant'
                }
            ),
            error =>
                error &&
                error.code ===
                    'CASE_OWNER_MISMATCH'
        );

        const current = await get(
            fixture.db,
            `
            SELECT status
            FROM ministry_discernment_cases
            WHERE id = ?
            `,
            [opened.case.id]
        );

        assert.equal(
            current.status,
            'intent_submitted'
        );
    }
);

test(
    'event write failure rolls back the entire discernment state transition',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const opened =
            await openCase(fixture.db);

        await exec(
            fixture.db,
            `
            CREATE TRIGGER fail_discernment_event
            BEFORE INSERT
            ON ministry_discernment_events
            WHEN NEW.event_type =
                'leader_consultation_completed'
            BEGIN
                SELECT RAISE(
                    ABORT,
                    'Injected discernment event failure'
                );
            END;
            `
        );

        await assert.rejects(
            Discernment.completeConsultation(
                fixture.db,
                leaderOptions(
                    opened.case.id
                )
            )
        );

        const current = await get(
            fixture.db,
            `
            SELECT status
            FROM ministry_discernment_cases
            WHERE id = ?
            `,
            [opened.case.id]
        );

        assert.equal(
            current.status,
            'intent_submitted'
        );

        const events = await all(
            fixture.db,
            `
            SELECT event_type
            FROM ministry_discernment_events
            WHERE case_id = ?
            ORDER BY id
            `,
            [opened.case.id]
        );

        assert.deepEqual(
            events.map(row => row.event_type),
            ['intent_submitted']
        );
    }
);

test(
    'simultaneous open requests serialize to one case and one intent event',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const results =
            await Promise.all([
                openCase(fixture.db),
                openCase(fixture.db)
            ]);

        assert.equal(
            results.filter(
                result =>
                    result.opened === true
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

        const cases = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_discernment_cases
            `
        );

        assert.equal(cases.count, 1);

        const events = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_discernment_events
            `
        );

        assert.equal(events.count, 1);
    }
);
