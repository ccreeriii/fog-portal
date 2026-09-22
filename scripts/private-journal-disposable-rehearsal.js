'use strict';

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const sqlite3 =
    require('sqlite3');

const Security =
    require(
        '../lib/private-journal-security'
    );

const Safeguarding =
    require(
        '../lib/private-journal-safeguarding'
    );

const JournalCrypto =
    require(
        '../public/js/journal-crypto.js'
    );


const dbPath =
    process.argv[2];

if (!dbPath) {
    throw new Error(
        'Disposable rehearsal database path is required.'
    );
}


const ids = Object.freeze({
    adult:
        900001,

    teen:
        900002,

    youth:
        900003,

    under10:
        900004,

    unknown:
        900005,

    guardian:
        900006
});


const sentinels =
    Object.freeze({
        adultTitle:
            'FOG_REHEARSAL_ADULT_TITLE_8c13f2',

        adultMood:
            'FOG_REHEARSAL_ADULT_MOOD_4ed921',

        adultContent:
            'FOG_REHEARSAL_ADULT_CONTENT_a7c519_' +
            'Synthetic private reflection only.',

        teenTitle:
            'FOG_REHEARSAL_TEEN_TITLE_72b34d',

        teenMood:
            'FOG_REHEARSAL_TEEN_MOOD_e45ad2',

        teenContent:
            'FOG_REHEARSAL_TEEN_CONTENT_90fd38_' +
            'Synthetic teen reflection only.',

        youthTitle:
            'FOG_REHEARSAL_YOUTH_TITLE_d91c28',

        youthMood:
            'FOG_REHEARSAL_YOUTH_MOOD_812ffa',

        youthContent:
            'FOG_REHEARSAL_YOUTH_CONTENT_1810bc_' +
            'Synthetic youth reflection only.'
    });


function fixedNow() {
    return new Date(
        '2026-09-21T08:00:00.000Z'
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
                        resolve(
                            row || null
                        );
                    }
                }
            );
        }
    );
}


