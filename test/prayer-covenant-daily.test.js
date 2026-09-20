'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const sqlite3 =
    require('sqlite3');

const Daily =
    require('../lib/prayer-covenant-daily');

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
                error => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
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
                function onRun(
                    error
                ) {
                    if (error) {
                        reject(error);
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
                (
                    error,
                    rows
                ) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(
                            rows || []
                        );
                    }
                }
            );
        }
    );
}

function close(db) {
    return new Promise(
        resolve => {
            db.close(
                () => resolve()
            );
        }
    );
}

async function createBaseSchema(
    db
) {
    await exec(
        db,
        `
        PRAGMA foreign_keys = ON;

        CREATE TABLE youth (
            id INTEGER
                PRIMARY KEY,

            name TEXT
                NOT NULL,

            profile_picture TEXT
        );

        CREATE TABLE
            growth_onboarding_templates (
                id INTEGER
                    PRIMARY KEY,

                template_code TEXT
                    NOT NULL
                    UNIQUE,

                is_active INTEGER
                    NOT NULL
                    DEFAULT 1,

                is_paused INTEGER
                    NOT NULL
                    DEFAULT 0
            );

        CREATE TABLE
            growth_onboarding_enrollments (
                id INTEGER
                    PRIMARY KEY,

                youth_id INTEGER
                    NOT NULL,

                template_id INTEGER
                    NOT NULL,

                status TEXT
                    NOT NULL,

                completed_days INTEGER
                    NOT NULL
                    DEFAULT 0,

                FOREIGN KEY (youth_id)
                    REFERENCES youth(id),

                FOREIGN KEY (template_id)
                    REFERENCES
                        growth_onboarding_templates(id)
            );

        CREATE TABLE secret_prayer_pals (
            id INTEGER
                PRIMARY KEY AUTOINCREMENT,

            youth_id INTEGER
                NOT NULL,

            pal_youth_id INTEGER
                NOT NULL,

            week_start TEXT
                NOT NULL
        );

        CREATE TABLE
            growth_onboarding_daily_completions (
                id INTEGER
                    PRIMARY KEY AUTOINCREMENT,

                enrollment_id INTEGER,
                completion_date TEXT,
                day_number INTEGER
            );

        CREATE TABLE
            growth_prayer_rhythm_days (
                id INTEGER
                    PRIMARY KEY AUTOINCREMENT,

                youth_id INTEGER,
                prayer_date TEXT
            );

        CREATE TABLE growth_evidence (
            id INTEGER
                PRIMARY KEY AUTOINCREMENT,

            youth_id INTEGER,
            evidence_type TEXT
        );
        `
    );

    await run(
        db,
        `
        INSERT INTO
            growth_onboarding_templates (
                id,
                template_code,
                is_active,
                is_paused
            )
        VALUES (
            1,
            'prayer-covenant-21',
            1,
            0
        )
        `
    );
}

async function seedActiveMembers(
    db,
    ids
) {
    for (const id of ids) {
        await run(
            db,
            `
            INSERT INTO youth (
                id,
                name
            )
            VALUES (?, ?)
            `,
            [
                id,
                `Member ${id}`
            ]
        );

        await run(
            db,
            `
            INSERT INTO
                growth_onboarding_enrollments (
                    id,
                    youth_id,
                    template_id,
                    status,
                    completed_days
                )
            VALUES (?, ?, 1, 'active', 0)
            `,
            [
                id,
                id
            ]
        );
    }
}

