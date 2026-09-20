'use strict';

const crypto = require('crypto');

const TIME_ZONE = 'Asia/Manila';
const TEMPLATE_CODE = 'prayer-covenant-21';

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(error) {
            if (error) return reject(error);

            return resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (error, row) => {
            if (error) return reject(error);
            return resolve(row || null);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (error, rows) => {
            if (error) return reject(error);
            return resolve(rows || []);
        });
    });
}

function exec(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, error => {
            if (error) return reject(error);
            return resolve();
        });
    });
}

function positiveInteger(value, label) {
    const parsed = Number(value);

    if (
        !Number.isInteger(parsed) ||
        parsed <= 0
    ) {
        throw new TypeError(
            `${label} must be a positive integer`
        );
    }

    return parsed;
}

function parseDate(value = null) {
    if (value instanceof Date) {
        return new Date(value.getTime());
    }

    if (value == null) {
        return new Date();
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        throw new TypeError(
            'A valid date/time is required'
        );
    }

    return parsed;
}

function getManilaDate(value = null) {
    const date = parseDate(value);

    const parts =
        new Intl.DateTimeFormat(
            'en-US',
            {
                timeZone: TIME_ZONE,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }
        ).formatToParts(date);

    const values = {};

    for (const part of parts) {
        if (
            part.type === 'year' ||
            part.type === 'month' ||
            part.type === 'day'
        ) {
            values[part.type] =
                part.value;
        }
    }

    return (
        `${values.year}-` +
        `${values.month}-` +
        `${values.day}`
    );
}

function dateOrdinal(dateKey) {
    const match =
        /^(\d{4})-(\d{2})-(\d{2})$/
            .exec(dateKey);

    if (!match) {
        throw new TypeError(
            'assignment date must use YYYY-MM-DD'
        );
    }

    return Math.floor(
        Date.UTC(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3])
        ) / 86400000
    );
}

function stableMemberRank(youthId) {
    return crypto
        .createHash('sha256')
        .update(
            `fog-prayer-covenant-daily:${youthId}`,
            'utf8'
        )
        .digest('hex');
}

function stableParticipantOrder(rows) {
    return [...rows].sort((left, right) => {
        const leftRank =
            stableMemberRank(
                left.youth_id
            );

        const rightRank =
            stableMemberRank(
                right.youth_id
            );

        const rankCompare =
            leftRank.localeCompare(
                rightRank
            );

        if (rankCompare !== 0) {
            return rankCompare;
        }

        return (
            Number(left.youth_id) -
            Number(right.youth_id)
        );
    });
}

function buildPreviousMap(rows) {
    const map = new Map();

    for (const row of rows) {
        map.set(
            Number(
                row.sender_youth_id
            ),
            Number(
                row.pal_youth_id
            )
        );
    }

    return map;
}

function buildCandidateMap(
    ordered,
    offset
) {
    const assignments =
        new Map();

    for (
        let index = 0;
        index < ordered.length;
        index += 1
    ) {
        const sender =
            ordered[index];

        const pal =
            ordered[
                (
                    index +
                    offset
                ) %
                ordered.length
            ];

        assignments.set(
            Number(
                sender.youth_id
            ),
            {
                senderYouthId:
                    Number(
                        sender.youth_id
                    ),

                enrollmentId:
                    Number(
                        sender.enrollment_id
                    ),

                palYouthId:
                    Number(
                        pal.youth_id
                    )
            }
        );
    }

    return assignments;
}

function countPreviousRepeats(
    assignments,
    previous
) {
    let repeats = 0;

    for (
        const [
            senderYouthId,
            assignment
        ]
        of assignments
    ) {
        if (
            previous.get(
                senderYouthId
            ) ===
            assignment.palYouthId
        ) {
            repeats += 1;
        }
    }

    return repeats;
}

function orderedOffsets(
    participantCount,
    assignmentDate
) {
    if (participantCount < 2) {
        return [];
    }

    const span =
        participantCount - 1;

    const preferred =
        1 +
        (
            dateOrdinal(
                assignmentDate
            ) %
            span
        );

    const values = [
        preferred
    ];

    for (
        let offset = 1;
        offset <= span;
        offset += 1
    ) {
        if (
            offset !== preferred
        ) {
            values.push(
                offset
            );
        }
    }

    return values;
}

