const test = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sqlite3 = require('sqlite3').verbose();

const root = path.resolve(__dirname, '..');

const GrowthJourney = require(
    path.join(root, 'lib', 'growth-journey')
);

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else {
                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(err => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function makeFixture() {
    const dir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'fog-growth-attendance-')
    );

    const dbPath = path.join(dir, 'test.db');

    const db = new sqlite3.Database(dbPath);

    await exec(
        db,
        `
        PRAGMA foreign_keys = ON;

        CREATE TABLE youth (
            id INTEGER PRIMARY KEY,
            name TEXT
        );

        CREATE TABLE events (
            id INTEGER PRIMARY KEY,
            name TEXT
        );

        /*
         * Minimal legacy base tables required by the Growth
         * migration. These are intentionally empty because this
         * fixture tests attendance evidence, not legacy migration.
         */
        CREATE TABLE ministries (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT
        );

        CREATE TABLE small_groups (
            id INTEGER PRIMARY KEY,
            name TEXT,
            description TEXT
        );
        `
    );

    const migration = fs.readFileSync(
        path.join(
            root,
            'migrations',
            '20260913_growth_journey_v1.sql'
        ),
        'utf8'
    );

    await exec(db, migration);

    await run(
        db,
        `INSERT INTO youth (id, name)
         VALUES (1, 'Test Member')`
    );

    await run(
        db,
        `INSERT INTO events (id, name)
         VALUES (1, 'Test Event')`
    );

    return {
        db,
        dir,
        async cleanup() {
            await close(db);
            fs.rmSync(
                dir,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    };
}

async function task(db, taskKey) {
    const row = await get(
        db,
        `
        SELECT
            id,
            evidence_type
        FROM growth_tasks
        WHERE task_key = ?
        `,
        [taskKey]
    );

    assert.ok(
        row,
        `expected Growth task ${taskKey}`
    );

    return row;
}

async function addDirectMapping(
    db,
    taskKey,
    evidenceMode = 'attendance',
    formationArea = '',
    creditValue = 1
) {
    const t = await task(db, taskKey);

    return run(
        db,
        `
        INSERT INTO growth_event_task_map (
            task_id,
            event_id,
            series_id,
            evidence_mode,
            formation_area,
            credit_value,
            is_active
        )
        VALUES (?, 1, 0, ?, ?, ?, 1)
        `,
        [
            t.id,
            evidenceMode,
            formationArea,
            creditValue
        ]
    );
}

async function addSeriesMapping(
    db,
    taskKey,
    evidenceMode = 'attendance'
) {
    const t = await task(db, taskKey);

    const series = await run(
        db,
        `
        INSERT INTO growth_event_series (
            series_key,
            name,
            audience,
            is_active
        )
        VALUES (
            'test-series',
            'Test Series',
            'all',
            1
        )
        `
    );

    await run(
        db,
        `
        INSERT INTO growth_event_series_events (
            series_id,
            event_id
        )
        VALUES (?, 1)
        `,
        [series.lastID]
    );

    await run(
        db,
        `
        INSERT INTO growth_event_task_map (
            task_id,
            event_id,
            series_id,
            evidence_mode,
            formation_area,
            credit_value,
            is_active
        )
        VALUES (?, 0, ?, ?, '', 1, 1)
        `,
        [
            t.id,
            series.lastID,
            evidenceMode
        ]
    );

    return {
        task: t,
        seriesId: series.lastID
    };
}

test(
    'unmapped attendance creates no Growth evidence',
    async () => {
        const fixture = await makeFixture();

        try {
            const result =
                await GrowthJourney
                    .recordEventAttendanceGrowthEvidence(
                        fixture.db,
                        {
                            youthId: 1,
                            eventId: 1,
                            attendanceId: 100,
                            occurredAt:
                                '2026-09-13 20:00:00',
                            actor: 'Test Leader'
                        }
                    );

            assert.equal(
                result.attendanceMappings,
                0
            );

            assert.equal(
                result.insertedEvidence,
                0
            );

            const row = await get(
                fixture.db,
                `SELECT COUNT(*) count
                 FROM growth_evidence`
            );

            assert.equal(row.count, 0);
        } finally {
            await fixture.cleanup();
        }
    }
);

test(
    'mapped attendance records one semantic Growth evidence row and recalculates its phase',
    async () => {
        const fixture = await makeFixture();

        try {
            await addDirectMapping(
                fixture.db,
                'encounter-community-event'
            );

            const result =
                await GrowthJourney
                    .recordEventAttendanceGrowthEvidence(
                        fixture.db,
                        {
                            youthId: 1,
                            eventId: 1,
                            attendanceId: 101,
                            isWalkin: true,
                            occurredAt:
                                '2026-09-13 20:01:00',
                            actor: 'Test Leader'
                        }
                    );

            assert.equal(
                result.attendanceMappings,
                1
            );

            assert.equal(
                result.insertedEvidence,
                1
            );

            assert.deepEqual(
                result.recalculatedPhases,
                ['encounter']
            );

            const evidence = await get(
                fixture.db,
                `
                SELECT *
                FROM growth_evidence
                WHERE youth_id = 1
                `
            );

            assert.equal(
                evidence.evidence_type,
                'event_participation'
            );

            assert.equal(
                evidence.source_table,
                'attendance'
            );

            assert.equal(
                evidence.source_id,
                101
            );

            assert.equal(
                evidence.source_key,
                'event-attendance:event:1'
            );

            assert.equal(
                evidence.numeric_value,
                1
            );

            const details = JSON.parse(
                evidence.details_json
            );

            assert.equal(
                details.event_id,
                1
            );

            assert.equal(
                details.attendance_id,
                101
            );

            assert.equal(
                details.evidence_mode,
                'attendance'
            );

            assert.equal(
                details.is_walkin,
                1
            );

            const progress = await get(
                fixture.db,
                `
                SELECT COUNT(*) count
                FROM growth_phase_progress
                WHERE youth_id = 1
                  AND phase_id = 1
                `
            );

            assert.equal(
                progress.count,
                1
            );
        } finally {
            await fixture.cleanup();
        }
    }
);

test(
    'replaying the same member event task cannot double-credit even with another attendance row id',
    async () => {
        const fixture = await makeFixture();

        try {
            await addDirectMapping(
                fixture.db,
                'encounter-community-event'
            );

            const first =
                await GrowthJourney
                    .recordEventAttendanceGrowthEvidence(
                        fixture.db,
                        {
                            youthId: 1,
                            eventId: 1,
                            attendanceId: 201
                        }
                    );

            const second =
                await GrowthJourney
                    .recordEventAttendanceGrowthEvidence(
                        fixture.db,
                        {
                            youthId: 1,
                            eventId: 1,
                            attendanceId: 202
                        }
                    );

            assert.equal(
                first.insertedEvidence,
                1
            );

            assert.equal(
                second.insertedEvidence,
                0
            );

            const row = await get(
                fixture.db,
                `
                SELECT
                    COUNT(*) count,
                    SUM(numeric_value) total
                FROM growth_evidence
                `
            );

            assert.equal(row.count, 1);
            assert.equal(row.total, 1);
        } finally {
            await fixture.cleanup();
        }
    }
);

test(
    'direct event mapping overrides series attendance mapping for the same task',
    async () => {
        const fixture = await makeFixture();

        try {
            const series = await addSeriesMapping(
                fixture.db,
                'belong-community-orientation',
                'attendance'
            );

            await addDirectMapping(
                fixture.db,
                'belong-community-orientation',
                'completion'
            );

            const effective =
                await GrowthJourney
                    .effectiveGrowthMappingsForEvent(
                        fixture.db,
                        1
                    );

            const selected = effective.find(
                mapping =>
                    mapping.task_id ===
                    series.task.id
            );

            assert.ok(selected);

            assert.equal(
                selected.source_type,
                'event'
            );

            assert.equal(
                selected.evidence_mode,
                'completion'
            );

            const result =
                await GrowthJourney
                    .recordEventAttendanceGrowthEvidence(
                        fixture.db,
                        {
                            youthId: 1,
                            eventId: 1,
                            attendanceId: 301
                        }
                    );

            assert.equal(
                result.insertedEvidence,
                0
            );

            const row = await get(
                fixture.db,
                `
                SELECT COUNT(*) count
                FROM growth_evidence
                WHERE task_id = ?
                `,
                [series.task.id]
            );

            assert.equal(row.count, 0);
        } finally {
            await fixture.cleanup();
        }
    }
);

test(
    'Form attendance preserves the task evidence type and formation metadata',
    async () => {
        const fixture = await makeFixture();

        try {
            await addDirectMapping(
                fixture.db,
                'form-spiritual',
                'attendance',
                'spiritual'
            );

            const result =
                await GrowthJourney
                    .recordEventAttendanceGrowthEvidence(
                        fixture.db,
                        {
                            youthId: 1,
                            eventId: 1,
                            attendanceId: 401
                        }
                    );

            assert.equal(
                result.insertedEvidence,
                1
            );

            const evidence = await get(
                fixture.db,
                `
                SELECT *
                FROM growth_evidence
                WHERE youth_id = 1
                `
            );

            assert.equal(
                evidence.evidence_type,
                'formation_area_attendance'
            );

            const details = JSON.parse(
                evidence.details_json
            );

            assert.equal(
                details.formation_area,
                'spiritual'
            );
        } finally {
            await fixture.cleanup();
        }
    }
);

test(
    'Serve attendance percentage is never credited from one attendance row',
    async () => {
        const fixture = await makeFixture();

        try {
            await addDirectMapping(
                fixture.db,
                'serve-attendance',
                'attendance'
            );

            const result =
                await GrowthJourney
                    .recordEventAttendanceGrowthEvidence(
                        fixture.db,
                        {
                            youthId: 1,
                            eventId: 1,
                            attendanceId: 501
                        }
                    );

            assert.equal(
                result.attendanceMappings,
                1
            );

            assert.equal(
                result.skippedMappings,
                1
            );

            assert.equal(
                result.insertedEvidence,
                0
            );

            const row = await get(
                fixture.db,
                `
                SELECT COUNT(*) count
                FROM growth_evidence
                `
            );

            assert.equal(row.count, 0);
        } finally {
            await fixture.cleanup();
        }
    }
);

test(
    'the live check-in route invokes the Growth attendance hook only after a successful attendance insert',
    () => {
        const source = fs.readFileSync(
            path.join(root, 'server.js'),
            'utf8'
        );

        const start = source.indexOf(
            "app.post('/api/checkin'"
        );

        const end = source.indexOf(
            "app.get('/api/attendance/logs'",
            start
        );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const route = source.slice(
            start,
            end
        );

        const insertPos = route.indexOf(
            'INSERT INTO attendance'
        );

        const hookPos = route.indexOf(
            'recordEventAttendanceGrowthEvidence'
        );

        assert.ok(insertPos >= 0);
        assert.ok(hookPos > insertPos);

        assert.match(
            route,
            /\[Growth Journey\] Attendance evidence hook failed/
        );

        const serverOccurrences =
            (
                source.match(
                    /recordEventAttendanceGrowthEvidence/g
                ) || []
            ).length;

        assert.equal(
            serverOccurrences,
            1,
            'no startup or historical backfill hook should exist'
        );
    }
);
