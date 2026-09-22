const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3').verbose();

const GrowthJourney = require('../lib/growth-journey');

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (error) {
            if (error) return reject(error);

            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) return reject(error);
            resolve(rows || []);
        });
    });
}

function close(db) {
    return new Promise((resolve, reject) => {
        db.close(error => {
            if (error) return reject(error);
            resolve();
        });
    });
}

function snapshot(rows) {
    return rows.map(row => ({
        youth_id: Number(row.youth_id),
        pal_youth_id: Number(row.pal_youth_id),
        week_start: row.week_start
    }));
}

test(
    'Prayer Partner rotation is Monday-keyed, complete, idempotent, repairable, and transactional',
    async () => {
        const directory = fs.mkdtempSync(
            path.join(
                os.tmpdir(),
                'fog-prayer-rotation-'
            )
        );

        const dbPath = path.join(
            directory,
            'rotation.db'
        );

        const db = new sqlite3.Database(dbPath);

        try {
            await run(
                db,
                `CREATE TABLE youth (
                    id INTEGER PRIMARY KEY,
                    commitment_intent TEXT
                )`
            );

            await run(
                db,
                `CREATE TABLE secret_prayer_pals (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    youth_id INTEGER,
                    pal_youth_id INTEGER,
                    week_start TEXT,
                    UNIQUE(youth_id, week_start)
                )`
            );

            await run(
                db,
                `CREATE TABLE growth_onboarding_enrollments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    youth_id INTEGER,
                    status TEXT
                )`
            );

            for (const id of [1, 2, 3, 4, 5, 6]) {
                await run(
                    db,
                    `INSERT INTO youth (
                        id,
                        commitment_intent
                     )
                     VALUES (?, NULL)`,
                    [id]
                );
            }

            // 1-3 are established legacy Prayer Partner participants.
            await run(
                db,
                `INSERT INTO secret_prayer_pals (
                    youth_id,
                    pal_youth_id,
                    week_start
                 )
                 VALUES
                    (1, 2, '2026-09-07'),
                    (2, 3, '2026-09-07'),
                    (3, 1, '2026-09-07')`
            );

            // 4 explicitly expressed Membership/Belonging Intent.
            await run(
                db,
                `UPDATE youth
                 SET commitment_intent =
                    'I want to belong'
                 WHERE id = 4`
            );

            // 5 is enrolled in Prayer Covenant onboarding.
            await run(
                db,
                `INSERT INTO growth_onboarding_enrollments (
                    youth_id,
                    status
                 )
                 VALUES (5, 'active')`
            );

            // 6 is registration-only and must remain excluded.

            assert.equal(
                GrowthJourney.getManilaMondayKey(
                    new Date(
                        '2026-09-13T10:00:00Z'
                    )
                ),
                '2026-09-07'
            );

            assert.equal(
                GrowthJourney.getManilaMondayKey(
                    new Date(
                        '2026-09-14T01:00:00Z'
                    )
                ),
                '2026-09-14'
            );

            const first =
                await GrowthJourney.rotatePrayerPartners(
                    db,
                    {
                        now: new Date(
                            '2026-09-14T01:00:00Z'
                        ),
                        random: () => 0.37
                    }
                );

            assert.equal(first.status, 'created');
            assert.equal(first.changed, true);
            assert.equal(
                first.weekStart,
                '2026-09-14'
            );
            assert.equal(first.assignedCount, 5);

            const registrationOnlyRows =
                await all(
                    db,
                    `SELECT COUNT(*) AS count
                     FROM secret_prayer_pals
                     WHERE week_start='2026-09-14'
                       AND (
                            youth_id = 6
                            OR pal_youth_id = 6
                       )`
                );

            assert.equal(
                Number(
                    registrationOnlyRows[0].count
                ),
                0
            );

            const firstRows = await all(
                db,
                `SELECT
                    youth_id,
                    pal_youth_id,
                    week_start
                 FROM secret_prayer_pals
                 WHERE week_start='2026-09-14'
                 ORDER BY youth_id`
            );

            assert.equal(firstRows.length, 5);

            assert.equal(
                new Set(
                    firstRows.map(
                        row => row.youth_id
                    )
                ).size,
                5
            );

            assert.equal(
                new Set(
                    firstRows.map(
                        row => row.pal_youth_id
                    )
                ).size,
                5
            );

            assert.equal(
                firstRows.some(
                    row =>
                        row.youth_id ===
                        row.pal_youth_id
                ),
                false
            );

            const original =
                snapshot(firstRows);

            const second =
                await GrowthJourney.rotatePrayerPartners(
                    db,
                    {
                        now: new Date(
                            '2026-09-14T01:05:00Z'
                        ),
                        random: () => 0.81
                    }
                );

            assert.equal(
                second.status,
                'already_complete'
            );

            assert.equal(
                second.changed,
                false
            );

            const unchanged = await all(
                db,
                `SELECT
                    youth_id,
                    pal_youth_id,
                    week_start
                 FROM secret_prayer_pals
                 WHERE week_start='2026-09-14'
                 ORDER BY youth_id`
            );

            assert.deepEqual(
                snapshot(unchanged),
                original
            );

            await run(
                db,
                `DELETE FROM secret_prayer_pals
                 WHERE youth_id=3
                   AND week_start='2026-09-14'`
            );

            const repaired =
                await GrowthJourney.rotatePrayerPartners(
                    db,
                    {
                        now: new Date(
                            '2026-09-14T02:00:00Z'
                        ),
                        random: () => 0.22
                    }
                );

            assert.equal(
                repaired.status,
                'rebuilt'
            );

            assert.equal(
                repaired.assignedCount,
                5
            );

            const repairedRows =
                await all(
                    db,
                    `SELECT
                        youth_id,
                        pal_youth_id,
                        week_start
                     FROM secret_prayer_pals
                     WHERE week_start='2026-09-14'
                     ORDER BY youth_id`
                );

            assert.equal(
                repairedRows.length,
                5
            );

            assert.equal(
                repairedRows.some(
                    row =>
                        row.youth_id ===
                        row.pal_youth_id
                ),
                false
            );

            assert.equal(
                new Set(
                    repairedRows.map(
                        row => row.pal_youth_id
                    )
                ).size,
                5
            );

            const beforeFailure =
                snapshot(repairedRows);

            await run(
                db,
                `CREATE TRIGGER fail_rotation_insert
                 BEFORE INSERT ON secret_prayer_pals
                 WHEN NEW.youth_id = 3
                 BEGIN
                    SELECT RAISE(
                        ABORT,
                        'forced rotation failure'
                    );
                 END`
            );

            await assert.rejects(
                GrowthJourney.rotatePrayerPartners(
                    db,
                    {
                        now: new Date(
                            '2026-09-14T03:00:00Z'
                        ),
                        force: true,
                        random: () => 0.63
                    }
                ),
                /forced rotation failure/
            );

            const afterFailure =
                await all(
                    db,
                    `SELECT
                        youth_id,
                        pal_youth_id,
                        week_start
                     FROM secret_prayer_pals
                     WHERE week_start='2026-09-14'
                     ORDER BY youth_id`
                );

            assert.deepEqual(
                snapshot(afterFailure),
                beforeFailure
            );

            await run(
                db,
                `DROP TRIGGER fail_rotation_insert`
            );

            const forced =
                await GrowthJourney.rotatePrayerPartners(
                    db,
                    {
                        now: new Date(
                            '2026-09-14T04:00:00Z'
                        ),
                        force: true,
                        random: () => 0.63
                    }
                );

            assert.equal(
                forced.status,
                'rebuilt'
            );

            assert.equal(
                forced.changed,
                true
            );

            assert.equal(
                forced.assignedCount,
                5
            );
        } finally {
            await close(db);

            fs.rmSync(
                directory,
                {
                    recursive: true,
                    force: true
                }
            );
        }
    }
);

test(
    'server uses one canonical Prayer Partner engine for manual and scheduled rotation',
    () => {
        const source = fs.readFileSync(
            path.join(
                __dirname,
                '..',
                'server.js'
            ),
            'utf8'
        );

        assert.doesNotMatch(
            source,
            /STRICT GENDER MATCHING/
        );

        assert.doesNotMatch(
            source,
            /assignPalsByGender/
        );

        assert.doesNotMatch(
            source,
            /members\?\.length \|\| 0 < 2/
        );

        assert.match(
            source,
            /GrowthJourney\.rotatePrayerPartners/
        );

        assert.match(
            source,
            /app\.post\('\/api\/admin\/trigger-prayer-pals', requirePermission\('edit_entries'\), async/
        );

        assert.match(
            source,
            /force_rebuild === true/
        );

        assert.match(
            source,
            /cron\.schedule\('0 9 \* \* 1', async/
        );

        assert.match(
            source,
            /timezone:\s*'Asia\/Manila'/
        );
    }
);
