'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3').verbose();

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const {
    normalizeEmail,
    validatePublicOrigin,
    validateVerifiedGooglePayload,
    findGoogleYouthIdentity,
    findPasswordRecoveryIdentity,
    createRecoveryRateLimiter,
    initializeEmailRecoverySchema,
    createAuthTokenStore,
    parseOutboxEncryptionKey,
    encryptOutboxPayload,
    decryptOutboxPayload,
    createEmailOutbox,
    createBoundedOutboxWorker,
    invalidateSessionsForYouth
} = require('../lib/email-security');
const {
    EmailTransportError,
    createResendTransport,
    createEmailTransport
} = require('../lib/email-transport');

function openDatabase(filename) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(filename, err => err ? reject(err) : resolve(database));
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => database.close(err => err ? reject(err) : resolve()));
}

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function(err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => err ? reject(err) : resolve(row || null));
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
}

async function withTemporaryDatabase(action) {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-email-foundation-'));
    const database = await openDatabase(path.join(temporaryRoot, 'test.db'));
    try {
        await initializeEmailRecoverySchema(database);
        return await action(database, temporaryRoot);
    } finally {
        await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    }
}

test('canonical email normalization and verified Google payload validation fail closed', () => {
    assert.equal(normalizeEmail('  Member.Name+tag@Example.COM  '), 'member.name+tag@example.com');
    assert.equal(normalizeEmail('member..name@example.com'), null);
    assert.equal(normalizeEmail('member@example'), null);
    assert.equal(normalizeEmail('member @example.com'), null);
    assert.equal(normalizeEmail(`${'a'.repeat(65)}@example.com`), null);
    assert.equal(normalizeEmail(null), null);

    assert.deepEqual(validateVerifiedGooglePayload({
        sub: 'google-subject-1',
        email: ' Verified@Example.COM ',
        email_verified: true,
        name: 'Verified Member',
        picture: 'https://example.invalid/avatar.png'
    }), {
        googleId: 'google-subject-1',
        normalizedEmail: 'verified@example.com',
        name: 'Verified Member',
        picture: 'https://example.invalid/avatar.png'
    });
    assert.equal(validateVerifiedGooglePayload({
        sub: 'google-subject-1', email: 'verified@example.com', email_verified: false
    }), null);
    assert.equal(validateVerifiedGooglePayload({
        sub: 'google-subject-1', email: 'invalid', email_verified: true
    }), null);
    assert.equal(validateVerifiedGooglePayload({
        email: 'verified@example.com', email_verified: true
    }), null);
});

test('password recovery origin validation requires an exact credential-free HTTPS origin', () => {
    assert.equal(validatePublicOrigin('https://staging.fogmin.site'), 'https://staging.fogmin.site');
    assert.equal(validatePublicOrigin(' https://fogmin.site/ '), 'https://fogmin.site');
    for (const invalid of [
        undefined,
        '',
        'http://staging.fogmin.site',
        'https://user:secret@fogmin.site',
        'https://fogmin.site/reset',
        'https://fogmin.site/?next=reset',
        'https://fogmin.site/#reset',
        'https://localhost'
    ]) assert.equal(validatePublicOrigin(invalid), null);
});

test('Google identity lookup prefers google_id and rejects ambiguous normalized email', async () => {
    await withTemporaryDatabase(async database => {
        await run(database, 'CREATE TABLE youth (id INTEGER PRIMARY KEY, email TEXT, google_id TEXT)');
        await run(database, "INSERT INTO youth (id, email, google_id) VALUES (1, 'first@example.com', 'subject-1')");
        await run(database, "INSERT INTO youth (id, email, google_id) VALUES (2, ' DUPLICATE@example.com ', NULL)");
        await run(database, "INSERT INTO youth (id, email, google_id) VALUES (3, 'duplicate@EXAMPLE.com', NULL)");

        const strongest = await findGoogleYouthIdentity(database, 'subject-1', 'duplicate@example.com');
        assert.equal(strongest.status, 'matched');
        assert.equal(strongest.matchedBy, 'google_id');
        assert.equal(strongest.member.id, 1);

        const ambiguous = await findGoogleYouthIdentity(database, 'unknown-subject', 'duplicate@example.com');
        assert.equal(ambiguous.status, 'ambiguous');
        assert.equal(ambiguous.matchedBy, 'email');

        const missing = await findGoogleYouthIdentity(database, 'unknown-subject', 'missing@example.com');
        assert.equal(missing.status, 'none');
    });
});

