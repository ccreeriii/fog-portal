'use strict';

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const test =
    require('node:test');

const root =
    path.join(
        __dirname,
        '..'
    );

function read(relative) {
    return fs.readFileSync(
        path.join(
            root,
            relative
        ),
        'utf8'
    );
}

test(
    'secure Directory creation route is unique and requires the exact canonical permission pair',
    () => {
        const source =
            read('server.js');

        const route =
            "app.post(\n    '/api/admin/directory/members'";

        assert.equal(
            source.split(route).length - 1,
            1
        );

        const start =
            source.indexOf(route);

        assert.ok(
            start >= 0
        );

        const region =
            source.slice(
                start,
                start + 5000
            );

        assert.ok(
            region.includes(
                "'access_directory'"
            )
        );

        assert.ok(
            region.includes(
                "'add_entries'"
            )
        );

        assert.ok(
            region.includes(
                'requireAllPermissions'
            )
        );
    }
);

test(
    'secure Directory route uses canonical leadership actor and authoritative inserted-ID formatter',
    () => {
        const source =
            read('server.js');

        const start =
            source.indexOf(
                "'/api/admin/directory/members'"
            );

        const end =
            source.indexOf(
                "app.post('/api/youth'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const region =
            source.slice(
                start,
                end
            );

        assert.ok(
            region.includes(
                'getCanonicalDisplayActor(req)'
            )
        );

        assert.ok(
            region.includes(
                'formatFogPassId'
            )
        );

        assert.ok(
            region.includes(
                'normalizeEmail'
            )
        );

        assert.ok(
            region.includes(
                "require('./lib/directory-member-creation')"
            )
        );

        assert.equal(
            region.includes(
                'req.body.actor'
            ),
            false
        );

        assert.equal(
            region.includes(
                'GrowthJourney'
            ),
            false
        );

        assert.equal(
            region.includes(
                'queueEmailVerification'
            ),
            false
        );

        assert.equal(
            region.includes(
                'legalAcceptanceStore'
            ),
            false
        );
    }
);

test(
    'legacy public POST /api/youth remains available during controlled migration',
    () => {
        const source =
            read('server.js');

        assert.equal(
            (
                source.match(
                    /app\.post\('\/api\/youth', async \(req, res\) =>/g
                ) || []
            ).length,
            1
        );
    }
);

test(
    'Directory Add Member UI alone uses the protected creation endpoint and sends no actor',
    () => {
        const source =
            read(
                'public/js/app.js'
            );

        const start =
            source.indexOf(
                'window.submitNewMember = async function(e) {'
            );

        const end =
            source.indexOf(
                'window.saveMemberEditWithConfirm = async function() {',
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const region =
            source.slice(
                start,
                end
            );

        assert.ok(
            region.includes(
                "fetch('/api/admin/directory/members'"
            )
        );

        assert.equal(
            region.includes(
                "fetch('/api/youth'"
            ),
            false
        );

        assert.equal(
            region.includes(
                'actor: currentUser'
            ),
            false
        );
    }
);

test(
    'public preregistration remains on the legacy registration path for this phase',
    () => {
        const source =
            read(
                'public/preregister.js'
            );

        assert.ok(
            source.includes(
                "fetch('/api/youth'"
            )
        );
    }
);

test(
    'walk-in and event preregistration legacy member creation remain untouched',
    () => {
        const source =
            read(
                'public/js/app.js'
            );

        const legacyRegistrations =
            (
                source.match(
                    /const regRes = await fetch\('\/api\/youth'/g
                ) || []
            ).length;

        assert.ok(
            legacyRegistrations >= 2
        );
    }
);

test(
    'Directory Add Member visibility requires access_directory plus add_entries in every late override',
    () => {
        const source =
            read(
                'public/js/app.js'
            );

        assert.ok(
            source.includes(
                "window.hasPerm('access_directory')"
            )
        );

        assert.ok(
            source.includes(
                "window.hasPerm('add_entries')"
            )
        );

        assert.equal(
            (
                source.match(
                    /window\.canCreateDirectoryMember\(\)/g
                ) || []
            ).length >= 4,
            true
        );

        assert.equal(
            (
                source.match(
                    /setDisp\('btnDirectoryAddMember'\)/g
                ) || []
            ).length,
            0
        );
    }
);
