'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

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

function createSession(sessionStore, identity) {
    const sessionId = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        createdAt: now,
        expiresAt: now + 60_000
    });
    return { sessionId, cookie: `koinonia_session=${sessionId}` };
}

async function request(origin, pathname, { method = 'GET', cookie = null, body } = {}) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const response = await fetch(`${origin}${pathname}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; }
    catch (error) { /* HTML and images are expected for some routes. */ }
    return { status: response.status, headers: response.headers, text, json };
}

test('member account claim onboarding activates only the token-selected existing identity', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-account-claim-onboarding-'));
    let database;
    let httpServer;
    const previousEnvironment = {
        PORT: process.env.PORT,
        KOINONIA_PUBLIC_ORIGIN: process.env.KOINONIA_PUBLIC_ORIGIN,
        EMAIL_OUTBOX_ENCRYPTION_KEY: process.env.EMAIL_OUTBOX_ENCRYPTION_KEY
    };

    t.after(async () => {
        if (httpServer) await new Promise(resolve => httpServer.close(resolve));
        if (database) await closeDatabase(database);
        delete global.__koinoniaClaimGoogleClient;
        for (const [key, value] of Object.entries(previousEnvironment)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'claim'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'js'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'css'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });

    const serverSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const googleInitializer = "const googleClient = new OAuth2Client('100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com');";
    const isolatedSource = serverSource
        .replace(
            googleInitializer,
            `const googleClient = global.__koinoniaClaimGoogleClient || new OAuth2Client('100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com');`
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
            'module.exports = { app, db, sessionStore, accountClaimStore, ready: applyDeterministicRuntimeMigration() };'
        );
    assert.notEqual(isolatedSource, serverSource);
    assert.equal(isolatedSource.includes('global.__koinoniaClaimGoogleClient'), true);
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'help-faq.js', 'legal-acceptance.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    for (const filename of ['claim/index.html', 'js/claim.js', 'css/claim.css']) {
        await fsp.copyFile(
            path.join(repositoryRoot, 'public', filename),
            path.join(temporaryRoot, 'public', filename)
        );
    }
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'img', 'logo.png'), 'test');
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');

    const googlePayloads = new Map([
        ['claim-google-target', {
            sub: 'google-claim-target', email: 'google-claim@example.test', email_verified: true,
            name: 'Claim Google', picture: 'https://images.example.test/google.png'
        }],
        ['claim-google-duplicate', {
            sub: 'google-already-used', email: 'duplicate@example.test', email_verified: true,
            name: 'Duplicate Google'
        }],
        ['claim-google-conflicting-target', {
            sub: 'google-requested-different', email: 'conflicting@example.test', email_verified: true,
            name: 'Conflicting Google'
        }],
        ['claim-google-rollback', {
            sub: 'google-rollback-id', email: 'google-rollback@example.test', email_verified: true,
            name: 'Rollback Google'
        }],
        ['normal-google-existing', {
            sub: 'normal-google-id', email: 'normal-google@example.test', email_verified: true,
            name: 'Normal Google'
        }]
    ]);
    global.__koinoniaClaimGoogleClient = {
        async verifyIdToken({ idToken, audience }) {
            assert.equal(audience, '100122228838-c3f4kfv31pakgc0o6vstrrngo8h3uhvn.apps.googleusercontent.com');
            const payload = googlePayloads.get(idToken);
            if (!payload) throw new Error('invalid token');
            return { getPayload: () => payload };
        }
    };

    process.env.PORT = '0';
    process.env.KOINONIA_PUBLIC_ORIGIN = 'https://staging.fogmin.site';
    delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    const application = require(path.join(temporaryRoot, 'server.js'));
    await application.ready;
    database = application.db;
    httpServer = await new Promise((resolve, reject) => {
        const server = application.app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(server));
        server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${httpServer.address().port}`;

    let sequence = 0;
    const createTarget = async (label, options = {}) => {
        sequence += 1;
        const qrCode = `FOG-CLAIM-${label}-${sequence}`;
        const member = await run(
            database,
            `INSERT INTO youth (name, email, qr_code, google_id, password)
             VALUES (?, ?, ?, ?, ?)`,
            [`Claim ${label}`, options.email || null, qrCode, options.googleId || null, options.youthPassword || null]
        );
        let user = null;
        if (options.createUser !== false) {
            user = await run(
                database,
                `INSERT INTO users
                    (username, password, permissions, youth_id, account_claimed_at,
                     account_claim_method, account_claim_token_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [qrCode, options.userPassword || null, JSON.stringify(options.permissions || []), member.lastID,
                    options.claimedAt || null, options.claimMethod || null, options.claimTokenId || null]
            );
        }
        return { youthId: member.lastID, userId: user ? user.lastID : null, qrCode };
    };

    const adminTarget = await createTarget('ADMIN', { permissions: ['access_permissions'] });
    const ordinaryTarget = await createTarget('ORDINARY');
    const adminSession = createSession(application.sessionStore, {
        userId: adminTarget.userId,
        youthId: adminTarget.youthId,
        username: adminTarget.qrCode
    });
    const ordinarySession = createSession(application.sessionStore, {
        userId: ordinaryTarget.userId,
        youthId: ordinaryTarget.youthId,
        username: ordinaryTarget.qrCode
    });
    const issue = youthId => request(origin, '/api/admin/account-claims', {
        method: 'POST', cookie: adminSession.cookie, body: { youth_id: youthId }
    });
    const assertPreviewHidesIdentifier = async rawToken => {
        const response = await request(origin, '/api/account-claim/preview', {
            method: 'POST', body: { token: rawToken }
        });
        assert.equal(response.status, 404);
        assert.equal(response.text.includes('login_identifier'), false);
        assert.equal(response.json && Object.hasOwn(response.json, 'login_identifier'), false);
    };

    await t.test('claim shell serves both paths with privacy headers and fragment-only client handling', async () => {
        for (const pathname of ['/claim', '/claim/']) {
            const response = await request(origin, pathname);
            assert.equal(response.status, 200);
            assert.match(response.headers.get('cache-control'), /no-store/);
            assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
            assert.match(response.text, /Connect your membership/);
        }
        const client = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'claim.js'), 'utf8');
        assert.match(client, /window\.location\.hash/);
        assert.match(client, /history\.replaceState\(null, '', '\/claim'\)/);
        assert.equal(client.includes('localStorage'), false);
        assert.equal(client.includes('sessionStorage'), false);
        assert.equal(client.includes('indexedDB'), false);
        assert.equal(client.includes('?token='), false);
        assert.ok(client.indexOf('history.replaceState') < client.indexOf("accounts.google.com/gsi/client"));
        const replaced = [];
        vm.runInNewContext(client, {
            window: {
                location: { hash: `#${'A'.repeat(43)}` },
                history: { replaceState: (...args) => replaced.push(args) }
            },
            document: { addEventListener() {} }
        });
        assert.deepEqual(replaced, [[null, '', '/claim']]);
        const serviceWorker = await fsp.readFile(path.join(repositoryRoot, 'public', 'sw.js'), 'utf8');
        assert.match(serviceWorker, /url\.pathname === '\/claim'/);
        assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
    });

    await t.test('admin claim management is canonical, local-QR-only, replaceable, and secret-safe', async () => {
        const target = await createTarget('ISSUE');
        const anonymousIssue = await request(origin, '/api/admin/account-claims', {
            method: 'POST', body: { youth_id: target.youthId }
        });
        assert.equal(anonymousIssue.status, 401);
        assert.match(anonymousIssue.headers.get('cache-control'), /no-store/);
        assert.match(anonymousIssue.headers.get('cache-control'), /private/);
        const unauthorizedIssue = await request(origin, '/api/admin/account-claims', {
            method: 'POST', cookie: ordinarySession.cookie,
            body: { youth_id: target.youthId, permissions: ['access_permissions'], is_admin: true }
        });
        assert.equal(unauthorizedIssue.status, 403);
        assert.match(unauthorizedIssue.headers.get('cache-control'), /no-store/);
        assert.match(unauthorizedIssue.headers.get('cache-control'), /private/);
        assert.equal((await request(origin, `/api/admin/account-claims/${target.youthId}`, {
            cookie: ordinarySession.cookie
        })).status, 403);
        assert.equal((await request(origin, `/api/admin/account-claims/${target.youthId}`, {
            method: 'DELETE', cookie: ordinarySession.cookie
        })).status, 403);

        const first = await issue(target.youthId);
        assert.equal(first.status, 201);
        assert.match(first.headers.get('cache-control'), /private/);
        assert.match(first.json.claim_url, /^https:\/\/staging\.fogmin\.site\/claim#[A-Za-z0-9_-]{43}$/);
        assert.match(first.json.claim_qr_data_url, /^data:image\/png;base64,/);
        assert.equal(first.text.includes('api.qrserver.com'), false);
        const firstToken = first.json.claim_url.split('#')[1];

        const status = await request(origin, `/api/admin/account-claims/${target.youthId}`, {
            cookie: adminSession.cookie
        });
        assert.equal(status.status, 200);
        assert.equal(status.json.account_status, 'active');
        assert.equal(status.text.includes(firstToken), false);
        assert.equal(status.text.includes('token_hash'), false);

        const replacement = await issue(target.youthId);
        assert.equal(replacement.status, 201);
        assert.notEqual(replacement.json.claim_url, first.json.claim_url);
        assert.equal((await application.accountClaimStore.getUsable(firstToken)), null);
        const replacementToken = replacement.json.claim_url.split('#')[1];
        const revoked = await request(origin, `/api/admin/account-claims/${target.youthId}`, {
            method: 'DELETE', cookie: adminSession.cookie
        });
        assert.equal(revoked.status, 200);
        assert.equal(revoked.json.revoked, true);
        assert.equal(await application.accountClaimStore.getUsable(replacementToken), null);
    });

    await t.test('issuance and preview fail closed for claimed, missing-account, and ambiguous targets', async () => {
        const claimed = await createTarget('CLAIMED', {
            claimedAt: Date.now(), claimMethod: 'claim_password', claimTokenId: 88
        });
        const claimedIssue = await issue(claimed.youthId);
        assert.equal(claimedIssue.status, 409);
        assert.equal(claimedIssue.json.account_status, 'claimed');

        const missingAccount = await createTarget('NO-ACCOUNT', { createUser: false });
        const missingIssue = await issue(missingAccount.youthId);
        assert.equal(missingIssue.status, 409);
        assert.equal(missingIssue.json.account_status, 'conflict');

        const ambiguous = await createTarget('AMBIGUOUS');
        await run(
            database,
            "INSERT INTO users (username, permissions, youth_id) VALUES (?, '[]', ?)",
            [`${ambiguous.qrCode}-SECOND`, ambiguous.youthId]
        );
        assert.equal((await issue(ambiguous.youthId)).status, 409);
    });

    await t.test('preview never reveals a Sign-in ID for invalid or unclaimable states', async () => {
        await assertPreviewHidesIdentifier('A'.repeat(43));

        const expiredTarget = await createTarget('PREVIEW-EXPIRED');
        const expired = await application.accountClaimStore.issue({
            youthId: expiredTarget.youthId, createdByUserId: adminTarget.userId
        });
        await run(database, 'UPDATE account_claim_tokens SET expires_at = 1 WHERE id = ?', [expired.id]);
        await assertPreviewHidesIdentifier(expired.rawToken);

        const revokedTarget = await createTarget('PREVIEW-REVOKED');
        const revoked = await application.accountClaimStore.issue({
            youthId: revokedTarget.youthId, createdByUserId: adminTarget.userId
        });
        await application.accountClaimStore.revoke({
            youthId: revokedTarget.youthId, revokedByUserId: adminTarget.userId
        });
        await assertPreviewHidesIdentifier(revoked.rawToken);

        const usedTarget = await createTarget('PREVIEW-USED');
        const used = await application.accountClaimStore.issue({
            youthId: usedTarget.youthId, createdByUserId: adminTarget.userId
        });
        await application.accountClaimStore.consumeWithMutation({
            rawToken: used.rawToken, consumedByUserId: usedTarget.userId
        }, async () => ({}));
        await assertPreviewHidesIdentifier(used.rawToken);

        const noAccountTarget = await createTarget('PREVIEW-NO-ACCOUNT', { createUser: false });
        const noAccount = await application.accountClaimStore.issue({
            youthId: noAccountTarget.youthId, createdByUserId: adminTarget.userId
        });
        await assertPreviewHidesIdentifier(noAccount.rawToken);

        const multipleTarget = await createTarget('PREVIEW-MULTIPLE');
        const multiple = await application.accountClaimStore.issue({
            youthId: multipleTarget.youthId, createdByUserId: adminTarget.userId
        });
        await run(database, "INSERT INTO users (username, permissions, youth_id) VALUES (?, '[]', ?)", [
            `${multipleTarget.qrCode}-SECOND`, multipleTarget.youthId
        ]);
        await assertPreviewHidesIdentifier(multiple.rawToken);

        const claimedTarget = await createTarget('PREVIEW-CLAIMED', {
            claimedAt: Date.now(), claimMethod: 'claim_password', claimTokenId: 99
        });
        const claimed = await application.accountClaimStore.issue({
            youthId: claimedTarget.youthId, createdByUserId: adminTarget.userId
        });
        await assertPreviewHidesIdentifier(claimed.rawToken);
    });

    await t.test('invalid, expired, revoked, and ambiguous-target claims cannot activate a password', async () => {
        assert.equal((await request(origin, '/api/account-claim/activate-password', {
            method: 'POST', body: { token: 'A'.repeat(43), password: 'Safe-password-2026' }
        })).status, 400);

        const expiredTarget = await createTarget('ACTIVATE-EXPIRED');
        const expired = await application.accountClaimStore.issue({ youthId: expiredTarget.youthId, createdByUserId: adminTarget.userId });
        await run(database, 'UPDATE account_claim_tokens SET expires_at = 1 WHERE id = ?', [expired.id]);
        assert.equal((await request(origin, '/api/account-claim/activate-password', {
            method: 'POST', body: { token: expired.rawToken, password: 'Safe-password-2026' }
        })).status, 400);

        const revokedTarget = await createTarget('ACTIVATE-REVOKED');
        const revoked = await application.accountClaimStore.issue({ youthId: revokedTarget.youthId, createdByUserId: adminTarget.userId });
        await application.accountClaimStore.revoke({ youthId: revokedTarget.youthId, revokedByUserId: adminTarget.userId });
        assert.equal((await request(origin, '/api/account-claim/activate-password', {
            method: 'POST', body: { token: revoked.rawToken, password: 'Safe-password-2026' }
        })).status, 400);

        const ambiguous = await createTarget('ACTIVATE-AMBIGUOUS');
        const ambiguousClaim = await application.accountClaimStore.issue({ youthId: ambiguous.youthId, createdByUserId: adminTarget.userId });
        await run(database, "INSERT INTO users (username, permissions, youth_id) VALUES (?, '[]', ?)", [
            `${ambiguous.qrCode}-SECOND`, ambiguous.youthId
        ]);
        assert.equal((await request(origin, '/api/account-claim/activate-password', {
            method: 'POST', body: { token: ambiguousClaim.rawToken, password: 'Safe-password-2026' }
        })).status, 400);
        assert.ok(await application.accountClaimStore.getUsable(ambiguousClaim.rawToken));
    });

    await t.test('password activation preserves identity, authority, and history and commits atomically', async () => {
        const permissions = ['access_events', 'edit_entries'];
        const target = await createTarget('PASSWORD', { permissions });
        await run(database, 'INSERT INTO attendance (youth_id, event_id, checked_in_at) VALUES (?, 901, ?)', [target.youthId, '2026-09-11']);
        await run(database, "INSERT INTO ministry_members (ministry_id, youth_id, role) VALUES (902, ?, 'Member')", [target.youthId]);
        await run(database, "INSERT INTO event_roles (event_id, youth_id, role_name) VALUES (903, ?, 'Usher')", [target.youthId]);
        const beforeCounts = {
            youth: (await get(database, 'SELECT COUNT(*) count FROM youth')).count,
            users: (await get(database, 'SELECT COUNT(*) count FROM users')).count,
            attendance: (await get(database, 'SELECT COUNT(*) count FROM attendance WHERE youth_id = ?', [target.youthId])).count,
            ministries: (await get(database, 'SELECT COUNT(*) count FROM ministry_members WHERE youth_id = ?', [target.youthId])).count,
            roles: (await get(database, 'SELECT COUNT(*) count FROM event_roles WHERE youth_id = ?', [target.youthId])).count
        };
        const issued = await issue(target.youthId);
        const token = issued.json.claim_url.split('#')[1];

        const preview = await request(origin, '/api/account-claim/preview', {
            method: 'POST', body: { token, youth_id: ordinaryTarget.youthId, email: 'forged@example.test' }
        });
        assert.equal(preview.status, 200);
        assert.deepEqual(preview.json, {
            success: true,
            member: { name: 'Claim PASSWORD' },
            login_identifier: target.qrCode
        });
        for (const forbidden of [
            'email', 'permissions', 'password', 'google_id', 'youth_id', 'user_id', 'id'
        ]) {
            assert.equal(Object.hasOwn(preview.json, forbidden), false);
            assert.equal(Object.hasOwn(preview.json.member, forbidden), false);
        }

        const staleSession = createSession(application.sessionStore, {
            userId: target.userId, youthId: target.youthId, username: target.qrCode
        });
        const completed = await request(origin, '/api/account-claim/activate-password', {
            method: 'POST',
            body: { token, password: 'A-private-password-2026', youth_id: ordinaryTarget.youthId, permissions: ['access_permissions'] }
        });
        assert.equal(completed.status, 200);
        assert.equal(completed.json.login_identifier, target.qrCode);
        assert.equal(application.sessionStore.has(staleSession.sessionId), false);

        const member = await get(database, 'SELECT password FROM youth WHERE id = ?', [target.youthId]);
        const account = await get(
            database,
            `SELECT id, username, password, permissions, account_claimed_at,
                    account_claim_method, account_claim_token_id
             FROM users WHERE id = ?`,
            [target.userId]
        );
        assert.equal(account.id, target.userId);
        assert.equal(account.username, target.qrCode);
        assert.equal(account.permissions, JSON.stringify(permissions));
        assert.match(account.password, /^scrypt\$v1\$/);
        assert.equal(member.password, account.password);
        assert.equal(account.account_claim_method, 'claim_password');
        assert.equal(Number.isInteger(account.account_claimed_at), true);
        assert.equal((await get(database, 'SELECT used_at FROM account_claim_tokens WHERE id = ?', [account.account_claim_token_id])).used_at !== null, true);
        assert.deepEqual({
            youth: (await get(database, 'SELECT COUNT(*) count FROM youth')).count,
            users: (await get(database, 'SELECT COUNT(*) count FROM users')).count,
            attendance: (await get(database, 'SELECT COUNT(*) count FROM attendance WHERE youth_id = ?', [target.youthId])).count,
            ministries: (await get(database, 'SELECT COUNT(*) count FROM ministry_members WHERE youth_id = ?', [target.youthId])).count,
            roles: (await get(database, 'SELECT COUNT(*) count FROM event_roles WHERE youth_id = ?', [target.youthId])).count
        }, beforeCounts);

        assert.equal((await request(origin, '/api/account-claim/activate-password', {
            method: 'POST', body: { token, password: 'Another-password-2026' }
        })).status, 400);
        assert.equal((await issue(target.youthId)).status, 409);
        const login = await request(origin, '/api/login', {
            method: 'POST', body: { username: target.qrCode, password: 'A-private-password-2026' }
        });
        assert.equal(login.status, 200);
    });

    await t.test('password mutation failure rolls back credentials, attestation, and token consumption', async () => {
        const target = await createTarget('PASSWORD-ROLLBACK');
        const issued = await issue(target.youthId);
        const token = issued.json.claim_url.split('#')[1];
        await run(database, `CREATE TRIGGER reject_claim_password
            BEFORE UPDATE OF password ON users WHEN NEW.id = ${target.userId}
            BEGIN SELECT RAISE(ABORT, 'forced activation failure'); END`);
        assert.equal((await request(origin, '/api/account-claim/activate-password', {
            method: 'POST', body: { token, password: 'Rollback-password-2026' }
        })).status, 500);
        assert.deepEqual(await get(
            database,
            'SELECT password, account_claimed_at, account_claim_method FROM users WHERE id = ?',
            [target.userId]
        ), { password: null, account_claimed_at: null, account_claim_method: null });
        assert.equal((await get(database, 'SELECT password FROM youth WHERE id = ?', [target.youthId])).password, null);
        assert.equal((await get(database, 'SELECT used_at FROM account_claim_tokens WHERE id = ?', [issued.json ? (await get(database, 'SELECT id FROM account_claim_tokens WHERE youth_id = ? ORDER BY id DESC', [target.youthId])).id : 0])).used_at, null);
        await run(database, 'DROP TRIGGER reject_claim_password');
        assert.equal((await request(origin, '/api/account-claim/activate-password', {
            method: 'POST', body: { token, password: 'Rollback-password-2026' }
        })).status, 200);
    });

    await t.test('claim-aware Google activation verifies remotely and never provisions or retargets a member', async () => {
        const permissions = ['access_ministries'];
        const target = await createTarget('GOOGLE', {
            email: 'google-claim@example.test', permissions
        });
        const sameEmailOther = await createTarget('GOOGLE-SAME-EMAIL', {
            email: 'google-claim@example.test'
        });
        const other = await createTarget('GOOGLE-FORGED-TARGET');
        const issued = await issue(target.youthId);
        const token = issued.json.claim_url.split('#')[1];
        const beforeYouth = (await get(database, 'SELECT COUNT(*) count FROM youth')).count;
        const beforeUsers = (await get(database, 'SELECT COUNT(*) count FROM users')).count;
        const completed = await request(origin, '/api/account-claim/activate-google', {
            method: 'POST',
            body: { token, google_token: 'claim-google-target', youth_id: other.youthId, is_admin: true }
        });
        assert.equal(completed.status, 200);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM youth')).count, beforeYouth);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM users')).count, beforeUsers);
        const member = await get(database, 'SELECT google_id, email_verified FROM youth WHERE id = ?', [target.youthId]);
        assert.deepEqual(member, { google_id: 'google-claim-target', email_verified: 1 });
        assert.equal((await get(database, 'SELECT google_id FROM youth WHERE id = ?', [sameEmailOther.youthId])).google_id, null);
        assert.equal((await get(database, 'SELECT google_id FROM youth WHERE id = ?', [other.youthId])).google_id, null);
        const account = await get(database, 'SELECT permissions, account_claim_method FROM users WHERE id = ?', [target.userId]);
        assert.deepEqual(account, { permissions: JSON.stringify(permissions), account_claim_method: 'claim_google' });
    });

    await t.test('Google identity conflicts fail closed and leave the claim retryable', async () => {
        await createTarget('GOOGLE-OWNER', { googleId: 'google-already-used' });
        const duplicateTarget = await createTarget('GOOGLE-DUPLICATE', { email: 'duplicate@example.test' });
        const duplicateClaim = await issue(duplicateTarget.youthId);
        const duplicateToken = duplicateClaim.json.claim_url.split('#')[1];
        assert.equal((await request(origin, '/api/account-claim/activate-google', {
            method: 'POST', body: { token: duplicateToken, google_token: 'claim-google-duplicate' }
        })).status, 400);
        assert.ok(await application.accountClaimStore.getUsable(duplicateToken));
        assert.equal((await get(database, 'SELECT google_id FROM youth WHERE id = ?', [duplicateTarget.youthId])).google_id, null);

        const conflictingTarget = await createTarget('GOOGLE-CONFLICT', {
            email: 'conflicting@example.test', googleId: 'google-existing-different'
        });
        const conflictingClaim = await issue(conflictingTarget.youthId);
        const conflictingToken = conflictingClaim.json.claim_url.split('#')[1];
        assert.equal((await request(origin, '/api/account-claim/activate-google', {
            method: 'POST', body: { token: conflictingToken, google_token: 'claim-google-conflicting-target' }
        })).status, 400);
        assert.ok(await application.accountClaimStore.getUsable(conflictingToken));
        assert.equal((await get(database, 'SELECT google_id FROM youth WHERE id = ?', [conflictingTarget.youthId])).google_id, 'google-existing-different');
    });

    await t.test('Google attestation failure rolls back identity binding and token consumption', async () => {
        const target = await createTarget('GOOGLE-ROLLBACK', { email: 'google-rollback@example.test' });
        const issued = await issue(target.youthId);
        const token = issued.json.claim_url.split('#')[1];
        await run(database, `CREATE TRIGGER reject_claim_google_attestation
            BEFORE UPDATE OF account_claimed_at ON users WHEN NEW.id = ${target.userId}
            BEGIN SELECT RAISE(ABORT, 'forced Google attestation failure'); END`);
        assert.equal((await request(origin, '/api/account-claim/activate-google', {
            method: 'POST', body: { token, google_token: 'claim-google-rollback' }
        })).status, 500);
        assert.equal((await get(database, 'SELECT google_id FROM youth WHERE id = ?', [target.youthId])).google_id, null);
        assert.deepEqual(await get(
            database,
            'SELECT account_claimed_at, account_claim_method FROM users WHERE id = ?',
            [target.userId]
        ), { account_claimed_at: null, account_claim_method: null });
        assert.ok(await application.accountClaimStore.getUsable(token));
        await run(database, 'DROP TRIGGER reject_claim_google_attestation');
    });

    await t.test('ordinary Google authentication remains on its existing route', async () => {
        const target = await createTarget('NORMAL-GOOGLE', {
            email: 'normal-google@example.test', googleId: 'normal-google-id'
        });
        const response = await request(origin, '/api/auth/google', {
            method: 'POST', body: { token: 'normal-google-existing' }
        });
        assert.equal(response.status, 200);
        assert.equal(response.json.member.id, target.youthId);
    });

    await t.test('signed-in different-member completion and forged authority cannot hijack a claim', async () => {
        const target = await createTarget('SIGNED-IN-TARGET');
        const issued = await issue(target.youthId);
        const token = issued.json.claim_url.split('#')[1];
        assert.equal((await request(origin, '/api/account-claim/complete', {
            method: 'POST', cookie: ordinarySession.cookie,
            body: { token, youth_id: target.youthId, permissions: ['access_permissions'], is_admin: true }
        })).status, 400);
        assert.ok(await application.accountClaimStore.getUsable(token));
        assert.equal((await get(database, 'SELECT youth_id FROM users WHERE id = ?', [ordinaryTarget.userId])).youth_id, ordinaryTarget.youthId);
    });

    await t.test('public activation attempts are bounded without token material in responses', async () => {
        const target = await createTarget('LIMITED');
        const issued = await issue(target.youthId);
        const token = issued.json.claim_url.split('#')[1];
        for (let attempt = 0; attempt < 6; attempt += 1) {
            const rejected = await request(origin, '/api/account-claim/activate-google', {
                method: 'POST', body: { token, google_token: 'invalid-google-token' }
            });
            assert.equal(rejected.status, 400);
            assert.equal(rejected.text.includes(token), false);
        }
        const limited = await request(origin, '/api/account-claim/activate-google', {
            method: 'POST', body: { token, google_token: 'invalid-google-token' }
        });
        assert.equal(limited.status, 429);
        assert.equal(limited.headers.get('retry-after'), '900');
        assert.match(limited.headers.get('cache-control'), /private/);
        assert.ok(await application.accountClaimStore.getUsable(token));
    });

    const audits = await all(database, "SELECT details FROM activity_logs WHERE action LIKE 'ACCOUNT_CLAIM_%'");
    const auditText = JSON.stringify(audits);
    const hashes = await all(database, 'SELECT token_hash FROM account_claim_tokens');
    for (const row of hashes) assert.equal(auditText.includes(row.token_hash), false);
});

