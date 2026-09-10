'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const {
    FAQ_SECTIONS,
    getFaqSectionsForAccess,
    isFaqSectionAllowed
} = require('../lib/help-faq');

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close(error => error ? reject(error) : resolve());
    });
}

function request(app, pathname, { cookie, query = {} } = {}) {
    const parsedPath = new URL(pathname, 'http://isolated.test');
    const router = app.router || app._router;
    let routeMatch;
    const routeLayer = router.stack.find(layer => {
        if (!layer.route || !layer.route.methods.get) return false;
        routeMatch = layer.matchers[0](parsedPath.pathname);
        return Boolean(routeMatch);
    });
    assert.ok(routeLayer, `GET ${parsedPath.pathname} is registered`);

    return new Promise((resolve, reject) => {
        let handlerIndex = 0;
        let completed = false;
        const responseHeaders = Object.create(null);
        const req = {
            body: {},
            params: { ...routeMatch.params },
            query: { ...Object.fromEntries(parsedPath.searchParams), ...query },
            headers: cookie ? { cookie } : {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1', encrypted: false }
        };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(name, value) { responseHeaders[name.toLowerCase()] = value; },
            getHeader(name) { return responseHeaders[name.toLowerCase()]; },
            json(value) {
                if (!completed) {
                    completed = true;
                    resolve({ status: this.statusCode, json: value, headers: responseHeaders });
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
            const handler = routeLayer.route.stack[handlerIndex++]?.handle;
            if (!handler) return reject(new Error(`GET ${parsedPath.pathname} completed without a response`));
            try {
                Promise.resolve(handler(req, res, next)).catch(reject);
            } catch (handlerError) {
                reject(handlerError);
            }
        };
        next();
    });
}

async function createIdentity(database, suffix, permissions, usernameOverride = null) {
    const username = usernameOverride || `HELP-${suffix}`;
    const youth = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [`Help ${suffix}`, `${suffix.toLowerCase()}@invalid.test`, username, 'isolated-help-password']
    );
    const user = await run(
        database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        [username, 'isolated-help-password', JSON.stringify(permissions), youth.lastID]
    );
    return { username, youthId: youth.lastID, userId: user.lastID };
}

function createSession(sessionStore, identity) {
    const sessionId = `help-${identity.userId}`;
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000
    });
    return `koinonia_session=${sessionId}`;
}

function sectionIds(response) {
    return response.json.sections.map(section => section.id);
}

