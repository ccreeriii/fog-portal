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
    path.resolve(
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

function blockBetween(
    startMarker,
    endMarker
) {
    const start =
        server.indexOf(
            startMarker
        );

    assert.ok(
        start >= 0,
        `missing ${startMarker}`
    );

    const end =
        server.indexOf(
            endMarker,
            start +
            startMarker.length
        );

    assert.ok(
        end > start,
        `missing boundary after ${startMarker}`
    );

    return server.slice(
        start,
        end
    );
}

test(
    'daily Prayer Covenant engine is imported and initialized at runtime schema startup',
    () => {
        assert.equal(
            (
                server.match(
                    /require\('\.\/lib\/prayer-covenant-daily'\)/g
                ) || []
            ).length,
            1
        );

        assert.equal(
            (
                server.match(
                    /PrayerCovenantDaily\.initializeSchema\(db\)/g
                ) || []
            ).length,
            1
        );
    }
);

test(
    'daily Prayer Pal GET is authenticated and does not use weekly Prayer Partner state',
    () => {
        const block =
            blockBetween(
                "app.get(\n    '/api/prayer-covenant/daily-pal'",
                "app.post(\n    '/api/prayer-covenant/daily-pal/send'"
            );

        assert.match(
            block,
            /requireAuth/
        );

        assert.match(
            block,
            /req\.auth[\s\S]*youthId/
        );

        assert.match(
            block,
            /getOrCreateDailyPal/
        );

        assert.match(
            block,
            /Cache-Control/
        );

        assert.doesNotMatch(
            block,
            /secret_prayer_pals/
        );

        assert.doesNotMatch(
            block,
            /rotatePrayerPartners/
        );
    }
);

test(
    'daily Prayer Covenant send enforces today assignment and one durable send',
    () => {
        const block =
            blockBetween(
                "app.post(\n    '/api/prayer-covenant/daily-pal/send'",
                "app.get('/api/prayer-pals/current/:youth_id'"
            );

        assert.match(
            block,
            /requireAuth/
        );

        assert.match(
            block,
            /req\.auth[\s\S]*youthId/
        );

        assert.match(
            block,
            /getOrCreateDailyPal/
        );

        assert.match(
            block,
            /assignment\.palYouthId/
        );

        assert.match(
            block,
            /Prayer can only be sent to today’s assigned Prayer Pal/
        );

        assert.match(
            block,
            /INSERT INTO personal_inbox/
        );

        assert.match(
            block,
            /UPDATE prayer_covenant_daily_pals/
        );

        assert.match(
            block,
            /sent_inbox_id/
        );

        assert.match(
            block,
            /sent_at/
        );

        assert.match(
            block,
            /recordPrayerCovenantCompletion/
        );

        assert.match(
            block,
            /DAILY_PRAYER_ALREADY_SENT/
        );

        assert.match(
            block,
            /useExistingTransaction:[\s\S]*true/
        );

        assert.doesNotMatch(
            block,
            /secret_prayer_pals/
        );

        assert.doesNotMatch(
            block,
            /rotatePrayerPartners/
        );

        /*
         * sender_id is a legitimate personal_inbox database column.
         * What must never be trusted is a client-supplied sender
         * identity. The authenticated req.auth.youthId is canonical.
         */
        assert.doesNotMatch(
            block,
            /req\.body\.sender_id/
        );

        assert.doesNotMatch(
            block,
            /req\.body\.sender_name/
        );
    }
);

test(
    'legacy weekly Prayer Partner APIs remain present exactly once',
    () => {
        assert.equal(
            (
                server.match(
                    /app\.post\('\/api\/prayer-pals\/send'/g
                ) || []
            ).length,
            1
        );

        assert.equal(
            (
                server.match(
                    /app\.get\('\/api\/prayer-pals\/current\/:youth_id'/g
                ) || []
            ).length,
            1
        );

        const weeklySend =
            blockBetween(
                "app.post('/api/prayer-pals/send'",
                "app.post('/api/inbox/personal/:id/respond'"
            );

        assert.match(
            weeklySend,
            /secret_prayer_pals/
        );

        assert.doesNotMatch(
            weeklySend,
            /prayer_covenant_daily_pals/
        );
    }
);
