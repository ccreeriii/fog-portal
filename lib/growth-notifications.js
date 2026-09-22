'use strict';

const NotificationCenter =
    require('./notification-center');

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
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(
                            row || null
                        );
                    }
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

function normalizePhaseKey(
    value
) {
    if (
        typeof value !== 'string' ||
        !/^[a-z0-9_]{1,64}$/.test(
            value
        )
    ) {
        throw new TypeError(
            'A canonical phaseKey is required'
        );
    }

    return value;
}

function journeyReadyEventKey(
    youthId,
    phaseKey,
    version = 'v1'
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    const normalizedPhaseKey =
        normalizePhaseKey(
            phaseKey
        );

    if (
        typeof version !== 'string' ||
        !/^[a-z0-9_-]{1,32}$/i.test(
            version
        )
    ) {
        throw new TypeError(
            'A canonical transition version is required'
        );
    }

    return (
        `journey-phase-ready:`
        + `${normalizedYouthId}:`
        + `${normalizedPhaseKey}:`
        + version
    );
}

function isReadyTransition(
    phaseProgress
) {
    if (
        !phaseProgress ||
        typeof phaseProgress !== 'object'
    ) {
        return false;
    }

    if (
        phaseProgress.status !==
            'ready'
    ) {
        return false;
    }

    /*
     * The previous state is required.
     * We intentionally do not infer a transition
     * merely because a phase currently reads ready.
     */
    if (
        typeof phaseProgress
            .previousStatus !==
            'string'
    ) {
        return false;
    }

    return (
        phaseProgress.previousStatus
            !== 'ready' &&
        phaseProgress.previousStatus
            !== 'completed'
    );
}

async function createPhaseReadyNotification(
    db,
    {
        youthId,
        phaseProgress,
        transitionVersion = 'v1'
    } = {}
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    if (
        !isReadyTransition(
            phaseProgress
        )
    ) {
        return {
            eligible:
                false,
            created:
                false,
            reason:
                'not_a_ready_transition'
        };
    }

    const phaseKey =
        normalizePhaseKey(
            phaseProgress.phaseKey
        );

    const title =
        typeof phaseProgress.title ===
            'string' &&
        phaseProgress.title.trim()
            ? phaseProgress.title.trim()
            : phaseKey;

    const eventKey =
        journeyReadyEventKey(
            normalizedYouthId,
            phaseKey,
            transitionVersion
        );

    const before =
        await get(
            db,
            `SELECT id
             FROM notification_events
             WHERE event_key = ?
             LIMIT 1`,
            [
                eventKey
            ]
        );

    await NotificationCenter
        .createNotification(
            db,
            {
                eventKey,

                category:
                    'journey_progress',

                title:
                    `${title}: Your next step is ready`,

                message:
                    `You've completed the essential steps in ${title}. `
                    + `Open your Growth Journey to see the next invitation.`,

                importance:
                    'normal',

                actionUrl:
                    '/',

                sourceType:
                    'growth_journey',

                sourceId:
                    phaseProgress.phaseId,

                sourceActor:
                    'Growth Journey',

                metadata: {
                    transition:
                        'phase_ready',
                    phase_key:
                        phaseKey,
                    previous_status:
                        phaseProgress
                            .previousStatus,
                    status:
                        phaseProgress.status
                },

                recipientYouthIds: [
                    normalizedYouthId
                ]
            }
        );

    /*
     * Do not depend on an undocumented return
     * shape from createNotification(). Query the
     * canonical rows by their idempotency key.
     */
    const event =
        await get(
            db,
            `SELECT
                id,
                event_key,
                category,
                title
             FROM notification_events
             WHERE event_key = ?
             LIMIT 1`,
            [
                eventKey
            ]
        );

    if (!event) {
        throw new Error(
            'Canonical Journey notification event was not persisted'
        );
    }

    const recipient =
        await get(
            db,
            `SELECT
                id,
                youth_id,
                is_read
             FROM notification_recipients
             WHERE event_id = ?
               AND youth_id = ?
             LIMIT 1`,
            [
                event.id,
                normalizedYouthId
            ]
        );

    if (!recipient) {
        throw new Error(
            'Canonical Journey notification recipient was not persisted'
        );
    }

    return {
        eligible:
            true,

        created:
            !before,

        eventId:
            event.id,

        eventKey:
            event.event_key,

        recipientId:
            recipient.id,

        youthId:
            recipient.youth_id,

        phaseKey,

        previousStatus:
            phaseProgress
                .previousStatus,

        status:
            phaseProgress.status
    };
}

module.exports =
    Object.freeze({
        journeyReadyEventKey,
        isReadyTransition,
        createPhaseReadyNotification
    });
