'use strict';

const BirthdayBlessings =
    require('./birthday-blessings');

const NotificationCenter =
    require('./notification-center');

const {
    manilaDateKey
} = require('./birthday-age-sync');

const TIMEZONE =
    'Asia/Manila';

const CRON_EXPRESSION =
    '0 7 * * *';

function all(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.all(
                sql,
                params,
                (error, rows) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        rows || []
                    );
                }
            );
        }
    );
}

function manilaHour(
    now
) {
    const formatter =
        new Intl.DateTimeFormat(
            'en-US',
            {
                timeZone:
                    TIMEZONE,

                hour:
                    '2-digit',

                hourCycle:
                    'h23'
            }
        );

    return Number(
        formatter.format(
            now
        )
    );
}

async function notificationRecipients(
    database
) {
    /*
     * Birthday notifications are sent only to actual
     * Portal-linked member accounts.
     *
     * Birthday-specific notification opt-out and the
     * canonical Membership & Community preference are
     * both respected.
     *
     * There is currently no canonical account-level
     * active/deactivated column in users or youth.
     * Do not infer inactivity from account_tier or
     * ministry roles.
     */
    const rows =
        await all(
            database,
            `
            SELECT DISTINCT
                u.youth_id

            FROM users u

            JOIN youth y
              ON y.id =
                u.youth_id

            LEFT JOIN
                birthday_celebration_preferences bp
              ON bp.youth_id =
                y.id

            LEFT JOIN
                notification_preferences np
              ON np.youth_id =
                y.id

            WHERE
                u.youth_id IS NOT NULL

                AND COALESCE(
                    bp.include_in_notifications,
                    1
                ) = 1

                AND COALESCE(
                    np.membership_community,
                    1
                ) = 1

            ORDER BY
                u.youth_id
            `
        );

    return rows
        .map(
            row =>
                Number(
                    row.youth_id
                )
        )
        .filter(
            value =>
                Number.isSafeInteger(
                    value
                ) &&
                value > 0
        );
}

function notificationCopy(
    celebrants
) {
    const names =
        celebrants
            .map(
                celebrant =>
                    celebrant.name
            )
            .filter(Boolean);

    if (
        names.length === 1
    ) {
        return {
            title:
                '🎂 Birthday Blessing Today!',

            message:
                `Today we celebrate ${names[0]}! ` +
                'Open Birthday Blessings to share a blessing and celebrate together.'
        };
    }

    if (
        names.length === 2
    ) {
        return {
            title:
                '🎉 Two Birthdays Today!',

            message:
                `Today we celebrate ${names[0]} and ${names[1]}! ` +
                'Open Birthday Blessings and help make their day special.'
        };
    }

    if (
        names.length === 3
    ) {
        return {
            title:
                '🎉 Birthday Celebrations Today!',

            message:
                `Today we celebrate ${names[0]}, ${names[1]}, and ${names[2]}! ` +
                'Open Birthday Blessings to celebrate with them.'
        };
    }

    return {
        title:
            '🎉 Birthday Celebrations Today!',

        message:
            `Today we celebrate ${names.length} members of our FOG family! ` +
            'Open Birthday Blessings to see today’s celebrants and share a blessing.'
    };
}

