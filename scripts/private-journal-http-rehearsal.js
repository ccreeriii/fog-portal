#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const sqlite3 = require('sqlite3').verbose();

const JournalCrypto = require('../public/js/journal-crypto.js');

const SOURCE_ROOT = path.resolve(__dirname, '..');
const FORBIDDEN_PORTS = new Set([3000, 3001, 3003]);
const SYNTHETIC = Object.freeze({
    teen: Object.freeze({
        youthId: 9902101,
        userId: 9902201,
        journalId: 9902301,
        name: 'F3 Synthetic Teen',
        qrCode: 'F3-TEEN-9902101',
        linkedUsername: 'f3-linked-teen-9902201',
        password: 'F3-only-teen-password',
        age: 15,
        birthday: '2011-01-01',
        reason: 'guardian_authorization_required',
        title: 'F3_TEEN_TITLE_SENTINEL',
        content: 'F3_TEEN_CONTENT_SENTINEL',
        mood: 'F3_TEEN_MOOD_SENTINEL'
    }),
    unknown: Object.freeze({
        youthId: 9902102,
        userId: 9902202,
        journalId: 9902302,
        name: 'F3 Synthetic Unknown Birthday',
        qrCode: 'F3-UNKNOWN-9902102',
        linkedUsername: 'f3-linked-unknown-9902202',
        password: 'F3-only-unknown-password',
        age: 44,
        birthday: null,
        reason: 'birthday_required',
        title: 'F3_UNKNOWN_TITLE_SENTINEL',
        content: 'F3_UNKNOWN_CONTENT_SENTINEL',
        mood: 'F3_UNKNOWN_MOOD_SENTINEL'
    })
});
const SENTINELS = Object.freeze(
    Object.values(SYNTHETIC).flatMap(person => [
        person.title,
        person.content,
        person.mood
    ])
);

function fail(message) {
    throw new Error(message);
}

function ensure(condition, message) {
    if (!condition) fail(message);
}

function parseArguments(argv) {
    const values = new Map();
    for (let index = 0; index < argv.length; index += 2) {
        const key = argv[index];
        const value = argv[index + 1];
        if (!key || !key.startsWith('--') || !value) {
            fail('Arguments must be provided as --name value pairs.');
        }
        values.set(key.slice(2), value);
    }

    const dependencyRoot = values.get('dependency-root');
    const forbiddenRoot = values.get('forbidden-root');
    if (!dependencyRoot || !forbiddenRoot) {
        fail('--dependency-root and --forbidden-root are required.');
    }

    return {
        dependencyRoot: path.resolve(dependencyRoot),
        forbiddenRoot: path.resolve(forbiddenRoot),
        baseDirectory: values.has('base-dir')
            ? path.resolve(values.get('base-dir'))
            : null
    };
}

function selectDisposableBase(requested) {
    const candidates = requested
        ? [requested]
        : ['/dev/shm', os.tmpdir()];

    for (const candidate of candidates) {
        try {
            fs.accessSync(candidate, fs.constants.W_OK | fs.constants.X_OK);
            return candidate;
        } catch (error) {
            // Try the next explicitly disposable location.
        }
    }
    fail('No writable disposable runtime location is available.');
}

function copyDisposableApplication(destination) {
    const excludedTopLevel = new Set([
        '.git',
        '.agents',
        '.codex',
        'node_modules',
        'backups',
        'docs'
    ]);
    const excludedDatabaseFiles = new Set([
        'fog_community.db',
        'fog_community.db-wal',
        'fog_community.db-shm'
    ]);

    fs.cpSync(SOURCE_ROOT, destination, {
        recursive: true,
        filter(source) {
            const relative = path.relative(SOURCE_ROOT, source);
            if (!relative) return true;

            const components = relative.split(path.sep);
            const basename = path.basename(source);
            if (excludedTopLevel.has(components[0])) return false;
            if (excludedDatabaseFiles.has(basename)) return false;
            if (/^\.env(?:\.|$)/i.test(basename)) return false;
            if (/\.(?:pem|key|p12|pfx)$/i.test(basename)) return false;
            if (/(?:credential|secret)[-_].*\.(?:json|ya?ml|txt)$/i.test(basename)) {
                return false;
            }
            if (/\.(?:zip|tar|tgz|gz)$/i.test(basename)) return false;
            return true;
        }
    });
}

