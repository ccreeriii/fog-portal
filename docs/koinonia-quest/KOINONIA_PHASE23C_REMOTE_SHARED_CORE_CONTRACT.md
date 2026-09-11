# KOINONIA — PHASE 0.23C: REMOTE SHARED CORE CONTRACT FREEZE

> **Document Status**: FROZEN CONTRACT SPECIFICATION
> **Phase**: KOINONIA Phase 0.23C
> **Repository**: `ccreeriii/koinonia-quest`
> **Working Tree**: `prototype/koinonia-phase23_1/`
> **Target Production / Staging State**: UNTOUCHED (Zero modification)

---

## 1. Purpose

The purpose of Phase 0.23C is to freeze the client/service integration contract between KOINONIA and the Community Portal Shared Core service layer before any backend code is implemented in the Main App.

Building on the Phase 0.23B provider abstraction (`LocalSharedCoreProvider` vs `RemoteSharedCoreProvider`), Phase 0.23C proves that `RemoteSharedCoreProvider` and its underlying `SharedCoreHttpClient` perform deterministic, safe, fail-closed operations over real HTTP traffic using an isolated, ephemeral-port mock server.

This frozen contract ensures:
- Full client-side validation and transport safety.
- Strict path containment within `/api/v1/shared/*`.
- Guaranteed replay protection via canonical `Idempotency-Key` headers.
- Zero split-brain or silent local award fallback.
- Predictable HTTP status code mapping to structured errors.
- Absolute isolation from staging and production databases.

---

## 2. Safety Boundary

This phase strictly respects the canonical Koinonia repository safety boundary:

- **Main App Staging Code**: UNTOUCHED (`/home/raspi4/fog-portal-staging` was not read, written, or modified).
- **Main App Production Code**: UNTOUCHED (`/home/raspi4/fog-portal`, `/home/raspi4/fog-portal-v2`, `/home/raspi4/fogmin-portal-v3` were not modified).
- **Community Portal SQLite Databases**: UNTOUCHED (`fog_community.db`, `-wal`, `-shm` were not accessed, altered, or queried). Bit-for-bit SHA256 integrity remains `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`.
- **Process Manager (PM2)**: UNTOUCHED (PM2 process `koinonia-beta` [ID 4] remains pinned to `prototype/koinonia-phase22_1` on port 3005; no PM2 processes restarted or modified).
- **Network / Cloudflare / DNS**: UNTOUCHED (No new ports exposed, no public tunnels created, zero external network traffic).
- **Git State**: No commits or pushes performed.

---

## 3. Local Mock Architecture

The test harness uses an isolated mock server (`prototype/koinonia-phase23_1/test_support/mock_shared_core_server.js`):

- **Technology**: Built purely on the Node.js standard library (`http`). Zero dependencies on Express, external routers, or database drivers.
- **Interface Binding**: Binds strictly to `127.0.0.1` (localhost only).
- **Port Assignment**: Binds to port `0`, allowing the operating system kernel to allocate a dynamic ephemeral port at runtime.
- **Lifecycle**: Starts automatically during tests and terminates cleanly via `server.close()` with active socket tracking to prevent orphaned connections.
- **In-Memory State**: Maintains an ephemeral state (member identity, points balance, quests, events, attendance, campfires, ministries, milestones, activity events) and an in-memory idempotency ledger.
- **Fault Injection**: Supports deterministic simulation of HTTP status codes (401, 403, 404, 409, 422, 429, 500), simulated latency, connection drops, and malformed JSON payloads.

---

## 4. Provider Opt-In Rules

1. **Default Mode**: `createSharedCoreProvider()` unconditionally instantiates `LocalSharedCoreProvider` (`capabilities.remote === false`, `capabilities.providerMode === 'local'`).
2. **Explicit Opt-In**: `RemoteSharedCoreProvider` is instantiated **only** when caller explicitly supplies `{ providerMode: 'remote' }`.
3. **Presence of Files**: The mere existence of `remote_shared_core.js` or `mock_shared_core_server.js` never activates remote behavior.

---

## 5. Remote Read Gating

