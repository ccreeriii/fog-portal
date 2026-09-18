'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

const ui = fs.readFileSync(
    path.join(
        root,
        'public/js/ministry-discernment-leadership.js'
    ),
    'utf8'
);

const css = fs.readFileSync(
    path.join(
        root,
        'public/css/ministry-discernment-leadership.css'
    ),
    'utf8'
);

test(
    'ministry discernment leadership UI requires exact permission pair',
    () => {
        assert.match(
            ui,
            /hasPerm\('access_ministries'\)/
        );

        assert.match(
            ui,
            /hasPerm\('edit_entries'\)/
        );
    }
);

test(
    'UI uses only canonical protected discernment leadership API',
    () => {
        assert.match(
            ui,
            /\/api\/admin\/ministry-discernment/
        );

        assert.doesNotMatch(
            ui,
            /\/api\/member-transition\/me\/discernment/
        );

        assert.doesNotMatch(
            ui,
            /\byouth_id\s*:/
        );

        assert.doesNotMatch(
            ui,
            /\bactor_user_id\s*:/
        );

        assert.doesNotMatch(
            ui,
            /\bactor_name\s*:/
        );
    }
);

test(
    'UI implements consultation assessment recommendation completion and withdrawal',
    () => {
        for (const route of [
            '/consultation/complete',
            '/assessment/start',
            '/assessment/complete',
            '/recommendation',
            '/complete',
            '/withdraw'
        ]) {
            assert.ok(
                ui.includes(route),
                `missing ${route}`
            );
        }
    }
);

test(
    'recommendation sends explicit boolean and assessment requirement',
    () => {
        assert.match(
            ui,
            /recommended:\s*true/
        );

        assert.match(
            ui,
            /recommended:\s*false/
        );

        assert.match(
            ui,
            /assessment_required:\s*true/
        );

        assert.match(
            ui,
            /assessment_required:\s*false/
        );
    }
);

test(
    'UI is state aware and terminal cases expose no further mutations',
    () => {
        for (const status of [
            'intent_submitted',
            'consultation_complete',
            'assessment_pending',
            'assessment_complete',
            'recommended',
            'not_recommended',
            'completed',
            'withdrawn'
        ]) {
            assert.ok(
                ui.includes(status),
                `missing status ${status}`
            );
        }

        assert.match(
            ui,
            /TERMINAL\.has\(discernmentCase\.status\)/
        );
    }
);

test(
    'UI does not directly mutate ministry role priority community intent or Growth',
    () => {
        assert.doesNotMatch(
            ui,
            /\/api\/ministries\/.*members/
        );

        assert.doesNotMatch(
            ui,
            /\/api\/member-transition\/me\/priority/
        );

        assert.doesNotMatch(
            ui,
            /\/api\/member-transition\/me\/community-intent/
        );

        assert.doesNotMatch(
            ui,
            /\/api\/growth-journey/
        );
    }
);

test(
    'UI renders untrusted content through safe DOM APIs',
    () => {
        assert.doesNotMatch(
            ui,
            /\.innerHTML\s*=/
        );

        assert.doesNotMatch(
            ui,
            /insertAdjacentHTML/
        );

        assert.doesNotMatch(
            ui,
            /\beval\s*\(/
        );

        assert.match(
            ui,
            /textContent/
        );
    }
);

test(
    'UI is isolated for future Ministries subtab publication',
    () => {
        assert.match(
            ui,
            /btnSubMinistryDiscernment/
        );

        assert.match(
            ui,
            /subTabMinistryDiscernment/
        );

        assert.match(
            css,
            /#subTabMinistryDiscernment/
        );

        assert.match(
            css,
            /\.ministry-discernment-shell/
        );
    }
);


test(
    'ministry discernment assets publish coherently inside Ministries',
    () => {
        const index = fs.readFileSync(
            path.join(root, 'public/index.html'),
            'utf8'
        );

        const sw = fs.readFileSync(
            path.join(root, 'public/sw.js'),
            'utf8'
        );

        assert.match(
            index,
            /id="btnSubMinistryDiscernment"/
        );

        assert.match(
            index,
            /id="subTabMinistryDiscernment"/
        );

        assert.match(
            index,
            /\/css\/ministry-discernment-leadership\.css\?v=1/
        );

        assert.match(
            index,
            /\/js\/ministry-discernment-leadership\.js\?v=1/
        );

        assert.ok(
            index.indexOf(
                '/js/member-transition-leadership.js?v=1'
            ) <
            index.indexOf(
                '/js/ministry-discernment-leadership.js?v=1'
            )
        );

        assert.match(
            sw,
            /const CACHE_NAME = 'fog-portal-v63';/
        );

        assert.match(
            sw,
            /\/css\/ministry-discernment-leadership\.css\?v=1/
        );

        assert.match(
            sw,
            /\/js\/ministry-discernment-leadership\.js\?v=1/
        );
    }
);
