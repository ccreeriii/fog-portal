const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root =
    path.resolve(__dirname, '..');

const source =
    fs.readFileSync(
        path.join(root, 'server.js'),
        'utf8'
    );

function routeCount(method, route) {
    const escaped =
        route.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );

    return (
        source.match(
            new RegExp(
                `app\\.${method}\\('${escaped}'`,
                'g'
            )
        ) || []
    ).length;
}

test(
    'Communications broadcast has one canonical secured route',
    () => {
        assert.equal(
            routeCount(
                'post',
                '/api/communications/broadcast'
            ),
            1
        );

        const start =
            source.indexOf(
                "app.post('/api/communications/broadcast'"
            );

        const end =
            source.indexOf(
                "app.get('/api/communications/history'",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route =
            source.slice(
                start,
                end
            );

        assert.match(
            route,
            /requireAllPermissions\(\['access_communications', 'edit_entries'\]\)/
        );

        assert.match(
            route,
            /requirePushAvailable/
        );

        assert.match(
            route,
            /getCanonicalDisplayActor\(req\)/
        );

        assert.doesNotMatch(route, /author\s*:\s*body\./);

        assert.doesNotMatch(
            route,
            /\{\s*target,\s*title,\s*message,\s*actor\s*\}\s*=\s*req\.body/
        );

        assert.match(
            route,
            /Invalid broadcast target\./
        );
    }
);

test(
    'broadcast history requires canonical Communications permission',
    () => {
        assert.equal(
            routeCount(
                'get',
                '/api/communications/history'
            ),
            1
        );

        assert.match(
            source,
            /app\.get\('\/api\/communications\/history', requirePermission\('access_communications'\),/
        );
    }
);

test(
    'announcement inbox derives recipient from authenticated identity',
    () => {
        assert.equal(
            routeCount(
                'get',
                '/api/communications/inbox'
            ),
            1
        );

        const start =
            source.indexOf(
                "app.get('/api/communications/inbox'"
            );

        const end =
            source.indexOf(
                "app.delete('/api/communications/inbox/:id'",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route =
            source.slice(
                start,
                end
            );

        assert.match(
            route,
            /requireAuth/
        );

        assert.match(
            route,
            /req\.auth[\s\S]*youthId/
        );

        assert.match(
            route,
            /isStrongAdmin\(req\.auth\)/
        );

        assert.doesNotMatch(
            route,
            /req\.query\.username/
        );

        assert.doesNotMatch(
            route,
            /celsocreeriii@gmail\.com/
        );
    }
);

test(
    'push subscription mutations remain authenticated and canonical',
    () => {
        assert.match(
            source,
            /app\.post\('\/api\/communications\/subscribe', requireAuth, requirePushAvailable,/
        );

        assert.match(
            source,
            /app\.post\('\/api\/communications\/unsubscribe', requireAuth,/
        );

        assert.match(
            source,
            /getCanonicalPushSubscriptionUsername\(req\.auth\)/
        );
    }
);

test(
    'private Prayer Inbox retains self-ownership enforcement',
    () => {
        assert.match(
            source,
            /app\.get\('\/api\/inbox\/personal\/:youth_id', requireAuth,/
        );

        assert.match(
            source,
            /requestedYouthId !==[\s\S]*authenticatedYouthId/
        );

        assert.match(
            source,
            /You can only view your own private inbox\./
        );

        assert.match(
            source,
            /app\.post\('\/api\/inbox\/personal\/:id\/respond', requireAuth,/
        );

        assert.match(
            source,
            /inboxMessage\.receiver_id[\s\S]*authenticatedYouthId/
        );
    }
);
