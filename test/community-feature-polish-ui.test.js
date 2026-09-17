'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootPath = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(rootPath, 'public/js/community-feature-polish.js'), 'utf8');
const index = fs.readFileSync(path.join(rootPath, 'public/index.html'), 'utf8');
const sw = fs.readFileSync(path.join(rootPath, 'public/sw.js'), 'utf8');

class Element {
    constructor(tag = 'div', id = '') {
        this.tagName = tag.toUpperCase();
        this.id = id;
        this.children = [];
        this.attributes = {};
        this.listeners = {};
        this.textContent = '';
        this.hidden = false;
        this.disabled = false;
        this._classes = new Set();
        this.classList = {
            toggle: (name, force) => force ? this._classes.add(name) : this._classes.delete(name),
            contains: name => this._classes.has(name)
        };
    }
    set className(value) { this._classes = new Set(String(value).split(/\s+/).filter(Boolean)); }
    get className() { return [...this._classes].join(' '); }
    appendChild(child) { this.children.push(child); return child; }
    replaceChildren(...children) { this.children = children; this.textContent = ''; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    focus() { this.focused = true; }
    click() { if (this.listeners.click && !this.disabled) this.listeners.click(); }
}

function walk(element) { return [element, ...element.children.flatMap(walk)]; }
function findText(element, text) { return walk(element).find(node => node.textContent === text); }
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
function response(json, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => json };
}
function harness(fetchImplementation = async () => response([])) {
    const ids = [
        'prayerWallTabButton', 'prayerSubmitTabButton', 'prayerWallPanel', 'prayerSubmitPanel',
        'prayerWallContainer', 'myGroupsTabButton', 'discoverGroupsTabButton',
        'myGroupsPanel', 'discoverGroupsPanel', 'smallGroupsContainer',
        'discoverGroupsContainer', 'adminSmallGroupsList'
    ];
    const elements = Object.fromEntries(ids.map(id => [id, new Element('div', id)]));
    const calls = { prayer: [], groups: [], opened: [], joined: [] };
    const discipleship = {
        prayersData: [], groupsData: [],
        intercedePrayer(id) { calls.prayer.push(id); },
        openEditPrayerModal(id) { calls.prayer.push(`edit:${id}`); },
        joinSmallGroup(id) { calls.joined.push(id); },
        openEditSmallGroupModal() {}, deleteSmallGroup() {}
    };
    const root = {
        document: { getElementById: id => elements[id] || null, createElement: tag => new Element(tag) },
        V2Discipleship: discipleship,
        currentMember: { id: 7 }, koinoniaAuthStatus: 'authenticated', isGuestMode: false,
        fetch: fetchImplementation,
        switchGrowthSubTab() {},
        openGroupDashboard(...args) { calls.opened.push(args); },
        hasPerm: () => false
    };
    vm.runInNewContext(source, { window: root, globalThis: root, Date, Promise, console });
    return { root, elements, discipleship, calls };
}

test('shell keeps canonical navigation and existing Events controls while adding compact feature affordances', () => {
    for (const id of ['prayerWallTabButton', 'prayerSubmitTabButton', 'myGroupsTabButton',
        'discoverGroupsTabButton', 'eventsTab', 'journalsContainer']) {
        assert.match(index, new RegExp(`id="${id}"`));
    }
    assert.equal((index.match(/id="prayerForm"/g) || []).length, 1);
    for (const id of ['eventsListContainer', 'viewBtnList', 'viewBtnGrid', 'viewBtnCal',
        'editEventModal', 'growthEventMappingModal']) {
        assert.match(index, new RegExp(`id="${id}"`));
    }
    assert.match(index, /\/css\/community-features\.css\?v=3/);
    assert.match(index, /\/js\/community-feature-polish\.js\?v=7/);
    assert.match(sw, /const CACHE_NAME = 'fog-portal-v56'/);
    assert.match(sw, /'\/css\/community-features\.css\?v=3'/);
    assert.match(sw, /'\/js\/community-feature-polish\.js\?v=7'/);
    assert.doesNotMatch(source, /growth[_/-]evidence|prayerHabit|member_milestones|sendEmail|pushToUser/i);
});

