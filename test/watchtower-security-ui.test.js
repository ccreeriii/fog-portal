'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const watchtowerSource = fs.readFileSync(
    path.join(repositoryRoot, 'public', 'js', 'watchtower.js'),
    'utf8'
);

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
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
        const requestHeaders = {
            ...(cookie ? { cookie } : {}),
            ...Object.fromEntries(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value]))
        };
        const req = {
            body,
            params: { ...params },
            query: Object.fromEntries(parsedPath.searchParams),
            headers: requestHeaders,
            get(name) { return requestHeaders[String(name).toLowerCase()]; },
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
            if (error) return reject(error);
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
    const username = `WATCH-${suffix}`;
    const member = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, created_at)
         VALUES (?, ?, ?, 'test-password', datetime('now'))`,
        [`Watchtower ${suffix}`, `${suffix.toLowerCase()}@invalid.test`, username]
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
    const sessionId = `watchtower-${identity.userId}`;
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        permissions: ['access_prayer'],
        createdAt: Date.now(),
        expiresAt: Date.now() + 600_000
    });
    return `koinonia_session=${sessionId}`;
}

test('Watchtower APIs use live canonical access_prayer authority and reject forged acting identity', { concurrency: false }, async t => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-watchtower-api-'));
    let database;
    t.after(async () => {
        if (database) await close(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    for (const directory of ['terms', 'privacy']) {
        await fsp.cp(path.join(repositoryRoot, 'public', directory), path.join(temporaryRoot, 'public', directory), { recursive: true });
    }

    let serverSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    for (const [original, replacement] of [
        ['void runDatabaseBackup();', 'void Promise.resolve();'],
        ['setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);', 'setInterval(() => {}, 1000 * 60 * 60).unref();'],
        ["cron.schedule('0 9 * * 1',", "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"],
        ['startServerAfterRuntimeSchemaReady();', 'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };']
    ]) {
        assert.ok(serverSource.includes(original), `isolation hook exists: ${original}`);
        serverSource = serverSource.replace(original, replacement);
    }
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), serverSource);
    for (const filename of [
        'sqlite-backup.js',
        'email-security.js',
        'account-claim-security.js',
        'legal-acceptance.js',
        'growth-journey.js',
        'notification-center.js',
        'notification-delivery.js',
        'growth-notifications.js',
        'watchtower-prayer-coverage.js'
    ]) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Watchtower Test</title>');

    const application = require(path.join(temporaryRoot, 'server.js'));
    database = application.db;
    await application.ready;
    for (const migrationName of [
        '20260913_notification_center_v1.sql',
        '20260913_growth_journey_v1.sql',
        '20260913_growth_journey_ministry_hierarchy_fix.sql',
        '20260914_growth_encounter_readiness_v1.sql',
        '20260914_growth_prayer_rhythm_v1.sql'
    ]) {
        await execute(database, await fsp.readFile(path.join(repositoryRoot, 'migrations', migrationName), 'utf8'));
    }

    const ordinary = await createIdentity(database, 'ORDINARY');
    const intercessor = await createIdentity(database, 'INTERCESSOR', ['access_prayer']);
    const ordinaryCookie = createSession(application.sessionStore, ordinary);
    const intercessorCookie = createSession(application.sessionStore, intercessor);

    assert.equal((await request(application.app, '/api/prayer/watchtower')).status, 401);
    assert.equal((await request(application.app, '/api/prayer/watchtower', {
        cookie: ordinaryCookie,
        headers: { 'X-User-Permissions': 'access_prayer' }
    })).status, 403);

    const authorized = await request(application.app, '/api/prayer/watchtower', {
        cookie: intercessorCookie
    });
    assert.equal(authorized.status, 200);
    assert.equal(authorized.json.success, true);
    assert.ok(Object.hasOwn(authorized.json, 'manila_date'));
    assert.ok(Object.hasOwn(authorized.json, 'open'));

    assert.equal((await request(
        application.app,
        `/api/prayer/watchtower/${ordinary.youthId}/claim?claimant_youth_id=${intercessor.youthId}`,
        {
            method: 'POST',
            cookie: intercessorCookie,
            body: { actor_youth_id: intercessor.youthId, permissions: ['access_prayer'] },
            headers: { 'X-User-Id': String(intercessor.userId) }
        }
    )).status, 403);

    await run(database, 'UPDATE users SET permissions = ? WHERE id = ?', ['[]', intercessor.userId]);
    assert.equal((await request(application.app, '/api/prayer/watchtower', {
        cookie: intercessorCookie
    })).status, 403, 'permission revocation is effective on the next request');
});

class FakeElement {
    constructor(tagName) {
        this.tagName = String(tagName).toUpperCase();
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.style = {};
        this.attributes = {};
        this.listeners = {};
        this.id = '';
        this.textContent = '';
        this.disabled = false;
        this._classes = new Set();
    }

    set className(value) {
        this._classes = new Set(String(value || '').split(/\s+/).filter(Boolean));
    }

    get className() {
        return [...this._classes].join(' ');
    }

    get firstChild() {
        return this.children[0] || null;
    }

    appendChild(node) {
        node.parentNode = this;
        this.children.push(node);
        return node;
    }

    insertBefore(node, reference) {
        node.parentNode = this;
        const index = reference ? this.children.indexOf(reference) : -1;
        if (index < 0) this.children.push(node);
        else this.children.splice(index, 0, node);
        return node;
    }

    removeChild(node) {
        const index = this.children.indexOf(node);
        if (index >= 0) this.children.splice(index, 1);
        node.parentNode = null;
    }

    remove() {
        if (this.parentNode) this.parentNode.removeChild(this);
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    addEventListener(name, listener) {
        this.listeners[name] = listener;
    }

    querySelectorAll(selector) {
        const results = [];
        const visit = node => {
            for (const child of node.children) {
                if (selector === '.nav-btn' && child._classes.has('nav-btn')) results.push(child);
                visit(child);
            }
        };
        visit(this);
        return results;
    }
}

function findById(root, id) {
    if (root.id === id) return root;
    for (const child of root.children) {
        const found = findById(child, id);
        if (found) return found;
    }
    return null;
}

function renderedText(node) {
    return [node.textContent, ...node.children.map(renderedText)].filter(Boolean).join(' ');
}

function createWatchtowerBrowser({ authorized, states }) {
    const root = new FakeElement('body');
    const sidebar = new FakeElement('nav');
    sidebar.id = 'sidebarNav';
    const status = new FakeElement('div');
    status.id = 'watchtowerStatus';
    const list = new FakeElement('div');
    list.id = 'watchtowerList';
    const hamburger = new FakeElement('button');
    hamburger.id = 'hamburgerBtn';
    root.appendChild(sidebar);
    root.appendChild(status);
    root.appendChild(list);
    root.appendChild(hamburger);

    const responses = [...states];
    let fetchCalls = 0;
    const window = {
        location: { origin: 'https://portal.invalid', search: '' },
        hasPerm: permission => authorized && permission === 'access_prayer',
        fetch: async () => {
            fetchCalls += 1;
            const body = responses.shift();
            return { ok: true, status: 200, json: async () => body };
        },
        buildNav() {
            const logout = new FakeElement('button');
            logout.className = 'nav-btn';
            logout.textContent = 'Logout';
            sidebar.appendChild(logout);
        },
        switchTab() {},
        addEventListener() {}
    };
    const document = {
        createElement: tag => new FakeElement(tag),
        getElementById: id => findById(root, id)
    };
    const context = vm.createContext({
        window,
        document,
        URL,
        URLSearchParams,
        encodeURIComponent,
        console
    });
    vm.runInContext(watchtowerSource, context);
    return { window, sidebar, status, list, getFetchCalls: () => fetchCalls };
}

test('authorized Watchtower UI renders safe claim states, empty success, and closed-window copy', async () => {
    const maliciousName = '<img src=x onerror=alert(1)>';
    const browser = createWatchtowerBrowser({
        authorized: true,
        states: [
            {
                open: true,
                phase: 'open',
                claim_minutes: 15,
                uncovered: [
                    { youth_id: 1, name: maliciousName, profile_picture: null, claim_state: 'available' },
                    { youth_id: 2, name: 'Claimed by me', profile_picture: null, claim_state: 'claimed_by_me' },
                    { youth_id: 3, name: 'Claimed elsewhere', profile_picture: null, claim_state: 'claimed' }
                ]
            },
            { open: true, phase: 'open', claim_minutes: 15, uncovered: [] },
            {
                open: false,
                phase: 'closed',
                uncovered: [],
                report: { total_covered: 3, eligible_population: 3, coverage_percent: 100 }
            }
        ]
    });

    browser.window.buildNav();
    assert.ok(findById(browser.sidebar, 'watchtowerNavButton'));
    await browser.window.loadWatchtower();
    assert.equal(browser.list.children.length, 3);
    assert.match(renderedText(browser.list.children[0]), /<img src=x onerror=alert\(1\)>/);
    assert.equal(browser.list.children[0].children.at(-1).textContent, 'Claim');
    assert.equal(browser.list.children[1].children.at(-1).textContent, 'Mark Prayed');
    assert.equal(browser.list.children[2].children.at(-1).disabled, true);
    assert.doesNotMatch(watchtowerSource, /\.innerHTML\s*=/);

    await browser.window.loadWatchtower();
    assert.equal(browser.list.children.length, 0, 'covered members disappear from Uncovered Today');
    assert.match(browser.status.textContent, /Everyone.*covered/);

    await browser.window.loadWatchtower();
    assert.match(browser.status.textContent, /window is closed/i);
    assert.match(browser.status.textContent, /100%/);
});

test('unauthorized UI exposes no Watchtower navigation and performs no API read', async () => {
    const browser = createWatchtowerBrowser({ authorized: false, states: [] });
    browser.window.buildNav();
    await browser.window.loadWatchtower();
    assert.equal(findById(browser.sidebar, 'watchtowerNavButton'), null);
    assert.equal(browser.getFetchCalls(), 0);
});

test('active shell and cache publish the restricted Watchtower asset coherently', () => {
    const html = fs.readFileSync(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
    const serviceWorker = fs.readFileSync(path.join(repositoryRoot, 'public', 'sw.js'), 'utf8');
    assert.match(html, /id="watchtowerTab"/);
    assert.match(html, /Uncovered Today/);
    assert.match(html, /value="access_prayer"/);
    assert.match(html, /\/js\/watchtower\.js\?v=1/);
    assert.match(serviceWorker, /fog-portal-v25/);
    assert.match(serviceWorker, /\/js\/watchtower\.js\?v=1/);
    assert.match(watchtowerSource, /window\.hasPerm/);
    assert.match(watchtowerSource, /textContent/);
});
