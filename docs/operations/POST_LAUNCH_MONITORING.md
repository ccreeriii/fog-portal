# Main FOG App / Koinonia Post-Launch Monitoring Baseline

## Purpose and scope

This document establishes a lightweight, repeatable monitoring baseline for the Main FOG App / Koinonia production deployment. It records read-only observations made on September 7, 2026 and defines monitoring and escalation policy. It does not authorize an application, process, database, configuration, routing, backup, or infrastructure change.

- Baseline captured: September 7, 2026, approximately 12:24–12:29 Philippine Standard Time (`+0800`)
- Production launch source: `ac80805a9508e06426d5f2dbaabcbf8f150ba2c5`
- P5 stabilization checkpoint: `96988a11eb45219f14e11387c8eeed2427a50953`
- P6 release-workflow checkpoint: `76f541b6592fd5b74b40f52450833cf6824d6a98`
- Overall P7 classification: **YELLOW**
- Production availability and functional smoke: **GREEN**

The overall classification is YELLOW because the Events API remains materially slower and larger than representative routes, and the application-managed backup mechanism has a recovery-assurance limitation described below. Neither warning currently makes production unavailable.

Use this baseline with the [Post-Launch Stabilization Policy](./POST_LAUNCH_STABILIZATION.md) and [Staging-to-Production Release Workflow](./STAGING_TO_PRODUCTION_RELEASE_WORKFLOW.md).

## Environment monitored

| Environment | Address | PM2 | Port | Path | Monitoring role |
|---|---|---|---:|---|---|
| Production V3 | `https://fogmin.site` | `fog-v3` | 3003 | `/home/raspi4/fogmin-portal-v3` | Primary monitored service and authoritative database |
| Staging V3 | `https://staging.fogmin.site` | `fog-staging` | 3001 | `/home/raspi4/fog-portal-staging` | Isolated test environment; never a production-data source |
| Legacy V1 | `https://checkin.fogmin.site` | `fog-portal` | 3000 | `/home/raspi4/fog-portal` | Externally frozen and preserved during stabilization |

Production V3 is the authoritative source of real community data. Monitoring must not copy staging or V1 data into production, reactivate V1, or mutate any environment without a separate approved manual gate.

## Production health baseline

### PM2

| Measurement | Baseline |
|---|---|
| Process | `fog-v3` |
| Status | Online |
| PID | 98925 |
| Uptime at final snapshot | Approximately 2 hours 36 minutes |
| Restart count | 0 |
| Unstable restarts | 0 |
| RSS | 148.77 MiB |
| CPU snapshot | 0.8% |
| Script | `/home/raspi4/fogmin-portal-v3/server.js` |
| Working directory | `/home/raspi4/fogmin-portal-v3` |
| Port | 3003 |
| Saved environment-file argument | `--env-file-if-exists=/etc/koinonia/production.env` |

The live process identity, script, working directory, port, restart state, and saved PM2 definition were consistent where safely inspectable. The saved definition contains the production environment-file path. Push configuration was enabled at runtime, with no configuration error observed. Secret values were not inspected or emitted.

Host baseline at capture time: 7,818 MiB RAM total, 6,104 MiB available, swap unused, and load averages `0.25 / 0.43 / 0.41`.

### HTTP and application smoke

| Check | Result |
|---|---|
| Local production homepage, port 3003 | HTTP 200 |
| Public `https://fogmin.site/` | HTTP 200 |
| `http://fogmin.site/` | HTTP 301 to `https://fogmin.site/` |
| `https://www.fogmin.site/` | HTTP 301 to `https://fogmin.site/` |
| Anonymous `/api/auth/me` | HTTP 401, expected |
| Public `/api/youth` representative endpoint | HTTP 200 |
| Public `/api/events` | HTTP 200 |
| `/api/push/config` | HTTP 200; enabled; public key present |

The push-config response exposed only `enabled` and `publicKey`; no private or environment values were returned. All probes were non-destructive and created no test data.

## Production database baseline

- Database: `/home/raspi4/fogmin-portal-v3/fog_community.db`
- File size: 12,365,824 bytes (approximately 11.79 MiB)
- File mode: `0600`
- SQLite `PRAGMA integrity_check`: `ok`
- Filesystem: `/dev/sda2`, 491,997,270,016 bytes total
- Available space: 462,378,299,392 bytes (approximately 430.62 GiB)
- Filesystem utilization: 3%

### Key row counts

| Table | Rows |
|---|---:|
| `youth` | 189 |
| `users` | 190 |
| `events` | 14 |
| `attendance` | 455 |
| `ministries` | 6 |
| `ministry_members` | 50 |
| `event_roles` | 65 |
| `preregistrations` | 0 |
| `push_subscriptions` | 1 |

