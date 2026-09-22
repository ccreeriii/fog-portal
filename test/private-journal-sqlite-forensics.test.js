'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const os =
    require('node:os');

const path =
    require('node:path');

const sqlite3 =
    require('sqlite3');

const Security =
    require(
        '../lib/private-journal-security'
    );

const JournalCrypto =
    require(
        '../public/js/journal-crypto.js'
    );


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


function get(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.get(
                sql,
                params,
                (error, row) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(row || null);
                    }
                }
            );
        }
    );
}


function closeDatabase(
    database
) {
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


function fileContains(
    filename,
    needle
) {
    if (
        !fs.existsSync(filename)
    ) {
        return false;
    }

    const data =
        fs.readFileSync(
            filename
        );

    return data.includes(
        Buffer.from(
            needle,
            'utf8'
        )
    );
}


test(
    'Journal schema enables full SQLite secure_delete',
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

            const state =
                await Security
                    .readPrivateJournalStorageSecurity(
                        database
                    );

            assert.equal(
                Number(
                    state.secure_delete
                ),
                1
            );

        } finally {
            await closeDatabase(
                database
            );
        }
    }
);


test(
    'legacy migration plus WAL truncate removes synthetic plaintext bytes from disposable SQLite files',
    async () => {
        const directory =
            fs.mkdtempSync(
                path.join(
                    os.tmpdir(),
                    'fog-journal-forensic-'
                )
            );

        const dbPath =
            path.join(
                directory,
                'journal-rehearsal.db'
            );

        const database =
            new sqlite3.Database(
                dbPath
            );

        const sentinelTitle =
            'FOG_FORENSIC_TITLE_9f8b74e1';

        const sentinelMood =
            'FOG_FORENSIC_MOOD_a16c9902';

        const sentinelContent =
            'FOG_FORENSIC_CONTENT_5d14dcbf_' +
            'This plaintext must disappear after secure migration.';

        try {
            await run(
                database,
                'PRAGMA journal_mode = WAL'
            );

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

            await run(
                database,
                `INSERT INTO private_journals (
                    youth_id,
                    title,
                    content,
                    mood,
                    created_at
                 )
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    900001,
                    sentinelTitle,
                    sentinelContent,
                    sentinelMood,
                    '2026-09-21 12:00:00'
                ]
            );

            /*
             * Checkpoint the pre-migration plaintext so this
             * test starts from a worst-case condition where
             * the main DB file has definitely held the words.
             */
            await Security
                .truncatePrivateJournalWal(
                    database
                );

            assert.equal(
                fileContains(
                    dbPath,
                    sentinelContent
                ),
                true
            );

            await Security
                .ensurePrivateJournalSecuritySchema(
                    database
                );

            const storageState =
                await Security
                    .readPrivateJournalStorageSecurity(
                        database
                    );

            assert.equal(
                Number(
                    storageState
                        .secure_delete
                ),
                1
            );

            const setup =
                await JournalCrypto
                    .createJournalSetup(
                        900001
                    );

            const entryUuid =
                JournalCrypto
                    .createEntryUuid();

            const encrypted =
                await JournalCrypto
                    .encryptEntry(
                        900001,
                        setup.masterKey,
                        {
                            entryUuid,

                            title:
                                sentinelTitle,

                            mood:
                                sentinelMood,

                            content:
                                sentinelContent
                        }
                    );

            const result =
                await run(
                    database,
                    `UPDATE private_journals
                     SET
                        entry_uuid = ?,
                        crypto_version = ?,
                        cipher_alg = ?,
                        iv_b64 = ?,
                        ciphertext_b64 = ?,
                        encrypted_at = ?,
                        updated_at = ?,
                        title = NULL,
                        content = NULL,
                        mood = NULL
                     WHERE id = 1
                       AND youth_id = 900001
                       AND (
                            crypto_version IS NULL
                            OR ciphertext_b64 IS NULL
                       )`,
                    [
                        encrypted.entry_uuid,
                        encrypted.crypto_version,
                        encrypted.cipher_alg,
                        encrypted.iv_b64,
                        encrypted.ciphertext_b64,
                        '2026-09-21 12:01:00',
                        '2026-09-21 12:01:00'
                    ]
                );

            assert.equal(
                result.changes,
                1
            );

            const row =
                await get(
                    database,
                    `SELECT
                        id,
                        title,
                        content,
                        mood,
                        entry_uuid,
                        crypto_version,
                        cipher_alg,
                        iv_b64,
                        ciphertext_b64,
                        created_at,
                        updated_at
                     FROM private_journals
                     WHERE id = 1`
                );

            assert.equal(
                row.title,
                null
            );

            assert.equal(
                row.content,
                null
            );

            assert.equal(
                row.mood,
                null
            );

            const decrypted =
                await JournalCrypto
                    .decryptEntry(
                        900001,
                        setup.masterKey,
                        row
                    );

            assert.equal(
                decrypted.title,
                sentinelTitle
            );

            assert.equal(
                decrypted.mood,
                sentinelMood
            );

            assert.equal(
                decrypted.content,
                sentinelContent
            );

            /*
             * In WAL mode the old page can remain outside
             * the logical row until a successful checkpoint.
             */
            await Security
                .truncatePrivateJournalWal(
                    database
                );

        } finally {
            await closeDatabase(
                database
            );
        }

        const walPath =
            `${dbPath}-wal`;

        assert.equal(
            fileContains(
                dbPath,
                sentinelTitle
            ),
            false
        );

        assert.equal(
            fileContains(
                dbPath,
                sentinelMood
            ),
            false
        );

        assert.equal(
            fileContains(
                dbPath,
                sentinelContent
            ),
            false
        );

        assert.equal(
            fileContains(
                walPath,
                sentinelTitle
            ),
            false
        );

        assert.equal(
            fileContains(
                walPath,
                sentinelMood
            ),
            false
        );

        assert.equal(
            fileContains(
                walPath,
                sentinelContent
            ),
            false
        );

        fs.rmSync(
            directory,
            {
                recursive:
                    true,
                force:
                    true
            }
        );
    }
);


test(
    'WAL truncate helper is explicit maintenance code and is not called by Journal request handlers',
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

        assert.doesNotMatch(
            server,
            /truncatePrivateJournalWal\s*\(/
        );

        const security =
            fs.readFileSync(
                path.join(
                    __dirname,
                    '..',
                    'lib',
                    'private-journal-security.js'
                ),
                'utf8'
            );

        assert.match(
            security,
            /PRAGMA wal_checkpoint\(TRUNCATE\)/
        );

        assert.match(
            security,
            /PRAGMA secure_delete = ON/
        );
    }
);