test('FAQ content model applies audience, any-permission, all-permission, and preview rules', async t => {
    const publicIds = getFaqSectionsForAccess({}).map(section => section.id);
    const memberIds = getFaqSectionsForAccess({ authenticated: true }).map(section => section.id);
    const permissionAccess = permission => ({
        authenticated: true,
        hasPermission: candidate => candidate === permission
    });

    await t.test('guest receives public sections only', () => {
        assert.ok(publicIds.length > 0);
        assert.ok(FAQ_SECTIONS.filter(section => publicIds.includes(section.id)).every(section => section.audience === 'public'));
    });
    await t.test('ordinary member receives public and member sections', () => {
        assert.ok(memberIds.length > publicIds.length);
        assert.ok(FAQ_SECTIONS.filter(section => memberIds.includes(section.id)).every(section => ['public', 'member'].includes(section.audience)));
    });
    await t.test('ordinary member receives no leadership section', () => {
        assert.equal(memberIds.some(id => id.startsWith('leader-help-')), false);
    });
    await t.test('ordinary member receives no administrator section', () => {
        assert.equal(memberIds.includes('administrator-help-accounts-permissions'), false);
    });
    for (const permission of ['access_events', 'access_attendance', 'access_checkin']) {
        await t.test(`${permission} independently enables event leadership help`, () => {
            assert.ok(getFaqSectionsForAccess(permissionAccess(permission)).some(section => section.id === 'leader-help-events-attendance-roles'));
        });
    }
    await t.test('event permission does not enable unrelated leadership help', () => {
        const ids = getFaqSectionsForAccess(permissionAccess('access_events')).map(section => section.id);
        assert.equal(ids.includes('leader-help-ministries-availability'), false);
        assert.equal(ids.includes('leader-help-announcements-broadcasts'), false);
        assert.equal(ids.includes('leader-help-worship-resources'), false);
    });
    for (const [permission, expectedId] of [
        ['access_ministries', 'leader-help-ministries-availability'],
        ['access_communications', 'leader-help-announcements-broadcasts'],
        ['access_worship', 'leader-help-worship-resources']
    ]) {
        await t.test(`${permission} enables only its mapped leadership topic`, () => {
            const ids = getFaqSectionsForAccess(permissionAccess(permission)).map(section => section.id);
            assert.ok(ids.includes(expectedId));
            assert.equal(ids.filter(id => id.startsWith('leader-help-')).length, 1);
        });
    }
    await t.test('unknown permission names grant no restricted help', () => {
        assert.deepEqual(
            getFaqSectionsForAccess(permissionAccess('display_theme')).map(section => section.id),
            memberIds
        );
    });
    await t.test('unmapped restricted metadata fails closed', () => {
        const synthetic = { audience: 'leader', permissionAny: [], permissionAll: [] };
        assert.equal(isFaqSectionAllowed(synthetic, { authenticated: true, hasPermission: () => true }), false);
    });
    await t.test('permissionAny accepts one canonical match', () => {
        const synthetic = { audience: 'leader', permissionAny: ['one', 'two'], permissionAll: [] };
        assert.equal(isFaqSectionAllowed(synthetic, { authenticated: true, hasPermission: value => value === 'two' }), true);
    });
    await t.test('permissionAll fails closed on an incomplete set', () => {
        const synthetic = { audience: 'leader', permissionAny: [], permissionAll: ['one', 'two'] };
        assert.equal(isFaqSectionAllowed(synthetic, { authenticated: true, hasPermission: value => value === 'one' }), false);
    });
    await t.test('permissionAll accepts only the complete set', () => {
        const synthetic = { audience: 'leader', permissionAny: [], permissionAll: ['one', 'two'] };
        assert.equal(isFaqSectionAllowed(synthetic, { authenticated: true, hasPermission: () => true }), true);
    });
    await t.test('leader preview excludes account administration', () => {
        const ids = getFaqSectionsForAccess({ preview: 'leader' }).map(section => section.id);
        assert.ok(ids.includes('leader-help-events-attendance-roles'));
        assert.equal(ids.includes('administrator-help-accounts-permissions'), false);
    });
    await t.test('administrator preview contains every deliverable section', () => {
        assert.equal(getFaqSectionsForAccess({ preview: 'administrator' }).length, FAQ_SECTIONS.length);
    });
    await t.test('invalid preview fails closed', () => {
        assert.throws(() => getFaqSectionsForAccess({ preview: 'crafted-admin' }), /Unknown FAQ preview profile/);
    });
    await t.test('unmapped moderation and recipe topics are excluded', () => {
        const ids = FAQ_SECTIONS.map(section => section.id);
        assert.equal(ids.includes('moderation-member-flags'), false);
        assert.equal(ids.includes('recipe-review-approval'), false);
    });
});

