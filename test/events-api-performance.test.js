'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');
const sharp = require('sharp');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const legacyPayloadBytes = 10_071_001;

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close((err) => err ? reject(err) : resolve());
    });
}

function request(app, pathname, { method = 'GET', cookie, body = {} } = {}) {
    const parsedPath = new URL(pathname, 'http://isolated.test');
    const router = app.router || app._router;
    let routeMatch;
    const routeLayer = router.stack.find(layer => {
        if (!layer.route || !layer.route.methods[method.toLowerCase()]) return false;
        routeMatch = layer.matchers[0](parsedPath.pathname);
        return Boolean(routeMatch);
    });
    assert.ok(routeLayer, `${method} ${parsedPath.pathname} is registered`);

    return new Promise((resolve, reject) => {
        let completed = false;
        let handlerIndex = 0;
        const responseHeaders = Object.create(null);
        const req = {
            body,
            params: { ...routeMatch.params },
            query: Object.fromEntries(parsedPath.searchParams),
            headers: cookie ? { cookie } : {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1', encrypted: false }
        };
        const complete = (res, body, json) => {
            if (!completed) {
                completed = true;
                resolve({ status: res.statusCode, body, json, headers: responseHeaders });
            }
            return res;
        };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            setHeader(name, value) { responseHeaders[name.toLowerCase()] = value; },
            getHeader(name) { return responseHeaders[name.toLowerCase()]; },
            json(value) { return complete(this, value, value); },
            send(value) { return complete(this, value, undefined); }
        };
        const next = (err) => {
            if (completed) return;
            if (err) return reject(err);
            const handler = routeLayer.route.stack[handlerIndex++]?.handle;
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

function createSession(sessionStore, identity) {
    const sessionId = `p9-performance-${identity.userId}`;
    sessionStore.set(sessionId, {
        userId: identity.userId,
        youthId: identity.youthId,
        username: identity.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000
    });
    return `koinonia_session=${sessionId}`;
}

async function createStaffIdentity(database) {
    const youth = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, created_at)
         VALUES ('P9 Performance Staff', 'p9-performance@invalid.test', 'P9-PERFORMANCE-STAFF', 'disposable', datetime('now'))`
    );
    const user = await run(
        database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES ('P9-PERFORMANCE-STAFF', 'disposable', ?, ?, datetime('now'))`,
        [JSON.stringify(['access_events', 'edit_entries']), youth.lastID]
    );
    return { userId: user.lastID, youthId: youth.lastID, username: 'P9-PERFORMANCE-STAFF' };
}

async function createOrdinaryIdentity(database) {
    const youth = await run(
        database,
        `INSERT INTO youth (name, email, qr_code, password, created_at)
         VALUES ('P9 Performance Member', 'p9-performance-member@invalid.test', 'P9-PERFORMANCE-MEMBER', 'disposable', datetime('now'))`
    );
    const user = await run(
        database,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES ('P9-PERFORMANCE-MEMBER', 'disposable', '[]', ?, datetime('now'))`,
        [youth.lastID]
    );
    return { userId: user.lastID, youthId: youth.lastID, username: 'P9-PERFORMANCE-MEMBER' };
}

test('events API uses lightweight list, selected detail, and allowlisted media', { concurrency: false }, async (t) => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-events-performance-'));
    let database;
    let httpServer;

    t.after(async () => {
        if (httpServer) await new Promise(resolve => httpServer.close(resolve));
        if (database) await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public', 'img'), { recursive: true });
    const serverSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const isolatedServerSource = serverSource
        .replace("process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err));", '')
        .replace("process.on('unhandledRejection', (reason, promise) => console.error('Unhandled Rejection:', reason));", '')
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
    await fsp.copyFile(
        path.join(repositoryRoot, 'lib', 'email-security.js'),
        path.join(temporaryRoot, 'lib', 'email-security.js')
    );
    await fsp.copyFile(
        path.join(repositoryRoot, 'lib', 'account-claim-security.js'),
        path.join(temporaryRoot, 'lib', 'account-claim-security.js')
    );
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');
    await fsp.writeFile(
        path.join(temporaryRoot, 'public', 'index.html'),
        '<!doctype html><html><head><title>Isolated test</title></head><body>Isolated test</body></html>'
    );

    const isolatedApplication = require(path.join(temporaryRoot, 'server.js'));
    await isolatedApplication.ready;
    database = isolatedApplication.db;
    await run(database, 'ALTER TABLE events ADD COLUMN gallery TEXT');
    await run(database, 'ALTER TABLE events ADD COLUMN additional_info TEXT');

    const largeJpeg = `data:image/jpeg;base64,${Buffer.alloc(180_000, 65).toString('base64')}`;
    const portraitPixels = Buffer.alloc(400 * 800 * 3);
    for (let y = 0; y < 800; y += 1) {
        const color = y < 80 ? [230, 35, 35] : y >= 720 ? [35, 70, 230] : [245, 245, 245];
        for (let x = 0; x < 400; x += 1) {
            const offset = (y * 400 + x) * 3;
            portraitPixels[offset] = color[0];
            portraitPixels[offset + 1] = color[1];
            portraitPixels[offset + 2] = color[2];
        }
    }
    const portraitPoster = `data:image/jpeg;base64,${(await sharp(portraitPixels, {
        raw: { width: 400, height: 800, channels: 3 }
    }).jpeg({ quality: 95 }).toBuffer()).toString('base64')}`;
    const png = `data:image/png;base64,${Buffer.from('png-fixture').toString('base64')}`;
    const webp = `data:image/webp;base64,${Buffer.from('webp-fixture').toString('base64')}`;
    let selectedEventId;
    for (let index = 0; index < 14; index += 1) {
        const inserted = await run(
            database,
            `INSERT INTO events (
                name, event_date, time_start, venue, poster, photos_url, materials_url,
                gallery, prereg_banner, prereg_info, additional_info, prereg_title,
                prereg_bottom_banner, roles_restricted_notes, event_points, created_at
             ) VALUES (?, ?, '09:00', 'Isolated Venue', ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?, 10, datetime('now'))`,
            [
                `P9 Event ${index + 1}`,
                `2099-01-${String(index + 1).padStart(2, '0')}`,
                index === 0 ? portraitPoster : largeJpeg,
                `https://example.invalid/photos/${index + 1}`,
                `https://example.invalid/materials/${index + 1}`,
                index === 0 ? png : largeJpeg,
                `Selected prereg information ${index + 1}`,
                `Selected additional information ${index + 1}`,
                `Selected prereg title ${index + 1}`,
                index === 0 ? webp : largeJpeg,
                `Restricted note ${index + 1}`
            ]
        );
        if (index === 0) selectedEventId = inserted.lastID;
    }
    const app = isolatedApplication.app;
    httpServer = await new Promise((resolve, reject) => {
        const server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(server));
        server.once('error', reject);
    });
    const isolatedOrigin = `http://127.0.0.1:${httpServer.address().port}`;
    const staff = await createStaffIdentity(database);
    const staffCookie = createSession(isolatedApplication.sessionStore, staff);
    const ordinary = await createOrdinaryIdentity(database);
    const ordinaryCookie = createSession(isolatedApplication.sessionStore, ordinary);
    const listResponse = await request(app, '/api/events');
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.json.length, 14);
    const selectedListEvent = listResponse.json.find(event => event.id === selectedEventId);
    assert.deepEqual(Object.keys(selectedListEvent), [
        'id', 'name', 'event_date', 'time_start', 'venue', 'photos_url',
        'materials_url', 'event_points', 'has_poster', 'poster_url',
        'preregistration_available'
    ]);
    assert.equal(selectedListEvent.poster_url, `/api/events/${selectedEventId}/media/poster`);
    assert.equal(selectedListEvent.has_poster, true);
    assert.equal(selectedListEvent.preregistration_available, true);
    for (const event of listResponse.json) {
        assert.equal('poster' in event, false);
        assert.equal('prereg_banner' in event, false);
        assert.equal('prereg_bottom_banner' in event, false);
        assert.equal('prereg_info' in event, false);
        assert.equal('additional_info' in event, false);
        assert.equal('roles_restricted_notes' in event, false);
    }
    const measuredListResponse = await fetch(`${isolatedOrigin}/api/events`);
    assert.equal(measuredListResponse.status, 200);
    const listBytes = (await measuredListResponse.arrayBuffer()).byteLength;
    const reduction = (1 - listBytes / legacyPayloadBytes) * 100;
    assert.ok(listBytes <= 25 * 1024, `list payload was ${listBytes} bytes`);
    assert.ok(reduction >= 99.7, `payload reduction was ${reduction.toFixed(4)}%`);

    const timings = [];
    for (let index = 0; index < 25; index += 1) {
        const started = performance.now();
        const response = await fetch(`${isolatedOrigin}/api/events`);
        assert.equal(response.status, 200);
        await response.arrayBuffer();
        timings.push(performance.now() - started);
    }
    timings.sort((left, right) => left - right);
    const median = timings[Math.floor(timings.length / 2)];
    const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
    assert.ok(p95 <= 250, `isolated local p95 was ${p95.toFixed(3)}ms`);
    t.diagnostic(`P9_METRICS bytes=${listBytes} reduction=${reduction.toFixed(4)}% median_ms=${median.toFixed(3)} p95_ms=${p95.toFixed(3)}`);

    await t.test('detail preserves selected fields and restricts staff notes', async () => {
        const publicDetailResponse = await fetch(`${isolatedOrigin}/api/events/${selectedEventId}`);
        assert.equal(publicDetailResponse.status, 200);
        const publicDetail = await publicDetailResponse.json();
        assert.equal(publicDetail.prereg_title, 'Selected prereg title 1');
        assert.equal(publicDetail.prereg_info, 'Selected prereg information 1');
        assert.equal(publicDetail.additional_info, 'Selected additional information 1');
        assert.equal(publicDetail.poster_url, `/api/events/${selectedEventId}/media/poster`);
        assert.equal(publicDetail.prereg_banner_url, `/api/events/${selectedEventId}/media/prereg_banner`);
        assert.equal(publicDetail.prereg_bottom_banner_url, `/api/events/${selectedEventId}/media/prereg_bottom_banner`);
        assert.equal('poster' in publicDetail, false);
        assert.equal('roles_restricted_notes' in publicDetail, false);

        const staffDetail = await request(app, `/api/events/${selectedEventId}`, {
            cookie: staffCookie
        });
        assert.equal(staffDetail.status, 200);
        assert.equal(staffDetail.json.roles_restricted_notes, 'Restricted note 1');
        const analytics = await request(app, `/api/events/${selectedEventId}/analytics`, {
            cookie: staffCookie
        });
        assert.equal(analytics.status, 200);
        assert.equal(analytics.json.event.poster_url, `/api/events/${selectedEventId}/media/poster`);
        assert.equal(analytics.json.event.roles_restricted_notes, 'Restricted note 1');
        assert.equal('poster' in analytics.json.event, false);
        assert.equal((await request(app, '/api/events/not-a-number')).status, 404);
        assert.equal((await request(app, '/api/events/999999')).status, 404);
    });

    await t.test('preregistration settings persist both banners and preserve omitted media', async () => {
        const original = await new Promise((resolve, reject) => database.get(
            'SELECT prereg_banner, prereg_bottom_banner FROM events WHERE id = ?',
            [selectedEventId],
            (error, row) => error ? reject(error) : resolve(row)
        ));
        const unauthorized = await request(app, `/api/events/${selectedEventId}/prereg-settings`, {
            method: 'POST', cookie: ordinaryCookie,
            body: { banner: null, bottom_banner: null, title: 'Denied', info: 'Denied' }
        });
        assert.equal(unauthorized.status, 403);
        const afterDenied = await new Promise((resolve, reject) => database.get(
            'SELECT prereg_banner, prereg_bottom_banner FROM events WHERE id = ?',
            [selectedEventId],
            (error, row) => error ? reject(error) : resolve(row)
        ));
        assert.deepEqual(afterDenied, original);

        const updatedTop = `data:image/png;base64,${Buffer.from('updated-top-banner').toString('base64')}`;
        const updatedBottom = `data:image/webp;base64,${Buffer.from('updated-bottom-banner').toString('base64')}`;
        const saved = await request(app, `/api/events/${selectedEventId}/prereg-settings`, {
            method: 'POST', cookie: staffCookie,
            body: {
                banner: updatedTop,
                bottom_banner: updatedBottom,
                title: 'Selected prereg title 1',
                info: 'Selected prereg information 1'
            }
        });
        assert.equal(saved.status, 200);
        assert.deepEqual(saved.json, { success: true, updated: 1 });
        const persisted = await new Promise((resolve, reject) => database.get(
            'SELECT prereg_banner, prereg_bottom_banner FROM events WHERE id = ?',
            [selectedEventId],
            (error, row) => error ? reject(error) : resolve(row)
        ));
        assert.deepEqual(persisted, { prereg_banner: updatedTop, prereg_bottom_banner: updatedBottom });

        const reopened = await fetch(`${isolatedOrigin}/api/events/${selectedEventId}`).then(response => response.json());
        assert.equal(reopened.prereg_banner_url, `/api/events/${selectedEventId}/media/prereg_banner`);
        assert.equal(reopened.prereg_bottom_banner_url, `/api/events/${selectedEventId}/media/prereg_bottom_banner`);
        const topMedia = await fetch(`${isolatedOrigin}${reopened.prereg_banner_url}`);
        const bottomMedia = await fetch(`${isolatedOrigin}${reopened.prereg_bottom_banner_url}`);
        assert.equal(Buffer.from(await topMedia.arrayBuffer()).toString(), 'updated-top-banner');
        assert.equal(Buffer.from(await bottomMedia.arrayBuffer()).toString(), 'updated-bottom-banner');

        const textOnlySave = await request(app, `/api/events/${selectedEventId}/prereg-settings`, {
            method: 'POST', cookie: staffCookie,
            body: { title: 'Selected prereg title 1', info: 'Selected prereg information 1' }
        });
        assert.equal(textOnlySave.status, 200);
        const preserved = await new Promise((resolve, reject) => database.get(
            'SELECT prereg_banner, prereg_bottom_banner FROM events WHERE id = ?',
            [selectedEventId],
            (error, row) => error ? reject(error) : resolve(row)
        ));
        assert.deepEqual(preserved, persisted);
    });

    await t.test('media is binary, cacheable, and limited to three fixed types', async () => {
        const malformedEvent = await run(
            database,
            `INSERT INTO events (name, event_date, poster, event_points, created_at)
             VALUES ('Malformed Media', '2099-02-01', 'data:image/jpeg;base64,%%%bad%%%', 10, datetime('now'))`
        );
        const emptyEvent = await run(
            database,
            `INSERT INTO events (name, event_date, event_points, created_at)
             VALUES ('Empty Media', '2099-02-02', 10, datetime('now'))`
        );
        const mediaCases = [
            ['poster', 'image/jpeg'],
            ['prereg_banner', 'image/png'],
            ['prereg_bottom_banner', 'image/webp']
        ];
        for (const [type, expectedContentType] of mediaCases) {
            const media = await fetch(`${isolatedOrigin}/api/events/${selectedEventId}/media/${type}`);
            assert.equal(media.status, 200);
            const mediaBody = Buffer.from(await media.arrayBuffer());
            assert.ok(mediaBody.length > 0);
            assert.equal(media.headers.get('content-type'), expectedContentType);
            assert.equal(Number(media.headers.get('content-length')), mediaBody.length);
            assert.equal(media.headers.get('cache-control'), 'public, max-age=300');
            assert.equal(media.headers.get('x-content-type-options'), 'nosniff');
        }
        assert.equal((await fetch(`${isolatedOrigin}/api/events/${selectedEventId}/media/roles_restricted_notes`)).status, 404);
        assert.equal((await fetch(`${isolatedOrigin}/api/events/not-a-number/media/poster`)).status, 404);
        assert.equal((await fetch(`${isolatedOrigin}/api/events/999999/media/poster`)).status, 404);
        assert.equal((await fetch(`${isolatedOrigin}/api/events/${emptyEvent.lastID}/media/poster`)).status, 404);
        assert.equal((await fetch(`${isolatedOrigin}/api/events/${malformedEvent.lastID}/media/poster`)).status, 404);
    });

    await t.test('event share URL renders crawler-visible, event-specific metadata', async () => {
        const response = await fetch(`${isolatedOrigin}/?event=${selectedEventId}`, {
            headers: { 'User-Agent': 'facebookexternalhit/1.1' }
        });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        const html = await response.text();
        const canonical = `https://fogmin.site/?event=${selectedEventId}`;
        const socialPreview = `https://fogmin.site/api/events/${selectedEventId}/social-preview.png`;
        assert.match(html, /property="og:title" content="Selected prereg title 1"/);
        assert.match(html, /property="og:description" content="Selected prereg information 1"/);
        assert.ok(html.includes(`property="og:url" content="${canonical}"`));
        assert.ok(html.includes(`property="og:image" content="${socialPreview}"`));
        assert.match(html, /property="og:image:width" content="1200"/);
        assert.match(html, /property="og:image:height" content="630"/);
        assert.match(html, /property="og:image:type" content="image\/png"/);
        assert.match(html, /name="twitter:card" content="summary_large_image"/);
        assert.ok(html.includes(`name="twitter:image" content="${socialPreview}"`));
        assert.equal(html.includes('Restricted note 1'), false);

        const previewResponse = await fetch(`${isolatedOrigin}/api/events/${selectedEventId}/social-preview.png`);
        assert.equal(previewResponse.status, 200);
        assert.equal(previewResponse.headers.get('content-type'), 'image/png');
        assert.match(previewResponse.headers.get('cache-control'), /public, max-age=300/);
        assert.equal(previewResponse.headers.get('x-content-type-options'), 'nosniff');
        const preview = Buffer.from(await previewResponse.arrayBuffer());
        const previewMetadata = await sharp(preview).metadata();
        assert.equal(previewMetadata.width, 1200);
        assert.equal(previewMetadata.height, 630);
        assert.equal(previewMetadata.format, 'png');

        const { data: previewPixels, info } = await sharp(preview)
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        const pixelAt = (x, y) => {
            const offset = (y * info.width + x) * info.channels;
            return Array.from(previewPixels.subarray(offset, offset + 3));
        };
        const containedTop = pixelAt(600, 30);
        const containedMiddle = pixelAt(600, 315);
        const containedBottom = pixelAt(600, 600);
        assert.ok(containedTop[0] > containedTop[1] * 3 && containedTop[0] > containedTop[2] * 3,
            'the source poster top remains visible');
        assert.ok(containedMiddle.every(channel => channel > 220), 'the source poster center remains visible');
        assert.ok(containedBottom[2] > containedBottom[0] * 3 && containedBottom[2] > containedBottom[1] * 2,
            'the source poster bottom remains visible');

        const noPoster = await run(
            database,
            `INSERT INTO events (name, event_date, prereg_info, event_points, created_at)
             VALUES ('No Poster', '2099-03-01', 'Public fallback description', 10, datetime('now'))`
        );
        const invalidPoster = await run(
            database,
            `INSERT INTO events (name, event_date, poster, event_points, created_at)
             VALUES ('Invalid Poster', '2099-03-02', 'data:image/png;base64,aW52YWxpZA==', 10, datetime('now'))`
        );
        for (const eventId of [noPoster.lastID, invalidPoster.lastID]) {
            const fallbackResponse = await fetch(`${isolatedOrigin}/api/events/${eventId}/social-preview.png`);
            assert.equal(fallbackResponse.status, 200);
            assert.equal(fallbackResponse.headers.get('content-type'), 'image/png');
            const fallbackMetadata = await sharp(Buffer.from(await fallbackResponse.arrayBuffer())).metadata();
            assert.equal(fallbackMetadata.width, 1200);
            assert.equal(fallbackMetadata.height, 630);
        }
        assert.equal((await fetch(`${isolatedOrigin}/api/events/not-a-number/social-preview.png`)).status, 404);
        assert.equal((await fetch(`${isolatedOrigin}/api/events/999999/social-preview.png`)).status, 404);
    });
});

