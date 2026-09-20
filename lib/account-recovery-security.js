'use strict';

const crypto = require('crypto');
const {
    databaseRun,
    databaseGet,
    databaseAll,
    databaseExec,
    withImmediateTransaction
} = require('./email-security');

const ACCOUNT_RECOVERY_TOKEN_BYTES = 32;
const ACCOUNT_RECOVERY_TOKEN_TTL_MS = 60 * 60 * 1000;
const ACCOUNT_RECOVERY_TOKEN_MAX_TTL_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_RECOVERY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function normalizePositiveInteger(value) {
    const normalized = typeof value === 'number'
        ? value
        : typeof value === 'string' && /^[1-9]\d*$/.test(value)
            ? Number(value)
            : NaN;

    return Number.isSafeInteger(normalized) && normalized > 0
        ? normalized
        : null;
}

function normalizeAccountRecoveryToken(rawToken) {
    if (
        typeof rawToken !== 'string' ||
        !ACCOUNT_RECOVERY_TOKEN_PATTERN.test(rawToken)
    ) return null;

    try {
        const decoded = Buffer.from(rawToken, 'base64url');
        return (
            decoded.length === ACCOUNT_RECOVERY_TOKEN_BYTES &&
            decoded.toString('base64url') === rawToken
        )
            ? rawToken
            : null;
    } catch (error) {
        return null;
    }
}

function hashAccountRecoveryToken(rawToken) {
    const normalizedToken = normalizeAccountRecoveryToken(rawToken);
    if (!normalizedToken) return null;

    return crypto.createHash('sha256')
        .update('fog-account-recovery-v1')
        .update('\0')
        .update(normalizedToken)
        .digest('hex');
}

async function initializeAccountRecoverySchema(database) {
    await databaseExec(database, `
        CREATE TABLE IF NOT EXISTS account_recovery_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            created_by_user_id INTEGER NOT NULL,
            revoked_at INTEGER,
            revoked_by_user_id INTEGER,
            used_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS account_recovery_tokens_youth_idx
            ON account_recovery_tokens(youth_id, created_at DESC);

        CREATE UNIQUE INDEX IF NOT EXISTS account_recovery_tokens_one_pending_idx
            ON account_recovery_tokens(youth_id)
            WHERE used_at IS NULL AND revoked_at IS NULL;
    `);
}

