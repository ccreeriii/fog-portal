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

const {
    journeyReadyEventKey,
    isReadyTransition,
    createPhaseReadyNotification
} =
    require('../lib/growth-notifications');

const root =
    path.resolve(
        __dirname,
        '..'
    );

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
                        resolve(
                            row || null
                        );
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

async function createDatabase() {
    const db =
        new sqlite3.Database(
            ':memory:'
        );

    await exec(
        db,
        `
        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            email TEXT,
            email_verified INTEGER
                NOT NULL DEFAULT 0
        );

        INSERT INTO youth (
            id,
            email,
            email_verified
        )
        VALUES (
            102,
            'member@example.test',
            1
        );
        `
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

    await exec(
        db,
        migration
    );

    return db;
}

test(
    'ready transition classifier requires an actual previous state transition',
    () => {
        assert.equal(
            isReadyTransition({
                previousStatus:
                    'in_progress',
                status:
                    'ready'
            }),
            true
        );

        assert.equal(
            isReadyTransition({
                previousStatus:
                    'ready',
                status:
                    'ready'
            }),
            false
        );

        assert.equal(
            isReadyTransition({
                previousStatus:
                    'completed',
                status:
                    'ready'
            }),
            false
        );

        assert.equal(
            isReadyTransition({
                status:
                    'ready'
            }),
            false
        );

        assert.equal(
            isReadyTransition({
                previousStatus:
                    'in_progress',
                status:
                    'in_progress'
            }),
            false
        );
    }
);

test(
    'Journey ready key is deterministic and member/phase scoped',
    () => {
        assert.equal(
            journeyReadyEventKey(
                102,
                'belong'
            ),
            'journey-phase-ready:102:belong:v1'
        );
    }
);

test(
    'non-transition creates no canonical Notification',
    async () => {
        const db =
            await createDatabase();

        try {
            const result =
                await createPhaseReadyNotification(
                    db,
                    {
                        youthId:
                            102,

                        phaseProgress: {
                            phaseId:
                                2,
                            phaseKey:
                                'belong',
                            title:
                                'Belong',
                            previousStatus:
                                'in_progress',
                            status:
                                'in_progress'
                        }
                    }
                );

            assert.equal(
                result.created,
                false
            );

            assert.equal(
                (
                    await get(
                        db,
                        `SELECT COUNT(*) AS count
                         FROM notification_events`
                    )
                ).count,
                0
            );
        } finally {
            await close(db);
        }
    }
);

test(
    'first transition into ready creates one Journey Inbox notification',
    async () => {
        const db =
            await createDatabase();

        try {
            const result =
                await createPhaseReadyNotification(
                    db,
                    {
                        youthId:
                            102,

                        phaseProgress: {
                            phaseId:
                                2,
                            phaseKey:
                                'belong',
                            title:
                                'Belong',
                            previousStatus:
                                'in_progress',
                            status:
                                'ready'
                        }
                    }
                );

            assert.equal(
                result.eligible,
                true
            );

            assert.equal(
                result.created,
                true
            );

            const event =
                await get(
                    db,
                    `SELECT *
                     FROM notification_events
                     WHERE id = ?`,
                    [
                        result.eventId
                    ]
                );

            assert.equal(
                event.event_key,
                'journey-phase-ready:102:belong:v1'
            );

            assert.equal(
                event.category,
                'journey_progress'
            );

            assert.equal(
                event.importance,
                'normal'
            );

            assert.equal(
                event.action_url,
                '/'
            );

            const recipient =
                await get(
                    db,
                    `SELECT *
                     FROM notification_recipients
                     WHERE id = ?`,
                    [
                        result.recipientId
                    ]
                );

            assert.equal(
                recipient.youth_id,
                102
            );

            assert.equal(
                recipient.is_read,
                0
            );
        } finally {
            await close(db);
        }
    }
);

test(
    'replaying the same ready transition is event and recipient idempotent',
    async () => {
        const db =
            await createDatabase();

        try {
            const input = {
                youthId:
                    102,

                phaseProgress: {
                    phaseId:
                        2,
                    phaseKey:
                        'belong',
                    title:
                        'Belong',
                    previousStatus:
                        'in_progress',
                    status:
                        'ready'
                }
            };

            const first =
                await createPhaseReadyNotification(
                    db,
                    input
                );

            const second =
                await createPhaseReadyNotification(
                    db,
                    input
                );

            assert.equal(
                first.created,
                true
            );

            assert.equal(
                second.created,
                false
            );

            assert.equal(
                first.eventId,
                second.eventId
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

            assert.equal(
                (
                    await get(
                        db,
                        `SELECT COUNT(*) AS count
                         FROM notification_recipients`
                    )
                ).count,
                1
            );
        } finally {
            await close(db);
        }
    }
);
