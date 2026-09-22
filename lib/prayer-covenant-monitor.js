'use strict';

const TIME_ZONE = 'Asia/Manila';
const TEMPLATE_CODE = 'prayer-covenant-21';
const EXPECTED_DURATION_DAYS = 21;

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(
            sql,
            params,
            (error, rows) => (
                error
                    ? reject(error)
                    : resolve(rows || [])
            )
        );
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(
            sql,
            params,
            (error, row) => (
                error
                    ? reject(error)
                    : resolve(row || null)
            )
        );
    });
}

function positiveInteger(value) {
    const number = Number(value);

    return (
        Number.isSafeInteger(number) &&
        number > 0
    )
        ? number
        : null;
}

function nonNegativeInteger(value) {
    const number = Number(value);

    return (
        Number.isSafeInteger(number) &&
        number >= 0
    )
        ? number
        : null;
}

function manilaDate(value = new Date()) {
    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    const formatter =
        new Intl.DateTimeFormat(
            'en-US',
            {
                timeZone: TIME_ZONE,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }
        );

    const parts = Object.fromEntries(
        formatter
            .formatToParts(date)
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyFromStored(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return manilaDate(value);
    }

    const text =
        String(value).trim();

    if (!text) {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    /*
     * SQLite/local Manila timestamps without an explicit zone are already
     * calendar-local. Preserve their date component rather than allowing
     * the host timezone to reinterpret them.
     */
    if (
        /^\d{4}-\d{2}-\d{2}[ T]/.test(text) &&
        !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)
    ) {
        return text.slice(0, 10);
    }

    return manilaDate(text);
}

function addDays(dateKey, amount) {
    if (
        typeof dateKey !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)
    ) {
        return null;
    }

    const date =
        new Date(`${dateKey}T00:00:00Z`);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    date.setUTCDate(
        date.getUTCDate() + Number(amount || 0)
    );

    return date
        .toISOString()
        .slice(0, 10);
}

function latestDate(...values) {
    const dates =
        values
            .filter(value =>
                typeof value === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(value)
            )
            .sort();

    return dates.length
        ? dates[dates.length - 1]
        : null;
}

function participantFromRow(row) {
    const youthId =
        positiveInteger(row.youth_id);

    const resolvedYouthId =
        positiveInteger(row.resolved_youth_id);

    const durationDays =
        positiveInteger(row.duration_days);

    const completedDays =
        nonNegativeInteger(row.completed_days);

    const status =
        typeof row.status === 'string'
            ? row.status.trim().toLowerCase()
            : '';

    const issues = [];

    if (!youthId) {
        issues.push('Invalid member reference');
    }

    if (!resolvedYouthId) {
        issues.push('Member record could not be resolved');
    }

    if (
        !['active', 'completed', 'paused']
            .includes(status)
    ) {
        issues.push('Unrecognized covenant status');
    }

    if (durationDays !== EXPECTED_DURATION_DAYS) {
        issues.push('Unexpected covenant duration');
    }

    if (
        completedDays === null ||
        (
            durationDays !== null &&
            completedDays > durationDays
        )
    ) {
        issues.push('Invalid completed prayer-day count');
    }

    if (
        status === 'completed' &&
        durationDays !== null &&
        completedDays !== durationDays
    ) {
        issues.push('Completed covenant has inconsistent progress');
    }

    if (
        status === 'active' &&
        durationDays !== null &&
        completedDays === durationDays
    ) {
        issues.push('Active covenant already has full progress');
    }

    const covenantLastDate =
        dateKeyFromStored(
            row.last_covenant_prayer_date
        );

    const rhythmLastDate =
        dateKeyFromStored(
            row.last_rhythm_prayer_date
        );

    const displayName =
        typeof row.full_name === 'string' &&
        row.full_name.trim()
            ? row.full_name.trim()
            : youthId
                ? `Unresolved member — Youth ID ${youthId}`
                : 'Unresolved member';

    return {
        enrollmentId:
            positiveInteger(row.enrollment_id),
        youthId,
        name:
            displayName,
        profilePicture:
            resolvedYouthId &&
            typeof row.profile_picture === 'string'
                ? row.profile_picture
                : null,
        status,
        startDate:
            dateKeyFromStored(
                row.started_at ||
                row.enrolled_at
            ),
        enrolledAt:
            row.enrolled_at || null,
        startedAt:
            row.started_at || null,
        pausedAt:
            row.paused_at || null,
        resumedAt:
            row.resumed_at || null,
        completedAt:
            row.completed_at || null,
        completedDays:
            completedDays === null
                ? 0
                : completedDays,
        durationDays:
            durationDays ||
            EXPECTED_DURATION_DAYS,
        lastRecordedPrayerDate:
            latestDate(
                covenantLastDate,
                rhythmLastDate
            ),
        prayedToday:
            Number(row.prayed_today) === 1,
        dataIssue:
            issues.length > 0,
        dataIssueReasons:
            issues
    };
}

