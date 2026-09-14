'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const sqlite3 =
    require('sqlite3');

const NotificationCenter =
    require('../lib/notification-center');

const {
    createNotificationDeliveryEngine
} = require('../lib/notification-delivery');

const {
    TIME_ZONE,
    getManilaClock,
    sweepPrayerCovenantReminders,
    startPrayerCovenantReminderScheduler
} = require('../lib/prayer-covenant-reminders');

function openDb() {
    return new sqlite3.Database(
        ':memory:'
    );
}

function exec(db, sql) {
    return new Promise(
        (resolve, reject) => {
            db.exec(
                sql,
                error => error
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
                function (error) {
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
                (error, row) => error
                    ? reject(error)
                    : resolve(row || null)
            );
        }
    );
}

function all(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.all(
                sql,
                params,
                (error, rows) => error
                    ? reject(error)
                    : resolve(rows || [])
            );
        }
    );
}

function close(db) {
    return new Promise(
        (resolve, reject) => {
            db.close(
                error => error
                    ? reject(error)
                    : resolve()
            );
        }
    );
}

async function createSchema(db) {
    await exec(
        db,
        `
        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            qr_code TEXT,
            email_verified INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE growth_onboarding_templates (
            id INTEGER PRIMARY KEY,
            template_code TEXT NOT NULL UNIQUE,
            duration_days,
            is_active INTEGER NOT NULL DEFAULT 1,
            is_paused INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE growth_onboarding_enrollments (
            id INTEGER PRIMARY KEY,
            youth_id,
            template_id INTEGER NOT NULL,
            status TEXT,
            completed_days
        );

        CREATE TABLE growth_prayer_rhythm_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            prayer_date TEXT NOT NULL,
            source_key TEXT NOT NULL UNIQUE,
            UNIQUE(youth_id, prayer_date)
        );

        CREATE TABLE growth_onboarding_daily_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            enrollment_id INTEGER NOT NULL,
            completion_date TEXT NOT NULL,
            day_number INTEGER NOT NULL
        );

        CREATE TABLE growth_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            evidence_type TEXT NOT NULL
        );

        CREATE TABLE notification_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_key TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            importance TEXT NOT NULL DEFAULT 'normal',
            action_url TEXT,
            source_type TEXT NOT NULL DEFAULT 'system',
            source_id INTEGER,
            source_actor TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE notification_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            youth_id INTEGER NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(event_id, youth_id)
        );

        CREATE TABLE notification_deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient_id INTEGER NOT NULL,
            channel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            attempt_count INTEGER NOT NULL DEFAULT 0,
            provider_reference TEXT,
            last_error_code TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            sent_at TEXT,
            UNIQUE(recipient_id, channel)
        );

        CREATE TABLE notification_preferences (
            youth_id INTEGER PRIMARY KEY,
            push_enabled INTEGER NOT NULL DEFAULT 1,
            email_enabled INTEGER NOT NULL DEFAULT 0,
            prayer_daily_growth INTEGER NOT NULL DEFAULT 1,
            journey_progress INTEGER NOT NULL DEFAULT 1,
            events_formation INTEGER NOT NULL DEFAULT 1,
            membership_community INTEGER NOT NULL DEFAULT 1,
            ministry_servant INTEGER NOT NULL DEFAULT 1,
            prayer_partner INTEGER NOT NULL DEFAULT 1,
            games_growth INTEGER NOT NULL DEFAULT 1,
            preferred_prayer_time TEXT,
            quiet_hours_start TEXT,
            quiet_hours_end TEXT,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            subscription TEXT,
            created_at TEXT
        );
        `
    );

    await run(
        db,
        `INSERT INTO growth_onboarding_templates (
            id,
            template_code,
            duration_days,
            is_active,
            is_paused
         ) VALUES (1, 'prayer-covenant-21', 21, 1, 0)`
    );
}

