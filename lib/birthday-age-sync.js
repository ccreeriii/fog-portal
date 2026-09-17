'use strict';

const TIMEZONE = 'Asia/Manila';
const SETTING_KEY = 'birthday_age_sync_last_date';

function parseDateKey(value) {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return null;
    }

    const [year, month, day] =
        value.split('-').map(Number);

    const check =
        new Date(
            Date.UTC(year, month - 1, day)
        );

    if (
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() + 1 !== month ||
        check.getUTCDate() !== day
    ) {
        return null;
    }

    return { year, month, day };
}

function manilaDateKey(value = new Date()) {
    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new TypeError('Valid date required');
    }

    const parts = new Intl.DateTimeFormat(
        'en-CA',
        {
            timeZone: TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    ).formatToParts(date);

    const result = {};

    for (const part of parts) {
        if (
            part.type === 'year' ||
            part.type === 'month' ||
            part.type === 'day'
        ) {
            result[part.type] = part.value;
        }
    }

    return (
        `${result.year}-${result.month}-${result.day}`
    );
}

function addDays(key, days) {
    const parsed = parseDateKey(key);

    if (!parsed || !Number.isInteger(days)) {
        throw new TypeError(
            'Valid date and integer offset required'
        );
    }

    const date =
        new Date(
            Date.UTC(
                parsed.year,
                parsed.month - 1,
                parsed.day
            )
        );

    date.setUTCDate(
        date.getUTCDate() + days
    );

    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1)
            .padStart(2, '0'),
        String(date.getUTCDate())
            .padStart(2, '0')
    ].join('-');
}

function leapYear(year) {
    return (
        year % 4 === 0 &&
        (
            year % 100 !== 0 ||
            year % 400 === 0
        )
    );
}

function birthdayOccursOn(
    birthday,
    dateKey
) {
    const birth = parseDateKey(birthday);
    const target = parseDateKey(dateKey);

    if (!birth || !target) return false;

    if (
        birth.month === target.month &&
        birth.day === target.day
    ) {
        return true;
    }

    /*
     * Feb 29 birthdays advance on March 1
     * during non-leap years.
     */
    return (
        birth.month === 2 &&
        birth.day === 29 &&
        target.month === 3 &&
        target.day === 1 &&
        !leapYear(target.year)
    );
}

function calculateAge(
    birthday,
    dateKey
) {
    const birth = parseDateKey(birthday);
    const target = parseDateKey(dateKey);

    if (!birth || !target) return null;

    let age =
        target.year - birth.year;

    if (
        target.month < birth.month ||
        (
            target.month === birth.month &&
            target.day < birth.day
        )
    ) {
        age -= 1;
    }

    /*
     * March 1 in a non-leap year is already
     * after Feb 29 in the comparison above.
     */

    if (
        !Number.isInteger(age) ||
        age < 0 ||
        age > 130
    ) {
        return null;
    }

    return age;
}

function dbGet(
    database,
    sql,
    params = []
) {
    return new Promise((resolve, reject) => {
        database.get(
            sql,
            params,
            (error, row) =>
                error
                    ? reject(error)
                    : resolve(row || null)
        );
    });
}

function dbAll(
    database,
    sql,
    params = []
) {
    return new Promise((resolve, reject) => {
        database.all(
            sql,
            params,
            (error, rows) =>
                error
                    ? reject(error)
                    : resolve(rows || [])
        );
    });
}

function dbRun(
    database,
    sql,
    params = []
) {
    return new Promise((resolve, reject) => {
        database.run(
            sql,
            params,
            function(error) {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({
                    changes: this.changes,
                    lastID: this.lastID
                });
            }
        );
    });
}

