-- Koinonia v3 Games Phase 1: additive score/economy foundation.
-- Rollback is intentionally not automatic. The two new tables can be left in
-- place safely; dropping them would destroy post-migration score/claim data.

CREATE TABLE IF NOT EXISTS game_score_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    game_name TEXT NOT NULL,
    category TEXT NOT NULL,
    score REAL NOT NULL,
    played_at TEXT NOT NULL,
    submission_id TEXT,
    legacy_source TEXT,
    legacy_id INTEGER,
    UNIQUE(youth_id, submission_id),
    UNIQUE(legacy_source, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_game_score_member_game
    ON game_score_logs (youth_id, game_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_game_score_game_rank
    ON game_score_logs (game_id, score DESC, played_at ASC);

CREATE TABLE IF NOT EXISTS game_reward_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    submission_id TEXT NOT NULL,
    game_id TEXT NOT NULL,
    category TEXT NOT NULL,
    score REAL NOT NULL,
    requested_life_points INTEGER NOT NULL,
    life_points_awarded INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(youth_id, submission_id)
);

CREATE INDEX IF NOT EXISTS idx_game_reward_member_day
    ON game_reward_claims (youth_id, category, created_at);

INSERT OR IGNORE INTO game_score_logs (
    youth_id, game_id, game_name, category, score, played_at,
    legacy_source, legacy_id
)
SELECT youth_id,
       CASE game_name
           WHEN 'David''s Slingshot' THEN 'davids-slingshot'
           WHEN 'Noah''s Ark: Rescue' THEN 'noahs-ark-rescue'
           WHEN 'Moses'' Red Sea Dash' THEN 'moses-red-sea-dash'
           WHEN 'Peter''s Leap of Faith' THEN 'peters-leap-of-faith'
           WHEN 'Jonah''s Deep Sea Dive' THEN 'jonahs-deep-sea-dive'
       END,
       game_name,
       'arcade',
       score,
       played_at,
       'arcade_score_logs',
       id
FROM arcade_score_logs
WHERE game_name IN (
    'David''s Slingshot',
    'Noah''s Ark: Rescue',
    'Moses'' Red Sea Dash',
    'Peter''s Leap of Faith',
    'Jonah''s Deep Sea Dive'
);
