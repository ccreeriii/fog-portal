BEGIN IMMEDIATE;

/*
 * Audit persistence only. This migration never changes member Journey state
 * and never applies a grandfather transition.
 */
CREATE TABLE IF NOT EXISTS growth_legacy_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    transition_version TEXT NOT NULL,
    standing_class TEXT NOT NULL
        CHECK (standing_class IN ('formal_member', 'active_servant')),
    completion_basis TEXT NOT NULL
        CHECK (completion_basis IN (
            'legacy_membership_standing',
            'legacy_service_standing'
        )),
    source_summary_json TEXT NOT NULL,
    phases_grandfathered_json TEXT NOT NULL,
    previous_journey_json TEXT NOT NULL,
    resulting_journey_json TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    operator_actor TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (youth_id) REFERENCES youth(id),
    UNIQUE(youth_id, transition_version, standing_class)
);

CREATE INDEX IF NOT EXISTS growth_legacy_transitions_member_idx
ON growth_legacy_transitions(youth_id, applied_at);

COMMIT;
