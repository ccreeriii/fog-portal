const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const index = fs.readFileSync(
    path.join(root, 'public/index.html'),
    'utf8'
);

const js = fs.readFileSync(
    path.join(root, 'public/js/community-feature-polish.js'),
    'utf8'
);

const css = fs.readFileSync(
    path.join(root, 'public/css/community-features.css'),
    'utf8'
);

const journey = fs.readFileSync(
    path.join(root, 'public/css/journey-dashboard.css'),
    'utf8'
);

const sw = fs.readFileSync(
    path.join(root, 'public/sw.js'),
    'utf8'
);

test('Private Journal uses the canonical polished split-tab presentation', () => {
    assert.match(js, /FINAL PRIVATE JOURNAL POLISH/);
    assert.match(js, /My Journal/);
    assert.match(js, /New Entry/);
    assert.match(js, /Pause\. Reflect\. Grow\./);
    assert.doesNotMatch(js, /Private to you/);
    assert.match(js, /Only you can view your journal entries/);
    assert.match(js, /loadCanonicalJournalList/);
    assert.match(js, /state\.entries\s*\.slice\(start,\s*start\s*\+\s*10\)/);

    assert.match(css, /\.feature-intro--journal/);
    assert.match(css, /\.journal-feature-shell/);
    assert.match(css, /\.journal-form-polished/);
});

test('Community feature colors use Fire of God orange branding', () => {
    assert.match(css, /--fog-brand-orange:\s*#FF6B00/);
    assert.match(css, /--fog-brand-orange-strong:\s*#C84F00/);

    assert.doesNotMatch(css, /#8f5a2a/i);
    assert.doesNotMatch(css, /#8a4f3f/i);
    assert.doesNotMatch(css, /#a94d12/i);

    for (const feature of ['prayer', 'journal', 'groups', 'events']) {
        assert.match(
            css,
            new RegExp(`feature-intro--${feature}`)
        );
    }
});

test('Growth Journey palette is aligned to the same orange family', () => {
    assert.match(journey, /--journey-green:\s*#C84F00/);
    assert.match(journey, /--journey-amber:\s*#FF6B00/);
    assert.match(
        journey,
        /linear-gradient\(145deg,\s*#F97316 0%,\s*#D95700 58%,\s*#A83D00 130%\)/
    );

    assert.doesNotMatch(journey, /#176b4d/i);
    assert.doesNotMatch(journey, /#205c47/i);
    assert.doesNotMatch(journey, /#174b3a/i);
});

test('brand and journal assets publish through a fresh PWA cache', () => {
    assert.match(index, /community-features\.css\?v=3/);
    assert.match(index, /community-feature-polish\.js\?v=7/);
    assert.match(index, /journey-dashboard\.css\?v=4/);
    assert.match(sw, /fog-portal-v62/);
});
