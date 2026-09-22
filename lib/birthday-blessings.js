'use strict';

const {
    parseDateKey,
    manilaDateKey,
    birthdayOccursOn
} = require('./birthday-age-sync');

const TIMEZONE = 'Asia/Manila';

const PRESET_BLESSINGS = Object.freeze({
    god_bless_you: Object.freeze({
        key: 'god_bless_you',
        label: 'God Bless You',
        message:
            'Happy Birthday! God bless you always! 🙏🎂'
    }),

    joyful_year: Object.freeze({
        key: 'joyful_year',
        label: 'Joyful Year',
        message:
            'Praying for a joyful and blessed year ahead! ❤️'
    }),

    praying_for_you: Object.freeze({
        key: 'praying_for_you',
        label: 'Praying for You',
        message:
            'Happy Birthday! Praying that God continues to guide and strengthen you. 🙏'
    }),

    carry_the_light: Object.freeze({
        key: 'carry_the_light',
        label: 'Carry the Light',
        message:
            'Happy Birthday! Keep carrying His light and sharing His love! 🔥'
    })
});

const MONTH_NAMES = Object.freeze([
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
]);

function run(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.run(
                sql,
                params,
                function onRun(error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        changes:
                            Number(
                                this.changes || 0
                            ),
                        lastID:
                            Number(
                                this.lastID || 0
                            )
                    });
                }
            );
        }
    );
}

function get(
    database,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            database.get(
                sql,
                params,
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        row || null
                    );
                }
            );
        }
    );
}

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

function positiveInteger(
    value,
    label
) {
    const normalized =
        Number(value);

    if (
        !Number.isSafeInteger(
            normalized
        ) ||
        normalized <= 0
    ) {
        throw new TypeError(
            `${label} must be a positive integer`
        );
    }

    return normalized;
}

function normalizeBoolean(
    value,
    label
) {
    if (
        value === true ||
        value === 1 ||
        value === '1'
    ) {
        return true;
    }

    if (
        value === false ||
        value === 0 ||
        value === '0'
    ) {
        return false;
    }

    throw new TypeError(
        `${label} must be boolean`
    );
}

function normalizeDateKey(
    value
) {
    const parsed =
        parseDateKey(value);

    if (!parsed) {
        throw new TypeError(
            'Valid YYYY-MM-DD date required'
        );
    }

    return {
        dateKey: value,
        parsed
    };
}

function normalizeBlessingKey(
    value
) {
    if (
        typeof value !== 'string' ||
        !Object.prototype
            .hasOwnProperty.call(
                PRESET_BLESSINGS,
                value
            )
    ) {
        throw new RangeError(
            'Invalid Birthday Blessing preset'
        );
    }

    return value;
}

function birthdayLabel(
    birthday
) {
    const parsed =
        parseDateKey(birthday);

    if (!parsed) {
        return null;
    }

    const month =
        MONTH_NAMES[
            parsed.month - 1
        ];

    if (!month) {
        return null;
    }

    return (
        `${month} ${parsed.day}`
    );
}

/*
 * IMPORTANT PRIVACY BOUNDARY
 *
 * This serializer intentionally does NOT expose:
 * - full birthday
 * - birth year
 * - age
 *
 * Member-facing Birthday Blessings APIs should use this
 * projection rather than returning the youth DB row.
 */
function publicCelebrantProjection(
    member,
    blessingCount = 0
) {
    if (!member) {
        throw new TypeError(
            'Birthday celebrant is required'
        );
    }

    const id =
        positiveInteger(
            member.id,
            'celebrant ID'
        );

    const label =
        birthdayLabel(
            member.birthday
        );

    if (!label) {
        throw new TypeError(
            'Celebrant birthday is invalid'
        );
    }

    return {
        id,

        name:
            typeof member.name ===
                'string'
                ? member.name.trim()
                : '',

        profile_picture:
            typeof member
                .profile_picture ===
                'string' &&
            member
                .profile_picture
                .trim()
                ? member
                    .profile_picture
                    .trim()
                : null,

        birthday_label:
            label,

        blessing_count:
            Math.max(
                0,
                Number(
                    blessingCount
                ) || 0
            )
    };
}

function listPresetBlessings() {
    return Object.values(
        PRESET_BLESSINGS
    ).map(
        item => ({
            key:
                item.key,

            label:
                item.label,

            message:
                item.message
        })
    );
}

