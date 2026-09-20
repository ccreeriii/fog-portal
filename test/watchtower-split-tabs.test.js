'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const root =
    path.join(
        __dirname,
        '..'
    );

const monitor =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'prayer-covenant-monitor.js'
        ),
        'utf8'
    );

const html =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'index.html'
        ),
        'utf8'
    );

const sw =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'sw.js'
        ),
        'utf8'
    );

test(
    'Watchtower dashboard provides Coverage and Prayer Journey sub-tabs',
    () => {
        assert.match(
            monitor,
            /watchtowerCoverageTabButton/
        );

        assert.match(
            monitor,
            /prayerJourneyTabButton/
        );

        assert.match(
            monitor,
            /'Watchtower Coverage'/
        );

        assert.match(
            monitor,
            /'Prayer Journey'/
        );

        assert.match(
            html,
            /\.watchtower-subtabs/
        );
    }
);

test(
    'Prayer Journey sub-tab is permission-aware',
    () => {
        assert.match(
            monitor,
            /function canViewPrayerJourney\(\)/
        );

        assert.match(
            monitor,
            /isAuthorized\(\)/
        );

        assert.match(
            monitor,
            /journeyButton\.hidden\s*=\s*!journeyAllowed/
        );

        assert.match(
            monitor,
            /view === 'journey'[\s\S]{0,120}journeyAllowed/
        );
    }
);

test(
    'opening Watchtower defaults to Coverage without loading Prayer Journey',
    () => {
        assert.match(
            monitor,
            /tabId ===\s*'watchtowerTab'[\s\S]{0,220}setWatchtowerView\(\s*'coverage'\s*\)/
        );

        assert.match(
            monitor,
            /watchtowerView !== 'journey'/
        );

        assert.match(
            monitor,
            /showingJourney[\s\S]{0,180}loadPrayerCovenantMonitor/
        );
    }
);

test(
    'permission revocation hides Journey and safely returns to Coverage',
    () => {
        assert.match(
            monitor,
            /error\.status === 403[\s\S]{0,280}journeyAuthorizationDenied[\s\S]{0,300}setWatchtowerView\(\s*'coverage'\s*\)/
        );
    }
);

test(
    'split-tab monitor asset is published coherently',
    () => {
        assert.match(
            html,
            /\/js\/prayer-covenant-monitor\.js\?v=4/
        );

        assert.match(
            sw,
            /\/js\/prayer-covenant-monitor\.js\?v=4/
        );

        assert.match(
            sw,
            /fog-portal-v65/
        );
    }
);
