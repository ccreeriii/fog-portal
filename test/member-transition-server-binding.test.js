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
    'member transition controller is imported and registered exactly once',
    () => {
        const text =
            source();

        assert.equal(
            (
                text.match(
                    /require\('\.\/lib\/member-transition-http'\)/g
                ) || []
            ).length,
            1
        );

        assert.equal(
            (
                text.match(
                    /MemberTransitionHttp\.registerMemberTransitionRoutes\(/g
                ) || []
            ).length,
            1
        );
    }
);

test(
    'member transition API is registered after the legal acceptance gate',
    () => {
        const text =
            source();

        const legalGate =
            text.indexOf(
                'app.use(enforceCurrentLegalAcceptance);'
            );

        const registration =
            text.indexOf(
                'MemberTransitionHttp.registerMemberTransitionRoutes({'
            );

        assert.ok(
            legalGate >= 0
        );

        assert.ok(
            registration > legalGate
        );
    }
);

test(
    'member transition API is registered only after SQLite database initialization',
    () => {
        const text =
            source();

        const databaseInitialization =
            text.indexOf(
                'const db = new sqlite3.Database('
            );

        const registration =
            text.indexOf(
                'MemberTransitionHttp.registerMemberTransitionRoutes({'
            );

        assert.ok(
            databaseInitialization >= 0
        );

        assert.ok(
            registration >
                databaseInitialization
        );
    }
);

test(
    'legacy Priority URLs remain available for backward compatibility',
    () => {
        const text =
            source();

        assert.ok(
            text.includes(
                "'/api/ministries-v37/priority/:mappingId'"
            )
        );

        assert.ok(
            text.includes(
                "'/api/ministries/members/:mapping_id/priority'"
            )
        );
    }
);

test(
    'legacy Priority handler delegates to audited transactional service and no longer uses separate clear-set SQL',
    () => {
        const text =
            source();

        const start =
            text.indexOf(
                'async function handleMinistryPriority'
            );

        const end =
            text.indexOf(
                "app.post(\n    '/api/ministries-v37/priority/:mappingId'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const handler =
            text.slice(
                start,
                end
            );

        assert.ok(
            handler.includes(
                'MinistryServiceJourney'
            )
        );

        assert.ok(
            handler.includes(
                '.setPriorityMinistry('
            )
        );

        assert.ok(
            handler.includes(
                "'leadership_review'"
            )
        );

        assert.equal(
            handler.includes(
                'db.serialize'
            ),
            false
        );

        assert.equal(
            handler.includes(
                'SET is_priority = 0'
            ),
            false
        );

        assert.equal(
            handler.includes(
                'SET is_priority = 1'
            ),
            false
        );
    }
);

test(
    'legacy Priority routes retain resource-owner-or-leadership authorization middleware',
    () => {
        const text =
            source();

        const first =
            text.indexOf(
                "'/api/ministries-v37/priority/:mappingId'"
            );

        const second =
            text.indexOf(
                "'/api/ministries/members/:mapping_id/priority'"
            );

        assert.ok(
            first >= 0
        );

        assert.ok(
            second >= 0
        );

        const firstRegion =
            text.slice(
                first,
                first + 500
            );

        const secondRegion =
            text.slice(
                second,
                second + 500
            );

        assert.ok(
            firstRegion.includes(
                'requireResourceOwnerOrAllPermissions'
            )
        );

        assert.ok(
            secondRegion.includes(
                'requireResourceOwnerOrAllPermissions'
            )
        );

        assert.ok(
            firstRegion.includes(
                'handleMinistryPriority'
            )
        );

        assert.ok(
            secondRegion.includes(
                'handleMinistryPriority'
            )
        );
    }
);