test(
    'daily Prayer Covenant schedule is one-to-one, self-free, durable and does not touch weekly Prayer Partner state',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createBaseSchema(
            db
        );

        await seedActiveMembers(
            db,
            [
                1,
                2,
                3,
                4
            ]
        );

        await run(
            db,
            `
            INSERT INTO
                secret_prayer_pals (
                    youth_id,
                    pal_youth_id,
                    week_start
                )
            VALUES (
                1,
                2,
                '2026-09-14'
            )
            `
        );

        await Daily.initializeSchema(
            db
        );

        await Daily.initializeSchema(
            db
        );

        const first =
            await Daily
                .getOrCreateDailyPal(
                    db,
                    1,
                    {
                        now:
                            '2026-09-20T04:00:00.000Z'
                    }
                );

        assert.equal(
            first.available,
            true
        );

        assert.equal(
            first.assignmentDate,
            '2026-09-20'
        );

        assert.notEqual(
            first.assignment.senderYouthId,
            first.assignment.palYouthId
        );

        const dayOne =
            await Daily
                .listDateAssignments(
                    db,
                    '2026-09-20'
                );

        assert.equal(
            dayOne.length,
            4
        );

        const senders =
            dayOne.map(
                row =>
                    Number(
                        row.sender_youth_id
                    )
            );

        const recipients =
            dayOne.map(
                row =>
                    Number(
                        row.pal_youth_id
                    )
            );

        assert.deepEqual(
            [...senders].sort(
                (a, b) => a - b
            ),
            [
                1,
                2,
                3,
                4
            ]
        );

        assert.deepEqual(
            [...recipients].sort(
                (a, b) => a - b
            ),
            [
                1,
                2,
                3,
                4
            ]
        );

        assert.equal(
            new Set(
                recipients
            ).size,
            4
        );

        for (
            const row
            of dayOne
        ) {
            assert.notEqual(
                Number(
                    row.sender_youth_id
                ),
                Number(
                    row.pal_youth_id
                )
            );
        }

        const sameDay =
            await Daily
                .ensureDateAssignments(
                    db,
                    {
                        now:
                            '2026-09-20T09:00:00.000Z'
                    }
                );

        assert.equal(
            sameDay.created,
            false
        );

        assert.equal(
            sameDay.reason,
            'existing_schedule'
        );

        const repeatedDayOne =
            await Daily
                .listDateAssignments(
                    db,
                    '2026-09-20'
                );

        assert.deepEqual(
            repeatedDayOne.map(
                row => [
                    Number(
                        row.sender_youth_id
                    ),
                    Number(
                        row.pal_youth_id
                    )
                ]
            ),
            dayOne.map(
                row => [
                    Number(
                        row.sender_youth_id
                    ),
                    Number(
                        row.pal_youth_id
                    )
                ]
            )
        );

        const dayTwoResult =
            await Daily
                .ensureDateAssignments(
                    db,
                    {
                        now:
                            '2026-09-21T04:00:00.000Z'
                    }
                );

        assert.equal(
            dayTwoResult.created,
            true
        );

        const dayTwo =
            await Daily
                .listDateAssignments(
                    db,
                    '2026-09-21'
                );

        assert.equal(
            dayTwo.length,
            4
        );

        const previous =
            new Map(
                dayOne.map(
                    row => [
                        Number(
                            row.sender_youth_id
                        ),
                        Number(
                            row.pal_youth_id
                        )
                    ]
                )
            );

        for (
            const row
            of dayTwo
        ) {
            const sender =
                Number(
                    row.sender_youth_id
                );

            const recipient =
                Number(
                    row.pal_youth_id
                );

            assert.notEqual(
                sender,
                recipient
            );

            assert.notEqual(
                recipient,
                previous.get(
                    sender
                )
            );
        }

        const weeklyRows =
            await all(
                db,
                `
                SELECT
                    youth_id,
                    pal_youth_id,
                    week_start
                FROM
                    secret_prayer_pals
                ORDER BY id
                `
            );

        assert.deepEqual(
            weeklyRows,
            [
                {
                    youth_id: 1,
                    pal_youth_id: 2,
                    week_start:
                        '2026-09-14'
                }
            ]
        );

        assert.equal(
            (
                await all(
                    db,
                    `
                    SELECT *
                    FROM
                        growth_onboarding_daily_completions
                    `
                )
            ).length,
            0
        );

        assert.equal(
            (
                await all(
                    db,
                    `
                    SELECT *
                    FROM
                        growth_prayer_rhythm_days
                    `
                )
            ).length,
            0
        );

        assert.equal(
            (
                await all(
                    db,
                    `
                    SELECT *
                    FROM
                        growth_evidence
                    `
                )
            ).length,
            0
        );
    }
);

