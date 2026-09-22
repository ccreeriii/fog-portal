'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3').verbose();

const GrowthJourney = require('../lib/growth-journey');
const LegacyTransition = require('../lib/growth-journey-legacy-transition');
const Cli = require('../scripts/growth-journey-legacy-transition');

const repositoryRoot = path.resolve(__dirname, '..');
const growthMigration = fs.readFileSync(
    path.join(repositoryRoot, 'migrations', '20260913_growth_journey_v1.sql'),
    'utf8'
);
const rhythmMigration = fs.readFileSync(
    path.join(repositoryRoot, 'migrations', '20260914_growth_prayer_rhythm_v1.sql'),
    'utf8'
);
const transitionMigration = fs.readFileSync(
    path.join(repositoryRoot, 'migrations', '20260914_growth_legacy_transition_v1.sql'),
    'utf8'
);
const serverSource = fs.readFileSync(
    path.join(repositoryRoot, 'server.js'),
    'utf8'
);
const cliSource = fs.readFileSync(
    path.join(repositoryRoot, 'scripts', 'growth-journey-legacy-transition.js'),
    'utf8'
);

function exec(database, sql) {
    return new Promise((resolve, reject) => {
        database.exec(sql, error => error ? reject(error) : resolve());
    });
}

function close(database) {
    return new Promise((resolve, reject) => {
        database.close(error => error ? reject(error) : resolve());
    });
}

async function createFixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'growth-legacy-transition-'));
    const databasePath = path.join(directory, 'fixture.db');
    const database = new sqlite3.Database(databasePath);
    t.after(async () => {
        await close(database);
        fs.rmSync(directory, { recursive: true, force: true });
    });

    await exec(database, `
        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT,
            account_tier TEXT,
            commitment_intent TEXT,
            commitment_date TEXT,
            commitment_accepted_at TEXT,
            commitment_accepted_by TEXT
        );
        CREATE TABLE ministries (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT
        );
        CREATE TABLE ministry_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ministry_id INTEGER,
            youth_id INTEGER,
            role TEXT,
            sub_role TEXT,
            assigned_at TEXT
        );
        CREATE TABLE events (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE attendance (
            id INTEGER PRIMARY KEY,
            youth_id INTEGER,
            event_id INTEGER,
            checked_in_at TEXT
        );
        CREATE TABLE small_groups (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE secret_prayer_pals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER,
            pal_youth_id INTEGER,
            week_start TEXT
        );
        INSERT INTO ministries (id, name) VALUES (1, 'Prayer Ministry');
        ${growthMigration}
        ${rhythmMigration}
        ${transitionMigration}
    `);

    return { database, databasePath };
}

