const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function source(...parts) {
    return fs.readFileSync(
        path.join(root, ...parts),
        'utf8'
    );
}

const server =
    source('server.js');

const postlaunch =
    source(
        'public',
        'js',
        'postlaunch-hotfix.js'
    );

const v10 =
    source(
        'public',
        'js',
        'v10-expansion.js'
    );

const index =
    source(
        'public',
        'index.html'
    );

const sw =
    source(
        'public',
        'sw.js'
    );

test(
    'Check-In waits for the canonical event loader after the tab becomes active',
    () => {
        assert.match(
            postlaunch,
            /tabId === 'checkinTab'[\s\S]{0,500}await root\.loadEvents\(\)/
        );
    }
);

test(
    'Ministry logs preserve structured history and expose only truthful current baselines',
    () => {
        const start =
            server.indexOf(
                "app.get('/api/admin/ministry-logs-v36'"
            );

        const end =
            server.indexOf(
                '// --- V37: PROFILE DETAILS & PRIORITY ENDPOINTS ---',
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route =
            server.slice(
                start,
                end
            );

        assert.match(
            route,
            /FROM ministry_role_history h/
        );

        assert.match(
            route,
            /FROM ministry_members mm/
        );

        assert.match(
            route,
            /WHERE NOT EXISTS/
        );

        assert.match(
            route,
            /record_kind:[\s\r\n]*'history'/
        );

        assert.match(
            route,
            /record_kind:[\s\r\n]*'current_baseline'/
        );

        assert.match(
            route,
            /earlier role changes are not reconstructed/
        );
    }
);

test(
    'Ministry baseline rows are visibly distinguished from real history',
    () => {
        assert.match(
            postlaunch,
            /item\.record_kind ===[\s\r\n]*'current_baseline'/
        );

        assert.match(
            postlaunch,
            /Current baseline/
        );

        assert.match(
            postlaunch,
            /not reconstructed historical role changes/
        );

        assert.match(
            postlaunch,
            /Activity Logs/
        );
    }
);

test(
    'Returning from a game refreshes browse Top 3 and featured rankings without page reload',
    () => {
        const start =
            v10.indexOf(
                'exitGame: function()'
            );

        const end =
            v10.indexOf(
                'loadAdminFeaturedSettings:',
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const block =
            v10.slice(
                start,
                end
            );

        const top =
            block.indexOf(
                'this.loadTopScorers()'
            );

        const featured =
            block.indexOf(
                'this.loadFeaturedGames()'
            );

        assert.ok(top >= 0);
        assert.ok(featured > top);

        assert.doesNotMatch(
            block,
            /location\.reload/
        );
    }
);

test(
    'score submission still invalidates the individual game leaderboard cache',
    () => {
        const start =
            v10.indexOf(
                'submitGameScore: async function'
            );

        const end =
            v10.indexOf(
                'submitUniversalScore: async function',
                start
            );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const block =
            v10.slice(
                start,
                end
            );

        assert.match(
            block,
            /delete this\.bulkDataCache\[gameName\]/
        );
    }
);

test(
    'Checkpoint 2 assets are cache-busted and PWA cache advances',
    () => {
        assert.match(
            index,
            /\/js\/v10-expansion\.js\?v=20260922c3/
        );

        assert.match(
            index,
            /\/js\/postlaunch-hotfix\.js\?v=20260922c2/
        );

        assert.match(
            sw,
            /fog-portal-v84/
        );
    }
);
