'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const GrowthJourney = require('../lib/growth-journey');

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
        database.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
    });
}

function execute(database, sql) {
    return new Promise((resolve, reject) => {
        database.exec(sql, error => error ? reject(error) : resolve());
    });
}

function close(database) {
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
    assert.equal(matches.length, 1, `${method} ${parsedPath.pathname} has one effective route`);

    return new Promise((resolve, reject) => {
        const { route, params } = matches[0];
        let handlerIndex = 0;
        let completed = false;
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
        const next = error => {
            if (completed) return;
            if (error) {
                completed = true;
                reject(error);
                return;
            }
            const handler = route.stack[handlerIndex++]?.handle;
            if (!handler) return reject(new Error(`${method} ${parsedPath.pathname} did not respond`));
            try {
                Promise.resolve(handler(req, res, next)).catch(reject);
            } catch (handlerError) {
                reject(handlerError);
            }
        };
        next();
    });
}

async function createIdentity(database, suffix, permissions = []) {
    const username = `ADVANCE-${suffix}`;
    const member = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, account_tier, created_at)
         VALUES (?, ?, ?, 'test-password', 'New Member', datetime('now'))`,
        [`Advancement ${suffix}`, `${suffix.toLowerCase()}@invalid.test`, username]
    );
    const user = await run(
        database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, 'test-password', ?, ?, datetime('now'))`,
        [username, JSON.stringify(permissions), member.lastID]
    );
    return { username, youthId: member.lastID, userId: user.lastID };
}

function createSession(sessionStore, identity) {
    const sessionId = `advance-${identity.userId}`;
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        permissions: ['forged-session-permission'],
        createdAt: Date.now(),
        expiresAt: Date.now() + 600_000
    });
    return `koinonia_session=${sessionId}`;
}

async function makeEncounterReady(database, youthId, suffix) {
    const task = await GrowthJourney.getTaskByKey(database, 'encounter-community-event');
    await GrowthJourney.recordEvidence(database, {
        youthId,
        taskId: task.id,
        evidenceType: task.evidence_type,
        sourceTable: 'test_fixture',
        sourceId: youthId,
        sourceKey: `encounter-ready:${suffix}`,
        occurredAt: new Date().toISOString(),
        actor: 'TEST'
    });
    const progress = await GrowthJourney.recalculatePhaseByKey(database, youthId, 'encounter');
    assert.equal(progress.status, 'ready');
}

async function addFuturePrayerProgress(database, youthId) {
    for (let offset = 0; offset < 7; offset += 1) {
        await run(
            database,
            `INSERT INTO growth_prayer_rhythm_days (
                youth_id, prayer_date, source_table, source_key, occurred_at, recorded_by
             ) VALUES (?, date('now', ?), 'test_fixture', ?, datetime('now', ?), 'TEST')`,
            [youthId, `-${offset} day`, `future-prayer:${youthId}:${offset}`, `-${offset} day`]
        );
    }
}

