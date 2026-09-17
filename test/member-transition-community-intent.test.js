'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3');

const CommunityIntent =
    require('../lib/member-transition-community-intent');

const migrationV1 = fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'migrations',
        '20260917_member_transition_intake_v1.sql'
    ),
    'utf8'
);

const migrationV2 = fs.readFileSync(
    path.join(
        __dirname,
        '..',
        'migrations',
        '20260917_member_transition_community_confirmation_v2.sql'
    ),
    'utf8'
);

function openDatabase() {
    const directory = fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            'fog-community-confirmation-'
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
            youth_id INTEGER,
            username TEXT,
            permissions TEXT
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
        VALUES
            (
                1,
                'Existing Member',
                'My original Community Intent from years ago.'
            ),
            (
                2,
                'Other Member',
                NULL
            );

        INSERT INTO users (
            id,
            youth_id,
            username,
            permissions
        )
        VALUES
            (
                50,
                1,
                'member@example.test',
                '["view_profile"]'
            );

        INSERT INTO ministries (
            id,
            name
        )
        VALUES (
            10,
            'Seraphs'
        );

        INSERT INTO ministry_members (
            ministry_id,
            youth_id,
            role,
            is_priority
        )
        VALUES (
            10,
            1,
            'Core Member',
            1
        );
        `
    );

    await exec(db, migrationV1);
    await exec(db, migrationV1);

    await exec(db, migrationV2);
    await exec(db, migrationV2);
}

async function createIntake(
    db,
    {
        youthId = 1,
        kind = 'accelerated_confirmation',
        status = 'draft'
    } = {}
) {
    return run(
        db,
        `
        INSERT INTO member_transition_intakes (
            youth_id,
            intake_kind,
            status,
            answers_json
        )
        VALUES (?, ?, ?, '{}')
        `,
        [
            youthId,
            kind,
            status
        ]
    );
}

function submit(
    db,
    intakeId,
    overrides = {}
) {
    return CommunityIntent
        .submitCommunityDeclaration(
            db,
            {
                youthId: 1,
                intakeId,
                choice: 'yes',
                statementText:
                    'I desire to continue journeying with Fire Of God Ministries.',
                actorUserId: 50,
                actorName: 'Existing Member',
                now: new Date(
                    '2026-09-17T12:00:00.000Z'
                ),
                ...overrides
            }
        );
}

test(
    'transition confirmation is append-only and preserves original canonical Community Intent',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db
            );

        const result =
            await submit(
                fixture.db,
                intake.lastID
            );

        assert.equal(
            result.submitted,
            true
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
            'My original Community Intent from years ago.'
        );

        const row = await get(
            fixture.db,
            `
            SELECT
                community_intent_choice
            FROM member_transition_intakes
            WHERE id = ?
            `,
            [intake.lastID]
        );

        assert.equal(
            row.community_intent_choice,
            'yes'
        );

        const declaration =
            await get(
                fixture.db,
                `
                SELECT *
                FROM member_transition_community_declarations
                WHERE intake_id = ?
                `,
                [intake.lastID]
            );

        assert.equal(
            declaration.choice,
            'yes'
        );

        assert.equal(
            declaration.previous_declaration_id,
            null
        );
    }
);

test(
    'transition confirmation does not grant permissions or mutate Growth or ministry standing',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db
            );

        await submit(
            fixture.db,
            intake.lastID
        );

        const user = await get(
            fixture.db,
            `
            SELECT permissions
            FROM users
            WHERE id = 50
            `
        );

        assert.equal(
            user.permissions,
            '["view_profile"]'
        );

        const evidence = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM growth_evidence
            `
        );

        assert.equal(
            evidence.count,
            0
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
            SELECT
                role,
                is_priority
            FROM ministry_members
            WHERE youth_id = 1
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
    'identical retry is idempotent and does not duplicate declaration or activity',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db
            );

        const first =
            await submit(
                fixture.db,
                intake.lastID
            );

        const second =
            await submit(
                fixture.db,
                intake.lastID
            );

        assert.equal(
            first.submitted,
            true
        );

        assert.equal(
            second.submitted,
            false
        );

        assert.equal(
            second.idempotent,
            true
        );

        const declarations =
            await get(
                fixture.db,
                `
                SELECT COUNT(*) AS count
                FROM member_transition_community_declarations
                `
            );

        assert.equal(
            declarations.count,
            1
        );

        const activity =
            await get(
                fixture.db,
                `
                SELECT COUNT(*) AS count
                FROM activity_logs
                WHERE action =
                    'MEMBER_TRANSITION_COMMUNITY_INTENT'
                `
            );

        assert.equal(
            activity.count,
            1
        );
    }
);

