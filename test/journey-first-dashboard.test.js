'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const Dashboard = require('../public/js/journey-dashboard');
const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const dashboardSource = fs.readFileSync(
    path.join(root, 'public', 'js', 'journey-dashboard.js'),
    'utf8'
);
const dashboardStyles = fs.readFileSync(
    path.join(root, 'public', 'css', 'journey-dashboard.css'),
    'utf8'
);
const serviceWorker = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const growthJourney = fs.readFileSync(path.join(root, 'lib', 'growth-journey.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'public', 'js', 'app.js'), 'utf8');

test('Home Journey uses pastoral member wording without renaming canonical phases', () => {
    assert.match(dashboardSource, /Your Journey Now: \$\{model\.current\.title\}/);
    assert.doesNotMatch(dashboardSource, /Current Stage: \$\{model\.current\.title\}/);
    assert.deepEqual(Dashboard.PHASES.map(phase => phase.title),
        ['Encounter', 'Belong', 'Commit', 'Discern', 'Form', 'Serve', 'Be Sent']);
});

function routeBlock(marker, nextMarker) {
    const start = server.indexOf(marker);
    assert.notEqual(start, -1, `Missing route marker ${marker}`);
    const end = server.indexOf(nextMarker, start + marker.length);
    assert.notEqual(end, -1, `Missing route boundary ${nextMarker}`);
    return server.slice(start, end);
}

test('Prayer Covenant view states remain permanent and server-authoritative', () => {
    const noEnrollment = Dashboard.buildPrayerModel({
        onboarding: {
            templateCode: 'prayer-covenant-21',
            durationDays: 21,
            enrollment: null
        },
        prayerRhythm: {
            available: true,
            completedToday: false,
            qualifyingDays: 3,
            targetDays: 7,
            windowDays: 14,
            consistencyPercent: 42.9
        }
    }, true);
    assert.equal(noEnrollment.state, 'rhythm');
    assert.equal(noEnrollment.action, 'Pray Today');
    assert.equal(noEnrollment.rhythm.qualifyingDays, 3);
    assert.equal(noEnrollment.joinAvailable, true);
    assert.equal(noEnrollment.title, 'Your Prayer Habit');

    const active = Dashboard.buildPrayerModel({
        onboarding: {
            durationDays: 21,
            enrollment: { status: 'active', completedDays: 7 }
        },
        prayerRhythm: { available: true, completedToday: false }
    }, true);
    assert.equal(active.state, 'active_challenge');
    assert.equal(active.title, 'Day 8 of 21');
    assert.equal(active.action, 'Continue Prayer');
    assert.equal(active.challengeProgress.completedDays, 7);
    assert.equal(active.showRhythm, false);
    assert.equal(active.joinAvailable, false);

    const activePrayed = Dashboard.buildPrayerModel({
        onboarding: {
            durationDays: 21,
            enrollment: { status: 'active', completedDays: 8 }
        },
        prayerRhythm: { available: true, completedToday: true }
    }, true);
    assert.equal(activePrayed.title, 'Day 8 of 21');
    assert.equal(activePrayed.status, 'Prayer offered today');
    assert.equal(activePrayed.actionDisabled, true);

    const completed = Dashboard.buildPrayerModel({
        onboarding: {
            durationDays: 21,
            enrollment: { status: 'completed', completedDays: 21 }
        },
        prayerRhythm: {
            available: true,
            completedToday: false,
            qualifyingDays: 7,
            targetDays: 7,
            windowDays: 14,
            consistencyPercent: 100
        }
    }, true);
    assert.equal(completed.state, 'completed_challenge');
    assert.equal(completed.title, '21-Day Prayer Covenant Completed');
    assert.equal(completed.action, 'Pray Today');
    assert.equal(completed.showRhythm, true);
    assert.equal(completed.joinAvailable, false);
    assert.doesNotMatch(JSON.stringify(completed), /Day 22|22\/21|22 of 21/);

    const prayedToday = Dashboard.buildPrayerModel({
        onboarding: { durationDays: 21, enrollment: null },
        prayerRhythm: { available: true, completedToday: true }
    }, true);
    assert.equal(prayedToday.state, 'rhythm_complete_today');
    assert.equal(prayedToday.action, 'Prayer offered today');
    assert.equal(prayedToday.actionDisabled, true);
});

test('future raw Prayer Rhythm progress never presents all seven phases as current', () => {
    const journey = {
        currentPhase: {
            phaseKey: 'encounter',
            title: 'Encounter',
            progressPercent: 35,
            essentialCompleted: 0,
            essentialTotal: 1,
            status: 'in_progress'
        },
        nextPhase: { phaseKey: 'belong', title: 'Belong' },
        nextInvitation: {
            kind: 'essential',
            phaseKey: 'encounter',
            taskKey: 'encounter-community-event',
            title: 'Come and See',
            description: 'Join a welcoming community activity.'
        },
        phases: Dashboard.PHASES.map((phase, index) => ({
            phaseKey: phase.key,
            title: phase.title,
            status: 'in_progress',
            sequenceState: index === 0 ? 'current' : 'upcoming'
        }))
    };
    const model = Dashboard.buildJourneyModel(journey);
    assert.equal(model.current.key, 'encounter');
    assert.equal(model.invitation.taskKey, 'encounter-community-event');
    assert.deepEqual(
        model.phases.map(phase => phase.sequenceState),
        ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']
    );
});

test('Coming Up keeps only upcoming public event fields', () => {
    const events = Dashboard.selectUpcomingEvents([
        {
            id: 1,
            name: 'Past Gathering',
            event_date: '2026-09-13',
            venue: 'Hall'
        },
        {
            id: 2,
            name: 'Community Night',
            event_date: '2026-09-15',
            time_start: '18:00',
            venue: 'FOG Center',
            roles_restricted_notes: 'private planning note'
        }
    ], '2026-09-14T08:00:00+08:00');

    assert.deepEqual(events, [{
        id: 2,
        name: 'Community Night',
        eventDate: '2026-09-15',
        timeStart: '18:00',
        venue: 'FOG Center'
    }]);
    assert.equal(Object.hasOwn(events[0], 'roles_restricted_notes'), false);
});

test('member dashboard data remains authenticated, self-scoped, and safely projected', () => {
    const route = routeBlock(
        "app.get('/api/growth-journey/me'",
        "app.post('/api/youth/:id/commit'"
    );
    assert.match(route, /requireAuth/);
    assert.match(route, /req\.auth\s*&&\s*req\.auth\.youthId/);
    assert.doesNotMatch(route, /req\.body[^;]*youth|req\.query[^;]*youth/);
    assert.match(route, /WHERE date\(event_date\) >= date\(\?\)/);
    assert.match(route, /LIMIT 3/);
    assert.match(route, /EVENT_LIST_RESPONSE_FIELDS/);
    assert.doesNotMatch(route, /roles_restricted_notes/);
});

test('direct Prayer Covenant join is authenticated, self-scoped, and canonical', () => {
    const route = routeBlock(
        "app.post('/api/growth-journey/prayer-covenant/join'",
        '// ==========================================\n// MEMBERSHIP INTENT ENDPOINT'
    );
    assert.match(route, /requireAuth/);
    assert.match(route, /req\.auth\s*&&\s*req\.auth\.youthId/);
    assert.doesNotMatch(route, /req\.body|req\.query|req\.params/);
    assert.match(route, /enrollPrayerCovenantChallenge/);
    assert.match(growthJourney, /PRAYER_COVENANT_TEMPLATE_CODE\s*=\s*'prayer-covenant-21'/);
    assert.match(growthJourney, /BEGIN IMMEDIATE/);
    assert.match(growthJourney, /INSERT OR IGNORE INTO growth_onboarding_enrollments/);
});

test('Home information architecture and final runtime module are ordered and focused', () => {
    const prayer = index.indexOf('id="journeyPrayerCard"');
    const growth = index.indexOf('id="journeyGrowthCard"');
    const events = index.indexOf('id="journeyEventsCard"');
    const connected = index.indexOf('id="journeyConnectedCard"');
    assert.ok(prayer > 0 && prayer < growth && growth < events && events < connected);

    const finalModule = index.indexOf('/js/journey-dashboard.js?v=5');
    const historicalDashboard = index.indexOf('id="dashboardReorderEngine"');
    assert.ok(finalModule > historicalDashboard);
    assert.match(index, /id="headerNotificationBell"/);
    assert.doesNotMatch(dashboardSource + dashboardStyles, /watchtower|prayer coverage/i);
    assert.match(dashboardSource, /fetch\('\/api\/growth-journey\/me'/);
    assert.match(dashboardSource, /fetch\('\/api\/prayer-pals\/send'/);
    assert.match(dashboardSource, /Join the 21-Day Prayer Covenant Challenge/);
    assert.doesNotMatch(dashboardSource, /Measured across the latest 14 Manila days/);
    assert.doesNotMatch(dashboardSource, /Membership Journey · Encounter → Belong → Commit/);
    assert.doesNotMatch(dashboardSource, /Servant Journey · Discern → Form → Serve → Be Sent/);
    assert.doesNotMatch(dashboardSource, /essential steps complete/i);
    assert.match(dashboardSource, /textContent/);
    assert.doesNotMatch(dashboardSource, /localStorage\.getItem\([^)]*prayed/i);
    assert.doesNotMatch(
        appSource.match(/const ogIntervalV19[\s\S]*?}, 1500\);/)?.[0] || '',
        /renderHomeJourneyCard/
    );
    assert.match(dashboardSource, /Promise\.all\(\[/);
});

test('mobile dashboard assets advance the explicit PWA cache coherently', () => {
    assert.match(index, /\/css\/journey-dashboard\.css\?v=4/);
    assert.match(index, /\/js\/journey-dashboard\.js\?v=5/);
    assert.match(serviceWorker, /const CACHE_NAME = 'fog-portal-v33'/);
    assert.match(serviceWorker, /'\/css\/journey-dashboard\.css\?v=4'/);
    assert.match(serviceWorker, /'\/js\/journey-dashboard\.js\?v=5'/);
    assert.match(dashboardStyles, /env\(safe-area-inset-bottom\)/);
    assert.match(dashboardStyles, /#mainHeader[\s\S]*env\(safe-area-inset-top\)/);
    assert.match(dashboardStyles, /\.journey-home__welcome[\s\S]*position:\s*static/);
    assert.match(dashboardStyles, /overflow-x:\s*clip/);
    assert.match(dashboardStyles, /@media \(max-width: 420px\)/);
});
