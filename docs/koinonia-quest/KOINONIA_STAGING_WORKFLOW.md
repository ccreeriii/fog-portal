# KOINONIA Online Staging Workflow & Runtime Architecture

**Document Version:** 1.0.0  
**Phase:** 0.23H Baseline  
**Date:** September 14, 2026  
**Status:** Active Canonical Specification  

---

## 1. Executive Summary

This specification establishes the standardized operational development, testing, staging, and promotion workflow for **KOINONIA**.

It defines the strict boundaries between **Main App (Community Portal)** and **KOINONIA (Quest & Social System)**, establishes canonical runtime environments, details the immutable snapshot release model, and enforces strict pre-deployment verification standards to protect user data, production uptime, and public beta stability.

---

## 2. Core Governance & Isolation Principles

1. **STAGING IS NOT PRODUCTION**  
   The staging environment (`koinonia-staging.fogmin.site`) is an isolated pre-release qualification environment. Experimental features, mock harnesses, and preliminary UI workflows are evaluated here without risking production data or public users.

2. **PUBLIC BETA IS NOT AUTOMATICALLY UPDATED**  
   The public beta environment (`koinonia-beta.fogmin.site`) serves live members and is updated only through explicit, deliberate promotion of fully accepted and verified staging checkpoints.

3. **MAIN APP IS A SEPARATE RELEASE LANE**  
   KOINONIA development operates with absolute isolation from the Main App (Fire of God Ministries Portal):
   - **Zero Main App database modifications** (`fog_community.db` is strictly isolated; Shared Core operates in read-only/mock mode during development).
   - **Zero Main App file modifications** (no changes to `/home/raspi4/fog-portal-staging`, `fog-portal`, `fogmin-portal-v3`, or `fog-portal-v2`).
   - **Zero Main App authentication modifications** (KOINONIA uses namespaced local identity storage and independent session headers).
   - **Zero Main App process restarts** (`fog-staging`, `fog-v3`, `fog-portal`, `fog-v2` PM2 processes are never signaled or restarted).
   - **Zero Main App Cloudflare tunnel or DNS routing changes**.

---

## 3. Canonical Environments

| Environment | Public Hostname | PM2 Process Name | Bound Port | Upstream Prototype Path | Purpose / Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **KOINONIA Staging** | `https://koinonia-staging.fogmin.site` | `koinonia-staging` | `127.0.0.1:3006` | `prototype/koinonia-phase23_5` (candidate) | Isolated online staging environment for mobile QA, leadership sign-off, and cross-device testing. |
| **KOINONIA Public Beta** | `https://koinonia-beta.fogmin.site` | `koinonia-beta` | `127.0.0.1:3005` | `prototype/koinonia-phase22_1` (accepted) | Live public beta environment. Frozen until intentional promotion. |
| **Future Production** | `https://koinonia.fogmin.site` | `koinonia` (future) | TBD | Future production release artifact | Production deployment target for full congregation launch. |

*Note on Main App processes for reference:*
- `fog-staging` (`staging.fogmin.site`): Port 3001
- `fog-v3` (`fogmin.site`): Port 3003
- `fog-portal`: Port 3000
- `fog-v2`: Port 3002

---

## 4. The 10-Step Development Workflow

All KOINONIA enhancements, fixes, and features must follow this rigorous 10-step lifecycle:

```
[1. Checkpoint] ──> [2. Snapshot] ──> [3. Implement] ──> [4. Automated Tests] ──> [5. Regressions]
                                                                                         │
[10. Deliberate Beta] <── [9. Git Push] <── [8. Git Commit] <── [7. Physical QA] <── [6. Staging Deploy]
```

### DEVELOPMENT FLOW

1. Start from last accepted checkpoint.
2. Create next immutable prototype snapshot.
3. Implement only in new snapshot.
4. Run automated tests.
5. Run regression tests.
6. Deploy candidate to koinonia-staging.
7. Physical mobile/browser QA.
8. Commit only after acceptance.
9. Push accepted checkpoint.
10. Public koinonia-beta is promoted only deliberately.

### Step 1 — Start from Last Accepted Checkpoint
Always begin work on a clean, physically accepted Git commit SHA. Identify the immutable accepted prototype directory (e.g., `prototype/koinonia-phase23_4` at Git SHA `3b6cfdeea93e308958d8d2e107062a95d70387ab`).

### Step 2 — Create Next Immutable Prototype Snapshot
Never edit previously accepted prototype folders. Clone the accepted snapshot into the new target directory (e.g., `cp -r prototype/koinonia-phase23_4 prototype/koinonia-phase23_5`). The prior folder becomes an immutable historical reference and regression benchmark.

### Step 3 — Implement Only in New Snapshot
Make focused, targeted code changes strictly inside the new snapshot directory:
- Update runtime constants (`PHASE`, `VERSION`, `CACHE_NAME`).
- Ensure service name and environment labels are dynamic (`KOINONIA_SERVICE_NAME`, `KOINONIA_ENVIRONMENT`).
- Update service worker (`sw.js`) and HTML cache-busting strings (`?v=...`).
- Implement the requested feature or fix without refactoring unrelated code.