test('FAQ API uses canonical sessions, filters on the server, and protects preview mode', { concurrency: false }, async t => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-help-test-'));
    let database;
    t.after(async () => {
        if (database) await closeDatabase(database);
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
            'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };'
        );
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'help-faq.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');

    const application = require(path.join(temporaryRoot, 'server.js'));
    await application.ready;
    database = application.db;
    const member = await createIdentity(database, 'MEMBER', []);
    const events = await createIdentity(database, 'EVENTS', ['access_events']);
    const ministries = await createIdentity(database, 'MINISTRIES', ['access_ministries']);
    const communications = await createIdentity(database, 'COMMUNICATIONS', ['access_communications']);
    const worship = await createIdentity(database, 'WORSHIP', ['access_worship']);
    const administrator = await createIdentity(database, 'ADMINISTRATOR', ['access_permissions']);
    const fullAdministrator = await createIdentity(database, 'FULL', [
        'access_events', 'access_attendance', 'access_checkin', 'access_ministries',
        'access_communications', 'access_worship', 'access_permissions'
    ]);
    const strongAdministrator = await createIdentity(
        database,
        'STRONG',
        ['access_permissions'],
        'celsocreeriii@gmail.com'
    );
    const cookies = Object.fromEntries([
        ['member', member], ['events', events], ['ministries', ministries],
        ['communications', communications], ['worship', worship],
        ['administrator', administrator], ['fullAdministrator', fullAdministrator],
        ['strongAdministrator', strongAdministrator]
    ].map(([name, identity]) => [name, createSession(application.sessionStore, identity)]));

    await t.test('anonymous API response succeeds with public content and private no-store caching', async () => {
        const response = await request(application.app, '/api/help/faq');
        assert.equal(response.status, 200);
        assert.equal(response.json.canPreview, false);
        assert.ok(response.json.sections.every(section => section.audience === 'public'));
        assert.match(response.headers['cache-control'], /no-store/);
        assert.match(response.headers['cache-control'], /private/);
        assert.equal(response.headers.vary, 'Cookie');
    });
    await t.test('member API response adds member content without restricted content', async () => {
        const response = await request(application.app, '/api/help/faq', { cookie: cookies.member });
        const ids = sectionIds(response);
        assert.equal(response.status, 200);
        assert.ok(response.json.sections.some(section => section.audience === 'member'));
        assert.equal(ids.some(id => id.startsWith('leader-help-')), false);
        assert.equal(ids.includes('administrator-help-accounts-permissions'), false);
    });
    for (const [name, expectedId] of [
        ['events', 'leader-help-events-attendance-roles'],
        ['ministries', 'leader-help-ministries-availability'],
        ['communications', 'leader-help-announcements-broadcasts'],
        ['worship', 'leader-help-worship-resources']
    ]) {
        await t.test(`${name} canonical permission returns its matching topic`, async () => {
            const response = await request(application.app, '/api/help/faq', { cookie: cookies[name] });
            assert.ok(sectionIds(response).includes(expectedId));
            assert.equal(sectionIds(response).filter(id => id.startsWith('leader-help-')).length, 1);
        });
    }
    await t.test('access_permissions enables account help and preview without unrelated leadership help', async () => {
        const response = await request(application.app, '/api/help/faq', { cookie: cookies.administrator });
        assert.equal(response.status, 200);
        assert.equal(response.json.canPreview, true);
        assert.ok(sectionIds(response).includes('administrator-help-accounts-permissions'));
        assert.equal(sectionIds(response).some(id => id.startsWith('leader-help-')), false);
    });
    await t.test('full permission array and strong administrator receive all deliverable content', async () => {
        for (const cookie of [cookies.fullAdministrator, cookies.strongAdministrator]) {
            const response = await request(application.app, '/api/help/faq', { cookie });
            assert.equal(response.status, 200);
            assert.equal(response.json.canPreview, true);
            assert.equal(response.json.sections.length, FAQ_SECTIONS.length);
        }
    });
    await t.test('forged query authority cannot reveal restricted content', async () => {
        const response = await request(
            application.app,
            '/api/help/faq?permissions=access_permissions&is_admin=true',
            { cookie: cookies.member }
        );
        assert.equal(response.json.canPreview, false);
        assert.equal(sectionIds(response).some(id => id.startsWith('leader-help-')), false);
    });
    await t.test('unauthorized preview attempts fail with 403', async () => {
        const unauthorizedPreview = await request(application.app, '/api/help/faq?preview=leader');
        assert.equal(unauthorizedPreview.status, 403);
        assert.match(unauthorizedPreview.headers['cache-control'], /no-store/);
        assert.match(unauthorizedPreview.headers['cache-control'], /private/);
        assert.equal(unauthorizedPreview.headers.vary, 'Cookie');
        assert.equal((await request(application.app, '/api/help/faq?preview=administrator', { cookie: cookies.member })).status, 403);
        assert.equal((await request(application.app, '/api/help/faq?preview=crafted', { cookie: cookies.member })).status, 403);
        assert.equal((await request(application.app, '/api/help/faq', { cookie: cookies.member, query: { preview: ['leader'] } })).status, 403);
    });
    await t.test('authorized invalid preview fails with 400', async () => {
        const invalidPreview = await request(application.app, '/api/help/faq?preview=crafted', { cookie: cookies.administrator });
        assert.equal(invalidPreview.status, 400);
        assert.match(invalidPreview.headers['cache-control'], /no-store/);
        assert.match(invalidPreview.headers['cache-control'], /private/);
        assert.equal(invalidPreview.headers.vary, 'Cookie');
        assert.equal((await request(application.app, '/api/help/faq?preview=', { cookie: cookies.administrator })).status, 400);
        assert.equal((await request(application.app, '/api/help/faq', { cookie: cookies.administrator, query: { preview: ['leader'] } })).status, 400);
    });
    for (const [profile, allowedAudiences] of [
        ['guest', ['public']],
        ['member', ['public', 'member']],
        ['leader', ['public', 'member', 'leader']],
        ['administrator', ['public', 'member', 'leader', 'admin']]
    ]) {
        await t.test(`authorized ${profile} preview returns only its documented profile`, async () => {
            const response = await request(application.app, `/api/help/faq?preview=${profile}`, { cookie: cookies.administrator });
            assert.equal(response.status, 200);
            assert.ok(response.json.sections.every(section => allowedAudiences.includes(section.audience)));
            if (profile === 'administrator') assert.equal(response.json.sections.length, FAQ_SECTIONS.length);
        });
    }
    await t.test('preview is documentation-only and does not mutate actual authority', async () => {
        const before = await request(application.app, '/api/help/faq', { cookie: cookies.administrator });
        await request(application.app, '/api/help/faq?preview=guest', { cookie: cookies.administrator });
        const after = await request(application.app, '/api/help/faq', { cookie: cookies.administrator });
        assert.deepEqual(sectionIds(after), sectionIds(before));
    });
    await t.test('response contains no account identity or permission record', async () => {
        const response = await request(application.app, '/api/help/faq', { cookie: cookies.administrator });
        const serialized = JSON.stringify(response.json);
        assert.doesNotMatch(serialized, /celsocreeriii|@invalid\.test|"permissions"|"userId"|"youthId"/);
    });
});

