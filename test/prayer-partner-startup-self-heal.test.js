'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.join(__dirname, '..');
const serverSource = fs.readFileSync(
    path.join(repositoryRoot, 'server.js'),
    'utf8'
);

test('startup performs canonical idempotent Prayer Partner snapshot ensure before HTTP listen', () => {
    assert.match(
        serverSource,
        /async function ensurePrayerPartnerSnapshotAtStartup\(\)/
    );

    assert.match(
        serverSource,
        /GrowthJourney\.rotatePrayerPartners\(\s*db,\s*\{\s*force:\s*false\s*\}\s*\)/
    );

    const startupFunctionIndex = serverSource.indexOf(
        'async function startServerAfterRuntimeSchemaReady()'
    );
    assert.notEqual(
        startupFunctionIndex,
        -1,
        'startServerAfterRuntimeSchemaReady() must exist'
    );

    const migrationIndex = serverSource.indexOf(
        'await applyDeterministicRuntimeMigration();',
        startupFunctionIndex
    );
    const ensureIndex = serverSource.indexOf(
        'await ensurePrayerPartnerSnapshotAtStartup();',
        startupFunctionIndex
    );
    const listenIndex = serverSource.indexOf(
        'app.listen(PORT',
        startupFunctionIndex
    );

    assert.ok(
        migrationIndex > startupFunctionIndex,
        'runtime migration must occur inside startup'
    );

    assert.ok(
        ensureIndex > migrationIndex,
        'Prayer Partner ensure must happen after runtime migration'
    );

    assert.ok(
        listenIndex > ensureIndex,
        'Prayer Partner ensure must happen before HTTP listen'
    );
});

test('startup Prayer Partner recovery is non-destructive and non-fatal', () => {
    assert.match(
        serverSource,
        /force:\s*false/
    );

    assert.match(
        serverSource,
        /\[STARTUP\] Prayer Partner snapshot ensure failed:/
    );

    assert.match(
        serverSource,
        /return null;/
    );

    assert.doesNotMatch(
        serverSource,
        /ensurePrayerPartnerSnapshotAtStartup[\s\S]{0,1500}force:\s*true/
    );
});
