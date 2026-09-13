const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const root =
    path.resolve(__dirname, '..');

const NotificationCenter =
    require(
        path.join(
            root,
            'lib',
            'notification-center'
        )
    );

const migration =
    fs.readFileSync(
        path.join(
            root,
            'migrations',
            '20260913_notification_center_v1.sql'
        ),
        'utf8'
    );

function exec(db, sql) {
    return new Promise(
        (resolve, reject) => {
            db.exec(
                sql,
                error => {
                    if (error) reject(error);
                    else resolve();
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
                    if (error) reject(error);
                    else resolve(row || null);
                }
            );
        }
    );
}

function close(db) {
    return new Promise(
        (resolve, reject) => {
            db.close(
                error => {
                    if (error) reject(error);
                    else resolve();
                }
            );
        }
    );
}

async function fixture() {
    const db =
        new sqlite3.Database(':memory:');

    await exec(
        db,
        `
        PRAGMA foreign_keys = ON;

        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT
        );

        INSERT INTO youth (id,name)
        VALUES
            (1,'Member One'),
            (2,'Member Two'),
            (3,'Member Three');
        `
    );

    await exec(
        db,
        migration
    );

    return db;
}

test(
    'canonical notification creation is event and recipient idempotent',
    async () => {
        const db =
            await fixture();

        try {
            const first =
                await NotificationCenter
                    .createNotification(
                        db,
                        {
                            eventKey:
                                'journey-phase-ready:1:belong:v1',

                            category:
                                'journey_progress',

                            title:
                                'Your next invitation is ready',

                            message:
                                'Continue your Growth Journey.',

                            sourceType:
                                'growth_journey',

                            sourceId:
                                1,

                            recipientYouthIds:
                                [1, 2, 2]
                        }
                    );

            assert.equal(
                first.eventInserted,
                true
            );

            assert.equal(
                first.recipientCount,
                2
            );

            assert.equal(
                first.insertedRecipients,
                2
            );

            const replay =
                await NotificationCenter
                    .createNotification(
                        db,
                        {
                            eventKey:
                                'journey-phase-ready:1:belong:v1',

                            category:
                                'journey_progress',

                            title:
                                'Changed title must not duplicate event',

                            message:
                                'Replay',

                            recipientYouthIds:
                                [1, 2, 3]
                        }
                    );

            assert.equal(
                replay.eventInserted,
                false
            );

            assert.equal(
                replay.insertedRecipients,
                1
            );

            const counts =
                await get(
                    db,
                    `
                    SELECT
                        (
                            SELECT COUNT(*)
                            FROM notification_events
                        ) event_count,

                        (
                            SELECT COUNT(*)
                            FROM notification_recipients
                        ) recipient_count
                    `
                );

            assert.equal(
                counts.event_count,
                1
            );

            assert.equal(
                counts.recipient_count,
                3
            );
        } finally {
            await close(db);
        }
    }
);

test(
    'Inbox list, unread count, ownership and read state are canonical',
    async () => {
        const db =
            await fixture();

        try {
            await NotificationCenter
                .createNotification(
                    db,
                    {
                        eventKey:
                            'test:member-one',

                        category:
                            'membership_community',

                        title:
                            'Welcome',

                        message:
                            'Welcome to the community.',

                        recipientYouthIds:
                            [1]
                    }
                );

            await NotificationCenter
                .createNotification(
                    db,
                    {
                        eventKey:
                            'test:member-two',

                        category:
                            'system',

                        title:
                            'Member Two',

                        message:
                            'Private to member two.',

                        recipientYouthIds:
                            [2]
                    }
                );

            assert.equal(
                await NotificationCenter
                    .unreadCount(
                        db,
                        1
                    ),
                1
            );

            const inbox =
                await NotificationCenter
                    .listNotifications(
                        db,
                        1
                    );

            assert.equal(
                inbox.length,
                1
            );

            assert.equal(
                inbox[0].title,
                'Welcome'
            );

            assert.equal(
                inbox[0].is_read,
                false
            );

            const foreignInbox =
                await NotificationCenter
                    .listNotifications(
                        db,
                        2
                    );

            assert.equal(
                foreignInbox.length,
                1
            );

            assert.equal(
                foreignInbox[0].title,
                'Member Two'
            );

            const wrongOwner =
                await NotificationCenter
                    .markRead(
                        db,
                        {
                            youthId: 2,
                            recipientId:
                                inbox[0].recipient_id
                        }
                    );

            assert.equal(
                wrongOwner,
                false
            );

            assert.equal(
                await NotificationCenter
                    .unreadCount(
                        db,
                        1
                    ),
                1
            );

            const correctOwner =
                await NotificationCenter
                    .markRead(
                        db,
                        {
                            youthId: 1,
                            recipientId:
                                inbox[0].recipient_id
                        }
                    );

            assert.equal(
                correctOwner,
                true
            );

            assert.equal(
                await NotificationCenter
                    .unreadCount(
                        db,
                        1
                    ),
                0
            );
        } finally {
            await close(db);
        }
    }
);

test(
    'notification preferences default without writing and save canonically',
    async () => {
        const db =
            await fixture();

        try {
            const defaults =
                await NotificationCenter
                    .getPreferences(
                        db,
                        1
                    );

            assert.equal(
                defaults.stored,
                false
            );

            assert.equal(
                defaults.push_enabled,
                true
            );

            assert.equal(
                defaults.email_enabled,
                false
            );

            const before =
                await get(
                    db,
                    `SELECT COUNT(*) count
                     FROM notification_preferences`
                );

            assert.equal(
                before.count,
                0,
                'GET defaults must not mutate'
            );

            const saved =
                await NotificationCenter
                    .savePreferences(
                        db,
                        1,
                        {
                            ...NotificationCenter
                                .DEFAULT_PREFERENCES,

                            email_enabled:
                                true,

                            prayer_daily_growth:
                                false,

                            preferred_prayer_time:
                                '07:30',

                            quiet_hours_start:
                                '22:00',

                            quiet_hours_end:
                                '06:00'
                        }
                    );

            assert.equal(
                saved.stored,
                true
            );

            assert.equal(
                saved.email_enabled,
                true
            );

            assert.equal(
                saved.prayer_daily_growth,
                false
            );

            assert.equal(
                saved.preferred_prayer_time,
                '07:30'
            );

            await assert.rejects(
                NotificationCenter
                    .savePreferences(
                        db,
                        1,
                        {
                            ...NotificationCenter
                                .DEFAULT_PREFERENCES,

                            preferred_prayer_time:
                                '25:00'
                        }
                    )
            );
        } finally {
            await close(db);
        }
    }
);
