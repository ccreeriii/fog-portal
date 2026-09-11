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
    hasExplicitLegalAcceptance,
    initializeLegalAcceptanceSchema,
    createLegalAcceptanceStore
} = require('../lib/legal-acceptance');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');

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
        await initializeLegalAcceptanceSchema(database);
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
        await initializeLegalAcceptanceSchema(database);
        const columns = await new Promise((resolve, reject) => {
            database.all('PRAGMA table_info(legal_acceptances)', (error, rows) => (
                error ? reject(error) : resolve(rows)
            ));
        });
        assert.deepEqual(
            columns.map(column => column.name),
            ['id', 'user_id', 'terms_version', 'privacy_version', 'accepted_at', 'source']
        );
        assert.ok(await get(
            database,
            "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'legal_acceptances_user_idx'"
        ));
    });
});

test('account and server-owned legal acceptance commit atomically', async () => {
    await withTemporaryDatabase(async database => {
        const acceptedAt = 1_789_012_345_678;
        const store = createLegalAcceptanceStore({ database, now: () => acceptedAt });
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
            await get(database, 'SELECT user_id, terms_version, privacy_version, accepted_at, source FROM legal_acceptances'),
            {
                user_id: result.result.userId,
                terms_version: '2026-09-11',
                privacy_version: '2026-09-11',
                accepted_at: acceptedAt,
                source: 'registration'
            }
        );
        assert.ok(await get(database, 'SELECT id FROM accounts WHERE id = ?', [result.result.accountId]));
    });
});

test('acceptance failure rolls back account and user creation', async () => {
    await withTemporaryDatabase(async database => {
        const store = createLegalAcceptanceStore({ database });
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
