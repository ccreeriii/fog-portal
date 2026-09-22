'use strict';

const crypto = require('crypto');

const AUTH_TOKEN_PURPOSES = Object.freeze(['password_reset', 'email_verification']);
const AUTH_TOKEN_BYTES = 32;
const AUTH_TOKEN_MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OUTBOX_ENCRYPTION_AAD = Buffer.from('koinonia-email-outbox:v1', 'utf8');
const OUTBOX_MAX_PAYLOAD_BYTES = 64 * 1024;
const OUTBOX_DEFAULT_MAX_ATTEMPTS = 5;
const OUTBOX_DEFAULT_STALE_AFTER_MS = 10 * 60 * 1000;
const OUTBOX_DEFAULT_RETRY_BASE_MS = 60 * 1000;
const OUTBOX_DEFAULT_RETRY_MAX_MS = 60 * 60 * 1000;
const databaseTransactionQueues = new WeakMap();

function createSafeError(code, retryable = false) {
    return Object.assign(new Error('Email security operation failed'), { code, retryable });
}

function databaseRun(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function databaseGet(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
    });
}

function databaseAll(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
}

function databaseExec(database, sql) {
    return new Promise((resolve, reject) => {
        database.exec(sql, err => err ? reject(err) : resolve());
    });
}

function withImmediateTransaction(database, action) {
    const previous = databaseTransactionQueues.get(database) || Promise.resolve();
    const operation = previous.catch(() => {}).then(async () => {
        await databaseRun(database, 'BEGIN IMMEDIATE');
        try {
            const result = await action();
            await databaseRun(database, 'COMMIT');
            return result;
        } catch (err) {
            try { await databaseRun(database, 'ROLLBACK'); }
            catch (rollbackError) { /* Preserve the original failure. */ }
            throw err;
        }
    });
    databaseTransactionQueues.set(database, operation.catch(() => {}));
    return operation;
}

function normalizeEmail(value) {
    if (typeof value !== 'string') return null;
    const email = value.trim().toLowerCase();
    if (!email || email.length > 254 || !/^[\x21-\x7e]+$/.test(email)) return null;

    const separator = email.lastIndexOf('@');
    if (separator <= 0 || separator !== email.indexOf('@')) return null;
    const local = email.slice(0, separator);
    const domain = email.slice(separator + 1);
    if (local.length > 64 || domain.length > 253) return null;
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return null;
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return null;

    const labels = domain.split('.');
    if (labels.length < 2 || labels.some(label => (
        !label || label.length > 63 ||
        !/^[a-z0-9-]+$/.test(label) ||
        label.startsWith('-') || label.endsWith('-')
    ))) return null;
    return email;
}

function validateVerifiedGooglePayload(payload) {
    if (!payload || payload.email_verified !== true) return null;
    const normalizedEmail = normalizeEmail(payload.email);
    const googleId = typeof payload.sub === 'string' ? payload.sub.trim() : '';
    if (!normalizedEmail || !googleId || googleId.length > 255) return null;
    return {
        googleId,
        normalizedEmail,
        name: typeof payload.name === 'string' && payload.name.trim()
            ? payload.name.trim().slice(0, 255)
            : normalizedEmail,
        picture: typeof payload.picture === 'string' && payload.picture.length <= 2048
            ? payload.picture
            : null
    };
}

function validatePublicOrigin(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) return null;
    try {
        const parsed = new URL(value.trim());
        if (
            parsed.protocol !== 'https:' || parsed.username || parsed.password ||
            parsed.pathname !== '/' || parsed.search || parsed.hash ||
            !parsed.hostname || !parsed.hostname.includes('.')
        ) return null;
        return parsed.origin;
    } catch (err) {
        return null;
    }
}

