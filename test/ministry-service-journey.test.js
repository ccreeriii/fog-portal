'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3');

const MinistryJourney =
    require('../lib/ministry-service-journey');

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
        path.join(os.tmpdir(), 'fog-ministry-priority-')
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

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
            if (err) return reject(err);

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
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

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
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

        INSERT INTO youth (id, name)
        VALUES
            (1, 'Priority Test Member'),
            (2, 'Other Member');

        INSERT INTO users (id, username)
        VALUES
            (50, 'member@example.test');

        INSERT INTO ministries (id, name)
        VALUES
            (10, 'Seraphs'),
            (20, 'Levites'),
            (30, 'Lighthouse'),
            (40, 'JOY');

        INSERT INTO ministry_members (
            id,
            ministry_id,
            youth_id,
            role,
            is_priority
        )
        VALUES
            (101, 10, 1, 'Member', 1),
            (102, 20, 1, 'Integration Period', 0),
            (103, 30, 1, 'Applicant', 0),
            (104, 40, 1, 'Core Member', 0),

            (201, 10, 2, 'Member', 0);
    `);

    await exec(db, migration);
    await exec(db, migration);
}

function setPriority(
    db,
    mappingId,
    overrides = {}
) {
    return MinistryJourney.setPriorityMinistry(
        db,
        {
            youthId: 1,
            mappingId,
            actorUserId: 50,
            actorName: 'Priority Test Member',
            source: 'member_profile',
            ...overrides
        }
    );
}

test(
    'priority candidates include current relationships but exclude Applicant',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const rows =
            await MinistryJourney.listPriorityCandidates(
                fixture.db,
                1
            );

        assert.deepEqual(
            rows.map(row => row.mapping_id).sort(),
            [101, 102, 104]
        );

        assert.equal(
            rows.some(row => row.role === 'Applicant'),
            false
        );
    }
);

test(
    'Applicant cannot become Priority Ministry',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await assert.rejects(
            setPriority(fixture.db, 103),
            error =>
                error &&
                error.code ===
                    'MINISTRY_NOT_PRIORITY_ELIGIBLE'
        );

        const current = await get(
            fixture.db,
            `
            SELECT id
            FROM ministry_members
            WHERE youth_id = 1
              AND is_priority = 1
            `
        );

        assert.equal(current.id, 101);

        const history = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_priority_history
            `
        );

        assert.equal(history.count, 0);
    }
);

test(
    'Integration Period may become Priority and secondary ministries remain intact',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const result =
            await setPriority(
                fixture.db,
                102
            );

        assert.equal(result.changed, true);
        assert.equal(result.previousMappingId, 101);
        assert.equal(result.mappingId, 102);

        const rows = await all(
            fixture.db,
            `
            SELECT
                id,
                role,
                is_priority
            FROM ministry_members
            WHERE youth_id = 1
            ORDER BY id
            `
        );

        assert.equal(rows.length, 4);

        assert.equal(
            rows.filter(row => row.is_priority === 1).length,
            1
        );

        assert.equal(
            rows.find(row => row.id === 102).is_priority,
            1
        );

        assert.equal(
            rows.find(row => row.id === 101).role,
            'Member'
        );

        assert.equal(
            rows.find(row => row.id === 104).role,
            'Core Member'
        );

        const history = await all(
            fixture.db,
            `
            SELECT *
            FROM ministry_priority_history
            `
        );

        assert.equal(history.length, 1);
        assert.equal(history[0].previous_mapping_id, 101);
        assert.equal(history[0].new_mapping_id, 102);
    }
);

test(
    'selecting the existing Priority again is idempotent and creates no duplicate history',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const result =
            await setPriority(
                fixture.db,
                101
            );

        assert.equal(result.changed, false);
        assert.equal(result.idempotent, true);

        const history = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_priority_history
            `
        );

        assert.equal(history.count, 0);
    }
);

test(
    'member cannot select another member ministry mapping',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await assert.rejects(
            setPriority(
                fixture.db,
                201
            ),
            error =>
                error &&
                error.code ===
                    'MINISTRY_MEMBERSHIP_NOT_FOUND'
        );

        const current = await get(
            fixture.db,
            `
            SELECT id
            FROM ministry_members
            WHERE youth_id = 1
              AND is_priority = 1
            `
        );

        assert.equal(current.id, 101);
    }
);

test(
    'active discernment blocks silent Priority switch to another ministry',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await run(
            fixture.db,
            `
            INSERT INTO ministry_discernment_cases (
                youth_id,
                ministry_id,
                source_type,
                status,
                intent_text,
                priority_at_open
            )
            VALUES (
                1,
                10,
                'profile',
                'intent_submitted',
                'I desire to discern my service.',
                1
            )
            `
        );

        await assert.rejects(
            setPriority(
                fixture.db,
                102
            ),
            error =>
                error &&
                error.code ===
                    'ACTIVE_DISCERNMENT_PRIORITY_CONFLICT'
        );

        const current = await get(
            fixture.db,
            `
            SELECT id
            FROM ministry_members
            WHERE youth_id = 1
              AND is_priority = 1
            `
        );

        assert.equal(current.id, 101);
    }
);

test(
    'history failure rolls back the Priority mutation atomically',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        await exec(
            fixture.db,
            `
            CREATE TRIGGER fail_priority_history
            BEFORE INSERT
            ON ministry_priority_history
            BEGIN
                SELECT RAISE(
                    ABORT,
                    'Injected priority history failure'
                );
            END;
            `
        );

        await assert.rejects(
            setPriority(
                fixture.db,
                102
            )
        );

        const priorities = await all(
            fixture.db,
            `
            SELECT id, is_priority
            FROM ministry_members
            WHERE youth_id = 1
            ORDER BY id
            `
        );

        assert.equal(
            priorities.find(row => row.id === 101).is_priority,
            1
        );

        assert.equal(
            priorities.find(row => row.id === 102).is_priority,
            0
        );

        const history = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_priority_history
            `
        );

        assert.equal(history.count, 0);
    }
);

test(
    'simultaneous requests for the same Priority serialize to one change and one history record',
    async t => {
        const fixture = openDatabase();
        t.after(fixture.close);

        await setup(fixture.db);

        const results = await Promise.all([
            setPriority(
                fixture.db,
                102
            ),
            setPriority(
                fixture.db,
                102
            )
        ]);

        assert.equal(
            results.filter(
                result => result.changed === true
            ).length,
            1
        );

        assert.equal(
            results.filter(
                result => result.idempotent === true
            ).length,
            1
        );

        const current = await all(
            fixture.db,
            `
            SELECT id
            FROM ministry_members
            WHERE youth_id = 1
              AND is_priority = 1
            `
        );

        assert.deepEqual(
            current.map(row => row.id),
            [102]
        );

        const history = await get(
            fixture.db,
            `
            SELECT COUNT(*) AS count
            FROM ministry_priority_history
            `
        );

        assert.equal(history.count, 1);
    }
);
