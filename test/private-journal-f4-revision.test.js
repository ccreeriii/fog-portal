'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');
const Safeguarding = require('../lib/private-journal-safeguarding');

function read(relative) {
    return fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function callback(error) {
            if (error) reject(error);
            else resolve(this);
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) reject(error);
            else resolve(row || null);
        });
    });
}

async function createDb() {
    const db = new sqlite3.Database(':memory:');
    await run(db, `CREATE TABLE youth (
        id INTEGER PRIMARY KEY,
        name TEXT,
        age INTEGER,
        birthday TEXT,
        email TEXT
    )`);
    await Safeguarding.ensurePrivateJournalSafeguardingSchema(db);
    return db;
}

function close(db) {
    return new Promise(resolve => db.close(resolve));
}

const NOW = new Date('2026-09-21T04:00:00.000Z');

async function addYouth(db, id, birthday, email = null, name = `Youth ${id}`) {
    await run(
        db,
        'INSERT INTO youth (id, name, birthday, email) VALUES (?, ?, ?, ?)',
        [id, name, birthday, email]
    );
}

async function setTeenPolicy(db, required) {
    return Safeguarding.setTeenGuardianPolicy(db, {
        guardianRequired: required,
        adminUserId: 99,
        adminIdentity: 'superadmin@example.test',
        now: NOW
    });
}

async function requestFor(db, youthId) {
    return Safeguarding.requestGuardianAuthorization(db, {
        youthId,
        youthAcknowledged: true,
        now: NOW
    });
}

async function beginGuest(db, token, email = 'guardian@example.test') {
    return Safeguarding.beginGuardianEmailVerification(db, {
        token,
        guardianEmail: email,
        relationship: 'parent',
        adultConfirmed: true,
        authorizedConfirmed: true,
        permissionAttested: true,
        now: NOW
    });
}

test('Recovery Key Continue completes concurrent setup exactly once', async () => {
    const source = read('public/js/journal-secure-controller.js');
    assert.match(source, /const setupPromises/);
    assert.match(source, /setupPromises\.has/);
    assert.match(source, /configureNewJournalOnce/);

    class FakeElement {
        constructor(tag) {
            this.tagName = tag.toUpperCase();
            this.children = [];
            this.style = {};
            this.listeners = new Map();
            this.disabled = false;
            this.checked = false;
            this.textContent = '';
        }
        appendChild(child) { this.children.push(child); return child; }
        append(...children) { this.children.push(...children); }
        addEventListener(name, handler) {
            if (!this.listeners.has(name)) this.listeners.set(name, []);
            this.listeners.get(name).push(handler);
        }
        setAttribute() {}
        remove() { this.removed = true; }
        click() {
            if (this.disabled) return;
            for (const handler of this.listeners.get('click') || []) handler({ target: this });
        }
    }

    function descendants(element) {
        return [element, ...element.children.flatMap(descendants)];
    }

    const body = new FakeElement('body');
    const originalAppend = body.appendChild.bind(body);
    body.appendChild = element => {
        originalAppend(element);
        queueMicrotask(() => {
            const all = descendants(element);
            const checkbox = all.find(item => item.tagName === 'INPUT' && item.type === 'checkbox');
            const continueButton = all.find(item => item.tagName === 'BUTTON' && item.textContent === 'Continue');
            checkbox.checked = true;
            for (const handler of checkbox.listeners.get('change') || []) handler({ target: checkbox });
            continueButton.click();
        });
        return element;
    };

    let createCount = 0;
    let envelopeCount = 0;
    let deviceSaveCount = 0;
    global.document = { body, createElement: tag => new FakeElement(tag) };
    global.navigator = {};
    global.fetch = async () => {
        envelopeCount += 1;
        return { ok: true, json: async () => ({ success: true }) };
    };
    global.FOGJournalCrypto = {
        deleteDeviceKey: async () => {},
        createJournalSetup: async () => {
            createCount += 1;
            return {
                recoveryCode: 'FOG-JR1-SYNTHETIC-ONLY',
                masterKey: { synthetic: true },
                envelope: { key_fingerprint: 'a'.repeat(64) }
            };
        },
        saveDeviceKey: async () => { deviceSaveCount += 1; }
    };

    const modulePath = require.resolve('../public/js/journal-secure-controller.js');
    delete require.cache[modulePath];
    const Controller = require(modulePath);
    try {
        const [first, second] = await Promise.all([
            Controller._testing.configureNewJournal(7),
            Controller._testing.configureNewJournal(7)
        ]);
        assert.equal(first, second);
        assert.equal(createCount, 1);
        assert.equal(envelopeCount, 1);
        assert.equal(deviceSaveCount, 1);
    } finally {
        Controller.clearMemoryKeys();
        delete require.cache[modulePath];
        delete global.FOGJournalCrypto;
        delete global.fetch;
        delete global.navigator;
        delete global.document;
    }
});

