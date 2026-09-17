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
            /\/js\/member-transition-intake\.js\?v=1/
        );

        assert.match(
            index,
            /\/js\/journey-dashboard\.js\?v=7/
        );

        assert.ok(
            index.indexOf(
                '/js/member-transition-intake.js?v=1'
            ) <
            index.indexOf(
                '/js/journey-dashboard.js?v=7'
            )
        );

        assert.match(
            sw,
            /fog-portal-v56/
        );

        assert.match(
            sw,
            /\/css\/member-transition-intake\.css\?v=1/
        );

        assert.match(
            sw,
            /\/js\/member-transition-intake\.js\?v=1/
        );

        assert.match(
            sw,
            /\/js\/journey-dashboard\.js\?v=7/
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
