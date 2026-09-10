'use strict';

const crypto = require('crypto');
const {
    databaseRun,
    databaseGet,
    databaseAll,
    databaseExec,
    withImmediateTransaction
} = require('./email-security');

const ACCOUNT_CLAIM_TOKEN_BYTES = 32;
const ACCOUNT_CLAIM_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCOUNT_CLAIM_TOKEN_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACCOUNT_CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function normalizePositiveInteger(value) {
    const normalized = typeof value === 'number'
        ? value
        : typeof value === 'string' && /^[1-9]\d*$/.test(value)
            ? Number(value)
            : NaN;
    return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}

function normalizeClaimToken(rawToken) {
    if (typeof rawToken !== 'string' || !ACCOUNT_CLAIM_TOKEN_PATTERN.test(rawToken)) return null;
    try {
        const decoded = Buffer.from(rawToken, 'base64url');
        return decoded.length === ACCOUNT_CLAIM_TOKEN_BYTES && decoded.toString('base64url') === rawToken
            ? rawToken
            : null;
    } catch (error) {
        return null;
    }
}

function hashAccountClaimToken(rawToken) {
    const normalizedToken = normalizeClaimToken(rawToken);
    if (!normalizedToken) return null;
    return crypto.createHash('sha256')
        .update('koinonia-account-claim-v1')
        .update('\0')
        .update(normalizedToken)
        .digest('hex');
}

async function initializeAccountClaimSchema(database) {
    await databaseExec(database, `
        CREATE TABLE IF NOT EXISTS account_claim_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            created_by_user_id INTEGER NOT NULL,
            revoked_at INTEGER,
            revoked_by_user_id INTEGER,
            used_at INTEGER,
            consumed_by_user_id INTEGER
        );
        CREATE INDEX IF NOT EXISTS account_claim_tokens_youth_idx
            ON account_claim_tokens(youth_id, created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS account_claim_tokens_one_pending_idx
            ON account_claim_tokens(youth_id)
            WHERE used_at IS NULL AND revoked_at IS NULL;
    `);
}

