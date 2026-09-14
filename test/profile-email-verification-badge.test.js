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

const app =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'js',
            'app.js'
        ),
        'utf8'
    );

const html =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'index.html'
        ),
        'utf8'
    );

const sw =
    fs.readFileSync(
        path.join(
            root,
            'public',
            'sw.js'
        ),
        'utf8'
    );

test(
    'Email badge uses canonical email_verified state',
    () => {
        assert.match(
            app,
            /function emailVerificationBadgeHtml\(member\)/
        );

        assert.match(
            app,
            /member\.email_verified === 1/
        );

        assert.match(
            app,
            /✓ Verified/
        );

        assert.match(
            app,
            /Not verified/
        );

        assert.match(
            app,
            /data-email-verification-state/
        );
    }
);

test(
    'Personal Details places verification badge beside Email Address',
    () => {
        assert.match(
            app,
            /Email Address<\/span>\s*\$\{emailVerificationBadgeHtml\(member\)\}/
        );
    }
);

test(
    'effective V24 Directory profile shows Email verification badge',
    () => {
        const start =
            app.indexOf(
                '// V24: UNIFIED DIRECTORY PROFILE & FREEZE FIX (CLEAN)'
            );

        assert.ok(
            start >= 0
        );

        const end =
            app.indexOf(
                'window.closeViewProfileModal = function()',
                start
            );

        assert.ok(
            end > start
        );

        const block =
            app.slice(
                start,
                end
            );

        assert.match(
            block,
            /<strong>Email:<\/strong>\s*\$\{emailVerificationBadgeHtml\(member\)\}\s*\$\{safeText\(member\.email\)\}/
        );
    }
);

test(
    'Directory badge is informational and exposes no member verification action',
    () => {
        assert.doesNotMatch(
            app,
            /verifyDirectoryMemberEmail/
        );

        assert.doesNotMatch(
            app,
            /verifyOtherMemberEmail/
        );
    }
);

test(
    'PWA publishes app 13.3 and cache v22',
    () => {
        assert.match(
            html,
            /\/js\/app\.js\?v=13\.3/
        );

        assert.match(
            sw,
            /fog-portal-v24/
        );

        assert.match(
            sw,
            /\/js\/app\.js\?v=13\.3/
        );
    }
);
