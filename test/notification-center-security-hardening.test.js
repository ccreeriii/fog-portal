const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const sqlite3 =
    require('sqlite3');

const NotificationCenter =
    require('../lib/notification-center');

function openDatabase() {
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
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
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
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                }
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
                err => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                }
            );
        }
    );
}

async function createTestDatabase() {
    const db =
        openDatabase();

    await exec(
        db,
        `
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
        `
    );

    return db;
}

function notificationInput(
    eventKey,
    actionUrl
) {
    return {
        eventKey,
        category:
            'journey_progress',
        title:
            'Your Journey',
        message:
            'A new invitation is ready.',
        importance:
            'normal',
        actionUrl,
        sourceType:
            'growth_journey',
        metadata: {
            internal_rule:
                'belong-next-step',
            private_note:
                'backend-only'
        },
        recipientYouthIds: [
            101
        ]
    };
}

test(
    'canonical Notification actions accept only local Portal paths',
    async t => {
        const db =
            await createTestDatabase();

        t.after(
            async () => {
                await close(db);
            }
        );

        for (
            const [
                suffix,
                actionUrl
            ]
            of [
                [
                    'absolute',
                    'https://evil.example/phish'
                ],
                [
                    'protocol-relative',
                    '//evil.example/phish'
                ],
                [
                    'backslash',
                    '\\\\evil.example\\phish'
                ],
                [
                    'control',
                    '/journey\nhttps://evil.example'
                ]
            ]
        ) {
            await assert.rejects(
                () =>
                    NotificationCenter
                        .createNotification(
                            db,
                            notificationInput(
                                `hardening-${suffix}`,
                                actionUrl
                            )
                        ),
                /local Portal path/
            );
        }

        await NotificationCenter
            .createNotification(
                db,
                notificationInput(
                    'hardening-valid',
                    '/journey?phase=belong#next'
                )
            );

        const stored =
            await get(
                db,
                `SELECT
                    action_url,
                    metadata_json
                 FROM notification_events
                 WHERE event_key = ?`,
                [
                    'hardening-valid'
                ]
            );

        assert.equal(
            stored.action_url,
            '/journey?phase=belong#next'
        );

        assert.deepEqual(
            JSON.parse(
                stored.metadata_json
            ),
            {
                internal_rule:
                    'belong-next-step',
                private_note:
                    'backend-only'
            }
        );
    }
);

test(
    'member Inbox keeps internal Notification metadata private',
    async t => {
        const db =
            await createTestDatabase();

        t.after(
            async () => {
                await close(db);
            }
        );

        await NotificationCenter
            .createNotification(
                db,
                notificationInput(
                    'metadata-private',
                    '/journey'
                )
            );

        const rows =
            await NotificationCenter
                .listNotifications(
                    db,
                    101
                );

        assert.equal(
            rows.length,
            1
        );

        assert.equal(
            rows[0].action_url,
            '/journey'
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty.call(
                    rows[0],
                    'metadata'
                ),
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty.call(
                    rows[0],
                    'metadata_json'
                ),
            false
        );
    }
);
