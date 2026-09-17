'use strict';

const ACTIVE_MINISTRY_ROLES = Object.freeze([
    'Core Member',
    'Member',
    'Integration Period',
    'Ministry Head',
    'Youth Ministry Head',
    'Core',
    'Assistant Ministry Head'
]);

const ACTIVE_ROLE_SET = new Set(ACTIVE_MINISTRY_ROLES);

const priorityQueues = new WeakMap();

function serviceError(code, message) {
    return Object.assign(new Error(message), { code });
}

function normalizeId(value) {
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeActor(value) {
    return typeof value === 'string' && value.trim()
        ? value.trim()
        : null;
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function onRun(err) {
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

async function rollbackQuietly(db) {
    try {
        await run(db, 'ROLLBACK');
    } catch (_) {
        // Preserve original error.
    }
}

function isActiveMinistryRole(role) {
    return ACTIVE_ROLE_SET.has(
        typeof role === 'string'
            ? role.trim()
            : ''
    );
}

async function withPriorityQueue(db, operation) {
    const previous =
        priorityQueues.get(db) ||
        Promise.resolve();

    let tracked;

    const current = previous
        .catch(() => {})
        .then(operation);

    tracked = current.finally(() => {
        if (priorityQueues.get(db) === tracked) {
            priorityQueues.delete(db);
        }
    });

    priorityQueues.set(db, tracked);

    return tracked;
}

async function listPriorityCandidates(db, youthId) {
    const memberId = normalizeId(youthId);

    if (!memberId) {
        throw serviceError(
            'INVALID_MEMBER',
            'A valid member is required.'
        );
    }

    const rows = await all(
        db,
        `
        SELECT
            mm.id AS mapping_id,
            mm.ministry_id,
            m.name AS ministry_name,
            mm.role,
            mm.sub_role,
            COALESCE(mm.is_priority,0) AS is_priority
        FROM ministry_members mm
        JOIN ministries m
          ON m.id = mm.ministry_id
        WHERE mm.youth_id = ?
        ORDER BY
            COALESCE(mm.is_priority,0) DESC,
            m.name ASC
        `,
        [memberId]
    );

    return rows.filter(
        row => isActiveMinistryRole(row.role)
    );
}

async function setPriorityMinistry(
    db,
    {
        youthId,
        mappingId,
        actorUserId = null,
        actorName,
        source = 'member_profile',
        reason = null
    }
) {
    const memberId = normalizeId(youthId);
    const targetMappingId = normalizeId(mappingId);
    const actorId = normalizeId(actorUserId);
    const actor = normalizeActor(actorName);

    if (!memberId || !targetMappingId) {
        throw serviceError(
            'INVALID_PRIORITY_TARGET',
            'A valid ministry membership is required.'
        );
    }

    if (!actor) {
        throw serviceError(
            'ACTOR_REQUIRED',
            'An authenticated actor is required.'
        );
    }

    if (![
        'member_profile',
        'transition_intake',
        'leadership_review',
        'migration'
    ].includes(source)) {
        throw serviceError(
            'INVALID_PRIORITY_SOURCE',
            'Invalid priority source.'
        );
    }

    return withPriorityQueue(db, async () => {
        await run(db, 'BEGIN IMMEDIATE');

        try {
        const target = await get(
            db,
            `
            SELECT
                mm.id,
                mm.youth_id,
                mm.ministry_id,
                mm.role,
                COALESCE(mm.is_priority,0) AS is_priority
            FROM ministry_members mm
            WHERE mm.id = ?
              AND mm.youth_id = ?
            `,
            [targetMappingId, memberId]
        );

        if (!target) {
            throw serviceError(
                'MINISTRY_MEMBERSHIP_NOT_FOUND',
                'Ministry membership not found.'
            );
        }

        if (!isActiveMinistryRole(target.role)) {
            throw serviceError(
                'MINISTRY_NOT_PRIORITY_ELIGIBLE',
                'Only a current ministry relationship can be selected as Priority Ministry.'
            );
        }

        const conflictingActiveCase = await get(
            db,
            `
            SELECT
                id,
                ministry_id,
                status
            FROM ministry_discernment_cases
            WHERE youth_id = ?
              AND ministry_id <> ?
              AND status NOT IN (
                    'completed',
                    'withdrawn',
                    'not_recommended'
              )
            ORDER BY opened_at DESC, id DESC
            LIMIT 1
            `,
            [
                memberId,
                target.ministry_id
            ]
        );

        if (conflictingActiveCase) {
            throw serviceError(
                'ACTIVE_DISCERNMENT_PRIORITY_CONFLICT',
                'An active ministry discernment must be resolved before changing Priority Ministry.'
            );
        }

        const previousPriorities = await all(
            db,
            `
            SELECT id, ministry_id
            FROM ministry_members
            WHERE youth_id = ?
              AND COALESCE(is_priority,0) = 1
            ORDER BY id ASC
            `,
            [memberId]
        );

        if (
            previousPriorities.length > 1
        ) {
            throw serviceError(
                'MULTIPLE_PRIORITY_CONFLICT',
                'Multiple Priority Ministries are recorded for this member. Leadership review is required before changing Priority Ministry.'
            );
        }

        const previous =
            previousPriorities[0] ||
            null;

        if (
            previous &&
            Number(previous.id) === targetMappingId
        ) {
            await run(db, 'ROLLBACK');

            return {
                changed: false,
                idempotent: true,
                mappingId: targetMappingId
            };
        }

        await run(
            db,
            `
            UPDATE ministry_members
            SET is_priority = 0
            WHERE youth_id = ?
            `,
            [memberId]
        );

        const update = await run(
            db,
            `
            UPDATE ministry_members
            SET is_priority = 1
            WHERE id = ?
              AND youth_id = ?
            `,
            [targetMappingId, memberId]
        );

        if (update.changes !== 1) {
            throw serviceError(
                'PRIORITY_UPDATE_CONFLICT',
                'Priority Ministry changed unexpectedly.'
            );
        }

        await run(
            db,
            `
            INSERT INTO ministry_priority_history (
                youth_id,
                previous_mapping_id,
                new_mapping_id,
                changed_by_user_id,
                changed_by_name,
                source,
                reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
                memberId,
                previous ? previous.id : null,
                targetMappingId,
                actorId,
                actor,
                source,
                typeof reason === 'string'
                    ? reason.trim() || null
                    : null
            ]
        );

        await run(db, 'COMMIT');

        return {
            changed: true,
            idempotent: false,
            previousMappingId:
                previous ? Number(previous.id) : null,
            mappingId: targetMappingId,
            ministryId: Number(target.ministry_id)
        };
        } catch (error) {
            await rollbackQuietly(db);
            throw error;
        }
    });
}

module.exports = Object.freeze({
    ACTIVE_MINISTRY_ROLES,
    isActiveMinistryRole,
    listPriorityCandidates,
    setPriorityMinistry
});
