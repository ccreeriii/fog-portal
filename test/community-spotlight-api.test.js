'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'server.js'),
    'utf8'
);

function literalCount(value) {
    return source.split(value).length - 1;
}

function routeBlock(method, route) {
    const needle = `app.${method}(\n    '${route}'`;
    const start = source.indexOf(needle);

    assert.ok(
        start >= 0,
        `${method.toUpperCase()} ${route} exists`
    );

    const tail = source.slice(start + 1);
    const next =
        tail.match(
            /\napp\.(?:get|post|put|patch|delete)\s*\(/
        );

    const end =
        next
            ? start + 1 + next.index
            : source.length;

    return source.slice(start, end);
}
function sourceBetween(startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);

    assert.ok(
        start >= 0,
        `start marker exists: ${startNeedle}`
    );

    const end = source.indexOf(
        endNeedle,
        start + startNeedle.length
    );

    assert.ok(
        end > start,
        `end marker exists: ${endNeedle}`
    );

    return source.slice(start, end);
}

test(
    'Community Spotlight has exactly one canonical API registration per Phase 1B route',
    () => {
        const routes = [
            ['get', '/api/community-spotlight/next'],
            ['post', '/api/community-spotlight/:campaignId/impression'],
            ['post', '/api/community-spotlight/:campaignId/dismiss'],
            ['post', '/api/community-spotlight/:campaignId/action'],
            ['post', '/api/community-spotlight/:campaignId/complete'],
            ['get', '/api/admin/community-spotlight/campaigns'],
            ['post', '/api/admin/community-spotlight/campaigns'],
            ['put', '/api/admin/community-spotlight/campaigns/:campaignId'],
            ['post', '/api/admin/community-spotlight/campaigns/:campaignId/relaunch'],
            ['get', '/api/admin/community-spotlight/campaigns/:campaignId/analytics']
        ];

        for (const [method, route] of routes) {
            assert.equal(
                literalCount(
                    `app.${method}(\n    '${route}'`
                ),
                1,
                `${method.toUpperCase()} ${route}`
            );
        }

        assert.equal(
            literalCount(
                "const CommunitySpotlight = require('./lib/community-spotlight');"
            ),
            1
        );
    }
);

test(
    'member Spotlight routes require canonical authentication, member binding, and legal acceptance',
    () => {
        for (const [method, route] of [
            ['get', '/api/community-spotlight/next'],
            ['post', '/api/community-spotlight/:campaignId/impression'],
            ['post', '/api/community-spotlight/:campaignId/dismiss'],
            ['post', '/api/community-spotlight/:campaignId/action'],
            ['post', '/api/community-spotlight/:campaignId/complete']
        ]) {
            const block = routeBlock(method, route);

            assert.match(
                block,
                /requireAuth,\s*requireCommunitySpotlightMember,\s*requireCommunitySpotlightLegalAcceptance/
            );
        }

        const memberBinding =
            sourceBetween(
                'function requireCommunitySpotlightMember',
                'async function loadShownCommunitySpotlightContext'
            );

        assert.match(
            memberBinding,
            /req\.auth\.youthId/
        );

        assert.match(
            memberBinding,
            /req\.communitySpotlightYouthId = youthId/
        );
    }
);

