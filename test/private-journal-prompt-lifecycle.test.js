'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const secure = fs.readFileSync(
    path.join(ROOT, 'public/js/journal-secure-controller.js'),
    'utf8'
);

const discipleship = fs.readFileSync(
    path.join(ROOT, 'public/js/v2-discipleship.js'),
    'utf8'
);

const polish = fs.readFileSync(
    path.join(ROOT, 'public/js/community-feature-polish.js'),
    'utf8'
);

const serviceWorker = fs.readFileSync(
    path.join(ROOT, 'public/sw.js'),
    'utf8'
);

function between(source, startText, endText) {
    const start = source.indexOf(startText);

    assert.notEqual(
        start,
        -1,
        `Missing start marker: ${startText}`
    );

    const end = source.indexOf(
        endText,
        start + startText.length
    );

    assert.notEqual(
        end,
        -1,
        `Missing end marker: ${endText}`
    );

    return source.slice(start, end);
}


test(
    'general Growth lifecycle no longer preloads Private Journal',
    () => {
        const growth = between(
            discipleship,
            'loadUserGrowthData: async function() {',
            'loadAdminData: async function() {'
        );

        assert.doesNotMatch(
            growth,
            /\bthis\.loadJournals\s*\(/
        );

        assert.match(
            polish,
            /if\s*\(\s*subTabName\s*===\s*['"]Journal['"]\s*\)[\s\S]*?loadJournals\s*\(/
        );
    }
);


test(
    'device recovery is protected by a per-owner single-flight promise',
    () => {
        assert.match(
            secure,
            /const\s+recoveryPromises\s*=\s*[\r\n\s]*new Map\(\)/
        );

        const wrapper = between(
            secure,
            'function recoverJournalOnDevice(',
            'async function ensureMigrationMasterKey('
        );

        assert.match(
            wrapper,
            /recoveryPromises\.has\s*\(/
        );

        assert.match(
            wrapper,
            /recoveryPromises\.get\s*\(/
        );

        assert.match(
            wrapper,
            /recoveryPromises\.set\s*\(/
        );

        assert.match(
            wrapper,
            /recoveryPromises\.delete\s*\(/
        );

        assert.match(
            wrapper,
            /recoverJournalOnDeviceOnce\s*\(/
        );
    }
);


test(
    'master-key acquisition joins interactive setup or recovery already in progress',
    () => {
        const body = between(
            secure,
            'async function ensureMasterKey(',
            'async function getRawEntries('
        );

        const setupCheck =
            body.indexOf('setupPromises.has');

        const recoveryCheck =
            body.indexOf('recoveryPromises.has');

        const statusLoad =
            body.indexOf('let status =');

        assert.ok(setupCheck >= 0);
        assert.ok(recoveryCheck >= 0);
        assert.ok(statusLoad >= 0);

        assert.ok(
            setupCheck < statusLoad,
            'setup single-flight must be checked before status loading'
        );

        assert.ok(
            recoveryCheck < statusLoad,
            'recovery single-flight must be checked before status loading'
        );
    }
);


test(
    'migration key acquisition also joins existing interactive key flows',
    () => {
        const body = between(
            secure,
            'async function ensureMigrationMasterKey(',
            'async function ensureMasterKey('
        );

        assert.match(
            body,
            /setupPromises\.has\s*\(/
        );

        assert.match(
            body,
            /recoveryPromises\.has\s*\(/
        );
    }
);


test(
    'Recovery Key dialogs remove their overlay before resolving',
    () => {
        const setupDialog = between(
            secure,
            'async function showRecoveryKeyOnce(',
            'async function requestRecoveryKey('
        );

        const recoveryDialog = between(
            secure,
            'async function requestRecoveryKey(',
            'async function requestResponsibleUseAcknowledgement('
        );

        assert.match(
            setupDialog,
            /overlay\.remove\(\)[\s\S]*?resolve\(value\)/
        );

        assert.match(
            recoveryDialog,
            /overlay\.remove\(\)[\s\S]*?resolve\(value\)/
        );
    }
);


test(
    'service worker advances cache generation for corrected Journal client code',
    () => {
        assert.match(
            serviceWorker,
            /const CACHE_NAME = ['"]fog-portal-v82['"]/
        );
    }
);