test('FAQ client shell, interactive behavior, and universal header entry point are safe', async t => {
    const html = await fsp.readFile(path.join(repositoryRoot, 'public', 'faq', 'index.html'), 'utf8');
    const script = await fsp.readFile(path.join(repositoryRoot, 'public', 'faq', 'faq.js'), 'utf8');
    const portal = await fsp.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');

    await t.test('public shell contains no restricted FAQ answers or preview prototype wording', () => {
        assert.doesNotMatch(html, /What can leaders manage|member flag|recipe review|Leadership Review Preview/i);
    });
    await t.test('public JavaScript contains no restricted FAQ answer constants', () => {
        assert.doesNotMatch(script, /What can leaders manage|member flag|recipe review/i);
    });
    await t.test('client fetches only server-filtered FAQ data without caching', () => {
        assert.match(script, /fetch\(`\/api\/help\/faq\$\{query\}`/);
        assert.match(script, /cache: 'no-store'/);
        assert.match(script, /credentials: 'same-origin'/);
    });
    await t.test('search uses only currently authorized response sections', () => {
        assert.match(script, /authorizedSections/);
        assert.match(script, /search\.addEventListener\('input', renderSections\)/);
    });
    await t.test('accordion controls update aria-expanded and hidden state', () => {
        assert.match(script, /aria-expanded/);
        assert.match(script, /answer\.hidden = !willOpen/);
    });
    await t.test('section chips are rebuilt from visible filtered sections', () => {
        assert.match(script, /chips\.replaceChildren\(\.\.\.chipNodes\)/);
        assert.match(script, /chip\.href = `#\$\{section\.id\}`/);
    });
    await t.test('Preview As remains hidden unless the server authorizes it', () => {
        assert.match(html, /id="previewControls" hidden/);
        assert.match(script, /previewControls\.hidden = payload\.canPreview !== true/);
    });
    await t.test('changing preview requests newly filtered server data', () => {
        assert.match(script, /previewAs\.addEventListener\('change', \(\) => loadFaq\(previewAs\.value\)\)/);
    });
    await t.test('active preview is clearly presentation-only', () => {
        assert.match(html, /id="previewNotice"/);
        assert.match(script, /Presentation Preview/);
        assert.match(script, /Your account and permissions are unchanged/);
    });
    await t.test('no browser persistence stores FAQ payloads', () => {
        assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB|caches\s*\./);
    });
    await t.test('official feature names and support address are preserved', () => {
        const serialized = JSON.stringify(FAQ_SECTIONS);
        assert.match(serialized, /Faith Quest Challenge/);
        assert.match(serialized, /Sports & Fitness/);
        assert.match(serialized, /FOG Arcade/);
        assert.doesNotMatch(serialized, /Fit Quest/);
        assert.match(html, /support@fogmin\.site/);
    });
    await t.test('universal header help link is an accessible direct link', () => {
        assert.match(portal, /<a id="headerHelpLink"[^>]+href="\/faq\/"[^>]+aria-label="Help &amp; FAQ"[^>]+title="Help &amp; FAQ"/);
        assert.match(portal, /id="headerHelpLink"[^>]+min-width:44px[^>]+min-height:44px/);
    });
    await t.test('existing navigation menu remains available and separately labeled', () => {
        assert.match(portal, /id="hamburgerBtn"[^>]+onclick="openSidebar\(\)"[^>]+aria-label="Open navigation menu"/);
    });
});
