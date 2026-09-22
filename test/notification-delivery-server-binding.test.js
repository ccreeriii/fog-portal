const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const {
    createWebPushSender,
    createRuntimeNotificationDeliveryEngine
} = require('../lib/notification-delivery');

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

test(
    'real web-push adapter serializes canonical payload and returns bounded provider reference',
    async () => {
        let captured = null;

        const sender =
            createWebPushSender({
                enabled:
                    true,

                webpush: {
                    sendNotification:
                        async (
                            subscription,
                            payload
                        ) => {
                            captured = {
                                subscription,
                                payload
                            };

                            return {
                                statusCode:
                                    201,

                                headers: {
                                    location:
                                        'https://push.example/message/123'
                                }
                            };
                        }
                }
            });

        const subscription = {
            endpoint:
                'https://push.example/sub',

            keys: {
                p256dh:
                    'test',
                auth:
                    'test'
            }
        };

        const payload = {
            title:
                'Journey Update',

            body:
                'A new invitation is ready.',

            url:
                '/journey'
        };

        const result =
            await sender({
                subscription,
                payload
            });

        assert.deepEqual(
            captured.subscription,
            subscription
        );

        assert.deepEqual(
            JSON.parse(
                captured.payload
            ),
            payload
        );

        assert.equal(
            result.providerReference,
            'https://push.example/message/123'
        );
    }
);

test(
    'web-push adapter propagates provider errors for canonical retry classification',
    async () => {
        const expected =
            Object.assign(
                new Error('gone'),
                {
                    statusCode:
                        410
                }
            );

        const sender =
            createWebPushSender({
                enabled:
                    true,

                webpush: {
                    sendNotification:
                        async () => {
                            throw expected;
                        }
                }
            });

        await assert.rejects(
            () =>
                sender({
                    subscription: {
                        endpoint:
                            'https://push.example/sub'
                    },

                    payload: {
                        title:
                            'Test',
                        body:
                            'Test',
                        url:
                            '/'
                    }
                }),
            error =>
                error === expected
        );
    }
);

test(
    'disabled Push produces no transport and runtime engine still supports Inbox/Email delivery',
    () => {
        assert.equal(
            createWebPushSender({
                enabled:
                    false
            }),
            null
        );

        const database = {
            run() {},
            get() {},
            all() {}
        };

        const engine =
            createRuntimeNotificationDeliveryEngine({
                database,
                webpush:
                    null,
                pushEnabled:
                    false,
                emailOutbox:
                    null,
                publicOrigin:
                    'https://staging.fogmin.site'
            });

        assert.equal(
            typeof engine.dispatchRecipient,
            'function'
        );

        assert.equal(
            typeof engine.dispatchEvent,
            'function'
        );

        assert.equal(
            typeof engine.reconcileEmailDeliveries,
            'function'
        );
    }
);

test(
    'server binds canonical delivery internally without exposing a public send endpoint',
    () => {
        assert.match(
            server,
            /createRuntimeNotificationDeliveryEngine/
        );

        assert.match(
            server,
            /function getCanonicalNotificationDeliveryEngine/
        );

        assert.match(
            server,
            /dispatchCanonicalNotificationRecipient/
        );

        assert.match(
            server,
            /dispatchCanonicalNotificationEvent/
        );

        assert.match(
            server,
            /reconcileCanonicalNotificationEmailDeliveries/
        );

        assert.match(
            server,
            /pushEnabled:\s*pushNotificationsAvailable/
        );

        assert.match(
            server,
            /emailRecoveryOutbox\s*\|\|\s*null/
        );

        assert.match(
            server,
            /process\.env\.KOINONIA_PUBLIC_ORIGIN/
        );

        assert.doesNotMatch(
            server,
            /app\.(?:post|put|patch|get)\(\s*['"]\/api\/notifications\/(?:dispatch|send|deliver)/
        );
    }
);
