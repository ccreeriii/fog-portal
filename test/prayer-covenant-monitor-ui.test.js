'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot =
    path.join(__dirname, '..');

const html =
    fs.readFileSync(
        path.join(
            repositoryRoot,
            'public',
            'index.html'
        ),
        'utf8'
    );

const source =
    fs.readFileSync(
        path.join(
            repositoryRoot,
            'public',
            'js',
            'prayer-covenant-monitor.js'
        ),
        'utf8'
    );

const serviceWorker =
    fs.readFileSync(
        path.join(
            repositoryRoot,
            'public',
            'sw.js'
        ),
        'utf8'
    );

test(
    'Prayer Covenant Monitor is published only inside the existing restricted Prayer leadership tab',
    () => {
        assert.match(
            html,
            /id="watchtowerTab"/
        );

        assert.match(
            html,
            /id="prayerMonitorHeading"/
        );

        assert.match(
            html,
            /21-Day Prayer Covenant Monitor/
        );

        assert.match(
            html,
            /Watchtower coverage is separate from personal Prayer Covenant completion/
        );

        assert.match(
            html,
            /id="prayerMonitorActiveCount"/
        );

        assert.match(
            html,
            /id="prayerMonitorPrayedCount"/
        );

        assert.match(
            html,
            /id="prayerMonitorWaitingCount"/
        );

        assert.match(
            html,
            /id="prayerMonitorCompletedCount"/
        );

        assert.match(
            html,
            /id="prayerMonitorPausedCount"/
        );

        assert.match(
            html,
            /id="prayerMonitorIssuesCount"/
        );
    }
);

test(
    'Prayer Covenant Monitor client is access_prayer_journey gated and reads only protected monitor APIs',
    () => {
        assert.match(
            source,
            /const PERMISSION\s*=\s*'access_prayer_journey'/
        );

        assert.match(
            source,
            /window\.hasPerm/
        );

        assert.match(
            source,
            /\/api\/admin\/prayer-covenant-monitor/
        );

        assert.match(
            source,
            /\/api\/admin\/prayer-covenant-monitor\/\$\{encodeURIComponent\(participant\.enrollmentId\)\}/
        );

        assert.doesNotMatch(
            source,
            /method:\s*'(?:POST|PUT|PATCH|DELETE)'/
        );
    }
);

test(
    'Prayer Covenant Monitor safely renders member-derived data without innerHTML',
    () => {
        assert.match(
            source,
            /textContent/
        );

        assert.match(
            source,
            /document\.createElement/
        );

        assert.doesNotMatch(
            source,
            /\.innerHTML\s*=/
        );

        assert.doesNotMatch(
            source,
            /insertAdjacentHTML/
        );

        assert.doesNotMatch(
            source,
            /document\.write/
        );
    }
);

test(
    'Prayer Covenant Monitor presents gaps pastorally without resetting covenant progress',
    () => {
        assert.match(
            html,
            /Calendar gaps never reset a member’s 21-day progress/
        );

        assert.match(
            source,
            /No prayer recorded/
        );

        assert.match(
            source,
            /Calendar gaps do not reset the 21-Day Prayer Covenant/
        );

        assert.match(
            source,
            /completedPrayerDays/
        );

        assert.doesNotMatch(
            source,
            /reset.{0,80}completedPrayerDays/i
        );
    }
);

test(
    'Data Review remains separate from ordinary participant status',
    () => {
        assert.match(
            html,
            /data-prayer-monitor-filter="data_review"/
        );

        assert.match(
            source,
            /participant\.dataIssue/
        );

        assert.match(
            source,
            /Data Review/
        );

        assert.match(
            source,
            /dataIssueReasons/
        );
    }
);

test(
    'monitor asset and service-worker revision are synchronized',
    () => {
        assert.match(
            html,
            /\/js\/prayer-covenant-monitor\.js\?v=4/
        );

        assert.match(
            serviceWorker,
            /fog-portal-v66/
        );

        assert.match(
            serviceWorker,
            /\/js\/prayer-covenant-monitor\.js\?v=4/
        );

        assert.match(
            serviceWorker,
            /\/js\/watchtower\.js\?v=2/
        );
    }
);
