'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const sqlite3 = require('sqlite3').verbose();

const GrowthJourney = require('../lib/growth-journey');
const root = path.resolve(__dirname, '..');
const baseMigration = fs.readFileSync(
    path.join(root, 'migrations', '20260913_growth_journey_v1.sql'),
    'utf8'
);
const readinessMigration = fs.readFileSync(
    path.join(root, 'migrations', '20260914_growth_encounter_readiness_v1.sql'),
    'utf8'
);
const rhythmMigration = fs.readFileSync(
    path.join(root, 'migrations', '20260914_growth_prayer_rhythm_v1.sql'),
    'utf8'
);

function execute(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, error => error ? reject(error) : resolve());
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(error => error ? reject(error) : resolve());
    });
}

async function createFixture({ applyRhythmMigration = true } = {}) {
    const db = new sqlite3.Database(':memory:');
    await execute(db, `
        PRAGMA foreign_keys = ON;
        CREATE TABLE youth (id INTEGER PRIMARY KEY, name TEXT);
        CREATE TABLE ministries (id INTEGER PRIMARY KEY, name TEXT, description TEXT);
        CREATE TABLE small_groups (id INTEGER PRIMARY KEY, name TEXT, description TEXT);
    `);
    await execute(db, baseMigration);
    await execute(db, readinessMigration);
    await GrowthJourney.run(db, "INSERT INTO youth (id, name) VALUES (1, 'Prayer Rhythm Member')");
    await GrowthJourney.run(db, "INSERT INTO youth (id, name) VALUES (2, 'Second Rhythm Member')");
    if (applyRhythmMigration) await execute(db, rhythmMigration);
    return db;
}

async function recordDay(db, youthId, dateKey, suffix = '') {
    return GrowthJourney.recordPrayerCovenantCompletion(db, youthId, {
        sourceTable: 'personal_inbox',
        sourceId: Number(dateKey.replace(/-/g, '')),
        sourceKey: `personal-inbox:${youthId}:${dateKey}${suffix}`,
        completedAt: `${dateKey} 20:00:00`,
        actor: `MEMBER-${youthId}`
    });
}

test('Prayer Rhythm migration is additive, replay-safe, configurable, and does not fabricate history', async () => {
    const db = await createFixture({ applyRhythmMigration: false });
    try {
        const enrollment = await GrowthJourney.enrollDefaultOnboarding(db, 1, {
            triggerType: 'membership_intent',
            triggerSourceId: 101,
            occurredAt: '2026-08-01 10:00:00'
        });
        await GrowthJourney.run(
            db,
            `INSERT INTO growth_onboarding_daily_completions
                (enrollment_id, completion_date, day_number, source_key, completed_at)
             VALUES (?, '2026-08-01', 1, 'historical-onboarding-only', '2026-08-01 20:00:00')`,
            [enrollment.enrollment.id]
        );

        await execute(db, rhythmMigration);
        assert.equal((await GrowthJourney.get(
            db, 'SELECT COUNT(*) AS count FROM growth_prayer_rhythm_days'
        )).count, 0);

        const tasks = await GrowthJourney.all(
            db,
            `SELECT phase.phase_key, task.classification, task.evidence_type,
                    task.target_value, task.progress_weight, task.config_json
             FROM growth_tasks task
             JOIN growth_journey_phases phase ON phase.id = task.phase_id
             WHERE task.evidence_type = 'prayer_rhythm_recent'
             ORDER BY phase.phase_order`
        );
        assert.equal(tasks.length, 7);
        assert.ok(tasks.every(task => task.classification === 'growth'));
        assert.ok(tasks.every(task => Number(task.target_value) === 7));
        assert.equal(Number(tasks[0].progress_weight), 1);
        assert.ok(tasks.slice(1).every(task => Number(task.progress_weight) === 0.5));
        assert.ok(tasks.every(task => JSON.parse(task.config_json).window_days === 14));

        await execute(db, rhythmMigration);
        assert.equal((await GrowthJourney.get(
            db,
            "SELECT COUNT(*) AS count FROM growth_tasks WHERE evidence_type = 'prayer_rhythm_recent'"
        )).count, 7);
        assert.equal((await GrowthJourney.get(db, 'PRAGMA integrity_check')).integrity_check, 'ok');
    } finally {
        await close(db);
    }
});

test('concurrent same-day Prayer Rhythm writes serialize to one canonical day', async () => {
    const db = await createFixture();
    try {
        const results = await Promise.all([
            recordDay(db, 1, '2026-09-14', ':first'),
            recordDay(db, 1, '2026-09-14', ':second')
        ]);

        assert.deepEqual(
            results.map(result => result.prayerRhythm.credited).sort(),
            [false, true]
        );
        assert.equal((await GrowthJourney.get(
            db,
            `SELECT COUNT(*) AS count
             FROM growth_prayer_rhythm_days
             WHERE youth_id = 1 AND prayer_date = '2026-09-14'`
        )).count, 1);
    } finally {
        await close(db);
    }
});

