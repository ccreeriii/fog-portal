# Leaderboard Cleanup Production Release — 2026-09-17

## Release Status

**DEPLOYED / VERIFIED / TAGGED / FROZEN**

Official application: **Fire Of God Ministries Community Portal**

## Release Identity

- Production tag: `production-20260917-leaderboard-cleanup`
- Exact deployed commit: `ddada29c9db1439bdf3ddf6d9ebd0e58ee2aad8f`
- Production server SHA-256: `e759881007fdf5157a96369dfe4ef466fa6c6f891387a41d5ac50f033bfc5bb3`
- Production process: `fog-v3`
- Production PID at closure: `74130`
- Staging PID at closure: `73835`

The Production tag intentionally points to the exact deployed runtime
checkpoint. This release-document commit is created after tagging and is
not part of the deployed runtime.

## Requested Cleanup

Only the following accounts were reset:

- Cris Caballes — Youth ID 6
- Catarina Jana E. Lim — Youth ID 16
- Cazandra Jana E. Lim — Youth ID 17

Final stored gamification points for all three: **0**

The following account was not reset:

- Fire Of God Ministries — Youth ID 209

Its stored **75 points remain preserved**, but it is excluded from all
audited leaderboard and ranking calculations.

## Superadmin Ranking Exclusion

The superadmin exclusion covers:

- Public Arcade daily ranking
- Public Arcade weekly ranking
- Public Arcade previous-week ranking
- Public Arcade monthly ranking
- Public Arcade all-time ranking
- Public Arcade game rankings
- Public Arcade V2 equivalents
- Overall leaderboard
- Growth leaderboard
- Arcade leaderboard
- Game-specific Top 3
- Faith Quest leaderboard
- Group leaderboard contribution

The superadmin remains a valid Portal account and remains a member of
Torchbearers. Only competitive ranking participation is excluded.

At Production acceptance, Torchbearers ranked aggregate excluded the
superadmin contribution:

- total ranked points: **349**
- ranked contributing members: **3**

## Reset Scope

For the three requested accounts only:

- `gamification_points` totals reset to zero
- `point_transactions` rows removed
- `arcade_score_logs` rows removed
- matching Faith Quest leaderboard rows removed by exact canonical name

Profiles, user accounts, attendance, ministries, groups, Prayer,
Journal, Events and other member data were not reset.

Non-target leaderboard data was verified unchanged against pre-mutation
snapshots.

## Recovery Package

Recovery directory:

`/home/raspi4/koinonia-recovery/prod-leaderboard-cleanup-20260917-162728`

WAL-safe Production database backup:

`/home/raspi4/koinonia-recovery/prod-leaderboard-cleanup-20260917-162728/fog_community_before_leaderboard_cleanup.db`

- SHA-256: `9c95c1930563dce28f9b4fe06709c02496968a21e1de51ce1f7a9ecfd00cd53b`
- SQLite integrity: **ok**

Pre-release Production server rollback:

`/home/raspi4/koinonia-recovery/prod-leaderboard-cleanup-20260917-162728/server.js.before`

## Verification

Staging regression before Production deployment:

- tests: **432**
- passed: **431**
- failed: **0**
- intentional skipped: **1**

Production acceptance:

- Database integrity: **ok**
- Local HTTP: **200**
- Public HTTP: **200**
- Cris Caballes: **0**
- Catarina Jana E. Lim: **0**
- Cazandra Jana E. Lim: **0**
- Fire Of God Ministries stored points: **75**
- Superadmin absent from audited individual ranking APIs
- Superadmin excluded from group leaderboard contribution
- Only `fog-v3` was restarted during deployment
- `fog-staging` remained untouched during Production deployment

## Final State

Production is healthy and this leaderboard-cleanup release is frozen.
Future leaderboard changes must begin from a new audited staging branch.