- **Default State**: In `RemoteSharedCoreProvider`, remote reads are **disabled by default** (`remoteReadsEnabled: false`).
- **Fail-Closed Policy**: Any read method (`getCurrentMember`, `getLifePoints`, `getEvents`, etc.) invoked while reads are disabled immediately returns a fail-closed result:
  ```json
  {
    "success": false,
    "error": "SHARED_CORE_READS_DISABLED",
    "code": "SHARED_CORE_READS_DISABLED",
    "message": "Remote Shared Core reads are disabled by default in Phase 0.23B."
  }
  ```
- **Zero Outbound Traffic**: Zero HTTP requests are dispatched when the read gate is active.
- **Explicit Enablement**: Reads require `{ remoteReadsEnabled: true }` in provider configuration.

---

## 6. Remote Mutation Gating

- **Default State**: Remote mutations are **disabled by default** (`remoteMutationsEnabled: false`).
- **Fail-Closed Policy**: Any mutation method (`awardLifePoints`, `checkIn`, `completeQuest`, etc.) invoked while mutations are disabled immediately returns:
  ```json
  {
    "success": false,
    "error": "SHARED_CORE_MUTATIONS_DISABLED",
    "code": "SHARED_CORE_MUTATIONS_DISABLED",
    "message": "Remote Shared Core mutations are disabled by default in Phase 0.23B (scaffolding only)."
  }
  ```
- **Dual Sync/Async Access**: The returned object is a dual-purpose Promise that allows immediate synchronous inspection (`res.success`, `res.error`) as well as `await res`.
- **Zero Outbound Traffic**: Zero HTTP requests are dispatched when the mutation gate is active.
- **Explicit Enablement**: Mutations require `{ remoteMutationsEnabled: true }` in provider configuration.

---

## 7. Canonical Route Namespace

All Remote Shared Core endpoints **must** reside under the canonical namespace:
```
/api/v1/shared/*
```

### Pre-Network Route Rejection
The client evaluates endpoints *before* any network dispatch occurs. Any endpoint not strictly matching `/api/v1/shared/*` or containing security risks is rejected immediately with:
```json
{
  "success": false,
  "error": "SHARED_CORE_INVALID_ROUTE",
  "code": "SHARED_CORE_INVALID_ROUTE"
}
```

The following are strictly blocked before network dispatch:
1. **Raw Portal Routes**:
   - `/api/checkin`
   - `/api/games/universal-submit`
   - `/api/growth-games/*`
   - `/api/youth/*`
   - `/api/admin/*`
   - `/api/ministries/*` (raw portal namespace)
   - `/api/small-groups/*`
   - `/auth/*`
2. **Path Traversal Patterns**:
   - `../api/checkin`
   - `/api/v1/shared/../../api/checkin`
   - `/api/v1/shared/..`
   - `/api/v1/shared/%2e%2e/checkin`
3. **Absolute & Scheme Injections**:
   - `//evil.example/path`
   - `\\\\evil.example\\path`
   - `https://evil.example/api/v1/shared/me`
   - `http://127.0.0.1/api/v1/shared/me`
   - `javascript:alert(1)`

---

## 8. Request Headers

### Read Requests (`GET`, `HEAD`)
```http
GET /api/v1/shared/points HTTP/1.1
Host: 127.0.0.1:<port>
Accept: application/json
```

### Mutation Requests (`POST`, `PUT`, `PATCH`, `DELETE`)
```http
POST /api/v1/shared/points/award HTTP/1.1
Host: 127.0.0.1:<port>
Accept: application/json
Content-Type: application/json
Idempotency-Key: <unique-client-generated-key>
```

---

## 9. Idempotency Contract

Consequential mutations that modify user state or award currency **require** an idempotency key.

1. **Client Parameter**: Callers provide `idempotencyKey` in the method call parameters:
   ```javascript
   await provider.awardLifePoints({ amount: 50, idempotencyKey: 'quest_complete_q01_member123' });
   ```
2. **Transport Header**: The HTTP client maps this to the canonical HTTP header:
   ```http
   Idempotency-Key: quest_complete_q01_member123
   ```
3. **Missing Key Policy**: If an idempotency key is omitted on a consequential mutation, the client rejects the request fail-closed *before* dispatch:
   ```json
   {
     "success": false,
     "error": "SHARED_CORE_MISSING_IDEMPOTENCY_KEY",
     "code": "SHARED_CORE_MISSING_IDEMPOTENCY_KEY",
     "message": "Idempotency key is required for consequential mutations."
   }
   ```
