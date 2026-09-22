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

const Security =
    require('../lib/private-journal-security');


function run(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.run(
                sql,
                params,
                function (error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        changes:
                            this.changes,
                        lastID:
                            this.lastID
                    });
                }
            );
        }
    );
}


function get(
    database,
    sql
) {
    return new Promise(
        (resolve, reject) => {
            database.get(
                sql,
                [],
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(row);
                }
            );
        }
    );
}


function close(
    database
) {
    return new Promise(
        resolve =>
            database.close(
                () => resolve()
            )
    );
}


test(
    'lost-both reset removes only the selected owner Journal identity and safeguarding state',
    async () => {
        const database =
            new sqlite3.Database(
                ':memory:'
            );

        try {
            await run(
                database,
                `CREATE TABLE private_journals (
                    id INTEGER PRIMARY KEY,
                    youth_id INTEGER
                )`
            );

            await run(
                database,
                `CREATE TABLE private_journal_keys (
                    youth_id INTEGER PRIMARY KEY
                )`
            );

            await run(
                database,
                `CREATE TABLE private_journal_responsible_acknowledgements (
                    youth_id INTEGER,
                    policy_version TEXT
                )`
            );

            await run(
                database,
                `CREATE TABLE private_journal_guardian_authorizations (
                    id INTEGER PRIMARY KEY,
                    youth_id INTEGER
                )`
            );

            await run(
                database,
                `CREATE TABLE private_journal_guardian_verifications (
                    id INTEGER PRIMARY KEY,
                    authorization_id INTEGER
                )`
            );

            await run(
                database,
                `INSERT INTO private_journals
                 VALUES
                    (1, 42),
                    (2, 42),
                    (3, 43)`
            );

            await run(
                database,
                `INSERT INTO private_journal_keys
                 VALUES
                    (42),
                    (43)`
            );

            await run(
                database,
                `INSERT INTO private_journal_responsible_acknowledgements
                 VALUES
                    (42, 'p1'),
                    (43, 'p1')`
            );

            await run(
                database,
                `INSERT INTO private_journal_guardian_authorizations
                 VALUES
                    (100, 42),
                    (101, 43)`
            );

            await run(
                database,
                `INSERT INTO private_journal_guardian_verifications
                 VALUES
                    (200, 100),
                    (201, 101)`
            );

            const result =
                await Security
                    .resetPrivateJournalForOwner(
                        database,
                        42
                    );

            assert.equal(
                result.success,
                true
            );

            const checks = [
                [
                    `SELECT COUNT(*) count
                     FROM private_journals
                     WHERE youth_id = 42`,
                    0
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_keys
                     WHERE youth_id = 42`,
                    0
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_responsible_acknowledgements
                     WHERE youth_id = 42`,
                    0
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_guardian_authorizations
                     WHERE youth_id = 42`,
                    0
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_guardian_verifications
                     WHERE authorization_id = 100`,
                    0
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journals
                     WHERE youth_id = 43`,
                    1
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_keys
                     WHERE youth_id = 43`,
                    1
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_responsible_acknowledgements
                     WHERE youth_id = 43`,
                    1
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_guardian_authorizations
                     WHERE youth_id = 43`,
                    1
                ],
                [
                    `SELECT COUNT(*) count
                     FROM private_journal_guardian_verifications
                     WHERE authorization_id = 101`,
                    1
                ]
            ];

            for (
                const [
                    sql,
                    expected
                ]
                of checks
            ) {
                const row =
                    await get(
                        database,
                        sql
                    );

                assert.equal(
                    Number(row.count),
                    expected
                );
            }

        } finally {
            await close(
                database
            );
        }
    }
);


test(
    'lost-both reset rejects invalid owner identity',
    async () => {
        const database =
            new sqlite3.Database(
                ':memory:'
            );

        try {
            await assert.rejects(
                () =>
                    Security
                        .resetPrivateJournalForOwner(
                            database,
                            0
                        ),
                /valid Journal owner/i
            );
        } finally {
            await close(
                database
            );
        }
    }
);


test(
    'server reset route requires authentication and exact destructive confirmation',
    () => {
        const server =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'server.js'
                ),
                'utf8'
            );

        const start =
            server.indexOf(
                "app.post(\n    '/api/journal-security/reset'"
            );

        const end =
            server.indexOf(
                "app.get(\n    '/api/journal-security/key-envelope'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const block =
            server.slice(
                start,
                end
            );

        assert.match(
            block,
            /requireAuth/
        );

        assert.doesNotMatch(
            block,
            /requirePrivateJournalAccess/
        );

        assert.doesNotMatch(
            block,
            /requireCurrentPrivateJournalKeyFingerprint/
        );

        assert.match(
            block,
            /RESET MY JOURNAL/
        );

        assert.match(
            block,
            /understands_data_loss/
        );

        assert.match(
            block,
            /resetPrivateJournalForOwner/
        );

        assert.match(
            block,
            /PRIVATE_JOURNAL_RESET/
        );
    }
);


test(
    'reset request does not submit recovery or master-key material',
    () => {
        const controller =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'public',
                    'js',
                    'journal-secure-controller.js'
                ),
                'utf8'
            );

        const start =
            controller.indexOf(
                'async function resetJournalAfterLostRecovery'
            );

        const end =
            controller.indexOf(
                'async function recoverJournalOnDeviceOnce',
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const block =
            controller.slice(
                start,
                end
            );

        assert.match(
            block,
            /\/api\/journal-security\/reset/
        );

        assert.match(
            block,
            /understands_data_loss/
        );

        assert.doesNotMatch(
            block,
            /recoveryCode|masterKey|wrapped_key_b64/
        );
    }
);


test(
    'lost-key UI warns about permanent loss and automatically restarts normal setup flow',
    () => {
        const controller =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'public',
                    'js',
                    'journal-secure-controller.js'
                ),
                'utf8'
            );

        assert.match(
            controller,
            /I lost my Recovery Key/
        );

        assert.match(
            controller,
            /Permanently Reset Journal/
        );

        assert.match(
            controller,
            /If you lose BOTH every trusted device and this Recovery Key/
        );

        assert.match(
            controller,
            /existing Journal entries cannot be recovered/
        );

        assert.match(
            controller,
            /JOURNAL_RESET_COMPLETED/
        );

        assert.match(
            controller,
            /return ensureMasterKey\(\s*canonicalOwner\s*\)/
        );

        assert.match(
            controller,
            /recoveryPromises\.clear\(\)/
        );
    }
);
