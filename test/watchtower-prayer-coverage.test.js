'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sqlite3 = require('sqlite3');

const NotificationCenter = require('../lib/notification-center');
const Watchtower = require('../lib/watchtower-prayer-coverage');

const migration = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '20260914_watchtower_prayer_coverage_v1.sql'),
    'utf8'
);

function openDb() {
    return new sqlite3.Database(':memory:');
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, error => error ? reject(error) : resolve());
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) return reject(error);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => error ? reject(error) : resolve(row || null));
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows || []));
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(error => error ? reject(error) : resolve());
    });
}

async function createSchema(db) {
    await exec(db, `
        PRAGMA foreign_keys = ON;

        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT,
            qr_code TEXT,
            profile_picture TEXT,
            email_verified INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            permissions TEXT,
            youth_id INTEGER
        );

        CREATE TABLE secret_prayer_pals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER,
            pal_youth_id INTEGER,
            week_start TEXT,
            UNIQUE(youth_id, week_start)
        );

        CREATE TABLE personal_inbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            title TEXT,
            message TEXT,
            status TEXT,
            created_at TEXT
        );

        CREATE TABLE growth_prayer_rhythm_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER NOT NULL,
            prayer_date TEXT NOT NULL,
            source_table TEXT NOT NULL,
            source_id INTEGER,
            source_key TEXT NOT NULL UNIQUE,
            occurred_at TEXT NOT NULL,
            recorded_by TEXT NOT NULL,
            UNIQUE(youth_id, prayer_date)
        );

        CREATE TABLE growth_onboarding_daily_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            enrollment_id INTEGER,
            completion_date TEXT,
            day_number INTEGER
        );

        CREATE TABLE growth_evidence (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER,
            evidence_type TEXT
        );

        CREATE TABLE growth_phase_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            youth_id INTEGER,
            progress_percent REAL,
            status TEXT
        );

        CREATE TABLE notification_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_key TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            importance TEXT NOT NULL DEFAULT 'normal',
            action_url TEXT,
            source_type TEXT NOT NULL DEFAULT 'system',
            source_id INTEGER,
            source_actor TEXT,
            metadata_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE notification_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER NOT NULL,
            youth_id INTEGER NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(event_id, youth_id)
        );

        CREATE TABLE notification_preferences (
            youth_id INTEGER PRIMARY KEY,
            push_enabled INTEGER NOT NULL DEFAULT 1,
            email_enabled INTEGER NOT NULL DEFAULT 0,
            prayer_daily_growth INTEGER NOT NULL DEFAULT 1,
            journey_progress INTEGER NOT NULL DEFAULT 1,
            events_formation INTEGER NOT NULL DEFAULT 1,
            membership_community INTEGER NOT NULL DEFAULT 1,
            ministry_servant INTEGER NOT NULL DEFAULT 1,
            prayer_partner INTEGER NOT NULL DEFAULT 1,
            games_growth INTEGER NOT NULL DEFAULT 1,
            preferred_prayer_time TEXT,
            quiet_hours_start TEXT,
            quiet_hours_end TEXT,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await exec(db, migration);
}

async function seedYouth(db, id, name = `Member ${id}`) {
    await run(
        db,
        `INSERT INTO youth (id, name, email, qr_code, email_verified)
         VALUES (?, ?, ?, ?, 1)`,
        [id, name, `member${id}@invalid.test`, `MEMBER-${id}`]
    );
}

async function seedPopulation(db) {
    for (const id of [1, 2, 3, 90, 91]) {
        await seedYouth(db, id);
    }

    for (const [sender, recipient] of [[1, 2], [2, 3], [3, 1]]) {
        await run(
            db,
            `INSERT INTO secret_prayer_pals (youth_id, pal_youth_id, week_start)
             VALUES (?, ?, '2026-09-14')`,
            [sender, recipient]
        );
    }
}

async function recordNormalPrayer(db, senderId, recipientId, suffix = '') {
    const inbox = await run(
        db,
        `INSERT INTO personal_inbox (
            sender_id, receiver_id, title, message, status, created_at
         ) VALUES (?, ?, 'Prayer', 'Prayer', 'Delivered', '2026-09-14 22:00:00')`,
        [senderId, recipientId]
    );

    await run(
        db,
        `INSERT INTO growth_prayer_rhythm_days (
            youth_id, prayer_date, source_table, source_id,
            source_key, occurred_at, recorded_by
         ) VALUES (?, '2026-09-14', 'personal_inbox', ?, ?, ?, 'TEST')`,
        [senderId, inbox.lastID, `normal:${senderId}:${suffix}`, '2026-09-14T14:00:00.000Z']
    );
}

test('migration is additive, replay-safe, and enforces durable uniqueness', async t => {
    const db = openDb();
    t.after(() => close(db));

    await createSchema(db);
    await exec(db, migration);

    for (const table of [
        'watchtower_prayer_claims',
        'watchtower_prayer_coverage',
        'watchtower_daily_reports'
    ]) {
        assert.ok((await all(db, `PRAGMA table_info(${table})`)).length > 0, table);
    }

    await seedPopulation(db);
    await run(
        db,
        `INSERT INTO watchtower_prayer_claims (
            coverage_date, covered_youth_id, claimant_youth_id,
            claimed_at, expires_at
         ) VALUES ('2026-09-14', 1, 90, '2026-09-14T14:00:00.000Z', '2026-09-14T14:15:00.000Z')`
    );

    await assert.rejects(
        run(
            db,
            `INSERT INTO watchtower_prayer_claims (
                coverage_date, covered_youth_id, claimant_youth_id,
                claimed_at, expires_at
             ) VALUES ('2026-09-14', 1, 91, '2026-09-14T14:01:00.000Z', '2026-09-14T14:16:00.000Z')`
        ),
        /UNIQUE/
    );
});

test('coverage population uses only valid recipients in the current Manila-week assignment snapshot', async t => {
    const db = openDb();
    t.after(() => close(db));
    await createSchema(db);
    await seedPopulation(db);
    await seedYouth(db, 4, '   ');
    await run(
        db,
        `INSERT INTO secret_prayer_pals (youth_id, pal_youth_id, week_start)
         VALUES (90, 4, '2026-09-14')`
    );
    await run(
        db,
        `INSERT INTO secret_prayer_pals (youth_id, pal_youth_id, week_start)
         VALUES (91, 91, '2026-09-14')`
    );
    await run(
        db,
        `INSERT INTO secret_prayer_pals (youth_id, pal_youth_id, week_start)
         VALUES (90, 91, '2026-09-07')`
    );

    const population = await Watchtower.loadCoveragePopulation(
        db,
        new Date('2026-09-14T14:00:00.000Z')
    );
    assert.deepEqual(population.map(member => member.id), [1, 2, 3]);
});

test('normal and fallback coverage remain distinct and Watchtower creates no fake Growth or Prayer Habit credit', async t => {
    const db = openDb();
    t.after(() => close(db));
    await createSchema(db);
    await seedPopulation(db);
    await recordNormalPrayer(db, 3, 1, 'first');

    const before = {
        rhythm: (await get(db, 'SELECT COUNT(*) AS count FROM growth_prayer_rhythm_days')).count,
        onboarding: (await get(db, 'SELECT COUNT(*) AS count FROM growth_onboarding_daily_completions')).count,
        evidence: (await get(db, 'SELECT COUNT(*) AS count FROM growth_evidence')).count,
        progress: (await get(db, 'SELECT COUNT(*) AS count FROM growth_phase_progress')).count
    };

    const initial = await Watchtower.getWatchtowerState(db, {
        actorYouthId: 90,
        now: new Date('2026-09-14T14:05:00.000Z')
    });
    assert.deepEqual(initial.uncovered.map(member => member.youth_id), [2, 3]);

    await Watchtower.claimWatchtowerMember(db, {
        actorYouthId: 90,
        coveredYouthId: 2,
        now: new Date('2026-09-14T14:10:00.000Z')
    });
    await Watchtower.completeWatchtowerPrayer(db, {
        actorYouthId: 90,
        coveredYouthId: 2,
        now: new Date('2026-09-14T14:11:00.000Z')
    });

    assert.deepEqual({
        rhythm: (await get(db, 'SELECT COUNT(*) AS count FROM growth_prayer_rhythm_days')).count,
        onboarding: (await get(db, 'SELECT COUNT(*) AS count FROM growth_onboarding_daily_completions')).count,
        evidence: (await get(db, 'SELECT COUNT(*) AS count FROM growth_evidence')).count,
        progress: (await get(db, 'SELECT COUNT(*) AS count FROM growth_phase_progress')).count
    }, before);

    const coverage = await get(db, 'SELECT * FROM watchtower_prayer_coverage');
    assert.equal(coverage.covered_youth_id, 2);
    assert.equal(coverage.intercessor_youth_id, 90);
    assert.equal(coverage.coverage_source, 'watchtower');

    await recordNormalPrayer(db, 1, 2, 'later');
    assert.equal(
        (await get(db, 'SELECT COUNT(*) AS count FROM growth_prayer_rhythm_days WHERE youth_id = 1')).count,
        1,
        'later normal assigned prayer remains allowed'
    );

    const after = await Watchtower.getWatchtowerState(db, {
        actorYouthId: 90,
        now: new Date('2026-09-14T14:20:00.000Z')
    });
    assert.deepEqual(after.uncovered.map(member => member.youth_id), [3]);
    assert.equal(after.total_covered, 2);
});

test('claims are atomic, retry-safe, non-stealable, owner-bound, expiring, and completion-idempotent', async t => {
    const db = openDb();
    t.after(() => close(db));
    await createSchema(db);
    await seedPopulation(db);

    const now = new Date('2026-09-14T14:00:00.000Z');
    const attempts = await Promise.allSettled([
        Watchtower.claimWatchtowerMember(db, { actorYouthId: 90, coveredYouthId: 1, now }),
        Watchtower.claimWatchtowerMember(db, { actorYouthId: 91, coveredYouthId: 1, now })
    ]);
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
    assert.equal(attempts.find(result => result.status === 'rejected').reason.code, 'CLAIMED_BY_ANOTHER');

    const owner = attempts[0].status === 'fulfilled' ? 90 : 91;
    const other = owner === 90 ? 91 : 90;
    const retry = await Watchtower.claimWatchtowerMember(db, {
        actorYouthId: owner,
        coveredYouthId: 1,
        now: new Date('2026-09-14T14:05:00.000Z')
    });
    assert.equal(retry.already_claimed, true);

    await assert.rejects(
        Watchtower.completeWatchtowerPrayer(db, {
            actorYouthId: other,
            coveredYouthId: 1,
            now: new Date('2026-09-14T14:06:00.000Z')
        }),
        error => error.code === 'CLAIM_NOT_OWNED'
    );

    await assert.rejects(
        Watchtower.claimWatchtowerMember(db, {
            actorYouthId: 1,
            coveredYouthId: 1,
            now
        }),
        error => error.code === 'SELF_CLAIM'
    );

    const reclaimed = await Watchtower.claimWatchtowerMember(db, {
        actorYouthId: other,
        coveredYouthId: 1,
        now: new Date('2026-09-14T14:16:00.000Z')
    });
    assert.equal(reclaimed.already_claimed, false);

    const completed = await Watchtower.completeWatchtowerPrayer(db, {
        actorYouthId: other,
        coveredYouthId: 1,
        now: new Date('2026-09-14T14:17:00.000Z')
    });
    const replay = await Watchtower.completeWatchtowerPrayer(db, {
        actorYouthId: other,
        coveredYouthId: 1,
        now: new Date('2026-09-14T14:18:00.000Z')
    });
    assert.equal(completed.already_completed, false);
    assert.equal(replay.already_completed, true);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM watchtower_prayer_coverage')).count, 1);

    await assert.rejects(
        Watchtower.claimWatchtowerMember(db, {
            actorYouthId: owner,
            coveredYouthId: 1,
            now: new Date('2026-09-14T14:19:00.000Z')
        }),
        error => error.code === 'ALREADY_COVERED'
    );
});

test('normal assigned prayer winning after a claim resolves coverage without fallback evidence', async t => {
    const db = openDb();
    t.after(() => close(db));
    await createSchema(db);
    await seedPopulation(db);

    await Watchtower.claimWatchtowerMember(db, {
        actorYouthId: 90,
        coveredYouthId: 2,
        now: new Date('2026-09-14T14:05:00.000Z')
    });
    await recordNormalPrayer(db, 1, 2, 'after-claim');

    const result = await Watchtower.completeWatchtowerPrayer(db, {
        actorYouthId: 90,
        coveredYouthId: 2,
        now: new Date('2026-09-14T14:06:00.000Z')
    });
    assert.equal(result.completed, false);
    assert.equal(result.already_covered, true);
    assert.equal(result.coverage_source, 'normal_assigned_prayer');
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM watchtower_prayer_coverage')).count, 0);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM growth_prayer_rhythm_days')).count, 1);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM growth_onboarding_daily_completions')).count, 0);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM growth_evidence')).count, 0);
});

test('server-derived Manila window opens at 22:00, closes at 23:00, and rolls date at Manila midnight', async t => {
    const db = openDb();
    t.after(() => close(db));
    await createSchema(db);
    await seedPopulation(db);

    assert.equal(Watchtower.getWindowStatus(new Date('2026-09-14T13:59:59.000Z')).phase, 'before_open');
    assert.equal(Watchtower.getWindowStatus(new Date('2026-09-14T14:00:00.000Z')).open, true);
    assert.equal(Watchtower.getWindowStatus(new Date('2026-09-14T14:59:59.000Z')).open, true);
    assert.equal(Watchtower.getWindowStatus(new Date('2026-09-14T15:00:00.000Z')).phase, 'closed');
    assert.equal(Watchtower.getWindowStatus(new Date('2026-09-14T16:00:00.000Z')).manila_date, '2026-09-15');
    assert.equal(Watchtower.getManilaMondayKey(new Date('2026-09-14T16:00:00.000Z')), '2026-09-14');

    for (const when of ['2026-09-14T13:59:59.000Z', '2026-09-14T15:00:00.000Z']) {
        await assert.rejects(
            Watchtower.claimWatchtowerMember(db, {
                actorYouthId: 90,
                coveredYouthId: 1,
                now: new Date(when)
            }),
            error => error.code === 'WATCHTOWER_CLOSED'
        );
    }
});

test('23:00 report snapshots mixed coverage once and notifies only canonical access_prayer recipients by Push', async t => {
    const db = openDb();
    t.after(() => close(db));
    await createSchema(db);
    await seedPopulation(db);
    await run(db, `INSERT INTO users (username, permissions, youth_id) VALUES ('authorized', '["access_prayer"]', 90)`);
    await run(db, `INSERT INTO users (username, permissions, youth_id) VALUES ('unauthorized', '["edit_entries"]', 91)`);
    await recordNormalPrayer(db, 3, 1, 'report');
    await Watchtower.claimWatchtowerMember(db, {
        actorYouthId: 90,
        coveredYouthId: 2,
        now: new Date('2026-09-14T14:10:00.000Z')
    });
    await Watchtower.completeWatchtowerPrayer(db, {
        actorYouthId: 90,
        coveredYouthId: 2,
        now: new Date('2026-09-14T14:11:00.000Z')
    });

    const dispatches = [];
    const options = {
        now: new Date('2026-09-14T15:00:00.000Z'),
        notificationCenter: NotificationCenter,
        dispatchEvent: async (eventId, dispatchOptions) => {
            dispatches.push({ eventId, dispatchOptions });
        }
    };
    const first = await Watchtower.createDailyCoverageReport(db, options);
    const second = await Watchtower.createDailyCoverageReport(db, options);

    assert.deepEqual({
        eligible_population: first.report.eligible_population,
        normal_coverage: first.report.normal_coverage,
        watchtower_coverage: first.report.watchtower_coverage,
        total_covered: first.report.total_covered,
        uncovered: first.report.uncovered,
        coverage_percent: first.report.coverage_percent
    }, {
        eligible_population: 3,
        normal_coverage: 1,
        watchtower_coverage: 1,
        total_covered: 2,
        uncovered: 1,
        coverage_percent: 66.67
    });
    assert.equal(first.report_recipient_count, 1);
    assert.equal(first.notification_created, true);
    assert.equal(second.notification_created, false);
    assert.deepEqual(dispatches, [{
        eventId: dispatches[0].eventId,
        dispatchOptions: { channels: ['push'] }
    }]);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM watchtower_daily_reports')).count, 1);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM notification_events')).count, 1);
    assert.deepEqual(await all(db, 'SELECT youth_id FROM notification_recipients'), [{ youth_id: 90 }]);

    delete require.cache[require.resolve('../lib/watchtower-prayer-coverage')];
    const restarted = require('../lib/watchtower-prayer-coverage');
    const replay = await restarted.createDailyCoverageReport(db, options);
    assert.equal(replay.notification_created, false);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM watchtower_daily_reports')).count, 1);
});

test('report scheduler is disabled by default and enabled mode performs restart-safe Manila due checks', async t => {
    let scheduled = 0;
    const disabled = Watchtower.startWatchtowerScheduler({
        enabled: false,
        cron: { schedule() { scheduled += 1; } }
    });
    assert.equal((await disabled.initialRun).status, 'disabled');
    assert.equal(scheduled, 0);

    const db = openDb();
    t.after(() => close(db));
    await createSchema(db);
    await seedPopulation(db);

    const enabled = Watchtower.startWatchtowerScheduler({
        enabled: true,
        database: db,
        cron: {
            schedule(expression, callback, options) {
                scheduled += 1;
                assert.equal(expression, '*/5 23 * * *');
                assert.equal(typeof callback, 'function');
                assert.deepEqual(options, { scheduled: true, timezone: 'Asia/Manila' });
                return { stop() {} };
            }
        },
        now: () => new Date('2026-09-14T15:05:00.000Z'),
        logger: { info() {}, error() {} }
    });
    assert.equal((await enabled.initialRun).status, 'completed');
    assert.equal(scheduled, 1);
    assert.equal((await get(db, 'SELECT COUNT(*) AS count FROM watchtower_daily_reports')).count, 1);
});