test(
    'changed declaration creates a new immutable revision linked to the previous declaration',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db
            );

        const first =
            await submit(
                fixture.db,
                intake.lastID,
                {
                    choice: 'discerning',
                    statementText:
                        'I am prayerfully discerning.'
                }
            );

        const second =
            await submit(
                fixture.db,
                intake.lastID,
                {
                    choice: 'yes',
                    statementText:
                        'I now desire to journey with FOG.',
                    now: new Date(
                        '2026-09-18T12:00:00.000Z'
                    )
                }
            );

        assert.equal(
            second.declaration.previous_declaration_id,
            first.declaration.id
        );

        const count = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM member_transition_community_declarations
            WHERE intake_id = ?
            `,
            [intake.lastID]
        );

        assert.equal(
            count.count,
            2
        );

        const current = await get(
            fixture.db,
            `
            SELECT community_intent_choice
            FROM member_transition_intakes
            WHERE id = ?
            `,
            [intake.lastID]
        );

        assert.equal(
            current.community_intent_choice,
            'yes'
        );
    }
);

test(
    'member cannot submit Community confirmation to another member intake',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db,
                {
                    youthId: 2
                }
            );

        await assert.rejects(
            submit(
                fixture.db,
                intake.lastID
            ),
            error =>
                error &&
                error.code ===
                    'INTAKE_OWNER_MISMATCH'
        );

        const count = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM member_transition_community_declarations
            `
        );

        assert.equal(
            count.count,
            0
        );
    }
);

test(
    'closed transition intake rejects new Community declaration',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db,
                {
                    status: 'closed'
                }
            );

        await assert.rejects(
            submit(
                fixture.db,
                intake.lastID
            ),
            error =>
                error &&
                error.code ===
                    'INTAKE_CLOSED'
        );
    }
);

test(
    'activity failure rolls back declaration and current-choice update',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db
            );

        await exec(
            fixture.db,
            `
            CREATE TRIGGER fail_transition_community_activity
            BEFORE INSERT
            ON activity_logs
            WHEN NEW.action =
                'MEMBER_TRANSITION_COMMUNITY_INTENT'
            BEGIN
                SELECT RAISE(
                    ABORT,
                    'Injected activity failure'
                );
            END;
            `
        );

        await assert.rejects(
            submit(
                fixture.db,
                intake.lastID
            )
        );

        const declaration =
            await get(
                fixture.db,
                `
                SELECT COUNT(*) AS count
                FROM member_transition_community_declarations
                `
            );

        assert.equal(
            declaration.count,
            0
        );

        const current = await get(
            fixture.db,
            `
            SELECT community_intent_choice
            FROM member_transition_intakes
            WHERE id = ?
            `,
            [intake.lastID]
        );

        assert.equal(
            current.community_intent_choice,
            null
        );
    }
);

test(
    'simultaneous identical submissions serialize to one declaration',
    async t => {
        const fixture =
            openDatabase();

        t.after(fixture.close);

        await setup(fixture.db);

        const intake =
            await createIntake(
                fixture.db
            );

        const results =
            await Promise.all([
                submit(
                    fixture.db,
                    intake.lastID
                ),
                submit(
                    fixture.db,
                    intake.lastID
                )
            ]);

        assert.equal(
            results.filter(
                result =>
                    result.submitted === true
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

        const count = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM member_transition_community_declarations
            `
        );

        assert.equal(
            count.count,
            1
        );
    }
);