function emptySummary() {
    return {
        activeParticipants: 0,
        prayedToday: 0,
        notYetToday: 0,
        completedJourneys: 0,
        paused: 0,
        dataIssues: 0
    };
}

async function getMonitorSummary(
    db,
    {
        now = new Date()
    } = {}
) {
    if (!db) {
        throw new TypeError('database is required');
    }

    const today =
        manilaDate(now);

    if (!today) {
        throw new TypeError('A valid monitor time is required');
    }

    const template =
        await get(
            db,
            `SELECT
                id,
                template_code,
                title,
                duration_days,
                is_active,
                is_paused
             FROM growth_onboarding_templates
             WHERE template_code = ?
             LIMIT 1`,
            [TEMPLATE_CODE]
        );

    if (!template) {
        return {
            asOfDate: today,
            template: null,
            summary: emptySummary(),
            participants: [],
            dataReview: []
        };
    }

    const rows =
        await all(
            db,
            `SELECT
                enrollment.id AS enrollment_id,
                enrollment.youth_id,
                enrollment.status,
                enrollment.enrolled_at,
                enrollment.started_at,
                enrollment.paused_at,
                enrollment.resumed_at,
                enrollment.completed_at,
                enrollment.completed_days,
                template.duration_days,
                youth.id AS resolved_youth_id,
                youth.name AS full_name,
                youth.profile_picture,
                (
                    SELECT MAX(completion.completion_date)
                    FROM growth_onboarding_daily_completions completion
                    WHERE completion.enrollment_id = enrollment.id
                ) AS last_covenant_prayer_date,
                (
                    SELECT MAX(rhythm.prayer_date)
                    FROM growth_prayer_rhythm_days rhythm
                    WHERE rhythm.youth_id = enrollment.youth_id
                ) AS last_rhythm_prayer_date,
                CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM growth_prayer_rhythm_days rhythm_today
                        WHERE rhythm_today.youth_id = enrollment.youth_id
                          AND rhythm_today.prayer_date = ?
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM growth_onboarding_daily_completions completion_today
                        WHERE completion_today.enrollment_id = enrollment.id
                          AND completion_today.completion_date = ?
                    )
                    THEN 1
                    ELSE 0
                END AS prayed_today
             FROM growth_onboarding_enrollments enrollment
             JOIN growth_onboarding_templates template
               ON template.id = enrollment.template_id
             LEFT JOIN youth
               ON youth.id = enrollment.youth_id
             WHERE template.template_code = ?
             ORDER BY enrollment.id ASC`,
            [
                today,
                today,
                TEMPLATE_CODE
            ]
        );

    const participants = [];
    const dataReview = [];
    const summary =
        emptySummary();

    for (const row of rows) {
        const participant =
            participantFromRow(row);

        if (participant.dataIssue) {
            summary.dataIssues += 1;
            dataReview.push(participant);
            continue;
        }

        participants.push(participant);

        if (participant.status === 'active') {
            summary.activeParticipants += 1;

            if (participant.prayedToday) {
                summary.prayedToday += 1;
            } else {
                summary.notYetToday += 1;
            }
        } else if (
            participant.status === 'completed'
        ) {
            summary.completedJourneys += 1;
        } else if (
            participant.status === 'paused'
        ) {
            summary.paused += 1;
        }
    }

    participants.sort(
        (left, right) =>
            left.name.localeCompare(
                right.name,
                undefined,
                {
                    sensitivity: 'base'
                }
            )
    );

    dataReview.sort(
        (left, right) =>
            (
                left.youthId ||
                Number.MAX_SAFE_INTEGER
            ) -
            (
                right.youthId ||
                Number.MAX_SAFE_INTEGER
            )
    );

    return {
        asOfDate:
            today,
        template: {
            id:
                positiveInteger(template.id),
            code:
                template.template_code,
            title:
                template.title ||
                '21-Day Prayer Covenant',
            durationDays:
                positiveInteger(
                    template.duration_days
                ) ||
                EXPECTED_DURATION_DAYS,
            active:
                Number(template.is_active) === 1,
            paused:
                Number(template.is_paused) === 1
        },
        summary,
        participants,
        dataReview
    };
}