test('a challenge consumer failure rolls back the canonical day and releases the mutation queue', async () => {
    const db = await createFixture();
    try {
        const enrollment = await GrowthJourney.enrollDefaultOnboarding(db, 1, {
            triggerType: 'membership_intent',
            triggerSourceId: 151,
            occurredAt: '2026-09-14 09:00:00'
        });
        await execute(db, `
            CREATE TEMP TRIGGER reject_prayer_challenge_day
            BEFORE INSERT ON growth_onboarding_daily_completions
            BEGIN
                SELECT RAISE(ABORT, 'forced challenge failure');
            END;
        `);

        await assert.rejects(
            recordDay(db, 1, '2026-09-14'),
            /forced challenge failure/
        );
        assert.equal((await GrowthJourney.get(
            db,
            'SELECT COUNT(*) AS count FROM growth_prayer_rhythm_days WHERE youth_id = 1'
        )).count, 0);
        assert.equal((await GrowthJourney.get(
            db,
            `SELECT completed_days
             FROM growth_onboarding_enrollments
             WHERE id = ?`,
            [enrollment.enrollment.id]
        )).completed_days, 0);

        await execute(db, 'DROP TRIGGER reject_prayer_challenge_day;');
        const retry = await recordDay(db, 1, '2026-09-14', ':retry');
        assert.equal(retry.prayerRhythm.credited, true);
        assert.equal(retry.credited, true);
        assert.equal(retry.dayNumber, 1);
    } finally {
        await close(db);
    }
});

test('permanent Prayer Rhythm continues after the independent 21-day challenge completes', async () => {
    const db = await createFixture();
    try {
        await GrowthJourney.enrollDefaultOnboarding(db, 1, {
            triggerType: 'membership_intent',
            triggerSourceId: 201,
            occurredAt: '2026-09-01 09:00:00'
        });

        let day21;
        for (let day = 1; day <= 21; day += 1) {
            const dateKey = `2026-09-${String(day).padStart(2, '0')}`;
            const result = await recordDay(db, 1, dateKey);
            assert.equal(result.credited, true);
            assert.equal(result.dayNumber, day);
            day21 = result;
        }
        assert.equal(day21.completed, true);
        assert.equal(day21.enrollment.status, 'completed');

        const day22 = await recordDay(db, 1, '2026-09-22');
        assert.equal(day22.credited, false);
        assert.equal(day22.reason, 'welcome_journey_complete');
        assert.equal(day22.prayerRhythm.credited, true);
        assert.equal(day22.prayerRhythm.completedToday, true);

        const replay = await recordDay(db, 1, '2026-09-22', ':replay');
        assert.equal(replay.credited, false);
        assert.equal(replay.prayerRhythm.credited, false);

        const counts = {
            rhythm: (await GrowthJourney.get(db,
                'SELECT COUNT(*) AS count FROM growth_prayer_rhythm_days WHERE youth_id = 1')).count,
            challenge: (await GrowthJourney.get(db,
                `SELECT COUNT(*) AS count FROM growth_onboarding_daily_completions
                 WHERE enrollment_id = ?`, [day21.enrollment.id])).count,
            challengeEvidence: (await GrowthJourney.get(db,
                "SELECT COUNT(*) AS count FROM growth_evidence WHERE evidence_type = 'onboarding_prayer_day'")).count
        };
        assert.deepEqual(counts, { rhythm: 22, challenge: 21, challengeEvidence: 21 });
        const enrollment = await GrowthJourney.get(
            db,
            'SELECT status, completed_days FROM growth_onboarding_enrollments WHERE id = ?',
            [day21.enrollment.id]
        );
        assert.deepEqual(enrollment, { status: 'completed', completed_days: 21 });
    } finally {
        await close(db);
    }
});

