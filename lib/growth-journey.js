'use strict';

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

function normaliseTimestamp(value) {
    if (!value) return new Date().toISOString();

    if (value instanceof Date) {
        return value.toISOString();
    }

    return String(value);
}

function manilaDate(value) {
    if (typeof value === 'string') {
        const normalized = value.trim();
        const localTimestamp = normalized.match(
            /^(\d{4}-\d{2}-\d{2})(?:$|[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$)/
        );
        if (localTimestamp) return localTimestamp[1];
    }

    const date = value instanceof Date ? value : new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) {
        throw new TypeError('A valid date is required');
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);

    const values = {};
    for (const part of parts) {
        if (part.type !== 'literal') values[part.type] = part.value;
    }

    return `${values.year}-${values.month}-${values.day}`;
}

function shiftDateKey(dateKey, dayOffset) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey))) {
        throw new TypeError('A valid date key is required');
    }
    const [year, month, day] = String(dateKey).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + Number(dayOffset || 0));
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function parseGrowthTaskConfig(value) {
    try {
        const parsed = JSON.parse(value || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

const prayerRhythmMutationQueues = new WeakMap();
const phaseAdvancementMutationQueues = new WeakMap();

async function withPrayerRhythmMutation(db, operation) {
    if (!db || typeof operation !== 'function') {
        throw new TypeError('A database and Prayer Rhythm operation are required');
    }
    const previous = prayerRhythmMutationQueues.get(db) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    prayerRhythmMutationQueues.set(db, current);
    await previous.catch(() => {});
    try {
        return await operation();
    } finally {
        release();
        if (prayerRhythmMutationQueues.get(db) === current) {
            prayerRhythmMutationQueues.delete(db);
        }
    }
}

async function withPhaseAdvancementMutation(db, operation) {
    if (!db || typeof operation !== 'function') {
        throw new TypeError('A database and phase advancement operation are required');
    }
    const previous = phaseAdvancementMutationQueues.get(db) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    phaseAdvancementMutationQueues.set(db, current);
    await previous.catch(() => {});
    try {
        return await operation();
    } finally {
        release();
        if (phaseAdvancementMutationQueues.get(db) === current) {
            phaseAdvancementMutationQueues.delete(db);
        }
    }
}

function growthAdvancementError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizeGrowthMemberId(value) {
    if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value > 0 ? value : null;
    }
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
    const normalized = Number(value);
    return Number.isSafeInteger(normalized) ? normalized : null;
}

function normalizeGrowthPhaseKey(value) {
    return typeof value === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(value)
        ? value
        : null;
}

async function getPhaseByKey(db, phaseKey) {
    return get(
        db,
        `
        SELECT *
        FROM growth_journey_phases
        WHERE phase_key = ?
          AND is_active = 1
        LIMIT 1
        `,
        [phaseKey]
    );
}

async function getTaskByKey(db, taskKey) {
    return get(
        db,
        `
        SELECT *
        FROM growth_tasks
        WHERE task_key = ?
          AND is_active = 1
        LIMIT 1
        `,
        [taskKey]
    );
}

async function getPrayerRhythmStatus(db, youthId, {
    asOf = null,
    task = null
} = {}) {
    const normalizedYouthId = Number(youthId);
    if (!Number.isSafeInteger(normalizedYouthId) || normalizedYouthId <= 0) {
        throw new TypeError('A positive youthId is required');
    }

    const rhythmTask = task || await get(
        db,
        `SELECT task.*, phase.phase_key, phase.phase_order
         FROM growth_tasks task
         JOIN growth_journey_phases phase ON phase.id = task.phase_id
         WHERE task.evidence_type = 'prayer_rhythm_recent'
           AND task.is_active = 1
           AND phase.is_active = 1
         ORDER BY phase.phase_order ASC
         LIMIT 1`
    );

    if (!rhythmTask) {
        return {
            available: false,
            reason: 'prayer_rhythm_not_configured'
        };
    }

    const config = parseGrowthTaskConfig(rhythmTask.config_json);
    const windowDays = Math.min(
        Math.max(Number.parseInt(config.window_days, 10) || 14, 1),
        365
    );
    const targetDays = Math.min(
        Math.max(Number(rhythmTask.target_value) || 7, 1),
        windowDays
    );
    const windowEnd = manilaDate(asOf || new Date());
    const windowStart = shiftDateKey(windowEnd, -(windowDays - 1));

    const recent = await get(
        db,
        `SELECT COUNT(*) AS qualifying_days, MAX(prayer_date) AS last_prayer_date
         FROM growth_prayer_rhythm_days
         WHERE youth_id = ?
           AND prayer_date BETWEEN ? AND ?`,
        [normalizedYouthId, windowStart, windowEnd]
    );
    const today = await get(
        db,
        `SELECT id
         FROM growth_prayer_rhythm_days
         WHERE youth_id = ? AND prayer_date = ?
         LIMIT 1`,
        [normalizedYouthId, windowEnd]
    );
    const qualifyingDays = Number(recent?.qualifying_days || 0);

    return {
        available: true,
        habitKind: 'personal_prayer',
        timezone: 'Asia/Manila',
        windowDays,
        targetDays,
        windowStart,
        windowEnd,
        qualifyingDays,
        consistencyPercent: Math.min(
            100,
            Math.round((qualifyingDays / targetDays) * 1000) / 10
        ),
        completedToday: Boolean(today),
        lastPrayerDate: recent?.last_prayer_date || null
    };
}

async function effectiveGrowthMappingsForEvent(db, eventId) {
    const normalizedEventId = Number(eventId);
    if (!Number.isSafeInteger(normalizedEventId) || normalizedEventId <= 0) {
        throw new TypeError('A positive eventId is required');
    }

    const mappings = await all(
        db,
        `
        SELECT
            mapping.id,
            mapping.task_id,
            mapping.event_id,
            mapping.series_id,
            mapping.evidence_mode,
            mapping.formation_area,
            mapping.credit_value,
            task.task_key,
            task.title AS task_title,
            task.evidence_type AS task_evidence_type,
            phase.phase_key,
            phase.title AS phase_title,
            phase.journey_segment,
            series.series_key,
            series.name AS series_name,
            CASE WHEN mapping.event_id = ? THEN 'event' ELSE 'series' END AS source_type
        FROM growth_event_task_map mapping
        JOIN growth_tasks task
          ON task.id = mapping.task_id
        JOIN growth_journey_phases phase
          ON phase.id = task.phase_id
        LEFT JOIN growth_event_series_events assignment
          ON assignment.series_id = mapping.series_id
         AND assignment.event_id = ?
        LEFT JOIN growth_event_series series
          ON series.id = mapping.series_id
        WHERE mapping.is_active = 1
          AND task.is_active = 1
          AND (
                (mapping.event_id = ? AND mapping.series_id = 0)
                OR
                (mapping.event_id = 0 AND mapping.series_id > 0
                    AND assignment.id IS NOT NULL AND series.is_active = 1)
          )
        ORDER BY
            CASE WHEN mapping.event_id = ? THEN 1 ELSE 0 END ASC,
            mapping.series_id ASC,
            mapping.id ASC
        `,
        [normalizedEventId, normalizedEventId, normalizedEventId, normalizedEventId]
    );

    const uniqueByTask = new Map();
    for (const mapping of mappings) {
        uniqueByTask.set(mapping.task_id, mapping);
    }
    return [...uniqueByTask.values()];
}

async function recordEvidence(db, {
    youthId,
    taskId,
    evidenceType,
    sourceTable = null,
    sourceId = null,
    sourceKey,
    numericValue = 1,
    occurredAt = null,
    details = {},
    actor = 'System'
}) {
    if (!youthId) throw new Error('youthId is required');
    if (!taskId) throw new Error('taskId is required');
    if (!evidenceType) throw new Error('evidenceType is required');
    if (!sourceKey) throw new Error('sourceKey is required');

    const timestamp = normaliseTimestamp(occurredAt);

    const result = await run(
        db,
        `
        INSERT OR IGNORE INTO growth_evidence (
            youth_id,
            task_id,
            evidence_type,
            source_table,
            source_id,
            source_key,
            numeric_value,
            occurred_at,
            details_json,
            recorded_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            youthId,
            taskId,
            evidenceType,
            sourceTable,
            sourceId,
            sourceKey,
            Number(numericValue) || 0,
            timestamp,
            JSON.stringify(details || {}),
            actor || 'System'
        ]
    );

    return {
        inserted: result.changes === 1,
        changes: result.changes
    };
}

async function getTaskEvidenceValue(db, youthId, taskOrId, {
    asOf = null
} = {}) {
    const task = typeof taskOrId === 'object' && taskOrId
        ? taskOrId
        : await get(db, 'SELECT * FROM growth_tasks WHERE id = ?', [taskOrId]);
    if (!task) throw new Error(`Unknown growth task: ${taskOrId}`);
    const taskId = Number(task.id);

    let prayerRhythm = null;
    let evidenceTotal = 0;

    if (task.evidence_type === 'prayer_rhythm_recent') {
        prayerRhythm = await getPrayerRhythmStatus(db, youthId, {
            asOf,
            task
        });
        evidenceTotal = Number(prayerRhythm.qualifyingDays || 0);
    } else {
        const row = await get(
            db,
            `
            SELECT COALESCE(SUM(numeric_value), 0) AS total
            FROM growth_evidence
            WHERE youth_id = ?
              AND task_id = ?
            `,
            [youthId, taskId]
        );
        evidenceTotal = Number(row?.total || 0);
    }

    const override = await get(
        db,
        `
        SELECT
            COALESCE(SUM(
                CASE
                    WHEN override_type = 'add_credit'
                    THEN COALESCE(numeric_value, 0)
                    ELSE 0
                END
            ), 0) AS added_credit,

            MAX(
                CASE
                    WHEN override_type IN (
                        'recognize_complete',
                        'waive_requirement'
                    )
                    THEN 1
                    ELSE 0
                END
            ) AS forced_complete
        FROM growth_overrides
        WHERE youth_id = ?
          AND task_id = ?
          AND revoked_at IS NULL
        `,
        [youthId, taskId]
    );

    return {
        evidence: evidenceTotal,
        addedCredit: Number(override?.added_credit || 0),
        forcedComplete: Number(override?.forced_complete || 0) === 1,
        prayerRhythm
    };
}

async function recalculatePhaseProgress(db, youthId, phaseId, {
    asOf = null
} = {}) {
    const phase = await get(
        db,
        `
        SELECT *
        FROM growth_journey_phases
        WHERE id = ?
          AND is_active = 1
        `,
        [phaseId]
    );

    if (!phase) throw new Error(`Unknown growth phase: ${phaseId}`);

    const tasks = await all(
        db,
        `
        SELECT *
        FROM growth_tasks
        WHERE phase_id = ?
          AND is_active = 1
        ORDER BY id
        `,
        [phaseId]
    );

    let totalWeight = 0;
    let earnedWeight = 0;

    let essentialTotal = 0;
    let essentialCompleted = 0;

    let hasAnyProgress = false;

    const taskProgress = [];

    for (const task of tasks) {
        const evidence = await getTaskEvidenceValue(db, youthId, task, {
            asOf
        });

        const target = Number(task.target_value) > 0
            ? Number(task.target_value)
            : 1;

        const value = evidence.evidence + evidence.addedCredit;

        let ratio = Math.min(value / target, 1);

        if (evidence.forcedComplete) {
            ratio = 1;
        }

        const weight = Math.max(Number(task.progress_weight) || 0, 0);

        totalWeight += weight;
        earnedWeight += weight * ratio;

        if (value > 0 || evidence.forcedComplete) {
            hasAnyProgress = true;
        }

        const completed = ratio >= 1;

        if (task.classification === 'essential') {
            essentialTotal += 1;
            if (completed) essentialCompleted += 1;
        }

        taskProgress.push({
            id: task.id,
            taskKey: task.task_key,
            title: task.title,
            memberDescription: task.member_description,
            classification: task.classification,
            visibility: task.visibility,
            evidenceType: task.evidence_type,
            target,
            value,
            ratio,
            completed,
            progressWeight: weight,
            prayerRhythm: evidence.prayerRhythm
        });
    }

    let progressPercent = totalWeight > 0
        ? (earnedWeight / totalWeight) * 100
        : 0;

    progressPercent = Math.max(
        0,
        Math.min(100, Math.round(progressPercent * 10) / 10)
    );

    const existing = await get(
        db,
        `
        SELECT *
        FROM growth_phase_progress
        WHERE youth_id = ?
          AND phase_id = ?
        `,
        [youthId, phaseId]
    );

    /*
     * Completed phases are grandfathered.
     * Recalculation must never silently make a legitimately completed
     * phase incomplete merely because leadership later changes rules.
     */
    const previousStatus =
        existing?.status || 'not_started';

    let status = previousStatus;
    let completedAt = existing?.completed_at || null;
    let completionBasis = existing?.completion_basis || null;

    if (status !== 'completed' && status !== 'paused') {
        if (!hasAnyProgress) {
            status = 'not_started';
        } else if (
            essentialTotal > 0 &&
            essentialCompleted === essentialTotal
        ) {
            /*
             * "ready" deliberately means all hard gates are satisfied.
             * Phase 1B does not yet auto-complete the phase.
             * Phase-completion policy is wired in the next integration step.
             */
            status = 'ready';
            completionBasis = 'rules_ready';
        } else if (
            essentialTotal === 0 &&
            progressPercent >= 100
        ) {
            status = 'ready';
            completionBasis = 'rules_ready';
        } else {
            status = 'in_progress';
            completionBasis = null;
        }
    }

    const now = new Date().toISOString();

    await run(
        db,
        `
        INSERT INTO growth_phase_progress (
            youth_id,
            phase_id,
            status,
            progress_percent,
            essential_completed,
            essential_total,
            started_at,
            completed_at,
            completion_basis,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

        ON CONFLICT(youth_id, phase_id)
        DO UPDATE SET
            status = excluded.status,
            progress_percent = excluded.progress_percent,
            essential_completed = excluded.essential_completed,
            essential_total = excluded.essential_total,
            started_at = COALESCE(
                growth_phase_progress.started_at,
                excluded.started_at
            ),
            completed_at = COALESCE(
                growth_phase_progress.completed_at,
                excluded.completed_at
            ),
            completion_basis = excluded.completion_basis,
            updated_at = excluded.updated_at
        `,
        [
            youthId,
            phaseId,
            status,
            progressPercent,
            essentialCompleted,
            essentialTotal,
            hasAnyProgress
                ? (existing?.started_at || now)
                : null,
            completedAt,
            completionBasis,
            now
        ]
    );

    return {
        phaseId,
        phaseKey: phase.phase_key,
        title: phase.title,
        previousStatus,
        status,
        statusChanged:
            previousStatus !== status,
        progressPercent,
        essentialCompleted,
        essentialTotal,
        tasks: taskProgress
    };
}

async function recalculatePhaseByKey(db, youthId, phaseKey, options = {}) {
    const phase = await getPhaseByKey(db, phaseKey);

    if (!phase) throw new Error(`Unknown growth phase: ${phaseKey}`);

    return recalculatePhaseProgress(db, youthId, phase.id, options);
}


async function recordEventAttendanceGrowthEvidence(db, {
    youthId,
    eventId,
    attendanceId,
    isWalkin = false,
    occurredAt = null,
    actor = 'System'
}) {
    const normalizedYouthId = Number(youthId);
    const normalizedEventId = Number(eventId);
    const normalizedAttendanceId = Number(attendanceId);

    if (
        !Number.isSafeInteger(normalizedYouthId) ||
        normalizedYouthId <= 0
    ) {
        throw new TypeError('A positive youthId is required');
    }

    if (
        !Number.isSafeInteger(normalizedEventId) ||
        normalizedEventId <= 0
    ) {
        throw new TypeError('A positive eventId is required');
    }

    if (
        !Number.isSafeInteger(normalizedAttendanceId) ||
        normalizedAttendanceId <= 0
    ) {
        throw new TypeError('A positive attendanceId is required');
    }

    const mappings = await effectiveGrowthMappingsForEvent(
        db,
        normalizedEventId
    );

    const attendanceMappings = mappings.filter(
        mapping => mapping.evidence_mode === 'attendance'
    );

    const affectedPhases = new Set();

    let insertedEvidence = 0;
    let skippedMappings = 0;

    for (const mapping of attendanceMappings) {
        /*
         * Serve attendance is a percentage/readiness calculation.
         * A single attendance row must never be treated as an
         * 80-percent readiness value.
         */
        if (
            mapping.task_evidence_type ===
            'serve_attendance_percentage'
        ) {
            skippedMappings += 1;
            continue;
        }

        const result = await recordEvidence(db, {
            youthId: normalizedYouthId,
            taskId: mapping.task_id,
            evidenceType: mapping.task_evidence_type,
            sourceTable: 'attendance',
            sourceId: normalizedAttendanceId,

            /*
             * Intentionally keyed by member + task + event,
             * not attendance row ID. This prevents a duplicate
             * attendance row from double-crediting Journey progress.
             */
            sourceKey:
                `event-attendance:event:${normalizedEventId}`,

            numericValue: mapping.credit_value,
            occurredAt,

            details: {
                event_id: normalizedEventId,
                attendance_id: normalizedAttendanceId,
                mapping_id: mapping.id,
                source_type: mapping.source_type,
                evidence_mode: mapping.evidence_mode,
                formation_area: mapping.formation_area || null,
                is_walkin: isWalkin ? 1 : 0
            },

            actor
        });

        if (result.inserted) {
            insertedEvidence += 1;

            if (mapping.phase_key) {
                affectedPhases.add(mapping.phase_key);
            }
        }
    }

    const recalculatedPhases = [];
    const phaseTransitions = [];

    for (const phaseKey of affectedPhases) {
        const phaseProgress =
            await recalculatePhaseByKey(
                db,
                normalizedYouthId,
                phaseKey
            );

        recalculatedPhases.push(
            phaseKey
        );

        phaseTransitions.push(
            phaseProgress
        );
    }

    return {
        eventId: normalizedEventId,
        attendanceMappings: attendanceMappings.length,
        insertedEvidence,
        skippedMappings,
        recalculatedPhases,
        phaseTransitions
    };
}

const PRAYER_COVENANT_TEMPLATE_CODE = 'prayer-covenant-21';

async function enrollPrayerCovenantChallengeUnlocked(db, youthId, {
    triggerType = 'membership_intent',
    triggerSourceId = null,
    occurredAt = null,
    requireAutoEnroll = false
} = {}) {
    const normalizedYouthId = Number(youthId);
    if (!Number.isSafeInteger(normalizedYouthId) || normalizedYouthId <= 0) {
        throw new TypeError('A positive youthId is required');
    }

    await run(db, 'BEGIN IMMEDIATE');

    try {
        const template = await get(
            db,
            `SELECT *
             FROM growth_onboarding_templates
             WHERE template_code = ?
               AND is_active = 1
             LIMIT 1`,
            [PRAYER_COVENANT_TEMPLATE_CODE]
        );

        if (!template) {
            await run(db, 'COMMIT');
            return {
                enrolled: false,
                reason: 'no_default_template'
            };
        }

        const existing = await get(
            db,
            `SELECT *
             FROM growth_onboarding_enrollments
             WHERE youth_id = ?
               AND template_id = ?
             LIMIT 1`,
            [normalizedYouthId, template.id]
        );
        if (existing) {
            await run(db, 'COMMIT');
            return {
                enrolled: false,
                reason: 'already_enrolled',
                template,
                enrollment: existing
            };
        }

        if (
            Number(template.is_paused) === 1 ||
            (requireAutoEnroll && Number(template.auto_enroll_enabled) !== 1)
        ) {
            await run(db, 'COMMIT');
            return {
                enrolled: false,
                reason: 'template_not_enrolling',
                template
            };
        }

        const timestamp = normaliseTimestamp(occurredAt);
        const inserted = await run(
            db,
            `INSERT OR IGNORE INTO growth_onboarding_enrollments (
                youth_id, template_id, status, trigger_type,
                trigger_source_id, enrolled_at, started_at, completed_days
             ) VALUES (?, ?, 'active', ?, ?, ?, ?, 0)`,
            [
                normalizedYouthId,
                template.id,
                triggerType,
                triggerSourceId,
                timestamp,
                timestamp
            ]
        );

        const enrollment = await get(
            db,
            `SELECT *
             FROM growth_onboarding_enrollments
             WHERE youth_id = ?
               AND template_id = ?
             LIMIT 1`,
            [normalizedYouthId, template.id]
        );

        if (!enrollment) {
            throw new Error('Prayer Covenant enrollment could not be confirmed');
        }

        await run(db, 'COMMIT');
        return {
            enrolled: inserted.changes === 1,
            reason: inserted.changes === 1 ? null : 'already_enrolled',
            template,
            enrollment
        };
    } catch (error) {
        try {
            await run(db, 'ROLLBACK');
        } catch (_) {
            // Preserve the original enrollment error.
        }
        throw error;
    }
}

async function enrollPrayerCovenantChallenge(db, youthId, options = {}) {
    return withPrayerRhythmMutation(
        db,
        () => enrollPrayerCovenantChallengeUnlocked(db, youthId, options)
    );
}

async function enrollDefaultOnboarding(db, youthId, options = {}) {
    return enrollPrayerCovenantChallenge(db, youthId, {
        ...options,
        requireAutoEnroll: true
    });
}

async function recordAccountCreated(db, youthId, {
    sourceTable = 'users',
    sourceId = null,
    sourceKey = null,
    occurredAt = null,
    actor = 'System',
    details = {}
} = {}) {
    if (!youthId) {
        throw new Error('youthId is required');
    }

    const task = await getTaskByKey(
        db,
        'encounter-account-start'
    );

    if (!task) {
        throw new Error(
            'Growth task encounter-account-start is not configured'
        );
    }

    const timestamp = normaliseTimestamp(occurredAt);

    /*
     * One canonical account-start evidence item per member.
     * This remains idempotent even if an HTTP request is retried.
     */
    const canonicalSourceKey =
        sourceKey ||
        `account-created:youth:${youthId}`;

    const evidence = await recordEvidence(db, {
        youthId,
        taskId: task.id,
        evidenceType: 'account_created',
        sourceTable,
        sourceId,
        sourceKey: canonicalSourceKey,
        numericValue: 1,
        occurredAt: timestamp,
        details,
        actor
    });

    const encounter = await recalculatePhaseByKey(
        db,
        youthId,
        'encounter'
    );

    return {
        evidence,
        encounter
    };
}


async function ensureOnboardingPrayerPartner(db, youthId, {
    assignedAt = null
} = {}) {
    if (!youthId) {
        throw new Error('youthId is required');
    }

    /*
     * Do not disturb an existing Prayer Pal relationship.
     * The onboarding requirement is simply that the newcomer
     * has somebody meaningful to pray for immediately.
     */
    const existing = await get(
        db,
        `
        SELECT
            id,
            youth_id,
            pal_youth_id,
            week_start
        FROM secret_prayer_pals
        WHERE youth_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [youthId]
    );

    if (existing) {
        return {
            available: true,
            created: false,
            reason: 'existing_partner',
            assignmentId: existing.id,
            partnerYouthId: existing.pal_youth_id,
            assignmentDate: existing.week_start
        };
    }

    /*
     * Prefer an established community member as the newcomer's
     * first Prayer Covenant partner.
     *
     * This does NOT change the selected person's own assignment.
     */
    let candidate = await get(
        db,
        `
        SELECT id
        FROM youth
        WHERE id <> ?
          AND (
                account_tier IN ('Committed Member', 'Leader')
                OR commitment_accepted_at IS NOT NULL
              )
        ORDER BY RANDOM()
        LIMIT 1
        `,
        [youthId]
    );

    /*
     * Safe fallback for a very new/small community where no
     * established member is yet marked in the legacy fields.
     */
    if (!candidate) {
        candidate = await get(
            db,
            `
            SELECT id
            FROM youth
            WHERE id <> ?
            ORDER BY RANDOM()
            LIMIT 1
            `,
            [youthId]
        );
    }

    if (!candidate) {
        return {
            available: false,
            created: false,
            reason: 'no_partner_available'
        };
    }

    const assignmentDate =
        manilaDate(assignedAt || new Date());

    const inserted = await run(
        db,
        `
        INSERT OR IGNORE INTO secret_prayer_pals (
            youth_id,
            pal_youth_id,
            week_start
        )
        VALUES (?, ?, ?)
        `,
        [
            youthId,
            candidate.id,
            assignmentDate
        ]
    );

    /*
     * Re-read instead of assuming our insert won.
     * This makes concurrent/repeated onboarding idempotent.
     */
    const assignment = await get(
        db,
        `
        SELECT
            id,
            youth_id,
            pal_youth_id,
            week_start
        FROM secret_prayer_pals
        WHERE youth_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [youthId]
    );

    if (!assignment) {
        return {
            available: false,
            created: false,
            reason: 'assignment_unavailable'
        };
    }

    return {
        available: true,
        created: inserted.changes === 1,
        reason:
            inserted.changes === 1
                ? 'partner_assigned'
                : 'existing_partner',
        assignmentId: assignment.id,
        partnerYouthId: assignment.pal_youth_id,
        assignmentDate: assignment.week_start
    };
}


async function recordMembershipIntent(db, youthId, {
    sourceId = null,
    occurredAt = null,
    actor = 'System',
    details = {}
} = {}) {
    const task = await getTaskByKey(db, 'belong-membership-intent');

    if (!task) {
        throw new Error(
            'Growth task belong-membership-intent is not configured'
        );
    }

    const timestamp = normaliseTimestamp(occurredAt);

    const sourceKey = sourceId
        ? `membership-intent:${sourceId}`
        : `membership-intent:youth:${youthId}`;

    const evidence = await recordEvidence(db, {
        youthId,
        taskId: task.id,
        evidenceType: 'membership_intent',
        sourceTable: 'youth',
        sourceId: sourceId || youthId,
        sourceKey,
        numericValue: 1,
        occurredAt: timestamp,
        details,
        actor
    });

    const onboarding = await enrollDefaultOnboarding(
        db,
        youthId,
        {
            triggerType: 'membership_intent',
            triggerSourceId: sourceId,
            occurredAt: timestamp
        }
    );

    let prayerPartner = null;

    if (
        onboarding &&
        onboarding.enrollment &&
        onboarding.enrollment.status === 'active'
    ) {
        try {
            prayerPartner =
                await ensureOnboardingPrayerPartner(
                    db,
                    youthId,
                    {
                        assignedAt: timestamp
                    }
                );
        } catch (partnerError) {
            /*
             * A partner-assignment problem must never erase or
             * reject the member's saved intent or onboarding.
             * Leadership can resolve the pairing later.
             */
            console.error(
                '[Growth Journey] Onboarding Prayer Partner assignment failed:',
                partnerError
            );

            prayerPartner = {
                available: false,
                created: false,
                reason: 'assignment_error'
            };
        }
    }

    const belong = await recalculatePhaseByKey(
        db,
        youthId,
        'belong'
    );

    return {
        evidence,
        onboarding,
        prayerPartner,
        belong
    };
}

async function recordPrayerCovenantCompletionUnlocked(db, youthId, {
    sourceKey = null,
    sourceTable = 'personal_inbox',
    sourceId = null,
    completedAt = null,
    actor = 'System',
    details = {},
    useExistingTransaction = false
} = {}) {
    const normalizedYouthId = Number(youthId);
    if (!Number.isSafeInteger(normalizedYouthId) || normalizedYouthId <= 0) {
        throw new TypeError('A positive youthId is required');
    }
    const timestamp = normaliseTimestamp(completedAt);
    const completionDate = manilaDate(timestamp);
    const canonicalSourceKey = sourceKey
        || `personal-prayer:${normalizedYouthId}:${completionDate}`;

    if (!useExistingTransaction) {
        await run(db, 'BEGIN IMMEDIATE');
    }

    try {
        /*
         * Permanent personal prayer is canonical. The temporary onboarding
         * challenge below consumes this same inserted day and cannot create
         * a second, disagreeing definition of whether prayer happened.
         */
        const rhythmInsert = await run(
            db,
            `INSERT OR IGNORE INTO growth_prayer_rhythm_days (
                youth_id, prayer_date, source_table, source_id,
                source_key, occurred_at, recorded_by
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                normalizedYouthId,
                completionDate,
                sourceTable || 'personal_inbox',
                sourceId,
                canonicalSourceKey,
                timestamp,
                actor || 'System'
            ]
        );
        const rhythmDay = await get(
            db,
            `SELECT * FROM growth_prayer_rhythm_days
             WHERE youth_id = ? AND prayer_date = ?
             LIMIT 1`,
            [normalizedYouthId, completionDate]
        );
        if (!rhythmDay) {
            throw new Error('Prayer Rhythm source key conflicts with another activity');
        }

        const enrollment = await get(
            db,
            `SELECT e.*, t.duration_days, t.template_code,
                    t.title AS template_title, t.is_paused AS template_paused
             FROM growth_onboarding_enrollments e
             JOIN growth_onboarding_templates t ON t.id = e.template_id
             WHERE e.youth_id = ?
               AND t.template_code = ?
               AND t.is_active = 1
             ORDER BY e.id DESC
             LIMIT 1`,
            [normalizedYouthId, PRAYER_COVENANT_TEMPLATE_CODE]
        );

        let challengeCredited = false;
        let challengeReason = null;
        let dayNumber = null;
        let challengeCompleted = Boolean(enrollment && enrollment.status === 'completed');
        let dailyCompletion = null;

        if (!enrollment) {
            challengeReason = 'no_active_welcome_journey';
        } else if (
            enrollment.status === 'paused' ||
            Number(enrollment.template_paused) === 1
        ) {
            challengeReason = 'welcome_journey_paused';
        } else if (enrollment.status === 'completed') {
            challengeReason = 'welcome_journey_complete';
        } else if (enrollment.status !== 'active') {
            challengeReason = 'welcome_journey_not_active';
        } else if (rhythmInsert.changes !== 1) {
            challengeReason = 'already_credited_today';
            dailyCompletion = await get(
                db,
                `SELECT * FROM growth_onboarding_daily_completions
                 WHERE enrollment_id = ? AND completion_date = ?
                 LIMIT 1`,
                [enrollment.id, completionDate]
            );
        } else {
            dailyCompletion = await get(
                db,
                `SELECT * FROM growth_onboarding_daily_completions
                 WHERE enrollment_id = ? AND completion_date = ?
                 LIMIT 1`,
                [enrollment.id, completionDate]
            );

            if (dailyCompletion) {
                challengeReason = 'already_credited_today';
            } else {
                const duration = Math.max(Number(enrollment.duration_days) || 21, 1);
                dayNumber = Math.min(
                    Number(enrollment.completed_days || 0) + 1,
                    duration
                );
                const insertedCompletion = await run(
                    db,
                    `INSERT INTO growth_onboarding_daily_completions (
                        enrollment_id, completion_date, day_number,
                        source_key, completed_at
                     ) VALUES (?, ?, ?, ?, ?)`,
                    [
                        enrollment.id,
                        completionDate,
                        dayNumber,
                        canonicalSourceKey,
                        timestamp
                    ]
                );
                challengeCompleted = dayNumber >= duration;
                await run(
                    db,
                    `UPDATE growth_onboarding_enrollments
                     SET completed_days = ?, status = ?,
                         completed_at = CASE WHEN ? = 1 THEN ? ELSE completed_at END,
                         updated_at = ?
                     WHERE id = ?`,
                    [
                        dayNumber,
                        challengeCompleted ? 'completed' : 'active',
                        challengeCompleted ? 1 : 0,
                        timestamp,
                        timestamp,
                        enrollment.id
                    ]
                );

                const challengeTask = await getTaskByKey(
                    db,
                    'encounter-prayer-covenant-21'
                );
                if (!challengeTask) {
                    throw new Error('Growth task encounter-prayer-covenant-21 is not configured');
                }
                await recordEvidence(db, {
                    youthId: normalizedYouthId,
                    taskId: challengeTask.id,
                    evidenceType: 'onboarding_prayer_day',
                    sourceTable: 'growth_onboarding_daily_completions',
                    sourceId: insertedCompletion.lastID,
                    sourceKey: `onboarding:${enrollment.id}:day:${dayNumber}`,
                    numericValue: 1,
                    occurredAt: timestamp,
                    details: {
                        ...details,
                        dayNumber,
                        completionDate,
                        templateCode: enrollment.template_code
                    },
                    actor
                });
                challengeCredited = true;
            }
        }

        const phaseTransitions = [];
        if (rhythmInsert.changes === 1) {
            const phases = await all(
                db,
                `SELECT id FROM growth_journey_phases
                 WHERE is_active = 1 ORDER BY phase_order ASC`
            );
            for (const phase of phases) {
                phaseTransitions.push(await recalculatePhaseProgress(
                    db,
                    normalizedYouthId,
                    phase.id,
                    { asOf: timestamp }
                ));
            }
        }

        const refreshedEnrollment = enrollment
            ? await get(
                db,
                'SELECT * FROM growth_onboarding_enrollments WHERE id = ?',
                [enrollment.id]
            )
            : null;
        const rhythmStatus = await getPrayerRhythmStatus(
            db,
            normalizedYouthId,
            { asOf: timestamp }
        );

        if (!useExistingTransaction) {
            await run(db, 'COMMIT');
        }

        return {
            credited: challengeCredited,
            reason: challengeCredited ? null : challengeReason,
            dayNumber,
            completed: challengeCompleted,
            enrollment: refreshedEnrollment,
            dailyCompletion,
            prayerRhythm: {
                ...rhythmStatus,
                credited: rhythmInsert.changes === 1,
                activityId: rhythmDay.id
            },
            encounter: phaseTransitions.find(item => item.phaseKey === 'encounter') || null,
            phaseTransitions
        };
    } catch (error) {
        if (!useExistingTransaction) {
            try {
                await run(db, 'ROLLBACK');
            } catch (_) {
                // Preserve the original transaction error.
            }
        }
        throw error;
    }
}

async function recordPrayerCovenantCompletion(db, youthId, options = {}) {
    if (options && options.useExistingTransaction === true) {
        return recordPrayerCovenantCompletionUnlocked(db, youthId, options);
    }
    return withPrayerRhythmMutation(
        db,
        () => recordPrayerCovenantCompletionUnlocked(db, youthId, options)
    );
}

async function getDefaultOnboardingStatus(db, youthId) {
    if (!youthId) throw new Error('youthId is required');

    const template = await get(
        db,
        `
        SELECT *
        FROM growth_onboarding_templates
        WHERE template_code = ?
          AND is_active = 1
        LIMIT 1
        `,
        [PRAYER_COVENANT_TEMPLATE_CODE]
    );

    if (!template) {
        return null;
    }

    const enrollment = await get(
        db,
        `
        SELECT *
        FROM growth_onboarding_enrollments
        WHERE youth_id = ?
          AND template_id = ?
        LIMIT 1
        `,
        [youthId, template.id]
    );

    const completedDays = Number(
        enrollment?.completed_days || 0
    );

    const durationDays = Math.max(
        Number(template.duration_days) || 21,
        1
    );

    return {
        templateCode: template.template_code,
        title: template.title,
        description: template.description,
        durationDays,
        triggerType: template.trigger_type,
        autoEnrollEnabled:
            Number(template.auto_enroll_enabled) === 1,
        paused: Number(template.is_paused) === 1,
        memberIntroText: template.member_intro_text,
        enrollment: enrollment
            ? {
                id: enrollment.id,
                status: enrollment.status,
                triggerType: enrollment.trigger_type,
                enrolledAt: enrollment.enrolled_at,
                startedAt: enrollment.started_at,
                pausedAt: enrollment.paused_at,
                resumedAt: enrollment.resumed_at,
                completedAt: enrollment.completed_at,
                completedDays,
                remainingDays: Math.max(
                    durationDays - completedDays,
                    0
                )
            }
            : null
    };
}


async function getMemberJourney(db, youthId, {
    asOf = null
} = {}) {
    const phases = await all(
        db,
        `
        SELECT *
        FROM growth_journey_phases
        WHERE is_active = 1
        ORDER BY phase_order
        `
    );

    const journey = [];

    for (const phase of phases) {
        const progress = await recalculatePhaseProgress(
            db,
            youthId,
            phase.id,
            { asOf }
        );

        const visibleTasks = progress.tasks.filter(task =>
            task.visibility === 'visible' ||
            task.visibility === 'summary'
        );

        journey.push({
            phaseOrder: phase.phase_order,
            phaseKey: phase.phase_key,
            title: phase.title,
            subtitle: phase.subtitle,
            journeySegment: phase.journey_segment,
            memberDescription: phase.member_description,
            status: progress.status,
            progressPercent: progress.progressPercent,
            essentialCompleted: progress.essentialCompleted,
            essentialTotal: progress.essentialTotal,
            tasks: visibleTasks
        });
    }

    /*
     * Prayer Rhythm can give every future phase raw progress. Member-facing
     * sequencing must still advance one phase at a time, so only the first
     * non-completed phase is current and every later phase remains upcoming.
     */
    const activePhaseIndex =
        journey.findIndex(item => item.status !== 'completed');
    const sequencedJourney = journey.map((item, index) => ({
        ...item,
        sequenceState: item.status === 'completed'
            ? 'completed'
            : index === activePhaseIndex
                ? 'current'
                : 'upcoming'
    }));
    const currentPhase = activePhaseIndex >= 0
        ? sequencedJourney[activePhaseIndex]
        : sequencedJourney[sequencedJourney.length - 1] || null;
    const nextPhase = activePhaseIndex >= 0
        ? sequencedJourney[activePhaseIndex + 1] || null
        : null;

    let nextInvitation = null;
    if (currentPhase && currentPhase.status === 'ready') {
        nextInvitation = {
            kind: 'phase_ready',
            title: 'Ready for the next conversation',
            description: 'Your essential steps are complete. Stay connected as ministry leaders walk with you toward the next phase.',
            phaseKey: currentPhase.phaseKey,
            taskKey: null
        };
    } else if (currentPhase) {
        const incompleteTasks = currentPhase.tasks.filter(task => !task.completed);
        const incompleteEssential = incompleteTasks.find(
            item => item.classification === 'essential'
        );
        if (
            currentPhase.essentialCompleted < currentPhase.essentialTotal
            && !incompleteEssential
        ) {
            nextInvitation = {
                kind: 'essential',
                title: 'Continue with your community guide',
                description: 'A community or ministry leader will walk with you through the next essential step.',
                phaseKey: currentPhase.phaseKey,
                taskKey: null
            };
        }
        const task = incompleteEssential
            || incompleteTasks.find(item =>
                item.classification === 'growth'
                && item.evidenceType !== 'prayer_rhythm_recent'
            )
            || incompleteTasks[0]
            || null;

        if (!nextInvitation && task) {
            nextInvitation = {
                kind: task.classification,
                title: task.title,
                description: task.memberDescription || 'Continue this step with your community.',
                phaseKey: currentPhase.phaseKey,
                taskKey: task.taskKey
            };
        }
    }

    return {
        youthId,
        currentPhase,
        nextPhase,
        nextInvitation,
        phases: sequencedJourney
    };
}

async function completeReadyPhaseUnlocked(db, youthId, phaseKey, {
    actor = 'System'
} = {}) {
    const normalizedYouthId = normalizeGrowthMemberId(youthId);
    if (!normalizedYouthId) {
        throw growthAdvancementError(
            'INVALID_MEMBER_ID',
            'A valid member ID is required.'
        );
    }

    const normalizedPhaseKey = normalizeGrowthPhaseKey(phaseKey);
    if (!normalizedPhaseKey) {
        throw growthAdvancementError(
            'INVALID_PHASE_KEY',
            'A valid Growth Journey phase is required.'
        );
    }

    await run(db, 'BEGIN IMMEDIATE');

    try {
        const member = await get(
            db,
            'SELECT id, name FROM youth WHERE id = ? LIMIT 1',
            [normalizedYouthId]
        );
        if (!member) {
            throw growthAdvancementError('MEMBER_NOT_FOUND', 'Member not found.');
        }

        const phase = await getPhaseByKey(db, normalizedPhaseKey);
        if (!phase) {
            throw growthAdvancementError('PHASE_NOT_FOUND', 'Growth Journey phase not found.');
        }

        const storedProgress = await get(
            db,
            `SELECT * FROM growth_phase_progress
             WHERE youth_id = ? AND phase_id = ?
             LIMIT 1`,
            [normalizedYouthId, phase.id]
        );

        if (storedProgress?.status === 'completed') {
            const journey = await getMemberJourney(db, normalizedYouthId);

            /*
             * Recalculation is useful for an authoritative replay response,
             * but a replay itself must not update timestamps or other state.
             */
            await run(db, 'ROLLBACK');
            return {
                completed: false,
                idempotent: true,
                member,
                phase: journey.phases.find(item => item.phaseKey === normalizedPhaseKey),
                journey
            };
        }

        /*
         * Recalculate under the same write lock. Raw progress in later phases
         * may exist, but sequencing still makes only the first unfinished
         * phase eligible for leadership completion.
         */
        const journeyBefore = await getMemberJourney(db, normalizedYouthId);
        const targetPhase = journeyBefore.phases.find(
            item => item.phaseKey === normalizedPhaseKey
        );

        if (!targetPhase || journeyBefore.currentPhase?.phaseKey !== normalizedPhaseKey) {
            throw growthAdvancementError(
                'PHASE_NOT_CURRENT',
                'Only the current Growth Journey phase can be advanced.'
            );
        }

        if (targetPhase.status !== 'ready') {
            throw growthAdvancementError(
                'PHASE_NOT_READY',
                'The current Growth Journey phase is not ready for advancement.'
            );
        }

        if (
            targetPhase.essentialTotal > 0 &&
            targetPhase.essentialCompleted !== targetPhase.essentialTotal
        ) {
            throw growthAdvancementError(
                'ESSENTIALS_INCOMPLETE',
                'Essential Growth Journey requirements are incomplete.'
            );
        }

        const completedAt = new Date().toISOString();
        const update = await run(
            db,
            `UPDATE growth_phase_progress
             SET status = 'completed',
                 completed_at = ?,
                 completion_basis = 'leadership_approved',
                 updated_at = ?
             WHERE youth_id = ?
               AND phase_id = ?
               AND status = 'ready'
               AND completed_at IS NULL`,
            [completedAt, completedAt, normalizedYouthId, phase.id]
        );

        if (update.changes !== 1) {
            throw growthAdvancementError(
                'PHASE_UPDATE_CONFLICT',
                'The Growth Journey phase changed before it could be advanced.'
            );
        }

        const auditActor = typeof actor === 'string' && actor.trim()
            ? actor.trim()
            : 'System';
        await run(
            db,
            `INSERT INTO activity_logs (username, action, details, created_at)
             VALUES (?, 'GROWTH_PHASE_ADVANCED', ?, ?)`,
            [
                auditActor,
                `Completed ${phase.title} for Member ID ${normalizedYouthId}`,
                completedAt
            ]
        );

        const journey = await getMemberJourney(db, normalizedYouthId);
        await run(db, 'COMMIT');

        return {
            completed: true,
            idempotent: false,
            completedAt,
            completionBasis: 'leadership_approved',
            member,
            phase: journey.phases.find(item => item.phaseKey === normalizedPhaseKey),
            journey
        };
    } catch (error) {
        try {
            await run(db, 'ROLLBACK');
        } catch (_) {
            // Preserve the canonical advancement error.
        }
        throw error;
    }
}

async function completeReadyPhase(db, youthId, phaseKey, options = {}) {
    return withPhaseAdvancementMutation(
        db,
        () => completeReadyPhaseUnlocked(db, youthId, phaseKey, options)
    );
}


function getManilaMondayKey(value = new Date()) {
    const dateKey = manilaDate(value);

    const parts =
        dateKey
            .split('-')
            .map(Number);

    if (
        parts.length !== 3 ||
        parts.some(
            part =>
                !Number.isInteger(part)
        )
    ) {
        throw new Error(
            'Unable to calculate Prayer Partner week key'
        );
    }

    const [
        year,
        month,
        day
    ] = parts;

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

function shufflePrayerPartnerIds(
    memberIds,
    random = Math.random
) {
    const shuffled =
        [...memberIds];

    for (
        let index =
            shuffled.length - 1;
        index > 0;
        index -= 1
    ) {
        const sample =
            Number(random());

        if (
            !Number.isFinite(sample) ||
            sample < 0 ||
            sample >= 1
        ) {
            throw new Error(
                'Prayer Partner random source returned an invalid value'
            );
        }

        const swapIndex =
            Math.floor(
                sample *
                (index + 1)
            );

        [
            shuffled[index],
            shuffled[swapIndex]
        ] = [
            shuffled[swapIndex],
            shuffled[index]
        ];
    }

    return shuffled;
}

function isCompletePrayerPartnerSnapshot(
    rows,
    memberIds
) {
    if (
        !Array.isArray(rows) ||
        rows.length !==
            memberIds.length
    ) {
        return false;
    }

    const expected =
        new Set(
            memberIds.map(Number)
        );

    const senders =
        new Set();

    const partners =
        new Set();

    for (const row of rows) {
        const youthId =
            Number(row.youth_id);

        const partnerId =
            Number(row.pal_youth_id);

        if (
            !expected.has(youthId) ||
            !expected.has(partnerId) ||
            youthId === partnerId ||
            senders.has(youthId) ||
            partners.has(partnerId)
        ) {
            return false;
        }

        senders.add(youthId);
        partners.add(partnerId);
    }

    return (
        senders.size ===
            expected.size &&
        partners.size ===
            expected.size
    );
}

async function rotatePrayerPartners(
    db,
    {
        weekStart = null,
        now = new Date(),
        force = false,
        random = Math.random
    } = {}
) {
    const canonicalWeek =
        weekStart ||
        getManilaMondayKey(now);

    if (
        typeof canonicalWeek !==
            'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(
            canonicalWeek
        )
    ) {
        throw new Error(
            'Invalid Prayer Partner week key'
        );
    }

    const members =
        await all(
            db,
            `
            SELECT DISTINCT
                y.id
            FROM youth y
            WHERE y.id IS NOT NULL
              AND (
                    EXISTS (
                        SELECT 1
                        FROM secret_prayer_pals history
                        WHERE history.youth_id = y.id
                    )
                    OR TRIM(
                        COALESCE(
                            y.commitment_intent,
                            ''
                        )
                    ) <> ''
                    OR EXISTS (
                        SELECT 1
                        FROM growth_onboarding_enrollments enrollment
                        WHERE enrollment.youth_id = y.id
                          AND enrollment.status IN (
                              'active',
                              'completed'
                          )
                    )
              )
            ORDER BY y.id ASC
            `
        );

    const memberIds =
        members
            .map(
                row =>
                    Number(row.id)
            )
            .filter(
                id =>
                    Number.isInteger(id) &&
                    id > 0
            );

    if (memberIds.length < 2) {
        return {
            status:
                'insufficient_members',
            changed: false,
            weekStart:
                canonicalWeek,
            memberCount:
                memberIds.length,
            assignedCount: 0
        };
    }

    const existing =
        await all(
            db,
            `
            SELECT
                youth_id,
                pal_youth_id
            FROM secret_prayer_pals
            WHERE week_start = ?
            ORDER BY youth_id ASC
            `,
            [canonicalWeek]
        );

    if (
        !force &&
        isCompletePrayerPartnerSnapshot(
            existing,
            memberIds
        )
    ) {
        return {
            status:
                'already_complete',
            changed: false,
            weekStart:
                canonicalWeek,
            memberCount:
                memberIds.length,
            assignedCount:
                existing.length
        };
    }

    const shuffled =
        shufflePrayerPartnerIds(
            memberIds,
            random
        );

    const assignments =
        shuffled.map(
            (
                youthId,
                index
            ) => ({
                youthId,
                partnerId:
                    shuffled[
                        (
                            index + 1
                        ) %
                        shuffled.length
                    ]
            })
        );

    await run(
        db,
        'BEGIN IMMEDIATE'
    );

    try {
        await run(
            db,
            `
            DELETE FROM
                secret_prayer_pals
            WHERE week_start = ?
            `,
            [canonicalWeek]
        );

        for (
            const assignment
            of assignments
        ) {
            await run(
                db,
                `
                INSERT INTO
                    secret_prayer_pals (
                        youth_id,
                        pal_youth_id,
                        week_start
                    )
                VALUES (?, ?, ?)
                `,
                [
                    assignment.youthId,
                    assignment.partnerId,
                    canonicalWeek
                ]
            );
        }

        const verification =
            await all(
                db,
                `
                SELECT
                    youth_id,
                    pal_youth_id
                FROM
                    secret_prayer_pals
                WHERE week_start = ?
                ORDER BY youth_id ASC
                `,
                [canonicalWeek]
            );

        if (
            !isCompletePrayerPartnerSnapshot(
                verification,
                memberIds
            )
        ) {
            throw new Error(
                'Prayer Partner rotation verification failed'
            );
        }

        await run(
            db,
            'COMMIT'
        );

        return {
            status:
                existing.length > 0
                    ? 'rebuilt'
                    : 'created',
            changed: true,
            weekStart:
                canonicalWeek,
            memberCount:
                memberIds.length,
            assignedCount:
                verification.length
        };
    } catch (error) {
        try {
            await run(
                db,
                'ROLLBACK'
            );
        } catch (_) {
            // Preserve the original
            // transaction error.
        }

        throw error;
    }
}

module.exports = {
    run,
    get,
    all,
    manilaDate,
    getManilaMondayKey,
    rotatePrayerPartners,
    getPhaseByKey,
    getTaskByKey,
    effectiveGrowthMappingsForEvent,
    recordEvidence,
    recordEventAttendanceGrowthEvidence,
    getTaskEvidenceValue,
    recalculatePhaseProgress,
    recalculatePhaseByKey,
    enrollPrayerCovenantChallenge,
    enrollDefaultOnboarding,
    recordAccountCreated,
    ensureOnboardingPrayerPartner,
    recordMembershipIntent,
    withPrayerRhythmMutation,
    recordPrayerCovenantCompletion,
    getPrayerRhythmStatus,
    getDefaultOnboardingStatus,
    getMemberJourney,
    completeReadyPhase
};
