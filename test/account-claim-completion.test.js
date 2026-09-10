'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

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

function closeDatabase(database) {
    return new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
}

function createSession(sessionStore, identity) {
    const sessionId = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId ?? null,
        username: identity.username,
        createdAt: now,
        expiresAt: now + 60_000
    });
    return { sessionId, cookie: `koinonia_session=${sessionId}` };
}

async function requestJson(origin, pathname, { method = 'POST', cookie = null, body } = {}) {
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
    catch (error) { /* Unsupported token-bearing routes return ordinary HTML 404 responses. */ }
    return { status: response.status, headers: response.headers, text, json };
}

test('authenticated account claim completion is atomic and fails closed', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-account-claim-complete-'));
    let database;
    let httpServer;
    const previousEnvironment = {
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
    const source = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const isolatedSource = source
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
    assert.notEqual(isolatedSource, source);
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');

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
    const createMember = async (label, email = null) => {
        sequence += 1;
        const inserted = await run(
            database,
            'INSERT INTO youth (name, email, qr_code) VALUES (?, ?, ?)',
            [`Claim ${label}`, email, `CLAIM-${label}-${sequence}`]
        );
        return inserted.lastID;
    };
    const createUser = async (label, youthId = null, attestation = {}) => {
        sequence += 1;
        const inserted = await run(
            database,
            `INSERT INTO users
                (username, permissions, youth_id, account_claimed_at,
                 account_claim_method, account_claim_token_id)
             VALUES (?, '[]', ?, ?, ?, ?)`,
            [`CLAIM-USER-${label}-${sequence}`, youthId,
                attestation.claimedAt ?? null, attestation.method ?? null, attestation.tokenId ?? null]
        );
        return { userId: inserted.lastID, username: `CLAIM-USER-${label}-${sequence}`, youthId };
    };
    const issue = (youthId, options = {}) => application.accountClaimStore.issue({
        youthId,
        createdByUserId: options.createdByUserId || 1,
        ...(options.ttlMs ? { ttlMs: options.ttlMs } : {})
    });
    await t.test('a canonical authenticated account links, attests, consumes once, and loses stale sessions', async () => {
        const targetYouthId = await createMember('SUCCESS');
        const account = await createUser('SUCCESS');
        const issued = await issue(targetYouthId);
        const activeSession = createSession(application.sessionStore, account);
        const siblingSession = createSession(application.sessionStore, account);
        const targetSession = createSession(application.sessionStore, {
            userId: null,
            youthId: targetYouthId,
            username: 'legacy-target-session'
        });

        const anonymous = await requestJson(origin, '/api/account-claim/complete', {
            body: { token: issued.rawToken }
        });
        assert.equal(anonymous.status, 401);

        const completed = await requestJson(origin, '/api/account-claim/complete', {
            cookie: activeSession.cookie,
            body: { token: issued.rawToken, email: 'forged@example.test', youth_id: 999999 }
        });
        assert.equal(completed.status, 200);
        assert.deepEqual(completed.json, { success: true, reauthentication_required: true });
        assert.match(completed.headers.get('cache-control'), /no-store/);
        assert.match(completed.headers.get('set-cookie'), /Max-Age=0/);

        const linked = await get(
            database,
            `SELECT youth_id, account_claimed_at, account_claim_method, account_claim_token_id
             FROM users WHERE id = ?`,
            [account.userId]
        );
        assert.equal(linked.youth_id, targetYouthId);
        assert.equal(Number.isInteger(linked.account_claimed_at), true);
        assert.equal(linked.account_claim_method, 'claim_token');
        assert.equal(linked.account_claim_token_id, issued.id);
        const consumed = await get(database, 'SELECT used_at, consumed_by_user_id FROM account_claim_tokens WHERE id = ?', [issued.id]);
        assert.equal(Number.isInteger(consumed.used_at), true);
        assert.equal(consumed.consumed_by_user_id, account.userId);
        assert.equal(application.sessionStore.has(activeSession.sessionId), false);
        assert.equal(application.sessionStore.has(siblingSession.sessionId), false);
        assert.equal(application.sessionStore.has(targetSession.sessionId), false);

        const replaySession = createSession(application.sessionStore, {
            ...account,
            youthId: targetYouthId
        });
        const recoveredIdentity = await requestJson(origin, '/api/auth/me', {
            method: 'GET',
            cookie: replaySession.cookie
        });
        assert.equal(recoveredIdentity.status, 200);
        assert.equal(recoveredIdentity.json.member.id, targetYouthId);
        const replay = await requestJson(origin, '/api/account-claim/complete', {
            cookie: replaySession.cookie,
            body: { token: issued.rawToken }
        });
        assert.equal(replay.status, 400);
        assert.equal(replay.text.includes(issued.rawToken), false);
    });

    await t.test('tokens are accepted only from the POST JSON body', async () => {
        const targetYouthId = await createMember('TRANSPORT');
        const account = await createUser('TRANSPORT');
        const issued = await issue(targetYouthId);
        const session = createSession(application.sessionStore, account);

        assert.equal((await requestJson(origin, `/api/account-claim/complete/${issued.rawToken}`, {
            method: 'GET', cookie: session.cookie
        })).status, 404);
        assert.equal((await requestJson(origin, `/api/account-claim/complete?token=${issued.rawToken}`, {
            cookie: session.cookie, body: {}
        })).status, 400);
        assert.ok(await application.accountClaimStore.getUsable(issued.rawToken));
    });

    await t.test('malformed, unknown, expired, revoked, missing-member, and used claims fail safely', async () => {
        const account = await createUser('INVALIDS');
        const invalidSession = () => createSession(application.sessionStore, account).cookie;
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: invalidSession(), body: { token: 'not-a-token' }
        })).status, 400);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: invalidSession(), body: { token: 'A'.repeat(43) }
        })).status, 400);

        const expiredTarget = await createMember('EXPIRED');
        const expired = await issue(expiredTarget);
        await run(database, 'UPDATE account_claim_tokens SET expires_at = 1 WHERE id = ?', [expired.id]);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: invalidSession(), body: { token: expired.rawToken }
        })).status, 400);

        const revokedTarget = await createMember('REVOKED');
        const revoked = await issue(revokedTarget);
        await application.accountClaimStore.revoke({ youthId: revokedTarget, revokedByUserId: 1 });
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: invalidSession(), body: { token: revoked.rawToken }
        })).status, 400);

        const missing = await issue(999999);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: invalidSession(), body: { token: missing.rawToken }
        })).status, 400);
        assert.equal((await get(database, 'SELECT used_at FROM account_claim_tokens WHERE id = ?', [missing.id])).used_at, null);
    });

    await t.test('different, conflicting, ambiguous, and already-attested associations fail closed', async () => {
        const existingYouthId = await createMember('ACCOUNT-EXISTING');
        const targetYouthId = await createMember('ACCOUNT-DIFFERENT');
        const linkedElsewhere = await createUser('ACCOUNT-DIFFERENT', existingYouthId);
        const differentClaim = await issue(targetYouthId);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, linkedElsewhere).cookie,
            body: { token: differentClaim.rawToken }
        })).status, 400);
        assert.equal((await get(database, 'SELECT used_at FROM account_claim_tokens WHERE id = ?', [differentClaim.id])).used_at, null);

        const occupiedTarget = await createMember('OCCUPIED');
        await createUser('OCCUPANT', occupiedTarget);
        const unlinked = await createUser('OCCUPIED-CLAIMANT');
        const occupiedClaim = await issue(occupiedTarget);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, unlinked).cookie,
            body: { token: occupiedClaim.rawToken }
        })).status, 400);

        const ambiguousTarget = await createMember('AMBIGUOUS');
        const ambiguousClaimant = await createUser('AMBIGUOUS-A', ambiguousTarget);
        await createUser('AMBIGUOUS-B', ambiguousTarget);
        const ambiguousClaim = await issue(ambiguousTarget);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, ambiguousClaimant).cookie,
            body: { token: ambiguousClaim.rawToken }
        })).status, 400);

        const attestedTarget = await createMember('ATTESTED');
        const attestedAccount = await createUser('ATTESTED', attestedTarget, {
            claimedAt: Date.now(), method: 'claim_token', tokenId: 12345
        });
        const attestedClaim = await issue(attestedTarget);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, attestedAccount).cookie,
            body: { token: attestedClaim.rawToken }
        })).status, 400);
    });

    await t.test('legacy linkage remains unclaimed until an explicit valid-token completion', async () => {
        const targetYouthId = await createMember('LEGACY');
        const legacy = await createUser('LEGACY', targetYouthId);
        const before = await get(
            database,
            'SELECT account_claimed_at, account_claim_method, account_claim_token_id FROM users WHERE id = ?',
            [legacy.userId]
        );
        assert.deepEqual(before, {
            account_claimed_at: null,
            account_claim_method: null,
            account_claim_token_id: null
        });
        const issued = await issue(targetYouthId);
        assert.equal((await requestJson(origin, '/api/account-claim/preview', {
            body: { token: issued.rawToken }
        })).status, 200);
        assert.deepEqual(await get(
            database,
            'SELECT account_claimed_at, account_claim_method, account_claim_token_id FROM users WHERE id = ?',
            [legacy.userId]
        ), before);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, legacy).cookie,
            body: { token: issued.rawToken }
        })).status, 200);
    });

    await t.test('email matches and duplicate emails never select the claim identity', async () => {
        const matchingEmail = 'duplicate-claim@example.test';
        const emailMember = await createMember('EMAIL-A', matchingEmail);
        const tokenTarget = await createMember('EMAIL-B', matchingEmail);
        const account = await createUser('EMAIL');
        await run(database, 'UPDATE users SET username = ? WHERE id = ?', [matchingEmail, account.userId]);

        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, { ...account, username: matchingEmail }).cookie,
            body: { token: 'invalid', email: matchingEmail }
        })).status, 400);
        assert.equal((await get(database, 'SELECT youth_id FROM users WHERE id = ?', [account.userId])).youth_id, null);

        const issued = await issue(tokenTarget);
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, { ...account, username: matchingEmail }).cookie,
            body: { token: issued.rawToken, email: matchingEmail }
        })).status, 200);
        assert.equal((await get(database, 'SELECT youth_id FROM users WHERE id = ?', [account.userId])).youth_id, tokenTarget);
        assert.notEqual(tokenTarget, emailMember);
    });

    await t.test('linkage or attestation failure rolls back token consumption and remains retryable', async () => {
        const targetYouthId = await createMember('LINK-ROLLBACK');
        const account = await createUser('LINK-ROLLBACK');
        const issued = await issue(targetYouthId);
        await run(
            database,
            `CREATE TRIGGER force_claim_link_failure
             BEFORE UPDATE OF account_claimed_at ON users
             WHEN NEW.id = ${account.userId}
             BEGIN SELECT RAISE(ABORT, 'forced claim linkage failure'); END`
        );
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, account).cookie,
            body: { token: issued.rawToken }
        })).status, 500);
        const afterFailure = await get(
            database,
            'SELECT youth_id, account_claimed_at FROM users WHERE id = ?',
            [account.userId]
        );
        assert.deepEqual(afterFailure, { youth_id: null, account_claimed_at: null });
        assert.equal((await get(database, 'SELECT used_at FROM account_claim_tokens WHERE id = ?', [issued.id])).used_at, null);
        await run(database, 'DROP TRIGGER force_claim_link_failure');
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, account).cookie,
            body: { token: issued.rawToken }
        })).status, 200);
    });

    await t.test('token-consumption failure rolls back account linkage and attestation', async () => {
        const targetYouthId = await createMember('TOKEN-ROLLBACK');
        const account = await createUser('TOKEN-ROLLBACK');
        const issued = await issue(targetYouthId);
        await run(
            database,
            `CREATE TRIGGER force_claim_consume_failure
             BEFORE UPDATE OF used_at ON account_claim_tokens
             WHEN NEW.id = ${issued.id}
             BEGIN SELECT RAISE(ABORT, 'forced claim consumption failure'); END`
        );
        assert.equal((await requestJson(origin, '/api/account-claim/complete', {
            cookie: createSession(application.sessionStore, account).cookie,
            body: { token: issued.rawToken }
        })).status, 500);
        assert.deepEqual(await get(
            database,
            `SELECT youth_id, account_claimed_at, account_claim_method, account_claim_token_id
             FROM users WHERE id = ?`,
            [account.userId]
        ), {
            youth_id: null,
            account_claimed_at: null,
            account_claim_method: null,
            account_claim_token_id: null
        });
        assert.equal((await get(database, 'SELECT used_at FROM account_claim_tokens WHERE id = ?', [issued.id])).used_at, null);
        await run(database, 'DROP TRIGGER force_claim_consume_failure');
    });

    await t.test('concurrent redemption has exactly one successful claimant', async () => {
        const targetYouthId = await createMember('CONCURRENT');
        const firstAccount = await createUser('CONCURRENT-A');
        const secondAccount = await createUser('CONCURRENT-B');
        const issued = await issue(targetYouthId);
        const responses = await Promise.all([
            requestJson(origin, '/api/account-claim/complete', {
                cookie: createSession(application.sessionStore, firstAccount).cookie,
                body: { token: issued.rawToken }
            }),
            requestJson(origin, '/api/account-claim/complete', {
                cookie: createSession(application.sessionStore, secondAccount).cookie,
                body: { token: issued.rawToken }
            })
        ]);
        assert.equal(responses.filter(response => response.status === 200).length, 1);
        assert.equal(responses.filter(response => response.status === 400).length, 1);
        const linkedCount = await get(
            database,
            'SELECT COUNT(*) count FROM users WHERE youth_id = ? AND account_claimed_at IS NOT NULL',
            [targetYouthId]
        );
        assert.equal(linkedCount.count, 1);
        const consumed = await get(
            database,
            'SELECT used_at, consumed_by_user_id FROM account_claim_tokens WHERE id = ?',
            [issued.id]
        );
        assert.equal(Number.isInteger(consumed.used_at), true);
        assert.ok([firstAccount.userId, secondAccount.userId].includes(consumed.consumed_by_user_id));
    });

    const completionAudits = await new Promise((resolve, reject) => {
        database.all(
            "SELECT username, action, details FROM activity_logs WHERE action = 'ACCOUNT_CLAIM_COMPLETED'",
            [],
            (error, rows) => error ? reject(error) : resolve(rows || [])
        );
    });
    assert.ok(completionAudits.length >= 4);
    const serializedAudits = JSON.stringify(completionAudits);
    const tokenHashes = await new Promise((resolve, reject) => {
        database.all('SELECT token_hash FROM account_claim_tokens', [], (error, rows) => (
            error ? reject(error) : resolve(rows || [])
        ));
    });
    for (const row of tokenHashes) assert.equal(serializedAudits.includes(row.token_hash), false);
});
