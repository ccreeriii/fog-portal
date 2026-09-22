'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const repositoryRoot = path.resolve(__dirname, '..');

function sourceBetween(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(endMarker, start);
    assert.ok(start >= 0, `missing start marker: ${startMarker}`);
    assert.ok(end > start, `missing end marker: ${endMarker}`);
    return source.slice(start, end);
}

test('normal members see upcoming Manila events and planners retain management actions', async () => {
    const appSource = await fs.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');
    const helperSource = sourceBetween(
        appSource,
        '// === P9 PHASE C EVENT EXPERIENCE HELPERS ===',
        '// === END P9 PHASE C EVENT EXPERIENCE HELPERS ==='
    );
    const permissions = new Set();
    const context = vm.createContext({
        console,
        window: { hasPerm(permission) { return permissions.has(permission); } }
    });
    vm.runInContext(helperSource, context);

    const events = [
        { id: 1, name: 'Past', event_date: '2026-09-08', time_start: '08:00' },
        { id: 4, name: 'Later future', event_date: '2026-09-10', time_start: '17:00' },
        { id: 3, name: 'Earlier future', event_date: '2026-09-10', time_start: '08:00', preregistration_available: false },
        { id: 2, name: 'Today', event_date: '2026-09-09', time_start: '20:00', preregistration_available: true }
    ];
    const justAfterManilaMidnight = new Date('2026-09-08T16:30:00.000Z');
    assert.equal(context.window.getManilaDateKey(justAfterManilaMidnight), '2026-09-09');
    assert.deepEqual(
        Array.from(context.window.getVisibleEventsForCurrentUser(events, justAfterManilaMidnight), event => event.id),
        [2, 3, 4]
    );

    const memberCapabilities = context.window.getEventViewerCapabilities();
    const memberActions = context.window.renderEventActionButtons(events[3], memberCapabilities);
    assert.match(memberActions, /href="\/\?event=2"/);
    assert.match(memberActions, /window\.launchPublicPrereg\(2\)/);
    assert.equal(memberActions.includes('Details'), false);
    assert.equal(memberActions.includes('Edit'), false);
    assert.equal(memberActions.includes('Form'), false);
    assert.equal(memberActions.includes('Del'), false);
    const unavailableActions = context.window.renderEventActionButtons(events[2], memberCapabilities);
    assert.equal(unavailableActions.includes('Pre-register'), false);
    assert.equal(unavailableActions.includes('launchPublicPrereg'), false);

    permissions.add('access_events');
    permissions.add('add_entries');
    permissions.add('edit_entries');
    permissions.add('delete_entries');
    const plannerCapabilities = context.window.getEventViewerCapabilities();
    assert.equal(plannerCapabilities.canCreate, true);
    assert.deepEqual(
        Array.from(context.window.getVisibleEventsForCurrentUser(events, justAfterManilaMidnight), event => event.id),
        [1, 4, 3, 2]
    );
    const plannerActions = context.window.renderEventActionButtons(events[3], plannerCapabilities);
    assert.match(plannerActions, /Details/);
    assert.match(plannerActions, /Form/);
    assert.match(plannerActions, /Edit/);
    assert.match(plannerActions, /Del/);
    assert.equal(plannerActions.includes('Pre-register'), false);
});