async function seedMember(
    db,
    id,
    {
        status = 'active',
        completedDays = 0,
        prayedDate = null,
        subscription = false
    } = {}
) {
    await run(
        db,
        `INSERT INTO youth (
            id,
            name,
            email,
            qr_code,
            email_verified
         ) VALUES (?, ?, ?, ?, 1)`,
        [
            id,
            `Member ${id}`,
            `member${id}@example.com`,
            `FOG-MEMBER-${id}`
        ]
    );

    await run(
        db,
        `INSERT INTO growth_onboarding_enrollments (
            id,
            youth_id,
            template_id,
            status,
            completed_days
         ) VALUES (?, ?, 1, ?, ?)`,
        [
            id,
            id,
            status,
            completedDays
        ]
    );

    if (prayedDate) {
        await run(
            db,
            `INSERT INTO growth_prayer_rhythm_days (
                youth_id,
                prayer_date,
                source_key
             ) VALUES (?, ?, ?)`,
            [
                id,
                prayedDate,
                `prayer:${id}:${prayedDate}`
            ]
        );
    }

    if (subscription) {
        await run(
            db,
            `INSERT INTO push_subscriptions (
                username,
                subscription,
                created_at
             ) VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [
                `FOG-MEMBER-${id}`,
                JSON.stringify({
                    endpoint:
                        `https://push.example/${id}`,
                    expirationTime:
                        null,
                    keys: {
                        p256dh:
                            'test-p256dh',
                        auth:
                            'test-auth'
                    }
                })
            ]
        );
    }
}

test(
    'sweep reminds only active unprayed covenant members without mutating prayer or Growth state',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db, 1);
        await seedMember(db, 2, {
            prayedDate:
                '2026-09-14'
        });
        await seedMember(db, 3, {
            status:
                'completed',
            completedDays:
                21
        });
        await seedMember(db, 4, {
            status:
                'cancelled'
        });
        await seedMember(db, 5, {
            status:
                'paused'
        });
        await seedMember(db, 6, {
            completedDays:
                21
        });
        await seedMember(db, 7, {
            completedDays:
                20
        });

        const beforeEnrollments =
            await all(
                db,
                `SELECT *
                 FROM growth_onboarding_enrollments
                 ORDER BY id`
            );

        const result =
            await sweepPrayerCovenantReminders({
                database:
                    db,
                now:
                    new Date(
                        '2026-09-14T13:05:00.000Z'
                    )
            });

        assert.deepEqual(
            {
                eligible:
                    result.eligible,
                already_prayed:
                    result.already_prayed,
                inactive:
                    result.inactive,
                notifications_created:
                    result.notifications_created,
                errors:
                    result.errors
            },
            {
                eligible:
                    2,
                already_prayed:
                    1,
                inactive:
                    4,
                notifications_created:
                    2,
                errors:
                    0
            }
        );

        const notifications =
            await all(
                db,
                `SELECT
                    event.event_key,
                    event.category,
                    event.title,
                    event.message,
                    event.source_type,
                    recipient.youth_id
                 FROM notification_events event
                 JOIN notification_recipients recipient
                   ON recipient.event_id = event.id
                 ORDER BY recipient.youth_id`
            );

        assert.deepEqual(
            notifications.map(
                row => row.youth_id
            ),
            [
                1,
                7
            ]
        );

        for (const row of notifications) {
            assert.match(
                row.event_key,
                /^prayer-covenant-reminder:youth:\d+:date:2026-09-14$/
            );
            assert.equal(
                row.category,
                'prayer_daily_growth'
            );
            assert.equal(
                row.title,
                'Prayer Covenant Reminder'
            );
            assert.match(
                row.message,
                /gentle reminder/i
            );
            assert.equal(
                row.source_type,
                'prayer_covenant_reminder'
            );
        }

        assert.deepEqual(
            await all(
                db,
                `SELECT *
                 FROM growth_onboarding_enrollments
                 ORDER BY id`
            ),
            beforeEnrollments
        );

        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) AS count
                     FROM growth_prayer_rhythm_days`
                )
            ).count,
            1
        );

        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) AS count
                     FROM growth_onboarding_daily_completions`
                )
            ).count,
            0
        );

        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) AS count
                     FROM growth_evidence`
                )
            ).count,
            0
        );
    }
);

test(
    'durable event and recipient keys deduplicate retries, concurrency, and module re-instantiation',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db, 10);

        const sweepOptions = {
            database:
                db,
            now:
                new Date(
                    '2026-09-14T14:00:00.000Z'
                )
        };

        const first =
            await sweepPrayerCovenantReminders(
                sweepOptions
            );

        const reloadedPath =
            require.resolve(
                '../lib/prayer-covenant-reminders'
            );

        delete require.cache[reloadedPath];

        const reloadedSweep =
            require(
                '../lib/prayer-covenant-reminders'
            ).sweepPrayerCovenantReminders;

        const replayed =
            await Promise.all([
                reloadedSweep(sweepOptions),
                reloadedSweep(sweepOptions)
            ]);

        assert.equal(
            first.notifications_created,
            1
        );
        assert.equal(
            replayed.reduce(
                (sum, item) =>
                    sum +
                    item.notifications_created,
                0
            ),
            0
        );
        assert.equal(
            replayed.reduce(
                (sum, item) =>
                    sum +
                    item.already_reminded,
                0
            ),
            2
        );

        assert.deepEqual(
            await get(
                db,
                `SELECT
                    (SELECT COUNT(*)
                     FROM notification_events) AS events,
                    (SELECT COUNT(*)
                     FROM notification_recipients) AS recipients`
            ),
            {
                events:
                    1,
                recipients:
                    1
            }
        );
    }
);

test(
    'Manila boundary gates reminders and never backfills yesterday after midnight',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db, 20);

        assert.deepEqual(
            getManilaClock(
                new Date(
                    '2026-09-14T12:59:59.000Z'
                )
            ),
            {
                dateKey:
                    '2026-09-14',
                hour:
                    20
            }
        );

        const before =
            await sweepPrayerCovenantReminders({
                database:
                    db,
                now:
                    new Date(
                        '2026-09-14T12:59:59.000Z'
                    )
            });

        const atNine =
            await sweepPrayerCovenantReminders({
                database:
                    db,
                now:
                    new Date(
                        '2026-09-14T13:00:00.000Z'
                    )
            });

        const afterMidnight =
            await sweepPrayerCovenantReminders({
                database:
                    db,
                now:
                    new Date(
                        '2026-09-14T16:00:00.000Z'
                    )
            });

        assert.equal(
            before.status,
            'not_due'
        );
        assert.equal(
            atNine.notifications_created,
            1
        );
        assert.equal(
            afterMidnight.status,
            'not_due'
        );
        assert.equal(
            afterMidnight.manila_date,
            '2026-09-15'
        );
        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) AS count
                     FROM notification_events`
                )
            ).count,
            1
        );
    }
);

