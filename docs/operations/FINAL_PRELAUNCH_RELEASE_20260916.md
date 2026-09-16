# Fire Of God Ministries Community Portal
## Final Pre-launch Production Release — 2026-09-16

### Release status

**Status:** PRODUCTION ACCEPTED AND FROZEN

**Production RC:** `4d36cb4f8921a31dcdc78f977b37f1343dd99c5d`

**Production tag:** `production-20260916-final-prelaunch`

**Previous Production RC:** `c33dc40784783e70bbb410ec0c2e21333b8ca95b`

**Production runtime:** `/home/raspi4/fogmin-portal-v3`

**Production PM2 process:** `fog-v3`

**Production port:** `3003`

---

## Acceptance Summary

### Staging

- Automated regression: **415 tests**
- Passed: **414**
- Failed: **0**
- Intentional skip: **1**
- Manual staging acceptance: **PASS**
- Campfire / Fire Circle workflow: **PASS**
- Prayer Wall pastoral review workflow: **PASS**
- Help & FAQ refresh: **PASS**
- PWA cache update: **PASS**

### Production

- Controlled six-file deployment: **PASS**
- Runtime exactly matches accepted RC: **PASS**
- Database integrity: **PASS**
- `group_type` additive migration: **PASS**
- Existing group/member data preservation: **PASS**
- Local Production HTTP 200: **PASS**
- Public Production HTTP 200: **PASS**
- PWA cache `fog-portal-v34`: **PASS**
- Unauthorized Group mutation rejected: **PASS**
- Unauthorized Prayer mutation rejected: **PASS**
- New critical runtime errors after deployment: **NONE**
- Manual Production acceptance: **PASS**

Manual Production acceptance was operator-confirmed on **2026-09-16** after validating the live Community Portal and installed PWA.

---

## Runtime Deployment Scope

Exactly these six runtime files were promoted:

1. `lib/help-faq.js`
2. `public/index.html`
3. `public/js/community-feature-polish.js`
4. `public/js/v2-discipleship.js`
5. `public/sw.js`
6. `server.js`

No staging database was copied to Production.

---

## Released Features

### Campfires and Fire Circles

- Groups now have explicit identity:
  - `campfire`
  - `fire_circle`
- Existing groups safely defaulted to Campfire.
- Group type remains independent from privacy.
- No automatic member reassignment was introduced.
- Create/Edit Group supports explicit Group Type selection.
- Group cards display Campfire / Fire Circle badges.
- Existing logos and memberships were preserved.

### Prayer Wall Pastoral Review

Before submitting a public Prayer Wall request, members are reminded to:

- respect privacy and dignity,
- avoid identifying others without appropriate consent,
- avoid unnecessary sensitive details,
- focus on the prayer intention,
- understand that Anonymous hides the poster, not people named in the request,
- use pastoral leadership channels for sensitive matters.

### Help & FAQ

Help content now reflects:

- Campfires & Fire Circles,
- the canonical seven-stage Growth Journey,
- Prayer Partner terminology,
- Private Journal,
- Life Points,
- Weekly Challenges,
- Games,
- Journey Board,
- Notification Center and preferences,
- permission-controlled Discipleship leadership help.

---

## Production Data Preservation Evidence

Existing Group/member invariant before deployment:

`f897ecc155ef0a0b5dbddad30005cd5be3a5b00700a8daaa6c5022d8ae3ad78d`

Existing Group/member invariant after deployment:

`f897ecc155ef0a0b5dbddad30005cd5be3a5b00700a8daaa6c5022d8ae3ad78d`

**Result:** exact preservation confirmed.

### Known pre-existing data issue

Production Group **Momshies** had a pre-existing nonstandard
`privacy_level` value:

`2026-09-08 11:42:57`

This value existed before this release and was deliberately preserved.
It was **not** silently repaired as part of this deployment.

Any correction should be handled separately through a controlled,
audited data-repair task.

---

## Recovery Artifacts

### Preflight Production DB backup

`/home/raspi4/koinonia-recovery/final-prelaunch-rc-20260916-142713/fog_community_prod_preflight.db`

SHA-256:

`52a876500b64ffbc69205ca02b408fe18611df0339ad3d6e2b6098f283476272`

### Just-in-time Production DB backup

`/home/raspi4/koinonia-recovery/prod-final-prelaunch-20260916-143624/fog_community_before_deploy.db`

SHA-256:

`2ab2dfc8649a032bcadcec1dbe7b50bc2f520b69d6ba6f12efcd467e8bc228a2`

### Runtime rollback archive

`/home/raspi4/koinonia-recovery/prod-final-prelaunch-20260916-143624/runtime-before-deploy.tar.gz`

SHA-256:

`9eaa34b77f5d3cc0c3cf629175d2e8cf7323bfa6d4cd82295108665d8efb2363`

---

## Release Freeze

The Production Community Portal is frozen at:

`4d36cb4f8921a31dcdc78f977b37f1343dd99c5d`

Tag:

`production-20260916-final-prelaunch`

After this release:

- no direct Production source edits,
- no uncontrolled Production database edits,
- all further changes begin in staging,
- automated regression and manual acceptance remain required before promotion,
- Production recovery artifacts must be preserved.

This release completes the final pre-launch Campfire / Fire Circle,
Prayer Wall pastoral review, and Help & FAQ readiness work.
