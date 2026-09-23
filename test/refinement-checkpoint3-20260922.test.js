'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(
        path.join(root, relativePath),
        'utf8'
    );
}

test(
    'Communications Broadcast publishes even when Push is unavailable',
    () => {
        const source = read('server.js');

        const start =
            source.indexOf(
                "app.post('/api/communications/broadcast'"
            );

        const end =
            source.indexOf(
                "app.get('/api/communications/history'",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route =
            source.slice(start, end);

        assert.match(
            route,
            /requireAllPermissions\(\s*\[\s*'access_communications',\s*'edit_entries'\s*\]/
        );

        assert.doesNotMatch(
            route.split('=> {', 1)[0],
            /requirePushAvailable/
        );

        assert.match(
            route,
            /if\s*\(\s*!pushNotificationsAvailable\s*\)/
        );

        assert.match(
            route,
            /pushStatus:\s*'unavailable'/
        );

        assert.match(
            route,
            /Broadcast published in the Portal/
        );

        assert.match(
            route,
            /success:\s*true/
        );
    }
);

test(
    'Broadcast deletion removes canonical Notification Center mirrors',
    () => {
        const source = read('server.js');

        assert.match(
            source,
            /async function deleteCommunicationsBroadcastCascade/
        );

        assert.match(
            source,
            /DELETE FROM notification_deliveries/
        );

        assert.match(
            source,
            /DELETE FROM notification_recipients/
        );

        assert.match(
            source,
            /DELETE FROM notification_events/
        );

        assert.match(
            source,
            /source_type = \?[\s\S]{0,160}source_id = \?/
        );

        assert.match(
            source,
            /DELETE FROM user_notifications/
        );

        assert.match(
            source,
            /DELETE FROM announcements/
        );

        assert.match(
            source,
            /BEGIN IMMEDIATE TRANSACTION/
        );

        assert.match(
            source,
            /ROLLBACK/
        );

        assert.match(
            source,
            /COMMIT/
        );

        const directDeletes =
            (
                source.match(
                    /DELETE FROM announcements\s+WHERE id = \?/g
                ) || []
            ).length;

        assert.equal(
            directDeletes,
            1,
            'announcement deletion should be centralized in the cascade helper'
        );
    }
);

test(
    'Strong Admin Inbox deletion uses the same Broadcast cleanup helper',
    () => {
        const source = read('server.js');

        const start =
            source.indexOf(
                "app.delete('/api/communications/inbox/:id'"
            );

        const end =
            source.indexOf(
                "app.get('/api/leaderboards/",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route =
            source.slice(start, end);

        assert.match(
            route,
            /isStrongAdmin\(req\.auth\)/
        );

        assert.match(
            route,
            /deleteCommunicationsBroadcastCascade/
        );

        assert.doesNotMatch(
            route,
            /DELETE FROM announcements/
        );
    }
);

test(
    'Journal policy 403 renders an unknown state instead of a checked default',
    () => {
        const fs = require('node:fs');
        const path = require('node:path');

        const controller = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                'public',
                'js',
                'journal-policy-admin.js'
            ),
            'utf8'
        );

        const forbiddenStart =
            controller.indexOf(
                'if (response.status === 403)'
            );

        assert.notEqual(
            forbiddenStart,
            -1,
            '403 policy branch must remain explicit'
        );

        const forbiddenEnd =
            controller.indexOf(
                'const policy =',
                forbiddenStart
            );

        assert.notEqual(
            forbiddenEnd,
            -1,
            '403 branch must end before successful policy processing'
        );

        const forbiddenBranch =
            controller.slice(
                forbiddenStart,
                forbiddenEnd
            );

        /*
         * The current controller centralizes unknown-state behavior in
         * showUnknown(). The 403 branch must delegate to that helper
         * instead of duplicating the state assignments inline.
         */
        assert.match(
            forbiddenBranch,
            /showUnknown\s*\(/
        );

        assert.match(
            forbiddenBranch,
            /Strong Admin account/
        );

        const helperStart =
            controller.indexOf(
                'function showUnknown(message)'
            );

        const helperEnd =
            controller.indexOf(
                'function showLoaded',
                helperStart
            );

        assert.notEqual(
            helperStart,
            -1,
            'showUnknown helper must exist'
        );

        assert.notEqual(
            helperEnd,
            -1,
            'showUnknown helper must have a bounded definition'
        );

        const helper =
            controller.slice(
                helperStart,
                helperEnd
            );

        assert.match(
            helper,
            /section\.hidden\s*=\s*false/
        );

        assert.match(
            helper,
            /loaded\s*=\s*false/
        );

        assert.match(
            helper,
            /savedValue\s*=\s*null/
        );

        assert.match(
            helper,
            /toggle\.disabled\s*=\s*true/
        );

        assert.match(
            helper,
            /toggle\.checked\s*=\s*false/
        );

        assert.match(
            helper,
            /toggle\.indeterminate\s*=\s*true/
        );

        assert.match(
            helper,
            /aria-checked/
        );
    }
);

test(
    'Checkpoint 3 client assets are cache-busted coherently',
    () => {
        const index =
            read('public/index.html');

        const sw =
            read('public/sw.js');

        assert.match(
            index,
            /\/js\/v10-expansion\.js\?v=20260922c3/
        );

        assert.match(
            index,
            /\/js\/journal-policy-admin\.js\?v=20260922c4/
        );

        assert.match(
            sw,
            /fog-portal-v83/
        );

        assert.match(
            sw,
            /\/js\/v10-expansion\.js\?v=20260922c3/
        );

        assert.match(
            sw,
            /\/js\/journal-policy-admin\.js\?v=20260922c4/
        );
    }
);

test(
    'Broadcast UI distinguishes Portal publication from Push delivery',
    () => {
        const source =
            read(
                'public/js/v10-expansion.js'
            );

        assert.match(
            source,
            /Broadcast published!/
        );

        assert.match(
            source,
            /data\.pushStatus === 'unavailable'/
        );

        assert.match(
            source,
            /No subscribed devices were available for Push delivery/
        );
    }
);
