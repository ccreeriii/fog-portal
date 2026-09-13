PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS notification_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    event_key TEXT NOT NULL UNIQUE,

    category TEXT NOT NULL
        CHECK (
            category IN (
                'prayer_daily_growth',
                'journey_progress',
                'events_formation',
                'membership_community',
                'ministry_servant',
                'prayer_partner',
                'games_growth',
                'leadership',
                'system'
            )
        ),

    title TEXT NOT NULL,
    message TEXT NOT NULL,

    importance TEXT NOT NULL DEFAULT 'normal'
        CHECK (
            importance IN (
                'low',
                'normal',
                'important',
                'critical'
            )
        ),

    action_url TEXT,

    source_type TEXT NOT NULL DEFAULT 'system',
    source_id INTEGER,
    source_actor TEXT,

    metadata_json TEXT NOT NULL DEFAULT '{}',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS notification_events_category_idx
    ON notification_events(category, created_at);

CREATE INDEX IF NOT EXISTS notification_events_source_idx
    ON notification_events(source_type, source_id);


CREATE TABLE IF NOT EXISTS notification_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    event_id INTEGER NOT NULL,
    youth_id INTEGER NOT NULL,

    is_read INTEGER NOT NULL DEFAULT 0
        CHECK (is_read IN (0, 1)),

    read_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(event_id, youth_id),

    FOREIGN KEY (event_id)
        REFERENCES notification_events(id)
        ON DELETE CASCADE,

    FOREIGN KEY (youth_id)
        REFERENCES youth(id)
);

CREATE INDEX IF NOT EXISTS notification_recipients_member_idx
    ON notification_recipients(
        youth_id,
        is_read,
        created_at
    );

CREATE INDEX IF NOT EXISTS notification_recipients_event_idx
    ON notification_recipients(event_id);


CREATE TABLE IF NOT EXISTS notification_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    recipient_id INTEGER NOT NULL,

    channel TEXT NOT NULL
        CHECK (
            channel IN (
                'push',
                'email'
            )
        ),

    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'sent',
                'skipped',
                'retry',
                'failed'
            )
        ),

    attempt_count INTEGER NOT NULL DEFAULT 0,

    provider_reference TEXT,
    last_error_code TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TEXT,

    UNIQUE(recipient_id, channel),

    FOREIGN KEY (recipient_id)
        REFERENCES notification_recipients(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_idx
    ON notification_deliveries(
        channel,
        status,
        updated_at
    );


CREATE TABLE IF NOT EXISTS notification_preferences (
    youth_id INTEGER PRIMARY KEY,

    push_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (push_enabled IN (0, 1)),

    email_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (email_enabled IN (0, 1)),

    prayer_daily_growth INTEGER NOT NULL DEFAULT 1
        CHECK (prayer_daily_growth IN (0, 1)),

    journey_progress INTEGER NOT NULL DEFAULT 1
        CHECK (journey_progress IN (0, 1)),

    events_formation INTEGER NOT NULL DEFAULT 1
        CHECK (events_formation IN (0, 1)),

    membership_community INTEGER NOT NULL DEFAULT 1
        CHECK (membership_community IN (0, 1)),

    ministry_servant INTEGER NOT NULL DEFAULT 1
        CHECK (ministry_servant IN (0, 1)),

    prayer_partner INTEGER NOT NULL DEFAULT 1
        CHECK (prayer_partner IN (0, 1)),

    games_growth INTEGER NOT NULL DEFAULT 1
        CHECK (games_growth IN (0, 1)),

    preferred_prayer_time TEXT,
    quiet_hours_start TEXT,
    quiet_hours_end TEXT,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (youth_id)
        REFERENCES youth(id)
);
