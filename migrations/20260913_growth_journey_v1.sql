BEGIN IMMEDIATE;

CREATE TABLE IF NOT EXISTS growth_journey_phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    subtitle TEXT,
    phase_order INTEGER NOT NULL UNIQUE,
    journey_segment TEXT NOT NULL
        CHECK (journey_segment IN ('membership','servant')),
    member_description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phase_id INTEGER NOT NULL,
    task_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    member_description TEXT,
    leader_description TEXT,

    classification TEXT NOT NULL DEFAULT 'growth'
        CHECK (classification IN ('essential','growth','enrichment')),

    visibility TEXT NOT NULL DEFAULT 'visible'
        CHECK (visibility IN (
            'visible',
            'summary',
            'leadership_only',
            'system_only'
        )),

    audience TEXT NOT NULL DEFAULT 'all'
        CHECK (audience IN ('all','youth','adult')),

    evidence_type TEXT NOT NULL,

    target_value REAL NOT NULL DEFAULT 1,
    progress_weight REAL NOT NULL DEFAULT 1,
    max_credit REAL NOT NULL DEFAULT 1,

    allow_repeat INTEGER NOT NULL DEFAULT 0
        CHECK (allow_repeat IN (0,1)),

    config_json TEXT NOT NULL DEFAULT '{}',

    effective_from TEXT,
    applies_to_existing TEXT NOT NULL DEFAULT 'new_only'
        CHECK (applies_to_existing IN (
            'new_only',
            'in_progress',
            'everyone'
        )),

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (phase_id)
        REFERENCES growth_journey_phases(id)
);

CREATE INDEX IF NOT EXISTS growth_tasks_phase_idx
ON growth_tasks(phase_id, is_active);

CREATE TABLE IF NOT EXISTS growth_event_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    audience TEXT NOT NULL DEFAULT 'all'
        CHECK (audience IN ('all','youth','adult')),
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_event_series_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(series_id, event_id),
    FOREIGN KEY (series_id)
        REFERENCES growth_event_series(id),
    FOREIGN KEY (event_id)
        REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS growth_event_series_event_idx
ON growth_event_series_events(event_id);

CREATE TABLE IF NOT EXISTS growth_event_task_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,

    event_id INTEGER NOT NULL DEFAULT 0,
    series_id INTEGER NOT NULL DEFAULT 0,

    evidence_mode TEXT NOT NULL DEFAULT 'attendance'
        CHECK (evidence_mode IN (
            'registration',
            'attendance',
            'event_role',
            'completion'
        )),

    formation_area TEXT NOT NULL DEFAULT ''
        CHECK (formation_area IN (
            '',
            'spiritual',
            'community',
            'servanthood',
            'ministry',
            'mission'
        )),

    credit_value REAL NOT NULL DEFAULT 1,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (event_id > 0 AND series_id = 0)
        OR
        (series_id > 0 AND event_id = 0)
    ),

    UNIQUE(
        task_id,
        event_id,
        series_id,
        evidence_mode,
        formation_area
    ),

    FOREIGN KEY (task_id)
        REFERENCES growth_tasks(id)
);

CREATE INDEX IF NOT EXISTS growth_event_task_event_idx
ON growth_event_task_map(event_id);

CREATE INDEX IF NOT EXISTS growth_event_task_series_idx
ON growth_event_task_map(series_id);

CREATE TABLE IF NOT EXISTS growth_game_learning_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_name TEXT NOT NULL UNIQUE,
    task_id INTEGER NOT NULL,
    learning_category TEXT NOT NULL,
    points_per_learning_credit REAL NOT NULL DEFAULT 1,
    max_learning_credit REAL NOT NULL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id)
        REFERENCES growth_tasks(id)
);

CREATE TABLE IF NOT EXISTS growth_evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,

    evidence_type TEXT NOT NULL,

    source_table TEXT,
    source_id INTEGER,
    source_key TEXT NOT NULL,

    numeric_value REAL NOT NULL DEFAULT 1,
    occurred_at TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',

    recorded_by TEXT NOT NULL DEFAULT 'System',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(
        youth_id,
        task_id,
        evidence_type,
        source_key
    ),

    FOREIGN KEY (youth_id)
        REFERENCES youth(id),

    FOREIGN KEY (task_id)
        REFERENCES growth_tasks(id)
);