test('password recovery eligibility requires one normalized youth and an existing local credential', async () => {
    await withTemporaryDatabase(async database => {
        await run(database, 'CREATE TABLE youth (id INTEGER PRIMARY KEY, email TEXT, password TEXT, google_id TEXT, email_verified INTEGER NOT NULL DEFAULT 0)');
        await run(database, 'CREATE TABLE users (id INTEGER PRIMARY KEY, youth_id INTEGER, password TEXT)');
        await run(database, "INSERT INTO youth VALUES (1, ' Local@Example.com ', NULL, 'google-1', 1)");
        await run(database, "INSERT INTO users VALUES (1, 1, 'local-hash')");
        await run(database, "INSERT INTO youth VALUES (2, 'google-only@example.com', NULL, 'google-2', 1)");
        await run(database, "INSERT INTO youth VALUES (3, 'duplicate@example.com', 'hash', NULL, 1)");
        await run(database, "INSERT INTO youth VALUES (4, ' DUPLICATE@EXAMPLE.COM ', 'hash', NULL, 1)");
        await run(database, "INSERT INTO youth VALUES (5, 'unverified@example.com', 'hash', NULL, 0)");

        assert.deepEqual(await findPasswordRecoveryIdentity(database, 'local@example.com'), {
            status: 'eligible', identity: { youthId: 1, normalizedEmail: 'local@example.com' }
        });
        assert.equal((await findPasswordRecoveryIdentity(database, 'google-only@example.com')).status, 'no_local_credential');
        assert.equal((await findPasswordRecoveryIdentity(database, 'duplicate@example.com')).status, 'ambiguous');
        assert.equal((await findPasswordRecoveryIdentity(database, 'unverified@example.com')).status, 'unverified');
        assert.equal((await findPasswordRecoveryIdentity(database, 'unknown@example.com')).status, 'unknown');
        assert.equal((await findPasswordRecoveryIdentity(database, 'INVALID')).status, 'invalid');
    });
});

test('recovery limiter hashes and independently enforces client and subject limits', () => {
    let clock = 1_700_000_000_000;
    const limiter = createRecoveryRateLimiter({
        namespace: 'test-recovery', windowMs: 1_000, ipLimit: 3, subjectLimit: 2, now: () => clock
    });
    assert.equal(limiter.check({ ip: 'client-a', subject: 'one@example.com' }), true);
    assert.equal(limiter.check({ ip: 'client-a', subject: 'one@example.com' }), true);
    assert.equal(limiter.check({ ip: 'client-a', subject: 'one@example.com' }), false);
    assert.equal(limiter.check({ ip: 'client-b', subject: 'two@example.com' }), true);
    assert.equal(limiter.check({ ip: 'client-b', subject: 'three@example.com' }), true);
    assert.equal(limiter.check({ ip: 'client-b', subject: 'four@example.com' }), true);
    assert.equal(limiter.check({ ip: 'client-b', subject: 'five@example.com' }), false);
    clock += 1_001;
    assert.equal(limiter.check({ ip: 'client-a', subject: 'one@example.com' }), true);
});

