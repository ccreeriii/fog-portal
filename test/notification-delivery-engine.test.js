const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const sqlite3 =
    require('sqlite3');

const NotificationCenter =
    require('../lib/notification-center');

const {
    createNotificationDeliveryEngine
} = require('../lib/notification-delivery');

function openDb() {
    return new sqlite3.Database(
        ':memory:'
    );
}

function exec(
    db,
    sql
) {
    return new Promise(
        (resolve, reject) => {
            db.exec(
                sql,
                err =>
                    err
                        ? reject(err)
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
                function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({
                            lastID:
                                this.lastID,
                            changes:
                                this.changes
                        });
                    }
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
                (err, row) =>
                    err
                        ? reject(err)
                        : resolve(
                            row || null
                        )
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
                (err, rows) =>
                    err
                        ? reject(err)
                        : resolve(
                            rows || []
                        )
            );
        }
    );
}

function close(
    db
) {
    return new Promise(
        (resolve, reject) => {
            db.close(
                err =>
                    err
                        ? reject(err)
                        : resolve()
            );
        }
    );
}

async function createSchema(
    db
) {
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

        CREATE TABLE push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            subscription TEXT,
            created_at TEXT
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

        CREATE TABLE email_outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            status TEXT NOT NULL DEFAULT 'pending',
            retry_count INTEGER NOT NULL DEFAULT 0,
            sent_at INTEGER,
            provider_message_id TEXT,
            last_error_code TEXT
        );
        `
    );
}

async function seedMember(
    db,
    {
        id = 101,
        verified = true,
        subscription = true
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
         )
         VALUES (?, ?, ?, ?, ?)`,
        [
            id,
            `Member ${id}`,
            `member${id}@example.com`,
            `FOG-MEMBER-${id}`,
            verified
                ? 1
                : 0
        ]
    );

    if (subscription) {
        await run(
            db,
            `INSERT INTO push_subscriptions (
                username,
                subscription,
                created_at
             )
             VALUES (?, ?, CURRENT_TIMESTAMP)`,
            [
                `FOG-MEMBER-${id}`,
                JSON.stringify({
                    endpoint:
                        'https://push.example/subscription',
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

async function createRecipient(
    db,
    {
        eventKey =
            'journey-test-1',
        youthId = 101,
        category =
            'journey_progress',
        actionUrl =
            '/journey'
    } = {}
) {
    await NotificationCenter
        .createNotification(
            db,
            {
                eventKey,
                category,
                title:
                    'Your next invitation',
                message:
                    'Your next Growth Journey invitation is ready.',
                actionUrl,
                sourceType:
                    'growth_journey',
                recipientYouthIds: [
                    youthId
                ]
            }
        );

    const event =
        await get(
            db,
            `SELECT id
             FROM notification_events
             WHERE event_key = ?
             LIMIT 1`,
            [
                eventKey
            ]
        );

    assert.ok(
        event,
        'canonical notification event must exist'
    );

    const recipient =
        await get(
            db,
            `SELECT id
             FROM notification_recipients
             WHERE event_id = ?
               AND youth_id = ?`,
            [
                event.id,
                youthId
            ]
        );

    assert.ok(
        recipient,
        'canonical notification recipient must exist'
    );

    return {
        eventId:
            event.id,
        recipientId:
            recipient.id
    };
}

test(
    'default preferences deliver Push once and skip Email',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db);

        const {
            recipientId
        } =
            await createRecipient(db);

        let pushes = 0;
        let emails = 0;

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                publicOrigin:
                    'https://staging.fogmin.site',

                sendPush:
                    async ({
                        payload
                    }) => {
                        pushes += 1;

                        assert.equal(
                            payload.url,
                            '/journey'
                        );

                        return {
                            providerReference:
                                'push-provider-1'
                        };
                    },

                emailOutbox: {
                    enqueue:
                        async () => {
                            emails += 1;

                            return {
                                enqueued:
                                    true,
                                id:
                                    10
                            };
                        }
                }
            });

        await engine
            .dispatchRecipient(
                recipientId
            );

        await engine
            .dispatchRecipient(
                recipientId
            );

        assert.equal(
            pushes,
            1
        );

        assert.equal(
            emails,
            0
        );

        const rows =
            await all(
                db,
                `SELECT
                    channel,
                    status,
                    attempt_count,
                    last_error_code
                 FROM notification_deliveries
                 ORDER BY channel`
            );

        assert.deepEqual(
            rows,
            [
                {
                    channel:
                        'email',
                    status:
                        'skipped',
                    attempt_count:
                        0,
                    last_error_code:
                        'PREFERENCE_DISABLED'
                },
                {
                    channel:
                        'push',
                    status:
                        'sent',
                    attempt_count:
                        1,
                    last_error_code:
                        null
                }
            ]
        );
    }
);

test(
    'category preference prevents external delivery without affecting Inbox',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db);

        const {
            recipientId
        } =
            await createRecipient(db);

        await run(
            db,
            `INSERT INTO notification_preferences (
                youth_id,
                push_enabled,
                email_enabled,
                journey_progress
             )
             VALUES (101, 1, 1, 0)`
        );

        let calls = 0;

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                sendPush:
                    async () => {
                        calls += 1;
                    },

                emailOutbox: {
                    enqueue:
                        async () => {
                            calls += 1;

                            return {
                                id:
                                    5
                            };
                        }
                }
            });

        await engine
            .dispatchRecipient(
                recipientId
            );

        assert.equal(
            calls,
            0
        );

        const deliveries =
            await all(
                db,
                `SELECT
                    channel,
                    status,
                    last_error_code
                 FROM notification_deliveries
                 ORDER BY channel`
            );

        assert.deepEqual(
            deliveries,
            [
                {
                    channel:
                        'email',
                    status:
                        'skipped',
                    last_error_code:
                        'CATEGORY_DISABLED'
                },
                {
                    channel:
                        'push',
                    status:
                        'skipped',
                    last_error_code:
                        'CATEGORY_DISABLED'
                }
            ]
        );

        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) count
                     FROM notification_recipients`
                )
            ).count,
            1
        );
    }
);

test(
    'gone Push subscription is removed and delivery is failed truthfully',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db);

        const {
            recipientId
        } =
            await createRecipient(db);

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                sendPush:
                    async () => {
                        throw Object.assign(
                            new Error(
                                'gone'
                            ),
                            {
                                statusCode:
                                    410
                            }
                        );
                    }
            });

        await engine
            .dispatchRecipient(
                recipientId,
                {
                    channels: [
                        'push'
                    ]
                }
            );

        const delivery =
            await get(
                db,
                `SELECT *
                 FROM notification_deliveries
                 WHERE recipient_id = ?
                   AND channel = 'push'`,
                [
                    recipientId
                ]
            );

        assert.equal(
            delivery.status,
            'failed'
        );

        assert.equal(
            delivery.attempt_count,
            1
        );

        assert.equal(
            delivery.last_error_code,
            'PUSH_SUBSCRIPTION_GONE'
        );

        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) count
                     FROM push_subscriptions`
                )
            ).count,
            0
        );
    }
);

