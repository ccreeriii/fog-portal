# Premium Redesign Production Release — 2026-09-16

## Release Status

**ACCEPTED / DEPLOYED / VISUALLY APPROVED / TAGGED / FROZEN**

Finalized: `2026-09-17 01:05:30 +0800`

Official application name: **Fire Of God Ministries Community Portal**

## Release Identity

- Production tag: `production-20260916-premium-redesign`
- Exact deployed commit: `c170b5ba7c1a63c1edfeba98f078c202b757a144`
- Previous Production tag: `production-20260916-final-prelaunch`
- Previous Production commit: `4d36cb4f8921a31dcdc78f977b37f1343dd99c5d`
- Premium CSS: `v10`
- Community Feature Polish: `v7`
- PWA cache: `fog-portal-v46`

The Production tag intentionally points to the exact deployed runtime
commit. The documentation commit created after tagging is not part of
the deployed runtime.

## Accepted Staging Verification

Before Production deployment:

- Total tests: **427**
- Passed: **426**
- Failed: **0**
- Intentional skipped: **1**
- SQLite integrity: **ok**
- Six premium banner targets verified
- Daily Gospel sage readability regression verified

## Production Deployment Acceptance

Production acceptance completed successfully with:

- Local Production HTTP: **200**
- Public Production HTTPS: **200**
- Exact runtime hashes matched the release checkpoint
- All six premium banner API values matched the accepted staging release
- All six public banner files matched Production bytes by SHA-256
- Premium banner unauthenticated write test returned **401**
- Post-deployment SQLite integrity: **ok**
- Exactly six premium banner settings present
- No new `fog-v3` error-log lines after deployment
- Only PM2 process `fog-v3` was restarted
- Production data was preserved
- Manual live Production visual acceptance: **APPROVED**

## Runtime Files

- `public/css/fog-premium.css` — SHA-256 `2f5146116a62e9b9c85d42b8bf0706f0c7e298a97cba8de930610315378364e4`
- `public/index.html` — SHA-256 `de94e0674d6ca996a85270a6f0e471aca3c65fac58c5cb6904aefeecd362b6bc`
- `public/js/community-feature-polish.js` — SHA-256 `f04b55c105536bd9a3681b8f998d185da906a31d5865100dcc7bee3c368dcf0d`
- `public/sw.js` — SHA-256 `905489cd5bb4fff469b73ab78c21d4b4013693c2ca0b33920672d90a0131f203`
- `server.js` — SHA-256 `f73f572627dfa338ae147973627053c276d0aca93e4f4123ec0e877208b8918b`

## Premium Banner Runtime Media

- `prayer-page-banner.jpg` — SHA-256 `2592abcf6de7fdac8c5dba16916f61a82b46718985479f32ac6255427f340589`
- `journal-page-banner.jpg` — SHA-256 `bfe7740deec8569139c06c8bb971d8888d0af26f41e9666056cc4edfb0736705`
- `groups-page-banner.jpg` — SHA-256 `2908380e855a8cd7ecf0fac237bfbe0a9dc600ed57f84c43769e43be1efae1fa`
- `growth-page-banner.jpg` — SHA-256 `663f6c6e1a688d97c016b562886321462184472a814ce1c2b2d7e77c0a759739`
- `events-page-banner.jpg` — SHA-256 `5e9fbf1c4c8e98038ae68c5db7397680c808fe38ec91dbe3c0f557d06ecbb51a`
- `arcade-page-banner.jpg` — SHA-256 `75043bf5708d61b337219269f038e02af5c56d4d65d7437b7d84a9c72cd9832b`

## Production Banner Settings

- `premium_banner_arcade` → `/runtime-media/premium-banners/arcade-page-banner.jpg?v=1789572886903`
- `premium_banner_events` → `/runtime-media/premium-banners/events-page-banner.jpg?v=1789572600336`
- `premium_banner_groups` → `/runtime-media/premium-banners/groups-page-banner.jpg?v=1789573763733`
- `premium_banner_growth` → `/runtime-media/premium-banners/growth-page-banner.jpg?v=1789571825062`
- `premium_banner_journal` → `/runtime-media/premium-banners/journal-page-banner.jpg?v=1789569546628`
- `premium_banner_prayer` → `/runtime-media/premium-banners/prayer-page-banner.jpg?v=1789571052335`

## Recovery Artifacts

### JIT Production Database Backup

- Path: `/home/raspi4/koinonia-recovery/prod-premium-redesign-20260916-222230/fog_community_before_premium_redesign.db`
- SHA-256: `0b09de8c8655d958e60bac8c806581fdd4f4f6daa6f9fe5d077f341137df5f1c`
- Integrity check: **ok**

### Runtime Rollback Archive

- Path: `/home/raspi4/koinonia-recovery/prod-premium-redesign-20260916-222230/runtime-before-deploy.tar.gz`
- SHA-256: `c8eb10ed559780da581d2e2f41ce1dafc86a9c8832df36e7661050763c946efd`

## Release Scope

The premium redesign established the accepted visual system across:

- Home
- Growth
- Prayer
- Private Journal
- Groups / Campfires & Fire Circles
- Events
- FOG Arcade

The release includes:

- warm ivory / cream Community Portal canvas
- FOG copper / orange / brown premium visual language
- six independent premium page banners
- persistent banner runtime storage outside Git-managed public assets
- strong-admin banner upload protection
- unified hero sizing and typography
- premium card and navigation styling
- Private Journal presentation refinement
- Growth Daily Gospel soft-sage readability treatment
- responsive/mobile presentation refinements

## Production Freeze

This release is now frozen.

Production must not be direct-edited. Future changes must begin from an
audited staging branch, pass regression and manual staging acceptance,
then use the controlled staging-to-Production release workflow.

The six premium banner files under `runtime-data/premium-banners/` are
persistent Production runtime media and must be preserved across future
code deployments.

The Production database must never be replaced with the staging
database.

---

Release closure: **COMPLETE**
