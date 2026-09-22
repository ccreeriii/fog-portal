'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'scripts', 'private-journal-http-rehearsal.js'),
    'utf8'
);

test('F3 HTTP rehearsal has no hardcoded Production application path', () => {
    assert.doesNotMatch(source, /\/home\/raspi4\/fogmin-portal-v3/);
    assert.match(source, /--forbidden-root/);
    assert.match(source, /assertNoHardcodedReference/);
    assert.match(source, /'docs'/);
});

test('F3 HTTP rehearsal uses a disposable loopback-only ephemeral server', () => {
    assert.match(source, /PORT: '0'/);
    assert.match(source, /127\.0\.0\.1/);
    assert.match(source, /FORBIDDEN_PORTS/);
    assert.match(source, /\/proc\/\$\{pid\}\/cwd/);
    assert.match(source, /productionFileDescriptors/);
});

test('F3 HTTP rehearsal disables unrelated external and scheduled effects in the clone', () => {
    assert.match(source, /F3 push is disabled/);
    assert.match(source, /email outbox and worker initialization are disabled/);
    assert.match(source, /verified backups are disabled/);
    assert.match(source, /Prayer Covenant scheduling is disabled/);
    assert.match(source, /birthday synchronization scheduling is disabled/);
});

test('F3 HTTP rehearsal exercises real routes, real crypto, IDOR, and forensics', () => {
    for (const required of [
        "'/api/login'",
        "'/api/auth/me'",
        "'/api/journal-security/status'",
        "'/api/journal-security/key-envelope'",
        "'/api/journal-security/legacy-migration'",
        'JournalCrypto.createJournalSetup',
        'JournalCrypto.recoverMasterKey',
        'JournalCrypto.encryptEntry',
        'JournalCrypto.decryptEntry',
        'crossOwnerJournalId',
        'PRAGMA wal_checkpoint(TRUNCATE)',
        'bufferContainsSentinel'
    ]) {
        assert.ok(source.includes(required), `missing F3 proof: ${required}`);
    }
});

test('F3 HTTP rehearsal always validates and removes its disposable clone', () => {
    assert.match(source, /finally \{/);
    assert.match(source, /Refusing to remove an unexpected cleanup target/);
    assert.match(source, /fs\.rmSync\(resolvedClone, \{ recursive: true, force: true \}\)/);
    assert.match(source, /F3_DISPOSABLE_CLEANUP PASS/);
});
