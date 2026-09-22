'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const sqlite3 = require('sqlite3').verbose();
const {
    BACKUP_METHOD,
    BackupInProgressError,
    createSqliteBackupManager
} = require('../lib/sqlite-backup');

const fsp = fs.promises;
const quietLogger = { info() {}, warn() {}, error() {}, log() {} };

function openDatabase(filename, mode = sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(filename, mode, (err) => {
            if (err) return reject(err);
            resolve(database);
        });
    });
}

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function get(database, sql) {
    return new Promise((resolve, reject) => {
        database.get(sql, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function sha256(filename) {
    return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
}

async function logicalFingerprint(database) {
    return get(database, `
        SELECT COUNT(*) AS row_count,
               COALESCE(SUM(id), 0) AS id_sum,
               COALESCE(group_concat(value, '|'), '') AS values_joined
        FROM test_rows
        ORDER BY id
    `);
}

async function createWalFixture(t) {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-backup-test-'));
    const applicationRoot = path.join(temporaryRoot, 'app');
    const backupDirectory = path.join(applicationRoot, 'backups');
    await fsp.mkdir(backupDirectory, { recursive: true });

    const sourcePath = path.join(applicationRoot, 'fog_community.db');
    const database = await openDatabase(sourcePath);
    const journal = await get(database, 'PRAGMA journal_mode=WAL');
    assert.equal(String(journal.journal_mode).toLowerCase(), 'wal');
    await run(database, 'CREATE TABLE test_rows (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    await run(database, 'INSERT INTO test_rows(value) VALUES (?)', ['committed-before-backup']);
    await run(database, 'INSERT INTO test_rows(value) VALUES (?)', ['latest-committed-record']);

    let databaseClosed = false;
    t.after(async () => {
        if (!databaseClosed) await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    });

    return {
        applicationRoot,
        backupDirectory,
        sourcePath,
        database,
        close: async () => {
            if (!databaseClosed) {
                await closeDatabase(database);
                databaseClosed = true;
            }
        }
    };
}

test('online WAL backup preserves the latest commit and verifies before publication', { concurrency: false }, async (t) => {
    const fixture = await createWalFixture(t);
    const logMessages = [];
    const logger = {
        info(message) { logMessages.push(message); },
        warn(message) { logMessages.push(message); },
        error(message) { logMessages.push(message); },
        log(message) { logMessages.push(message); }
    };
    const manager = createSqliteBackupManager({
        applicationRoot: fixture.applicationRoot,
        sqlite3,
        logger
    });
    const before = await logicalFingerprint(fixture.database);
    const sourceChangesBefore = fixture.database.total_changes;
    const sourceWalStats = await fsp.stat(`${fixture.sourcePath}-wal`);
    assert.ok(sourceWalStats.size > 0);

    const result = await manager.ensureDailyBackup({
        dateKey: '2026-09-07',
        timeKey: '120000001'
    });
    assert.equal(result.created, true);
    assert.match(result.filename, /^fog_community_2026-09-07_120000001_[a-f0-9]{12}\.db$/);
    assert.equal(result.integrity, 'ok');
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    assert.ok(result.sizeBytes > 0);

    const finalPath = path.join(fixture.backupDirectory, result.filename);
    const manifest = JSON.parse(await fsp.readFile(`${finalPath}.json`, 'utf8'));
    assert.equal(manifest.method, BACKUP_METHOD);
    assert.match(manifest.sourceIdentity, /^[a-f0-9]{64}$/);
    assert.equal(manifest.integrity, 'ok');
    assert.equal(manifest.sizeBytes, (await fsp.stat(finalPath)).size);
    assert.equal(manifest.sha256, sha256(finalPath));
    assert.equal((await fsp.stat(finalPath)).mode & 0o777, 0o600);
    assert.equal((await fsp.stat(`${finalPath}.json`)).mode & 0o777, 0o600);

    const backupDatabase = await openDatabase(finalPath, sqlite3.OPEN_READONLY);
    try {
        assert.equal((await get(backupDatabase, 'PRAGMA integrity_check')).integrity_check, 'ok');
        const copied = await logicalFingerprint(backupDatabase);
        assert.deepEqual(copied, before);
        assert.match(copied.values_joined, /latest-committed-record/);
    } finally {
        await closeDatabase(backupDatabase);
    }

    assert.deepEqual(await logicalFingerprint(fixture.database), before);
    assert.equal(fixture.database.total_changes, sourceChangesBefore);
    assert.equal((await manager.verifyPublishedBackup(result.filename)).valid, true);
    assert.equal((await fsp.readdir(fixture.backupDirectory)).some((name) => name.includes('.partial')), false);
    assert.equal(logMessages.length, 1);
    assert.match(logMessages[0], /^\[BACKUP\] Verified backup created filename=fog_community_/);
    assert.match(logMessages[0], /sizeBytes=\d+ integrity=ok checksum=[a-f0-9]{12} durationMs=\d+$/);
    assert.doesNotMatch(logMessages[0], /committed-before-backup|latest-committed-record/);
});

test('a verified same-day backup is reused deterministically', { concurrency: false }, async (t) => {
    const fixture = await createWalFixture(t);
    const manager = createSqliteBackupManager({ applicationRoot: fixture.applicationRoot, sqlite3, logger: quietLogger });
    const first = await manager.ensureDailyBackup({ dateKey: '2026-09-08', timeKey: '010203004' });
    const second = await manager.ensureDailyBackup({ dateKey: '2026-09-08', timeKey: '050607008' });

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.filename, first.filename);
    assert.deepEqual(
        (await fsp.readdir(fixture.backupDirectory)).filter((name) => name.endsWith('.db')),
        [first.filename]
    );
});

test('an unverified same-day artifact is preserved but never mistaken for a valid backup', { concurrency: false }, async (t) => {
    const fixture = await createWalFixture(t);
    const invalidFilename = 'fog_community_2026-09-09.db';
    const invalidPath = path.join(fixture.backupDirectory, invalidFilename);
    await fsp.writeFile(invalidPath, 'incomplete legacy copy', { mode: 0o600 });
    const invalidHash = sha256(invalidPath);
    const manager = createSqliteBackupManager({ applicationRoot: fixture.applicationRoot, sqlite3, logger: quietLogger });

    const result = await manager.ensureDailyBackup({ dateKey: '2026-09-09', timeKey: '111213014' });
    assert.equal(result.created, true);
    assert.notEqual(result.filename, invalidFilename);
    assert.equal(sha256(invalidPath), invalidHash);
    assert.equal((await manager.verifyPublishedBackup(invalidFilename)).valid, false);
    assert.equal((await manager.verifyPublishedBackup(result.filename)).valid, true);
});

test('a failed attempt preserves the last good backup and publishes no candidate', { concurrency: false }, async (t) => {
    const fixture = await createWalFixture(t);
    const manager = createSqliteBackupManager({ applicationRoot: fixture.applicationRoot, sqlite3, logger: quietLogger });
    const good = await manager.createVerifiedBackup('fog_community_known_good.db');
    const goodPath = path.join(fixture.backupDirectory, good.filename);
    const goodHash = sha256(goodPath);

    await fixture.close();
    await Promise.all([
        fsp.rm(`${fixture.sourcePath}-wal`, { force: true }),
        fsp.rm(`${fixture.sourcePath}-shm`, { force: true })
    ]);
    await fsp.writeFile(fixture.sourcePath, 'not a sqlite database', { mode: 0o600 });

    const failedFilename = 'fog_community_failed_attempt.db';
    await assert.rejects(manager.createVerifiedBackup(failedFilename));
    assert.equal(sha256(goodPath), goodHash);
    assert.equal((await manager.verifyPublishedBackup(good.filename)).valid, true);
    assert.equal(fs.existsSync(path.join(fixture.backupDirectory, failedFilename)), false);
    assert.equal(fs.existsSync(path.join(fixture.backupDirectory, `${failedFilename}.json`)), false);
    assert.equal((await fsp.readdir(fixture.backupDirectory)).some((name) => name.includes('.partial')), false);
});

test('publication occurs only after verification and overlapping backup is rejected', { concurrency: false }, async (t) => {
    const fixture = await createWalFixture(t);
    const manager = createSqliteBackupManager({ applicationRoot: fixture.applicationRoot, sqlite3, logger: quietLogger });
    const firstFilename = 'fog_community_concurrency_first.db';
    const firstPath = path.join(fixture.backupDirectory, firstFilename);
    const originalRename = fsp.rename;
    let releasePublication;
    let publicationInspected;
    const publicationGate = new Promise((resolve) => { releasePublication = resolve; });
    const inspectionReady = new Promise((resolve) => { publicationInspected = resolve; });
    let candidateVerifiedBeforePublish = false;

    fsp.rename = async (from, to) => {
        if (to === firstPath) {
            assert.equal(fs.existsSync(firstPath), false);
            const candidateDatabase = await openDatabase(from, sqlite3.OPEN_READONLY);
            try {
                candidateVerifiedBeforePublish =
                    (await get(candidateDatabase, 'PRAGMA integrity_check')).integrity_check === 'ok' &&
                    (await fsp.stat(from)).size > 0;
            } finally {
                await closeDatabase(candidateDatabase);
            }
            publicationInspected();
            await publicationGate;
        }
        return originalRename.call(fsp, from, to);
    };

    try {
        const firstAttempt = manager.createVerifiedBackup(firstFilename);
        await inspectionReady;
        await assert.rejects(
            manager.createVerifiedBackup('fog_community_concurrency_second.db'),
            (err) => err instanceof BackupInProgressError && err.code === 'BACKUP_IN_PROGRESS'
        );
        releasePublication();
        await firstAttempt;
    } finally {
        fsp.rename = originalRename;
        releasePublication();
    }

    assert.equal(candidateVerifiedBeforePublish, true);
    assert.equal((await manager.verifyPublishedBackup(firstFilename)).valid, true);
    assert.equal(fs.existsSync(path.join(fixture.backupDirectory, 'fog_community_concurrency_second.db')), false);
});

test('pre-restore safety backup is verified and server fails closed before restore', { concurrency: false }, async (t) => {
    const fixture = await createWalFixture(t);
    const manager = createSqliteBackupManager({ applicationRoot: fixture.applicationRoot, sqlite3, logger: quietLogger });
    const safety = await manager.createPreRestoreBackup('20260907_123456');

    assert.match(safety.filename, /^fog_community_pre_restore_20260907_123456_[a-f0-9]{12}\.db$/);
    assert.equal((await manager.verifyPublishedBackup(safety.filename)).valid, true);

    const serverSource = await fsp.readFile(path.join(__dirname, '..', 'server.js'), 'utf8');
    const routeStart = serverSource.indexOf("app.post('/api/backups/restore'");
    const safetyAwait = serverSource.indexOf('await backupManager.createPreRestoreBackup', routeStart);
    const failureResponse = serverSource.indexOf('Failed to create a verified pre-restore backup', safetyAwait);
    const restoreClose = serverSource.indexOf('db.close(', safetyAwait);
    assert.ok(routeStart >= 0 && safetyAwait > routeStart);
    assert.ok(failureResponse > safetyAwait && failureResponse < restoreClose);
    assert.ok(restoreClose > safetyAwait);

    await fixture.close();
    await Promise.all([
        fsp.rm(`${fixture.sourcePath}-wal`, { force: true }),
        fsp.rm(`${fixture.sourcePath}-shm`, { force: true })
    ]);
    await fsp.writeFile(fixture.sourcePath, 'invalid pre-restore source', { mode: 0o600 });
    await assert.rejects(manager.createPreRestoreBackup('20260907_123457'));
    assert.equal(
        (await fsp.readdir(fixture.backupDirectory)).some((name) => name.includes('20260907_123457')),
        false
    );
});

test('source and destination path confinement rejects unsafe inputs', { concurrency: false }, async (t) => {
    const fixture = await createWalFixture(t);
    const manager = createSqliteBackupManager({ applicationRoot: fixture.applicationRoot, sqlite3, logger: quietLogger });
    await assert.rejects(
        manager.createVerifiedBackup('../escaped.db'),
        (err) => err.code === 'BACKUP_INVALID_FILENAME'
    );
    assert.equal(fs.existsSync(path.join(fixture.applicationRoot, '..', 'escaped.db')), false);

    const implementation = await fsp.readFile(path.join(__dirname, '..', 'lib', 'sqlite-backup.js'), 'utf8');
    assert.doesNotMatch(implementation, /\/home\/raspi4\/(?:fog-portal-staging|fogmin-portal-v3|fog-portal)\b/);
});

test('a verified backup from another application root is not accepted as local', { concurrency: false }, async (t) => {
    const firstFixture = await createWalFixture(t);
    const secondFixture = await createWalFixture(t);
    const firstManager = createSqliteBackupManager({
        applicationRoot: firstFixture.applicationRoot,
        sqlite3,
        logger: quietLogger
    });
    const secondManager = createSqliteBackupManager({
        applicationRoot: secondFixture.applicationRoot,
        sqlite3,
        logger: quietLogger
    });
    const created = await firstManager.createVerifiedBackup('fog_community_environment_bound.db');
    const firstPath = path.join(firstFixture.backupDirectory, created.filename);
    const secondPath = path.join(secondFixture.backupDirectory, created.filename);
    await fsp.copyFile(firstPath, secondPath);
    await fsp.copyFile(`${firstPath}.json`, `${secondPath}.json`);

    const result = await secondManager.verifyPublishedBackup(created.filename);
    assert.equal(result.valid, false);
    assert.equal(result.reason, 'BACKUP_MANIFEST_MISMATCH');
});
