'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const Premium =
    require(
        '../public/js/journal-premium-ui.js'
    );

function read(relative) {
    return fs.readFileSync(
        path.join(
            __dirname,
            '..',
            relative
        ),
        'utf8'
    );
}


test(
    'premium Journal provides List, Grid and Calendar modes',
    () => {
        const source =
            read(
                'public/js/journal-premium-ui.js'
            );

        assert.match(
            source,
            /'list'/
        );

        assert.match(
            source,
            /'grid'/
        );

        assert.match(
            source,
            /'calendar'/
        );

        assert.match(
            source,
            /journal-premium-view-switch/
        );
    }
);


test(
    'Journal search operates on already-decrypted in-memory entries',
    () => {
        const filter =
            Premium
                ._testing
                .filterEntries;

        const entries = [
            {
                title:
                    'Gratitude',
                mood:
                    'Peaceful',
                content:
                    'Thankful for family.'
            },
            {
                title:
                    'Discernment',
                mood:
                    'Hopeful',
                content:
                    'Praying about direction.'
            }
        ];

        assert.equal(
            filter(
                entries,
                'family',
                'all'
            ).length,
            1
        );

        assert.equal(
            filter(
                entries,
                '',
                'Hopeful'
            ).length,
            1
        );

        assert.equal(
            filter(
                entries,
                'praying',
                'Hopeful'
            ).length,
            1
        );
    }
);


test(
    'premium presentation performs no network requests',
    () => {
        const source =
            read(
                'public/js/journal-premium-ui.js'
            );

        assert.doesNotMatch(
            source,
            /\bfetch\s*\(/
        );

        assert.doesNotMatch(
            source,
            /XMLHttpRequest/
        );

        assert.doesNotMatch(
            source,
            /\baxios\b/
        );
    }
);


test(
    'premium presentation stores no Journal content in localStorage or sessionStorage',
    () => {
        const source =
            read(
                'public/js/journal-premium-ui.js'
            );

        assert.doesNotMatch(
            source,
            /localStorage\./
        );

        assert.doesNotMatch(
            source,
            /sessionStorage\./
        );

        assert.doesNotMatch(
            source,
            /\.innerHTML\s*=/
        );
    }
);


test(
    'calendar contains metadata indicators rather than reflection words in day cells',
    () => {
        const source =
            read(
                'public/js/journal-premium-ui.js'
            );

        assert.match(
            source,
            /Calendar cells intentionally contain/
        );

        assert.match(
            source,
            /journal-premium-calendar__count/
        );
    }
);


test(
    'calendar helper always provides a six-week calendar grid',
    () => {
        const cells =
            Premium
                ._testing
                .calendarCells(
                    2026,
                    8
                );

        assert.equal(
            cells.length,
            42
        );

        assert.equal(
            cells.every(
                item =>
                    typeof item.key ===
                    'string'
            ),
            true
        );
    }
);


test(
    'premium UI wraps secure loader rather than replacing cryptography',
    () => {
        const source =
            read(
                'public/js/journal-premium-ui.js'
            );

        assert.match(
            source,
            /const previousLoad/
        );

        assert.match(
            source,
            /await previousLoad/
        );

        assert.match(
            source,
            /journalsData/
        );

        assert.doesNotMatch(
            source,
            /FOGJournalCrypto\./
        );
    }
);


test(
    'premium assets load after encryption controller',
    () => {
        const html =
            read(
                'public/index.html'
            );

        const crypto =
            html.indexOf(
                '/js/journal-crypto.js?v=1'
            );

        const secure =
            html.indexOf(
                '/js/journal-secure-controller.js?v=1'
            );

        const premium =
            html.indexOf(
                '/js/journal-premium-ui.js?v=1'
            );

        assert.ok(
            crypto >= 0
        );

        assert.ok(
            secure > crypto
        );

        assert.ok(
            premium > secure
        );

        assert.match(
            html,
            /\/css\/journal-premium\.css\?v=1/
        );
    }
);


test(
    'premium Journal stylesheet is feature-scoped and responsive',
    () => {
        const css =
            read(
                'public/css/journal-premium.css'
            );

        assert.match(
            css,
            /\.journal-premium-shell/
        );

        assert.match(
            css,
            /journal-premium-grid/
        );

        assert.match(
            css,
            /journal-premium-calendar/
        );

        assert.match(
            css,
            /@media/
        );
    }
);


test(
    'service worker caches premium static assets while API responses remain excluded',
    () => {
        const sw =
            read(
                'public/sw.js'
            );

        assert.match(
            sw,
            /journal-premium\.css\?v=1/
        );

        assert.match(
            sw,
            /journal-premium-ui\.js\?v=1/
        );

        assert.match(
            sw,
            /url\.pathname\.startsWith\(['"]\/api\//
        );
    }
);


test(
    'premium member language presents encryption simply without cryptographic jargon',
    () => {
        const source =
            read(
                'public/js/journal-premium-ui.js'
            );

        assert.match(
            source,
            /encrypted on this device before saving/
        );

        assert.doesNotMatch(
            source,
            /AES-256-GCM/
        );

        assert.doesNotMatch(
            source,
            /96-bit IV/
        );
    }
);