CREATE INDEX IF NOT EXISTS growth_evidence_member_idx
ON growth_evidence(youth_id, task_id, occurred_at);

CREATE INDEX IF NOT EXISTS growth_evidence_source_idx
ON growth_evidence(source_table, source_id);

CREATE TABLE IF NOT EXISTS growth_phase_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    phase_id INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (status IN (
            'not_started',
            'in_progress',
            'ready',
            'completed',
            'paused'
        )),

    progress_percent REAL NOT NULL DEFAULT 0,
    essential_completed INTEGER NOT NULL DEFAULT 0,
    essential_total INTEGER NOT NULL DEFAULT 0,

    started_at TEXT,
    completed_at TEXT,

    completion_basis TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(youth_id, phase_id),

    FOREIGN KEY (youth_id)
        REFERENCES youth(id),

    FOREIGN KEY (phase_id)
        REFERENCES growth_journey_phases(id)
);

CREATE INDEX IF NOT EXISTS growth_phase_progress_status_idx
ON growth_phase_progress(phase_id, status);

CREATE TABLE IF NOT EXISTS growth_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,

    phase_id INTEGER,
    task_id INTEGER,

    override_type TEXT NOT NULL
        CHECK (override_type IN (
            'recognize_complete',
            'waive_requirement',
            'add_credit',
            'approve_progression',
            'reopen'
        )),

    numeric_value REAL,
    reason TEXT NOT NULL,
    actor TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    revoked_at TEXT,
    revoked_by TEXT,
    revoke_reason TEXT,

    CHECK (phase_id IS NOT NULL OR task_id IS NOT NULL),

    FOREIGN KEY (youth_id)
        REFERENCES youth(id),

    FOREIGN KEY (phase_id)
        REFERENCES growth_journey_phases(id),

    FOREIGN KEY (task_id)
        REFERENCES growth_tasks(id)
);

CREATE INDEX IF NOT EXISTS growth_overrides_member_idx
ON growth_overrides(youth_id, created_at);

CREATE TABLE IF NOT EXISTS growth_leader_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    phase_id INTEGER NOT NULL,
    task_id INTEGER,

    review_type TEXT NOT NULL
        CHECK (review_type IN (
            'consultation',
            'assessment',
            'recommendation',
            'participation',
            'pastoral_review'
        )),

    status TEXT NOT NULL DEFAULT 'completed',

    member_summary TEXT,
    confidential_notes TEXT,

    actor TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (youth_id)
        REFERENCES youth(id),

    FOREIGN KEY (phase_id)
        REFERENCES growth_journey_phases(id),

    FOREIGN KEY (task_id)
        REFERENCES growth_tasks(id)
);

CREATE INDEX IF NOT EXISTS growth_leader_reviews_member_idx
ON growth_leader_reviews(youth_id, phase_id, occurred_at);

CREATE TABLE IF NOT EXISTS growth_onboarding_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    template_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,

    duration_days INTEGER NOT NULL DEFAULT 21,

    trigger_type TEXT NOT NULL DEFAULT 'membership_intent',

    auto_enroll_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (auto_enroll_enabled IN (0,1)),

    is_paused INTEGER NOT NULL DEFAULT 0
        CHECK (is_paused IN (0,1)),

    is_default INTEGER NOT NULL DEFAULT 0
        CHECK (is_default IN (0,1)),

    replacement_template_id INTEGER,

    member_intro_text TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (replacement_template_id)
        REFERENCES growth_onboarding_templates(id)
);

CREATE TABLE IF NOT EXISTS growth_onboarding_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    template_id INTEGER NOT NULL,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN (
            'active',
            'paused',
            'completed',
            'cancelled'
        )),

    trigger_type TEXT NOT NULL,
    trigger_source_id INTEGER,

    enrolled_at TEXT NOT NULL,
    started_at TEXT,
    paused_at TEXT,
    resumed_at TEXT,
    completed_at TEXT,

    completed_days INTEGER NOT NULL DEFAULT 0,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(youth_id, template_id),

    FOREIGN KEY (youth_id)
        REFERENCES youth(id),

    FOREIGN KEY (template_id)
        REFERENCES growth_onboarding_templates(id)
);