async function runDailyBirthdayNotification({
    database,
    dateKey,
    dispatchEvent = null
} = {}) {
    if (!database) {
        throw new TypeError(
            'Birthday notification database is required'
        );
    }

    const celebrants =
        await BirthdayBlessings
            .getCelebrantsForDate(
                database,
                dateKey
            );

    if (
        celebrants.length === 0
    ) {
        return {
            eligible:
                false,

            reason:
                'no_birthdays',

            dateKey,

            celebrantCount:
                0,

            recipientCount:
                0,

            created:
                false,

            eventId:
                null
        };
    }

    const recipients =
        await notificationRecipients(
            database
        );

    if (
        recipients.length === 0
    ) {
        return {
            eligible:
                false,

            reason:
                'no_recipients',

            dateKey,

            celebrantCount:
                celebrants.length,

            recipientCount:
                0,

            created:
                false,

            eventId:
                null
        };
    }

    const copy =
        notificationCopy(
            celebrants
        );

    const eventKey =
        `birthday-blessings:daily:${dateKey}:v1`;

    const result =
        await NotificationCenter
            .createNotification(
                database,
                {
                    eventKey,

                    category:
                        'membership_community',

                    title:
                        copy.title,

                    message:
                        copy.message,

                    importance:
                        'normal',

                    actionUrl:
                        '/?birthday=1',

                    sourceType:
                        'birthday_blessings',

                    sourceActor:
                        'FOG Community Portal',

                    metadata: {
                        feature:
                            'birthday_blessings',

                        date_key:
                            dateKey,

                        celebrant_count:
                            celebrants.length,

                        celebrant_ids:
                            celebrants.map(
                                celebrant =>
                                    celebrant.id
                            )
                    },

                    recipientYouthIds:
                        recipients
                }
            );

    const created =
        result.eventInserted ===
        true;

    if (
        created &&
        typeof dispatchEvent ===
            'function'
    ) {
        await dispatchEvent(
            result.eventId
        );
    }

    return {
        eligible:
            true,

        reason:
            created
                ? 'created'
                : 'already_created',

        dateKey,

        celebrantCount:
            celebrants.length,

        recipientCount:
            recipients.length,

        created,

        eventId:
            result.eventId,

        eventKey:
            result.eventKey
    };
}

function startScheduler({
    enabled,
    database,
    cron,
    dispatchEvent,
    logger = console,
    now = () => new Date()
} = {}) {
    if (
        enabled !== true
    ) {
        return {
            enabled:
                false,

            task:
                null,

            trigger:
                null
        };
    }

    if (
        !database
    ) {
        throw new TypeError(
            'Birthday notification database is required'
        );
    }

    if (
        !cron ||
        typeof cron.schedule !==
            'function'
    ) {
        throw new TypeError(
            'Birthday cron scheduler is required'
        );
    }

    let running =
        null;

    function trigger(
        reason
    ) {
        if (running) {
            return running;
        }

        const current =
            now();

        const dateKey =
            manilaDateKey(
                current
            );

        running =
            runDailyBirthdayNotification({
                database,
                dateKey,
                dispatchEvent
            })
                .then(
                    result => {
                        logger.log(
                            '[BIRTHDAY BLESSINGS]',
                            reason,
                            `date=${dateKey}`,
                            `celebrants=${result.celebrantCount}`,
                            `recipients=${result.recipientCount}`,
                            `result=${result.reason}`
                        );

                        return result;
                    }
                )
                .catch(
                    error => {
                        logger.error(
                            '[BIRTHDAY BLESSINGS] notification failed',
                            error &&
                            error.message
                                ? error.message
                                : error
                        );

                        throw error;
                    }
                )
                .finally(
                    () => {
                        running =
                            null;
                    }
                );

        return running;
    }

    const current =
        now();

    /*
     * If the server starts/restarts after 7:00 AM
     * Manila time, perform a same-day catch-up.
     *
     * event_key uniqueness makes this replay-safe.
     */
    if (
        manilaHour(
            current
        ) >= 7
    ) {
        void trigger(
            'startup-catchup'
        ).catch(
            () => null
        );
    }

    const task =
        cron.schedule(
            CRON_EXPRESSION,
            () => {
                void trigger(
                    '07:00'
                ).catch(
                    () => null
                );
            },
            {
                timezone:
                    TIMEZONE
            }
        );

    return {
        enabled:
            true,

        task,
        trigger
    };
}

module.exports =
    Object.freeze({
        TIMEZONE,
        CRON_EXPRESSION,
        manilaHour,
        notificationCopy,
        notificationRecipients,
        runDailyBirthdayNotification,
        startScheduler
    });
