'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const fixturePassword = 'p9-s1-disposable-password';

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
        database.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close((err) => err ? reject(err) : resolve());
    });
}

function request(app, pathname, { method = 'GET', query = {}, cookie, body = {}, headers = {} } = {}) {
    const parsedPath = new URL(pathname, 'http://isolated.test');
    const router = app.router || app._router;
    let routeMatch;
    const routeLayer = router.stack.find(layer => {
        if (!layer.route || !layer.route.methods[method.toLowerCase()]) return false;
        routeMatch = layer.matchers[0](parsedPath.pathname);
        return Boolean(routeMatch);
    });
    assert.ok(routeLayer, `${method} ${parsedPath.pathname} is registered`);
    const route = routeLayer.route;
    return new Promise((resolve, reject) => {
        let completed = false;
        let handlerIndex = 0;
        const responseHeaders = Object.create(null);
        const req = {
            body,
            params: { ...routeMatch.params },
            query: { ...Object.fromEntries(parsedPath.searchParams), ...query },
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
        const next = (err) => {
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

function createSession(sessionStore, identity) {
    const sessionId = `p9-s1-${identity.userId}`;
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000
    });
    return `koinonia_session=${sessionId}`;
}

async function createIdentity(database, suffix, permissions) {
    const username = `P9-S1-${suffix}`;
    const youth = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [`P9 S1 ${suffix}`, `${suffix.toLowerCase()}@invalid.test`, username, fixturePassword]
    );
    const user = await run(
        database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [username, fixturePassword, JSON.stringify(permissions), youth.lastID]
    );
    return { username, youthId: youth.lastID, userId: user.lastID };
}

test('event-management mutations enforce canonical permissions and ownership', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-event-auth-test-'));
    let database;

    t.after(async () => {
        if (database) await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    const serverSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const isolatedServerSource = serverSource
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
    assert.notEqual(isolatedServerSource, serverSource);
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedServerSource);
    await fsp.copyFile(
        path.join(repositoryRoot, 'lib', 'sqlite-backup.js'),
        path.join(temporaryRoot, 'lib', 'sqlite-backup.js')
    );
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated test</title>');

    const isolatedDatabasePath = path.join(temporaryRoot, 'fog_community.db');
    assert.notEqual(isolatedDatabasePath, path.join(repositoryRoot, 'fog_community.db'));
    const isolatedApplication = require(path.join(temporaryRoot, 'server.js'));
    await isolatedApplication.ready;
    database = isolatedApplication.db;
    assert.equal(path.dirname(isolatedDatabasePath), temporaryRoot);
    await run(database, 'ALTER TABLE events ADD COLUMN gallery TEXT');
    await run(database, 'ALTER TABLE events ADD COLUMN additional_info TEXT');

    const unauthorized = await createIdentity(database, 'UNAUTHORIZED', []);
    const addStaff = await createIdentity(database, 'ADD', ['access_events', 'add_entries']);
    const editStaff = await createIdentity(database, 'EDIT', ['access_events', 'edit_entries']);
    const deleteStaff = await createIdentity(database, 'DELETE', ['access_events', 'delete_entries']);
    const owner = await createIdentity(database, 'OWNER', []);

    const unauthorizedCookie = createSession(isolatedApplication.sessionStore, unauthorized);
    const addCookie = createSession(isolatedApplication.sessionStore, addStaff);
    const editCookie = createSession(isolatedApplication.sessionStore, editStaff);
    const deleteCookie = createSession(isolatedApplication.sessionStore, deleteStaff);
    const ownerCookie = createSession(isolatedApplication.sessionStore, owner);
    const app = isolatedApplication.app;

    const event = await run(
        database,
        `INSERT INTO events (name, event_date, time_start, venue, event_points, created_at)
         VALUES ('P9 S1 Fixture Event', '2099-01-01', '09:00', 'Isolated', 10, datetime('now'))`
    );
    const ownerRole = await run(
        database,
        `INSERT INTO event_roles (event_id, youth_id, role_name, sub_role, assigned_at, status)
         VALUES (?, ?, 'P9 Owner Role', '', datetime('now'), 'Pending')`,
        [event.lastID, owner.youthId]
    );

    const createBody = {
        name: 'Denied Event', event_date: '2099-02-02', time_start: '10:00',
        venue: 'Isolated', event_points: 10
    };
    const updateBody = {
        name: 'Denied Update', event_date: '2099-01-01', time_start: '09:00',
        venue: 'Isolated', photos_url: '', materials_url: '', event_points: 10
    };
    const preregBody = { banner: null, bottom_banner: null, title: 'Denied', info: 'Denied' };
    const assignBody = { youth_id: unauthorized.youthId, role_name: 'Denied', sub_role: '' };
    const roleBody = { role_name: 'Denied', sub_role: '' };
    const statusBody = { status: 'Accepted' };

    const mutationCases = [
        ['POST', '/api/events', createBody],
        ['PUT', `/api/events/${event.lastID}`, updateBody],
        ['POST', `/api/events/${event.lastID}/prereg-settings`, preregBody],
        ['POST', `/api/events/${event.lastID}/roles`, assignBody],
        ['POST', `/api/events/${event.lastID}/roles-notes`, { roles_restricted_notes: 'Denied' }],
        ['PUT', `/api/events/${event.lastID}/roles/${ownerRole.lastID}`, roleBody],
        ['PUT', `/api/events/${event.lastID}/roles/${ownerRole.lastID}/status`, statusBody]
    ];

    await t.test('anonymous and authenticated unauthorized requests are denied before mutation', async () => {
        const beforeEvents = (await get(database, 'SELECT COUNT(*) count FROM events')).count;
        const beforeRoles = (await get(database, 'SELECT COUNT(*) count FROM event_roles')).count;
        for (const [method, pathname, body] of mutationCases) {
            assert.equal((await request(app, pathname, { method, body })).status, 401, `${method} ${pathname}`);
            assert.equal(
                (await request(app, pathname, { method, body, cookie: unauthorizedCookie })).status,
                403,
                `${method} ${pathname}`
            );
        }
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM events')).count, beforeEvents);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM event_roles')).count, beforeRoles);
        assert.equal((await get(database, 'SELECT name FROM events WHERE id = ?', [event.lastID])).name, 'P9 S1 Fixture Event');
        assert.equal((await get(database, 'SELECT status FROM event_roles WHERE id = ?', [ownerRole.lastID])).status, 'Pending');
    });

    await t.test('forged request authority cannot replace canonical stored permissions', async () => {
        const beforeEvents = (await get(database, 'SELECT COUNT(*) count FROM events')).count;
        const forged = await request(
            app,
            '/api/events?permissions=access_events,add_entries&is_admin=true',
            {
                method: 'POST',
                cookie: unauthorizedCookie,
                headers: {
                    'X-User-Permissions': 'access_events,add_entries',
                    'X-Admin': 'true'
                },
                body: {
                    ...createBody,
                    actor: 'admin',
                    username: addStaff.username,
                    permissions: ['access_events', 'add_entries'],
                    is_admin: true,
                    user_id: addStaff.youthId,
                    youth_id: addStaff.youthId
                }
            }
        );
        assert.equal(forged.status, 403);
        assert.equal((await get(database, 'SELECT COUNT(*) count FROM events')).count, beforeEvents);
    });

    await t.test('canonical action permissions preserve authorized event-management flows', async () => {
        const created = await request(app, '/api/events', {
            method: 'POST', cookie: addCookie, body: { ...createBody, name: 'Authorized Event' }
        });
        assert.equal(created.status, 200);
        assert.ok(Number.isInteger(created.json.id));

        assert.equal((await request(app, `/api/events/${created.json.id}`, {
            method: 'PUT', cookie: editCookie, body: { ...updateBody, name: 'Authorized Update' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT name FROM events WHERE id = ?', [created.json.id])).name, 'Authorized Update');

        assert.equal((await request(app, `/api/events/${created.json.id}/prereg-settings`, {
            method: 'POST', cookie: editCookie,
            body: { banner: null, bottom_banner: null, title: 'Authorized Form', info: 'Authorized Info' }
        })).status, 200);

        assert.equal((await request(app, `/api/events/${created.json.id}/roles`, {
            method: 'POST', cookie: addCookie,
            body: { youth_id: unauthorized.youthId, role_name: 'Authorized Role', sub_role: 'Fixture' }
        })).status, 200);
        const assignedRole = await get(
            database,
            'SELECT id FROM event_roles WHERE event_id = ? AND youth_id = ? AND role_name = ?',
            [created.json.id, unauthorized.youthId, 'Authorized Role']
        );
        assert.ok(assignedRole);

        assert.equal((await request(app, `/api/events/${event.lastID}/roles-notes`, {
            method: 'POST', cookie: editCookie, body: { roles_restricted_notes: 'Authorized Notes' }
        })).status, 200);
        assert.equal((await request(app, `/api/events/${created.json.id}/roles/${assignedRole.id}`, {
            method: 'PUT', cookie: editCookie, body: { role_name: 'Updated Role', sub_role: 'Fixture' }
        })).status, 200);

        assert.equal((await request(app, `/api/events/${event.lastID}/roles/${ownerRole.lastID}/status`, {
            method: 'PUT', cookie: ownerCookie, body: { status: 'Accepted' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT status FROM event_roles WHERE id = ?', [ownerRole.lastID])).status, 'Accepted');
        assert.equal((await request(app, `/api/events/${event.lastID}/roles/${ownerRole.lastID}/status`, {
            method: 'PUT', cookie: editCookie, body: { status: 'Pending' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT status FROM event_roles WHERE id = ?', [ownerRole.lastID])).status, 'Pending');

        assert.equal((await request(app, `/api/events/${created.json.id}`, {
            method: 'DELETE', body: {}
        })).status, 401);
        assert.equal((await request(app, `/api/events/${created.json.id}`, {
            method: 'DELETE', cookie: unauthorizedCookie, body: {}
        })).status, 403);
        assert.equal((await request(app, `/api/events/${created.json.id}`, {
            method: 'DELETE', cookie: deleteCookie, body: {}
        })).status, 200);
        assert.equal(await get(database, 'SELECT id FROM events WHERE id = ?', [created.json.id]), undefined);
    });

    await t.test('existing event-role delete ownership and staff override behavior remains intact', async () => {
        const ownedRole = await run(
            database,
            `INSERT INTO event_roles (event_id, youth_id, role_name, sub_role, assigned_at, status)
             VALUES (?, ?, 'Owner Delete', '', datetime('now'), 'Pending')`,
            [event.lastID, owner.youthId]
        );
        assert.equal((await request(app, `/api/events/${event.lastID}/roles/${ownedRole.lastID}`, {
            method: 'DELETE', body: {}
        })).status, 401);
        assert.equal((await request(app, `/api/events/${event.lastID}/roles/${ownedRole.lastID}`, {
            method: 'DELETE', cookie: unauthorizedCookie, body: {}
        })).status, 403);
        assert.equal((await request(app, `/api/events/${event.lastID}/roles/${ownedRole.lastID}`, {
            method: 'DELETE', cookie: ownerCookie, body: {}
        })).status, 200);
        assert.equal(await get(database, 'SELECT id FROM event_roles WHERE id = ?', [ownedRole.lastID]), undefined);

        const staffRole = await run(
            database,
            `INSERT INTO event_roles (event_id, youth_id, role_name, sub_role, assigned_at, status)
             VALUES (?, ?, 'Staff Delete', '', datetime('now'), 'Pending')`,
            [event.lastID, unauthorized.youthId]
        );
        assert.equal((await request(app, `/api/events/${event.lastID}/roles/${staffRole.lastID}`, {
            method: 'DELETE', cookie: deleteCookie, body: {}
        })).status, 200);
        assert.equal(await get(database, 'SELECT id FROM event_roles WHERE id = ?', [staffRole.lastID]), undefined);
    });

    await t.test('event read routes retain public and authenticated behavior', async () => {
        const publicEvents = await request(app, '/api/events');
        assert.equal(publicEvents.status, 200);
        assert.ok(Array.isArray(publicEvents.json));
        assert.ok(publicEvents.json.some((row) => row.id === event.lastID));

        assert.equal((await request(app, `/api/events/${event.lastID}/roles`)).status, 401);
        const ownerRoles = await request(app, `/api/events/${event.lastID}/roles`, { cookie: ownerCookie });
        assert.equal(ownerRoles.status, 200);
        assert.ok(Array.isArray(ownerRoles.json));

        const analytics = await request(app, `/api/events/${event.lastID}/analytics`, { cookie: editCookie });
        assert.equal(analytics.status, 200);
        assert.equal(analytics.json.event.id, event.lastID);
        assert.equal(analytics.json.event.roles_restricted_notes, 'Authorized Notes');
    });

    assert.equal((await get(database, 'PRAGMA integrity_check')).integrity_check, 'ok');
});
