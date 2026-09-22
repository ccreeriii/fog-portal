'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const Guardian =
    require(
        '../public/js/journal-guardian-ui.js'
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
    'guardian share link uses URL fragment rather than query parameter',
    () => {
        const link =
            Guardian
                ._testing
                .buildGuardianShareLink(
                    'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG',
                    'https://fogmin.site/?page=growth'
                );

        const url =
            new URL(link);

        assert.equal(
            url.searchParams
                .has(
                    'journal-guardian'
                ),
            false
        );

        assert.match(
            url.hash,
            /^#journal-guardian=/
        );
    }
);


test(
    'guardian token can be read back from fragment',
    () => {
        const token =
            'abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG';

        const encoded =
            Guardian
                ._testing
                .buildGuardianShareLink(
                    token,
                    'https://fogmin.site/'
                );

        const parsed =
            Guardian
                ._testing
                .extractGuardianTokenFromHash(
                    new URL(encoded)
                        .hash
                );

        assert.equal(
            parsed,
            token
        );
    }
);


test(
    'guardian UI never persists approval token in localStorage or sessionStorage',
    () => {
        const source =
            read(
                'public/js/journal-guardian-ui.js'
            );

        assert.doesNotMatch(
            source,
            /(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|getItem|removeItem|clear)\s*\(/
        );

        assert.doesNotMatch(
            source,
            /console\.log/
        );
    }
);


test(
    'guardian fragment is removed after authenticated consumption',
    () => {
        const source =
            read(
                'public/js/journal-guardian-ui.js'
            );

        assert.match(
            source,
            /replaceState/
        );

        assert.match(
            source,
            /clearGuardianFragment/
        );

        assert.match(
            source,
            /currentMemberId/
        );
    }
);


test(
    'guardian messaging explicitly says approval does not grant routine Journal access',
    () => {
        const source =
            read(
                'public/js/journal-guardian-ui.js'
            );

        assert.match(
            source,
            /does not automatically let them read your entries/i
        );

        assert.match(
            source,
            /does not give me routine access to their entries/i
        );

        assert.match(
            source,
            /FOG leaders do not routinely browse/i
        );
    }
);


test(
    'guardian approval requires explicit attestation and relationship',
    () => {
        const source =
            read(
                'public/js/journal-guardian-ui.js'
            );

        assert.match(
            source,
            /guardian_attested:\s*true/
        );

        assert.match(
            source,
            /legal_guardian/
        );

        assert.match(
            source,
            /Parent/
        );
    }
);


test(
    'secure controller permits server-authorized youth modes',
    () => {
        const source =
            read(
                'public/js/journal-secure-controller.js'
            );

        assert.match(
            source,
            /status\.access_allowed ===/
        );

        assert.match(
            source,
            /youth_reflection/
        );

        assert.match(
            source,
            /FOGJournalGuardianUI/
        );

        assert.match(
            source,
            /requestYouthAuthorization/
        );
    }
);


test(
    'premium Journal contains age-appropriate Youth Reflection copy',
    () => {
        const source =
            read(
                'public/js/journal-premium-ui.js'
            );

        assert.match(
            source,
            /YOUTH REFLECTION/
        );

        assert.match(
            source,
            /A safe place to pause and pray/
        );

        assert.match(
            source,
            /Need a place to begin/
        );

        assert.match(
            source,
            /What made you thankful/
        );
    }
);


test(
    'guardian UI loads before secure controller and premium presentation',
    () => {
        const html =
            read(
                'public/index.html'
            );

        const crypto =
            html.indexOf(
                '/js/journal-crypto.js?v=1'
            );

        const guardian =
            html.indexOf(
                '/js/journal-guardian-ui.js?v=1'
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
            0 <= crypto
        );

        assert.ok(
            crypto <
            guardian
        );

        assert.ok(
            guardian <
            secure
        );

        assert.ok(
            secure <
            premium
        );
    }
);


test(
    'service worker caches guardian code but still excludes APIs',
    () => {
        const sw =
            read(
                'public/sw.js'
            );

        assert.match(
            sw,
            /journal-guardian-ui\.js\?v=1/
        );

        assert.match(
            sw,
            /url\.pathname\.startsWith\(['"]\/api\//
        );
    }
);
