BEGIN IMMEDIATE;

/*
 * One authoritative personal Prayer Covenant activity per member per
 * Asia/Manila day. This records prayer habit only. Future prayer coverage
 * and Watchtower activity must use a separate representation.
 *
 * Existing onboarding completions are deliberately not backfilled because
 * they do not prove that the permanent activity contract was satisfied.
 */
CREATE TABLE IF NOT EXISTS growth_prayer_rhythm_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    prayer_date TEXT NOT NULL,
    source_table TEXT NOT NULL DEFAULT 'personal_inbox',
    source_id INTEGER,
    source_key TEXT NOT NULL UNIQUE,
    occurred_at TEXT NOT NULL,
    recorded_by TEXT NOT NULL DEFAULT 'System',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(youth_id, prayer_date),
    FOREIGN KEY (youth_id) REFERENCES youth(id)
);

CREATE INDEX IF NOT EXISTS growth_prayer_rhythm_member_date_idx
ON growth_prayer_rhythm_days(youth_id, prayer_date DESC);

/*
 * The current rhythm is seven qualifying days in the trailing fourteen
 * Manila dates. target_value, progress_weight, and config_json remain normal
 * Growth task configuration rather than route constants. Encounter has the
 * stronger permanent-prayer weight; later phases retain meaningful credit.
 */
INSERT OR IGNORE INTO growth_tasks (
    phase_id,
    task_key,
    title,
    member_description,
    leader_description,
    classification,
    visibility,
    audience,
    evidence_type,
    target_value,
    progress_weight,
    max_credit,
    allow_repeat,
    config_json,
    applies_to_existing,
    is_active
)
SELECT
    phase.id,
    phase.phase_key || '-prayer-rhythm',
    'Prayer Rhythm',
    'Keep a current rhythm of personally praying for your Prayer Partner.',
    'Counts distinct personal Prayer Covenant days in a bounded recent window; it never replaces Essential requirements.',
    'growth',
    'summary',
    'all',
    'prayer_rhythm_recent',
    7,
    CASE WHEN phase.phase_key = 'encounter' THEN 1.0 ELSE 0.5 END,
    1,
    1,
    '{"window_days":14,"day_timezone":"Asia/Manila","habit_kind":"personal_prayer"}',
    'everyone',
    1
FROM growth_journey_phases phase
WHERE phase.phase_key IN (
    'encounter',
    'belong',
    'commit',
    'discern',
    'form',
    'serve',
    'be_sent'
);

COMMIT;
