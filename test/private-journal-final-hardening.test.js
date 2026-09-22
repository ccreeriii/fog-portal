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
    require(
        '../lib/private-journal-security'
    );

const Crypto =
    require(
        '../public/js/journal-crypto.js'
    );


function read(relative) {
    return fs.readFileSync(
        path.join(
            __dirname,
            '..',
            relative
        ),
        'utf8'
    );
}


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
                function callback(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(this);
                    }
                }
            );
        }
    );
}


function all(
    database,
    sql
) {
    return new Promise(
        (resolve, reject) => {
            database.all(
                sql,
                [],
                (error, rows) => {
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


function close(database) {
    return new Promise(
        (resolve, reject) => {
            database.close(
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


function routeBlock(
    server,
    signature,
    nextSignature
) {
    const start =
        server.indexOf(
            signature
        );

    assert.ok(
        start >= 0,
        `missing route ${signature}`
    );

    const end =
        nextSignature
            ? server.indexOf(
                nextSignature,
                start +
                    signature.length
            )
            : -1;

    return server.slice(
        start,
        end > start
            ? end
            : start + 7000
    );
}


test(
    'fingerprinted encrypted payload requires active key identity and rejects plaintext',
    async () => {
        const setup =
            await Crypto
                .createJournalSetup(
                    900001
                );

        const encrypted =
            await Crypto
                .encryptEntry(
                    900001,
                    setup.masterKey,
                    {
                        entryUuid:
                            Crypto
                                .createEntryUuid(),

                        title:
                            'Synthetic',

                        mood:
                            'Peaceful',

                        content:
                            'Synthetic content'
                    }
                );

        const validated =
            Security
                .validateEncryptedEntryPayloadWithFingerprint({
                    ...encrypted,

                    key_fingerprint:
                        setup
                            .envelope
                            .key_fingerprint
                });

        assert.equal(
            validated.key_fingerprint,
            setup.envelope
                .key_fingerprint
        );

        assert.throws(
            () =>
                Security
                    .validateEncryptedEntryPayloadWithFingerprint(
                        encrypted
                    )
        );

        assert.throws(
            () =>
                Security
                    .validateEncryptedEntryPayloadWithFingerprint({
                        ...encrypted,

                        key_fingerprint:
                            setup.envelope
                                .key_fingerprint,

                        title:
                            'PLAINTEXT MUST FAIL'
                    }),
            /plaintext/i
        );
    }
);


test(
    'Journal schema adds per-entry key fingerprint column',
    async () => {
        const database =
            new sqlite3.Database(
                ':memory:'
            );

        try {
            await run(
                database,
                `CREATE TABLE private_journals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    youth_id INTEGER,
                    title TEXT,
                    content TEXT,
                    mood TEXT,
                    created_at DATETIME
                )`
            );

            await Security
                .ensurePrivateJournalSecuritySchema(
                    database
                );

            const columns =
                await all(
                    database,
                    'PRAGMA table_info(private_journals)'
                );

            assert.equal(
                columns.some(
                    column =>
                        column.name ===
                        'key_fingerprint'
                ),
                true
            );

        } finally {
            await close(
                database
            );
        }
    }
);


test(
    'all Journal APIs wait for fail-closed schema readiness',
    () => {
        const server =
            read(
                'server.js'
            );

        assert.match(
            server,
            /const privateJournalSchemaReady/
        );

        assert.match(
            server,
            /JOURNAL_SCHEMA_UNAVAILABLE/
        );

        assert.match(
            server,
            /status\(503\)/
        );

        assert.match(
            server,
            /app\.use\(\s*'\/api\/journal-security',\s*requirePrivateJournalSchemaReady/
        );

        assert.match(
            server,
            /app\.use\(\s*'\/api\/journals',\s*requirePrivateJournalSchemaReady/
        );

        assert.doesNotMatch(
            server,
            /ensurePrivateJournalSecuritySchema\(db\)\s*\.catch/
        );
    }
);


test(
    'locked legacy owners receive migration-only capability without normal Journal access',
    () => {
        const server =
            read(
                'server.js'
            );

        assert.match(
            server,
            /async function requirePrivateJournalMigrationAccess/
        );

        assert.match(
            server,
            /migration_only:\s*true/
        );

        assert.match(
            server,
            /\/api\/journal-security\/legacy-migration/
        );

        const normalGet =
            routeBlock(
                server,
                "app.get(\n    '/api/journals/:youth_id'",
                "app.post(\n    '/api/journals'"
            );

        assert.match(
            normalGet,
            /requirePrivateJournalAccess/
        );

        assert.doesNotMatch(
            normalGet,
            /requirePrivateJournalMigrationAccess/
        );
    }
);


test(
    'key setup and legacy migration use migration gate while normal writes remain fully gated',
    () => {
        const server =
            read(
                'server.js'
            );

        const keyGet =
            routeBlock(
                server,
                "app.get(\n    '/api/journal-security/key-envelope'",
                "app.put(\n    '/api/journal-security/key-envelope'"
            );

        const keyPut =
            routeBlock(
                server,
                "app.put(\n    '/api/journal-security/key-envelope'",
                "app.get(\n    '/api/journals/:youth_id'"
            );

        const create =
            routeBlock(
                server,
                "app.post(\n    '/api/journals'",
                "app.put(\n    '/api/journals/:id'"
            );

        const update =
            routeBlock(
                server,
                "app.put(\n    '/api/journals/:id'",
                "app.put(\n    '/api/journals/:id/migrate'"
            );

        const migrate =
            routeBlock(
                server,
                "app.put(\n    '/api/journals/:id/migrate'",
                "app.delete(\n    '/api/journals/:id'"
            );

        assert.match(
            keyGet,
            /requirePrivateJournalMigrationAccess/
        );

        assert.match(
            keyPut,
            /requirePrivateJournalMigrationAccess/
        );

        assert.match(
            create,
            /requirePrivateJournalAccess/
        );

        assert.match(
            update,
            /requirePrivateJournalAccess/
        );

        assert.match(
            migrate,
            /requirePrivateJournalMigrationAccess/
        );
    }
);


test(
    'encrypted writes require currently configured Journal key fingerprint',
    () => {
        const server =
            read(
                'server.js'
            );

        assert.match(
            server,
            /function requireCurrentPrivateJournalKeyFingerprint/
        );

        assert.match(
            server,
            /validateEncryptedEntryPayloadWithFingerprint/
        );

        assert.match(
            server,
            /JOURNAL_KEY_NOT_CONFIGURED/
        );

        assert.match(
            server,
            /JOURNAL_KEY_FINGERPRINT_MISMATCH/
        );

        for (
            const signature of [
                "app.post(\n    '/api/journals'",
                "app.put(\n    '/api/journals/:id'",
                "app.put(\n    '/api/journals/:id/migrate'"
            ]
        ) {
            const start =
                server.indexOf(
                    signature
                );

            assert.ok(
                start >= 0
            );

            assert.match(
                server.slice(
                    start,
                    start + 650
                ),
                /requireCurrentPrivateJournalKeyFingerprint/
            );
        }
    }
);


test(
    'create update and migration persist and bind row key fingerprint',
    () => {
        const server =
            read(
                'server.js'
            );

        const create =
            routeBlock(
                server,
                "app.post(\n    '/api/journals'",
                "app.put(\n    '/api/journals/:id'"
            );

        const update =
            routeBlock(
                server,
                "app.put(\n    '/api/journals/:id'",
                "app.put(\n    '/api/journals/:id/migrate'"
            );

        const migrate =
            routeBlock(
                server,
                "app.put(\n    '/api/journals/:id/migrate'",
                "app.delete(\n    '/api/journals/:id'"
            );

        assert.match(
            create,
            /key_fingerprint/
        );

        assert.match(
            create,
            /encrypted\.key_fingerprint/
        );

        assert.match(
            update,
            /key_fingerprint = \?/
        );

        assert.match(
            update,
            /AND key_fingerprint = \?/
        );

        assert.match(
            migrate,
            /key_fingerprint = \?/
        );

        assert.match(
            migrate,
            /encrypted\.key_fingerprint/
        );
    }
);


test(
    'browser migration-only flow protects legacy rows without returning them to visible Journal list',
    () => {
        const controller =
            read(
                'public/js/journal-secure-controller.js'
            );

        assert.match(
            controller,
            /initialStatus\.migration_only/
        );

        assert.match(
            controller,
            /ensureMigrationMasterKey/
        );

        assert.match(
            controller,
            /\/api\/journal-security\/legacy-migration/
        );

        assert.match(
            controller,
            /for\s*\(\s*const row of legacyRows\s*\)/
        );

        assert.match(
            controller,
            /await migrateLegacyEntry/
        );

        assert.match(
            controller,
            /Your existing Journal reflections were protected successfully/
        );
    }
);


test(
    'browser attaches active fingerprint and owner deletion remains privacy exception',
    () => {
        const controller =
            read(
                'public/js/journal-secure-controller.js'
            );

        const server =
            read(
                'server.js'
            );

        assert.match(
            controller,
            /const memoryFingerprints/
        );

        assert.match(
            controller,
            /function withKeyFingerprint/
        );

        const calls =
            (
                controller.match(
                    /withKeyFingerprint\(/g
                ) || []
            ).length;

        assert.ok(
            calls >= 4
        );

        assert.match(
            controller,
            /memoryFingerprints\.clear/
        );

        assert.match(
            server,
            /OWNER DELETE PRIVACY EXCEPTION/
        );

        const deleteBlock =
            routeBlock(
                server,
                "app.delete(\n    '/api/journals/:id'",
                null
            );

        assert.match(
            deleteBlock,
            /requireAuth/
        );

        assert.doesNotMatch(
            deleteBlock.slice(
                0,
                650
            ),
            /requirePrivateJournalAccess/
        );

        assert.doesNotMatch(
            deleteBlock.slice(
                0,
                650
            ),
            /requirePrivateJournalMigrationAccess/
        );
    }
);
