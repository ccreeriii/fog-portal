'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3').verbose();

const {
    TERMS_VERSION,
    PRIVACY_VERSION,
    LEGAL_ACCEPTANCE_SOURCES,
    hasExplicitLegalAcceptance,
    createCurrentPolicyEvidence,
    initializeLegalAcceptanceSchema,
    createLegalAcceptanceStore
} = require('../lib/legal-acceptance');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const currentPolicies = createCurrentPolicyEvidence({
    termsContent: fs.readFileSync(path.join(repositoryRoot, 'public', 'terms', 'index.html'), 'utf8'),
    privacyContent: fs.readFileSync(path.join(repositoryRoot, 'public', 'privacy', 'index.html'), 'utf8')
});

function openDatabase(filename) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(filename, error => error ? reject(error) : resolve(database));
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
}

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function(error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
    });
}

async function withTemporaryDatabase(action) {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-legal-acceptance-'));
    const database = await openDatabase(path.join(temporaryRoot, 'test.db'));
    try {
        await run(database, `CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL
        )`);
        await run(database, `CREATE TABLE accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL
        )`);
        await initializeLegalAcceptanceSchema(database, { currentPolicies });
        return await action(database);
    } finally {
        await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    }
}

test('legal acceptance requires an explicit boolean true', () => {
    assert.equal(hasExplicitLegalAcceptance(true), true);
    for (const value of [false, undefined, null, 1, 'true', 'accepted', {}]) {
        assert.equal(hasExplicitLegalAcceptance(value), false);
    }
});

test('legal acceptance migration is idempotent and append-oriented', async () => {
    await withTemporaryDatabase(async database => {
        await initializeLegalAcceptanceSchema(database, { currentPolicies });
        const columns = await new Promise((resolve, reject) => {
            database.all('PRAGMA table_info(legal_acceptances)', (error, rows) => (
                error ? reject(error) : resolve(rows)
            ));
        });
        assert.deepEqual(
            columns.map(column => column.name),
            ['id', 'user_id', 'terms_version', 'privacy_version', 'terms_sha256',
                'privacy_sha256', 'accepted_at', 'source']
        );
        assert.ok(await get(
            database,
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'legal_acceptances_user_idx'"
        ));
        assert.equal((await new Promise((resolve, reject) => {
            database.all('SELECT * FROM legal_policy_versions', (error, rows) => error ? reject(error) : resolve(rows));
        })).length, 2);
    });
});

test('account and server-owned legal acceptance commit atomically', async () => {
    await withTemporaryDatabase(async database => {
        const acceptedAt = 1_789_012_345_678;
        const store = createLegalAcceptanceStore({ database, currentPolicies, now: () => acceptedAt });
        let called = false;
        const rejected = await store.createAcceptedAccount({
            accepted: false,
            source: 'registration',
            createAccount: async () => { called = true; }
        });
        assert.deepEqual(rejected, { accepted: false, reason: 'LEGAL_ACCEPTANCE_REQUIRED' });
        assert.equal(called, false);

        const result = await store.createAcceptedAccount({
            accepted: true,
            source: 'registration',
            createAccount: async transaction => {
                const account = await transaction.run(
                    'INSERT INTO accounts (username) VALUES (?)',
                    ['created-account']
                );
                const user = await transaction.run(
                    'INSERT INTO users (username) VALUES (?)',
                    ['created-user']
                );
                return {
                    userId: user.lastID,
                    accountId: account.lastID,
                    source: 'forged',
                    termsVersion: 'forged',
                    privacyVersion: 'forged',
                    acceptedAt: 1
                };
            }
        });
        assert.equal(result.accepted, true);
        assert.equal(result.termsVersion, TERMS_VERSION);
        assert.equal(result.privacyVersion, PRIVACY_VERSION);
        assert.equal(result.acceptedAt, acceptedAt);
        assert.equal(result.source, 'registration');
        assert.deepEqual(
            await get(database, 'SELECT user_id, terms_version, privacy_version, terms_sha256, privacy_sha256, accepted_at, source FROM legal_acceptances'),
            {
                user_id: result.result.userId,
                terms_version: '2026-09-11',
                privacy_version: '2026-09-11',
                terms_sha256: currentPolicies.terms.contentSha256,
                privacy_sha256: currentPolicies.privacy.contentSha256,
                accepted_at: acceptedAt,
                source: 'registration'
            }
        );
        assert.ok(await get(database, 'SELECT id FROM accounts WHERE id = ?', [result.result.accountId]));
    });
});

