# Koinonia Phase 0.22 — Shared Core Gap Matrix & Data Ownership Contract

**Document Version**: 1.2.0  
**Status**: Authoritative Architectural Contract for Stage 3 Integration  
**Date**: 2026-09-07  
**Context**: Result of Phase 0.22 Deep Read-Only Audit of Main App Staging (`/home/raspi4/fog-portal-staging`)  

---

## 1. Executive Summary

This document formalizes the integration contract between **Koinonia** and the **Main FOG App**. During Phase 0.20 and 0.21, Koinonia operated on an isolated in-memory/browser-backed provider (`LocalSharedCoreProvider`). 

This gap matrix audits all **30 methods** of `LocalSharedCoreProvider` against the live Main App schema and API routes, assigning an authoritative gap classification, required transformation logic, and risk mitigation strategy. It also establishes the definitive **Data Ownership Matrix** across all entities, distinguishing current Main App write pathways from target secured Koinonia Shared Core endpoints, and specifies the strict **Security Architecture Requirements** for Stage 3.

---

## 2. Gap Classification Taxonomy

Every method in `LocalSharedCoreProvider` is assigned exactly one of the following six gap classifications:

1. **`DIRECTLY MAPPABLE`**: Main App exposes an existing REST route or database table that matches the required semantics with minimal parameter reshaping.
2. **`MAPPABLE WITH ADAPTER`**: Main App possesses the underlying data or route, but requires client-side projection, data transformation, or combining multiple endpoints.
3. **`REQUIRES NEW BACKEND API`**: The operation requires a new secured Shared Core API boundary because existing routes are missing or are unauthenticated raw staging endpoints that cannot serve as direct Koinonia write paths.
4. **`REQUIRES SCHEMA CHANGE`**: The operation requires columns, tables, or database constraints that do not exist anywhere in `fog_community.db`.
5. **`POLICY DECISION GOVERNED`**: A fundamental product, pastoral, or safety policy divergence exists between Main App and Koinonia that is governed by Product Owner directives established in Phase 0.22.
6. **`PROTOTYPE ONLY`**: The method is designed solely for the standalone prototype test harness or simulated environment and is not intended to map to production backend systems.

---

## 3. LocalSharedCoreProvider Method Mapping Matrix

