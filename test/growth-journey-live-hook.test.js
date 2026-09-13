'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverPath =
    path.join(__dirname, '..', 'server.js');

const source =
    fs.readFileSync(serverPath, 'utf8');

test(
    'Growth Journey is imported into the server',
    () => {
        assert.match(
            source,
            /const GrowthJourney = require\('\.\/lib\/growth-journey'\);/
        );
    }
);

test(
    'effective Prayer Covenant route is authenticated and canonical',
    () => {
        const start = source.indexOf(
            "app.post('/api/prayer-pals/send'"
        );

        assert.ok(
            start >= 0,
            'Prayer Covenant route must exist'
        );

        const end = source.indexOf(
            "app.post('/api/inbox/personal/:id/respond'",
            start
        );

        assert.ok(
            end > start,
            'Prayer Covenant route boundary must exist'
        );

        const route =
            source.slice(start, end);

        assert.match(
            route,
            /requireAuth/
        );

        assert.match(
            route,
            /req\.auth.*youthId/s
        );

        assert.match(
            route,
            /senderId !== authenticatedYouthId/
        );

        assert.match(
            route,
            /recordPrayerCovenantCompletion/
        );

        assert.match(
            route,
            /personal-inbox:/
        );
    }
);

test(
    'live membership intent route is authenticated and starts onboarding',
    () => {
        const start = source.indexOf(
            "app.post('/api/youth/:id/commit'"
        );

        assert.ok(
            start >= 0,
            'Live membership intent route must exist'
        );

        const end = source.indexOf(
            '// --- V30: NEW LOGGING & INTEGRATION API ROUTES ---',
            start
        );

        assert.ok(
            end > start,
            'Membership route boundary must exist'
        );

        const route =
            source.slice(start, end);

        assert.match(
            route,
            /requireAuth/
        );

        assert.match(
            route,
            /youthId !== authenticatedYouthId/
        );

        assert.match(
            route,
            /recordMembershipIntent/
        );
    }
);

test(
    'member Growth Journey API is authenticated',
    () => {
        assert.match(
            source,
            /app\.get\('\/api\/growth-journey\/me', requireAuth/
        );

        assert.match(
            source,
            /GrowthJourney\.getMemberJourney/
        );

        assert.match(
            source,
            /GrowthJourney\.getDefaultOnboardingStatus/
        );
    }
);

test(
    'new Google signup starts Encounter account evidence',
    () => {
        const start = source.indexOf(
            "app.post('/api/auth/google/complete-signup'"
        );

        const end = source.indexOf(
            'function sendNoStoreJson',
            start
        );

        assert.ok(start >= 0 && end > start);

        const route = source.slice(start, end);

        assert.match(
            route,
            /GrowthJourney\.recordAccountCreated/
        );

        assert.match(
            route,
            /method:\s*'google_signup'/
        );

        assert.match(
            route,
            /account-created:youth:/
        );
    }
);

test(
    'new Wanderer registration starts Encounter account evidence',
    () => {
        const start = source.indexOf(
            "app.post('/api/public/register-wanderer'"
        );

        assert.ok(
            start >= 0,
            'Wanderer registration route must exist'
        );

        const route = source.slice(start);

        assert.match(
            route,
            /GrowthJourney\.recordAccountCreated/
        );

        assert.match(
            route,
            /method:\s*'registration'/
        );

        assert.match(
            route,
            /account-created:youth:/
        );
    }
);
