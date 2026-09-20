'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');

const Spotlight = require('../lib/community-spotlight');

function openDb() {
    return new sqlite3.Database(':memory:');
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, error => error ? reject(error) : resolve());
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(error => error ? reject(error) : resolve());
    });
}

async function createBaseSchema(db) {
    await exec(db, `
        PRAGMA foreign_keys = ON;
        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER
        );
    `);
    await Spotlight.initializeSchema(db);
}

const NOW = '2026-09-20 10:00:00';

test('Community Spotlight schema is additive and replay-safe', async t => {
    const db = openDb();
    t.after(() => close(db));

    await createBaseSchema(db);
    await Spotlight.initializeSchema(db);

    for (const table of [
        'community_spotlight_campaigns',
        'community_spotlight_member_state'
    ]) {
        const columns = await all(db, `PRAGMA table_info(${table})`);
        assert.ok(columns.length > 0, table);
    }

    const campaignIndexes = await all(db, `PRAGMA index_list(community_spotlight_campaigns)`);
    const stateIndexes = await all(db, `PRAGMA index_list(community_spotlight_member_state)`);
    assert.ok(campaignIndexes.some(index => index.name === 'community_spotlight_campaign_active_idx'));
    assert.ok(stateIndexes.some(index => index.name === 'community_spotlight_member_state_member_idx'));
});

test('highest-priority eligible campaign wins and permanent dismissal is version-scoped', async t => {
    const db = openDb();
    t.after(() => close(db));

    await createBaseSchema(db);
    for (const [id, age] of [[1, 18], [2, 30], [3, 15]]) {
        await run(db, 'INSERT INTO youth (id, name, age) VALUES (?, ?, ?)', [id, `Member ${id}`, age]);
    }

    const general = await Spotlight.createCampaign(db, {
        campaign_key: 'general-welcome',
        internal_name: 'General Welcome',
        template_type: 'simple_announcement',
        title: 'Welcome',
        message: 'Welcome to the community.',
        audience_type: 'all',
        audience_json: {},
        priority: 20,
        display_frequency: 'once',
        is_enabled: true
    }, { actor: 'TEST', now: NOW });

    const focused = await Spotlight.createCampaign(db, {
        campaign_key: 'focused-prayer',
        internal_name: 'Focused Prayer Invitation',
        template_type: 'invitation',
        title: 'Let us pray',
        message: 'An invitation to pray together.',
        primary_label: 'Join',
        primary_action_type: 'prayer_covenant_join',
        audience_type: 'selected_members',
        audience_json: { youth_ids: [1, 3] },
        priority: 60,
        display_frequency: 'every_login',
        allow_dont_show_again: true,
        is_enabled: true
    }, { actor: 'TEST', now: NOW });

    const memberOneFirst = await Spotlight.getNextEligibleCampaign(db, 1, { now: NOW });
    assert.equal(memberOneFirst.campaign.id, focused.id);

    const memberTwoFirst = await Spotlight.getNextEligibleCampaign(db, 2, { now: NOW });
    assert.equal(memberTwoFirst.campaign.id, general.id);

    await Spotlight.recordImpression(db, focused.id, 1, { now: NOW });
    const memberOneAfterImpression = await Spotlight.getNextEligibleCampaign(
        db,
        1,
        { now: '2026-09-20 10:05:00' }
    );
    assert.equal(memberOneAfterImpression.campaign.id, focused.id);

    await Spotlight.recordDismissal(db, focused.id, 1, {
        permanent: true,
        now: '2026-09-20 10:06:00'
    });

    const afterDismissal = await Spotlight.getNextEligibleCampaign(
        db,
        1,
        { now: '2026-09-20 10:07:00' }
    );
    assert.equal(afterDismissal.campaign.id, general.id);

    await Spotlight.recordImpression(db, general.id, 1, {
        now: '2026-09-20 10:08:00'
    });

    assert.equal(
        await Spotlight.getNextEligibleCampaign(
            db,
            1,
            { now: '2026-09-20 10:09:00' }
        ),
        null
    );

    const relaunched = await Spotlight.relaunchCampaign(
        db,
        focused.id,
        { is_enabled: true },
        { actor: 'TEST', now: '2026-09-20 10:10:00' }
    );

    assert.equal(relaunched.version, 2);
    assert.notEqual(relaunched.id, focused.id);

    const afterRelaunch = await Spotlight.getNextEligibleCampaign(
        db,
        1,
        { now: '2026-09-20 10:11:00' }
    );
    assert.equal(afterRelaunch.campaign.id, relaunched.id);

    const analytics = await Spotlight.getAnalytics(db, focused.id);
    assert.equal(analytics.eligible_members, 2);
    assert.equal(analytics.shown_members, 1);
    assert.equal(analytics.total_views, 1);
    assert.equal(analytics.dismissed_members, 1);
});