test('recovery key remains local and is never included in the envelope upload', () => {
    const source = read('public/js/journal-secure-controller.js');
    const saveEnvelopeBlock = source.slice(source.indexOf('async function saveEnvelope'), source.indexOf('function createOverlay'));
    assert.doesNotMatch(saveEnvelopeBlock, /recoveryCode/);
    assert.match(source, /Upload ONLY the wrapped master-key envelope/);
});

test('premium layer preserves the shared Portal Journal banner', () => {
    const premium = read('public/js/journal-premium-ui.js');
    const shared = read('public/js/community-feature-polish.js');
    assert.doesNotMatch(premium, /A quiet place with God/);
    assert.doesNotMatch(premium, /journal-premium-intro__action/);
    assert.match(shared, /Pause\. Reflect\. Grow\./);
});

test('list renderer contains only compact metadata and controls', () => {
    const source = read('public/js/journal-premium-ui.js');
    const block = source.slice(source.indexOf('function createListEntry'), source.indexOf('function createGridEntry'));
    assert.match(block, /journal-premium-date/);
    assert.match(block, /createMoodChip/);
    assert.match(block, /'Open'/);
    assert.doesNotMatch(block, /previewText/);
    assert.doesNotMatch(block, /journal-premium-entry__preview/);
});

test('grid renderer keeps a limited preview and compact date badge', () => {
    const source = read('public/js/journal-premium-ui.js');
    const block = source.slice(source.indexOf('function createGridEntry'), source.indexOf('function getEntries'));
    assert.match(block, /journal-premium-date--grid/);
    assert.match(block, /previewText/);
    assert.doesNotMatch(block, /is-expanded/);
});

test('calendar remains metadata-only and the editor remains wired', () => {
    const source = read('public/js/journal-premium-ui.js');
    assert.match(source, /Calendar cells intentionally contain/);
    assert.match(source, /newJournalTabButton/);
    assert.match(source, /journalForm/);
});

test('missing teen policy fails closed to guardian required', async () => {
    const db = await createDb();
    try {
        assert.deepEqual(await Safeguarding.getTeenGuardianPolicy(db), {
            guardian_required: true,
            configured: false,
            valid: false
        });
    } finally { await close(db); }
});

test('malformed teen policy fails closed to guardian required', async () => {
    const db = await createDb();
    try {
        await run(db, 'INSERT INTO app_settings (key, value) VALUES (?, ?)', [Safeguarding.TEEN_GUARDIAN_SETTING_KEY, 'sometimes']);
        const policy = await Safeguarding.getTeenGuardianPolicy(db);
        assert.equal(policy.guardian_required, true);
        assert.equal(policy.valid, false);
    } finally { await close(db); }
});

test('explicit OFF policy is parsed only from canonical false', async () => {
    const db = await createDb();
    try {
        await setTeenPolicy(db, false);
        const policy = await Safeguarding.getTeenGuardianPolicy(db);
        assert.equal(policy.guardian_required, false);
        assert.equal(policy.valid, true);
    } finally { await close(db); }
});

test('teen policy routes require genuine strong-admin middleware', () => {
    const source = read('server.js');
    assert.match(source, /'\/api\/admin\/private-journal-policy',[\s\S]{0,100}requireStrongAdmin/);
    assert.match(source, /function isStrongAdmin[\s\S]{0,500}BOOTSTRAP_STRONG_ADMIN_USERNAME/);
});

