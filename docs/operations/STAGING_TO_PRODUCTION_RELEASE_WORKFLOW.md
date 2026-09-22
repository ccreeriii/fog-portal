# Main FOG App / Koinonia Staging-to-Production Release Workflow

## Purpose and authority

This document defines the permanent release workflow for promoting the Main FOG App / Koinonia from staging to production. It is a policy and operating contract; it does not authorize a deployment, database operation, process action, environment change, or routing change.

- Production launch source commit: `ac80805a9508e06426d5f2dbaabcbf8f150ba2c5`
- Production launch completion date: September 7, 2026
- Post-launch stabilization checkpoint: `96988a11eb45219f14e11387c8eeed2427a50953`
- Release approver: Product Owner

This workflow must be used with the [Post-Launch Stabilization Policy](./POST_LAUNCH_STABILIZATION.md). During stabilization, that policy's V1 preservation, fallback, data-authority, and September 21, 2026 review gates remain controlling.

## Environment map

| Environment | Public address | PM2 process | Port | Application path | Environment file | Role |
|---|---|---|---:|---|---|---|
| Legacy V1 | `https://checkin.fogmin.site` | `fog-portal` | 3000 | `/home/raspi4/fog-portal` | Legacy-specific configuration | Externally frozen, preserved Tier 4 fallback |
| Staging V3 | `https://staging.fogmin.site` | `fog-staging` | 3001 | `/home/raspi4/fog-portal-staging` | `/etc/koinonia/staging.env` | Development and acceptance |
| Production V3 | `https://fogmin.site` | `fog-v3` | 3003 | `/home/raspi4/fogmin-portal-v3` | `/etc/koinonia/production.env` | Live authoritative service |

The saved PM2 definitions launch `server.js` from the environment-specific working directory and pass only the appropriate `--env-file-if-exists` path to Node. The application opens `./fog_community.db`, so the PM2 working directory and database handoff are release-critical.

V1 must never be overwritten, upgraded in place, deleted, repurposed, or used as a V3 development environment. A routine release must not restart, reload, stop, alter, or unfreeze V1.

## Authoritative production-data rule

Production V3 is the sole source of truth for real community data from September 7, 2026 onward.

- Never copy the staging SQLite database into production.
- Never replace production data with V1 data as part of a routine release or rollback.
- Preserve production identifiers, relationships, accounts, permissions, subscriptions, and all post-launch writes.
- Use SQLite-aware backup and migration operations. Never raw-copy an active database or its WAL/SHM files.
- Treat any older V1 or V3 snapshot as a recovery point with potential data loss, not as a current production database.

## Current release topology and reusable mechanisms

At the P6 review checkpoint:

- staging is the Git repository on branch `koinonia-v3-remediation-20260903`, with checkpoint `96988a11eb45219f14e11387c8eeed2427a50953` and remote `origin`;
- production is an installed release copy without local Git metadata;
- every tracked file from launch commit `ac80805a9508e06426d5f2dbaabcbf8f150ba2c5` matches the installed production copy;
- the repository contains no permanent deployment script and its `npm test` script is only a placeholder;
- the audited P3 package under `/home/raspi4/koinonia-recovery/p3-production-cutover-package-20260907-003151+0800` contains the launch archive, checksums, PM2 definition/verifier, cutover runbook, rollback definition, and V1-to-V3 migration tool; and
- production was installed during the audited cutover from the immutable launch archive into a prepared next-release directory, with dependencies installed by `npm ci --omit=dev`, an SQLite-safe migrated database copy, an atomic directory replacement, and a `fog-v3`-only PM2 start.

The P3 archive/manifest, checksum verification, isolated build directory, exact-source comparison, PM2 verification, and rollback packaging patterns may be reused. The P3 V1-to-V3 migration and initial-cutover steps are launch-specific and must not be rerun for normal releases.

## Release contract

Every production release must follow this lifecycle:

`development on staging` → `staging testing` → `commit/checkpoint` → `release candidate identification` → `Product Owner approval` → `production preflight` → `exact promotion` → `production smoke` → `human acceptance when required` → `release closure`

