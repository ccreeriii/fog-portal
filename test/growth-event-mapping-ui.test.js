'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const createGrowthEventMappingUI = require('../public/js/growth-event-mapping-ui');

const rootPath = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(rootPath, 'public/js/growth-event-mapping-ui.js'), 'utf8');
const index = fs.readFileSync(path.join(rootPath, 'public/index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(rootPath, 'public/sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(rootPath, 'public/js/app.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(rootPath, 'server.js'), 'utf8');

class FakeTextNode {
    constructor(value) {
        this.textContent = String(value);
        this.parentNode = null;
        this.children = [];
    }
}

class FakeElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName).toUpperCase();
        this.id = id;
        this.children = [];
        this.parentNode = null;
        this.dataset = {};
        this.style = {};
        this.attributes = {};
        this.listeners = {};
        this.textContent = '';
        this.value = '';
        this.checked = false;
        this.disabled = false;
        this.type = '';
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

    addEventListener(name, listener) {
        this.listeners[name] = listener;
    }

    querySelectorAll(selector) {
        return findAll(this, selector);
    }
}

function matches(element, selector) {
    if (!(element instanceof FakeElement)) return false;
    if (selector === '[data-growth-mutation-control]') {
        return Object.hasOwn(element.dataset, 'growthMutationControl');
    }
    if (selector === '[data-growth-task-id]:checked') {
        return Object.hasOwn(element.dataset, 'growthTaskId') && element.checked;
    }
    return false;
}

function findAll(parent, selector) {
    const matchesFound = [];
    for (const child of parent.children) {
        if (matches(child, selector)) matchesFound.push(child);
        matchesFound.push(...findAll(child, selector));
    }
    return matchesFound;
}

function renderedText(node) {
    return [node.textContent, ...node.children.map(renderedText)].filter(Boolean).join(' ');
}

function response(body, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    };
}

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

const elementIds = [
    'growthEventMappingModal',
    'growthEventMappingTitle',
    'growthEventMappingStatus',
    'growthEventMappingContent',
    'growthEventContributionSummary',
    'growthEventSeriesSelect',
    'growthEventEffectiveMappings',
    'growthEventTaskSelect',
    'growthEventSelectedTaskMetadata',
    'addGrowthEventDirectMappingButton',
    'growthEventDirectMappings',
    'growthSeriesManagerToggle',
    'growthSeriesManager',
    'growthSeriesManagerSelect',
    'growthSeriesId',
    'growthSeriesName',
    'growthSeriesKey',
    'growthSeriesDescription',
    'growthSeriesAudience',
    'growthSeriesActive',
    'growthSeriesTaskList',
    'growthEventEditSection',
    'growthEventEditAccessMessage',
    'growthEventMappingEditorButton',
    'editEvtId'
];

function createHarness(fetchImplementation, permissions = ['access_events', 'edit_entries']) {
    const elements = Object.fromEntries(elementIds.map(id => [id, new FakeElement('div', id)]));
    elements.growthEventMappingModal.classList.add('modal');
    for (const id of ['growthEventSeriesSelect', 'growthEventTaskSelect', 'growthSeriesManagerSelect']) {
        elements[id].tagName = 'SELECT';
    }
    const document = {
        getElementById: id => elements[id] || null,
        createElement: tagName => new FakeElement(tagName),
        createTextNode: value => new FakeTextNode(value)
    };
    const root = {
        document,
        fetch: fetchImplementation,
        hasPerm: permission => permissions.includes(permission),
        eventsData: [
            { id: 10, name: 'Leadership Night' },
            { id: 11, name: 'Discipleship Gathering' }
        ],
        applyGranularPermissions() {}
    };
    const ui = createGrowthEventMappingUI(root);
    ui.install();
    return { root, ui, elements };
}

