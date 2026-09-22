'use strict';

const NotificationCenter =
    require('./notification-center');

const TIME_ZONE =
    'Asia/Manila';

const DEFAULT_REMINDER_HOUR =
    21;

const PRAYER_COVENANT_TEMPLATE_CODE =
    'prayer-covenant-21';

const PRAYER_COVENANT_DURATION_DAYS =
    21;

const NOTIFICATION_CATEGORY =
    'prayer_daily_growth';

const NOTIFICATION_TITLE =
    'Prayer Covenant Reminder';

const NOTIFICATION_MESSAGE =
    'A gentle reminder to spend a moment in prayer for your Prayer Partner today. 🙏';

function all(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.all(
                sql,
                params,
                (error, rows) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(rows || []);
                }
            );
        }
    );
}

function validDatabase(database) {
    return Boolean(
        database &&
        typeof database.all === 'function' &&
        typeof database.run === 'function' &&
        typeof database.get === 'function'
    );
}

function normalizeReminderHour(value) {
    const parsed =
        value === null ||
        value === undefined ||
        value === ''
            ? DEFAULT_REMINDER_HOUR
            : Number(value);

    return (
        Number.isSafeInteger(parsed) &&
        parsed >= 0 &&
        parsed <= 23
    )
        ? parsed
        : DEFAULT_REMINDER_HOUR;
}

function getManilaClock(value = new Date()) {
    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (!Number.isFinite(date.getTime())) {
        throw new TypeError(
            'now must be a valid date'
        );
    }

    const parts =
        new Intl.DateTimeFormat(
            'en-CA',
            {
                timeZone:
                    TIME_ZONE,
                year:
                    'numeric',
                month:
                    '2-digit',
                day:
                    '2-digit',
                hour:
                    '2-digit',
                hourCycle:
                    'h23'
            }
        )
            .formatToParts(date)
            .reduce(
                (result, part) => {
                    if (
                        part.type !==
                        'literal'
                    ) {
                        result[part.type] =
                            part.value;
                    }

                    return result;
                },
                {}
            );

    return {
        dateKey:
            `${parts.year}-${parts.month}-${parts.day}`,
        hour:
            Number(parts.hour)
    };
}

function emptyResult({
    status,
    dateKey = null
}) {
    return {
        status,
        manila_date:
            dateKey,
        eligible:
            0,
        already_prayed:
            0,
        already_reminded:
            0,
        notifications_created:
            0,
        push_attempted:
            0,
        push_sent:
            0,
        inactive:
            0,
        malformed:
            0,
        errors:
            0
    };
}

function validEnrollment(row) {
    const enrollmentId =
        Number(row && row.enrollment_id);

    const youthId =
        Number(row && row.youth_id);

    const completedDays =
        Number(row && row.completed_days);

    const durationDays =
        Number(row && row.duration_days);

    return (
        Number.isSafeInteger(enrollmentId) &&
        enrollmentId > 0 &&
        Number.isSafeInteger(youthId) &&
        youthId > 0 &&
        Number.isSafeInteger(completedDays) &&
        completedDays >= 0 &&
        Number.isSafeInteger(durationDays) &&
        durationDays ===
            PRAYER_COVENANT_DURATION_DAYS
    );
}

function summarizePushDispatch(
    dispatchResults,
    result
) {
    if (!Array.isArray(dispatchResults)) {
        return;
    }

    for (const recipient of dispatchResults) {
        const push =
            recipient &&
            recipient.deliveries &&
            recipient.deliveries.push;

        if (!push) {
            continue;
        }

        const attempts =
            Number(push.attempt_count);

        if (
            Number.isSafeInteger(attempts) &&
            attempts > 0
        ) {
            result.push_attempted += 1;
        }

        if (push.status === 'sent') {
            result.push_sent += 1;
        }
    }
}