test('every teen policy change records previous, new, actor and version', async () => {
    const db = await createDb();
    try {
        await setTeenPolicy(db, false);
        const audit = await get(db, 'SELECT * FROM private_journal_policy_audit ORDER BY id DESC LIMIT 1');
        assert.equal(audit.previous_value, 'true');
        assert.equal(audit.new_value, 'false');
        assert.equal(audit.admin_user_id, 99);
        assert.equal(audit.policy_version, Safeguarding.JOURNAL_GUARDIAN_POLICY_VERSION);
    } finally { await close(db); }
});

test('members under 10 remain unavailable', () => {
    const access = Safeguarding.evaluateJournalAccess({
        ageProfile: Safeguarding.resolveJournalAgeProfile({ birthday: '2018-01-01' }, NOW),
        authorization: null,
        guardianRequired13To17: false
    });
    assert.equal(access.allowed, false);
    assert.equal(access.reason, 'under_10');
});

test('ages 10-12 always require guardian authorization', () => {
    const access = Safeguarding.evaluateJournalAccess({
        ageProfile: Safeguarding.resolveJournalAgeProfile({ birthday: '2015-01-01' }, NOW),
        authorization: null,
        guardianRequired13To17: false,
        responsibleUseAcknowledgement: { policy_version: Safeguarding.JOURNAL_RESPONSIBLE_USE_POLICY_VERSION, acknowledged_at: NOW.toISOString() }
    });
    assert.equal(access.allowed, false);
    assert.equal(access.guardian_required, true);
});

test('ages 13-17 are locked without guardian authorization while policy is ON', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        const state = await Safeguarding.getPrivateJournalAccessState(db, 1, NOW);
        assert.equal(state.access_allowed, false);
        assert.equal(state.reason, 'guardian_authorization_required');
    } finally { await close(db); }
});

test('ages 13-17 require current acknowledgement while policy is OFF', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        await setTeenPolicy(db, false);
        const state = await Safeguarding.getPrivateJournalAccessState(db, 1, NOW);
        assert.equal(state.access_allowed, false);
        assert.equal(state.reason, 'responsible_use_acknowledgement_required');
    } finally { await close(db); }
});

test('current responsible-use acknowledgement allows teen access while policy is OFF', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        await setTeenPolicy(db, false);
        await Safeguarding.acknowledgeResponsibleUse(db, {
            youthId: 1,
            policyVersion: Safeguarding.JOURNAL_RESPONSIBLE_USE_POLICY_VERSION,
            acknowledged: true,
            now: NOW
        });
        assert.equal((await Safeguarding.getPrivateJournalAccessState(db, 1, NOW)).access_allowed, true);
    } finally { await close(db); }
});

test('stale or wrong acknowledgement policy version is rejected', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        await setTeenPolicy(db, false);
        await assert.rejects(
            Safeguarding.acknowledgeResponsibleUse(db, { youthId: 1, policyVersion: 'old', acknowledged: true, now: NOW }),
            error => error.code === 'RESPONSIBLE_USE_ACKNOWLEDGEMENT_INVALID'
        );
    } finally { await close(db); }
});

test('turning 18 removes the guardian requirement without deleting authorization', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2008-09-21');
        const state = await Safeguarding.getPrivateJournalAccessState(db, 1, NOW);
        assert.equal(state.age_bracket, 'AGE_18_PLUS');
        assert.equal(state.access_allowed, true);
        assert.equal(state.guardian_required, false);
    } finally { await close(db); }
});