const tasks = [
    {
        id: 101,
        task_key: 'encounter-alpha',
        title: '<Alpha Participation>',
        evidence_type: 'event_attendance',
        audience: 'all',
        phase_key: 'encounter',
        phase_title: 'Encounter',
        classification: 'essential',
        journey_segment: 'membership'
    },
    {
        id: 102,
        task_key: 'belong-service',
        title: 'Serve Together',
        evidence_type: 'event_attendance',
        audience: 'youth',
        phase_key: 'belong',
        phase_title: 'Belong',
        classification: 'growth',
        journey_segment: 'membership'
    },
    {
        id: 103,
        task_key: 'form-mission',
        title: 'Mission Formation',
        evidence_type: 'event_attendance',
        audience: 'all',
        phase_key: 'become',
        phase_title: 'Become',
        classification: 'enrichment',
        journey_segment: 'servant'
    }
];

const series = [{ id: 41, series_key: 'alpha-series', name: '<Alpha Series>', is_active: 1 }];
const inherited = {
    id: 401,
    task_id: 101,
    task_key: 'encounter-alpha',
    task_title: '<Alpha Participation>',
    task_evidence_type: 'event_attendance',
    evidence_mode: 'attendance',
    phase_key: 'encounter',
    phase_title: 'Encounter',
    classification: 'essential',
    journey_segment: 'membership',
    series_name: '<Alpha Series>',
    source_type: 'series',
    is_active: 1
};
const direct = {
    id: 501,
    task_id: 102,
    task_key: 'belong-service',
    task_title: 'Serve Together',
    task_evidence_type: 'event_attendance',
    evidence_mode: 'attendance',
    phase_key: 'belong',
    phase_title: 'Belong',
    classification: 'growth',
    journey_segment: 'membership',
    source_type: 'event',
    is_active: 1
};

function standardFetch(calls, overrides = {}) {
    return async (url, options = {}) => {
        calls.push({ url, options });
        if (overrides[url]) return overrides[url](options);
        if (url === '/api/admin/growth/event-series') return response(series);
        if (url === '/api/admin/growth/tasks') return response(tasks);
        if (/\/series$/.test(url)) return response({ series: series[0], assignments: [series[0]] });
        if (/\/mappings$/.test(url)) {
            return response({ direct_mappings: [direct], effective_mappings: [inherited, direct, direct] });
        }
        if (url === '/api/admin/growth/event-mappings') return response({ id: 601 }, 201);
        if (/\/api\/admin\/growth\/event-mappings\/\d+$/.test(url)) return response({ deleted: 1 });
        throw new Error(`Unexpected request ${url}`);
    };
}

test('Event Create/Edit expose the launch-ready mapping entry points and preserve event forms', () => {
    assert.match(index, /<form id="createEventForm"[^>]*onsubmit="handleCreateEvent\(event\)"/);
    assert.match(index, /Save this event first to configure Growth Journey mappings\./);
    assert.match(index, /id="editEventForm"[^>]*submitEditEvent/);
    assert.match(index, /id="growthEventEditSection"/);
    assert.match(index, /id="growthEventMappingEditorButton"/);
    assert.match(index, /Growth Journey Mapping/);
    assert.match(appSource, /openPreregSettings\(\$\{eventId\}\)/);
    assert.match(appSource, /openEditEventModal\(\$\{eventId\}\)/);
});

test('effective mappings render canonical metadata, source, and one card per task using safe DOM', async () => {
    const calls = [];
    const { ui, elements } = createHarness(standardFetch(calls));
    await ui.openGrowthEventMapping(10);

    const effectiveText = renderedText(elements.growthEventEffectiveMappings);
    assert.match(effectiveText, /<Alpha Participation>/);
    assert.match(effectiveText, /Encounter/);
    assert.match(effectiveText, /essential/);
    assert.match(effectiveText, /Inherited from Event Series/);
    assert.match(effectiveText, /<Alpha Series>/);
    assert.match(effectiveText, /Direct Event Mapping/);
    assert.equal(elements.growthEventEffectiveMappings.children.length, 2);
    assert.match(elements.growthEventContributionSummary.textContent, /2 Growth tasks/);
    assert.doesNotMatch(source, /\.innerHTML|insertAdjacentHTML|document\.write/);
});