async function findGoogleYouthIdentity(database, googleId, normalizedEmail) {
    const googleMatches = await databaseAll(
        database,
        'SELECT * FROM youth WHERE google_id = ? LIMIT 2',
        [googleId]
    );
    if (googleMatches.length > 1) return { status: 'ambiguous', matchedBy: 'google_id' };
    if (googleMatches.length === 1) {
        return { status: 'matched', matchedBy: 'google_id', member: googleMatches[0] };
    }

    const emailMatches = await databaseAll(
        database,
        `SELECT * FROM youth
         WHERE email IS NOT NULL AND LOWER(TRIM(email)) = ?
         LIMIT 2`,
        [normalizedEmail]
    );
    if (emailMatches.length > 1) return { status: 'ambiguous', matchedBy: 'email' };
    if (emailMatches.length === 1) {
        return { status: 'matched', matchedBy: 'email', member: emailMatches[0] };
    }
    return { status: 'none', matchedBy: null, member: null };
}

async function findPasswordRecoveryIdentity(database, normalizedEmail) {
    if (!database || normalizeEmail(normalizedEmail) !== normalizedEmail) {
        return { status: 'invalid', identity: null };
    }
    const matches = await databaseAll(
        database,
        `SELECT id, email, password, email_verified FROM youth
         WHERE email IS NOT NULL AND LOWER(TRIM(email)) = ?
         ORDER BY id ASC LIMIT 2`,
        [normalizedEmail]
    );
    if (matches.length > 1) return { status: 'ambiguous', identity: null };
    if (matches.length === 0) return { status: 'unknown', identity: null };

    const member = matches[0];
    if (member.email_verified !== 1) {
        return { status: 'unverified', identity: null };
    }
    const linkedCredential = await databaseGet(
        database,
        `SELECT id FROM users
         WHERE youth_id = ? AND password IS NOT NULL AND TRIM(password) <> ''
         ORDER BY id ASC LIMIT 1`,
        [member.id]
    );
    const hasYouthCredential = typeof member.password === 'string' && member.password.length > 0;
    if (!hasYouthCredential && !linkedCredential) {
        return { status: 'no_local_credential', identity: null };
    }
    return {
        status: 'eligible',
        identity: Object.freeze({ youthId: member.id, normalizedEmail })
    };
}

function createRecoveryRateLimiter({
    namespace,
    windowMs = 15 * 60 * 1000,
    ipLimit,
    subjectLimit,
    maximumIpKeys = 2048,
    maximumSubjectKeys = 4096,
    now = () => Date.now()
} = {}) {
    if (
        typeof namespace !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(namespace) ||
        !Number.isInteger(windowMs) || windowMs < 1000 ||
        !Number.isInteger(ipLimit) || ipLimit < 1 ||
        !Number.isInteger(subjectLimit) || subjectLimit < 1
    ) throw new TypeError('Invalid recovery limiter configuration');

    const ipEntries = new Map();
    const subjectEntries = new Map();
    const digestKey = (type, value) => crypto.createHash('sha256')
        .update('koinonia-recovery-limit-v1')
        .update('\0')
        .update(namespace)
        .update('\0')
        .update(type)
        .update('\0')
        .update(String(value))
        .digest('base64url');
    const cleanup = (store, currentTime) => {
        for (const [key, entry] of store) {
            if (!entry || entry.resetAt <= currentTime) store.delete(key);
        }
    };
    const consume = (store, key, limit, maximumKeys, currentTime) => {
        let entry = store.get(key);
        if (entry && entry.resetAt <= currentTime) {
            store.delete(key);
            entry = null;
        }
        if (!entry) {
            if (store.size >= maximumKeys) cleanup(store, currentTime);
            if (store.size >= maximumKeys) return false;
            entry = { count: 0, resetAt: currentTime + windowMs };
            store.set(key, entry);
        }
        if (entry.count >= limit) return false;
        entry.count += 1;
        return true;
    };

    function check({ ip, subject = null } = {}) {
        const currentTime = Math.trunc(now());
        const safeIp = typeof ip === 'string' && ip ? ip : '<unknown>';
        if (!consume(ipEntries, digestKey('ip', safeIp), ipLimit, maximumIpKeys, currentTime)) return false;
        if (subject !== null && !consume(
            subjectEntries,
            digestKey('subject', subject),
            subjectLimit,
            maximumSubjectKeys,
            currentTime
        )) return false;
        return true;
    }

    function cleanupExpired() {
        const currentTime = Math.trunc(now());
        cleanup(ipEntries, currentTime);
        cleanup(subjectEntries, currentTime);
    }

    return Object.freeze({ check, cleanupExpired });
}

