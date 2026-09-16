'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const read = relative =>
    fs.readFileSync(
        path.join(ROOT, relative),
        'utf8'
    );

test(
    'Premium Banner Manager exposes six clearly labelled image inputs with visible recommended dimensions',
    () => {
        const html = read('public/index.html');

        const expectedInputs = [
            [
                'premiumPrayerBannerInput',
                'Prayer Page Banner Image'
            ],
            [
                'premiumJournalBannerInput',
                'Private Journal Banner Image'
            ],
            [
                'premiumGroupsBannerInput',
                'Groups / Campfires &amp; Fire Circles Banner Image'
            ],
            [
                'premiumGrowthBannerInput',
                'Growth Page Banner Image'
            ],
            [
                'premiumEventsBannerInput',
                'Events Page Banner Image'
            ],
            [
                'premiumArcadeBannerInput',
                'FOG Arcade Page Banner Image'
            ]
        ];

        for (const [id, label] of expectedInputs) {
            assert.match(
                html,
                new RegExp(`id=["']${id}["']`)
            );

            assert.match(
                html,
                new RegExp(`for=["']${id}["']`)
            );

            assert.ok(
                html.includes(label),
                `Missing visible label: ${label}`
            );
        }

        const recommendations =
            html.match(
                /Recommended:\s*1600 × 700 px \(16:7\)\./g
            ) || [];

        assert.equal(
            recommendations.length,
            6
        );
    }
);