test('leadership-controlled Growth Journey phase advancement', { concurrency: false }, async t => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-growth-advance-'));
    let database;
    t.after(async () => {
        if (database) await close(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    for (const directory of ['terms', 'privacy']) {
        await fsp.cp(
            path.join(repositoryRoot, 'public', directory),
            path.join(temporaryRoot, 'public', directory),
            { recursive: true }
        );
    }

    let isolatedServerSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    for (const [original, replacement] of [
        ['void runDatabaseBackup();', 'void Promise.resolve();'],
        ['setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);', 'setInterval(() => {}, 1000 * 60 * 60).unref();'],
        ["cron.schedule('0 9 * * 1',", "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"],
        ['startServerAfterRuntimeSchemaReady();', 'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };']
    ]) {
        assert.ok(isolatedServerSource.includes(original), `isolation hook exists: ${original}`);
        isolatedServerSource = isolatedServerSource.replace(original, replacement);
    }
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedServerSource);
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
        'sqlite-backup.js',
        'email-security.js',
        'account-claim-security.js',
        'legal-acceptance.js',
        'growth-journey.js',
        'notification-center.js',
        'notification-delivery.js',
        'growth-notifications.js'
    ]) {
        await fsp.copyFile(
            path.join(repositoryRoot, 'lib', filename),
            path.join(temporaryRoot, 'lib', filename)
        );
    }
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Test</title>');

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
    await isolatedApplication.ready;
    for (const migration of [
        '20260913_notification_center_v1.sql',
        '20260913_growth_journey_v1.sql',
        '20260913_growth_journey_ministry_hierarchy_fix.sql',
        '20260914_growth_encounter_readiness_v1.sql',
        '20260914_growth_prayer_rhythm_v1.sql'
    ]) {
        await execute(database, await fsp.readFile(path.join(repositoryRoot, 'migrations', migration), 'utf8'));
    }

    const { app, sessionStore } = isolatedApplication;
    const ordinary = await createIdentity(database, 'ORDINARY');
    const editor = await createIdentity(database, 'EDITOR', ['edit_entries']);
    const reviewer = await createIdentity(database, 'REVIEWER', ['access_discipleship']);
    const leader = await createIdentity(
        database,
        'LEADER',
        ['access_discipleship', 'edit_entries']
    );
    const target = await createIdentity(database, 'TARGET');
    const untouched = await createIdentity(database, 'UNTOUCHED');
    const notStarted = await createIdentity(database, 'NOT-STARTED');
    const inProgress = await createIdentity(database, 'IN-PROGRESS');
    const paused = await createIdentity(database, 'PAUSED');
    const concurrent = await createIdentity(database, 'CONCURRENT');
    const ordinaryCookie = createSession(sessionStore, ordinary);
    const editorCookie = createSession(sessionStore, editor);
    const reviewerCookie = createSession(sessionStore, reviewer);
    const leaderCookie = createSession(sessionStore, leader);

    const reviewPath = `/api/admin/growth-journey/members/${target.youthId}`;
    const completePath = `${reviewPath}/phases/encounter/complete`;

    await addFuturePrayerProgress(database, target.youthId);
    await makeEncounterReady(database, target.youthId, 'target');

    await t.test('routes are unique', () => {
        const stack = (app.router || app._router).stack;
        for (const [method, routePath] of [
            ['get', '/api/admin/growth-journey/members/:youthId'],
            ['post', '/api/admin/growth-journey/members/:youthId/phases/:phaseKey/complete']
        ]) {
            assert.equal(
                stack.filter(layer => layer.route?.path === routePath && layer.route.methods[method]).length,
                1
            );
        }
    });

    await t.test('anonymous and ordinary members cannot read or complete another Journey', async () => {
        for (const [method, pathname] of [['GET', reviewPath], ['POST', completePath]]) {
            assert.equal((await request(app, pathname, { method })).status, 401);
            assert.equal((await request(app, pathname, {
                method,
                cookie: ordinaryCookie,
                body: {
                    actor: leader.username,
                    permissions: ['edit_entries'],
                    is_admin: true,
                    youth_id: target.youthId
                },
                headers: { 'X-User-Permissions': 'edit_entries', 'X-Admin': 'true' }
            })).status, 403);
        }
        assert.equal((await request(
            app,
            `/api/admin/growth-journey/members/${ordinary.youthId}/phases/encounter/complete`,
            {
                method: 'POST',
                cookie: ordinaryCookie,
                body: { permissions: ['edit_entries'], is_admin: true }
            }
        )).status, 403);
        const progress = await get(
            database,
            `SELECT progress.* FROM growth_phase_progress progress
             JOIN growth_journey_phases phase ON phase.id = progress.phase_id
             WHERE progress.youth_id = ? AND phase.phase_key = 'encounter'`,
            [target.youthId]
        );
        assert.equal(progress.status, 'ready');
    });

    await t.test('review and advancement enforce the exact permission matrix', async () => {
        const forgedAuthority = {
            permissions: ['access_discipleship', 'edit_entries'],
            roles: ['Discipleship Admin'],
            is_admin: true
        };
        const forgedHeaders = {
            'X-User-Permissions': 'access_discipleship,edit_entries',
            'X-Admin': 'true'
        };

        assert.equal((await request(app, `${reviewPath}?permissions=access_discipleship`, {
            cookie: editorCookie,
            body: forgedAuthority,
            headers: forgedHeaders
        })).status, 403);
        assert.equal((await request(app, `${completePath}?permissions=access_discipleship`, {
            method: 'POST',
            cookie: editorCookie,
            body: forgedAuthority,
            headers: forgedHeaders
        })).status, 403);

        const review = await request(app, reviewPath, { cookie: reviewerCookie });
        assert.equal(review.status, 200);
        assert.equal(review.json.member.id, target.youthId);
        assert.equal((await request(app, completePath, {
            method: 'POST',
            cookie: reviewerCookie,
            body: { ...forgedAuthority, edit_entries: true },
            headers: forgedHeaders
        })).status, 403);

        assert.equal((await request(app, reviewPath, { cookie: leaderCookie })).status, 200);
        const progress = await get(
            database,
            `SELECT progress.status FROM growth_phase_progress progress
             JOIN growth_journey_phases phase ON phase.id = progress.phase_id
             WHERE progress.youth_id = ? AND phase.phase_key = 'encounter'`,
            [target.youthId]
        );
        assert.equal(progress.status, 'ready');
    });

    await t.test('leadership review is bounded and future prayer does not bypass sequencing', async () => {
        const response = await request(app, `${reviewPath}?youth_id=${untouched.youthId}`, {
            cookie: leaderCookie
        });
        assert.equal(response.status, 200);
        assert.deepEqual(Object.keys(response.json.member).sort(), ['id', 'name']);
        assert.equal(response.json.member.id, target.youthId);
        assert.equal(response.json.journey.currentPhase.phaseKey, 'encounter');
        assert.equal(response.json.journey.currentPhase.status, 'ready');
        assert.equal(response.json.journey.phases.find(phase => phase.phaseKey === 'belong').sequenceState, 'upcoming');
        assert.ok(response.json.journey.phases.find(phase => phase.phaseKey === 'commit').progressPercent > 0);
        assert.equal(response.headers['cache-control'], 'no-store');
    });

    await t.test('malformed/missing targets and non-current phases fail safely', async () => {
        assert.equal((await request(app, '/api/admin/growth-journey/members/not-a-number', {
            cookie: leaderCookie
        })).status, 400);
        assert.equal((await request(app, '/api/admin/growth-journey/members/999999999', {
            cookie: leaderCookie
        })).status, 404);
        assert.equal((await request(app, '/api/admin/growth-journey/members/999999999/phases/encounter/complete', {
            method: 'POST', cookie: leaderCookie
        })).status, 404);
        assert.equal((await request(app, `${reviewPath}/phases/Bad-Key/complete`, {
            method: 'POST', cookie: leaderCookie
        })).status, 400);
        assert.equal((await request(app, `${reviewPath}/phases/not_a_phase/complete`, {
            method: 'POST', cookie: leaderCookie
        })).status, 404);
        assert.equal((await request(app, `${reviewPath}/phases/commit/complete`, {
            method: 'POST', cookie: leaderCookie
        })).status, 409);
    });

    await t.test('not_started, in_progress, and paused current phases are rejected', async () => {
        const notStartedResponse = await request(
            app,
            `/api/admin/growth-journey/members/${notStarted.youthId}/phases/encounter/complete`,
            { method: 'POST', cookie: leaderCookie }
        );
        assert.equal(notStartedResponse.status, 409);

        await GrowthJourney.recordAccountCreated(database, inProgress.youthId, {
            sourceKey: `account:${inProgress.youthId}`,
            actor: 'TEST'
        });
        assert.equal((await request(
            app,
            `/api/admin/growth-journey/members/${inProgress.youthId}/phases/encounter/complete`,
            { method: 'POST', cookie: leaderCookie }
        )).status, 409);

        await GrowthJourney.recordAccountCreated(database, paused.youthId, {
            sourceKey: `account:${paused.youthId}`,
            actor: 'TEST'
        });
        await run(
            database,
            `UPDATE growth_phase_progress SET status = 'paused'
             WHERE youth_id = ? AND phase_id = (
                 SELECT id FROM growth_journey_phases WHERE phase_key = 'encounter'
             )`,
            [paused.youthId]
        );
        assert.equal((await request(
            app,
            `/api/admin/growth-journey/members/${paused.youthId}/phases/encounter/complete`,
            { method: 'POST', cookie: leaderCookie }
        )).status, 409);
    });

    await t.test('ready Encounter completes once and authoritatively reveals Belong', async () => {
        const untouchedBefore = await get(database, 'SELECT * FROM youth WHERE id = ?', [untouched.youthId]);
        const response = await request(app, completePath, {
            method: 'POST',
            cookie: leaderCookie,
            body: {
                actor: 'FORGED-ACTOR',
                approved_by: 'FORGED-APPROVER',
                youth_id: untouched.youthId,
                status: 'completed',
                completion_basis: 'FORGED'
            }
        });
        assert.equal(response.status, 200);
        assert.equal(response.json.completed, true);
        assert.equal(response.json.idempotent, false);
        assert.equal(response.json.member.id, target.youthId);
        assert.equal(response.json.journey.phases[0].status, 'completed');
        assert.equal(response.json.journey.phases[0].sequenceState, 'completed');
        assert.equal(response.json.journey.currentPhase.phaseKey, 'belong');
        assert.equal(response.json.journey.currentPhase.sequenceState, 'current');
        assert.equal(response.json.journey.nextInvitation.taskKey, 'belong-membership-intent');
        assert.equal(response.json.journey.nextPhase.phaseKey, 'commit');
        assert.equal(response.json.journey.phases.find(phase => phase.phaseKey === 'commit').sequenceState, 'upcoming');

        const completed = await get(
            database,
            `SELECT progress.* FROM growth_phase_progress progress
             JOIN growth_journey_phases phase ON phase.id = progress.phase_id
             WHERE progress.youth_id = ? AND phase.phase_key = 'encounter'`,
            [target.youthId]
        );
        assert.equal(completed.status, 'completed');
        assert.ok(completed.completed_at);
        assert.equal(completed.completion_basis, 'leadership_approved');
        assert.deepEqual(await get(database, 'SELECT * FROM youth WHERE id = ?', [untouched.youthId]), untouchedBefore);

        const audit = await get(
            database,
            `SELECT * FROM activity_logs
             WHERE action = 'GROWTH_PHASE_ADVANCED'
             ORDER BY id DESC LIMIT 1`
        );
        assert.equal(audit.username, leader.username);
        assert.doesNotMatch(audit.username, /FORGED/);

        const completedAt = completed.completed_at;
        const replay = await request(app, completePath, { method: 'POST', cookie: leaderCookie });
        assert.equal(replay.status, 200);
        assert.equal(replay.json.completed, false);
        assert.equal(replay.json.idempotent, true);
        assert.equal((await get(
            database,
            `SELECT completed_at FROM growth_phase_progress
             WHERE youth_id = ? AND phase_id = (
                 SELECT id FROM growth_journey_phases WHERE phase_key = 'encounter'
             )`,
            [target.youthId]
        )).completed_at, completedAt);
        assert.equal((await get(
            database,
            "SELECT COUNT(*) AS count FROM activity_logs WHERE action = 'GROWTH_PHASE_ADVANCED' AND details LIKE ?",
            [`%Member ID ${target.youthId}`]
        )).count, 1);
        assert.equal((await get(
            database,
            "SELECT COUNT(*) AS count FROM notification_events WHERE source_type = 'growth_journey'"
        )).count, 0);

        assert.equal((await request(
            app,
            `${reviewPath}/phases/belong/complete`,
            { method: 'POST', cookie: leaderCookie }
        )).status, 409);
    });

    await t.test('simultaneous completion is serialized and creates one transition', async () => {
        await makeEncounterReady(database, concurrent.youthId, 'concurrent');
        const pathName = `/api/admin/growth-journey/members/${concurrent.youthId}/phases/encounter/complete`;
        const responses = await Promise.all([
            request(app, pathName, { method: 'POST', cookie: leaderCookie }),
            request(app, pathName, { method: 'POST', cookie: leaderCookie })
        ]);
        assert.deepEqual(responses.map(response => response.status), [200, 200]);
        assert.deepEqual(
            responses.map(response => response.json.completed).sort(),
            [false, true]
        );
        assert.equal((await get(
            database,
            "SELECT COUNT(*) AS count FROM activity_logs WHERE action = 'GROWTH_PHASE_ADVANCED' AND details LIKE ?",
            [`%Member ID ${concurrent.youthId}`]
        )).count, 1);
        const progress = await get(
            database,
            `SELECT status, completed_at, completion_basis
             FROM growth_phase_progress
             WHERE youth_id = ? AND phase_id = (
                 SELECT id FROM growth_journey_phases WHERE phase_key = 'encounter'
             )`,
            [concurrent.youthId]
        );
        assert.equal(progress.status, 'completed');
        assert.ok(progress.completed_at);
        assert.equal(progress.completion_basis, 'leadership_approved');
    });

    await t.test('revoking either canonical permission takes effect immediately', async () => {
        const forged = {
            cookie: leaderCookie,
            body: { permissions: ['access_discipleship', 'edit_entries'], is_admin: true },
            headers: { 'X-User-Permissions': 'access_discipleship,edit_entries', 'X-Admin': 'true' }
        };

        await run(
            database,
            'UPDATE users SET permissions = ? WHERE id = ?',
            [JSON.stringify(['access_discipleship']), leader.userId]
        );
        assert.equal((await request(app, reviewPath, forged)).status, 200);
        assert.equal((await request(app, completePath, { ...forged, method: 'POST' })).status, 403);

        await run(
            database,
            'UPDATE users SET permissions = ? WHERE id = ?',
            [JSON.stringify(['edit_entries']), leader.userId]
        );
        assert.equal((await request(app, reviewPath, forged)).status, 403);
        assert.equal((await request(app, completePath, { ...forged, method: 'POST' })).status, 403);
    });

    assert.equal((await get(database, 'PRAGMA integrity_check')).integrity_check, 'ok');
});