Counts are monitoring reference points, not hard limits. A change is not automatically an error; investigate unexpected discontinuities, decreases in identity/relationship tables, or growth inconsistent with known activity.

## Recent log and error baseline

Classification: **GREEN**.

The most recent 2,000 production output-log lines and the available production error log were inspected by operational pattern, without dumping request or personal data.

- No uncaught exceptions or unhandled rejections were detected.
- No repeated HTTP 5xx trend was detected.
- No SQLite errors or database-lock events were detected.
- No OAuth, push/VAPID, PWA/service-worker, or authentication/session error trend was detected.
- The 49 SQLite-related output lines were normal historical database-connection messages, not errors.
- The production error log was last modified on September 5, 2026, before the September 7 launch, and contained none of the monitored error patterns.
- Live PM2 restart count remained 0 with no unstable restarts.

PM2 logs accumulate across process incarnations, so historical startup lines must not be interpreted as current restarts without correlating them with the live restart counter and timestamps.

## Performance baseline

Each endpoint was sampled five times sequentially. Measurements include full response-body receipt and are intended as a lightweight operational reference, not a load test. With only five samples, the approximate p95 is the slowest observation and must not be treated as a statistically mature percentile.

### Local production

| Endpoint | Expected status | Median | Approx. p95 | Min–max | Response size |
|---|---:|---:|---:|---:|---:|
| `/` | 200 | 45.2 ms | 394.5 ms | 30.8–394.5 ms | 213,192 bytes |
| `/api/auth/me` | 401 | 16.6 ms | 19.6 ms | 13.0–19.6 ms | 51 bytes |
| `/api/youth` | 200 | 17.7 ms | 33.6 ms | 14.1–33.6 ms | 7,116 bytes |
| `/api/events` | 200 | 478.1 ms | 575.3 ms | 449.8–575.3 ms | 10,071,001 bytes |
| `/api/push/config` | 200 | 4.8 ms | 9.8 ms | 3.8–9.8 ms | 118 bytes |

### Public production

| Endpoint | Expected status | Median | Approx. p95 | Min–max | Response size |
|---|---:|---:|---:|---:|---:|
| `/` | 200 | 115.5 ms | 333.0 ms | 111.5–333.0 ms | 213,192 bytes |
| `/api/events` | 200 | 1,289.5 ms | 1,558.2 ms | 1,237.8–1,558.2 ms | 10,071,001 bytes |

Network, Cloudflare, and client conditions affect public timing. Compare trends using the same sample size, endpoint, location, and approximate time window when practical.

## Events API observation

- Endpoint: `/api/events`
- Functional correctness: **PASS**; all local and public samples returned HTTP 200.
- Current local baseline: median 478.1 ms, approximate p95 575.3 ms.
- Current public baseline: median 1,289.5 ms, approximate p95 1,558.2 ms.
- Launch reference: approximately 718 ms local and 1.86 seconds public.
- Current response size: approximately 10.07 MB (9.60 MiB).
- Performance severity: **YELLOW**.
- Launch impact: **NO** based on current evidence.

The endpoint is faster than the launch reference in this sample but remains much slower and substantially larger than representative APIs. Treat it as a dedicated P8 staging-first investigation. Do not change its query, schema, indexes, caching, response contract, or production behavior as part of P7.

## Backup and recovery baseline

### Application-managed production backup

- Path: `/home/raspi4/fogmin-portal-v3/backups/fog_community_2026-09-07.db`
- Timestamp: September 7, 2026 at 09:48:27 `+0800`
- Size: 12,365,824 bytes
- Mode: `0600`
- Readable by SQLite under authorized host-level read-only access: yes
- SQLite `PRAGMA integrity_check`: `ok`
- Backup `push_subscriptions` rows: 0
- Current production `push_subscriptions` rows: 1

The backup exists and is structurally readable, but it predates the current production database and does not contain the current post-launch subscription row. It must not be described as a complete current recovery point.

The current application routine uses `fs.copyFileSync` on `fog_community.db`. A raw main-file copy while SQLite WAL activity is possible is not a guaranteed transactionally complete SQLite backup, even when the resulting file passes `integrity_check`. This is a **YELLOW recovery-assurance warning**. Do not restore from an application-managed backup without confirming its capture conditions, required data, schema, and relationship fidelity. Future backup hardening requires a separate approved staging-first task.

### Recovery storage

- Recovery root: `/home/raspi4/koinonia-recovery`
- Observed recovery footprint: approximately 1.07 GB across 12,380 files
- Application backup directory: one file, approximately 12.37 MB
- Filesystem free space: approximately 430.62 GiB, 3% used
- Immediate accumulation risk: none apparent

