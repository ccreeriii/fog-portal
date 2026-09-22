'use strict';

const CATEGORIES = Object.freeze([
    'prayer_daily_growth',
    'journey_progress',
    'events_formation',
    'membership_community',
    'ministry_servant',
    'prayer_partner',
    'games_growth',
    'leadership',
    'system'
]);

const IMPORTANCE_LEVELS = Object.freeze([
    'low',
    'normal',
    'important',
    'critical'
]);

const DEFAULT_PREFERENCES = Object.freeze({
    push_enabled: true,
    email_enabled: false,

    prayer_daily_growth: true,
    journey_progress: true,
    events_formation: true,
    membership_community: true,
    ministry_servant: true,
    prayer_partner: true,
    games_growth: true,

    preferred_prayer_time: null,
    quiet_hours_start: null,
    quiet_hours_end: null
});

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(
            sql,
            params,
            function (error) {
                if (error) {
                    reject(error);
                    return;
                }

                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        );
    });
}

function get(db, sql, params = []) {
    return new Promise((resolve, reject) => {
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
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
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
    });
}

function positiveInteger(value, label) {
    const normalized = Number(value);

    if (
        !Number.isSafeInteger(normalized) ||
        normalized <= 0
    ) {
        throw new TypeError(
            `${label} must be a positive integer`
        );
    }

    return normalized;
}

function boundedText(value, label, maxLength) {
    if (typeof value !== 'string') {
        throw new TypeError(
            `${label} must be text`
        );
    }

    const normalized =
        value.trim();

    if (
        normalized.length === 0 ||
        normalized.length > maxLength
    ) {
        throw new RangeError(
            `${label} is invalid`
        );
    }

    return normalized;
}

function optionalBoundedText(
    value,
    label,
    maxLength
) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    return boundedText(
        value,
        label,
        maxLength
    );
}

function normalizeRecipients(values) {
    if (!Array.isArray(values)) {
        throw new TypeError(
            'recipientYouthIds must be an array'
        );
    }

    const unique = [];

    const seen =
        new Set();

    for (const value of values) {
        const id =
            positiveInteger(
                value,
                'recipient youth ID'
            );

        if (seen.has(id)) {
            continue;
        }

        seen.add(id);
        unique.push(id);
    }

    if (unique.length === 0) {
        throw new RangeError(
            'At least one recipient is required'
        );
    }

    if (unique.length > 5000) {
        throw new RangeError(
            'Too many notification recipients'
        );
    }

    return unique;
}

function safeJsonObject(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return {};
    }

    if (
        typeof value !== 'object' ||
        Array.isArray(value)
    ) {
        throw new TypeError(
            'metadata must be an object'
        );
    }

    const serialized =
        JSON.stringify(value);

    if (serialized.length > 12000) {
        throw new RangeError(
            'notification metadata is too large'
        );
    }

    return value;
}

function parseMetadata(value) {
    if (
        typeof value !== 'string' ||
        value.length === 0
    ) {
        return {};
    }

    try {
        const parsed =
            JSON.parse(value);

        return (
            parsed &&
            typeof parsed === 'object' &&
            !Array.isArray(parsed)
        )
            ? parsed
            : {};
    } catch {
        return {};
    }
}

function normalizeLocalActionUrl(value) {
    const normalized =
        optionalBoundedText(
            value,
            'actionUrl',
            800
        );

    if (normalized === null) {
        return null;
    }

    /*
     * Canonical Notification actions are always internal
     * Community Portal paths.
     *
     * Reject protocol-relative URLs, browser-normalized
     * backslashes, and control characters so the same
     * stored action is safe for Inbox, Push, and Email.
     */
    if (
        !normalized.startsWith('/') ||
        normalized.startsWith('//') ||
        normalized.includes('\\') ||
        /[\u0000-\u001F\u007F]/.test(
            normalized
        )
    ) {
        throw new TypeError(
            'actionUrl must be a local Portal path'
        );
    }

    return normalized;
}

