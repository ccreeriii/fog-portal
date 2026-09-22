'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const LeadershipUI = require('../public/js/growth-journey-leadership');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');
const leadershipSource = fs.readFileSync(
    path.join(root, 'public', 'js', 'growth-journey-leadership.js'),
    'utf8'
);

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
        this._classes = new Set();
        this.classList = {
            add: (...names) => names.forEach(name => this._classes.add(name)),
            remove: (...names) => names.forEach(name => this._classes.delete(name)),
            contains: name => this._classes.has(name)
        };
    }

    set className(value) {
        this._classes = new Set(String(value || '').split(/\s+/).filter(Boolean));
    }

    get className() {
        return [...this._classes].join(' ');
    }

    get isConnected() {
        let node = this;
        while (node) {
            if (node._documentRoot) return true;
            node = node.parentNode;
        }
        return false;
    }

    append(...nodes) {
        for (const node of nodes) {
            node.parentNode = this;
            this.children.push(node);
        }
    }

    replaceChildren(...nodes) {
        for (const child of this.children) child.parentNode = null;
        this.children = [];
        this.textContent = '';
        this.append(...nodes);
    }

    remove() {
        if (!this.parentNode) return;
        const index = this.parentNode.children.indexOf(this);
        if (index >= 0) this.parentNode.children.splice(index, 1);
        this.parentNode = null;
    }

    setAttribute(name, value) {
        this.attributes[name] = String(value);
    }

    addEventListener(name, listener) {
        this.listeners[name] = listener;
    }

    querySelector(selector) {
        return findElement(this, selector);
    }
}

function matchesSelector(element, selector) {
    if (selector.startsWith('#')) return element.id === selector.slice(1);
    if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
    return element.tagName === selector.toUpperCase();
}

function findElement(rootElement, selector) {
    for (const child of rootElement.children) {
        if (matchesSelector(child, selector)) return child;
        const nested = findElement(child, selector);
        if (nested) return nested;
    }
    return null;
}

function createFakeDocument(youthId) {
    const modal = new FakeElement('div');
    modal.id = 'viewProfileModal';
    modal._documentRoot = true;
    modal.classList.add('modal', 'active');
    modal.dataset.profileYouthId = String(youthId);

    const content = new FakeElement('div');
    content.classList.add('modal-content');
    modal.append(content);

    return {
        modal,
        content,
        document: {
            createElement: tagName => new FakeElement(tagName),
            getElementById: id => modal.id === id ? modal : findElement(modal, `#${id}`)
        }
    };
}

function response(body, ok = true) {
    return {
        ok,
        json: async () => body
    };
}

function journey(status, essentialCompleted = 0) {
    return {
        currentPhase: {
            phaseKey: 'encounter',
            title: 'Encounter',
            status,
            essentialCompleted,
            essentialTotal: 1
        },
        nextPhase: { phaseKey: 'belong', title: 'Belong' },
        phases: [
            { phaseKey: 'encounter', title: 'Encounter', sequenceState: 'current' },
            { phaseKey: 'belong', title: 'Belong', sequenceState: 'upcoming' }
        ]
    };
}