function calculateStreaks(
    recordedDates,
    today
) {
    const dates =
        [...new Set(
            recordedDates.filter(date =>
                typeof date === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(date)
            )
        )].sort();

    if (!dates.length) {
        return {
            current: 0,
            longest: 0
        };
    }

    let longest = 1;
    let running = 1;

    for (
        let index = 1;
        index < dates.length;
        index += 1
    ) {
        if (
            dates[index] ===
            addDays(dates[index - 1], 1)
        ) {
            running += 1;
            longest =
                Math.max(longest, running);
        } else {
            running = 1;
        }
    }

    const latest =
        dates[dates.length - 1];

    const yesterday =
        addDays(today, -1);

    if (
        latest !== today &&
        latest !== yesterday
    ) {
        return {
            current: 0,
            longest
        };
    }

    let current = 1;

    for (
        let index = dates.length - 1;
        index > 0;
        index -= 1
    ) {
        if (
            dates[index - 1] ===
            addDays(dates[index], -1)
        ) {
            current += 1;
        } else {
            break;
        }
    }

    return {
        current,
        longest
    };
}

function buildCalendar(
    startDate,
    endDate,
    recordedDates
) {
    if (
        !startDate ||
        !endDate ||
        endDate < startDate
    ) {
        return [];
    }

    const recorded =
        new Set(recordedDates);

    const calendar = [];
    let cursor =
        startDate;

    /*
     * This is a detail endpoint for one enrollment, not a bulk payload.
     * The safety ceiling prevents corrupted dates from producing an
     * unbounded response while still allowing nearly 11 years of history.
     */
    const MAX_CALENDAR_DAYS = 4000;

    while (
        cursor &&
        cursor <= endDate &&
        calendar.length < MAX_CALENDAR_DAYS
    ) {
        const prayed =
            recorded.has(cursor);

        calendar.push({
            date:
                cursor,
            prayed,
            label:
                prayed
                    ? 'Prayer recorded'
                    : 'No prayer recorded'
        });

        cursor =
            addDays(cursor, 1);
    }

    return calendar;
}