| # | Provider Method | Main App Equivalent | Gap Classification | Adapter Transformation Logic | Risk & Mitigation |
|:---|:---|:---|:---|:---|:---|
| 1 | `getCurrentMember()` | `GET /api/auth/me` / `youth` table | **`DIRECTLY MAPPABLE`** | Maps `res.member` fields: `id` -> `memberId`, `name` -> `displayName`, `qr_code` -> `passCode`, `account_tier` -> `tier`. For production/shared authenticated member data, an invalid or missing authenticated session must NOT silently grant member privileges through a generic guest identity. Authenticated operations must return/reject with HTTP 401 when no valid member session exists. (Guest/anonymous mode may exist only as an explicitly scoped read-only experience if later approved.) | Low. Non-authenticated states reject with 401. |
| 2 | `getLifePoints()` | `GET /api/gamification/points/:youth_id` + `point_transactions` | **`MAPPABLE WITH ADAPTER`** | Total LP maps to `res.points`. `point_transactions` is confirmed as the eventual authoritative Life Points ledger. Main App projects aggregate `growth_xp`. Koinonia's 6 Virtue XP dimensions (Stewardship, Responsibility, Discipline, Teamwork, Service, Reflection) must eventually have canonical server-side Shared Core storage designed in Stage 3 (no DB migration in Phase 0.22). | Medium. Reconciles cached vs ledger discrepancies dynamically on load. |
| 3 | `awardLifePoints(params)` | `awardPoints()` via `POST /api/games/universal-submit` (internal logic only) | **`REQUIRES NEW BACKEND API`** | Existing `universal-submit` caps points at `Math.min(score, 5)` and lacks authentication and `idempotency_key`. Requires dedicated Stage 3 endpoint `POST /api/v1/shared/points/award` enforcing server authority and idempotency. | High. Raw mutation route lacks auth and idempotency. Mitigation: Stage 3 must implement secure server-side authenticated endpoint. |
| 4 | `getQuests()` | NONE (`fog_community.db` has no quest catalog) | **`POLICY DECISION GOVERNED`** | Generic Studio template is **📜 QUEST**. For upcoming internet beta, static/prototype-local Quest definitions are acceptable. Stage 3 will design canonical server-side content contract conceptually supporting `quests`. | Low-Medium. Use static catalog for beta; design DB schema for later approved migration. |
| 5 | `getQuest(questId)` | NONE | **`POLICY DECISION GOVERNED`** | Filter from catalog bundle. | Low. |
| 6 | `getQuestCompletion(qId, mId)` | NONE | **`REQUIRES SCHEMA CHANGE`** | `member_milestones` is NOT the permanent storage for Quest completions; Milestones and Quests are separate canonical concepts. Stage 3 will design canonical `quest_completions` contract (no tables migrated in 0.22). | Medium. Client/prototype storage fallback for beta ensures zero staging DB breakage. |
| 7 | `completeQuest(params)` | NONE | **`REQUIRES SCHEMA CHANGE`** | Submits completion record to future Quest completion contract; awards LP via secure points API; logs activity. | Medium. Server must calculate rewards; client must never declare arbitrary LP awards. |
| 8 | `getEvents()` | `GET /api/events` | **`DIRECTLY MAPPABLE`** | Renames `name` -> `title`, `event_points` -> `pointsReward`, formats ISO dates. | Low. Public route already returns active events list. |
| 9 | `getEvent(eventId)` | Client filter on `GET /api/events` | **`MAPPABLE WITH ADAPTER`** | Filters array returned by `GET /api/events` by `id == eventId`. | Low. |
| 10 | `getAttendance(instId, mId)` | `SELECT FROM attendance` / `GET /api/attendance/logs` | **`MAPPABLE WITH ADAPTER`** | Queries attendance logs or member profile history for `event_id == instId` and `youth_id == mId`. | Low. Adapter handles missing youth gracefully with safe joins. |
| 11 | `getAllAttendanceRecords()`| `GET /api/attendance/logs` | **`MAPPABLE WITH ADAPTER`** | Maps `attendance` rows to `AttendanceRecord` objects. | Low. Admin route or member-filtered query. |
| 12 | `checkIn(params)` | `POST /api/checkin` (internal logic only) | **`REQUIRES NEW BACKEND API`** | Stage 3 requires a NEW SECURED SHARED CORE API boundary: `POST /api/v1/shared/attendance/check-in`. The existing Main App check-in business logic in `server.js` may later be called/reused internally behind that secured service, but Koinonia clients must NOT call the unauthenticated raw `/api/checkin` endpoint directly. | Medium. Direct raw mutation call lacks session authentication and target-member checks. Mitigation: Wrap internal check-in logic inside authenticated `/api/v1/shared/attendance/check-in` with idempotency token and target-member authorization. |
| 13 | `getMyCampfires(memberId)` | `GET /api/small-groups?youth_id=:id` | **`DIRECTLY MAPPABLE`** | Campfire is the canonical group system; Quest Circles are a gameplay layer attached to Campfire. Filters where `user_status === 'Approved'` or `leader_id === memberId`. | Low. Direct match to existing small groups. |
| 14 | `getCampfire(campfireId)` | `GET /api/small-groups` (filtered) | **`MAPPABLE WITH ADAPTER`** | Finds group by `id == campfireId`. | Low. |
| 15 | `getCampfireMembers(cfId)` | `GET /api/small-groups/:id/roster-status` | **`DIRECTLY MAPPABLE`** | Returns active members with names, avatars, and statuses. | Low. Fully supported by existing staging endpoint. |
| 16 | `getCampfireLeaders(cfId)` | `small_groups.leader_id` + `youth` | **`MAPPABLE WITH ADAPTER`** | Extracts `leader_id` and `leader_name` from small group payload. | Low. |
| 17 | `getCampfireGameState(cfId)`| NONE | **`POLICY DECISION GOVERNED`** | Campfire game state (active assigned quests, collective reactions) resides in Shared Core service layer. | Medium. Use client extension state in Stage 3. |
| 18 | `getCampfireSettings()` | Shared Core Service | **`POLICY DECISION GOVERNED`** | Capacity enforced through future Shared Core service: Minimum participants required to ACTIVATE = 5; default maximum = 12; community maximum = configurable by Admin, default 12; Leader may configure per-Campfire maximum between 5 and community maximum; active Campfire cannot have capacity lowered below its current active member count. Quest Circles remain a gameplay layer attached to canonical Campfire with no duplicate roster. Application/API level for beta; long-term server-side persisted (e.g. `max_capacity`) via later approved migration. No staging schema modification in Phase 0.22. | Low. Zero staging schema changes in Phase 0.22. |
| 19 | `setCommunityMaxParticipants()`| Shared Core Service | **`POLICY DECISION GOVERNED`** | Admin capacity configuration persisted in Shared Core service layer (default 12). | Low. |
| 20 | `setCampfireCapacity(id, max)`| Shared Core Service | **`POLICY DECISION GOVERNED`** | Capacity enforced via Shared Core service between 5 and community max. Active Campfire cannot have capacity lowered below active member count. Long-term `max_capacity` DB migration deferred to later approved release. | Medium. Enforce in service logic. |
| 21 | `addReactionToCampfire(id, e)`| Shared Core Service / `POST /api/small-groups/react-v2` | **`MAPPABLE WITH ADAPTER`** | Structured reactions (👏, 🙏, 🔥, 🌱, ❤️) are default under Koinonia / Fire of God youth-safety policy. CANONICAL PRODUCT RULE: NO UNRESTRICTED FREE-TEXT MESSAGING FOR MINORS. | Low. Adheres strictly to minor communication safety. |
| 22 | `getMinistries()` | `GET /api/ministries` | **`DIRECTLY MAPPABLE`** | Returns ministries with `id`, `name`, `description`, `logo`, `member_count`. | Low. |
| 23 | `getMyMinistries(memberId)` | `GET /api/youth/:id/ministries` | **`DIRECTLY MAPPABLE`** | Returns member's assigned ministries with roles and priority flags. | Low. |
| 24 | `getMinistryMissions(minId)` | `GET /api/events/:id/roles` | **`MAPPABLE WITH ADAPTER`** | Maps service opportunities and event roles to Ministry Missions. | Low-Medium. |
| 25 | `getMyMinistryMissions(mId)` | `GET /api/youth/:id/event_roles` | **`MAPPABLE WITH ADAPTER`** | Returns assigned service roles for the member across upcoming events. | Low. |
| 26 | `getMilestones()` | `GET /api/discipleship/pathways` | **`DIRECTLY MAPPABLE`** | Returns 5 canonical discipleship pathway milestones. Separate from Quests. | Low. |
| 27 | `getGrowthProgress(mId)` | `GET /api/discipleship/member-progress/:id` | **`DIRECTLY MAPPABLE`** | Returns progress and completion status for member across all milestones. | Low. |
| 28 | `emitActivityEvent(params)` | `logActivity()` via route / `activity_logs` | **`MAPPABLE WITH ADAPTER`** | Writes action, username, details to canonical `activity_logs`. | Low. |
| 29 | `getActivityEvents()` | `GET /api/activity-logs` | **`DIRECTLY MAPPABLE`** | Returns recent system activity logs. | Low. |
| 30 | `resetToBaseline()` | NONE (Prototype sandbox only) | **`PROTOTYPE ONLY`** | Gated strictly to test harness. Never executed in live environments. | Zero. |

