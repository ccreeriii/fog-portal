const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const root =
    path.resolve(
        __dirname,
        '..'
    );

const server =
    fs.readFileSync(
        path.join(
            root,
            'server.js'
        ),
        'utf8'
    );

const growth =
    fs.readFileSync(
        path.join(
            root,
            'lib',
            'growth-journey.js'
        ),
        'utf8'
    );

function sourceHookCount(source) {
    const pattern =
        new RegExp(
            `source\\s*:\\s*['"]${source}['"]`,
            'g'
        );

    return (
        server.match(pattern)
        || []
    ).length;
}

test(
    'server binds canonical Growth notification runtime',
    () => {
        assert.match(
            server,
            /const GrowthNotifications = require\('\.\/lib\/growth-notifications'\);/
        );

        assert.match(
            server,
            /async function processJourneyReadyNotification/
        );
    }
);

test(
    'Journey notification processing is downstream and fail-safe',
    () => {
        assert.match(
            server,
            /GrowthNotifications\s*\.createPhaseReadyNotification/
        );

        assert.match(
            server,
            /dispatchCanonicalNotificationEvent\(\s*result\.eventId\s*\)/
        );

        assert.match(
            server,
            /\[Growth Notification\] Journey-ready processing failed:/
        );

        assert.match(
            server,
            /\[Growth Notification\] External delivery failed:/
        );
    }
);

test(
    'exactly one notification source hook exists for every live Growth mutation',
    () => {
        for (
            const source
            of [
                'google_account_created',
                'wanderer_account_created',
                'prayer_covenant_completion',
                'membership_intent',
                'event_attendance'
            ]
        ) {
            assert.equal(
                sourceHookCount(source),
                1,
                source
            );
        }
    }
);

test(
    'Prayer Covenant ready evaluation uses every mutation-driven phase transition',
    () => {
        const routeStart =
            server.indexOf(
                "app.post('/api/prayer-pals/send'"
            );

        assert.ok(
            routeStart >= 0,
            'Prayer Covenant send route exists'
        );

        const routeEnd =
            server.indexOf(
                "app.post('/api/inbox/personal/:id/respond'",
                routeStart
            );

        assert.ok(
            routeEnd > routeStart,
            'Prayer Covenant route has a stable next-route boundary'
        );

        const prayerRoute =
            server.slice(
                routeStart,
                routeEnd
            );

        assert.match(
            prayerRoute,
            /growthJourney\.phaseTransitions/
        );

        assert.match(
            prayerRoute,
            /for\s*\(const phaseProgress of phaseTransitions\)/
        );

        assert.match(
            prayerRoute,
            /processPrayerCovenantReadyNotification\(/
        );
    }
);

test(
    'Membership Intent ready evaluation uses Belong',
    () => {
        const matches =
            [...server.matchAll(
                /source\s*:\s*['"]membership_intent['"]/g
            )];

        assert.equal(
            matches.length,
            1
        );

        const marker =
            matches[0].index;

        const block =
            server.slice(
                Math.max(0, marker - 1000),
                marker + 1000
            );

        assert.match(
            block,
            /growthJourney\s*&&\s*growthJourney\.belong/
        );
    }
);

test(
    'attendance exposes full recalculated phase transition objects',
    () => {
        assert.match(
            growth,
            /const phaseTransitions = \[\];/
        );

        assert.match(
            growth,
            /phaseTransitions\.push\(\s*phaseProgress\s*\)/
        );

        assert.match(
            growth,
            /recalculatedPhases,\s*phaseTransitions/
        );

        assert.match(
            server,
            /for\s*\(\s*const phaseProgress\s*of phaseTransitions\s*\)/
        );
    }
);

test(
    'member Journey GET never creates Journey notifications',
    () => {
        const start =
            server.indexOf(
                "app.get('/api/growth-journey/me'"
            );

        assert.ok(
            start >= 0
        );

        const end =
            server.indexOf(
                '// ==========================================',
                start + 20
            );

        const block =
            server.slice(
                start,
                end > start
                    ? end
                    : start + 5000
            );

        assert.doesNotMatch(
            block,
            /processJourneyReadyNotification/
        );

        assert.doesNotMatch(
            block,
            /createPhaseReadyNotification/
        );
    }
);