CREATE INDEX IF NOT EXISTS growth_onboarding_member_idx
ON growth_onboarding_enrollments(youth_id, status);

CREATE TABLE IF NOT EXISTS growth_onboarding_daily_completions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    enrollment_id INTEGER NOT NULL,

    completion_date TEXT NOT NULL,
    day_number INTEGER NOT NULL,

    source_key TEXT NOT NULL,

    completed_at TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(enrollment_id, completion_date),
    UNIQUE(enrollment_id, day_number),

    FOREIGN KEY (enrollment_id)
        REFERENCES growth_onboarding_enrollments(id)
);

CREATE TABLE IF NOT EXISTS growth_group_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL UNIQUE,

    group_type TEXT NOT NULL DEFAULT 'other'
        CHECK (group_type IN (
            'fire_circle',
            'campfire',
            'other'
        )),

    parent_group_id INTEGER,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (group_id)
        REFERENCES small_groups(id),

    FOREIGN KEY (parent_group_id)
        REFERENCES small_groups(id)
);

CREATE TABLE IF NOT EXISTS growth_ministry_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    unit_type TEXT NOT NULL DEFAULT 'ministry'
        CHECK (unit_type IN (
            'ministry',
            'committee',
            'team'
        )),

    parent_unit_id INTEGER,

    legacy_ministry_id INTEGER UNIQUE,

    description TEXT,

    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0,1)),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (parent_unit_id)
        REFERENCES growth_ministry_units(id),

    FOREIGN KEY (legacy_ministry_id)
        REFERENCES ministries(id)
);

CREATE INDEX IF NOT EXISTS growth_ministry_parent_idx
ON growth_ministry_units(parent_unit_id);

CREATE TABLE IF NOT EXISTS growth_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_by TEXT NOT NULL DEFAULT 'System',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==================================================
-- CANONICAL SEVEN PHASES
-- ==================================================

INSERT OR IGNORE INTO growth_journey_phases
(phase_key,title,subtitle,phase_order,journey_segment,member_description)
VALUES
(
 'encounter',
 'Encounter',
 'Come and See',
 1,
 'membership',
 'Encounter God, experience Christian community, and begin your journey with the Fire Of God Ministries family.'
),
(
 'belong',
 'Belong',
 'Become Part of the Community',
 2,
 'membership',
 'Grow in relationship, understand the life of the community, and find a place to belong.'
),
(
 'commit',
 'Commit',
 'Choose to Belong',
 3,
 'membership',
 'Freely choose to journey with the community in faith, fellowship, formation, and mission.'
),
(
 'discern',
 'Discern',
 'Discover Your Place of Service',
 4,
 'servant',
 'Explore your gifts, calling, availability, and readiness to serve together with community leaders.'
),
(
 'form',
 'Form',
 'Go for Servant Formation',
 5,
 'servant',
 'Be formed spiritually, relationally, as a servant, in ministry, and for mission.'
),
(
 'serve',
 'Serve',
 'Serve and Grow',
 6,
 'servant',
 'Grow through faithful participation, accompaniment, practice, and real opportunities to serve.'
),
(
 'be_sent',
 'Be Sent',
 'Be Sent Forth to Serve',
 7,
 'servant',
 'Receive the community’s welcome, blessing, commissioning, and invitation to active service.'
);

-- ==================================================
-- ENCOUNTER EXPERIENCES
-- ==================================================

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat
)
SELECT id,
       'encounter-account-start',
       'Begin Your Journey',
       'Your journey begins when you create or claim your Community Portal account.',
       'System-recognized beginning of the member journey.',
       'growth','system_only','all','account_created',
       1,0.25,1,0
FROM growth_journey_phases
WHERE phase_key='encounter';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat
)
SELECT id,
       'encounter-prayer-covenant-21',
       '21-Day Prayer Covenant',
       'Begin with a simple rhythm of praying for someone each day and allowing prayer to draw you closer to God and the community.',
       'Default welcome rhythm automatically offered after membership intent.',
       'growth','visible','all','onboarding_prayer_days',
       21,1.5,1,1
