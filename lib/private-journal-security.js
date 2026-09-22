'use strict';

/*
 * Fire Of God Ministries Community Portal
 * Private Journal server-side storage/security helpers.
 *
 * IMPORTANT:
 * This module NEVER decrypts journal content.
 * The server receives and stores ciphertext only.
 */

const CRYPTO_VERSION = 1;
const ENTRY_ALGORITHM = 'AES-256-GCM';

const GCM_IV_BYTES = 12;
const MASTER_KEY_BYTES = 32;
const GCM_TAG_BYTES = 16;

const WRAPPED_MASTER_KEY_BYTES =
    MASTER_KEY_BYTES + GCM_TAG_BYTES;

const MAX_CIPHERTEXT_BYTES =
    (64 * 1024) + 1024;

const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BASE64URL =
    /^[A-Za-z0-9_-]+$/;

function canonicalPositiveId(value) {
    const number = Number(value);

    return Number.isInteger(number) &&
        number > 0
        ? number
        : null;
}

function decodeBase64Url(value) {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        !BASE64URL.test(value)
    ) {
        throw new TypeError(
            'Invalid Base64URL value.'
        );
    }

    const padding =
        value.length % 4 === 0
            ? ''
            : '='.repeat(
                4 - (value.length % 4)
            );

    return Buffer.from(
        value
            .replace(/-/g, '+')
            .replace(/_/g, '/') +
            padding,
        'base64'
    );
}

function validateExactByteLength(
    value,
    expected,
    label
) {
    const decoded =
        decodeBase64Url(value);

    if (decoded.length !== expected) {
        throw new TypeError(
            `${label} has an invalid length.`
        );
    }

    return value;
}

function rejectPlaintextFields(body) {
    for (const key of [
        'title',
        'content',
        'mood'
    ]) {
        if (
            Object.prototype
                .hasOwnProperty
                .call(body, key)
        ) {
            throw new TypeError(
                'Plaintext journal fields are not accepted.'
            );
        }
    }
}

function containsForbiddenRecoveryMaterial(
    value,
    depth = 0
) {
    if (
        depth > 6 ||
        value === null ||
        value === undefined
    ) {
        return false;
    }

    if (
        typeof value !== 'object'
    ) {
        return false;
    }

    if (Array.isArray(value)) {
        return value.some(
            item =>
                containsForbiddenRecoveryMaterial(
                    item,
                    depth + 1
                )
        );
    }

    for (
        const [key, child]
        of Object.entries(value)
    ) {
        const normalized =
            String(key)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');

        if (
            normalized.includes(
                'recoverykey'
            ) ||
            normalized ===
                'recoverycode' ||
            normalized.includes(
                'journalrecovery'
            ) ||
            normalized ===
                'rawmasterkey' ||
            normalized ===
                'masterkey'
        ) {
            return true;
        }

        if (
            containsForbiddenRecoveryMaterial(
                child,
                depth + 1
            )
        ) {
            return true;
        }
    }

    return false;
}

function validateEncryptedEntryPayload(
    rawBody
) {
    const body =
        rawBody &&
        typeof rawBody === 'object' &&
        !Array.isArray(rawBody)
            ? rawBody
            : {};

    rejectPlaintextFields(body);

    if (
        containsForbiddenRecoveryMaterial(
            body
        )
    ) {
        throw new TypeError(
            'Recovery or plaintext key material must never be sent to the Journal API.'
        );
    }

    const entryUuid =
        typeof body.entry_uuid ===
            'string'
            ? body.entry_uuid
                .trim()
                .toLowerCase()
            : '';

    if (!UUID_V4.test(entryUuid)) {
        throw new TypeError(
            'Invalid encrypted Journal entry identifier.'
        );
    }

    const cryptoVersion =
        Number(body.crypto_version);

    if (
        cryptoVersion !==
        CRYPTO_VERSION
    ) {
        throw new TypeError(
            'Unsupported Journal encryption version.'
        );
    }

    if (
        body.cipher_alg !==
        ENTRY_ALGORITHM
    ) {
        throw new TypeError(
            'Unsupported Journal encryption algorithm.'
        );
    }

    const iv =
        typeof body.iv_b64 ===
            'string'
            ? body.iv_b64.trim()
            : '';

    validateExactByteLength(
        iv,
        GCM_IV_BYTES,
        'Journal IV'
    );

    const ciphertext =
        typeof body.ciphertext_b64 ===
            'string'
            ? body.ciphertext_b64.trim()
            : '';

    const decodedCiphertext =
        decodeBase64Url(ciphertext);

    if (
        decodedCiphertext.length <
            GCM_TAG_BYTES + 1 ||
        decodedCiphertext.length >
            MAX_CIPHERTEXT_BYTES
    ) {
        throw new TypeError(
            'Encrypted Journal content has an invalid size.'
        );
    }

    return Object.freeze({
        entry_uuid:
            entryUuid,
        crypto_version:
            CRYPTO_VERSION,
        cipher_alg:
            ENTRY_ALGORITHM,
        iv_b64:
            iv,
        ciphertext_b64:
            ciphertext
    });
}

