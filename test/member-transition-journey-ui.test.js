'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
    return fs.readFileSync(path, 'utf8');
}

test(
    'Existing Member Transition UI exposes the downstream transition states',
    () => {
        const ui =
            read(
                'public/js/member-transition-journey.js'
            );

        [
            'initialize_transition',
            'community_intent',
            'priority_ministry',
            'ministry_discernment',
            'discernment_in_progress',
            'awaiting_ministry_verification',
            'transition_current',
            'transition_closed'
        ].forEach(action => {
            assert.ok(
                ui.includes(action),
                `missing transition action: ${action}`
            );
        });

        assert.equal(
            /\.innerHTML\s*=/.test(ui),
            false
        );
    }
);

test(
    'Existing Member Transition UI uses self-scoped transition routes',
    () => {
        const ui =
            read(
                'public/js/member-transition-journey.js'
            );

        [
            '/api/member-transition/me',
            '/api/member-transition/me/initialize',
            '/api/member-transition/me/community-intent',
            '/api/member-transition/me/priority/',
            '/api/member-transition/me/discernment'
        ].forEach(route => {
            assert.ok(
                ui.includes(route),
                `missing route: ${route}`
            );
        });

        assert.equal(
            /youth_id\s*:/.test(ui),
            false
        );

        assert.equal(
            /actor_user_id\s*:/.test(ui),
            false
        );

        assert.equal(
            /actor_name\s*:/.test(ui),
            false
        );
    }
);

test(
    'Priority Ministry remains an explicit member choice when none is canonical',
    () => {
        const ui =
            read(
                'public/js/member-transition-journey.js'
            );

        assert.ok(
            /let selectedMapping\s*=\s*null/.test(ui)
        );

        assert.ok(
            ui.includes(
                'Please choose one Priority Ministry.'
            )
        );

        assert.equal(
            /selectedMapping\s*=\s*Number\s*\(\s*list\[0\]/.test(ui),
            false
        );
    }
);

test(
    'Transition Journey preserves pastoral community and ministry semantics',
    () => {
        const ui =
            read(
                'public/js/member-transition-journey.js'
            );

        [
            'I Desire to Journey With FOG',
            'I’m Still Discerning',
            'Not at This Time',
            'does not remove your other ministry memberships',
            'not an automatic ministry appointment or role change'
        ].forEach(copy => {
            assert.ok(
                ui.includes(copy),
                `missing pastoral copy: ${copy}`
            );
        });
    }
);

test(
    'Canonical Journey renderer shares state with downstream Transition Journey UI',
    () => {
        const dashboard =
            read(
                'public/js/journey-dashboard.js'
            );

        assert.ok(
            dashboard.includes(
                'let memberTransitionState'
            )
        );

        assert.ok(
            dashboard.includes(
                'MemberTransitionIntakeUI.refreshCard'
            )
        );

        assert.ok(
            dashboard.includes(
                'MemberTransitionJourneyUI.refreshCard'
            )
        );

        assert.ok(
            /transition:\s*memberTransitionState/.test(
                dashboard
            )
        );
    }
);

test(
    'Transition Journey assets publish before Journey Dashboard v8',
    () => {
        const index =
            read(
                'public/index.html'
            );

        const sw =
            read(
                'public/sw.js'
            );

        const transition =
            index.indexOf(
                '/js/member-transition-journey.js?v=2'
            );

        const dashboard =
            index.indexOf(
                '/js/journey-dashboard.js?v=8'
            );

        assert.ok(
            transition >= 0
        );

        assert.ok(
            dashboard > transition
        );

        assert.ok(
            index.includes(
                '/css/member-transition-journey.css?v=2'
            )
        );

        assert.ok(
            sw.includes(
                "fog-portal-v64"
            )
        );

        assert.ok(
            sw.includes(
                '/js/member-transition-journey.js?v=2'
            )
        );

        assert.ok(
            sw.includes(
                '/css/member-transition-journey.css?v=2'
            )
        );

        assert.ok(
            sw.includes(
                '/js/journey-dashboard.js?v=8'
            )
        );
    }
);

test(
    'Accelerated transition uses a persistent sibling slot outside journeyGrowthCard',
    () => {
        const ui =
            read(
                'public/js/member-transition-journey.js'
            );

        assert.ok(
            ui.includes(
                "memberTransitionJourneySlot"
            )
        );

        assert.ok(
            ui.includes(
                "growthCard.nextSibling"
            )
        );

        assert.ok(
            ui.includes(
                "parent.insertBefore"
            )
        );

        assert.ok(
            ui.includes(
                "ensureTransitionSlot"
            )
        );

        assert.ok(
            ui.includes(
                "renderCallout("
            )
        );

        assert.equal(
            /renderCallout\(\s*card\s*,\s*transition\s*\)/.test(ui),
            false,
            'transition callout must not be remounted inside journeyGrowthCard'
        );
    }
);

test(
    'Accelerated transition refresh keeps existing DOM mounted during fetch',
    () => {
        const ui =
            read(
                'public/js/member-transition-journey.js'
            );

        const functionStart =
            ui.indexOf(
                'async function refreshCard'
            );

        assert.ok(
            functionStart >= 0
        );

        const section =
            ui.slice(
                functionStart,
                functionStart + 5000
            );

        const hostAt =
            section.indexOf(
                'ensureTransitionSlot'
            );

        const fetchAt =
            section.indexOf(
                'loadTransition'
            );

        assert.ok(
            hostAt >= 0
        );

        assert.ok(
            fetchAt > hostAt,
            'persistent host must exist before async transition refresh'
        );
    }
);

test(
    'No-flicker fix leaves canonical Journey Dashboard renderer untouched',
    () => {
        const dashboard =
            read(
                'public/js/journey-dashboard.js'
            );

        assert.equal(
            dashboard.includes(
                'detachGrowthJourneyExtensions'
            ),
            false
        );

        assert.equal(
            dashboard.includes(
                'restoreGrowthJourneyExtensions'
            ),
            false
        );
    }
);
