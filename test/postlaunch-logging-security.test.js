'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(repositoryRoot, 'server.js'), 'utf8');

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => database.run(sql, params, function (error) {
        if (error) return reject(error);
        resolve({ lastID: this.lastID, changes: this.changes });
    }));
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => database.get(sql, params, (error, row) =>
        error ? reject(error) : resolve(row)));
}

function execute(database, sql) {
    return new Promise((resolve, reject) => database.exec(sql, error => error ? reject(error) : resolve()));
}

function request(app, pathname, { method = 'GET', cookie, body = {} } = {}) {
    const parsed = new URL(pathname, 'http://isolated.test');
    const router = app.router || app._router;
    const matches = router.stack.flatMap(layer => {
        if (!layer.route || !layer.route.methods[method.toLowerCase()]) return [];
        const match = layer.matchers[0](parsed.pathname);
        return match ? [{ route: layer.route, params: match.params }] : [];
    });
    assert.equal(matches.length, 1, `${method} ${parsed.pathname} has one effective route`);
    return new Promise((resolve, reject) => {
        const { route, params } = matches[0];
        let index = 0;
        let completed = false;
        const req = {
            body,
            params: { ...params },
            query: Object.fromEntries(parsed.searchParams),
            headers: cookie ? { cookie } : {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1', encrypted: false }
        };
        const res = {
            statusCode: 200,
            headers: {},
            status(code) { this.statusCode = code; return this; },
            setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
            getHeader(name) { return this.headers[name.toLowerCase()]; },
            json(json) {
                if (!completed) {
                    completed = true;
                    resolve({ status: this.statusCode, json });
                }
                return this;
            },
            send(value) { return this.json(value); }
        };
        const next = error => {
            if (completed) return;
            if (error) return reject(error);
            const handler = route.stack[index++]?.handle;
            if (!handler) return reject(new Error('Route completed without a response'));
            try { Promise.resolve(handler(req, res, next)).catch(reject); } catch (caught) { reject(caught); }
        };
        next();
    });
}

async function createIdentity(database, suffix, permissions = [], useEmailUsername = false) {
    const email = `${suffix.toLowerCase()}@invalid.test`;
    const username = useEmailUsername ? email : `POSTLAUNCH-${suffix}`;
    const name = `Postlaunch ${suffix}`;
    const youth = await run(database,
        `INSERT INTO youth (name, email, qr_code, password, account_tier, created_at)
         VALUES (?, ?, ?, 'fixture-password', 'New Member', datetime('now'))`,
        [name, email, `POSTLAUNCH-${suffix}`]);
    const user = await run(database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, 'fixture-password', ?, ?, datetime('now'))`,
        [username, JSON.stringify(permissions), youth.lastID]);
    return { email, username, name, youthId: youth.lastID, userId: user.lastID };
}

function session(sessionStore, identity) {
    const id = `postlaunch-${identity.userId}`;
    sessionStore.set(id, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: 'STALE-SESSION-ACTOR',
        createdAt: Date.now(),
        expiresAt: Date.now() + 600_000
    });
    return `koinonia_session=${id}`;
}

test('post-launch logging APIs preserve history and enforce canonical identities', { concurrency: false }, async t => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-postlaunch-logs-'));
    let database;
    t.after(async () => {
        if (database) await new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    for (const directory of ['terms', 'privacy']) {
        await fsp.cp(path.join(repositoryRoot, 'public', directory), path.join(temporaryRoot, 'public', directory), { recursive: true });
    }
    let isolatedSource = serverSource;
    for (const [original, replacement] of [
        ['void runDatabaseBackup();', 'void Promise.resolve();'],
        ['setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);', 'setInterval(() => {}, 1000 * 60 * 60).unref();'],
        ["cron.schedule('0 9 * * 1',", "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"],
        ['startServerAfterRuntimeSchemaReady();', 'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };']
    ]) {
        assert.ok(isolatedSource.includes(original), `isolation hook exists: ${original}`);
        isolatedSource = isolatedSource.replace(original, replacement);
    }
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of [
        'sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'legal-acceptance.js',
        'growth-journey.js', 'notification-center.js', 'notification-delivery.js', 'growth-notifications.js'
    ]) await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Postlaunch fixture</title>');

    const application = require(path.join(temporaryRoot, 'server.js'));
    database = application.db;
    assert.equal(database.filename, path.join(temporaryRoot, 'fog_community.db'));
    await application.ready;
    for (const migration of [
        '20260913_growth_journey_v1.sql',
        '20260913_growth_journey_ministry_hierarchy_fix.sql',
        '20260914_growth_encounter_readiness_v1.sql',
        '20260914_growth_prayer_rhythm_v1.sql'
    ]) await execute(database, await fsp.readFile(path.join(repositoryRoot, 'migrations', migration), 'utf8'));

    const member = await createIdentity(database, 'MEMBER');
    const other = await createIdentity(database, 'OTHER');
    const leader = await createIdentity(database, 'LEADER', [
        'add_entries', 'edit_entries', 'access_ministries', 'access_activity', 'access_attendance'
    ], true);
    const memberCookie = session(application.sessionStore, member);
    const leaderCookie = session(application.sessionStore, leader);

    await t.test('Audit Logs require access_activity and resolve stored account email to member name', async () => {
        await run(database,
            `INSERT INTO activity_logs (username, action, details, created_at) VALUES (?, 'FIXTURE', 'Safe details', '2026-09-15 10:00:00')`,
            [leader.email]);
        assert.equal((await request(application.app, '/api/activity-logs')).status, 401);
        assert.equal((await request(application.app, '/api/activity-logs', { cookie: memberCookie })).status, 403);
        const response = await request(application.app, '/api/activity-logs', { cookie: leaderCookie });
        assert.equal(response.status, 200);
        assert.equal(response.json.find(row => row.action === 'FIXTURE').username, leader.name);
    });

    await t.test('announcement Inbox resolves canonical name and never exposes an unresolved author email', async () => {
        const linked = await run(database,
            `INSERT INTO announcements (title, message, target_audience, author, created_at)
             VALUES ('Linked', 'Message', 'All', ?, '2026-09-15 10:01:00')`, [leader.email]);
        const unlinked = await run(database,
            `INSERT INTO announcements (title, message, target_audience, author, created_at)
             VALUES ('Unlinked', 'Message', 'All', 'unknown@invalid.test', '2026-09-15 10:02:00')`);
        for (const id of [linked.lastID, unlinked.lastID]) {
            await run(database,
                `INSERT INTO user_notifications (youth_id, announcement_id, created_at) VALUES (?, ?, '2026-09-15 10:03:00')`,
                [member.youthId, id]);
        }
        const response = await request(application.app, '/api/communications/inbox', { cookie: memberCookie });
        assert.equal(response.status, 200);
        assert.equal(response.json.find(row => row.title === 'Linked').author, leader.name);
        assert.equal(response.json.find(row => row.title === 'Unlinked').author, 'FOG Leadership');
        assert.equal(response.json.some(row => String(row.author).includes('@')), false);
    });

    await t.test('ambiguous historical email identities neither multiply rows nor expose the email', async () => {
        await run(database,
            `INSERT INTO users (username, password, permissions, youth_id, created_at)
             VALUES (?, 'fixture-password', '[]', ?, datetime('now'))`,
            [leader.email.toUpperCase(), other.youthId]);
        const inbox = await request(application.app, '/api/communications/inbox', { cookie: memberCookie });
        assert.equal(inbox.status, 200);
        assert.equal(inbox.json.filter(row => row.title === 'Linked').length, 1);
        assert.equal(inbox.json.find(row => row.title === 'Linked').author, 'FOG Leadership');
        const audit = await request(application.app, '/api/activity-logs', { cookie: leaderCookie });
        assert.equal(audit.status, 200);
        assert.equal(audit.json.filter(row => row.action === 'FIXTURE').length, 1);
        assert.equal(audit.json.find(row => row.action === 'FIXTURE').username, 'System');
    });

    await t.test('Community Intent history uses its durable audit timestamp when evidence is absent', async () => {
        await run(database, 'UPDATE youth SET commitment_intent = ? WHERE id = ?', ['Intent fixture', member.youthId]);
        await run(database,
            `INSERT INTO activity_logs (username, action, details, created_at)
             VALUES (?, 'COMMITMENT_PLEDGE', ?, '2026-09-15 10:04:00')`,
            [member.username, `Member ID ${member.youthId} expressed intent to journey with the community`]);
        const response = await request(application.app, '/api/admin/community-intents-v2', { cookie: leaderCookie });
        assert.equal(response.status, 200);
        assert.equal(response.json.find(row => row.id === member.youthId).intent_recorded_at, '2026-09-15 10:04:00');
    });

    await t.test('Attendance Logs retain orphan records without mutating their references', async () => {
        await run(database,
            `INSERT INTO attendance (youth_id, event_id, is_walkin, checked_in_at)
             VALUES (999991, 999992, 1, '2026-09-15 10:05:00')`);
        const response = await request(application.app, '/api/attendance/logs', { cookie: leaderCookie });
        assert.equal(response.status, 200);
        const orphan = response.json.find(row => row.youth_id === 999991);
        assert.equal(orphan.has_missing_reference, 1);
        assert.match(orphan.member_name, /Unknown member/);
        assert.equal((await get(database, 'SELECT youth_id, event_id FROM attendance WHERE id = ?', [orphan.id])).event_id, 999992);
    });

    await t.test('ministry application and role changes reject spoofing and create durable canonical history', async () => {
        const ministry = await run(database,
            `INSERT INTO ministries (name, description, created_at) VALUES ('Hospitality', 'Fixture', '2026-09-15 10:06:00')`);
        const path = `/api/ministries/${ministry.lastID}/apply`;
        assert.equal((await request(application.app, path, {
            method: 'POST', body: { youth_id: member.youthId, actor: 'FORGED' }
        })).status, 401);
        assert.equal((await request(application.app, path, {
            method: 'POST', cookie: memberCookie, body: { youth_id: other.youthId, actor: 'FORGED' }
        })).status, 403);
        const applied = await request(application.app, path, {
            method: 'POST', cookie: memberCookie,
            body: { youth_id: member.youthId, actor: 'FORGED', intent_message: 'I would like to serve.' }
        });
        assert.equal(applied.status, 200);
        const mapping = await get(database,
            'SELECT * FROM ministry_members WHERE ministry_id = ? AND youth_id = ?',
            [ministry.lastID, member.youthId]);
        let history = await get(database,
            'SELECT * FROM ministry_role_history WHERE ministry_id = ? AND youth_id = ? ORDER BY id',
            [ministry.lastID, member.youthId]);
        assert.equal(history.role, 'Applicant');
        assert.equal(history.actor, member.name);

        const updatePath = `/api/ministries-v36/${ministry.lastID}/members/${mapping.id}`;
        assert.equal((await request(application.app, updatePath, {
            method: 'PUT', cookie: memberCookie, body: { role: 'Core', actor: 'FORGED' }
        })).status, 403);
        assert.equal((await request(application.app, updatePath, {
            method: 'PUT', cookie: leaderCookie, body: { role: 'Core', actor: 'FORGED' }
        })).status, 200);
        history = await get(database,
            'SELECT * FROM ministry_role_history WHERE ministry_id = ? AND youth_id = ? ORDER BY id DESC',
            [ministry.lastID, member.youthId]);
        assert.equal(history.role, 'Core');
        assert.equal(history.actor, leader.name);

        const assigned = await request(application.app, `/api/ministries/${ministry.lastID}/members`, {
            method: 'POST', cookie: leaderCookie,
            body: { youth_id: other.youthId, role: 'Member', actor: 'FORGED' }
        });
        assert.equal(assigned.status, 200);
        const assignmentHistory = await get(database,
            'SELECT * FROM ministry_role_history WHERE ministry_id = ? AND youth_id = ? ORDER BY id DESC',
            [ministry.lastID, other.youthId]);
        assert.equal(assignmentHistory.role, 'Member');
        assert.equal(assignmentHistory.actor, leader.name);

        await run(database,
            `INSERT INTO ministry_role_history
                (ministry_id, youth_id, role, actor, timestamp, intent_message)
             VALUES (999993, 999994, 'Historical', 'System', '2026-09-15 10:07:00', 'Orphan fixture')`);
        const logs = await request(application.app, '/api/admin/ministry-logs-v36', { cookie: leaderCookie });
        assert.equal(logs.status, 200);
        assert.match(logs.json.find(row => row.youth_id === 999994).applicant_name, /Unknown member/);
    });
});

test('active logging and ministry endpoints declare canonical authorization guards', () => {
    assert.match(serverSource, /app\.get\('\/api\/activity-logs', requirePermission\('access_activity'\),/);
    assert.match(serverSource, /app\.put\('\/api\/ministries-v36\/:id\/members\/:mappingId', requireAllPermissions\(\['access_ministries', 'edit_entries'\]\),/);
    assert.match(serverSource, /app\.post\('\/api\/ministries\/:id\/apply', requireAuth,/);
    assert.match(serverSource, /app\.post\('\/api\/ministries\/:id\/members', requireAllPermissions\(\['access_ministries', 'add_entries'\]\),/);
    assert.doesNotMatch(
        serverSource.slice(serverSource.indexOf("app.put('/api/ministries-v36/:id/members/:mappingId'"), serverSource.indexOf("app.get('/api/admin/ministry-logs-v36'")),
        /const\s*\{[^}]*actor[^}]*\}\s*=\s*req\.body/
    );
});

test('legacy Path and Milestone writes are retired while historical reads remain', () => {
    assert.match(serverSource, /function retireLegacyPathwayMutation/);
    assert.match(serverSource, /app\.post\('\/api\/discipleship\/milestones', requireAuth, retireLegacyPathwayMutation\)/);
    assert.match(serverSource, /app\.get\('\/api\/discipleship\/pathways'/);
    assert.match(serverSource, /app\.get\('\/api\/discipleship\/member-progress\/:youth_id'/);
    assert.match(serverSource, /Legacy Paths and Milestones are read-only/);
    assert.match(serverSource, /CREATE TABLE IF NOT EXISTS discipleship_pathways/);
    assert.match(serverSource, /CREATE TABLE IF NOT EXISTS member_milestones/);
});