function validateEncryptedEntryPayloadWithFingerprint(
    rawBody
) {
    const body =
        rawBody &&
        typeof rawBody === 'object' &&
        !Array.isArray(rawBody)
            ? rawBody
            : {};

    if (
        containsForbiddenRecoveryMaterial(
            body
        )
    ) {
        throw new TypeError(
            'Journal Recovery Key material must never be uploaded.'
        );
    }

    for (
        const field of [
            'title',
            'content',
            'mood'
        ]
    ) {
        if (
            Object.prototype
                .hasOwnProperty
                .call(
                    body,
                    field
                )
        ) {
            throw new TypeError(
                'Plaintext Journal fields must never be uploaded.'
            );
        }
    }

    /*
     * Pass only the established encrypted fields into the
     * original validator. key_fingerprint is authenticated
     * separately as non-secret key identity metadata.
     */
    const encrypted =
        validateEncryptedEntryPayload({
            entry_uuid:
                body.entry_uuid,

            crypto_version:
                body.crypto_version,

            cipher_alg:
                body.cipher_alg,

            iv_b64:
                body.iv_b64,

            ciphertext_b64:
                body.ciphertext_b64
        });

    const fingerprint =
        typeof body.key_fingerprint ===
            'string'
            ? body
                .key_fingerprint
                .trim()
            : '';

    validateExactByteLength(
        fingerprint,
        16,
        'Journal key fingerprint'
    );

    return Object.freeze({
        ...encrypted,

        key_fingerprint:
            fingerprint
    });
}


function validateKeyEnvelopePayload(
    rawBody
) {
    const body =
        rawBody &&
        typeof rawBody === 'object' &&
        !Array.isArray(rawBody)
            ? rawBody
            : {};

    if (
        containsForbiddenRecoveryMaterial(
            body
        )
    ) {
        throw new TypeError(
            'Journal Recovery Key material must never be uploaded.'
        );
    }

    const cryptoVersion =
        Number(body.crypto_version);

    if (
        cryptoVersion !==
        CRYPTO_VERSION
    ) {
        throw new TypeError(
            'Unsupported Journal key version.'
        );
    }

    if (
        body.wrap_alg !==
        ENTRY_ALGORITHM
    ) {
        throw new TypeError(
            'Unsupported Journal key wrapping algorithm.'
        );
    }

    const wrappedKey =
        typeof body.wrapped_key_b64 ===
            'string'
            ? body.wrapped_key_b64.trim()
            : '';

    validateExactByteLength(
        wrappedKey,
        WRAPPED_MASTER_KEY_BYTES,
        'Wrapped Journal Master Key'
    );

    const wrapIv =
        typeof body.wrap_iv_b64 ===
            'string'
            ? body.wrap_iv_b64.trim()
            : '';

    validateExactByteLength(
        wrapIv,
        GCM_IV_BYTES,
        'Journal key wrapping IV'
    );

    const fingerprint =
        typeof body.key_fingerprint ===
            'string'
            ? body.key_fingerprint.trim()
            : '';

    validateExactByteLength(
        fingerprint,
        16,
        'Journal key fingerprint'
    );

    return Object.freeze({
        crypto_version:
            CRYPTO_VERSION,
        wrap_alg:
            ENTRY_ALGORITHM,
        wrapped_key_b64:
            wrappedKey,
        wrap_iv_b64:
            wrapIv,
        key_fingerprint:
            fingerprint
    });
}

function isEncryptedJournalRow(row) {
    return Boolean(
        row &&
        Number(row.crypto_version) ===
            CRYPTO_VERSION &&
        row.cipher_alg ===
            ENTRY_ALGORITHM &&
        row.entry_uuid &&
        row.iv_b64 &&
        row.ciphertext_b64
    );
}

