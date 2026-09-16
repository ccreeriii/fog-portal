'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function source(relative) {
    return fs.readFileSync(
        path.join(root, relative),
        'utf8'
    );
}

const {
    FAQ_SECTIONS
} = require('../lib/help-faq');

function faqSection(id) {
    return FAQ_SECTIONS.find(
        section => section.id === id
    );
}

test('small groups support server-authoritative Campfire and Fire Circle identity', () => {
    const server = source('server.js');

    assert.match(
        server,
        /SMALL_GROUP_TYPES\s*=\s*new Set\(\['campfire', 'fire_circle'\]\)/
    );

    assert.match(
        server,
        /ALTER TABLE small_groups ADD COLUMN group_type TEXT DEFAULT 'campfire'/
    );

    assert.match(
        server,
        /Group type must be campfire or fire_circle/
    );

    assert.match(
        server,
        /group_type=COALESCE\(\?, group_type, 'campfire'\)/
    );
});

test('group create/edit UI exposes explicit group type selection', () => {
    const html = source('public/index.html');
    const v2 = source('public/js/v2-discipleship.js');

    assert.match(html, /id="sgCreateType"/);
    assert.match(html, /id="editSgType"/);
    assert.match(html, /value="campfire"/);
    assert.match(html, /value="fire_circle"/);

    assert.match(
        v2,
        /group_type:\s*document\.getElementById\('sgCreateType'\)\.value/
    );

    assert.match(
        v2,
        /group_type:\s*document\.getElementById\('editSgType'\)\.value/
    );
});

test('canonical group renderer displays safe Campfire and Fire Circle badges', () => {
    const polish =
        source('public/js/community-feature-polish.js');

    assert.match(
        polish,
        /group_type === 'fire_circle'/
    );

    assert.match(
        polish,
        /label: 'Fire Circle'/
    );

    assert.match(
        polish,
        /label: 'Campfire'/
    );

    assert.match(
        polish,
        /badge\.textContent/
    );
});

test('Prayer Wall requires pastoral review before the existing POST', () => {
    const html = source('public/index.html');
    const v2 = source('public/js/v2-discipleship.js');

    assert.match(
        html,
        /id="prayerGuidelinesModal"/
    );

    assert.match(
        html,
        /Review My Prayer/
    );

    assert.match(
        html,
        /Share Prayer Request/
    );

    assert.match(
        html,
        /Avoid naming or identifying another person/
    );

    const submitStart =
        v2.indexOf('submitPrayer: async function');

    const editStart =
        v2.indexOf(
            'openEditPrayerModal:',
            submitStart
        );

    assert.notEqual(submitStart, -1);
    assert.notEqual(editStart, -1);

    const submitFlow =
        v2.slice(submitStart, editStart);

    assert.match(
        submitFlow,
        /pendingPrayerSubmission/
    );

    assert.match(
        submitFlow,
        /confirmPrayerSubmission/
    );

    assert.doesNotMatch(
        submitFlow,
        /youth_id\s*:/
    );
});

test('FAQ uses current pastoral terminology and adds Discipleship leader help', () => {
    const journey =
        faqSection('my-journey-seven-milestones');

    assert.ok(journey);

    const journeyText =
        JSON.stringify(journey);

    assert.match(
        journeyText,
        /Encounter.*Belong.*Commit.*Discern.*Form.*Serve.*Be Sent/
    );

    assert.doesNotMatch(
        journeyText,
        /Connect & Belong/
    );

    const prayer =
        faqSection(
            'prayer-center-prayer-covenant-prayer-pal'
        );

    assert.match(
        JSON.stringify(prayer),
        /Prayer Partner/
    );

    const groups =
        faqSection('campfires-small-groups');

    assert.equal(
        groups.title,
        'Campfires & Fire Circles'
    );

    assert.match(
        JSON.stringify(groups),
        /stable, long-term discipleship group/
    );

    const leader =
        faqSection(
            'leader-help-discipleship-groups-growth'
        );

    assert.ok(leader);

    assert.deepEqual(
        leader.permissionAny,
        ['access_discipleship']
    );
});

test('pre-launch PWA revisions are synchronized', () => {
    const html = source('public/index.html');
    const sw = source('public/sw.js');

    assert.match(
        html,
        /\/js\/v2-discipleship\.js\?v=12\.4/
    );

    assert.match(
        html,
        /\/js\/community-feature-polish\.js\?v=5/
    );

    assert.match(
        sw,
        /fog-portal-v35/
    );

    assert.match(
        sw,
        /\/js\/v2-discipleship\.js\?v=12\.4/
    );

    assert.match(
        sw,
        /\/js\/community-feature-polish\.js\?v=5/
    );
});