test('Prayer Wall defaults to Wall in List view, renders 10 safe compact rows, and has one canonical fetch', async () => {
    const prayers = Array.from({ length: 12 }, (_, index) => ({
        id: index + 1, title: index ? `Request ${index}` : '<img src=x onerror=alert(1)>',
        request: 'A long prayer request '.repeat(15), is_anonymous: index === 0 ? 1 : 0,
        author_name: 'A Member', prayer_count: 2, is_owner: index === 0 ? 1 : 0
    }));
    let count = 0;
    const { root, elements, discipleship, calls } = harness(async url => {
        assert.equal(url, '/api/prayers'); count += 1; return response(prayers);
    });
    assert.equal(elements.prayerWallPanel.hidden, false);
    assert.equal(elements.prayerSubmitPanel.hidden, true);
    assert.equal(elements.prayerWallTabButton.attributes['aria-selected'], 'true');
    await Promise.all([discipleship.loadPrayers(), discipleship.loadPrayers()]);
    assert.equal(count, 1);
    const prayerRows = () => walk(elements.prayerWallContainer).filter(node =>
        node.tagName === 'ARTICLE' &&
        String(node.className || '').includes('feature-list-row--prayer')
    );
    assert.equal(prayerRows().length, 10);
    assert.ok(findText(elements.prayerWallContainer, '<img src=x onerror=alert(1)>'));
    const firstCard = prayerRows()[0];
    assert.ok(walk(firstCard).some(node => node.textContent.startsWith('Anonymous ·')));
    const expand = findText(firstCard, 'View');
    expand.click();
    assert.equal(findText(firstCard, 'Hide').attributes['aria-expanded'], 'true');
    findText(firstCard, 'Pray for This').click();
    findText(firstCard, 'Edit').click();
    assert.deepEqual(calls.prayer, [1, 'edit:1']);
    await Promise.resolve();
    findText(elements.prayerWallContainer, 'Next').click();
    assert.equal(prayerRows().length, 2);
    elements.prayerSubmitTabButton.click();
    assert.equal(elements.prayerSubmitPanel.hidden, false);
    assert.equal(elements.prayerWallPanel.hidden, true);
    root.switchGrowthSubTab('Prayer');
    assert.equal(elements.prayerWallPanel.hidden, false);
    await discipleship.loadPrayers();
    assert.equal(count, 1);
});

test('Prayer and Groups reject late responses after member switch and render safe failures', async () => {
    const pendingPrayer = deferred();
    const pendingGroups = deferred();
    const { root, elements, discipleship } = harness(url => url === '/api/prayers'
        ? pendingPrayer.promise : pendingGroups.promise);
    const firstPrayer = discipleship.loadPrayers();
    const firstGroups = discipleship.loadSmallGroups();
    assert.ok(findText(elements.prayerWallContainer, 'Loading prayers…'));
    assert.ok(findText(elements.smallGroupsContainer, 'Loading groups…'));
    root.currentMember = { id: 8 };
    pendingPrayer.resolve(response([{ id: 1, title: 'Stale', request: 'Stale' }]));
    pendingGroups.resolve(response([{ id: 1, name: 'Stale Group', user_status: 'Approved' }]));
    await Promise.all([firstPrayer, firstGroups]);
    assert.equal(findText(elements.prayerWallContainer, 'Stale'), undefined);
    assert.equal(findText(elements.smallGroupsContainer, 'Stale Group'), undefined);
    root.isGuestMode = true;
    await discipleship.loadPrayers();
    await discipleship.loadSmallGroups();
    assert.ok(findText(elements.prayerWallContainer, 'Sign in to view the Prayer Wall.'));
    assert.ok(findText(elements.smallGroupsContainer, 'Sign in to view your groups.'));
});

