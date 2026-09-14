BEGIN IMMEDIATE;

/*
 * Watchtower is fallback Prayer Coverage only. Normal assigned-partner
 * coverage remains derivable from growth_prayer_rhythm_days -> personal_inbox.
 * None of these tables is Growth Journey or Prayer Habit evidence.
 */
CREATE TABLE IF NOT EXISTS watchtower_prayer_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coverage_date TEXT NOT NULL,
    covered_youth_id INTEGER NOT NULL,
    claimant_youth_id INTEGER NOT NULL,
    claimed_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coverage_date, covered_youth_id),
    FOREIGN KEY (covered_youth_id) REFERENCES youth(id),
    FOREIGN KEY (claimant_youth_id) REFERENCES youth(id)
);

CREATE INDEX IF NOT EXISTS watchtower_claim_owner_expiry_idx
ON watchtower_prayer_claims(claimant_youth_id, coverage_date, expires_at);

CREATE TABLE IF NOT EXISTS watchtower_prayer_coverage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coverage_date TEXT NOT NULL,
    covered_youth_id INTEGER NOT NULL,
    coverage_source TEXT NOT NULL DEFAULT 'watchtower'
        CHECK (coverage_source = 'watchtower'),
    intercessor_youth_id INTEGER NOT NULL,
    claim_id INTEGER NOT NULL UNIQUE,
    completed_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coverage_date, covered_youth_id),
    FOREIGN KEY (covered_youth_id) REFERENCES youth(id),
    FOREIGN KEY (intercessor_youth_id) REFERENCES youth(id),
    FOREIGN KEY (claim_id) REFERENCES watchtower_prayer_claims(id)
);

CREATE INDEX IF NOT EXISTS watchtower_coverage_date_idx
ON watchtower_prayer_coverage(coverage_date, covered_youth_id);

CREATE TABLE IF NOT EXISTS watchtower_daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coverage_date TEXT NOT NULL UNIQUE,
    eligible_population INTEGER NOT NULL,
    normal_coverage INTEGER NOT NULL,
    watchtower_coverage INTEGER NOT NULL,
    total_covered INTEGER NOT NULL,
    uncovered INTEGER NOT NULL,
    coverage_percent REAL NOT NULL,
    generated_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