test('selected active task exposes read-only canonical Phase and Requirement metadata', async () => {
    const calls = [];
    const { ui, elements } = createHarness(standardFetch(calls));
    await ui.openGrowthEventMapping(10);
    elements.growthEventTaskSelect.value = '103';
    ui.renderSelectedTaskMetadata();

    const metadata = renderedText(elements.growthEventSelectedTaskMetadata);
    assert.match(metadata, /Phase:\s+Become/);
    assert.match(metadata, /Requirement:\s+enrichment/);
    assert.match(metadata, /Evidence type:\s+event_attendance/);
    assert.doesNotMatch(index, /id="growthEventPhaseSelect"|id="growthEventPhaseInput"/);
});

test('direct mapping add uses only the canonical mapping API and suppresses repeats', async () => {
    const calls = [];
    const { ui, elements } = createHarness(standardFetch(calls));
    await ui.openGrowthEventMapping(10);
    elements.growthEventTaskSelect.value = '103';

    const first = ui.addDirectMapping();
    const repeated = ui.addDirectMapping();
    await Promise.all([first, repeated]);
    const posts = calls.filter(call => call.url === '/api/admin/growth/event-mappings' && call.options.method === 'POST');
    assert.equal(posts.length, 1);
    assert.deepEqual(JSON.parse(posts[0].options.body), {
        event_id: 10,
        task_id: 103,
        evidence_mode: 'attendance',
        formation_area: 'mission'
    });
    assert.doesNotMatch(posts[0].options.body, /actor|permission|admin|youth/i);
    assert.equal(calls.some(call => /evidence/i.test(call.url)), false);
});

test('direct mapping removal uses canonical DELETE and inherited mappings have no remove action', async () => {
    const calls = [];
    const { ui, elements } = createHarness(standardFetch(calls));
    await ui.openGrowthEventMapping(10);
    await ui.removeDirectMapping(501);

    assert.equal(calls.some(call =>
        call.url === '/api/admin/growth/event-mappings/501' && call.options.method === 'DELETE'), true);
    assert.equal(elements.growthEventEffectiveMappings.children[0].querySelectorAll('[data-growth-mutation-control]').length, 0);
});

test('existing Event Series assignment is saved through the accepted event-series endpoint', async () => {
    const calls = [];
    const { ui, elements } = createHarness(standardFetch(calls));
    await ui.openGrowthEventMapping(10);
    elements.growthEventSeriesSelect.value = '41';
    await ui.saveEventSeriesAssignment();

    const update = calls.find(call =>
        call.url === '/api/admin/growth/events/10/series' && call.options.method === 'PUT');
    assert.ok(update);
    assert.deepEqual(JSON.parse(update.options.body), { series_id: 41 });
});

test('the latest event selection wins when an earlier mapping response finishes late', async () => {
    const pending = Array.from({ length: 8 }, deferred);
    let callIndex = 0;
    const { ui, elements } = createHarness(() => pending[callIndex++].promise);
    const eventA = ui.openGrowthEventMapping(10);
    const eventB = ui.openGrowthEventMapping(11);

    const eventBResults = [
        response(series),
        response(tasks),
        response({ series: null, assignments: [] }),
        response({ direct_mappings: [], effective_mappings: [{ ...direct, task_title: 'Member B Event Task' }] })
    ];
    eventBResults.forEach((result, index) => pending[index + 4].resolve(result));
    await eventB;
    const eventAResults = [
        response(series),
        response(tasks),
        response({ series: series[0], assignments: [series[0]] }),
        response({ direct_mappings: [direct], effective_mappings: [{ ...inherited, task_title: 'Stale Event A Task' }] })
    ];
    eventAResults.forEach((result, index) => pending[index].resolve(result));
    await eventA;

    assert.equal(ui._state.eventId, 11);
    assert.match(renderedText(elements.growthEventEffectiveMappings), /Member B Event Task/);
    assert.doesNotMatch(renderedText(elements.growthEventEffectiveMappings), /Stale Event A Task/);
    assert.equal(elements.growthEventMappingTitle.textContent, 'Discipleship Gathering');
});