test('Prayer and Groups show intentional empty and error states', async () => {
    const empty = harness(async () => response([]));
    await empty.discipleship.loadPrayers();
    await empty.discipleship.loadSmallGroups();
    assert.ok(findText(empty.elements.prayerWallContainer, 'No prayer requests yet.'));
    assert.ok(findText(empty.elements.smallGroupsContainer, 'You are not in a group yet.'));
    assert.ok(findText(empty.elements.discoverGroupsContainer, 'No groups are available to discover right now.'));
    const failing = harness(async () => response({}, 500));
    await failing.discipleship.loadPrayers();
    await failing.discipleship.loadSmallGroups();
    assert.ok(findText(failing.elements.prayerWallContainer, 'Unable to load prayer requests.'));
    assert.ok(findText(failing.elements.smallGroupsContainer, 'Unable to load groups.'));
    assert.ok(findText(failing.elements.discoverGroupsContainer, 'Unable to load groups.'));
});

test('member transition starts fresh canonical requests instead of reusing prior in-flight work', async () => {
    const oldPrayer = deferred();
    const oldGroups = deferred();
    const calls = [];
    const { root, elements, discipleship } = harness(url => {
        calls.push(url);
        if (url === '/api/prayers') return calls.filter(call => call === url).length === 1
            ? oldPrayer.promise : Promise.resolve(response([{ id: 2, title: 'New prayer', request: 'Current' }]));
        return url.endsWith('=7') ? oldGroups.promise
            : Promise.resolve(response([{ id: 2, name: 'New group', user_status: 'Approved' }]));
    });
    const previous = [discipleship.loadPrayers(), discipleship.loadSmallGroups()];
    root.currentMember = { id: 8 };
    await Promise.all([discipleship.loadPrayers(), discipleship.loadSmallGroups()]);
    oldPrayer.resolve(response([{ id: 1, title: 'Old prayer', request: 'Prior member' }]));
    oldGroups.resolve(response([{ id: 1, name: 'Old group', user_status: 'Approved' }]));
    await Promise.all(previous);
    assert.ok(findText(elements.prayerWallContainer, 'New prayer'));
    assert.ok(findText(elements.smallGroupsContainer, 'New group'));
    assert.equal(findText(elements.prayerWallContainer, 'Old prayer'), undefined);
    assert.equal(findText(elements.smallGroupsContainer, 'Old group'), undefined);
    assert.deepEqual(calls, ['/api/prayers', '/api/small-groups?youth_id=7',
        '/api/prayers', '/api/small-groups?youth_id=8']);
});

test('Groups distinguishes real Approved and Pending membership from discoverable groups', async () => {
    const groups = [
        { id: 1, name: 'My Campfire', user_status: 'Approved', leader_name: 'Leader', leader_id: 9 },
        { id: 2, name: 'Requested Campfire', user_status: 'Pending' },
        { id: 3, name: 'Open Campfire', user_status: null, privacy_level: 'Open' },
        { id: 4, name: 'Private Campfire', user_status: null, privacy_level: 'Invite-Only' },
        { id: 5, name: 'Approval Campfire', user_status: null, privacy_level: 'Approval' }
    ];
    const { root, elements, discipleship, calls } = harness(async url => {
        assert.equal(url, '/api/small-groups?youth_id=7'); return response(groups);
    });
    await discipleship.loadSmallGroups();
    assert.equal(elements.myGroupsPanel.hidden, false);
    assert.equal(elements.discoverGroupsPanel.hidden, true);
    assert.equal(elements.smallGroupsContainer.children.length, 2);
    assert.equal(elements.discoverGroupsContainer.children.length, 2);
    assert.equal(findText(elements.discoverGroupsContainer, 'Private Campfire'), undefined);
    findText(elements.smallGroupsContainer, 'Open Group').click();
    assert.equal(calls.opened[0][0], 1);
    assert.equal(findText(elements.smallGroupsContainer, 'Request Pending').disabled, true);
    elements.discoverGroupsTabButton.click();
    assert.equal(elements.discoverGroupsPanel.hidden, false);
    findText(elements.discoverGroupsContainer, 'Join Group').click();
    findText(elements.discoverGroupsContainer, 'Request to Join').click();
    assert.deepEqual(calls.joined, [3, 5]);
    root.switchGrowthSubTab('Groups');
    assert.equal(elements.myGroupsPanel.hidden, false);
});
