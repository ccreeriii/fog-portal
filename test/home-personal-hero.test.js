'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const html = fs.readFileSync(
    path.join(root, 'public/index.html'),
    'utf8'
);

const js = fs.readFileSync(
    path.join(
        root,
        'public/js/journey-dashboard.js'
    ),
    'utf8'
);

const css = fs.readFileSync(
    path.join(
        root,
        'public/css/fog-premium.css'
    ),
    'utf8'
);

const server = fs.readFileSync(
    path.join(root, 'server.js'),
    'utf8'
);

test(
    'Home uses authenticated profile picture with FOG logo fallback',
    () => {
        assert.match(
            html,
            /id="journeyHomePortrait"/
        );

        assert.match(
            html,
            /id="journeyHomePortraitFrame"/
        );

        assert.match(
            html,
            /src="\/img\/logo\.png"/
        );

        assert.match(
            js,
            /HOME_PORTRAIT_FALLBACK/
        );

        assert.match(
            js,
            /member\.profile_picture/
        );

        assert.match(
            js,
            /portrait\.onerror/
        );

        assert.match(
            css,
            /HOME PERSONALIZED PREMIUM HERO/
        );

        assert.match(
            css,
            /\.journey-home__portrait/
        );

        assert.doesNotMatch(
            server,
            /premium_banner_home/
        );
    }
);
