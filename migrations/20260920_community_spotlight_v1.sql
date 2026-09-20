PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS community_spotlight_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_key TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    internal_name TEXT NOT NULL,
    template_type TEXT NOT NULL,
    eyebrow TEXT,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    primary_label TEXT,
    primary_action_type TEXT NOT NULL DEFAULT 'none',
    primary_action_value TEXT,
    secondary_label TEXT,
    audience_type TEXT NOT NULL DEFAULT 'all',
    audience_json TEXT NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 0,
    display_frequency TEXT NOT NULL DEFAULT 'once',
    allow_dont_show_again INTEGER NOT NULL DEFAULT 1 CHECK (allow_dont_show_again IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 0 CHECK (is_enabled IN (0, 1)),
    is_paused INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1)),
    is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    start_at TEXT,
    end_at TEXT,
    created_by TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(campaign_key, version)
);

CREATE INDEX IF NOT EXISTS community_spotlight_campaign_active_idx
    ON community_spotlight_campaigns(
        is_enabled, is_paused, is_archived, priority, start_at, end_at
    );

CREATE TABLE IF NOT EXISTS community_spotlight_member_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    youth_id INTEGER NOT NULL,
    first_seen_at TEXT,
    last_seen_at TEXT,
    view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
    clicked_at TEXT,
    dismissed_at TEXT,
    completed_at TEXT,
    last_action_at TEXT,
    UNIQUE(campaign_id, youth_id),
    FOREIGN KEY (campaign_id) REFERENCES community_spotlight_campaigns(id),
    FOREIGN KEY (youth_id) REFERENCES youth(id)
);

CREATE INDEX IF NOT EXISTS community_spotlight_member_state_member_idx
    ON community_spotlight_member_state(youth_id, campaign_id);