test('email recovery migration creates only the dedicated tables and required indexes', async () => {
    await withTemporaryDatabase(async database => {
        const tables = await all(
            database,
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('auth_one_time_tokens', 'email_outbox') ORDER BY name"
        );
        assert.deepEqual(tables.map(row => row.name), ['auth_one_time_tokens', 'email_outbox']);

        const indexes = await all(
            database,
            `SELECT name FROM sqlite_master
             WHERE type = 'index' AND name LIKE 'auth_one_time_tokens_%'
                OR type = 'index' AND name LIKE 'email_outbox_%'
             ORDER BY name`
        );
        assert.deepEqual(indexes.map(row => row.name), [
            'auth_one_time_tokens_email_idx',
            'auth_one_time_tokens_lookup_idx',
            'auth_one_time_tokens_subject_idx',
            'email_outbox_active_dedupe_idx',
            'email_outbox_due_idx',
            'email_outbox_stale_idx'
        ]);

        const youthTable = await get(database, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'youth'");
        assert.equal(youthTable, null);
    });
});

test('one-time tokens are hashed, purpose-bound, expiring, revocable, and consumed once', async () => {
    await withTemporaryDatabase(async database => {
        let clock = 1_700_000_000_000;
        const tokens = createAuthTokenStore({ database, now: () => clock });
        const first = await tokens.issue({
            purpose: 'password_reset', youthId: 42, email: ' Member@Example.COM ', ttlMs: 60_000
        });
        const persistedFirst = await get(database, 'SELECT * FROM auth_one_time_tokens WHERE id = ?', [first.id]);
        assert.equal(JSON.stringify(persistedFirst).includes(first.rawToken), false);
        assert.match(persistedFirst.token_hash, /^[a-f0-9]{64}$/);
        assert.equal(persistedFirst.target_email, 'member@example.com');
        assert.equal(await tokens.consume({ rawToken: first.rawToken, purpose: 'email_verification' }), null);

        const second = await tokens.issue({
            purpose: 'password_reset', youthId: 42, email: 'member@example.com', ttlMs: 60_000
        });
        assert.notEqual(first.rawToken, second.rawToken);
        assert.notEqual((await get(database, 'SELECT revoked_at FROM auth_one_time_tokens WHERE id = ?', [first.id])).revoked_at, null);
        assert.equal(await tokens.consume({ rawToken: first.rawToken, purpose: 'password_reset' }), null);
        const consumed = await tokens.consume({ rawToken: second.rawToken, purpose: 'password_reset' });
        assert.equal(consumed.youthId, 42);
        assert.deepEqual(Object.keys(consumed).sort(), ['id', 'targetEmail', 'usedAt', 'youthId']);
        assert.equal(await tokens.consume({ rawToken: second.rawToken, purpose: 'password_reset' }), null);

        const expiring = await tokens.issue({
            purpose: 'email_verification', youthId: 43, email: 'other@example.com', ttlMs: 1_000
        });
        clock += 1_001;
        assert.equal(await tokens.consume({ rawToken: expiring.rawToken, purpose: 'email_verification' }), null);

        const revoked = await tokens.issue({
            purpose: 'email_verification', youthId: 44, email: 'revoke@example.com', ttlMs: 60_000
        });
        assert.equal((await tokens.revoke({ youthId: 44, purpose: 'email_verification' })).changes, 1);
        assert.equal(await tokens.consume({ rawToken: revoked.rawToken, purpose: 'email_verification' }), null);
    });
});

test('token consumption and password mutations share one atomic transaction', async () => {
    await withTemporaryDatabase(async database => {
        await run(database, 'CREATE TABLE recovery_youth (id INTEGER PRIMARY KEY, password TEXT NOT NULL)');
        await run(database, 'CREATE TABLE recovery_users (id INTEGER PRIMARY KEY, youth_id INTEGER, password TEXT NOT NULL)');
        await run(database, "INSERT INTO recovery_youth (id, password) VALUES (42, 'old-hash')");
        await run(database, "INSERT INTO recovery_users (id, youth_id, password) VALUES (1, 42, 'old-hash'), (2, 42, 'old-hash')");

        const tokens = createAuthTokenStore({ database });
        const issued = await tokens.issue({
            purpose: 'password_reset', youthId: 42, email: 'member@example.com', ttlMs: 60_000
        });
        const redeemed = await tokens.consumeWithMutation(
            { rawToken: issued.rawToken, purpose: 'password_reset' },
            async (token, transaction) => {
                assert.deepEqual(Object.keys(token).sort(), ['expiresAt', 'id', 'purpose', 'targetEmail', 'youthId']);
                assert.equal(token.youthId, 42);
                assert.equal('rawToken' in token, false);
                const youthUpdate = await transaction.run(
                    'UPDATE recovery_youth SET password = ? WHERE id = ?',
                    ['new-hash', token.youthId]
                );
                const userUpdate = await transaction.run(
                    'UPDATE recovery_users SET password = ? WHERE youth_id = ?',
                    ['new-hash', token.youthId]
                );
                return { youthChanges: youthUpdate.changes, userChanges: userUpdate.changes };
            }
        );

        assert.deepEqual(redeemed.mutationResult, { youthChanges: 1, userChanges: 2 });
        assert.equal((await get(database, 'SELECT password FROM recovery_youth WHERE id = 42')).password, 'new-hash');
        assert.deepEqual(
            (await all(database, 'SELECT password FROM recovery_users WHERE youth_id = 42 ORDER BY id')).map(row => row.password),
            ['new-hash', 'new-hash']
        );
        assert.notEqual((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [issued.id])).used_at, null);
    });
});

