'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const sqlite3 =
    require('sqlite3').verbose();

const Spotlight =
    require('../lib/community-spotlight');

const root =
    path.resolve(__dirname, '..');

function run(db, sql, params = []) {
    return new Promise(
        (resolve, reject) => {
            db.run(
                sql,
                params,
                function(error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        lastID:
                            this.lastID,
                        changes:
                            this.changes
                    });
                }
            );
        }
    );
}

function close(db) {
    return new Promise(
        (resolve, reject) => {
            db.close(
                error => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                }
            );
        }
    );
}

async function createFixture() {
    const db =
        new sqlite3.Database(
            ':memory:'
        );

    await run(
        db,
        `CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            age INTEGER
        )`
    );

    await Spotlight.initializeSchema(
        db
    );

    await run(
        db,
        `INSERT INTO youth (id, age)
         VALUES (1, 30)`
    );

    return db;
}

async function insertCampaign(
    db,
    {
        key,
        priority,
        actionType
    }
) {
    const result =
        await run(
            db,
            `INSERT INTO community_spotlight_campaigns (
                campaign_key,
                version,
                internal_name,
                template_type,
                title,
                message,
                primary_action_type,
                audience_type,
                audience_json,
                priority,
                display_frequency,
                allow_dont_show_again,
                is_enabled,
                is_paused,
                is_archived,
                created_by,
                created_at,
                updated_at
             ) VALUES (
                ?, 1, ?, 'invitation', ?, ?,
                ?, 'all', '{}', ?, 'every_login',
                1, 1, 0, 0, 'test',
                '2026-09-20 12:00:00',
                '2026-09-20 12:00:00'
             )`,
            [
                key,
                key,
                key,
                `${key} message`,
                actionType,
                priority
            ]
        );

    return result.lastID;
}

test(
    'campaign filter falls through from a suppressed Prayer Covenant invitation',
    async () => {
        const db =
            await createFixture();

        try {
            const prayerId =
                await insertCampaign(
                    db,
                    {
                        key:
                            'prayer-invite',
                        priority:
                            60,
                        actionType:
                            'prayer_covenant_join'
                    }
                );

            const generalId =
                await insertCampaign(
                    db,
                    {
                        key:
                            'general-invite',
                        priority:
                            40,
                        actionType:
                            'none'
                    }
                );

            const normal =
                await Spotlight
                    .getNextEligibleCampaign(
                        db,
                        1,
                        {
                            now:
                                '2026-09-20 12:30:00'
                        }
                    );

            assert.equal(
                normal.campaign.id,
                prayerId
            );

            const filtered =
                await Spotlight
                    .getNextEligibleCampaign(
                        db,
                        1,
                        {
                            now:
                                '2026-09-20 12:30:00',
                            campaignFilter:
                                async campaign =>
                                    campaign
                                        .primary_action_type !==
                                    'prayer_covenant_join'
                        }
                    );

            assert.equal(
                filtered.campaign.id,
                generalId
            );
        } finally {
            await close(db);
        }
    }
);

test(
    'server suppression uses canonical Growth Journey state without mutating enrollment',
    () => {
        const server =
            fs.readFileSync(
                path.join(
                    root,
                    'server.js'
                ),
                'utf8'
            );

        const start =
            server.indexOf(
                'async function isCommunitySpotlightCampaignEligibleForMember'
            );

        const end =
            server.indexOf(
                "app.get(\n    '/api/community-spotlight/next'",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const helper =
            server.slice(
                start,
                end
            );

        assert.match(
            helper,
            /GrowthJourney\.getDefaultOnboardingStatus/
        );

        assert.match(
            helper,
            /onboarding\.enrollment/
        );

        assert.match(
            helper,
            /Boolean\(onboarding\.paused\)/
        );

        assert.doesNotMatch(
            helper,
            /enrollPrayerCovenantChallenge/
        );

        assert.doesNotMatch(
            helper,
            /recordCompletion|recordAction/
        );

        const nextStart =
            server.indexOf(
                "app.get(\n    '/api/community-spotlight/next'"
            );

        const impressionStart =
            server.indexOf(
                "app.post(\n    '/api/community-spotlight/:campaignId/impression'"
            );

        const dismissStart =
            server.indexOf(
                "app.post(\n    '/api/community-spotlight/:campaignId/dismiss'"
            );

        const next =
            server.slice(
                nextStart,
                impressionStart
            );

        const impression =
            server.slice(
                impressionStart,
                dismissStart
            );

        assert.match(
            next,
            /campaignFilter/
        );

        assert.match(
            impression,
            /campaignFilter/
        );
    }
);

test(
    'canonical enrollment occurs only inside explicit CTA flow before Spotlight action and completion',
    () => {
        const member =
            fs.readFileSync(
                path.join(
                    root,
                    'public/js/community-spotlight-member.js'
                ),
                'utf8'
            );

        const lookupStart =
            member.indexOf(
                'async function lookupNextCampaign'
            );

        const lookupEnd =
            member.indexOf(
                'function beginAuthenticatedSession',
                lookupStart
            );

        const lookup =
            member.slice(
                lookupStart,
                lookupEnd
            );

        assert.doesNotMatch(
            lookup,
            /prayer-covenant\/join/
        );

        const flowStart =
            member.indexOf(
                'async function joinPrayerCovenantFromSpotlight'
            );

        const flowEnd =
            member.indexOf(
                'async function handlePrimaryAction',
                flowStart
            );

        assert.ok(
            flowStart >= 0
        );

        assert.ok(
            flowEnd >
            flowStart
        );

        const flow =
            member.slice(
                flowStart,
                flowEnd
            );

        const joinIndex =
            flow.indexOf(
                '/api/growth-journey/prayer-covenant/join'
            );

        const actionIndex =
            flow.indexOf(
                'await recordSpotlightAction'
            );

        const completionIndex =
            flow.indexOf(
                'await completeSpotlightCampaign'
            );

        assert.ok(
            joinIndex >= 0
        );

        assert.ok(
            actionIndex >
            joinIndex
        );

        assert.ok(
            completionIndex >
            actionIndex
        );

        assert.doesNotMatch(
            member,
            /enrollPrayerCovenantChallenge/
        );

        assert.match(
            member,
            /Welcome to the Covenant 🙏/
        );

        assert.match(
            member,
            /completionAcknowledged/
        );
    }
);
