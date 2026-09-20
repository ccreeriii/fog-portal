'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const LeadershipUI = require('../public/js/growth-journey-leadership');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'public', 'js', 'growth-journey-leadership.js'),
    'utf8'
);
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('leadership Journey control is permission-gated and server-authoritative', () => {
    assert.match(source, /REVIEW_PERMISSION = 'access_discipleship'/);
    assert.match(source, /ADVANCEMENT_PERMISSION = 'edit_entries'/);
    assert.match(source, /if \(!hasReviewPermission\(\)\) return/);
    assert.match(source, /hasAdvancementPermission\(\)/);
    assert.match(source, /currentPhase\.status !== 'ready'/);
    assert.match(source, /currentPhase\.status === 'ready'/);
    assert.match(source, /Ready for advancement/);
    assert.match(source, /Advance to \$\{nextTitle\}/);
    assert.match(source, /root\.confirm\(/);
    assert.match(source, /method: 'POST'/);
    assert.match(source, /renderJourneyReview\(container, body\.member, body\.journey\)/);
    assert.doesNotMatch(source, /innerHTML|insertAdjacentHTML|localStorage|sessionStorage/);
    assert.match(source, /textContent/);
    assert.match(source, /encodeURIComponent\(currentPhase\.phaseKey\)/);
    assert.doesNotMatch(source, /Prayer Rhythm/);
});

test('review model exposes advancement only for the current ready phase', () => {
    const originalHasPerm = globalThis.hasPerm;
    globalThis.hasPerm = () => false;
    assert.equal(LeadershipUI.hasReviewPermission(), false);
    assert.equal(LeadershipUI.hasAdvancementPermission(), false);

    globalThis.hasPerm = permission => permission === 'edit_entries';
    assert.equal(LeadershipUI.hasReviewPermission(), false);
    assert.equal(LeadershipUI.hasAdvancementPermission(), false);

    globalThis.hasPerm = permission => permission === 'access_discipleship';
    assert.equal(LeadershipUI.hasReviewPermission(), true);
    assert.equal(LeadershipUI.hasAdvancementPermission(), false);

    globalThis.hasPerm = permission => [
        'access_discipleship',
        'edit_entries'
    ].includes(permission);
    assert.equal(LeadershipUI.hasReviewPermission(), true);
    assert.equal(LeadershipUI.hasAdvancementPermission(), true);
    if (originalHasPerm === undefined) delete globalThis.hasPerm;
    else globalThis.hasPerm = originalHasPerm;

    const notReady = LeadershipUI.buildReviewModel(
        { id: 7, name: 'Member' },
        {
            currentPhase: { phaseKey: 'encounter', title: 'Encounter', status: 'in_progress' },
            nextPhase: { phaseKey: 'belong', title: 'Belong' },
            phases: []
        },
        true
    );
    assert.equal(notReady.canAdvance, false);
    assert.equal(notReady.actionLabel, null);

    const reviewOnlyReady = LeadershipUI.buildReviewModel(
        { id: 7, name: 'Member' },
        {
            currentPhase: { phaseKey: 'encounter', title: 'Encounter', status: 'ready' },
            nextPhase: { phaseKey: 'belong', title: 'Belong' },
            phases: []
        },
        false
    );
    assert.equal(reviewOnlyReady.canAdvance, false);
    assert.equal(reviewOnlyReady.actionLabel, null);

    const authorizedReady = LeadershipUI.buildReviewModel(
        { id: 7, name: 'Member' },
        {
            currentPhase: { phaseKey: 'encounter', title: 'Encounter', status: 'ready' },
            nextPhase: { phaseKey: 'belong', title: 'Belong' },
            phases: []
        },
        true
    );
    assert.equal(authorizedReady.canAdvance, true);
    assert.equal(authorizedReady.actionLabel, 'Advance to Belong');
});

test('leadership Journey asset is loaded and cached coherently', () => {
    assert.match(index, /\/js\/app\.js\?v=13\.3/);
    assert.match(index, /\/js\/growth-journey-leadership\.js\?v=3/);
    assert.ok(
        index.indexOf('/js/growth-journey-leadership.js?v=3') >
        index.indexOf('/js/app.js?v=13.3')
    );
    assert.match(serviceWorker, /const CACHE_NAME = 'fog-portal-v68'/);
    assert.match(serviceWorker, /'\/js\/growth-journey-leadership\.js\?v=3'/);
});

test('advancement routes do not couple the transaction to notifications', () => {
    const start = server.indexOf("app.get(\n    '/api/admin/growth-journey/members/:youthId'");
    const end = server.indexOf("app.post('/api/growth-journey/prayer-covenant/join'", start);
    assert.ok(start >= 0 && end > start);
    const routeBlock = server.slice(start, end);
    assert.match(routeBlock, /requirePermission\('access_discipleship'\)/);
    assert.match(
        routeBlock,
        /requireAllPermissions\(\['access_discipleship', 'edit_entries'\]\)/
    );
    assert.doesNotMatch(routeBlock, /processJourneyReadyNotification|pushToUser|sendNotification/);
    assert.doesNotMatch(routeBlock, /req\.body|req\.query/);
});
