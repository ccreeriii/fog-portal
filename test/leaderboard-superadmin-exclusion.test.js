'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
    path.join(root, 'server.js'),
    'utf8'
);

function routeBlock(marker) {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `Missing route: ${marker}`);

    const next = source.indexOf('\napp.', start + marker.length);
    return source.slice(
        start,
        next === -1 ? source.length : next
    );
}

test(
    'Fire Of God Ministries superadmin is non-competitive across every leaderboard',
    () => {
        const routes = [
            "app.get('/api/public/arcade-leaderboards'",
            "app.get('/api/fq-leaderboard/top3'",
            "app.get('/api/leaderboards/:type/:timeframe'",
            "app.get('/api/gamification/game-top/:game_name'",
            "app.get('/api/gamification/group-leaderboard'",
            "app.get('/api/public/arcade-leaderboards-v2'"
        ];

        for (const route of routes) {
            assert.match(
                routeBlock(route),
                /fire of god ministries/i,
                `${route} must exclude the superadmin identity`
            );
        }

        assert.doesNotMatch(
            source,
            /app\.get\(\s*['"]\/api\/arcade\/leaderboard['"]/,
            'Unexpected additional Arcade leaderboard server route requires audit'
        );

        const canonicalExclusions =
            source.match(
                /lower\(trim\((?:y\.name|player_name)\)\) <> 'fire of god ministries'/g
            ) || [];

        assert.equal(
            canonicalExclusions.length,
            16,
            'Expected all 16 audited ranking-query exclusions'
        );
    }
);