function all(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.all(
                sql,
                params,
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


function getSetupEnvelope(
    setup
) {
    const envelope =
        setup &&
        (
            setup.envelope ||
            setup.keyEnvelope ||
            setup.key_envelope
        );

    if (!envelope) {
        throw new Error(
            'Journal setup did not return a key envelope.'
        );
    }

    return envelope;
}


function getRecoverySecret(
    setup
) {
    const recovery =
        setup &&
        (
            setup.recoveryKey ||
            setup.recoveryCode ||
            setup.recovery_key ||
            setup.recovery_code
        );

    if (
        typeof recovery !==
            'string' ||
        !recovery
    ) {
        throw new Error(
            'Journal setup did not return a Recovery Key.'
        );
    }

    return recovery;
}


async function recoverMasterKey(
    ownerId,
    setup
) {
    const recovery =
        getRecoverySecret(
            setup
        );

    const envelope =
        getSetupEnvelope(
            setup
        );

    /*
     * JournalCrypto.recoverMasterKey() deliberately returns
     * recovery metadata together with the restored working
     * key. The application uses the contained CryptoKey,
     * not the wrapper object itself.
     */
    const recovered =
        await JournalCrypto
            .recoverMasterKey(
                ownerId,
                recovery,
                envelope
            );

    const masterKey =
        recovered &&
        recovered.masterKey
            ? recovered.masterKey
            : (
                recovered &&
                recovered.key
                    ? recovered.key
                    : recovered
            );

    if (
        !masterKey ||
        typeof masterKey !==
            'object' ||
        masterKey.type !==
            'secret'
    ) {
        throw new Error(
            'Recovered Journal result did not contain a usable master key.'
        );
    }

    /*
     * If recovery metadata exposes the fingerprint, confirm
     * it still matches the server-storable envelope.
     */
    const recoveredFingerprint =
        recovered &&
        typeof recovered ===
            'object'
            ? (
                recovered.fingerprint ||
                recovered.keyFingerprint ||
                recovered.key_fingerprint ||
                null
            )
            : null;

    if (
        recoveredFingerprint &&
        envelope.key_fingerprint &&
        recoveredFingerprint !==
            envelope.key_fingerprint
    ) {
        throw new Error(
            'Recovered Journal key fingerprint does not match the envelope.'
        );
    }

    return masterKey;
}


async function saveKeyEnvelope(
    database,
    ownerId,
    setup
) {
    const rawEnvelope =
        getSetupEnvelope(
            setup
        );

    const envelope =
        Security
            .validateKeyEnvelopePayload(
                rawEnvelope
            );

    await run(
        database,
        `
        INSERT INTO private_journal_keys (
            youth_id,
            crypto_version,
            wrap_alg,
            wrapped_key_b64,
            wrap_iv_b64,
            key_fingerprint,
            created_at,
            updated_at
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            ?
        )
        `,
        [
            ownerId,

            envelope
                .crypto_version,

            envelope
                .wrap_alg,

            envelope
                .wrapped_key_b64,

            envelope
                .wrap_iv_b64,

            envelope
                .key_fingerprint,

            '2026-09-21 16:00:00',

            '2026-09-21 16:00:00'
        ]
    );

    return envelope;
}


async function createSyntheticJournalSetup(
    database,
    ownerId
) {
    const setup =
        await JournalCrypto
            .createJournalSetup(
                ownerId
            );

    await saveKeyEnvelope(
        database,
        ownerId,
        setup
    );

    return setup;
}


async function migrateLegacyEntry(
    database,
    {
        ownerId,
        rowId,
        title,
        mood,
        content
    }
) {
    const setup =
        await createSyntheticJournalSetup(
            database,
            ownerId
        );

    const entryUuid =
        JournalCrypto
            .createEntryUuid();

    const encrypted =
        await JournalCrypto
            .encryptEntry(
                ownerId,
                setup.masterKey,
                {
                    entryUuid,
                    title,
                    mood,
                    content
                }
            );

    const result =
        await run(
            database,
            `
            UPDATE private_journals
            SET
                entry_uuid = ?,
                crypto_version = ?,
                cipher_alg = ?,
                iv_b64 = ?,
                ciphertext_b64 = ?,
                key_fingerprint = ?,
                encrypted_at = ?,
                updated_at = ?,
                title = NULL,
                content = NULL,
                mood = NULL

            WHERE
                id = ?
                AND youth_id = ?
                AND (
                    crypto_version IS NULL
                    OR ciphertext_b64 IS NULL
                )
            `,
            [
                encrypted
                    .entry_uuid,

                encrypted
                    .crypto_version,

                encrypted
                    .cipher_alg,

                encrypted
                    .iv_b64,

                encrypted
                    .ciphertext_b64,

                setup.envelope
                    .key_fingerprint,

                '2026-09-21 16:01:00',

                '2026-09-21 16:01:00',

                rowId,

                ownerId
            ]
        );

    assert.equal(
        result.changes,
        1,
        'legacy migration must update exactly one row'
    );

    const row =
        await get(
            database,
            `
            SELECT *
            FROM private_journals
            WHERE id = ?
              AND youth_id = ?
            `,
            [
                rowId,
                ownerId
            ]
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

    assert.equal(
        row.key_fingerprint,
        setup.envelope
            .key_fingerprint
    );

    const serialized =
        Security
            .serializePrivateJournalRow(
                row
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

    const decrypted =
        await JournalCrypto
            .decryptEntry(
                ownerId,
                setup.masterKey,
                row
            );

    assert.equal(
        decrypted.title,
        title
    );

    assert.equal(
        decrypted.mood,
        mood
    );

    assert.equal(
        decrypted.content,
        content
    );

    return {
        setup,
        row
    };
}


function tamperCiphertext(
    ciphertext
) {
    const bytes =
        Buffer.from(
            ciphertext,
            'base64url'
        );

    if (!bytes.length) {
        throw new Error(
            'Ciphertext is unexpectedly empty.'
        );
    }

    bytes[0] =
        bytes[0] ^ 0x01;

    return bytes.toString(
        'base64url'
    );
}


async function main() {
    const database =
        new sqlite3.Database(
            dbPath
        );

    try {
        await run(
            database,
            'PRAGMA journal_mode = WAL'
        );

        /*
         * Confirm the schema-only clone really started
         * empty before adding synthetic rehearsal data.
         */
        for (
            const table of [
                'youth',
                'private_journals',
                'point_transactions',
                'app_settings'
            ]
        ) {
            const row =
                await get(
                    database,
                    `SELECT COUNT(*) AS total FROM ${table}`
                );

            assert.equal(
                Number(
                    row.total
                ),
                0,
                `${table} must begin empty`
            );
        }


        console.log(
            'PASS: Disposable Production-schema clone contains no Production rows.'
        );


        /*
         * -------------------------------------------------
         * Synthetic members only.
         * -------------------------------------------------
         */

        const people = [
            [
                ids.adult,
                'Synthetic Adult',
                36,
                '1990-01-10'
            ],

            [
                ids.teen,
                'Synthetic Teen',
                14,
                '2012-01-10'
            ],

            [
                ids.youth,
                'Synthetic Youth',
                11,
                '2015-01-10'
            ],

            [
                ids.under10,
                'Synthetic Child',
                8,
                '2018-01-10'
            ],

            [
                ids.unknown,
                'Synthetic Unknown',
                null,
                null
            ],

            [
                ids.guardian,
                'Synthetic Guardian',
                41,
                '1985-01-10'
            ]
        ];

        for (
            const person of people
        ) {
            const normalized =
                person.map(
                    value =>
                        value ===
                            undefined
                            ? null
                            : value
                );

            await run(
                database,
                `
                INSERT INTO youth (
                    id,
                    name,
                    age,
                    birthday
                )
                VALUES (?, ?, ?, ?)
                `,
                normalized
            );
        }


        /*
         * JavaScript has no Python None. Correct the two
         * intended NULL values explicitly.
         */
        await run(
            database,
            `
            UPDATE youth
            SET
                age = NULL,
                birthday = NULL
            WHERE id = ?
            `,
            [
                ids.unknown
            ]
        );


        await run(
            database,
            `
            INSERT OR REPLACE INTO app_settings (
                key,
                value
            )
            VALUES (
                'journal_points',
                '10'
            )
            `
        );


        /*
         * Insert legacy plaintext BEFORE schema upgrade to
         * model the existing Production Journal shape.
         */
        const adultInsert =
            await run(
                database,
                `
                INSERT INTO private_journals (
                    youth_id,
                    title,
                    content,
                    mood,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    ids.adult,
                    sentinels
                        .adultTitle,
                    sentinels
                        .adultContent,
                    sentinels
                        .adultMood,
                    '2026-09-20 18:00:00'
                ]
            );

        const teenInsert =
            await run(
                database,
                `
                INSERT INTO private_journals (
                    youth_id,
                    title,
                    content,
                    mood,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    ids.teen,
                    sentinels
                        .teenTitle,
                    sentinels
                        .teenContent,
                    sentinels
                        .teenMood,
                    '2026-09-20 18:05:00'
                ]
            );


        /*
         * Force pre-migration plaintext into the main
         * disposable DB so secure deletion is tested under
         * a deliberately difficult condition.
         */
        await Security
            .truncatePrivateJournalWal(
                database
            );


        /*
         * -------------------------------------------------
         * Apply real Journal schema upgrades.
         * -------------------------------------------------
         */

        await Security
            .ensurePrivateJournalSecuritySchema(
                database
            );

        await Safeguarding
            .ensurePrivateJournalSafeguardingSchema(
                database
            );

        const storage =
            await Security
                .readPrivateJournalStorageSecurity(
                    database
                );

        assert.equal(
            Number(
                storage
                    .secure_delete
            ),
            1
        );

        console.log(
            'PASS: Journal security + safeguarding schemas upgrade Production-compatible legacy schema.'
        );


        /*
         * -------------------------------------------------
         * Age / safeguarding decisions.
         * -------------------------------------------------
         */

        const now =
            fixedNow();

        const adultAccess =
            await Safeguarding
                .getPrivateJournalAccessState(
                    database,
                    ids.adult,
                    now
                );

        assert.equal(
            adultAccess
                .access_allowed,
            true
        );

        assert.equal(
            adultAccess
                .experience_mode,
            'private_journal'
        );


        let teenAccess =
            await Safeguarding
                .getPrivateJournalAccessState(
                    database,
                    ids.teen,
                    now
                );

        assert.equal(
            teenAccess
                .access_allowed,
            false
        );

        assert.equal(
            teenAccess
                .reason,
            'guardian_authorization_required'
        );


        let youthAccess =
            await Safeguarding
                .getPrivateJournalAccessState(
                    database,
                    ids.youth,
                    now
                );

        assert.equal(
            youthAccess
                .access_allowed,
            false
        );

        assert.equal(
            youthAccess
                .experience_mode,
            'youth_reflection'
        );


        const under10Access =
            await Safeguarding
                .getPrivateJournalAccessState(
                    database,
                    ids.under10,
                    now
                );

        assert.equal(
            under10Access
                .access_allowed,
            false
        );

        assert.equal(
            under10Access
                .reason,
            'under_10'
        );


        const unknownAccess =
            await Safeguarding
                .getPrivateJournalAccessState(
                    database,
                    ids.unknown,
                    now
                );

        assert.equal(
            unknownAccess
                .access_allowed,
            false
        );

        assert.equal(
            unknownAccess
                .reason,
            'birthday_required'
        );


        console.log(
            'PASS: Adult / teen / 10-12 / under-10 / unknown-age safeguards behave correctly.'
        );


        /*
         * -------------------------------------------------
         * Teen guardian authorization.
         * -------------------------------------------------
         */

        const teenRequest =
            await Safeguarding
                .requestGuardianAuthorization(
                    database,
                    {
                        youthId:
                            ids.teen,

                        youthAcknowledged:
                            true,

                        now
                    }
                );

        await Safeguarding
            .approveGuardianAuthorization(
                database,
                {
                    token:
                        teenRequest
                            .approval_token,

                    guardianYouthId:
                        ids.guardian,

                    relationship:
                        'parent',

                    guardianAttested:
                        true,

                    now:
                        new Date(
                            now.getTime() +
                            60_000
                        )
                }
            );

        teenAccess =
            await Safeguarding
                .getPrivateJournalAccessState(
                    database,
                    ids.teen,
                    new Date(
                        now.getTime() +
                        120_000
                    )
                );

        assert.equal(
            teenAccess
                .access_allowed,
            true
        );

        assert.equal(
            teenAccess
                .experience_mode,
            'private_journal'
        );


        /*
         * -------------------------------------------------
         * Ages 10-12 guardian authorization.
         * -------------------------------------------------
         */

        const youthRequest =
            await Safeguarding
                .requestGuardianAuthorization(
                    database,
                    {
                        youthId:
                            ids.youth,

                        youthAcknowledged:
                            true,

                        now
                    }
                );

        await Safeguarding
            .approveGuardianAuthorization(
                database,
                {
                    token:
                        youthRequest
                            .approval_token,

                    guardianYouthId:
                        ids.guardian,

                    relationship:
                        'legal_guardian',

                    guardianAttested:
                        true,

                    now:
                        new Date(
                            now.getTime() +
                            60_000
                        )
                }
            );

        youthAccess =
            await Safeguarding
                .getPrivateJournalAccessState(
                    database,
                    ids.youth,
                    new Date(
                        now.getTime() +
                        120_000
                    )
                );

        assert.equal(
            youthAccess
                .access_allowed,
            true
        );

        assert.equal(
            youthAccess
                .experience_mode,
            'youth_reflection'
        );


        console.log(
            'PASS: Guardian authorization unlocks correct teen and Youth Reflection modes.'
        );


        /*
         * -------------------------------------------------
         * Adult legacy migration.
         * -------------------------------------------------
         */

        const adultMigration =
            await migrateLegacyEntry(
                database,
                {
                    ownerId:
                        ids.adult,

                    rowId:
                        adultInsert
                            .lastID,

                    title:
                        sentinels
                            .adultTitle,

                    mood:
                        sentinels
                            .adultMood,

                    content:
                        sentinels
                            .adultContent
                }
            );


        /*
         * Recovery Key / new-device rehearsal.
         */
        const recoveredAdultKey =
            await recoverMasterKey(
                ids.adult,
                adultMigration
                    .setup
            );

        const recoveredAdultEntry =
            await JournalCrypto
                .decryptEntry(
                    ids.adult,
                    recoveredAdultKey,
                    adultMigration
                        .row
                );

        assert.equal(
            recoveredAdultEntry
                .content,
            sentinels
                .adultContent
        );


        /*
         * Ciphertext tampering must fail authentication.
         */
        const tamperedAdultRow = {
            ...adultMigration
                .row,

            ciphertext_b64:
                tamperCiphertext(
                    adultMigration
                        .row
                        .ciphertext_b64
                )
        };

        await assert.rejects(
            JournalCrypto
                .decryptEntry(
                    ids.adult,
                    adultMigration
                        .setup
                        .masterKey,
                    tamperedAdultRow
                )
        );


        console.log(
            'PASS: Adult legacy migration, Recovery Key restoration, and tamper detection succeed.'
        );


        /*
         * -------------------------------------------------
         * Teen legacy migration after guardian approval.
         * -------------------------------------------------
         */

        await migrateLegacyEntry(
            database,
            {
                ownerId:
                    ids.teen,

                rowId:
                    teenInsert
                        .lastID,

                title:
                    sentinels
                        .teenTitle,

                mood:
                    sentinels
                        .teenMood,

                content:
                    sentinels
                        .teenContent
            }
        );

        console.log(
            'PASS: Authorized teen legacy Journal migrates to ciphertext.'
        );


        /*
         * -------------------------------------------------
         * Ages 10-12 use identical encryption underneath
         * the simpler Youth Reflection UI.
         * -------------------------------------------------
         */

        const youthSetup =
            await createSyntheticJournalSetup(
                database,
                ids.youth
            );

        const youthEncrypted =
            await JournalCrypto
                .encryptEntry(
                    ids.youth,
                    youthSetup.masterKey,
                    {
                        entryUuid:
                            JournalCrypto
                                .createEntryUuid(),

                        title:
                            sentinels
                                .youthTitle,

                        mood:
                            sentinels
                                .youthMood,

                        content:
                            sentinels
                                .youthContent
                    }
                );

        const youthInsert =
            await run(
                database,
                `
                INSERT INTO private_journals (
                    youth_id,
                    title,
                    content,
                    mood,
                    created_at,

                    entry_uuid,
                    crypto_version,
                    cipher_alg,
                    iv_b64,
                    ciphertext_b64,
                    key_fingerprint,
                    encrypted_at,
                    updated_at
                )
                VALUES (
                    ?,
                    NULL,
                    NULL,
                    NULL,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                `,
                [
                    ids.youth,

                    '2026-09-21 16:15:00',

                    youthEncrypted
                        .entry_uuid,

                    youthEncrypted
                        .crypto_version,

                    youthEncrypted
                        .cipher_alg,

                    youthEncrypted
                        .iv_b64,

                    youthEncrypted
                        .ciphertext_b64,

                    youthSetup.envelope
                        .key_fingerprint,

                    '2026-09-21 16:15:00',

                    '2026-09-21 16:15:00'
                ]
            );

        const youthRow =
            await get(
                database,
                `
                SELECT *
                FROM private_journals
                WHERE id = ?
                `,
                [
                    youthInsert
                        .lastID
                ]
            );

        assert.equal(
            youthRow.title,
            null
        );

        assert.equal(
            youthRow.content,
            null
        );

        assert.equal(
            youthRow.mood,
            null
        );

        assert.equal(
            youthRow.key_fingerprint,
            youthSetup.envelope
                .key_fingerprint
        );

        const youthDecrypted =
            await JournalCrypto
                .decryptEntry(
                    ids.youth,
                    youthSetup.masterKey,
                    youthRow
                );

        assert.equal(
            youthDecrypted
                .content,
            sentinels
                .youthContent
        );


        console.log(
            'PASS: Youth Reflection uses the same ciphertext-only storage model.'
        );


        /*
         * -------------------------------------------------
         * Final logical database inspection.
         * -------------------------------------------------
         */

        const rows =
            await all(
                database,
                `
                SELECT
                    id,
                    youth_id,
                    title,
                    content,
                    mood,
                    crypto_version,
                    cipher_alg,
                    ciphertext_b64,
                    key_fingerprint

                FROM private_journals

                ORDER BY id
                `
            );

        assert.equal(
            rows.length,
            3
        );

        for (
            const row of rows
        ) {
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

            assert.equal(
                Number(
                    row.crypto_version
                ),
                1
            );

            assert.equal(
                row.cipher_alg,
                'AES-256-GCM'
            );

            assert.ok(
                row.ciphertext_b64
            );

            assert.ok(
                row.key_fingerprint
            );
        }


        /*
         * No journal words may appear in point records.
         * This rehearsal does not award points based on
         * content.
         */
        const pointRows =
            await all(
                database,
                `
                SELECT *
                FROM point_transactions
                `
            );

        const pointDump =
            JSON.stringify(
                pointRows
            );

        for (
            const value of
            Object.values(
                sentinels
            )
        ) {
            assert.equal(
                pointDump.includes(
                    value
                ),
                false
            );
        }


        console.log(
            'PASS: All synthetic Journal rows are ciphertext-only; no Journal words leaked into point records.'
        );


        /*
         * Flush and truncate WAL after sensitive migration.
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


    /*
     * -----------------------------------------------------
     * Forensic byte scan after DB close.
     * -----------------------------------------------------
     */

    const files = [
        dbPath,
        `${dbPath}-wal`,
        `${dbPath}-shm`
    ];

    for (
        const filename of files
    ) {
        if (
            !fs.existsSync(
                filename
            )
        ) {
            continue;
        }

        const bytes =
            fs.readFileSync(
                filename
            );

        for (
            const sentinel of
            Object.values(
                sentinels
            )
        ) {
            assert.equal(
                bytes.includes(
                    Buffer.from(
                        sentinel,
                        'utf8'
                    )
                ),
                false,
                `plaintext trace found in ${filename}`
            );
        }
    }


    console.log(
        'PASS: Synthetic Journal plaintext absent from disposable DB/WAL/SHM byte scan.'
    );

    console.log(
        'PASS: DISPOSABLE PRIVATE JOURNAL INTEGRATION REHEARSAL COMPLETE.'
    );
}


main()
    .catch(
        error => {
            console.error(
                'REHEARSAL FAILED:',
                error &&
                error.message
                    ? error.message
                    : 'Unknown error'
            );

            process.exitCode =
                1;
        }
    );
