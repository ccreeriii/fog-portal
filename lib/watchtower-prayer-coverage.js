'use strict';

const NotificationCenter =
    require('./notification-center');

const TIME_ZONE =
    'Asia/Manila';

const DEFAULT_OPEN_HOUR =
    22;

const DEFAULT_REPORT_HOUR =
    0;

const DEFAULT_CLAIM_MINUTES =
    15;

const WATCHTOWER_PERMISSION =
    'access_prayer';

const mutationQueues =
    new WeakMap();

function run(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.run(
                sql,
                params,
                function (error) {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve({
                        lastID:
                            this.lastID,
                        changes:
                            this.changes
                    });
                }
            );
        }
    );
}

function get(
    db,
    sql,
    params = []
) {
    return new Promise(
        (resolve, reject) => {
            db.get(
                sql,
                params,
                (error, row) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(row || null);
                }
            );
        }
    );
}

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

function requireDatabase(database) {
    if (
        !database ||
        typeof database.run !== 'function' ||
        typeof database.get !== 'function' ||
        typeof database.all !== 'function'
    ) {
        throw new TypeError(
            'database is required'
        );
    }
}

function positiveInteger(value, label) {
    const normalized =
        Number(value);

    if (
        !Number.isSafeInteger(normalized) ||
        normalized <= 0
    ) {
        throw watchtowerError(
            'INVALID_ID',
            `${label} must be a positive integer`
        );
    }

    return normalized;
}

function watchtowerError(code, message) {
    return Object.assign(
        new Error(message),
        {
            code
        }
    );
}

function normalizeInteger(
    value,
    fallback,
    minimum,
    maximum
) {
    const normalized =
        value === null ||
        value === undefined ||
        value === ''
            ? fallback
            : Number(value);

    return (
        Number.isSafeInteger(normalized) &&
        normalized >= minimum &&
        normalized <= maximum
    )
        ? normalized
        : fallback;
}

function normalizeConfig({
    openHour = DEFAULT_OPEN_HOUR,
    reportHour = DEFAULT_REPORT_HOUR,
    claimMinutes = DEFAULT_CLAIM_MINUTES
} = {}) {
    const normalizedOpen =
        normalizeInteger(
            openHour,
            DEFAULT_OPEN_HOUR,
            0,
            22
        );

    const normalizedReport =
        normalizeInteger(
            reportHour,
            DEFAULT_REPORT_HOUR,
            0,
            23
        );

    /*
     * reportHour === 0 represents a Watchtower window that
     * crosses Manila midnight:
     *
     *   OPEN  : 22:00:00 through 23:59:59
     *   CLOSE : 00:00:00
     *
     * The report generated after midnight belongs to the
     * preceding Manila calendar date.
     */
    const validWindow =
        normalizedReport === 0
            ? normalizedOpen > 0
            : normalizedOpen <
                normalizedReport;

    return {
        openHour:
            validWindow
                ? normalizedOpen
                : DEFAULT_OPEN_HOUR,
        reportHour:
            validWindow
                ? normalizedReport
                : DEFAULT_REPORT_HOUR,
        claimMinutes:
            normalizeInteger(
                claimMinutes,
                DEFAULT_CLAIM_MINUTES,
                1,
                120
            )
    };
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
                minute:
                    '2-digit',
                hourCycle:
                    'h23'
            }
        )
            .formatToParts(date)
            .reduce(
                (result, part) => {
                    if (part.type !== 'literal') {
                        result[part.type] =
                            part.value;
                    }

                    return result;
                },
                {}
            );

    return {
        date:
            new Date(date.getTime()),
        iso:
            date.toISOString(),
        dateKey:
            `${parts.year}-${parts.month}-${parts.day}`,
        hour:
            Number(parts.hour),
        minute:
            Number(parts.minute)
    };
}


function shiftManilaDateKey(
    dateKey,
    deltaDays
) {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})$/
            .exec(
                String(dateKey || '')
            );

    if (!match) {
        throw new TypeError(
            'dateKey must be YYYY-MM-DD'
        );
    }

    const date =
        new Date(
            Date.UTC(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3]) +
                    Number(deltaDays || 0)
            )
        );

    return [
        date.getUTCFullYear(),
        String(
            date.getUTCMonth() + 1
        ).padStart(2, '0'),
        String(
            date.getUTCDate()
        ).padStart(2, '0')
    ].join('-');
}


