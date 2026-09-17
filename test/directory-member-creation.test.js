'use strict';

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const sqlite3 =
    require('sqlite3')
        .verbose();

const test =
    require('node:test');

const {
    createDirectoryMember
} =
    require(
        '../lib/directory-member-creation'
    );

function openDatabase() {
    return new sqlite3.Database(
        ':memory:'
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
                function callback(error) {
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
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        row || null
                    );
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
                (error, rows) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        rows || []
                    );
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
                error =>
                    error
                        ? reject(error)
                        : resolve()
            );
        }
    );
}

async function prepareDatabase(
    db
) {
    await run(
        db,
        `
        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER,
            email TEXT,
            mobile TEXT,
            social_media TEXT,
            birthday TEXT,
            parents_name TEXT,
            qr_code TEXT UNIQUE,
            created_at TEXT,
            profile_picture TEXT,
            gender TEXT,
            address TEXT,
            email_verified INTEGER NOT NULL DEFAULT 0,
            email_verified_at INTEGER
        )
        `
    );

    await run(
        db,
        `
        CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT UNIQUE,
            password TEXT,
            permissions TEXT,
            created_at TEXT,
            youth_id INTEGER,
            account_claimed_at INTEGER,
            account_claim_method TEXT,
            account_claim_token_id INTEGER
        )
        `
    );

    await run(
        db,
        `
        CREATE TABLE activity_logs (
            id INTEGER PRIMARY KEY,
            username TEXT,
            action TEXT,
            details TEXT,
            created_at TEXT
        )
        `
    );
}

function normalizeEmail(
    value
) {
    const email =
        String(value || '')
            .trim()
            .toLowerCase();

    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/
        .test(email)
        ? email
        : null;
}

function formatMemberCode(
    youthId
) {
    return (
        'FOG-PASS-' +
        String(youthId)
            .padStart(3, '0')
    );
}

const now =
    () =>
        '2026-09-17 21:30:00';

test(
    'leadership creation atomically creates one member and one claimable empty-permission account',
    async () => {
        const db =
            openDatabase();

        try {
            await prepareDatabase(
                db
            );

            const result =
                await createDirectoryMember(
                    db,
                    {
                        member: {
                            name:
                                'Historical Adult',

                            age:
                                38,

                            birthday:
                                '1988-03-10',

                            email:
                                ' Adult@Example.com ',

                            mobile:
                                '09170000000',

                            address:
                                'Cebu'
                        },

                        actorName:
                            'Directory Leader',

                        normalizeEmail,
                        formatMemberCode,
                        now
                    }
                );

            assert.equal(
                result.id,
                1
            );

            assert.equal(
                result.qr_code,
                'FOG-PASS-001'
            );

            assert.equal(
                result.account_status,
                'claimable'
            );

            assert.deepEqual(
                result.permissions,
                []
            );

            assert.equal(
                result.legal_acceptance_recorded,
                false
            );

            assert.equal(
                result.growth_started,
                false
            );

            const member =
                await get(
                    db,
                    'SELECT * FROM youth WHERE id = 1'
                );

            assert.equal(
                member.name,
                'Historical Adult'
            );

            assert.equal(
                member.email,
                'adult@example.com'
            );

            assert.equal(
                member.qr_code,
                'FOG-PASS-001'
            );

            assert.equal(
                member.email_verified,
                0
            );

            const accounts =
                await all(
                    db,
                    'SELECT * FROM users WHERE youth_id = 1'
                );

            assert.equal(
                accounts.length,
                1
            );

            assert.equal(
                accounts[0].username,
                'FOG-PASS-001'
            );

            assert.equal(
                accounts[0].password,
                null
            );

            assert.equal(
                accounts[0].permissions,
                '[]'
            );

            assert.equal(
                accounts[0].account_claimed_at,
                null
            );

            assert.equal(
                accounts[0].account_claim_method,
                null
            );

            assert.equal(
                accounts[0].account_claim_token_id,
                null
            );
        } finally {
            await close(
                db
            );
        }
    }
);

test(
    'audit actor is canonical context and cannot be overridden by member payload',
    async () => {
        const db =
            openDatabase();

        try {
            await prepareDatabase(
                db
            );

            await createDirectoryMember(
                db,
                {
                    member: {
                        name:
                            'Adult Member',

                        actor:
                            'Forged Browser Actor'
                    },

                    actorName:
                        'Authenticated Leader',

                    normalizeEmail,
                    formatMemberCode,
                    now
                }
            );

            const log =
                await get(
                    db,
                    `
                    SELECT username,
                           action,
                           details
                    FROM activity_logs
                    LIMIT 1
                    `
                );

            assert.equal(
                log.username,
                'Authenticated Leader'
            );

            assert.equal(
                log.action,
                'DIRECTORY_MEMBER_CREATED'
            );

            assert.equal(
                log.details.includes(
                    'Forged Browser Actor'
                ),
                false
            );
        } finally {
            await close(
                db
            );
        }
    }
);

test(
    'member code is derived from the actual inserted ID and never from MAX(id)',
    async () => {
        const db =
            openDatabase();

        try {
            await prepareDatabase(
                db
            );

            await run(
                db,
                `
                INSERT INTO youth (
                    id,
                    name,
                    qr_code
                )
                VALUES (
                    10,
                    'Existing Member',
                    'FOG-PASS-010'
                )
                `
            );

            const result =
                await createDirectoryMember(
                    db,
                    {
                        member: {
                            name:
                                'Next Member'
                        },

                        actorName:
                            'Directory Leader',

                        normalizeEmail,
                        formatMemberCode,
                        now
                    }
                );

            assert.equal(
                result.id,
                11
            );

            assert.equal(
                result.qr_code,
                'FOG-PASS-011'
            );

            const source =
                fs.readFileSync(
                    path.join(
                        __dirname,
                        '..',
                        'lib',
                        'directory-member-creation.js'
                    ),
                    'utf8'
                );

            assert.equal(
                /MAX\s*\(\s*id\s*\)/i.test(
                    source
                ),
                false
            );
        } finally {
            await close(
                db
            );
        }
    }
);