async function initializeEmailRecoverySchema(database) {
    await databaseExec(database, `
        CREATE TABLE IF NOT EXISTS auth_one_time_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            token_hash TEXT NOT NULL,
            purpose TEXT NOT NULL CHECK (purpose IN ('password_reset', 'email_verification')),
            youth_id INTEGER,
            target_email TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            used_at INTEGER,
            revoked_at INTEGER
        );
        CREATE UNIQUE INDEX IF NOT EXISTS auth_one_time_tokens_lookup_idx
            ON auth_one_time_tokens(token_hash, purpose);
        CREATE INDEX IF NOT EXISTS auth_one_time_tokens_subject_idx
            ON auth_one_time_tokens(youth_id, purpose, expires_at);
        CREATE INDEX IF NOT EXISTS auth_one_time_tokens_email_idx
            ON auth_one_time_tokens(target_email, purpose, expires_at);

        CREATE TABLE IF NOT EXISTS email_outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipient TEXT NOT NULL,
            message_type TEXT NOT NULL,
            payload_ciphertext TEXT NOT NULL,
            payload_iv TEXT NOT NULL,
            payload_tag TEXT NOT NULL,
            encryption_version INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'sending', 'retry', 'sent', 'failed')),
            retry_count INTEGER NOT NULL DEFAULT 0,
            next_attempt_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            locked_at INTEGER,
            sent_at INTEGER,
            provider_message_id TEXT,
            last_error_code TEXT,
            dedupe_key TEXT
        );
        CREATE INDEX IF NOT EXISTS email_outbox_due_idx
            ON email_outbox(status, next_attempt_at, id);
        CREATE INDEX IF NOT EXISTS email_outbox_stale_idx
            ON email_outbox(status, locked_at);
        CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_active_dedupe_idx
            ON email_outbox(dedupe_key)
            WHERE dedupe_key IS NOT NULL AND status IN ('pending', 'sending', 'retry');
    `);
}

function validateTokenPurpose(purpose) {
    return AUTH_TOKEN_PURPOSES.includes(purpose) ? purpose : null;
}

function hashOneTimeToken(rawToken, purpose) {
    const validatedPurpose = validateTokenPurpose(purpose);
    if (!validatedPurpose || typeof rawToken !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(rawToken)) return null;
    return crypto.createHash('sha256')
        .update('koinonia-auth-token-v1')
        .update('\0')
        .update(validatedPurpose)
        .update('\0')
        .update(rawToken)
        .digest('hex');
}