async function createNotification(
    db,
    {
        eventKey,
        category,
        title,
        message,
        importance = 'normal',
        actionUrl = null,
        sourceType = 'system',
        sourceId = null,
        sourceActor = null,
        metadata = {},
        recipientYouthIds,
        createdAt = null
    }
) {
    const normalizedEventKey =
        boundedText(
            eventKey,
            'eventKey',
            240
        );

    if (!CATEGORIES.includes(category)) {
        throw new RangeError(
            'Invalid notification category'
        );
    }

    if (
        !IMPORTANCE_LEVELS.includes(
            importance
        )
    ) {
        throw new RangeError(
            'Invalid notification importance'
        );
    }

    const normalizedTitle =
        boundedText(
            title,
            'title',
            180
        );

    const normalizedMessage =
        boundedText(
            message,
            'message',
            5000
        );

    const normalizedActionUrl =
        normalizeLocalActionUrl(
            actionUrl
        );

    const normalizedSourceType =
        boundedText(
            sourceType,
            'sourceType',
            100
        );

    const normalizedSourceActor =
        optionalBoundedText(
            sourceActor,
            'sourceActor',
            250
        );

    let normalizedSourceId = null;

    if (
        sourceId !== null &&
        sourceId !== undefined
    ) {
        normalizedSourceId =
            positiveInteger(
                sourceId,
                'sourceId'
            );
    }

    const normalizedMetadata =
        safeJsonObject(metadata);

    const recipients =
        normalizeRecipients(
            recipientYouthIds
        );

    const timestamp =
        createdAt === null ||
        createdAt === undefined
            ? new Date().toISOString()
            : boundedText(
                createdAt,
                'createdAt',
                80
            );

    /*
     * Notifications are intentionally downstream and
     * retry-safe rather than wrapping unrelated source
     * activity inside one broad transaction.
     *
     * If recipient insertion is interrupted, replaying
     * the same eventKey safely fills only missing
     * recipients because both levels are deduplicated.
     */
    const eventInsert =
        await run(
            db,
            `INSERT OR IGNORE INTO notification_events (
                event_key,
                category,
                title,
                message,
                importance,
                action_url,
                source_type,
                source_id,
                source_actor,
                metadata_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                normalizedEventKey,
                category,
                normalizedTitle,
                normalizedMessage,
                importance,
                normalizedActionUrl,
                normalizedSourceType,
                normalizedSourceId,
                normalizedSourceActor,
                JSON.stringify(
                    normalizedMetadata
                ),
                timestamp
            ]
        );

    const event =
        await get(
            db,
            `SELECT *
             FROM notification_events
             WHERE event_key = ?
             LIMIT 1`,
            [
                normalizedEventKey
            ]
        );

    if (!event) {
        throw new Error(
            'Unable to resolve canonical notification event'
        );
    }

    let insertedRecipients = 0;

    for (const youthId of recipients) {
        const result =
            await run(
                db,
                `INSERT OR IGNORE INTO notification_recipients (
                    event_id,
                    youth_id,
                    created_at
                )
                VALUES (?, ?, ?)`,
                [
                    event.id,
                    youthId,
                    timestamp
                ]
            );

        insertedRecipients +=
            Number(result.changes || 0);
    }

    return {
        eventId: event.id,
        eventKey: event.event_key,
        eventInserted:
            Number(eventInsert.changes || 0) === 1,
        recipientCount:
            recipients.length,
        insertedRecipients
    };
}

async function listNotifications(
    db,
    youthId,
    {
        unreadOnly = false,
        limit = 50
    } = {}
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    const normalizedLimit =
        Number(limit);

    if (
        !Number.isSafeInteger(
            normalizedLimit
        ) ||
        normalizedLimit < 1 ||
        normalizedLimit > 100
    ) {
        throw new RangeError(
            'limit must be between 1 and 100'
        );
    }

    const rows =
        await all(
            db,
            `SELECT
                r.id AS recipient_id,
                r.event_id,
                r.is_read,
                r.read_at,
                r.created_at AS recipient_created_at,

                e.event_key,
                e.category,
                e.title,
                e.message,
                e.importance,
                e.action_url,
                e.source_type,
                e.source_id,
                e.source_actor,
                e.created_at
             FROM notification_recipients r
             JOIN notification_events e
               ON e.id = r.event_id
             WHERE r.youth_id = ?
               ${unreadOnly
                    ? 'AND r.is_read = 0'
                    : ''}
             ORDER BY
                e.created_at DESC,
                r.id DESC
             LIMIT ?`,
            [
                normalizedYouthId,
                normalizedLimit
            ]
        );

    return rows.map(
        row => ({
            recipient_id:
                row.recipient_id,
            event_id:
                row.event_id,
            event_key:
                row.event_key,

            category:
                row.category,
            title:
                row.title,
            message:
                row.message,
            importance:
                row.importance,

            action_url:
                row.action_url,
            source_type:
                row.source_type,
            source_id:
                row.source_id,
            source_actor:
                row.source_actor,

            is_read:
                Number(row.is_read) === 1,
            read_at:
                row.read_at,

            created_at:
                row.created_at
        })
    );
}

async function unreadCount(
    db,
    youthId
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    const row =
        await get(
            db,
            `SELECT COUNT(*) AS count
             FROM notification_recipients
             WHERE youth_id = ?
               AND is_read = 0`,
            [
                normalizedYouthId
            ]
        );

    return Number(
        row && row.count
            ? row.count
            : 0
    );
}

async function markRead(
    db,
    {
        youthId,
        recipientId,
        readAt = null
    }
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    const normalizedRecipientId =
        positiveInteger(
            recipientId,
            'recipientId'
        );

    const timestamp =
        readAt ||
        new Date().toISOString();

    const result =
        await run(
            db,
            `UPDATE notification_recipients
             SET
                is_read = 1,
                read_at = COALESCE(
                    read_at,
                    ?
                )
             WHERE id = ?
               AND youth_id = ?`,
            [
                timestamp,
                normalizedRecipientId,
                normalizedYouthId
            ]
        );

    return Number(
        result.changes || 0
    ) === 1;
}

async function markAllRead(
    db,
    {
        youthId,
        readAt = null
    }
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    const timestamp =
        readAt ||
        new Date().toISOString();

    const result =
        await run(
            db,
            `UPDATE notification_recipients
             SET
                is_read = 1,
                read_at = COALESCE(
                    read_at,
                    ?
                )
             WHERE youth_id = ?
               AND is_read = 0`,
            [
                timestamp,
                normalizedYouthId
            ]
        );

    return Number(
        result.changes || 0
    );
}

function booleanFromSql(value) {
    return Number(value) === 1;
}

function normalizePreferenceRow(row) {
    if (!row) {
        return {
            ...DEFAULT_PREFERENCES
        };
    }

    return {
        push_enabled:
            booleanFromSql(
                row.push_enabled
            ),

        email_enabled:
            booleanFromSql(
                row.email_enabled
            ),

        prayer_daily_growth:
            booleanFromSql(
                row.prayer_daily_growth
            ),

        journey_progress:
            booleanFromSql(
                row.journey_progress
            ),

        events_formation:
            booleanFromSql(
                row.events_formation
            ),

        membership_community:
            booleanFromSql(
                row.membership_community
            ),

        ministry_servant:
            booleanFromSql(
                row.ministry_servant
            ),

        prayer_partner:
            booleanFromSql(
                row.prayer_partner
            ),

        games_growth:
            booleanFromSql(
                row.games_growth
            ),

        preferred_prayer_time:
            row.preferred_prayer_time ||
            null,

        quiet_hours_start:
            row.quiet_hours_start ||
            null,

        quiet_hours_end:
            row.quiet_hours_end ||
            null
    };
}

async function getPreferences(
    db,
    youthId
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    const row =
        await get(
            db,
            `SELECT *
             FROM notification_preferences
             WHERE youth_id = ?
             LIMIT 1`,
            [
                normalizedYouthId
            ]
        );

    return {
        youth_id:
            normalizedYouthId,

        ...normalizePreferenceRow(
            row
        ),

        stored:
            Boolean(row)
    };
}

function validateBoolean(
    value,
    label
) {
    if (typeof value !== 'boolean') {
        throw new TypeError(
            `${label} must be boolean`
        );
    }

    return value;
}

function validateOptionalTime(
    value,
    label
) {
    if (
        value === null ||
        value === undefined ||
        value === ''
    ) {
        return null;
    }

    if (
        typeof value !== 'string' ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
            value
        )
    ) {
        throw new TypeError(
            `${label} must use HH:MM`
        );
    }

    return value;
}

async function savePreferences(
    db,
    youthId,
    preferences,
    updatedAt = null
) {
    const normalizedYouthId =
        positiveInteger(
            youthId,
            'youthId'
        );

    if (
        !preferences ||
        typeof preferences !== 'object' ||
        Array.isArray(preferences)
    ) {
        throw new TypeError(
            'preferences are required'
        );
    }

    const normalized = {
        push_enabled:
            validateBoolean(
                preferences.push_enabled,
                'push_enabled'
            ),

        email_enabled:
            validateBoolean(
                preferences.email_enabled,
                'email_enabled'
            ),

        prayer_daily_growth:
            validateBoolean(
                preferences.prayer_daily_growth,
                'prayer_daily_growth'
            ),

        journey_progress:
            validateBoolean(
                preferences.journey_progress,
                'journey_progress'
            ),

        events_formation:
            validateBoolean(
                preferences.events_formation,
                'events_formation'
            ),

        membership_community:
            validateBoolean(
                preferences.membership_community,
                'membership_community'
            ),

        ministry_servant:
            validateBoolean(
                preferences.ministry_servant,
                'ministry_servant'
            ),

        prayer_partner:
            validateBoolean(
                preferences.prayer_partner,
                'prayer_partner'
            ),

        games_growth:
            validateBoolean(
                preferences.games_growth,
                'games_growth'
            ),

        preferred_prayer_time:
            validateOptionalTime(
                preferences.preferred_prayer_time,
                'preferred_prayer_time'
            ),

        quiet_hours_start:
            validateOptionalTime(
                preferences.quiet_hours_start,
                'quiet_hours_start'
            ),

        quiet_hours_end:
            validateOptionalTime(
                preferences.quiet_hours_end,
                'quiet_hours_end'
            )
    };

    const timestamp =
        updatedAt ||
        new Date().toISOString();

    await run(
        db,
        `INSERT INTO notification_preferences (
            youth_id,
            push_enabled,
            email_enabled,
            prayer_daily_growth,
            journey_progress,
            events_formation,
            membership_community,
            ministry_servant,
            prayer_partner,
            games_growth,
            preferred_prayer_time,
            quiet_hours_start,
            quiet_hours_end,
            updated_at
        )
        VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?
        )
        ON CONFLICT(youth_id)
        DO UPDATE SET
            push_enabled =
                excluded.push_enabled,
            email_enabled =
                excluded.email_enabled,
            prayer_daily_growth =
                excluded.prayer_daily_growth,
            journey_progress =
                excluded.journey_progress,
            events_formation =
                excluded.events_formation,
            membership_community =
                excluded.membership_community,
            ministry_servant =
                excluded.ministry_servant,
            prayer_partner =
                excluded.prayer_partner,
            games_growth =
                excluded.games_growth,
            preferred_prayer_time =
                excluded.preferred_prayer_time,
            quiet_hours_start =
                excluded.quiet_hours_start,
            quiet_hours_end =
                excluded.quiet_hours_end,
            updated_at =
                excluded.updated_at`,
        [
            normalizedYouthId,

            normalized.push_enabled
                ? 1
                : 0,

            normalized.email_enabled
                ? 1
                : 0,

            normalized.prayer_daily_growth
                ? 1
                : 0,

            normalized.journey_progress
                ? 1
                : 0,

            normalized.events_formation
                ? 1
                : 0,

            normalized.membership_community
                ? 1
                : 0,

            normalized.ministry_servant
                ? 1
                : 0,

            normalized.prayer_partner
                ? 1
                : 0,

            normalized.games_growth
                ? 1
                : 0,

            normalized.preferred_prayer_time,
            normalized.quiet_hours_start,
            normalized.quiet_hours_end,

            timestamp
        ]
    );

    return getPreferences(
        db,
        normalizedYouthId
    );
}

module.exports = Object.freeze({
    CATEGORIES,
    IMPORTANCE_LEVELS,
    DEFAULT_PREFERENCES,

    createNotification,
    listNotifications,
    unreadCount,
    markRead,
    markAllRead,
    getPreferences,
    savePreferences
});
