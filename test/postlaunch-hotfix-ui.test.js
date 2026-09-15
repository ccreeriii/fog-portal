'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootPath = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(rootPath, 'public/js/postlaunch-hotfix.js'), 'utf8');
const index = fs.readFileSync(path.join(rootPath, 'public/index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(rootPath, 'public/sw.js'), 'utf8');
const mappingSource = fs.readFileSync(path.join(rootPath, 'public/js/growth-event-mapping-ui.js'), 'utf8');
const journeySource = fs.readFileSync(path.join(rootPath, 'public/js/journey-dashboard.js'), 'utf8');

class FakeElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = tagName.toUpperCase();
        this.id = id;
        this.children = [];
        this.dataset = {};
        this.style = {};
        this.attributes = {};
        this.listeners = {};
        this.textContent = '';
        this.value = '';
        this.hidden = false;
        this._classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => this._classes.add(name)),
            remove: (...names) => names.forEach(name => this._classes.delete(name)),
            contains: name => this._classes.has(name),
            toggle: (name, force) => force ? this._classes.add(name) : this._classes.delete(name)
        };
    }

    set className(value) {
        this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
    }

    get className() {
        return [...this._classes].join(' ');
    }

    append(...nodes) {
        this.children.push(...nodes);
    }

    appendChild(node) {
        this.children.push(node);
        return node;
    }

    replaceChildren(...nodes) {
        this.children = [...nodes];
        this.textContent = '';
    }

    addEventListener(type, listener) {
        this.listeners[type] = listener;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    removeAttribute(name) {
        delete this.attributes[name];
    }
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function response(json, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => json };
}

function createHarness(fetchImplementation = async () => response([])) {
    const ids = [
        'bottomNav', 'eventAnalyticsModal', 'editEventModal', 'growthEventMappingModal',
        'mainContainer', 'membershipAdminTab', 'mainHeader', 'preregPublicTitle', 'preregPublicInfo',
        'preregPublicBottomBanner'
    ];
    const elements = Object.fromEntries(ids.map(id => [id, new FakeElement('div', id)]));
    for (const id of ['eventAnalyticsModal', 'editEventModal', 'growthEventMappingModal']) {
        elements[id].classList.add('modal');
    }
    const document = {
        body: new FakeElement('body', 'body'),
        getElementById: id => elements[id] || null,
        createElement: tag => new FakeElement(tag),
        querySelectorAll(selector) {
            if (selector === '.modal.active') {
                return Object.values(elements).filter(element =>
                    element.classList.contains('modal') && element.classList.contains('active'));
            }
            return [];
        }
    };
    const listeners = {};
    const navigation = [];
    const history = [];
    const root = {
        document,
        fetch: fetchImplementation,
        authReady: Promise.resolve(),
        isGuestMode: false,
        koinoniaAuthStatus: 'unauthenticated',
        location: { href: 'http://isolated.test/', pathname: '/', search: '', hash: '' },
        history: { pushState: (...args) => history.push(args) },
        addEventListener(type, listener, capture = false) {
            (listeners[type] ||= []).push({ listener, capture });
        },
        renderBottomNav() {},
        switchTab: async (tab, subTab) => { navigation.push([tab, subTab]); },
        switchGrowthSubTab() {},
        openSidebar() { navigation.push(['menu']); },
        showPreregStep(step) { navigation.push(['prereg-step', step]); },
        openAnalyticsModal: async () => {
            elements.eventAnalyticsModal.style.display = 'none';
            elements.eventAnalyticsModal.classList.add('active');
        },
        closeAnalyticsModal: () => elements.eventAnalyticsModal.classList.remove('active'),
        openEditEventModal: async () => {
            elements.editEventModal.style.display = 'none';
            elements.editEventModal.classList.add('active');
        },
        closeEditEventModal: () => elements.editEventModal.classList.remove('active')
    };
    vm.runInNewContext(source, { window: root, globalThis: root, URL, Promise, Set, console });
    return { root, document, elements, listeners, navigation, history };
}