test(
    'Campaign Manager reads and mutations enforce the canonical Communications permission matrix',
    () => {
        for (const [method, route] of [
            ['get', '/api/admin/community-spotlight/campaigns'],
            ['get', '/api/admin/community-spotlight/campaigns/:campaignId/analytics']
        ]) {
            const block = routeBlock(method, route);

            assert.match(
                block,
                /requirePermission\('access_communications'\),\s*requireCommunitySpotlightLegalAcceptance/
            );

            assert.doesNotMatch(
                block,
                /requireAllPermissions\(\['access_communications', 'edit_entries'\]\)/
            );
        }

        for (const [method, route] of [
            ['post', '/api/admin/community-spotlight/campaigns'],
            ['put', '/api/admin/community-spotlight/campaigns/:campaignId'],
            ['post', '/api/admin/community-spotlight/campaigns/:campaignId/relaunch']
        ]) {
            const block = routeBlock(method, route);

            assert.match(
                block,
                /requireAllPermissions\(\['access_communications', 'edit_entries'\]\),\s*requireCommunitySpotlightLegalAcceptance/
            );
        }

        const legalGate =
            sourceBetween(
                'async function requireCommunitySpotlightLegalAcceptance',
                'function requireCommunitySpotlightMember'
            );

        assert.match(
            legalGate,
            /resolveLegalUserIdForLogin\(req && req\.auth\)/
        );

        assert.match(
            legalGate,
            /legalAcceptanceStore\.requiresCurrentAcceptance/
        );

        assert.match(
            legalGate,
            /legal_acceptance_required:\s*true/
        );

        const legalRequiredStatuses =
            legalGate.match(
                /sendCommunitySpotlightJson\(res,\s*428,/g
            ) || [];

        assert.equal(
            legalRequiredStatuses.length,
            2
        );

        assert.doesNotMatch(
            legalGate,
            /sendCommunitySpotlightJson\(res,\s*403,/
        );
    }
);

test(
    'member Spotlight identity can never be selected from request body or query parameters',
    () => {
        const block =
            sourceBetween(
                'Community Spotlight Phase 1B API foundation.',
                "app.get('/api/auth/me'"
            );

        assert.doesNotMatch(
            block,
            /req\.body\.youth_id/
        );

        assert.doesNotMatch(
            block,
            /req\.body\.youthId/
        );

        assert.doesNotMatch(
            block,
            /req\.query\.youth_id/
        );

        assert.doesNotMatch(
            block,
            /req\.query\.youthId/
        );

        assert.match(
            block,
            /req\.communitySpotlightYouthId/
        );
    }
);

test(
    'next and impression semantics preserve highest-priority server eligibility',
    () => {
        const next =
            routeBlock(
                'get',
                '/api/community-spotlight/next'
            );

        assert.match(
            next,
            /getNextEligibleCampaign/
        );

        assert.doesNotMatch(
            next,
            /recordImpression/
        );

        const impression =
            routeBlock(
                'post',
                '/api/community-spotlight/:campaignId/impression'
            );

        assert.match(
            impression,
            /getNextEligibleCampaign/
        );

        assert.match(
            impression,
            /Number\(eligible\.campaign\.id\) !== campaignId/
        );

        assert.match(
            impression,
            /recordImpression/
        );
    }
);

test(
    'member response projection excludes Campaign Manager-only configuration',
    () => {
        const projection =
            sourceBetween(
                'function projectCommunitySpotlightCampaignForMember',
                'function projectCommunitySpotlightStateForMember'
            );

        for (const required of [
            'title',
            'message',
            'primary_label',
            'primary_action_type',
            'primary_action_value',
            'secondary_label',
            'allow_dont_show_again'
        ]) {
            assert.match(
                projection,
                new RegExp(`campaign\\.${required}`)
            );
        }

        for (const forbidden of [
            'internal_name',
            'audience_json',
            'priority',
            'created_by',
            'updated_at'
        ]) {
            assert.doesNotMatch(
                projection,
                new RegExp(`campaign\\.${forbidden}`)
            );
        }
    }
);

test(
    'shown-state actions are account-side and Prayer Covenant execution remains deferred',
    () => {
        const action =
            routeBlock(
                'post',
                '/api/community-spotlight/:campaignId/action'
            );

        assert.match(
            action,
            /loadShownCommunitySpotlightContext/
        );

        assert.match(
            action,
            /recordAction/
        );

        assert.match(
            action,
            /executed:\s*false/
        );

        assert.doesNotMatch(
            action,
            /GrowthJourney\.enrollPrayerCovenantChallenge/
        );

        const complete =
            routeBlock(
                'post',
                '/api/community-spotlight/:campaignId/complete'
            );

        assert.match(
            complete,
            /context\.state\.clicked_at/
        );

        assert.match(
            complete,
            /recordCompletion/
        );

        const entirePhase =
            sourceBetween(
                'Community Spotlight Phase 1B API foundation.',
                "app.get('/api/auth/me'"
            );

        assert.doesNotMatch(
            entirePhase,
            /GrowthJourney\.enrollPrayerCovenantChallenge/
        );
    }
);

test(
    'Campaign Manager mutations use canonical actor attribution and durable audit logging',
    () => {
        const create =
            routeBlock(
                'post',
                '/api/admin/community-spotlight/campaigns'
            );

        const update =
            routeBlock(
                'put',
                '/api/admin/community-spotlight/campaigns/:campaignId'
            );

        const relaunch =
            routeBlock(
                'post',
                '/api/admin/community-spotlight/campaigns/:campaignId/relaunch'
            );

        for (const block of [
            create,
            update,
            relaunch
        ]) {
            assert.match(
                block,
                /getCommunitySpotlightActor\(req\)/
            );

            assert.match(
                block,
                /logActivity\(/
            );
        }

        assert.match(
            create,
            /COMMUNITY_SPOTLIGHT_CREATED/
        );

        assert.match(
            update,
            /COMMUNITY_SPOTLIGHT_UPDATED/
        );

        assert.match(
            relaunch,
            /COMMUNITY_SPOTLIGHT_RELAUNCHED/
        );

        const analytics =
            routeBlock(
                'get',
                '/api/admin/community-spotlight/campaigns/:campaignId/analytics'
            );

        assert.match(
            analytics,
            /CommunitySpotlight\s*\.getAnalytics/
        );

        assert.doesNotMatch(
            analytics,
            /logActivity\(/
        );
    }
);


test(
    'Prayer Covenant invitation eligibility is derived from canonical Growth Journey state',
    () => {
        const helperStart = source.indexOf(
            'async function isCommunitySpotlightCampaignEligibleForMember'
        );

        const helperEnd = source.indexOf(
            "app.get(\n    '/api/community-spotlight/next'",
            helperStart
        );

        assert.ok(
            helperStart >= 0 &&
            helperEnd > helperStart
        );

        const helper = source.slice(
            helperStart,
            helperEnd
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

        const next = routeBlock(
            'get',
            '/api/community-spotlight/next'
        );

        const impression = routeBlock(
            'post',
            '/api/community-spotlight/:campaignId/impression'
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
