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
        database.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

function execute(database, sql) {
    return new Promise((resolve, reject) => {
        database.exec(sql, error => error ? reject(error) : resolve());
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close(error => error ? reject(error) : resolve());
    });
}

function request(app, pathname, { method = 'GET', cookie, body = {}, headers = {} } = {}) {
    const parsedPath = new URL(pathname, 'http://isolated.test');
    const router = app.router || app._router;
    const matches = router.stack.flatMap(layer => {
        if (!layer.route || !layer.route.methods[method.toLowerCase()]) return [];
        const match = layer.matchers[0](parsedPath.pathname);
        return match ? [{ route: layer.route, params: match.params }] : [];
    });
    assert.equal(matches.length, 1, `${method} ${parsedPath.pathname} has one effective registration`);
    const { route, params } = matches[0];
    return new Promise((resolve, reject) => {
        let completed = false;
        let handlerIndex = 0;
        const req = {
            body,
            params: { ...params },
            query: Object.fromEntries(parsedPath.searchParams),
            headers: {
                ...(cookie ? { cookie } : {}),
                ...Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
            },
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1', encrypted: false }
        };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader() {},
            getHeader() { return undefined; },
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
            const handler = route.stack[handlerIndex++]?.handle;
            if (!handler) return reject(new Error(`${method} ${parsedPath.pathname} completed without a response`));
            try {
                Promise.resolve(handler(req, res, next)).catch(reject);
            } catch (handlerError) {
                reject(handlerError);
            }
        };
        next();
    });
}