---

## 4. Gap Classification Summary Statistics

| Classification | Count | Percentage | Primary Strategy |
|:---|:---:|:---:|:---|
| **`DIRECTLY MAPPABLE`** | 9 | 30.0% | Straightforward read-only REST fetch with field normalization. |
| **`MAPPABLE WITH ADAPTER`** | 10 | 33.3% | Client/service-side transformation, array filtering, or multi-endpoint composition. |
| **`POLICY DECISION GOVERNED`** | 6 | 20.0% | Product Owner policy directives established in Phase 0.22. |
| **`REQUIRES SCHEMA CHANGE`** | 2 | 6.7% | Stage 3 design canonical contract -> later approved migration. |
| **`REQUIRES NEW BACKEND API`** | 2 | 6.7% | Dedicated authenticated endpoints (`awardLifePoints`, `checkIn`) in Stage 3. |
| **`PROTOTYPE ONLY`** | 1 | 3.3% | Gated exclusively to test harness. |
| **TOTAL** | **30** | **100.0%** | **Comprehensive coverage of all Shared Core provider methods.** |

---

## 5. Data Ownership Matrix (Source of Truth Contract)

| Entity Type | System of Record (SoR) | Secondary / Read Replica | Read Access Path | Current Main App Write Path | Target Koinonia Shared Core Write Path | Synchronization Mechanism |
|:---|:---|:---|:---|:---|:---|:---|
| **Member Identity** | **Main App** (`youth`, `users`) | Koinonia Session State | `GET /api/auth/me`, `GET /api/youth/:id` | `PUT /api/youth/profile/:id` | `PUT /api/v1/shared/member/profile` (authenticated, self-authorized) | REST API on login/profile update |
| **Life Points Ledger** | **Main App** (`point_transactions`) | Koinonia Provider Cache | `GET /api/gamification/points/:id` | Raw `awardPoints()` (internal) | `POST /api/v1/shared/points/award` (authenticated, server-authorized, idempotent) | Transactional REST append; dynamically audited |
| **Virtue XP Breakdown** | **Shared Core Service** (Stage 3) | Main App projected `growth_xp` | Shared Core API | None (Main App has only coarse buckets) | Shared Core Progression Engine (canonical server-side storage) | Canonical server-side storage; projects aggregate `growth_xp` to Main App |
| **Events & Attendance** | **Main App** (`events`, `attendance`) | Koinonia Calendar View | `GET /api/events`, `GET /api/attendance/logs` | Raw `POST /api/checkin` | `POST /api/v1/shared/attendance/check-in` (authenticated, target-member authorized, idempotent) | Direct REST submission; atomic duplicate check |
| **Campfires (Groups)** | **Main App** (`small_groups`) | Koinonia Campfire State | `GET /api/small-groups` | Raw `POST /api/small-groups/:id/join` | `POST /api/v1/shared/campfires/:id/join` (authenticated, capacity check: min activation = 5, default max = 12) | Direct REST API with Shared Core capacity check |
| **Campfire Quest State** | **Shared Core Service Layer** | None in Main App | Shared Core API | None | Shared Core Service Layer (`POST /api/v1/shared/campfires/:id/activity`) | State synchronization via Campfire ID key |
| **Ministries & Rosters**| **Main App** (`ministries`, `ministry_members`) | Koinonia Ministry View | `GET /api/ministries`, `GET /api/youth/:id/ministries` | `POST /api/ministries/:id/apply` | `POST /api/v1/shared/ministries/:id/apply` (authenticated) | REST API |
| **Milestones** | **Main App** (`discipleship_pathways`) | Koinonia Discipleship View | `GET /api/discipleship/pathways` | `POST /api/discipleship/milestones` | `POST /api/v1/shared/discipleship/milestones` (authenticated) | REST API |
| **Quest Definitions** | **Shared Core Content Registry** | Koinonia Runtime Catalog | Static JSON bundles (Beta) -> Content Registry API | None | Shared Core CONTENT REGISTRY / API (`POST /api/v1/shared/content/publish`, Superadmin approved) | Validated Content Registry API after Superadmin approval |
| **Quest Completions** | **Shared Core Service Layer** | None in Main App Milestones | Shared Core API | None (NOT stored in `member_milestones`) | `POST /api/v1/shared/quests/:id/complete` (canonical `quest_completions` contract) | Canonical `quest_completions` contract (NOT `member_milestones`) |
| **Places & Artifacts** | **Shared Core Content Registry** | Koinonia Runtime Catalog | Static JSON bundles (Beta) -> Content Registry API | None | Shared Core CONTENT REGISTRY / API (`POST /api/v1/shared/content/publish`, Superadmin approved) | Validated Content Registry API |
| **📖 FAITH QUEST CHALLENGE** | **Main App** (`fq_daily_scores`) | None in Koinonia | `GET /api/fq-leaderboard/top3` | `POST /api/fq-leaderboard/submit` | Independent Bible trivia game loop in Main App | Independent Bible trivia game loop |

