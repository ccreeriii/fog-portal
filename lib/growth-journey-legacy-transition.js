'use strict';

const GrowthJourney = require('./growth-journey');

const TRANSITION_VERSION = 'legacy-growth-transition-v1';
const BULK_CONFIRMATION_TOKEN = 'APPLY_LEGACY_GROWTH_TRANSITION_V1';
const MEMBERSHIP_BASIS = 'legacy_membership_standing';
const SERVICE_BASIS = 'legacy_service_standing';

const CANONICAL_PHASES = Object.freeze([
    'encounter',
    'belong',
    'commit',
    'discern',
    'form',
    'serve',
    'be_sent'
]);

const FORMAL_MEMBER_TIERS = new Set([
    'committed member',
    'leader'
]);

const ORDINARY_NON_FORMAL_TIERS = new Set([
    '',
    'new member',
    'seeker',
    'integration period'
]);

/* These are the role values exposed by the current ministry product. */
const ACTIVE_MINISTRY_ROLES = new Set([
    'member',
    'core',
    'core member',
    'youth ministry head',
    'assistant ministry head',
    'ministry head'
]);

const NON_ACTIVE_MINISTRY_ROLES = new Set([
    'applicant',
    'integration period',
    'denied',
    'declined',
    'inactive',
    'former',
    'former member',
    'removed'
]);

const transitionQueues = new WeakMap();

function normalizeText(value) {
    return typeof value === 'string'
        ? value.trim()
        : '';
}

function normalizeKey(value) {
    return normalizeText(value).toLowerCase();
}

function positiveMemberId(value) {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw transitionError(
            'INVALID_MEMBER_ID',
            'A positive youth ID is required.'
        );
    }
    return id;
}

function transitionError(code, message) {
    return Object.assign(new Error(message), { code });
}

function requireDatabase(database) {
    if (
        !database ||
        typeof database.run !== 'function' ||
        typeof database.get !== 'function' ||
        typeof database.all !== 'function'
    ) {
        throw new TypeError('A SQLite database is required.');
    }
}

function normalizeOperator(value) {
    const actor = normalizeText(value);
    if (!actor || actor.length > 200) {
        throw transitionError(
            'OPERATOR_REQUIRED',
            'A bounded operator identity is required.'
        );
    }
    return actor;
}

async function withTransitionQueue(database, operation) {
    const previous = transitionQueues.get(database) || Promise.resolve();
    const current = previous.catch(() => {}).then(operation);
    let tracked;
    const release = () => {
        if (transitionQueues.get(database) === tracked) {
            transitionQueues.delete(database);
        }
    };
    tracked = current.then(release, release);
    transitionQueues.set(database, tracked);
    return current;
}

async function loadLegacyMemberContext(database, youthId) {
    requireDatabase(database);
    const memberId = positiveMemberId(youthId);
    const member = await GrowthJourney.get(
        database,
        `SELECT id, name, account_tier, commitment_intent,
                commitment_date, commitment_accepted_at,
                commitment_accepted_by
         FROM youth
         WHERE id = ?
         LIMIT 1`,
        [memberId]
    );

    if (!member) {
        throw transitionError('MEMBER_NOT_FOUND', 'Member not found.');
    }

    const ministryAssignments = await GrowthJourney.all(
        database,
        `SELECT mm.id AS mapping_id,
                mm.ministry_id,
                mm.role,
                mm.sub_role,
                mm.assigned_at,
                m.id AS canonical_ministry_id
         FROM ministry_members mm
         LEFT JOIN ministries m ON m.id = mm.ministry_id
         WHERE mm.youth_id = ?
         ORDER BY mm.id`,
        [memberId]
    );

    return {
        member,
        ministryAssignments
    };
}

