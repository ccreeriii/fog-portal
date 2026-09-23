'use strict';

const test =
    require('node:test');

const assert =
    require('node:assert/strict');

const {
    renderBrandedEmail,
    normalizePublicOrigin
} =
    require('../lib/email-template');

const {
    createResendTransport
} =
    require('../lib/email-transport');

test(
    'global email template wraps existing HTML with FOG Community Portal branding',
    () => {
        const html =
            renderBrandedEmail({
                html:
                    '<p>Hello member.</p><p><a href="https://fogmin.site/example">Continue</a></p>',
                text:
                    'Hello member.',
                publicOrigin:
                    'https://fogmin.site'
            });

        assert.match(
            html,
            /data-fog-email-template="v1"/
        );

        assert.match(
            html,
            /FIRE OF GOD MINISTRIES/
        );

        assert.match(
            html,
            /Community Portal/
        );

        assert.match(
            html,
            /https:\/\/fogmin\.site\/img\/logo\.png/
        );

        assert.match(
            html,
            /Hello member\./
        );

        assert.match(
            html,
            /support@fogmin\.site/
        );
    }
);

test(
    'text-only email receives safe branded HTML without changing its text fallback',
    () => {
        const html =
            renderBrandedEmail({
                text:
                    'Hello <member> & family\nSecond line'
            });

        assert.match(
            html,
            /Hello &lt;member&gt; &amp; family/
        );

        assert.doesNotMatch(
            html,
            /Hello <member>/
        );

        assert.match(
            html,
            /Second line/
        );
    }
);

test(
    'template does not wrap an already branded email twice',
    () => {
        const once =
            renderBrandedEmail({
                html:
                    '<p>Original</p>'
            });

        const twice =
            renderBrandedEmail({
                html:
                    once
            });

        assert.equal(
            twice,
            once
        );
    }
);

test(
    'unsafe branding origin falls back to canonical fogmin.site',
    () => {
        assert.equal(
            normalizePublicOrigin(
                'http://evil.example'
            ),
            'https://fogmin.site'
        );
    }
);

test(
    'Resend transport sends the branded HTML while preserving plain text',
    async () => {
        let request = null;

        const transport =
            createResendTransport({
                apiKey:
                    'test-key',
                from:
                    'FOG Portal <noreply@fogmin.site>',
                publicOrigin:
                    'https://fogmin.site',
                fetchImpl:
                    async (
                        url,
                        options
                    ) => {
                        request = {
                            url,
                            options
                        };

                        return {
                            ok:
                                true,
                            status:
                                200,
                            async json() {
                                return {
                                    id:
                                        'template-test-message'
                                };
                            }
                        };
                    }
            });

        const result =
            await transport.send({
                to:
                    'member@example.com',
                subject:
                    'Community message',
                text:
                    'Plain fallback content',
                html:
                    '<p>HTML content</p>'
            });

        assert.equal(
            result.providerMessageId,
            'template-test-message'
        );

        const body =
            JSON.parse(
                request.options.body
            );

        assert.equal(
            body.text,
            'Plain fallback content'
        );

        assert.match(
            body.html,
            /data-fog-email-template="v1"/
        );

        assert.match(
            body.html,
            /HTML content/
        );

        assert.match(
            body.html,
            /FIRE OF GOD MINISTRIES/
        );
    }
);