async function ensureSchema(
    database
) {
    await run(
        database,
        `
        CREATE TABLE IF NOT EXISTS
        birthday_celebration_preferences (
            youth_id INTEGER PRIMARY KEY,

            celebration_enabled INTEGER
                NOT NULL
                DEFAULT 1
                CHECK (
                    celebration_enabled
                    IN (0, 1)
                ),

            include_in_notifications INTEGER
                NOT NULL
                DEFAULT 1
                CHECK (
                    include_in_notifications
                    IN (0, 1)
                ),

            updated_at TEXT
                NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (youth_id)
                REFERENCES youth(id)
                ON DELETE CASCADE
        )
        `
    );

    await run(
        database,
        `
        CREATE TABLE IF NOT EXISTS
        birthday_blessings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            celebrant_youth_id INTEGER
                NOT NULL,

            sender_youth_id INTEGER
                NOT NULL,

            birthday_year INTEGER
                NOT NULL
                CHECK (
                    birthday_year >= 1900
                    AND birthday_year <= 2200
                ),

            blessing_key TEXT
                NOT NULL,

            created_at TEXT
                NOT NULL
                DEFAULT CURRENT_TIMESTAMP,

            FOREIGN KEY (
                celebrant_youth_id
            )
                REFERENCES youth(id)
                ON DELETE CASCADE,

            FOREIGN KEY (
                sender_youth_id
            )
                REFERENCES youth(id)
                ON DELETE CASCADE,

            UNIQUE (
                celebrant_youth_id,
                sender_youth_id,
                birthday_year
            )
        )
        `
    );

    await run(
        database,
        `
        CREATE INDEX IF NOT EXISTS
        birthday_blessings_celebrant_year_idx
        ON birthday_blessings (
            celebrant_youth_id,
            birthday_year,
            created_at
        )
        `
    );

    await run(
        database,
        `
        CREATE INDEX IF NOT EXISTS
        birthday_blessings_sender_idx
        ON birthday_blessings (
            sender_youth_id,
            created_at
        )
        `
    );
}

async function getPreference(
    database,
    youthId
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youth ID'
        );

    const row =
        await get(
            database,
            `
            SELECT
                youth_id,
                celebration_enabled,
                include_in_notifications,
                updated_at
            FROM
                birthday_celebration_preferences
            WHERE
                youth_id = ?
            LIMIT 1
            `,
            [
                normalizedYouthId
            ]
        );

    if (!row) {
        return {
            youth_id:
                normalizedYouthId,

            celebration_enabled:
                true,

            include_in_notifications:
                true,

            updated_at:
                null
        };
    }

    return {
        youth_id:
            normalizedYouthId,

        celebration_enabled:
            row
                .celebration_enabled ===
                1,

        include_in_notifications:
            row
                .include_in_notifications ===
                1,

        updated_at:
            row.updated_at || null
    };
}

async function setPreference(
    database,
    youthId,
    {
        celebrationEnabled,
        includeInNotifications
    } = {}
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youth ID'
        );

    const existing =
        await get(
            database,
            `
            SELECT id
            FROM youth
            WHERE id = ?
            LIMIT 1
            `,
            [
                normalizedYouthId
            ]
        );

    if (!existing) {
        const error =
            new Error(
                'Member not found'
            );

        error.code =
            'BIRTHDAY_MEMBER_NOT_FOUND';

        throw error;
    }

    const current =
        await getPreference(
            database,
            normalizedYouthId
        );

    const enabled =
        celebrationEnabled ===
            undefined
            ? current
                .celebration_enabled
            : normalizeBoolean(
                celebrationEnabled,
                'celebrationEnabled'
            );

    const notify =
        includeInNotifications ===
            undefined
            ? current
                .include_in_notifications
            : normalizeBoolean(
                includeInNotifications,
                'includeInNotifications'
            );

    await run(
        database,
        `
        INSERT INTO
            birthday_celebration_preferences (
                youth_id,
                celebration_enabled,
                include_in_notifications,
                updated_at
            )
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)

        ON CONFLICT (youth_id)
        DO UPDATE SET
            celebration_enabled =
                excluded.celebration_enabled,

            include_in_notifications =
                excluded.include_in_notifications,

            updated_at =
                CURRENT_TIMESTAMP
        `,
        [
            normalizedYouthId,
            enabled ? 1 : 0,
            notify ? 1 : 0
        ]
    );

    return getPreference(
        database,
        normalizedYouthId
    );
}