test('account claim admin UI keeps raw issuance links ephemeral and uses local QR data only', async () => {
    const appSource = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');
    const html = await fsp.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
    assert.match(html, /Account Access/);
    assert.match(html, /Temporary, one-time Account Claim QR/);
    assert.match(appSource, /currentIssuedAccountClaimUrl/);
    assert.match(appSource, /navigator\.clipboard\.writeText\(currentIssuedAccountClaimUrl\)/);
    assert.equal(appSource.includes('localStorage.setItem(\'accountClaim'), false);
    assert.equal(appSource.includes('sessionStorage.setItem(\'accountClaim'), false);
    const claimSection = appSource.slice(appSource.indexOf('let currentIssuedAccountClaimUrl'), appSource.indexOf('window.openAssignPermissionModal'));
    assert.equal(claimSection.includes('api.qrserver.com'), false);
    assert.match(claimSection, /claim_qr_data_url/);
});

test('claim client reveals the Sign-in ID only after a successful preview using safe DOM APIs', async () => {
    const client = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'claim.js'), 'utf8');
    const html = await fsp.readFile(path.join(repositoryRoot, 'public', 'claim', 'index.html'), 'utf8');
    assert.match(html, /id="claimSignInIdentity"[^>]*hidden/);
    assert.match(html, /Your Community Portal Sign-in ID/);
    assert.match(html, /id="claimCopyIdentifier"/);
    assert.match(client, /typeof preview\.login_identifier !== 'string'/);
    assert.match(client, /loginIdentifierElement\.textContent = loginIdentifier/);
    assert.match(client, /signInIdentity\.hidden = false/);
    assert.match(client, /successLoginIdentifier\.textContent = confirmedIdentifier/);
    assert.match(client, /navigator\.clipboard\.writeText\(loginIdentifier\)/);
    assert.equal(client.includes('innerHTML'), false);
    assert.equal(client.includes('localStorage'), false);
    assert.equal(client.includes('sessionStorage'), false);
    assert.equal(client.includes('indexedDB'), false);
    assert.ok(client.indexOf('loginIdentifierElement.textContent = loginIdentifier') > client.indexOf('!previewResponse.ok'));
});
