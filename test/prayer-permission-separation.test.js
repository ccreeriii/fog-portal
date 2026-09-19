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

const server =
    fs.readFileSync(
        path.join(
            root,
            'server.js'
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

const app =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'app.js'
        ),
        'utf8'
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

const watchtower =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'watchtower.js'
        ),
        'utf8'
    );

test(
    'Watchtower and Prayer Journey use distinct canonical permissions',
    () => {
        assert.match(
            server,
            /'\/api\/admin\/prayer-covenant-monitor',\s*requirePermission\('access_prayer_journey'\)/
        );

        assert.match(
            server,
            /'\/api\/admin\/prayer-covenant-monitor\/:enrollmentId',\s*requirePermission\('access_prayer_journey'\)/
        );

        assert.match(
            server,
            /'\/api\/prayer\/watchtower',\s*requirePermission\('access_prayer'\)/
        );

        assert.match(
            server,
            /'\/api\/prayer\/watchtower\/:youthId\/claim',\s*requirePermission\('access_prayer'\)/
        );

        assert.match(
            server,
            /'\/api\/prayer\/watchtower\/:youthId\/complete',\s*requirePermission\('access_prayer'\)/
        );
    }
);

test(
    'Permissions Management exposes both prayer permissions independently',
    () => {
        assert.match(
            html,
            /value="access_prayer"> Watchtower Prayer/
        );

        assert.match(
            html,
            /value="access_prayer_journey"> Prayer Journey Monitor/
        );

        assert.match(
            app,
            /access_prayer:\s*'Watchtower Prayer'/
        );

        assert.match(
            app,
            /access_prayer_journey:\s*'Prayer Journey Monitor'/
        );
    }
);

test(
    'sensitive Prayer Journey Monitor is hidden by default and client-gated separately',
    () => {
        assert.match(
            html,
            /id="prayerMonitorPanel"[^>]*hidden/
        );

        assert.match(
            html,
            /id="prayerMonitorDivider"[^>]*hidden/
        );

        assert.match(
            monitor,
            /const PERMISSION\s*=\s*'access_prayer_journey'/
        );

        assert.match(
            monitor,
            /function canViewPrayerJourney\(\)/
        );

        assert.match(
            monitor,
            /journeyButton\.hidden\s*=\s*!journeyAllowed/
        );

        assert.doesNotMatch(
            monitor,
            /const PERMISSION\s*=\s*'access_prayer';/
        );

        assert.doesNotMatch(
            monitor,
            /tabId\s*===\s*'watchtowerTab'\s*&&\s*!isAuthorized/
        );
    }
);

test(
    'Watchtower client remains access_prayer only',
    () => {
        assert.match(
            watchtower,
            /const WATCHTOWER_PERMISSION\s*=\s*'access_prayer'/
        );

        assert.doesNotMatch(
            watchtower,
            /access_prayer_journey/
        );
    }
);

test(
    'bootstrap strong administrator explicitly has both prayer permissions without bulk-upgrading Watchtower users',
    () => {
        assert.match(
            server,
            /superadminPermissions[\s\S]{0,700}'access_prayer'[\s\S]{0,120}'access_prayer_journey'/
        );

        assert.doesNotMatch(
            server,
            /UPDATE\s+users[\s\S]{0,250}access_prayer_journey[\s\S]{0,250}access_prayer/i
        );
    }
);