Production must not automatically mirror staging. Passing staging tests does not itself authorize production activity.

### 1. Immutable release candidate

Before approval, record one full 40-character Git commit SHA. The candidate must be committed, available from the canonical repository, and reproducible from a clean checkout.

Never promote:

- an uncommitted or dirty working tree;
- "latest staging" or a mutable branch name without its resolved SHA;
- a mixture of files from multiple commits; or
- arbitrary hand-copied files without a verified manifest.

Build an immutable source archive or equivalent artifact from the approved SHA. Record its SHA-256 checksum and a file manifest. Dependency installation must use the committed lockfile and `npm ci`; the release record must state the Node/npm versions or approved runtime baseline.

### 2. Staging acceptance

Before requesting Product Owner approval:

- the staging working tree must be clean;
- branch, full HEAD SHA, and remote relationship must be recorded;
- relevant syntax, static, migration, security, and regression checks must pass;
- staging runtime smoke must pass;
- physical or human acceptance must pass for affected user-facing behavior;
- database effects and schema compatibility must be verified where relevant;
- known warnings, limitations, deferred work, and required production configuration must be documented; and
- the intended release classification and rollback strategy must be recorded.

The absence of an automated test suite is a known control gap. Until a real suite exists, every release must name and record the exact checks used instead of reporting a generic "tests passed."

### 3. Change classification

Classify every release before approval. Use every applicable class when a release spans categories.

| Class | Description | Additional required gates |
|---|---|---|
| A — Code-only | Source behavior changes with no schema, data, or environment change | Prove compatibility with the current production schema and configuration; targeted regression and rollback-source verification |
| B — Backward-compatible schema migration | Additive or otherwise backward-compatible schema change | Deterministic migration; production-like copy rehearsal; pre/post schema contract; integrity checks; prove both new and rollback code compatibility or explicitly disallow code-only rollback |
| C — Data transformation | Existing production rows will be changed | Exact row scope; deterministic/idempotent behavior where possible; rehearsed counts/fingerprints; reconciliation and restore plan; Product Owner approval of data effects |
| D — Configuration/environment | Production environment, origin, VAPID, OAuth, cookie, routing, or process definition changes | Secret-safe procedure; environment-specific validation; rollback of configuration; confirm no staging value is promoted; infrastructure owner approval where applicable |
| E — Security-sensitive | Authentication, authorization, credential, session, secret, privacy, or destructive-route behavior changes | Threat-focused review; negative authorization tests; secret-exposure check; privileged and ordinary-user acceptance; security rollback implications |
| F — Emergency hotfix | Urgent change needed to restore or protect production | Follow the abbreviated hotfix workflow below; explicit approval, production backup, exact SHA, targeted tests, and immediate source-history reconciliation remain mandatory |

Documentation-only work that causes no deployment may be checkpointed separately and recorded as `deployment: NONE`.

## Production preflight

No promotion may begin until a manual gate approves the exact SHA and release plan. Immediately before deployment, record and verify:

1. `fog-v3` is the only in-scope PM2 process and currently points to `/home/raspi4/fogmin-portal-v3/server.js`, working directory `/home/raspi4/fogmin-portal-v3`, port 3003.
2. Local and public production health are understood; investigate unexplained failures before changing state.
3. The production database passes `PRAGMA integrity_check` and its schema matches the release's declared starting contract.
4. Production source/build identity and rollback point are captured.
5. `/etc/koinonia/production.env` remains the production configuration source and contains no staging values.
6. V1 and staging process state, data, and configuration are out of scope and will remain untouched.
7. Required backups, migration rehearsal, rollback assets, disk space, and maintenance/write-control plan are ready.
8. Public routing and canonical redirects are known; a source promotion does not implicitly authorize Cloudflare changes.

Stop if the current production state differs materially from the approved assumptions.

## Backup requirements

Before every consequential release, create a release-specific recovery directory outside the application roots. At minimum preserve:

- an SQLite-safe backup of the authoritative production database;
- the current installed production source/build or its independently verified release artifact;
- the current and candidate release SHA, source manifest, and SHA-256 checksums;
- the PM2 launch references needed to reconstruct only `fog-v3`; and
- non-secret references to the production environment mechanism and required configuration keys.

Never copy secret values into a release manifest or Git. Never archive `.env` files inside a source artifact.

Use timestamped, environment-labelled artifact names. Verify the database backup with `PRAGMA integrity_check`; verify artifacts with SHA-256; record file ownership and restrictive permissions. A backup is not accepted until its integrity and checksum checks pass.

For a genuinely non-deployed documentation checkpoint, record the production backup as `NOT APPLICABLE — no production operation`. For code-only deployment, a database backup may be waived only by explicit Product Owner decision after confirming the application cannot mutate schema or data during startup; otherwise back up production.

## Exact-SHA promotion and database handoff

1. Resolve and record the approved SHA; fetch without merging, rebasing, or changing the candidate.
2. Produce the release artifact from a clean detached checkout of that SHA.
3. Generate and verify a manifest and checksum before touching production.
4. Prepare a new release directory outside the live target. Run `npm ci --omit=dev` from the committed lockfile.
5. Confirm the artifact excludes databases, WAL/SHM files, backups, archives, `.env` files, VAPID material, session state, and other environment-specific runtime data.
6. Compare the prepared release to the approved artifact and expected file list.
7. Preserve `/etc/koinonia/production.env`, the production VAPID pair, OAuth/cookie settings, push subscriptions, and all other production-only state.
8. Because the application database is relative to its working directory, use an explicitly reviewed SQLite-safe handoff. Quiesce production writes or `fog-v3` during the approved window, create the final SQLite backup into the prepared release, verify integrity, and preserve the old database/release. Never use a raw copy of an active database or copy WAL/SHM files as a migration method.
9. For a schema release, run only the approved deterministic migration against the production database copy, then enforce pre/post schema, row-count, relationship, and integrity assertions before promotion.
10. Atomically install the prepared release, start or reload only `fog-v3`, and verify its exact source fingerprint against the approved manifest.

If a release-specific procedure cannot demonstrate an exact artifact and safe authoritative-database handoff, it is not ready for production.

## Database migration policy

Staging data is never a migration input for production. Migrations operate on an SQLite-safe copy of the existing authoritative production database and are promoted only after verification.

Every migration must:

- declare its accepted starting schema and expected resulting schema;
- be deterministic and reviewed, with idempotence or explicit rerun refusal;
- refuse wrong paths, wrong environments, symlinks, unexpected schemas, and unverified inputs where practical;
- be rehearsed against a recent production-like copy when the data shape matters;
- state expected row changes and preserve identifiers/relationships unless explicitly approved;
- pass schema-contract, fidelity, count/fingerprint, and `PRAGMA integrity_check` gates;
- define whether old code can run against the resulting schema; and
- include a migration-specific rollback or restore/reconciliation procedure before authorization.

Never assume that reverting source reverses a schema or data transformation.

## Environment isolation policy

Source promotion must not overwrite or copy between environments any of the following:

- `fog_community.db`, WAL/SHM files, backups, or recovery snapshots;
- `.env` files or environment variables;
- VAPID key pairs or push subscriptions;
- OAuth origins, client/runtime settings, cookies, or sessions; or
- PM2 definitions and routing configuration unless separately classified and approved.

Production retains `/etc/koinonia/production.env`; staging retains `/etc/koinonia/staging.env`. PM2 should persist only the appropriate environment-file path, never direct secret values. Reports, logs, manifests, shell history, and commits must not expose secret values.

## PM2 rules

- During a normal production release, only `fog-v3` may be stopped, started, restarted, reloaded, deleted, or reconstructed.
- Never act on `fog-portal` or `fog-staging` unless a separate approved operation explicitly targets that environment.
- Before action, positively identify process name, script, working directory, port, node arguments, PID/restart baseline, and saved definition.
- After action, verify the same fields, online state, restart stability, and absence of new startup/database/configuration errors.
- Run `pm2 save` only when an approved PM2 definition changed and only after a secret-safe saved-definition review.
- If the required action is broader than the approved manual gate, stop and request authorization.