test('frontend permission visibility is conservative and direct invocation cannot issue requests', async () => {
    let fetchCount = 0;
    const { ui, elements } = createHarness(async () => {
        fetchCount += 1;
        return response({});
    }, ['access_events']);
    ui.updateEntryPoints();
    await ui.openGrowthEventMapping(10);
    await ui.addDirectMapping();

    assert.equal(fetchCount, 0);
    assert.equal(elements.growthEventMappingEditorButton.style.display, 'none');
    assert.equal(elements.growthSeriesManagerToggle.style.display, 'none');
    assert.match(elements.growthEventMappingStatus.textContent, /do not have permission/);
    assert.match(serverSource, /requireAllPermissions\(\['access_events', 'edit_entries'\]\)/);
});

test('canonical 401/403 responses become a safe permission message', async () => {
    const calls = [];
    const fetchImplementation = standardFetch(calls, {
        '/api/admin/growth/tasks': () => response({ error: 'internal authorization detail' }, 403)
    });
    const { ui, elements } = createHarness(fetchImplementation);
    await ui.openGrowthEventMapping(10);

    assert.equal(ui._state.eventId, null);
    assert.match(elements.growthEventMappingStatus.textContent, /do not have permission/);
    assert.doesNotMatch(elements.growthEventMappingStatus.textContent, /internal authorization detail/);
});

test('no active Growth tasks produces an explicit empty selection state', async () => {
    const calls = [];
    const fetchImplementation = standardFetch(calls, {
        '/api/admin/growth/tasks': () => response([])
    });
    const { ui, elements } = createHarness(fetchImplementation);
    await ui.openGrowthEventMapping(10);

    assert.match(renderedText(elements.growthEventTaskSelect), /No active Growth tasks available/);
    assert.match(renderedText(elements.growthEventSelectedTaskMetadata), /No active Growth tasks are available/);
    assert.equal(elements.addGrowthEventDirectMappingButton.disabled, true);
});

test('API failures clear event state and display a safe non-sensitive error', async () => {
    const calls = [];
    const fetchImplementation = standardFetch(calls, {
        '/api/admin/growth/tasks': () => response({ error: 'Unable to load Growth tasks.' }, 500)
    });
    const { ui, elements } = createHarness(fetchImplementation);
    await ui.openGrowthEventMapping(10);

    assert.equal(ui._state.eventId, null);
    assert.match(elements.growthEventMappingStatus.textContent, /Unable to load Growth tasks/);
    assert.match(elements.growthEventContributionSummary.textContent, /unavailable/);
    assert.doesNotMatch(renderedText(elements.growthEventEffectiveMappings), /Alpha Participation|Serve Together/);
});

test('UI introduces neither event-name inference nor direct Growth Evidence creation', () => {
    assert.doesNotMatch(source, /event\.name.*task|task.*event\.name/i);
    assert.doesNotMatch(source, /growth[_/-]evidence|advance.*phase|phase.*advance/i);
    assert.match(source, /evidence_mode: 'attendance'/);
    assert.match(source, /\/api\/admin\/growth\/event-mappings/);
});

test('new mapping asset is loaded after app.js and cached under a fresh shell revision', () => {
    assert.ok(index.indexOf('/js/growth-event-mapping-ui.js?v=3') > index.indexOf('/js/app.js?v=13.3'));
    assert.match(serviceWorker, /const CACHE_NAME = 'fog-portal-v32'/);
    assert.match(serviceWorker, /'\/js\/growth-event-mapping-ui\.js\?v=3'/);
});