function serializePrivateJournalRow(
    row
) {
    if (!row) return null;

    if (
        isEncryptedJournalRow(row)
    ) {
        /*
         * Do not include title/content/mood at all.
         * Even if legacy columns accidentally still contain
         * values, they are never exposed with an encrypted row.
         */
        return {
            id:
                row.id,
            entry_uuid:
                row.entry_uuid,
            crypto_version:
                Number(
                    row.crypto_version
                ),
            cipher_alg:
                row.cipher_alg,
            iv_b64:
                row.iv_b64,
            ciphertext_b64:
                row.ciphertext_b64,
            created_at:
                row.created_at ||
                null,
            updated_at:
                row.updated_at ||
                null,
            legacy:
                false
        };
    }

    /*
     * Legacy plaintext is temporarily returned ONLY through
     * the already owner-only Journal route, solely so the
     * owner's browser can migrate it to ciphertext.
     */
    return {
        id:
            row.id,
        title:
            typeof row.title ===
                'string'
                ? row.title
                : '',
        content:
            typeof row.content ===
                'string'
                ? row.content
                : '',
        mood:
            typeof row.mood ===
                'string'
                ? row.mood
                : '',
        created_at:
            row.created_at ||
            null,
        legacy:
            true
    };
}

function getJournalAgeBracket(age) {
    const parsed =
        age === null ||
        age === undefined ||
        age === ''
            ? null
            : Number(age);

    if (
        parsed === null ||
        !Number.isInteger(parsed) ||
        parsed < 0
    ) {
        return 'UNKNOWN';
    }

    if (parsed < 10) {
        return 'UNDER_10';
    }

    if (parsed <= 12) {
        return 'AGE_10_12';
    }

    if (parsed <= 17) {
        return 'AGE_13_17';
    }

    return 'AGE_18_PLUS';
}

