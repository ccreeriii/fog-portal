'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const JournalCrypto =
    require(
        '../public/js/journal-crypto.js'
    );

const OWNER_ID = 42;

const ENTRY = {
    title:
        'A private prayer',
    mood:
        'Hopeful',
    content:
        'This is intentionally sensitive test text and must never appear in ciphertext.'
};

async function makeSetup() {
    return JournalCrypto
        .createJournalSetup(
            OWNER_ID
        );
}

test(
    'Journal setup creates a non-extractable 256-bit working key and separate recovery code',
    async () => {
        const setup =
            await makeSetup();

        assert.equal(
            setup.masterKey.type,
            'secret'
        );

        assert.equal(
            setup.masterKey.extractable,
            false
        );

        assert.equal(
            setup.masterKey
                .algorithm
                .name,
            'AES-GCM'
        );

        assert.match(
            setup.recoveryCode,
            /^FOG-JR1-[A-Za-z0-9_-]+$/
        );

        assert.equal(
            setup.envelope
                .crypto_version,
            1
        );

        assert.equal(
            setup.envelope
                .wrap_alg,
            'AES-256-GCM'
        );

        assert.ok(
            setup.envelope
                .wrapped_key_b64
        );

        assert.ok(
            setup.envelope
                .wrap_iv_b64
        );

        assert.ok(
            setup.envelope
                .key_fingerprint
        );

        const serialized =
            JSON.stringify(
                setup.envelope
            );

        assert.equal(
            serialized.includes(
                setup.recoveryCode
            ),
            false
        );
    }
);


test(
    'Journal entry encrypts title, mood, and content before transmission',
    async () => {
        const setup =
            await makeSetup();

        const entryUuid =
            JournalCrypto
                .createEntryUuid();

        const encrypted =
            await JournalCrypto
                .encryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    {
                        entryUuid,
                        ...ENTRY
                    }
                );

        assert.equal(
            encrypted.entry_uuid,
            entryUuid
        );

        assert.equal(
            encrypted.crypto_version,
            1
        );

        assert.equal(
            encrypted.cipher_alg,
            'AES-256-GCM'
        );

        const serialized =
            JSON.stringify(
                encrypted
            );

        assert.equal(
            serialized.includes(
                ENTRY.title
            ),
            false
        );

        assert.equal(
            serialized.includes(
                ENTRY.mood
            ),
            false
        );

        assert.equal(
            serialized.includes(
                ENTRY.content
            ),
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    encrypted,
                    'title'
                ),
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    encrypted,
                    'content'
                ),
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    encrypted,
                    'mood'
                ),
            false
        );
    }
);


test(
    'encrypted Journal entry decrypts only with the correct member key and owner identity',
    async () => {
        const setup =
            await makeSetup();

        const entryUuid =
            JournalCrypto
                .createEntryUuid();

        const encrypted =
            await JournalCrypto
                .encryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    {
                        entryUuid,
                        ...ENTRY
                    }
                );

        const decrypted =
            await JournalCrypto
                .decryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    encrypted
                );

        assert.equal(
            decrypted.title,
            ENTRY.title
        );

        assert.equal(
            decrypted.mood,
            ENTRY.mood
        );

        assert.equal(
            decrypted.content,
            ENTRY.content
        );

        await assert.rejects(
            JournalCrypto
                .decryptEntry(
                    OWNER_ID + 1,
                    setup.masterKey,
                    encrypted
                ),
            /could not be decrypted|changed/i
        );
    }
);


test(
    'AES-GCM produces different ciphertext for repeated encryption of the same Journal entry',
    async () => {
        const setup =
            await makeSetup();

        const entryUuid =
            JournalCrypto
                .createEntryUuid();

        const first =
            await JournalCrypto
                .encryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    {
                        entryUuid,
                        ...ENTRY
                    }
                );

        const second =
            await JournalCrypto
                .encryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    {
                        entryUuid,
                        ...ENTRY
                    }
                );

        assert.notEqual(
            first.iv_b64,
            second.iv_b64
        );

        assert.notEqual(
            first.ciphertext_b64,
            second.ciphertext_b64
        );
    }
);


test(
    'tampering with encrypted Journal data is detected',
    async () => {
        const setup =
            await makeSetup();

        const encrypted =
            await JournalCrypto
                .encryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    {
                        entryUuid:
                            JournalCrypto
                                .createEntryUuid(),
                        ...ENTRY
                    }
                );

        const bytes =
            JournalCrypto
                ._testing
                .base64UrlToBytes(
                    encrypted
                        .ciphertext_b64
                );

        bytes[0] ^= 0x01;

        const tampered = {
            ...encrypted,
            ciphertext_b64:
                JournalCrypto
                    ._testing
                    .bytesToBase64Url(
                        bytes
                    )
        };

        await assert.rejects(
            JournalCrypto
                .decryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    tampered
                ),
            /could not be decrypted|changed/i
        );
    }
);


test(
    'Recovery Key restores the Journal Master Key on another device',
    async () => {
        const setup =
            await makeSetup();

        const encrypted =
            await JournalCrypto
                .encryptEntry(
                    OWNER_ID,
                    setup.masterKey,
                    {
                        entryUuid:
                            JournalCrypto
                                .createEntryUuid(),
                        ...ENTRY
                    }
                );

        const recovered =
            await JournalCrypto
                .recoverMasterKey(
                    OWNER_ID,
                    setup.recoveryCode,
                    setup.envelope
                );

        assert.equal(
            recovered.masterKey
                .extractable,
            false
        );

        assert.equal(
            recovered
                .keyFingerprint,
            setup.envelope
                .key_fingerprint
        );

        const decrypted =
            await JournalCrypto
                .decryptEntry(
                    OWNER_ID,
                    recovered.masterKey,
                    encrypted
                );

        assert.equal(
            decrypted.content,
            ENTRY.content
        );
    }
);


test(
    'incorrect Recovery Key cannot recover another Journal',
    async () => {
        const first =
            await makeSetup();

        const second =
            await makeSetup();

        await assert.rejects(
            JournalCrypto
                .recoverMasterKey(
                    OWNER_ID,
                    second.recoveryCode,
                    first.envelope
                ),
            /incorrect|changed|match/i
        );
    }
);


test(
    'Recovery Key is bound to its Journal owner',
    async () => {
        const setup =
            await makeSetup();

        await assert.rejects(
            JournalCrypto
                .recoverMasterKey(
                    OWNER_ID + 1,
                    setup.recoveryCode,
                    setup.envelope
                ),
            /incorrect|changed|match/i
        );
    }
);


test(
    'Journal crypto source contains no localStorage key persistence',
    () => {
        const fs =
            require('node:fs');

        const source =
            fs.readFileSync(
                require('node:path')
                    .join(
                        __dirname,
                        '..',
                        'public',
                        'js',
                        'journal-crypto.js'
                    ),
                'utf8'
            );

        assert.equal(
            /localStorage\.setItem/i
                .test(source),
            false
        );

        assert.equal(
            /sessionStorage\.setItem/i
                .test(source),
            false
        );

        assert.match(
            source,
            /indexedDB/i
        );

        assert.match(
            source,
            /AES-GCM/
        );
    }
);
