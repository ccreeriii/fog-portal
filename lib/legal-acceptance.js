'use strict';

const crypto = require('crypto');
const {
    databaseRun,
    databaseGet,
    databaseAll,
    withImmediateTransaction
} = require('./email-security');

const TERMS_VERSION = '2026-09-11';
const PRIVACY_VERSION = '2026-09-11';
const POLICY_PUBLISHED_AT = '2026-09-11T00:00:00+08:00';
const LEGAL_ACCEPTANCE_SOURCES = Object.freeze([
    'registration',
    'google_signup',
    'account_claim',
    'existing_user_gate',
    'policy_reacceptance'
]);
const LEGAL_ACCEPTANCE_SOURCE_SET = new Set(LEGAL_ACCEPTANCE_SOURCES);

function normalizePositiveInteger(value) {
    const normalized = typeof value === 'number'
        ? value
        : typeof value === 'string' && /^[1-9]\d*$/.test(value)
            ? Number(value)
            : NaN;
    return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}

function hasExplicitLegalAcceptance(value) {
    return value === true;
}

function hashPolicyContent(content) {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

function createCurrentPolicyEvidence({ termsContent, privacyContent } = {}) {
    if (typeof termsContent !== 'string' || !termsContent.trim()) {
        throw new TypeError('Current Terms content is required');
    }
    if (typeof privacyContent !== 'string' || !privacyContent.trim()) {
        throw new TypeError('Current Privacy content is required');
    }
    return Object.freeze({
        terms: Object.freeze({
            policyType: 'terms',
            version: TERMS_VERSION,
            contentSha256: hashPolicyContent(termsContent),
            contentSnapshot: termsContent,
            publishedAt: POLICY_PUBLISHED_AT
        }),
        privacy: Object.freeze({
            policyType: 'privacy',
            version: PRIVACY_VERSION,
            contentSha256: hashPolicyContent(privacyContent),
            contentSnapshot: privacyContent,
            publishedAt: POLICY_PUBLISHED_AT
        })
    });
}

function createAcceptanceTableSql(tableName = 'legal_acceptances') {
    return `CREATE TABLE ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        terms_version TEXT NOT NULL,
        privacy_version TEXT NOT NULL,
        terms_sha256 TEXT,
        privacy_sha256 TEXT,
        accepted_at INTEGER NOT NULL,
        source TEXT NOT NULL CHECK (source IN ('registration', 'google_signup', 'account_claim', 'existing_user_gate', 'policy_reacceptance')),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (user_id, terms_version, privacy_version)
    )`;
}

async function ensurePolicyEvidence(database, policy) {
    const existing = await databaseGet(
        database,
        `SELECT content_sha256, content_snapshot, published_at
         FROM legal_policy_versions
         WHERE policy_type = ? AND version = ?`,
        [policy.policyType, policy.version]
    );
    if (existing) {
        if (
            existing.content_sha256 !== policy.contentSha256 ||
            existing.content_snapshot !== policy.contentSnapshot ||
            existing.published_at !== policy.publishedAt
        ) {
            const error = new Error('Published legal policy content does not match immutable evidence');
            error.code = 'LEGAL_POLICY_VERSION_CONFLICT';
            throw error;
        }
        return;
    }
    await databaseRun(
        database,
        `INSERT INTO legal_policy_versions
            (policy_type, version, content_sha256, content_snapshot, published_at)
         VALUES (?, ?, ?, ?, ?)`,
        [policy.policyType, policy.version, policy.contentSha256,
            policy.contentSnapshot, policy.publishedAt]
    );
}

async function initializeLegalAcceptanceSchema(database, { currentPolicies = null } = {}) {
    if (!database) throw new TypeError('database is required');

    await withImmediateTransaction(database, async () => {
        await databaseRun(database, `CREATE TABLE IF NOT EXISTS legal_policy_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            policy_type TEXT NOT NULL CHECK (policy_type IN ('terms', 'privacy')),
            version TEXT NOT NULL,
            content_sha256 TEXT NOT NULL CHECK (length(content_sha256) = 64),
            content_snapshot TEXT NOT NULL,
            published_at TEXT NOT NULL,
            UNIQUE (policy_type, version)
        )`);

        if (currentPolicies) {
            await ensurePolicyEvidence(database, currentPolicies.terms);
            await ensurePolicyEvidence(database, currentPolicies.privacy);
        }

        const existingTable = await databaseGet(
            database,
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'legal_acceptances'"
        );
        if (!existingTable) {
            await databaseRun(database, createAcceptanceTableSql());
        } else {
            const columns = await databaseAll(database, 'PRAGMA table_info(legal_acceptances)');
            const columnNames = new Set(columns.map(column => column.name));
            const hasExpandedSources = /existing_user_gate/.test(existingTable.sql || '') &&
                /policy_reacceptance/.test(existingTable.sql || '');
            const uniqueIndexes = await databaseAll(database, 'PRAGMA index_list(legal_acceptances)');
            let hasVersionUniqueIndex = false;
            for (const index of uniqueIndexes.filter(item => item.unique === 1)) {
                const safeIndexName = String(index.name).replaceAll('"', '""');
                const fields = await databaseAll(database, `PRAGMA index_info("${safeIndexName}")`);
                if (fields.map(field => field.name).join(',') === 'user_id,terms_version,privacy_version') {
                    hasVersionUniqueIndex = true;
                    break;
                }
            }
            const requiresRebuild = !columnNames.has('terms_sha256') ||
                !columnNames.has('privacy_sha256') || !hasExpandedSources || !hasVersionUniqueIndex;

            if (requiresRebuild) {
                const duplicate = await databaseGet(
                    database,
                    `SELECT user_id, terms_version, privacy_version
                     FROM legal_acceptances
                     GROUP BY user_id, terms_version, privacy_version
                     HAVING COUNT(*) > 1 LIMIT 1`
                );
                if (duplicate) {
                    const error = new Error('Duplicate legal acceptance rows require manual review');
                    error.code = 'LEGAL_ACCEPTANCE_DUPLICATE_MIGRATION_BLOCKED';
                    throw error;
                }

                if (currentPolicies && columnNames.has('terms_sha256')) {
                    const conflict = await databaseGet(
                        database,
                        `SELECT id FROM legal_acceptances
                         WHERE terms_version = ? AND terms_sha256 IS NOT NULL AND terms_sha256 <> ?
                         LIMIT 1`,
                        [TERMS_VERSION, currentPolicies.terms.contentSha256]
                    );
                    if (conflict) throw Object.assign(new Error('Current Terms hash conflict'), { code: 'LEGAL_POLICY_HASH_CONFLICT' });
                }
                if (currentPolicies && columnNames.has('privacy_sha256')) {
                    const conflict = await databaseGet(
                        database,
                        `SELECT id FROM legal_acceptances
                         WHERE privacy_version = ? AND privacy_sha256 IS NOT NULL AND privacy_sha256 <> ?
                         LIMIT 1`,
                        [PRIVACY_VERSION, currentPolicies.privacy.contentSha256]
                    );
                    if (conflict) throw Object.assign(new Error('Current Privacy hash conflict'), { code: 'LEGAL_POLICY_HASH_CONFLICT' });
                }

                await databaseRun(database, 'DROP TABLE IF EXISTS legal_acceptances_v2_migration');
                await databaseRun(database, createAcceptanceTableSql('legal_acceptances_v2_migration'));
                const termsHashExpression = columnNames.has('terms_sha256')
                    ? 'terms_sha256'
                    : currentPolicies
                        ? 'CASE WHEN terms_version = ? THEN ? ELSE NULL END'
                        : 'NULL';
                const privacyHashExpression = columnNames.has('privacy_sha256')
                    ? 'privacy_sha256'
                    : currentPolicies
                        ? 'CASE WHEN privacy_version = ? THEN ? ELSE NULL END'
                        : 'NULL';
                const parameters = [];
                if (!columnNames.has('terms_sha256') && currentPolicies) {
                    parameters.push(TERMS_VERSION, currentPolicies.terms.contentSha256);
                }
                if (!columnNames.has('privacy_sha256') && currentPolicies) {
                    parameters.push(PRIVACY_VERSION, currentPolicies.privacy.contentSha256);
                }
                await databaseRun(
                    database,
                    `INSERT INTO legal_acceptances_v2_migration
                        (id, user_id, terms_version, privacy_version, terms_sha256,
                         privacy_sha256, accepted_at, source)
                     SELECT id, user_id, terms_version, privacy_version,
                            ${termsHashExpression}, ${privacyHashExpression}, accepted_at, source
                     FROM legal_acceptances`,
                    parameters
                );
                await databaseRun(database, 'DROP TABLE legal_acceptances');
                await databaseRun(database, 'ALTER TABLE legal_acceptances_v2_migration RENAME TO legal_acceptances');
            }
        }

        if (currentPolicies) {
            await databaseRun(
                database,
                `UPDATE legal_acceptances SET terms_sha256 = ?
                 WHERE terms_version = ? AND terms_sha256 IS NULL`,
                [currentPolicies.terms.contentSha256, TERMS_VERSION]
            );
            await databaseRun(
                database,
                `UPDATE legal_acceptances SET privacy_sha256 = ?
                 WHERE privacy_version = ? AND privacy_sha256 IS NULL`,
                [currentPolicies.privacy.contentSha256, PRIVACY_VERSION]
            );
        }

        await databaseRun(
            database,
            `CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx
             ON legal_acceptances(user_id, accepted_at DESC)`
        );
    });
}

function createLegalAcceptanceStore({ database, currentPolicies, now = () => Date.now() } = {}) {
    if (!database || !currentPolicies || typeof now !== 'function') {
        throw new TypeError('database, currentPolicies, and now are required');
    }

    const currentParams = Object.freeze([
        TERMS_VERSION,
        PRIVACY_VERSION,
        currentPolicies.terms.contentSha256,
        currentPolicies.privacy.contentSha256
    ]);

    async function getCurrentAcceptance(userId) {
        const canonicalUserId = normalizePositiveInteger(userId);
        if (!canonicalUserId) return null;
        return databaseGet(
            database,
            `SELECT id, user_id, terms_version, privacy_version, terms_sha256,
                    privacy_sha256, accepted_at, source
             FROM legal_acceptances
             WHERE user_id = ? AND terms_version = ? AND privacy_version = ?
               AND terms_sha256 = ? AND privacy_sha256 = ?
             ORDER BY accepted_at DESC, id DESC LIMIT 1`,
            [canonicalUserId, ...currentParams]
        );
    }

    async function getLatestAcceptance(userId) {
        const canonicalUserId = normalizePositiveInteger(userId);
        if (!canonicalUserId) return null;
        return databaseGet(
            database,
            `SELECT id, user_id, terms_version, privacy_version, terms_sha256,
                    privacy_sha256, accepted_at, source
             FROM legal_acceptances
             WHERE user_id = ? ORDER BY accepted_at DESC, id DESC LIMIT 1`,
            [canonicalUserId]
        );
    }

    async function requiresCurrentAcceptance(userId) {
        return !(await getCurrentAcceptance(userId));
    }

    async function createAcceptedAccount({ accepted, source, createAccount } = {}) {
        if (!hasExplicitLegalAcceptance(accepted)) {
            return Object.freeze({ accepted: false, reason: 'LEGAL_ACCEPTANCE_REQUIRED' });
        }
        if (!LEGAL_ACCEPTANCE_SOURCE_SET.has(source) || typeof createAccount !== 'function') {
            throw new TypeError('A controlled source and account creation action are required');
        }

        const acceptedAt = Math.trunc(now());
        const result = await withImmediateTransaction(database, async () => {
            const transaction = Object.freeze({
                run: (sql, params = []) => databaseRun(database, sql, params),
                get: (sql, params = []) => databaseGet(database, sql, params),
                all: (sql, params = []) => databaseAll(database, sql, params)
            });
            const created = await createAccount(transaction);
            const userId = normalizePositiveInteger(created && created.userId);
            if (!userId) throw new TypeError('Account creation must return a valid userId');

            const inserted = await databaseRun(
                database,
                `INSERT INTO legal_acceptances
                    (user_id, terms_version, privacy_version, terms_sha256,
                     privacy_sha256, accepted_at, source)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, ...currentParams, acceptedAt, source]
            );
            return Object.freeze({
                ...created,
                userId,
                legalAcceptanceId: inserted.lastID
            });
        });

        return Object.freeze({
            accepted: true,
            created: true,
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
            termsSha256: currentPolicies.terms.contentSha256,
            privacySha256: currentPolicies.privacy.contentSha256,
            acceptedAt,
            source,
            result
        });
    }

    async function acceptCurrentPolicies({ userId, accepted } = {}) {
        if (!hasExplicitLegalAcceptance(accepted)) {
            return Object.freeze({ accepted: false, reason: 'LEGAL_ACCEPTANCE_REQUIRED' });
        }
        const canonicalUserId = normalizePositiveInteger(userId);
        if (!canonicalUserId) throw new TypeError('A canonical userId is required');

        return withImmediateTransaction(database, async () => {
            const user = await databaseGet(database, 'SELECT id FROM users WHERE id = ?', [canonicalUserId]);
            if (!user) throw Object.assign(new Error('Canonical user is unavailable'), { code: 'LEGAL_USER_UNAVAILABLE' });

            const current = await databaseGet(
                database,
                `SELECT id, user_id, terms_version, privacy_version, terms_sha256,
                        privacy_sha256, accepted_at, source
                 FROM legal_acceptances
                 WHERE user_id = ? AND terms_version = ? AND privacy_version = ?
                   AND terms_sha256 = ? AND privacy_sha256 = ? LIMIT 1`,
                [canonicalUserId, ...currentParams]
            );
            if (current) return Object.freeze({ accepted: true, created: false, acceptance: current });

            const latest = await databaseGet(
                database,
                'SELECT id FROM legal_acceptances WHERE user_id = ? ORDER BY accepted_at DESC, id DESC LIMIT 1',
                [canonicalUserId]
            );
            const source = latest ? 'policy_reacceptance' : 'existing_user_gate';
            const acceptedAt = Math.trunc(now());
            const inserted = await databaseRun(
                database,
                `INSERT OR IGNORE INTO legal_acceptances
                    (user_id, terms_version, privacy_version, terms_sha256,
                     privacy_sha256, accepted_at, source)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [canonicalUserId, ...currentParams, acceptedAt, source]
            );
            const acceptance = await databaseGet(
                database,
                `SELECT id, user_id, terms_version, privacy_version, terms_sha256,
                        privacy_sha256, accepted_at, source
                 FROM legal_acceptances
                 WHERE user_id = ? AND terms_version = ? AND privacy_version = ?
                   AND terms_sha256 = ? AND privacy_sha256 = ? LIMIT 1`,
                [canonicalUserId, ...currentParams]
            );
            if (!acceptance) throw new Error('Legal acceptance was not recorded');
            return Object.freeze({ accepted: true, created: inserted.changes === 1, acceptance });
        });
    }

    return Object.freeze({
        createAcceptedAccount,
        getCurrentAcceptance,
        getLatestAcceptance,
        requiresCurrentAcceptance,
        acceptCurrentPolicies
    });
}

module.exports = {
    TERMS_VERSION,
    PRIVACY_VERSION,
    POLICY_PUBLISHED_AT,
    LEGAL_ACCEPTANCE_SOURCES,
    hasExplicitLegalAcceptance,
    hashPolicyContent,
    createCurrentPolicyEvidence,
    initializeLegalAcceptanceSchema,
    createLegalAcceptanceStore
};
