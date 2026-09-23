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

const index =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'index.html'
        ),
        'utf8'
    );

const client =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'member-broadcast.js'
        ),
        'utf8'
    );

test(
    'specific-member APIs are protected by Communications edit authority',
    () => {
        assert.match(
            server,
            /app\.get\(\s*['"]\/api\/communications\/member-targets['"][\s\S]*?requireAllPermissions\(\[\s*['"]access_communications['"]\s*,\s*['"]edit_entries['"]\s*\]\)/
        );

        assert.match(
            server,
            /app\.post\(\s*['"]\/api\/communications\/member-message['"][\s\S]*?requireAllPermissions\(\[\s*['"]access_communications['"]\s*,\s*['"]edit_entries['"]\s*\]\)/
        );
    }
);

test(
    'direct member message is Portal-first and uses canonical external delivery',
    () => {
        const start =
            server.indexOf(
                "app.post(\n    '/api/communications/member-message'"
            );

        const end =
            server.indexOf(
                "app.post('/api/communications/broadcast'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const route =
            server.slice(
                start,
                end
            );

        assert.match(
            route,
            /NotificationCenter[\s\S]*?createNotification/
        );

        assert.match(
            route,
            /dispatchCanonicalNotificationRecipient/
        );

        assert.match(
            route,
            /membership_community/
        );

        assert.match(
            route,
            /member_direct_message/
        );

        assert.match(
            route,
            /channels/
        );

        assert.doesNotMatch(
            route,
            /body\.actor/
        );
    }
);

test(
    'member search exposes readiness rather than raw email address',
    () => {
        const start =
            server.indexOf(
                "app.get(\n    '/api/communications/member-targets'"
            );

        const end =
            server.indexOf(
                "app.post(\n    '/api/communications/member-message'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const route =
            server.slice(
                start,
                end
            );

        assert.match(
            route,
            /email_verified/
        );

        assert.match(
            route,
            /email_ready/
        );

        assert.match(
            route,
            /push_ready/
        );

        assert.match(
            route,
            /has_push_subscription/
        );

        assert.doesNotMatch(
            route,
            /email:\s*row\.email/
        );
    }
);

test(
    'member UI uses safe DOM text rendering for member-supplied names',
    () => {
        assert.match(
            client,
            /name\.textContent/
        );

        assert.match(
            client,
            /selectedName\.textContent/
        );

        assert.match(
            client,
            /encodeURIComponent\(query\)/
        );

        assert.match(
            client,
            /\/api\/communications\/member-message/
        );

        assert.doesNotMatch(
            client,
            /innerHTML\s*=\s*member\.name/
        );
    }
);

test(
    'specific member UI is loaded as a versioned asset',
    () => {
        assert.match(
            index,
            /\/js\/member-broadcast\.js\?v=20260923b2/
        );
    }
);

test(
    'existing community Broadcast endpoint remains singular',
    () => {
        const matches =
            server.match(
                /app\.post\(['"]\/api\/communications\/broadcast['"]/g
            ) || [];

        assert.equal(
            matches.length,
            1
        );
    }
);
