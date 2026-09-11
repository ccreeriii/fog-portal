'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { decryptOutboxPayload } = require('../lib/email-security');

const fsp = fs.promises;
const repositoryRoot = path.resolve(__dirname, '..');
const successMessage = 'Your message has been sent to Fire Of God Ministries Support. We’ll get back to you through the email you provided.';

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

function all(database, sql, params = []) {
    return new Promise((resolve, reject) => {
        database.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
    });
}

function closeDatabase(database) {
    return new Promise((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
}

async function postSupport(origin, body, cookie = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(`${origin}/api/help/contact-support`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    return {
        status: response.status,
        headers: response.headers,
        json: await response.json()
    };
}

async function createIsolatedApplication({ outboxEnabled = true } = {}) {
    const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'koinonia-contact-support-'));
    const encryptionKey = crypto.randomBytes(32).toString('base64url');
    const transportCalls = [];
    const transport = {
        async send(message) {
            transportCalls.push(message);
            return { providerMessageId: 'contact-support-test-only' };
        }
    };

    await fsp.mkdir(path.join(temporaryRoot, 'lib'), { recursive: true });
    await fsp.mkdir(path.join(temporaryRoot, 'public'), { recursive: true });
    for (const directory of ['terms', 'privacy']) {
        await fsp.cp(path.join(repositoryRoot, 'public', directory), path.join(temporaryRoot, 'public', directory), { recursive: true });
    }
    const serverSource = await fsp.readFile(path.join(repositoryRoot, 'server.js'), 'utf8');
    const isolatedSource = serverSource
        .replace('void runDatabaseBackup();', 'void Promise.resolve();')
        .replace(
            'setInterval(() => { void runDatabaseBackup(); }, 1000 * 60 * 60);',
            'setInterval(() => {}, 1000 * 60 * 60).unref();'
        )
        .replace(
            'const PASSWORD_RECOVERY_WORKER_INTERVAL_MS = 30 * 1000;',
            'const PASSWORD_RECOVERY_WORKER_INTERVAL_MS = 60 * 60 * 1000;'
        )
        .replace(
            "cron.schedule('0 9 * * 1',",
            "((expression, task, options) => ({ stop() {} }))('0 9 * * 1',"
        )
        .replace(
            'startServerAfterRuntimeSchemaReady();',
            'module.exports = { app, db, sessionStore, ready: applyDeterministicRuntimeMigration() };'
        );
    assert.notEqual(isolatedSource, serverSource);
    await fsp.writeFile(path.join(temporaryRoot, 'server.js'), isolatedSource);
    for (const filename of ['sqlite-backup.js', 'email-security.js', 'account-claim-security.js', 'help-faq.js', 'legal-acceptance.js']) {
        await fsp.copyFile(path.join(repositoryRoot, 'lib', filename), path.join(temporaryRoot, 'lib', filename));
    }
    await fsp.writeFile(
        path.join(temporaryRoot, 'lib', 'email-transport.js'),
        `'use strict';\nmodule.exports = { createEmailTransportFromEnv() { return global.__koinoniaContactSupportTransport; } };\n`
    );
    await fsp.writeFile(path.join(temporaryRoot, 'public', 'index.html'), '<!doctype html><title>Isolated</title>');
    await fsp.symlink(path.join(repositoryRoot, 'node_modules'), path.join(temporaryRoot, 'node_modules'), 'dir');

    global.__koinoniaContactSupportTransport = transport;
    process.env.PORT = '0';
    process.env.KOINONIA_PUBLIC_ORIGIN = 'https://staging.fogmin.site';
    if (outboxEnabled) process.env.EMAIL_OUTBOX_ENCRYPTION_KEY = encryptionKey;
    else delete process.env.EMAIL_OUTBOX_ENCRYPTION_KEY;

    const application = require(path.join(temporaryRoot, 'server.js'));
    await application.ready;
    const server = await new Promise((resolve, reject) => {
        const listener = application.app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve(listener));
        listener.once('error', reject);
    });

    return {
        ...application,
        origin: `http://127.0.0.1:${server.address().port}`,
        encryptionKey,
        transportCalls,
        async close() {
            await new Promise(resolve => server.close(resolve));
            await closeDatabase(application.db);
            await fsp.rm(temporaryRoot, { recursive: true, force: true });
        }
    };
}