async function blessingCountForYear(
    database,
    celebrantYouthId,
    birthdayYear
) {
    const row =
        await get(
            database,
            `
            SELECT COUNT(*) AS count
            FROM birthday_blessings
            WHERE
                celebrant_youth_id = ?
                AND birthday_year = ?
            `,
            [
                celebrantYouthId,
                birthdayYear
            ]
        );

    return Number(
        row && row.count
            ? row.count
            : 0
    );
}

async function getCelebrantsForDate(
    database,
    dateKey
) {
    const {
        parsed
    } = normalizeDateKey(
        dateKey
    );

    const rows =
        await all(
            database,
            `
            SELECT
                y.id,
                y.name,
                y.birthday,
                y.profile_picture,

                COALESCE(
                    p.celebration_enabled,
                    1
                ) AS celebration_enabled

            FROM youth y

            LEFT JOIN
                birthday_celebration_preferences p
                ON p.youth_id = y.id

            WHERE
                y.birthday IS NOT NULL
                AND TRIM(y.birthday) <> ''
                AND COALESCE(
                    p.celebration_enabled,
                    1
                ) = 1

            ORDER BY
                y.name COLLATE NOCASE,
                y.id
            `
        );

    const result = [];

    for (const member of rows) {
        if (
            !birthdayOccursOn(
                member.birthday,
                dateKey
            )
        ) {
            continue;
        }

        const count =
            await blessingCountForYear(
                database,
                member.id,
                parsed.year
            );

        result.push(
            publicCelebrantProjection(
                member,
                count
            )
        );
    }

    return result;
}

async function getTodaysCelebrants(
    database,
    now = new Date()
) {
    return getCelebrantsForDate(
        database,
        manilaDateKey(now)
    );
}

function addDaysToDateKey(
    dateKey,
    days
) {
    const {
        parsed
    } = normalizeDateKey(
        dateKey
    );

    const offset =
        Number(days);

    if (
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 366
    ) {
        throw new RangeError(
            'Birthday calendar offset must be between 0 and 366 days'
        );
    }

    const value =
        new Date(
            Date.UTC(
                parsed.year,
                parsed.month - 1,
                parsed.day + offset
            )
        );

    return [
        value.getUTCFullYear(),
        String(
            value.getUTCMonth() + 1
        ).padStart(2, '0'),
        String(
            value.getUTCDate()
        ).padStart(2, '0')
    ].join('-');
}

async function getUpcomingCelebrants(
    database,
    {
        dateKey,
        days = 30
    } = {}
) {
    normalizeDateKey(
        dateKey
    );

    const normalizedDays =
        Number(days);

    if (
        !Number.isInteger(
            normalizedDays
        ) ||
        normalizedDays < 0 ||
        normalizedDays > 366
    ) {
        throw new RangeError(
            'Birthday calendar range must be between 0 and 366 days'
        );
    }

    const calendar = [];

    for (
        let offset = 0;
        offset <= normalizedDays;
        offset += 1
    ) {
        const targetDateKey =
            addDaysToDateKey(
                dateKey,
                offset
            );

        const celebrants =
            await getCelebrantsForDate(
                database,
                targetDateKey
            );

        if (
            celebrants.length === 0
        ) {
            continue;
        }

        calendar.push({
            offset,
            date_key:
                targetDateKey,
            celebrants
        });
    }

    return calendar;
}

async function getMonthCalendar(
    database,
    dateKey
) {
    const {
        parsed
    } = normalizeDateKey(
        dateKey
    );

    const daysInMonth =
        new Date(
            Date.UTC(
                parsed.year,
                parsed.month,
                0
            )
        ).getUTCDate();

    const calendar = [];

    for (
        let day = 1;
        day <= daysInMonth;
        day += 1
    ) {
        const targetDateKey = [
            parsed.year,
            String(
                parsed.month
            ).padStart(2, '0'),
            String(day)
                .padStart(2, '0')
        ].join('-');

        const celebrants =
            await getCelebrantsForDate(
                database,
                targetDateKey
            );

        calendar.push({
            date_key:
                targetDateKey,

            day,

            celebrants
        });
    }

    return {
        year:
            parsed.year,

        month:
            parsed.month,

        month_label:
            MONTH_NAMES[
                parsed.month - 1
            ],

        days:
            calendar
    };
}


