const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const root = path.resolve(__dirname, '..');

const migration = fs.readFileSync(
    path.join(
        root,
        'migrations',
        '20260913_notification_center_v1.sql'
    ),
    'utf8'
);

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function all(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function get(db, sql) {
    return new Promise((resolve, reject) => {
        db.get(sql, [], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

test(
    'notification center migration is additive, idempotent, empty by default, and dedupe-safe',
    async () => {
        const db = new sqlite3.Database(':memory:');

        try {
            await exec(
                db,
                `
                PRAGMA foreign_keys = ON;

                CREATE TABLE youth (
                    id INTEGER PRIMARY KEY,
                    name TEXT
                );

                CREATE TABLE announcements (
                    id INTEGER PRIMARY KEY,
                    title TEXT
                );

                INSERT INTO youth (
                    id,
                    name
                )
                VALUES (
                    1,
                    'Member'
                );

                INSERT INTO announcements (
                    id,
                    title
                )
                VALUES (
                    7,
                    'Legacy Announcement'
                );
                `
            );

            await exec(db, migration);
            await exec(db, migration);

            const tables =
                await all(
                    db,
                    `
                    SELECT name
                    FROM sqlite_master
                    WHERE type='table'
                      AND name LIKE 'notification_%'
                    ORDER BY name
                    `
                );

            assert.deepEqual(
                tables.map(row => row.name),
                [
                    'notification_deliveries',
                    'notification_events',
                    'notification_preferences',
                    'notification_recipients'
                ]
            );

            for (const table of [
                'notification_events',
                'notification_recipients',
                'notification_deliveries',
                'notification_preferences'
            ]) {
                const row =
                    await get(
                        db,
                        `SELECT COUNT(*) count
                         FROM ${table}`
                    );

                assert.equal(
                    row.count,
                    0,
                    `${table} should have no automatic backfill`
                );
            }

            const legacy =
                await get(
                    db,
                    `SELECT COUNT(*) count
                     FROM announcements
                     WHERE id = 7`
                );

            assert.equal(
                legacy.count,
                1
            );

            await exec(
                db,
                `
                INSERT INTO notification_events (
                    event_key,
                    category,
                    title,
                    message
                )
                VALUES (
                    'journey-phase-ready:1:belong:v1',
                    'journey_progress',
                    'Your next invitation is ready',
                    'Continue your Growth Journey.'
                );

                INSERT INTO notification_recipients (
                    event_id,
                    youth_id
                )
                VALUES (
                    1,
                    1
                );
                `
            );

            await assert.rejects(
                exec(
                    db,
                    `
                    INSERT INTO notification_events (
                        event_key,
                        category,
                        title,
                        message
                    )
                    VALUES (
                        'journey-phase-ready:1:belong:v1',
                        'journey_progress',
                        'Duplicate',
                        'Duplicate'
                    );
                    `
                )
            );

            await assert.rejects(
                exec(
                    db,
                    `
                    INSERT INTO notification_recipients (
                        event_id,
                        youth_id
                    )
                    VALUES (
                        1,
                        1
                    );
                    `
                )
            );
        } finally {
            await close(db);
        }
    }
);