test('failed reset mutation rolls back its database changes and leaves the token usable', async () => {
    await withTemporaryDatabase(async database => {
        await run(database, 'CREATE TABLE recovery_youth (id INTEGER PRIMARY KEY, password TEXT NOT NULL)');
        await run(database, "INSERT INTO recovery_youth (id, password) VALUES (42, 'old-hash')");
        const tokens = createAuthTokenStore({ database });
        const issued = await tokens.issue({
            purpose: 'password_reset', youthId: 42, email: 'member@example.com', ttlMs: 60_000
        });

        await assert.rejects(
            tokens.consumeWithMutation(
                { rawToken: issued.rawToken, purpose: 'password_reset' },
                async (token, transaction) => {
                    await transaction.run(
                        'UPDATE recovery_youth SET password = ? WHERE id = ?',
                        ['must-roll-back', token.youthId]
                    );
                    throw new Error('simulated linked-user password update failure');
                }
            ),
            /simulated linked-user password update failure/
        );
        assert.equal((await get(database, 'SELECT password FROM recovery_youth WHERE id = 42')).password, 'old-hash');
        assert.equal((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [issued.id])).used_at, null);
        assert.equal((await tokens.consume({ rawToken: issued.rawToken, purpose: 'password_reset' })).youthId, 42);
    });
});

test('concurrent token redemption runs one mutation and permits one successful consumer', async () => {
    await withTemporaryDatabase(async database => {
        const tokens = createAuthTokenStore({ database });
        const issued = await tokens.issue({
            purpose: 'password_reset', youthId: 42, email: 'member@example.com', ttlMs: 60_000
        });
        let mutationRuns = 0;
        const redeem = () => tokens.consumeWithMutation(
            { rawToken: issued.rawToken, purpose: 'password_reset' },
            async () => { mutationRuns += 1; }
        );

        const results = await Promise.all([redeem(), redeem()]);
        assert.equal(results.filter(Boolean).length, 1);
        assert.equal(results.filter(result => result === null).length, 1);
        assert.equal(mutationRuns, 1);
    });
});

test('outbox encryption is authenticated and never persists a plaintext reset token', async () => {
    await withTemporaryDatabase(async database => {
        const encryptionKey = crypto.randomBytes(32).toString('base64url');
        assert.equal(parseOutboxEncryptionKey(encryptionKey).length, 32);
        assert.equal(parseOutboxEncryptionKey('invalid'), null);
        const rawResetToken = crypto.randomBytes(32).toString('base64url');
        const encrypted = encryptOutboxPayload({
            subject: 'Reset access', text: `Reset token: ${rawResetToken}`
        }, encryptionKey);
        assert.equal(JSON.stringify(encrypted).includes(rawResetToken), false);
        assert.equal(decryptOutboxPayload(encrypted, encryptionKey).text, `Reset token: ${rawResetToken}`);

        const tampered = { ...encrypted, ciphertext: `${encrypted.ciphertext[0] === 'A' ? 'B' : 'A'}${encrypted.ciphertext.slice(1)}` };
        assert.throws(() => decryptOutboxPayload(tampered, encryptionKey), { code: 'OUTBOX_DECRYPTION_FAILED' });
        assert.throws(() => encryptOutboxPayload({ token: rawResetToken }, 'invalid'), { code: 'OUTBOX_ENCRYPTION_KEY_INVALID' });

        const outbox = createEmailOutbox({
            database,
            encryptionKey,
            transport: { async send() { return { providerMessageId: 'unused' }; } }
        });
        const queued = await outbox.enqueue({
            recipient: ' Recipient@Example.COM ',
            messageType: 'password_reset',
            payload: { subject: 'Reset access', text: `Reset token: ${rawResetToken}` },
            dedupeKey: 'member-42-password-reset'
        });
        const row = await get(database, 'SELECT * FROM email_outbox WHERE id = ?', [queued.id]);
        assert.equal(row.recipient, 'recipient@example.com');
        assert.equal(JSON.stringify(row).includes(rawResetToken), false);
        const duplicate = await outbox.enqueue({
            recipient: 'recipient@example.com',
            messageType: 'password_reset',
            payload: { subject: 'Reset access', text: 'replacement' },
            dedupeKey: 'member-42-password-reset'
        });
        assert.deepEqual(duplicate, { enqueued: false, id: queued.id, reason: 'DUPLICATE_ACTIVE' });
        assert.equal(await outbox.hasActiveDedupeKey('member-42-password-reset'), true);
        assert.equal(await outbox.hasActiveDedupeKey('different-logical-message'), false);
    });
});

