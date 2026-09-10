'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();
const {
    ACCOUNT_CLAIM_TOKEN_BYTES,
    ACCOUNT_CLAIM_TOKEN_TTL_MS,
    hashAccountClaimToken,
    initializeAccountClaimSchema,
    createAccountClaimStore
} = require('../lib/account-claim-security');

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
    return `koinonia_session=${sessionId}`;
}

async function requestJson(origin, pathname, { method = 'GET', cookie = null, body } = {}) {
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
    catch (error) { /* A 404 HTML response is expected for unsupported token URLs. */ }
    return { status: response.status, headers: response.headers, text, json };
}

test('account claim token lifecycle is hash-only, atomic, and single-use', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-account-claim-store-'));
    const databasePath = path.join(temporaryRoot, 'claim.db');
    const database = new sqlite3.Database(databasePath);
    let clock = 1_800_000_000_000;

    t.after(async () => {
        await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await initializeAccountClaimSchema(database);
    await run(database, 'CREATE TABLE mutation_probe (id INTEGER PRIMARY KEY, value TEXT)');
    const store = createAccountClaimStore({ database, now: () => clock });

    const first = await store.issue({ youthId: 10, createdByUserId: 1 });
    assert.equal(Buffer.from(first.rawToken, 'base64url').length, ACCOUNT_CLAIM_TOKEN_BYTES);
    assert.match(first.rawToken, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(first.expiresAt - first.createdAt, ACCOUNT_CLAIM_TOKEN_TTL_MS);
    const persistedFirst = await get(database, 'SELECT * FROM account_claim_tokens WHERE id = ?', [first.id]);
    assert.equal(persistedFirst.token_hash, hashAccountClaimToken(first.rawToken));
    assert.notEqual(persistedFirst.token_hash, first.rawToken);
    assert.equal(JSON.stringify(persistedFirst).includes(first.rawToken), false);

    const second = await store.issue({ youthId: 10, createdByUserId: 2 });
    assert.equal(second.replaced, true);
    assert.notEqual(second.rawToken, first.rawToken);
    assert.notEqual(hashAccountClaimToken(second.rawToken), persistedFirst.token_hash);
    assert.notEqual((await get(database, 'SELECT revoked_at FROM account_claim_tokens WHERE id = ?', [first.id])).revoked_at, null);
    assert.equal(await store.getUsable(first.rawToken), null);
    assert.equal((await store.getUsable(second.rawToken)).youthId, 10);
    assert.equal((await get(
        database,
        'SELECT COUNT(*) count FROM account_claim_tokens WHERE youth_id = 10 AND used_at IS NULL AND revoked_at IS NULL'
    )).count, 1);

    const uniqueIndexes = await all(database, "PRAGMA index_list('account_claim_tokens')");
    assert.ok(uniqueIndexes.some(index => index.name === 'account_claim_tokens_one_pending_idx' && index.unique === 1));
    assert.ok(uniqueIndexes.some(index => index.origin === 'u' && index.unique === 1));

    const expiring = await store.issue({ youthId: 11, createdByUserId: 1, ttlMs: 1000 });
    clock += 1000;
    assert.equal(await store.getUsable(expiring.rawToken), null);
    assert.equal((await store.getStatus(11)).status, 'expired');

    const revoked = await store.issue({ youthId: 12, createdByUserId: 1 });
    assert.equal((await store.revoke({ youthId: 12, revokedByUserId: 2 })).revoked, true);
    assert.equal((await store.revoke({ youthId: 12, revokedByUserId: 2 })).revoked, false);
    assert.equal(await store.getUsable(revoked.rawToken), null);
    assert.equal((await store.getStatus(12)).status, 'revoked');

    const used = await store.issue({ youthId: 13, createdByUserId: 1 });
    let usedMutationRuns = 0;
    const consumed = await store.consumeWithMutation(
        { rawToken: used.rawToken, consumedByUserId: 20 },
        async (claim, transaction) => {
            usedMutationRuns += 1;
            await transaction.run('INSERT INTO mutation_probe (id, value) VALUES (?, ?)', [claim.id, 'committed']);
            return 'done';
        }
    );
    assert.equal(consumed.mutationResult, 'done');
    assert.equal(usedMutationRuns, 1);
    assert.equal((await get(database, 'SELECT value FROM mutation_probe WHERE id = ?', [used.id])).value, 'committed');
    assert.equal((await store.getStatus(13)).status, 'used');
    assert.equal(await store.consumeWithMutation(
        { rawToken: used.rawToken, consumedByUserId: 20 },
        async () => { usedMutationRuns += 1; }
    ), null);
    assert.equal(usedMutationRuns, 1);

    const rollback = await store.issue({ youthId: 14, createdByUserId: 1 });
    await assert.rejects(
        store.consumeWithMutation(
            { rawToken: rollback.rawToken, consumedByUserId: 21 },
            async (claim, transaction) => {
                await transaction.run('INSERT INTO mutation_probe (id, value) VALUES (?, ?)', [claim.id, 'rollback']);
                throw new Error('simulated linking failure');
            }
        ),
        /simulated linking failure/
    );
    assert.equal(await get(database, 'SELECT id FROM mutation_probe WHERE id = ?', [rollback.id]), null);
    assert.equal((await get(database, 'SELECT used_at FROM account_claim_tokens WHERE id = ?', [rollback.id])).used_at, null);
    assert.ok(await store.getUsable(rollback.rawToken));
    assert.ok(await store.consumeWithMutation(
        { rawToken: rollback.rawToken, consumedByUserId: 21 },
        async () => 'retry succeeded'
    ));

    const concurrent = await store.issue({ youthId: 15, createdByUserId: 1 });
    const concurrentResults = await Promise.all([
        store.consumeWithMutation({ rawToken: concurrent.rawToken, consumedByUserId: 22 }, async () => 'first'),
        store.consumeWithMutation({ rawToken: concurrent.rawToken, consumedByUserId: 23 }, async () => 'second')
    ]);
    assert.equal(concurrentResults.filter(Boolean).length, 1);
    assert.equal(await store.getUsable(concurrent.rawToken), null);

    const replacements = await Promise.all([
        store.issue({ youthId: 16, createdByUserId: 1 }),
        store.issue({ youthId: 16, createdByUserId: 2 })
    ]);
    const pendingReplacement = await get(
        database,
        'SELECT COUNT(*) count FROM account_claim_tokens WHERE youth_id = 16 AND used_at IS NULL AND revoked_at IS NULL'
    );
    assert.equal(pendingReplacement.count, 1);
    assert.equal(replacements.filter(result => result.replaced).length, 1);
    assert.equal((await Promise.all(replacements.map(result => store.getUsable(result.rawToken)))).filter(Boolean).length, 1);

    assert.equal(await store.getUsable('not-a-token'), null);
    assert.equal(await store.consumeWithMutation(
        { rawToken: 'A'.repeat(42), consumedByUserId: 22 },
        async () => assert.fail('malformed token mutation must not run')
    ), null);
    const persistedDatabase = await fsp.readFile(databasePath);
    for (const issued of [first, second, expiring, revoked, used, rollback, concurrent, ...replacements]) {
        assert.equal(persistedDatabase.includes(Buffer.from(issued.rawToken, 'utf8')), false);
    }
});

test('account claim HTTP foundation enforces authorization, privacy, and bounded preview', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-account-claim-http-'));
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
        for (const [key, value] of Object.entries(previousEnvironment)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    const serverSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const isolatedSource = serverSource
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
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');

    process.env.PORT = '0';
    process.env.KOINONIA_PUBLIC_ORIGIN = 'https://staging.fogmin.site';
    delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;
    const application = require(path.join(temporaryRoot, 'server.js'));
    await application.ready;
    database = application.db;

    const target = await run(
        database,
        `INSERT INTO youth (name, email, mobile, birthday, parents_name, qr_code, password)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Disposable Claim Target', 'claim-target@example.test', 'private-mobile', '2000-01-01',
            'private-parent', 'FOG-MEMBER-CLAIM-TARGET', 'private-password']
    );
    const adminYouth = await run(database, "INSERT INTO youth (name, qr_code) VALUES ('Claim Admin', 'CLAIM-ADMIN')");
    const adminUser = await run(
        database,
        `INSERT INTO users (username, permissions, youth_id)
         VALUES ('CLAIM-ADMIN', '["access_permissions"]', ?)`,
        [adminYouth.lastID]
    );
    const ordinaryYouth = await run(database, "INSERT INTO youth (name, qr_code) VALUES ('Ordinary', 'CLAIM-ORDINARY')");
    const ordinaryUser = await run(
        database,
        "INSERT INTO users (username, permissions, youth_id) VALUES ('CLAIM-ORDINARY', '[]', ?)",
        [ordinaryYouth.lastID]
    );
    const adminCookie = createSession(application.sessionStore, {
        userId: adminUser.lastID,
        youthId: adminYouth.lastID,
        username: 'CLAIM-ADMIN'
    });
    const ordinaryCookie = createSession(application.sessionStore, {
        userId: ordinaryUser.lastID,
        youthId: ordinaryYouth.lastID,
        username: 'CLAIM-ORDINARY'
    });

    httpServer = await new Promise((resolve, reject) => {
        const server = application.app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(server));
        server.once('error', reject);
    });
    const origin = `http://127.0.0.1:${httpServer.address().port}`;

    assert.equal((await requestJson(origin, '/api/admin/account-claims', {
        method: 'POST', body: { youth_id: target.lastID }
    })).status, 401);
    assert.equal((await requestJson(origin, '/api/admin/account-claims', {
        method: 'POST', cookie: ordinaryCookie,
        body: { youth_id: target.lastID, actor: adminUser.lastID, permissions: ['access_permissions'], is_admin: true }
    })).status, 403);
    assert.equal((await requestJson(origin, `/api/admin/account-claims/${target.lastID}`, {
        method: 'DELETE', cookie: ordinaryCookie
    })).status, 403);

    const issued = await requestJson(origin, '/api/admin/account-claims', {
        method: 'POST', cookie: adminCookie, body: { youth_id: target.lastID, actor: 999999 }
    });
    assert.equal(issued.status, 201);
    assert.equal(issued.headers.get('cache-control').includes('no-store'), true);
    assert.match(issued.json.claim_url, /^https:\/\/staging\.fogmin\.site\/claim#[A-Za-z0-9_-]{43}$/);
    const rawToken = issued.json.claim_url.split('#')[1];
    const persisted = await get(database, 'SELECT * FROM account_claim_tokens WHERE youth_id = ?', [target.lastID]);
    assert.equal(persisted.created_by_user_id, adminUser.lastID);
    assert.equal(persisted.token_hash, hashAccountClaimToken(rawToken));
    assert.equal(JSON.stringify(persisted).includes(rawToken), false);

    const status = await requestJson(origin, `/api/admin/account-claims/${target.lastID}`, { cookie: adminCookie });
    assert.equal(status.status, 200);
    assert.equal(status.json.claim.status, 'active');
    assert.equal(status.text.includes(rawToken), false);
    assert.equal(status.text.includes('token_hash'), false);
    assert.equal((await requestJson(origin, `/api/admin/account-claims/${target.lastID}`, {
        cookie: ordinaryCookie
    })).status, 403);

    const preview = await requestJson(origin, '/api/account-claim/preview', {
        method: 'POST', body: { token: rawToken, email: 'forged@example.test', qr_code: 'forged' }
    });
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('cache-control'), /no-store/);
    assert.deepEqual(preview.json.member, { id: target.lastID, name: 'Disposable Claim Target' });
    for (const forbidden of ['email', 'mobile', 'birthday', 'parents_name', 'qr_code', 'password', 'permissions', 'google_id']) {
        assert.equal(Object.hasOwn(preview.json.member, forbidden), false);
    }

    assert.equal((await requestJson(origin, `/claim/${rawToken}`)).status, 404);
    assert.equal((await requestJson(origin, `/api/account-claim/preview?token=${rawToken}`)).status, 404);
    assert.equal((await requestJson(origin, '/api/account-claim/preview', {
        method: 'POST', body: { token: 'claim-target@example.test' }
    })).status, 404);
    assert.equal((await requestJson(origin, '/api/account-claim/preview', {
        method: 'POST', body: { token: 'FOG-MEMBER-CLAIM-TARGET' }
    })).status, 404);

    const replacement = await requestJson(origin, '/api/admin/account-claims', {
        method: 'POST', cookie: adminCookie, body: { youth_id: target.lastID }
    });
    assert.equal(replacement.status, 201);
    assert.notEqual(replacement.json.claim_url, issued.json.claim_url);
    assert.equal((await requestJson(origin, '/api/account-claim/preview', {
        method: 'POST', body: { token: rawToken }
    })).status, 404);
    const replacementToken = replacement.json.claim_url.split('#')[1];

    const revoked = await requestJson(origin, `/api/admin/account-claims/${target.lastID}`, {
        method: 'DELETE', cookie: adminCookie,
        body: { actor: ordinaryUser.lastID, user_id: ordinaryUser.lastID }
    });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.json.revoked, true);
    assert.equal((await requestJson(origin, '/api/account-claim/preview', {
        method: 'POST', body: { token: replacementToken }
    })).status, 404);
    assert.equal((await requestJson(origin, `/api/admin/account-claims/${target.lastID}`, {
        method: 'DELETE', cookie: adminCookie
    })).json.revoked, false);

    let rateLimited = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
        const response = await requestJson(origin, '/api/account-claim/preview', {
            method: 'POST', body: { token: 'invalid' }
        });
        if (response.status === 429) {
            rateLimited = response;
            break;
        }
    }
    assert.ok(rateLimited);
    assert.equal(rateLimited.headers.get('retry-after'), '900');

    const attestations = await all(
        database,
        `SELECT account_claimed_at, account_claim_method, account_claim_token_id
         FROM users`
    );
    assert.ok(attestations.every(row => (
        row.account_claimed_at === null && row.account_claim_method === null && row.account_claim_token_id === null
    )));

    const auditRows = await all(
        database,
        "SELECT action, details FROM activity_logs WHERE action LIKE 'ACCOUNT_CLAIM_%'"
    );
    assert.ok(auditRows.some(row => row.action === 'ACCOUNT_CLAIM_ISSUED'));
    assert.ok(auditRows.some(row => row.action === 'ACCOUNT_CLAIM_REPLACED'));
    assert.ok(auditRows.some(row => row.action === 'ACCOUNT_CLAIM_REVOKED'));
    assert.ok(auditRows.some(row => row.action === 'ACCOUNT_CLAIM_PREVIEW_REJECTED'));
    const serializedAudit = JSON.stringify(auditRows);
    assert.equal(serializedAudit.includes(rawToken), false);
    assert.equal(serializedAudit.includes(replacementToken), false);
    assert.equal(serializedAudit.includes(persisted.token_hash), false);
});
