# Main FOG App / Koinonia Post-Launch Stabilization Policy

## Purpose and status

This document defines the post-launch stabilization and emergency fallback policy for the Main FOG App / Koinonia production deployment completed on September 7, 2026.

- Production launch source commit: `ac80805a9508e06426d5f2dbaabcbf8f150ba2c5`
- Production launch completion date: September 7, 2026
- Production acceptance status: server-side, Product Owner, iPhone PWA, and targeted push acceptance passed
- Policy owner: Product Owner

This policy does not authorize an operational change. Any recovery action must follow the authorization and safety requirements below.

## Environment architecture

| Environment | Public address | PM2 process | Port | Application path | Status and role |
|---|---|---:|---:|---|---|
| Production V3 | `https://fogmin.site` | `fog-v3` | 3003 | `/home/raspi4/fogmin-portal-v3` | Live, accepted, authoritative production service |
| Legacy V1 | `https://checkin.fogmin.site` | `fog-portal` | 3000 | `/home/raspi4/fog-portal` | Externally frozen by Cloudflare; locally preserved for last-resort recovery |
| Staging V3 | `https://staging.fogmin.site` | `fog-staging` | 3001 | `/home/raspi4/fog-portal-staging` | Isolated development and acceptance environment |

Production and staging use separate databases, environment configuration, VAPID keys, and push subscriptions. Never copy the staging database into production. Legacy V1 must never be overwritten, upgraded in place, deleted, repurposed, or used as a V3 development environment.

## Production data authority

Production V3 is the authoritative source of truth from the launch completion date onward. All new production activity belongs to the V3 production database.

- Preserve the current production database during routine service recovery and application rollback.
- Use SQLite-safe backup and recovery procedures for any database operation.
- Never replace production data with staging data.
- Never assume the final V1 snapshot contains activity accepted after the V3 launch.
- Before any recovery involving older data, identify and account for production writes newer than the proposed recovery point.

## Legacy V1 freeze and preservation

Legacy V1 remains locally available but externally blocked by the active Cloudflare freeze. Its local application, Git worktree, database, PM2 definition, and recovery assets must remain preserved.

The minimum stabilization window is 14 days, from September 7 through September 21, 2026. Keep V1 externally frozen throughout this window.

September 21 is a reassessment date, not an automatic disposal date. V1 must not be automatically deleted, reopened, upgraded, repurposed, or disabled. At the end of stabilization, the Product Owner must explicitly choose whether to:

1. retain V1 indefinitely as cold legacy recovery;
2. archive it under an approved retention plan;
3. keep the service installed but disabled; or
4. approve another documented state.

## Data-divergence warning

Reopening V1 for writes after V3 has accepted production activity creates two competing data histories. V1 does not automatically contain new V3 registrations, profile updates, permissions, attendance, ministry activity, announcements, subscriptions, or other post-launch changes.

V1 must never silently become writable production again. Before any V1 reactivation:

1. obtain explicit Product Owner authorization;
2. determine whether V3 contains data newer than the final V1 snapshot;
3. quantify the affected records and relationships;
4. prepare and review a recovery and data-reconciliation plan;
5. define which system will remain authoritative during and after fallback; and
6. prevent user writes until the reconciliation decision is complete.

The final V1 snapshot is:

`/home/raspi4/koinonia-recovery/fog_community_final-v1-snapshot_20260907-094329+0800.db`

## Fallback hierarchy

Always use the lowest tier capable of safely restoring service. Escalation to a higher tier requires a documented reason and explicit authorization appropriate to the action.

### Tier 1 — V3 service recovery

Use for a transient runtime failure when the deployed source and production database remain healthy.

- Diagnose the failure before acting.
- Preserve the current production database and environment configuration.
- Restart or recover only `fog-v3`; do not touch V1 or staging.
- Confirm the correct application path, port, environment-file argument, HTTP health, restart stability, and error logs.
- Do not replace source or data at this tier.

### Tier 2 — V3 application rollback

Use when the application build is defective but the authoritative production database remains healthy.

- Roll back only the application source/build to the last approved known-good release.
- Preserve the current production database.
- Prove schema compatibility before starting the rolled-back application against the current database.
- Do not roll back if the older application cannot safely read the current schema and data.
- Verify locally before public traffic is accepted.

### Tier 3 — V3 production recovery

Use when production application or database recovery cannot be completed through Tiers 1 or 2.

- Use only verified V3 recovery assets and SQLite-safe backups.
- Identify all writes newer than the selected backup and plan their reconciliation.
- Protect the failed production state for investigation and recovery.
- Restore into an isolated candidate first, verify integrity and schema contracts, then use an explicitly approved cutover procedure.
- Do not substitute the staging database or the legacy V1 database for an authoritative V3 backup.

### Tier 4 — Legacy V1 emergency fallback

V1 is a last resort only when V3 recovery is not safely achievable within the required incident window.

- Explicit Product Owner authorization is mandatory before changing the Cloudflare freeze or accepting V1 writes.
- Confirm V1 local health and snapshot integrity without changing them.
- Determine the complete V3-versus-V1 data delta.
- Approve a written reconciliation and authority plan before reopening access.
- Keep V1 read-only or externally frozen until the authorization and reconciliation gates pass.
- Never present V1 as current production without clearly addressing post-launch V3 data.

## Verified recovery artifacts

The September 7, 2026 P5 read-only baseline confirmed:

- the final V1 snapshot exists and passes `PRAGMA integrity_check`;
- live V1 data matches the final snapshot across all ten V1 tables;
- the final deterministic V1-to-V3 migration evidence remains present;
- the P3 production cutover package and all listed checksums pass;
- pre-cutover, rollback, and prior verified recovery materials remain present;
- V1 Git/source is clean and locally operational;
- production V3 source matches the approved launch build; and
- production, V1 local origin, and staging are healthy and isolated.

Recovery materials must not be deleted, overwritten, or pruned during the stabilization window. Any later retention change requires explicit approval.

## Emergency recovery decision checklist

Before any operational recovery action, answer and record each item:

1. Is `https://fogmin.site` actually unavailable or materially impaired from both public and local perspectives?
2. Is the failure runtime-only, code-related, database-related, or infrastructure-related?
3. Is the current production V3 database healthy and SQLite-integrity clean?
4. Can V3 service be restored without changing authoritative production data?
5. If application rollback is proposed, is the rollback build proven compatible with the current production schema?
6. Does production V3 contain data newer than the final V1 snapshot or proposed V3 recovery point?
7. Would the proposed recovery or V1 reactivation create data divergence or discard accepted production writes?
8. Has the Product Owner explicitly authorized any V1 fallback and its reconciliation plan?

If any answer is unknown, stop and investigate before changing service, source, data, routing, Cloudflare, PM2, or environment configuration.

## Stabilization exit review

On or after September 21, 2026, perform a read-only review of production health, backup validity, recovery readiness, and any post-launch incidents. The review may recommend a future V1 state, but it must not automatically execute deletion, archival, public reactivation, repurposing, or PM2 changes.