async function getMissingBirthdayMembers(
    database
) {
    const rows =
        await all(
            database,
            `
            SELECT DISTINCT
                y.id,
                y.name
            FROM youth y

            JOIN users u
              ON u.youth_id = y.id

            WHERE
                y.birthday IS NULL
                OR TRIM(y.birthday) = ''

            ORDER BY
                y.name COLLATE NOCASE,
                y.id
            `
        );

    return rows.map(
        row => ({
            id:
                Number(row.id),

            name:
                typeof row.name ===
                    'string'
                    ? row.name.trim()
                    : ''
        })
    );
}

async function getBirthdayProfileStatus(
    database,
    youthId
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youth ID'
        );

    const member =
        await get(
            database,
            `
            SELECT
                id,
                name,
                birthday
            FROM youth
            WHERE id = ?
            LIMIT 1
            `,
            [
                normalizedYouthId
            ]
        );

    if (!member) {
        const error =
            new Error(
                'Member not found'
            );

        error.code =
            'BIRTHDAY_MEMBER_NOT_FOUND';

        throw error;
    }

    const preference =
        await getPreference(
            database,
            normalizedYouthId
        );

    return {
        youth_id:
            normalizedYouthId,

        has_birthday:
            Boolean(
                parseDateKey(
                    member.birthday
                )
            ),

        birthday_label:
            birthdayLabel(
                member.birthday
            ),

        celebration_enabled:
            preference
                .celebration_enabled,

        include_in_notifications:
            preference
                .include_in_notifications
    };
}

async function isBirthdayOnDate(
    database,
    youthId,
    dateKey
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youth ID'
        );

    normalizeDateKey(
        dateKey
    );

    const member =
        await get(
            database,
            `
            SELECT birthday
            FROM youth
            WHERE id = ?
            LIMIT 1
            `,
            [
                normalizedYouthId
            ]
        );

    return Boolean(
        member &&
        birthdayOccursOn(
            member.birthday,
            dateKey
        )
    );
}

async function getBlessingSenders(
    database,
    {
        celebrantYouthId,
        birthdayYear
    } = {}
) {
    const celebrantId =
        positiveInteger(
            celebrantYouthId,
            'celebrant youth ID'
        );

    const year =
        Number(
            birthdayYear
        );

    if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2200
    ) {
        throw new TypeError(
            'Valid birthday year required'
        );
    }

    const rows =
        await all(
            database,
            `
            SELECT
                b.sender_youth_id,
                b.blessing_key,
                b.created_at,
                y.name,
                y.profile_picture

            FROM birthday_blessings b

            JOIN youth y
              ON y.id =
                b.sender_youth_id

            WHERE
                b.celebrant_youth_id = ?
                AND b.birthday_year = ?

            ORDER BY
                b.created_at ASC,
                b.id ASC
            `,
            [
                celebrantId,
                year
            ]
        );

    return rows.map(
        row => ({
            id:
                Number(
                    row.sender_youth_id
                ),

            name:
                typeof row.name ===
                    'string'
                    ? row.name.trim()
                    : '',

            profile_picture:
                typeof row
                    .profile_picture ===
                    'string' &&
                row
                    .profile_picture
                    .trim()
                    ? row
                        .profile_picture
                        .trim()
                    : null,

            blessing_key:
                row.blessing_key,

            created_at:
                row.created_at
        })
    );
}

