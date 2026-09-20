'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const {
    ACCOUNT_RECOVERY_TOKEN_BYTES,
    ACCOUNT_RECOVERY_TOKEN_TTL_MS,
    hashAccountRecoveryToken,
    initializeAccountRecoverySchema,
    createAccountRecoveryStore
} = require('../lib/account-recovery-security');

const repositoryRoot =
    path.resolve(__dirname, '..');

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(
            sql,
            params,
            function(error) {
                if (error) return reject(error);

                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        );
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(
            sql,
            params,
            (error, row) =>
                error
                    ? reject(error)
                    : resolve(row || null)
        );
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(
            sql,
            params,
            (error, rows) =>
                error
                    ? reject(error)
                    : resolve(rows || [])
        );
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close(
            error =>
                error
                    ? reject(error)
                    : resolve()
        );
    });
}

test(
    'account recovery tokens are hash-only, one-hour, replaceable and single-use',
    async t => {
        const database =
            new sqlite3.Database(':memory:');

        t.after(
            async () =>
                closeDatabase(database)
        );

        await initializeAccountRecoverySchema(
            database
        );

        await run(
            database,
            `CREATE TABLE mutation_probe (
                id INTEGER PRIMARY KEY,
                value TEXT
            )`
        );

        let clock = 1_900_000_000_000;

        const store =
            createAccountRecoveryStore({
                database,
                now: () => clock
            });

        const first =
            await store.issue({
                youthId: 10,
                createdByUserId: 1
            });

        assert.equal(
            Buffer.from(
                first.rawToken,
                'base64url'
            ).length,
            ACCOUNT_RECOVERY_TOKEN_BYTES
        );

        assert.match(
            first.rawToken,
            /^[A-Za-z0-9_-]{43}$/
        );

        assert.equal(
            first.expiresAt -
                first.createdAt,
            ACCOUNT_RECOVERY_TOKEN_TTL_MS
        );

        const firstRow =
            await get(
                database,
                `SELECT *
                 FROM account_recovery_tokens
                 WHERE id = ?`,
                [first.id]
            );

        assert.equal(
            firstRow.token_hash,
            hashAccountRecoveryToken(
                first.rawToken
            )
        );

        assert.notEqual(
            firstRow.token_hash,
            first.rawToken
        );

        const second =
            await store.issue({
                youthId: 10,
                createdByUserId: 2
            });

        assert.equal(
            second.replaced,
            true
        );

        assert.equal(
            await store.getUsable(
                first.rawToken
            ),
            null
        );

        assert.equal(
            (
                await store.getUsable(
                    second.rawToken
                )
            ).youthId,
            10
        );

        const pending =
            await get(
                database,
                `SELECT COUNT(*) AS count
                 FROM account_recovery_tokens
                 WHERE youth_id = ?
                   AND used_at IS NULL
                   AND revoked_at IS NULL`,
                [10]
            );

        assert.equal(
            pending.count,
            1
        );

        const indexes =
            await all(
                database,
                `PRAGMA index_list(
                    'account_recovery_tokens'
                )`
            );

        assert.ok(
            indexes.some(
                index =>
                    index.name ===
                        'account_recovery_tokens_one_pending_idx' &&
                    index.unique === 1
            )
        );

        let mutationRuns = 0;

        const consumed =
            await store.consumeWithMutation(
                {
                    rawToken:
                        second.rawToken
                },
                async (
                    recovery,
                    transaction
                ) => {
                    mutationRuns += 1;

                    await transaction.run(
                        `INSERT INTO mutation_probe
                            (id, value)
                         VALUES (?, ?)`,
                        [
                            recovery.id,
                            'committed'
                        ]
                    );

                    return 'done';
                }
            );

        assert.equal(
            consumed.mutationResult,
            'done'
        );

        assert.equal(
            mutationRuns,
            1
        );

        assert.equal(
            await store.consumeWithMutation(
                {
                    rawToken:
                        second.rawToken
                },
                async () => {
                    mutationRuns += 1;
                }
            ),
            null
        );

        assert.equal(
            mutationRuns,
            1
        );

        assert.equal(
            (
                await store.getStatus(10)
            ).status,
            'used'
        );

        const expiring =
            await store.issue({
                youthId: 11,
                createdByUserId: 1,
                ttlMs: 1000
            });

        clock += 1000;

        assert.equal(
            await store.getUsable(
                expiring.rawToken
            ),
            null
        );

        assert.equal(
            (
                await store.getStatus(11)
            ).status,
            'expired'
        );
    }
);

