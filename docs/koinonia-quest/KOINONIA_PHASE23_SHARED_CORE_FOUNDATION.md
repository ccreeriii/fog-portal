# KOINONIA — Phase 0.23B: Shared Core Provider Foundation

## 1. Executive Summary & Purpose

Phase 0.23B establishes the foundational architectural bridge between **KOINONIA** and the **Fire Of God Ministries Community Portal (Main App)** without connecting to live remote backends or modifying staging/production systems.

```
KOINONIA Gameplay Engine (game.js)
              ↓
Shared Core Provider Abstraction (shared_core_provider.js)
              ↓
  ┌───────────────────────────────────────────────┐
  │                                               │
  ▼                                               ▼
[LocalSharedCoreProvider]              [RemoteSharedCoreProvider]
- ACTIVE & DEFAULT                     - SCAFFOLDING ONLY (DISABLED)
- In-Memory & LocalStorage             - Safe HTTP Client (shared_core_client.js)
- Full 30-Method Contract              - Strict /api/v1/shared/* Gating
- Zero Network / Zero Backend          - Fail-Closed Mutation Policy
                                       - Enforced Idempotency Keys
                                       - Zero Database Access
```

### Core Invariants:
1. **Two Experiences, One Community, One Source of Truth:** Establishes the provider interface contract to allow future authenticated synchronization of Life Points, attendance, callings/quests, campfires, and ministries without rewriting gameplay systems.
2. **Local Provider Remains Active Default:** `createSharedCoreProvider()` defaults to `LocalSharedCoreProvider`. The remote provider cannot be activated merely by existing.
3. **Fail-Closed & Safe:** Remote mode requires explicit opt-in (`providerMode: 'remote'`), and remote mutations require a second explicit gate (`remoteMutationsEnabled: true`). Both are disabled by default.
4. **Zero Split-Brain State:** If a remote mutation fails, it never falls back silently to local state.
5. **Absolute Environment Isolation:** Main App staging, production, PM2, Cloudflare, and databases were **NOT touched, modified, or restarted**.

---

## 2. Architecture & Provider Selection Model

### 2.1 Provider Factory (`data/shared_core_provider.js`)
The factory initializes the appropriate provider based on explicit configuration options:

```javascript
const DEFAULT_PROVIDER_CONFIG = {
  providerMode: 'local',           // 'local' | 'remote' — DEFAULT MUST BE LOCAL
  remoteReadsEnabled: false,       // Default disabled
  remoteMutationsEnabled: false,   // Default disabled
  baseUrl: '',                     // No hardcoded IP or remote domain
  timeoutMs: 8000,
  credentials: 'same-origin'
};

const provider = createSharedCoreProvider(options);
```

- If `options.providerMode !== 'remote'`, it unconditionally instantiates `LocalSharedCoreProvider`.
- If `options.providerMode === 'remote'`, it instantiates `RemoteSharedCoreProvider` with `remoteReadsEnabled: false` and `remoteMutationsEnabled: false` unless explicitly overridden.

### 2.2 Global Singleton Access & Resolution
In `prototype/koinonia-phase23/game.js`, the engine resolves the provider via:
```javascript
function getSharedCore() {
  if (typeof window !== 'undefined') {
    if (typeof window.getSharedCoreProvider === 'function') return window.getSharedCoreProvider();
    if (window.SharedCore) return window.SharedCore;
  }
  // Node.js fallback
  if (typeof require !== 'undefined') {
    try {
      const provMod = require('./data/shared_core_provider.js');
      if (typeof provMod.getSharedCoreProvider === 'function') return provMod.getSharedCoreProvider();
    } catch (_) {}
  }
  return null;
}
```

---

## 3. The 30-Method Public Contract

Both `LocalSharedCoreProvider` and `RemoteSharedCoreProvider` strictly implement the identical 30-method public contract:

| Category | Method | Local Behavior | Remote Behavior (Phase 0.23B Scaffolding) |
|---|---|---|---|
| **System** | `resetToBaseline()` | Resets local state to QA baseline | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Member** | `getCurrentMember()` | Returns Alex Rivera (seedling) | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Life Points** | `getLifePoints()` | Returns balance, level, XP, ledger | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Life Points** | `awardLifePoints(params)` | Applies LP/XP, verifies idempotency | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Quests** | `getQuests()` | Returns canonical catalog | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Quests** | `getQuest(id)` | Returns single quest record | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Quests** | `getQuestCompletion(id, mId)`| Returns completion record | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Quests** | `completeQuest(params)` | Completes quest & awards rewards | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Events** | `getEvents()` | Returns canonical event catalog | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Events** | `getEvent(id)` | Returns single event record | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Attendance** | `getAttendance(instId, mId)` | Returns attendance record | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Attendance** | `getAllAttendanceRecords()` | Returns all attendance records | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Attendance** | `checkIn(params)` | Records event check-in | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Campfires** | `getMyCampfires(mId)` | Returns member campfires | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Campfires** | `getCampfire(id)` | Returns campfire details | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Campfires** | `getCampfireMembers(id)` | Returns member IDs | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Campfires** | `getCampfireLeaders(id)` | Returns leader IDs | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Campfires** | `getCampfireGameState(id)` | Returns circle game state | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Campfires** | `getCampfireSettings()` | Returns capacity settings | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Campfires** | `setCommunityMaxParticipants(m)`| Sets community max | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Campfires** | `setCampfireCapacity(id, m, r)` | Sets campfire capacity | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Campfires** | `addReactionToCampfire(id, e)` | Adds structured reaction | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Ministries** | `getMinistries()` | Returns ministries catalog | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Ministries** | `getMyMinistries(mId)` | Returns enrolled ministries | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Ministries** | `getMinistryMissions(id)` | Returns ministry missions | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Ministries** | `getMyMinistryMissions(mId)` | Returns active missions | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Growth** | `getMilestones()` | Returns discipleship milestones| Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Growth** | `getGrowthProgress()` | Returns summary statistics | Reads disabled (`SHARED_CORE_READS_DISABLED`) |
| **Activity Bus** | `emitActivityEvent(params)` | Emits event with idempotency | Fails closed (`SHARED_CORE_MUTATIONS_DISABLED`) |
| **Activity Bus** | `getActivityEvents()` | Returns activity log | Reads disabled (`SHARED_CORE_READS_DISABLED`) |

---

## 4. Capability Metadata Model

Both providers expose capability metadata via `getCapabilities()` and the `.capabilities` getter:

```javascript
// Local Provider
provider.capabilities = {
  providerMode: 'local',
  remote: false,
  authenticated: false,
  readsEnabled: true,
  mutations: true,
  mutationsEnabled: true,
  lifePointsWrite: true,
  attendanceWrite: true,
  questCompletionWrite: true,
  campfireCapacityWrite: true,
  reactionsWrite: true,
  activityEventsWrite: true
};

// Remote Provider (Default Phase 0.23B State)
provider.capabilities = {
  providerMode: 'remote',
  remote: true,
  authenticated: false, // Becomes true in Stage 3 post-OAuth
  readsEnabled: false,
  mutations: false,
  mutationsEnabled: false,
  lifePointsWrite: false,
  attendanceWrite: false,
  questCompletionWrite: false,
  campfireCapacityWrite: false,
  reactionsWrite: false,
  activityEventsWrite: false
};
```

Gameplay and UI systems can unambiguously branch on `provider.capabilities.remote` without relying on fragile string comparisons.

---

## 5. Security Boundary & Safe HTTP Client

### 5.1 Route Whitelisting
`SharedCoreHttpClient` enforces strict route whitelisting:
- **Permitted Route Prefix:** `/api/v1/shared/*`
- **Strictly Rejected Routes:**
  - Legacy checkin: `/api/checkin`
  - Raw arcade/growth submissions: `/api/games/universal-submit`, `/api/growth-games/*`
  - Raw portal administrative mutations: `/api/members/*`, `/api/admin/*`
  - Authentication routes: `/auth/*`

Any request targeting a non-whitelisted path immediately returns:
```json
{
  "success": false,
  "error": "SHARED_CORE_INVALID_ROUTE",
  "code": "SHARED_CORE_INVALID_ROUTE",
  "message": "Rejected route: /api/checkin. Only /api/v1/shared/* endpoints are permitted."
}
```

### 5.2 Idempotency & Replay Protection
All consequential remote mutations require an `idempotencyKey`:
- Enforced on: `awardLifePoints()`, `completeQuest()`, `checkIn()`, `emitActivityEvent()`.
- If missing, the client fails closed with `SHARED_CORE_MISSING_IDEMPOTENCY_KEY` before any network activity.
- Automatic unsafe retries on mutation failure are **strictly disabled** to prevent double-awarding LP or duplicate check-ins.
- The same `idempotencyKey` is preserved if the client explicitly re-attempts a request.

### 5.3 Fail-Closed Dual Return Model
To ensure maximum developer ergonomics and backward compatibility, fail-closed results are wrapped in a dual thenable/property object:
```javascript
// Synchronous property access works:
const res = provider.awardLifePoints({ amount: 10 });
console.log(res.error); // "SHARED_CORE_MUTATIONS_DISABLED"

// Asynchronous await works:
const asyncRes = await provider.awardLifePoints({ amount: 10 });
console.log(asyncRes.error); // "SHARED_CORE_MUTATIONS_DISABLED"
```