test(
    'transient Push failure becomes retryable and can later succeed once',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);
        await seedMember(db);

        const {
            recipientId
        } =
            await createRecipient(db);

        let calls = 0;

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                sendPush:
                    async () => {
                        calls += 1;

                        if (calls === 1) {
                            throw Object.assign(
                                new Error(
                                    'temporary'
                                ),
                                {
                                    statusCode:
                                        503
                                }
                            );
                        }

                        return {};
                    }
            });

        await engine
            .dispatchRecipient(
                recipientId,
                {
                    channels: [
                        'push'
                    ]
                }
            );

        let delivery =
            await get(
                db,
                `SELECT *
                 FROM notification_deliveries
                 WHERE recipient_id = ?
                   AND channel = 'push'`,
                [
                    recipientId
                ]
            );

        assert.equal(
            delivery.status,
            'retry'
        );

        assert.equal(
            delivery.attempt_count,
            1
        );

        await engine
            .dispatchRecipient(
                recipientId,
                {
                    channels: [
                        'push'
                    ]
                }
            );

        delivery =
            await get(
                db,
                `SELECT *
                 FROM notification_deliveries
                 WHERE recipient_id = ?
                   AND channel = 'push'`,
                [
                    recipientId
                ]
            );

        assert.equal(
            calls,
            2
        );

        assert.equal(
            delivery.status,
            'sent'
        );

        assert.equal(
            delivery.attempt_count,
            2
        );
    }
);