function createAccountClaimStore({
    database,
    now = () => Date.now(),
    randomBytes = crypto.randomBytes
} = {}) {
    if (!database || typeof now !== 'function' || typeof randomBytes !== 'function') {
        throw new TypeError('database, now, and randomBytes are required');
    }

    function createRawToken() {
        const randomValue = randomBytes(ACCOUNT_CLAIM_TOKEN_BYTES);
        if (!Buffer.isBuffer(randomValue) || randomValue.length !== ACCOUNT_CLAIM_TOKEN_BYTES) {
            throw new TypeError('randomBytes must return exactly 32 bytes');
        }
        return randomValue.toString('base64url');
    }

    async function issue({
        youthId,
        createdByUserId,
        ttlMs = ACCOUNT_CLAIM_TOKEN_TTL_MS
    } = {}) {
        const normalizedYouthId = normalizePositiveInteger(youthId);
        const normalizedActorId = normalizePositiveInteger(createdByUserId);
        if (!normalizedYouthId || !normalizedActorId) {
            throw new TypeError('Valid youthId and createdByUserId are required');
        }
        if (!Number.isSafeInteger(ttlMs) || ttlMs <= 0 || ttlMs > ACCOUNT_CLAIM_TOKEN_MAX_TTL_MS) {
            throw new TypeError('Invalid account claim lifetime');
        }

        const rawToken = createRawToken();
        const tokenHash = hashAccountClaimToken(rawToken);
        const createdAt = Math.trunc(now());
        const expiresAt = createdAt + ttlMs;
        const result = await withImmediateTransaction(database, async () => {
            const revoked = await databaseRun(
                database,
                `UPDATE account_claim_tokens
                 SET revoked_at = ?, revoked_by_user_id = ?
                 WHERE youth_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
                [createdAt, normalizedActorId, normalizedYouthId]
            );
            const inserted = await databaseRun(
                database,
                `INSERT INTO account_claim_tokens
                    (youth_id, token_hash, created_at, expires_at, created_by_user_id)
                 VALUES (?, ?, ?, ?, ?)`,
                [normalizedYouthId, tokenHash, createdAt, expiresAt, normalizedActorId]
            );
            return { id: inserted.lastID, replaced: revoked.changes > 0 };
        });

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
        const tokenHash = hashAccountClaimToken(rawToken);
        if (!tokenHash) return null;
        const currentTime = Math.trunc(now());
        const record = await databaseGet(
            database,
            `SELECT id, youth_id, created_at, expires_at, created_by_user_id
             FROM account_claim_tokens
             WHERE token_hash = ? AND used_at IS NULL AND revoked_at IS NULL
               AND expires_at > ?`,
            [tokenHash, currentTime]
        );
        return record ? Object.freeze({
            id: record.id,
            youthId: record.youth_id,
            createdAt: record.created_at,
            expiresAt: record.expires_at,
            createdByUserId: record.created_by_user_id
        }) : null;
    }

    async function getStatus(youthId) {
        const normalizedYouthId = normalizePositiveInteger(youthId);
        if (!normalizedYouthId) throw new TypeError('A valid youthId is required');
        const record = await databaseGet(
            database,
            `SELECT id, youth_id, created_at, expires_at, created_by_user_id,
                    revoked_at, revoked_by_user_id, used_at, consumed_by_user_id
             FROM account_claim_tokens WHERE youth_id = ?
             ORDER BY id DESC LIMIT 1`,
            [normalizedYouthId]
        );
        if (!record) return null;
        const currentTime = Math.trunc(now());
        const status = record.used_at !== null
            ? 'used'
            : record.revoked_at !== null
                ? 'revoked'
                : record.expires_at <= currentTime
                    ? 'expired'
                    : 'active';
        return Object.freeze({ ...record, status });
    }

    async function revoke({ youthId, revokedByUserId } = {}) {
        const normalizedYouthId = normalizePositiveInteger(youthId);
        const normalizedActorId = normalizePositiveInteger(revokedByUserId);
        if (!normalizedYouthId || !normalizedActorId) {
            throw new TypeError('Valid youthId and revokedByUserId are required');
        }
        const revokedAt = Math.trunc(now());
        const result = await databaseRun(
            database,
            `UPDATE account_claim_tokens
             SET revoked_at = ?, revoked_by_user_id = ?
             WHERE youth_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
            [revokedAt, normalizedActorId, normalizedYouthId]
        );
        return Object.freeze({ revoked: result.changes > 0, revokedAt });
    }

    const transactionDatabase = Object.freeze({
        run: (sql, params = []) => databaseRun(database, sql, params),
        get: (sql, params = []) => databaseGet(database, sql, params),
        all: (sql, params = []) => databaseAll(database, sql, params)
    });

    async function consumeWithMutation({ rawToken, consumedByUserId } = {}, mutation) {
        if (typeof mutation !== 'function') throw new TypeError('A database mutation callback is required');
        const tokenHash = hashAccountClaimToken(rawToken);
        const normalizedConsumerId = normalizePositiveInteger(consumedByUserId);
        if (!tokenHash || !normalizedConsumerId) return null;

        return withImmediateTransaction(database, async () => {
            const consumedAt = Math.trunc(now());
            const record = await databaseGet(
                database,
                `SELECT id, youth_id, created_at, expires_at, created_by_user_id
                 FROM account_claim_tokens
                 WHERE token_hash = ? AND used_at IS NULL AND revoked_at IS NULL
                   AND expires_at > ?`,
                [tokenHash, consumedAt]
            );
            if (!record) return null;
            const claim = Object.freeze({
                id: record.id,
                youthId: record.youth_id,
                createdAt: record.created_at,
                expiresAt: record.expires_at,
                createdByUserId: record.created_by_user_id
            });
            const mutationResult = await mutation(claim, transactionDatabase);
            const consumed = await databaseRun(
                database,
                `UPDATE account_claim_tokens SET used_at = ?, consumed_by_user_id = ?
                 WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
                [consumedAt, normalizedConsumerId, record.id, consumedAt]
            );
            if (consumed.changes !== 1) {
                throw Object.assign(new Error('Account claim consumption failed'), {
                    code: 'ACCOUNT_CLAIM_CONSUME_CONFLICT'
                });
            }
            return Object.freeze({
                id: record.id,
                youthId: record.youth_id,
                usedAt: consumedAt,
                consumedByUserId: normalizedConsumerId,
                mutationResult
            });
        });
    }

    return Object.freeze({ issue, getUsable, getStatus, revoke, consumeWithMutation });
}

module.exports = {
    ACCOUNT_CLAIM_TOKEN_BYTES,
    ACCOUNT_CLAIM_TOKEN_TTL_MS,
    normalizeClaimToken,
    hashAccountClaimToken,
    initializeAccountClaimSchema,
    createAccountClaimStore
};
