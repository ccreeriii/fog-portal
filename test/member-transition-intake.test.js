'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3');

const Transition = require('../lib/member-transition-intake');

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
        path.join(os.tmpdir(), 'fog-transition-intake-')
    );
    const filename = path.join(directory, 'test.db');
    const db = new sqlite3.Database(filename);

    return {
        db,
        close: () => new Promise(resolve => {
            db.close(() => {
                fs.rmSync(directory, {
                    recursive: true,
                    force: true
                });
                resolve();
            });
        })
    };
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, err => err ? reject(err) : resolve());
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

async function setup(db) {
    await exec(db, `
        PRAGMA foreign_keys = ON;

        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
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
            is_priority INTEGER DEFAULT 0
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
            evidence_type TEXT
        );

        INSERT INTO youth (id, name)
        VALUES (1, 'Adult Test Member');

        INSERT INTO users (id, username)
        VALUES (50, 'reviewer@example.test');

        INSERT INTO ministries (id, name)
        VALUES
            (10, 'Seraphs'),
            (20, 'Levites');

        INSERT INTO ministry_members (
            ministry_id,
            youth_id,
            role,
            is_priority
        ) VALUES (
            10,
            1,
            'Member',
            0
        );

        INSERT INTO growth_phase_progress (
            youth_id,
            phase_id,
            status,
            completion_basis
        ) VALUES (
            1,
            1,
            'completed',
            'existing-proof'
        );

        INSERT INTO growth_evidence (
            youth_id,
            evidence_type
        ) VALUES (
            1,
            'existing-proof'
        );
    `);

    await exec(db, migration);
    await exec(db, migration);
}

async function officialSnapshot(db) {
    return {
        ministryMembers: await get(
            db,
            `SELECT COUNT(*) AS count,
                    COALESCE(SUM(is_priority),0) AS priority
             FROM ministry_members`
        ),
        phaseProgress: await get(
            db,
            `SELECT COUNT(*) AS count
             FROM growth_phase_progress`
        ),
        evidence: await get(
            db,
            `SELECT COUNT(*) AS count
             FROM growth_evidence`
        )
    };
}

test(
    'transition intake submission is self-reported only and cannot mutate official standing',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const before = await officialSnapshot(fixture.db);

        const intake = await Transition.createIntake(
            fixture.db,
            {
                youthId: 1,
                intakeKind: 'adult_historical'
            }
        );

        await assert.rejects(
            Transition.submitIntake(
                fixture.db,
                {
                    intakeId: intake.id,
                    youthId: 1,
                    serviceState: 'current',
                    answers: {
                        relationship: 'committed_member'
                    },
                    reportedMinistries: [
                        {
                            ministry_id: 10,
                            ministry_name_snapshot: 'Seraphs',
                            service_state: 'current'
                        },
                        {
                            ministry_id: 20,
                            ministry_name_snapshot: 'Levites',
                            service_state: 'current'
                        }
                    ]
                }
            ),
            err => err && err.code === 'PRIORITY_REQUIRED'
        );

        const stillDraft = await get(
            fixture.db,
            `SELECT status
             FROM member_transition_intakes
             WHERE id = ?`,
            [intake.id]
        );

        assert.equal(stillDraft.status, 'draft');

        const submitted = await Transition.submitIntake(
            fixture.db,
            {
                intakeId: intake.id,
                youthId: 1,
                serviceState: 'current',
                answers: {
                    relationship: 'committed_member',
                    years_with_fog: '6-10'
                },
                reportedMinistries: [
                    {
                        ministry_id: 10,
                        ministry_name_snapshot: 'Seraphs',
                        service_state: 'current',
                        selected_priority: true,
                        wants_discernment: true
                    },
                    {
                        ministry_id: 20,
                        ministry_name_snapshot: 'Levites',
                        service_state: 'current'
                    }
                ]
            }
        );

        assert.equal(submitted.status, 'submitted');

        const reported =
            await Transition.getReportedMinistries(
                fixture.db,
                intake.id
            );

        assert.equal(reported.length, 2);
        assert.equal(
            reported.filter(row => row.selected_priority === 1).length,
            1
        );

        const after = await officialSnapshot(fixture.db);

        assert.deepEqual(after, before);
    }
);

test(
    'leadership approval records a proposal but still cannot recognize Growth or ministry standing',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const before = await officialSnapshot(fixture.db);

        const intake = await Transition.createIntake(
            fixture.db,
            {
                youthId: 1,
                intakeKind: 'adult_historical'
            }
        );

        await Transition.submitIntake(
            fixture.db,
            {
                intakeId: intake.id,
                youthId: 1,
                serviceState: 'current',
                answers: {
                    relationship: 'committed_member'
                },
                reportedMinistries: [
                    {
                        ministry_id: 10,
                        ministry_name_snapshot: 'Seraphs',
                        service_state: 'current',
                        wants_discernment: true
                    }
                ]
            }
        );

        await Transition.beginReview(
            fixture.db,
            {
                intakeId: intake.id,
                youthId: 1
            }
        );

        const review = await Transition.recordReview(
            fixture.db,
            {
                intakeId: intake.id,
                youthId: 1,
                reviewerUserId: 50,
                reviewerName: 'Shepherd Reviewer',
                decision: 'approved',
                proposedStanding: 'active_servant',
                proposedPhases: [
                    'encounter',
                    'belong',
                    'commit'
                ],
                notes: 'History reviewed.'
            }
        );

        assert.equal(review.decision, 'approved');
        assert.equal(
            review.proposed_standing,
            'active_servant'
        );

        const state = await get(
            fixture.db,
            `SELECT status, recognized_at
             FROM member_transition_intakes
             WHERE id = ?`,
            [intake.id]
        );

        assert.equal(state.status, 'approved');
        assert.equal(state.recognized_at, null);

        const after = await officialSnapshot(fixture.db);

        assert.deepEqual(after, before);
    }
);

test(
    'single current ministry becomes the reported priority without changing canonical ministry membership',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const before = await officialSnapshot(fixture.db);

        const intake = await Transition.createIntake(
            fixture.db,
            {
                youthId: 1,
                intakeKind: 'accelerated_confirmation'
            }
        );

        await Transition.submitIntake(
            fixture.db,
            {
                intakeId: intake.id,
                youthId: 1,
                serviceState: 'current',
                answers: {},
                reportedMinistries: [
                    {
                        ministry_id: 10,
                        ministry_name_snapshot: 'Seraphs',
                        service_state: 'current'
                    }
                ]
            }
        );

        const reported =
            await Transition.getReportedMinistries(
                fixture.db,
                intake.id
            );

        assert.equal(reported.length, 1);
        assert.equal(reported[0].selected_priority, 1);

        const after = await officialSnapshot(fixture.db);

        assert.deepEqual(after, before);
        assert.equal(after.ministryMembers.priority, 0);
    }
);