## Production smoke requirements

After promotion and before release closure, verify at minimum:

- `fog-v3` is online with the correct script, working directory, port 3003, and production environment-file argument;
- there is no restart loop, unstable restart increase, or new startup/database/configuration error;
- `http://127.0.0.1:3003` returns HTTP 200;
- `https://fogmin.site` returns HTTPS 200;
- canonical HTTP/`www` redirects behave as approved;
- `/api/auth/me` has correct anonymous and authenticated behavior;
- password and Google authentication remain operational when affected;
- one representative authenticated route and relevant authorization denial pass;
- the production configuration marker and `/api/push/config` are correct when relevant;
- the database schema and `PRAGMA integrity_check` pass; and
- representative data counts/fingerprints agree with the preflight or migration evidence.

Production probes must be read-only or use explicitly approved disposable fixtures. Do not perform destructive writes, broadcasts, credential changes, permission changes, or broad notifications as smoke tests.

## Human acceptance rules

Human acceptance is required before closure when a release affects:

- password or Google authentication, login, logout, sessions, or account activation;
- permissions, authorization, staff/admin workflows, or destructive operations;
- UI, navigation, accessibility, forms, or critical member-facing behavior;
- PWA installation, offline behavior, caching, or service workers;
- push subscription, reactivation, or notification delivery;
- attendance, check-in, registration, profile, event, ministry, or other data workflows; or
- any behavior whose correctness depends on a physical device, browser, external identity provider, or Product Owner judgment.

Record the tester, environment, acceptance scope, time, result, and any warning. A push acceptance test must be targeted to exactly one consenting production subscription, with an explicit send gate and no automatic retry or broadcast.

## Rollback contract

### Code-only rollback

Preserve the current authoritative production database. Before replacing source, prove that the prior approved build can safely operate against the current database schema and data. Restore the exact prior source/build, its locked dependencies, and its compatible production configuration references; then restart only `fog-v3` and repeat production smoke.

### Schema- or data-affecting rollback

Do not assume source rollback is safe. Follow the release's approved migration-specific recovery plan. Depending on verified data written since release, recovery may require forward repair, a reverse migration, or an SQLite-safe restore plus reconciliation. Protect the failed state and all newer writes before action.

V1 is never the routine rollback path. It remains Tier 4 emergency fallback under the Post-Launch Stabilization Policy and requires explicit Product Owner authorization plus a V3/V1 data-divergence and reconciliation decision before reactivation.

## Emergency hotfix workflow

When urgency prevents the normal timeline, use this shortened path without removing its safety gates:

1. Reproduce and diagnose on staging whenever practical.
2. Implement the smallest change in the canonical staging repository.
3. Run targeted regression and security checks.
4. Commit and record one immutable hotfix SHA.
5. Classify data, schema, environment, and rollback effects.
6. Obtain explicit Product Owner approval for that SHA and procedure.
7. Verify production integrity and create the required production backup.
8. Promote the exact verified artifact and act only on `fog-v3`.
9. Run production smoke and required human acceptance.
10. Record the release and reconcile any emergency operational deviation immediately.

Emergency does not authorize permanent production file edits, unsafe production-to-staging database copying, bypassing source control, weakening verification, or casually reopening V1. If a direct production edit is genuinely unavoidable, capture the exact change, obtain authorization, minimize exposure, and immediately reproduce and commit it in the canonical staging/source history so production and source control cannot silently diverge.

## Reusable release checklist

### Prepare

- [ ] Change developed in the staging repository
- [ ] Relevant named tests and static checks pass
- [ ] Staging runtime smoke passes
- [ ] Required physical/human staging acceptance passes
- [ ] Staging working tree is clean
- [ ] Full release-candidate SHA is recorded
- [ ] Change classification and known warnings are recorded
- [ ] Immutable artifact, file manifest, and checksum are prepared

### Approve

