# Main FOG App / Koinonia Production Backup and Recovery

## Purpose and status

This document defines the production SQLite backup contract, the recommended implementation, verification requirements, and controlled recovery procedure for the Fire Of God Ministries Community Portal.

It records the P8 audit and isolated proof completed on September 7, 2026. It does not authorize a production code change, backup operation, restore, retention deletion, PM2 action, deployment, permission change, or environment change.

- Production service: `fog-v3`, port 3003, `/home/raspi4/fogmin-portal-v3`
- Production database: `/home/raspi4/fogmin-portal-v3/fog_community.db`
- Production launch source: `ac80805a9508e06426d5f2dbaabcbf8f150ba2c5`
- Production V3 is the authoritative source of community data.

Use this policy with:

- [Post-Launch Stabilization Policy](./POST_LAUNCH_STABILIZATION.md)
- [Post-Launch Monitoring Baseline](./POST_LAUNCH_MONITORING.md)
- [Staging-to-Production Release Workflow](./STAGING_TO_PRODUCTION_RELEASE_WORKFLOW.md)

## Current implementation audit

### Automatic daily backup

The current implementation is in `server.js`, function `runDatabaseBackup()` near line 1453.

- Trigger: once during application startup, before the primary `sqlite3.Database` handle is opened.
- Schedule: checked every hour using `setInterval`; a backup is created only when that Manila-calendar-day filename does not already exist.
- Source: relative path `./fog_community.db`.
- Destination: `backups/fog_community_YYYY-MM-DD.db` under the application directory.
- Mechanism: synchronous raw main-file copy using `fs.copyFileSync`.
- WAL/SHM handling: neither sidecar is copied or interpreted through SQLite.
- Active-write handling: no transaction, write quiescence, SQLite snapshot, or concurrency guard is used.
- Collision behavior: an existing daily filename causes the operation to skip, whether that file is valid or incomplete.
- Retention: none. The API lists only the ten newest `.db` names, but older files are not removed.
- Verification: none. No SQLite integrity check, content/fidelity check, file-size validation, or checksum is produced.
- Error handling: synchronous copy errors are caught and written to stderr as `[BACKUP ERROR]`; success is logged immediately after copying.
- Failed-artifact handling: there is no explicit removal or quarantine of a partially created destination.

Production enables `PRAGMA journal_mode = WAL` after opening the main database. A startup copy can encounter WAL state left by the prior process, and a scheduled copy after midnight can run while the application is live. Copying only the main database file cannot guarantee inclusion of committed pages still present in the WAL.

### Restore-triggered safety copy

The strong-admin restore route, `POST /api/backups/restore`, creates `backups/fog_community_pre_restore_YYYYMMDD_HHMMSS.db` using the same raw `fs.copyFileSync` method before closing the main database and restoring the selected file.

This pre-restore copy is not WAL-aware and is not verified before the restore proceeds. The route catches synchronous errors and returns HTTP 500, but its audit entry is written before the database-close and restore-copy callbacks finish. P8 does not change this behavior; a later reviewed implementation should route both automatic and pre-restore snapshots through the same verified SQLite-aware helper.

### Observed production backup state

The current application-managed backup is:

`/home/raspi4/fogmin-portal-v3/backups/fog_community_2026-09-07.db`

- Timestamp: September 7, 2026 at 09:48:27 `+0800`
- Size: 12,365,824 bytes
- File mode: `0600`
- SQLite-readable under authorized host-level read-only access: yes
- `PRAGMA integrity_check`: `ok`
- Backup push-subscription rows: 0
- Current production push-subscription rows: 1

The file is structurally valid but predates the current production state. An integrity result of `ok` proves internal SQLite consistency; it does not prove that a raw main-file copy captured all committed WAL data or all later production writes.

## Backup-method assessment