test('preregistration hero starts promptly and falls back from banner to poster', async () => {
    const appSource = await fs.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8');
    const heroSource = sourceBetween(appSource, 'window.loadPreregHeroMedia = function(event) {', 'window.launchPublicPrereg = async function(eventId) {');
    const banner = {
        style: {},
        removeAttribute(name) { if (name === 'src') delete this.src; }
    };
    const status = { style: {}, innerText: '' };
    const context = vm.createContext({
        document: {
            getElementById(id) {
                if (id === 'preregPublicBanner') return banner;
                if (id === 'preregPublicMediaStatus') return status;
                return null;
            }
        },
        window: {}
    });
    vm.runInContext(heroSource, context);

    context.window.loadPreregHeroMedia({ prereg_banner_url: '/banner', poster_url: '/poster' });
    assert.equal(banner.loading, 'eager');
    assert.equal(banner.fetchPriority, 'high');
    assert.equal(banner.decoding, 'async');
    assert.equal(banner.src, '/banner');
    assert.equal(banner.style.display, 'block');
    banner.onerror();
    assert.equal(banner.src, '/poster');
    banner.onload();
    assert.equal(status.style.display, 'none');

    context.window.loadPreregHeroMedia({ prereg_banner_url: '/bad-banner', poster_url: '/bad-poster' });
    banner.onerror();
    banner.onerror();
    assert.equal(banner.style.display, 'none');
    assert.match(status.innerText, /Registration is still open/);

    const preregStart = appSource.indexOf('window.launchPublicPrereg = async function(eventId) {');
    const preregEnd = appSource.indexOf('window.closePublicPrereg = function()', preregStart);
    const preregSource = appSource.slice(preregStart, preregEnd);
    assert.ok(preregSource.indexOf('const preregIdsPromise') < preregSource.indexOf('const eventRes = await fetch'));
    assert.ok(preregSource.indexOf('window.loadPreregHeroMedia(event)') < preregSource.indexOf('currentPreRegYouthIds = await preregIdsPromise'));
});

