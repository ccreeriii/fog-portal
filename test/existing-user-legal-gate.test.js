'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function(error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
}

async function requestJson(origin, pathname, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${origin}${pathname}`, {
        method,
        headers: {
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(cookie ? { Cookie: cookie } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        redirect: 'manual'
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch (error) {}
    return {
        status: response.status,
        body: json,
        text,
        cacheControl: response.headers.get('cache-control'),
        vary: response.headers.get('vary'),
        setCookie: response.headers.get('set-cookie')
    };
}

function encodeGooglePayload(payload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

async function createIsolatedApplication() {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-existing-legal-gate-'));
    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public'), { recursive: true });
    for (const directory of ['terms', 'privacy']) {
        await fsp.cp(
            path.join(repositoryRoot, 'public', directory),
            path.join(temporaryRoot, 'public', directory),
            { recursive: true }
        );
    }
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');

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
        .replace('N: 32768,', 'N: 1024,')
        .replace('void runDatabaseBackup();', 'void Promise.resolve();')
        .replace(
            'setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);',
            'setInterval(() => {}, 1000 * 60 * 60).unref();'
        )
        .replace(
            'const PASSWORD_RECOVERY_WORKER_INTERVAL_MS = 30 * 1000;',
            'const PASSWORD_RECOVERY_WORKER_INTERVAL_MS = 60 * 60 * 1000;'
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
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of [
        'sqlite-backup.js',
        'email-security.js',
        'email-transport.js',
        'account-claim-security.js',
        'help-faq.js',
        'legal-acceptance.js'
    ]) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');

    const savedEnvironment = {
        PORT: process.env.PORT,
        KOINONIA_PUBLIC_ORIGIN: process.env.KOINONIA_PUBLIC_ORIGIN,
        EMAIL_OUTBOX_ENCRYPTION_KEY: process.env.EMAIL_OUTBOX_ENCRYPTION_KEY
    };
    process.env.PORT = '0';
    process.env.KOINONIA_PUBLIC_ORIGIN = 'https://staging.fogmin.site';
    delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;

    const application = require(path.join(temporaryRoot, 'server.js'));
    await application.ready;
    const httpServer = await new Promise((resolve, reject) => {
        const listener = application.app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(listener));
        listener.once('error', reject);
    });

    return {
        ...application,
        origin: `http://127.0.0.1:${httpServer.address().port}`,
        async close() {
            await new Promise(resolve => httpServer.close(resolve));
            await closeDatabase(application.db);
            for (const [name, value] of Object.entries(savedEnvironment)) {
                if (value === undefined) delete process.env[name];
                else process.env[name] = value;
            }
            await fsp.rm(temporaryRoot, { recursive: true, force: true });
        }
    };
}

async function createUser(database, suffix, { permissions = [], googleId = null } = {}) {
    const username = `LEGAL-${suffix}`;
    const youth = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, google_id, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        [`Legal ${suffix}`, `${suffix.toLowerCase()}@example.test`, username, `password-${suffix}`, googleId]
    );
    const user = await run(
        database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [username, `password-${suffix}`, JSON.stringify(permissions), youth.lastID]
    );
    return { userId: user.lastID, youthId: youth.lastID, username, password: `password-${suffix}` };
}

