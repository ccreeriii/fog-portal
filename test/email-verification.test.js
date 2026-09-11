'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
    createAuthTokenStore,
    decryptOutboxPayload,
    findPasswordRecoveryIdentity
} = require('../lib/email-security');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');

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

function closeDatabase(database) {
    return new Promise((resolve, reject) => database.close(err => err ? reject(err) : resolve()));
}

async function requestJson(origin, pathname, { method = 'POST', body = {}, cookie } = {}) {
    const response = await fetch(`${origin}${pathname}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {})
        },
        body: method === 'GET' ? undefined : JSON.stringify(body)
    });
    return {
        status: response.status,
        body: await response.json(),
        cacheControl: response.headers.get('cache-control'),
        setCookie: response.headers.get('set-cookie')
    };
}

async function createMember(database, suffix, {
    email = `${suffix.toLowerCase()}@example.test`,
    password = `legacy-${suffix}-password`,
    verified = 0,
    pendingEmail = null,
    googleId = null,
    permissions = null
} = {}) {
    const qrCode = `P10-B3-${suffix}`;
    const inserted = await run(
        database,
        `INSERT INTO youth
            (name, email, qr_code, password, google_id, email_verified, email_verified_at,
             pending_email, pending_email_requested_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [`P10 B3 ${suffix}`, email, qrCode, password, googleId, verified,
            verified ? Date.now() : null, pendingEmail, pendingEmail ? Date.now() : null]
    );
    let userId = null;
    if (permissions !== null) {
        const user = await run(
            database,
            `INSERT INTO users (username, password, permissions, youth_id, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [`${qrCode}-USER`, password, JSON.stringify(permissions), inserted.lastID]
        );
        userId = user.lastID;
    }
    return {
        youthId: inserted.lastID,
        userId,
        qrCode,
        email: email.trim().toLowerCase(),
        pendingEmail: pendingEmail ? pendingEmail.trim().toLowerCase() : null
    };
}

function createSession(sessionStore, fixture, suffix) {
    const sessionId = `p10-b3-${suffix}-${fixture.youthId}`;
    sessionStore.set(sessionId, {
        userId: fixture.userId,
        youthId: fixture.youthId,
        username: fixture.userId ? `${fixture.qrCode}-USER` : fixture.qrCode,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000
    });
    return `koinonia_session=${sessionId}`;
}

async function acceptCurrentLegalPolicies(database, userId) {
    const terms = await get(database, "SELECT version, content_sha256 FROM legal_policy_versions WHERE policy_type = 'terms'");
    const privacy = await get(database, "SELECT version, content_sha256 FROM legal_policy_versions WHERE policy_type = 'privacy'");
    await run(
        database,
        `INSERT INTO legal_acceptances
            (user_id, terms_version, privacy_version, terms_sha256, privacy_sha256, accepted_at, source)
         VALUES (?, ?, ?, ?, ?, ?, 'existing_user_gate')`,
        [userId, terms.version, privacy.version, terms.content_sha256, privacy.content_sha256, Date.now()]
    );
}

async function latestVerificationToken(database, encryptionKey, youthId, targetEmail = null) {
    const tokenRow = await get(
        database,
        `SELECT * FROM auth_one_time_tokens
         WHERE purpose = 'email_verification' AND youth_id = ?
           AND (? IS NULL OR target_email = ?)
         ORDER BY id DESC LIMIT 1`,
        [youthId, targetEmail, targetEmail]
    );
    assert.ok(tokenRow);
    const outboxRow = await get(
        database,
        `SELECT * FROM email_outbox
         WHERE message_type = 'email_verification' AND recipient = ?
         ORDER BY id DESC LIMIT 1`,
        [tokenRow.target_email]
    );
    assert.ok(outboxRow);
    const payload = decryptOutboxPayload({
        version: outboxRow.encryption_version,
        ciphertext: outboxRow.payload_ciphertext,
        iv: outboxRow.payload_iv,
        tag: outboxRow.payload_tag
    }, encryptionKey);
    const match = /https:\/\/staging\.fogmin\.site\/verify-email#([A-Za-z0-9_-]{43})/.exec(payload.text);
    assert.ok(match);
    return { rawToken: match[1], tokenRow, outboxRow, payload };
}

function encodeGooglePayload(payload) {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

test('verified email and pending email changes fail closed across application flows', { concurrency: false }, async t => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-email-verification-'));
    const encryptionKey = crypto.randomBytes(32).toString('base64url');
    const savedEnvironment = {
        KOINONIA_PUBLIC_ORIGIN: process.env.KOINONIA_PUBLIC_ORIGIN,
        EMAIL_OUTBOX_ENCRYPTION_KEY: process.env.EMAIL_OUTBOX_ENCRYPTION_KEY
    };
    let database;
    let httpServer;

    t.after(async () => {
        if (httpServer) await new Promise(resolve => httpServer.close(resolve));
        if (database) await closeDatabase(database);
        for (const [name, value] of Object.entries(savedEnvironment)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
        delete global.__koinoniaEmailVerificationTransport;
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'js'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    const source = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const fakeVerifier = `const googleClient = {
        async verifyIdToken({ idToken }) {
            const payload = JSON.parse(Buffer.from(idToken, 'base64url').toString('utf8'));
            return { getPayload() { return payload; } };
        }
    };`;
    const isolatedSource = source
        .replace("process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));", '')
        .replace("process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));", '')
        .replace(
            "const googleClient = new OAuth2Client('100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com');",
            fakeVerifier
        )
        .replace('N: 32768,', 'N: 1024,')
        .replace('const PASSWORD_RECOVERY_WORKER_INTERVAL_MS = 30 * 1000;', 'const PASSWORD_RECOVERY_WORKER_INTERVAL_MS = 60 * 60 * 1000;')
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
            'module.exports = { app, db, sessionStore, applyDeterministicRuntimeMigration, ready: applyDeterministicRuntimeMigration() };'
        );
    assert.notEqual(isolatedSource, source);
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'legal-acceptance.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.writeFile(
        path.join(temporaryRoot, 'lib', 'email-transport.js'),
        `'use strict';\nmodule.exports = { createEmailTransportFromEnv() { return global.__koinoniaEmailVerificationTransport; } };\n`
    );
    for (const filename of ['verify-email.html', 'reset-password.html']) {
        await fsp.copyFile(path.join(repositoryRoot, 'public', filename), path.join(temporaryRoot, 'public', filename));
    }
    for (const directory of ['legal', 'privacy', 'terms']) {
        await fsp.cp(
            path.join(repositoryRoot, 'public', directory),
            path.join(temporaryRoot, 'public', directory),
            { recursive: true }
        );
    }
    for (const filename of ['verify-email.js', 'reset-password.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'public', 'js', filename), path.join(temporaryRoot, 'public', 'js', filename));
    }
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');

    const transportCalls = [];
    global.__koinoniaEmailVerificationTransport = {
        async send(message) {
            transportCalls.push(message);
            return { providerMessageId: 'mock-only' };
        }
    };
    process.env.KOINONIA_PUBLIC_ORIGIN = 'https://staging.fogmin.site';
    process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = encryptionKey;

    const application = require(path.join(temporaryRoot, 'server.js'));
    await application.ready;
    database = application.db;
    httpServer = await new Promise((resolve, reject) => {
        const server = application.app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(server));
        server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${httpServer.address().port}`;
    const tokenStore = createAuthTokenStore({ database });

    await t.test('privacy and terms pages are publicly available without a session', async () => {
        for (const pathname of ['/privacy/', '/terms/']) {
            const response = await fetch(`${origin}${pathname}`, { redirect: 'manual' });
            assert.equal(response.status, 200);
            assert.match(response.headers.get('content-type'), /^text\/html/);
            const html = await response.text();
            assert.match(html, /Fire Of God Ministries/);
            assert.match(html, /support@fogmin\.site/);
        }
    });

    await t.test('migration is additive, defaults legacy/Google rows to unverified, and creates no unique email index', async () => {
        const columns = await all(database, 'PRAGMA table_info(youth)');
        const byName = Object.fromEntries(columns.map(column => [column.name, column]));
        assert.equal(byName.email_verified.notnull, 1);
        assert.equal(String(byName.email_verified.dflt_value), '0');
        assert.ok(byName.email_verified_at);
        assert.ok(byName.pending_email);
        assert.ok(byName.pending_email_requested_at);
        const legacyGoogle = await createMember(database, 'LEGACY-GOOGLE', { googleId: 'legacy-google', verified: 0 });
        await application.applyDeterministicRuntimeMigration();
        assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [legacyGoogle.youthId])).email_verified, 0);
        assert.equal((await all(database, 'PRAGMA table_info(youth)')).filter(column => (
            ['email_verified', 'email_verified_at', 'pending_email', 'pending_email_requested_at'].includes(column.name)
        )).length, 4);
        const uniqueEmailIndexes = await all(
            database,
            `SELECT name FROM sqlite_master
             WHERE type = 'index' AND tbl_name = 'youth' AND sql LIKE '%UNIQUE%' AND sql LIKE '%email%'`
        );
        assert.equal(uniqueEmailIndexes.length, 0);
    });

    await t.test('verification page uses fragments only and cannot persist or transmit the token in a URL', async () => {
        const syntheticToken = 'V'.repeat(43);
        const page = await fetch(`${origin}/verify-email#${syntheticToken}`);
        assert.equal(page.status, 200);
        assert.equal(page.url, `${origin}/verify-email`);
        assert.match(page.headers.get('cache-control'), /no-store/);
        assert.equal(page.headers.get('referrer-policy'), 'no-referrer');
        const html = await page.text();
        assert.match(html, /<meta name="referrer" content="no-referrer">/);
        assert.match(html, /<meta name="robots" content="noindex, nofollow">/);
        assert.equal((await fetch(`${origin}/verify-email/${syntheticToken}`)).status, 404);
        const script = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'verify-email.js'), 'utf8');
        assert.match(script, /window\.location\.hash/);
        assert.match(script, /history\.replaceState\(null, '', '\/verify-email'\)/);
        assert.doesNotMatch(script, /location\.pathname|location\.search|localStorage|sessionStorage|indexedDB|caches\s*\.|console\./);
        const worker = await fsp.readFile(path.join(repositoryRoot, 'public', 'sw.js'), 'utf8');
        assert.match(worker, /url\.pathname === '\/verify-email'/);
        assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
        const index = await fsp.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
        const appScript = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');
        assert.match(index, /id="myEmailVerificationStatus"/);
        assert.match(index, /id="verifyMyEmailBtn"/);
        assert.match(index, /id="cancelMyEmailChangeBtn"/);
        assert.match(appScript, /status\.textContent = member\.email_verified === 1 \? 'Verified' : 'Not verified'/);
        assert.match(appScript, /Waiting for confirmation:/);
    });

    const currentFixture = await createMember(database, 'CURRENT', { verified: 0, permissions: [] });
    const currentCookie = createSession(application.sessionStore, currentFixture, 'current');
    await t.test('authenticated canonical request queues one hashed token and encrypted fragment link', async () => {
        assert.equal((await requestJson(origin, '/api/auth/email-verification/request')).status, 401);
        const response = await requestJson(origin, '/api/auth/email-verification/request', {
            cookie: currentCookie,
            body: { youth_id: currentFixture.youthId + 9999 }
        });
        assert.equal(response.status, 200);
        assert.match(response.cacheControl, /no-store/);
        const issued = await latestVerificationToken(database, encryptionKey, currentFixture.youthId);
        assert.match(issued.tokenRow.token_hash, /^[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(issued.tokenRow).includes(issued.rawToken), false);
        assert.equal(JSON.stringify(issued.outboxRow).includes(issued.rawToken), false);
        assert.equal(issued.payload.deliveryNotAfter - issued.tokenRow.created_at, 24 * 60 * 60 * 1000);
        assert.equal(issued.payload.minimumRemainingValidityMs, 30 * 60 * 1000);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM auth_one_time_tokens WHERE youth_id = ?', [currentFixture.youthId])).count, 1);
        const repeated = await requestJson(origin, '/api/auth/email-verification/request', { cookie: currentCookie });
        assert.equal(repeated.status, 200);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM auth_one_time_tokens WHERE youth_id = ?', [currentFixture.youthId])).count, 1);
        assert.equal(transportCalls.length, 0);
    });

    await t.test('current-email confirmation is atomic, enables recovery, and replay fails', async () => {
        assert.equal((await findPasswordRecoveryIdentity(database, currentFixture.email)).status, 'unverified');
        const issued = await latestVerificationToken(database, encryptionKey, currentFixture.youthId);
        const confirmed = await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: issued.rawToken }
        });
        assert.equal(confirmed.status, 200);
        const member = await get(database, 'SELECT email_verified, email_verified_at FROM youth WHERE id = ?', [currentFixture.youthId]);
        assert.equal(member.email_verified, 1);
        assert.ok(member.email_verified_at);
        assert.equal((await findPasswordRecoveryIdentity(database, currentFixture.email)).status, 'eligible');
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: issued.rawToken }
        })).status, 400);
    });

    await t.test('cancelling a pending change clears it and invalidates its verification link', async () => {
        const fixture = await createMember(database, 'CANCEL', { verified: 1, permissions: [] });
        await acceptCurrentLegalPolicies(database, fixture.userId);
        const cookie = createSession(application.sessionStore, fixture, 'cancel');
        const pendingEmail = 'cancelled-change@example.test';
        assert.equal((await requestJson(origin, `/api/youth/profile/${fixture.youthId}`, {
            method: 'PUT', cookie,
            body: {
                name: 'Cancel Change', email: pendingEmail, age: 24, birthday: '',
                social_media: '', parents_name: '', gender: ''
            }
        })).status, 200);
        const issued = await latestVerificationToken(database, encryptionKey, fixture.youthId, pendingEmail);
        assert.equal((await requestJson(origin, '/api/auth/email-verification/cancel', { cookie })).status, 200);
        const member = await get(database, 'SELECT email, email_verified, pending_email FROM youth WHERE id = ?', [fixture.youthId]);
        assert.deepEqual(member, { email: fixture.email, email_verified: 1, pending_email: null });
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: issued.rawToken }
        })).status, 400);
    });

    await t.test('concurrent confirmation has one winner and a failed mutation leaves the token reusable', async () => {
        const concurrent = await createMember(database, 'CONCURRENT', { permissions: [] });
        const concurrentCookie = createSession(application.sessionStore, concurrent, 'concurrent');
        await requestJson(origin, '/api/auth/email-verification/request', { cookie: concurrentCookie });
        const issued = await latestVerificationToken(database, encryptionKey, concurrent.youthId);
        const concurrentResults = await Promise.all([
            requestJson(origin, '/api/auth/email-verification/confirm', { body: { token: issued.rawToken } }),
            requestJson(origin, '/api/auth/email-verification/confirm', { body: { token: issued.rawToken } })
        ]);
        assert.deepEqual(concurrentResults.map(result => result.status).sort(), [200, 400]);

        const rollback = await createMember(database, 'ROLLBACK', { permissions: [] });
        const rollbackCookie = createSession(application.sessionStore, rollback, 'rollback');
        await requestJson(origin, '/api/auth/email-verification/request', { cookie: rollbackCookie });
        const rollbackToken = await latestVerificationToken(database, encryptionKey, rollback.youthId);
        await run(
            database,
            `CREATE TRIGGER p10_b3_verification_failure
             BEFORE UPDATE OF email_verified ON youth
             WHEN NEW.id = ${Number(rollback.youthId)}
             BEGIN SELECT RAISE(ABORT, 'simulated verification failure'); END`
        );
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: rollbackToken.rawToken }
        })).status, 500);
        assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [rollback.youthId])).email_verified, 0);
        assert.equal((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [rollbackToken.tokenRow.id])).used_at, null);
        await run(database, 'DROP TRIGGER p10_b3_verification_failure');
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: rollbackToken.rawToken }
        })).status, 200);
    });

    await t.test('target mismatch and expiration fail closed without consuming verification tokens', async () => {
        const fixture = await createMember(database, 'MISMATCH');
        const mismatch = await tokenStore.issue({
            purpose: 'email_verification', youthId: fixture.youthId,
            email: 'different@example.test', ttlMs: 60_000
        });
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: mismatch.rawToken }
        })).status, 400);
        assert.equal((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [mismatch.id])).used_at, null);
        const expired = await tokenStore.issue({
            purpose: 'email_verification', youthId: fixture.youthId,
            email: fixture.email, ttlMs: 60_000
        });
        await run(database, 'UPDATE auth_one_time_tokens SET expires_at = 1 WHERE id = ?', [expired.id]);
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: expired.rawToken }
        })).status, 400);
    });

    await t.test('self email change remains pending, supersedes old verification, swaps atomically, and revokes reset tokens', async () => {
        const fixture = await createMember(database, 'SELF-CHANGE', { verified: 1, permissions: [] });
        await acceptCurrentLegalPolicies(database, fixture.userId);
        const cookie = createSession(application.sessionStore, fixture, 'self-change');
        const resetToken = await tokenStore.issue({
            purpose: 'password_reset', youthId: fixture.youthId, email: fixture.email, ttlMs: 60_000
        });
        const firstPendingEmail = 'first-self-change@example.test';
        assert.equal((await requestJson(origin, `/api/youth/profile/${fixture.youthId}`, {
            method: 'PUT', cookie,
            body: {
                name: 'Updated Self', email: firstPendingEmail, age: 25, birthday: '',
                social_media: '', parents_name: '', gender: ''
            }
        })).status, 200);
        const supersededVerification = await latestVerificationToken(
            database,
            encryptionKey,
            fixture.youthId,
            firstPendingEmail
        );
        const newEmail = 'new-self-change@example.test';
        const update = await requestJson(origin, `/api/youth/profile/${fixture.youthId}`, {
            method: 'PUT', cookie,
            body: {
                name: 'Updated Self', email: newEmail, age: 25, birthday: '',
                social_media: '', parents_name: '', gender: ''
            }
        });
        assert.equal(update.status, 200);
        assert.equal(update.body.member.email, fixture.email);
        assert.equal(update.body.member.pending_email, newEmail);
        assert.equal(update.body.member.email_verified, 1);
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: supersededVerification.rawToken }
        })).status, 400);
        const verification = await latestVerificationToken(database, encryptionKey, fixture.youthId, newEmail);
        const confirmed = await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: verification.rawToken }
        });
        assert.equal(confirmed.status, 200);
        const member = await get(database, 'SELECT * FROM youth WHERE id = ?', [fixture.youthId]);
        assert.equal(member.email, newEmail);
        assert.equal(member.email_verified, 1);
        assert.equal(member.pending_email, null);
        assert.equal(member.pending_email_requested_at, null);
        assert.notEqual(member.email_verified_at, null);
        assert.notEqual((await get(database, 'SELECT revoked_at FROM auth_one_time_tokens WHERE id = ?', [resetToken.id])).revoked_at, null);
        assert.ok(await get(database, "SELECT id FROM email_outbox WHERE message_type = 'email_changed' AND recipient = ?", [fixture.email]));

        const thirdPendingEmail = 'third-self-change@example.test';
        assert.equal((await requestJson(origin, `/api/youth/profile/${fixture.youthId}`, {
            method: 'PUT', cookie,
            body: {
                name: 'Updated Self', email: thirdPendingEmail, age: 25, birthday: '',
                social_media: '', parents_name: '', gender: ''
            }
        })).status, 200);
        assert.equal((await requestJson(origin, `/api/youth/profile/${fixture.youthId}`, {
            method: 'PUT', cookie,
            body: {
                name: 'Updated Self', email: 'rate-limited-change@example.test', age: 25,
                birthday: '', social_media: '', parents_name: '', gender: ''
            }
        })).status, 429);
        assert.equal(
            (await get(database, 'SELECT pending_email FROM youth WHERE id = ?', [fixture.youthId])).pending_email,
            thirdPendingEmail
        );
    });

    await t.test('same-email save preserves trust while staff email edits clear trust and pending state', async () => {
        const same = await createMember(database, 'SAME', { verified: 1, permissions: [] });
        await acceptCurrentLegalPolicies(database, same.userId);
        const sameCookie = createSession(application.sessionStore, same, 'same');
        assert.equal((await requestJson(origin, `/api/youth/profile/${same.youthId}`, {
            method: 'PUT', cookie: sameCookie,
            body: { name: 'Same', email: ` ${same.email.toUpperCase()} `, age: 20, birthday: '', social_media: '', parents_name: '', gender: '' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [same.youthId])).email_verified, 1);

        const staff = await createMember(database, 'STAFF', { verified: 1, permissions: ['edit_entries'] });
        await acceptCurrentLegalPolicies(database, staff.userId);
        const target = await createMember(database, 'STAFF-TARGET', {
            verified: 1, pendingEmail: 'old-pending@example.test'
        });
        const staffCookie = createSession(application.sessionStore, staff, 'staff');
        const verification = await tokenStore.issue({
            purpose: 'email_verification', youthId: target.youthId, email: target.pendingEmail || 'old-pending@example.test', ttlMs: 60_000
        });
        const reset = await tokenStore.issue({
            purpose: 'password_reset', youthId: target.youthId, email: target.email, ttlMs: 60_000
        });
        const response = await requestJson(origin, `/api/youth-v37/profile/${target.youthId}`, {
            method: 'PUT', cookie: staffCookie,
            body: {
                name: 'Staff Target', email: 'leader-entered@example.test', age: 30,
                birthday: '', gender: '', mobile: '', address: '', social_media: '', parents_name: ''
            }
        });
        assert.equal(response.status, 200);
        assert.equal(Object.prototype.hasOwnProperty.call(response.body.member, 'pending_email'), false);
        const changed = await get(database, 'SELECT * FROM youth WHERE id = ?', [target.youthId]);
        assert.equal(changed.email, 'leader-entered@example.test');
        assert.equal(changed.email_verified, 0);
        assert.equal(changed.email_verified_at, null);
        assert.equal(changed.pending_email, null);
        assert.notEqual((await get(database, 'SELECT revoked_at FROM auth_one_time_tokens WHERE id = ?', [verification.id])).revoked_at, null);
        assert.notEqual((await get(database, 'SELECT revoked_at FROM auth_one_time_tokens WHERE id = ?', [reset.id])).revoked_at, null);
    });

    await t.test('existing password login needs no prospective legal acceptance and creates none', async () => {
        const fixture = await createMember(database, 'LEGAL-EXISTING-LOGIN', { permissions: [] });
        const before = (await get(database, 'SELECT COUNT(*) count FROM legal_acceptances')).count;
        const response = await requestJson(origin, '/api/login', {
            body: { username: `${fixture.qrCode}-USER`, password: 'legacy-LEGAL-EXISTING-LOGIN-password' }
        });
        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM legal_acceptances')).count, before);
    });

    await t.test('Wanderer registration normalizes duplicates, starts unverified, and queues encrypted verification', async () => {
        const email = 'new-wanderer@example.test';
        for (const legalAccepted of [undefined, false]) {
            const rejected = await requestJson(origin, '/api/public/register-wanderer', {
                body: {
                    name: 'Rejected Wanderer', email,
                    password: 'Wanderer-Password-1',
                    ...(legalAccepted === undefined ? {} : { legal_accepted: legalAccepted })
                }
            });
            assert.equal(rejected.status, 400);
        }
        assert.equal(await get(database, 'SELECT id FROM youth WHERE email = ?', [email]), null);
        const created = await requestJson(origin, '/api/public/register-wanderer', {
            body: {
                name: 'New Wanderer', email: ` New-Wanderer@Example.Test `,
                password: 'Wanderer-Password-1', legal_accepted: true,
                user_id: 999999, source: 'forged', terms_version: 'forged',
                privacy_version: 'forged', accepted_at: 1
            }
        });
        assert.equal(created.status, 200);
        const member = await get(database, 'SELECT * FROM youth WHERE email = ?', [email]);
        assert.ok(member);
        assert.equal(member.email_verified, 0);
        assert.equal(member.email_verified_at, null);
        assert.ok(await get(database, "SELECT id FROM auth_one_time_tokens WHERE youth_id = ? AND purpose = 'email_verification'", [member.id]));
        const linkedUser = await get(database, 'SELECT id FROM users WHERE youth_id = ?', [member.id]);
        assert.ok(linkedUser);
        const registrationAcceptance = await get(
            database,
            `SELECT id, user_id, terms_version, privacy_version, terms_sha256,
                    privacy_sha256, source
             FROM legal_acceptances WHERE user_id = ?`,
            [linkedUser.id]
        );
        assert.equal(registrationAcceptance.user_id, linkedUser.id);
        assert.equal(registrationAcceptance.terms_version, '2026-09-11');
        assert.equal(registrationAcceptance.privacy_version, '2026-09-11');
        assert.equal(registrationAcceptance.source, 'registration');
        assert.match(registrationAcceptance.terms_sha256, /^[a-f0-9]{64}$/);
        assert.match(registrationAcceptance.privacy_sha256, /^[a-f0-9]{64}$/);
        const registrationAudit = await get(
            database,
            `SELECT username, details FROM activity_logs
             WHERE action = 'LEGAL_ACCEPTANCE_RECORDED'
             ORDER BY id DESC LIMIT 1`
        );
        assert.equal(registrationAudit.username, `User ${linkedUser.id}`);
        assert.deepEqual(JSON.parse(registrationAudit.details), {
            acceptance_id: registrationAcceptance.id,
            user_id: linkedUser.id,
            terms_version: '2026-09-11',
            privacy_version: '2026-09-11',
            source: 'registration',
            terms_sha256: registrationAcceptance.terms_sha256,
            privacy_sha256: registrationAcceptance.privacy_sha256
        });
        const duplicate = await requestJson(origin, '/api/public/register-wanderer', {
            body: {
                name: 'Duplicate', email: 'NEW-WANDERER@example.test',
                password: 'Wanderer-Password-2', legal_accepted: true
            }
        });
        assert.equal(duplicate.status, 409);
        const rateLimitedAcrossRegistrationRoutes = await requestJson(origin, '/api/youth', {
            body: { name: 'Rate Limited Duplicate', email }
        });
        assert.equal(rateLimitedAcrossRegistrationRoutes.status, 429);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM youth WHERE LOWER(TRIM(email)) = ?', [email])).count, 1);
    });

    await t.test('verification enqueue failure leaves a complete unverified registration and revokes its unusable token', async () => {
        await run(
            database,
            `CREATE TRIGGER p10_b3_registration_queue_failure
             BEFORE INSERT ON email_outbox
             WHEN NEW.message_type = 'email_verification'
             BEGIN SELECT RAISE(ABORT, 'simulated verification queue failure'); END`
        );
        const email = 'queue-failure@example.test';
        const created = await requestJson(origin, '/api/public/register-wanderer', {
            body: {
                name: 'Queue Failure', email, password: 'Wanderer-Password-3',
                legal_accepted: true
            }
        });
        await run(database, 'DROP TRIGGER p10_b3_registration_queue_failure');
        assert.equal(created.status, 200);
        assert.equal(created.body.email_verification_queued, false);
        const member = await get(database, 'SELECT id, email_verified FROM youth WHERE email = ?', [email]);
        assert.ok(member);
        assert.equal(member.email_verified, 0);
        const token = await get(
            database,
            `SELECT used_at, revoked_at FROM auth_one_time_tokens
             WHERE youth_id = ? AND purpose = 'email_verification' ORDER BY id DESC LIMIT 1`,
            [member.id]
        );
        assert.equal(token.used_at, null);
        assert.notEqual(token.revoked_at, null);
    });

    await t.test('legacy duplicate verified emails remain separate and ineligible for password recovery', async () => {
        const first = await createMember(database, 'DUPLICATE-ONE', { email: ' Shared@Example.test ', verified: 1 });
        const second = await createMember(database, 'DUPLICATE-TWO', { email: 'shared@EXAMPLE.test', verified: 1 });
        assert.equal((await findPasswordRecoveryIdentity(database, 'shared@example.test')).status, 'ambiguous');
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM youth WHERE id IN (?, ?)', [first.youthId, second.youthId])).count, 2);
    });

    await t.test('forgot-password stays neutral and reset completion never marks an email verified', async () => {
        const verified = await createMember(database, 'RECOVERY-VERIFIED', { verified: 1 });
        const unverified = await createMember(database, 'RECOVERY-UNVERIFIED', { verified: 0 });
        const eligibleResponse = await requestJson(origin, '/api/auth/forgot-password', {
            body: { email: verified.email }
        });
        const ineligibleResponse = await requestJson(origin, '/api/auth/forgot-password', {
            body: { email: unverified.email }
        });
        assert.equal(eligibleResponse.status, 200);
        assert.equal(ineligibleResponse.status, 200);
        assert.deepEqual(ineligibleResponse.body, eligibleResponse.body);
        assert.equal(
            (await get(database, "SELECT COUNT(*) count FROM auth_one_time_tokens WHERE youth_id = ? AND purpose = 'password_reset'", [unverified.youthId])).count,
            0
        );

        const reset = await tokenStore.issue({
            purpose: 'password_reset',
            youthId: unverified.youthId,
            email: unverified.email,
            ttlMs: 60_000
        });
        assert.equal((await requestJson(origin, '/api/auth/reset-password', {
            body: { token: reset.rawToken, password: 'Changed-But-Still-Unverified' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [unverified.youthId])).email_verified, 0);
    });

    await t.test('Google verifies existing identities without acceptance and gates new account persistence', async () => {
        const acceptanceCountBeforeExistingLogins = (
            await get(database, 'SELECT COUNT(*) count FROM legal_acceptances')
        ).count;
        const exact = await createMember(database, 'GOOGLE-EXACT', { verified: 0 });
        const exactResponse = await requestJson(origin, '/api/auth/google', {
            body: { token: encodeGooglePayload({
                sub: 'google-exact-subject', email: exact.email, email_verified: true, name: 'Exact'
            }) }
        });
        assert.equal(exactResponse.status, 200);
        assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [exact.youthId])).email_verified, 1);

        const linkedExact = await createMember(database, 'GOOGLE-LINKED-EXACT', {
            verified: 0,
            googleId: 'google-linked-exact-subject'
        });
        const linkedExactResponse = await requestJson(origin, '/api/auth/google', {
            body: { token: encodeGooglePayload({
                sub: 'google-linked-exact-subject', email: linkedExact.email,
                email_verified: true, name: 'Linked Exact'
            }) }
        });
        assert.equal(linkedExactResponse.status, 200);
        assert.equal(linkedExactResponse.body.member.email_verified, 1);
        assert.equal((await get(database, 'SELECT email_verified FROM youth WHERE id = ?', [linkedExact.youthId])).email_verified, 1);

        const different = await createMember(database, 'GOOGLE-DIFFERENT', {
            email: 'stored-different@example.test', verified: 0, googleId: 'google-different-subject'
        });
        assert.equal((await requestJson(origin, '/api/auth/google', {
            body: { token: encodeGooglePayload({
                sub: 'google-different-subject', email: 'verified-google@example.test', email_verified: true, name: 'Different'
            }) }
        })).status, 200);
        const unchanged = await get(database, 'SELECT email, email_verified FROM youth WHERE id = ?', [different.youthId]);
        assert.deepEqual(unchanged, { email: 'stored-different@example.test', email_verified: 0 });
        assert.equal(
            (await get(database, 'SELECT COUNT(*) count FROM legal_acceptances')).count,
            acceptanceCountBeforeExistingLogins
        );

        const collisionPending = await requestJson(origin, '/api/auth/google', {
            body: { token: encodeGooglePayload({
                sub: 'google-collision-subject', email: 'google-collision@example.test',
                email_verified: true, name: 'Google Collision'
            }) }
        });
        assert.equal(collisionPending.status, 202);
        const collisionCookie = /koinonia_pending_google_signup=[^;]+/.exec(collisionPending.setCookie || '');
        assert.ok(collisionCookie);
        await run(
            database,
            `INSERT INTO users (username, permissions, created_at)
             VALUES ('google-collision@example.test', '[]', datetime('now'))`
        );
        assert.equal((await requestJson(origin, '/api/auth/google/complete-signup', {
            cookie: collisionCookie[0], body: { legal_accepted: true }
        })).status, 409);
        assert.equal(await get(database, "SELECT id FROM youth WHERE google_id = 'google-collision-subject'"), null);

        const pendingGoogle = await requestJson(origin, '/api/auth/google', {
            body: { token: encodeGooglePayload({
                sub: 'google-new-subject', email: 'google-new@example.test', email_verified: true, name: 'Google New'
            }) }
        });
        assert.equal(pendingGoogle.status, 202);
        assert.equal(pendingGoogle.body.legal_acceptance_required, true);
        assert.equal(await get(database, "SELECT id FROM youth WHERE google_id = 'google-new-subject'"), null);
        const pendingCookie = /koinonia_pending_google_signup=[^;]+/.exec(pendingGoogle.setCookie || '');
        assert.ok(pendingCookie);
        for (const legalAccepted of [undefined, false]) {
            const rejected = await requestJson(origin, '/api/auth/google/complete-signup', {
                cookie: pendingCookie[0],
                body: legalAccepted === undefined ? {} : { legal_accepted: legalAccepted }
            });
            assert.equal(rejected.status, 400);
        }
        assert.equal(await get(database, "SELECT id FROM youth WHERE google_id = 'google-new-subject'"), null);
        const completedGoogle = await requestJson(origin, '/api/auth/google/complete-signup', {
            cookie: pendingCookie[0],
            body: {
                legal_accepted: true, user_id: 999999, source: 'forged',
                terms_version: 'forged', privacy_version: 'forged', accepted_at: 1
            }
        });
        assert.equal(completedGoogle.status, 200);
        const newGoogle = await get(database, "SELECT id, email_verified, email_verified_at FROM youth WHERE google_id = 'google-new-subject'");
        assert.equal(newGoogle.email_verified, 1);
        assert.ok(newGoogle.email_verified_at);
        const googleUser = await get(database, 'SELECT id FROM users WHERE youth_id = ?', [newGoogle.id]);
        assert.ok(googleUser);
        const googleAcceptance = await get(
            database,
            `SELECT id, user_id, terms_version, privacy_version, terms_sha256,
                    privacy_sha256, source
             FROM legal_acceptances WHERE user_id = ?`,
            [googleUser.id]
        );
        assert.equal(googleAcceptance.user_id, googleUser.id);
        assert.equal(googleAcceptance.terms_version, '2026-09-11');
        assert.equal(googleAcceptance.privacy_version, '2026-09-11');
        assert.equal(googleAcceptance.source, 'google_signup');
        assert.match(googleAcceptance.terms_sha256, /^[a-f0-9]{64}$/);
        assert.match(googleAcceptance.privacy_sha256, /^[a-f0-9]{64}$/);
        const googleAudits = await all(
            database,
            `SELECT username, details FROM activity_logs
             WHERE action = 'LEGAL_ACCEPTANCE_RECORDED'`
        );
        const googleAudit = googleAudits.find(audit => JSON.parse(audit.details).user_id === googleUser.id);
        assert.ok(googleAudit);
        assert.equal(googleAudit.username, `User ${googleUser.id}`);
        assert.deepEqual(JSON.parse(googleAudit.details), {
            acceptance_id: googleAcceptance.id,
            user_id: googleUser.id,
            terms_version: '2026-09-11',
            privacy_version: '2026-09-11',
            source: 'google_signup',
            terms_sha256: googleAcceptance.terms_sha256,
            privacy_sha256: googleAcceptance.privacy_sha256
        });
    });

    await t.test('email-change notice queue failure never reverses a confirmed pending email', async () => {
        const fixture = await createMember(database, 'NOTICE-FAIL', {
            verified: 1, pendingEmail: 'notice-new@example.test', permissions: []
        });
        const cookie = createSession(application.sessionStore, fixture, 'notice-fail');
        await requestJson(origin, '/api/auth/email-verification/request', { cookie });
        const issued = await latestVerificationToken(database, encryptionKey, fixture.youthId, 'notice-new@example.test');
        await run(
            database,
            `CREATE TRIGGER p10_b3_notice_failure
             BEFORE INSERT ON email_outbox
             WHEN NEW.message_type = 'email_changed'
             BEGIN SELECT RAISE(ABORT, 'simulated notice failure'); END`
        );
        assert.equal((await requestJson(origin, '/api/auth/email-verification/confirm', {
            body: { token: issued.rawToken }
        })).status, 200);
        const member = await get(database, 'SELECT email, email_verified, pending_email FROM youth WHERE id = ?', [fixture.youthId]);
        assert.deepEqual(member, { email: 'notice-new@example.test', email_verified: 1, pending_email: null });
        await run(database, 'DROP TRIGGER p10_b3_notice_failure');
        assert.equal(transportCalls.length, 0);
    });
});