function chooseAssignments(
    participants,
    previousRows,
    assignmentDate
) {
    const ordered =
        stableParticipantOrder(
            participants
        );

    if (ordered.length < 2) {
        return new Map();
    }

    const previous =
        buildPreviousMap(
            previousRows
        );

    let best = null;
    let bestRepeats =
        Number.POSITIVE_INFINITY;

    for (
        const offset
        of orderedOffsets(
            ordered.length,
            assignmentDate
        )
    ) {
        const candidate =
            buildCandidateMap(
                ordered,
                offset
            );

        const repeats =
            countPreviousRepeats(
                candidate,
                previous
            );

        if (
            repeats <
            bestRepeats
        ) {
            best =
                candidate;

            bestRepeats =
                repeats;
        }

        if (repeats === 0) {
            break;
        }
    }

    return best || new Map();
}

async function initializeSchema(db) {
    await exec(
        db,
        `
        CREATE TABLE IF NOT EXISTS
            prayer_covenant_daily_pals (
                id INTEGER
                    PRIMARY KEY AUTOINCREMENT,

                assignment_date TEXT
                    NOT NULL,

                sender_youth_id INTEGER
                    NOT NULL,

                pal_youth_id INTEGER
                    NOT NULL,

                enrollment_id INTEGER
                    NOT NULL,

                created_at TEXT
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                UNIQUE(
                    assignment_date,
                    sender_youth_id
                ),

                UNIQUE(
                    assignment_date,
                    pal_youth_id
                ),

                CHECK(
                    sender_youth_id
                    <> pal_youth_id
                ),

                FOREIGN KEY (
                    sender_youth_id
                )
                    REFERENCES youth(id),

                FOREIGN KEY (
                    pal_youth_id
                )
                    REFERENCES youth(id),

                FOREIGN KEY (
                    enrollment_id
                )
                    REFERENCES
                        growth_onboarding_enrollments(id)
            );

        CREATE INDEX IF NOT EXISTS
            prayer_covenant_daily_pals_sender_idx
        ON
            prayer_covenant_daily_pals(
                sender_youth_id,
                assignment_date
            );

        CREATE INDEX IF NOT EXISTS
            prayer_covenant_daily_pals_pal_idx
        ON
            prayer_covenant_daily_pals(
                pal_youth_id,
                assignment_date
            );
        `
    );
}

async function getActiveParticipants(
    db
) {
    return all(
        db,
        `
        SELECT
            enrollment.id
                AS enrollment_id,

            enrollment.youth_id
                AS youth_id

        FROM
            growth_onboarding_enrollments
                enrollment

        JOIN
            growth_onboarding_templates
                template
          ON
            template.id =
                enrollment.template_id

        JOIN
            youth
          ON
            youth.id =
                enrollment.youth_id

        WHERE
            template.template_code = ?

          AND template.is_active = 1
          AND template.is_paused = 0

          AND enrollment.status =
                'active'

        ORDER BY
            enrollment.youth_id ASC
        `,
        [
            TEMPLATE_CODE
        ]
    );
}

async function listDateAssignments(
    db,
    assignmentDate
) {
    return all(
        db,
        `
        SELECT
            assignment.id,
            assignment.assignment_date,
            assignment.sender_youth_id,
            assignment.pal_youth_id,
            assignment.enrollment_id,
            assignment.created_at,

            pal.name
                AS pal_name,

            pal.profile_picture
                AS pal_profile_picture

        FROM
            prayer_covenant_daily_pals
                assignment

        JOIN
            youth pal
          ON
            pal.id =
                assignment.pal_youth_id

        WHERE
            assignment.assignment_date = ?

        ORDER BY
            assignment.sender_youth_id ASC
        `,
        [
            assignmentDate
        ]
    );
}

async function getPreviousAssignments(
    db,
    assignmentDate
) {
    return all(
        db,
        `
        SELECT
            sender_youth_id,
            pal_youth_id

        FROM
            prayer_covenant_daily_pals

        WHERE
            assignment_date = (
                SELECT
                    MAX(assignment_date)

                FROM
                    prayer_covenant_daily_pals

                WHERE
                    assignment_date < ?
            )
        `,
        [
            assignmentDate
        ]
    );
}