async function createIdentity(database, suffix, permissions) {
    const username = `GROWTH-EVENT-${suffix}`;
    const password = 'disposable-growth-event-fixture-password';
    const youth = await run(database,
        `INSERT INTO youth (name, email, qr_code, password, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [`Growth Event ${suffix}`, `${suffix.toLowerCase()}@invalid.test`, username, password]);
    const user = await run(database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [username, password, JSON.stringify(permissions), youth.lastID]);
    return { username, userId: user.lastID, youthId: youth.lastID };
}

function createSession(sessionStore, identity) {
    const sessionId = `growth-event-${identity.userId}`;
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 600_000
    });
    return `koinonia_session=${sessionId}`;
}

test('Growth event administration APIs enforce permissions and explicit mapping semantics', { concurrency: false }, async t => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-growth-event-auth-test-'));
    let database;
    t.after(async () => {
        if (database) await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });

    await fsp.copyFile(
        path.join(
            repositoryRoot,
            'lib',
            'prayer-covenant-daily.js'
        ),
        path.join(
            temporaryRoot,
            'lib',
            'prayer-covenant-daily.js'
        )
    );
    await fsp.copyFile(
        path.join(repositoryRoot, 'lib', 'community-spotlight.js'),
        path.join(temporaryRoot, 'lib', 'community-spotlight.js')
    );
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    for (const directory of ['terms', 'privacy']) {
        await fsp.cp(path.join(repositoryRoot, 'public', directory), path.join(temporaryRoot, 'public', directory), { recursive: true });
    }
    let isolatedServerSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const replacements = [
        ['void runDatabaseBackup();', 'void Promise.resolve();'],
        ['setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);', 'setInterval(() => {}, 1000 * 60 * 60).unref();'],
        ["cron.schedule('0 9 * * 1',", "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"],
        ['startServerAfterRuntimeSchemaReady();', 'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };']
    ];
    for (const [original, replacement] of replacements) {
        assert.ok(isolatedServerSource.includes(original), `isolation hook exists: ${original}`);
        isolatedServerSource = isolatedServerSource.replace(original, replacement);
    }
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedServerSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'legal-acceptance.js', 'growth-journey.js', 'notification-center.js', 'notification-delivery.js', 'growth-notifications.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated Growth event test</title>');

    await fsp.copyFile(
        path.join(
            repositoryRoot,
            'lib',
            'birthday-age-sync.js'
        ),
        path.join(
            temporaryRoot,
            'lib',
            'birthday-age-sync.js'
        )
    );

    const isolatedApplication = require(path.join(temporaryRoot, 'server.js'));
    database = isolatedApplication.db;
    assert.equal(database.filename, path.join(temporaryRoot, 'fog_community.db'));
    await isolatedApplication.ready;
    await execute(database, await fsp.readFile(
        path.join(repositoryRoot, 'migrations', '20260913_growth_journey_v1.sql'), 'utf8'
    ));

    const leader = await createIdentity(database, 'LEADER', ['access_events', 'edit_entries']);
    const member = await createIdentity(database, 'MEMBER', []);
    const leaderCookie = createSession(isolatedApplication.sessionStore, leader);
    const memberCookie = createSession(isolatedApplication.sessionStore, member);
    const event = await run(database,
        `INSERT INTO events (name, event_date, created_at)
         VALUES ('Alpha Youth Series Test Event', '2099-01-01', datetime('now'))`);
    const secondEvent = await run(database,
        `INSERT INTO events (name, event_date, created_at)
         VALUES ('One-off Fixture Event', '2099-01-02', datetime('now'))`);
    const firstTask = await get(database, "SELECT id FROM growth_tasks WHERE task_key = 'encounter-community-event'");
    const secondTask = await get(database, "SELECT id FROM growth_tasks WHERE task_key = 'belong-community-orientation'");
    const { app } = isolatedApplication;

    await t.test('anonymous, ordinary-member, and forged authority are rejected before mutation', async () => {
        const cases = [
            ['POST', '/api/admin/growth/event-series', { series_key: 'denied', name: 'Denied' }],
            ['PUT', '/api/admin/growth/event-series/1', { name: 'Denied' }],
            ['PATCH', '/api/admin/growth/event-series/1/active', { is_active: false }],
            ['PUT', `/api/admin/growth/events/${event.lastID}/series`, { series_id: null }],
            ['POST', '/api/admin/growth/event-mappings', { event_id: event.lastID, task_id: firstTask.id }],
            ['PUT', '/api/admin/growth/event-mappings/1', { is_active: false }],
            ['DELETE', '/api/admin/growth/event-mappings/1', {}]
        ];
        for (const [method, pathname, body] of cases) {
            assert.equal((await request(app, pathname, { method, body })).status, 401, `${method} ${pathname}`);
            assert.equal((await request(app, pathname, { method, body, cookie: memberCookie })).status, 403, `${method} ${pathname}`);
        }
        const forged = await request(app, '/api/admin/growth/event-series?permissions=access_events,edit_entries', {
            method: 'POST', cookie: memberCookie,
            headers: { 'X-User-Permissions': 'access_events,edit_entries', 'X-Admin': 'true' },
            body: {
                series_key: 'forged', name: 'Forged', actor: leader.username,
                user_id: leader.userId, youth_id: leader.youthId,
                permissions: ['access_events', 'edit_entries'], is_admin: true
            }
        });
        assert.equal(forged.status, 403);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM growth_event_series')).count, 0);
        assert.equal((await request(app, '/api/admin/growth/event-series')).status, 401);
        assert.equal((await request(app, '/api/admin/growth/tasks', { cookie: memberCookie })).status, 403);
    });

    let firstSeriesId;
    let secondSeriesId;
    await t.test('authorized leadership can create, update, deactivate, and activate series', async () => {
        const first = await request(app, '/api/admin/growth/event-series', {
            method: 'POST', cookie: leaderCookie,
            body: { series_key: 'alpha-fixture', name: 'Alpha Fixture', audience: 'youth', actor: 'FORGED-ACTOR' }
        });
        assert.equal(first.status, 201);
        firstSeriesId = first.json.id;
        const second = await request(app, '/api/admin/growth/event-series', {
            method: 'POST', cookie: leaderCookie,
            body: { series_key: 'formation-fixture', name: 'Formation Fixture' }
        });
        assert.equal(second.status, 201);
        secondSeriesId = second.json.id;
        assert.equal((await request(app, `/api/admin/growth/event-series/${firstSeriesId}`, {
            method: 'PUT', cookie: leaderCookie,
            body: { name: 'Alpha Fixture Updated', description: 'Isolated fixture series.' }
        })).status, 200);
        assert.equal((await request(app, `/api/admin/growth/event-series/${firstSeriesId}/active`, {
            method: 'PATCH', cookie: leaderCookie, body: { is_active: false }
        })).json.is_active, 0);
        assert.equal((await request(app, `/api/admin/growth/event-series/${firstSeriesId}/active`, {
            method: 'PATCH', cookie: leaderCookie, body: { is_active: true }
        })).json.is_active, 1);
        const audit = await get(database,
            "SELECT username FROM activity_logs WHERE action = 'CREATE_GROWTH_EVENT_SERIES' ORDER BY id ASC LIMIT 1");
        assert.equal(audit.username, leader.username);
        assert.notEqual(audit.username, 'FORGED-ACTOR');
    });

    await t.test('event assignment can be set, changed, and removed with missing references rejected', async () => {
        assert.equal((await request(app, '/api/admin/growth/events/999999/series', {
            method: 'PUT', cookie: leaderCookie, body: { series_id: firstSeriesId }
        })).status, 404);
        assert.equal((await request(app, `/api/admin/growth/events/${event.lastID}/series`, {
            method: 'PUT', cookie: leaderCookie, body: { series_id: 999999 }
        })).status, 404);
        assert.equal((await request(app, `/api/admin/growth/events/${event.lastID}/series`, {
            method: 'PUT', cookie: leaderCookie, body: { series_id: firstSeriesId }
        })).status, 200);
        assert.equal((await request(app, `/api/admin/growth/events/${event.lastID}/series`, {
            method: 'PUT', cookie: leaderCookie, body: { series_id: secondSeriesId }
        })).json.series_id, secondSeriesId);
        assert.deepEqual((await all(database,
            'SELECT series_id FROM growth_event_series_events WHERE event_id = ?', [event.lastID])).map(row => row.series_id), [secondSeriesId]);
        assert.equal((await request(app, `/api/admin/growth/events/${event.lastID}/series`, {
            method: 'PUT', cookie: leaderCookie, body: { series_id: null }
        })).json.series_id, null);
        assert.equal((await get(database,
            'SELECT COUNT(*) count FROM growth_event_series_events WHERE event_id = ?', [event.lastID])).count, 0);
        await request(app, `/api/admin/growth/events/${event.lastID}/series`, {
            method: 'PUT', cookie: leaderCookie, body: { series_id: firstSeriesId }
        });
    });

    await t.test('explicit series and direct mappings resolve, deduplicate, update, and remove', async () => {
        const before = await request(app, `/api/admin/growth/events/${event.lastID}/mappings`, { cookie: leaderCookie });
        assert.equal(before.status, 200);
        assert.deepEqual(before.json.effective_mappings, []);

        const seriesMapping = await request(app, '/api/admin/growth/event-mappings', {
            method: 'POST', cookie: leaderCookie,
            body: { series_id: firstSeriesId, task_id: firstTask.id, evidence_mode: 'attendance' }
        });
        assert.equal(seriesMapping.status, 201);
        let effective = (await request(app, `/api/admin/growth/events/${event.lastID}/mappings`, { cookie: leaderCookie })).json.effective_mappings;
        assert.deepEqual(effective.map(item => item.task_id), [firstTask.id]);
        assert.equal(effective[0].source_type, 'series');

        const directDuplicate = await request(app, '/api/admin/growth/event-mappings', {
            method: 'POST', cookie: leaderCookie,
            body: { event_id: event.lastID, task_id: firstTask.id, evidence_mode: 'completion', credit_value: 2 }
        });
        const directAdditional = await request(app, '/api/admin/growth/event-mappings', {
            method: 'POST', cookie: leaderCookie,
            body: { event_id: event.lastID, task_id: secondTask.id, evidence_mode: 'attendance' }
        });
        assert.equal(directDuplicate.status, 201);
        assert.equal(directAdditional.status, 201);
        effective = (await request(app, `/api/admin/growth/events/${event.lastID}/mappings`, { cookie: leaderCookie })).json.effective_mappings;
        assert.equal(effective.length, 2);
        assert.equal(effective.find(item => item.task_id === firstTask.id).source_type, 'event');
        assert.equal(effective.find(item => item.task_id === firstTask.id).credit_value, 2);

        assert.equal((await request(app, '/api/admin/growth/event-mappings', {
            method: 'POST', cookie: leaderCookie,
            body: { event_id: event.lastID, task_id: 999999 }
        })).status, 404);
        assert.equal((await request(app, `/api/admin/growth/event-mappings/${directAdditional.json.id}`, {
            method: 'PUT', cookie: leaderCookie, body: { evidence_mode: 'registration' }
        })).status, 200);
        assert.equal((await request(app, `/api/admin/growth/event-mappings/${directAdditional.json.id}`, {
            method: 'DELETE', cookie: leaderCookie
        })).status, 200);
        assert.equal(await get(database, 'SELECT id FROM growth_event_task_map WHERE id = ?', [directAdditional.json.id]), undefined);

        const oneOff = await request(app, '/api/admin/growth/event-mappings', {
            method: 'POST', cookie: leaderCookie,
            body: { event_id: secondEvent.lastID, task_id: secondTask.id, evidence_mode: 'attendance' }
        });
        assert.equal(oneOff.status, 201);
        const oneOffEffective = (await request(app,
            `/api/admin/growth/events/${secondEvent.lastID}/mappings`, { cookie: leaderCookie })).json.effective_mappings;
        assert.deepEqual(oneOffEffective.map(item => item.task_id), [secondTask.id]);
    });

    assert.equal((await get(database, 'PRAGMA integrity_check')).integrity_check, 'ok');
});
