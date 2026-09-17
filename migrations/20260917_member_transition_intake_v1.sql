CREATE TABLE IF NOT EXISTS member_transition_intakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,

    intake_version TEXT NOT NULL DEFAULT 'member-transition-v1',

    intake_kind TEXT NOT NULL
        CHECK (
            intake_kind IN (
                'adult_historical',
                'accelerated_confirmation'
            )
        ),

    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'submitted',
                'under_review',
                'needs_changes',
                'approved',
                'recognized',
                'closed'
            )
        ),

    community_intent_choice TEXT
        CHECK (
            community_intent_choice IS NULL
            OR community_intent_choice IN (
                'yes',
                'discerning',
                'not_now'
            )
        ),

    service_state TEXT
        CHECK (
            service_state IS NULL
            OR service_state IN (
                'none',
                'current',
                'former',
                'interested'
            )
        ),

    answers_json TEXT NOT NULL DEFAULT '{}',

    submitted_at TEXT,
    review_started_at TEXT,
    recognized_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS
member_transition_intake_version_idx
ON member_transition_intakes (
    youth_id,
    intake_version,
    intake_kind
);

CREATE INDEX IF NOT EXISTS
member_transition_intake_status_idx
ON member_transition_intakes (
    status,
    youth_id
);


CREATE TABLE IF NOT EXISTS member_transition_reported_ministries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    intake_id INTEGER NOT NULL,

    ministry_id INTEGER,
    ministry_name_snapshot TEXT NOT NULL,

    service_state TEXT NOT NULL
        CHECK (
            service_state IN (
                'current',
                'former'
            )
        ),

    reported_role TEXT,
    started_when TEXT,

    assignment_kind TEXT
        CHECK (
            assignment_kind IS NULL
            OR assignment_kind IN (
                'formal',
                'informal',
                'unsure'
            )
        ),

    wants_discernment INTEGER NOT NULL DEFAULT 0
        CHECK (wants_discernment IN (0,1)),

    selected_priority INTEGER NOT NULL DEFAULT 0
        CHECK (selected_priority IN (0,1)),

    notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (intake_id)
        REFERENCES member_transition_intakes(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
member_transition_reported_ministry_intake_idx
ON member_transition_reported_ministries (
    intake_id,
    service_state
);


CREATE TABLE IF NOT EXISTS member_transition_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    intake_id INTEGER NOT NULL,

    reviewer_user_id INTEGER,
    reviewer_name TEXT NOT NULL,

    decision TEXT NOT NULL
        CHECK (
            decision IN (
                'approved',
                'needs_changes',
                'declined'
            )
        ),

    proposed_standing TEXT
        CHECK (
            proposed_standing IS NULL
            OR proposed_standing IN (
                'none',
                'formal_member',
                'active_servant',
                'uncertain'
            )
        ),

    proposed_phases_json TEXT NOT NULL DEFAULT '[]',
    decision_json TEXT NOT NULL DEFAULT '{}',
    review_notes TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (intake_id)
        REFERENCES member_transition_intakes(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
member_transition_review_intake_idx
ON member_transition_reviews (
    intake_id,
    created_at
);


CREATE TABLE IF NOT EXISTS ministry_discernment_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    youth_id INTEGER NOT NULL,
    ministry_id INTEGER NOT NULL,

    source_intake_id INTEGER,

    source_type TEXT NOT NULL
        CHECK (
            source_type IN (
                'profile',
                'adult_intake',
                'accelerated_transition',
                'new_application'
            )
        ),

    status TEXT NOT NULL DEFAULT 'intent_submitted'
        CHECK (
            status IN (
                'intent_submitted',
                'consultation_pending',
                'consultation_complete',
                'assessment_pending',
                'assessment_complete',
                'recommended',
                'not_recommended',
                'completed',
                'withdrawn'
            )
        ),

    intent_text TEXT NOT NULL,

    availability TEXT,
    gifts_text TEXT,
    growth_hopes_text TEXT,

    wants_leader_conversation INTEGER NOT NULL DEFAULT 1
        CHECK (wants_leader_conversation IN (0,1)),

    priority_at_open INTEGER NOT NULL DEFAULT 0
        CHECK (priority_at_open IN (0,1)),

    opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TEXT,

    FOREIGN KEY (source_intake_id)
        REFERENCES member_transition_intakes(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS
ministry_discernment_one_open_case_idx
ON ministry_discernment_cases (
    youth_id,
    ministry_id
)
WHERE status NOT IN (
    'completed',
    'withdrawn',
    'not_recommended'
);

CREATE INDEX IF NOT EXISTS
ministry_discernment_status_idx
ON ministry_discernment_cases (
    status,
    ministry_id,
    youth_id
);


CREATE TABLE IF NOT EXISTS ministry_discernment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    case_id INTEGER NOT NULL,

    event_type TEXT NOT NULL,

    actor_user_id INTEGER,
    actor_name TEXT NOT NULL,

    visibility TEXT NOT NULL DEFAULT 'leadership'
        CHECK (
            visibility IN (
                'member',
                'leadership'
            )
        ),

    details_json TEXT NOT NULL DEFAULT '{}',

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (case_id)
        REFERENCES ministry_discernment_cases(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS
ministry_discernment_event_case_idx
ON ministry_discernment_events (
    case_id,
    created_at
);


CREATE TABLE IF NOT EXISTS ministry_priority_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    youth_id INTEGER NOT NULL,

    previous_mapping_id INTEGER,
    new_mapping_id INTEGER NOT NULL,

    changed_by_user_id INTEGER,
    changed_by_name TEXT NOT NULL,

    source TEXT NOT NULL
        CHECK (
            source IN (
                'member_profile',
                'transition_intake',
                'leadership_review',
                'migration'
            )
        ),

    reason TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS
ministry_priority_history_member_idx
ON ministry_priority_history (
    youth_id,
    created_at
);


CREATE TABLE IF NOT EXISTS member_transition_recognitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    intake_id INTEGER NOT NULL UNIQUE,
    review_id INTEGER NOT NULL,
    youth_id INTEGER NOT NULL,

    recognized_standing TEXT NOT NULL
        CHECK (
            recognized_standing IN (
                'none',
                'formal_member',
                'active_servant'
            )
        ),

    completion_basis TEXT NOT NULL
        DEFAULT 'transition_review_recognized',

    recognized_phases_json TEXT NOT NULL DEFAULT '[]',

    previous_journey_json TEXT NOT NULL,
    resulting_journey_json TEXT NOT NULL,

    recognized_by_user_id INTEGER,
    recognized_by_name TEXT NOT NULL,

    recognized_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    idempotency_key TEXT NOT NULL UNIQUE,

    FOREIGN KEY (intake_id)
        REFERENCES member_transition_intakes(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (review_id)
        REFERENCES member_transition_reviews(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS
member_transition_recognition_member_idx
ON member_transition_recognitions (
    youth_id,
    recognized_at
);