test(
    'verified Email queues exactly once and remains pending until reconciliation',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);

        await seedMember(
            db,
            {
                verified:
                    true
            }
        );

        await run(
            db,
            `INSERT INTO notification_preferences (
                youth_id,
                push_enabled,
                email_enabled
             )
             VALUES (101, 0, 1)`
        );

        const {
            recipientId
        } =
            await createRecipient(db);

        let enqueueCalls = 0;

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                publicOrigin:
                    'https://staging.fogmin.site',

                emailOutbox: {
                    enqueue:
                        async options => {
                            enqueueCalls += 1;

                            assert.equal(
                                options.recipient,
                                'member101@example.com'
                            );

                            assert.equal(
                                options.messageType,
                                'notification_center'
                            );

                            assert.match(
                                options.payload.text,
                                /https:\/\/staging\.fogmin\.site\/journey/
                            );

                            assert.equal(
                                options.dedupeKey,
                                'notification-email:journey-test-1:101'
                            );

                            return {
                                enqueued:
                                    true,
                                id:
                                    44
                            };
                        }
                }
            });

        await engine
            .dispatchRecipient(
                recipientId,
                {
                    channels: [
                        'email'
                    ]
                }
            );

        await engine
            .dispatchRecipient(
                recipientId,
                {
                    channels: [
                        'email'
                    ]
                }
            );

        assert.equal(
            enqueueCalls,
            1
        );

        const delivery =
            await get(
                db,
                `SELECT *
                 FROM notification_deliveries
                 WHERE recipient_id = ?
                   AND channel = 'email'`,
                [
                    recipientId
                ]
            );

        assert.equal(
            delivery.status,
            'pending'
        );

        assert.equal(
            delivery.provider_reference,
            'email_outbox:44'
        );
    }
);

test(
    'unverified Email is skipped before touching the encrypted outbox',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);

        await seedMember(
            db,
            {
                verified:
                    false
            }
        );

        await run(
            db,
            `INSERT INTO notification_preferences (
                youth_id,
                push_enabled,
                email_enabled
             )
             VALUES (101, 0, 1)`
        );

        const {
            recipientId
        } =
            await createRecipient(db);

        let enqueueCalls = 0;

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                emailOutbox: {
                    enqueue:
                        async () => {
                            enqueueCalls += 1;

                            return {
                                id:
                                    1
                            };
                        }
                }
            });

        await engine
            .dispatchRecipient(
                recipientId,
                {
                    channels: [
                        'email'
                    ]
                }
            );

        assert.equal(
            enqueueCalls,
            0
        );

        const delivery =
            await get(
                db,
                `SELECT
                    status,
                    last_error_code
                 FROM notification_deliveries
                 WHERE recipient_id = ?
                   AND channel = 'email'`,
                [
                    recipientId
                ]
            );

        assert.deepEqual(
            delivery,
            {
                status:
                    'skipped',
                last_error_code:
                    'EMAIL_NOT_VERIFIED'
            }
        );
    }
);