test('acceptance failure rolls back account and user creation', async () => {
    await withTemporaryDatabase(async database => {
        const store = createLegalAcceptanceStore({ database, currentPolicies });
        await run(database, `CREATE TRIGGER reject_legal_acceptance
            BEFORE INSERT ON legal_acceptances
            BEGIN SELECT RAISE(ABORT, 'simulated legal acceptance failure'); END`);
        await assert.rejects(
            store.createAcceptedAccount({
                accepted: true,
                source: 'google_signup',
                createAccount: async transaction => {
                    await transaction.run('INSERT INTO accounts (username) VALUES (?)', ['rolled-back-account']);
                    const user = await transaction.run('INSERT INTO users (username) VALUES (?)', ['rolled-back-user']);
                    return { userId: user.lastID };
                }
            }),
            /simulated legal acceptance failure/
        );
        assert.equal(await get(database, "SELECT id FROM accounts WHERE username = 'rolled-back-account'"), null);
        assert.equal(await get(database, "SELECT id FROM users WHERE username = 'rolled-back-user'"), null);
        assert.equal(await get(database, 'SELECT id FROM legal_acceptances'), null);
    });
});

test('V1 schema migrates without fabricating history and enforces expanded controlled sources', async () => {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-legal-v1-migration-'));
    const database = await openDatabase(path.join(temporaryRoot, 'test.db'));
    try {
        await run(database, 'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL)');
        await run(database, "INSERT INTO users (id, username) VALUES (1, 'legacy-user')");
        await run(database, `CREATE TABLE legal_acceptances (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            terms_version TEXT NOT NULL,
            privacy_version TEXT NOT NULL,
            accepted_at INTEGER NOT NULL,
            source TEXT NOT NULL CHECK (source IN ('registration', 'google_signup', 'account_claim')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);
        await run(database, `CREATE INDEX legal_acceptances_user_idx
            ON legal_acceptances(user_id, accepted_at DESC)`);
        await run(
            database,
            `INSERT INTO legal_acceptances
                (id, user_id, terms_version, privacy_version, accepted_at, source)
             VALUES (27, 1, ?, ?, 1700000000000, 'registration')`,
            [TERMS_VERSION, PRIVACY_VERSION]
        );

        await initializeLegalAcceptanceSchema(database, { currentPolicies });
        await initializeLegalAcceptanceSchema(database, { currentPolicies });

        const preserved = await get(database, 'SELECT * FROM legal_acceptances WHERE id = 27');
        assert.equal(preserved.user_id, 1);
        assert.equal(preserved.accepted_at, 1700000000000);
        assert.equal(preserved.source, 'registration');
        assert.equal(preserved.terms_sha256, currentPolicies.terms.contentSha256);
        assert.equal(preserved.privacy_sha256, currentPolicies.privacy.contentSha256);
        assert.ok(await get(database, "SELECT name FROM sqlite_master WHERE name = 'legal_acceptances_user_idx'"));

        for (const [offset, source] of LEGAL_ACCEPTANCE_SOURCES.entries()) {
            await run(
                database,
                `INSERT INTO legal_acceptances
                    (user_id, terms_version, privacy_version, accepted_at, source)
                 VALUES (1, ?, ?, ?, ?)`,
                [`test-terms-${offset}`, `test-privacy-${offset}`, 1700000000100 + offset, source]
            );
        }
        await assert.rejects(
            run(
                database,
                `INSERT INTO legal_acceptances
                    (user_id, terms_version, privacy_version, accepted_at, source)
                 VALUES (1, 'invalid-terms', 'invalid-privacy', 1, 'forged')`
            ),
            /CHECK constraint failed/
        );
        await assert.rejects(
            run(
                database,
                `INSERT INTO legal_acceptances
                    (user_id, terms_version, privacy_version, accepted_at, source)
                 VALUES (1, ?, ?, 2, 'registration')`,
                [TERMS_VERSION, PRIVACY_VERSION]
            ),
            /UNIQUE constraint failed/
        );
    } finally {
        await closeDatabase(database);
        await fsp.rm(temporaryRoot, { recursive: true, force: true });
    }
});

test('policy evidence is immutable for a published version', async () => {
    await withTemporaryDatabase(async database => {
        const changedPolicies = createCurrentPolicyEvidence({
            termsContent: `${currentPolicies.terms.contentSnapshot}\nchanged without a version bump`,
            privacyContent: currentPolicies.privacy.contentSnapshot
        });
        await assert.rejects(
            initializeLegalAcceptanceSchema(database, { currentPolicies: changedPolicies }),
            error => error && error.code === 'LEGAL_POLICY_VERSION_CONFLICT'
        );
        assert.equal((await get(database, "SELECT COUNT(*) AS count FROM legal_policy_versions")).count, 2);
    });
});

test('existing-user acceptance is canonical, version-aware, concurrent-safe, and idempotent', async () => {
    await withTemporaryDatabase(async database => {
        for (const username of ['first', 'historical', 'concurrent']) {
            await run(database, 'INSERT INTO users (username) VALUES (?)', [username]);
        }
        const store = createLegalAcceptanceStore({ database, currentPolicies, now: () => 1789012345678 });

        assert.deepEqual(
            await store.acceptCurrentPolicies({ userId: 1, accepted: 'true' }),
            { accepted: false, reason: 'LEGAL_ACCEPTANCE_REQUIRED' }
        );
        const first = await store.acceptCurrentPolicies({
            userId: 1,
            accepted: true,
            source: 'forged',
            termsVersion: 'forged',
            acceptedAt: 1
        });
        assert.equal(first.created, true);
        assert.equal(first.acceptance.user_id, 1);
        assert.equal(first.acceptance.source, 'existing_user_gate');
        assert.equal(first.acceptance.terms_version, TERMS_VERSION);
        assert.equal(first.acceptance.accepted_at, 1789012345678);
        assert.equal(await store.requiresCurrentAcceptance(1), false);
        const repeated = await store.acceptCurrentPolicies({ userId: 1, accepted: true });
        assert.equal(repeated.created, false);
        assert.equal(repeated.acceptance.id, first.acceptance.id);

        await run(
            database,
            `INSERT INTO legal_acceptances
                (user_id, terms_version, privacy_version, accepted_at, source)
             VALUES (2, '2025-01-01', '2025-01-01', 1700000000000, 'registration')`
        );
        const reaccepted = await store.acceptCurrentPolicies({ userId: 2, accepted: true });
        assert.equal(reaccepted.acceptance.source, 'policy_reacceptance');
        assert.equal(await store.requiresCurrentAcceptance(2), false);
        assert.equal((await get(database, 'SELECT COUNT(*) AS count FROM legal_acceptances WHERE user_id = 2')).count, 2);

        const concurrent = await Promise.all([
            store.acceptCurrentPolicies({ userId: 3, accepted: true }),
            store.acceptCurrentPolicies({ userId: 3, accepted: true })
        ]);
        assert.equal(concurrent.filter(result => result.created).length, 1);
        assert.equal((await get(database, 'SELECT COUNT(*) AS count FROM legal_acceptances WHERE user_id = 3')).count, 1);
    });
});

test('failed existing-user acceptance transaction leaves no partial row', async () => {
    await withTemporaryDatabase(async database => {
        await run(database, "INSERT INTO users (username) VALUES ('rollback')");
        const store = createLegalAcceptanceStore({ database, currentPolicies });
        await run(database, `CREATE TRIGGER reject_existing_legal_acceptance
            BEFORE INSERT ON legal_acceptances
            BEGIN SELECT RAISE(ABORT, 'simulated existing acceptance failure'); END`);
        await assert.rejects(
            store.acceptCurrentPolicies({ userId: 1, accepted: true }),
            /simulated existing acceptance failure/
        );
        assert.equal(await get(database, 'SELECT id FROM legal_acceptances WHERE user_id = 1'), null);
    });
});

test('legal pages and account-creation surfaces expose the required public policy links', async () => {
    const privacy = await fsp.readFile(path.join(repositoryRoot, 'public', 'privacy', 'index.html'), 'utf8');
    const terms = await fsp.readFile(path.join(repositoryRoot, 'public', 'terms', 'index.html'), 'utf8');
    const index = await fsp.readFile(path.join(repositoryRoot, 'public', 'index.html'), 'utf8');
    const wanderer = await fsp.readFile(path.join(repositoryRoot, 'public', 'register-w.html'), 'utf8');
    const claim = await fsp.readFile(path.join(repositoryRoot, 'public', 'claim', 'index.html'), 'utf8');
    const faq = await fsp.readFile(path.join(repositoryRoot, 'public', 'faq', 'index.html'), 'utf8');
    const googleSetup = await fsp.readFile(path.join(repositoryRoot, 'public', 'js', 'legal-acceptance.js'), 'utf8');

    for (const page of [privacy, terms]) {
        assert.match(page, /September 11, 2026/);
        assert.match(page, /support@fogmin\.site/);
        assert.match(page, /FOG Center/);
        assert.match(page, /IEC Convention Center Cebu/);
        assert.match(page, /Cebu, Philippines/);
    }
    assert.match(privacy, /href="\/terms\/"/);
    assert.match(terms, /href="\/privacy\/"/);
    for (const surface of [index, wanderer, claim, faq]) {
        assert.match(surface, /href="\/terms\/"/);
        assert.match(surface, /href="\/privacy\/"/);
    }
    assert.match(wanderer, /id="wandererLegalAccepted"[^>]*required/);
    assert.match(index, /id="googleLegalAccepted"[^>]*required/);
    assert.match(index, /I have read and agree to the[\s\S]*Terms of Service[\s\S]*acknowledge the[\s\S]*Privacy Policy/);
    assert.match(googleSetup, /body: JSON\.stringify\(\{ legal_accepted: true \}\)/);
    assert.doesNotMatch(googleSetup, /localStorage|sessionStorage|indexedDB/);
});
