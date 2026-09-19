'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const Monitor =
    require('../lib/prayer-covenant-monitor');

const repositoryRoot =
    path.join(__dirname, '..');

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(
            sql,
            params,
            function callback(error) {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({
                    changes: this.changes,
                    lastID: this.lastID
                });
            }
        );
    });
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(
            sql,
            error => (
                error
                    ? reject(error)
                    : resolve()
            )
        );
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(
            error => (
                error
                    ? reject(error)
                    : resolve()
            )
        );
    });
}

async function createDatabase() {
    const db =
        new sqlite3.Database(':memory:');

    await exec(
        db,
        `
        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT,
            profile_picture TEXT
        );

        CREATE TABLE growth_onboarding_templates (
            id INTEGER PRIMARY KEY,
            template_code TEXT NOT NULL UNIQUE,
            title TEXT,
            duration_days INTEGER,
            is_active INTEGER NOT NULL DEFAULT 1,
            is_paused INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE growth_onboarding_enrollments (
            id INTEGER PRIMARY KEY,
            youth_id INTEGER,
            template_id INTEGER NOT NULL,
            status TEXT,
            enrolled_at TEXT,
            started_at TEXT,
            paused_at TEXT,
            resumed_at TEXT,
            completed_at TEXT,
            completed_days INTEGER
        );

        CREATE TABLE growth_onboarding_daily_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            enrollment_id INTEGER NOT NULL,
            completion_date TEXT NOT NULL,
            day_number INTEGER NOT NULL,
            source_key TEXT,
            completed_at TEXT
        );

        CREATE TABLE growth_prayer_rhythm_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            prayer_date TEXT NOT NULL,
            source_key TEXT NOT NULL UNIQUE,
            UNIQUE(youth_id, prayer_date)
        );
        `
    );

    await run(
        db,
        `INSERT INTO growth_onboarding_templates (
            id,
            template_code,
            title,
            duration_days,
            is_active,
            is_paused
         ) VALUES (
            1,
            'prayer-covenant-21',
            '21-Day Prayer Covenant',
            21,
            1,
            0
         )`
    );

    const members = [
        [1, 'Active Prayed'],
        [2, 'Active Waiting'],
        [3, 'Completed Member'],
        [4, 'Paused Member']
    ];

    for (const [id, name] of members) {
        await run(
            db,
            `INSERT INTO youth (
                id,
                name,
                profile_picture
             ) VALUES (?, ?, NULL)`,
            [id, name]
        );
    }

    const enrollments = [
        [
            1, 1, 'active',
            '2026-09-16T01:00:00.000Z',
            '2026-09-16T01:00:00.000Z',
            null, 2
        ],
        [
            2, 2, 'active',
            '2026-09-18T01:00:00.000Z',
            '2026-09-18T01:00:00.000Z',
            null, 1
        ],
        [
            3, 3, 'completed',
            '2026-08-20T01:00:00.000Z',
            '2026-08-20T01:00:00.000Z',
            '2026-09-10T01:00:00.000Z',
            21
        ],
        [
            4, 4, 'paused',
            '2026-09-10T01:00:00.000Z',
            '2026-09-10T01:00:00.000Z',
            null, 4
        ],
        [
            5, 214, 'active',
            '2026-09-01T01:00:00.000Z',
            '2026-09-01T01:00:00.000Z',
            null, 3
        ]
    ];

    for (
        const [
            id,
            youthId,
            status,
            enrolledAt,
            startedAt,
            completedAt,
            completedDays
        ] of enrollments
    ) {
        await run(
            db,
            `INSERT INTO growth_onboarding_enrollments (
                id,
                youth_id,
                template_id,
                status,
                enrolled_at,
                started_at,
                completed_at,
                completed_days
             ) VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
            [
                id,
                youthId,
                status,
                enrolledAt,
                startedAt,
                completedAt,
                completedDays
            ]
        );
    }

    await run(
        db,
        `UPDATE growth_onboarding_enrollments
         SET paused_at = '2026-09-15T01:00:00.000Z'
         WHERE id = 4`
    );

    const completionRows = [
        [1, '2026-09-16', 1],
        [1, '2026-09-19', 2],
        [2, '2026-09-18', 1],
        [5, '2026-09-01', 1],
        [5, '2026-09-03', 2],
        [5, '2026-09-05', 3]
    ];

    for (
        const [
            enrollmentId,
            date,
            dayNumber
        ] of completionRows
    ) {
        await run(
            db,
            `INSERT INTO growth_onboarding_daily_completions (
                enrollment_id,
                completion_date,
                day_number,
                source_key,
                completed_at
             ) VALUES (?, ?, ?, ?, ?)`,
            [
                enrollmentId,
                date,
                dayNumber,
                `test:${enrollmentId}:${dayNumber}`,
                `${date}T12:00:00.000Z`
            ]
        );
    }

    const rhythmRows = [
        [1, '2026-09-16'],
        [1, '2026-09-19'],
        [2, '2026-09-18']
    ];

    for (
        const [
            youthId,
            date
        ] of rhythmRows
    ) {
        await run(
            db,
            `INSERT INTO growth_prayer_rhythm_days (
                youth_id,
                prayer_date,
                source_key
             ) VALUES (?, ?, ?)`,
            [
                youthId,
                date,
                `rhythm:${youthId}:${date}`
            ]
        );
    }

    return db;
}

test(
    'Prayer Covenant monitor summary separates active, completed, paused, today, and unresolved data',
    async t => {
        const db =
            await createDatabase();

        t.after(
            async () => {
                await close(db);
            }
        );

        const result =
            await Monitor.getMonitorSummary(
                db,
                {
                    now:
                        new Date(
                            '2026-09-19T12:00:00.000Z'
                        )
                }
            );

        assert.equal(
            result.asOfDate,
            '2026-09-19'
        );

        assert.deepEqual(
            result.summary,
            {
                activeParticipants: 2,
                prayedToday: 1,
                notYetToday: 1,
                completedJourneys: 1,
                paused: 1,
                dataIssues: 1
            }
        );

        assert.equal(
            result.participants.length,
            4
        );

        assert.equal(
            result.dataReview.length,
            1
        );

        assert.equal(
            result.dataReview[0].youthId,
            214
        );

        assert.match(
            result.dataReview[0].name,
            /Youth ID 214/
        );

        assert.match(
            result.dataReview[0]
                .dataIssueReasons
                .join(' '),
            /could not be resolved/i
        );
    }
);

test(
    'calendar gaps do not reset 21-Day Prayer Covenant progress',
    async t => {
        const db =
            await createDatabase();

        t.after(
            async () => {
                await close(db);
            }
        );

        const detail =
            await Monitor.getMonitorDetail(
                db,
                1,
                {
                    now:
                        new Date(
                            '2026-09-19T12:00:00.000Z'
                        )
                }
            );

        assert.ok(detail);

        assert.equal(
            detail.completedPrayerDays,
            2
        );

        assert.equal(
            detail.durationDays,
            21
        );

        assert.equal(
            detail.days[0].completed,
            true
        );

        assert.equal(
            detail.days[0].completionDate,
            '2026-09-16'
        );

        assert.equal(
            detail.days[1].completed,
            true
        );

        assert.equal(
            detail.days[1].completionDate,
            '2026-09-19'
        );

        assert.deepEqual(
            detail.noPrayerDates,
            [
                '2026-09-17',
                '2026-09-18'
            ]
        );

        assert.equal(
            detail.prayedToday,
            true
        );

        assert.equal(
            detail.currentCalendarStreak,
            1
        );

        assert.equal(
            detail.longestCalendarStreak,
            1
        );
    }
);

test(
    'monitor API routes are read-only and protected by canonical access_prayer_journey permission',
    () => {
        const serverSource =
            fs.readFileSync(
                path.join(
                    repositoryRoot,
                    'server.js'
                ),
                'utf8'
            );

        assert.match(
            serverSource,
            /app\.get\(\s*'\/api\/admin\/prayer-covenant-monitor',\s*requirePermission\('access_prayer_journey'\)/
        );

        assert.match(
            serverSource,
            /app\.get\(\s*'\/api\/admin\/prayer-covenant-monitor\/:enrollmentId',\s*requirePermission\('access_prayer_journey'\)/
        );

        assert.match(
            serverSource,
            /require\('\.\/lib\/prayer-covenant-monitor'\)/
        );

        assert.doesNotMatch(
            serverSource,
            /app\.(?:post|put|patch|delete)\(\s*'\/api\/admin\/prayer-covenant-monitor/
        );
    }
);