---

## 6. Shared Core API Security Architecture Requirement

The factual audit discovered that several existing staging mutation routes (e.g. `/api/games/universal-submit`, `/api/checkin`) appear callable without authentication and lack replay protection. 

**Stage 3 Architectural Mandate**: Stage 3 **MUST NOT** simply expose or reuse these raw mutation endpoints as Koinonia's public Shared Core contract. Any consequential Koinonia mutation must go through authenticated `/api/v1/shared/*` services (including attendance/check-in, Life Points/progression, Campfire membership/settings, milestones/progression, Studio publication). Raw unauthenticated routes in Main App must NOT be used as direct Koinonia client write APIs. All future `/api/v1/shared/*` mutation endpoints must satisfy the following security architecture:

1. **Authenticated Member/Session Identity**: All mutation endpoints require a validated session identity. Unauthenticated requests must be rejected immediately with HTTP 401. For production/shared authenticated member data, an invalid or missing authenticated session must NOT silently grant member privileges through a generic guest identity. Authenticated operations must return/reject appropriately with HTTP 401 when no valid member session exists. (Guest/anonymous mode may exist only as an explicitly scoped read-only experience if later approved.)
2. **Server-Side Authorization**: The server must verify that the caller is authorized to perform the action (e.g. only members can claim their own rewards; only Campfire leaders or admins can alter circle settings).
3. **Target-Member / Target-Resource Authorization (Role-Aware IDOR Protection)**:
   - **Canonical Rule**: An authenticated ordinary MEMBER may mutate only their own authorized member state.
   - **Authorized Staff/Admin Workflows**: A mutation targeting another member or protected resource is permitted ONLY when the authenticated session possesses an explicit server-side role/permission authorizing that action.
   - **Dual Verification**: The server must verify BOTH:
     1. Authenticated caller identity.
     2. Authorization for the specific target member/resource and operation.
   - **Untrusted Input**: Never trust a client-supplied target `youth_id` merely because it was submitted. Preserve strict IDOR protection.
   - **Rejection Status**: Unauthorized cross-member access must return an appropriate authorization error (HTTP 403 Forbidden).
   - **Concrete Examples**:
     - *Normal member Quest completion*: Authenticated `youth_id` must equal target member ID.
     - *Event check-in by member*: Authenticated `youth_id` must equal target member ID.
     - *Event check-in by authorized check-in staff*: Target member may differ, but server must verify explicit check-in/admin permission.
     - *Campfire settings*: Only authorized Campfire Leader/Admin/Superadmin.
     - *Studio publication*: Only authorized SUPERADMIN after approved workflow.