FROM growth_journey_phases
WHERE phase_key='encounter';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat
)
SELECT id,
       'encounter-community-event',
       'Come and See',
       'Join an Encounter experience such as Alpha, Youth Hangout, outreach, Youth Day, Day of Encounter, or another welcoming community activity.',
       'Configured registrations and attendance may contribute.',
       'growth','visible','all','event_participation',
       1,1,1,1
FROM growth_journey_phases
WHERE phase_key='encounter';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat
)
SELECT id,
       'encounter-faith-learning',
       'Grow in Faith and Understanding',
       'Explore the Gospel, Bible, Catechism, and Christian life through learning activities and faith-based games.',
       'Eligible Growth Games may contribute capped learning credit.',
       'enrichment','visible','all','growth_game_learning_points',
       100,0.75,1,1
FROM growth_journey_phases
WHERE phase_key='encounter';

-- ==================================================
-- BELONG EXPERIENCES
-- ==================================================

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'belong-membership-intent',
       'Express Your Desire to Belong',
       'Let us know that you would like to journey more intentionally with the FOG family.',
       'Membership intention begins the belonging process and normally triggers the welcome rhythm.',
       'essential','visible','all','membership_intent',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='belong';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat
)
SELECT id,
       'belong-community-orientation',
       'Community Orientation',
       'Discover our identity, vision, mission, values, and way of life as a spiritual family.',
       'Usually evidenced through attendance at a configured orientation event or series.',
       'essential','visible','all','event_attendance',
       1,1,1,1
FROM growth_journey_phases
WHERE phase_key='belong';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'belong-fire-circle',
       'Find Your Circle',
       'Be welcomed into a Fire Circle or another appropriate small community where people can pray and journey together.',
       'Recognized through approved group placement.',
       'essential','visible','all','group_membership',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='belong';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat
)
SELECT id,
       'belong-regular-participation',
       'Journey With the Community',
       'Continue showing up, sharing life, praying, and participating in the activities appropriate to your journey.',
       'Threshold is configurable by leadership and may differ for youth and adults.',
       'essential','visible','all','community_participation',
       1,1,1,1
FROM growth_journey_phases
WHERE phase_key='belong';

-- ==================================================
-- COMMIT
-- ==================================================

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'commit-membership-rite',
       'Choose to Belong',
       'When you are ready, formally embrace the community as a spiritual family through the Membership Commitment.',
       'Normally recognized through the commitment rite at an authorized community occasion.',
       'essential','visible','all','commitment_rite',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='commit';

-- ==================================================
-- DISCERN
-- ==================================================

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'discern-ministry-intent',
       'Explore Serving',
       'When you feel ready, express your desire to explore serving in a ministry.',
       'Starts the Servant Journey without automatically assigning a ministry.',
       'essential','visible','all','ministry_intent',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='discern';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'discern-leader-consultation',
       'Discern Together',
       'Spend time with leaders in prayerful conversation about your gifts, season, availability, and possible place of service.',
       'Detailed consultation record remains leadership-side.',
       'essential','summary','all','leader_consultation',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='discern';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,config_json
)
SELECT id,
       'discern-ministry-assessment',
       'Explore Your Gifts',
       'Where appropriate, leaders may invite you to a friendly ministry assessment or practical exploration.',
       'Conditional requirement for ministries where assessment is appropriate.',
       'essential','summary','all','ministry_assessment',
       1,1,1,
       '{"required_when_applicable":true}'
FROM growth_journey_phases
WHERE phase_key='discern';

-- ==================================================
-- FORM
-- ==================================================

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat
)
SELECT id,
       'form-ministry-orientation',
       'Ministry Orientation',
       'Learn the heart, purpose, culture, and expectations of the ministry you are discerning.',
       'Evidence normally comes from configured orientation attendance.',
       'essential','visible','all','formation_area_attendance',
       1,1,1,1
FROM growth_journey_phases
WHERE phase_key='form';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat,config_json
)
SELECT id,
       'form-spiritual',
       'Spiritual Formation',
       'Keep growing in prayer, Scripture, sacraments, and Christian life.',
       'One of the five core formation areas.',
       'essential','visible','all','formation_area_attendance',
       1,1,1,1,
       '{"formation_area":"spiritual"}'