The recovery root includes the final V1 snapshot, deterministic migration evidence, production cutover package, rollback materials, and a verified pre-production-smoke SQLite backup. Preserve them under the P5 stabilization policy. File count and recovery growth should still be monitored; free space alone does not replace retention and restore validation.

## Monitoring cadence

### Daily

- Confirm `fog-v3` is online with the expected script, working directory, port, and production environment mechanism.
- Compare restart and unstable-restart counts with the previous observation.
- Confirm local production and public `https://fogmin.site` availability.
- Review new severe log patterns: uncaught/unhandled errors, repeated 5xx, SQLite errors/locks, OAuth failures, and push failures.
- Record filesystem use and available space.
- Confirm the most recent expected backup exists; do not claim it is recoverable solely from its presence.

### Weekly

- Run read-only `PRAGMA integrity_check` on the authoritative production database.
- Verify newest appropriate backup presence, readability, SQLite integrity, age, and data/schema suitability.
- Review key table counts and investigate unexplained discontinuities.
- Repeat the lightweight Events API timing sample under comparable conditions.
- Compare safe live and saved PM2 identity/configuration metadata.
- Review log growth, restart history, memory trend, and recovery-storage growth.
- During the stabilization window, verify that V1 remains externally frozen and physically preserved without modification.

### Per release

Follow the complete P6 staging-to-production workflow, including exact-SHA verification, production preflight, SQLite-safe backup, source fingerprint, database integrity, post-release smoke, and applicable human acceptance.

No automated alerting or monitoring process is installed by this policy.

## Operational thresholds

Thresholds are starting points for this Raspberry Pi deployment and should be refined from future baselines.

| Signal | YELLOW — investigate | RED — escalate immediately |
|---|---|---|
| Availability | One unexplained failed probe or intermittent public failure | Local and public production unavailable on two consecutive checks, or confirmed user outage |
| PM2 | Any unexpected restart-count increase; RSS above 350 MiB sustained for 15 minutes | Restart loop, unstable restarts, process offline, OOM, or RSS above 500 MiB with degradation |
| Database | Unexpected count discontinuity or schema drift | `integrity_check` is not `ok`, database cannot open, or evidence of loss/corruption |
| SQLite locking | Three lock/busy errors within 10 minutes | Sustained locking that blocks normal production writes or causes repeated 5xx |
| HTTP errors | Five related 5xx responses within 10 minutes | Twenty related 5xx responses within 10 minutes or a persistent critical-route failure |
| Disk | 80% used or less than 20 GiB available | 90% used or less than 10 GiB available |
| Backups | Expected backup older than 36 hours, raw-copy provenance, or newest backup behind known production state | No viable verified recovery point, unreadable/corrupt backups, or backup failure during a consequential release |
| Events API | Five-sample median exceeds 1.0 s local or 2.6 s public, or approximate p95 exceeds 3 s | Repeated non-200/timeouts, median exceeds 5 s, or degradation blocks normal use |
| Logs | New repeated OAuth, push, session, or database warnings | Uncaught/unhandled crash, secret exposure, corruption signal, or repeated critical failures |

Never suppress an urgent condition merely because it has not crossed a numeric threshold. Security compromise, data loss, or credible corruption evidence is RED immediately.

## Escalation guidance

1. Record the time, observer, affected endpoint/process, symptoms, status codes, restart delta, and relevant sanitized log category.
2. Compare local port 3003 with public `fogmin.site` to distinguish application from routing/network failure.
3. Preserve evidence and check production database integrity before proposing a data-affecting action.
4. Classify the incident and use the lowest safe P5 recovery tier: service recovery, application rollback, V3 recovery, then V1 only as Tier 4.
5. Obtain a manual gate before any PM2, database, environment, Cloudflare, deployment, backup-restoration, or production change.
6. For application rollback, prove the candidate source is compatible with the current production schema.
7. Never copy the staging database into production and never reopen V1 casually. V1 reactivation requires explicit Product Owner authorization and a V1/V3 data-reconciliation plan.
8. After an approved intervention, follow P6 smoke, human acceptance, and release/incident closure requirements.

For a RED database-integrity, data-loss, secret-exposure, or suspected-compromise condition, stop ordinary writes if explicitly authorized, preserve the current state, and escalate to the Product Owner before recovery action. Do not improvise a restore.

## Next review

Repeat this baseline after a consequential release or operational incident and at the end of the stabilization window. P8 may investigate Events API performance on staging first. Backup-method hardening should be handled as a separately approved change with SQLite-safe implementation and recovery testing.