| Method | WAL-consistent snapshot | Availability and locking | Implementation fit | Restore simplicity | Assessment |
|---|---|---|---|---|---|
| Node `sqlite3` online backup API | Yes; uses SQLite's backup API against an open source database | Designed for online backup; can step in bounded page batches and retry `BUSY`/`LOCKED` | Available in the installed `sqlite3` 6.0.1 dependency; no subprocess or new package | Produces a normal SQLite database | **Recommended primary method** |
| SQLite CLI `.backup` | Yes; also uses SQLite's backup API | Suitable while source is online; lifecycle is managed in an external process | Simple for controlled operations, but adds executable/subprocess/path/error-handling dependency to application scheduling | Produces a normal SQLite database | Recommended manual/recovery fallback |
| `VACUUM INTO` | Produces a consistent compact database | More CPU, I/O, and temporary-space work; may hold a read transaction longer | Simple SQL but optimized for compacting/copying rather than frequent operational snapshots | Produces a normal SQLite database | Valid, but not preferred for routine application backups |

## Recommended method

Use `sqlite3.Database#backup()` from the existing Node `sqlite3` 6.0.1 package. It wraps the SQLite Online Backup API and already treats `SQLITE_BUSY` and `SQLITE_LOCKED` as retryable by default.

The production implementation should:

1. Resolve the source as `path.join(__dirname, 'fog_community.db')`; never accept a client-supplied source path.
2. Open a dedicated SQLite source connection for the backup so startup and scheduled snapshots do not depend on the lifetime of the request-handling handle.
3. Back up to a unique temporary file inside the same environment's backup directory.
4. Step the backup in bounded batches, retry `BUSY`/`LOCKED` with a bounded delay and total timeout, and reject every other error.
5. Close the backup and source handles on success or failure.
6. Open the completed temporary database read-only and require `PRAGMA integrity_check` to return exactly `ok`.
7. Close it, record its size, compute SHA-256, and create a non-secret metadata manifest.
8. Publish the verified database and manifest under a collision-safe timestamped name without replacing an existing file.
9. Remove only attributable unverified temporary files after a failed attempt.
10. Log a concise success or failure result without credentials, database contents, or secret configuration.

This method requires no new dependency, schema, or environment variable and does not require stopping normal request handling to create a consistent snapshot.

## Isolated proof result

P8 tested the recommended method only against a disposable database under `/tmp`; neither production nor staging data was used.

The proof:

1. created a new SQLite database;
2. enabled WAL mode and confirmed a non-empty WAL file;
3. committed two rows, including a latest-write marker;
4. ran `Database#backup()` while the source connection remained open;
5. verified the backup with `PRAGMA integrity_check`;
6. confirmed both committed rows were present;
7. confirmed the source logical fingerprint and change count were unchanged;
8. computed SHA-256;
9. published the candidate only after verification; and
10. simulated an invalid destination, confirming the failure was detected, the last good backup was unchanged, and no failed database artifact was published.

Results:

- Journal mode: `wal`
- Source WAL present: yes
- Online backup completed: yes
- Backup integrity: `ok`
- Latest committed data present: yes
- Source logical data unchanged: yes
- Verified backup SHA-256: `97d5f6b3f2214fc1382ed66f1ad785288b1618ca01af81790b016caf8205f879`
- Simulated failure detected: yes
- Last good backup preserved: yes
- Unexpected failed artifact: no

The disposable test directory and its generated test databases were removed after verification.

## Permanent backup contract

Every production backup must satisfy all of the following:

1. It is a transactionally consistent SQLite snapshot.
2. It is never created by copying only the main `.db` file while WAL may contain committed data.
3. It reads only the authoritative production database when running in production. The source and destination must resolve inside the verified production application and backup paths; staging paths are rejected.
4. It never accepts a database source path or backup destination from an HTTP request.
5. Production and staging backups, databases, environment files, VAPID material, subscriptions, and recovery roots remain isolated.
6. A unique temporary candidate is created without overwriting a previous backup.
7. The candidate is not published as successful until SQLite integrity, size, checksum, and required fidelity checks pass.
8. A failed candidate never replaces or invalidates the last known-good backup.
9. At most one automatic backup job runs per application instance; overlapping attempts are skipped or queued safely.
10. Names use Manila date/time with seconds or milliseconds plus a collision-safe suffix, for example `fog_community_2026-09-07_143012_482_<suffix>.db`.
11. Each successful backup has a sidecar manifest containing method/version, environment marker, creation time, size, SHA-256, integrity result, and safe schema/count metadata. It contains no secrets or row contents.
12. Success is logged only after publication. Failure logs identify the stage and error class without database contents or secrets.
13. Backup failures are visible to operational monitoring and are retried only according to a bounded policy; there is no tight automatic retry loop.
14. Restore eligibility requires the `.db` and manifest to agree on checksum and size and a fresh read-only integrity check to pass.
15. Release, pre-migration, pre-restore, and incident backups are labelled separately from scheduled daily backups.

### Cadence and retention recommendation

- Create one verified scheduled backup per Manila calendar day.
- Create an additional verified backup before every consequential production release, schema/data migration, restore, or approved high-risk operation.
- Retain at least 14 daily backups.
- Retain at least 12 weekly recovery points after the daily window.
- Preserve launch, migration, incident, legal/organizational, and explicitly pinned recovery artifacts until the Product Owner approves their separate retention disposition.

Do not enable automatic deletion with the first backup-method rollout. First accumulate and validate at least 14 days of SQLite-safe production backups. Retention automation requires a separate review, must never delete the newest or last known-good backup, and must validate the retained set before and after cleanup.

Use the P7 disk thresholds before any future rotation:

- YELLOW: 80% used or less than 20 GiB available.
- RED: 90% used or less than 10 GiB available.

At RED, stop nonessential backup creation/cleanup automation and escalate; do not delete recovery assets improvisationally.

## Backup verification procedure

For each new production backup:

1. Confirm the source was the resolved production database under `/home/raspi4/fogmin-portal-v3` and not staging, V1, a symlink, or an arbitrary path.
2. Confirm the candidate filename is unique and the target did not previously exist.
3. Require the online backup operation to report completion.
4. Close the backup destination before hashing or publishing it.
5. Record a nonzero file size.
6. Open the candidate read-only and require `PRAGMA integrity_check` to return exactly `ok`.
7. Capture approved non-sensitive schema/count evidence sufficient to detect an obviously wrong source database.
8. Compute SHA-256 and write the manifest without secrets or record contents.
9. Publish without overwriting any existing backup.
10. Re-read the published file's size and SHA-256 and compare them with the manifest.
11. Record the result in monitoring. Never report success before every required check passes.

Periodic restore rehearsals must use an isolated directory and must never point a test process at the production database, staging database, or V1 database.

## Controlled recovery and restore checklist

A restore is destructive and always requires an incident-specific manual gate. Before restoring:

- [ ] Confirm production V3 is impaired and identify the lowest safe P5 recovery tier.
- [ ] Identify the exact backup, timestamp, manifest, size, SHA-256, and integrity result.
- [ ] Determine all authoritative production writes newer than the recovery point and approve a reconciliation plan.
- [ ] Confirm the backup schema is compatible with the application source to be started.
- [ ] Verify the backup read-only with a fresh checksum and `PRAGMA integrity_check`.
- [ ] Preserve the current production database state using the SQLite Online Backup API or CLI `.backup`; do not raw-copy an active main file.
- [ ] Obtain explicit Product Owner authorization for the exact restore point and expected data effects.
- [ ] Quiesce writes and stop only `fog-v3` during the final replacement window.
- [ ] Restore into a new temporary database using a SQLite-aware method and verify it before replacing the live path.
- [ ] Preserve, rather than delete, the replaced main database and its attributable WAL/SHM state for investigation.
- [ ] Set the expected owner and restrictive file mode without exposing data.
- [ ] Start only `fog-v3`; verify path, port, environment file, restart stability, local/public HTTP, schema, integrity, authentication, and representative application behavior.
- [ ] Record the restore, reconciliation status, smoke result, rollback point, and Product Owner acceptance.

