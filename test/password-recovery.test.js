'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3').verbose();

const {
    createAuthTokenStore,
    decryptOutboxPayload
} = require('../lib/email-security');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const neutralMessage = 'If an eligible account matches that email, password reset instructions will be sent shortly.';

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

async function postJson(origin, pathname, body) {
    const response = await fetch(`${origin}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return {
        status: response.status,
        body: await response.json(),
        cacheControl: response.headers.get('cache-control'),
        pragma: response.headers.get('pragma'),
        setCookie: response.headers.get('set-cookie')
    };
}

async function countRows(database, table) {
    return (await get(database, `SELECT COUNT(*) AS count FROM ${table}`)).count;
}

async function createRecoveryMember(database, suffix, {
    email = `${suffix.toLowerCase()}@example.test`,
    youthPassword = `legacy-${suffix}-password`,
    linkedPasswords = []
} = {}) {
    const qrCode = `P10-B2-${suffix}`;
    const youth = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, email_verified, email_verified_at, created_at)
         VALUES (?, ?, ?, ?, 1, ?, datetime('now'))`,
        [`P10 B2 ${suffix}`, email, qrCode, youthPassword, Date.now()]
    );
    const userIds = [];
    for (let index = 0; index < linkedPasswords.length; index += 1) {
        const user = await run(
            database,
            `INSERT INTO users (username, password, permissions, youth_id, created_at)
             VALUES (?, ?, '[]', ?, datetime('now'))`,
            [`${qrCode}-U${index + 1}`, linkedPasswords[index], youth.lastID]
        );
        userIds.push(user.lastID);
    }
    return { youthId: youth.lastID, qrCode, email: email.trim().toLowerCase(), userIds };
}

async function latestResetToken(database, encryptionKey, youthId) {
    const tokenRow = await get(
        database,
        `SELECT * FROM auth_one_time_tokens
         WHERE purpose = 'password_reset' AND youth_id = ? ORDER BY id DESC LIMIT 1`,
        [youthId]
    );
    const outboxRow = await get(
        database,
        `SELECT * FROM email_outbox
         WHERE message_type = 'password_reset' AND recipient =
             (SELECT target_email FROM auth_one_time_tokens WHERE id = ?)
         ORDER BY id DESC LIMIT 1`,
        [tokenRow.id]
    );
    assert.ok(tokenRow);
    assert.ok(outboxRow);
    const payload = decryptOutboxPayload({
        version: outboxRow.encryption_version,
        ciphertext: outboxRow.payload_ciphertext,
        iv: outboxRow.payload_iv,
        tag: outboxRow.payload_tag
    }, encryptionKey);
    const match = /https:\/\/staging\.fogmin\.site\/reset-password#([A-Za-z0-9_-]{43})/.exec(payload.text);
    assert.ok(match, 'encrypted reset message contains the configured-origin reset link');
    return { rawToken: match[1], tokenRow, outboxRow, payload };
}