async function createAuthenticatedMember(application) {
    const youth = await run(
        application.db,
        `INSERT INTO youth (name, email, qr_code, password, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        ['Canonical Support Member', 'canonical-member@example.test', 'SUPPORT-CANONICAL-ID', 'test-password']
    );
    const user = await run(
        application.db,
        `INSERT INTO users (username, password, permissions, youth_id, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
        ['SUPPORT-CANONICAL-ID', 'test-password', '[]', youth.lastID]
    );
    const sessionId = crypto.randomBytes(24).toString('hex');
    const now = Date.now();
    application.sessionStore.set(sessionId, {
        userId: user.lastID,
        youthId: youth.lastID,
        username: 'SUPPORT-CANONICAL-ID',
        createdAt: now,
        expiresAt: now + 60_000
    });
    return { youthId: youth.lastID, userId: user.lastID, cookie: `koinonia_session=${sessionId}` };
}

function decryptSupportPayload(row, encryptionKey) {
    return decryptOutboxPayload({
        version: row.encryption_version,
        ciphertext: row.payload_ciphertext,
        iv: row.payload_iv,
        tag: row.payload_tag
    }, encryptionKey);
}

test('Contact Support queues only validated encrypted messages with canonical optional identity', { concurrency: false }, async t => {
    const savedEnvironment = {
        PORT: process.env.PORT,
        KOINONIA_PUBLIC_ORIGIN: process.env.KOINONIA_PUBLIC_ORIGIN,
        EMAIL_OUTBOX_ENCRYPTION_KEY: process.env.EMAIL_OUTBOX_ENCRYPTION_KEY
    };
    const applications = [];
    t.after(async () => {
        for (const application of applications.reverse()) await application.close();
        delete global.__koinoniaContactSupportTransport;
        for (const [key, value] of Object.entries(savedEnvironment)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });

    const application = await createIsolatedApplication();
    applications.push(application);

    await t.test('valid guest input is escaped and queued through the encrypted outbox only', async () => {
        const uniqueMessage = 'Please help with <script>alert("support-marker")</script> today.';
        const response = await postSupport(application.origin, {
            name: 'Guest <Helper> & "Friend"',
            email: ' Guest.Support@Example.test ',
            category: 'Technical Problem',
            message: uniqueMessage,
            recipient: 'attacker@example.test',
            subject: 'Injected subject',
            html: '<b>injected</b>'
        });
        assert.equal(response.status, 202);
        assert.deepEqual(response.json, { success: true, message: successMessage });
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('vary'), 'Cookie');
        assert.equal(application.transportCalls.length, 0);

        const row = await get(application.db, "SELECT * FROM email_outbox WHERE message_type = 'support_request' ORDER BY id DESC LIMIT 1");
        assert.ok(row);
        assert.equal(row.recipient, 'support@fogmin.site');
        assert.equal(JSON.stringify(row).includes('support-marker'), false);
        const payload = decryptSupportPayload(row, application.encryptionKey);
        assert.equal(payload.subject, '[FOG Portal Support] Technical Problem');
        assert.match(payload.text, /Contact email: guest\.support@example\.test/);
        assert.match(payload.text, /Authenticated: No/);
        assert.doesNotMatch(payload.text, /attacker@example\.test|Injected subject/);
        assert.match(payload.html, /Guest &lt;Helper&gt; &amp; &quot;Friend&quot;/);
        assert.match(payload.html, /&lt;script&gt;alert\(&quot;support-marker&quot;\)&lt;\/script&gt;/);
        assert.doesNotMatch(payload.html, /<script>|<b>injected<\/b>/);
        assert.match(payload.html, /mailto:guest\.support%40example\.test/);
        assert.equal(Object.hasOwn(payload, 'deliveryNotAfter'), false);

        const audits = await all(application.db, "SELECT username, details FROM activity_logs WHERE action = 'SUPPORT_REQUEST_QUEUED'");
        assert.equal(audits.length, 1);
        assert.equal(JSON.stringify(audits).includes('support-marker'), false);
        assert.equal(JSON.stringify(audits).includes('guest.support@example.test'), false);
    });

    await t.test('authenticated requests use canonical context and ignore forged authority', async () => {
        const identity = await createAuthenticatedMember(application);
        const response = await postSupport(application.origin, {
            name: 'Editable Contact Name',
            email: 'editable-contact@example.test',
            category: 'Account & Sign-in',
            message: 'I need help accessing a feature in my account.',
            youth_id: 999999,
            user_id: 999999,
            username: 'FORGED-SIGN-IN-ID',
            permissions: ['access_permissions']
        }, identity.cookie);
        assert.equal(response.status, 202);
        const row = await get(application.db, "SELECT * FROM email_outbox WHERE message_type = 'support_request' ORDER BY id DESC LIMIT 1");
        const payload = decryptSupportPayload(row, application.encryptionKey);
        assert.match(payload.text, /Authenticated: Yes/);
        assert.match(payload.text, new RegExp(`Member ID: ${identity.youthId}`));
        assert.match(payload.text, /Canonical Sign-in ID: SUPPORT-CANONICAL-ID/);
        assert.doesNotMatch(payload.text, /999999|FORGED-SIGN-IN-ID|access_permissions/);
        assert.match(payload.text, /Contact name: Editable Contact Name/);
        assert.match(payload.text, /Contact email: editable-contact@example\.test/);
    });

    await t.test('invalid types, lengths, email, category, and header-injection attempts return 400', async () => {
        const valid = {
            name: 'Valid Name',
            email: 'valid@example.test',
            category: 'Other',
            message: 'This is a sufficiently detailed support request.'
        };
        const invalidBodies = [
            { ...valid, email: 'not-an-email' },
            { ...valid, category: 'Billing' },
            { ...valid, category: 'Technical Problem\r\nBcc: attacker@example.test' },
            { ...valid, message: 'Too short' },
            { ...valid, message: 'x'.repeat(4001) },
            { ...valid, name: 'x'.repeat(101) },
            { ...valid, name: 'Bad\nName' },
            { ...valid, email: 'x'.repeat(321) },
            { ...valid, name: ['Array Name'] },
            { ...valid, email: { value: 'object@example.test' } },
            { ...valid, category: ['Other'] },
            { ...valid, message: { text: valid.message } },
            []
        ];
        const before = (await get(application.db, "SELECT COUNT(*) count FROM email_outbox WHERE message_type = 'support_request'")).count;
        for (const body of invalidBodies) {
            const response = await postSupport(application.origin, body);
            assert.equal(response.status, 400);
            assert.equal(response.json.success, false);
            assert.equal(response.headers.get('cache-control'), 'no-store');
        }
        const after = (await get(application.db, "SELECT COUNT(*) count FROM email_outbox WHERE message_type = 'support_request'")).count;
        assert.equal(after, before);
    });

    await t.test('subject limiting permits three guest requests and rejects the fourth', async () => {
        const subjectApplication = await createIsolatedApplication();
        applications.push(subjectApplication);
        const body = {
            name: 'Subject Limit',
            email: 'subject-limit@example.test',
            category: 'Other',
            message: 'This request verifies the dedicated subject limit.'
        };
        for (let attempt = 0; attempt < 3; attempt += 1) {
            assert.equal((await postSupport(subjectApplication.origin, body)).status, 202);
        }
        const limited = await postSupport(subjectApplication.origin, body);
        assert.equal(limited.status, 429);
        assert.equal(limited.headers.get('retry-after'), '900');
        assert.match(limited.json.message, /Too many support requests/);
    });

    await t.test('IP limiting permits six subjects and rejects the seventh', async () => {
        const ipApplication = await createIsolatedApplication();
        applications.push(ipApplication);
        for (let attempt = 1; attempt <= 6; attempt += 1) {
            const response = await postSupport(ipApplication.origin, {
                name: `IP Limit ${attempt}`,
                email: `ip-limit-${attempt}@example.test`,
                category: 'Other',
                message: `This is valid support request number ${attempt} for the IP limit.`
            });
            assert.equal(response.status, 202);
        }
        const limited = await postSupport(ipApplication.origin, {
            name: 'IP Limit Seven',
            email: 'ip-limit-7@example.test',
            category: 'Other',
            message: 'This seventh valid request must be rejected by the IP limit.'
        });
        assert.equal(limited.status, 429);
        assert.equal(limited.headers.get('retry-after'), '900');
    });

    await t.test('unavailable outbox returns 503 without claiming success or writing a row', async () => {
        const unavailableApplication = await createIsolatedApplication({ outboxEnabled: false });
        applications.push(unavailableApplication);
        const response = await postSupport(unavailableApplication.origin, {
            name: 'Unavailable Test',
            email: 'unavailable@example.test',
            category: 'Other',
            message: 'This request verifies safe unavailable-outbox behavior.'
        });
        assert.equal(response.status, 503);
        assert.equal(response.json.success, false);
        assert.doesNotMatch(JSON.stringify(response.json), /encryption|Resend|provider|API/i);
        assert.equal((await get(unavailableApplication.db, 'SELECT COUNT(*) count FROM email_outbox')).count, 0);
        assert.equal(unavailableApplication.transportCalls.length, 0);
    });
});

test('Contact Support FAQ UI is accessible, fixed-category, online-only, and non-persistent', async () => {
    const html = await fsp.readFile(path.join(repositoryRoot, 'public', 'faq', 'index.html'), 'utf8');
    const script = await fsp.readFile(path.join(repositoryRoot, 'public', 'faq', 'faq.js'), 'utf8');
    const serviceWorker = await fsp.readFile(path.join(repositoryRoot, 'public', 'sw.js'), 'utf8');
    assert.match(html, /id="openSupportModal"[^>]*>Contact Support<\/button>/);
    assert.match(html, /role="dialog" aria-modal="true"/);
    for (const id of ['supportName', 'supportEmail', 'supportCategory', 'supportMessage', 'supportSubmit', 'supportStatus']) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    for (const category of [
        'Account &amp; Sign-in', 'Profile &amp; Member Record', 'Events &amp; Attendance',
        'Ministry &amp; Community', 'Technical Problem', 'Other'
    ]) assert.match(html, new RegExp(`>${category}<\\/option>`));
    assert.match(script, /fetch\('\/api\/auth\/me'/);
    assert.match(script, /fetch\('\/api\/help\/contact-support'/);
    assert.match(script, /supportSubmit\.disabled = true/);
    assert.match(script, /supportSubmit\.disabled = false/);
    assert.match(script, /if \(!navigator\.onLine\)/);
    assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB|caches\s*\./);
    assert.doesNotMatch(script, /innerHTML/);
    assert.match(serviceWorker, /if \(request\.method !== 'GET'\) return/);
    assert.match(serviceWorker, /url\.pathname\.startsWith\('\/api\/'\)/);
});
