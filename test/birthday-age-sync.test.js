'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');

const {
    TIMEZONE,
    manilaDateKey,
    birthdayOccursOn,
    calculateAge,
    runCatchUp
} = require('../lib/birthday-age-sync');

function openDb() {
    return new sqlite3.Database(':memory:');
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, error =>
            error ? reject(error) : resolve()
        );
    });
}

function get(db, sql) {
    return new Promise((resolve, reject) => {
        db.get(sql, (error, row) =>
            error ? reject(error) : resolve(row)
        );
    });
}

function run(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, error =>
            error ? reject(error) : resolve()
        );
    });
}

function close(db) {
    return new Promise(resolve =>
        db.close(() => resolve())
    );
}

test(
    'birthday age calculation follows Manila midnight',
    () => {
        assert.equal(
            TIMEZONE,
            'Asia/Manila'
        );

        assert.equal(
            manilaDateKey(
                new Date(
                    '2026-09-16T15:59:59Z'
                )
            ),
            '2026-09-16'
        );

        assert.equal(
            manilaDateKey(
                new Date(
                    '2026-09-16T16:00:00Z'
                )
            ),
            '2026-09-17'
        );

        assert.equal(
            calculateAge(
                '2000-09-17',
                '2026-09-17'
            ),
            26
        );

        assert.equal(
            birthdayOccursOn(
                '2000-09-17',
                '2026-09-17'
            ),
            true
        );
    }
);

test(
    'first run changes only todays birthday and keeps Age manually editable afterward',
    async t => {
        const db = openDb();

        t.after(() => close(db));

        await exec(
            db,
            `
            CREATE TABLE youth (
                id INTEGER PRIMARY KEY,
                age INTEGER,
                birthday TEXT
            );

            CREATE TABLE app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            INSERT INTO youth
            VALUES
                (1, 25, '2000-09-17'),
                (2, 99, '2001-09-18'),
                (3, 40, NULL);
            `
        );

        const first =
            await runCatchUp({
                database: db,
                now: new Date(
                    '2026-09-17T00:05:00+08:00'
                )
            });

        assert.equal(first.updated, 1);

        assert.equal(
            (
                await get(
                    db,
                    'SELECT age FROM youth WHERE id=1'
                )
            ).age,
            26
        );

        assert.equal(
            (
                await get(
                    db,
                    'SELECT age FROM youth WHERE id=2'
                )
            ).age,
            99
        );

        await run(
            db,
            'UPDATE youth SET age=7 WHERE id=1'
        );

        const second =
            await runCatchUp({
                database: db,
                now: new Date(
                    '2026-09-17T12:00:00+08:00'
                )
            });

        assert.equal(
            second.datesProcessed,
            0
        );

        assert.equal(
            (
                await get(
                    db,
                    'SELECT age FROM youth WHERE id=1'
                )
            ).age,
            7
        );
    }
);

test(
    'startup catch-up processes a birthday missed during downtime',
    async t => {
        const db = openDb();

        t.after(() => close(db));

        await exec(
            db,
            `
            CREATE TABLE youth (
                id INTEGER PRIMARY KEY,
                age INTEGER,
                birthday TEXT
            );

            CREATE TABLE app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            INSERT INTO youth
            VALUES
                (10, 15, '2010-09-16');

            INSERT INTO app_settings
            VALUES
                (
                    'birthday_age_sync_last_date',
                    '2026-09-15'
                );
            `
        );

        const result =
            await runCatchUp({
                database: db,
                now: new Date(
                    '2026-09-17T08:00:00+08:00'
                )
            });

        assert.equal(
            result.datesProcessed,
            2
        );

        assert.equal(
            (
                await get(
                    db,
                    'SELECT age FROM youth WHERE id=10'
                )
            ).age,
            16
        );
    }
);