function deriveLegacyStanding(context) {
    const member = context && context.member
        ? context.member
        : context;
    const ministryAssignments = Array.isArray(
        context && context.ministryAssignments
    )
        ? context.ministryAssignments
        : [];

    if (!member || !Number.isSafeInteger(Number(member.id))) {
        throw transitionError('INVALID_MEMBER', 'A canonical member is required.');
    }

    const tier = normalizeKey(member.account_tier);
    const acceptedAt = normalizeText(member.commitment_accepted_at);
    const acceptedBy = normalizeText(member.commitment_accepted_by);
    const commitmentDate = normalizeText(member.commitment_date);
    const formalTier = FORMAL_MEMBER_TIERS.has(tier);
    const formalAcceptance = Boolean(acceptedAt);

    if (acceptedBy && !formalAcceptance) {
        return manualReview(
            'membership_acceptor_without_acceptance_timestamp',
            member,
            ministryAssignments
        );
    }

    if (
        formalAcceptance &&
        ['new member', 'seeker', 'integration period'].includes(tier)
    ) {
        return manualReview(
            'formal_acceptance_conflicts_with_account_tier',
            member,
            ministryAssignments
        );
    }

    const invalidMappings = ministryAssignments.filter(assignment =>
        !Number.isSafeInteger(Number(assignment.mapping_id)) ||
        !Number.isSafeInteger(Number(assignment.ministry_id)) ||
        !Number.isSafeInteger(Number(assignment.canonical_ministry_id)) ||
        !normalizeText(assignment.role)
    );

    if (invalidMappings.length > 0) {
        return manualReview(
            'incomplete_current_ministry_assignment',
            member,
            ministryAssignments
        );
    }

    const activeAssignments = ministryAssignments.filter(assignment =>
        ACTIVE_MINISTRY_ROLES.has(normalizeKey(assignment.role))
    );
    const unknownAssignments = ministryAssignments.filter(assignment => {
        const role = normalizeKey(assignment.role);
        return !ACTIVE_MINISTRY_ROLES.has(role) &&
            !NON_ACTIVE_MINISTRY_ROLES.has(role);
    });

    if (activeAssignments.length > 0) {
        return {
            standingClass: 'active_servant',
            completionBasis: SERVICE_BASIS,
            manualReview: false,
            manualReviewReason: null,
            sourceSummary: buildSourceSummary(
                member,
                activeAssignments,
                ministryAssignments
            )
        };
    }

    if (unknownAssignments.length > 0) {
        return manualReview(
            'unrecognized_current_ministry_role',
            member,
            ministryAssignments
        );
    }

    if (formalTier || formalAcceptance) {
        return {
            standingClass: 'formal_member',
            completionBasis: MEMBERSHIP_BASIS,
            manualReview: false,
            manualReviewReason: null,
            sourceSummary: buildSourceSummary(
                member,
                [],
                ministryAssignments
            )
        };
    }

    if (!ORDINARY_NON_FORMAL_TIERS.has(tier)) {
        return manualReview(
            'unrecognized_account_tier_without_formal_acceptance',
            member,
            ministryAssignments
        );
    }

    if (commitmentDate) {
        return manualReview(
            'commitment_date_without_authoritative_formal_acceptance',
            member,
            ministryAssignments
        );
    }

    return {
        standingClass: 'unaffected',
        completionBasis: null,
        manualReview: false,
        manualReviewReason: null,
        sourceSummary: buildSourceSummary(
            member,
            [],
            ministryAssignments
        )
    };
}

function buildSourceSummary(member, activeAssignments, allAssignments) {
    return {
        formal_membership: {
            account_tier: normalizeText(member.account_tier) || null,
            commitment_accepted_at:
                normalizeText(member.commitment_accepted_at) || null,
            commitment_accepted_by_present:
                Boolean(normalizeText(member.commitment_accepted_by))
        },
        active_ministry_assignments: activeAssignments.map(assignment => ({
            mapping_id: Number(assignment.mapping_id),
            ministry_id: Number(assignment.ministry_id),
            role: normalizeText(assignment.role)
        })),
        current_ministry_assignments: allAssignments.map(assignment => ({
            mapping_id: Number(assignment.mapping_id),
            ministry_id: Number(assignment.ministry_id),
            role: normalizeText(assignment.role) || null
        })),
        current_ministry_assignment_count: allAssignments.length
    };
}

function manualReview(reason, member, assignments) {
    return {
        standingClass: 'manual_review',
        completionBasis: null,
        manualReview: true,
        manualReviewReason: reason,
        sourceSummary: buildSourceSummary(member, [], assignments)
    };
}

