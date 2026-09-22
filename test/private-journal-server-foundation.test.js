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

function b64url(bytes) {
    return Buffer
        .from(bytes)
        .toString('base64url');
}

function encryptedPayload() {
    return {
        entry_uuid:
            '8d12ac11-1bbf-4bdb-9bf1-c622ac724110',
        crypto_version:
            1,
        cipher_alg:
            'AES-256-GCM',
        iv_b64:
            b64url(
                Buffer.alloc(
                    12,
                    0x11
                )
            ),
        ciphertext_b64:
            b64url(
                Buffer.alloc(
                    64,
                    0x22
                )
            )
    };
}

function keyEnvelope() {
    return {
        crypto_version:
            1,
        wrap_alg:
            'AES-256-GCM',
        wrapped_key_b64:
            b64url(
                Buffer.alloc(
                    48,
                    0x33
                )
            ),
        wrap_iv_b64:
            b64url(
                Buffer.alloc(
                    12,
                    0x44
                )
            ),
        key_fingerprint:
            b64url(
                Buffer.alloc(
                    16,
                    0x55
                )
            )
    };
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
                    } else {
                        resolve(this);
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
                (error, rows) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(rows);
                    }
                }
            );
        }
    );
}


test(
    'encrypted Journal payload validation rejects plaintext fields',
    () => {
        const payload =
            encryptedPayload();

        assert.deepEqual(
            Security
                .validateEncryptedEntryPayload(
                    payload
                ),
            payload
        );

        assert.throws(
            () =>
                Security
                    .validateEncryptedEntryPayload({
                        ...payload,
                        content:
                            'plaintext must never arrive here'
                    }),
            /plaintext/i
        );

        assert.throws(
            () =>
                Security
                    .validateEncryptedEntryPayload({
                        ...payload,
                        recovery_key:
                            'must-not-upload'
                    }),
            /recovery|key material/i
        );
    }
);


test(
    'Journal key envelope accepts only wrapped key material',
    () => {
        const envelope =
            keyEnvelope();

        assert.deepEqual(
            Security
                .validateKeyEnvelopePayload(
                    envelope
                ),
            envelope
        );

        assert.throws(
            () =>
                Security
                    .validateKeyEnvelopePayload({
                        ...envelope,
                        recoveryCode:
                            'FOG-JR1-secret'
                    }),
            /recovery/i
        );

        assert.throws(
            () =>
                Security
                    .validateKeyEnvelopePayload({
                        ...envelope,
                        masterKey:
                            'secret'
                    }),
            /recovery|key material/i
        );
    }
);


test(
    'encrypted row serialization never exposes legacy plaintext columns',
    () => {
        const row = {
            id:
                9,
            youth_id:
                42,
            title:
                'SHOULD NEVER LEAK',
            mood:
                'SHOULD NEVER LEAK',
            content:
                'SHOULD NEVER LEAK',
            created_at:
                '2026-09-21 10:00:00',
            updated_at:
                '2026-09-21 10:01:00',
            ...encryptedPayload()
        };

        const serialized =
            Security
                .serializePrivateJournalRow(
                    row
                );

        assert.equal(
            serialized.legacy,
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    serialized,
                    'title'
                ),
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    serialized,
                    'content'
                ),
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    serialized,
                    'mood'
                ),
            false
        );

        assert.equal(
            JSON.stringify(
                serialized
            ).includes(
                'SHOULD NEVER LEAK'
            ),
            false
        );
    }
);


test(
    'legacy row serialization remains temporarily available only for owner-side migration',
    () => {
        const serialized =
            Security
                .serializePrivateJournalRow({
                    id:
                        5,
                    title:
                        'Legacy title',
                    content:
                        'Legacy content',
                    mood:
                        'Peaceful',
                    created_at:
                        '2026-09-01 08:00:00',
                    crypto_version:
                        null,
                    ciphertext_b64:
                        null
                });

        assert.equal(
            serialized.legacy,
            true
        );

        assert.equal(
            serialized.title,
            'Legacy title'
        );

        assert.equal(
            serialized.content,
            'Legacy content'
        );
    }
);


