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

const Dashboard =
    require(
        '../public/js/journey-dashboard'
    );

const source =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'journey-dashboard.js'
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

const serviceWorker =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'sw.js'
        ),
        'utf8'
    );

function between(
    startMarker,
    endMarker
) {
    const start =
        source.indexOf(
            startMarker
        );

    assert.ok(
        start >= 0,
        `Missing ${startMarker}`
    );

    const end =
        source.indexOf(
            endMarker,
            start +
            startMarker.length
        );

    assert.ok(
        end > start,
        `Missing boundary ${endMarker}`
    );

    return source.slice(
        start,
        end
    );
}

test(
    'Daily Prayer Covenant uses the authenticated Covenant-only Prayer Pal endpoint',
    () => {
        assert.match(
            source,
            /fetch\(\s*'\/api\/prayer-covenant\/daily-pal'/
        );

        assert.match(
            source,
            /partner\.available === true/
        );

        assert.match(
            source,
            /partner\.prayerPal\.youthId/
        );

        assert.match(
            source,
            /window\.openDailyPrayerCovenant/
        );

        assert.doesNotMatch(
            source,
            /`\/api\/prayer-pals\/current\/\$\{encodeURIComponent\(String\(member\.id\)\)\}`/
        );
    }
);

test(
    'the Covenant flow contains exactly the ten established prayer starters',
    () => {
        assert.equal(
            Array.isArray(
                Dashboard.PRAYER_STARTERS
            ),
            true
        );

        assert.equal(
            Dashboard.PRAYER_STARTERS.length,
            10
        );

        assert.deepEqual(
            Dashboard.PRAYER_STARTERS.map(
                prayer =>
                    prayer.title
            ),
            [
                'Peace & Strength',
                'Blessing & Love',
                'Breakthrough',
                'Healing & Comfort',
                'Guidance & Wisdom',
                'Protection',
                'Anxiety & Worry',
                'Work & Provision',
                'Relationships',
                'Spiritual Fire'
            ]
        );
    }
);

test(
    'selecting or reviewing a starter cannot send a prayer',
    () => {
        const starterBlock =
            between(
                'function renderDailyPrayerStarters()',
                'window.closeDailyPrayerCovenant'
            );

        const reviewBlock =
            between(
                'window.reviewDailyPrayerCovenant =',
                'window.editDailyPrayerCovenant ='
            );

        assert.match(
            starterBlock,
            /textarea\.value\s*=/
        );

        assert.match(
            starterBlock,
            /button\.textContent/
        );

        assert.doesNotMatch(
            starterBlock,
            /fetch\(/
        );

        assert.doesNotMatch(
            starterBlock,
            /innerHTML/
        );

        assert.match(
            reviewBlock,
            /dailyPrayerDraft/
        );

        assert.match(
            reviewBlock,
            /reviewText\.textContent/
        );

        assert.doesNotMatch(
            reviewBlock,
            /fetch\(/
        );
    }
);

test(
    'only Confirm and Send posts the reviewed prayer to the daily Covenant route',
    () => {
        const confirmBlock =
            between(
                'window.confirmDailyPrayerCovenant =',
                "document.addEventListener("
            );

        assert.match(
            confirmBlock,
            /\/api\/prayer-covenant\/daily-pal\/send/
        );

        assert.match(
            confirmBlock,
            /receiver_id:\s*dailyPrayerDraft\.receiverId/
        );

        assert.match(
            confirmBlock,
            /message:\s*dailyPrayerDraft\.message/
        );

        assert.doesNotMatch(
            confirmBlock,
            /sender_id/
        );

        assert.doesNotMatch(
            confirmBlock,
            /sender_name/
        );

        assert.match(
            confirmBlock,
            /Thank You or a Praise Report/
        );
    }
);

test(
    'Daily Covenant modal separates compose from Review and Confirm with pastoral privacy guidance',
    () => {
        assert.match(
            index,
            /id="dailyCovenantPrayerModal"/
        );

        assert.match(
            index,
            /id="dailyCovenantComposeStep"/
        );

        assert.match(
            index,
            /id="dailyCovenantReviewStep"/
        );

        assert.match(
            index,
            />\s*Review Prayer\s*</
        );

        assert.match(
            index,
            /Confirm &amp; Send/
        );

        assert.match(
            index,
            /Faith-filled, hopeful, and encouraging/
        );

        assert.match(
            index,
            /Mindful of privacy and sensitive personal details/
        );

        assert.match(
            index,
            /Prayer-centered rather than advice, judgment, or diagnosis/
        );

        assert.match(
            index,
            /Thank You/
        );

        assert.match(
            index,
            /Praise Report/
        );
    }
);

test(
    'weekly Prayer Partner guided prayer remains separate from Daily Covenant prayer',
    () => {
        assert.match(
            index,
            /id="guidedPrayerModal"/
        );

        assert.match(
            index,
            /window\.openGuidedPrayer = function\(palName, palId\)/
        );

        assert.match(
            index,
            /fetch\('\/api\/prayer-pals\/send'/
        );

        assert.match(
            source,
            /window\.submitGuidedPrayer = async function/
        );

        assert.match(
            source,
            /fetch\('\/api\/prayer-pals\/send'/
        );

        assert.match(
            index,
            /id="dailyCovenantPrayerModal"/
        );

        assert.match(
            source,
            /fetch\(\s*'\/api\/prayer-covenant\/daily-pal'/
        );

        assert.match(
            source,
            /\/api\/prayer-covenant\/daily-pal\/send/
        );
    }
);

test(
    'Step 3B publishes Journey v7 through PWA v63',
    () => {
        assert.match(
            index,
            /\/js\/journey-dashboard\.js\?v=7/
        );

        assert.match(
            serviceWorker,
            /const CACHE_NAME = 'fog-portal-v63'/
        );

        assert.match(
            serviceWorker,
            /'\/js\/journey-dashboard\.js\?v=7'/
        );
    }
);