function replaceExactlyOnce(source, search, replacement, label) {
    const first = source.indexOf(search);
    const last = source.lastIndexOf(search);
    ensure(first >= 0, `Disposable patch anchor missing: ${label}.`);
    ensure(first === last, `Disposable patch anchor is ambiguous: ${label}.`);
    return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function patchDisposableServer(cloneRoot) {
    const serverPath = path.join(cloneRoot, 'server.js');
    let source = fs.readFileSync(serverPath, 'utf8');

    source = replaceExactlyOnce(
        source,
        "const express = require('express');",
        "console.log('F3_BOOT');\nconst express = require('express');",
        'boot marker'
    );
    source = replaceExactlyOnce(
        source,
        "const webpush = require('web-push');",
        `const webpush = Object.freeze({
    setVapidDetails() { throw new Error('F3 push is disabled'); },
    sendNotification() { throw new Error('F3 push is disabled'); }
});`,
        'push adapter'
    );
    source = replaceExactlyOnce(
        source,
        "const cron = require('node-cron');",
        `const cron = Object.freeze({
    schedule() { return Object.freeze({ stop() {} }); }
});`,
        'cron adapter'
    );
    source = replaceExactlyOnce(
        source,
        'setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);',
        '/* F3: recurring backups are disabled in the disposable runtime. */',
        'backup timer'
    );
    source = replaceExactlyOnce(
        source,
        'void runDatabaseBackup();',
        '/* F3: verified backups are disabled in the disposable runtime. */',
        'initial backup'
    );
    source = replaceExactlyOnce(
        source,
        '    await initializeEmailRecoveryRuntime();',
        '    /* F3: email outbox and worker initialization are disabled. */',
        'email recovery startup'
    );
    source = replaceExactlyOnce(
        source,
        '        await ensurePrayerPartnerSnapshotAtStartup();',
        '        /* F3: unrelated Prayer Partner startup work is disabled. */',
        'prayer partner startup'
    );
    source = replaceExactlyOnce(
        source,
        '        startPrayerCovenantReminderScheduler();',
        '        /* F3: Prayer Covenant scheduling is disabled. */',
        'prayer covenant scheduler'
    );
    source = replaceExactlyOnce(
        source,
        '        startWatchtowerPrayerCoverageScheduler();',
        '        /* F3: Watchtower scheduling is disabled. */',
        'watchtower scheduler'
    );
    source = replaceExactlyOnce(
        source,
        '        startBirthdayAgeSyncScheduler();',
        '        /* F3: birthday synchronization scheduling is disabled. */',
        'birthday scheduler'
    );
    source = replaceExactlyOnce(
        source,
        '        app.listen(PORT, () => { console.log(`Server running safely on Port ${PORT}`); });',
        `        const f3Listener = app.listen(Number(PORT), '127.0.0.1', error => {
            if (error) {
                console.error(\`F3_LISTEN_ERROR \${error.code || 'UNKNOWN'}\`);
                process.exitCode = 1;
                return;
            }
            console.log(\`F3_READY \${f3Listener.address().port}\`);
        });
        process.once('SIGTERM', () => {
            f3Listener.close(() => db.close(() => process.exit(0)));
        });`,
        'HTTP listener'
    );

    fs.writeFileSync(serverPath, source, { mode: 0o600 });
}

function walkRegularFiles(root, callback) {
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const target = path.join(current, entry.name);
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) pending.push(target);
            else if (entry.isFile()) callback(target);
        }
    }
}

function assertNoHardcodedReference(root, forbiddenRoot) {
    const needle = Buffer.from(forbiddenRoot, 'utf8');
    const offending = [];
    walkRegularFiles(root, filename => {
        if (fs.readFileSync(filename).includes(needle)) {
            offending.push(path.relative(root, filename));
        }
    });
    ensure(offending.length === 0, 'Disposable runtime contains a forbidden Production path reference.');
}

function openDatabase(filename, mode = sqlite3.OPEN_READWRITE) {
    return new Promise((resolve, reject) => {
        const database = new sqlite3.Database(filename, mode, error => {
            if (error) reject(error);
            else resolve(database);
        });
    });
}

