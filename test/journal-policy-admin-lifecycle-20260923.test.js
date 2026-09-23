'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT =
    path.resolve(__dirname, '..');

const html =
    fs.readFileSync(
        path.join(
            ROOT,
            'public/index.html'
        ),
        'utf8'
    );

const controller =
    fs.readFileSync(
        path.join(
            ROOT,
            'public/js/journal-policy-admin.js'
        ),
        'utf8'
    );

const sw =
    fs.readFileSync(
        path.join(
            ROOT,
            'public/sw.js'
        ),
        'utf8'
    );

const server =
    fs.readFileSync(
        path.join(
            ROOT,
            'server.js'
        ),
        'utf8'
    );

test(
    'Journal safeguarding panel is fail-visible and safely disabled before policy load',
    () => {
        const section =
            html.match(
                /<section id="privateJournalPolicySettings"[^>]*>/
            );

        assert.ok(section);

        assert.doesNotMatch(
            section[0],
            /\shidden(?:\s|=|>)/
        );

        const toggle =
            html.match(
                /<input id="privateJournalTeenGuardianToggle"[^>]*>/
            );

        assert.ok(toggle);

        assert.match(
            toggle[0],
            /\bdisabled\b/
        );

        assert.doesNotMatch(
            toggle[0],
            /\bchecked\b/
        );

        assert.match(
            html,
            /journal-policy-admin\.js\?v=20260922c4/
        );
    }
);

test(
    'Journal policy retries after authentication instead of permanently hiding on initial 401',
    () => {
        assert.doesNotMatch(
            controller,
            /if\s*\(\s*response\.status\s*===\s*401\s*\)\s*return\s*;/
        );

        assert.match(
            controller,
            /response\.status\s*===\s*401/
        );

        assert.match(
            controller,
            /MutationObserver/
        );

        assert.match(
            controller,
            /profileTab/
        );

        assert.match(
            controller,
            /\[data-target="profileTab"\]/
        );

        assert.match(
            controller,
            /FOGPrivateJournalPolicyAdmin/
        );

        assert.match(
            controller,
            /section\.hidden\s*=\s*false/
        );
    }
);

test(
    'Journal policy still fails closed for unauthorized or unknown state',
    () => {
        assert.match(
            controller,
            /response\.status\s*===\s*403/
        );

        assert.match(
            controller,
            /toggle\.indeterminate\s*=\s*true/
        );

        assert.match(
            controller,
            /toggle\.disabled\s*=\s*true/
        );

        assert.match(
            controller,
            /Strong Admin/
        );
    }
);

test(
    'Strong Admin authorization remains server enforced',
    () => {
        const routeMatches =
            [
                ...server.matchAll(
                    /['"]\/api\/admin\/private-journal-policy['"]/g
                )
            ];

        assert.equal(
            routeMatches.length,
            2
        );

        for (const match of routeMatches) {
            const start =
                Math.max(
                    0,
                    match.index - 120
                );

            const end =
                Math.min(
                    server.length,
                    match.index + 180
                );

            const context =
                server.slice(
                    start,
                    end
                );

            assert.match(
                context,
                /requireStrongAdmin/
            );
        }
    }
);

test(
    'PWA publishes fresh Journal policy controller',
    () => {
        assert.match(
            sw,
            /const CACHE_NAME = ['"]fog-portal-v83['"]/
        );

        assert.match(
            sw,
            /\/js\/journal-policy-admin\.js\?v=20260922c4/
        );
    }
);