test('stale security email fails without transport delivery', async () => {
    await withTemporaryDatabase(async database => {
        const encryptionKey = crypto.randomBytes(32).toString('base64url');
        let clock = 1_700_000_000_000;
        let sendCount = 0;
        const outbox = createEmailOutbox({
            database,
            encryptionKey,
            now: () => clock,
            transport: { async send() { sendCount += 1; return { providerMessageId: 'must-not-send' }; } }
        });
        const job = await outbox.enqueue({
            recipient: 'member@example.com',
            messageType: 'password_reset',
            payload: {
                subject: 'Reset',
                text: 'Encrypted reset URL',
                deliveryNotAfter: clock + 60 * 60 * 1000,
                minimumRemainingValidityMs: 15 * 60 * 1000
            }
        });
        clock += 46 * 60 * 1000;
        const result = await outbox.processNext();
        assert.equal(result.status, 'failed');
        assert.equal(sendCount, 0);
        const row = await get(database, 'SELECT status, last_error_code FROM email_outbox WHERE id = ?', [job.id]);
        assert.deepEqual(row, { status: 'failed', last_error_code: 'EMAIL_DELIVERY_WINDOW_EXPIRED' });
    });
});

test('email outbox schedules bounded retries, fails permanently, and recovers stale sending jobs', async () => {
    await withTemporaryDatabase(async database => {
        const encryptionKey = crypto.randomBytes(32).toString('base64url');
        let clock = 1_700_000_000_000;
        let behavior = 'retry';
        let sendCount = 0;
        const transport = {
            async send() {
                sendCount += 1;
                if (behavior === 'retry') throw Object.assign(new Error('retry'), { code: 'EMAIL_PROVIDER_503', retryable: true });
                if (behavior === 'permanent') throw Object.assign(new Error('permanent'), { code: 'EMAIL_PROVIDER_400', retryable: false });
                return { providerMessageId: 'provider-message-id' };
            }
        };
        const outbox = createEmailOutbox({
            database, encryptionKey, transport, now: () => clock,
            retryBaseMs: 1_000, retryMaxMs: 8_000, staleAfterMs: 5_000, maxAttempts: 3
        });

        const retryJob = await outbox.enqueue({
            recipient: 'retry@example.com', messageType: 'password_reset',
            payload: { subject: 'Retry', text: 'Encrypted content' }
        });
        assert.deepEqual(await outbox.processNext(), {
            processed: true, id: retryJob.id, status: 'retry', retryCount: 1
        });
        let retryRow = await get(database, 'SELECT * FROM email_outbox WHERE id = ?', [retryJob.id]);
        assert.equal(retryRow.status, 'retry');
        assert.equal(retryRow.next_attempt_at, clock + 1_000);
        assert.equal((await outbox.processNext()).reason, 'NO_DUE_EMAIL');
        clock += 1_000;
        behavior = 'success';
        assert.equal((await outbox.processNext()).status, 'sent');
        retryRow = await get(database, 'SELECT * FROM email_outbox WHERE id = ?', [retryJob.id]);
        assert.equal(retryRow.provider_message_id, 'provider-message-id');

        behavior = 'permanent';
        const permanentJob = await outbox.enqueue({
            recipient: 'permanent@example.com', messageType: 'email_verification',
            payload: { subject: 'Permanent', text: 'Encrypted content' }
        });
        assert.equal((await outbox.processNext()).status, 'failed');
        assert.equal((await get(database, 'SELECT status FROM email_outbox WHERE id = ?', [permanentJob.id])).status, 'failed');

        const staleJob = await outbox.enqueue({
            recipient: 'stale@example.com', messageType: 'password_reset',
            payload: { subject: 'Stale', text: 'Encrypted content' }, nextAttemptAt: clock + 60_000
        });
        await run(
            database,
            "UPDATE email_outbox SET status = 'sending', locked_at = ?, next_attempt_at = ? WHERE id = ?",
            [clock - 10_000, clock, staleJob.id]
        );
        assert.equal((await outbox.recoverStaleSending()).changes, 1);
        const staleRow = await get(database, 'SELECT * FROM email_outbox WHERE id = ?', [staleJob.id]);
        assert.equal(staleRow.status, 'retry');
        assert.equal(staleRow.retry_count, 1);
        assert.equal(staleRow.last_error_code, 'STALE_SENDING_RECOVERED');
        assert.equal(sendCount, 3);
    });
});

