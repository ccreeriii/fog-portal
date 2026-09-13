'use strict';

const NotificationCenter =
    require('./notification-center');

const {
    normalizeEmail
} = require('./email-security');

const CHANNELS =
    Object.freeze([
        'push',
        'email'
    ]);

const CATEGORY_PREFERENCE_FIELD =
    Object.freeze({
        prayer_daily_growth:
            'prayer_daily_growth',

        journey_progress:
            'journey_progress',

        events_formation:
            'events_formation',

        membership_community:
            'membership_community',

        ministry_servant:
            'ministry_servant',

        prayer_partner:
            'prayer_partner',

        games_growth:
            'games_growth'
    });

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
                function(err) {
                    if (err) {
                        reject(err);
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
                (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row || null);
                    }
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
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(
                            rows || []
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

function normalizeChannels(
    channels
) {
    if (channels === undefined) {
        return [...CHANNELS];
    }

    if (!Array.isArray(channels)) {
        throw new TypeError(
            'channels must be an array'
        );
    }

    const result =
        [...new Set(channels)];

    for (const channel of result) {
        if (!CHANNELS.includes(channel)) {
            throw new TypeError(
                'Invalid notification delivery channel'
            );
        }
    }

    return result;
}

function safeErrorCode(
    value,
    fallback
) {
    if (
        typeof value === 'string' &&
        /^[A-Z0-9_:-]{1,100}$/.test(
            value
        )
    ) {
        return value;
    }

    return fallback;
}

function preferenceAllowsCategory(
    preferences,
    category
) {
    const field =
        CATEGORY_PREFERENCE_FIELD[
            category
        ];

    /*
     * leadership/system currently have no ordinary
     * per-category opt-out. They still respect each
     * channel's master Push/Email setting.
     */
    if (!field) {
        return true;
    }

    return (
        preferences[field] === true
    );
}

function pushRetryable(
    error
) {
    if (
        error &&
        error.retryable === true
    ) {
        return true;
    }

    const statusCode =
        Number(
            error &&
            (
                error.statusCode ??
                error.status
            )
        );

    return (
        statusCode === 408 ||
        statusCode === 425 ||
        statusCode === 429 ||
        statusCode >= 500
    );
}

function pushGone(
    error
) {
    const statusCode =
        Number(
            error &&
            (
                error.statusCode ??
                error.status
            )
        );

    return (
        statusCode === 404 ||
        statusCode === 410
    );
}

function isoNow(
    now
) {
    return new Date(
        Number(now())
    ).toISOString();
}

function normalizePublicOrigin(
    value
) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    if (typeof value !== 'string') {
        throw new TypeError(
            'publicOrigin must be a string'
        );
    }

    let parsed;

    try {
        parsed =
            new URL(value);
    } catch {
        throw new TypeError(
            'Invalid publicOrigin'
        );
    }

    if (
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash
    ) {
        throw new TypeError(
            'Invalid publicOrigin'
        );
    }

    return parsed.origin;
}

async function ensureDelivery(
    db,
    recipientId,
    channel
) {
    await run(
        db,
        `INSERT OR IGNORE
         INTO notification_deliveries (
            recipient_id,
            channel,
            status,
            attempt_count
         )
         VALUES (?, ?, 'pending', 0)`,
        [
            recipientId,
            channel
        ]
    );

    const row =
        await get(
            db,
            `SELECT *
             FROM notification_deliveries
             WHERE recipient_id = ?
               AND channel = ?
             LIMIT 1`,
            [
                recipientId,
                channel
            ]
        );

    if (!row) {
        throw new Error(
            'Unable to create notification delivery'
        );
    }

    return row;
}

async function updateDelivery(
    db,
    deliveryId,
    {
        status,
        attemptCount = null,
        providerReference = undefined,
        errorCode = undefined,
        sentAt = undefined,
        updatedAt
    }
) {
    const allowedStatuses =
        new Set([
            'pending',
            'sent',
            'skipped',
            'retry',
            'failed'
        ]);

    if (!allowedStatuses.has(status)) {
        throw new TypeError(
            'Invalid delivery status'
        );
    }

    await run(
        db,
        `UPDATE notification_deliveries
         SET status = ?,
             attempt_count =
                CASE
                    WHEN ? IS NULL
                    THEN attempt_count
                    ELSE ?
                END,
             provider_reference =
                CASE
                    WHEN ? = 0
                    THEN provider_reference
                    ELSE ?
                END,
             last_error_code =
                CASE
                    WHEN ? = 0
                    THEN last_error_code
                    ELSE ?
                END,
             sent_at =
                CASE
                    WHEN ? = 0
                    THEN sent_at
                    ELSE ?
                END,
             updated_at = ?
         WHERE id = ?`,
        [
            status,

            attemptCount,
            attemptCount,

            providerReference === undefined
                ? 0
                : 1,

            providerReference === undefined
                ? null
                : providerReference,

            errorCode === undefined
                ? 0
                : 1,

            errorCode === undefined
                ? null
                : errorCode,

            sentAt === undefined
                ? 0
                : 1,

            sentAt === undefined
                ? null
                : sentAt,

            updatedAt,
            deliveryId
        ]
    );

    return get(
        db,
        `SELECT *
         FROM notification_deliveries
         WHERE id = ?`,
        [
            deliveryId
        ]
    );
}

async function loadRecipientContext(
    db,
    recipientId
) {
    const normalizedRecipientId =
        positiveInteger(
            recipientId,
            'recipientId'
        );

    return get(
        db,
        `SELECT
            r.id AS recipient_id,
            r.youth_id,

            e.id AS event_id,
            e.event_key,
            e.category,
            e.title,
            e.message,
            e.importance,
            e.action_url,

            y.qr_code,
            y.email,
            y.email_verified,

            ps.id AS push_subscription_id,
            ps.subscription AS push_subscription

         FROM notification_recipients r

         JOIN notification_events e
           ON e.id = r.event_id

         JOIN youth y
           ON y.id = r.youth_id

         LEFT JOIN push_subscriptions ps
           ON ps.username = y.qr_code

         WHERE r.id = ?
         LIMIT 1`,
        [
            normalizedRecipientId
        ]
    );
}

function buildPushPayload(
    context
) {
    return {
        title:
            context.title,

        body:
            context.message,

        url:
            context.action_url ||
            '/'
    };
}

function buildEmailPayload(
    context,
    publicOrigin
) {
    const lines = [
        context.message
    ];

    if (
        context.action_url &&
        publicOrigin
    ) {
        lines.push(
            '',
            `Open in the Community Portal: ${publicOrigin}${context.action_url}`
        );
    }

    lines.push(
        '',
        'Fire Of God Ministries Community Portal'
    );

    return {
        subject:
            context.title,

        text:
            lines.join('\n')
    };
}

function createNotificationDeliveryEngine(
    {
        database,
        sendPush = null,
        emailOutbox = null,
        publicOrigin = null,
        now = Date.now
    } = {}
) {
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

    if (
        sendPush !== null &&
        typeof sendPush !== 'function'
    ) {
        throw new TypeError(
            'sendPush must be a function or null'
        );
    }

    if (
        emailOutbox !== null &&
        (
            !emailOutbox ||
            typeof emailOutbox.enqueue !==
                'function'
        )
    ) {
        throw new TypeError(
            'emailOutbox must expose enqueue()'
        );
    }

    if (typeof now !== 'function') {
        throw new TypeError(
            'now must be a function'
        );
    }

    const normalizedPublicOrigin =
        normalizePublicOrigin(
            publicOrigin
        );

    async function skipDelivery(
        delivery,
        code
    ) {
        return updateDelivery(
            database,
            delivery.id,
            {
                status:
                    'skipped',

                errorCode:
                    code,

                updatedAt:
                    isoNow(now)
            }
        );
    }

    async function dispatchPush(
        context,
        preferences
    ) {
        let delivery =
            await ensureDelivery(
                database,
                context.recipient_id,
                'push'
            );

        if (
            delivery.status === 'sent' ||
            delivery.status === 'skipped' ||
            delivery.status === 'failed'
        ) {
            return delivery;
        }

        if (
            preferences.push_enabled !== true
        ) {
            return skipDelivery(
                delivery,
                'PREFERENCE_DISABLED'
            );
        }

        if (
            !preferenceAllowsCategory(
                preferences,
                context.category
            )
        ) {
            return skipDelivery(
                delivery,
                'CATEGORY_DISABLED'
            );
        }

        if (
            !context.push_subscription
        ) {
            return skipDelivery(
                delivery,
                'PUSH_NOT_SUBSCRIBED'
            );
        }

        if (!sendPush) {
            return updateDelivery(
                database,
                delivery.id,
                {
                    status:
                        'retry',

                    errorCode:
                        'PUSH_TRANSPORT_UNAVAILABLE',

                    updatedAt:
                        isoNow(now)
                }
            );
        }

        let parsedSubscription;

        try {
            parsedSubscription =
                JSON.parse(
                    context.push_subscription
                );
        } catch {
            return updateDelivery(
                database,
                delivery.id,
                {
                    status:
                        'failed',

                    attemptCount:
                        Number(
                            delivery.attempt_count
                        ) + 1,

                    errorCode:
                        'PUSH_SUBSCRIPTION_INVALID',

                    updatedAt:
                        isoNow(now)
                }
            );
        }

        const nextAttempt =
            Number(
                delivery.attempt_count
            ) + 1;

        try {
            const result =
                await sendPush({
                    subscription:
                        parsedSubscription,

                    payload:
                        buildPushPayload(
                            context
                        ),

                    context
                });

            delivery =
                await updateDelivery(
                    database,
                    delivery.id,
                    {
                        status:
                            'sent',

                        attemptCount:
                            nextAttempt,

                        providerReference:
                            result &&
                            typeof result
                                .providerReference ===
                                'string'
                                ? result
                                    .providerReference
                                    .slice(
                                        0,
                                        500
                                    )
                                : null,

                        errorCode:
                            null,

                        sentAt:
                            isoNow(now),

                        updatedAt:
                            isoNow(now)
                    }
                );

            return delivery;
        } catch (error) {
            if (
                pushGone(error) &&
                context
                    .push_subscription_id
            ) {
                await run(
                    database,
                    `DELETE
                     FROM push_subscriptions
                     WHERE id = ?`,
                    [
                        context
                            .push_subscription_id
                    ]
                );
            }

            const retryable =
                pushRetryable(error);

            return updateDelivery(
                database,
                delivery.id,
                {
                    status:
                        retryable
                            ? 'retry'
                            : 'failed',

                    attemptCount:
                        nextAttempt,

                    errorCode:
                        pushGone(error)
                            ? 'PUSH_SUBSCRIPTION_GONE'
                            : safeErrorCode(
                                error &&
                                error.code,
                                retryable
                                    ? 'PUSH_TRANSIENT_FAILURE'
                                    : 'PUSH_DELIVERY_FAILED'
                            ),

                    updatedAt:
                        isoNow(now)
                }
            );
        }
    }

    async function dispatchEmail(
        context,
        preferences
    ) {
        let delivery =
            await ensureDelivery(
                database,
                context.recipient_id,
                'email'
            );

        /*
         * Once an Email job has been handed safely to
         * the encrypted outbox, replay must not enqueue
         * another copy while the first job is active.
         */
        if (
            delivery.status === 'sent' ||
            delivery.status === 'skipped' ||
            delivery.status === 'failed' ||
            (
                delivery.provider_reference &&
                delivery.provider_reference
                    .startsWith(
                        'email_outbox:'
                    )
            )
        ) {
            return delivery;
        }

        if (
            preferences.email_enabled !== true
        ) {
            return skipDelivery(
                delivery,
                'PREFERENCE_DISABLED'
            );
        }

        if (
            !preferenceAllowsCategory(
                preferences,
                context.category
            )
        ) {
            return skipDelivery(
                delivery,
                'CATEGORY_DISABLED'
            );
        }

        const normalizedEmail =
            normalizeEmail(
                context.email
            );

        if (
            Number(
                context.email_verified
            ) !== 1 ||
            !normalizedEmail
        ) {
            return skipDelivery(
                delivery,
                'EMAIL_NOT_VERIFIED'
            );
        }

        if (!emailOutbox) {
            return updateDelivery(
                database,
                delivery.id,
                {
                    status:
                        'retry',

                    errorCode:
                        'EMAIL_OUTBOX_UNAVAILABLE',

                    updatedAt:
                        isoNow(now)
                }
            );
        }

        try {
            const queued =
                await emailOutbox
                    .enqueue({
                        recipient:
                            normalizedEmail,

                        messageType:
                            'notification_center',

                        payload:
                            buildEmailPayload(
                                context,
                                normalizedPublicOrigin
                            ),

                        dedupeKey:
                            `notification-email:${context.event_key}:${context.youth_id}`
                    });

            if (
                !queued ||
                !Number.isSafeInteger(
                    Number(
                        queued.id
                    )
                ) ||
                Number(
                    queued.id
                ) <= 0
            ) {
                throw Object.assign(
                    new Error(
                        'Email outbox did not return a valid job'
                    ),
                    {
                        code:
                            'EMAIL_OUTBOX_QUEUE_INVALID',
                        retryable:
                            true
                    }
                );
            }

            return updateDelivery(
                database,
                delivery.id,
                {
                    status:
                        'pending',

                    providerReference:
                        `email_outbox:${Number(queued.id)}`,

                    errorCode:
                        null,

                    updatedAt:
                        isoNow(now)
                }
            );
        } catch (error) {
            return updateDelivery(
                database,
                delivery.id,
                {
                    status:
                        error &&
                        error.retryable === false
                            ? 'failed'
                            : 'retry',

                    errorCode:
                        safeErrorCode(
                            error &&
                            error.code,
                            'EMAIL_OUTBOX_QUEUE_FAILED'
                        ),

                    updatedAt:
                        isoNow(now)
                }
            );
        }
    }

    async function dispatchRecipient(
        recipientId,
        {
            channels
        } = {}
    ) {
        const context =
            await loadRecipientContext(
                database,
                recipientId
            );

        if (!context) {
            throw new RangeError(
                'Notification recipient not found'
            );
        }

        const preferences =
            await NotificationCenter
                .getPreferences(
                    database,
                    context.youth_id
                );

        const normalizedChannels =
            normalizeChannels(
                channels
            );

        const results = {};

        for (
            const channel
            of normalizedChannels
        ) {
            if (channel === 'push') {
                results.push =
                    await dispatchPush(
                        context,
                        preferences
                    );
            } else if (
                channel === 'email'
            ) {
                results.email =
                    await dispatchEmail(
                        context,
                        preferences
                    );
            }
        }

        return {
            recipient_id:
                context.recipient_id,

            youth_id:
                context.youth_id,

            event_id:
                context.event_id,

            event_key:
                context.event_key,

            deliveries:
                results
        };
    }

    async function dispatchEvent(
        eventId,
        options = {}
    ) {
        const normalizedEventId =
            positiveInteger(
                eventId,
                'eventId'
            );

        const recipients =
            await all(
                database,
                `SELECT id
                 FROM notification_recipients
                 WHERE event_id = ?
                 ORDER BY id`,
                [
                    normalizedEventId
                ]
            );

        const results = [];

        /*
         * Sequential on purpose: external notification
         * delivery should not create an uncontrolled
         * provider burst on the Raspberry Pi.
         */
        for (const row of recipients) {
            results.push(
                await dispatchRecipient(
                    row.id,
                    options
                )
            );
        }

        return results;
    }

    async function reconcileEmailDeliveries(
        {
            limit = 100
        } = {}
    ) {
        const normalizedLimit =
            Math.min(
                500,
                Math.max(
                    1,
                    Number.parseInt(
                        limit,
                        10
                    ) || 100
                )
            );

        const deliveries =
            await all(
                database,
                `SELECT *
                 FROM notification_deliveries
                 WHERE channel = 'email'
                   AND status IN (
                       'pending',
                       'retry'
                   )
                   AND provider_reference
                       LIKE 'email_outbox:%'
                 ORDER BY id
                 LIMIT ?`,
                [
                    normalizedLimit
                ]
            );

        const results = [];

        for (
            const delivery
            of deliveries
        ) {
            const match =
                /^email_outbox:(\d+)$/
                    .exec(
                        delivery
                            .provider_reference ||
                        ''
                    );

            if (!match) {
                continue;
            }

            const outboxId =
                Number(
                    match[1]
                );

            const outboxRow =
                await get(
                    database,
                    `SELECT
                        id,
                        status,
                        retry_count,
                        sent_at,
                        provider_message_id,
                        last_error_code
                     FROM email_outbox
                     WHERE id = ?
                     LIMIT 1`,
                    [
                        outboxId
                    ]
                );

            if (!outboxRow) {
                results.push(
                    await updateDelivery(
                        database,
                        delivery.id,
                        {
                            status:
                                'failed',

                            errorCode:
                                'EMAIL_OUTBOX_JOB_MISSING',

                            updatedAt:
                                isoNow(now)
                        }
                    )
                );

                continue;
            }

            if (
                outboxRow.status ===
                'sent'
            ) {
                results.push(
                    await updateDelivery(
                        database,
                        delivery.id,
                        {
                            status:
                                'sent',

                            attemptCount:
                                Number(
                                    outboxRow
                                        .retry_count
                                ) + 1,

                            providerReference:
                                outboxRow
                                    .provider_message_id
                                    ? String(
                                        outboxRow
                                            .provider_message_id
                                    ).slice(
                                        0,
                                        500
                                    )
                                    : delivery
                                        .provider_reference,

                            errorCode:
                                null,

                            sentAt:
                                outboxRow
                                    .sent_at
                                    ? new Date(
                                        Number(
                                            outboxRow
                                                .sent_at
                                        )
                                    ).toISOString()
                                    : isoNow(now),

                            updatedAt:
                                isoNow(now)
                        }
                    )
                );

                continue;
            }

            if (
                outboxRow.status ===
                'failed'
            ) {
                results.push(
                    await updateDelivery(
                        database,
                        delivery.id,
                        {
                            status:
                                'failed',

                            attemptCount:
                                Number(
                                    outboxRow
                                        .retry_count
                                ),

                            errorCode:
                                safeErrorCode(
                                    outboxRow
                                        .last_error_code,
                                    'EMAIL_DELIVERY_FAILED'
                                ),

                            updatedAt:
                                isoNow(now)
                        }
                    )
                );

                continue;
            }

            results.push(
                await updateDelivery(
                    database,
                    delivery.id,
                    {
                        status:
                            outboxRow.status ===
                                'retry'
                                ? 'retry'
                                : 'pending',

                        attemptCount:
                            Number(
                                outboxRow
                                    .retry_count
                            ),

                        errorCode:
                            outboxRow
                                .last_error_code
                                ? safeErrorCode(
                                    outboxRow
                                        .last_error_code,
                                    'EMAIL_DELIVERY_PENDING'
                                )
                                : null,

                        updatedAt:
                            isoNow(now)
                    }
                )
            );
        }

        return results;
    }

    return Object.freeze({
        dispatchRecipient,
        dispatchEvent,
        reconcileEmailDeliveries
    });
}

module.exports =
    Object.freeze({
        CHANNELS,
        CATEGORY_PREFERENCE_FIELD,
        createNotificationDeliveryEngine
    });