function run(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.run(sql, params, function callback(error) {
            if (error) reject(error);
            else resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

function get(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.get(sql, params, (error, row) => {
            if (error) reject(error);
            else resolve(row || null);
        });
    });
}

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (error, rows) => {
            if (error) reject(error);
            else resolve(rows || []);
        });
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => {
        database.close(error => error ? reject(error) : resolve());
    });
}

async function seedSyntheticOwners(databasePath) {
    const database = await openDatabase(databasePath);
    try {
        await run(database, 'PRAGMA busy_timeout = 5000');
        await run(database, 'PRAGMA secure_delete = ON');
        const secureDelete = await get(database, 'PRAGMA secure_delete');
        ensure(Number(secureDelete && secureDelete.secure_delete) === 1, 'Disposable secure_delete is not enabled.');

        await run(database, 'BEGIN IMMEDIATE');
        try {
            for (const person of Object.values(SYNTHETIC)) {
                await run(
                    database,
                    `INSERT INTO youth
                        (id, name, age, email, birthday, qr_code, password, created_at)
                     VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
                    [
                        person.youthId,
                        person.name,
                        person.age,
                        person.birthday,
                        person.qrCode,
                        person.password,
                        '2026-09-21 12:00:00'
                    ]
                );
                await run(
                    database,
                    `INSERT INTO users
                        (id, username, password, permissions, youth_id, created_at)
                     VALUES (?, ?, ?, '[]', ?, ?)`,
                    [
                        person.userId,
                        person.linkedUsername,
                        person.password,
                        person.youthId,
                        '2026-09-21 12:00:00'
                    ]
                );
                await run(
                    database,
                    `INSERT INTO private_journals
                        (id, youth_id, title, content, mood, created_at)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        person.journalId,
                        person.youthId,
                        person.title,
                        person.content,
                        person.mood,
                        '2026-09-20 18:00:00'
                    ]
                );
            }
            await run(database, 'COMMIT');
        } catch (error) {
            await run(database, 'ROLLBACK').catch(() => {});
            throw error;
        }
    } finally {
        await closeDatabase(database);
    }
}

function redacted(value) {
    let result = String(value || '');
    for (const sentinel of SENTINELS) result = result.replaceAll(sentinel, '[REDACTED]');
    return result;
}

function startDisposableServer(cloneRoot, dependencyRoot) {
    const environment = {
        PATH: process.env.PATH || '/usr/bin:/bin',
        HOME: cloneRoot,
        NODE_PATH: dependencyRoot,
        NODE_ENV: 'test',
        TZ: 'Asia/Manila',
        PORT: '0',
        F3_PRIVATE_JOURNAL_REHEARSAL: '1'
    };
    const serverPath = path.join(cloneRoot, 'server.js');
    ensure(fs.statSync(serverPath).size > 100000, 'Disposable server copy is unexpectedly small.');
    const preflight = childProcess.spawnSync(process.execPath, ['--check', 'server.js'], {
        cwd: cloneRoot,
        env: environment,
        encoding: 'utf8'
    });
    ensure(preflight.status === 0, 'Disposable server syntax preflight failed.');
    const logPath = path.join(cloneRoot, '.f3-server.log');
    const logDescriptor = fs.openSync(logPath, 'a', 0o600);
    const child = childProcess.spawn(process.execPath, ['server.js'], {
        cwd: cloneRoot,
        env: environment,
        stdio: ['ignore', logDescriptor, logDescriptor]
    });
    fs.closeSync(logDescriptor);
    return {
        child,
        logPath,
        getLogs() {
            if (!fs.existsSync(logPath)) return '';
            const logs = fs.readFileSync(logPath, 'utf8');
            return logs.length > 2 * 1024 * 1024
                ? logs.slice(-1024 * 1024)
                : logs;
        }
    };
}