function createAuthTokenStore({ database, now = () => Date.now(), randomBytes = crypto.randomBytes } = {}) {
    if (!database || typeof now !== 'function' || typeof randomBytes !== 'function') {
        throw new TypeError('database, now, and randomBytes are required');
    }

    async function issue({ purpose, youthId = null, email, ttlMs = 60 * 60 * 1000 } = {}) {
        const validatedPurpose = validateTokenPurpose(purpose);
        const targetEmail = normalizeEmail(email);
        const normalizedYouthId = youthId == null ? null : Number(youthId);
        if (!validatedPurpose || !targetEmail) throw new TypeError('Valid token purpose and email are required');
        if (normalizedYouthId !== null && (!Number.isInteger(normalizedYouthId) || normalizedYouthId <= 0)) {
            throw new TypeError('youthId must be a positive integer');
        }
        if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > AUTH_TOKEN_MAX_TTL_MS) {
            throw new TypeError('Invalid token lifetime');
        }

        const rawToken = randomBytes(AUTH_TOKEN_BYTES).toString('base64url');
        const tokenHash = hashOneTimeToken(rawToken, validatedPurpose);
        const createdAt = Math.trunc(now());
        const expiresAt = createdAt + ttlMs;
        const inserted = await withImmediateTransaction(database, async () => {
            if (normalizedYouthId !== null) {
                await databaseRun(
                    database,
                    `UPDATE auth_one_time_tokens SET revoked_at = ?
                     WHERE youth_id = ? AND purpose = ? AND used_at IS NULL AND revoked_at IS NULL`,
                    [createdAt, normalizedYouthId, validatedPurpose]
                );
            } else {
                await databaseRun(
                    database,
                    `UPDATE auth_one_time_tokens SET revoked_at = ?
                     WHERE youth_id IS NULL AND target_email = ? AND purpose = ?
                       AND used_at IS NULL AND revoked_at IS NULL`,
                    [createdAt, targetEmail, validatedPurpose]
                );
            }
            return databaseRun(
                database,
                `INSERT INTO auth_one_time_tokens
                    (token_hash, purpose, youth_id, target_email, created_at, expires_at)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [tokenHash, validatedPurpose, normalizedYouthId, targetEmail, createdAt, expiresAt]
            );
        });
        return {
            id: inserted.lastID,
            rawToken,
            purpose: validatedPurpose,
            youthId: normalizedYouthId,
            targetEmail,
            createdAt,
            expiresAt
        };
    }

    const transactionDatabase = Object.freeze({
        run: (sql, params = []) => databaseRun(database, sql, params),
        get: (sql, params = []) => databaseGet(database, sql, params),
        all: (sql, params = []) => databaseAll(database, sql, params)
    });

    async function consumeValidated({ rawToken, purpose } = {}, mutation = null) {
        const validatedPurpose = validateTokenPurpose(purpose);
        const tokenHash = hashOneTimeToken(rawToken, validatedPurpose);
        if (!validatedPurpose || !tokenHash) return null;

        return withImmediateTransaction(database, async () => {
            const consumedAt = Math.trunc(now());
            const record = await databaseGet(
                database,
                `SELECT id, youth_id, target_email, expires_at, used_at, revoked_at
                 FROM auth_one_time_tokens WHERE token_hash = ? AND purpose = ?`,
                [tokenHash, validatedPurpose]
            );
            if (!record || record.used_at !== null || record.revoked_at !== null || record.expires_at <= consumedAt) {
                return null;
            }
            const token = Object.freeze({
                id: record.id,
                youthId: record.youth_id,
                targetEmail: record.target_email,
                purpose: validatedPurpose,
                expiresAt: record.expires_at
            });
            const mutationResult = mutation
                ? await mutation(token, transactionDatabase)
                : undefined;
            const update = await databaseRun(
                database,
                `UPDATE auth_one_time_tokens SET used_at = ?
                 WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL AND expires_at > ?`,
                [consumedAt, record.id, consumedAt]
            );
            if (update.changes !== 1) return null;
            return {
                id: record.id,
                youthId: record.youth_id,
                targetEmail: record.target_email,
                usedAt: consumedAt,
                mutationResult
            };
        });
    }

    async function consume(input) {
        const consumed = await consumeValidated(input);
        if (!consumed) return null;
        return {
            id: consumed.id,
            youthId: consumed.youthId,
            targetEmail: consumed.targetEmail,
            usedAt: consumed.usedAt
        };
    }

    async function consumeWithMutation(input, mutation) {
        if (typeof mutation !== 'function') throw new TypeError('A database mutation callback is required');
        return consumeValidated(input, mutation);
    }

    async function revoke({ youthId, purpose } = {}) {
        const validatedPurpose = validateTokenPurpose(purpose);
        const normalizedYouthId = Number(youthId);
        if (!validatedPurpose || !Number.isInteger(normalizedYouthId) || normalizedYouthId <= 0) {
            throw new TypeError('Valid youthId and purpose are required');
        }
        return databaseRun(
            database,
            `UPDATE auth_one_time_tokens SET revoked_at = ?
             WHERE youth_id = ? AND purpose = ? AND used_at IS NULL AND revoked_at IS NULL`,
            [Math.trunc(now()), normalizedYouthId, validatedPurpose]
        );
    }

    return Object.freeze({ issue, consume, consumeWithMutation, revoke });
}

function parseOutboxEncryptionKey(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(value.trim())) return null;
    try {
        const key = Buffer.from(value.trim(), 'base64url');
        return key.length === 32 && key.toString('base64url') === value.trim() ? key : null;
    } catch (err) {
        return null;
    }
}

function encryptOutboxPayload(payload, encryptionKey) {
    const key = parseOutboxEncryptionKey(encryptionKey);
    if (!key) throw Object.assign(new Error('Email outbox encryption is unavailable'), { code: 'OUTBOX_ENCRYPTION_KEY_INVALID' });
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    if (!plaintext.length || plaintext.length > OUTBOX_MAX_PAYLOAD_BYTES) {
        throw Object.assign(new Error('Invalid email outbox payload'), { code: 'OUTBOX_PAYLOAD_INVALID' });
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(OUTBOX_ENCRYPTION_AAD);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
        version: 1,
        ciphertext: ciphertext.toString('base64url'),
        iv: iv.toString('base64url'),
        tag: cipher.getAuthTag().toString('base64url')
    };
}

function decryptOutboxPayload(encrypted, encryptionKey) {
    const key = parseOutboxEncryptionKey(encryptionKey);
    if (!key) throw Object.assign(new Error('Email outbox decryption is unavailable'), { code: 'OUTBOX_ENCRYPTION_KEY_INVALID' });
    try {
        if (!encrypted || encrypted.version !== 1) throw new Error('Unsupported encryption version');
        const iv = Buffer.from(encrypted.iv, 'base64url');
        const tag = Buffer.from(encrypted.tag, 'base64url');
        const ciphertext = Buffer.from(encrypted.ciphertext, 'base64url');
        if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) throw new Error('Invalid encrypted payload');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAAD(OUTBOX_ENCRYPTION_AAD);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        if (plaintext.length > OUTBOX_MAX_PAYLOAD_BYTES) throw new Error('Payload exceeds limit');
        return JSON.parse(plaintext.toString('utf8'));
    } catch (err) {
        throw Object.assign(new Error('Unable to decrypt email outbox payload'), { code: 'OUTBOX_DECRYPTION_FAILED' });
    }
}

function safeOutboxCode(value, fallback = 'EMAIL_DELIVERY_FAILED') {
    return typeof value === 'string' && /^[A-Z0-9_]{1,64}$/.test(value) ? value : fallback;
}

function calculateRetryDelay(attempt, baseDelay, maximumDelay) {
    return Math.min(maximumDelay, baseDelay * (2 ** Math.max(0, attempt - 1)));
}

function createEmailOutbox({
    database,
    encryptionKey,
    transport,
    now = () => Date.now(),
    logger = null,
    maxAttempts = OUTBOX_DEFAULT_MAX_ATTEMPTS,
    staleAfterMs = OUTBOX_DEFAULT_STALE_AFTER_MS,
    retryBaseMs = OUTBOX_DEFAULT_RETRY_BASE_MS,
    retryMaxMs = OUTBOX_DEFAULT_RETRY_MAX_MS
} = {}) {
    if (!database || !transport || typeof transport.send !== 'function') {
        throw new TypeError('database and transport are required');
    }
    if (!parseOutboxEncryptionKey(encryptionKey)) {
        throw Object.assign(new Error('Email outbox encryption is unavailable'), { code: 'OUTBOX_ENCRYPTION_KEY_INVALID' });
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new TypeError('Invalid maxAttempts');
    let workerRunning = false;

    const logSafe = (level, message, fields) => {
        if (!logger || typeof logger[level] !== 'function') return;
        logger[level](`${message} id=${fields.id} code=${fields.code}`);
    };

    async function enqueue({ recipient, messageType, payload, dedupeKey = null, nextAttemptAt = null } = {}) {
        const normalizedRecipient = normalizeEmail(recipient);
        if (!normalizedRecipient || typeof messageType !== 'string' || !/^[a-z0-9_:-]{1,64}$/.test(messageType)) {
            throw new TypeError('Valid recipient and messageType are required');
        }
        const encrypted = encryptOutboxPayload(payload, encryptionKey);
        const createdAt = Math.trunc(now());
        const dueAt = nextAttemptAt == null ? createdAt : Math.trunc(nextAttemptAt);
        if (!Number.isFinite(dueAt)) throw new TypeError('Invalid nextAttemptAt');
        const dedupeDigest = dedupeKey == null ? null : crypto.createHash('sha256')
            .update('koinonia-email-dedupe-v1\0')
            .update(String(dedupeKey))
            .digest('hex');
        try {
            const inserted = await databaseRun(
                database,
                `INSERT INTO email_outbox
                    (recipient, message_type, payload_ciphertext, payload_iv, payload_tag,
                     encryption_version, status, retry_count, next_attempt_at, created_at, updated_at, dedupe_key)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?, ?)`,
                [normalizedRecipient, messageType, encrypted.ciphertext, encrypted.iv, encrypted.tag,
                    encrypted.version, dueAt, createdAt, createdAt, dedupeDigest]
            );
            return { enqueued: true, id: inserted.lastID };
        } catch (err) {
            if (dedupeDigest && err && err.code === 'SQLITE_CONSTRAINT') {
                const existing = await databaseGet(
                    database,
                    `SELECT id FROM email_outbox
                     WHERE dedupe_key = ? AND status IN ('pending', 'sending', 'retry')`,
                    [dedupeDigest]
                );
                if (existing) return { enqueued: false, id: existing.id, reason: 'DUPLICATE_ACTIVE' };
            }
            throw err;
        }
    }

    async function hasActiveDedupeKey(dedupeKey) {
        if (dedupeKey == null) return false;
        const dedupeDigest = crypto.createHash('sha256')
            .update('koinonia-email-dedupe-v1\0')
            .update(String(dedupeKey))
            .digest('hex');
        return Boolean(await databaseGet(
            database,
            `SELECT id FROM email_outbox
             WHERE dedupe_key = ? AND status IN ('pending', 'sending', 'retry') LIMIT 1`,
            [dedupeDigest]
        ));
    }

    async function cancelActiveDedupeKey(dedupeKey, errorCode = 'EMAIL_SUPERSEDED') {
        if (dedupeKey == null) return { changes: 0 };
        const dedupeDigest = crypto.createHash('sha256')
            .update('koinonia-email-dedupe-v1\0')
            .update(String(dedupeKey))
            .digest('hex');
        return databaseRun(
            database,
            `UPDATE email_outbox
             SET status = 'failed', updated_at = ?, locked_at = NULL, last_error_code = ?
             WHERE dedupe_key = ? AND status IN ('pending', 'sending', 'retry')`,
            [Math.trunc(now()), safeOutboxCode(errorCode, 'EMAIL_SUPERSEDED'), dedupeDigest]
        );
    }

    async function recoverStaleSending() {
        const currentTime = Math.trunc(now());
        const staleBefore = currentTime - staleAfterMs;
        return databaseRun(
            database,
            `UPDATE email_outbox
             SET retry_count = retry_count + 1,
                 status = CASE WHEN retry_count + 1 >= ? THEN 'failed' ELSE 'retry' END,
                 next_attempt_at = CASE WHEN retry_count + 1 >= ? THEN next_attempt_at ELSE ? END,
                 updated_at = ?, locked_at = NULL, last_error_code = 'STALE_SENDING_RECOVERED'
             WHERE status = 'sending' AND locked_at IS NOT NULL AND locked_at <= ?`,
            [maxAttempts, maxAttempts, currentTime + retryBaseMs, currentTime, staleBefore]
        );
    }

    async function claimNext() {
        const currentTime = Math.trunc(now());
        return withImmediateTransaction(database, async () => {
            const row = await databaseGet(
                database,
                `SELECT * FROM email_outbox
                 WHERE status IN ('pending', 'retry') AND next_attempt_at <= ? AND retry_count < ?
                 ORDER BY next_attempt_at ASC, id ASC LIMIT 1`,
                [currentTime, maxAttempts]
            );
            if (!row) return null;
            const claimed = await databaseRun(
                database,
                `UPDATE email_outbox SET status = 'sending', locked_at = ?, updated_at = ?
                 WHERE id = ? AND status IN ('pending', 'retry') AND next_attempt_at <= ?`,
                [currentTime, currentTime, row.id, currentTime]
            );
            return claimed.changes === 1 ? { ...row, status: 'sending', locked_at: currentTime } : null;
        });
    }

    async function markFailure(row, err) {
        const currentTime = Math.trunc(now());
        const nextRetryCount = row.retry_count + 1;
        const retryable = Boolean(err && err.retryable);
        const willRetry = retryable && nextRetryCount < maxAttempts;
        const nextAttemptAt = willRetry
            ? currentTime + calculateRetryDelay(nextRetryCount, retryBaseMs, retryMaxMs)
            : row.next_attempt_at;
        const code = safeOutboxCode(err && err.code);
        await databaseRun(
            database,
            `UPDATE email_outbox
             SET status = ?, retry_count = ?, next_attempt_at = ?, updated_at = ?,
                 locked_at = NULL, last_error_code = ?
             WHERE id = ? AND status = 'sending'`,
            [willRetry ? 'retry' : 'failed', nextRetryCount, nextAttemptAt, currentTime, code, row.id]
        );
        logSafe(willRetry ? 'warn' : 'error', 'Email outbox delivery failed', { id: row.id, code });
        return { processed: true, id: row.id, status: willRetry ? 'retry' : 'failed', retryCount: nextRetryCount };
    }

    async function processNext() {
        if (workerRunning) return { processed: false, reason: 'WORKER_BUSY' };
        workerRunning = true;
        try {
            await recoverStaleSending();
            const row = await claimNext();
            if (!row) return { processed: false, reason: 'NO_DUE_EMAIL' };

            let payload;
            try {
                payload = decryptOutboxPayload({
                    version: row.encryption_version,
                    ciphertext: row.payload_ciphertext,
                    iv: row.payload_iv,
                    tag: row.payload_tag
                }, encryptionKey);
            } catch (err) {
                err.retryable = false;
                return markFailure(row, err);
            }

            try {
                if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                    return markFailure(row, createSafeError('EMAIL_PAYLOAD_INVALID'));
                }
                const deliveryNotAfter = payload.deliveryNotAfter;
                const minimumRemainingValidityMs = payload.minimumRemainingValidityMs == null
                    ? 0
                    : payload.minimumRemainingValidityMs;
                if (
                    (deliveryNotAfter != null && (!Number.isSafeInteger(deliveryNotAfter) || deliveryNotAfter <= 0)) ||
                    !Number.isSafeInteger(minimumRemainingValidityMs) || minimumRemainingValidityMs < 0
                ) {
                    return markFailure(row, createSafeError('EMAIL_DELIVERY_WINDOW_INVALID'));
                }
                if (deliveryNotAfter != null && deliveryNotAfter - Math.trunc(now()) < minimumRemainingValidityMs) {
                    return markFailure(row, createSafeError('EMAIL_DELIVERY_WINDOW_EXPIRED'));
                }
                const {
                    deliveryNotAfter: ignoredDeliveryNotAfter,
                    minimumRemainingValidityMs: ignoredMinimumRemainingValidityMs,
                    ...message
                } = payload;
                const delivered = await transport.send({
                    ...message,
                    to: row.recipient,
                    messageType: row.message_type
                });
                const sentAt = Math.trunc(now());
                const providerMessageId = delivered && typeof delivered.providerMessageId === 'string'
                    ? delivered.providerMessageId.slice(0, 255)
                    : null;
                await databaseRun(
                    database,
                    `UPDATE email_outbox
                     SET status = 'sent', sent_at = ?, updated_at = ?, locked_at = NULL,
                         provider_message_id = ?, last_error_code = NULL
                     WHERE id = ? AND status = 'sending'`,
                    [sentAt, sentAt, providerMessageId, row.id]
                );
                return { processed: true, id: row.id, status: 'sent' };
            } catch (err) {
                return markFailure(row, err);
            }
        } finally {
            workerRunning = false;
        }
    }

    return Object.freeze({
        enqueue,
        hasActiveDedupeKey,
        cancelActiveDedupeKey,
        processNext,
        recoverStaleSending
    });
}

function createBoundedOutboxWorker({ outbox, batchSize = 5 } = {}) {
    if (!outbox || typeof outbox.processNext !== 'function') throw new TypeError('outbox is required');
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
        throw new TypeError('Invalid email worker batch size');
    }
    let running = false;

    async function runOnce() {
        if (running) return { processed: 0, reason: 'WORKER_BUSY' };
        running = true;
        const results = [];
        try {
            for (let index = 0; index < batchSize; index += 1) {
                const result = await outbox.processNext();
                if (!result || !result.processed) break;
                results.push(result);
            }
            return { processed: results.length, results };
        } finally {
            running = false;
        }
    }

    return Object.freeze({ runOnce });
}

function invalidateSessionsForYouth(sessionStore, youthId) {
    if (!(sessionStore instanceof Map)) throw new TypeError('sessionStore must be a Map');
    const normalizedYouthId = Number(youthId);
    if (!Number.isInteger(normalizedYouthId) || normalizedYouthId <= 0) return 0;
    let removed = 0;
    for (const [sessionId, session] of sessionStore) {
        if (session && Number(session.youthId) === normalizedYouthId) {
            sessionStore.delete(sessionId);
            removed += 1;
        }
    }
    return removed;
}

function invalidateSessionsForUser(sessionStore, userId) {
    if (!(sessionStore instanceof Map)) throw new TypeError('sessionStore must be a Map');
    const normalizedUserId = Number(userId);
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0) return 0;
    let removed = 0;
    for (const [sessionId, session] of sessionStore) {
        if (session && Number(session.userId) === normalizedUserId) {
            sessionStore.delete(sessionId);
            removed += 1;
        }
    }
    return removed;
}

module.exports = {
    AUTH_TOKEN_PURPOSES,
    normalizeEmail,
    validatePublicOrigin,
    validateVerifiedGooglePayload,
    findGoogleYouthIdentity,
    findPasswordRecoveryIdentity,
    createRecoveryRateLimiter,
    initializeEmailRecoverySchema,
    hashOneTimeToken,
    createAuthTokenStore,
    parseOutboxEncryptionKey,
    encryptOutboxPayload,
    decryptOutboxPayload,
    createEmailOutbox,
    createBoundedOutboxWorker,
    invalidateSessionsForYouth,
    invalidateSessionsForUser,
    databaseRun,
    databaseGet,
    databaseAll,
    databaseExec,
    withImmediateTransaction
};