async function addMember(database, {
    id,
    name = `Member ${id}`,
    tier = 'New Member',
    intent = null,
    commitmentDate = null,
    acceptedAt = null,
    acceptedBy = null
}) {
    await GrowthJourney.run(
        database,
        `INSERT INTO youth (
            id, name, account_tier, commitment_intent,
            commitment_date, commitment_accepted_at,
            commitment_accepted_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, name, tier, intent, commitmentDate, acceptedAt, acceptedBy]
    );
}

async function addMinistryRole(database, youthId, role, ministryId = 1) {
    await GrowthJourney.run(
        database,
        `INSERT INTO ministry_members (
            ministry_id, youth_id, role, assigned_at
         ) VALUES (?, ?, ?, '2026-01-01T00:00:00.000Z')`,
        [ministryId, youthId, role]
    );
}

async function setCompleted(database, youthId, phaseKeys, basis = 'leadership_approved') {
    for (const phaseKey of phaseKeys) {
        const phase = await GrowthJourney.get(
            database,
            'SELECT id FROM growth_journey_phases WHERE phase_key = ?',
            [phaseKey]
        );
        await GrowthJourney.run(
            database,
            `INSERT INTO growth_phase_progress (
                youth_id, phase_id, status, progress_percent,
                essential_completed, essential_total,
                started_at, completed_at, completion_basis, updated_at
             ) VALUES (?, ?, 'completed', 100, 0, 0, ?, ?, ?, ?)`,
            [
                youthId,
                phase.id,
                '2026-01-01T00:00:00.000Z',
                '2026-01-02T00:00:00.000Z',
                basis,
                '2026-01-02T00:00:00.000Z'
            ]
        );
    }
}

async function progressRows(database, youthId) {
    return GrowthJourney.all(
        database,
        `SELECT phase.phase_key, progress.status, progress.progress_percent,
                progress.completed_at, progress.completion_basis
         FROM growth_phase_progress progress
         JOIN growth_journey_phases phase ON phase.id = progress.phase_id
         WHERE progress.youth_id = ?
         ORDER BY phase.phase_order`,
        [youthId]
    );
}

test('audit migration is additive, replay-safe, and never applies a transition', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 1, tier: 'Committed Member' });
    await exec(database, transitionMigration);
    await exec(database, transitionMigration);

    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_legacy_transitions'
    )).count, 0);
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_phase_progress'
    )).count, 0);
    const indexes = await GrowthJourney.all(
        database,
        "PRAGMA index_list('growth_legacy_transitions')"
    );
    assert.ok(indexes.some(index => index.name === 'growth_legacy_transitions_member_idx'));
    assert.ok(indexes.some(index => Number(index.unique) === 1));
});

test('preview classifies conservative legacy sources and commits zero mutations', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 1 });
    await addMember(database, { id: 2 });
    await addMember(database, { id: 3 });
    await addMember(database, { id: 4, intent: 'I would like to belong.' });
    await addMember(database, { id: 5, tier: 'Committed Member' });
    await addMember(database, { id: 6 });
    await addMember(database, { id: 7 });
    await addMember(database, { id: 8 });
    await addMember(database, { id: 9 });
    await addMember(database, { id: 10, commitmentDate: '2024-01-01' });
    await addMember(database, { id: 11, tier: 'Committed Member' });
    await addMember(database, { id: 12 });

    await GrowthJourney.run(
        database,
        `INSERT INTO growth_prayer_rhythm_days (
            youth_id, prayer_date, source_key, occurred_at
         ) VALUES (2, '2026-09-14', 'prayer-only', '2026-09-14T01:00:00.000Z')`
    );
    await GrowthJourney.run(
        database,
        `INSERT INTO attendance (id, youth_id, event_id, checked_in_at)
         VALUES (1, 3, 1, '2026-01-01T00:00:00.000Z')`
    );
    await addMinistryRole(database, 6, 'Member');
    await addMinistryRole(database, 7, 'Applicant');
    await addMinistryRole(database, 8, 'Inactive');
    await addMinistryRole(database, 9, 'Unverified Legacy Role');
    await addMinistryRole(database, 12, 'Integration Period');
    await setCompleted(database, 11, ['encounter', 'belong', 'commit']);

    const beforeProgress = await progressRows(database, 11);
    const result = await LegacyTransition.previewAllTransitions(database);
    const byId = new Map(result.candidates.map(candidate => [candidate.youth_id, candidate]));

    assert.deepEqual(result.counts, {
        new_unaffected: 7,
        formal_members: 1,
        active_servants: 1,
        no_op: 1,
        manual_review: 2
    });
    assert.equal(byId.get(1).derived_legacy_standing, 'unaffected');
    assert.equal(byId.get(2).derived_legacy_standing, 'unaffected');
    assert.equal(byId.get(3).derived_legacy_standing, 'unaffected');
    assert.equal(byId.get(4).derived_legacy_standing, 'unaffected');
    assert.equal(byId.get(5).derived_legacy_standing, 'formal_member');
    assert.equal(byId.get(6).derived_legacy_standing, 'active_servant');
    assert.equal(byId.get(7).derived_legacy_standing, 'unaffected');
    assert.equal(byId.get(8).derived_legacy_standing, 'unaffected');
    assert.equal(byId.get(12).derived_legacy_standing, 'unaffected');
    assert.equal(byId.get(9).manual_review_reason, 'unrecognized_current_ministry_role');
    assert.equal(
        byId.get(10).manual_review_reason,
        'commitment_date_without_authoritative_formal_acceptance'
    );
    assert.equal(byId.get(11).no_op, true);

    assert.deepEqual(await progressRows(database, 11), beforeProgress);
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_phase_progress WHERE youth_id <> 11'
    )).count, 0);
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_legacy_transitions'
    )).count, 0);
});

test('formal member transition completes only membership phases and survives recalculation', async t => {
    const { database } = await createFixture(t);
    await addMember(database, {
        id: 20,
        name: 'Established Member',
        tier: 'Committed Member',
        acceptedAt: '2024-03-01T10:00:00.000Z',
        acceptedBy: 'Legacy Leader'
    });
    const accountTask = await GrowthJourney.get(
        database,
        "SELECT id FROM growth_tasks WHERE task_key = 'encounter-account-start'"
    );
    await GrowthJourney.run(
        database,
        `INSERT INTO growth_evidence (
            youth_id, task_id, evidence_type, source_key,
            numeric_value, occurred_at, recorded_by
         ) VALUES (20, ?, 'account_created', 'genuine-existing-evidence', 1, ?, 'System')`,
        [accountTask.id, '2026-01-01T00:00:00.000Z']
    );
    const evidenceBefore = await GrowthJourney.all(
        database,
        'SELECT * FROM growth_evidence WHERE youth_id = 20 ORDER BY id'
    );

    const result = await LegacyTransition.applyMemberTransition(database, 20, {
        operator: 'Transition Administrator',
        now: new Date('2026-09-14T14:30:00.000Z')
    });
    assert.equal(result.applied, true);
    assert.deepEqual(result.phases_grandfathered, ['encounter', 'belong', 'commit']);
    assert.equal(result.journey.current_phase, 'discern');

    const rows = await progressRows(database, 20);
    assert.deepEqual(rows.map(row => row.phase_key), ['encounter', 'belong', 'commit']);
    assert.ok(rows.every(row => row.status === 'completed'));
    assert.ok(rows.every(row => row.progress_percent === 100));
    assert.ok(rows.every(row => row.completion_basis === 'legacy_membership_standing'));
    assert.ok(rows.every(row => row.completed_at === '2026-09-14T14:30:00.000Z'));
    assert.deepEqual(
        await GrowthJourney.all(database, 'SELECT * FROM growth_evidence WHERE youth_id = 20 ORDER BY id'),
        evidenceBefore
    );

    await GrowthJourney.run(
        database,
        `INSERT INTO growth_prayer_rhythm_days (
            youth_id, prayer_date, source_key, occurred_at
         ) VALUES (20, '2026-09-14', 'future-prayer', '2026-09-14T15:00:00.000Z')`
    );
    const journey = await GrowthJourney.getMemberJourney(database, 20, {
        asOf: '2026-09-14T16:00:00.000Z'
    });
    assert.equal(journey.currentPhase.phaseKey, 'discern');
    assert.equal(journey.nextInvitation.phaseKey, 'discern');
    assert.notEqual(journey.nextInvitation.taskKey, 'belong-membership-intent');
    assert.ok(journey.phases.slice(0, 3).every(phase => phase.status === 'completed'));
    assert.ok(journey.phases.slice(0, 3).every(phase => phase.progressPercent === 100));

    const covenant = await GrowthJourney.enrollPrayerCovenantChallenge(database, 20, {
        triggerType: 'member_choice',
        occurredAt: '2026-09-14T16:30:00.000Z'
    });
    assert.equal(covenant.enrolled, true);

    const audit = await GrowthJourney.get(
        database,
        'SELECT * FROM growth_legacy_transitions WHERE youth_id = 20'
    );
    assert.equal(audit.completion_basis, 'legacy_membership_standing');
    assert.equal(audit.operator_actor, 'Transition Administrator');
    assert.deepEqual(JSON.parse(audit.phases_grandfathered_json), [
        'encounter', 'belong', 'commit'
    ]);
    assert.equal(JSON.parse(audit.resulting_journey_json).current_phase, 'discern');
});

test('active servant transition stops at Form and leaves Serve current and Be Sent upcoming', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 30, name: 'Active Servant' });
    await addMinistryRole(database, 30, 'Ministry Head');

    const result = await LegacyTransition.applyMemberTransition(database, 30, {
        operator: 'Transition Administrator',
        now: new Date('2026-09-14T14:30:00.000Z')
    });
    assert.equal(result.applied, true);
    assert.deepEqual(result.phases_grandfathered, [
        'encounter', 'belong', 'commit', 'discern', 'form'
    ]);
    assert.equal(result.journey.current_phase, 'serve');
    const journey = await GrowthJourney.getMemberJourney(database, 30);
    assert.equal(journey.currentPhase.phaseKey, 'serve');
    assert.equal(journey.phases.find(phase => phase.phaseKey === 'serve').status, 'not_started');
    assert.equal(journey.phases.find(phase => phase.phaseKey === 'serve').sequenceState, 'current');
    assert.equal(journey.phases.find(phase => phase.phaseKey === 'be_sent').sequenceState, 'upcoming');
    assert.equal(journey.phases.find(phase => phase.phaseKey === 'be_sent').status, 'not_started');
    assert.ok((await progressRows(database, 30)).slice(0, 5).every(
        row => row.completion_basis === 'legacy_service_standing'
    ));
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_evidence WHERE youth_id = 30'
    )).count, 0);
});

test('transition is monotonic and preserves genuine higher state, basis, timestamps, and evidence', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 40 });
    await addMinistryRole(database, 40, 'Core');
    await setCompleted(database, 40, ['encounter', 'belong', 'commit', 'discern']);
    const evidenceTask = await GrowthJourney.get(
        database,
        "SELECT id FROM growth_tasks WHERE task_key = 'form-ministry-orientation'"
    );
    await GrowthJourney.run(
        database,
        `INSERT INTO growth_evidence (
            youth_id, task_id, evidence_type, source_key,
            numeric_value, occurred_at, recorded_by
         ) VALUES (40, ?, 'formation_attendance', 'genuine-formation', 1, ?, 'Leader')`,
        [evidenceTask.id, '2026-02-01T00:00:00.000Z']
    );
    const before = await progressRows(database, 40);
    const evidenceBefore = await GrowthJourney.all(
        database,
        'SELECT * FROM growth_evidence WHERE youth_id = 40'
    );

    const result = await LegacyTransition.applyMemberTransition(database, 40, {
        operator: 'Transition Administrator'
    });
    assert.equal(result.applied, true);
    assert.deepEqual(result.phases_grandfathered, ['form']);
    const after = await progressRows(database, 40);
    assert.deepEqual(after.slice(0, 4), before);
    assert.equal(after[4].completion_basis, 'legacy_service_standing');
    assert.deepEqual(
        await GrowthJourney.all(database, 'SELECT * FROM growth_evidence WHERE youth_id = 40'),
        evidenceBefore
    );

    await addMember(database, { id: 41 });
    await addMinistryRole(database, 41, 'Member');
    await setCompleted(database, 41, ['encounter', 'belong', 'commit', 'discern', 'form']);
    const noOp = await LegacyTransition.applyMemberTransition(database, 41, {
        operator: 'Transition Administrator'
    });
    assert.equal(noOp.applied, false);
    assert.equal(noOp.preview.no_op_reason, 'existing_journey_at_or_beyond_legacy_standing');
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_legacy_transitions WHERE youth_id = 41'
    )).count, 0);
});

test('paused and nonsequential Growth state fail closed for manual review', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 50, tier: 'Committed Member' });
    const belong = await GrowthJourney.get(
        database,
        "SELECT id FROM growth_journey_phases WHERE phase_key = 'belong'"
    );
    await GrowthJourney.run(
        database,
        `INSERT INTO growth_phase_progress (
            youth_id, phase_id, status, progress_percent, updated_at
         ) VALUES (50, ?, 'paused', 25, '2026-01-01')`,
        [belong.id]
    );
    const paused = await LegacyTransition.previewMemberTransition(database, 50);
    assert.equal(paused.manual_review_reason, 'paused_phase_requires_manual_review');

    await addMember(database, { id: 51, tier: 'Committed Member' });
    await setCompleted(database, 51, ['commit']);
    const nonsequential = await LegacyTransition.previewMemberTransition(database, 51);
    assert.equal(
        nonsequential.manual_review_reason,
        'nonsequential_existing_growth_completion'
    );

    await addMember(database, {
        id: 52,
        tier: 'New Member',
        acceptedAt: '2025-01-01T00:00:00.000Z'
    });
    const conflicting = await LegacyTransition.previewMemberTransition(database, 52);
    assert.equal(
        conflicting.manual_review_reason,
        'formal_acceptance_conflicts_with_account_tier'
    );
});

test('rerun is durable-idempotent and later service standing advances only the additional floor', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 60, tier: 'Committed Member' });
    const first = await LegacyTransition.applyMemberTransition(database, 60, {
        operator: 'Transition Administrator'
    });
    const replay = await LegacyTransition.applyMemberTransition(database, 60, {
        operator: 'Transition Administrator'
    });
    assert.equal(first.applied, true);
    assert.equal(replay.idempotent, true);
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_legacy_transitions WHERE youth_id = 60'
    )).count, 1);

    await addMinistryRole(database, 60, 'Member');
    const service = await LegacyTransition.applyMemberTransition(database, 60, {
        operator: 'Transition Administrator'
    });
    assert.deepEqual(service.phases_grandfathered, ['discern', 'form']);
    assert.equal(service.journey.current_phase, 'serve');
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_legacy_transitions WHERE youth_id = 60'
    )).count, 2);
    const rows = await progressRows(database, 60);
    assert.ok(rows.slice(0, 3).every(
        row => row.completion_basis === 'legacy_membership_standing'
    ));
    assert.ok(rows.slice(3, 5).every(
        row => row.completion_basis === 'legacy_service_standing'
    ));
});

test('injected failure rolls back one member without contaminating another', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 70, tier: 'Committed Member' });
    await addMember(database, { id: 71, tier: 'Committed Member' });

    await assert.rejects(
        LegacyTransition.applyMemberTransition(database, 70, {
            operator: 'Transition Administrator',
            injectFailureAfterPhase: 1
        }),
        error => error.code === 'INJECTED_FAILURE'
    );
    assert.deepEqual(await progressRows(database, 70), []);
    assert.deepEqual(await progressRows(database, 71), []);
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_legacy_transitions'
    )).count, 0);

    const other = await LegacyTransition.applyMemberTransition(database, 71, {
        operator: 'Transition Administrator'
    });
    assert.equal(other.applied, true);
    assert.deepEqual(await progressRows(database, 70), []);
    assert.equal((await progressRows(database, 71)).length, 3);
});

test('bulk apply requires deliberate confirmation and returns aggregate outcomes', async t => {
    const { database } = await createFixture(t);
    await addMember(database, { id: 80 });
    await addMember(database, { id: 81, tier: 'Committed Member' });
    await addMember(database, { id: 82 });
    await addMinistryRole(database, 82, 'Member');
    await addMember(database, { id: 83 });
    await addMinistryRole(database, 83, 'Unknown');

    await assert.rejects(
        LegacyTransition.applyAllTransitions(database, {
            operator: 'Transition Administrator',
            confirmationToken: 'wrong'
        }),
        error => error.code === 'BULK_CONFIRMATION_REQUIRED'
    );
    assert.equal((await GrowthJourney.get(
        database,
        'SELECT COUNT(*) AS count FROM growth_legacy_transitions'
    )).count, 0);

    const result = await LegacyTransition.applyAllTransitions(database, {
        operator: 'Transition Administrator',
        confirmationToken: LegacyTransition.BULK_CONFIRMATION_TOKEN
    });
    assert.deepEqual(result.preview_counts, {
        new_unaffected: 1,
        formal_members: 1,
        active_servants: 1,
        no_op: 0,
        manual_review: 1
    });
    assert.equal(result.attempted, 2);
    assert.equal(result.applied, 2);
    assert.deepEqual(result.errors, []);
});

test('CLI defaults read-only and enforces explicit single/bulk apply safeguards', () => {
    const preview = Cli.parseArguments(['--youth-id', '123', '--database', '/tmp/example.db']);
    assert.equal(preview.mode, 'preview');
    assert.equal(preview.youthId, 123);

    assert.throws(() => Cli.parseArguments(['--apply', '--youth-id', '123']));
    assert.throws(() => Cli.parseArguments([
        '--apply', '--all', '--operator', 'Admin', '--confirm', 'wrong'
    ]));
    assert.throws(() => Cli.parseArguments(['--preview', '--apply', '--youth-id', '123']));

    const single = Cli.parseArguments([
        '--apply', '--youth-id', '123', '--operator', 'Admin'
    ]);
    assert.equal(single.mode, 'apply');
    assert.equal(single.all, false);

    const bulk = Cli.parseArguments([
        '--apply', '--all', '--operator', 'Admin',
        '--confirm', LegacyTransition.BULK_CONFIRMATION_TOKEN
    ]);
    assert.equal(bulk.mode, 'apply');
    assert.equal(bulk.all, true);
    assert.match(cliSource, /OPEN_READONLY/);
    assert.doesNotMatch(serverSource, /\/api\/[^'"\s]*legacy-transition/);
    assert.doesNotMatch(serverSource, /applyAllTransitions|applyMemberTransition/);
    assert.match(serverSource, /Schema only: legacy Journey transitions are never run at startup/);
});