function waitForServerReady(runtime, timeoutMs = 45000) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (error, port) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            clearInterval(poll);
            runtime.child.off('close', closed);
            runtime.child.off('error', spawnError);
            if (error) reject(error);
            else resolve(port);
        };
        const inspect = () => {
            const match = runtime.getLogs().match(/F3_READY (\d+)/);
            if (!match) return;
            const port = Number(match[1]);
            if (!Number.isInteger(port) || port < 1 || FORBIDDEN_PORTS.has(port)) {
                finish(new Error('Disposable server selected an invalid port.'));
                return;
            }
            finish(null, port);
        };
        const closed = (code, signal) => {
            const reason = code !== null && code !== undefined
                ? String(code)
                : signal || 'unknown';
            finish(new Error(`Disposable server exited before readiness (${reason}).`));
        };
        const spawnError = () => finish(new Error('Disposable server process could not be started.'));
        const timer = setTimeout(() => {
            finish(new Error('Disposable server readiness timed out.'));
        }, timeoutMs);
        const poll = setInterval(inspect, 50);
        runtime.child.once('close', closed);
        runtime.child.once('error', spawnError);
        inspect();
    });
}

function readProcessFileDescriptors(pid) {
    const directory = `/proc/${pid}/fd`;
    return fs.readdirSync(directory).flatMap(name => {
        try {
            return [fs.readlinkSync(path.join(directory, name))];
        } catch (error) {
            if (error.code === 'ENOENT') return [];
            throw error;
        }
    });
}

function decodeIpv4(hex) {
    return hex.match(/../g).reverse().map(value => parseInt(value, 16)).join('.');
}

function processListeningSockets(pid, descriptors) {
    const socketInodes = new Set(
        descriptors
            .map(target => /^socket:\[(\d+)\]$/.exec(target))
            .filter(Boolean)
            .map(match => match[1])
    );
    const listeners = [];
    for (const family of ['tcp', 'tcp6']) {
        const filename = `/proc/${pid}/net/${family}`;
        const lines = fs.readFileSync(filename, 'utf8').trim().split('\n').slice(1);
        for (const line of lines) {
            const fields = line.trim().split(/\s+/);
            if (fields[3] !== '0A' || !socketInodes.has(fields[9])) continue;
            const [addressHex, portHex] = fields[1].split(':');
            listeners.push({
                family,
                address: family === 'tcp' ? decodeIpv4(addressHex) : addressHex,
                port: parseInt(portHex, 16)
            });
        }
    }
    return listeners;
}

function proveLiveProcessIsolation(pid, cloneRoot, forbiddenRoot, port) {
    const cwd = fs.realpathSync(`/proc/${pid}/cwd`);
    ensure(cwd === fs.realpathSync(cloneRoot), 'Disposable process cwd is not the disposable application.');

    const descriptors = readProcessFileDescriptors(pid);
    const forbiddenRealRoot = fs.realpathSync(forbiddenRoot);
    const productionDescriptors = descriptors.filter(target => (
        target === forbiddenRealRoot || target.startsWith(`${forbiddenRealRoot}${path.sep}`)
    ));
    ensure(productionDescriptors.length === 0, 'Disposable process opened a Production file descriptor.');

    const listeners = processListeningSockets(pid, descriptors);
    ensure(listeners.length === 1, 'Disposable process has an unexpected listener count.');
    ensure(
        listeners[0].family === 'tcp' &&
        listeners[0].address === '127.0.0.1' &&
        listeners[0].port === port,
        'Disposable listener is not isolated to the expected loopback endpoint.'
    );

    return {
        cwd,
        productionFileDescriptors: productionDescriptors.length,
        listenerAddress: listeners[0].address,
        listenerPort: listeners[0].port
    };
}