4. **Replay Contract**:
   - **Initial Request**: Processed normally. Returns `{ success: true, replayed: false, awarded: <N>, balance: <B>, idempotencyKey: "<K>" }`.
   - **Subsequent Replay with Identical Key**: Returns deterministic response without performing secondary side effects. Specifically, `awarded: 0` and `replayed: true`. User balance is **not** credited a second time.
5. **Key Immutability**: During retry or replay operations, the caller must supply the **same** idempotency key; keys are never dynamically regenerated for the same logical operation.

---

## 10. Success Response Contract

Successful responses must be unambiguous JSON objects conforming to:

```json
{
  "success": true,
  "data": { ... } // or domain-specific root keys (e.g. member, lifePoints, quests, etc.)
}
```

Domain-specific success structures:
- **`GET /api/v1/shared/me`**: `{ "success": true, "member": { "id": "...", "name": "...", "role": "..." } }`
- **`GET /api/v1/shared/points`**: `{ "success": true, "lifePoints": 120, "balance": 120, "totalEarned": 120, "tier": "Apprentice" }`
- **`POST /api/v1/shared/points/award`**: `{ "success": true, "replayed": false, "awarded": 50, "balance": 170, "idempotencyKey": "..." }`
- **`POST /api/v1/shared/quests/:id/complete`**: `{ "success": true, "completed": true, "questId": "Q-001" }`
- **`POST /api/v1/shared/attendance/check-in`**: `{ "success": true, "status": "checked_in", "record": { ... } }`

---

## 11. Error Contract

When transport or application failures occur, the client generates a standardized error envelope:

```json
{
  "success": false,
  "error": "<CANONICAL_ERROR_CODE>",
  "code": "<CANONICAL_ERROR_CODE>",
  "message": "<Human-readable diagnostic explanation>",
  "status": 401 // HTTP status code when available
}
```

The error contract guarantees:
- `res.success === false`.
- `res.error === res.code`.
- Zero exposure of internal database paths, raw SQL strings, secrets, cookies, or backend stack traces.

---

## 12. HTTP Status Mapping

The client deterministically maps HTTP status codes and transport faults to stable client error codes:

| HTTP Status / Condition | Client Error Code | Description |
|---|---|---|
| **401 Unauthorized** | `SHARED_CORE_UNAUTHORIZED` | Authentication required / invalid session |
| **403 Forbidden** | `SHARED_CORE_FORBIDDEN` | Authenticated but unauthorized for resource/action |
| **404 Not Found** | `SHARED_CORE_NOT_FOUND` | Endpoint or resource not found |
| **409 Conflict** | `SHARED_CORE_CONFLICT` | Stale state, state conflict, or lock contention |
| **422 Unprocessable** | `SHARED_CORE_VALIDATION_ERROR` | Schema validation error or missing required fields |
| **429 Rate Limited** | `SHARED_CORE_RATE_LIMITED` | Too many requests; client rate-limited |
| **500 - 599 Server Error** | `SHARED_CORE_SERVER_ERROR` | Upstream portal / database / internal error |
| **Malformed JSON** | `SHARED_CORE_MALFORMED_RESPONSE` | Non-JSON response or syntax error in body |
| **Timeout (AbortError)** | `SHARED_CORE_TIMEOUT` | Request duration exceeded `timeoutMs` |
| **Network Refusal / Offline** | `SHARED_CORE_NETWORK_ERROR` | Connection refused, host unreachable, DNS error |
| **Invalid Route** | `SHARED_CORE_INVALID_ROUTE` | Route outside `/api/v1/shared/*` or path traversal |
| **Missing Idempotency Key**| `SHARED_CORE_MISSING_IDEMPOTENCY_KEY`| Consequential mutation attempted without key |
| **Reads Disabled** | `SHARED_CORE_READS_DISABLED` | Provider configured with `remoteReadsEnabled: false` |
| **Mutations Disabled** | `SHARED_CORE_MUTATIONS_DISABLED` | Provider configured with `remoteMutationsEnabled: false` |
| **Unsupported Operation** | `SHARED_CORE_OPERATION_UNSUPPORTED` | Operation available only in local prototype provider (e.g. resetToBaseline) |

---

## 13. Retry Policy

- **Mutations (`POST`, `PUT`, `PATCH`, `DELETE`)**: **ZERO AUTOMATIC RETRIES**. To prevent double-awarding currency or creating duplicate transactions, failed mutations never automatically retry. Any retry must be explicitly initiated by caller code using the **same** idempotency key.
- **Reads (`GET`)**: Zero automatic retries by default. Callers may issue explicit retries when appropriate.