function summarizeJourney(journey) {
    return {
        current_phase: journey.currentPhase
            ? journey.currentPhase.phaseKey
            : null,
        phases: journey.phases.map(phase => ({
            phase_key: phase.phaseKey,
            status: phase.status,
            sequence_state: phase.sequenceState,
            progress_percent: phase.progressPercent,
            completion_basis: phase.completionBasis || null
        }))
    };
}

function previewTransition(context, currentJourney) {
    const derived = deriveLegacyStanding(context);
    const member = context.member;
    const base = {
        youth_id: Number(member.id),
        name: normalizeText(member.name) || `Member ${member.id}`,
        derived_legacy_standing: derived.standingClass,
        completion_basis: derived.completionBasis,
        source_summary: derived.sourceSummary,
        current_growth_journey: summarizeJourney(currentJourney),
        proposed_current_phase: currentJourney.currentPhase
            ? currentJourney.currentPhase.phaseKey
            : null,
        phases_to_grandfather: [],
        no_op: true,
        no_op_reason: null,
        manual_review: derived.manualReview,
        manual_review_reason: derived.manualReviewReason
    };

    if (derived.manualReview) return base;

    if (derived.standingClass === 'unaffected') {
        return {
            ...base,
            no_op_reason: 'no_authoritative_legacy_standing'
        };
    }

    const phases = currentJourney.phases;
    if (
        phases.length !== CANONICAL_PHASES.length ||
        phases.some((phase, index) => phase.phaseKey !== CANONICAL_PHASES[index])
    ) {
        return {
            ...base,
            derived_legacy_standing: 'manual_review',
            completion_basis: null,
            manual_review: true,
            manual_review_reason: 'noncanonical_growth_phase_sequence'
        };
    }

    const completedIndexes = phases
        .map((phase, index) => phase.status === 'completed' ? index : -1)
        .filter(index => index >= 0);
    const highestCompleted = completedIndexes.length > 0
        ? Math.max(...completedIndexes)
        : -1;

    if (
        highestCompleted >= 0 &&
        phases.slice(0, highestCompleted + 1)
            .some(phase => phase.status !== 'completed')
    ) {
        return {
            ...base,
            derived_legacy_standing: 'manual_review',
            completion_basis: null,
            manual_review: true,
            manual_review_reason: 'nonsequential_existing_growth_completion'
        };
    }

    const targetIndex = derived.standingClass === 'active_servant' ? 4 : 2;

    if (highestCompleted >= targetIndex) {
        return {
            ...base,
            no_op_reason: 'existing_journey_at_or_beyond_legacy_standing'
        };
    }

    if (
        phases.slice(0, targetIndex + 1)
            .some(phase => phase.status === 'paused')
    ) {
        return {
            ...base,
            derived_legacy_standing: 'manual_review',
            completion_basis: null,
            manual_review: true,
            manual_review_reason: 'paused_phase_requires_manual_review'
        };
    }

    const phasesToGrandfather = phases
        .slice(0, targetIndex + 1)
        .filter(phase => phase.status !== 'completed')
        .map(phase => phase.phaseKey);

    return {
        ...base,
        proposed_current_phase: phases[targetIndex + 1]
            ? phases[targetIndex + 1].phaseKey
            : null,
        phases_to_grandfather: phasesToGrandfather,
        no_op: phasesToGrandfather.length === 0,
        no_op_reason: phasesToGrandfather.length === 0
            ? 'legacy_floor_already_complete'
            : null
    };
}

async function previewMemberTransition(database, youthId) {
    const context = await loadLegacyMemberContext(database, youthId);
    const journey = await GrowthJourney.getMemberJourney(
        database,
        Number(context.member.id),
        { persist: false }
    );
    return previewTransition(context, journey);
}

async function listMemberIds(database) {
    requireDatabase(database);
    const rows = await GrowthJourney.all(
        database,
        'SELECT id FROM youth WHERE id IS NOT NULL ORDER BY id'
    );
    return rows
        .map(row => Number(row.id))
        .filter(id => Number.isSafeInteger(id) && id > 0);
}

