'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync(
    'public/css/fog-premium.css',
    'utf8'
);

test(
    'Growth Daily Gospel uses readable premium sage treatment',
    () => {
        assert.match(
            css,
            /DAILY GOSPEL — SAGE HIGHLIGHT POLISH/
        );

        assert.match(
            css,
            /#growthSubHome #liturgicalCard/
        );

        assert.match(
            css,
            /#F1F7EE/
        );

        assert.match(
            css,
            /#E4F0E1/
        );

        assert.match(
            css,
            /color:\s*#29483A\s*!important/
        );
    }
);

test(
    'Growth Daily Gospel actions keep distinct readable treatments',
    () => {
        assert.match(
            css,
            /button\[onclick\*="openLiturgicalReadings"\]/
        );

        assert.match(
            css,
            /button\[onclick\*="Journal"\]/
        );

        assert.match(
            css,
            /#C45528/
        );

        assert.match(
            css,
            /#D6E6D2/
        );

        assert.match(
            css,
            /#315A43/
        );
    }
);