---

## 6. Future Endpoint Contract Scaffolding

When remote Shared Core backend services are developed in future stages, they will align with this contract:

### Reads
- `GET /api/v1/shared/me` — Authenticated member profile, role, avatar
- `GET /api/v1/shared/points` — Life Points balance, character level, skill XP ledger
- `GET /api/v1/shared/content/quests` — Canonical Calling & Quest catalog
- `GET /api/v1/shared/quests/:id/completion` — Member quest completion status
- `GET /api/v1/shared/events` — Upcoming church and fellowship events
- `GET /api/v1/shared/attendance/:instanceId` — Event attendance record
- `GET /api/v1/shared/campfires` — Enrolled and nearby Campfire circles
- `GET /api/v1/shared/ministries` — Ministry catalog and active missions
- `GET /api/v1/shared/milestones` — Discipleship growth milestones

### Consequential Mutations (Future Only)
- `POST /api/v1/shared/points/award` — Server-authoritative LP ledger entry
- `POST /api/v1/shared/attendance/check-in` — Verified event attendance check-in
- `POST /api/v1/shared/quests/:id/complete` — Server-validated quest completion
- `POST /api/v1/shared/campfires/:id/capacity` — Role-gated campfire capacity update
- `POST /api/v1/shared/campfires/:id/reactions` — Safe structured encouragement emote
- `POST /api/v1/shared/activity/events` — Shared activity event bus dispatch

---

## 7. Absolute Safety & Non-Mutation Attestation

As mandated by repository rules:

1. **Main App Staging Code:** **UNTOUCHED (NO MODIFICATIONS)**
   The unrelated uncommitted work on branch `contact-support-v1-20260911` was preserved without change.
2. **Main App Production Code:** **UNTOUCHED (NO MODIFICATIONS)**
3. **Main App Databases (`fog_community.db`):** **BIT-FOR-BIT IDENTICAL**
   - Initial SHA256: `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`
   - Final SHA256: `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`
4. **PM2 Processes:** **UNTOUCHED (NO MODIFICATIONS OR RESTARTS)**
   The live Internet Beta process (`koinonia-beta`, ID 4, Port 3005) remains running on `prototype/koinonia-phase22_1/server.js`.
5. **Cloudflare Zero Trust:** **UNTOUCHED (NO ROUTE CHANGES)**

---

## 8. Test Verification Summary

### Phase 0.23B Focused Foundation Suite (`test_phase23_shared_core_foundation.js`):
```
================================================================
  KOINONIA PHASE 0.23B — SHARED CORE FOUNDATION TEST SUITE
================================================================

[GROUP 1]  Module Loading & Contract Parity (30 methods): PASS (65/65)
[GROUP 2]  Provider Factory & Safe Local Defaults: PASS (12/12)
[GROUP 3]  Capability Metadata & Mode Distinguishability: PASS (18/18)
[GROUP 4]  Safe HTTP Client & Strict Route Gating: PASS (21/21)
[GROUP 5]  Fail-Closed Mutation Policy & Error Structuring: PASS (19/19)
[GROUP 6]  Idempotency Requirements & Replay Safety: PASS (12/12)
[GROUP 7]  No-Split-Brain Invariant (Zero Silent Fallback): PASS (3/3)
[GROUP 8]  Zero Database & Zero Network Safety Invariants: PASS (13/13)
[GROUP 9]  Dual Synchronous / Async Return Compatibility: PASS (7/7)
[GROUP 10] Game Engine Provider Resolution & Beta Identity: PASS (16/16)

================================================================
TOTAL TESTS: 186 | PASSED: 186 | FAILED: 0
================================================================
```

### Phase 0.22.1 Internet Beta Regression Suite (`test_phase22_1_beta.js`):
```
================================================================
TOTAL TESTS: 200 | PASSED: 200 | FAILED: 0
================================================================
```

---

## 9. Next-Stage Prerequisites (Shared Core Stage 2 & 3)

Before remote mutations or live synchronizations can be activated:
1. **Main App Service Layer (`/api/v1/shared/*`):** Implementation of authorized endpoints in the Main App backend.
2. **Authoritative Life Points Ledger:** Server-side audit logging and idempotent transaction recording in `point_transactions`.
3. **Shared Auth Provider (Stage 3):** Transition from `BetaIdentityProvider` to cookie/token session verification.
4. **Physical Product Owner Approval:** Explicit acceptance of physical Internet Beta and subsequent transition approval.