test(
    'daily Prayer Covenant assignment requires an active unpaused enrollment and at least two active participants',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createBaseSchema(
            db
        );

        await seedActiveMembers(
            db,
            [
                10
            ]
        );

        await Daily.initializeSchema(
            db
        );

        const onlyMember =
            await Daily
                .getOrCreateDailyPal(
                    db,
                    10,
                    {
                        now:
                            '2026-09-20T04:00:00.000Z'
                    }
                );

        assert.equal(
            onlyMember.available,
            false
        );

        assert.equal(
            onlyMember.reason,
            'insufficient_participants'
        );

        await run(
            db,
            `
            INSERT INTO youth (
                id,
                name
            )
            VALUES (
                11,
                'Member 11'
            )
            `
        );

        await run(
            db,
            `
            INSERT INTO
                growth_onboarding_enrollments (
                    id,
                    youth_id,
                    template_id,
                    status,
                    completed_days
                )
            VALUES (
                11,
                11,
                1,
                'completed',
                21
            )
            `
        );

        const completed =
            await Daily
                .getOrCreateDailyPal(
                    db,
                    11,
                    {
                        now:
                            '2026-09-20T04:00:00.000Z'
                    }
                );

        assert.equal(
            completed.available,
            false
        );

        assert.equal(
            completed.reason,
            'not_enrolled'
        );

        await run(
            db,
            `
            UPDATE
                growth_onboarding_templates
            SET
                is_paused = 1
            WHERE
                id = 1
            `
        );

        const paused =
            await Daily
                .getOrCreateDailyPal(
                    db,
                    10,
                    {
                        now:
                            '2026-09-21T04:00:00.000Z'
                    }
                );

        assert.equal(
            paused.available,
            false
        );

        assert.equal(
            paused.reason,
            'not_enrolled'
        );
    }
);

test(
    'Manila calendar date is authoritative across UTC boundary',
    () => {
        assert.equal(
            Daily.getManilaDate(
                '2026-09-19T16:01:00.000Z'
            ),
            '2026-09-20'
        );

        assert.equal(
            Daily.getManilaDate(
                '2026-09-20T15:59:59.000Z'
            ),
            '2026-09-20'
        );

        assert.equal(
            Daily.getManilaDate(
                '2026-09-20T16:00:00.000Z'
            ),
            '2026-09-21'
        );
    }
);

test(
    'daily Prayer Covenant schema exposes durable send state and upgrades an older table safely',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createBaseSchema(
            db
        );

        await exec(
            db,
            `
            CREATE TABLE
                prayer_covenant_daily_pals (
                    id INTEGER
                        PRIMARY KEY AUTOINCREMENT,

                    assignment_date TEXT
                        NOT NULL,

                    sender_youth_id INTEGER
                        NOT NULL,

                    pal_youth_id INTEGER
                        NOT NULL,

                    enrollment_id INTEGER
                        NOT NULL,

                    created_at TEXT
                        NOT NULL
                        DEFAULT CURRENT_TIMESTAMP,

                    UNIQUE(
                        assignment_date,
                        sender_youth_id
                    ),

                    UNIQUE(
                        assignment_date,
                        pal_youth_id
                    ),

                    CHECK(
                        sender_youth_id <>
                        pal_youth_id
                    )
                );
            `
        );

        await Daily.initializeSchema(
            db
        );

        await Daily.initializeSchema(
            db
        );

        const columns =
            await all(
                db,
                `
                PRAGMA table_info(
                    prayer_covenant_daily_pals
                )
                `
            );

        const names =
            new Set(
                columns.map(
                    row => row.name
                )
            );

        assert.equal(
            names.has(
                'sent_inbox_id'
            ),
            true
        );

        assert.equal(
            names.has(
                'sent_at'
            ),
            true
        );
    }
);

test(
    'new daily Prayer Pal assignments expose an unsent durable state',
    async t => {
        const db =
            openDb();

        t.after(
            () => close(db)
        );

        await createBaseSchema(
            db
        );

        await seedActiveMembers(
            db,
            [
                31,
                32
            ]
        );

        await Daily.initializeSchema(
            db
        );

        const result =
            await Daily
                .getOrCreateDailyPal(
                    db,
                    31,
                    {
                        now:
                            '2026-09-20T04:00:00.000Z'
                    }
                );

        assert.equal(
            result.available,
            true
        );

        assert.equal(
            result.assignment
                .sentInboxId,
            null
        );

        assert.equal(
            result.assignment
                .sentAt,
            null
        );

        assert.equal(
            result.assignment
                .prayedToday,
            false
        );
    }
);