test(
    'Journal age brackets fail closed for missing ages',
    () => {
        assert.equal(
            Security
                .getJournalAgeBracket(
                    null
                ),
            'UNKNOWN'
        );

        assert.equal(
            Security
                .getJournalAgeBracket(
                    9
                ),
            'UNDER_10'
        );

        assert.equal(
            Security
                .getJournalAgeBracket(
                    10
                ),
            'AGE_10_12'
        );

        assert.equal(
            Security
                .getJournalAgeBracket(
                    12
                ),
            'AGE_10_12'
        );

        assert.equal(
            Security
                .getJournalAgeBracket(
                    13
                ),
            'AGE_13_17'
        );

        assert.equal(
            Security
                .getJournalAgeBracket(
                    17
                ),
            'AGE_13_17'
        );

        assert.equal(
            Security
                .getJournalAgeBracket(
                    18
                ),
            'AGE_18_PLUS'
        );
    }
);


test(
    'legacy SQLite Journal schema upgrades without reading or rewriting entry content',
    async () => {
        const db =
            new sqlite3.Database(
                ':memory:'
            );

        try {
            await run(
                db,
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
                db,
                `INSERT INTO private_journals (
                    youth_id,
                    title,
                    content,
                    mood,
                    created_at
                 )
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    42,
                    'Legacy test title',
                    'Legacy test content',
                    'Hopeful',
                    '2026-09-21 10:00:00'
                ]
            );

            await Security
                .ensurePrivateJournalSecuritySchema(
                    db
                );

            const columns =
                await all(
                    db,
                    `PRAGMA table_info(
                        "private_journals"
                    )`
                );

            const names =
                new Set(
                    columns.map(
                        row =>
                            row.name
                    )
                );

            for (const required of [
                'entry_uuid',
                'crypto_version',
                'cipher_alg',
                'iv_b64',
                'ciphertext_b64',
                'encrypted_at',
                'updated_at'
            ]) {
                assert.equal(
                    names.has(required),
                    true,
                    `missing ${required}`
                );
            }

            const keyTable =
                await all(
                    db,
                    `SELECT name
                     FROM sqlite_master
                     WHERE type = 'table'
                       AND name =
                           'private_journal_keys'`
                );

            assert.equal(
                keyTable.length,
                1
            );

            const legacy =
                await all(
                    db,
                    `SELECT
                        title,
                        content,
                        mood,
                        crypto_version,
                        ciphertext_b64
                     FROM private_journals`
                );

            assert.equal(
                legacy.length,
                1
            );

            assert.equal(
                legacy[0].title,
                'Legacy test title'
            );

            assert.equal(
                legacy[0].content,
                'Legacy test content'
            );

            assert.equal(
                legacy[0].crypto_version,
                null
            );

            assert.equal(
                legacy[0].ciphertext_b64,
                null
            );

            /*
             * Schema installation must be idempotent.
             */
            await Security
                .ensurePrivateJournalSecuritySchema(
                    db
                );

        } finally {
            db.close();
        }
    }
);


test(
    'server Journal routes remain owner-only and new saves accept ciphertext rather than plaintext',
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
                '// NEW JOURNAL API — CLIENT-SIDE ENCRYPTED / OWNER ONLY'
            );

        const end =
            server.indexOf(
                '// NEW PRAYER API (WITH DAILY POINTS)'
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const journalRoutes =
            server.slice(
                start,
                end
            );

        assert.match(
            journalRoutes,
            /\/api\/journals\/:youth_id'[\s\S]*requireAuth/
        );

        assert.match(
            journalRoutes,
            /isCanonicalSelf/
        );

        assert.match(
            journalRoutes,
            /validateEncryptedEntryPayload/
        );

        assert.match(
            journalRoutes,
            /ciphertext_b64/
        );

        assert.match(
            journalRoutes,
            /title = NULL/
        );

        assert.match(
            journalRoutes,
            /content = NULL/
        );

        assert.match(
            journalRoutes,
            /mood = NULL/
        );

        assert.doesNotMatch(
            journalRoutes,
            /req\.body\.title/
        );

        assert.doesNotMatch(
            journalRoutes,
            /req\.body\.content/
        );

        assert.doesNotMatch(
            journalRoutes,
            /req\.body\.mood/
        );

        assert.doesNotMatch(
            journalRoutes,
            /requirePermission\s*\(/
        );

        assert.doesNotMatch(
            journalRoutes,
            /requireAllPermissions\s*\(/
        );
    }
);


test(
    'server never defines an endpoint for uploading a Recovery Key',
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
            /\/api\/[^'"]*recovery-key/i
        );

        assert.doesNotMatch(
            server,
            /\/api\/[^'"]*recovery_key/i
        );

        assert.match(
            server,
            /\/api\/journal-security\/key-envelope/
        );
    }
);
