'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
}

function execute(database, sql) {
    return new Promise((resolve, reject) => {
        database.exec(sql, err => err ? reject(err) : resolve());
    });
}

// Dispatch the actual registered Express route stack, including its real session
// and database-backed authorization guards, without opening a network listener.
function request(app, pathname, { method = 'GET', cookie, body = {}, headers = {} } = {}) {
    const parsedPath = new URL(pathname, 'http://isolated.test');
    const router = app.router || app._router;
    const matchingRoutes = router.stack.flatMap(layer => {
        if (!layer.route || !layer.route.methods[method.toLowerCase()]) return [];
        const match = layer.matchers[0](parsedPath.pathname);
        return match ? [{ route: layer.route, params: match.params }] : [];
    });
    assert.equal(matchingRoutes.length, 1, `${method} ${parsedPath.pathname} has one effective registration`);
    const { route, params } = matchingRoutes[0];
    return new Promise((resolve, reject) => {
        let completed = false;
        let handlerIndex = 0;
        const responseHeaders = Object.create(null);
        const req = {
            body,
            params: { ...params },
            query: Object.fromEntries(parsedPath.searchParams),
            headers: {
                ...(cookie ? { cookie } : {}),
                ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
            },
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1', encrypted: false }
        };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(name, value) { responseHeaders[name.toLowerCase()] = value; },
            getHeader(name) { return responseHeaders[name.toLowerCase()]; },
            json(json) {
                if (!completed) {
                    completed = true;
                    resolve({ status: this.statusCode, json, headers: responseHeaders });
                }
                return this;
            },
            send(value) { return this.json(value); }
        };
        const next = err => {
            if (completed) return;
            if (err) {
                completed = true;
                reject(err);
                return;
            }
            const handler = route.stack[handlerIndex++]?.handle;
            if (!handler) {
                completed = true;
                reject(new Error(`${method} ${parsedPath.pathname} completed without a response`));
                return;
            }
            try {
                Promise.resolve(handler(req, res, next)).catch(reject);
            } catch (handlerError) {
                completed = true;
                reject(handlerError);
            }
        };
        next();
    });
}

async function createIdentity(database, suffix, permissions = []) {
    const username = `MEMBERSHIP-${suffix}`;
    const name = `Membership Fixture ${suffix}`;
    const password = 'disposable-membership-fixture-password';
    const youth = await run(database,
        `INSERT INTO youth (name, email, qr_code, password, account_tier, created_at)
         VALUES (?, ?, ?, ?, 'Wanderer', datetime('now'))`,
        [name, `${suffix.toLowerCase()}@invalid.test`, username, password]);
    const user = await run(database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [username, password, JSON.stringify(permissions), youth.lastID]);
    return { username, name, youthId: youth.lastID, userId: user.lastID };
}

function createSession(sessionStore, identity) {
    const sessionId = `membership-${identity.userId}`;
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 600_000
    });
    return `koinonia_session=${sessionId}`;
}

async function membershipState(database) {
    return {
        members: await all(database,
            `SELECT id, account_tier, commitment_intent, commitment_date,
                    commitment_accepted_at, commitment_accepted_by FROM youth ORDER BY id`),
        users: await all(database, 'SELECT id, permissions FROM users ORDER BY id'),
        logs: await all(database, 'SELECT * FROM activity_logs ORDER BY id'),
        evidence: await all(database, 'SELECT * FROM growth_evidence ORDER BY id'),
        enrollments: await all(database, 'SELECT * FROM growth_onboarding_enrollments ORDER BY id'),
        partners: await all(database, 'SELECT * FROM secret_prayer_pals ORDER BY id')
    };
}