async function getMonitorDetail(
    db,
    enrollmentId,
    {
        now = new Date()
    } = {}
) {
    if (!db) {
        throw new TypeError('database is required');
    }

    const normalizedEnrollmentId =
        positiveInteger(enrollmentId);

    if (!normalizedEnrollmentId) {
        throw new TypeError(
            'A positive enrollmentId is required'
        );
    }

    const today =
        manilaDate(now);

    if (!today) {
        throw new TypeError(
            'A valid monitor time is required'
        );
    }

    const row =
        await get(
            db,
            `SELECT
                enrollment.id AS enrollment_id,
                enrollment.youth_id,
                enrollment.status,
                enrollment.enrolled_at,
                enrollment.started_at,
                enrollment.paused_at,
                enrollment.resumed_at,
                enrollment.completed_at,
                enrollment.completed_days,
                template.duration_days,
                template.title AS template_title,
                template.is_active AS template_is_active,
                template.is_paused AS template_is_paused,
                youth.id AS resolved_youth_id,
                youth.name AS full_name,
                youth.profile_picture,
                NULL AS last_covenant_prayer_date,
                NULL AS last_rhythm_prayer_date,
                0 AS prayed_today
             FROM growth_onboarding_enrollments enrollment
             JOIN growth_onboarding_templates template
               ON template.id = enrollment.template_id
             LEFT JOIN youth
               ON youth.id = enrollment.youth_id
             WHERE enrollment.id = ?
               AND template.template_code = ?
             LIMIT 1`,
            [
                normalizedEnrollmentId,
                TEMPLATE_CODE
            ]
        );

    if (!row) {
        return null;
    }

    const completionRows =
        await all(
            db,
            `SELECT
                id,
                completion_date,
                day_number,
                source_key,
                completed_at
             FROM growth_onboarding_daily_completions
             WHERE enrollment_id = ?
             ORDER BY day_number ASC,
                      completion_date ASC,
                      id ASC`,
            [normalizedEnrollmentId]
        );

    const youthId =
        positiveInteger(row.youth_id);

    const rhythmRows =
        youthId
            ? await all(
                db,
                `SELECT
                    prayer_date,
                    source_key
                 FROM growth_prayer_rhythm_days
                 WHERE youth_id = ?
                 ORDER BY prayer_date ASC,
                          id ASC`,
                [youthId]
            )
            : [];

    const normalized =
        participantFromRow({
            ...row,
            last_covenant_prayer_date:
                completionRows.length
                    ? completionRows[
                        completionRows.length - 1
                    ].completion_date
                    : null,
            last_rhythm_prayer_date:
                rhythmRows.length
                    ? rhythmRows[
                        rhythmRows.length - 1
                    ].prayer_date
                    : null,
            prayed_today:
                (
                    completionRows.some(
                        completion =>
                            dateKeyFromStored(
                                completion.completion_date
                            ) === today
                    ) ||
                    rhythmRows.some(
                        rhythm =>
                            dateKeyFromStored(
                                rhythm.prayer_date
                            ) === today
                    )
                )
                    ? 1
                    : 0
        });

    const durationDays =
        normalized.durationDays;

    const completionsByDay =
        new Map();

    const detailIssues =
        [...normalized.dataIssueReasons];

    for (const completion of completionRows) {
        const dayNumber =
            positiveInteger(
                completion.day_number
            );

        if (
            !dayNumber ||
            dayNumber > durationDays
        ) {
            detailIssues.push(
                'Prayer-day history contains an invalid day number'
            );
            continue;
        }

        if (!completionsByDay.has(dayNumber)) {
            completionsByDay.set(
                dayNumber,
                completion
            );
        } else {
            detailIssues.push(
                'Prayer-day history contains a duplicate day number'
            );
        }
    }

    const days = [];

    for (
        let dayNumber = 1;
        dayNumber <= durationDays;
        dayNumber += 1
    ) {
        const completion =
            completionsByDay.get(dayNumber);

        days.push({
            dayNumber,
            completed:
                Boolean(completion),
            completionDate:
                completion
                    ? dateKeyFromStored(
                        completion.completion_date
                    )
                    : null,
            completedAt:
                completion
                    ? (
                        completion.completed_at ||
                        null
                    )
                    : null
        });
    }

    const completionDates =
        completionRows
            .map(completion =>
                dateKeyFromStored(
                    completion.completion_date
                )
            )
            .filter(Boolean);

    const rhythmDates =
        rhythmRows
            .map(rhythm =>
                dateKeyFromStored(
                    rhythm.prayer_date
                )
            )
            .filter(Boolean);

    /*
     * For historical records, either canonical source is accepted as real
     * evidence that prayer occurred. No synthetic prayer days are created.
     */
    const recordedDates =
        [...new Set([
            ...completionDates,
            ...rhythmDates
        ])].sort();

    const firstRecordedDate =
        recordedDates.length
            ? recordedDates[0]
            : null;

    const startDate =
        normalized.startDate ||
        firstRecordedDate;

    let endDate =
        today;

    if (normalized.status === 'completed') {
        endDate =
            dateKeyFromStored(
                normalized.completedAt
            ) ||
            completionDates[
                completionDates.length - 1
            ] ||
            today;
    } else if (
        normalized.status === 'paused'
    ) {
        endDate =
            dateKeyFromStored(
                normalized.pausedAt
            ) ||
            today;
    }

    const calendar =
        buildCalendar(
            startDate,
            endDate,
            recordedDates
        );

    const streaks =
        calculateStreaks(
            recordedDates,
            today
        );

    return {
        asOfDate:
            today,
        enrollmentId:
            normalized.enrollmentId,
        youthId:
            normalized.youthId,
        member:
            positiveInteger(
                row.resolved_youth_id
            )
                ? {
                    id:
                        positiveInteger(
                            row.resolved_youth_id
                        ),
                    name:
                        normalized.name,
                    profilePicture:
                        normalized.profilePicture
                }
                : null,
        displayName:
            normalized.name,
        status:
            normalized.status,
        startDate,
        enrolledAt:
            normalized.enrolledAt,
        startedAt:
            normalized.startedAt,
        pausedAt:
            normalized.pausedAt,
        resumedAt:
            normalized.resumedAt,
        completedAt:
            normalized.completedAt,
        completedPrayerDays:
            normalized.completedDays,
        durationDays,
        lastRecordedPrayerDate:
            recordedDates.length
                ? recordedDates[
                    recordedDates.length - 1
                ]
                : null,
        prayedToday:
            recordedDates.includes(today),
        currentCalendarStreak:
            streaks.current,
        longestCalendarStreak:
            streaks.longest,
        days,
        calendar,
        noPrayerDates:
            calendar
                .filter(day => !day.prayed)
                .map(day => day.date),
        dataIssue:
            detailIssues.length > 0,
        dataIssueReasons:
            [...new Set(detailIssues)]
    };
}

module.exports = Object.freeze({
    TIME_ZONE,
    TEMPLATE_CODE,
    EXPECTED_DURATION_DAYS,
    manilaDate,
    dateKeyFromStored,
    getMonitorSummary,
    getMonitorDetail
});
