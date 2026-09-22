/*
 * Fire Of God Ministries Community Portal
 * Private Journal Client-Side Cryptography
 *
 * SECURITY MODEL
 * --------------
 * - Journal plaintext is encrypted in the browser before transmission.
 * - AES-256-GCM provides confidentiality and integrity.
 * - A fresh 96-bit IV is generated for every encryption.
 * - The Journal Master Key is independent from login/session credentials.
 * - Device copies of the working key are stored as non-extractable
 *   CryptoKey objects in IndexedDB.
 * - A separate random Recovery Key protects a wrapped copy of the
 *   Journal Master Key.
 * - The server must never receive the Recovery Key or plaintext
 *   Journal Master Key.
 *
 * This module intentionally has NO localStorage fallback for keys.
 */

(function initializeJournalCrypto(root, factory) {
    const api = factory(root);

    if (
        typeof module === 'object' &&
        module &&
        module.exports
    ) {
        module.exports = api;
    }

    if (root && typeof root === 'object') {
        root.FOGJournalCrypto = api;
    }
})(
    typeof globalThis !== 'undefined'
        ? globalThis
        : this,
    function journalCryptoFactory(root) {
        'use strict';

        const CRYPTO_VERSION = 1;
        const ENTRY_FORMAT = 'fog-private-journal-entry-v1';
        const ENTRY_ALGORITHM = 'AES-256-GCM';

        const RECOVERY_PREFIX = 'FOG-JR1-';

        const KEY_DB_NAME =
            'fog-private-journal-keys';

        const KEY_DB_VERSION = 1;

        const KEY_STORE_NAME =
            'journal_keys';

        const MASTER_KEY_BYTES = 32;
        const RECOVERY_KEY_BYTES = 32;
        const GCM_IV_BYTES = 12;

        const MAX_PLAINTEXT_BYTES =
            64 * 1024;

        function getCrypto() {
            if (
                root &&
                root.crypto &&
                root.crypto.subtle &&
                typeof root.crypto.getRandomValues ===
                    'function'
            ) {
                return root.crypto;
            }

            if (
                typeof require === 'function'
            ) {
                try {
                    const nodeCrypto =
                        require('node:crypto');

                    if (
                        nodeCrypto.webcrypto &&
                        nodeCrypto.webcrypto.subtle
                    ) {
                        return nodeCrypto.webcrypto;
                    }
                } catch (error) {
                    // Fall through.
                }
            }

            throw new Error(
                'Secure Web Crypto is unavailable.'
            );
        }

        function getTextEncoder() {
            if (
                root &&
                typeof root.TextEncoder ===
                    'function'
            ) {
                return new root.TextEncoder();
            }

            if (typeof TextEncoder === 'function') {
                return new TextEncoder();
            }

            throw new Error(
                'TextEncoder is unavailable.'
            );
        }

        function getTextDecoder() {
            if (
                root &&
                typeof root.TextDecoder ===
                    'function'
            ) {
                return new root.TextDecoder();
            }

            if (typeof TextDecoder === 'function') {
                return new TextDecoder();
            }

            throw new Error(
                'TextDecoder is unavailable.'
            );
        }

        function assertOwnerId(ownerId) {
            const normalized =
                Number(ownerId);

            if (
                !Number.isInteger(normalized) ||
                normalized <= 0
            ) {
                throw new TypeError(
                    'A valid Journal owner is required.'
                );
            }

            return normalized;
        }

        function assertEntryUuid(value) {
            if (
                typeof value !== 'string' ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                    .test(value)
            ) {
                throw new TypeError(
                    'A valid Journal entry UUID is required.'
                );
            }

            return value.toLowerCase();
        }

        function randomBytes(length) {
            const crypto =
                getCrypto();

            const value =
                new Uint8Array(length);

            crypto.getRandomValues(value);

            return value;
        }

        function bytesToBase64Url(bytes) {
            let base64;

            if (
                typeof Buffer !== 'undefined'
            ) {
                base64 =
                    Buffer
                        .from(bytes)
                        .toString('base64');
            } else {
                let binary = '';

                for (const byte of bytes) {
                    binary +=
                        String.fromCharCode(byte);
                }

                base64 = root.btoa(binary);
            }

            return base64
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/g, '');
        }

        function base64UrlToBytes(value) {
            if (
                typeof value !== 'string' ||
                !/^[A-Za-z0-9_-]+$/.test(value)
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

            const normalized =
                value
                    .replace(/-/g, '+')
                    .replace(/_/g, '/') +
                padding;

            if (
                typeof Buffer !== 'undefined'
            ) {
                return new Uint8Array(
                    Buffer.from(
                        normalized,
                        'base64'
                    )
                );
            }

            const binary =
                root.atob(normalized);

            const bytes =
                new Uint8Array(binary.length);

            for (
                let index = 0;
                index < binary.length;
                index += 1
            ) {
                bytes[index] =
                    binary.charCodeAt(index);
            }

            return bytes;
        }

        function constantTimeEqualBytes(
            left,
            right
        ) {
            if (
                !(left instanceof Uint8Array) ||
                !(right instanceof Uint8Array) ||
                left.length !== right.length
            ) {
                return false;
            }

            let difference = 0;

            for (
                let index = 0;
                index < left.length;
                index += 1
            ) {
                difference |=
                    left[index] ^
                    right[index];
            }

            return difference === 0;
        }

        async function sha256(bytes) {
            const crypto =
                getCrypto();

            const digest =
                await crypto.subtle.digest(
                    'SHA-256',
                    bytes
                );

            return new Uint8Array(digest);
        }

        async function keyFingerprint(
            rawMasterKey
        ) {
            const digest =
                await sha256(rawMasterKey);

            return bytesToBase64Url(
                digest.slice(0, 16)
            );
        }

        function entryAad(
            ownerId,
            entryUuid
        ) {
            return getTextEncoder().encode(
                `${ENTRY_FORMAT}|owner:${ownerId}|entry:${entryUuid}`
            );
        }

        function recoveryAad(ownerId) {
            return getTextEncoder().encode(
                `fog-private-journal-keywrap-v1|owner:${ownerId}`
            );
        }

        async function importMasterKey(
            rawBytes,
            extractable = false
        ) {
            if (
                !(rawBytes instanceof Uint8Array) ||
                rawBytes.length !==
                    MASTER_KEY_BYTES
            ) {
                throw new TypeError(
                    'Invalid Journal Master Key material.'
                );
            }

            return getCrypto()
                .subtle
                .importKey(
                    'raw',
                    rawBytes,
                    {
                        name: 'AES-GCM'
                    },
                    extractable,
                    [
                        'encrypt',
                        'decrypt'
                    ]
                );
        }

        async function importRecoveryKey(
            rawBytes
        ) {
            if (
                !(rawBytes instanceof Uint8Array) ||
                rawBytes.length !==
                    RECOVERY_KEY_BYTES
            ) {
                throw new TypeError(
                    'Invalid Journal Recovery Key.'
                );
            }

            return getCrypto()
                .subtle
                .importKey(
                    'raw',
                    rawBytes,
                    {
                        name: 'AES-GCM'
                    },
                    false,
                    [
                        'encrypt',
                        'decrypt'
                    ]
                );
        }

        function createEntryUuid() {
            const crypto =
                getCrypto();

            if (
                typeof crypto.randomUUID ===
                    'function'
            ) {
                return crypto
                    .randomUUID()
                    .toLowerCase();
            }

            const bytes =
                randomBytes(16);

            bytes[6] =
                (bytes[6] & 0x0f) | 0x40;

            bytes[8] =
                (bytes[8] & 0x3f) | 0x80;

            const hex =
                Array
                    .from(bytes)
                    .map(
                        byte =>
                            byte
                                .toString(16)
                                .padStart(2, '0')
                    )
                    .join('');

            return [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20)
            ].join('-');
        }

        function encodeRecoveryCode(
            recoveryBytes
        ) {
            return (
                RECOVERY_PREFIX +
                bytesToBase64Url(
                    recoveryBytes
                )
            );
        }

        function decodeRecoveryCode(code) {
            if (
                typeof code !== 'string'
            ) {
                throw new TypeError(
                    'Journal Recovery Key is required.'
                );
            }

            const compact =
                code
                    .trim()
                    .replace(/\s+/g, '');

            if (
                !compact.startsWith(
                    RECOVERY_PREFIX
                )
            ) {
                throw new TypeError(
                    'Invalid Journal Recovery Key format.'
                );
            }

            const bytes =
                base64UrlToBytes(
                    compact.slice(
                        RECOVERY_PREFIX.length
                    )
                );

            if (
                bytes.length !==
                RECOVERY_KEY_BYTES
            ) {
                throw new TypeError(
                    'Invalid Journal Recovery Key length.'
                );
            }

            return bytes;
        }

        async function createJournalSetup(
            ownerId
        ) {
            const canonicalOwner =
                assertOwnerId(ownerId);

            const rawMaster =
                randomBytes(
                    MASTER_KEY_BYTES
                );

            const recoveryBytes =
                randomBytes(
                    RECOVERY_KEY_BYTES
                );

            const recoveryCode =
                encodeRecoveryCode(
                    recoveryBytes
                );

            const recoveryKey =
                await importRecoveryKey(
                    recoveryBytes
                );

            const wrapIv =
                randomBytes(
                    GCM_IV_BYTES
                );

            const fingerprint =
                await keyFingerprint(
                    rawMaster
                );

            const wrappedBuffer =
                await getCrypto()
                    .subtle
                    .encrypt(
                        {
                            name:
                                'AES-GCM',
                            iv:
                                wrapIv,
                            additionalData:
                                recoveryAad(
                                    canonicalOwner
                                ),
                            tagLength:
                                128
                        },
                        recoveryKey,
                        rawMaster
                    );

            const masterKey =
                await importMasterKey(
                    rawMaster,
                    false
                );

            rawMaster.fill(0);
            recoveryBytes.fill(0);

            return {
                masterKey,
                recoveryCode,
                envelope: {
                    crypto_version:
                        CRYPTO_VERSION,
                    wrap_alg:
                        ENTRY_ALGORITHM,
                    wrapped_key_b64:
                        bytesToBase64Url(
                            new Uint8Array(
                                wrappedBuffer
                            )
                        ),
                    wrap_iv_b64:
                        bytesToBase64Url(
                            wrapIv
                        ),
                    key_fingerprint:
                        fingerprint
                }
            };
        }

        async function recoverMasterKey(
            ownerId,
            recoveryCode,
            envelope
        ) {
            const canonicalOwner =
                assertOwnerId(ownerId);

            if (
                !envelope ||
                Number(
                    envelope.crypto_version
                ) !== CRYPTO_VERSION ||
                envelope.wrap_alg !==
                    ENTRY_ALGORITHM
            ) {
                throw new Error(
                    'Unsupported Journal recovery envelope.'
                );
            }

            const recoveryBytes =
                decodeRecoveryCode(
                    recoveryCode
                );

            const recoveryKey =
                await importRecoveryKey(
                    recoveryBytes
                );

            recoveryBytes.fill(0);

            const wrapped =
                base64UrlToBytes(
                    envelope.wrapped_key_b64
                );

            const iv =
                base64UrlToBytes(
                    envelope.wrap_iv_b64
                );

            if (
                iv.length !==
                    GCM_IV_BYTES
            ) {
                throw new Error(
                    'Invalid Journal recovery IV.'
                );
            }

            let rawBuffer;

            try {
                rawBuffer =
                    await getCrypto()
                        .subtle
                        .decrypt(
                            {
                                name:
                                    'AES-GCM',
                                iv,
                                additionalData:
                                    recoveryAad(
                                        canonicalOwner
                                    ),
                                tagLength:
                                    128
                            },
                            recoveryKey,
                            wrapped
                        );
            } catch (error) {
                throw new Error(
                    'Journal Recovery Key is incorrect or the recovery data was changed.'
                );
            }

            const rawMaster =
                new Uint8Array(
                    rawBuffer
                );

            const actualFingerprint =
                await keyFingerprint(
                    rawMaster
                );

            const expectedBytes =
                getTextEncoder().encode(
                    String(
                        envelope
                            .key_fingerprint ||
                        ''
                    )
                );

            const actualBytes =
                getTextEncoder().encode(
                    actualFingerprint
                );

            if (
                !constantTimeEqualBytes(
                    expectedBytes,
                    actualBytes
                )
            ) {
                rawMaster.fill(0);

                throw new Error(
                    'Recovered Journal key does not match this Journal.'
                );
            }

            const masterKey =
                await importMasterKey(
                    rawMaster,
                    false
                );

            rawMaster.fill(0);

            return {
                masterKey,
                keyFingerprint:
                    actualFingerprint
            };
        }

        async function encryptEntry(
            ownerId,
            masterKey,
            entry
        ) {
            const canonicalOwner =
                assertOwnerId(ownerId);

            if (
                !masterKey ||
                masterKey.type !== 'secret' ||
                masterKey.algorithm.name !==
                    'AES-GCM'
            ) {
                throw new TypeError(
                    'A valid Journal Master Key is required.'
                );
            }

            const entryUuid =
                assertEntryUuid(
                    entry &&
                    entry.entryUuid
                );

            const plainObject = {
                format:
                    ENTRY_FORMAT,
                title:
                    String(
                        entry.title || ''
                    ),
                mood:
                    String(
                        entry.mood || ''
                    ),
                content:
                    String(
                        entry.content || ''
                    )
            };

            const plaintext =
                getTextEncoder().encode(
                    JSON.stringify(
                        plainObject
                    )
                );

            if (
                plaintext.length >
                    MAX_PLAINTEXT_BYTES
            ) {
                throw new Error(
                    'Journal entry is too large.'
                );
            }

            const iv =
                randomBytes(
                    GCM_IV_BYTES
                );

            const encrypted =
                await getCrypto()
                    .subtle
                    .encrypt(
                        {
                            name:
                                'AES-GCM',
                            iv,
                            additionalData:
                                entryAad(
                                    canonicalOwner,
                                    entryUuid
                                ),
                            tagLength:
                                128
                        },
                        masterKey,
                        plaintext
                    );

            plaintext.fill(0);

            return {
                entry_uuid:
                    entryUuid,
                crypto_version:
                    CRYPTO_VERSION,
                cipher_alg:
                    ENTRY_ALGORITHM,
                iv_b64:
                    bytesToBase64Url(
                        iv
                    ),
                ciphertext_b64:
                    bytesToBase64Url(
                        new Uint8Array(
                            encrypted
                        )
                    )
            };
        }

        async function decryptEntry(
            ownerId,
            masterKey,
            encryptedEntry
        ) {
            const canonicalOwner =
                assertOwnerId(ownerId);

            if (
                !encryptedEntry ||
                Number(
                    encryptedEntry
                        .crypto_version
                ) !== CRYPTO_VERSION ||
                encryptedEntry
                    .cipher_alg !==
                    ENTRY_ALGORITHM
            ) {
                throw new Error(
                    'Unsupported encrypted Journal entry.'
                );
            }

            const entryUuid =
                assertEntryUuid(
                    encryptedEntry
                        .entry_uuid
                );

            const iv =
                base64UrlToBytes(
                    encryptedEntry
                        .iv_b64
                );

            const ciphertext =
                base64UrlToBytes(
                    encryptedEntry
                        .ciphertext_b64
                );

            if (
                iv.length !==
                    GCM_IV_BYTES
            ) {
                throw new Error(
                    'Invalid Journal encryption IV.'
                );
            }

            let plainBuffer;

            try {
                plainBuffer =
                    await getCrypto()
                        .subtle
                        .decrypt(
                            {
                                name:
                                    'AES-GCM',
                                iv,
                                additionalData:
                                    entryAad(
                                        canonicalOwner,
                                        entryUuid
                                    ),
                                tagLength:
                                    128
                            },
                            masterKey,
                            ciphertext
                        );
            } catch (error) {
                throw new Error(
                    'Journal entry could not be decrypted or has been changed.'
                );
            }

            const plaintext =
                new Uint8Array(
                    plainBuffer
                );

            let decoded;

            try {
                decoded =
                    JSON.parse(
                        getTextDecoder()
                            .decode(
                                plaintext
                            )
                    );
            } finally {
                plaintext.fill(0);
            }

            if (
                !decoded ||
                decoded.format !==
                    ENTRY_FORMAT ||
                typeof decoded.title !==
                    'string' ||
                typeof decoded.mood !==
                    'string' ||
                typeof decoded.content !==
                    'string'
            ) {
                throw new Error(
                    'Decrypted Journal entry is invalid.'
                );
            }

            return {
                id:
                    encryptedEntry.id,
                entry_uuid:
                    entryUuid,
                title:
                    decoded.title,
                mood:
                    decoded.mood,
                content:
                    decoded.content,
                created_at:
                    encryptedEntry
                        .created_at ||
                    null
            };
        }

        function getIndexedDb() {
            if (
                !root ||
                !root.indexedDB
            ) {
                throw new Error(
                    'Secure device key storage is unavailable.'
                );
            }

            return root.indexedDB;
        }

        function openKeyDatabase() {
            return new Promise(
                (resolve, reject) => {
                    const request =
                        getIndexedDb()
                            .open(
                                KEY_DB_NAME,
                                KEY_DB_VERSION
                            );

                    request.onupgradeneeded =
                        event => {
                            const database =
                                event
                                    .target
                                    .result;

                            if (
                                !database
                                    .objectStoreNames
                                    .contains(
                                        KEY_STORE_NAME
                                    )
                            ) {
                                database
                                    .createObjectStore(
                                        KEY_STORE_NAME,
                                        {
                                            keyPath:
                                                'ownerKey'
                                        }
                                    );
                            }
                        };

                    request.onsuccess =
                        event =>
                            resolve(
                                event
                                    .target
                                    .result
                            );

                    request.onerror =
                        () =>
                            reject(
                                request.error ||
                                new Error(
                                    'Unable to open secure Journal key storage.'
                                )
                            );
                }
            );
        }

        function ownerStorageKey(
            ownerId
        ) {
            return (
                'member:' +
                assertOwnerId(ownerId)
            );
        }

        async function saveDeviceKey(
            ownerId,
            masterKey,
            fingerprint
        ) {
            if (
                !masterKey ||
                masterKey.type !==
                    'secret' ||
                masterKey.extractable !==
                    false
            ) {
                throw new TypeError(
                    'Only a non-extractable Journal key may be stored.'
                );
            }

            const database =
                await openKeyDatabase();

            try {
                await new Promise(
                    (resolve, reject) => {
                        const tx =
                            database
                                .transaction(
                                    KEY_STORE_NAME,
                                    'readwrite'
                                );

                        const store =
                            tx.objectStore(
                                KEY_STORE_NAME
                            );

                        store.put({
                            ownerKey:
                                ownerStorageKey(
                                    ownerId
                                ),
                            key:
                                masterKey,
                            fingerprint:
                                String(
                                    fingerprint ||
                                    ''
                                ),
                            storedAt:
                                new Date()
                                    .toISOString()
                        });

                        tx.oncomplete =
                            () =>
                                resolve();

                        tx.onerror =
                            () =>
                                reject(
                                    tx.error ||
                                    new Error(
                                        'Unable to save Journal key.'
                                    )
                                );

                        tx.onabort =
                            () =>
                                reject(
                                    tx.error ||
                                    new Error(
                                        'Journal key storage was cancelled.'
                                    )
                                );
                    }
                );
            } finally {
                database.close();
            }
        }

        async function loadDeviceKey(
            ownerId
        ) {
            const database =
                await openKeyDatabase();

            try {
                return await new Promise(
                    (resolve, reject) => {
                        const tx =
                            database
                                .transaction(
                                    KEY_STORE_NAME,
                                    'readonly'
                                );

                        const request =
                            tx
                                .objectStore(
                                    KEY_STORE_NAME
                                )
                                .get(
                                    ownerStorageKey(
                                        ownerId
                                    )
                                );

                        request.onsuccess =
                            () =>
                                resolve(
                                    request
                                        .result ||
                                    null
                                );

                        request.onerror =
                            () =>
                                reject(
                                    request.error ||
                                    new Error(
                                        'Unable to load Journal key.'
                                    )
                                );
                    }
                );
            } finally {
                database.close();
            }
        }

        async function deleteDeviceKey(
            ownerId
        ) {
            const database =
                await openKeyDatabase();

            try {
                await new Promise(
                    (resolve, reject) => {
                        const tx =
                            database
                                .transaction(
                                    KEY_STORE_NAME,
                                    'readwrite'
                                );

                        tx
                            .objectStore(
                                KEY_STORE_NAME
                            )
                            .delete(
                                ownerStorageKey(
                                    ownerId
                                )
                            );

                        tx.oncomplete =
                            () =>
                                resolve();

                        tx.onerror =
                            () =>
                                reject(
                                    tx.error ||
                                    new Error(
                                        'Unable to remove Journal key.'
                                    )
                                );
                    }
                );
            } finally {
                database.close();
            }
        }

        return Object.freeze({
            CRYPTO_VERSION,
            ENTRY_FORMAT,
            ENTRY_ALGORITHM,
            RECOVERY_PREFIX,

            createEntryUuid,
            createJournalSetup,
            recoverMasterKey,

            encryptEntry,
            decryptEntry,

            saveDeviceKey,
            loadDeviceKey,
            deleteDeviceKey,

            // Exposed for deterministic security tests only.
            _testing:
                Object.freeze({
                    bytesToBase64Url,
                    base64UrlToBytes,
                    decodeRecoveryCode,
                    keyFingerprint
                })
        });
    }
);