async function requestJson(origin, requestPath, options = {}) {
    const headers = { Accept: 'application/json' };
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${origin}${requestPath}`, {
        method: options.method || 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        redirect: 'manual'
    });
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch (error) {
            fail(`Non-JSON response from ${requestPath}.`);
        }
    }
    return {
        status: response.status,
        body,
        setCookie: response.headers.get('set-cookie')
    };
}

function requireStatus(response, expected, label) {
    ensure(response.status === expected, `${label} returned HTTP ${response.status}, expected ${expected}.`);
    return response.body;
}

function sessionCookie(setCookie) {
    ensure(typeof setCookie === 'string' && setCookie.includes('koinonia_session='), 'Login did not issue a Portal session cookie.');
    return setCookie.split(';', 1)[0];
}

async function loadJournalRow(databasePath, journalId) {
    const database = await openDatabase(databasePath);
    try {
        return await get(
            database,
            `SELECT id, youth_id, title, content, mood, entry_uuid, crypto_version,
                    cipher_alg, iv_b64, ciphertext_b64, key_fingerprint,
                    encrypted_at, updated_at
             FROM private_journals WHERE id = ?`,
            [journalId]
        );
    } finally {
        await closeDatabase(database);
    }
}

async function exerciseOwner({ origin, databasePath, person, crossOwnerJournalId = null }) {
    const login = await requestJson(origin, '/api/login', {
        method: 'POST',
        body: { username: person.qrCode, password: person.password }
    });
    const loginBody = requireStatus(login, 200, 'Login');
    ensure(loginBody && loginBody.success === true && loginBody.is_admin === false, 'Synthetic member did not use the real member login flow.');
    ensure(loginBody.member && Number(loginBody.member.id) === person.youthId, 'Login returned the wrong canonical member.');
    const cookie = sessionCookie(login.setCookie);

    requireStatus(
        await requestJson(origin, '/api/legal/accept', {
            method: 'POST', cookie, body: { legal_accepted: true }
        }),
        200,
        'Synthetic legal acceptance'
    );

    const auth = requireStatus(
        await requestJson(origin, '/api/auth/me', { cookie }),
        200,
        'Session verification'
    );
    ensure(auth && auth.member && Number(auth.member.id) === person.youthId, 'Session resolved the wrong canonical identity.');

    const initialStatus = requireStatus(
        await requestJson(origin, '/api/journal-security/status', { cookie }),
        200,
        'Initial Journal status'
    );
    ensure(initialStatus.access_allowed === false, 'Gated owner unexpectedly received ordinary Journal access.');
    ensure(initialStatus.migration_only === true, 'Legacy owner did not receive migration-only capability.');
    ensure(initialStatus.legacy_entries === 1 && initialStatus.encrypted_entries === 0, 'Initial Journal counts are incorrect.');
    ensure(initialStatus.reason === person.reason, 'Initial safeguarding reason is incorrect.');

    requireStatus(
        await requestJson(origin, `/api/journals/${person.youthId}`, { cookie }),
        403,
        'Gated Journal read'
    );

    const envelopeBefore = requireStatus(
        await requestJson(origin, '/api/journal-security/key-envelope', { cookie }),
        200,
        'Migration-only key envelope read'
    );
    ensure(envelopeBefore && envelopeBefore.configured === false, 'Synthetic owner unexpectedly had an existing key envelope.');

    const setup = await JournalCrypto.createJournalSetup(person.youthId);
    const envelopePut = requireStatus(
        await requestJson(origin, '/api/journal-security/key-envelope', {
            method: 'PUT', cookie, body: setup.envelope
        }),
        200,
        'Key envelope establishment'
    );
    ensure(envelopePut && envelopePut.created === true, 'Initial key envelope was not established.');

    const replacementSetup = await JournalCrypto.createJournalSetup(person.youthId);
    const replacement = await requestJson(origin, '/api/journal-security/key-envelope', {
        method: 'PUT', cookie, body: replacementSetup.envelope
    });
    const replacementBody = requireStatus(replacement, 409, 'Key envelope replacement');
    ensure(replacementBody && replacementBody.code === 'JOURNAL_KEY_FINGERPRINT_MISMATCH', 'Key envelope replacement returned the wrong conflict code.');

    const recovered = await JournalCrypto.recoverMasterKey(
        person.youthId,
        setup.recoveryCode,
        setup.envelope
    );
    ensure(recovered && recovered.masterKey && recovered.masterKey.type === 'secret', 'Real Recovery Key flow did not return a CryptoKey.');
    ensure(recovered.keyFingerprint === setup.envelope.key_fingerprint, 'Recovered Journal key fingerprint is incorrect.');

    const encrypted = await JournalCrypto.encryptEntry(
        person.youthId,
        recovered.masterKey,
        {
            entryUuid: JournalCrypto.createEntryUuid(),
            title: person.title,
            content: person.content,
            mood: person.mood
        }
    );
    const activePayload = {
        ...encrypted,
        key_fingerprint: recovered.keyFingerprint
    };

    requireStatus(
        await requestJson(origin, '/api/journals', {
            method: 'POST', cookie, body: activePayload
        }),
        403,
        'Gated Journal create'
    );

    const missingFingerprint = await requestJson(
        origin,
        `/api/journals/${person.journalId}/migrate`,
        { method: 'PUT', cookie, body: encrypted }
    );
    const missingBody = requireStatus(missingFingerprint, 400, 'Missing fingerprint migration');
    ensure(missingBody && missingBody.code === 'JOURNAL_ENCRYPTED_PAYLOAD_INVALID', 'Missing fingerprint returned the wrong error code.');

    const wrongFingerprint = await requestJson(
        origin,
        `/api/journals/${person.journalId}/migrate`,
        {
            method: 'PUT',
            cookie,
            body: { ...encrypted, key_fingerprint: replacementSetup.envelope.key_fingerprint }
        }
    );
    const wrongBody = requireStatus(wrongFingerprint, 409, 'Wrong fingerprint migration');
    ensure(wrongBody && wrongBody.code === 'JOURNAL_KEY_FINGERPRINT_MISMATCH', 'Wrong fingerprint returned the wrong conflict code.');

    const legacy = requireStatus(
        await requestJson(origin, '/api/journal-security/legacy-migration', { cookie }),
        200,
        'Legacy migration fetch'
    );
    ensure(Array.isArray(legacy) && legacy.length === 1, 'Legacy migration fetch returned the wrong row count.');
    ensure(Number(legacy[0].id) === person.journalId && legacy[0].legacy === true, 'Legacy migration fetch returned another owner or a non-legacy row.');
    ensure(
        legacy[0].title === person.title &&
        legacy[0].content === person.content &&
        legacy[0].mood === person.mood,
        'Legacy migration plaintext did not match the synthetic seeded row.'
    );

    if (crossOwnerJournalId !== null) {
        requireStatus(
            await requestJson(origin, `/api/journals/${crossOwnerJournalId}/migrate`, {
                method: 'PUT', cookie, body: activePayload
            }),
            409,
            'Cross-owner migration'
        );
    }

    const migrated = requireStatus(
        await requestJson(origin, `/api/journals/${person.journalId}/migrate`, {
            method: 'PUT', cookie, body: activePayload
        }),
        200,
        'Correct Journal migration'
    );
    ensure(migrated && migrated.success === true && migrated.migrated === true, 'Correct Journal migration did not succeed.');

    const row = await loadJournalRow(databasePath, person.journalId);
    ensure(row && Number(row.youth_id) === person.youthId, 'Migrated SQLite row ownership is incorrect.');
    ensure(row.title === null && row.content === null && row.mood === null, 'Migrated plaintext columns were not cleared.');
    ensure(typeof row.entry_uuid === 'string' && row.entry_uuid.length > 0, 'Migrated entry UUID is missing.');
    ensure(Number(row.crypto_version) === JournalCrypto.CRYPTO_VERSION, 'Migrated crypto version is incorrect.');
    ensure(row.cipher_alg === JournalCrypto.ENTRY_ALGORITHM, 'Migrated cipher algorithm is incorrect.');
    ensure(typeof row.iv_b64 === 'string' && row.iv_b64.length > 0, 'Migrated IV is missing.');
    ensure(typeof row.ciphertext_b64 === 'string' && row.ciphertext_b64.length > 0, 'Migrated ciphertext is missing.');
    ensure(row.key_fingerprint === recovered.keyFingerprint, 'Migrated key fingerprint is incorrect.');
    ensure(typeof row.encrypted_at === 'string' && row.encrypted_at.length > 0, 'Migrated encrypted_at is missing.');

    const decrypted = await JournalCrypto.decryptEntry(person.youthId, recovered.masterKey, row);
    ensure(
        decrypted.title === person.title &&
        decrypted.content === person.content &&
        decrypted.mood === person.mood,
        'Offline decryption did not reproduce the synthetic plaintext.'
    );

    const finalStatus = requireStatus(
        await requestJson(origin, '/api/journal-security/status', { cookie }),
        200,
        'Post-migration Journal status'
    );
    ensure(finalStatus.access_allowed === false, 'Migration incorrectly unlocked ordinary Journal access.');
    ensure(finalStatus.migration_only === false, 'Migration-only capability remained after the last legacy row.');
    ensure(finalStatus.legacy_entries === 0 && finalStatus.encrypted_entries === 1, 'Post-migration Journal counts are incorrect.');

    requireStatus(
        await requestJson(origin, `/api/journals/${person.youthId}`, { cookie }),
        403,
        'Post-migration ordinary read'
    );
    requireStatus(
        await requestJson(origin, '/api/journals', {
            method: 'POST', cookie, body: activePayload
        }),
        403,
        'Post-migration ordinary create'
    );
    requireStatus(
        await requestJson(origin, '/api/journal-security/legacy-migration', { cookie }),
        403,
        'Post-migration legacy fetch'
    );

    return {
        youthId: person.youthId,
        reason: initialStatus.reason,
        login: 'PASS',
        authMe: 'PASS',
        migrationOnlyBefore: true,
        migrationOnlyAfter: false,
        ordinaryAccess: 'BLOCKED',
        missingFingerprint: 'REJECTED',
        wrongFingerprint: 'REJECTED',
        envelopeReplacement: 'REJECTED',
        migratedCiphertextOnly: true,
        offlineDecryption: 'PASS'
    };
}

function stopDisposableServer(child, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        if (child.exitCode !== null || child.signalCode !== null) {
            resolve({ code: child.exitCode, signal: child.signalCode });
            return;
        }
        const timer = setTimeout(() => reject(new Error('Disposable server did not stop after SIGTERM.')), timeoutMs);
        child.once('exit', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal });
        });
        child.kill('SIGTERM');
    });
}

function bufferContainsSentinel(buffer) {
    return SENTINELS.some(sentinel => buffer.includes(Buffer.from(sentinel, 'utf8')));
}

async function scanNamedTables(database, names) {
    for (const name of names) {
        const table = await get(
            database,
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
            [name]
        );
        if (!table) continue;
        ensure(/^[a-z_]+$/i.test(name), 'Unsafe forensic table name.');
        const rows = await all(database, `SELECT * FROM "${name}"`);
        const serialized = Buffer.from(JSON.stringify(rows), 'utf8');
        ensure(!bufferContainsSentinel(serialized), `Synthetic Journal plaintext remained in ${name}.`);
    }
}

async function performDatabaseForensics(databasePath, serverLogs) {
    const database = await openDatabase(databasePath);
    let journalCount;
    let checkpoint;
    try {
        await run(database, 'PRAGMA busy_timeout = 5000');
        await run(database, 'PRAGMA secure_delete = ON');
        const secureDelete = await get(database, 'PRAGMA secure_delete');
        ensure(Number(secureDelete && secureDelete.secure_delete) === 1, 'Forensic connection did not enable secure_delete.');
        checkpoint = await get(database, 'PRAGMA wal_checkpoint(TRUNCATE)');
        ensure(checkpoint && Number(checkpoint.busy) === 0, 'WAL truncate checkpoint was busy.');

        const rows = await all(
            database,
            `SELECT title, content, mood, entry_uuid, crypto_version, cipher_alg,
                    iv_b64, ciphertext_b64, key_fingerprint, encrypted_at
             FROM private_journals ORDER BY id`
        );
        ensure(rows.length === 2, 'Disposable database has an unexpected Journal row count.');
        for (const row of rows) {
            ensure(row.title === null && row.content === null && row.mood === null, 'A Journal row retained plaintext columns.');
            ensure(
                row.entry_uuid &&
                Number(row.crypto_version) === JournalCrypto.CRYPTO_VERSION &&
                row.cipher_alg === JournalCrypto.ENTRY_ALGORITHM &&
                row.iv_b64 && row.ciphertext_b64 && row.key_fingerprint && row.encrypted_at,
                'A Journal row is not ciphertext-only.'
            );
        }
        journalCount = rows.length;

        await scanNamedTables(database, [
            'activity_logs',
            'point_transactions',
            'push_subscriptions',
            'email_outbox',
            'notifications',
            'notification_events',
            'notification_deliveries'
        ]);
    } finally {
        await closeDatabase(database);
    }

    const scannedFiles = [];
    for (const suffix of ['', '-wal', '-shm']) {
        const filename = `${databasePath}${suffix}`;
        if (!fs.existsSync(filename)) continue;
        const bytes = fs.readFileSync(filename);
        ensure(!bufferContainsSentinel(bytes), `Synthetic Journal plaintext remained in SQLite${suffix || ' main database'}.`);
        scannedFiles.push(path.basename(filename));
    }
    ensure(!bufferContainsSentinel(Buffer.from(serverLogs, 'utf8')), 'Synthetic Journal plaintext appeared in server logs.');

    return {
        secureDelete: 1,
        walCheckpointBusy: Number(checkpoint.busy),
        journalRows: journalCount,
        sqliteFilesScanned: scannedFiles,
        serverLogScan: 'CLEAN',
        relatedTableScan: 'CLEAN'
    };
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    ensure(fs.statSync(options.dependencyRoot).isDirectory(), 'Dependency root is not a directory.');
    ensure(fs.statSync(options.forbiddenRoot).isDirectory(), 'Forbidden Production root is not a directory.');

    const baseDirectory = selectDisposableBase(options.baseDirectory);
    const cloneRoot = fs.mkdtempSync(path.join(baseDirectory, 'fog-f3-http-'));
    const databasePath = path.join(cloneRoot, 'fog_community.db');
    let runtime = null;
    let completed = false;

    try {
        copyDisposableApplication(cloneRoot);
        fs.symlinkSync(options.dependencyRoot, path.join(cloneRoot, 'node_modules'), 'dir');
        patchDisposableServer(cloneRoot);
        assertNoHardcodedReference(cloneRoot, options.forbiddenRoot);

        runtime = startDisposableServer(cloneRoot, options.dependencyRoot);
        const port = await waitForServerReady(runtime);
        const processProof = proveLiveProcessIsolation(
            runtime.child.pid,
            cloneRoot,
            options.forbiddenRoot,
            port
        );

        await seedSyntheticOwners(databasePath);
        const origin = `http://127.0.0.1:${port}`;

        const teen = await exerciseOwner({
            origin,
            databasePath,
            person: SYNTHETIC.teen,
            crossOwnerJournalId: SYNTHETIC.unknown.journalId
        });
        const untouchedUnknown = await loadJournalRow(databasePath, SYNTHETIC.unknown.journalId);
        ensure(
            untouchedUnknown && untouchedUnknown.title !== null && untouchedUnknown.ciphertext_b64 === null,
            'Cross-owner migration altered the other synthetic owner row.'
        );
        const unknown = await exerciseOwner({
            origin,
            databasePath,
            person: SYNTHETIC.unknown
        });

        const finalProcessProof = proveLiveProcessIsolation(
            runtime.child.pid,
            cloneRoot,
            options.forbiddenRoot,
            port
        );
        const stopped = await stopDisposableServer(runtime.child);
        ensure(stopped.code === 0, 'Disposable server did not stop cleanly.');

        const forensic = await performDatabaseForensics(databasePath, runtime.getLogs());
        completed = true;

        console.log(JSON.stringify({
            result: 'PASS',
            disposableBase: baseDirectory,
            disposableRuntimePatchedOnly: true,
            hardcodedProductionReferenceScan: 'CLEAN',
            strippedEnvironment: true,
            externalSideEffectsDisabled: true,
            processProof,
            finalProcessProof,
            teen,
            unknown,
            crossOwnerMigration: 'REJECTED',
            forensic,
            gracefulStop: 'PASS'
        }, null, 2));
    } catch (error) {
        const diagnostic = runtime ? redacted(runtime.getLogs()).slice(-4000) : '';
        if (diagnostic) process.stderr.write(`Disposable server diagnostic (redacted):\n${diagnostic}\n`);
        throw error;
    } finally {
        if (runtime && runtime.child.exitCode === null && runtime.child.signalCode === null) {
            await stopDisposableServer(runtime.child).catch(() => {
                runtime.child.kill('SIGKILL');
            });
        }
        const resolvedClone = path.resolve(cloneRoot);
        const expectedPrefix = `${path.resolve(baseDirectory)}${path.sep}fog-f3-http-`;
        ensure(resolvedClone.startsWith(expectedPrefix), 'Refusing to remove an unexpected cleanup target.');
        fs.rmSync(resolvedClone, { recursive: true, force: true });
        ensure(!fs.existsSync(resolvedClone), 'Disposable cleanup failed.');
        if (completed) console.log('F3_DISPOSABLE_CLEANUP PASS');
    }
}

main().catch(error => {
    process.stderr.write(`F3 HTTP rehearsal failed: ${redacted(error && error.message)}\n`);
    process.exitCode = 1;
});