4. **Idempotency Keys**: Every progression and Life Points mutation MUST require an `idempotency_key` (UUID v4 or semantic hash like `quest_comp:{questId}:{memberId}`). Duplicate submissions must return the original cached response with zero duplicate ledger writes.
5. **Server Authority Over Rewards**: Clients must **NEVER** be trusted to declare arbitrary LP or XP awards. The client sends an action verification payload (e.g. checkpoint reached, quiz completed); the server computes the reward based on canonical bounded rules.
6. **Validation & Bounded Rewards**: All LP and XP rewards must be bounded by server-side canonical content/reward definitions. Exact reward ceilings are governed configuration and must never be supplied or controlled by the client.
7. **Replay & Double-Submit Protection**: Atomic database transactions or conditional writes must prevent race conditions and concurrent double-submit exploits.
8. **CSRF Protection**: If session cookie authentication is utilized, requests must include anti-CSRF tokens or verify `SameSite=Lax/Strict` and origin headers.
9. **Audit Logging**: All consequential mutations (points awards, capacity changes, profile updates) must be recorded in `activity_logs` with canonical actor attribution.

---

## 7. Studio Publication Contract

The governance model established in Phase 0.21 is preserved:
```
[ADMIN Authors Draft] ──> [Request Review] ──> [SUPERADMIN Reviews & Approves] ──> [Publish]
```

For future Shared Core integration:
- Published Studio content will be ingested through a **validated Shared Core CONTENT REGISTRY / API**.
- Content will **NOT** be published via direct raw production-database writes.
- Content will **NOT** be published via Git or static-file commits to the staging directory.
- Phase 0.21 prototype-local publishing remains unchanged until that validated Content Registry API is implemented.