test('email outbox prevents concurrent duplicate worker execution', async () => {
    await withTemporaryDatabase(async database => {
        const encryptionKey = crypto.randomBytes(32).toString('base64url');
        let releaseSend;
        let sendStarted;
        const started = new Promise(resolve => { sendStarted = resolve; });
        const transport = {
            async send() {
                sendStarted();
                await new Promise(resolve => { releaseSend = resolve; });
                return { providerMessageId: 'one-send' };
            }
        };
        const outbox = createEmailOutbox({ database, encryptionKey, transport });
        await outbox.enqueue({
            recipient: 'once@example.com', messageType: 'password_reset',
            payload: { subject: 'Once', text: 'Encrypted content' }
        });

        const firstWorker = outbox.processNext();
        await started;
        assert.deepEqual(await outbox.processNext(), { processed: false, reason: 'WORKER_BUSY' });
        releaseSend();
        assert.equal((await firstWorker).status, 'sent');
        assert.equal((await all(database, "SELECT id FROM email_outbox WHERE status = 'sent'")).length, 1);
    });
});

test('bounded outbox worker prevents overlap and respects its batch limit', async () => {
    let calls = 0;
    let releaseFirst;
    let firstStarted;
    const started = new Promise(resolve => { firstStarted = resolve; });
    const outbox = {
        async processNext() {
            calls += 1;
            if (calls === 1) {
                firstStarted();
                await new Promise(resolve => { releaseFirst = resolve; });
            }
            return { processed: true, id: calls, status: 'sent' };
        }
    };
    const worker = createBoundedOutboxWorker({ outbox, batchSize: 2 });
    const firstRun = worker.runOnce();
    await started;
    assert.deepEqual(await worker.runOnce(), { processed: 0, reason: 'WORKER_BUSY' });
    releaseFirst();
    const result = await firstRun;
    assert.equal(result.processed, 2);
    assert.equal(calls, 2);
});

test('Resend transport uses HTTPS, timeout, and safe retry classification without live network', async () => {
    let captured;
    const successTransport = createResendTransport({
        apiKey: 'test-api-key-not-live',
        from: 'Koinonia <sender@example.com>',
        replyTo: 'reply@example.com',
        fetchImpl: async (url, options) => {
            captured = { url, options };
            return { ok: true, status: 200, async json() { return { id: 'mock-provider-id' }; } };
        }
    });
    assert.deepEqual(await successTransport.send({
        to: 'Member@Example.com', subject: 'Subject', text: 'Message'
    }), { providerMessageId: 'mock-provider-id' });
    assert.equal(captured.url, 'https://api.resend.com/emails');
    assert.equal(captured.options.method, 'POST');
    assert.equal(JSON.parse(captured.options.body).to[0], 'member@example.com');

    for (const [status, retryable] of [[429, true], [503, true], [400, false], [401, false]]) {
        const transport = createResendTransport({
            apiKey: 'test-api-key-not-live', from: 'sender@example.com',
            fetchImpl: async () => ({ ok: false, status })
        });
        await assert.rejects(
            transport.send({ to: 'member@example.com', subject: 'Subject', text: 'Message' }),
            error => error instanceof EmailTransportError && error.retryable === retryable && error.status === status
        );
    }

    const networkTransport = createResendTransport({
        apiKey: 'test-api-key-not-live', from: 'sender@example.com',
        fetchImpl: async () => { throw new TypeError('mock DNS failure'); }
    });
    await assert.rejects(
        networkTransport.send({ to: 'member@example.com', subject: 'Subject', text: 'Message' }),
        error => error.code === 'EMAIL_NETWORK_ERROR' && error.retryable === true
    );
    const timeoutTransport = createResendTransport({
        apiKey: 'test-api-key-not-live', from: 'sender@example.com', timeoutMs: 100,
        fetchImpl: async (url, options) => new Promise((resolve, reject) => {
            const keepAlive = setTimeout(() => resolve({ ok: true, status: 200 }), 1_000);
            options.signal.addEventListener('abort', () => {
                clearTimeout(keepAlive);
                reject(Object.assign(new Error('mock abort'), { name: 'AbortError' }));
            }, { once: true });
        })
    });
    await assert.rejects(
        timeoutTransport.send({ to: 'member@example.com', subject: 'Subject', text: 'Message' }),
        error => error.code === 'EMAIL_TIMEOUT' && error.retryable === true
    );
    assert.throws(() => createEmailTransport({ provider: 'unknown' }), { code: 'EMAIL_PROVIDER_UNSUPPORTED' });
    assert.throws(() => createResendTransport({ apiKey: '', from: 'sender@example.com' }), {
        code: 'EMAIL_TRANSPORT_CONFIG_INVALID'
    });
});

