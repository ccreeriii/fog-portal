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
        const source =
            read(
                'public/js/journal-policy-admin.js'
            );

        assert.match(
            source,
            /let savedValue = null;/
        );

        const marker =
            "if (response.status === 403)";

        const start =
            source.indexOf(marker);

        const end =
            source.indexOf(
                "const policy =",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const forbidden =
            source.slice(start, end);

        assert.match(
            forbidden,
            /toggle\.checked = false/
        );

        assert.match(
            forbidden,
            /toggle\.indeterminate = true/
        );

        assert.match(
            forbidden,
            /aria-checked/
        );

        assert.match(
            forbidden,
            /current policy state is not shown/i
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
            /\/js\/journal-policy-admin\.js\?v=20260922c3/
        );

        assert.match(
            sw,
            /fog-portal-v82/
        );

        assert.match(
            sw,
            /\/js\/v10-expansion\.js\?v=20260922c3/
        );

        assert.match(
            sw,
            /\/js\/journal-policy-admin\.js\?v=20260922c3/
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