function countPreviewCategories(candidates) {
    const counts = {
        new_unaffected: 0,
        formal_members: 0,
        active_servants: 0,
        no_op: 0,
        manual_review: 0
    };

    for (const candidate of candidates) {
        if (candidate.manual_review) {
            counts.manual_review += 1;
        } else if (candidate.derived_legacy_standing === 'unaffected') {
            counts.new_unaffected += 1;
        } else if (candidate.no_op) {
            counts.no_op += 1;
        } else if (candidate.derived_legacy_standing === 'formal_member') {
            counts.formal_members += 1;
        } else if (candidate.derived_legacy_standing === 'active_servant') {
            counts.active_servants += 1;
        }
    }

    return counts;
}

async function previewAllTransitions(database) {
    const candidates = [];
    for (const youthId of await listMemberIds(database)) {
        candidates.push(await previewMemberTransition(database, youthId));
    }
    return {
        mode: 'preview',
        transition_version: TRANSITION_VERSION,
        counts: countPreviewCategories(candidates),
        candidates
    };
}

function idempotencyKey(youthId, standingClass) {
    return `${TRANSITION_VERSION}:youth:${youthId}:standing:${standingClass}`;
}

async function applyMemberTransition(database, youthId, {
    operator,
    now = new Date(),
    injectFailureAfterPhase = null
} = {}) {
    requireDatabase(database);
    const memberId = positiveMemberId(youthId);
    const actor = normalizeOperator(operator);
    const appliedAt = now instanceof Date
        ? now.toISOString()
        : new Date(now).toISOString();

    if (!appliedAt || appliedAt === 'Invalid Date') {
        throw transitionError('INVALID_TIMESTAMP', 'A valid transition timestamp is required.');
    }

    return withTransitionQueue(database, async () => {
        await GrowthJourney.run(database, 'BEGIN IMMEDIATE');
        try {
            const context = await loadLegacyMemberContext(database, memberId);
            const before = await GrowthJourney.getMemberJourney(
                database,
                memberId,
                { persist: false }
            );
            const preview = previewTransition(context, before);

            const eligibleStanding =
                preview.derived_legacy_standing === 'formal_member' ||
                preview.derived_legacy_standing === 'active_servant';
            const key = eligibleStanding
                ? idempotencyKey(
                    memberId,
                    preview.derived_legacy_standing
                )
                : null;
            const existingAudit = key
                ? await GrowthJourney.get(
                    database,
                    `SELECT id FROM growth_legacy_transitions
                     WHERE idempotency_key = ?
                     LIMIT 1`,
                    [key]
                )
                : null;

            if (existingAudit) {
                await GrowthJourney.run(database, 'ROLLBACK');
                return {
                    applied: false,
                    idempotent: true,
                    audit_id: Number(existingAudit.id),
                    preview
                };
            }

            if (preview.manual_review || preview.no_op) {
                await GrowthJourney.run(database, 'ROLLBACK');
                return {
                    applied: false,
                    idempotent: false,
                    preview
                };
            }

            let phaseWrites = 0;
            for (const phaseKey of preview.phases_to_grandfather) {
                const phase = before.phases.find(item => item.phaseKey === phaseKey);
                const phaseRow = await GrowthJourney.get(
                    database,
                    `SELECT id FROM growth_journey_phases
                     WHERE phase_key = ? AND is_active = 1
                     LIMIT 1`,
                    [phaseKey]
                );
                if (!phase || !phaseRow) {
                    throw transitionError(
                        'PHASE_NOT_FOUND',
                        `Canonical phase is missing: ${phaseKey}`
                    );
                }

                const phaseWrite = await GrowthJourney.run(
                    database,
                    `INSERT INTO growth_phase_progress (
                        youth_id, phase_id, status, progress_percent,
                        essential_completed, essential_total,
                        started_at, completed_at, completion_basis, updated_at
                     ) VALUES (?, ?, 'completed', 100, ?, ?, ?, ?, ?, ?)
                     ON CONFLICT(youth_id, phase_id) DO UPDATE SET
                        status = 'completed',
                        progress_percent = MAX(
                            growth_phase_progress.progress_percent,
                            excluded.progress_percent
                        ),
                        started_at = COALESCE(
                            growth_phase_progress.started_at,
                            excluded.started_at
                        ),
                        completed_at = COALESCE(
                            growth_phase_progress.completed_at,
                            excluded.completed_at
                        ),
                        completion_basis = CASE
                            WHEN growth_phase_progress.status = 'completed'
                            THEN growth_phase_progress.completion_basis
                            ELSE excluded.completion_basis
                        END,
                        updated_at = excluded.updated_at
                     WHERE growth_phase_progress.status NOT IN ('completed', 'paused')`,
                    [
                        memberId,
                        Number(phaseRow.id),
                        Number(phase.essentialCompleted) || 0,
                        Number(phase.essentialTotal) || 0,
                        appliedAt,
                        appliedAt,
                        preview.completion_basis,
                        appliedAt
                    ]
                );

                if (phaseWrite.changes !== 1) {
                    throw transitionError(
                        'PHASE_UPDATE_CONFLICT',
                        `Growth phase changed during transition: ${phaseKey}`
                    );
                }

                phaseWrites += 1;
                if (
                    Number.isSafeInteger(injectFailureAfterPhase) &&
                    phaseWrites === injectFailureAfterPhase
                ) {
                    throw transitionError(
                        'INJECTED_FAILURE',
                        'Injected legacy transition failure.'
                    );
                }
            }

            const after = await GrowthJourney.getMemberJourney(
                database,
                memberId,
                { persist: false }
            );
            const audit = await GrowthJourney.run(
                database,
                `INSERT INTO growth_legacy_transitions (
                    youth_id, transition_version, standing_class,
                    completion_basis, source_summary_json,
                    phases_grandfathered_json, previous_journey_json,
                    resulting_journey_json, applied_at, operator_actor,
                    idempotency_key
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    memberId,
                    TRANSITION_VERSION,
                    preview.derived_legacy_standing,
                    preview.completion_basis,
                    JSON.stringify(preview.source_summary),
                    JSON.stringify(preview.phases_to_grandfather),
                    JSON.stringify(summarizeJourney(before)),
                    JSON.stringify(summarizeJourney(after)),
                    appliedAt,
                    actor,
                    key
                ]
            );

            await GrowthJourney.run(database, 'COMMIT');
            return {
                applied: true,
                idempotent: false,
                audit_id: Number(audit.lastID),
                completion_basis: preview.completion_basis,
                phases_grandfathered: preview.phases_to_grandfather,
                journey: summarizeJourney(after),
                preview
            };
        } catch (error) {
            await GrowthJourney.run(database, 'ROLLBACK').catch(() => {});
            throw error;
        }
    });
}

async function applyAllTransitions(database, {
    operator,
    confirmationToken,
    now = new Date()
} = {}) {
    if (confirmationToken !== BULK_CONFIRMATION_TOKEN) {
        throw transitionError(
            'BULK_CONFIRMATION_REQUIRED',
            `Bulk apply requires confirmation token ${BULK_CONFIRMATION_TOKEN}.`
        );
    }
    const actor = normalizeOperator(operator);
    const preview = await previewAllTransitions(database);
    const results = [];
    const errors = [];

    for (const candidate of preview.candidates) {
        if (candidate.manual_review || candidate.no_op) continue;
        try {
            results.push(await applyMemberTransition(
                database,
                candidate.youth_id,
                { operator: actor, now }
            ));
        } catch (error) {
            errors.push({
                youth_id: candidate.youth_id,
                code: error.code || 'TRANSITION_FAILED',
                error: error.message
            });
        }
    }

    return {
        mode: 'apply',
        transition_version: TRANSITION_VERSION,
        preview_counts: preview.counts,
        attempted: results.length + errors.length,
        applied: results.filter(result => result.applied).length,
        errors,
        results
    };
}

module.exports = Object.freeze({
    TRANSITION_VERSION,
    BULK_CONFIRMATION_TOKEN,
    MEMBERSHIP_BASIS,
    SERVICE_BASIS,
    CANONICAL_PHASES,
    ACTIVE_MINISTRY_ROLES,
    loadLegacyMemberContext,
    deriveLegacyStanding,
    summarizeJourney,
    previewTransition,
    previewMemberTransition,
    previewAllTransitions,
    countPreviewCategories,
    applyMemberTransition,
    applyAllTransitions
});
