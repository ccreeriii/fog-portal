'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');


function source() {
    return fs.readFileSync(
        path.join(
            __dirname,
            '..',
            'server.js'
        ),
        'utf8'
    );
}


test(
    'server defines safeguarding middleware and canonical access state',
    () => {
        const server =
            source();

        assert.match(
            server,
            /function requirePrivateJournalAccess/
        );

        assert.match(
            server,
            /getPrivateJournalAccessState/
        );

        assert.match(
            server,
            /journal_access_required/
        );
    }
);


test(
    'Journal status endpoint uses birthday-based safeguarding state',
    () => {
        const server =
            source();

        const start =
            server.indexOf(
                "app.get(\n    '/api/journal-security/status'"
            );

        const end =
            server.indexOf(
                "app.get(\n    '/api/journal-security/key-envelope'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const block =
            server.slice(
                start,
                end
            );

        assert.match(
            block,
            /getPrivateJournalAccessState/
        );

        assert.match(
            block,
            /age_basis/
        );

        assert.match(
            block,
            /access_allowed/
        );

        assert.match(
            block,
            /experience_mode/
        );
    }
);


test(
    'Journal routes use normal access or migration-only safeguarding as appropriate',
    () => {
        const server =
            source();

        const policies = [
            {
                signature:
                    "app.get(\n    '/api/journal-security/key-envelope'",

                middleware:
                    'requirePrivateJournalMigrationAccess',

                forbidden:
                    null
            },

            {
                signature:
                    "app.put(\n    '/api/journal-security/key-envelope'",

                middleware:
                    'requirePrivateJournalMigrationAccess',

                forbidden:
                    null
            },

            {
                signature:
                    "app.get(\n    '/api/journals/:youth_id'",

                middleware:
                    'requirePrivateJournalAccess',

                forbidden:
                    'requirePrivateJournalMigrationAccess'
            },

            {
                signature:
                    "app.post(\n    '/api/journals'",

                middleware:
                    'requirePrivateJournalAccess',

                forbidden:
                    'requirePrivateJournalMigrationAccess'
            },

            {
                signature:
                    "app.put(\n    '/api/journals/:id'",

                middleware:
                    'requirePrivateJournalAccess',

                forbidden:
                    'requirePrivateJournalMigrationAccess'
            },

            {
                signature:
                    "app.put(\n    '/api/journals/:id/migrate'",

                middleware:
                    'requirePrivateJournalMigrationAccess',

                forbidden:
                    null
            }
        ];

        for (
            const policy of policies
        ) {
            const position =
                server.indexOf(
                    policy.signature
                );

            assert.ok(
                position >= 0,
                `missing route ${policy.signature}`
            );

            const block =
                server.slice(
                    position,
                    position + 520
                );

            assert.match(
                block,
                /requireAuth/
            );

            assert.match(
                block,
                new RegExp(
                    policy.middleware
                )
            );

            if (
                policy.forbidden
            ) {
                assert.doesNotMatch(
                    block,
                    new RegExp(
                        policy.forbidden
                    )
                );
            }
        }

        /*
         * The narrower migration gate does NOT grant normal
         * Journal use. Normal GET/create/edit remain behind
         * requirePrivateJournalAccess.
         */
        assert.match(
            server,
            /function requirePrivateJournalMigrationAccess/
        );

        assert.match(
            server,
            /migration_only:\s*true/
        );
    }
);

test(
    'guardian endpoints require authenticated Portal accounts',
    () => {
        const server =
            source();

        for (
            const route of [
                '/api/journal-security/guardian-request',
                '/api/journal-security/guardian-request/preview',
                '/api/journal-security/guardian-request/approve',
                '/api/journal-security/guardian-authorization'
            ]
        ) {
            const position =
                server.indexOf(
                    `'${route}'`
                );

            assert.ok(
                position >= 0,
                route
            );

            assert.match(
                server.slice(
                    position,
                    position + 350
                ),
                /requireAuth/
            );
        }
    }
);


test(
    'established Journal Master Key fingerprint cannot be silently replaced',
    () => {
        const server =
            source();

        const start =
            server.indexOf(
                "app.put(\n    '/api/journal-security/key-envelope'"
            );

        const end =
            server.indexOf(
                "app.get(\n    '/api/journals/:youth_id'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const block =
            server.slice(
                start,
                end
            );

        assert.match(
            block,
            /existing[\s\S]*key_fingerprint/
        );

        assert.match(
            block,
            /JOURNAL_KEY_FINGERPRINT_MISMATCH/
        );

        assert.match(
            block,
            /status\(409\)/
        );

        assert.doesNotMatch(
            block,
            /ON CONFLICT\(youth_id\)[\s\S]*DO UPDATE/
        );
    }
);


test(
    'guardian approval token is not logged through Journal route block',
    () => {
        const server =
            source();

        const start =
            server.indexOf(
                "app.post(\n    '/api/journal-security/guardian-request'"
            );

        const end =
            server.indexOf(
                "app.get(\n    '/api/journal-security/status'",
                start
            );

        assert.ok(
            start >= 0
        );

        assert.ok(
            end > start
        );

        const block =
            server.slice(
                start,
                end
            );

        assert.doesNotMatch(
            block,
            /console\.log/
        );

        assert.doesNotMatch(
            block,
            /logActivity/
        );
    }
);