test('preregistration settings expose, preview, save, and report both banner fields', async () => {
    const [appSource, indexSource] = await Promise.all([
        fs.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8'),
        fs.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8')
    ]);
    assert.match(indexSource, /id="preregSetBanner"[^>]+onchange="previewPreregSettingsImage/);
    assert.match(indexSource, /id="preregSetBottomBanner"[^>]+onchange="previewPreregSettingsImage/);
    assert.ok(indexSource.includes('id="preregSetBannerPreview"'));
    assert.ok(indexSource.includes('id="preregSetBottomBannerPreview"'));
    assert.equal((indexSource.match(/id="preregPublicBottomBanner"/g) || []).length, 1);

    const settingsSource = sourceBetween(
        appSource,
        'window.setPreregSettingsFeedback = function(message, isError = false) {',
        'window.openPublicPreregFromSettings = async function() {'
    );
    const makeImage = () => ({
        style: {}, src: '',
        removeAttribute(name) { if (name === 'src') this.src = ''; }
    });
    const elements = {
        preregSettingsFeedback: { style: {}, innerText: '' },
        preregSetEventId: { value: '' },
        preregSetTitle: { value: '' },
        preregSetInfo: { value: '' },
        preregSetBanner: { value: '', files: [{ name: 'top' }] },
        preregSetBottomBanner: { value: '', files: [{ name: 'bottom' }] },
        preregSetBannerPreview: makeImage(),
        preregSetBottomBannerPreview: makeImage(),
        preregSetBannerStatus: { innerText: '' },
        preregSetBottomBannerStatus: { innerText: '' },
        preregSettingsModal: { classList: { add() {}, remove() {} } }
    };
    const alerts = [];
    const requests = [];
    let pendingAction;
    let loadEventsCalls = 0;
    let closeCalls = 0;
    let nextResponse = { ok: true, status: 200, json: async () => ({ success: true, updated: 1 }) };
    const context = vm.createContext({
        console: { error() {} },
        currentUser: 'P9-EDITOR',
        eventsData: [],
        FileReader: function() {},
        alert(message) { alerts.push(message); },
        document: { getElementById(id) { return elements[id] || null; } },
        fetch: async (url, options) => {
            requests.push({ url, options });
            return nextResponse;
        },
        window: {
            getBase64: async file => `data:image/jpeg;base64,${file.name}`,
            triggerActionConfirmation(summary, action) { pendingAction = action; },
            closePreregSettingsModal() { closeCalls += 1; },
            async loadEvents() { loadEventsCalls += 1; }
        }
    });
    vm.runInContext(settingsSource, context);
    context.window.closePreregSettingsModal = () => { closeCalls += 1; };

    context.window.populatePreregSettingsEditor({
        id: 42,
        name: 'Event',
        prereg_title: 'Configured title',
        prereg_info: 'Configured information',
        prereg_banner_url: '/api/events/42/media/prereg_banner',
        prereg_bottom_banner_url: '/api/events/42/media/prereg_bottom_banner'
    });
    assert.equal(elements.preregSetEventId.value, 42);
    assert.equal(elements.preregSetBannerPreview.src, '/api/events/42/media/prereg_banner');
    assert.equal(elements.preregSetBottomBannerPreview.src, '/api/events/42/media/prereg_bottom_banner');

    await context.window.savePreregSettings({ preventDefault() {} });
    assert.equal(typeof pendingAction, 'function');
    assert.equal(await pendingAction(), true);
    const payload = JSON.parse(requests[0].options.body);
    assert.equal(requests[0].url, '/api/events/42/prereg-settings');
    assert.equal(payload.banner, 'data:image/jpeg;base64,top');
    assert.equal(payload.bottom_banner, 'data:image/jpeg;base64,bottom');
    assert.ok(alerts.includes('Settings saved successfully!'));
    assert.equal(elements.preregSettingsFeedback.innerText, 'Settings saved successfully.');
    assert.equal(closeCalls, 1);
    assert.equal(loadEventsCalls, 1);

    elements.preregSetBanner.files = [];
    elements.preregSetBottomBanner.files = [];
    nextResponse = { ok: false, status: 500, json: async () => ({ error: 'Rejected' }) };
    await context.window.savePreregSettings({ preventDefault() {} });
    assert.equal(await pendingAction(), false);
    const retryPayload = JSON.parse(requests[1].options.body);
    assert.equal(Object.hasOwn(retryPayload, 'banner'), false);
    assert.equal(Object.hasOwn(retryPayload, 'bottom_banner'), false);
    assert.equal(elements.preregSettingsFeedback.innerText, 'Unable to save settings. Please try again.');
    assert.ok(alerts.includes('Unable to save settings. Please try again.'));

    const laterOverride = appSource.lastIndexOf('window.openPreregSettings = async function(eventId) {');
    assert.ok(laterOverride > 0);
    assert.ok(appSource.slice(laterOverride, laterOverride + 700).includes('window.populatePreregSettingsEditor(event)'));
    const publicStart = appSource.indexOf('window.launchPublicPrereg = async function(eventId) {');
    const publicEnd = appSource.indexOf('window.closePublicPrereg = function()', publicStart);
    const publicSource = appSource.slice(publicStart, publicEnd);
    assert.ok(publicSource.includes('event.prereg_bottom_banner_url'));
    assert.ok(publicSource.includes("bottomBanner.style.display = 'block'"));
});

test('native event sharing preserves user activation and has a copy fallback', async () => {
    const [appSource, indexSource] = await Promise.all([
        fs.readFile(path.join(repositoryRoot, 'public', 'js', 'app.js'), 'utf8'),
        fs.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8')
    ]);
    const preregMarkup = sourceBetween(indexSource, '<div id="preregPublicTab"', '<div id="loginTab"');
    const shareButtons = preregMarkup.match(/<button[^>]+onclick="sharePreRegLink\(\)"[^>]*>[^<]*Share Invite<\/button>/g) || [];
    assert.equal(shareButtons.length, 1, 'one public Share Invite control is rendered');
    assert.ok(preregMarkup.indexOf('id="preregShareInviteButton"') < preregMarkup.indexOf('id="preregStep1"'),
        'Share Invite is visible before registration steps begin');
    const successMarkup = sourceBetween(preregMarkup, '<div id="preregStepSuccess"', '<img id="preregPublicBottomBanner"');
    assert.equal(successMarkup.includes('sharePreRegLink()'), false, 'Share Invite is not success-only');
    assert.equal(shareButtons[0].includes('hasPerm'), false, 'Share Invite has no authorization condition');

    const shareSource = sourceBetween(appSource, 'window.copyPreRegInvite = function(shareText, shareUrl) {', 'window.openEditEventModal = function(eventId) {');
    const calls = [];
    const navigator = {
        share(data) {
            calls.push({ type: 'share', data });
            return Promise.resolve();
        },
        clipboard: {
            writeText(value) {
                calls.push({ type: 'copy', value });
                return Promise.resolve();
            }
        }
    };
    const context = vm.createContext({
        alert(message) { calls.push({ type: 'alert', message }); },
        currentPreregEventId: 42,
        document: { getElementById() { return { innerText: 'Community Gathering' }; } },
        navigator,
        Promise,
        encodeURIComponent,
        window: {
            location: { origin: 'https://fogmin.site', href: 'https://fogmin.site/?event=42' },
            prompt() { calls.push({ type: 'prompt' }); }
        }
    });
    vm.runInContext(shareSource, context);

    const nativeResult = context.window.sharePreRegLink();
    assert.equal(calls.length, 1, 'navigator.share is invoked synchronously in the click stack');
    assert.equal(calls[0].type, 'share');
    assert.equal(calls[0].data.url, 'https://fogmin.site/?event=42');
    await nativeResult;
    assert.equal(calls.some(call => call.type === 'copy'), false);

    navigator.share = () => Promise.reject(Object.assign(new Error('unsupported'), { name: 'NotAllowedError' }));
    await context.window.sharePreRegLink();
    assert.equal(calls.filter(call => call.type === 'copy').length, 1);

    delete navigator.share;
    await context.window.sharePreRegLink();
    assert.equal(calls.filter(call => call.type === 'copy').length, 2);
    assert.equal(shareSource.includes('fetch('), false, 'share flow performs no pre-share asynchronous fetch');
});

test('Arcade Games restores its nested grid after game and leaderboard navigation', async () => {
    const expansionSource = await fs.readFile(path.join(repositoryRoot, 'public', 'js', 'v10-expansion.js'), 'utf8');
    const overrideSource = sourceBetween(
        expansionSource,
        'window.V8Arcade = Object.assign(window.V8Arcade || {}, {',
        "document.addEventListener('DOMContentLoaded'"
    );
    const elements = Object.fromEntries([
        'arcadeGamesList', 'arcadeLeaderboardView', 'btnArcadeGames', 'btnArcadeLeaderboard',
        'arcadeActiveGameArea', 'arcadeGridItems', 'featuredArcadeGameContainer',
        'arcadeLeaderboardContainer'
    ].map(id => [id, {
        id,
        style: {},
        innerHTML: '',
        innerText: '',
        classList: { toggle() {} }
    }]));
    const context = vm.createContext({
        currentMember: null,
        document: { getElementById(id) { return elements[id] || null; } },
        fetch: async () => ({ ok: true, json: async () => [] }),
        window: { V8Arcade: {} }
    });
    vm.runInContext(overrideSource, context);

    elements.arcadeGridItems.style.display = 'none';
    elements.featuredArcadeGameContainer.style.display = 'none';
    elements.arcadeActiveGameArea.style.display = 'block';
    elements.arcadeActiveGameArea.innerHTML = '<div>Pre-game</div>';
    context.window.V8Arcade.switchTab('leaderboard');
    assert.equal(elements.arcadeGamesList.style.display, 'none');
    assert.equal(elements.arcadeLeaderboardView.style.display, 'block');
    context.window.V8Arcade.switchTab('games');
    assert.equal(elements.arcadeGamesList.style.display, 'block');
    assert.equal(elements.arcadeLeaderboardView.style.display, 'none');
    assert.equal(elements.arcadeGridItems.style.display, 'grid');
    assert.equal(elements.featuredArcadeGameContainer.style.display, 'block');
    assert.equal(elements.arcadeActiveGameArea.style.display, 'none');
    assert.equal(elements.arcadeActiveGameArea.innerHTML, '');

    context.window.V8Arcade.switchTab('leaderboard');
    context.window.V8Arcade.switchTab('games');
    assert.equal(elements.arcadeGridItems.style.display, 'grid');
    assert.equal(overrideSource.includes('addEventListener'), false);
});
