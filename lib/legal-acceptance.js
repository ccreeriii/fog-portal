'use strict';

const {
    databaseRun,
    databaseGet,
    databaseAll,
    databaseExec,
    withImmediateTransaction
} = require('./email-security');

const TERMS_VERSION = '2026-09-11';
const PRIVACY_VERSION = '2026-09-11';
const LEGAL_ACCEPTANCE_SOURCES = Object.freeze([
    'registration',
    'google_signup',
    'account_claim'
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

async function initializeLegalAcceptanceSchema(database) {
    await databaseExec(database, `
        CREATE TABLE IF NOT EXISTS legal_acceptances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            terms_version TEXT NOT NULL,
            privacy_version TEXT NOT NULL,
            accepted_at INTEGER NOT NULL,
            source TEXT NOT NULL CHECK (source IN ('registration', 'google_signup', 'account_claim')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx
            ON legal_acceptances(user_id, accepted_at DESC);
    `);
}

function createLegalAcceptanceStore({ database, now = () => Date.now() } = {}) {
    if (!database || typeof now !== 'function') {
        throw new TypeError('database and now are required');
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
                    (user_id, terms_version, privacy_version, accepted_at, source)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, TERMS_VERSION, PRIVACY_VERSION, acceptedAt, source]
            );
            return Object.freeze({
                ...created,
                userId,
                legalAcceptanceId: inserted.lastID
            });
        });

        return Object.freeze({
            accepted: true,
            termsVersion: TERMS_VERSION,
            privacyVersion: PRIVACY_VERSION,
            acceptedAt,
            source,
            result
        });
    }

    return Object.freeze({ createAcceptedAccount });
}

module.exports = {
    TERMS_VERSION,
    PRIVACY_VERSION,
    LEGAL_ACCEPTANCE_SOURCES,
    hasExplicitLegalAcceptance,
    initializeLegalAcceptanceSchema,
    createLegalAcceptanceStore
};