test(
    'Email reconciliation mirrors real outbox sent and failed outcomes',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);

        await seedMember(
            db,
            {
                id:
                    101,
                verified:
                    true
            }
        );

        await seedMember(
            db,
            {
                id:
                    102,
                verified:
                    true
            }
        );

        for (const id of [101, 102]) {
            await run(
                db,
                `INSERT INTO notification_preferences (
                    youth_id,
                    push_enabled,
                    email_enabled
                 )
                 VALUES (?, 0, 1)`,
                [
                    id
                ]
            );
        }

        const first =
            await createRecipient(
                db,
                {
                    eventKey:
                        'email-reconcile-1',
                    youthId:
                        101
                }
            );

        const second =
            await createRecipient(
                db,
                {
                    eventKey:
                        'email-reconcile-2',
                    youthId:
                        102
                }
            );

        let nextOutboxId = 70;

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                emailOutbox: {
                    enqueue:
                        async () => ({
                            id:
                                nextOutboxId++
                        })
                }
            });

        await engine.dispatchRecipient(
            first.recipientId,
            {
                channels: [
                    'email'
                ]
            }
        );

        await engine.dispatchRecipient(
            second.recipientId,
            {
                channels: [
                    'email'
                ]
            }
        );

        await run(
            db,
            `INSERT INTO email_outbox (
                id,
                status,
                retry_count,
                sent_at,
                provider_message_id
             )
             VALUES (
                70,
                'sent',
                1,
                1700000000000,
                'resend-message-70'
             )`
        );

        await run(
            db,
            `INSERT INTO email_outbox (
                id,
                status,
                retry_count,
                last_error_code
             )
             VALUES (
                71,
                'failed',
                3,
                'EMAIL_PROVIDER_400'
             )`
        );

        await engine
            .reconcileEmailDeliveries();

        const rows =
            await all(
                db,
                `SELECT
                    r.youth_id,
                    d.status,
                    d.attempt_count,
                    d.provider_reference,
                    d.last_error_code
                 FROM notification_deliveries d
                 JOIN notification_recipients r
                   ON r.id = d.recipient_id
                 WHERE d.channel = 'email'
                 ORDER BY r.youth_id`
            );

        assert.equal(
            rows[0].youth_id,
            101
        );

        assert.equal(
            rows[0].status,
            'sent'
        );

        assert.equal(
            rows[0].attempt_count,
            2
        );

        assert.equal(
            rows[0].provider_reference,
            'resend-message-70'
        );

        assert.equal(
            rows[0].last_error_code,
            null
        );

        assert.equal(
            rows[1].youth_id,
            102
        );

        assert.equal(
            rows[1].status,
            'failed'
        );

        assert.equal(
            rows[1].attempt_count,
            3
        );

        assert.equal(
            rows[1].last_error_code,
            'EMAIL_PROVIDER_400'
        );
    }
);

test(
    'event dispatch is recipient-idempotent and sequential',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createSchema(db);

        await seedMember(
            db,
            {
                id:
                    101
            }
        );

        await seedMember(
            db,
            {
                id:
                    102
            }
        );

        await NotificationCenter
            .createNotification(
                db,
                {
                    eventKey:
                        'multi-recipient-event',
                    category:
                        'membership_community',
                    title:
                        'Community Update',
                    message:
                        'A community invitation is ready.',
                    actionUrl:
                        '/journey',
                    recipientYouthIds: [
                        101,
                        102
                    ]
                }
            );

        const notificationEvent =
            await get(
                db,
                `SELECT id
                 FROM notification_events
                 WHERE event_key = ?
                 LIMIT 1`,
                [
                    'multi-recipient-event'
                ]
            );

        assert.ok(
            notificationEvent,
            'multi-recipient event must exist'
        );

        const sequence = [];

        const engine =
            createNotificationDeliveryEngine({
                database:
                    db,

                sendPush:
                    async ({
                        context
                    }) => {
                        sequence.push(
                            context.youth_id
                        );

                        return {};
                    }
            });

        await engine.dispatchEvent(
            notificationEvent.id,
            {
                channels: [
                    'push'
                ]
            }
        );

        await engine.dispatchEvent(
            notificationEvent.id,
            {
                channels: [
                    'push'
                ]
            }
        );

        assert.deepEqual(
            sequence,
            [
                101,
                102
            ]
        );

        assert.equal(
            (
                await get(
                    db,
                    `SELECT COUNT(*) count
                     FROM notification_deliveries
                     WHERE channel = 'push'`
                )
            ).count,
            2
        );
    }
);