test('Prayer Rhythm uses a bounded Manila-day window and contributes without bypassing Essentials', async () => {
    const db = await createFixture();
    try {
        for (let day = 1; day <= 30; day += 1) {
            const dateKey = `2026-01-${String(day).padStart(2, '0')}`;
            await GrowthJourney.run(
                db,
                `INSERT INTO growth_prayer_rhythm_days
                    (youth_id, prayer_date, source_table, source_key, occurred_at, recorded_by)
                 VALUES (1, ?, 'personal_inbox', ?, ?, 'TEST')`,
                [dateKey, `old:${dateKey}`, `${dateKey} 20:00:00`]
            );
        }

        const historicalOnly = await GrowthJourney.getPrayerRhythmStatus(db, 1, {
            asOf: '2026-09-22 12:00:00'
        });
        assert.equal(historicalOnly.qualifyingDays, 0);
        assert.equal(historicalOnly.consistencyPercent, 0);

        for (const dateKey of [
            '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19',
            '2026-09-20', '2026-09-21', '2026-09-22'
        ]) {
            const result = await recordDay(db, 1, dateKey);
            assert.equal(result.prayerRhythm.credited, true);
            assert.equal(result.reason, 'no_active_welcome_journey');
        }

        const current = await GrowthJourney.getPrayerRhythmStatus(db, 1, {
            asOf: '2026-09-22 23:00:00'
        });
        assert.equal(current.windowStart, '2026-09-09');
        assert.equal(current.windowEnd, '2026-09-22');
        assert.equal(current.qualifyingDays, 7);
        assert.equal(current.consistencyPercent, 100);

        const journey = await GrowthJourney.getMemberJourney(db, 1, {
            asOf: '2026-09-22 23:00:00'
        });
        const encounter = journey.phases.find(phase => phase.phaseKey === 'encounter');
        const belong = journey.phases.find(phase => phase.phaseKey === 'belong');
        const sent = journey.phases.find(phase => phase.phaseKey === 'be_sent');
        const encounterRhythm = encounter.tasks.find(task => task.evidenceType === 'prayer_rhythm_recent');
        const belongRhythm = belong.tasks.find(task => task.evidenceType === 'prayer_rhythm_recent');
        const sentRhythm = sent.tasks.find(task => task.evidenceType === 'prayer_rhythm_recent');

        assert.equal(encounterRhythm.completed, true);
        assert.equal(belongRhythm.completed, true);
        assert.equal(sentRhythm.completed, true);
        assert.ok(encounterRhythm.progressWeight > belongRhythm.progressWeight);
        assert.equal(encounter.status, 'in_progress');
        assert.equal(belong.status, 'in_progress');
        assert.equal(sent.status, 'in_progress');
        assert.ok(encounter.essentialCompleted < encounter.essentialTotal);
        assert.ok(belong.essentialCompleted < belong.essentialTotal);
        assert.ok(sent.essentialCompleted < sent.essentialTotal);
        assert.equal(journey.currentPhase.phaseKey, 'encounter');
        assert.equal(journey.currentPhase.sequenceState, 'current');
        assert.equal(journey.nextInvitation.taskKey, 'encounter-community-event');
        assert.deepEqual(
            journey.phases.map(phase => phase.sequenceState),
            ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']
        );
    } finally {
        await close(db);
    }
});

test('Prayer Rhythm preserves mutation-driven ready transitions and Manila boundaries', async () => {
    assert.equal(GrowthJourney.manilaDate('2026-09-13T15:59:59Z'), '2026-09-13');
    assert.equal(GrowthJourney.manilaDate('2026-09-13T16:00:00Z'), '2026-09-14');
    assert.equal(GrowthJourney.manilaDate('2026-09-14 00:00:00'), '2026-09-14');

    const db = await createFixture();
    try {
        const first = await recordDay(db, 1, '2026-09-20');
        assert.equal(first.phaseTransitions.find(phase => phase.phaseKey === 'encounter').status, 'in_progress');

        const essentialTask = await GrowthJourney.getTaskByKey(db, 'encounter-community-event');
        await GrowthJourney.recordEvidence(db, {
            youthId: 1,
            taskId: essentialTask.id,
            evidenceType: essentialTask.evidence_type,
            sourceTable: 'attendance',
            sourceId: 999,
            sourceKey: 'ready-transition-fixture',
            occurredAt: '2026-09-21 10:00:00'
        });
        const second = await recordDay(db, 1, '2026-09-21');
        const encounter = second.phaseTransitions.find(phase => phase.phaseKey === 'encounter');
        assert.equal(encounter.previousStatus, 'in_progress');
        assert.equal(encounter.status, 'ready');
        assert.equal(encounter.statusChanged, true);

        await GrowthJourney.run(
            db,
            `UPDATE growth_phase_progress
             SET status = 'completed', completed_at = '2026-09-21 20:00:00'
             WHERE youth_id = 1 AND phase_id = ?`,
            [essentialTask.phase_id]
        );
        const advancedJourney = await GrowthJourney.getMemberJourney(db, 1, {
            asOf: '2026-09-21 21:00:00'
        });
        assert.equal(advancedJourney.currentPhase.phaseKey, 'belong');
        assert.equal(advancedJourney.nextPhase.phaseKey, 'commit');
        assert.deepEqual(
            advancedJourney.phases.map(phase => phase.sequenceState),
            ['completed', 'current', 'upcoming', 'upcoming', 'upcoming', 'upcoming', 'upcoming']
        );

        const privateTables = await GrowthJourney.all(
            db,
            `SELECT name FROM sqlite_master
             WHERE type = 'table' AND (name LIKE '%watchtower%' OR name LIKE '%coverage%')`
        );
        assert.deepEqual(privateTables, []);
        const columns = await GrowthJourney.all(db, 'PRAGMA table_info(growth_prayer_rhythm_days)');
        assert.ok(columns.some(column => column.name === 'youth_id'));
        assert.ok(!columns.some(column => column.name === 'recipient_id'));
    } finally {
        await close(db);
    }
});
