'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const fsp = fs.promises;
const BACKUP_METHOD = 'sqlite-online-backup';
const MANIFEST_VERSION = 1;
const DEFAULT_STEP_PAGES = 256;
const DEFAULT_RETRY_DELAY_MS = 50;
const DEFAULT_RETRY_TIMEOUT_MS = 5000;

class BackupInProgressError extends Error {
    constructor() {
        super('A database backup is already in progress');
        this.name = 'BackupInProgressError';
        this.code = 'BACKUP_IN_PROGRESS';
    }
}

function databaseOpen(sqlite3, filename, mode) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(filename, mode, (err) => {
            if (err) return reject(err);
            resolve(database);
        });
    });
}

function databaseGet(database, sql) {
    return new Promise((resolve, reject) => {
        database.get(sql, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function databaseClose(database) {
    return new Promise((resolve, reject) => {
        database.close((err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function pathExists(filename) {
    return fsp.lstat(filename).then(() => true, (err) => {
        if (err && err.code === 'ENOENT') return false;
        throw err;
    });
}

async function unlinkIfPresent(filename) {
    try {
        await fsp.unlink(filename);
    } catch (err) {
        if (err.code !== 'ENOENT') throw err;
    }
}

async function removeCandidateArtifacts(candidatePath, manifestCandidatePath) {
    const attributablePaths = [
        candidatePath,
        `${candidatePath}-wal`,
        `${candidatePath}-shm`,
        `${candidatePath}-journal`,
        manifestCandidatePath
    ];
    await Promise.all(attributablePaths.map(unlinkIfPresent));
}

function sha256File(filename) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const input = fs.createReadStream(filename);
        input.on('error', reject);
        input.on('data', (chunk) => hash.update(chunk));
        input.on('end', () => resolve(hash.digest('hex')));
    });
}

function sha256Value(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function finishBackup(backup) {
    return new Promise((resolve) => backup.finish(resolve));
}

function runOnlineBackup(sourceDatabase, candidatePath, options) {
    const stepPages = options.stepPages || DEFAULT_STEP_PAGES;
    const retryDelayMs = options.retryDelayMs || DEFAULT_RETRY_DELAY_MS;
    const retryTimeoutMs = options.retryTimeoutMs || DEFAULT_RETRY_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
        let backup;
        let settled = false;
        const startedAt = Date.now();

        const settle = (callback) => {
            if (settled) return;
            settled = true;
            callback();
        };

        const failAfterFinish = (err) => {
            finishBackup(backup).then(
                () => settle(() => reject(err)),
                () => settle(() => reject(err))
            );
        };

        backup = sourceDatabase.backup(candidatePath, (initializeError) => {
            if (initializeError) return settle(() => reject(initializeError));

            const step = () => {
                backup.step(stepPages, (stepError, done) => {
                    if (stepError) {
                        const retryable = stepError.code === 'SQLITE_BUSY' || stepError.code === 'SQLITE_LOCKED';
                        if (retryable && Date.now() - startedAt < retryTimeoutMs) {
                            return setTimeout(step, retryDelayMs);
                        }
                        return failAfterFinish(stepError);
                    }

                    if (!done) return setImmediate(step);
                    finishBackup(backup).then(() => {
                        if (!backup.completed || backup.failed) {
                            const error = new Error('SQLite online backup did not complete');
                            error.code = 'BACKUP_INCOMPLETE';
                            return settle(() => reject(error));
                        }
                        settle(() => resolve({ pageCount: backup.pageCount }));
                    }, (finishError) => settle(() => reject(finishError)));
                });
            };

            step();
        });
    });
}

function immutableReadOnlyUri(filename) {
    const fileUrl = pathToFileURL(filename);
    fileUrl.searchParams.set('mode', 'ro');
    fileUrl.searchParams.set('immutable', '1');
    return fileUrl.href;
}

async function verifyIntegrity(sqlite3, filename, immutable = true) {
    const openTarget = immutable ? immutableReadOnlyUri(filename) : filename;
    const mode = sqlite3.OPEN_READONLY | (immutable ? sqlite3.OPEN_URI : 0);
    const database = await databaseOpen(sqlite3, openTarget, mode);
    try {
        const row = await databaseGet(database, 'PRAGMA integrity_check');
        const result = row && row.integrity_check;
        if (result !== 'ok') {
            const error = new Error('SQLite integrity verification failed');
            error.code = 'BACKUP_INTEGRITY_FAILED';
            throw error;
        }
        return result;
    } finally {
        await databaseClose(database);
    }
}

async function normalizeAndVerifyCandidate(sqlite3, candidatePath) {
    const database = await databaseOpen(sqlite3, candidatePath, sqlite3.OPEN_READWRITE);
    let integrity;
    try {
        await databaseGet(database, 'PRAGMA wal_checkpoint(TRUNCATE)');
        const journalRow = await databaseGet(database, 'PRAGMA journal_mode=DELETE');
        if (!journalRow || String(journalRow.journal_mode).toLowerCase() !== 'delete') {
            const error = new Error('Backup journal normalization failed');
            error.code = 'BACKUP_JOURNAL_MODE_FAILED';
            throw error;
        }
        const integrityRow = await databaseGet(database, 'PRAGMA integrity_check');
        integrity = integrityRow && integrityRow.integrity_check;
        if (integrity !== 'ok') {
            const error = new Error('SQLite integrity verification failed');
            error.code = 'BACKUP_INTEGRITY_FAILED';
            throw error;
        }
    } finally {
        await databaseClose(database);
    }

    await Promise.all([
        unlinkIfPresent(`${candidatePath}-wal`),
        unlinkIfPresent(`${candidatePath}-shm`),
        unlinkIfPresent(`${candidatePath}-journal`)
    ]);
    await fsp.chmod(candidatePath, 0o600);
    const stats = await fsp.stat(candidatePath);
    if (!stats.isFile() || stats.size <= 0) {
        const error = new Error('Backup candidate is empty or invalid');
        error.code = 'BACKUP_EMPTY';
        throw error;
    }
    return {
        integrity,
        sizeBytes: stats.size,
        sha256: await sha256File(candidatePath)
    };
}

function safeLog(logger, level, event, details) {
    if (!logger) return;
    try {
        const writer = typeof logger[level] === 'function' ? logger[level].bind(logger) : logger.log.bind(logger);
        const fields = Object.entries(details)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ');
        writer(`${event}${fields ? ` ${fields}` : ''}`);
    } catch (err) {
        // Backup success/failure must not depend on a logger implementation.
    }
}

function safeErrorCode(err) {
    if (err && typeof err.code === 'string' && /^[A-Z0-9_]+$/.test(err.code)) return err.code;
    return err && err.name === 'Error' ? 'BACKUP_ERROR' : 'BACKUP_FAILURE';
}

function validateBackupFilename(filename) {
    return typeof filename === 'string' &&
        filename.length <= 255 &&
        filename === path.basename(filename) &&
        /^fog_community_[A-Za-z0-9_-]+\.db$/.test(filename);
}

function uniqueSuffix() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function createSqliteBackupManager({ applicationRoot, sqlite3, logger = console } = {}) {
    if (!applicationRoot || !sqlite3) throw new TypeError('applicationRoot and sqlite3 are required');

    const rootPath = path.resolve(applicationRoot);
    const sourcePath = path.join(rootPath, 'fog_community.db');
    const backupDirectory = path.join(rootPath, 'backups');
    let backupInProgress = false;

    async function resolveSafePaths(finalFilename) {
        if (!validateBackupFilename(finalFilename)) {
            const error = new Error('Invalid backup filename');
            error.code = 'BACKUP_INVALID_FILENAME';
            throw error;
        }

        const [rootRealPath, sourceStats, sourceRealPath, backupStats, backupRealPath] = await Promise.all([
            fsp.realpath(rootPath),
            fsp.lstat(sourcePath),
            fsp.realpath(sourcePath),
            fsp.lstat(backupDirectory),
            fsp.realpath(backupDirectory)
        ]);

        if (!sourceStats.isFile() || sourceStats.isSymbolicLink() || sourceRealPath !== path.join(rootRealPath, 'fog_community.db')) {
            const error = new Error('Unsafe SQLite source path');
            error.code = 'BACKUP_UNSAFE_SOURCE';
            throw error;
        }
        if (!backupStats.isDirectory() || backupStats.isSymbolicLink() || backupRealPath !== path.join(rootRealPath, 'backups')) {
            const error = new Error('Unsafe backup directory');
            error.code = 'BACKUP_UNSAFE_DIRECTORY';
            throw error;
        }

        const finalPath = path.resolve(backupRealPath, finalFilename);
        if (path.dirname(finalPath) !== backupRealPath) {
            const error = new Error('Backup path escapes backup directory');
            error.code = 'BACKUP_PATH_ESCAPE';
            throw error;
        }
        return { rootRealPath, sourceRealPath, backupRealPath, finalPath };
    }

    async function verifyPublishedBackup(finalFilename) {
        let paths;
        try {
            paths = await resolveSafePaths(finalFilename);
            const manifestPath = `${paths.finalPath}.json`;
            const [stats, manifestStats] = await Promise.all([
                fsp.lstat(paths.finalPath),
                fsp.lstat(manifestPath)
            ]);
            if (!stats.isFile() || stats.isSymbolicLink() || stats.size <= 0) {
                return { valid: false, reason: 'BACKUP_FILE_INVALID' };
            }
            if (!manifestStats.isFile() || manifestStats.isSymbolicLink() || manifestStats.size > 16 * 1024) {
                return { valid: false, reason: 'BACKUP_MANIFEST_INVALID' };
            }

            const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
            if (
                manifest.version !== MANIFEST_VERSION ||
                manifest.method !== BACKUP_METHOD ||
                manifest.filename !== finalFilename ||
                manifest.sourceIdentity !== sha256Value(paths.rootRealPath) ||
                manifest.integrity !== 'ok' ||
                manifest.sizeBytes !== stats.size ||
                typeof manifest.sha256 !== 'string' ||
                !/^[a-f0-9]{64}$/.test(manifest.sha256)
            ) return { valid: false, reason: 'BACKUP_MANIFEST_MISMATCH' };

            const [integrity, checksum] = await Promise.all([
                verifyIntegrity(sqlite3, paths.finalPath),
                sha256File(paths.finalPath)
            ]);
            if (checksum !== manifest.sha256) return { valid: false, reason: 'BACKUP_CHECKSUM_MISMATCH' };
            return { valid: true, filename: finalFilename, integrity, sizeBytes: stats.size, sha256: checksum };
        } catch (err) {
            return { valid: false, reason: safeErrorCode(err) };
        }
    }

    async function createVerifiedBackup(finalFilename) {
        if (backupInProgress) throw new BackupInProgressError();
        backupInProgress = true;

        const startedAt = Date.now();
        let candidatePath;
        let manifestCandidatePath;
        let publishedPath;
        let publishedManifestPath;
        try {
            const paths = await resolveSafePaths(finalFilename);
            const manifestPath = `${paths.finalPath}.json`;
            if (await pathExists(paths.finalPath) || await pathExists(manifestPath)) {
                const error = new Error('Backup destination already exists');
                error.code = 'BACKUP_DESTINATION_EXISTS';
                throw error;
            }

            const candidateToken = `${process.pid}-${Date.now()}-${uniqueSuffix()}`;
            candidatePath = path.join(paths.backupRealPath, `.${finalFilename}.${candidateToken}.partial`);
            manifestCandidatePath = `${candidatePath}.json`;
            const candidateHandle = await fsp.open(candidatePath, 'wx', 0o600);
            await candidateHandle.close();

            const sourceDatabase = await databaseOpen(sqlite3, paths.sourceRealPath, sqlite3.OPEN_READONLY);
            let onlineResult;
            try {
                onlineResult = await runOnlineBackup(sourceDatabase, candidatePath, {});
            } finally {
                await databaseClose(sourceDatabase);
            }

            if (!await pathExists(candidatePath)) {
                const error = new Error('Backup candidate was not created');
                error.code = 'BACKUP_CANDIDATE_MISSING';
                throw error;
            }
            const verified = await normalizeAndVerifyCandidate(sqlite3, candidatePath);
            const durationMs = Date.now() - startedAt;
            const manifest = {
                version: MANIFEST_VERSION,
                method: BACKUP_METHOD,
                filename: finalFilename,
                sourceIdentity: sha256Value(paths.rootRealPath),
                createdAt: new Date().toISOString(),
                sizeBytes: verified.sizeBytes,
                sha256: verified.sha256,
                integrity: verified.integrity,
                pageCount: onlineResult.pageCount,
                durationMs
            };
            await fsp.writeFile(manifestCandidatePath, `${JSON.stringify(manifest, null, 2)}\n`, {
                encoding: 'utf8',
                flag: 'wx',
                mode: 0o600
            });

            await fsp.rename(candidatePath, paths.finalPath);
            publishedPath = paths.finalPath;
            await fsp.rename(manifestCandidatePath, manifestPath);
            publishedManifestPath = manifestPath;

            safeLog(logger, 'info', '[BACKUP] Verified backup created', {
                filename: finalFilename,
                sizeBytes: verified.sizeBytes,
                integrity: verified.integrity,
                checksum: verified.sha256.slice(0, 12),
                durationMs
            });
            return { filename: finalFilename, created: true, ...verified, durationMs };
        } catch (err) {
            if (publishedManifestPath) {
                try { await unlinkIfPresent(publishedManifestPath); } catch (cleanupError) {
                    safeLog(logger, 'error', '[BACKUP ERROR] Published manifest cleanup failed', {
                        filename: path.basename(publishedManifestPath),
                        code: safeErrorCode(cleanupError)
                    });
                }
            }
            if (publishedPath) {
                try { await unlinkIfPresent(publishedPath); } catch (cleanupError) {
                    safeLog(logger, 'error', '[BACKUP ERROR] Published backup cleanup failed', {
                        filename: path.basename(publishedPath),
                        code: safeErrorCode(cleanupError)
                    });
                }
            }
            safeLog(logger, 'error', '[BACKUP ERROR] Verified backup failed', {
                filename: validateBackupFilename(finalFilename) ? finalFilename : 'invalid',
                code: safeErrorCode(err),
                durationMs: Date.now() - startedAt
            });
            throw err;
        } finally {
            if (candidatePath) {
                try {
                    await removeCandidateArtifacts(candidatePath, manifestCandidatePath);
                } catch (cleanupError) {
                    safeLog(logger, 'error', '[BACKUP ERROR] Candidate cleanup failed', {
                        filename: path.basename(candidatePath),
                        code: safeErrorCode(cleanupError)
                    });
                }
            }
            backupInProgress = false;
        }
    }

    async function ensureDailyBackup({ dateKey, timeKey }) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !/^\d{9}$/.test(timeKey)) {
            const error = new Error('Invalid daily backup timestamp');
            error.code = 'BACKUP_INVALID_TIMESTAMP';
            throw error;
        }

        const prefix = `fog_community_${dateKey}`;
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dailyPattern = new RegExp(`^${escapedPrefix}(?:_[A-Za-z0-9_-]+)?\\.db$`);
        const { backupRealPath } = await resolveSafePaths(`${prefix}_path_check.db`);
        const candidates = (await fsp.readdir(backupRealPath))
            .filter((filename) => dailyPattern.test(filename))
            .sort()
            .reverse();

        for (const filename of candidates) {
            const verified = await verifyPublishedBackup(filename);
            if (verified.valid) return { ...verified, created: false };
            safeLog(logger, 'warn', '[BACKUP] Ignoring unverified same-day backup', {
                filename,
                reason: verified.reason
            });
        }

        const filename = `${prefix}_${timeKey}_${uniqueSuffix()}.db`;
        return createVerifiedBackup(filename);
    }

    function createPreRestoreBackup(timestampKey) {
        if (!/^\d{8}_\d{6}$/.test(timestampKey)) {
            const error = new Error('Invalid pre-restore timestamp');
            error.code = 'BACKUP_INVALID_TIMESTAMP';
            return Promise.reject(error);
        }
        return createVerifiedBackup(`fog_community_pre_restore_${timestampKey}_${uniqueSuffix()}.db`);
    }

    return {
        sourcePath,
        backupDirectory,
        createVerifiedBackup,
        createPreRestoreBackup,
        ensureDailyBackup,
        verifyPublishedBackup
    };
}

module.exports = {
    BACKUP_METHOD,
    BackupInProgressError,
    createSqliteBackupManager
};