test('membership intents enforce canonical ownership and leadership approval', { concurrency: false }, async t => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-membership-auth-test-'));
    let database;
    t.after(async () => {
        if (database) await new Promise((resolve, reject) => {
            database.close(err => err ? reject(err) : resolve());
        });
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    for (const directory of ['terms', 'privacy']) {
        await fsp.cp(path.join(repositoryRoot, 'public', directory), path.join(temporaryRoot, 'public', directory), { recursive: true });
    }
    const serverSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const isolationReplacements = [
        ['void runDatabaseBackup();', 'void Promise.resolve();'],
        ['setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);', 'setInterval(() => {}, 1000 * 60 * 60).unref();'],
        ["cron.schedule('0 9 * * 1',", "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"],
        ['startServerAfterRuntimeSchemaReady();', 'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };']
    ];
    let isolatedServerSource = serverSource;
    for (const [original, replacement] of isolationReplacements) {
        assert.ok(isolatedServerSource.includes(original), `isolation hook exists: ${original}`);
        isolatedServerSource = isolatedServerSource.replace(original, replacement);
    }
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedServerSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'legal-acceptance.js', 'growth-journey.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated membership test</title>');

    // Only the copied server is loaded; its __dirname-based database is new and
    // empty. No staging database is opened or copied into this fixture.
    const isolatedApplication = require(path.join(temporaryRoot, 'server.js'));
    database = isolatedApplication.db;
    assert.equal(database.filename, path.join(temporaryRoot, 'fog_community.db'));
    await isolatedApplication.ready;
    for (const migration of ['20260913_growth_journey_v1.sql', '20260913_growth_journey_ministry_hierarchy_fix.sql']) {
        await execute(database, await fsp.readFile(path.join(repositoryRoot, 'migrations', migration), 'utf8'));
    }

    const { app, sessionStore } = isolatedApplication;
    const member = await createIdentity(database, 'MEMBER', ['access_prayer']);
    const legacyMember = await createIdentity(database, 'LEGACY');
    const other = await createIdentity(database, 'OTHER');
    const leader = await createIdentity(database, 'LEADER', ['edit_entries']);
    const memberCookie = createSession(sessionStore, member);
    const legacyCookie = createSession(sessionStore, legacyMember);
    const otherCookie = createSession(sessionStore, other);
    const leaderCookie = createSession(sessionStore, leader);
    const commitRoutes = ['commit', 'commit-v2'];
    const approvalRoutes = ['community-intents', 'community-intents-v2'];
    const forgedBody = {
        actor: 'FORGED-ACTOR', accepted_by: 'FORGED-ACCEPTED', approved_by: 'FORGED-APPROVED',
        username: 'FORGED-USERNAME', user_id: other.userId, youth_id: other.youthId,
        permissions: ['edit_entries'], is_admin: true,
        intent_message: 'A personal reflection for the isolated fixture.'
    };

    await t.test('all seven effective routes have exactly one registration', () => {
        const expected = [
            ...commitRoutes.map(route => ['post', `/api/youth/:id/${route}`]),
            ...approvalRoutes.flatMap(route => [
                ['get', `/api/admin/${route}`], ['post', `/api/admin/${route}/:id/approve`]
            ]),
            ['get', '/api/youth-v2/:id/tier']
        ];
        const stack = (app.router || app._router).stack;
        for (const [method, pathname] of expected) {
            assert.equal(stack.filter(layer => layer.route?.path === pathname && layer.route.methods[method]).length,
                1, `${method.toUpperCase()} ${pathname}`);
        }
    });

    await t.test('anonymous mutations return 401 and leave membership state unchanged', async () => {
        const before = await membershipState(database);
        for (const route of commitRoutes) {
            assert.equal((await request(app, `/api/youth/${member.youthId}/${route}`, {
                method: 'POST', body: forgedBody
            })).status, 401);
        }
        for (const route of approvalRoutes) {
            assert.equal((await request(app, `/api/admin/${route}/${member.youthId}/approve`, {
                method: 'POST', body: forgedBody
            })).status, 401);
        }
        assert.deepEqual(await membershipState(database), before);
    });

    await t.test('commit URL ownership is required even for leadership and forged actors', async () => {
        const before = await membershipState(database);
        for (const route of commitRoutes) {
            for (const cookie of [memberCookie, leaderCookie]) {
                assert.equal((await request(app, `/api/youth/${other.youthId}/${route}`, {
                    method: 'POST', cookie, body: forgedBody
                })).status, 403);
            }
        }
        assert.deepEqual(await membershipState(database), before);
    });

    await t.test('explicit conflicting or invalid commit body youth IDs return 403', async () => {
        const before = await membershipState(database);
        const invalidIds = [other.youthId, String(other.youthId), null, 0, -1, true, false, '', 'invalid', '1e0', [], {}, 1.5];
        for (const route of commitRoutes) {
            for (const youthId of invalidIds) {
                assert.equal((await request(app, `/api/youth/${member.youthId}/${route}`, {
                    method: 'POST', cookie: memberCookie,
                    body: { ...forgedBody, youth_id: youthId }
                })).status, 403, `${route}: ${JSON.stringify(youthId)}`);
            }
        }
        assert.deepEqual(await membershipState(database), before);
    });

    await t.test('ordinary members cannot approve themselves or another member through forged authority', async () => {
        const before = await membershipState(database);
        for (const route of approvalRoutes) {
            for (const youthId of [member.youthId, other.youthId]) {
                assert.equal((await request(app, `/api/admin/${route}/${youthId}/approve?permissions=edit_entries&is_admin=true`, {
                    method: 'POST', cookie: memberCookie, body: forgedBody,
                    headers: { 'X-User-Permissions': 'edit_entries', 'X-Admin': 'true', 'X-User-Id': String(leader.userId) }
                })).status, 403);
            }
        }
        assert.deepEqual(await membershipState(database), before);
    });

    await t.test('own primary intent preserves permissions and starts real Growth Journey onboarding', async () => {
        const otherBefore = await get(database, 'SELECT * FROM youth WHERE id = ?', [other.youthId]);
        const response = await request(app, `/api/youth/${member.youthId}/commit`, {
            method: 'POST', cookie: memberCookie,
            body: { ...forgedBody, youth_id: String(member.youthId), intent_message: '  My genuine reflection.  ' }
        });
        assert.equal(response.status, 200);
        assert.equal(response.json.success, true);
        assert.equal(response.json.member.id, member.youthId);
        assert.equal(response.json.member.account_tier, 'Committed Member');
        assert.equal(response.json.growthJourneyWarning, null);
        assert.ok(response.json.growthJourney);
        assert.deepEqual([...response.json.permissions].sort(), ['access_directory', 'access_prayer']);
        const stored = await get(database, 'SELECT * FROM youth WHERE id = ?', [member.youthId]);
        assert.equal(stored.commitment_intent, 'My genuine reflection.');
        assert.ok(stored.commitment_date);
        assert.equal(stored.commitment_accepted_at, null);
        assert.equal(stored.commitment_accepted_by, null);
        const evidence = await get(database,
            "SELECT * FROM growth_evidence WHERE youth_id = ? AND evidence_type = 'membership_intent'", [member.youthId]);
        assert.equal(evidence.recorded_by, member.username);
        const enrollment = await get(database, 'SELECT * FROM growth_onboarding_enrollments WHERE youth_id = ?', [member.youthId]);
        assert.equal(enrollment.status, 'active');
        assert.equal(enrollment.trigger_type, 'membership_intent');
        const log = await get(database, "SELECT * FROM activity_logs WHERE action = 'COMMITMENT_PLEDGE' ORDER BY id DESC LIMIT 1");
        assert.equal(log.username, member.name);
        assert.ok(log.details.includes(`Member ID ${member.youthId}`));
        assert.deepEqual(await get(database, 'SELECT * FROM youth WHERE id = ?', [other.youthId]), otherBefore);

        // A retry without a redundant body ID keeps the first commitment date
        // and does not duplicate evidence or onboarding enrollment.
        assert.equal((await request(app, `/api/youth/${member.youthId}/commit`, {
            method: 'POST', cookie: memberCookie, body: { intent_message: 'Updated reflection.' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT commitment_date FROM youth WHERE id = ?', [member.youthId])).commitment_date, stored.commitment_date);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM growth_evidence WHERE youth_id = ?', [member.youthId])).count, 1);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM growth_onboarding_enrollments WHERE youth_id = ?', [member.youthId])).count, 1);
    });

    await t.test('own legacy intent retains Integration Period without adding a Growth Journey hook', async () => {
        const response = await request(app, `/api/youth/${legacyMember.youthId}/commit-v2`, {
            method: 'POST', cookie: legacyCookie,
            body: { ...forgedBody, youth_id: legacyMember.youthId, intent_message: 'Legacy reflection.' }
        });
        assert.equal(response.status, 200);
        assert.equal(response.json.success, true);
        assert.equal(response.json.member.id, legacyMember.youthId);
        assert.equal(response.json.member.account_tier, 'Integration Period');
        assert.deepEqual(response.json.permissions, ['access_directory']);
        const stored = await get(database, 'SELECT * FROM youth WHERE id = ?', [legacyMember.youthId]);
        assert.equal(stored.commitment_intent, 'Legacy reflection.');
        assert.ok(stored.commitment_date);
        assert.equal(stored.commitment_accepted_at, null);
        assert.equal(stored.commitment_accepted_by, null);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM growth_evidence WHERE youth_id = ?', [legacyMember.youthId])).count, 0);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM growth_onboarding_enrollments WHERE youth_id = ?', [legacyMember.youthId])).count, 0);
        const log = await get(database, "SELECT * FROM activity_logs WHERE action = 'COMMITMENT_PLEDGE' ORDER BY id DESC LIMIT 1");
        assert.equal(log.username, legacyMember.username);
        assert.ok(log.details.includes(`Member ID ${legacyMember.youthId}`));
    });

    await t.test('leadership approvals select the URL target and record canonical stored identity', async () => {
        // A stale session name must not override the current database identity.
        sessionStore.get(`membership-${leader.userId}`).username = 'STALE-SESSION-LEADER';
        for (const [route, target, hasAcceptance] of [
            ['community-intents', other, false],
            ['community-intents-v2', legacyMember, true]
        ]) {
            const beforeLogs = (await get(database, "SELECT COUNT(*) count FROM activity_logs WHERE action = 'MEMBERSHIP_APPROVED'")).count;
            const bodyTargetBefore = await get(database, 'SELECT * FROM youth WHERE id = ?', [member.youthId]);
            const response = await request(app, `/api/admin/${route}/${target.youthId}/approve`, {
                method: 'POST', cookie: leaderCookie,
                body: { ...forgedBody, youth_id: member.youthId, user_id: member.userId }
            });
            assert.equal(response.status, 200);
            assert.equal(response.json.success, true);
            const stored = await get(database, 'SELECT * FROM youth WHERE id = ?', [target.youthId]);
            assert.equal(stored.account_tier, 'Committed Member');
            if (hasAcceptance) {
                assert.equal(stored.commitment_accepted_by, leader.username);
                assert.ok(stored.commitment_accepted_at);
            } else {
                assert.equal(stored.commitment_accepted_by, null);
                assert.equal(stored.commitment_accepted_at, null);
            }
            const logs = await all(database, "SELECT * FROM activity_logs WHERE action = 'MEMBERSHIP_APPROVED' ORDER BY id");
            assert.equal(logs.length, beforeLogs + 1);
            assert.equal(logs.at(-1).username, leader.username);
            assert.ok(logs.at(-1).details.includes(`Member ID ${target.youthId}`));
            assert.deepEqual(await get(database, 'SELECT * FROM youth WHERE id = ?', [member.youthId]), bodyTargetBefore);
        }
    });

    await t.test('protected lists require leadership and tier reads allow only self or leadership', async () => {
        for (const route of approvalRoutes) {
            assert.equal((await request(app, `/api/admin/${route}`)).status, 401);
            assert.equal((await request(app, `/api/admin/${route}`, { cookie: memberCookie })).status, 403);
            const allowed = await request(app, `/api/admin/${route}`, { cookie: leaderCookie });
            assert.equal(allowed.status, 200);
            assert.ok(Array.isArray(allowed.json));
            assert.ok(allowed.json.some(row => row.id === member.youthId));
        }
        const tierPath = `/api/youth-v2/${other.youthId}/tier`;
        assert.equal((await request(app, tierPath)).status, 401);
        assert.equal((await request(app, tierPath, { cookie: memberCookie })).status, 403);
        for (const cookie of [otherCookie, leaderCookie]) {
            const allowed = await request(app, tierPath, { cookie });
            assert.equal(allowed.status, 200);
            assert.deepEqual(allowed.json, { account_tier: 'Committed Member' });
        }
    });

    await t.test('permission revocation takes effect for approvals and protected reads in the same session', async () => {
        sessionStore.get(`membership-${leader.userId}`).permissions = ['edit_entries'];
        await run(database, 'UPDATE users SET permissions = ? WHERE id = ?', ['[]', leader.userId]);
        const before = await membershipState(database);
        const forgedHeaders = { 'X-User-Permissions': 'edit_entries', 'X-Admin': 'true' };
        for (const route of approvalRoutes) {
            assert.equal((await request(app, `/api/admin/${route}/${member.youthId}/approve?permissions=edit_entries`, {
                method: 'POST', cookie: leaderCookie, body: forgedBody, headers: forgedHeaders
            })).status, 403);
            assert.equal((await request(app, `/api/admin/${route}?permissions=edit_entries`, {
                cookie: leaderCookie, headers: forgedHeaders
            })).status, 403);
        }
        assert.equal((await request(app, `/api/youth-v2/${member.youthId}/tier?permissions=edit_entries`, {
            cookie: leaderCookie, headers: forgedHeaders
        })).status, 403);
        assert.equal((await request(app, `/api/youth-v2/${leader.youthId}/tier`, { cookie: leaderCookie })).status, 200);
        assert.deepEqual(await membershipState(database), before);
    });

    assert.equal((await get(database, 'PRAGMA integrity_check')).integrity_check, 'ok');
});
