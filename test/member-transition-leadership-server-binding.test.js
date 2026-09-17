'use strict';

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const test =
    require('node:test');

const serverPath =
    path.join(
        __dirname,
        '..',
        'server.js'
    );

function source() {
    return fs.readFileSync(
        serverPath,
        'utf8'
    );
}

test(
    'leadership transition controller is imported and registered exactly once',
    () => {
        const text =
            source();

        assert.equal(
            (
                text.match(
                    /require\('\.\/lib\/member-transition-leadership-http'\)/g
                ) || []
            ).length,
            1
        );

        assert.equal(
            (
                text.match(
                    /MemberTransitionLeadershipHttp\.registerMemberTransitionLeadershipRoutes\(/g
                ) || []
            ).length,
            1
        );
    }
);

test(
    'leadership transition routes are registered after the legal gate and SQLite initialization',
    () => {
        const text =
            source();

        const legalGate =
            text.indexOf(
                'app.use(enforceCurrentLegalAcceptance);'
            );

        const database =
            text.indexOf(
                'const db = new sqlite3.Database('
            );

        const registration =
            text.indexOf(
                'MemberTransitionLeadershipHttp.registerMemberTransitionLeadershipRoutes({'
            );

        assert.ok(
            legalGate >= 0
        );

        assert.ok(
            database > legalGate
        );

        assert.ok(
            registration > database
        );
    }
);

test(
    'leadership binding delegates authorization to canonical all-permissions middleware',
    () => {
        const text =
            source();

        const start =
            text.indexOf(
                'MemberTransitionLeadershipHttp.registerMemberTransitionLeadershipRoutes({'
            );

        assert.ok(
            start >= 0
        );

        const region =
            text.slice(
                start,
                start + 500
            );

        assert.ok(
            region.includes(
                'requireAllPermissions'
            )
        );

        assert.ok(
            region.includes(
                'getActorName: getCanonicalDisplayActor'
            )
        );
    }
);

test(
    'transition leadership APIs are not exempted from current legal acceptance',
    () => {
        const text =
            source();

        const start =
            text.indexOf(
                'const LEGAL_GATE_ALLOWED_API_PREFIXES'
            );

        const end =
            text.indexOf(
                'function isLegalGateAllowedApiPath',
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const allowlist =
            text.slice(
                start,
                end
            );

        assert.equal(
            allowlist.includes(
                'member-transitions'
            ),
            false
        );

        assert.equal(
            allowlist.includes(
                'ministry-discernment'
            ),
            false
        );
    }
);
