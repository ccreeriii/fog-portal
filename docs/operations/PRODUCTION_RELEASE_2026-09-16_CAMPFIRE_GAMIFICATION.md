# Production Release — Campfire & Weekly Challenge Polish

**Application:** Fire Of God Ministries Community Portal
**Production deployment date:** 2026-09-16
**Status:** Accepted in Production

## Production release

Deployed code commit:

`c33dc40784783e70bbb410ec0c2e21333b8ca95b`

Git release tag:

`production-20260916-campfire-gamification`

Previous Production baseline:

`0a72b4f46679d11f7756fa69c3d18432ae7ffbba`

## Scope

This release deployed exactly eight runtime files:

- `lib/help-faq.js`
- `public/faq/index.html`
- `public/index.html`
- `public/js/community-feature-polish.js`
- `public/js/v6-gamification.js`
- `public/js/v9-growth-games.js`
- `public/sw.js`
- `server.js`

No staging database was copied to Production.

No Production Campfire data was replaced.

No Weekly Challenge records or completion records were migrated.

## Delivered changes

- Restored Campfire/group thumbnail rendering.
- Preserved existing group logos when editing without selecting a replacement image.
- Added clean fallback presentation for groups without logos.
- Renamed Spiritual Growth navigation to:
  - Weekly Challenges
  - Games
  - Journey Board
- Added Journey Board pastoral wording:
  - "Celebrating our growth together"
- Changed user-facing Growth XP terminology to Life Points.
- Added Weekly Challenge completion flow.
- Hardened Weekly Challenge completion to canonical authenticated member identity.
- Prevented duplicate challenge reward credit.
- Added Weekly Challenge administration:
  - list
  - create
  - edit
  - archive
- Added canonical server-side authorization to Gamification administration.
- Added Help & FAQ Back to Home Dashboard navigation.
- Advanced PWA cache to `fog-portal-v33`.

## Verification

Staging automated verification before release:

- Tests: 409
- Passed: 408
- Failed: 0
- Intentional skip: 1
- SQLite integrity: PASS
- Real-user staging acceptance: PASS

Production deployment verification:

- Exact RC runtime hashes: PASS
- Production syntax: PASS
- PM2 `fog-v3`: online
- Local HTTP port 3003: HTTP 200
- Public `https://fogmin.site`: HTTP 200
- New release assets: PASS
- FAQ: PASS
- Weekly Challenge read: PASS
- Anonymous challenge completion rejected: PASS
- Anonymous Gamification administration rejected: PASS
- Production SQLite integrity after deployment: PASS
- Campfire data/hash preservation: PASS
- Authenticated browser acceptance: PASS
- Mobile/PWA acceptance: PASS

## Production data preservation

Production Campfire data remained unchanged across deployment.

Production retained:

- Torchbearers
- Dad Buds
- Momshies

The staging-only Test Campfire was not copied to Production.

## Recovery artifacts

Deployment workspace:

`/home/raspi4/koinonia-recovery/prod-deploy-campfire-20260916-124844`

Runtime rollback archive:

`/home/raspi4/koinonia-recovery/prod-deploy-campfire-20260916-124844/runtime-before-deploy.tar.gz`

Runtime rollback SHA-256:

`499dec320eae61751b0067b5050a06c81d0b48b23bfea28ed18ab71e31a5d148`

Production database safety backup:

`/home/raspi4/koinonia-recovery/prod-deploy-campfire-20260916-124844/fog_community_before_deploy.db`

Database backup SHA-256:

`dcdcd2b02985dc8dd9d66e5ffbf78702a62c28a98370e0eeb9464b3053bac810`

Database backup integrity:

`ok`

## Release decision

Production acceptance is complete.

This release becomes the new documented Production code baseline:

`c33dc40784783e70bbb410ec0c2e21333b8ca95b`

Further feature development must occur in staging first and follow the established staging-to-production release workflow.