### Step 4 — Run Automated Unit & Module Tests
Execute syntax checks and phase-specific automated test suites:
- `node -c prototype/koinonia-phaseXX/*.js prototype/koinonia-phaseXX/data/*.js`
- Run dedicated test scripts for the current phase (e.g., `node prototype/koinonia-phaseXX/test_phaseXX_*.js`).
- Require 100% pass rate before proceeding.

### Step 5 — Run Regression Tests
Verify that prior phase capabilities remain completely unbroken:
- Execute all ancestor automated suites against their immutable directories.
- Confirm zero regressions in Studio governance, Shared Core contracts, or presence instancing.

### Step 6 — Deploy Candidate to `koinonia-staging`
Only after all automated tests pass, deploy the candidate code to the staging PM2 process:
- Update PM2 `koinonia-staging` configuration or symlink to point to the new snapshot directory.
- Restart only `koinonia-staging` (`pm2 restart koinonia-staging`).
- **Never touch** `koinonia-beta`, `fog-staging`, or `fog-v3`.
- Verify HTTP `200` on `https://koinonia-staging.fogmin.site/health` and verify correct `service`, `environment`, `phase`, and `version` reporting.

### Step 7 — Physical Mobile & Browser QA
Perform real-device browser testing against `https://koinonia-staging.fogmin.site`:
- Verify service worker update and cache clearing.
- Execute full persona workflows (e.g., Sarah Admin draft creation -> Father Alex Superadmin review & approval).
- Verify responsive layout, touch targets, and mobile navigation ergonomics.
- Verify zero network errors or unexpected console errors.

### Step 8 — Commit Only After Acceptance
Do not create Git commits until physical acceptance is explicitly confirmed:
- Stage only changed files in the new prototype and documentation.
- Do not commit untracked build artifacts, zip archives, or SQLite database files.
- Write a clear, descriptive commit message detailing the phase, acceptance status, and verified features.

### Step 9 — Push Accepted Checkpoint
Push the commit to the remote repository (`git push origin feature/koinonia-quest` or target branch).
Verify remote branch sync.

### Step 10 — Public `koinonia-beta` is Promoted Only Deliberately
Promotion of staging to public beta is a deliberate, separate release action:
- Public beta is **never** automatically updated when staging changes.
- Promotion requires an explicit user command authorizing promotion to port 3005.
- Production deployment (`koinonia.fogmin.site`) requires formal governance approval.

---

## 5. Runtime Service Identity & Environment Standards

### Configuration Variables
Koinonia prototype servers dynamically configure identity via environment variables with safe defaults:

- `KOINONIA_SERVICE_NAME`: Logical service identifier.
  - Default: `koinonia`
  - Staging: `koinonia-staging`
  - Beta: `koinonia-beta`
  - Production: `koinonia`
- `KOINONIA_ENVIRONMENT`: Runtime environment label.
  - Default: `development`
  - Staging: `staging`
  - Production: `production`
- `KOINONIA_DEV_PORT`: Standalone HTTP port.
  - Staging: `3006`
  - Beta: `3005`
  - Local dev / QA: `18111` or ephemeral
- `KOINONIA_DEV_SHARED_CORE`: Shared Core data layer mode.
  - Values: `mock` (development/staging read-only proxy) or undefined (local default)

### Endpoint Schemas

#### 1. `/health` Endpoint
Returns lightweight health and environment identification JSON.
```json
{
  "status": "healthy",
  "service": "koinonia-staging",
  "environment": "staging",
  "phase": "0.23H",
  "version": "0.23H",
  "sharedCoreMode": "mock-readonly",
  "uptimeSeconds": 42,
  "timestamp": "2026-09-14T08:30:00.000Z"
}
```

#### 2. `/runtime-config.js` Endpoint
Serves JavaScript defining `window.__KOINONIA_RUNTIME_CONFIG__` for browser client runtime adaptation:
```javascript
window.__KOINONIA_RUNTIME_CONFIG__ = {
  "service": "koinonia-staging",
  "environment": "staging",
  "phase": "0.23H",
  "version": "0.23H",
  "sharedCoreMode": "mock",
  "remoteReadsEnabled": true,
  "remoteMutationsEnabled": false,
  "baseUrl": ""
};
```

### Security & Privacy Enforcements
- Zero exposure of file paths (`__dirname`, `/home/raspi4/...`).
- Zero exposure of authentication tokens, API keys, or session secrets.
- Zero exposure of internal network topology or Cloudflare tunnel UUIDs.
- `remoteMutationsEnabled` is hardcoded to `false` to guarantee zero upstream DB mutation.

---

## 6. Emergency Rollback Procedures

If a staging or beta deployment exhibits defects:

1. **Immediate Process Reversion**  
   Point PM2 back to the previous accepted immutable snapshot:
   ```bash
   # Example: revert staging to phase23_4
   pm2 restart koinonia-staging --update-env
   ```
2. **Client Cache Invalidation**  
   The `no-cache` directives on `/sw.js` and `/index.html` ensure clients pull updated manifest and script query parameters immediately upon reload.
3. **Main App Protection Guarantee**  
   Because KOINONIA processes run on dedicated ports (3005, 3006) with isolated memory/mock storage, no rollback actions ever impact the Main App.