async function sendBlessing(
    database,
    {
        senderYouthId,
        celebrantYouthId,
        blessingKey,
        dateKey = manilaDateKey(
            new Date()
        )
    } = {}
) {
    const senderId =
        positiveInteger(
            senderYouthId,
            'sender youth ID'
        );

    const celebrantId =
        positiveInteger(
            celebrantYouthId,
            'celebrant youth ID'
        );

    if (
        senderId ===
        celebrantId
    ) {
        const error =
            new Error(
                'Members cannot send a Birthday Blessing to themselves'
            );

        error.code =
            'BIRTHDAY_SELF_BLESSING_NOT_ALLOWED';

        throw error;
    }

    const normalizedBlessingKey =
        normalizeBlessingKey(
            blessingKey
        );

    const {
        parsed
    } = normalizeDateKey(
        dateKey
    );

    const sender =
        await get(
            database,
            `
            SELECT id
            FROM youth
            WHERE id = ?
            LIMIT 1
            `,
            [
                senderId
            ]
        );

    if (!sender) {
        const error =
            new Error(
                'Sender member not found'
            );

        error.code =
            'BIRTHDAY_SENDER_NOT_FOUND';

        throw error;
    }

    const celebrant =
        await get(
            database,
            `
            SELECT
                y.id,
                y.name,
                y.birthday,
                y.profile_picture,

                COALESCE(
                    p.celebration_enabled,
                    1
                ) AS celebration_enabled

            FROM youth y

            LEFT JOIN
                birthday_celebration_preferences p
                ON p.youth_id = y.id

            WHERE
                y.id = ?
            LIMIT 1
            `,
            [
                celebrantId
            ]
        );

    if (!celebrant) {
        const error =
            new Error(
                'Birthday celebrant not found'
            );

        error.code =
            'BIRTHDAY_CELEBRANT_NOT_FOUND';

        throw error;
    }

    if (
        celebrant
            .celebration_enabled !==
        1
    ) {
        const error =
            new Error(
                'Birthday celebration is not available for this member'
            );

        error.code =
            'BIRTHDAY_CELEBRATION_DISABLED';

        throw error;
    }

    if (
        !birthdayOccursOn(
            celebrant.birthday,
            dateKey
        )
    ) {
        const error =
            new Error(
                'Birthday Blessings can only be sent on the celebrant’s birthday'
            );

        error.code =
            'BIRTHDAY_NOT_TODAY';

        throw error;
    }

    const existing =
        await get(
            database,
            `
            SELECT
                id,
                blessing_key
            FROM birthday_blessings
            WHERE
                celebrant_youth_id = ?
                AND sender_youth_id = ?
                AND birthday_year = ?
            LIMIT 1
            `,
            [
                celebrantId,
                senderId,
                parsed.year
            ]
        );

    /*
     * One Birthday Blessing per sender per
     * celebrant per birthday-year.
     *
     * Repeated taps remain idempotent. A member
     * may change the selected preset without
     * increasing the blessing count.
     */
    await run(
        database,
        `
        INSERT INTO birthday_blessings (
            celebrant_youth_id,
            sender_youth_id,
            birthday_year,
            blessing_key,
            created_at
        )
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)

        ON CONFLICT (
            celebrant_youth_id,
            sender_youth_id,
            birthday_year
        )
        DO UPDATE SET
            blessing_key =
                excluded.blessing_key
        `,
        [
            celebrantId,
            senderId,
            parsed.year,
            normalizedBlessingKey
        ]
    );

    const count =
        await blessingCountForYear(
            database,
            celebrantId,
            parsed.year
        );

    return {
        sent:
            !existing,

        updated:
            Boolean(existing),

        blessing_key:
            normalizedBlessingKey,

        blessing_count:
            count,

        celebrant:
            publicCelebrantProjection(
                celebrant,
                count
            )
    };
}

async function getMemberBlessingState(
    database,
    {
        senderYouthId,
        celebrantYouthId,
        birthdayYear
    } = {}
) {
    const senderId =
        positiveInteger(
            senderYouthId,
            'sender youth ID'
        );

    const celebrantId =
        positiveInteger(
            celebrantYouthId,
            'celebrant youth ID'
        );

    const year =
        Number(
            birthdayYear
        );

    if (
        !Number.isInteger(year) ||
        year < 1900 ||
        year > 2200
    ) {
        throw new TypeError(
            'Valid birthday year required'
        );
    }

    const row =
        await get(
            database,
            `
            SELECT
                blessing_key,
                created_at
            FROM birthday_blessings
            WHERE
                celebrant_youth_id = ?
                AND sender_youth_id = ?
                AND birthday_year = ?
            LIMIT 1
            `,
            [
                celebrantId,
                senderId,
                year
            ]
        );

    if (!row) {
        return {
            sent:
                false,

            blessing_key:
                null,

            created_at:
                null
        };
    }

    return {
        sent:
            true,

        blessing_key:
            row.blessing_key,

        created_at:
            row.created_at
    };
}

module.exports = {
    TIMEZONE,
    PRESET_BLESSINGS,

    ensureSchema,

    birthdayLabel,
    publicCelebrantProjection,
    listPresetBlessings,

    getPreference,
    setPreference,

    getCelebrantsForDate,
    getTodaysCelebrants,
    getUpcomingCelebrants,
    getMonthCalendar,
    getMissingBirthdayMembers,
    getBirthdayProfileStatus,
    isBirthdayOnDate,
    getBlessingSenders,

    sendBlessing,
    getMemberBlessingState,

    blessingCountForYear
};
