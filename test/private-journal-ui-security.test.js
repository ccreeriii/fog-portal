'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const Controller =
    require(
        '../public/js/journal-secure-controller.js'
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
    'Journal UI access is server-authoritative and fails closed without explicit approval',
    () => {
        const decide =
            Controller
                ._testing
                .accessDecision;

        /*
         * Adults are allowed only when the server has
         * explicitly verified access_allowed=true.
         */
        assert.equal(
            decide({
                age_bracket:
                    'AGE_18_PLUS',

                access_allowed:
                    true,

                experience_mode:
                    'private_journal'
            }).allowed,
            true
        );

        /*
         * Authorized ages 13-17 use the encrypted
         * Private Journal.
         */
        const authorizedTeen =
            decide({
                age_bracket:
                    'AGE_13_17',

                access_allowed:
                    true,

                experience_mode:
                    'private_journal'
            });

        assert.equal(
            authorizedTeen.allowed,
            true
        );

        assert.equal(
            authorizedTeen
                .experience_mode,
            'private_journal'
        );

        /*
         * Authorized ages 10-12 use Youth Reflection.
         */
        const authorizedYouth =
            decide({
                age_bracket:
                    'AGE_10_12',

                access_allowed:
                    true,

                experience_mode:
                    'youth_reflection'
            });

        assert.equal(
            authorizedYouth.allowed,
            true
        );

        assert.equal(
            authorizedYouth
                .experience_mode,
            'youth_reflection'
        );

        /*
         * Age alone is NEVER sufficient anymore.
         * The server must explicitly authorize access.
         */
        for (const bracket of [
            'AGE_18_PLUS',
            'AGE_13_17',
            'AGE_10_12',
            'UNDER_10',
            'UNKNOWN',
            null
        ]) {
            assert.equal(
                decide({
                    age_bracket:
                        bracket
                }).allowed,
                false,
                String(bracket)
            );
        }

        assert.equal(
            decide({
                age_bracket:
                    'AGE_18_PLUS',

                access_allowed:
                    false,

                experience_mode:
                    'private_journal'
            }).allowed,
            false
        );
    }
);


test(
    'secure Journal controller never persists plaintext or keys in localStorage/sessionStorage',
    () => {
        const source =
            read(
                'public/js/journal-secure-controller.js'
            );

        assert.doesNotMatch(
            source,
            /localStorage\.setItem/
        );

        assert.doesNotMatch(
            source,
            /sessionStorage\.setItem/
        );

        assert.doesNotMatch(
            source,
            /localStorage\.getItem/
        );

        assert.doesNotMatch(
            source,
            /sessionStorage\.getItem/
        );
    }
);


test(
    'secure Journal controller never renders Journal content with innerHTML',
    () => {
        const source =
            read(
                'public/js/journal-secure-controller.js'
            );

        assert.doesNotMatch(
            source,
            /\.innerHTML\s*=/
        );

        assert.match(
            source,
            /\.textContent\s*=/
        );

        assert.match(
            source,
            /replaceChildren/
        );
    }
);


test(
    'legacy v2 Journal methods no longer construct plaintext API payloads',
    () => {
        const source =
            read(
                'public/js/v2-discipleship.js'
            );

        const start =
            source.indexOf(
                'saveJournal: async function(e)'
            );

        const end =
            source.indexOf(
                'submitPrayer: async function(e)'
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const block =
            source.slice(
                start,
                end
            );

        assert.match(
            block,
            /FOGJournalSecureController/
        );

        assert.doesNotMatch(
            block,
            /JSON\.stringify\s*\(\s*payload/
        );

        assert.doesNotMatch(
            block,
            /title:\s*document\.getElementById/
        );

        assert.doesNotMatch(
            block,
            /content:\s*document\.getElementById/
        );

        assert.match(
            block,
            /Nothing was sent or saved/
        );
    }
);


test(
    'polished Journal list uses secure decrypted entries',
    () => {
        const source =
            read(
                'public/js/community-feature-polish.js'
            );

        const start =
            source.indexOf(
                'function loadCanonicalJournalList()'
            );

        assert.ok(
            start >= 0
        );

        const block =
            source.slice(
                start,
                start + 4500
            );

        assert.match(
            block,
            /FOGJournalSecureController/
        );

        assert.match(
            block,
            /loadEntries\(ownerId\)/
        );

        assert.match(
            block,
            /discipleship\.journalsData/
        );

        assert.match(
            block,
            /renderEntries/
        );
    }
);


test(
    'Journal security scripts load after polished Journal implementation',
    () => {
        const html =
            read(
                'public/index.html'
            );

        const polish =
            html.indexOf(
                '/js/community-feature-polish.js'
            );

        const crypto =
            html.indexOf(
                '/js/journal-crypto.js?v=1'
            );

        const controller =
            html.indexOf(
                '/js/journal-secure-controller.js?v=1'
            );

        assert.ok(
            polish >= 0
        );

        assert.ok(
            crypto > polish
        );

        assert.ok(
            controller > crypto
        );
    }
);


test(
    'service worker includes Journal security code and excludes API requests from shell cache',
    () => {
        const sw =
            read(
                'public/sw.js'
            );

        assert.match(
            sw,
            /journal-crypto\.js\?v=1/
        );

        assert.match(
            sw,
            /journal-secure-controller\.js\?v=1/
        );

        assert.match(
            sw,
            /url\.pathname\.startsWith\(['"]\/api\//
        );
    }
);


test(
    'client Journal requests explicitly disable HTTP cache use',
    () => {
        const source =
            read(
                'public/js/journal-secure-controller.js'
            );

        assert.match(
            source,
            /cache:\s*'no-store'/
        );

        assert.match(
            source,
            /credentials:\s*'same-origin'/
        );
    }
);


test(
    'Recovery Key is displayed locally and only wrapped envelope is uploaded',
    () => {
        const source =
            read(
                'public/js/journal-secure-controller.js'
            );

        assert.match(
            source,
            /showRecoveryKeyOnce/
        );

        assert.match(
            source,
            /saveEnvelope\s*\(\s*setup\.envelope\s*\)/
        );

        assert.doesNotMatch(
            source,
            /saveEnvelope\s*\(\s*setup\.recoveryCode/
        );

        assert.doesNotMatch(
            source,
            /JSON\.stringify\s*\(\s*setup\.recoveryCode/
        );
    }
);


test(
    'legacy entries are encrypted before owner migration endpoint is called',
    () => {
        const source =
            read(
                'public/js/journal-secure-controller.js'
            );

        const migrationFunction =
            source.indexOf(
                'async function migrateLegacyEntry'
            );

        assert.ok(
            migrationFunction >= 0
        );

        const migrationBlock =
            source.slice(
                migrationFunction,
                migrationFunction + 5000
            );

        const encryptPosition =
            migrationBlock.indexOf(
                'crypto.encryptEntry('
            );

        const endpointPosition =
            migrationBlock.indexOf(
                '/migrate'
            );

        assert.ok(
            encryptPosition >= 0
        );

        assert.ok(
            endpointPosition >
            encryptPosition
        );

        assert.match(
            source,
            /row\.legacy === true/
        );
    }
);