test(
    'account recovery mutation and token consumption roll back together',
    async t => {
        const database =
            new sqlite3.Database(':memory:');

        t.after(
            async () =>
                closeDatabase(database)
        );

        await initializeAccountRecoverySchema(
            database
        );

        await run(
            database,
            `CREATE TABLE mutation_probe (
                id INTEGER PRIMARY KEY,
                value TEXT
            )`
        );

        const store =
            createAccountRecoveryStore({
                database
            });

        const issued =
            await store.issue({
                youthId: 20,
                createdByUserId: 1
            });

        await assert.rejects(
            store.consumeWithMutation(
                {
                    rawToken:
                        issued.rawToken
                },
                async (
                    recovery,
                    transaction
                ) => {
                    await transaction.run(
                        `INSERT INTO mutation_probe
                            (id, value)
                         VALUES (?, ?)`,
                        [
                            recovery.id,
                            'rollback'
                        ]
                    );

                    throw new Error(
                        'simulated recovery failure'
                    );
                }
            ),
            /simulated recovery failure/
        );

        assert.equal(
            await get(
                database,
                `SELECT id
                 FROM mutation_probe
                 WHERE id = ?`,
                [issued.id]
            ),
            null
        );

        assert.ok(
            await store.getUsable(
                issued.rawToken
            )
        );
    }
);

test(
    'account recovery source contract is separate from Claim and email recovery',
    () => {
        const server =
            fs.readFileSync(
                path.join(
                    repositoryRoot,
                    'server.js'
                ),
                'utf8'
            );

        const app =
            fs.readFileSync(
                path.join(
                    repositoryRoot,
                    'public/js/app.js'
                ),
                'utf8'
            );

        const page =
            fs.readFileSync(
                path.join(
                    repositoryRoot,
                    'public/recover-account.html'
                ),
                'utf8'
            );

        const client =
            fs.readFileSync(
                path.join(
                    repositoryRoot,
                    'public/js/account-recovery.js'
                ),
                'utf8'
            );

        const security =
            fs.readFileSync(
                path.join(
                    repositoryRoot,
                    'lib/account-recovery-security.js'
                ),
                'utf8'
            );

        const sw =
            fs.readFileSync(
                path.join(
                    repositoryRoot,
                    'public/sw.js'
                ),
                'utf8'
            );

        assert.match(
            server,
            /\/api\/admin\/account-recovery/
        );

        assert.match(
            server,
            /requirePermission\('access_permissions'\)/
        );

        assert.match(
            server,
            /requireClaimedAccountRecoveryTarget/
        );

        assert.match(
            server,
            /ACCOUNT_RECOVERY_TOKEN_TTL_MS/
        );

        assert.match(
            server,
            /invalidateSessionsForYouth/
        );

        const recoveryCompletionMatch =
            server.match(
                /app\.post\(\s*'\/api\/account-recovery\/complete'[\s\S]*?(?=app\.post\('\/api\/account-claim\/preview')/
            );

        assert.ok(
            recoveryCompletionMatch,
            'Account Recovery completion route must be present'
        );

        const recoveryCompletionSource =
            recoveryCompletionMatch[0];

        assert.doesNotMatch(
            recoveryCompletionSource,
            /invalidateSessionsForUser\(\s*sessionStore,\s*accountId/
        );

        assert.doesNotMatch(
            recoveryCompletionSource,
            /invalidateAuthorizationSession\(\s*req,\s*res/
        );

        assert.match(
            server,
            /ACCOUNT_RECOVERY_ISSUED/
        );

        assert.match(
            server,
            /ACCOUNT_RECOVERY_COMPLETED/
        );

        assert.match(
            app,
            /Generate Recovery QR \/ Link/
        );

        assert.match(
            app,
            /Replace Recovery QR \/ Link/
        );

        assert.match(
            app,
            /Revoke Recovery Link/
        );

        assert.match(
            page,
            /Recover your Community Portal account/
        );

        assert.match(
            client,
            /login_identifier/
        );

        assert.match(
            client,
            /\/api\/account-recovery\/preview/
        );

        assert.match(
            client,
            /\/api\/account-recovery\/complete/
        );

        assert.match(
            security,
            /CREATE TABLE IF NOT EXISTS account_recovery_tokens/
        );

        assert.doesNotMatch(
            security,
            /account_claim_tokens/
        );

        assert.doesNotMatch(
            security,
            /target_email/
        );

        assert.match(
            sw,
            /fog-portal-v69/
        );

        assert.match(
            sw,
            /\/recover-account/
        );

        assert.match(
            sw,
            /\/js\/account-recovery\.js/
        );
    }
);