test('forgot/reset routes preserve enumeration resistance and atomic credential recovery', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-password-recovery-'));
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
        delete global.__koinoniaRecoveryTestTransport;
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'js'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });

    const source = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const isolatedSource = source
        .replace('N: 32768,', 'N: 1024,')
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
    assert.ok(isolatedSource.includes('N: 1024,'));
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.writeFile(
        path.join(temporaryRoot, 'lib', 'email-transport.js'),
        `'use strict';\nmodule.exports = { createEmailTransportFromEnv() { return global.__koinoniaRecoveryTestTransport; } };\n`
    );
    await fsp.copyFile(
        path.join(repositoryRoot, 'public', 'reset-password.html'),
        path.join(temporaryRoot, 'public', 'reset-password.html')
    );
    await fsp.copyFile(
        path.join(repositoryRoot, 'public', 'js', 'reset-password.js'),
        path.join(temporaryRoot, 'public', 'js', 'reset-password.js')
    );
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');

    const transportCalls = [];
    global.__koinoniaRecoveryTestTransport = {
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

    const eligible = await createRecoveryMember(database, 'ELIGIBLE', {
        email: ' Eligible@Example.test ',
        youthPassword: 'eligible-old-password',
        linkedPasswords: ['eligible-user-one', 'eligible-user-two']
    });
    await createRecoveryMember(database, 'DUPLICATE-A', {
        email: ' Duplicate@Example.test ', youthPassword: 'duplicate-a-password'
    });
    await createRecoveryMember(database, 'DUPLICATE-B', {
        email: 'duplicate@EXAMPLE.test', youthPassword: 'duplicate-b-password'
    });
    await createRecoveryMember(database, 'GOOGLE-ONLY', {
        email: 'google-only@example.test', youthPassword: null
    });

    await t.test('reset surface strips cache/referrer leakage and frontend stores no token', async () => {
        const syntheticToken = 'A'.repeat(43);
        const response = await fetch(`${origin}/reset-password#${syntheticToken}`);
        assert.equal(response.status, 200);
        assert.equal(response.url, `${origin}/reset-password`);
        assert.match(response.headers.get('cache-control'), /no-store/);
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
        const html = await response.text();
        assert.match(html, /<meta name="referrer" content="no-referrer">/);
        assert.match(html, /<script src="\/js\/reset-password\.js\?v=1"><\/script>/);

        const frontend = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'reset-password.js'), 'utf8');
        assert.match(frontend, /\^#\(\[A-Za-z0-9_-\]\{43\}\)\$\/\.exec\(window\.location\.hash\)/);
        assert.match(frontend, /history\.replaceState\(null, '', '\/reset-password'\)/);
        assert.doesNotMatch(frontend, /window\.location\.pathname/);
        assert.doesNotMatch(frontend, /localStorage|sessionStorage|indexedDB|caches\s*\./);
        const serviceWorker = await fsp.readFile(path.join(repositoryRoot, 'public', 'sw.js'), 'utf8');
        assert.match(serviceWorker, /url\.pathname === '\/reset-password'/);
        assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
        assert.match(serviceWorker, /request\.method !== 'GET'/);

        const tokenPathResponse = await fetch(`${origin}/reset-password/${syntheticToken}`);
        assert.equal(tokenPathResponse.status, 404);
    });

    await t.test('existing login UI exposes neutral recovery without changing Google sign-in', async () => {
        const indexHtml = await fsp.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
        const applicationScript = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');
        assert.match(indexHtml, />Forgot password\?<\/button>/);
        assert.match(indexHtml, /id="forgotPasswordForm"/);
        assert.match(indexHtml, /id="g_id_onload"/);
        assert.match(applicationScript, /fetch\('\/api\/auth\/forgot-password'/);
        assert.match(applicationScript, /showTabWithoutOnlineHooks\('forgotPasswordTab'\)/);
        assert.doesNotMatch(applicationScript, /Google-only|Google account/);
    });

    let publicNeutralResponse;
    await t.test('eligible request queues one encrypted hashed-token recovery message', async () => {
        const beforeTokens = await countRows(database, 'auth_one_time_tokens');
        const beforeOutbox = await countRows(database, 'email_outbox');
        publicNeutralResponse = await postJson(origin, '/api/auth/forgot-password', { email: ' ELIGIBLE@example.TEST ' });
        assert.equal(publicNeutralResponse.status, 200);
        assert.deepEqual(publicNeutralResponse.body, { success: true, message: neutralMessage });
        assert.match(publicNeutralResponse.cacheControl, /no-store/);
        assert.equal(publicNeutralResponse.pragma, 'no-cache');
        assert.equal(await countRows(database, 'auth_one_time_tokens'), beforeTokens + 1);
        assert.equal(await countRows(database, 'email_outbox'), beforeOutbox + 1);

        const issued = await latestResetToken(database, encryptionKey, eligible.youthId);
        assert.match(issued.tokenRow.token_hash, /^[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(issued.tokenRow).includes(issued.rawToken), false);
        assert.equal(JSON.stringify(issued.outboxRow).includes(issued.rawToken), false);
        assert.equal(issued.payload.deliveryNotAfter - issued.tokenRow.created_at, 60 * 60 * 1000);
        assert.equal(issued.payload.minimumRemainingValidityMs, 15 * 60 * 1000);
        assert.equal(transportCalls.length, 0);

        const repeated = await postJson(origin, '/api/auth/forgot-password', { email: eligible.email });
        assert.deepEqual(repeated.body, publicNeutralResponse.body);
        assert.equal(await countRows(database, 'auth_one_time_tokens'), beforeTokens + 1);
        assert.equal(await countRows(database, 'email_outbox'), beforeOutbox + 1);
    });

    await t.test('unknown, malformed, ambiguous, and Google-only requests are indistinguishable and issue nothing', async () => {
        const cases = [
            { email: 'unknown@example.test' },
            { email: 'not-an-email' },
            { email: 'duplicate@example.test' },
            { email: 'google-only@example.test' }
        ];
        for (const body of cases) {
            const beforeTokens = await countRows(database, 'auth_one_time_tokens');
            const beforeOutbox = await countRows(database, 'email_outbox');
            const response = await postJson(origin, '/api/auth/forgot-password', body);
            assert.equal(response.status, publicNeutralResponse.status);
            assert.deepEqual(response.body, publicNeutralResponse.body);
            assert.match(response.cacheControl, /no-store/);
            assert.equal(await countRows(database, 'auth_one_time_tokens'), beforeTokens);
            assert.equal(await countRows(database, 'email_outbox'), beforeOutbox);
        }
    });

    await t.test('wrong-purpose, expired, and used tokens share one generic rejection', async () => {
        const fixture = await createRecoveryMember(database, 'INVALID-TOKENS');
        const wrongPurpose = await tokenStore.issue({
            purpose: 'email_verification', youthId: fixture.youthId, email: fixture.email, ttlMs: 60_000
        });
        const expired = await tokenStore.issue({
            purpose: 'password_reset', youthId: fixture.youthId, email: fixture.email, ttlMs: 60_000
        });
        await run(database, 'UPDATE auth_one_time_tokens SET expires_at = 1 WHERE id = ?', [expired.id]);
        const used = await tokenStore.issue({
            purpose: 'password_reset', youthId: fixture.youthId, email: fixture.email, ttlMs: 60_000
        });
        await run(database, 'UPDATE auth_one_time_tokens SET used_at = ? WHERE id = ?', [Date.now(), used.id]);
        let genericBody;
        for (const candidate of [wrongPurpose.rawToken, expired.rawToken, used.rawToken]) {
            const response = await postJson(origin, '/api/auth/reset-password', {
                token: candidate, password: 'Valid-New-Password-1'
            });
            assert.equal(response.status, 400);
            genericBody ||= response.body;
            assert.deepEqual(response.body, genericBody);
            assert.match(response.cacheControl, /no-store/);
        }
    });

    await t.test('changed recovery email rejects reset without consuming the token', async () => {
        const fixture = await createRecoveryMember(database, 'EMAIL-CHANGED');
        const issued = await tokenStore.issue({
            purpose: 'password_reset', youthId: fixture.youthId, email: fixture.email, ttlMs: 60_000
        });
        await run(database, 'UPDATE youth SET email = ? WHERE id = ?', ['changed@example.test', fixture.youthId]);
        const response = await postJson(origin, '/api/auth/reset-password', {
            token: issued.rawToken, password: 'Changed-Email-Password-1'
        });
        assert.equal(response.status, 400);
        assert.equal((await get(database, 'SELECT password FROM youth WHERE id = ?', [fixture.youthId])).password, 'legacy-EMAIL-CHANGED-password');
        assert.equal((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [issued.id])).used_at, null);
    });

    await t.test('successful reset updates youth and every linked user, consumes once, invalidates only member sessions, and queues notice', async () => {
        const fixture = await createRecoveryMember(database, 'SUCCESS', {
            linkedPasswords: ['success-user-one', 'success-user-two']
        });
        application.sessionStore.set('success-one', { youthId: fixture.youthId });
        application.sessionStore.set('success-two', { youthId: String(fixture.youthId) });
        application.sessionStore.set('unrelated', { youthId: fixture.youthId + 9999 });
        await postJson(origin, '/api/auth/forgot-password', { email: fixture.email });
        const issued = await latestResetToken(database, encryptionKey, fixture.youthId);
        const newPassword = 'Successful-New-Password-1';
        const response = await postJson(origin, '/api/auth/reset-password', {
            token: issued.rawToken, password: newPassword
        });
        assert.equal(response.status, 200);
        assert.equal(response.setCookie, null);
        const youthHash = (await get(database, 'SELECT password FROM youth WHERE id = ?', [fixture.youthId])).password;
        assert.match(youthHash, /^scrypt\$v1\$/);
        const linkedHashes = (await all(database, 'SELECT password FROM users WHERE youth_id = ? ORDER BY id', [fixture.youthId]))
            .map(row => row.password);
        assert.deepEqual(linkedHashes, [youthHash, youthHash]);
        assert.notEqual((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [issued.tokenRow.id])).used_at, null);
        assert.equal(application.sessionStore.has('success-one'), false);
        assert.equal(application.sessionStore.has('success-two'), false);
        assert.equal(application.sessionStore.has('unrelated'), true);

        const notice = await get(
            database,
            "SELECT * FROM email_outbox WHERE message_type = 'password_changed' AND recipient = ? ORDER BY id DESC LIMIT 1",
            [fixture.email]
        );
        assert.ok(notice);
        const noticePayload = decryptOutboxPayload({
            version: notice.encryption_version,
            ciphertext: notice.payload_ciphertext,
            iv: notice.payload_iv,
            tag: notice.payload_tag
        }, encryptionKey);
        assert.equal(JSON.stringify(noticePayload).includes(newPassword), false);
        assert.equal(JSON.stringify(noticePayload).includes(issued.rawToken), false);

        const secondUse = await postJson(origin, '/api/auth/reset-password', {
            token: issued.rawToken, password: 'Must-Not-Replace-Password-1'
        });
        assert.equal(secondUse.status, 400);
        const newLogin = await postJson(origin, '/api/login', { username: `${fixture.qrCode}-U1`, password: newPassword });
        assert.equal(newLogin.status, 200);
        const oldLogin = await postJson(origin, '/api/login', { username: `${fixture.qrCode}-U1`, password: 'success-user-one' });
        assert.equal(oldLogin.status, 401);
    });

    await t.test('password update failure rolls back credentials and leaves the same token reusable', async () => {
        const fixture = await createRecoveryMember(database, 'ROLLBACK', {
            linkedPasswords: ['rollback-user-old']
        });
        await postJson(origin, '/api/auth/forgot-password', { email: fixture.email });
        const issued = await latestResetToken(database, encryptionKey, fixture.youthId);
        await run(
            database,
            `CREATE TRIGGER p10_b2_simulated_password_failure
             BEFORE UPDATE OF password ON users
             WHEN NEW.youth_id = ${Number(fixture.youthId)}
             BEGIN SELECT RAISE(ABORT, 'simulated password update failure'); END`
        );
        const failed = await postJson(origin, '/api/auth/reset-password', {
            token: issued.rawToken, password: 'Rollback-New-Password-1'
        });
        assert.equal(failed.status, 500);
        assert.equal((await get(database, 'SELECT password FROM youth WHERE id = ?', [fixture.youthId])).password, 'legacy-ROLLBACK-password');
        assert.equal((await get(database, 'SELECT password FROM users WHERE youth_id = ?', [fixture.youthId])).password, 'rollback-user-old');
        assert.equal((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [issued.tokenRow.id])).used_at, null);
        await run(database, 'DROP TRIGGER p10_b2_simulated_password_failure');
        const retried = await postJson(origin, '/api/auth/reset-password', {
            token: issued.rawToken, password: 'Rollback-New-Password-1'
        });
        assert.equal(retried.status, 200);
    });

    await t.test('concurrent reset redemption permits exactly one successful password transaction', async () => {
        const fixture = await createRecoveryMember(database, 'CONCURRENT', { linkedPasswords: ['concurrent-old'] });
        await postJson(origin, '/api/auth/forgot-password', { email: fixture.email });
        const issued = await latestResetToken(database, encryptionKey, fixture.youthId);
        const results = await Promise.all([
            postJson(origin, '/api/auth/reset-password', { token: issued.rawToken, password: 'Concurrent-Password-One' }),
            postJson(origin, '/api/auth/reset-password', { token: issued.rawToken, password: 'Concurrent-Password-Two' })
        ]);
        assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
        const youthHash = (await get(database, 'SELECT password FROM youth WHERE id = ?', [fixture.youthId])).password;
        assert.equal((await get(database, 'SELECT password FROM users WHERE youth_id = ?', [fixture.youthId])).password, youthHash);
    });

    await t.test('password-change notice enqueue failure never rolls back a completed password reset', async () => {
        const fixture = await createRecoveryMember(database, 'NOTICE-FAILURE');
        await postJson(origin, '/api/auth/forgot-password', { email: fixture.email });
        const issued = await latestResetToken(database, encryptionKey, fixture.youthId);
        await run(
            database,
            `CREATE TRIGGER p10_b2_simulated_notice_failure
             BEFORE INSERT ON email_outbox
             WHEN NEW.message_type = 'password_changed'
             BEGIN SELECT RAISE(ABORT, 'simulated notice enqueue failure'); END`
        );
        const response = await postJson(origin, '/api/auth/reset-password', {
            token: issued.rawToken, password: 'Notice-Failure-New-Password'
        });
        assert.equal(response.status, 200);
        assert.match((await get(database, 'SELECT password FROM youth WHERE id = ?', [fixture.youthId])).password, /^scrypt\$v1\$/);
        assert.notEqual((await get(database, 'SELECT used_at FROM auth_one_time_tokens WHERE id = ?', [issued.tokenRow.id])).used_at, null);
        await run(database, 'DROP TRIGGER p10_b2_simulated_notice_failure');
    });

    await t.test('IP-limited eligible and unknown requests remain identical and produce no work', async () => {
        const beforeTokens = await countRows(database, 'auth_one_time_tokens');
        const beforeOutbox = await countRows(database, 'email_outbox');
        const blockedEligible = await postJson(origin, '/api/auth/forgot-password', { email: 'blocked-eligible@example.test' });
        const blockedUnknown = await postJson(origin, '/api/auth/forgot-password', { email: 'blocked-unknown@example.test' });
        assert.equal(blockedEligible.status, 200);
        assert.deepEqual(blockedEligible.body, { success: true, message: neutralMessage });
        assert.deepEqual(blockedUnknown, blockedEligible);
        assert.equal(await countRows(database, 'auth_one_time_tokens'), beforeTokens);
        assert.equal(await countRows(database, 'email_outbox'), beforeOutbox);
        assert.equal(transportCalls.length, 0);
    });
});