function createAccountRecoveryStore({
    database,
    now = () => Date.now(),
    randomBytes = crypto.randomBytes
} = {}) {
    if (
        !database ||
        typeof now !== 'function' ||
        typeof randomBytes !== 'function'
    ) {
        throw new TypeError(
            'database, now, and randomBytes are required'
        );
    }

    const transactionDatabase = Object.freeze({
        run: (sql, params = []) => databaseRun(database, sql, params),
        get: (sql, params = []) => databaseGet(database, sql, params),
        all: (sql, params = []) => databaseAll(database, sql, params)
    });

    function createRawToken() {
        const randomValue = randomBytes(ACCOUNT_RECOVERY_TOKEN_BYTES);

        if (
            !Buffer.isBuffer(randomValue) ||
            randomValue.length !== ACCOUNT_RECOVERY_TOKEN_BYTES
        ) {
            throw new TypeError(
                'randomBytes must return exactly 32 bytes'
            );
        }

        return randomValue.toString('base64url');
    }

    async function issue({
        youthId,
        createdByUserId,
        ttlMs = ACCOUNT_RECOVERY_TOKEN_TTL_MS,
        validate = null
    } = {}) {
        const normalizedYouthId =
            normalizePositiveInteger(youthId);

        const normalizedActorId =
            normalizePositiveInteger(createdByUserId);

        if (!normalizedYouthId || !normalizedActorId) {
            throw new TypeError(
                'Valid youthId and createdByUserId are required'
            );
        }

        if (
            !Number.isSafeInteger(ttlMs) ||
            ttlMs <= 0 ||
            ttlMs > ACCOUNT_RECOVERY_TOKEN_MAX_TTL_MS
        ) {
            throw new TypeError(
                'Invalid account recovery lifetime'
            );
        }

        const rawToken = createRawToken();
        const tokenHash =
            hashAccountRecoveryToken(rawToken);

        const createdAt = Math.trunc(now());
        const expiresAt = createdAt + ttlMs;

        const result = await withImmediateTransaction(
            database,
            async () => {
                if (validate !== null) {
                    if (typeof validate !== 'function') {
                        throw new TypeError(
                            'Recovery validation must be a function'
                        );
                    }

                    await validate(
                        Object.freeze({
                            youthId: normalizedYouthId,
                            createdByUserId: normalizedActorId,
                            createdAt,
                            expiresAt
                        }),
                        transactionDatabase
                    );
                }

                const revoked = await databaseRun(
                    database,
                    `UPDATE account_recovery_tokens
                     SET revoked_at = ?,
                         revoked_by_user_id = ?
                     WHERE youth_id = ?
                       AND used_at IS NULL
                       AND revoked_at IS NULL`,
                    [
                        createdAt,
                        normalizedActorId,
                        normalizedYouthId
                    ]
                );

                const inserted = await databaseRun(
                    database,
                    `INSERT INTO account_recovery_tokens
                        (
                            youth_id,
                            token_hash,
                            created_at,
                            expires_at,
                            created_by_user_id
                        )
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        normalizedYouthId,
                        tokenHash,
                        createdAt,
                        expiresAt,
                        normalizedActorId
                    ]
                );

                return {
                    id: inserted.lastID,
                    replaced: revoked.changes > 0
                };
            }
        );

        return Object.freeze({
            id: result.id,
            youthId: normalizedYouthId,
            rawToken,
            createdAt,
            expiresAt,
            replaced: result.replaced
        });
    }

    async function getUsable(rawToken) {
        const tokenHash =
            hashAccountRecoveryToken(rawToken);

        if (!tokenHash) return null;

        const currentTime = Math.trunc(now());

        const record = await databaseGet(
            database,
            `SELECT
                id,
                youth_id,
                created_at,
                expires_at,
                created_by_user_id
             FROM account_recovery_tokens
             WHERE token_hash = ?
               AND used_at IS NULL
               AND revoked_at IS NULL
               AND expires_at > ?`,
            [tokenHash, currentTime]
        );

        return record
            ? Object.freeze({
                id: record.id,
                youthId: record.youth_id,
                createdAt: record.created_at,
                expiresAt: record.expires_at,
                createdByUserId:
                    record.created_by_user_id
            })
            : null;
    }

    async function getStatus(youthId) {
        const normalizedYouthId =
            normalizePositiveInteger(youthId);

        if (!normalizedYouthId) {
            throw new TypeError(
                'A valid youthId is required'
            );
        }

        const record = await databaseGet(
            database,
            `SELECT
                id,
                youth_id,
                created_at,
                expires_at,
                created_by_user_id,
                revoked_at,
                revoked_by_user_id,
                used_at
             FROM account_recovery_tokens
             WHERE youth_id = ?
             ORDER BY id DESC
             LIMIT 1`,
            [normalizedYouthId]
        );

        if (!record) return null;

        const currentTime = Math.trunc(now());

        const status =
            record.used_at !== null
                ? 'used'
                : record.revoked_at !== null
                    ? 'revoked'
                    : record.expires_at <= currentTime
                        ? 'expired'
                        : 'active';

        return Object.freeze({
            ...record,
            status
        });
    }

    async function revoke({
        youthId,
        revokedByUserId
    } = {}) {
        const normalizedYouthId =
            normalizePositiveInteger(youthId);

        const normalizedActorId =
            normalizePositiveInteger(revokedByUserId);

        if (!normalizedYouthId || !normalizedActorId) {
            throw new TypeError(
                'Valid youthId and revokedByUserId are required'
            );
        }

        const revokedAt = Math.trunc(now());

        const result = await databaseRun(
            database,
            `UPDATE account_recovery_tokens
             SET revoked_at = ?,
                 revoked_by_user_id = ?
             WHERE youth_id = ?
               AND used_at IS NULL
               AND revoked_at IS NULL`,
            [
                revokedAt,
                normalizedActorId,
                normalizedYouthId
            ]
        );

        return Object.freeze({
            revoked: result.changes > 0,
            revokedAt
        });
    }

    async function consumeWithMutation(
        { rawToken } = {},
        mutation
    ) {
        if (typeof mutation !== 'function') {
            throw new TypeError(
                'A database mutation callback is required'
            );
        }

        const tokenHash =
            hashAccountRecoveryToken(rawToken);

        if (!tokenHash) return null;

        return withImmediateTransaction(
            database,
            async () => {
                const consumedAt = Math.trunc(now());

                const record = await databaseGet(
                    database,
                    `SELECT
                        id,
                        youth_id,
                        created_at,
                        expires_at,
                        created_by_user_id
                     FROM account_recovery_tokens
                     WHERE token_hash = ?
                       AND used_at IS NULL
                       AND revoked_at IS NULL
                       AND expires_at > ?`,
                    [tokenHash, consumedAt]
                );

                if (!record) return null;

                const recovery = Object.freeze({
                    id: record.id,
                    youthId: record.youth_id,
                    createdAt: record.created_at,
                    expiresAt: record.expires_at,
                    createdByUserId:
                        record.created_by_user_id
                });

                const mutationResult =
                    await mutation(
                        recovery,
                        transactionDatabase
                    );

                const consumed =
                    await databaseRun(
                        database,
                        `UPDATE account_recovery_tokens
                         SET used_at = ?
                         WHERE id = ?
                           AND used_at IS NULL
                           AND revoked_at IS NULL
                           AND expires_at > ?`,
                        [
                            consumedAt,
                            record.id,
                            consumedAt
                        ]
                    );

                if (consumed.changes !== 1) {
                    throw Object.assign(
                        new Error(
                            'Account recovery consumption failed'
                        ),
                        {
                            code:
                                'ACCOUNT_RECOVERY_CONSUME_CONFLICT'
                        }
                    );
                }

                return Object.freeze({
                    id: record.id,
                    youthId: record.youth_id,
                    usedAt: consumedAt,
                    mutationResult
                });
            }
        );
    }

    return Object.freeze({
        issue,
        getUsable,
        getStatus,
        revoke,
        consumeWithMutation
    });
}

module.exports = {
    ACCOUNT_RECOVERY_TOKEN_BYTES,
    ACCOUNT_RECOVERY_TOKEN_TTL_MS,
    normalizeAccountRecoveryToken,
    hashAccountRecoveryToken,
    initializeAccountRecoverySchema,
    createAccountRecoveryStore
};