function getManilaMondayKey(value = new Date()) {
    const dateKey =
        getManilaClock(value)
            .dateKey;

    const [
        year,
        month,
        day
    ] = dateKey
        .split('-')
        .map(Number);

    const calendarDate =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );

    const daysSinceMonday =
        (
            calendarDate.getUTCDay() +
            6
        ) % 7;

    calendarDate.setUTCDate(
        calendarDate.getUTCDate() -
        daysSinceMonday
    );

    return [
        calendarDate.getUTCFullYear(),
        String(
            calendarDate.getUTCMonth() + 1
        ).padStart(2, '0'),
        String(
            calendarDate.getUTCDate()
        ).padStart(2, '0')
    ].join('-');
}

function getWindowStatus(
    value = new Date(),
    config = {}
) {
    const normalized =
        normalizeConfig(config);

    const clock =
        getManilaClock(value);

    const closesAtMidnight =
        normalized.reportHour === 0;

    const phase =
        closesAtMidnight
            ? (
                clock.hour >=
                normalized.openHour
                    ? 'open'
                    : 'before_open'
            )
            : (
                clock.hour <
                normalized.openHour
                    ? 'before_open'
                    : clock.hour <
                        normalized.reportHour
                        ? 'open'
                        : 'closed'
            );

    const closeDateKey =
        closesAtMidnight
            ? shiftManilaDateKey(
                clock.dateKey,
                1
            )
            : clock.dateKey;

    const closeHour =
        closesAtMidnight
            ? 0
            : normalized.reportHour;

    return {
        manila_date:
            clock.dateKey,
        phase,
        open:
            phase === 'open',
        opens_at:
            `${clock.dateKey}T${String(normalized.openHour).padStart(2, '0')}:00:00+08:00`,
        closes_at:
            `${closeDateKey}T${String(closeHour).padStart(2, '0')}:00:00+08:00`
    };
}

function withMutationQueue(database, operation) {
    const previous =
        mutationQueues.get(database) ||
        Promise.resolve();

    const current =
        previous
            .catch(() => {})
            .then(operation);

    let tracked;

    const release =
        () => {
            if (
                mutationQueues.get(database) ===
                tracked
            ) {
                mutationQueues.delete(database);
            }
        };

    tracked =
        current.then(
            release,
            release
        );

    mutationQueues.set(
        database,
        tracked
    );

    return current;
}

async function loadCoveragePopulation(
    database,
    value = new Date()
) {
    requireDatabase(database);

    const weekStart =
        getManilaMondayKey(value);

    const rows =
        await all(
            database,
            `SELECT DISTINCT
                recipient.id,
                recipient.name,
                recipient.profile_picture
             FROM secret_prayer_pals assignment
             JOIN youth sender
               ON sender.id = assignment.youth_id
             JOIN youth recipient
               ON recipient.id = assignment.pal_youth_id
             WHERE assignment.week_start = ?
               AND assignment.youth_id <> assignment.pal_youth_id
             ORDER BY recipient.name COLLATE NOCASE,
                      recipient.id`,
            [
                weekStart
            ]
        );

    const seen =
        new Set();

    return rows.filter(row => {
        const youthId =
            Number(row.id);

        if (
            !Number.isSafeInteger(youthId) ||
            youthId <= 0 ||
            typeof row.name !== 'string' ||
            !row.name.trim() ||
            seen.has(youthId)
        ) {
            return false;
        }

        seen.add(youthId);
        row.id = youthId;
        row.name = row.name.trim();
        row.profile_picture =
            typeof row.profile_picture === 'string' &&
            row.profile_picture
                ? row.profile_picture
                : null;

        return true;
    });
}

async function loadNormalCoverageIds(
    database,
    dateKey
) {
    const rows =
        await all(
            database,
            `SELECT DISTINCT
                inbox.receiver_id AS youth_id
             FROM growth_prayer_rhythm_days rhythm
             JOIN personal_inbox inbox
               ON rhythm.source_table = 'personal_inbox'
              AND rhythm.source_id = inbox.id
              AND inbox.sender_id = rhythm.youth_id
             WHERE rhythm.prayer_date = ?`,
            [
                dateKey
            ]
        );

    return new Set(
        rows
            .map(row => Number(row.youth_id))
            .filter(
                value =>
                    Number.isSafeInteger(value) &&
                    value > 0
            )
    );
}