---

## 14. Timeout Policy

- Default timeout is **8000ms** (`timeoutMs: 8000`).
- Configurable per instance via `options.timeoutMs` or per call via `request(..., { timeoutMs })`.
- Utilizes `AbortController` signal to cleanly cancel outbound sockets when timeout fires.
- Generates deterministic `SHARED_CORE_TIMEOUT` error.

---

## 15. Credentials & Authentication Extension Point

- **Credentials Policy**: Preserves standard fetch credentials configuration (`options.credentials`, default `'same-origin'`). Supports `'include'` for cross-origin cookie authentication.
- **Auth Header Extension Point**: Supports optional `options.authHeader` or instance-level `this.authHeader`. When present, attaches `Authorization: <token>`.
- **Security Rule**: Tokens and cookie values are never logged or exposed in client error envelopes.

---

## 16. CSRF Extension Point

- **CSRF Token Hook**: Supports optional `options.csrfToken` or instance-level `this.csrfToken`.
- **Header Transport**: When provided, the client attaches `X-CSRF-Token: <token>` to mutation requests.
- **Future Integration**: Future Main App backend implementations requiring CSRF validation will utilize this header without requiring changes to the gameplay client.

---

## 17. No-Split-Brain Policy

When `RemoteSharedCoreProvider` is the active provider:
1. **No Silent Fallback**: If a remote call fails (e.g. 500 error, network timeout, 401 unauthorized), the system **must not** silently award Life Points, mark quests completed, or record attendance in `LocalSharedCoreProvider`.
2. **Remote Failure Stays Remote Failure**: The failure is reported directly to caller/gameplay code so it can display appropriate offline/retry UI.
3. **No Dynamic Mode Switching**: Provider mode never dynamically flips from `remote` to `local` mid-session on network error.

---

## 18. Endpoint Matrix

The following 30 canonical methods are implemented on `RemoteSharedCoreProvider`. The 29 active remote methods map to canonical `/api/v1/shared/*` endpoints; `resetToBaseline()` is preserved solely for 30-method contract parity and fails closed locally with `SHARED_CORE_OPERATION_UNSUPPORTED` (performing zero HTTP requests):

| # | Provider Method | HTTP Method | Endpoint Route | Idempotency Key |
|---|---|---|---|---|
| 1 | `resetToBaseline()` | *None (Local only)* | *No remote route* (returns `SHARED_CORE_OPERATION_UNSUPPORTED`) | N/A |
| 2 | `getCurrentMember()` | `GET` | `/api/v1/shared/me` | N/A |
| 3 | `getLifePoints()` | `GET` | `/api/v1/shared/points` | N/A |
| 4 | `awardLifePoints(params)` | `POST` | `/api/v1/shared/points/award` | **Required** |
| 5 | `getQuests()` | `GET` | `/api/v1/shared/content/quests` | N/A |
| 6 | `getQuest(id)` | `GET` | `/api/v1/shared/content/quests/:id` | N/A |
| 7 | `getQuestCompletion(id, mId)` | `GET` | `/api/v1/shared/quests/:id/completion` | N/A |
| 8 | `completeQuest(params)` | `POST` | `/api/v1/shared/quests/:id/complete` | **Required** |
| 9 | `getEvents()` | `GET` | `/api/v1/shared/events` | N/A |
| 10| `getEvent(id)` | `GET` | `/api/v1/shared/events/:id` | N/A |
| 11| `getAttendance(instanceId, mId)` | `GET` | `/api/v1/shared/attendance/:instanceId` | N/A |
| 12| `getAllAttendanceRecords()` | `GET` | `/api/v1/shared/attendance` | N/A |
| 13| `checkIn(params)` | `POST` | `/api/v1/shared/attendance/check-in` | **Required** |
| 14| `getMyCampfires(memberId)` | `GET` | `/api/v1/shared/campfires` | N/A |
| 15| `getCampfire(id)` | `GET` | `/api/v1/shared/campfires/:id` | N/A |
| 16| `getCampfireMembers(id)` | `GET` | `/api/v1/shared/campfires/:id/members` | N/A |
| 17| `getCampfireLeaders(id)` | `GET` | `/api/v1/shared/campfires/:id/leaders` | N/A |
| 18| `getCampfireGameState(id)` | `GET` | `/api/v1/shared/campfires/:id/gamestate` | N/A |
| 19| `getCampfireSettings()` | `GET` | `/api/v1/shared/campfires/settings` | N/A |
| 20| `setCommunityMaxParticipants(max)` | `POST` | `/api/v1/shared/campfires/settings/community-max` | Required |
| 21| `setCampfireCapacity(id, max, role)` | `POST` | `/api/v1/shared/campfires/:id/capacity` | Required |
| 22| `addReactionToCampfire(id, emoji)` | `POST` | `/api/v1/shared/campfires/:id/reactions` | Required |
| 23| `getMinistries()` | `GET` | `/api/v1/shared/ministries` | N/A |
| 24| `getMyMinistries(memberId)` | `GET` | `/api/v1/shared/ministries/mine` | N/A |
| 25| `getMinistryMissions(mId)` | `GET` | `/api/v1/shared/ministries/:id/missions` | N/A |
| 26| `getMyMinistryMissions(memberId)` | `GET` | `/api/v1/shared/ministries/missions/mine` | N/A |
| 27| `getMilestones()` | `GET` | `/api/v1/shared/milestones` | N/A |
| 28| `getGrowthProgress()` | `GET` | `/api/v1/shared/growth/progress` | N/A |
| 29| `emitActivityEvent(params)` | `POST` | `/api/v1/shared/activity/events` | **Required** |
| 30| `getActivityEvents()` | `GET` | `/api/v1/shared/activity/events` | N/A |

