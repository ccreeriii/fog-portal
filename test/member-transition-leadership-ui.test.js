'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

function read(relativePath) {
    return fs.readFileSync(
        path.join(
            __dirname,
            '..',
            relativePath
        ),
        'utf8'
    );
}

test(
    'Member Journey Review is isolated inside Discipleship Admin',
    () => {
        const index =
            read(
                'public/index.html'
            );

        assert.match(
            index,
            /id="btnSubAdminMemberJourney"/
        );

        assert.match(
            index,
            /id="subTabAdminMemberJourney"/
        );

        assert.match(
            index,
            /MemberTransitionLeadershipUI\.open\(\)/
        );

        assert.match(
            index,
            /\/css\/member-transition-leadership\.css\?v=1/
        );

        assert.match(
            index,
            /\/js\/member-transition-leadership\.js\?v=1/
        );

        assert.ok(
            index.indexOf(
                'id="discipleshipAdminTab"'
            ) <
            index.indexOf(
                'id="btnSubAdminMemberJourney"'
            )
        );
    }
);

test(
    'Leadership UI requires the canonical permission pair',
    () => {
        const ui =
            read(
                'public/js/member-transition-leadership.js'
            );

        assert.match(
            ui,
            /access_discipleship/
        );

        assert.match(
            ui,
            /edit_entries/
        );

        assert.match(
            ui,
            /hasReviewPermission/
        );
    }
);

test(
    'Leadership UI uses only protected transition leadership routes',
    () => {
        const ui =
            read(
                'public/js/member-transition-leadership.js'
            );

        assert.match(
            ui,
            /\/api\/admin\/member-transitions/
        );

        assert.match(
            ui,
            /review\/start/
        );

        assert.match(
            ui,
            /review\/needs-changes/
        );

        assert.match(
            ui,
            /review\/approve/
        );

        assert.match(
            ui,
            /reviews\/\$\{latest\.id\}\/recognize/
        );

        assert.doesNotMatch(
            ui,
            /\bactor\s*:/
        );

        assert.doesNotMatch(
            ui,
            /\byouth_id\s*:/
        );
    }
);

test(
    'Approval and recognition remain separate explicit leadership actions',
    () => {
        const ui =
            read(
                'public/js/member-transition-leadership.js'
            );

        const approve =
            ui.indexOf(
                'Approve Historical Standing'
            );

        const recognize =
            ui.indexOf(
                'Recognize Historical Standing'
            );

        assert.ok(
            approve >= 0
        );

        assert.ok(
            recognize >= 0
        );

        assert.notEqual(
            approve,
            recognize
        );

        assert.match(
            ui,
            /Recognition is still pending/
        );

        assert.match(
            ui,
            /recognition_pending|Historical standing has not yet been recognized/
        );
    }
);

test(
    'Historical approval offers only canonical recognition standings',
    () => {
        const ui =
            read(
                'public/js/member-transition-leadership.js'
            );

        assert.match(
            ui,
            /formal_member/
        );

        assert.match(
            ui,
            /active_servant/
        );

        assert.match(
            ui,
            /No Historical Standing/
        );

        assert.match(
            ui,
            /proposed_standing/
        );
    }
);

test(
    'Member Journey Review renders server data with safe DOM APIs',
    () => {
        const ui =
            read(
                'public/js/member-transition-leadership.js'
            );

        assert.match(
            ui,
            /textContent/
        );

        assert.match(
            ui,
            /createElement/
        );

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
    }
);

test(
    'Leadership static assets advance the PWA cache coherently',
    () => {
        const sw =
            read(
                'public/sw.js'
            );

        assert.match(
            sw,
            /fog-portal-v62/
        );

        assert.match(
            sw,
            /\/css\/member-transition-leadership\.css\?v=1/
        );

        assert.match(
            sw,
            /\/js\/member-transition-leadership\.js\?v=1/
        );
    }
);