FROM growth_journey_phases
WHERE phase_key='form';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat,config_json
)
SELECT id,
       'form-community',
       'Community Formation',
       'Grow in relationships, community culture, shared values, and healthy accountability.',
       'One of the five core formation areas.',
       'essential','visible','all','formation_area_attendance',
       1,1,1,1,
       '{"formation_area":"community"}'
FROM growth_journey_phases
WHERE phase_key='form';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat,config_json
)
SELECT id,
       'form-servanthood',
       'Servanthood Formation',
       'Grow in humility, obedience, faithfulness, responsibility, and a heart to serve.',
       'One of the five core formation areas.',
       'essential','visible','all','formation_area_attendance',
       1,1,1,1,
       '{"formation_area":"servanthood"}'
FROM growth_journey_phases
WHERE phase_key='form';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat,config_json
)
SELECT id,
       'form-ministry',
       'Ministry Formation',
       'Develop the gifts, skills, knowledge, discipline, and excellence needed for your ministry.',
       'Practices, workshops, skills development, and ministry training may contribute.',
       'essential','visible','all','formation_area_attendance',
       1,1,1,1,
       '{"formation_area":"ministry"}'
FROM growth_journey_phases
WHERE phase_key='form';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat,config_json
)
SELECT id,
       'form-mission',
       'Mission Formation',
       'Grow in evangelization, compassion, outreach, and a life ready to be sent.',
       'One of the five core formation areas.',
       'essential','visible','all','formation_area_attendance',
       1,1,1,1,
       '{"formation_area":"mission"}'
FROM growth_journey_phases
WHERE phase_key='form';

-- ==================================================
-- SERVE
-- ==================================================

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit,allow_repeat,config_json
)
SELECT id,
       'serve-attendance',
       'Walk Faithfully With Your Ministry',
       'Continue participating faithfully in the gatherings, formation, practices, meetings, and mission entrusted to you.',
       'Default readiness standard is 80 percent, adjustable by authorized leadership.',
       'essential','visible','all','serve_attendance_percentage',
       80,1,1,1,
       '{"unit":"percent","default_threshold":80}'
FROM growth_journey_phases
WHERE phase_key='serve';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'serve-active-participation',
       'Serve and Grow',
       'Receive opportunities to serve while being accompanied, mentored, and encouraged by the community.',
       'Leadership confirmation complements attendance evidence.',
       'essential','summary','all','active_participation_review',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='serve';

-- ==================================================
-- BE SENT
-- ==================================================

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'be-sent-recommendation',
       'Ready to Be Sent',
       'Your ministry leaders prayerfully affirm your readiness for active service.',
       'Formal ministry recommendation before commissioning.',
       'essential','summary','all','leader_recommendation',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='be_sent';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'be-sent-formal-acceptance',
       'Welcome to Active Service',
       'Be formally welcomed as a ministry servant.',
       'Part of the Ministry Acceptance Rites.',
       'essential','visible','all','acceptance_rite',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='be_sent';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'be-sent-blessing',
       'Prayer of Blessing and Commissioning',
       'Receive the prayer and blessing of the community as you are sent forth to serve.',
       'Part of the Ministry Acceptance Rites.',
       'essential','visible','all','acceptance_rite',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='be_sent';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'be-sent-presentation',
       'Community Presentation',
       'Be welcomed and presented to the wider Fire Of God Ministries family.',
       'Part of the Ministry Acceptance Rites.',
       'essential','visible','all','acceptance_rite',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='be_sent';

INSERT OR IGNORE INTO growth_tasks
(
 phase_id,task_key,title,member_description,leader_description,
 classification,visibility,audience,evidence_type,
 target_value,progress_weight,max_credit
)
SELECT id,
       'be-sent-commitment-to-serve',
       'Commitment to Serve',
       'Freely respond to the invitation to serve God and the community with faithfulness and joy.',
       'Final commitment within the Ministry Acceptance Rites.',
       'essential','visible','all','acceptance_rite',
       1,1,1
FROM growth_journey_phases
WHERE phase_key='be_sent';

-- ==================================================
-- DEFAULT ONBOARDING WELCOME RHYTHM
-- ==================================================