---

## 19. Future Main App Implementation Obligations

When the Main App backend is eventually updated in a future authorized phase, the Community Portal engineering team must fulfill the following obligations against this frozen contract:

1. **Implement Canonical Endpoints**: Implement the `/api/v1/shared/*` routes in Community Portal routing (e.g. `fog-portal-staging`).
2. **Session / Auth Verification**: Verify user session / bearer token on all `/api/v1/shared/*` endpoints, returning HTTP 401 when unauthenticated and HTTP 403 when forbidden.
3. **Idempotency Ledger**: Implement database-backed idempotency persistence for `Idempotency-Key` header transactions, ensuring replays return duplicate indicators with zero second award.
4. **Life Points Ledger Integration**: Integrate `POST /api/v1/shared/points/award` into the canonical `point_transactions` table inside an atomic SQLite transaction.
5. **Attendance Integration**: Integrate `POST /api/v1/shared/attendance/check-in` into canonical attendance records.
6. **Quest Completion Integration**: Persist quest completion records linked to canonical `member_id`.
7. **Campfire Capacity & Reactions**: Persist campfire state changes with role-based checks.
8. **Rate Limiting**: Enforce rate limits returning HTTP 429 when thresholds are exceeded.
9. **Zero Route Re-Use**: Do not map raw portal mutation routes (`/api/checkin`, `/api/games/universal-submit`) into KOINONIA.

*Note: None of these obligations are implemented during Phase 0.23C. They are strictly future requirements.*

---

## 20. PWA / Cache Deployment Prerequisite

- Phase 0.23C is an isolated integration test and contract freeze phase. It is **not** deployed to the public Internet Beta.
- The live Internet Beta remains intentionally pinned to `prototype/koinonia-phase22_1` on port 3005 (PM2 ID 4).
- **Deployment Prerequisite**: Before ANY future browser deployment of Phase 0.23 / 0.23C, the service worker (`sw.js`) and asset cache must receive a unique Phase 0.23-specific version string (e.g. `koinonia-v0.23.0-r1`), and cache assets must be reconciled.

---

## 21. Explicit Non-Mutation Attestation

| Target System | Modified in Phase 0.23C? | Attestation Details |
|---|---|---|
| **Main App Staging Code** | **NO** | `/home/raspi4/fog-portal-staging` was completely untouched |
| **Main App Production Code**| **NO** | Production portals (`fog-portal`, `fog-portal-v2`, `fogmin-portal-v3`) were completely untouched |
| **Main App Database** | **NO** | `fog_community.db` SHA256 remained identical (`f545bd91...`) |
| **PM2 Process Manager** | **NO** | No processes stopped, restarted, or modified; `koinonia-beta` pinned to phase 22.1 |
| **Cloudflare / DNS / Ports** | **NO** | No network changes, no public exposures |