Never use staging as a production recovery source. Never reopen or overwrite V1 as part of routine recovery. Tier 4 V1 fallback remains governed by explicit Product Owner authorization and the P5 divergence policy.

## Production rollout plan

P8 does not execute this plan.

### Proposed source scope

- `server.js`: add a reusable asynchronous SQLite Online Backup helper; replace the automatic raw copy and the restore-triggered pre-restore raw copy with that helper; add verification, checksum/manifest, concurrency, bounded retry, and safe temporary-artifact handling.
- `docs/operations/PRODUCTION_BACKUP_AND_RECOVERY.md`: retain this operational contract and update only if implementation review changes an assumption.

No frontend file should change.

### Staging-first gates

1. Implement the smallest isolated `server.js` change on staging.
2. Run syntax and diff checks.
3. Unit-test unique naming, path confinement, retries/timeouts, callback completion, verification failure, checksum generation, atomic publication, concurrency suppression, and cleanup of only attributable temporary files.
4. Use a disposable WAL-mode database to repeat the P8 latest-write and failure tests.
5. Run the implementation against a staging-only disposable database or approved staging backup directory; do not mutate legitimate staging rows.
6. Verify a scheduled backup and pre-restore safety backup through the same helper without executing a restore.
7. Confirm normal requests remain responsive and no PM2 instability or database-lock trend appears.
8. Obtain Product Owner review before committing, promoting, or changing production.

### Production gates

1. Follow the P6 exact-SHA workflow and classify the release as code-only plus security/recovery-sensitive.
2. Before deployment, create an independently verified SQLite-safe production backup using CLI `.backup` or another already trusted SQLite-aware procedure.
3. Preserve the existing raw backup; do not delete, overwrite, or relabel it as SQLite-safe.
4. Deploy the exact approved source artifact without any database, backup, environment, or staging file.
5. Restart only `fog-v3` to load the changed server code.
6. Trigger or wait for exactly one first backup under controlled observation.
7. Verify its completion, integrity, size, SHA-256/manifest, source path, and safe count/schema evidence.
8. Confirm it includes the then-current production state, including the expected push-subscription count.
9. Confirm application health, request latency, lock/error logs, PM2 stability, and disk space.
10. Keep both the independent pre-deployment backup and the first new verified backup. Do not activate retention deletion in this rollout.

### Expected operational impact

- Database schema change: none.
- Data migration: none.
- Environment change: none.
- New dependency: none.
- Backup-directory permission change: not required for functional rollout. The current directory mode is `0755`; any permission hardening must be separately reviewed and approved.
- PM2 definition change: none expected.
- PM2 restart: yes, one restart of `fog-v3` is eventually required to load the approved `server.js` change.
- Normal request handling: expected to remain available during online backup; verify bounded locking and latency on staging and during the first controlled production run.

## Rollback procedure for the backup-code release

The proposed change has no schema, data, or environment migration. If it causes runtime instability:

1. Stop automatic retry and preserve all logs and new backup candidates.
2. Confirm the authoritative production database remains healthy; do not restore a database merely to roll back code.
3. Use the P6 workflow to restore the exact prior approved application source after confirming current-schema compatibility.
4. Restart only `fog-v3` and repeat production smoke.
5. Keep every successfully verified SQLite-safe backup and the independent pre-deployment backup.
6. Quarantine attributable incomplete temporary artifacts for review; delete them only under explicit, path-specific approval.
7. Until the corrected backup code is redeployed, use an approved manual SQLite CLI `.backup` procedure for required production recovery points.

Rolling back application code must not overwrite the authoritative production database, production environment file, subscriptions, or recovery assets.