test('frequency, audience, action, and completion semantics are account-side and durable', async t => {
    const db = openDb();
    t.after(() => close(db));

    await createBaseSchema(db);
    await run(db, 'INSERT INTO youth (id, name, age) VALUES (?, ?, ?)', [1, 'Member 1', 19]);
    await run(db, 'INSERT INTO youth (id, name, age) VALUES (?, ?, ?)', [2, 'Member 2', 35]);

    const daily = await Spotlight.createCampaign(db, {
        campaign_key: 'daily-youth',
        internal_name: 'Daily Youth Spotlight',
        template_type: 'challenge',
        title: 'Daily Challenge',
        message: 'A daily invitation.',
        audience_type: 'age_range',
        audience_json: { min_age: 11, max_age: 21 },
        priority: 40,
        display_frequency: 'daily',
        is_enabled: true
    }, { actor: 'TEST', now: NOW });

    assert.equal(
        (await Spotlight.getNextEligibleCampaign(db, 1, { now: NOW })).campaign.id,
        daily.id
    );
    assert.equal(await Spotlight.getNextEligibleCampaign(db, 2, { now: NOW }), null);

    await Spotlight.recordImpression(db, daily.id, 1, { now: NOW });
    assert.equal(
        await Spotlight.getNextEligibleCampaign(
            db,
            1,
            { now: '2026-09-20 18:00:00' }
        ),
        null
    );
    assert.equal(
        (await Spotlight.getNextEligibleCampaign(
            db,
            1,
            { now: '2026-09-21 08:00:00' }
        )).campaign.id,
        daily.id
    );

    const untilAction = await Spotlight.createCampaign(db, {
        campaign_key: 'serve-now',
        internal_name: 'Serve Invitation',
        template_type: 'invitation',
        title: 'Serve Together',
        message: 'An invitation to serve.',
        primary_label: 'View opportunity',
        primary_action_type: 'internal_route',
        primary_action_value: '/ministries',
        audience_type: 'all',
        audience_json: {},
        priority: 80,
        display_frequency: 'until_action',
        is_enabled: true
    }, { actor: 'TEST', now: NOW });

    assert.equal(
        (await Spotlight.getNextEligibleCampaign(db, 1, {
            now: '2026-09-21 08:01:00'
        })).campaign.id,
        untilAction.id
    );

    const action = await Spotlight.recordAction(
        db,
        untilAction.id,
        1,
        { now: '2026-09-21 08:02:00' }
    );
    assert.equal(action.campaign.primary_action_type, 'internal_route');
    assert.equal(action.campaign.primary_action_value, '/ministries');
    assert.ok(action.state.clicked_at);

    const afterAction = await Spotlight.getNextEligibleCampaign(
        db,
        1,
        { now: '2026-09-21 08:03:00' }
    );
    assert.equal(afterAction.campaign.id, daily.id);

    await Spotlight.recordCompletion(
        db,
        daily.id,
        1,
        { now: '2026-09-21 08:04:00' }
    );
    assert.equal(
        await Spotlight.getNextEligibleCampaign(
            db,
            1,
            { now: '2026-09-22 08:00:00' }
        ),
        null
    );
});

test('campaign validation rejects unsafe or contradictory configuration', async t => {
    const db = openDb();
    t.after(() => close(db));
    await createBaseSchema(db);

    await assert.rejects(
        Spotlight.createCampaign(db, {
            campaign_key: 'unsafe-external',
            internal_name: 'Unsafe',
            title: 'Unsafe',
            message: 'Unsafe',
            primary_action_type: 'external_url',
            primary_action_value: 'http://example.com',
            audience_type: 'all',
            audience_json: {},
            is_enabled: true
        }, { actor: 'TEST', now: NOW }),
        /HTTPS/
    );

    await assert.rejects(
        Spotlight.createCampaign(db, {
            campaign_key: 'bad-age',
            internal_name: 'Bad Age',
            title: 'Bad Age',
            message: 'Bad Age',
            audience_type: 'age_range',
            audience_json: { min_age: 30, max_age: 20 }
        }, { actor: 'TEST', now: NOW }),
        /min_age/
    );
});

test('server runtime schema includes Community Spotlight tables without member UI activation', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

    assert.match(source, /community_spotlight_campaigns:\s*Object\.freeze/);
    assert.match(source, /community_spotlight_member_state:\s*Object\.freeze/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS community_spotlight_campaigns/);
    assert.match(source, /CREATE TABLE IF NOT EXISTS community_spotlight_member_state/);

    assert.doesNotMatch(source, /\/api\/community-spotlight\/next/);
    assert.doesNotMatch(source, /Community Spotlight modal/i);
});