test('event frontend consumes list references, selected detail, and deduplicates list loads', async () => {
    const appSource = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');
    const preregisterSource = await fsp.readFile(path.join(repositoryRoot, 'public', 'preregister.js'), 'utf8');
    const serviceWorkerSource = await fsp.readFile(path.join(repositoryRoot, 'public', 'sw.js'), 'utf8');
    const indexSource = await fsp.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
    assert.ok(/e\.poster_url \? `<img[^`]+loading="lazy"/.test(appSource), 'grid lazy-loads poster_url');
    assert.ok(/fetch\(`\/api\/events\/\$\{eventId\}`\)/.test(appSource), 'selected detail is fetched');
    assert.ok(appSource.includes('event.prereg_banner_url'), 'prereg banner uses its media URL');
    assert.ok(appSource.includes('event.prereg_bottom_banner_url'), 'bottom banner uses its media URL');
    assert.equal(appSource.includes('const imageResponse = await fetch(imageUrl)'), false, 'sharing does not delay native share for media');
    assert.ok(preregisterSource.includes('event.poster_url'), 'standalone prereg page uses poster_url');
    assert.equal(/event\.poster\b/.test(preregisterSource), false, 'standalone prereg page does not use embedded media');
    assert.ok(serviceWorkerSource.includes("const CACHE_NAME = 'fog-portal-v11';"), 'new app asset has a fresh shell cache');
    assert.ok(serviceWorkerSource.includes("if (request.method !== 'GET') return;"), 'service worker still bypasses mutations');
    assert.ok(serviceWorkerSource.includes("url.pathname.startsWith('/api/')"), 'service worker still bypasses API reads');
    assert.ok(serviceWorkerSource.includes("'/js/app.js?v=12.7'"), 'service worker caches the coordinated app version');
    assert.ok(serviceWorkerSource.includes("'/js/v10-expansion.js?v=12.3'"), 'service worker caches the Arcade fix');
    assert.ok(indexSource.includes('<script src="/js/app.js?v=12.7"></script>'), 'index serves the coordinated app version');
    assert.ok(indexSource.includes('<script src="/js/v10-expansion.js?v=12.3"></script>'), 'index serves the coordinated Arcade version');
    assert.equal(appSource.includes("localStorage.setItem('fog_events_cache'"), false, 'legacy full-event cache is retired');

    const loaderStart = appSource.indexOf('let eventsRequestInFlight = null;');
    const loaderEnd = appSource.indexOf('// V59: WEEKLY LIFE POINTS OVERRIDE', loaderStart);
    assert.ok(loaderStart >= 0 && loaderEnd > loaderStart);
    const loaderSource = appSource.slice(loaderStart, loaderEnd);
    const offlineSnapshots = [];
    const removedKeys = [];
    let fetchCalls = 0;
    let pendingResolve;
    const context = vm.createContext({
        console: { error() {} },
        currentMember: null,
        eventViewMode: 'list',
        eventsData: [],
        document: { getElementById() { return null; } },
        removeLocalStorageItem(key) { removedKeys.push(key); },
        fetch() {
            fetchCalls += 1;
            if (fetchCalls === 1) {
                return new Promise(resolve => { pendingResolve = resolve; });
            }
            if (fetchCalls === 2) return Promise.reject(new Error('disposable failure'));
            return Promise.resolve({
                ok: true,
                json: async () => [{ id: 1, name: 'Retry Event', event_date: '2099-01-01', time_start: '09:00', venue: 'Retry Venue' }]
            });
        },
        window: {
            getUpcomingEvents(events) { return events; },
            KoinoniaOfflineData: {
                savePublicContent(key, value) { offlineSnapshots.push({ key, value }); },
                saveDashboardSnapshot() {}
            }
        }
    });
    vm.runInContext(loaderSource, context);

    const first = context.window.loadEvents();
    const duplicate = context.window.loadEvents();
    assert.strictEqual(duplicate, first);
    assert.equal(fetchCalls, 1);
    pendingResolve({
        ok: true,
        json: async () => [{ id: 1, name: 'Event', event_date: '2099-01-01', time_start: '09:00', venue: 'Venue', poster_url: '/media' }]
    });
    await first;
    assert.equal(JSON.stringify(offlineSnapshots[0]), JSON.stringify({
        key: 'events_list',
        value: [{ id: 1, name: 'Event', event_date: '2099-01-01', time_start: '09:00', venue: 'Venue' }]
    }));
    assert.deepEqual(removedKeys, ['fog_events_cache']);

    assert.equal(await context.window.loadEvents(), null);
    assert.equal(fetchCalls, 2);
    const retry = await context.window.loadEvents();
    assert.equal(fetchCalls, 3);
    assert.equal(retry.length, 1);
});