test('session invalidation removes every session for one youth only', () => {
    const sessions = new Map([
        ['one', { youthId: 42 }],
        ['two', { youthId: '42' }],
        ['three', { youthId: 43 }],
        ['admin', { youthId: null }]
    ]);
    assert.equal(invalidateSessionsForYouth(sessions, 42), 2);
    assert.deepEqual(Array.from(sessions.keys()), ['three', 'admin']);
    assert.equal(invalidateSessionsForYouth(sessions, 'invalid'), 0);
});

test('real Google route refuses unverified and ambiguous email while preserving safe login/provisioning', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-google-route-'));
    let database;
    let httpServer;
    t.after(async () => {
        if (httpServer) await new Promise(resolve => httpServer.close(resolve));
        if (database) await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    const source = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const fakeVerifier = `const googleClient = {
        async verifyIdToken({ idToken }) {
            const payload = JSON.parse(Buffer.from(idToken, 'base64url').toString('utf8'));
            return { getPayload() { return payload; } };
        }
    };`;
    const isolatedSource = source
        .replace(
            "const googleClient = new OAuth2Client('100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com');",
            fakeVerifier
        )
        .replace('void runDatabaseBackup();', 'void Promise.resolve();')
        .replace(
            'setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);',
            'setInterval(() => {}, 1000 * 60 * 60).unref();'
        )
        .replace(
            "cron.schedule('0 9 * * 1',",
            "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"
        )
        .replace(
            'startServerAfterRuntimeSchemaReady();',
            'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };'
        );
    assert.notEqual(isolatedSource, source);
    assert.ok(isolatedSource.includes(fakeVerifier));
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');

    const application = require(path.join(temporaryRoot, 'server.js'));
    await application.ready;
    database = application.db;
    httpServer = await new Promise((resolve, reject) => {
        const server = application.app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(server));
        server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${httpServer.address().port}`;
    const googleRequest = payload => fetch(`${origin}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: Buffer.from(JSON.stringify(payload)).toString('base64url') })
    });
    const googleRequestWithAssociationRace = async (payload, winningGoogleId) => {
        const originalRun = database.run;
        let intercepted = false;
        database.run = function(sql, params, callback) {
            if (!intercepted && /UPDATE youth\s+SET google_id = \?, profile_picture = \?/.test(sql)) {
                intercepted = true;
                originalRun.call(
                    database,
                    'UPDATE youth SET google_id = ? WHERE id = ?',
                    [winningGoogleId, params[params.length - 1]],
                    err => {
                        if (err) return callback(err);
                        return originalRun.call(database, sql, params, callback);
                    }
                );
                return database;
            }
            return originalRun.apply(database, arguments);
        };
        try {
            const response = await googleRequest(payload);
            assert.equal(intercepted, true);
            return response;
        } finally {
            database.run = originalRun;
        }
    };

    const before = (await get(database, 'SELECT COUNT(*) AS count FROM youth')).count;
    assert.equal((await googleRequest({
        sub: 'unverified-subject', email: 'unverified@example.com', email_verified: false, name: 'Unverified'
    })).status, 401);
    assert.equal((await get(database, 'SELECT COUNT(*) AS count FROM youth')).count, before);

    await run(database, "INSERT INTO youth (name, email, created_at) VALUES ('Duplicate One', ' Duplicate@Example.com ', datetime('now'))");
    await run(database, "INSERT INTO youth (name, email, created_at) VALUES ('Duplicate Two', 'duplicate@EXAMPLE.COM', datetime('now'))");
    assert.equal((await googleRequest({
        sub: 'ambiguous-subject', email: 'duplicate@example.com', email_verified: true, name: 'Ambiguous'
    })).status, 401);
    assert.equal((await get(database, "SELECT COUNT(*) AS count FROM youth WHERE google_id = 'ambiguous-subject'")).count, 0);

    const raceLoser = await run(
        database,
        "INSERT INTO youth (name, email, qr_code, created_at) VALUES ('Race Loser', 'race-loser@example.com', 'P10-RACE-LOSER', datetime('now'))"
    );
    const raceRejected = await googleRequestWithAssociationRace({
        sub: 'requested-race-subject', email: 'race-loser@example.com', email_verified: true, name: 'Race Loser'
    }, 'different-winning-subject');
    assert.equal(raceRejected.status, 401);
    assert.equal(raceRejected.headers.get('set-cookie'), null);
    assert.equal(
        (await get(database, 'SELECT google_id FROM youth WHERE id = ?', [raceLoser.lastID])).google_id,
        'different-winning-subject'
    );

    const raceEquivalent = await run(
        database,
        "INSERT INTO youth (name, email, qr_code, created_at) VALUES ('Race Equivalent', 'race-equivalent@example.com', 'P10-RACE-EQUIVALENT', datetime('now'))"
    );
    const equivalentResponse = await googleRequestWithAssociationRace({
        sub: 'equivalent-subject', email: 'race-equivalent@example.com', email_verified: true, name: 'Race Equivalent'
    }, 'equivalent-subject');
    assert.equal(equivalentResponse.status, 200);
    assert.equal(
        (await get(database, 'SELECT google_id FROM youth WHERE id = ?', [raceEquivalent.lastID])).google_id,
        'equivalent-subject'
    );

    const unique = await run(
        database,
        "INSERT INTO youth (name, email, qr_code, password, created_at) VALUES ('Unique', ' Unique@Example.com ', 'P10-UNIQUE', 'secret-not-returned', datetime('now'))"
    );
    await run(
        database,
        "INSERT INTO users (username, permissions, youth_id, created_at) VALUES ('P10-UNIQUE', '[]', ?, datetime('now'))",
        [unique.lastID]
    );
    const uniqueResponse = await googleRequest({
        sub: 'unique-subject', email: 'unique@example.com', email_verified: true, name: 'Unique'
    });
    assert.equal(uniqueResponse.status, 200);
    const uniqueBody = await uniqueResponse.json();
    assert.equal(uniqueBody.member.id, unique.lastID);
    assert.equal('password' in uniqueBody.member, false);
    assert.equal('google_id' in uniqueBody.member, false);
    assert.equal((await get(database, 'SELECT google_id FROM youth WHERE id = ?', [unique.lastID])).google_id, 'unique-subject');
    assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [unique.lastID])).email_verified, 1);

    await run(
        database,
        "INSERT INTO users (username, permissions, created_at) VALUES ('Admin@Example.com', '[\"access_events\"]', datetime('now'))"
    );
    const adminResponse = await googleRequest({
        sub: 'admin-subject', email: ' admin@example.COM ', email_verified: true, name: 'Admin'
    });
    assert.equal(adminResponse.status, 200);
    const adminBody = await adminResponse.json();
    assert.deepEqual(adminBody.permissions, ['access_events']);
    assert.equal(adminBody.is_admin, true);
    assert.equal('password' in adminBody.member, false);
    const linkedAdmin = await get(database, "SELECT youth_id FROM users WHERE LOWER(TRIM(username)) = 'admin@example.com'");
    assert.ok(linkedAdmin.youth_id);
    assert.equal(
        (await get(database, 'SELECT google_id FROM youth WHERE id = ?', [linkedAdmin.youth_id])).google_id,
        'admin-subject'
    );
    assert.equal(
        (await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [linkedAdmin.youth_id])).email_verified,
        1
    );

    const newResponse = await googleRequest({
        sub: 'new-subject', email: ' Brand.New@Example.com ', email_verified: true, name: 'Brand New'
    });
    assert.equal(newResponse.status, 200);
    const newBody = await newResponse.json();
    assert.equal(newBody.is_new, true);
    assert.equal((await get(database, 'SELECT email FROM youth WHERE id = ?', [newBody.member.id])).email, 'brand.new@example.com');
    assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [newBody.member.id])).email_verified, 1);
});
