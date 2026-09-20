'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');

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

function createSession(
    sessionStore,
    {
        userId,
        youthId,
        username
    }
) {
    const sessionId =
        crypto.randomBytes(24).toString('hex');

    const now = Date.now();

    sessionStore.set(
        sessionId,
        {
            userId,
            youthId,
            username,
            createdAt: now,
            expiresAt:
                now + (60 * 60 * 1000)
        }
    );

    return {
        sessionId,
        cookie:
            `koinonia_session=${sessionId}`
    };
}

async function requestJson(
    origin,
    pathname,
    {
        method = 'GET',
        cookie = null,
        body = undefined
    } = {}
) {
    const headers = {};

    if (cookie) {
        headers.cookie = cookie;
    }

    if (body !== undefined) {
        headers['content-type'] =
            'application/json';
    }

    const response =
        await fetch(
            `${origin}${pathname}`,
            {
                method,
                headers,
                body:
                    body === undefined
                        ? undefined
                        : JSON.stringify(body)
            }
        );

    const text =
        await response.text();

    let json = null;

    try {
        json =
            text
                ? JSON.parse(text)
                : null;
    } catch (error) {
        // All tested endpoints should be JSON.
    }

    return {
        status: response.status,
        body: json,
        text,
        setCookie:
            response.headers.get(
                'set-cookie'
            ),
        cacheControl:
            response.headers.get(
                'cache-control'
            ),
        pragma:
            response.headers.get(
                'pragma'
            )
    };
}

function tokenFromUrl(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const match =
        /#([A-Za-z0-9_-]{43})$/.exec(
            value
        );

    return match
        ? match[1]
        : null;
}

function sessionIdFromSetCookie(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const match =
        /(?:^|,\s*)koinonia_session=([A-Fa-f0-9]{48})(?:;|$)/
            .exec(value);

    return match
        ? match[1]
        : null;
}