function renderedText(element) {
    return [element.textContent, ...element.children.map(renderedText)].filter(Boolean).join(' ');
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function installBrowserState(fakeDocument, permissions, fetchImplementation) {
    const originals = {
        document: globalThis.document,
        hasPerm: globalThis.hasPerm,
        fetch: globalThis.fetch,
        confirm: globalThis.confirm
    };
    globalThis.document = fakeDocument;
    globalThis.hasPerm = permission => permissions.includes(permission);
    globalThis.fetch = fetchImplementation;
    globalThis.confirm = () => true;
    return () => {
        LeadershipUI.invalidateLeadershipJourneyReview();
        for (const [name, value] of Object.entries(originals)) {
            if (value === undefined) delete globalThis[name];
            else globalThis[name] = value;
        }
    };
}

test('active Directory profile explicitly binds the selected Youth ID without a leadership monkeypatch', () => {
    const start = appSource.indexOf('// V24: UNIFIED DIRECTORY PROFILE');
    const end = appSource.indexOf('window.switchModalViewTab', start);
    assert.ok(start >= 0 && end > start);
    const activeProfile = appSource.slice(start, end);

    assert.match(appSource, /onclick="openViewProfileModal\(\$\{y\.id\}\)"/);
    assert.match(activeProfile, /const youthId = normalizeDirectoryProfileYouthId\(id\)/);
    assert.match(activeProfile, /modal\.dataset\.profileYouthId = String\(youthId\)/);
    assert.match(activeProfile, /isCurrentDirectoryProfileRequest\(modal, youthId, requestGeneration\)/);
    assert.match(
        activeProfile,
        /GrowthJourneyLeadership\.mountLeadershipJourneyReview\(youthId\)/
    );
    assert.doesNotMatch(leadershipSource, /existingOpenViewProfileModal|root\.openViewProfileModal\s*=/);
});

test('the latest Directory selection wins when an earlier profile load finishes late', async () => {
    const start = appSource.indexOf('let directoryProfileRequestGeneration = 0;');
    const end = appSource.indexOf('window.switchModalViewTab', start);
    assert.ok(start >= 0 && end > start);

    const modal = new FakeElement('div');
    modal.id = 'viewProfileModal';
    modal.classList.add('modal');
    const preloader = new FakeElement('div');
    preloader.id = 'globalPreloader';
    const batches = [
        Array.from({ length: 4 }, deferred),
        Array.from({ length: 4 }, deferred)
    ];
    let fetchIndex = 0;
    const mountedYouthIds = [];
    const context = vm.createContext({
        window: {
            GrowthJourneyLeadership: {
                invalidateLeadershipJourneyReview() {},
                mountLeadershipJourneyReview(youthId) {
                    mountedYouthIds.push(youthId);
                }
            }
        },
        document: {
            body: { style: {} },
            getElementById(id) {
                if (id === 'viewProfileModal') return modal;
                if (id === 'globalPreloader') return preloader;
                return null;
            }
        },
        fetch() {
            const index = fetchIndex++;
            return batches[Math.floor(index / 4)][index % 4].promise;
        },
        emailVerificationBadgeHtml: () => '',
        alert: () => assert.fail('stale Directory loads must not alert'),
        console,
        setTimeout: callback => callback()
    });
    vm.runInContext(appSource.slice(start, end), context);

    const pendingA = context.window.openViewProfileModal(231);
    const pendingB = context.window.openViewProfileModal(232);

    for (const [index, pending] of batches[1].entries()) {
        pending.resolve(response(index === 0
            ? [{ id: 232, name: 'Member B' }]
            : []));
    }
    await pendingB;
    for (const [index, pending] of batches[0].entries()) {
        pending.resolve(response(index === 0
            ? [{ id: 231, name: 'Member A' }]
            : []));
    }
    await pendingA;

    assert.equal(modal.dataset.profileYouthId, '232');
    assert.equal(modal.classList.contains('active'), true);
    assert.match(modal.innerHTML, /Member B/);
    assert.doesNotMatch(modal.innerHTML, /Member A/);
    assert.deepEqual(mountedYouthIds, [232]);
});

test('member selections request and replace the exact bound Journey state', async () => {
    const { document, modal, content } = createFakeDocument(231);
    const requests = [];
    const restore = installBrowserState(
        document,
        ['access_discipleship', 'edit_entries'],
        async url => {
            requests.push(url);
            const youthId = Number(url.split('/').pop());
            return response({
                success: true,
                member: { id: youthId, name: youthId === 231 ? 'B3 Acceptance Test Member' : 'Other Member' },
                journey: youthId === 231 ? journey('ready', 1) : journey('not_started', 0)
            });
        }
    );

    try {
        await LeadershipUI.mountLeadershipJourneyReview(231);
        assert.deepEqual(requests, ['/api/admin/growth-journey/members/231']);
        assert.match(renderedText(content), /Status: Ready/);
        assert.match(renderedText(content), /Essentials: 1 of 1/);
        assert.match(renderedText(content), /Ready for advancement/);
        assert.equal(content.querySelector('button').textContent, 'Advance to Belong');

        modal.dataset.profileYouthId = '232';
        await LeadershipUI.mountLeadershipJourneyReview(232);
        assert.deepEqual(requests, [
            '/api/admin/growth-journey/members/231',
            '/api/admin/growth-journey/members/232'
        ]);
        assert.equal(content.children.length, 1);
        assert.equal(content.children[0].dataset.youthId, '232');
        assert.match(renderedText(content), /Status: Not Started/);
        assert.doesNotMatch(renderedText(content), /Ready for advancement/);
        assert.equal(content.querySelector('button'), null);
    } finally {
        restore();
    }
});

test('a late response for member A cannot render after switching to member B', async () => {
    const { document, modal, content } = createFakeDocument(231);
    const memberA = deferred();
    const memberB = deferred();
    const restore = installBrowserState(
        document,
        ['access_discipleship', 'edit_entries'],
        url => url.endsWith('/231') ? memberA.promise : memberB.promise
    );

    try {
        const pendingA = LeadershipUI.mountLeadershipJourneyReview(231);
        modal.dataset.profileYouthId = '232';
        const pendingB = LeadershipUI.mountLeadershipJourneyReview(232);

        memberB.resolve(response({
            success: true,
            member: { id: 232, name: 'Member B' },
            journey: journey('not_started', 0)
        }));
        await pendingB;
        memberA.resolve(response({
            success: true,
            member: { id: 231, name: 'Member A' },
            journey: journey('ready', 1)
        }));
        await pendingA;

        assert.equal(content.children.length, 1);
        assert.equal(content.children[0].dataset.youthId, '232');
        assert.match(renderedText(content), /Status: Not Started/);
        assert.doesNotMatch(renderedText(content), /Ready for advancement/);
    } finally {
        restore();
    }
});

test('a mismatched response identity fails closed without rendering Journey data', async () => {
    const { document, content } = createFakeDocument(231);
    const restore = installBrowserState(
        document,
        ['access_discipleship', 'edit_entries'],
        async () => response({
            success: true,
            member: { id: 232, name: 'Wrong Member' },
            journey: journey('ready', 1)
        })
    );

    try {
        await LeadershipUI.mountLeadershipJourneyReview(231);
        assert.match(renderedText(content), /could not be verified/);
        assert.doesNotMatch(renderedText(content), /Status: Ready/);
        assert.doesNotMatch(renderedText(content), /Ready for advancement/);
        assert.equal(content.querySelector('button'), null);
    } finally {
        restore();
    }
});

test('review authorization and close invalidation remain fail closed', async () => {
    const noAccess = createFakeDocument(231);
    let fetchCount = 0;
    let restore = installBrowserState(noAccess.document, ['edit_entries'], async () => {
        fetchCount += 1;
        return response({ success: true, member: { id: 231 }, journey: journey('ready', 1) });
    });
    try {
        await LeadershipUI.mountLeadershipJourneyReview(231);
        assert.equal(fetchCount, 0);
        assert.equal(noAccess.content.children.length, 0);
    } finally {
        restore();
    }

    const reviewOnly = createFakeDocument(231);
    const pending = deferred();
    restore = installBrowserState(
        reviewOnly.document,
        ['access_discipleship'],
        () => pending.promise
    );
    try {
        const request = LeadershipUI.mountLeadershipJourneyReview(231);
        LeadershipUI.invalidateLeadershipJourneyReview();
        reviewOnly.modal.classList.remove('active');
        delete reviewOnly.modal.dataset.profileYouthId;
        pending.resolve(response({
            success: true,
            member: { id: 231, name: 'Closed Member' },
            journey: journey('ready', 1)
        }));
        await request;
        assert.equal(reviewOnly.content.children.length, 0);
    } finally {
        restore();
    }
});