async function loadWatchtowerCoverageIds(
    database,
    dateKey
) {
    const rows =
        await all(
            database,
            `SELECT covered_youth_id
             FROM watchtower_prayer_coverage
             WHERE coverage_date = ?`,
            [
                dateKey
            ]
        );

    return new Set(
        rows
            .map(
                row =>
                    Number(row.covered_youth_id)
            )
            .filter(
                value =>
                    Number.isSafeInteger(value) &&
                    value > 0
            )
    );
}

async function getWatchtowerState(
    database,
    {
        actorYouthId,
        now = new Date(),
        openHour,
        reportHour,
        claimMinutes
    } = {}
) {
    requireDatabase(database);

    const actorId =
        positiveInteger(
            actorYouthId,
            'actorYouthId'
        );

    const config =
        normalizeConfig({
            openHour,
            reportHour,
            claimMinutes
        });

    const clock =
        getManilaClock(now);

    const window =
        getWindowStatus(
            clock.date,
            config
        );

    const population =
        await loadCoveragePopulation(
            database,
            clock.date
        );

    const [
        normalCoverage,
        watchtowerCoverage,
        claimRows,
        report
    ] = await Promise.all([
        loadNormalCoverageIds(
            database,
            clock.dateKey
        ),
        loadWatchtowerCoverageIds(
            database,
            clock.dateKey
        ),
        all(
            database,
            `SELECT *
             FROM watchtower_prayer_claims
             WHERE coverage_date = ?`,
            [
                clock.dateKey
            ]
        ),
        get(
            database,
            `SELECT *
             FROM watchtower_daily_reports
             WHERE coverage_date = ?
             LIMIT 1`,
            [
                clock.dateKey
            ]
        )
    ]);

    const covered =
        new Set([
            ...normalCoverage,
            ...watchtowerCoverage
        ]);

    const claims =
        new Map(
            claimRows.map(
                row => [
                    Number(row.covered_youth_id),
                    row
                ]
            )
        );

    const uncovered =
        window.open
            ? population
                .filter(
                    member =>
                        !covered.has(member.id)
                )
                .map(member => {
                    const claim =
                        claims.get(member.id);

                    const claimActive =
                        claim &&
                        !claim.completed_at &&
                        typeof claim.expires_at === 'string' &&
                        claim.expires_at > clock.iso;

                    const claimState =
                        !claimActive
                            ? 'available'
                            : Number(
                                claim.claimant_youth_id
                            ) === actorId
                                ? 'claimed_by_me'
                                : 'claimed';

                    return {
                        youth_id:
                            member.id,
                        name:
                            member.name,
                        profile_picture:
                            member.profile_picture,
                        claim_state:
                            claimState,
                        claim_expires_at:
                            claimActive
                                ? claim.expires_at
                                : null
                    };
                })
            : [];

    return {
        ...window,
        claim_minutes:
            config.claimMinutes,
        eligible_population:
            population.length,
        total_covered:
            population.filter(
                member =>
                    covered.has(member.id)
            ).length,
        uncovered,
        report:
            report || null
    };
}

