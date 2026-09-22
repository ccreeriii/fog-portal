PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS birthday_celebration_preferences (
    youth_id INTEGER PRIMARY KEY,

    celebration_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (celebration_enabled IN (0, 1)),

    include_in_notifications INTEGER NOT NULL DEFAULT 1
        CHECK (include_in_notifications IN (0, 1)),

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (youth_id)
        REFERENCES youth(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS birthday_blessings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    celebrant_youth_id INTEGER NOT NULL,
    sender_youth_id INTEGER NOT NULL,

    birthday_year INTEGER NOT NULL
        CHECK (
            birthday_year >= 1900
            AND birthday_year <= 2200
        ),

    blessing_key TEXT NOT NULL,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (celebrant_youth_id)
        REFERENCES youth(id)
        ON DELETE CASCADE,

    FOREIGN KEY (sender_youth_id)
        REFERENCES youth(id)
        ON DELETE CASCADE,

    UNIQUE (
        celebrant_youth_id,
        sender_youth_id,
        birthday_year
    )
);

CREATE INDEX IF NOT EXISTS
birthday_blessings_celebrant_year_idx
ON birthday_blessings (
    celebrant_youth_id,
    birthday_year,
    created_at
);

CREATE INDEX IF NOT EXISTS
birthday_blessings_sender_idx
ON birthday_blessings (
    sender_youth_id,
    created_at
);
