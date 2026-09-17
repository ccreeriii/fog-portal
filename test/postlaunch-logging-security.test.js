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
        // Transition server dependencies required by isolated server.js fixture.
        {
            const transitionDependencyFs =
                require('node:fs').promises;

            const transitionDependencyPath =
                require('node:path');

            await transitionDependencyFs.mkdir(
                transitionDependencyPath.join(
                    temporaryRoot,
                    'lib'
                ),
                {
                    recursive: true
                }
            );

            for (const filename of [
                'member-transition-http.js',
                'member-transition-community-intent.js',
                'ministry-service-journey.js',
                'ministry-discernment-journey.js'
            ]) {
                await transitionDependencyFs.copyFile(
                    transitionDependencyPath.join(
                        repositoryRoot,
                        'lib',
                        filename
                    ),
                    transitionDependencyPath.join(
                        temporaryRoot,
                        'lib',
                        filename
                    )
                );
            }
        }
    for (const filename of [
        'sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'legal-acceptance.js',
        'growth-journey.js', 'notification-center.js', 'notification-delivery.js', 'growth-notifications.js'
    ]) await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Postlaunch fixture</title>');

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

    await t.test('Audit display names resolve authoritative member codes, account names, and Member ID forms', async () => {
        await run(database, 'UPDATE youth SET qr_code = ? WHERE id = ?', ['FOG-MEMBER-102', member.youthId]);
        await run(database, 'UPDATE youth SET qr_code = ? WHERE id = ?', ['FOG-PASS-214', other.youthId]);
        const actors = [
            ['FOG-MEMBER-102', member.name],
            ['FOG-PASS-214', other.name],
            [`Member ${member.youthId}`, member.name],
            [other.username, other.name],
            ['FOG-MEMBER-999', 'Member']
        ];
        for (const [identifier] of actors) {
            await run(database,
                `INSERT INTO activity_logs (username, action, details, created_at)
                 VALUES (?, 'ACTOR_RESOLUTION', 'Fixture', '2026-09-15 10:03:00')`,
                [identifier]);
        }
        const response = await request(application.app, '/api/activity-logs', { cookie: leaderCookie });
        assert.equal(response.status, 200);
        const rows = response.json.filter(row => row.action === 'ACTOR_RESOLUTION');
        assert.equal(rows.length, actors.length);
        for (const [identifier, fullName] of actors) {
            const row = rows.find(item => item.actor_identifier === identifier);
            assert.equal(row.actor_display_name, fullName);
            assert.equal(row.username, fullName);
        }
        assert.equal(response.json.find(row => row.action === 'FIXTURE').actor_identifier, '[email identifier]');
    });

    await t.test('Prayer Wall hides anonymous authors and binds writes to the authenticated member', async () => {
        const prayer = await run(database,
            `INSERT INTO prayer_requests (youth_id, title, request, is_anonymous, created_at)
             VALUES (?, 'Private author', 'Please pray', 1, '2026-09-15 10:03:00')`,
            [other.youthId]);
        const publicWall = await request(application.app, '/api/prayers');
        const publicPrayer = publicWall.json.find(row => row.id === prayer.lastID);
        assert.equal(publicWall.status, 200);
        assert.equal(publicPrayer.author_name, 'Anonymous');
        assert.equal(publicPrayer.youth_id, null);
        assert.equal(publicPrayer.is_owner, 0);
        assert.equal(JSON.stringify(publicPrayer).includes(other.name), false);
        const ownerWall = await request(application.app, '/api/prayers', { cookie: session(application.sessionStore, other) });
        assert.equal(ownerWall.json.find(row => row.id === prayer.lastID).youth_id, other.youthId);
        assert.equal(ownerWall.json.find(row => row.id === prayer.lastID).is_owner, 1);

        const forgedBody = { youth_id: other.youthId, title: 'Bound prayer', request: 'Pray with me', is_anonymous: true };
        assert.equal((await request(application.app, '/api/prayers', { method: 'POST', body: forgedBody })).status, 401);
        assert.equal((await request(application.app, '/api/prayers', { method: 'POST', cookie: memberCookie, body: forgedBody })).status, 200);
        const created = await get(database, `SELECT id, youth_id FROM prayer_requests WHERE title = 'Bound prayer'`);
        assert.equal(created.youth_id, member.youthId);
        assert.equal((await request(application.app, `/api/prayers/${prayer.lastID}`, {
            method: 'PUT', cookie: memberCookie,
            body: { title: 'Forged edit', request: 'No', is_anonymous: false }
        })).status, 403);
        assert.equal((await get(database, 'SELECT title FROM prayer_requests WHERE id = ?', [prayer.lastID])).title, 'Private author');
        assert.equal((await request(application.app, `/api/prayers/${created.id}/intercede`, {
            method: 'POST', body: { youth_id: other.youthId }
        })).status, 401);
        assert.equal((await request(application.app, `/api/prayers/${created.id}/intercede`, {
            method: 'POST', cookie: memberCookie, body: { youth_id: other.youthId }
        })).status, 200);
        assert.equal((await get(database, 'SELECT youth_id FROM prayer_intercessions WHERE prayer_id = ?', [created.id])).youth_id, member.youthId);
    });

    await t.test('Private Journal denies unauthenticated and cross-member access while retaining owner CRUD', async () => {
        const otherCookie = session(application.sessionStore, other);
        const own = await run(database,
            `INSERT INTO private_journals (youth_id, title, content, mood, created_at)
             VALUES (?, 'Own entry', 'Own private body', 'Reflective', '2026-09-15 10:06:00')`, [member.youthId]);
        const privateEntry = await run(database,
            `INSERT INTO private_journals (youth_id, title, content, mood, created_at)
             VALUES (?, 'Other entry', 'Other private body', 'Seeking', '2026-09-15 10:07:00')`, [other.youthId]);
        assert.equal((await request(application.app, `/api/journals/${member.youthId}`)).status, 401);
        assert.equal((await request(application.app, '/api/journals', {
            method: 'POST', body: { youth_id: member.youthId, title: 'Anonymous', content: 'No' }
        })).status, 401);
        assert.equal((await request(application.app, `/api/journals/${own.lastID}`, {
            method: 'PUT', body: { title: 'No', content: 'No' }
        })).status, 401);
        assert.equal((await request(application.app, `/api/journals/${own.lastID}`, { method: 'DELETE' })).status, 401);

        const ownList = await request(application.app, `/api/journals/${member.youthId}`, { cookie: memberCookie });
        assert.equal(ownList.status, 200);
        assert.equal(ownList.json.some(row => row.id === own.lastID && row.content === 'Own private body'), true);
        assert.equal(ownList.json.some(row => row.id === privateEntry.lastID || row.content === 'Other private body'), false);
        assert.equal((await request(application.app, `/api/journals/${other.youthId}`, { cookie: memberCookie })).status, 403);
        assert.equal((await request(application.app, `/api/journals/${privateEntry.lastID}`, { cookie: memberCookie })).status, 403);
        assert.equal((await request(application.app, `/api/journals/${other.youthId}`, { cookie: leaderCookie })).status, 403);
        assert.equal((await request(application.app, `/api/journals/${other.youthId}`, { cookie: otherCookie })).status, 200);

        const forged = await request(application.app, '/api/journals', { method: 'POST', cookie: memberCookie,
            body: { youth_id: other.youthId, member_id: other.youthId, title: 'Forged target',
                content: 'Journal secret fixture', mood: 'Blessed' } });
        assert.equal(forged.status, 200);
        const created = await get(database, `SELECT id, youth_id FROM private_journals WHERE title = 'Forged target'`);
        assert.equal(created.youth_id, member.youthId);
        assert.equal((await request(application.app, `/api/journals/${privateEntry.lastID}`, {
            method: 'PUT', cookie: memberCookie,
            body: { title: 'Cross-member edit', content: 'No', mood: 'Joyful' }
        })).status, 404);
        assert.equal((await request(application.app, `/api/journals/${privateEntry.lastID}`, {
            method: 'DELETE', cookie: memberCookie
        })).status, 404);
        assert.equal((await get(database, 'SELECT content FROM private_journals WHERE id = ?', [privateEntry.lastID])).content,
            'Other private body');
        assert.equal((await request(application.app, `/api/journals/${created.id}`, {
            method: 'PUT', cookie: memberCookie,
            body: { title: 'Owner edit', content: 'Updated private body', mood: 'Joyful' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT content FROM private_journals WHERE id = ?', [created.id])).content,
            'Updated private body');
        assert.equal((await request(application.app, `/api/journals/${created.id}`, {
            method: 'DELETE', cookie: memberCookie
        })).status, 200);
        assert.equal(await get(database, 'SELECT id FROM private_journals WHERE id = ?', [created.id]), undefined);
        const audit = await new Promise((resolve, reject) => database.all('SELECT details FROM activity_logs', [],
            (err, rows) => err ? reject(err) : resolve(rows)));
        assert.equal(audit.some(row => /Journal secret fixture|Updated private body|Other private body/.test(row.details)), false);
    });

    await t.test('Groups bind status and join to canonical self and preserve leader/admin targets and privacy', async () => {
        const otherCookie = session(application.sessionStore, other);
        const groupAdmin = await createIdentity(database, 'GROUPADMIN',
            ['access_discipleship', 'add_entries', 'edit_entries', 'delete_entries']);
        const adminCookie = session(application.sessionStore, groupAdmin);
        const outsider = await createIdentity(database, 'GROUPOUTSIDER');
        const outsiderCookie = session(application.sessionStore, outsider);
        const open = await run(database,
            `INSERT INTO small_groups (name, leader_id, privacy_level, points, created_at)
             VALUES ('Open fixture', ?, 'Open', 0, '2026-09-15 10:08:00')`, [leader.youthId]);
        const approval = await run(database,
            `INSERT INTO small_groups (name, leader_id, privacy_level, points, created_at)
             VALUES ('Approval fixture', ?, 'Approval', 0, '2026-09-15 10:08:00')`, [leader.youthId]);
        const inviteOnly = await run(database,
            `INSERT INTO small_groups (name, leader_id, privacy_level, points, created_at)
             VALUES ('Invite-only fixture', ?, 'Invite-Only', 0, '2026-09-15 10:08:00')`, [leader.youthId]);
        await run(database,
            `INSERT INTO small_group_members (group_id, youth_id, status, joined_at)
             VALUES (?, ?, 'Approved', '2026-09-15 10:08:00')`, [inviteOnly.lastID, member.youthId]);
        await run(database,
            `INSERT INTO small_group_members (group_id, youth_id, status, joined_at)
             VALUES (?, ?, 'Pending', '2026-09-15 10:08:00')`, [approval.lastID, other.youthId]);
        const publicGroups = await request(application.app, '/api/small-groups?youth_id=' + other.youthId);
        assert.equal(publicGroups.status, 200);
        assert.equal(publicGroups.json.some(group => group.id === inviteOnly.lastID), false);
        assert.equal(publicGroups.json.find(group => group.id === approval.lastID).user_status, null);
        const myGroups = await request(application.app, '/api/small-groups?youth_id=' + other.youthId,
            { cookie: memberCookie });
        assert.equal(myGroups.status, 200);
        assert.equal(myGroups.json.find(group => group.id === inviteOnly.lastID).user_status, 'Approved');
        assert.equal(myGroups.json.find(group => group.id === approval.lastID).user_status, null);
        const otherGroups = await request(application.app, '/api/small-groups?youth_id=' + member.youthId,
            { cookie: otherCookie });
        assert.equal(otherGroups.json.find(group => group.id === approval.lastID).user_status, 'Pending');
        assert.equal(otherGroups.json.some(group => group.id === inviteOnly.lastID), false);
        assert.equal((await request(application.app, `/api/small-groups/${open.lastID}/join`, {
            method: 'POST', body: { youth_id: other.youthId }
        })).status, 401);
        assert.equal((await request(application.app, `/api/small-groups/${open.lastID}/join`, {
            method: 'POST', cookie: memberCookie, body: { youth_id: other.youthId }
        })).status, 200);
        assert.equal((await get(database, 'SELECT youth_id FROM small_group_members WHERE group_id = ?', [open.lastID])).youth_id,
            member.youthId);
        assert.equal((await request(application.app, `/api/small-groups/${approval.lastID}/join`, {
            method: 'POST', cookie: memberCookie, body: { youth_id: other.youthId }
        })).json.status, 'Pending');
        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/join`, {
            method: 'POST', cookie: otherCookie, body: { youth_id: member.youthId }
        })).status, 403);

        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/invite`, {
            method: 'POST', cookie: memberCookie, body: { youth_id: other.youthId }
        })).status, 403);
        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/invite`, {
            method: 'POST', cookie: leaderCookie, body: { youth_id: other.youthId }
        })).status, 200);
        assert.equal((await get(database, 'SELECT youth_id FROM small_group_members WHERE group_id = ? AND youth_id = ?',
            [inviteOnly.lastID, other.youthId])).youth_id, other.youthId);
        assert.equal((await request(application.app,
            `/api/small-groups/${approval.lastID}/members/${other.youthId}/status`, {
                method: 'POST', cookie: memberCookie, body: { status: 'Approved' }
            })).status, 403);
        assert.equal((await request(application.app,
            `/api/small-groups/${approval.lastID}/members/${other.youthId}/status`, {
                method: 'POST', cookie: leaderCookie, body: { status: 'Approved' }
            })).status, 200);
        assert.equal((await get(database, 'SELECT status FROM small_group_members WHERE group_id = ? AND youth_id = ?',
            [approval.lastID, other.youthId])).status, 'Approved');
        assert.equal((await request(application.app, '/api/small-groups', {
            method: 'POST', cookie: memberCookie, body: { name: 'Unauthorized fixture' }
        })).status, 403);
        assert.equal((await request(application.app, '/api/small-groups', {
            method: 'POST', cookie: adminCookie,
            body: { name: 'Admin fixture', privacy_level: 'Invite-Only', leader_id: leader.youthId }
        })).status, 200);
        assert.equal((await get(database, `SELECT privacy_level FROM small_groups WHERE name = 'Admin fixture'`)).privacy_level,
            'Invite-Only');
        assert.equal((await request(application.app, '/api/small-groups', { cookie: adminCookie })).json.some(group =>
            group.name === 'Admin fixture'), true);
        assert.equal((await request(application.app, `/api/small-groups/${open.lastID}`, {
            method: 'PUT', cookie: memberCookie, body: { name: 'Unauthorized rename' }
        })).status, 403);
        assert.equal((await request(application.app, `/api/small-groups/${open.lastID}`, {
            method: 'PUT', cookie: leaderCookie,
            body: { name: 'Leader rename', privacy_level: 'Approval', points: 0 }
        })).status, 200);
        assert.equal((await get(database, 'SELECT name FROM small_groups WHERE id = ?', [open.lastID])).name,
            'Leader rename');
        assert.equal((await request(application.app, `/api/small-groups/${open.lastID}/privacy`, {
            method: 'PATCH', cookie: memberCookie, body: { privacy_level: 'Invite-Only' }
        })).status, 403);
        assert.equal((await request(application.app, `/api/small-groups/${open.lastID}/privacy`, {
            method: 'PATCH', cookie: adminCookie, body: { privacy_level: 'Invite-Only' }
        })).status, 200);
        assert.equal((await get(database, 'SELECT privacy_level FROM small_groups WHERE id = ?', [open.lastID])).privacy_level,
            'Invite-Only');

        const groupPrayer = await run(database,
            `INSERT INTO prayer_requests (group_id, youth_id, title, request, is_anonymous, created_at)
             VALUES (?, ?, 'Group anonymous', 'Group prayer body', 1, '2026-09-15 10:09:00')`,
            [inviteOnly.lastID, member.youthId]);
        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/prayers`)).status, 401);
        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/prayers`,
            { cookie: outsiderCookie })).status, 403);
        const privatePrayers = await request(application.app, `/api/small-groups/${inviteOnly.lastID}/prayers`,
            { cookie: memberCookie });
        assert.equal(privatePrayers.status, 200);
        const protectedPrayer = privatePrayers.json.find(prayer => prayer.id === groupPrayer.lastID);
        assert.equal(protectedPrayer.author_name, 'Anonymous');
        assert.equal(Object.hasOwn(protectedPrayer, 'youth_id'), false);
        assert.equal((await request(application.app, '/api/prayers')).json.some(prayer =>
            prayer.id === groupPrayer.lastID), false);
        assert.equal((await request(application.app, `/api/small-groups/${open.lastID}/prayers`,
            { cookie: otherCookie })).status, 403);
        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/threads`,
            { cookie: outsiderCookie })).status, 403);
        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/prayers`, {
            method: 'POST', cookie: memberCookie,
            body: { youth_id: outsider.youthId, title: 'Bound group prayer', request: 'Safe', is_anonymous: true }
        })).status, 200);
        assert.equal((await get(database, `SELECT youth_id FROM prayer_requests WHERE title = 'Bound group prayer'`)).youth_id,
            member.youthId);
        assert.equal((await request(application.app, `/api/small-groups/prayers/${groupPrayer.lastID}/intercede`, {
            method: 'POST', cookie: outsiderCookie, body: { youth_id: member.youthId }
        })).status, 403);
        assert.equal((await request(application.app, `/api/small-groups/prayers/${groupPrayer.lastID}/intercede`, {
            method: 'POST', cookie: otherCookie, body: { youth_id: outsider.youthId }
        })).status, 200);
        assert.equal((await get(database, 'SELECT youth_id FROM prayer_intercessions WHERE prayer_id = ?',
            [groupPrayer.lastID])).youth_id, other.youthId);
        assert.equal((await request(application.app, `/api/small-groups/prayers/${groupPrayer.lastID}/answered`, {
            method: 'PUT', cookie: memberCookie, body: { group_id: open.lastID, title: 'Forged' }
        })).status, 403);
        assert.equal((await request(application.app, `/api/small-groups/prayers/${groupPrayer.lastID}/answered`, {
            method: 'PUT', cookie: leaderCookie, body: { group_id: open.lastID, title: 'Forged' }
        })).status, 200);
        assert.equal((await request(application.app, `/api/small-groups/${inviteOnly.lastID}/chat`, {
            method: 'POST', cookie: memberCookie, body: { youth_id: other.youthId, message: 'Bound chat fixture' }
        })).status, 200);
        assert.equal((await get(database, `SELECT youth_id FROM small_group_chats WHERE message = 'Bound chat fixture'`)).youth_id,
            member.youthId);
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