- [ ] Product Owner approves the exact SHA and classified procedure
- [ ] Database/schema/data implications are reviewed
- [ ] Environment-specific implications are reviewed
- [ ] Rollback compatibility and strategy are confirmed
- [ ] Manual gates and authorized operators are identified

### Production preflight

- [ ] `fog-v3` is healthy and its path/port/environment mechanism are confirmed
- [ ] Production database integrity is `ok`
- [ ] Required SQLite-safe production backup is created
- [ ] Backup integrity, checksum, permissions, and reference are verified
- [ ] Current production source and rollback point are preserved
- [ ] V1 and staging isolation is confirmed
- [ ] Write-control and database-handoff plan is ready

### Promote

- [ ] Exact approved SHA/build is installed from the verified artifact
- [ ] Production environment and secrets are preserved
- [ ] Authoritative production database is preserved via the approved SQLite-safe handoff
- [ ] No staging database/configuration/subscription is included
- [ ] Only `fog-v3` is restarted/reloaded/reconstructed if required
- [ ] Installed source fingerprint matches the approved manifest

### Verify

- [ ] PM2 identity, online state, and restart stability pass
- [ ] Local port 3003 HTTP health passes
- [ ] Public HTTPS and canonical redirects pass
- [ ] Schema contract and database integrity pass
- [ ] Authentication and `/api/auth/me` smoke pass
- [ ] Representative application and authorization smoke pass
- [ ] No new startup/database/configuration errors appear
- [ ] Required human acceptance passes

### Close

- [ ] Production release SHA and artifact checksum are recorded
- [ ] Deployment date/time and operator are recorded
- [ ] Migration or `NONE` is recorded
- [ ] Production backup reference is recorded
- [ ] Smoke and human acceptance results are recorded
- [ ] Release notes and known warnings are recorded
- [ ] Rollback point and compatibility are recorded
- [ ] Product Owner closes the release

## Release-record template

```text
Release title:
Production release SHA:
Artifact filename and SHA-256:
Previous production release/fingerprint:
Branch/source repository:
Change classification(s): A / B / C / D / E / F
Change summary:
Known warnings or deferred work:

Staging acceptance:
- Automated/static checks:
- Runtime smoke:
- Human acceptance (tester/time/result or NOT REQUIRED):

Product Owner approval:
- Approver:
- Approved SHA:
- Approval date/time:
- Approved operational scope:

Production preflight:
- fog-v3 baseline:
- Database integrity:
- Starting schema contract:
- Backup path/checksum/integrity or NOT APPLICABLE:
- Rollback point:
- Environment-isolation result:

Promotion:
- Operator and date/time:
- Installed artifact/fingerprint:
- Migration performed (name/evidence or NONE):
- PM2 action (fog-v3 only or NONE):

Production verification:
- PM2/local/public health:
- Authentication/application smoke:
- Schema/database integrity:
- Human acceptance (tester/time/result or NOT REQUIRED):

Release closure:
- Final result:
- Current authoritative production release:
- Current rollback option and schema compatibility:
- Incidents/warnings:
- Product Owner closure:
```

## Current process risks and controls

1. Production has no Git metadata. Control this with immutable release artifacts, manifests, checksums, and installed-tree fingerprint comparison; never infer production identity from a directory name.
2. The application database path is working-directory relative. Every release needs an explicit SQLite-safe database handoff and PM2 working-directory check.
3. The repository has no substantive automated `npm test` suite. Record targeted checks and prioritize adding maintained automated coverage without weakening current manual gates.
4. The audited P3 tooling is stored as recovery/cutover material rather than a general in-repository release tool. Reuse its verified patterns, but create and review a release-specific procedure; never rerun launch-only V1 migration steps by default.
5. Live PM2 state and its saved dump can diverge. Verify both safely before any PM2 persistence change, without exposing environment values.
6. Schema compatibility determines whether application-only rollback is safe. Treat compatibility as an explicit assertion, not an assumption.
7. Production may contain writes newer than every backup and all V1 data. Quantify and preserve those writes before any data recovery or Tier 4 fallback.