async function sweepPrayerCovenantReminders({
    database,
    now = new Date(),
    reminderHour = DEFAULT_REMINDER_HOUR,
    notificationCenter = NotificationCenter,
    dispatchEvent = null
} = {}) {
    if (!validDatabase(database)) {
        throw new TypeError(
            'database is required'
        );
    }

    if (
        !notificationCenter ||
        typeof notificationCenter
            .createNotification !==
            'function'
    ) {
        throw new TypeError(
            'notificationCenter is required'
        );
    }

    if (
        dispatchEvent !== null &&
        typeof dispatchEvent !== 'function'
    ) {
        throw new TypeError(
            'dispatchEvent must be a function or null'
        );
    }

    const clock =
        getManilaClock(now);

    const normalizedHour =
        normalizeReminderHour(
            reminderHour
        );

    if (clock.hour < normalizedHour) {
        return emptyResult({
            status:
                'not_due',
            dateKey:
                clock.dateKey
        });
    }

    const result =
        emptyResult({
            status:
                'completed',
            dateKey:
                clock.dateKey
        });

    const enrollments =
        await all(
            database,
            `SELECT
                enrollment.id AS enrollment_id,
                enrollment.youth_id,
                enrollment.status,
                enrollment.completed_days,
                template.duration_days,
                template.is_active AS template_is_active,
                template.is_paused AS template_is_paused,
                CASE WHEN prayer.id IS NULL
                    THEN 0
                    ELSE 1
                END AS prayed_today
             FROM growth_onboarding_enrollments enrollment
             JOIN growth_onboarding_templates template
               ON template.id = enrollment.template_id
             LEFT JOIN growth_prayer_rhythm_days prayer
               ON prayer.youth_id = enrollment.youth_id
              AND prayer.prayer_date = ?
             WHERE template.template_code = ?
             ORDER BY enrollment.id`,
            [
                clock.dateKey,
                PRAYER_COVENANT_TEMPLATE_CODE
            ]
        );

    for (const row of enrollments) {
        if (!validEnrollment(row)) {
            result.malformed += 1;
            continue;
        }

        const completedDays =
            Number(row.completed_days);

        if (
            row.status !== 'active' ||
            Number(row.template_is_active) !== 1 ||
            Number(row.template_is_paused) !== 0 ||
            completedDays >=
                PRAYER_COVENANT_DURATION_DAYS
        ) {
            result.inactive += 1;
            continue;
        }

        if (Number(row.prayed_today) === 1) {
            result.already_prayed += 1;
            continue;
        }

        result.eligible += 1;

        try {
            const youthId =
                Number(row.youth_id);

            const notification =
                await notificationCenter
                    .createNotification(
                        database,
                        {
                            eventKey:
                                `prayer-covenant-reminder:youth:${youthId}:date:${clock.dateKey}`,
                            category:
                                NOTIFICATION_CATEGORY,
                            title:
                                NOTIFICATION_TITLE,
                            message:
                                NOTIFICATION_MESSAGE,
                            importance:
                                'normal',
                            actionUrl:
                                '/',
                            sourceType:
                                'prayer_covenant_reminder',
                            sourceId:
                                Number(
                                    row.enrollment_id
                                ),
                            metadata: {
                                manila_date:
                                    clock.dateKey,
                                template_code:
                                    PRAYER_COVENANT_TEMPLATE_CODE
                            },
                            recipientYouthIds: [
                                youthId
                            ],
                            createdAt:
                                new Date(now)
                                    .toISOString()
                        }
                    );

            if (
                Number(
                    notification
                        .insertedRecipients
                ) === 1
            ) {
                result.notifications_created += 1;
            } else {
                result.already_reminded += 1;
            }

            /*
             * Match the canonical Growth notification rule: only the
             * process that inserted the durable recipient may begin
             * external delivery. Concurrent/replayed sweeps retain the
             * existing Inbox reminder without producing another Push.
             */
            if (
                dispatchEvent &&
                notification &&
                Number(
                    notification
                        .insertedRecipients
                ) === 1 &&
                Number.isSafeInteger(
                    Number(
                        notification.eventId
                    )
                )
            ) {
                const dispatchResults =
                    await dispatchEvent(
                        Number(
                            notification.eventId
                        ),
                        {
                            channels: [
                                'push'
                            ]
                        }
                    );

                summarizePushDispatch(
                    dispatchResults,
                    result
                );
            }
        } catch {
            result.errors += 1;
        }
    }

    return result;
}

function cronExpression(reminderHour) {
    const normalizedHour =
        normalizeReminderHour(
            reminderHour
        );

    const hourRange =
        normalizedHour === 23
            ? '23'
            : `${normalizedHour}-23`;

    return `*/5 ${hourRange} * * *`;
}

function startPrayerCovenantReminderScheduler({
    enabled = false,
    database = null,
    cron = null,
    now = () => new Date(),
    reminderHour = DEFAULT_REMINDER_HOUR,
    notificationCenter = NotificationCenter,
    dispatchEvent = null,
    logger = console
} = {}) {
    if (enabled !== true) {
        return {
            enabled:
                false,
            task:
                null,
            initialRun:
                Promise.resolve(
                    emptyResult({
                        status:
                            'disabled'
                    })
                )
        };
    }

    if (!validDatabase(database)) {
        throw new TypeError(
            'database is required'
        );
    }

    if (
        !cron ||
        typeof cron.schedule !== 'function'
    ) {
        throw new TypeError(
            'cron scheduler is required'
        );
    }

    if (typeof now !== 'function') {
        throw new TypeError(
            'now must be a function'
        );
    }

    const normalizedHour =
        normalizeReminderHour(
            reminderHour
        );

    let running =
        false;

    const tick =
        async () => {
            if (running) {
                return emptyResult({
                    status:
                        'overlap_skipped'
                });
            }

            running =
                true;

            try {
                const result =
                    await sweepPrayerCovenantReminders({
                        database,
                        now:
                            now(),
                        reminderHour:
                            normalizedHour,
                        notificationCenter,
                        dispatchEvent
                    });

                if (
                    logger &&
                    typeof logger.info === 'function'
                ) {
                    logger.info(
                        '[PRAYER_COVENANT_REMINDERS]',
                        result
                    );
                }

                return result;
            } catch (error) {
                const failed =
                    emptyResult({
                        status:
                            'failed'
                    });

                failed.errors = 1;

                if (
                    logger &&
                    typeof logger.error === 'function'
                ) {
                    logger.error(
                        '[PRAYER_COVENANT_REMINDERS] sweep failed',
                        error && error.code
                            ? error.code
                            : 'SWEEP_FAILED'
                    );
                }

                return failed;
            } finally {
                running =
                    false;
            }
        };

    const task =
        cron.schedule(
            cronExpression(
                normalizedHour
            ),
            () => {
                void tick();
            },
            {
                scheduled:
                    true,
                timezone:
                    TIME_ZONE
            }
        );

    return {
        enabled:
            true,
        task,
        tick,
        initialRun:
            tick()
    };
}

module.exports = Object.freeze({
    TIME_ZONE,
    DEFAULT_REMINDER_HOUR,
    PRAYER_COVENANT_TEMPLATE_CODE,
    NOTIFICATION_CATEGORY,
    NOTIFICATION_TITLE,
    NOTIFICATION_MESSAGE,
    getManilaClock,
    normalizeReminderHour,
    sweepPrayerCovenantReminders,
    startPrayerCovenantReminderScheduler
});