test('OFF to ON to OFF transition preserves both guardian and acknowledgement metadata', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01', 'youth@example.test', 'Teen');
        await run(db, 'CREATE TABLE private_journals (id INTEGER PRIMARY KEY, youth_id INTEGER, ciphertext_b64 TEXT)');
        await run(db, 'INSERT INTO private_journals (id, youth_id, ciphertext_b64) VALUES (1, 1, ?)', ['SYNTHETIC_CIPHERTEXT_UNCHANGED']);
        await setTeenPolicy(db, false);
        await Safeguarding.acknowledgeResponsibleUse(db, { youthId: 1, policyVersion: Safeguarding.JOURNAL_RESPONSIBLE_USE_POLICY_VERSION, acknowledged: true, now: NOW });
        assert.equal((await Safeguarding.getPrivateJournalAccessState(db, 1, NOW)).access_allowed, true);
        await setTeenPolicy(db, true);
        assert.equal((await Safeguarding.getPrivateJournalAccessState(db, 1, NOW)).access_allowed, false);
        const request = await requestFor(db, 1);
        const verification = await beginGuest(db, request.approval_token);
        await Safeguarding.verifyGuardianEmailAndApprove(db, { token: request.approval_token, guardianEmail: verification.guardian_email, verificationCode: verification.verification_code, now: NOW });
        assert.equal((await Safeguarding.getPrivateJournalAccessState(db, 1, NOW)).access_allowed, true);
        await setTeenPolicy(db, false);
        const finalState = await Safeguarding.getPrivateJournalAccessState(db, 1, NOW);
        assert.equal(finalState.access_allowed, true);
        assert.ok(finalState.guardian_authorization);
        assert.ok(finalState.responsible_use_acknowledgement);
        assert.equal((await get(db, 'SELECT ciphertext_b64 FROM private_journals WHERE id = 1')).ciphertext_b64, 'SYNTHETIC_CIPHERTEXT_UNCHANGED');
    } finally { await close(db); }
});

test('raw approval token is returned once while only its hash is stored', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        const request = await requestFor(db, 1);
        const row = await get(db, 'SELECT token_hash FROM private_journal_guardian_authorizations WHERE id = ?', [request.request_id]);
        assert.notEqual(row.token_hash, request.approval_token);
        assert.equal(row.token_hash, Safeguarding.hashGuardianApprovalToken(request.approval_token));
    } finally { await close(db); }
});

test('guest guardian preview and approval routes do not require Portal authentication', () => {
    const source = read('server.js');
    assert.match(source, /'\/api\/journal-security\/guardian-guest\/preview',\s*async/);
    assert.match(source, /'\/api\/journal-security\/guardian-guest\/verify',\s*async/);
    assert.doesNotMatch(source, /guardian-guest\/preview',\s*requireAuth/);
});

test('guest verification requires all three guardian attestations', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        const request = await requestFor(db, 1);
        await assert.rejects(
            Safeguarding.beginGuardianEmailVerification(db, {
                token: request.approval_token,
                guardianEmail: 'guardian@example.test',
                relationship: 'parent',
                adultConfirmed: true,
                authorizedConfirmed: false,
                permissionAttested: true,
                now: NOW
            }),
            error => error.code === 'GUARDIAN_ATTESTATION_REQUIRED'
        );
    } finally { await close(db); }
});

test('young person cannot approve using their own profile email', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01', 'same@example.test');
        const request = await requestFor(db, 1);
        await assert.rejects(beginGuest(db, request.approval_token, 'same@example.test'), error => error.code === 'SELF_GUARDIAN_FORBIDDEN');
    } finally { await close(db); }
});

test('wrong verification code fails and increments bounded attempts', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        const request = await requestFor(db, 1);
        await beginGuest(db, request.approval_token);
        await assert.rejects(
            Safeguarding.verifyGuardianEmailAndApprove(db, { token: request.approval_token, guardianEmail: 'guardian@example.test', verificationCode: '000000', now: NOW }),
            error => error.code === 'GUARDIAN_VERIFICATION_INVALID'
        );
        assert.equal((await get(db, 'SELECT attempts FROM private_journal_guardian_verifications')).attempts, 1);
    } finally { await close(db); }
});

test('expired guardian email verification cannot approve', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        const request = await requestFor(db, 1);
        const verification = await beginGuest(db, request.approval_token);
        const later = new Date(NOW.getTime() + Safeguarding.GUARDIAN_VERIFICATION_TTL_MS + 1);
        await assert.rejects(
            Safeguarding.verifyGuardianEmailAndApprove(db, { token: request.approval_token, guardianEmail: verification.guardian_email, verificationCode: verification.verification_code, now: later }),
            error => error.code === 'GUARDIAN_VERIFICATION_INVALID'
        );
    } finally { await close(db); }
});

