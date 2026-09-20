'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const index = fs.readFileSync(
    path.join(root, 'public/index.html'),
    'utf8'
);

const source = fs.readFileSync(
    path.join(
        root,
        'public/js/community-spotlight-member.js'
    ),
    'utf8'
);

const css = fs.readFileSync(
    path.join(
        root,
        'public/css/community-spotlight-member.css'
    ),
    'utf8'
);

const serviceWorker = fs.readFileSync(
    path.join(root, 'public/sw.js'),
    'utf8'
);

const server = fs.readFileSync(
    path.join(root, 'server.js'),
    'utf8'
);

function between(startMarker, endMarker) {
    const start =
        server.indexOf(startMarker);

    assert.ok(
        start >= 0,
        `missing start marker: ${startMarker}`
    );

    const end =
        server.indexOf(
            endMarker,
            start + startMarker.length
        );

    assert.ok(
        end > start,
        `missing end marker: ${endMarker}`
    );

    return server.slice(start, end);
}

test(
    'Spotlight legal middleware uses the canonical 428 legal-required contract',
    () => {
        const block = between(
            'async function requireCommunitySpotlightLegalAcceptance',
            'function requireCommunitySpotlightMember'
        );

        const statuses =
            block.match(
                /sendCommunitySpotlightJson\(res,\s*428,/g
            ) || [];

        assert.equal(statuses.length, 2);

        assert.doesNotMatch(
            block,
            /sendCommunitySpotlightJson\(res,\s*403,/
        );

        assert.match(
            block,
            /legal_acceptance_required:\s*true/
        );
    }
);

test(
    'member Spotlight loads only for an online unlocked authenticated canonical member',
    () => {
        assert.match(
            source,
            /koinoniaAuthStatus !== 'authenticated'/
        );

        assert.match(
            source,
            /koinoniaReadOnlyLock === true/
        );

        assert.match(
            source,
            /navigator\.onLine === false/
        );

        assert.match(
            source,
            /koinonia-offline-readonly/
        );

        assert.match(
            source,
            /currentMember/
        );

        assert.match(
            source,
            /Promise\.resolve\(root\.authReady\)/
        );

        assert.match(
            source,
            /refreshAuthenticatedIdentity/
        );
    }
);

test(
    'member Spotlight records the server impression before rendering and keeps every-login suppression in memory only',
    () => {
        const lookupStart =
            source.indexOf(
                'async function lookupNextCampaign'
            );

        const lookupEnd =
            source.indexOf(
                'function beginAuthenticatedSession',
                lookupStart
            );

        assert.ok(
            lookupStart >= 0 &&
            lookupEnd > lookupStart
        );

        const lookup =
            source.slice(
                lookupStart,
                lookupEnd
            );

        assert.ok(
            lookup.indexOf(
                'await recordImpression(campaign)'
            ) <
            lookup.indexOf(
                'renderCampaign(campaign)'
            )
        );

        assert.match(
            source,
            /sessionShownKeys:\s*new Set\(\)/
        );

        assert.match(
            source,
            /campaignSessionKey/
        );

        assert.doesNotMatch(
            source,
            /localStorage|sessionStorage|indexedDB/
        );
    }
);

test(
    'Maybe Later and permanent dismissal use the canonical dismiss endpoint without fabricating completion',
    () => {
        const dismissStart =
            source.indexOf(
                'async function dismissActiveCampaign'
            );

        const dismissEnd =
            source.indexOf(
                'function navigateRecordedAction',
                dismissStart
            );

        assert.ok(
            dismissStart >= 0 &&
            dismissEnd > dismissStart
        );

        const dismissSource =
            source.slice(
                dismissStart,
                dismissEnd
            );

        assert.match(
            dismissSource,
            /\/dismiss/
        );

        assert.match(
            dismissSource,
            /dont_show_again:\s*permanent/
        );

        assert.match(
            dismissSource,
            /allow_dont_show_again === true/
        );

        assert.match(
            dismissSource,
            /completionAcknowledged/
        );

        assert.doesNotMatch(
            dismissSource,
            /\/complete/
        );
    }
);

test(
    'Prayer Covenant CTA uses the canonical join route only after explicit member action and then completes Spotlight',
    () => {
        assert.match(
            source,
            /\/api\/growth-journey\/prayer-covenant\/join/
        );

        assert.match(
            source,
            /recordSpotlightAction/
        );

        assert.match(
            source,
            /completeSpotlightCampaign/
        );

        assert.match(
            source,
            /completionAcknowledged/
        );

        assert.match(
            source,
            /Welcome to the Covenant 🙏/
        );

        assert.doesNotMatch(
            source,
            /enrollPrayerCovenantChallenge/
        );

        const lookupStart = source.indexOf(
            'async function lookupNextCampaign'
        );

        const lookupEnd = source.indexOf(
            'function beginAuthenticatedSession',
            lookupStart
        );

        assert.ok(
            lookupStart >= 0 &&
            lookupEnd > lookupStart
        );

        assert.doesNotMatch(
            source.slice(
                lookupStart,
                lookupEnd
            ),
            /prayer-covenant\/join/
        );
    }
);

test(
    'member campaign content is rendered through text APIs and image/navigation values are revalidated',
    () => {
        assert.match(
            source,
            /\.textContent/
        );

        assert.match(
            source,
            /safeImageUrl/
        );

        assert.match(
            source,
            /parsed\.protocol === 'https:'/
        );

        assert.match(
            source,
            /raw\.startsWith\('\/'\)/
        );

        assert.doesNotMatch(
            source,
            /campaign\.(?:title|message|eyebrow).*innerHTML/
        );
    }
);

test(
    'Spotlight modal is non-bypassable by backdrop click and supports recorded close semantics',
    () => {
        assert.match(
            source,
            /event\.target !== overlay/
        );

        assert.match(
            source,
            /dismissActiveCampaign/
        );

        assert.match(
            source,
            /event\.key !== 'Escape'/
        );

        assert.match(
            css,
            /\.community-spotlight-member-overlay/
        );

        assert.match(
            css,
            /body\.koinonia-offline-readonly/
        );
    }
);

test(
    'member Spotlight assets load after the authenticated app shell and publish through PWA v61',
    () => {
        const app =
            index.indexOf(
                '/js/app.js?v=13.3'
            );

        const member =
            index.indexOf(
                '/js/community-spotlight-member.js?v=2'
            );

        assert.ok(
            app >= 0 &&
            member > app
        );

        assert.match(
            index,
            /\/css\/community-spotlight-member\.css\?v=1/
        );

        assert.match(
            serviceWorker,
            /const CACHE_NAME = 'fog-portal-v61'/
        );

        assert.match(
            serviceWorker,
            /'\/js\/community-spotlight-member\.js\?v=2'/
        );

        assert.match(
            serviceWorker,
            /'\/css\/community-spotlight-member\.css\?v=1'/
        );
    }
);