test('event modal lifecycle clears stale inline display and backdrop state across reopen cycles', async () => {
    const { root, document, elements, listeners } = createHarness();
    await root.openAnalyticsModal(1);
    assert.equal(elements.eventAnalyticsModal.classList.contains('active'), true);
    assert.equal(elements.eventAnalyticsModal.style.display, '');

    const backdropListener = listeners.click.find(item => item.capture).listener;
    let stopped = false;
    backdropListener({
        target: elements.eventAnalyticsModal,
        preventDefault() {},
        stopImmediatePropagation() { stopped = true; }
    });
    assert.equal(stopped, true);
    assert.equal(elements.eventAnalyticsModal.classList.contains('active'), false);
    assert.equal(elements.eventAnalyticsModal.style.display, '');
    assert.equal(document.body.style.pointerEvents, '');

    await root.openAnalyticsModal(2);
    assert.equal(elements.eventAnalyticsModal.classList.contains('active'), true);
    root.__portalOpenModal(elements.editEventModal);
    root.__portalOpenModal(elements.growthEventMappingModal);
    root.__portalCloseModal(elements.growthEventMappingModal);
    assert.equal(elements.editEventModal.classList.contains('active'), true);
});

test('authenticated bottom navigation has exactly the seven canonical destinations', () => {
    const { root, elements, navigation } = createHarness();
    root.renderBottomNav('eventsTab');
    assert.deepEqual(
        elements.bottomNav.children.map(button => button.children[1].textContent),
        ['Home', 'Growth', 'Prayer', 'Events', 'Journal', 'Groups', 'Menu']
    );
    assert.equal(elements.bottomNav.children.length, 7);
    assert.equal(elements.bottomNav.children.some(button => /Paths|Inbox/.test(button.textContent)), false);
    const events = elements.bottomNav.children.find(button => button.dataset.destination === 'events');
    events.listeners.click();
    assert.deepEqual(navigation.at(-1), ['eventsTab', undefined]);
});

test('pre-registration renders immediately and ignores a stale event response', async () => {
    const pending = Array.from({ length: 6 }, deferred);
    let callIndex = 0;
    const { root, elements, navigation } = createHarness(() => pending[callIndex++].promise);
    const first = root.launchPublicPrereg(10);
    await Promise.resolve();
    assert.equal(elements.preregPublicTitle.textContent, 'Loading event…');
    assert.equal(navigation.some(call => call[0] === 'preregPublicTab'), true);

    const second = root.launchPublicPrereg(11);
    await Promise.resolve();
    pending[3].resolve(response({ id: 11, name: 'Current Event', event_date: '2026-09-20' }));
    pending[4].resolve(response([]));
    pending[5].resolve(response([]));
    await second;
    assert.equal(elements.preregPublicTitle.textContent, 'Current Event');

    pending[0].resolve(response({ id: 10, name: 'Stale Event', event_date: '2026-09-19' }));
    pending[1].resolve(response([]));
    pending[2].resolve(response([]));
    await first;
    assert.equal(elements.preregPublicTitle.textContent, 'Current Event');
});

test('shell retires legacy Paths UI, keeps canonical Journey and preserves Notification Center', () => {
    assert.doesNotMatch(index, /id="growthSubMilestones"|id="pathwaysListContainer"|id="btnSubAdminPathways"|id="subTabAdminPathways"|id="nextStepContainer"/);
    assert.match(index, /id="journeyGrowthCard"/);
    assert.match(journeySource, /Current Stage: \$\{model\.current\.title\}/);
    assert.match(index, /id="headerNotificationBell"/);
    assert.match(source, /subTabName === 'Milestones' \? 'Home'/);
    assert.match(source, /V2Discipleship\.updateMilestone = \(\) => false/);
    assert.doesNotMatch(source, /growth[_/-]evidence|member_milestones|discipleship_pathways/i);
});

test('post-launch asset and dependent revisions are cached coherently and load last', () => {
    const app = index.indexOf('/js/app.js?v=13.3');
    const mapping = index.indexOf('/js/growth-event-mapping-ui.js?v=3');
    const journey = index.indexOf('/js/journey-dashboard.js?v=4');
    const hotfix = index.indexOf('/js/postlaunch-hotfix.js?v=1');
    assert.ok(app < mapping && mapping < journey && journey < hotfix);
    assert.match(serviceWorker, /const CACHE_NAME = 'fog-portal-v26'/);
    for (const asset of [
        '/js/app.js?v=13.3',
        '/js/growth-event-mapping-ui.js?v=3',
        '/js/journey-dashboard.js?v=4',
        '/js/postlaunch-hotfix.js?v=1'
    ]) assert.ok(serviceWorker.includes(`'${asset}'`));
    assert.doesNotMatch(mappingSource, /2147483647|appendChild\(modal\)/);
});