test('verified guest guardian approval unlocks the eligible youth', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01', null, 'Teen');
        const request = await requestFor(db, 1);
        const verification = await beginGuest(db, request.approval_token);
        const approval = await Safeguarding.verifyGuardianEmailAndApprove(db, { token: request.approval_token, guardianEmail: verification.guardian_email, verificationCode: verification.verification_code, now: NOW });
        assert.ok(approval.management_token);
        assert.equal((await Safeguarding.getPrivateJournalAccessState(db, 1, NOW)).access_allowed, true);
    } finally { await close(db); }
});

test('guest revocation locks normal youth access when policy requires guardian', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        const request = await requestFor(db, 1);
        const verification = await beginGuest(db, request.approval_token);
        const approval = await Safeguarding.verifyGuardianEmailAndApprove(db, { token: request.approval_token, guardianEmail: verification.guardian_email, verificationCode: verification.verification_code, now: NOW });
        await Safeguarding.revokeGuardianAuthorization(db, { managementToken: approval.management_token, now: new Date(NOW.getTime() + 1000) });
        const state = await Safeguarding.getPrivateJournalAccessState(db, 1, NOW);
        assert.equal(state.access_allowed, false);
        assert.equal(state.reason, 'guardian_authorization_required');
    } finally { await close(db); }
});

test('revocation token is separately hashed and never stored raw', async () => {
    const db = await createDb();
    try {
        await addYouth(db, 1, '2011-01-01');
        const request = await requestFor(db, 1);
        const verification = await beginGuest(db, request.approval_token);
        const approval = await Safeguarding.verifyGuardianEmailAndApprove(db, { token: request.approval_token, guardianEmail: verification.guardian_email, verificationCode: verification.verification_code, now: NOW });
        const row = await get(db, 'SELECT management_token_hash FROM private_journal_guardian_authorizations WHERE youth_id = 1');
        assert.notEqual(row.management_token_hash, approval.management_token);
        assert.equal(row.management_token_hash, Safeguarding.hashGuardianApprovalToken(approval.management_token));
    } finally { await close(db); }
});

test('guardian guest APIs expose no Journal content endpoint or content field', () => {
    const source = read('server.js');
    const start = source.indexOf("'/api/journal-security/guardian-guest/preview'");
    const end = source.indexOf('function retireMemberOnlyGuardianApproval');
    const block = source.slice(start, end);
    assert.doesNotMatch(block, /private_journals/);
    assert.doesNotMatch(block, /ciphertext_b64/);
    assert.doesNotMatch(block, /journal content/i);
});

test('guardian verification uses encrypted outbox and never logs raw codes or tokens', () => {
    const source = read('server.js');
    assert.match(source, /messageType:\s*'journal_guardian_verification'/);
    assert.match(source, /emailRecoveryOutbox\.enqueue/);
    assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*(?:verification_code|approval_token|management_token)/);
});

test('locked legacy access remains migration-only and owner deletion remains available', () => {
    const source = read('server.js');
    assert.match(source, /OWNER-INITIATED LEGACY MIGRATION/);
    assert.match(source, /requirePrivateJournalMigrationAccess/);
    const deletion = source.slice(source.indexOf('OWNER DELETE PRIVACY EXCEPTION'), source.indexOf('// NEW PRAYER API'));
    assert.match(deletion, /requireAuth/);
    assert.doesNotMatch(deletion, /requirePrivateJournalAccess/);
});

test('dedicated guardian page keeps approval and revocation secrets in URL fragments', () => {
    const youthUi = read('public/js/journal-guardian-ui.js');
    const guestUi = read('public/js/journal-guardian-guest.js');
    assert.match(youthUi, /url\.pathname =\s*'\/journal-guardian\.html'/);
    assert.match(youthUi, /url\.hash/);
    assert.match(guestUi, /journal-guardian-revoke/);
    assert.doesNotMatch(guestUi, /localStorage|sessionStorage/);
});