INSERT OR IGNORE INTO growth_onboarding_templates
(
 template_code,
 title,
 description,
 duration_days,
 trigger_type,
 auto_enroll_enabled,
 is_paused,
 is_default,
 member_intro_text,
 is_active
)
VALUES
(
 'prayer-covenant-21',
 '21-Day Prayer Covenant',
 'A simple daily prayer rhythm that welcomes people into a life of prayer, love, belonging, and intentional growth.',
 21,
 'membership_intent',
 1,
 0,
 1,
 'Welcome to your journey with the Fire Of God Ministries family. As one of your first invitations, we encourage you to spend 21 days praying each day for someone in the community. This is not a test or a score. It is a simple rhythm of prayer, love, and belonging designed to help us grow closer to God and to one another.',
 1
);

-- ==================================================
-- EXISTING MINISTRIES BECOME TOP-LEVEL UNITS
-- WITHOUT MODIFYING THE LEGACY MINISTRIES TABLE
-- ==================================================

INSERT OR IGNORE INTO growth_ministry_units
(
 name,
 unit_type,
 legacy_ministry_id,
 description,
 is_active
)
SELECT
    name,
    'ministry',
    id,
    description,
    1
FROM ministries
WHERE name IS NOT NULL
  AND TRIM(name) <> '';

-- ==================================================
-- EXISTING FAITH-LEARNING GAMES
-- ONLY THESE MAPPED GAMES CONTRIBUTE LEARNING CREDIT.
-- ARCADE / OTHER GAMES ARE NOT INCLUDED BY DEFAULT.
-- ==================================================

INSERT OR IGNORE INTO growth_game_learning_map
(
 game_name,
 task_id,
 learning_category,
 points_per_learning_credit,
 max_learning_credit,
 is_active
)
SELECT
 'Catechism Clash',
 id,
 'catechism',
 1,
 100,
 1
FROM growth_tasks
WHERE task_key='encounter-faith-learning';

INSERT OR IGNORE INTO growth_game_learning_map
(
 game_name,
 task_id,
 learning_category,
 points_per_learning_credit,
 max_learning_credit,
 is_active
)
SELECT
 'Daily Manna Scramble',
 id,
 'scripture',
 1,
 100,
 1
FROM growth_tasks
WHERE task_key='encounter-faith-learning';

INSERT OR IGNORE INTO growth_game_learning_map
(
 game_name,
 task_id,
 learning_category,
 points_per_learning_credit,
 max_learning_credit,
 is_active
)
SELECT
 'The Narrow Gate',
 id,
 'christian_life',
 1,
 100,
 1
FROM growth_tasks
WHERE task_key='encounter-faith-learning';

INSERT OR IGNORE INTO growth_game_learning_map
(
 game_name,
 task_id,
 learning_category,
 points_per_learning_credit,
 max_learning_credit,
 is_active
)
SELECT
 'Word Matrix',
 id,
 'scripture',
 1,
 100,
 1
FROM growth_tasks
WHERE task_key='encounter-faith-learning';

INSERT OR IGNORE INTO growth_game_learning_map
(
 game_name,
 task_id,
 learning_category,
 points_per_learning_credit,
 max_learning_credit,
 is_active
)
SELECT
 'Emoji Sermon Translator',
 id,
 'scripture',
 1,
 100,
 1
FROM growth_tasks
WHERE task_key='encounter-faith-learning';

INSERT OR IGNORE INTO growth_game_learning_map
(
 game_name,
 task_id,
 learning_category,
 points_per_learning_credit,
 max_learning_credit,
 is_active
)
SELECT
 'Verse Chain',
 id,
 'scripture',
 1,
 100,
 1
FROM growth_tasks
WHERE task_key='encounter-faith-learning';

-- ==================================================
-- GLOBAL DEFAULTS
-- ==================================================

INSERT OR IGNORE INTO growth_settings
(setting_key,setting_value,updated_by)
VALUES
('serve.default_attendance_threshold','80','System');

INSERT OR IGNORE INTO growth_settings
(setting_key,setting_value,updated_by)
VALUES
('onboarding.default_template','prayer-covenant-21','System');

INSERT OR IGNORE INTO growth_settings
(setting_key,setting_value,updated_by)
VALUES
('onboarding.auto_enroll_trigger','membership_intent','System');

INSERT OR IGNORE INTO growth_settings
(setting_key,setting_value,updated_by)
VALUES
('journey.member_language_style','pastoral','System');

COMMIT;
