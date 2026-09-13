const fs =
    require('node:fs');

const path =
    require('node:path');

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const root =
    path.join(
        __dirname,
        '..'
    );

const server =
    fs.readFileSync(
        path.join(
            root,
            'server.js'
        ),
        'utf8'
    );

const appJs =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'app.js'
        ),
        'utf8'
    );

const indexHtml =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'index.html'
        ),
        'utf8'
    );

function routeCount(pattern) {
    return (
        server.match(pattern) ||
        []
    ).length;
}

test(
    'Prayer Pal APIs use authenticated identity and have no legacy duplicate mutations',
    () => {
        assert.equal(
            routeCount(
                /app\.post\('\/api\/prayer-pals\/send'/g
            ),
            1
        );

        assert.equal(
            routeCount(
                /app\.post\('\/api\/inbox\/personal\/:id\/respond'/g
            ),
            1
        );

        assert.equal(
            routeCount(
                /app\.get\('\/api\/prayer-pals\/current\/:youth_id'/g
            ),
            1
        );

        assert.equal(
            routeCount(
                /app\.get\('\/api\/inbox\/personal\/:youth_id'/g
            ),
            1
        );

        assert.match(
            server,
            /app\.post\('\/api\/prayer-pals\/send', requireAuth,/
        );

        assert.match(
            server,
            /FROM secret_prayer_pals[\s\S]*WHERE youth_id = \?[\s\S]*ORDER BY id DESC[\s\S]*LIMIT 1/
        );

        assert.match(
            server,
            /assignedPrayerPartnerId !==[\s\S]*receiverId/
        );

        assert.match(
            server,
            /Prayer can only be sent to your assigned Prayer Partner\./
        );

        assert.match(
            server,
            /app\.get\('\/api\/prayer-pals\/current\/:youth_id', requireAuth,/
        );

        assert.match(
            server,
            /You can only view your own Prayer Partner\./
        );

        assert.match(
            server,
            /app\.get\('\/api\/inbox\/personal\/:youth_id', requireAuth,/
        );

        assert.match(
            server,
            /You can only view your own private inbox\./
        );

        assert.doesNotMatch(
            server,
            /\[KOINONIA PATCH\] PRIVATE PRAYER INBOX/
        );
    }
);

test(
    'Prayer responses derive ownership and recipient from stored inbox data',
    () => {
        assert.match(
            server,
            /app\.post\('\/api\/inbox\/personal\/:id\/respond', requireAuth,/
        );

        assert.match(
            server,
            /const allowedActions =[\s\S]*'thank_you'[\s\S]*'answered'/
        );

        assert.match(
            server,
            /Number\([\s\S]*inboxMessage\.receiver_id[\s\S]*\) !== authenticatedYouthId/
        );

        assert.match(
            server,
            /const originalSenderId =[\s\S]*inboxMessage\.sender_id/
        );

        assert.match(
            appJs,
            /body:\s*JSON\.stringify\(\{\s*action:\s*action\s*\}\)/
        );

        assert.doesNotMatch(
            appJs,
            /original_sender_id/
        );

        assert.match(
            indexHtml,
            /force_rebuild:\s*true/
        );
    }
);