async function claimWatchtowerMember(
    database,
    {
        actorYouthId,
        coveredYouthId,
        now = new Date(),
        openHour,
        reportHour,
        claimMinutes
    } = {}
) {
    requireDatabase(database);

    const actorId =
        positiveInteger(
            actorYouthId,
            'actorYouthId'
        );

    const targetId =
        positiveInteger(
            coveredYouthId,
            'coveredYouthId'
        );

    if (actorId === targetId) {
        throw watchtowerError(
            'SELF_CLAIM',
            'You cannot claim yourself for Watchtower coverage.'
        );
    }

    const config =
        normalizeConfig({
            openHour,
            reportHour,
            claimMinutes
        });

    const clock =
        getManilaClock(now);

    if (
        !getWindowStatus(
            clock.date,
            config
        ).open
    ) {
        throw watchtowerError(
            'WATCHTOWER_CLOSED',
            'Watchtower is not open.'
        );
    }

    return withMutationQueue(
        database,
        async () => {
            await run(
                database,
                'BEGIN IMMEDIATE'
            );

            try {
                const population =
                    await loadCoveragePopulation(
                        database,
                        clock.date
                    );

                if (
                    !population.some(
                        member =>
                            member.id === targetId
                    )
                ) {
                    throw watchtowerError(
                        'TARGET_INELIGIBLE',
                        'The selected member is not eligible for Watchtower coverage.'
                    );
                }

                const [
                    normalCoverage,
                    watchtowerCoverage
                ] = await Promise.all([
                    loadNormalCoverageIds(
                        database,
                        clock.dateKey
                    ),
                    loadWatchtowerCoverageIds(
                        database,
                        clock.dateKey
                    )
                ]);

                if (
                    normalCoverage.has(targetId) ||
                    watchtowerCoverage.has(targetId)
                ) {
                    throw watchtowerError(
                        'ALREADY_COVERED',
                        'This member is already covered today.'
                    );
                }

                const existing =
                    await get(
                        database,
                        `SELECT *
                         FROM watchtower_prayer_claims
                         WHERE coverage_date = ?
                           AND covered_youth_id = ?
                         LIMIT 1`,
                        [
                            clock.dateKey,
                            targetId
                        ]
                    );

                if (
                    existing &&
                    !existing.completed_at &&
                    existing.expires_at > clock.iso
                ) {
                    if (
                        Number(
                            existing.claimant_youth_id
                        ) !== actorId
                    ) {
                        throw watchtowerError(
                            'CLAIMED_BY_ANOTHER',
                            'This member is currently claimed by another intercessor.'
                        );
                    }

                    await run(
                        database,
                        'COMMIT'
                    );

                    return {
                        claimed:
                            true,
                        already_claimed:
                            true,
                        claim_id:
                            Number(existing.id),
                        covered_youth_id:
                            targetId,
                        coverage_date:
                            clock.dateKey,
                        expires_at:
                            existing.expires_at
                    };
                }

                const expiresAt =
                    new Date(
                        clock.date.getTime() +
                        config.claimMinutes *
                            60 *
                            1000
                    ).toISOString();

                let claimId;

                if (existing) {
                    const updated =
                        await run(
                            database,
                            `UPDATE watchtower_prayer_claims
                             SET claimant_youth_id = ?,
                                 claimed_at = ?,
                                 expires_at = ?,
                                 completed_at = NULL,
                                 updated_at = ?
                             WHERE id = ?
                               AND completed_at IS NULL
                               AND expires_at <= ?`,
                            [
                                actorId,
                                clock.iso,
                                expiresAt,
                                clock.iso,
                                existing.id,
                                clock.iso
                            ]
                        );

                    if (updated.changes !== 1) {
                        throw watchtowerError(
                            'CLAIM_CONFLICT',
                            'The Watchtower claim changed. Please refresh.'
                        );
                    }

                    claimId =
                        Number(existing.id);
                } else {
                    const inserted =
                        await run(
                            database,
                            `INSERT INTO watchtower_prayer_claims (
                                coverage_date,
                                covered_youth_id,
                                claimant_youth_id,
                                claimed_at,
                                expires_at,
                                created_at,
                                updated_at
                             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                clock.dateKey,
                                targetId,
                                actorId,
                                clock.iso,
                                expiresAt,
                                clock.iso,
                                clock.iso
                            ]
                        );

                    claimId =
                        Number(inserted.lastID);
                }

                await run(
                    database,
                    'COMMIT'
                );

                return {
                    claimed:
                        true,
                    already_claimed:
                        false,
                    claim_id:
                        claimId,
                    covered_youth_id:
                        targetId,
                    coverage_date:
                        clock.dateKey,
                    expires_at:
                        expiresAt
                };
            } catch (error) {
                await run(
                    database,
                    'ROLLBACK'
                ).catch(() => {});

                throw error;
            }
        }
    );
}

async function completeWatchtowerPrayer(
    database,
    {
        actorYouthId,
        coveredYouthId,
        now = new Date(),
        openHour,
        reportHour,
        claimMinutes
    } = {}
) {
    requireDatabase(database);

    const actorId =
        positiveInteger(
            actorYouthId,
            'actorYouthId'
        );

    const targetId =
        positiveInteger(
            coveredYouthId,
            'coveredYouthId'
        );

    if (actorId === targetId) {
        throw watchtowerError(
            'SELF_CLAIM',
            'You cannot complete Watchtower coverage for yourself.'
        );
    }

    const config =
        normalizeConfig({
            openHour,
            reportHour,
            claimMinutes
        });

    const clock =
        getManilaClock(now);

    if (
        !getWindowStatus(
            clock.date,
            config
        ).open
    ) {
        throw watchtowerError(
            'WATCHTOWER_CLOSED',
            'Watchtower is not open.'
        );
    }

    return withMutationQueue(
        database,
        async () => {
            await run(
                database,
                'BEGIN IMMEDIATE'
            );

            try {
                const population =
                    await loadCoveragePopulation(
                        database,
                        clock.date
                    );

                if (
                    !population.some(
                        member =>
                            member.id === targetId
                    )
                ) {
                    throw watchtowerError(
                        'TARGET_INELIGIBLE',
                        'The selected member is not eligible for Watchtower coverage.'
                    );
                }

                const completed =
                    await get(
                        database,
                        `SELECT *
                         FROM watchtower_prayer_coverage
                         WHERE coverage_date = ?
                           AND covered_youth_id = ?
                         LIMIT 1`,
                        [
                            clock.dateKey,
                            targetId
                        ]
                    );

                if (completed) {
                    await run(
                        database,
                        'COMMIT'
                    );

                    return {
                        completed:
                            true,
                        already_completed:
                            true,
                        coverage_source:
                            'watchtower',
                        coverage_date:
                            clock.dateKey,
                        covered_youth_id:
                            targetId
                    };
                }

                const claim =
                    await get(
                        database,
                        `SELECT *
                         FROM watchtower_prayer_claims
                         WHERE coverage_date = ?
                           AND covered_youth_id = ?
                         LIMIT 1`,
                        [
                            clock.dateKey,
                            targetId
                        ]
                    );

                if (
                    !claim ||
                    claim.completed_at ||
                    claim.expires_at <= clock.iso
                ) {
                    throw watchtowerError(
                        'CLAIM_REQUIRED',
                        'A current Watchtower claim is required.'
                    );
                }

                if (
                    Number(
                        claim.claimant_youth_id
                    ) !== actorId
                ) {
                    throw watchtowerError(
                        'CLAIM_NOT_OWNED',
                        'Only the current claim owner may complete this prayer.'
                    );
                }

                const normalCoverage =
                    await loadNormalCoverageIds(
                        database,
                        clock.dateKey
                    );

                if (normalCoverage.has(targetId)) {
                    await run(
                        database,
                        `UPDATE watchtower_prayer_claims
                         SET completed_at = ?,
                             updated_at = ?
                         WHERE id = ?`,
                        [
                            clock.iso,
                            clock.iso,
                            claim.id
                        ]
                    );

                    await run(
                        database,
                        'COMMIT'
                    );

                    return {
                        completed:
                            false,
                        already_covered:
                            true,
                        coverage_source:
                            'normal_assigned_prayer',
                        coverage_date:
                            clock.dateKey,
                        covered_youth_id:
                            targetId
                    };
                }

                await run(
                    database,
                    `INSERT INTO watchtower_prayer_coverage (
                        coverage_date,
                        covered_youth_id,
                        coverage_source,
                        intercessor_youth_id,
                        claim_id,
                        completed_at,
                        created_at
                     ) VALUES (?, ?, 'watchtower', ?, ?, ?, ?)`,
                    [
                        clock.dateKey,
                        targetId,
                        actorId,
                        claim.id,
                        clock.iso,
                        clock.iso
                    ]
                );

                await run(
                    database,
                    `UPDATE watchtower_prayer_claims
                     SET completed_at = ?,
                         updated_at = ?
                     WHERE id = ?`,
                    [
                        clock.iso,
                        clock.iso,
                        claim.id
                    ]
                );

                await run(
                    database,
                    'COMMIT'
                );

                return {
                    completed:
                        true,
                    already_completed:
                        false,
                    coverage_source:
                        'watchtower',
                    coverage_date:
                        clock.dateKey,
                    covered_youth_id:
                        targetId
                };
            } catch (error) {
                await run(
                    database,
                    'ROLLBACK'
                ).catch(() => {});

                throw error;
            }
        }
    );
}

function parsePermissions(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value !== 'string') {
        return [];
    }

    try {
        const parsed =
            JSON.parse(value);

        return Array.isArray(parsed)
            ? parsed
            : [];
    } catch {
        return value
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);
    }
}

async function loadAuthorizedIntercessorIds(
    database
) {
    const rows =
        await all(
            database,
            `SELECT DISTINCT
                youth.id AS youth_id,
                users.permissions
             FROM users
             JOIN youth
               ON youth.id = users.youth_id
             WHERE users.youth_id IS NOT NULL`
        );

    return [
        ...new Set(
            rows
                .filter(
                    row =>
                        parsePermissions(
                            row.permissions
                        ).includes(
                            WATCHTOWER_PERMISSION
                        )
                )
                .map(
                    row =>
                        Number(row.youth_id)
                )
                .filter(
                    value =>
                        Number.isSafeInteger(value) &&
                        value > 0
                )
        )
    ];
}

async function createDailyCoverageReport(
    database,
    {
        now = new Date(),
        openHour,
        reportHour,
        claimMinutes,
        notificationCenter = NotificationCenter,
        dispatchEvent = null
    } = {}
) {
    requireDatabase(database);

    const config =
        normalizeConfig({
            openHour,
            reportHour,
            claimMinutes
        });

    const clock =
        getManilaClock(now);

    const currentDateKey =
        clock.dateKey;

    let coverageDateKey =
        currentDateKey;

    /*
     * Midnight reporting mode:
     *
     * 00:00 through 21:59:
     *   the preceding Manila date may be reported.
     *
     * 22:00 through 23:59:
     *   today's Watchtower window is live and no report
     *   is due yet.
     */
    if (config.reportHour === 0) {
        if (
            clock.hour >=
            config.openHour
        ) {
            return {
                status:
                    'not_due',
                manila_date:
                    currentDateKey
            };
        }

        coverageDateKey =
            shiftManilaDateKey(
                currentDateKey,
                -1
            );
    } else if (
        clock.hour <
        config.reportHour
    ) {
        return {
            status:
                'not_due',
            manila_date:
                currentDateKey
        };
    }

    const coverageDate =
        new Date(
            `${coverageDateKey}T12:00:00+08:00`
        );

    const population =
        await loadCoveragePopulation(
            database,
            coverageDate
        );

    const populationIds =
        new Set(
            population.map(
                member => member.id
            )
        );

    const [
        allNormalCoverage,
        allWatchtowerCoverage
    ] = await Promise.all([
        loadNormalCoverageIds(
            database,
            coverageDateKey
        ),
        loadWatchtowerCoverageIds(
            database,
            coverageDateKey
        )
    ]);

    const normalCoverage =
        new Set(
            [...allNormalCoverage]
                .filter(
                    youthId =>
                        populationIds.has(youthId)
                )
        );

    const watchtowerCoverage =
        new Set(
            [...allWatchtowerCoverage]
                .filter(
                    youthId =>
                        populationIds.has(youthId)
                )
        );

    const totalCovered =
        new Set([
            ...normalCoverage,
            ...watchtowerCoverage
        ]).size;

    const eligiblePopulation =
        population.length;

    const uncovered =
        Math.max(
            eligiblePopulation -
            totalCovered,
            0
        );

    const coveragePercent =
        eligiblePopulation === 0
            ? 100
            : Number(
                (
                    totalCovered /
                    eligiblePopulation *
                    100
                ).toFixed(2)
            );

    await run(
        database,
        `INSERT OR IGNORE INTO watchtower_daily_reports (
            coverage_date,
            eligible_population,
            normal_coverage,
            watchtower_coverage,
            total_covered,
            uncovered,
            coverage_percent,
            generated_at,
            created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            coverageDateKey,
            eligiblePopulation,
            normalCoverage.size,
            watchtowerCoverage.size,
            totalCovered,
            uncovered,
            coveragePercent,
            clock.iso,
            clock.iso
        ]
    );

    const report =
        await get(
            database,
            `SELECT *
             FROM watchtower_daily_reports
             WHERE coverage_date = ?
             LIMIT 1`,
            [
                coverageDateKey
            ]
        );

    const recipientYouthIds =
        await loadAuthorizedIntercessorIds(
            database
        );

    let notification =
        null;

    let notificationError =
        false;

    if (
        recipientYouthIds.length > 0 &&
        notificationCenter &&
        typeof notificationCenter
            .createNotification === 'function'
    ) {
        try {
            notification =
                await notificationCenter
                    .createNotification(
                        database,
                        {
                            eventKey:
                                `watchtower-coverage-report:date:${coverageDateKey}`,
                            category:
                                'prayer_daily_growth',
                            title:
                                'Watchtower Coverage Report',
                            message:
                                `${report.total_covered} of ${report.eligible_population} participating members received Prayer Coverage for ${report.coverage_date} (${report.coverage_percent}%).`,
                            importance:
                                report.uncovered > 0
                                    ? 'important'
                                    : 'normal',
                            actionUrl:
                                '/?tab=watchtower',
                            sourceType:
                                'watchtower_coverage_report',
                            sourceId:
                                Number(report.id),
                            metadata: {
                                manila_date:
                                    report.coverage_date,
                                eligible_population:
                                    report.eligible_population,
                                normal_coverage:
                                    report.normal_coverage,
                                watchtower_coverage:
                                    report.watchtower_coverage,
                                total_covered:
                                    report.total_covered,
                                uncovered:
                                    report.uncovered,
                                coverage_percent:
                                    report.coverage_percent
                            },
                            recipientYouthIds,
                            createdAt:
                                clock.iso
                        }
                    );

            if (
                dispatchEvent &&
                notification.insertedRecipients > 0
            ) {
                await dispatchEvent(
                    notification.eventId,
                    {
                        channels: [
                            'push'
                        ]
                    }
                );
            }
        } catch {
            notificationError =
                true;
        }
    }

    return {
        status:
            'completed',
        report,
        report_recipient_count:
            recipientYouthIds.length,
        notification_created:
            Boolean(
                notification &&
                notification.insertedRecipients > 0
            ),
        notification_error:
            notificationError
    };
}

function startWatchtowerScheduler({
    enabled = false,
    database = null,
    cron = null,
    now = () => new Date(),
    openHour,
    reportHour,
    claimMinutes,
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
                Promise.resolve({
                    status:
                        'disabled'
                })
        };
    }

    requireDatabase(database);

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

    const config =
        normalizeConfig({
            openHour,
            reportHour,
            claimMinutes
        });

    let running =
        false;

    const tick =
        async () => {
            if (running) {
                return {
                    status:
                        'overlap_skipped'
                };
            }

            running =
                true;

            try {
                const result =
                    await createDailyCoverageReport(
                        database,
                        {
                            now:
                                now(),
                            ...config,
                            notificationCenter,
                            dispatchEvent
                        }
                    );

                if (
                    logger &&
                    typeof logger.info === 'function'
                ) {
                    logger.info(
                        '[WATCHTOWER_COVERAGE]',
                        result.status,
                        result.report || null
                    );
                }

                return result;
            } catch (error) {
                if (
                    logger &&
                    typeof logger.error === 'function'
                ) {
                    logger.error(
                        '[WATCHTOWER_COVERAGE] report failed',
                        error && error.code
                            ? error.code
                            : 'REPORT_FAILED'
                    );
                }

                return {
                    status:
                        'failed',
                    errors:
                        1
                };
            } finally {
                running =
                    false;
            }
        };

    const task =
        cron.schedule(
            `*/5 ${config.reportHour} * * *`,
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
    DEFAULT_OPEN_HOUR,
    DEFAULT_REPORT_HOUR,
    DEFAULT_CLAIM_MINUTES,
    WATCHTOWER_PERMISSION,
    normalizeConfig,
    getManilaClock,
    getManilaMondayKey,
    getWindowStatus,
    loadCoveragePopulation,
    getWatchtowerState,
    claimWatchtowerMember,
    completeWatchtowerPrayer,
    loadAuthorizedIntercessorIds,
    createDailyCoverageReport,
    startWatchtowerScheduler
});