async function acceptCurrentDirectly(database, userId, source = 'registration') {
    const terms = await get(database, "SELECT * FROM legal_policy_versions WHERE policy_type = 'terms'");
    const privacy = await get(database, "SELECT * FROM legal_policy_versions WHERE policy_type = 'privacy'");
    return run(
        database,
        `INSERT INTO legal_acceptances
            (user_id, terms_version, privacy_version, terms_sha256, privacy_sha256, accepted_at, source)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, terms.version, privacy.version, terms.content_sha256,
            privacy.content_sha256, Date.now(), source]
    );
}

function createSession(application, fixture, suffix) {
    const sessionId = `legal-session-${suffix}-${crypto.randomBytes(8).toString('hex')}`;
    application.sessionStore.set(sessionId, {
        userId: fixture.userId,
        youthId: fixture.youthId,
        username: fixture.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000
    });
    return `koinonia_session=${sessionId}`;
}

test('existing-user legal gate is server-enforced, canonical, and version-aware', { concurrency: false }, async t => {
    const application = await createIsolatedApplication();
    t.after(() => application.close());

    const unaccepted = await createUser(application.db, 'UNACCEPTED');
    const accepted = await createUser(application.db, 'ACCEPTED');
    const activeSession = await createUser(application.db, 'ACTIVE-SESSION');
    const ordinary = await createUser(application.db, 'ORDINARY');
    const administrator = await createUser(application.db, 'ADMIN', { permissions: ['access_permissions'] });
    await acceptCurrentDirectly(application.db, accepted.userId);
    await acceptCurrentDirectly(application.db, ordinary.userId);
    await acceptCurrentDirectly(application.db, administrator.userId);

    await t.test('anonymous public behavior and public policies remain unchanged', async () => {
        assert.equal((await requestJson(application.origin, '/api/events')).status, 200);
        assert.equal((await requestJson(application.origin, '/api/legal/status')).status, 401);
        for (const pathname of ['/terms/', '/privacy/']) {
            const response = await fetch(`${application.origin}${pathname}`);
            assert.equal(response.status, 200);
        }
    });

    let unacceptedCookie;
    await t.test('password authentication succeeds before the missing acceptance is gated', async () => {
        const login = await requestJson(application.origin, '/api/login', {
            method: 'POST',
            body: { username: unaccepted.username, password: unaccepted.password }
        });
        assert.equal(login.status, 200);
        assert.equal(login.body.success, true);
        assert.equal(login.body.legal_acceptance_required, true);
        assert.equal(login.body.terms_version, '2026-09-11');
        assert.match(login.setCookie, /^koinonia_session=/);
        unacceptedCookie = login.setCookie.split(';', 1)[0];

        const blocked = await requestJson(application.origin, '/api/events', { cookie: unacceptedCookie });
        assert.equal(blocked.status, 428);
        assert.deepEqual(blocked.body, {
            success: false,
            legal_acceptance_required: true,
            terms_version: '2026-09-11',
            privacy_version: '2026-09-11'
        });
        assert.match(blocked.cacheControl, /no-store/);
        assert.match(blocked.cacheControl, /private/);
        assert.match(blocked.vary, /Cookie/);
    });

    await t.test('an already-active session is gated without a new login', async () => {
        const cookie = createSession(application, activeSession, 'predeployment');
        assert.equal((await requestJson(application.origin, '/api/events', { cookie })).status, 428);
    });

    await t.test('the gate allowlist preserves legal, Help/Support, recovery, claim, and logout flows', async () => {
        const probes = [
            ['/api/legal/status', { cookie: unacceptedCookie }, 200],
            ['/api/help/faq', { cookie: unacceptedCookie }, 200],
            ['/api/help/contact-support', { method: 'POST', cookie: unacceptedCookie, body: {} }, 400],
            ['/api/account-claim/preview', { method: 'POST', cookie: unacceptedCookie, body: {} }, 404],
            ['/api/auth/reset-password', { method: 'POST', cookie: unacceptedCookie, body: {} }, 400],
            ['/api/auth/email-verification/confirm', { method: 'POST', cookie: unacceptedCookie, body: {} }, 400],
            ['/api/public/arcade-leaderboards', { cookie: unacceptedCookie }, 200]
        ];
        for (const [pathname, options, expected] of probes) {
            const response = await requestJson(application.origin, pathname, options);
            assert.equal(response.status, expected, pathname);
            assert.notEqual(response.status, 428, pathname);
        }
    });

    await t.test('a failed acceptance insert creates neither acceptance nor success audit', async () => {
        const failing = await createUser(application.db, 'FAILING');
        const cookie = createSession(application, failing, 'failing');
        await run(application.db, `CREATE TRIGGER reject_gate_acceptance
            BEFORE INSERT ON legal_acceptances
            BEGIN SELECT RAISE(ABORT, 'simulated gate acceptance failure'); END`);
        const response = await requestJson(application.origin, '/api/legal/accept', {
            method: 'POST', cookie, body: { legal_accepted: true }
        });
        await run(application.db, 'DROP TRIGGER reject_gate_acceptance');
        assert.equal(response.status, 500);
        assert.equal(await get(application.db, 'SELECT id FROM legal_acceptances WHERE user_id = ?', [failing.userId]), null);
        const audits = await all(application.db, "SELECT details FROM activity_logs WHERE action = 'LEGAL_ACCEPTANCE_RECORDED'");
        assert.equal(audits.some(audit => JSON.parse(audit.details).user_id === failing.userId), false);
    });

    await t.test('explicit canonical acceptance unlocks immediately and records one bounded audit', async () => {
        const rejected = await requestJson(application.origin, '/api/legal/accept', {
            method: 'POST',
            cookie: unacceptedCookie,
            body: { legal_accepted: 'true', user_id: administrator.userId }
        });
        assert.equal(rejected.status, 400);
        assert.equal(await get(application.db, 'SELECT id FROM legal_acceptances WHERE user_id = ?', [unaccepted.userId]), null);

        const acceptedResponse = await requestJson(application.origin, '/api/legal/accept', {
            method: 'POST',
            cookie: unacceptedCookie,
            body: {
                legal_accepted: true,
                user_id: administrator.userId,
                terms_version: 'forged',
                privacy_version: 'forged',
                source: 'forged',
                accepted_at: 1
            }
        });
        assert.equal(acceptedResponse.status, 200);
        assert.equal(acceptedResponse.body.current, true);
        assert.equal((await requestJson(application.origin, '/api/events', { cookie: unacceptedCookie })).status, 200);

        const row = await get(application.db, 'SELECT * FROM legal_acceptances WHERE user_id = ?', [unaccepted.userId]);
        assert.equal(row.source, 'existing_user_gate');
        assert.equal(row.terms_version, '2026-09-11');
        assert.notEqual(row.user_id, administrator.userId);
        assert.match(row.terms_sha256, /^[a-f0-9]{64}$/);
        assert.match(row.privacy_sha256, /^[a-f0-9]{64}$/);

        const repeated = await requestJson(application.origin, '/api/legal/accept', {
            method: 'POST', cookie: unacceptedCookie, body: { legal_accepted: true }
        });
        assert.equal(repeated.status, 200);
        assert.equal((await get(application.db, 'SELECT COUNT(*) AS count FROM legal_acceptances WHERE user_id = ?', [unaccepted.userId])).count, 1);
        const audits = await all(application.db, "SELECT username, details FROM activity_logs WHERE action = 'LEGAL_ACCEPTANCE_RECORDED'");
        const matchingAudits = audits.filter(audit => JSON.parse(audit.details).user_id === unaccepted.userId);
        assert.equal(matchingAudits.length, 1);
        assert.equal(matchingAudits[0].username, `User ${unaccepted.userId}`);
        assert.equal(Object.hasOwn(JSON.parse(matchingAudits[0].details), 'session_id'), false);
    });

    await t.test('current acceptance preserves normal login and old versions require reacceptance', async () => {
        const currentLogin = await requestJson(application.origin, '/api/login', {
            method: 'POST', body: { username: accepted.username, password: accepted.password }
        });
        assert.equal(currentLogin.status, 200);
        assert.equal(currentLogin.body.legal_acceptance_required, false);
        const currentCookie = currentLogin.setCookie.split(';', 1)[0];
        assert.equal((await requestJson(application.origin, '/api/events', { cookie: currentCookie })).status, 200);

        const historical = await createUser(application.db, 'HISTORICAL');
        await run(
            application.db,
            `INSERT INTO legal_acceptances
                (user_id, terms_version, privacy_version, accepted_at, source)
             VALUES (?, '2025-01-01', '2025-01-01', ?, 'registration')`,
            [historical.userId, Date.now() - 1000]
        );
        const historicalCookie = createSession(application, historical, 'historical');
        assert.equal((await requestJson(application.origin, '/api/events', { cookie: historicalCookie })).status, 428);
        await requestJson(application.origin, '/api/legal/accept', {
            method: 'POST', cookie: historicalCookie, body: { legal_accepted: true }
        });
        const newest = await get(
            application.db,
            'SELECT source FROM legal_acceptances WHERE user_id = ? ORDER BY accepted_at DESC, id DESC LIMIT 1',
            [historical.userId]
        );
        assert.equal(newest.source, 'policy_reacceptance');
        assert.equal((await get(application.db, 'SELECT COUNT(*) AS count FROM legal_acceptances WHERE user_id = ?', [historical.userId])).count, 2);
    });

    await t.test('Google existing-account gate and new-account pending signup remain distinct', async () => {
        const googleMissing = await createUser(application.db, 'GOOGLE-MISSING', { googleId: 'google-missing' });
        const googleCurrent = await createUser(application.db, 'GOOGLE-CURRENT', { googleId: 'google-current' });
        await acceptCurrentDirectly(application.db, googleCurrent.userId, 'google_signup');

        const googleLogin = async (sub, email) => requestJson(application.origin, '/api/auth/google', {
            method: 'POST',
            body: { token: encodeGooglePayload({ sub, email, email_verified: true, name: 'Google Fixture' }) }
        });
        const missing = await googleLogin('google-missing', 'google-missing@example.test');
        assert.equal(missing.status, 200);
        assert.equal(missing.body.success, true);
        assert.equal(missing.body.legal_acceptance_required, true);

        const current = await googleLogin('google-current', 'google-current@example.test');
        assert.equal(current.status, 200);
        assert.equal(current.body.legal_acceptance_required, false);

        const usersBefore = (await get(application.db, 'SELECT COUNT(*) AS count FROM users')).count;
        const pending = await googleLogin('brand-new-google', 'brand-new-google@example.test');
        assert.equal(pending.status, 202);
        assert.equal(pending.body.success, false);
        assert.equal(pending.body.legal_acceptance_required, true);
        assert.equal((await get(application.db, 'SELECT COUNT(*) AS count FROM users')).count, usersBefore);
    });

    await t.test('admin reporting is canonical and permission protected', async () => {
        const adminCookie = createSession(application, administrator, 'admin');
        const ordinaryCookie = createSession(application, ordinary, 'ordinary');
        assert.equal((await requestJson(application.origin, '/api/admin/legal-acceptances')).status, 401);
        assert.equal((await requestJson(application.origin, '/api/admin/legal-acceptances', { cookie: ordinaryCookie })).status, 403);
        const report = await requestJson(application.origin, '/api/admin/legal-acceptances', { cookie: adminCookie });
        assert.equal(report.status, 200);
        assert.equal(report.body.success, true);
        assert.ok(report.body.summary.total_users >= 5);
        assert.ok(report.body.summary.action_required >= 1);
        assert.ok(report.body.users.some(user => user.user_id === unaccepted.userId && user.current === true));
        assert.equal(Object.hasOwn(report.body.users[0], 'password'), false);
        assert.equal(Object.hasOwn(report.body.users[0], 'session_id'), false);
    });
});

test('legal gate UI is explicit, unselected, server-derived, and storage-free', async () => {
    const html = await fsp.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
    const script = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'legal-acceptance.js'), 'utf8');
    assert.match(html, /id="existingUserLegalGate"/);
    assert.match(html, /Before you continue/);
    assert.match(html, /id="existingUserLegalAccepted" type="checkbox" required/);
    assert.doesNotMatch(html, /id="existingUserLegalAccepted"[^>]*checked/);
    assert.match(html, /Agree &amp; Continue/);
    assert.match(html, /id="myLegalPrivacySection"/);
    assert.match(html, /View Terms of Service/);
    assert.match(html, /View Privacy Policy/);
    assert.match(script, /fetch\('\/api\/legal\/status'/);
    assert.match(script, /body: JSON\.stringify\(\{ legal_accepted: true \}\)/);
    assert.match(script, /event\.target !== gate\.modal \|\| !legalGateRequired/);
    assert.match(script, /event\.stopPropagation\(\)/);
    assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB/);
});