function enablePrivateJournalSecureDelete(
    database
) {
    if (
        !database ||
        typeof database.run !==
            'function'
    ) {
        return Promise.reject(
            new TypeError(
                'A SQLite database is required.'
            )
        );
    }

    /*
     * secure_delete=ON is intentionally stronger than FAST.
     *
     * Legacy Journal migration removes plaintext from
     * existing SQLite records. With secure_delete enabled
     * before the UPDATE, SQLite overwrites deleted record
     * content rather than leaving old bytes in b-tree free
     * space.
     */
    return new Promise(
        (resolve, reject) => {
            database.run(
                'PRAGMA secure_delete = ON',
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


function readPrivateJournalStorageSecurity(
    database
) {
    if (
        !database ||
        typeof database.get !==
            'function'
    ) {
        return Promise.reject(
            new TypeError(
                'A SQLite database is required.'
            )
        );
    }

    return new Promise(
        (resolve, reject) => {
            database.get(
                `SELECT
                    (
                        SELECT secure_delete
                        FROM pragma_secure_delete
                    ) AS secure_delete,

                    (
                        SELECT journal_mode
                        FROM pragma_journal_mode
                    ) AS journal_mode`,
                (error, row) => {
                    if (error) {
                        reject(error);
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


function truncatePrivateJournalWal(
    database
) {
    if (
        !database ||
        typeof database.get !==
            'function'
    ) {
        return Promise.reject(
            new TypeError(
                'A SQLite database is required.'
            )
        );
    }

    /*
     * This helper is NOT called automatically by normal
     * Journal requests.
     *
     * It is reserved for controlled maintenance after
     * migration/rehearsal because TRUNCATE checkpoints can
     * wait on active readers.
     */
    return new Promise(
        (resolve, reject) => {
            database.get(
                'PRAGMA wal_checkpoint(TRUNCATE)',
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    const values =
                        row
                            ? Object.values(row)
                            : [];

                    const busy =
                        values.length
                            ? Number(
                                values[0]
                            )
                            : 0;

                    if (busy !== 0) {
                        const checkpointError =
                            new Error(
                                'SQLite WAL truncate checkpoint was busy.'
                            );

                        checkpointError.code =
                            'JOURNAL_WAL_CHECKPOINT_BUSY';

                        reject(
                            checkpointError
                        );

                        return;
                    }

                    resolve(
                        row || {}
                    );
                }
            );
        }
    );
}


function ensurePrivateJournalSecuritySchema(
    database
) {
    if (
        !database ||
        typeof database.run !==
            'function' ||
        typeof database.serialize !==
            'function'
    ) {
        return Promise.reject(
            new TypeError(
                'A SQLite database is required.'
            )
        );
    }

    const statements = [
        `
        PRAGMA secure_delete = ON
        `,
        `
        CREATE TABLE IF NOT EXISTS private_journal_keys (
            youth_id INTEGER PRIMARY KEY,
            crypto_version INTEGER NOT NULL,
            wrap_alg TEXT NOT NULL,
            wrapped_key_b64 TEXT NOT NULL,
            wrap_iv_b64 TEXT NOT NULL,
            key_fingerprint TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        )
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN entry_uuid TEXT
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN crypto_version INTEGER
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN cipher_alg TEXT
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN iv_b64 TEXT
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN ciphertext_b64 TEXT
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN key_fingerprint TEXT
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN encrypted_at DATETIME
        `,
        `
        ALTER TABLE private_journals
        ADD COLUMN updated_at DATETIME
        `,
        `
        CREATE UNIQUE INDEX IF NOT EXISTS
        private_journals_entry_uuid_uq
        ON private_journals(entry_uuid)
        WHERE entry_uuid IS NOT NULL
        `,
        `
        CREATE INDEX IF NOT EXISTS
        private_journals_owner_crypto_idx
        ON private_journals(
            youth_id,
            crypto_version,
            created_at DESC
        )
        `
    ];

    return new Promise(
        (resolve, reject) => {
            let remaining =
                statements.length;

            let firstError =
                null;

            database.serialize(
                () => {
                    for (
                        const statement
                        of statements
                    ) {
                        database.run(
                            statement,
                            error => {
                                if (
                                    error &&
                                    !/duplicate column name/i
                                        .test(
                                            String(
                                                error.message ||
                                                error
                                            )
                                        )
                                ) {
                                    firstError =
                                        firstError ||
                                        error;
                                }

                                remaining -= 1;

                                if (
                                    remaining ===
                                    0
                                ) {
                                    if (
                                        firstError
                                    ) {
                                        reject(
                                            firstError
                                        );
                                    } else {
                                        resolve();
                                    }
                                }
                            }
                        );
                    }
                }
            );
        }
    );
}


function resetPrivateJournalForOwner(
    database,
    youthId
) {
    if (
        !database ||
        typeof database.exec !== 'function' ||
        typeof database.run !== 'function'
    ) {
        return Promise.reject(
            new TypeError(
                'A SQLite database is required.'
            )
        );
    }

    const canonicalYouthId =
        canonicalPositiveId(
            youthId
        );

    if (!canonicalYouthId) {
        return Promise.reject(
            new TypeError(
                'A valid Journal owner is required.'
            )
        );
    }

    /*
     * This is the intentionally destructive recovery path used
     * only when the owner has lost BOTH:
     *
     *   1. every trusted-device Journal key, and
     *   2. their Recovery Key.
     *
     * The old Journal Master Key is NOT replaced in place.
     * Instead, all records tied to the old Journal identity are
     * removed atomically. The member must then complete the
     * current safeguarding flow again before a new key can be
     * established.
     *
     * No Recovery Key, plaintext Journal content, or encryption
     * key is accepted by this function.
     */

    const owner =
        String(
            canonicalYouthId
        );

    const sql = `
        PRAGMA secure_delete = ON;

        BEGIN IMMEDIATE;

        DELETE FROM
            private_journal_guardian_verifications
        WHERE authorization_id IN (
            SELECT id
            FROM private_journal_guardian_authorizations
            WHERE youth_id = ${owner}
        );

        DELETE FROM
            private_journal_guardian_authorizations
        WHERE youth_id = ${owner};

        DELETE FROM
            private_journal_responsible_acknowledgements
        WHERE youth_id = ${owner};

        DELETE FROM
            private_journals
        WHERE youth_id = ${owner};

        DELETE FROM
            private_journal_keys
        WHERE youth_id = ${owner};

        COMMIT;
    `;

    return new Promise(
        (resolve, reject) => {
            database.exec(
                sql,
                error => {
                    if (!error) {
                        resolve(
                            Object.freeze({
                                success:
                                    true,

                                youth_id:
                                    canonicalYouthId
                            })
                        );

                        return;
                    }

                    /*
                     * If BEGIN succeeded but a later statement
                     * failed, release the transaction before
                     * reporting the original error.
                     */
                    database.run(
                        'ROLLBACK',
                        () => reject(error)
                    );
                }
            );
        }
    );
}


module.exports = Object.freeze({
    CRYPTO_VERSION,
    ENTRY_ALGORITHM,

    canonicalPositiveId,
    containsForbiddenRecoveryMaterial,

    validateEncryptedEntryPayload,
    validateEncryptedEntryPayloadWithFingerprint,
    validateKeyEnvelopePayload,

    isEncryptedJournalRow,
    serializePrivateJournalRow,

    getJournalAgeBracket,

    enablePrivateJournalSecureDelete,
    readPrivateJournalStorageSecurity,
    truncatePrivateJournalWal,

    ensurePrivateJournalSecuritySchema,
    resetPrivateJournalForOwner
});
