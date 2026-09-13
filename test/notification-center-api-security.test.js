const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source =
    fs.readFileSync(
        path.join(
            __dirname,
            '..',
            'server.js'
        ),
        'utf8'
    );

test(
    'Notification Center APIs are authenticated and use canonical member identity',
    () => {
        const routes = [
            [
                'get',
                '/api/notifications'
            ],
            [
                'get',
                '/api/notifications/unread-count'
            ],
            [
                'post',
                '/api/notifications/:id/read'
            ],
            [
                'post',
                '/api/notifications/read-all'
            ],
            [
                'get',
                '/api/notifications/preferences'
            ],
            [
                'put',
                '/api/notifications/preferences'
            ]
        ];

        for (const [
            method,
            route
        ] of routes) {
            const escaped =
                route.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    '\\$&'
                );

            const regex =
                new RegExp(
                    `app\\.${method}\\('${escaped}', requireAuth,`
                );

            assert.match(
                source,
                regex,
                `${method.toUpperCase()} ${route} must require auth`
            );
        }

        assert.match(
            source,
            /function getAuthenticatedNotificationYouthId\(req\)/
        );

        assert.match(
            source,
            /req\.auth[\s\S]*youthId/
        );
    }
);

test(
    'Notification APIs never select member identity from request body or query',
    () => {
        const start =
            source.indexOf(
                '// CANONICAL NOTIFICATION CENTER API'
            );

        const end =
            source.indexOf(
                "app.post('/api/communications/subscribe'",
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const block =
            source.slice(
                start,
                end
            );

        assert.doesNotMatch(
            block,
            /req\.body\.youth_id/
        );

        assert.doesNotMatch(
            block,
            /req\.query\.username/
        );

        assert.doesNotMatch(
            block,
            /req\.query\.youth_id/
        );
    }
);

test(
    'canonical notification engine is internal and not exposed as an unauthenticated create endpoint',
    () => {
        assert.doesNotMatch(
            source,
            /app\.(?:post|put)\('\/api\/notifications\/create'/
        );

        assert.match(
            source,
            /NotificationCenter\s*\.\s*listNotifications/
        );

        assert.match(
            source,
            /NotificationCenter\s*\.\s*savePreferences/
        );
    }
);