test(
    'admin-assisted Recovery QR completes the full claimed-account recovery lifecycle',
    {
        concurrency: false
    },
    async t => {
        const temporaryRoot =
            await fsp.mkdtemp(
                path.join(
                    os.tmpdir(),
                    'fog-account-recovery-http-'
                )
            );

        const previousCwd =
            process.cwd();

        const savedEnvironment = {
            PORT:
                process.env.PORT,
            KOINONIA_PUBLIC_ORIGIN:
                process.env.KOINONIA_PUBLIC_ORIGIN,
            EMAIL_OUTBOX_ENCRYPTION_KEY:
                process.env.EMAIL_OUTBOX_ENCRYPTION_KEY,
            KOINONIA_SESSION_COOKIE_SECURE:
                process.env.KOINONIA_SESSION_COOKIE_SECURE,
            PRAYER_COVENANT_REMINDERS_ENABLED:
                process.env.PRAYER_COVENANT_REMINDERS_ENABLED,
            WATCHTOWER_PRAYER_COVERAGE_ENABLED:
                process.env.WATCHTOWER_PRAYER_COVERAGE_ENABLED
        };

        let database = null;
        let httpServer = null;

        t.after(async () => {
            if (httpServer) {
                await new Promise(
                    resolve =>
                        httpServer.close(resolve)
                );
            }

            if (database) {
                await closeDatabase(
                    database
                );
            }

            process.chdir(
                previousCwd
            );

            for (
                const [name, value]
                of Object.entries(
                    savedEnvironment
                )
            ) {
                if (value === undefined) {
                    delete process.env[name];
                } else {
                    process.env[name] =
                        value;
                }
            }

            await fsp.rm(
                temporaryRoot,
                {
                    recursive: true,
                    force: true
                }
            );
        });

        await fsp.mkdir(
            path.join(
                temporaryRoot,
                'lib'
            ),
            {
                recursive: true
            }
        );

        await fsp.mkdir(
            path.join(
                temporaryRoot,
                'public'
            ),
            {
                recursive: true
            }
        );

        const libraryFiles = [
            'sqlite-backup.js',
            'email-security.js',
            'account-claim-security.js',
            'account-recovery-security.js',
            'legal-acceptance.js',
            'growth-journey.js',
            'community-spotlight.js',
            'prayer-covenant-daily.js',
            'notification-center.js',
            'notification-delivery.js',
            'growth-notifications.js',
            'birthday-age-sync.js'
        ];

        for (
            const filename
            of libraryFiles
        ) {
            await fsp.copyFile(
                path.join(
                    repositoryRoot,
                    'lib',
                    filename
                ),
                path.join(
                    temporaryRoot,
                    'lib',
                    filename
                )
            );
        }

        for (
            const directory
            of [
                'terms',
                'privacy'
            ]
        ) {
            await fsp.cp(
                path.join(
                    repositoryRoot,
                    'public',
                    directory
                ),
                path.join(
                    temporaryRoot,
                    'public',
                    directory
                ),
                {
                    recursive: true
                }
            );
        }

        await fsp.copyFile(
            path.join(
                repositoryRoot,
                'public',
                'recover-account.html'
            ),
            path.join(
                temporaryRoot,
                'public',
                'recover-account.html'
            )
        );

        await fsp.writeFile(
            path.join(
                temporaryRoot,
                'public',
                'index.html'
            ),
            '<!doctype html><title>Recovery HTTP Test</title>'
        );

        await fsp.symlink(
            path.join(
                repositoryRoot,
                'node_modules'
            ),
            path.join(
                temporaryRoot,
                'node_modules'
            ),
            'dir'
        );

        const source =
            await fsp.readFile(
                path.join(
                    repositoryRoot,
                    'server.js'
                ),
                'utf8'
            );

        const requiredAnchors = [
            'N: 32768,',
            'void runDatabaseBackup();',
            'startServerAfterRuntimeSchemaReady();'
        ];

        for (
            const anchor
            of requiredAnchors
        ) {
            assert.ok(
                source.includes(anchor),
                `Expected isolated-server anchor missing: ${anchor}`
            );
        }

        let isolatedSource =
            source
                .replace(
                    'N: 32768,',
                    'N: 1024,'
                )
                .replace(
                    'void runDatabaseBackup();',
                    'void Promise.resolve();'
                )
                .replace(
                    'setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);',
                    'setInterval(() => {}, 1000 * 60 * 60).unref();'
                )
                .replace(
                    "cron.schedule('0 9 * * 1',",
                    "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"
                )
                .replace(
                    'startServerAfterRuntimeSchemaReady();',
                    'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };'
                );

        assert.notEqual(
            isolatedSource,
            source
        );

        await fsp.writeFile(
            path.join(
                temporaryRoot,
                'server.js'
            ),
            isolatedSource
        );

        process.env.PORT = '0';
        process.env.KOINONIA_PUBLIC_ORIGIN =
            'https://staging.fogmin.site';

        delete process.env
            .EMAIL_OUTBOX_ENCRYPTION_KEY;

        delete process.env
            .KOINONIA_SESSION_COOKIE_SECURE;

        process.env
            .PRAYER_COVENANT_REMINDERS_ENABLED =
            'false';

        process.env
            .WATCHTOWER_PRAYER_COVERAGE_ENABLED =
            'false';

        process.chdir(
            temporaryRoot
        );

        const application =
            require(
                path.join(
                    temporaryRoot,
                    'server.js'
                )
            );

        await application.ready;

        database =
            application.db;

        assert.ok(
            fs.existsSync(
                path.join(
                    temporaryRoot,
                    'fog_community.db'
                )
            ),
            'Test server must use temporary database'
        );

        const targetYouth =
            await run(
                database,
                `INSERT INTO youth
                    (
                        name,
                        qr_code,
                        created_at
                    )
                 VALUES (?, ?, datetime('now'))`,
                [
                    'Recovery E2E Member',
                    'FOG-RECOVERY-E2E'
                ]
            );

        const targetUser =
            await run(
                database,
                `INSERT INTO users
                    (
                        username,
                        permissions,
                        youth_id,
                        created_at
                    )
                 VALUES (?, '[]', ?, datetime('now'))`,
                [
                    'FOG-RECOVERY-E2E',
                    targetYouth.lastID
                ]
            );

        const adminYouth =
            await run(
                database,
                `INSERT INTO youth
                    (
                        name,
                        qr_code,
                        created_at
                    )
                 VALUES (?, ?, datetime('now'))`,
                [
                    'Recovery E2E Admin',
                    'FOG-RECOVERY-ADMIN'
                ]
            );

        const adminUser =
            await run(
                database,
                `INSERT INTO users
                    (
                        username,
                        permissions,
                        youth_id,
                        created_at
                    )
                 VALUES (
                    ?,
                    '["access_permissions"]',
                    ?,
                    datetime('now')
                 )`,
                [
                    'FOG-RECOVERY-ADMIN',
                    adminYouth.lastID
                ]
            );

        const adminSession =
            createSession(
                application.sessionStore,
                {
                    userId:
                        adminUser.lastID,
                    youthId:
                        adminYouth.lastID,
                    username:
                        'FOG-RECOVERY-ADMIN'
                }
            );

        httpServer =
            await new Promise(
                (resolve, reject) => {
                    const server =
                        application.app.listen(
                            0,
                            '127.0.0.1',
                            error =>
                                error
                                    ? reject(error)
                                    : resolve(server)
                        );

                    server.once(
                        'error',
                        reject
                    );
                }
            );

        const origin =
            `http://127.0.0.1:${httpServer.address().port}`;

        const OLD_PASSWORD =
            'OldRecoveryPass!123';

        const NEW_PASSWORD =
            'NewRecoveryPass!456';

        // --------------------------------------------------
        // 1. First-time Claim creates the authentic
        //    already-claimed starting condition.
        // --------------------------------------------------

        const claimIssue =
            await requestJson(
                origin,
                '/api/admin/account-claims',
                {
                    method: 'POST',
                    cookie:
                        adminSession.cookie,
                    body: {
                        youth_id:
                            targetYouth.lastID
                    }
                }
            );

        assert.equal(
            claimIssue.status,
            201
        );

        assert.equal(
            claimIssue.body.success,
            true
        );

        const claimToken =
            tokenFromUrl(
                claimIssue.body.claim_url
            );

        assert.match(
            claimToken,
            /^[A-Za-z0-9_-]{43}$/
        );

        const claimActivation =
            await requestJson(
                origin,
                '/api/account-claim/activate-password',
                {
                    method: 'POST',
                    body: {
                        token:
                            claimToken,
                        password:
                            OLD_PASSWORD
                    }
                }
            );

        assert.equal(
            claimActivation.status,
            200
        );

        assert.equal(
            claimActivation.body.success,
            true
        );

        assert.equal(
            claimActivation.body.login_identifier,
            'FOG-RECOVERY-E2E'
        );

        const attestationBefore =
            await get(
                database,
                `SELECT
                    id,
                    username,
                    youth_id,
                    account_claimed_at,
                    account_claim_method,
                    account_claim_token_id
                 FROM users
                 WHERE id = ?`,
                [
                    targetUser.lastID
                ]
            );

        assert.ok(
            attestationBefore.account_claimed_at
                !== null
        );

        assert.equal(
            attestationBefore.account_claim_method,
            'claim_password'
        );

        assert.ok(
            attestationBefore.account_claim_token_id
                !== null
        );

        const originalClaimTokenId =
            attestationBefore
                .account_claim_token_id;

        // --------------------------------------------------
        // 2. Confirm old credentials work before recovery.
        // --------------------------------------------------

        const sessionsBeforeMemberLogin =
            new Set(
                application.sessionStore.keys()
            );

        const oldLoginBefore =
            await requestJson(
                origin,
                '/api/login',
                {
                    method: 'POST',
                    body: {
                        username:
                            'FOG-RECOVERY-E2E',
                        identifier:
                            'FOG-RECOVERY-E2E',
                        login_identifier:
                            'FOG-RECOVERY-E2E',
                        password:
                            OLD_PASSWORD
                    }
                }
            );

        assert.equal(
            oldLoginBefore.status,
            200
        );

        assert.equal(
            oldLoginBefore.body.success,
            true
        );

        const newMemberSessionIds =
            [
                ...application.sessionStore.keys()
            ].filter(
                sessionId =>
                    !sessionsBeforeMemberLogin.has(
                        sessionId
                    )
            );

        assert.equal(
            newMemberSessionIds.length,
            1,
            'Successful member login should create exactly one new server session'
        );

        const memberSessionId =
            newMemberSessionIds[0];

        const memberSession =
            application.sessionStore.get(
                memberSessionId
            );

        assert.ok(
            memberSession,
            'Successful member login must create a live server session'
        );

        assert.equal(
            Number(memberSession.youthId),
            Number(targetYouth.lastID)
        );

        assert.equal(
            Number(memberSession.userId),
            Number(targetUser.lastID)
        );

        // --------------------------------------------------
        // 3. Recovery issuance requires admin permission.
        // --------------------------------------------------

        const unauthorizedIssue =
            await requestJson(
                origin,
                '/api/admin/account-recovery',
                {
                    method: 'POST',
                    body: {
                        youth_id:
                            targetYouth.lastID
                    }
                }
            );

        assert.equal(
            unauthorizedIssue.status,
            401
        );

        // --------------------------------------------------
        // 4. Admin generates first Recovery QR/link.
        // --------------------------------------------------

        const recoveryOne =
            await requestJson(
                origin,
                '/api/admin/account-recovery',
                {
                    method: 'POST',
                    cookie:
                        adminSession.cookie,
                    body: {
                        youth_id:
                            targetYouth.lastID
                    }
                }
            );

        assert.equal(
            recoveryOne.status,
            201
        );

        assert.equal(
            recoveryOne.body.success,
            true
        );

        assert.equal(
            recoveryOne.body.login_identifier,
            'FOG-RECOVERY-E2E'
        );

        assert.match(
            recoveryOne.body
                .recovery_qr_data_url,
            /^data:image\/png;base64,/
        );

        const recoveryTokenOne =
            tokenFromUrl(
                recoveryOne.body
                    .recovery_url
            );

        assert.match(
            recoveryTokenOne,
            /^[A-Za-z0-9_-]{43}$/
        );

        const previewOne =
            await requestJson(
                origin,
                '/api/account-recovery/preview',
                {
                    method: 'POST',
                    body: {
                        token:
                            recoveryTokenOne
                    }
                }
            );

        assert.equal(
            previewOne.status,
            200
        );

        assert.equal(
            previewOne.body.success,
            true
        );

        assert.equal(
            previewOne.body.login_identifier,
            'FOG-RECOVERY-E2E'
        );

        assert.equal(
            previewOne.body.member.name,
            'Recovery E2E Member'
        );

        // --------------------------------------------------
        // 5. Generating another recovery link invalidates
        //    the first unused link.
        // --------------------------------------------------

        const recoveryTwo =
            await requestJson(
                origin,
                '/api/admin/account-recovery',
                {
                    method: 'POST',
                    cookie:
                        adminSession.cookie,
                    body: {
                        youth_id:
                            targetYouth.lastID
                    }
                }
            );

        assert.equal(
            recoveryTwo.status,
            201
        );

        assert.equal(
            recoveryTwo.body.success,
            true
        );

        const recoveryTokenTwo =
            tokenFromUrl(
                recoveryTwo.body
                    .recovery_url
            );

        assert.match(
            recoveryTokenTwo,
            /^[A-Za-z0-9_-]{43}$/
        );

        assert.notEqual(
            recoveryTokenTwo,
            recoveryTokenOne
        );

        const stalePreview =
            await requestJson(
                origin,
                '/api/account-recovery/preview',
                {
                    method: 'POST',
                    body: {
                        token:
                            recoveryTokenOne
                    }
                }
            );

        assert.equal(
            stalePreview.status,
            400
        );

        assert.equal(
            stalePreview.body.success,
            false
        );

        const previewTwo =
            await requestJson(
                origin,
                '/api/account-recovery/preview',
                {
                    method: 'POST',
                    body: {
                        token:
                            recoveryTokenTwo
                    }
                }
            );

        assert.equal(
            previewTwo.status,
            200
        );

        assert.equal(
            previewTwo.body.login_identifier,
            'FOG-RECOVERY-E2E'
        );

        // --------------------------------------------------
        // 6. Complete recovery with no email and no old
        //    password supplied.
        // --------------------------------------------------

        const complete =
            await requestJson(
                origin,
                '/api/account-recovery/complete',
                {
                    method: 'POST',
                    body: {
                        token:
                            recoveryTokenTwo,
                        password:
                            NEW_PASSWORD
                    }
                }
            );

        assert.equal(
            complete.status,
            200
        );

        assert.equal(
            complete.body.success,
            true
        );

        assert.equal(
            complete.body.login_identifier,
            'FOG-RECOVERY-E2E'
        );

        // Recovery must invalidate existing member sessions.
        assert.equal(
            application.sessionStore.has(
                memberSessionId
            ),
            false
        );

        // --------------------------------------------------
        // 7. Recovery token is one-time.
        // --------------------------------------------------

        const reuse =
            await requestJson(
                origin,
                '/api/account-recovery/complete',
                {
                    method: 'POST',
                    body: {
                        token:
                            recoveryTokenTwo,
                        password:
                            'ShouldNotWork!789'
                    }
                }
            );

        assert.equal(
            reuse.status,
            400
        );

        assert.equal(
            reuse.body.success,
            false
        );

        // --------------------------------------------------
        // 8. Old password no longer works.
        // --------------------------------------------------

        const oldLoginAfter =
            await requestJson(
                origin,
                '/api/login',
                {
                    method: 'POST',
                    body: {
                        username:
                            'FOG-RECOVERY-E2E',
                        identifier:
                            'FOG-RECOVERY-E2E',
                        login_identifier:
                            'FOG-RECOVERY-E2E',
                        password:
                            OLD_PASSWORD
                    }
                }
            );

        assert.notEqual(
            (
                oldLoginAfter.status === 200 &&
                oldLoginAfter.body &&
                oldLoginAfter.body.success === true
            ),
            true,
            'Old password must no longer authenticate'
        );

        // --------------------------------------------------
        // 9. New password works.
        // --------------------------------------------------

        const newLogin =
            await requestJson(
                origin,
                '/api/login',
                {
                    method: 'POST',
                    body: {
                        username:
                            'FOG-RECOVERY-E2E',
                        identifier:
                            'FOG-RECOVERY-E2E',
                        login_identifier:
                            'FOG-RECOVERY-E2E',
                        password:
                            NEW_PASSWORD
                    }
                }
            );

        assert.equal(
            newLogin.status,
            200
        );

        assert.equal(
            newLogin.body.success,
            true
        );

        assert.equal(
            newLogin.body.username,
            'FOG-RECOVERY-E2E'
        );

        // --------------------------------------------------
        // 10. Original Claim identity remains intact.
        //     No re-claim and no duplicate account.
        // --------------------------------------------------

        const attestationAfter =
            await get(
                database,
                `SELECT
                    id,
                    username,
                    youth_id,
                    account_claimed_at,
                    account_claim_method,
                    account_claim_token_id
                 FROM users
                 WHERE id = ?`,
                [
                    targetUser.lastID
                ]
            );

        assert.equal(
            attestationAfter.id,
            attestationBefore.id
        );

        assert.equal(
            attestationAfter.username,
            attestationBefore.username
        );

        assert.equal(
            attestationAfter.youth_id,
            attestationBefore.youth_id
        );

        assert.equal(
            attestationAfter.account_claimed_at,
            attestationBefore.account_claimed_at
        );

        assert.equal(
            attestationAfter.account_claim_method,
            attestationBefore.account_claim_method
        );

        assert.equal(
            attestationAfter.account_claim_token_id,
            originalClaimTokenId
        );

        const accountCount =
            await get(
                database,
                `SELECT COUNT(*) AS count
                 FROM users
                 WHERE youth_id = ?`,
                [
                    targetYouth.lastID
                ]
            );

        assert.equal(
            accountCount.count,
            1
        );

        const originalClaim =
            await get(
                database,
                `SELECT
                    id,
                    used_at,
                    revoked_at
                 FROM account_claim_tokens
                 WHERE id = ?`,
                [
                    originalClaimTokenId
                ]
            );

        assert.ok(
            originalClaim
        );

        assert.ok(
            originalClaim.used_at
                !== null
        );

        assert.equal(
            originalClaim.revoked_at,
            null
        );

        // --------------------------------------------------
        // 11. Recovery lifecycle persisted correctly.
        // --------------------------------------------------

        const recoveryRows =
            await all(
                database,
                `SELECT
                    id,
                    youth_id,
                    revoked_at,
                    used_at
                 FROM account_recovery_tokens
                 WHERE youth_id = ?
                 ORDER BY id ASC`,
                [
                    targetYouth.lastID
                ]
            );

        assert.equal(
            recoveryRows.length,
            2
        );

        assert.ok(
            recoveryRows[0].revoked_at
                !== null
        );

        assert.equal(
            recoveryRows[0].used_at,
            null
        );

        assert.equal(
            recoveryRows[1].revoked_at,
            null
        );

        assert.ok(
            recoveryRows[1].used_at
                !== null
        );

        // Let asynchronous audit inserts settle.
        await new Promise(
            resolve =>
                setTimeout(
                    resolve,
                    75
                )
        );

        const audits =
            await all(
                database,
                `SELECT action
                 FROM activity_logs
                 WHERE action IN (
                    'ACCOUNT_RECOVERY_ISSUED',
                    'ACCOUNT_RECOVERY_REPLACED',
                    'ACCOUNT_RECOVERY_COMPLETED'
                 )
                 ORDER BY id ASC`
            );

        const auditActions =
            audits.map(
                row => row.action
            );

        assert.ok(
            auditActions.includes(
                'ACCOUNT_RECOVERY_ISSUED'
            )
        );

        assert.ok(
            auditActions.includes(
                'ACCOUNT_RECOVERY_REPLACED'
            )
        );

        assert.ok(
            auditActions.includes(
                'ACCOUNT_RECOVERY_COMPLETED'
            )
        );

        const quickCheck =
            await get(
                database,
                'PRAGMA quick_check'
            );

        assert.equal(
            Object.values(
                quickCheck
            )[0],
            'ok'
        );
    }
);