async function syncBirthdayDate({
    database,
    dateKey,
    onUpdate
}) {
    if (!parseDateKey(dateKey)) {
        throw new TypeError(
            'Valid YYYY-MM-DD date required'
        );
    }

    const members =
        await dbAll(
            database,
            `
            SELECT id, age, birthday
            FROM youth
            WHERE birthday IS NOT NULL
              AND TRIM(birthday) <> ''
            ORDER BY id
            `
        );

    let updated = 0;

    for (const member of members) {
        if (
            !birthdayOccursOn(
                member.birthday,
                dateKey
            )
        ) {
            continue;
        }

        const correctAge =
            calculateAge(
                member.birthday,
                dateKey
            );

        if (correctAge === null) {
            continue;
        }

        const previousAge =
            member.age === null ||
            member.age === undefined
                ? null
                : Number(member.age);

        if (
            Number.isFinite(previousAge) &&
            previousAge === correctAge
        ) {
            continue;
        }

        const result =
            await dbRun(
                database,
                `
                UPDATE youth
                SET age = ?
                WHERE id = ?
                `,
                [
                    correctAge,
                    member.id
                ]
            );

        if (result.changes !== 1) {
            throw new Error(
                `Unable to update member ${member.id}`
            );
        }

        updated += 1;

        if (typeof onUpdate === 'function') {
            await onUpdate({
                youthId: Number(member.id),
                previousAge:
                    Number.isFinite(previousAge)
                        ? previousAge
                        : null,
                newAge: correctAge,
                dateKey
            });
        }
    }

    return updated;
}

async function runCatchUp({
    database,
    now = new Date(),
    onUpdate,
    logger = console
}) {
    const today = manilaDateKey(now);

    const stored =
        await dbGet(
            database,
            `
            SELECT value
            FROM app_settings
            WHERE key = ?
            `,
            [SETTING_KEY]
        );

    const previous =
        stored &&
        parseDateKey(stored.value)
            ? stored.value
            : null;

    let dates = [];

    if (!previous) {
        /*
         * First installation:
         * only today's birthday is processed.
         * Existing historical ages are not
         * rewritten in bulk.
         */
        dates = [today];
    } else if (previous < today) {
        let cursor =
            addDays(previous, 1);

        /*
         * Bound catch-up to 370 days.
         */
        const earliest =
            addDays(today, -369);

        if (cursor < earliest) {
            cursor = earliest;
        }

        while (cursor <= today) {
            dates.push(cursor);
            cursor = addDays(cursor, 1);
        }
    } else if (previous > today) {
        dates = [today];

        if (
            logger &&
            typeof logger.warn === 'function'
        ) {
            logger.warn(
                '[BIRTHDAY AGE] Future date marker detected.'
            );
        }
    }

    let updated = 0;

    for (const dateKey of dates) {
        updated +=
            await syncBirthdayDate({
                database,
                dateKey,
                onUpdate
            });
    }

    await dbRun(
        database,
        `
        INSERT OR REPLACE
        INTO app_settings (key, value)
        VALUES (?, ?)
        `,
        [
            SETTING_KEY,
            today
        ]
    );

    return {
        today,
        previous,
        datesProcessed: dates.length,
        updated
    };
}

function startScheduler({
    database,
    cron,
    logger = console,
    onUpdate
}) {
    if (
        !cron ||
        typeof cron.schedule !== 'function'
    ) {
        throw new TypeError(
            'cron scheduler required'
        );
    }

    let running = null;

    function trigger(reason) {
        if (running) return running;

        running =
            runCatchUp({
                database,
                onUpdate,
                logger
            })
                .then(result => {
                    if (
                        logger &&
                        typeof logger.info ===
                            'function'
                    ) {
                        logger.info(
                            `[BIRTHDAY AGE] ${reason} date=${result.today} days=${result.datesProcessed} updated=${result.updated}`
                        );
                    }

                    return result;
                })
                .catch(error => {
                    if (
                        logger &&
                        typeof logger.error ===
                            'function'
                    ) {
                        logger.error(
                            '[BIRTHDAY AGE] sync failed code=BIRTHDAY_AGE_SYNC_FAILED'
                        );
                    }

                    return null;
                })
                .finally(() => {
                    running = null;
                });

        return running;
    }

    /*
     * Startup catch-up covers birthdays missed
     * while the Raspberry Pi/server was offline.
     */
    void trigger('startup');

    const task =
        cron.schedule(
            '0 0 * * *',
            () => {
                void trigger('midnight');
            },
            {
                timezone: TIMEZONE
            }
        );

    return {
        task,
        trigger
    };
}

module.exports = {
    TIMEZONE,
    SETTING_KEY,
    parseDateKey,
    manilaDateKey,
    birthdayOccursOn,
    calculateAge,
    syncBirthdayDate,
    runCatchUp,
    startScheduler
};