test(
    'duplicate email fails closed without creating member, account, or audit row',
    async () => {
        const db =
            openDatabase();

        try {
            await prepareDatabase(
                db
            );

            await run(
                db,
                `
                INSERT INTO youth (
                    name,
                    email,
                    qr_code
                )
                VALUES (
                    'Existing',
                    'same@example.com',
                    'FOG-PASS-001'
                )
                `
            );

            await assert.rejects(
                () =>
                    createDirectoryMember(
                        db,
                        {
                            member: {
                                name:
                                    'Duplicate',

                                email:
                                    'SAME@example.com'
                            },

                            actorName:
                                'Directory Leader',

                            normalizeEmail,
                            formatMemberCode,
                            now
                        }
                    ),

                error =>
                    error &&
                    error.code ===
                        'DIRECTORY_MEMBER_EMAIL_EXISTS'
            );

            const members =
                await get(
                    db,
                    'SELECT COUNT(*) AS count FROM youth'
                );

            const accounts =
                await get(
                    db,
                    'SELECT COUNT(*) AS count FROM users'
                );

            const logs =
                await get(
                    db,
                    'SELECT COUNT(*) AS count FROM activity_logs'
                );

            assert.equal(
                members.count,
                1
            );

            assert.equal(
                accounts.count,
                0
            );

            assert.equal(
                logs.count,
                0
            );
        } finally {
            await close(
                db
            );
        }
    }
);

test(
    'account creation failure rolls back the member and audit atomically',
    async () => {
        const db =
            openDatabase();

        try {
            await prepareDatabase(
                db
            );

            await run(
                db,
                `
                CREATE TRIGGER reject_user_insert
                BEFORE INSERT ON users
                BEGIN
                    SELECT RAISE(
                        ABORT,
                        'forced account failure'
                    );
                END
                `
            );

            await assert.rejects(
                () =>
                    createDirectoryMember(
                        db,
                        {
                            member: {
                                name:
                                    'Rollback Member'
                            },

                            actorName:
                                'Directory Leader',

                            normalizeEmail,
                            formatMemberCode,
                            now
                        }
                    )
            );

            const members =
                await get(
                    db,
                    'SELECT COUNT(*) AS count FROM youth'
                );

            const accounts =
                await get(
                    db,
                    'SELECT COUNT(*) AS count FROM users'
                );

            const logs =
                await get(
                    db,
                    'SELECT COUNT(*) AS count FROM activity_logs'
                );

            assert.equal(
                members.count,
                0
            );

            assert.equal(
                accounts.count,
                0
            );

            assert.equal(
                logs.count,
                0
            );
        } finally {
            await close(
                db
            );
        }
    }
);

test(
    'simultaneous leadership creations serialize into distinct complete identities',
    async () => {
        const db =
            openDatabase();

        try {
            await prepareDatabase(
                db
            );

            const results =
                await Promise.all([
                    createDirectoryMember(
                        db,
                        {
                            member: {
                                name:
                                    'Member One'
                            },

                            actorName:
                                'Leader',

                            normalizeEmail,
                            formatMemberCode,
                            now
                        }
                    ),

                    createDirectoryMember(
                        db,
                        {
                            member: {
                                name:
                                    'Member Two'
                            },

                            actorName:
                                'Leader',

                            normalizeEmail,
                            formatMemberCode,
                            now
                        }
                    )
                ]);

            assert.deepEqual(
                results.map(
                    item =>
                        item.id
                ),
                [1, 2]
            );

            const members =
                await all(
                    db,
                    `
                    SELECT id,
                           qr_code
                    FROM youth
                    ORDER BY id
                    `
                );

            const accounts =
                await all(
                    db,
                    `
                    SELECT youth_id,
                           username
                    FROM users
                    ORDER BY youth_id
                    `
                );

            const logs =
                await all(
                    db,
                    `
                    SELECT action
                    FROM activity_logs
                    ORDER BY id
                    `
                );

            assert.deepEqual(
                members,
                [
                    {
                        id: 1,
                        qr_code:
                            'FOG-PASS-001'
                    },
                    {
                        id: 2,
                        qr_code:
                            'FOG-PASS-002'
                    }
                ]
            );

            assert.deepEqual(
                accounts,
                [
                    {
                        youth_id: 1,
                        username:
                            'FOG-PASS-001'
                    },
                    {
                        youth_id: 2,
                        username:
                            'FOG-PASS-002'
                    }
                ]
            );

            assert.equal(
                logs.length,
                2
            );

            assert.ok(
                logs.every(
                    row =>
                        row.action ===
                        'DIRECTORY_MEMBER_CREATED'
                )
            );
        } finally {
            await close(
                db
            );
        }
    }
);

test(
    'secure Directory creator contains no automatic legal, Growth, password, or verification side effects',
    () => {
        const source =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'lib',
                    'directory-member-creation.js'
                ),
                'utf8'
            );

        assert.equal(
            source.includes(
                'legal_acceptances'
            ),
            false
        );

        assert.equal(
            source.includes(
                'GrowthJourney'
            ),
            false
        );

        assert.equal(
            source.includes(
                'queueEmailVerification'
            ),
            false
        );

        assert.equal(
            source.includes(
                'hashPassword'
            ),
            false
        );
    }
);
