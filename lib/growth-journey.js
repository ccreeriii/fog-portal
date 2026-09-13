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
        const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
        if (match) return match[1];
    }

    const date = value instanceof Date ? value : new Date(value || Date.now());

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

async function getTaskEvidenceValue(db, youthId, taskId) {
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
        evidence: Number(row?.total || 0),
        addedCredit: Number(override?.added_credit || 0),
        forcedComplete: Number(override?.forced_complete || 0) === 1
    };
}

async function recalculatePhaseProgress(db, youthId, phaseId) {
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
        const evidence = await getTaskEvidenceValue(db, youthId, task.id);

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
            classification: task.classification,
            visibility: task.visibility,
            evidenceType: task.evidence_type,
            target,
            value,
            ratio,
            completed
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
    let status = existing?.status || 'not_started';
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
        status,
        progressPercent,
        essentialCompleted,
        essentialTotal,
        tasks: taskProgress
    };
}

async function recalculatePhaseByKey(db, youthId, phaseKey) {
    const phase = await getPhaseByKey(db, phaseKey);

    if (!phase) throw new Error(`Unknown growth phase: ${phaseKey}`);

    return recalculatePhaseProgress(db, youthId, phase.id);
}

async function enrollDefaultOnboarding(db, youthId, {
    triggerType = 'membership_intent',
    triggerSourceId = null,
    occurredAt = null
} = {}) {
    if (!youthId) throw new Error('youthId is required');

    const template = await get(
        db,
        `
        SELECT *
        FROM growth_onboarding_templates
        WHERE is_default = 1
          AND is_active = 1
        ORDER BY id DESC
        LIMIT 1
        `
    );

    if (!template) {
        return {
            enrolled: false,
            reason: 'no_default_template'
        };
    }

    if (
        Number(template.auto_enroll_enabled) !== 1 ||
        Number(template.is_paused) === 1
    ) {
        return {
            enrolled: false,
            reason: 'template_not_enrolling',
            template
        };
    }

    const existing = await get(
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

    if (existing) {
        return {
            enrolled: false,
            reason: 'already_enrolled',
            template,
            enrollment: existing
        };
    }

    const timestamp = normaliseTimestamp(occurredAt);

    const inserted = await run(
        db,
        `
        INSERT INTO growth_onboarding_enrollments (
            youth_id,
            template_id,
            status,
            trigger_type,
            trigger_source_id,
            enrolled_at,
            started_at,
            completed_days
        )
        VALUES (?, ?, 'active', ?, ?, ?, ?, 0)
        `,
        [
            youthId,
            template.id,
            triggerType,
            triggerSourceId,
            timestamp,
            timestamp
        ]
    );

    const enrollment = await get(
        db,
        `
        SELECT *
        FROM growth_onboarding_enrollments
        WHERE id = ?
        `,
        [inserted.lastID]
    );

    return {
        enrolled: true,
        template,
        enrollment
    };
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

async function recordPrayerCovenantCompletion(db, youthId, {
    sourceKey = null,
    completedAt = null,
    actor = 'System',
    details = {}
} = {}) {
    const timestamp = normaliseTimestamp(completedAt);
    const completionDate = manilaDate(timestamp);

    const enrollment = await get(
        db,
        `
        SELECT
            e.*,
            t.duration_days,
            t.template_code,
            t.title AS template_title,
            t.is_paused AS template_paused
        FROM growth_onboarding_enrollments e
        JOIN growth_onboarding_templates t
          ON t.id = e.template_id
        WHERE e.youth_id = ?
          AND t.is_default = 1
          AND t.is_active = 1
        ORDER BY e.id DESC
        LIMIT 1
        `,
        [youthId]
    );

    if (!enrollment) {
        return {
            credited: false,
            reason: 'no_active_welcome_journey'
        };
    }

    if (
        enrollment.status === 'paused' ||
        Number(enrollment.template_paused) === 1
    ) {
        return {
            credited: false,
            reason: 'welcome_journey_paused',
            enrollment
        };
    }

    if (enrollment.status === 'completed') {
        return {
            credited: false,
            reason: 'welcome_journey_complete',
            enrollment
        };
    }

    if (enrollment.status !== 'active') {
        return {
            credited: false,
            reason: 'welcome_journey_not_active',
            enrollment
        };
    }

    const alreadyToday = await get(
        db,
        `
        SELECT *
        FROM growth_onboarding_daily_completions
        WHERE enrollment_id = ?
          AND completion_date = ?
        LIMIT 1
        `,
        [enrollment.id, completionDate]
    );

    if (alreadyToday) {
        return {
            credited: false,
            reason: 'already_credited_today',
            enrollment,
            dailyCompletion: alreadyToday
        };
    }

    const duration = Math.max(
        Number(enrollment.duration_days) || 21,
        1
    );

    const nextDay = Math.min(
        Number(enrollment.completed_days || 0) + 1,
        duration
    );

    const dailySourceKey = sourceKey
        || `prayer-covenant:${enrollment.id}:${completionDate}`;

    const inserted = await run(
        db,
        `
        INSERT INTO growth_onboarding_daily_completions (
            enrollment_id,
            completion_date,
            day_number,
            source_key,
            completed_at
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            enrollment.id,
            completionDate,
            nextDay,
            dailySourceKey,
            timestamp
        ]
    );

    const completed = nextDay >= duration;

    await run(
        db,
        `
        UPDATE growth_onboarding_enrollments
        SET
            completed_days = ?,
            status = ?,
            completed_at = CASE
                WHEN ? = 1 THEN ?
                ELSE completed_at
            END,
            updated_at = ?
        WHERE id = ?
        `,
        [
            nextDay,
            completed ? 'completed' : 'active',
            completed ? 1 : 0,
            timestamp,
            timestamp,
            enrollment.id
        ]
    );

    const task = await getTaskByKey(
        db,
        'encounter-prayer-covenant-21'
    );

    if (!task) {
        throw new Error(
            'Growth task encounter-prayer-covenant-21 is not configured'
        );
    }

    await recordEvidence(db, {
        youthId,
        taskId: task.id,
        evidenceType: 'onboarding_prayer_day',
        sourceTable: 'growth_onboarding_daily_completions',
        sourceId: inserted.lastID,
        sourceKey: `onboarding:${enrollment.id}:day:${nextDay}`,
        numericValue: 1,
        occurredAt: timestamp,
        details: {
            ...details,
            dayNumber: nextDay,
            completionDate,
            templateCode: enrollment.template_code
        },
        actor
    });

    const encounter = await recalculatePhaseByKey(
        db,
        youthId,
        'encounter'
    );

    const refreshedEnrollment = await get(
        db,
        `
        SELECT *
        FROM growth_onboarding_enrollments
        WHERE id = ?
        `,
        [enrollment.id]
    );

    return {
        credited: true,
        dayNumber: nextDay,
        completed,
        enrollment: refreshedEnrollment,
        encounter
    };
}

async function getDefaultOnboardingStatus(db, youthId) {
    if (!youthId) throw new Error('youthId is required');

    const template = await get(
        db,
        `
        SELECT *
        FROM growth_onboarding_templates
        WHERE is_default = 1
          AND is_active = 1
        ORDER BY id DESC
        LIMIT 1
        `
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


async function getMemberJourney(db, youthId) {
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
            phase.id
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

    const currentPhase =
        journey.find(item => item.status !== 'completed')
        || journey[journey.length - 1]
        || null;

    return {
        youthId,
        currentPhase,
        phases: journey
    };
}

module.exports = {
    run,
    get,
    all,
    manilaDate,
    getPhaseByKey,
    getTaskByKey,
    recordEvidence,
    getTaskEvidenceValue,
    recalculatePhaseProgress,
    recalculatePhaseByKey,
    enrollDefaultOnboarding,
    recordAccountCreated,
    ensureOnboardingPrayerPartner,
    recordMembershipIntent,
    recordPrayerCovenantCompletion,
    getDefaultOnboardingStatus,
    getMemberJourney
};