test(
    'Premium Banner Manager write endpoint is protected by strong admin authorization',
    () => {
        const server = read('server.js');

        assert.match(
            server,
            /app\.post\(\s*['"]\/api\/settings\/premium-banners['"],\s*requireStrongAdmin/
        );
    }
);

test(
    'Premium banner backend validates type size and file signatures',
    () => {
        const server = read('server.js');

        assert.match(
            server,
            /image\\\/\(\?:jpeg\|png\|webp\)/
        );

        assert.match(
            server,
            /PREMIUM_BANNER_MAX_BYTES\s*=\s*2\s*\*\s*1024\s*\*\s*1024/
        );

        assert.match(
            server,
            /file content does not match its declared image type/
        );

        assert.match(
            server,
            /premium-banners/
        );
    }
);

test(
    'Premium banner URLs feed the prepared Prayer Journal and Groups CSS hooks',
    () => {
        const html = read('public/index.html');
        const css = read(
            'public/css/fog-premium.css'
        );

        assert.match(
            html,
            /--fog-prayer-banner-photo/
        );

        assert.match(
            html,
            /--fog-journal-banner-photo/
        );

        assert.match(
            html,
            /--fog-groups-banner-photo/
        );

        assert.match(
            css,
            /--fog-prayer-banner-photo/
        );

        assert.match(
            css,
            /--fog-journal-banner-photo/
        );

        assert.match(
            css,
            /--fog-groups-banner-photo/
        );
    }
);


test(
    'Premium banner runtime media outside Git-managed public assets is served through the dedicated runtime route',
    () => {
        const server = read('server.js');
        const html = read('public/index.html');

        assert.match(
            server,
            /runtime-data[\s\S]{0,120}premium-banners/
        );

        assert.match(
            server,
            /app\.use\(\s*['"]\/runtime-media\/premium-banners['"]/
        );

        assert.match(
            server,
            /\/runtime-media\/premium-banners\/\$\{filename\}/
        );

        assert.match(
            html,
            /value\.startsWith\(['"]\/runtime-media\/premium-banners\//
        );
    }
);


test(
    'persisted premium banners reload independently without cross-page bleed',
    () => {
        const html = read('public/index.html');
        const css = read('public/css/fog-premium.css');

        assert.match(
            html,
            /cache:\s*['"]no-store['"]/
        );

        assert.match(
            html,
            /\/api\/settings\/premium-banners\?_=[\s\S]{0,80}Date\.now\(\)/
        );

        assert.match(
            html,
            /window\.addEventListener\(\s*['"]pageshow['"]/
        );

        assert.match(
            html,
            /definition\.cssVariable,[\s\S]{0,80}value/
        );

        assert.match(
            css,
            /feature-intro--prayer[\s\S]{0,500}var\(--fog-prayer-banner-photo,\s*none\)/
        );

        assert.match(
            css,
            /feature-intro--journal[\s\S]{0,500}var\(--fog-journal-banner-photo,\s*none\)/
        );

        assert.match(
            css,
            /feature-intro--groups[\s\S]{0,500}var\(--fog-groups-banner-photo,\s*none\)/
        );
    }
);


test(
    'premium banner upload contract mutates one explicit target at a time',
    () => {
        const html = read('public/index.html');
        const server = read('server.js');

        assert.match(
            html,
            /selected\.length\s*!==\s*1/
        );

        assert.match(
            html,
            /target:\s*selection\.name/
        );

        assert.match(
            server,
            /PREMIUM_BANNER_SETTING_KEYS\[target\]/
        );

        assert.match(
            server,
            /persistPremiumBannerSetting\(\s*definition\.settingKey,\s*publicUrl/
        );
    }
);


test(
    'Premium hero system supports Growth Events and FOG Arcade independently',
    () => {
        const html = read('public/index.html');
        const css = read('public/css/fog-premium.css');
        const server = read('server.js');

        for (const id of [
            'premiumPrayerBannerInput',
            'premiumJournalBannerInput',
            'premiumGroupsBannerInput',
            'premiumGrowthBannerInput',
            'premiumEventsBannerInput',
            'premiumArcadeBannerInput'
        ]) {
            assert.match(
                html,
                new RegExp(`id=["']${id}["']`)
            );
        }

        assert.match(
            html,
            /growthPremiumFeatureTitle/
        );

        assert.match(
            html,
            /eventsFeatureTitle/
        );

        assert.match(
            html,
            /arcadePremiumFeatureTitle/
        );

        assert.match(
            html,
            /--fog-growth-banner-photo/
        );

        assert.match(
            html,
            /--fog-events-banner-photo/
        );

        assert.match(
            html,
            /--fog-arcade-banner-photo/
        );

        assert.match(
            server,
            /premium_banner_growth/
        );

        assert.match(
            server,
            /premium_banner_events/
        );

        assert.match(
            server,
            /premium_banner_arcade/
        );

        assert.match(
            css,
            /--fog-growth-banner-photo/
        );

        assert.match(
            css,
            /--fog-events-banner-photo/
        );

        assert.match(
            css,
            /--fog-arcade-banner-photo/
        );
    }
);


test(
    'Premium hero shell removes the visible legacy copper border seam',
    () => {
        const css = read('public/css/fog-premium.css');

        assert.match(
            css,
            /PHASE 2B SIX-PAGE PREMIUM HERO SYSTEM/
        );

        assert.match(
            css,
            /border:\s*0\s*!important/
        );

        assert.match(
            css,
            /background-clip:\s*border-box\s*!important/
        );

        assert.match(
            css,
            /box-shadow:[\s\S]{0,100}rgba\(117,\s*47,\s*25,\s*0\.20\)\s*!important/
        );
    }
);


test(
    'Premium six-page consistency uses the shared warm canvas and compact hero typography',
    () => {
        const css = read('public/css/fog-premium.css');
        const polish = read('public/js/community-feature-polish.js');

        assert.match(
            css,
            /PHASE 2C FINAL SIX-PAGE CONSISTENCY/
        );

        assert.match(
            css,
            /#discipleshipTab,\s*#eventsTab,\s*#arcadeTab[\s\S]{0,300}var\(--fog-premium-canvas\)/
        );

        assert.match(
            css,
            /#growthSubPrayer[\s\S]{0,220}max-width:\s*none\s*!important/
        );

        assert.match(
            css,
            /font-size:\s*clamp\(1\.52rem,\s*3\.25vw,\s*2\.08rem\)\s*!important/
        );

        assert.match(
            css,
            /#eventsTab \.event-card/
        );

        assert.match(
            css,
            /#arcadeTab \.arcade-game-tile/
        );

        assert.match(
            polish,
            /'Private Journal'/
        );

        assert.doesNotMatch(
            polish,
            /Private Journal · Private to you/
        );
    }
);
