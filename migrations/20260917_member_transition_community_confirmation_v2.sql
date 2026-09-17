CREATE TABLE IF NOT EXISTS member_transition_community_declarations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    intake_id INTEGER NOT NULL,
    youth_id INTEGER NOT NULL,

    choice TEXT NOT NULL
        CHECK (
            choice IN (
                'yes',
                'discerning',
                'not_now'
            )
        ),

    statement_text TEXT,

    previous_declaration_id INTEGER,

    actor_user_id INTEGER,
    actor_name TEXT NOT NULL,

    created_at TEXT NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (intake_id)
        REFERENCES member_transition_intakes(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (youth_id)
        REFERENCES youth(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (previous_declaration_id)
        REFERENCES member_transition_community_declarations(id)
        ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS
member_transition_community_declaration_intake_idx
ON member_transition_community_declarations (
    intake_id,
    id
);

CREATE INDEX IF NOT EXISTS
member_transition_community_declaration_member_idx
ON member_transition_community_declarations (
    youth_id,
    created_at,
    id
);
