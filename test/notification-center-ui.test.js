const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const html = fs.readFileSync(
    path.join(root, 'public', 'index.html'),
    'utf8'
);

const app = fs.readFileSync(
    path.join(root, 'public', 'js', 'app.js'),
    'utf8'
);

const sw = fs.readFileSync(
    path.join(root, 'public', 'sw.js'),
    'utf8'
);

test(
    'header exposes Notification bell and unread badge instead of old question-mark Help control',
    () => {
        assert.match(
            html,
            /id="headerNotificationBell"/
        );

        assert.match(
            html,
            /id="headerNotificationBadge"/
        );

        assert.match(
            html,
            /onclick="openNotificationCenter\(\)"/
        );

        assert.doesNotMatch(
            html,
            /id="headerHelpLink"/
        );
    }
);

test(
    'unified Inbox preserves Updates, private Prayer messages, and authenticated Announcements',
    () => {
        assert.match(
            app,
            /\/api\/notifications\?limit=100/
        );

        assert.match(
            app,
            /\/api\/notifications\/unread-count/
        );

        assert.match(
            app,
            /\/api\/inbox\/personal\/\$\{memberId\}/
        );

        assert.match(
            app,
            /\/api\/communications\/inbox/
        );

        assert.doesNotMatch(
            app,
            /communications\/inbox\?username=/
        );

        assert.match(
            app,
            /setNotificationInboxFilter/
        );

        assert.match(
            app,
            /markAllNotificationsRead/
        );
    }
);

test(
    'canonical Notification cards use DOM text APIs and same-origin action validation',
    () => {
        const marker = app.indexOf(
            'PHASE 2C-B3 CANONICAL NOTIFICATION CENTER UI'
        );

        assert.ok(marker >= 0);

        const block = app.slice(marker);

        assert.match(
            block,
            /document\.createElement/
        );

        assert.match(
            block,
            /\.textContent\s*=/
        );

        assert.match(
            block,
            /safeNotificationActionUrl/
        );

        assert.match(
            block,
            /url\.origin\s*!==\s*window\.location\.origin/
        );
    }
);

test(
    'Profile exposes master channels, seven categories, reminder time, and quiet hours',
    () => {
        for (const id of [
            'notifPrefPushEnabled',
            'notifPrefEmailEnabled',
            'notifPrefPrayerDailyGrowth',
            'notifPrefJourneyProgress',
            'notifPrefEventsFormation',
            'notifPrefMembershipCommunity',
            'notifPrefMinistryServant',
            'notifPrefPrayerPartner',
            'notifPrefGamesGrowth',
            'notifPrefPrayerTime',
            'notifPrefQuietStart',
            'notifPrefQuietEnd',
            'saveNotificationPreferencesBtn'
        ]) {
            assert.match(
                html,
                new RegExp(
                    `id="${id}"`
                )
            );
        }

        assert.match(
            app,
            /\/api\/notifications\/preferences/
        );

        assert.match(
            app,
            /method:\s*'PUT'/
        );
    }
);

test(
    'PWA shell advances coherently to app 13.3 and cache v29',
    () => {
        assert.match(
            html,
            /\/js\/app\.js\?v=13\.3/
        );

        assert.match(
            sw,
            /fog-portal-v33/
        );

        assert.match(
            sw,
            /\/js\/app\.js\?v=13\.3/
        );

        assert.doesNotMatch(
            sw,
            /fog-portal-v12/
        );
    }
);