test(
    'canonical Push dispatch respects global and prayer category preferences and never queues Email',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(
            db,
            30,
            {
                subscription:
                    true
            }
        );
        await seedMember(
            db,
            31,
            {
                subscription:
                    true
            }
        );
        await seedMember(
            db,
            32,
            {
                subscription:
                    true
            }
        );

        await run(
            db,
            `INSERT INTO notification_preferences (
                youth_id,
                push_enabled,
                prayer_daily_growth
             ) VALUES (31, 1, 0)`
        );

        await run(
            db,
            `INSERT INTO notification_preferences (
                youth_id,
                push_enabled,
                prayer_daily_growth
             ) VALUES (32, 0, 1)`
        );

        const pushed = [];

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,
                sendPush:
                    async ({
                        payload,
                        context
                    }) => {
                        pushed.push({
                            payload,
                            youthId:
                                context.youth_id
                        });

                        return {
                            providerReference:
                                'test-push'
                        };
                    },
                emailOutbox: {
                    enqueue:
                        async () => {
                            assert.fail(
                                'Email must not be dispatched'
                            );
                        }
                }
            });

        const result =
            await sweepPrayerCovenantReminders({
                database:
                    db,
                now:
                    new Date(
                        '2026-09-14T13:30:00.000Z'
                    ),
                dispatchEvent:
                    (eventId, options) =>
                        engine.dispatchEvent(
                            eventId,
                            options
                        )
            });

        const replay =
            await sweepPrayerCovenantReminders({
                database:
                    db,
                now:
                    new Date(
                        '2026-09-14T14:00:00.000Z'
                    ),
                dispatchEvent:
                    (eventId, options) =>
                        engine.dispatchEvent(
                            eventId,
                            options
                        )
            });

        assert.deepEqual(
            pushed.map(
                item => item.youthId
            ),
            [
                30
            ]
        );
        assert.equal(
            pushed[0].payload.title,
            'Prayer Covenant Reminder'
        );
        assert.equal(
            result.push_attempted,
            1
        );
        assert.equal(
            result.push_sent,
            1
        );
        assert.equal(
            replay.already_reminded,
            3
        );
        assert.equal(
            replay.push_attempted,
            0
        );
        assert.equal(
            pushed.length,
            1
        );

        assert.deepEqual(
            await all(
                db,
                `SELECT
                    recipient.youth_id,
                    delivery.channel,
                    delivery.status,
                    delivery.last_error_code
                 FROM notification_deliveries delivery
                 JOIN notification_recipients recipient
                   ON recipient.id = delivery.recipient_id
                 ORDER BY recipient.youth_id`
            ),
            [
                {
                    youth_id:
                        30,
                    channel:
                        'push',
                    status:
                        'sent',
                    last_error_code:
                        null
                },
                {
                    youth_id:
                        31,
                    channel:
                        'push',
                    status:
                        'skipped',
                    last_error_code:
                        'CATEGORY_DISABLED'
                },
                {
                    youth_id:
                        32,
                    channel:
                        'push',
                    status:
                        'skipped',
                    last_error_code:
                        'PREFERENCE_DISABLED'
                }
            ]
        );
    }
);

