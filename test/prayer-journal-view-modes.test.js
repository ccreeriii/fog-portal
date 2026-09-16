const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

const index = fs.readFileSync(
    path.join(root, 'public/index.html'),
    'utf8'
);

const source = fs.readFileSync(
    path.join(root, 'public/js/community-feature-polish.js'),
    'utf8'
);

const css = fs.readFileSync(
    path.join(root, 'public/css/community-features.css'),
    'utf8'
);

const sw = fs.readFileSync(
    path.join(root, 'public/sw.js'),
    'utf8'
);

const marker =
    'PRAYER + JOURNAL LIST GRID CALENDAR';

const start =
    source.lastIndexOf(marker);

assert.notEqual(
    start,
    -1,
    'final Prayer/Journal view-mode layer must exist'
);

const layer =
    source.slice(start);

test('Prayer defaults to List and exposes List Grid Calendar views', () => {
    assert.match(
        layer,
        /prayerView:\s*'list'/
    );

    assert.match(
        layer,
        /\['list',\s*'☰',\s*'List'\]/
    );

    assert.match(
        layer,
        /\['grid',\s*'▦',\s*'Grid'\]/
    );

    assert.match(
        layer,
        /\['calendar',\s*'📅',\s*'Calendar'\]/
    );

    assert.match(
        layer,
        /renderPrayerView/
    );

    assert.match(
        layer,
        /prayerListRow/
    );

    assert.match(
        layer,
        /prayerGridCard/
    );

    assert.match(
        layer,
        /calendarView/
    );
});

test('Journal defaults to List and preserves owner actions in all views', () => {
    assert.match(
        layer,
        /journalView:\s*'list'/
    );

    assert.match(
        layer,
        /renderJournalView/
    );

    assert.match(
        layer,
        /journalListRow/
    );

    assert.match(
        layer,
        /journalGridCard/
    );

    assert.match(
        layer,
        /openEditJournalModal/
    );

    assert.match(
        layer,
        /deleteJournal/
    );
});

test('List and Grid remain bounded at ten items while Calendar uses real created dates', () => {
    assert.match(
        layer,
        /const PAGE_SIZE = 10/
    );

    assert.match(
        layer,
        /dateKey\(item\.created_at\)/
    );

    assert.match(
        layer,
        /start \+ PAGE_SIZE/
    );

    assert.match(
        layer,
        /feature-calendar-grid/
    );
});

test('Journal and other feature intro descriptions share one typography scale', () => {
    assert.match(
        css,
        /\.feature-intro p:not\(\.feature-intro__eyebrow\):not\(\.feature-intro__privacy\)/
    );

    assert.match(
        css,
        /font-size:\s*0\.86rem/
    );

    assert.match(
        css,
        /feature-view-toggle/
    );

    assert.match(
        css,
        /feature-list-row/
    );

    assert.match(
        css,
        /feature-view-grid/
    );

    assert.match(
        css,
        /feature-calendar-shell/
    );
});

test('new view layer publishes through fresh Community assets and PWA cache', () => {
    assert.match(
        index,
        /community-features\.css\?v=3/
    );

    assert.match(
        index,
        /community-feature-polish\.js\?v=7/
    );

    assert.match(
        sw,
        /fog-portal-v46/
    );
});
