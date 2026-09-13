'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sqlite3 = require('sqlite3');

const GrowthJourney = require('../lib/growth-journey');

const DB_PATH = process.env.GROWTH_TEST_DB;
const lifecycleTest = DB_PATH ? test : test.skip;

function openDb() {
    return new sqlite3.Database(DB_PATH);
}

function closeDb(db) {
    return new Promise((resolve, reject) => {
        db.close(err => err ? reject(err) : resolve());
    });
}

lifecycleTest(
    'Growth Journey membership intent and Prayer Covenant lifecycle',
    { concurrency: false },
    async () => {
        const db = openDb();

        try {
            const members = await GrowthJourney.all(
                db,
                `
                SELECT id
                FROM youth
                ORDER BY id
                LIMIT 2
                `
            );

            assert.ok(
                members.length >= 2,
                'Need at least two members in test DB'
            );

            const youthA = members[0].id;
            const youthB = members[1].id;

            await GrowthJourney.run(
                db,
                `
                DELETE FROM growth_onboarding_daily_completions
                WHERE enrollment_id IN (
                    SELECT id
                    FROM growth_onboarding_enrollments
                    WHERE youth_id IN (?, ?)
                )
                `,
                [youthA, youthB]
            );

            await GrowthJourney.run(
                db,
                `
                DELETE FROM growth_onboarding_enrollments
                WHERE youth_id IN (?, ?)
                `,
                [youthA, youthB]
            );

            await GrowthJourney.run(
                db,
                `
                DELETE FROM growth_evidence
                WHERE youth_id IN (?, ?)
                `,
                [youthA, youthB]
            );

            await GrowthJourney.run(
                db,
                `
                DELETE FROM growth_phase_progress
                WHERE youth_id IN (?, ?)
                `,
                [youthA, youthB]
            );

            await GrowthJourney.run(
                db,
                `
                DELETE FROM secret_prayer_pals
                WHERE youth_id IN (?, ?)
                `,
                [youthA, youthB]
            );

            await GrowthJourney.run(
                db,
                `
                UPDATE growth_onboarding_templates
                SET
                    is_paused = 0,
                    auto_enroll_enabled = 1,
                    is_default = 1,
                    is_active = 1
                WHERE template_code = 'prayer-covenant-21'
                `
            );

            const accountStart =
                await GrowthJourney.recordAccountCreated(
                    db,
                    youthA,
                    {
                        sourceTable: 'users',
                        sourceId: 800001,
                        occurredAt: '2026-09-13 17:00:00',
                        actor: 'TEST',
                        details: {
                            method: 'registration'
                        }
                    }
                );

            assert.equal(
                accountStart.evidence.inserted,
                true,
                'First account-created evidence should be inserted'
            );

            assert.equal(
                accountStart.encounter.status,
                'in_progress'
            );

            assert.ok(
                accountStart.encounter.progressPercent > 0,
                'Account creation should begin Encounter'
            );

            const repeatedAccountStart =
                await GrowthJourney.recordAccountCreated(
                    db,
                    youthA,
                    {
                        sourceTable: 'users',
                        sourceId: 800001,
                        occurredAt: '2026-09-13 17:01:00',
                        actor: 'TEST',
                        details: {
                            method: 'registration'
                        }
                    }
                );

            assert.equal(
                repeatedAccountStart.evidence.inserted,
                false,
                'Account-created evidence must be idempotent'
            );

            const preIntentEnrollment =
                await GrowthJourney.get(
                    db,
                    `
                    SELECT COUNT(*) AS total
                    FROM growth_onboarding_enrollments
                    WHERE youth_id = ?
                    `,
                    [youthA]
                );

            assert.equal(
                preIntentEnrollment.total,
                0,
                'Account creation alone must not start the Prayer Covenant'
            );

            const preIntentPartner =
                await GrowthJourney.get(
                    db,
                    `
                    SELECT COUNT(*) AS total
                    FROM secret_prayer_pals
                    WHERE youth_id = ?
                    `,
                    [youthA]
                );

            assert.equal(
                preIntentPartner.total,
                0,
                'Account creation alone must not assign an onboarding Prayer Partner'
            );

            const intent = await GrowthJourney.recordMembershipIntent(
                db,
                youthA,
                {
                    sourceId: 900001,
                    occurredAt: '2026-09-13 17:30:00',
                    actor: 'TEST'
                }
            );

            assert.equal(intent.evidence.inserted, true);
            assert.equal(intent.onboarding.enrolled, true);
            assert.equal(
                intent.onboarding.enrollment.completed_days,
                0
            );

            assert.ok(
                intent.prayerPartner,
                'Active onboarding should attempt Prayer Partner assignment'
            );

            assert.equal(
                intent.prayerPartner.available,
                true
            );

            assert.notEqual(
                Number(intent.prayerPartner.partnerYouthId),
                Number(youthA),
                'Member must never be assigned to pray for self'
            );

            const partnerRows =
                await GrowthJourney.get(
                    db,
                    `
                    SELECT COUNT(*) AS total
                    FROM secret_prayer_pals
                    WHERE youth_id = ?
                    `,
                    [youthA]
                );

            assert.equal(
                partnerRows.total,
                1,
                'Onboarding creates exactly one Prayer Partner assignment'
            );

            const repeatedIntent =
                await GrowthJourney.recordMembershipIntent(
                    db,
                    youthA,
                    {
                        sourceId: 900001,
                        occurredAt: '2026-09-13 17:31:00',
                        actor: 'TEST'
                    }
                );

            assert.equal(
                repeatedIntent.evidence.inserted,
                false,
                'Membership intent evidence must be idempotent'
            );

            assert.equal(
                repeatedIntent.onboarding.reason,
                'already_enrolled'
            );

            assert.ok(
                repeatedIntent.prayerPartner
            );

            assert.equal(
                repeatedIntent.prayerPartner.available,
                true
            );

            assert.equal(
                Number(
                    repeatedIntent.prayerPartner.partnerYouthId
                ),
                Number(
                    intent.prayerPartner.partnerYouthId
                ),
                'Repeated intent must preserve the same existing partner'
            );

            const partnerRowsAfterRepeat =
                await GrowthJourney.get(
                    db,
                    `
                    SELECT COUNT(*) AS total
                    FROM secret_prayer_pals
                    WHERE youth_id = ?
                    `,
                    [youthA]
                );

            assert.equal(
                partnerRowsAfterRepeat.total,
                1,
                'Repeated intent must not create duplicate partner assignments'
            );

            const enrollmentCount = await GrowthJourney.get(
                db,
                `
                SELECT COUNT(*) AS total
                FROM growth_onboarding_enrollments
                WHERE youth_id = ?
                `,
                [youthA]
            );

            assert.equal(enrollmentCount.total, 1);

            const day1 =
                await GrowthJourney.recordPrayerCovenantCompletion(
                    db,
                    youthA,
                    {
                        sourceKey: 'test-prayer-day-1',
                        completedAt: '2026-09-13 18:00:00',
                        actor: 'TEST'
                    }
                );

            assert.equal(day1.credited, true);
            assert.equal(day1.dayNumber, 1);
            assert.equal(day1.completed, false);

            const duplicateDay1 =
                await GrowthJourney.recordPrayerCovenantCompletion(
                    db,
                    youthA,
                    {
                        sourceKey: 'different-source-same-day',
                        completedAt: '2026-09-13 20:00:00',
                        actor: 'TEST'
                    }
                );

            assert.equal(duplicateDay1.credited, false);
            assert.equal(
                duplicateDay1.reason,
                'already_credited_today'
            );

            const day2 =
                await GrowthJourney.recordPrayerCovenantCompletion(
                    db,
                    youthA,
                    {
                        sourceKey: 'test-prayer-day-2',
                        completedAt: '2026-09-15 08:00:00',
                        actor: 'TEST'
                    }
                );

            assert.equal(day2.credited, true);
            assert.equal(day2.dayNumber, 2);

            /*
             * September 14 was intentionally skipped.
             * The challenge must continue, not reset.
             */
            assert.equal(
                day2.enrollment.completed_days,
                2,
                'Missed calendar days must not reset progress'
            );

            for (let dayNumber = 3; dayNumber <= 21; dayNumber++) {
                const date = new Date(
                    Date.UTC(2026, 8, 13 + dayNumber)
                );

                const yyyy = date.getUTCFullYear();
                const mm = String(
                    date.getUTCMonth() + 1
                ).padStart(2, '0');
                const dd = String(
                    date.getUTCDate()
                ).padStart(2, '0');

                const dateString =
                    `${yyyy}-${mm}-${dd} 08:00:00`;

                const result =
                    await GrowthJourney.recordPrayerCovenantCompletion(
                        db,
                        youthA,
                        {
                            sourceKey:
                                `test-prayer-day-${dayNumber}`,
                            completedAt: dateString,
                            actor: 'TEST'
                        }
                    );

                assert.equal(result.credited, true);
                assert.equal(result.dayNumber, dayNumber);
            }

            const finished = await GrowthJourney.get(
                db,
                `
                SELECT *
                FROM growth_onboarding_enrollments
                WHERE youth_id = ?
                `,
                [youthA]
            );

            assert.equal(finished.completed_days, 21);
            assert.equal(finished.status, 'completed');
            assert.ok(finished.completed_at);

            const prayerTask = await GrowthJourney.getTaskByKey(
                db,
                'encounter-prayer-covenant-21'
            );

            const prayerEvidence = await GrowthJourney.get(
                db,
                `
                SELECT
                    COUNT(*) AS evidence_count,
                    COALESCE(SUM(numeric_value), 0) AS total_value
                FROM growth_evidence
                WHERE youth_id = ?
                  AND task_id = ?
                `,
                [youthA, prayerTask.id]
            );

            assert.equal(prayerEvidence.evidence_count, 21);
            assert.equal(prayerEvidence.total_value, 21);

            const journey = await GrowthJourney.getMemberJourney(
                db,
                youthA
            );

            assert.equal(journey.phases.length, 7);

            const encounter = journey.phases.find(
                p => p.phaseKey === 'encounter'
            );

            assert.ok(encounter);
            assert.ok(encounter.progressPercent > 0);

            /*
             * Global pause must stop NEW automatic enrollment.
             */
            await GrowthJourney.run(
                db,
                `
                UPDATE growth_onboarding_templates
                SET is_paused = 1
                WHERE template_code = 'prayer-covenant-21'
                `
            );

            const pausedIntent =
                await GrowthJourney.recordMembershipIntent(
                    db,
                    youthB,
                    {
                        sourceId: 900002,
                        occurredAt: '2026-09-13 19:00:00',
                        actor: 'TEST'
                    }
                );

            assert.equal(
                pausedIntent.onboarding.enrolled,
                false
            );

            assert.equal(
                pausedIntent.onboarding.reason,
                'template_not_enrolling'
            );

            assert.equal(
                pausedIntent.prayerPartner,
                null,
                'Paused onboarding must not assign a Prayer Partner'
            );

            const youthBPartner = await GrowthJourney.get(
                db,
                `
                SELECT COUNT(*) AS total
                FROM secret_prayer_pals
                WHERE youth_id = ?
                `,
                [youthB]
            );

            assert.equal(
                youthBPartner.total,
                0,
                'Paused onboarding creates no Prayer Partner assignment'
            );

            const youthBEnrollment = await GrowthJourney.get(
                db,
                `
                SELECT COUNT(*) AS total
                FROM growth_onboarding_enrollments
                WHERE youth_id = ?
                `,
                [youthB]
            );

            assert.equal(youthBEnrollment.total, 0);
        } finally {
            await closeDb(db);
        }
    }
);
