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
    path.join(
        __dirname,
        '..'
    );

const read =
    relative =>
        fs.readFileSync(
            path.join(
                root,
                relative
            ),
            'utf8'
        );

test(
    'Adult Intake UI is isolated and published before the canonical Journey renderer',
    () => {
        const index =
            read(
                'public/index.html'
            );

        const sw =
            read(
                'public/sw.js'
            );

        const ui =
            read(
                'public/js/member-transition-intake.js'
            );

        const journey =
            read(
                'public/js/journey-dashboard.js'
            );

        assert.match(
            index,
            /\/css\/member-transition-intake\.css\?v=1/
        );

        assert.match(
            index,
            /\/js\/member-transition-intake\.js\?v=4/
        );

        assert.match(
            index,
            /\/js\/journey-dashboard\.js\?v=8/
        );

        assert.ok(
            index.indexOf(
                '/js/member-transition-intake.js?v=4'
            ) <
            index.indexOf(
                '/js/journey-dashboard.js?v=8'
            )
        );

        assert.match(
            sw,
            /fog-portal-v61/
        );

        assert.match(
            sw,
            /\/css\/member-transition-intake\.css\?v=1/
        );

        assert.match(
            sw,
            /\/js\/member-transition-intake\.js\?v=4/
        );

        assert.match(
            sw,
            /\/js\/journey-dashboard\.js\?v=8/
        );

        assert.match(
            journey,
            /MemberTransitionIntakeUI\.refreshCard/
        );

        assert.match(
            ui,
            /window\.MemberTransitionIntakeUI/
        );
    }
);

test(
    'Adult Intake UI uses only self-scoped member transition APIs and safe DOM construction',
    () => {
        const ui =
            read(
                'public/js/member-transition-intake.js'
            );

        for (
            const endpoint
            of [
                '/api/member-transition/me',
                '/api/member-transition/me/intake',
                '/api/member-transition/me/intake/draft',
                '/api/member-transition/me/intake/submit'
            ]
        ) {
            assert.ok(
                ui.includes(
                    endpoint
                )
            );
        }

        assert.doesNotMatch(
            ui,
            /youth_id/
        );

        assert.doesNotMatch(
            ui,
            /actor\s*:/
        );

        assert.match(
            ui,
            /document\.createElement/
        );

        assert.match(
            ui,
            /textContent/
        );

        assert.doesNotMatch(
            ui,
            /\.innerHTML\s*=/
        );
    }
);

test(
    'Adult Intake questionnaire exposes the agreed pastoral journey sections and safeguards',
    () => {
        const ui =
            read(
                'public/js/member-transition-intake.js'
            );

        for (
            const phrase
            of [
                'Your Journey With FOG',
                'About You',
                'Journey With FOG',
                'Membership History',
                'Ministry History',
                'Choose Your Priority Ministry',
                'Ministry Discernment',
                'Previous Formation',
                'Your Current Invitation',
                'Review & Attestation',
                'Save & Continue Later',
                'self-reported',
                'does not automatically change',
                'leadership may review and verify'
            ]
        ) {
            assert.ok(
                ui.includes(
                    phrase
                ),
                `Missing UI contract phrase: ${phrase}`
            );
        }

        assert.match(
            ui,
            /current\.length > 1/
        );

        assert.match(
            ui,
            /selected_priority/
        );

        assert.match(
            ui,
            /attestation_confirmed/
        );
    }
);

test(
    'Adult Intake status card respects review and recognition states',
    () => {
        const ui =
            read(
                'public/js/member-transition-intake.js'
            );

        for (
            const state
            of [
                'adult_intake_questionnaire',
                'adult_intake_submitted',
                'adult_intake_under_review',
                'adult_intake_awaiting_recognition'
            ]
        ) {
            assert.ok(
                ui.includes(
                    state
                )
            );
        }

        assert.ok(
            ui.includes(
                "'needs_changes'"
            )
        );

        assert.ok(
            ui.includes(
                'Awaiting Recognition'
            )
        );
    }
);


test(
    'Adult Intake UI unwraps the canonical transition state envelope',
    () => {
        const ui =
            read(
                'public/js/member-transition-intake.js'
            );

        assert.match(
            ui,
            /body\s*&&\s*body\.state/
        );

        assert.match(
            ui,
            /state\.transition\s*=\s*transition/
        );

        assert.match(
            ui,
            /return transition;/
        );

        assert.doesNotMatch(
            ui,
            /state\.transition\s*=\s*body;[\s\S]{0,120}return body;/
        );
    }
);


test(
    'Adult Intake callout remains stable across repeated Journey refreshes',
    () => {
        const ui =
            read(
                'public/js/member-transition-intake.js'
            );

        assert.match(
            ui,
            /dataset\.transitionKey/
        );

        assert.match(
            ui,
            /previous\.replaceWith/
        );

        assert.match(
            ui,
            /state\.transitionMemberId/
        );

        const start =
            ui.indexOf(
                'async function refreshCard'
            );

        const end =
            ui.indexOf(
                'window.MemberTransitionIntakeUI',
                start
            );

        assert.ok(
            start >= 0 &&
            end > start
        );

        const region =
            ui.slice(
                start,
                end
            );

        const cachedRender =
            region.indexOf(
                'renderTransitionCallout'
            );

        const networkLoad =
            region.indexOf(
                'await loadTransition'
            );

        assert.ok(
            cachedRender >= 0
        );

        assert.ok(
            networkLoad > cachedRender,
            'cached transition must render before awaiting the network'
        );

        assert.match(
            ui,
            /state\.transitionMemberId\s*!==\s*memberId/
        );
    }
);


test(
    'Adult Intake draft does not manufacture a Priority Ministry',
    () => {
        const ui =
            read(
                'public/js/member-transition-intake.js'
            );

        assert.match(
            ui,
            /if\s*\(\s*current\.length\s*<=\s*1\s*\)\s*\{\s*return;/
        );

        assert.doesNotMatch(
            ui,
            /row\.selected_priority\s*=\s*row\s*===\s*current\[0\]/
        );

        assert.match(
            ui,
            /current\.length\s*>\s*1[\s\S]*Please choose exactly one Priority Ministry/
        );

        assert.match(
            ui,
            /currentMinistries\.length\s*===\s*1/
        );
    }
);