async function ensureDateAssignments(
    db,
    {
        now = null
    } = {}
) {
    const assignmentDate =
        getManilaDate(now);

    await initializeSchema(db);

    await run(
        db,
        'BEGIN IMMEDIATE'
    );

    try {
        const existing =
            await listDateAssignments(
                db,
                assignmentDate
            );

        if (existing.length > 0) {
            await run(
                db,
                'COMMIT'
            );

            return {
                assignmentDate,
                created: false,
                reason:
                    'existing_schedule',
                assignments:
                    existing
            };
        }

        const participants =
            await getActiveParticipants(
                db
            );

        if (
            participants.length < 2
        ) {
            await run(
                db,
                'COMMIT'
            );

            return {
                assignmentDate,
                created: false,
                reason:
                    'insufficient_participants',
                assignments: []
            };
        }

        const previous =
            await getPreviousAssignments(
                db,
                assignmentDate
            );

        const selected =
            chooseAssignments(
                participants,
                previous,
                assignmentDate
            );

        if (
            selected.size !==
            participants.length
        ) {
            throw new Error(
                'Unable to build complete daily Prayer Pal schedule'
            );
        }

        for (
            const participant
            of participants
        ) {
            const senderYouthId =
                Number(
                    participant.youth_id
                );

            const assignment =
                selected.get(
                    senderYouthId
                );

            if (!assignment) {
                throw new Error(
                    `Missing daily Prayer Pal assignment for youth ${senderYouthId}`
                );
            }

            if (
                assignment.senderYouthId ===
                assignment.palYouthId
            ) {
                throw new Error(
                    'Daily Prayer Pal cannot be self'
                );
            }

            await run(
                db,
                `
                INSERT INTO
                    prayer_covenant_daily_pals (
                        assignment_date,
                        sender_youth_id,
                        pal_youth_id,
                        enrollment_id
                    )
                VALUES (?, ?, ?, ?)
                `,
                [
                    assignmentDate,
                    assignment.senderYouthId,
                    assignment.palYouthId,
                    assignment.enrollmentId
                ]
            );
        }

        const assignments =
            await listDateAssignments(
                db,
                assignmentDate
            );

        if (
            assignments.length !==
            participants.length
        ) {
            throw new Error(
                'Daily Prayer Pal schedule is incomplete'
            );
        }

        await run(
            db,
            'COMMIT'
        );

        return {
            assignmentDate,
            created: true,
            reason:
                'schedule_created',
            assignments
        };
    } catch (error) {
        try {
            await run(
                db,
                'ROLLBACK'
            );
        } catch (_) {
            // Preserve original error.
        }

        throw error;
    }
}

async function getActiveEnrollment(
    db,
    youthId
) {
    return get(
        db,
        `
        SELECT
            enrollment.*

        FROM
            growth_onboarding_enrollments
                enrollment

        JOIN
            growth_onboarding_templates
                template
          ON
            template.id =
                enrollment.template_id

        WHERE
            enrollment.youth_id = ?

          AND template.template_code = ?

          AND template.is_active = 1
          AND template.is_paused = 0

          AND enrollment.status =
                'active'

        ORDER BY
            enrollment.id DESC

        LIMIT 1
        `,
        [
            youthId,
            TEMPLATE_CODE
        ]
    );
}

async function getOrCreateDailyPal(
    db,
    youthId,
    {
        now = null
    } = {}
) {
    const memberId =
        positiveInteger(
            youthId,
            'youthId'
        );

    const enrollment =
        await getActiveEnrollment(
            db,
            memberId
        );

    const assignmentDate =
        getManilaDate(now);

    if (!enrollment) {
        return {
            available: false,
            reason:
                'not_enrolled',
            assignmentDate,
            assignment: null
        };
    }

    const schedule =
        await ensureDateAssignments(
            db,
            {
                now
            }
        );

    const row =
        await get(
            db,
            `
            SELECT
                assignment.id,
                assignment.assignment_date,
                assignment.sender_youth_id,
                assignment.pal_youth_id,
                assignment.enrollment_id,
                assignment.created_at,

                pal.name
                    AS pal_name,

                pal.profile_picture
                    AS pal_profile_picture

            FROM
                prayer_covenant_daily_pals
                    assignment

            JOIN
                youth pal
              ON
                pal.id =
                    assignment.pal_youth_id

            WHERE
                assignment.assignment_date = ?

              AND assignment.sender_youth_id = ?

            LIMIT 1
            `,
            [
                assignmentDate,
                memberId
            ]
        );

    if (!row) {
        return {
            available: false,

            reason:
                schedule.reason ===
                    'insufficient_participants'
                    ? 'insufficient_participants'
                    : 'assignment_pending_next_day',

            assignmentDate,
            assignment: null
        };
    }

    return {
        available: true,
        reason: 'assigned',
        assignmentDate,

        assignment: {
            id:
                Number(row.id),

            senderYouthId:
                Number(
                    row.sender_youth_id
                ),

            palYouthId:
                Number(
                    row.pal_youth_id
                ),

            enrollmentId:
                Number(
                    row.enrollment_id
                ),

            palName:
                row.pal_name,

            palProfilePicture:
                row.pal_profile_picture ||
                null
        }
    };
}

module.exports = Object.freeze({
    TIME_ZONE,
    TEMPLATE_CODE,
    initializeSchema,
    getManilaDate,
    getActiveParticipants,
    listDateAssignments,
    ensureDateAssignments,
    getOrCreateDailyPal
});