test(
    'disabled scheduler is inert while enabled startup uses a Manila catch-up due-check',
    async t => {
        let scheduled =
            0;

        const disabled =
            startPrayerCovenantReminderScheduler({
                enabled:
                    false,
                cron: {
                    schedule:
                        () => {
                            scheduled += 1;
                        }
                }
            });

        assert.equal(
            disabled.enabled,
            false
        );
        assert.equal(
            (
                await disabled.initialRun
            ).status,
            'disabled'
        );
        assert.equal(
            scheduled,
            0
        );

        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db, 40);

        let scheduledCallback =
            null;

        const scheduler =
            startPrayerCovenantReminderScheduler({
                enabled:
                    true,
                database:
                    db,
                cron: {
                    schedule:
                        (
                            expression,
                            callback,
                            options
                        ) => {
                            scheduled += 1;
                            scheduledCallback =
                                callback;

                            assert.equal(
                                expression,
                                '*/5 21-23 * * *'
                            );
                            assert.deepEqual(
                                options,
                                {
                                    scheduled:
                                        true,
                                    timezone:
                                        TIME_ZONE
                                }
                            );

                            return {
                                stop() {}
                            };
                        }
                },
                now:
                    () => new Date(
                        '2026-09-14T14:00:00.000Z'
                    ),
                logger: {
                    info() {},
                    error() {}
                }
            });

        assert.equal(
            scheduler.enabled,
            true
        );
        assert.equal(
            (
                await scheduler.initialRun
            ).notifications_created,
            1
        );
        assert.equal(
            scheduled,
            1
        );
        assert.equal(
            typeof scheduledCallback,
            'function'
        );

        scheduledCallback();
        await new Promise(
            resolve => setImmediate(resolve)
        );

        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) AS count
                     FROM notification_events`
                )
            ).count,
            1
        );
    }
);

test(
    'malformed covenant rows fail closed without blocking valid members',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db, 50);
        await seedMember(db, 51);

        await run(
            db,
            `UPDATE growth_onboarding_enrollments
             SET completed_days = 'not-a-day-count'
             WHERE youth_id = 50`
        );

        const result =
            await sweepPrayerCovenantReminders({
                database:
                    db,
                now:
                    new Date(
                        '2026-09-14T15:00:00.000Z'
                    )
            });

        assert.equal(
            result.malformed,
            1
        );
        assert.equal(
            result.notifications_created,
            1
        );
        assert.deepEqual(
            await all(
                db,
                `SELECT youth_id
                 FROM notification_recipients`
            ),
            [
                {
                    youth_id:
                        51
                }
            ]
        );
    }
);

test(
    'server integration is opt-in, post-schema, and exposes no reminder sweep route',
    () => {
        const source =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'server.js'
                ),
                'utf8'
            );

        assert.match(
            source,
            /PRAYER_COVENANT_REMINDERS_ENABLED/
        );
        assert.match(
            source,
            /await applyDeterministicRuntimeMigration\(\);[\s\S]*startPrayerCovenantReminderScheduler\(\);/
        );
        assert.doesNotMatch(
            source,
            /app\.(?:get|post|put|patch|delete)\([^\n]*prayer-covenant[^\n]*(?:reminder|sweep)/i
        );
    }
);
