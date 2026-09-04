# Koinonia Quest — Phase 0: Safe Architecture Audit

**Document Version:** 1.0.0  
**Date:** September 4, 2026  
**Repository Branch:** `feature/koinonia-quest`  
**Target Environment:** Raspberry Pi 4 (Node.js / Express 5 / SQLite WAL / PM2)  
**Status:** PHASE 0 AUDIT & DESIGN ONLY — ZERO LAUNCH DISRUPTION  

---

## 1. Executive Summary

The Koinonia application (v3) is currently undergoing final staging preparation for its official production launch scheduled for next week. Koinonia is a comprehensive community portal, member directory, attendance system, discipleship tracker, and gamification platform serving youth and leaders.

A major new module, **Koinonia Quest**, is envisioned as an integrated virtual world and life-simulation RPG where real-world Christian formation, service, teamwork, and family responsibility produce virtual-world growth.

### Core Mission Directive
**DO NOT DISRUPT, DESTABILIZE, DELAY, OR MODIFY THE CURRENT KOINONIA LAUNCH.**

The purpose of this Phase 0 Architecture Audit is to conduct an exhaustive, read-only inspection of the existing codebase to:
1. Thoroughly document existing runtime architectures, data models, authentication flows, and gamification hooks.
2. Establish strict architectural boundaries to guarantee that all development on Koinonia Quest remains completely decoupled and safe.
3. Formulate a verified integration strategy that preserves user identity, database integrity, and server performance on Raspberry Pi 4 hardware without modifying a single line of core production code before launch.

### Core Audit Finding
The existing Koinonia system is a monolithic, buildless Node.js application running on Express 5.2.1 and SQLite3 in WAL (Write-Ahead Logging) mode. Identity is securely managed through session cookies mapped to unified `users` and `youth` tables. Life Points utilize an existing transaction ledger (`point_transactions`) aggregated in `gamification_points`.

Koinonia Quest can be integrated seamlessly post-launch using a **Decoupled Hybrid Architecture (Option D)** behind an explicit **Feature Flag (`KOINONIA_QUEST_ENABLED=false`)**. This ensures zero database migrations on core tables, zero dependency conflicts, and zero runtime overhead for next week's production launch.

---

## 2. Existing Koinonia Architecture

| Layer | Implementation in Koinonia v3 |
| :--- | :--- |
| **Runtime & Language** | Node.js (ES6+ CommonJS) on Linux ARM (Raspberry Pi 4 Model B) |
| **Backend Framework** | Express `^5.2.1` |
| **Primary Entry Point** | `/home/raspi4/koinonia-quest/server.js` (2,905 lines, ~196 KB) |
| **Process Manager** | PM2 (`fog-staging` at `/home/raspi4/fog-portal-staging`) |
| **Database Engine** | SQLite3 `^6.0.1` (`./fog_community.db`) with WAL Mode enabled |
| **Client Frontend** | Vanilla ES6+ SPA (Single Page Application) with zero build tools |
| **Frontend Entry Point** | `public/index.html` (2,132 lines, ~213 KB) & `public/js/app.js` (8,105 lines, ~452 KB) |
| **PWA & Offline** | Service Worker (`public/sw.js`) with cache `fog-portal-v6` and Web Manifest (`/manifest.json`) |
| **Push Notifications** | `web-push` `^3.6.7` using VAPID protocol |
| **Scheduled Tasks** | `node-cron` `^4.6.0` (in-process cron jobs) |

### Key Architectural Characteristics
- **Buildless Simplicity:** The application contains **no build step** (no Webpack, Vite, Rollup, or Babel). All client scripts in `public/js/` are loaded directly into `index.html` via standard `<script>` tags.
- **Monolithic Route Definition:** All REST endpoints (over 100 endpoints) are declared directly on the Express `app` instance in `server.js`.
- **In-Memory Session Store:** User sessions are managed in an in-memory `Map` inside `server.js` with an 8-hour TTL and 15-minute cleanup intervals.
- **Static File Serving:** Served directly by Express static middleware: `app.use(express.static(path.join(__dirname, 'public')))`.

---

## 3. Authentication Architecture

Koinonia maintains a unified authentication and identity boundary. Koinonia Quest **must not** implement a separate login or account system.

```
       [ Client Browser ]
               │
   Sends 'koinonia_session' Cookie
               │
               ▼
     [ Express Middleware ]
     loadAuthorizationContext(req)
               │
               ▼
      [ In-Memory Store ]
       sessionStore.get(id)
               │
               ├────────────────────────────────────────┐
               ▼                                        ▼
      [ 'users' Table ]                          [ 'youth' Table ]
 (Credentials, Permissions)              (Profile, QR Pass, Account Tier)
```

### Authentication Mechanism
1. **Session Cookie:** Authenticated sessions use an HTTP-only cookie named `koinonia_session` containing a cryptographically secure 32-byte hex string (`crypto.randomBytes(32).toString('hex')`). Attributes enforced: `HttpOnly`, `SameSite=Strict`, `Path=/`, `Max-Age=28800` (8 hours).
2. **Session Storage:** In-memory `sessionStore = new Map()` holding `{ userId, youthId, username, createdAt, expiresAt }`. Bounded at 5,000 concurrent sessions with LRU eviction.
3. **Canonical Identity Resolution:** The internal function `resolveCanonicalSessionIdentity(session, callback)` cross-references `users` and `youth` tables to attach `req.auth = { userId, youthId, username, permissions, member }`.
4. **Google OAuth 2.0:** Handled via `POST /api/auth/google`. Verified via `google-auth-library` (`OAuth2Client`). If user exists, session is issued. If user is new, auto-provisions a `youth` record with unique pass code `FOG-PASS-XXX` and an associated `users` row.
5. **Standard Login:** Handled via `POST /api/login`. Matches `users.username` (for staff/superadmin) or `youth.qr_code` / `youth.email` / `youth.name` (for members) with plaintext/pass verification.
6. **Authorization Middleware:**
   - `requireAuth`: Ensures valid active session.
   - `requirePermission(perm)`: Verifies permission string in `users.permissions` JSON array.
   - `requireSelfOr(perm, resolver)`: Allows self-access or staff override.
   - `requireStrongAdmin`: Restricts critical operations to superadmin.

### Safe Reuse for Koinonia Quest
Koinonia Quest endpoints can effortlessly and safely authenticate incoming players by wrapping routes with `requireAuth`. Quest code immediately receives `req.auth.youthId` and `req.auth.member`. No token re-issuance, custom JWTs, or external login screens are needed.

---

## 4. Database Architecture

### Technology & Storage
- **Database Engine:** SQLite 3 via `sqlite3` driver.
- **File:** `./fog_community.db`.
- **Concurrency & Integrity:** Configured at startup with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging). This allows non-blocking concurrent readers while a write is occurring.
- **Automated Hourly Backups:** `server.js` maintains an hourly backup loop copying `./fog_community.db` to `./backups/fog_community_YYYY-MM-DD.db`.

### Existing Schema Overview
| Domain | Tables | Key Columns & Notes |
| :--- | :--- | :--- |
| **Members & Identity** | `youth`, `users`, `activity_logs` | `youth.id` is the canonical member ID; `users.youth_id` links login credentials. |
| **Events & Attendance** | `events`, `pre_registrations`, `attendance`, `event_roles` | `attendance` enforces `UNIQUE(youth_id, event_id)`. |
| **Gamification** | `gamification_points`, `point_transactions`, `weekly_challenges`, `user_challenge_logs` | `point_transactions` acts as the financial-style ledger; `gamification_points` holds aggregated balances. |
| **Arcade & Growth** | `arcade_score_logs`, `fq_daily_scores`, `brain_user_logs`, `brain_trivia_questions`, `brain_polls`, `brain_whoami_questions`, `brain_verse_chain`, `brain_verse_contributions`, `brain_verse_scramble`, `brain_emoji_translation`, `brain_crosswords` | Mini-game tracking, daily trivia, verse memory, and unconstrained Faith Quest daily leaderboards. |
| **Discipleship & Habits** | `discipleship_pathways`, `member_milestones`, `private_journals`, `prayer_requests`, `prayer_intercessions`, `secret_prayer_pals` | Habit streak trackers, prayer partners, discipleship stages. |
| **Small Groups & Ministries** | `ministries`, `ministry_members`, `small_groups`, `small_group_members`, `small_group_chats`, `group_sessions`, `group_threads`, `group_thread_replies`, `group_memories` | Small group fellowship, chat, ministry assignments. |
| **Communications** | `announcements`, `user_notifications`, `personal_inbox`, `push_subscriptions`, `blockout_dates` | Web push endpoints, personal member messaging, announcements. |
| **Configuration** | `app_settings` | Key-value store for point values (`journal_points`, `prayer_points`). |

### Migration Strategy
Koinonia does not use an external migration runner (like Knex or Umzug). Migrations are executed dynamically at boot inside `db.serialize()` via `CREATE TABLE IF NOT EXISTS` and silent `ALTER TABLE ADD COLUMN` queries.

### Future Quest Data Placement
All Quest data will reside in **separate, dedicated tables prefixed with `quest_`** (e.g., `quest_players`, `quest_skills`, `quest_progress`, `quest_community_projects`). Core tables (`youth`, `users`, `gamification_points`, `attendance`) will remain 100% unaltered.

---

## 5. Life Points Architecture

Life Points represent the global Koinonia currency and engagement metric across events, habits, and games.

```
                    ┌──────────────────────────────┐
                    │ awardPoints(youthId, type,   │
                    │        amount, actor, name)  │
                    └──────────────┬───────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │ INSERT INTO point_transactions       │
                │ (youth_id, type, game_name, amount)  │
                └──────────────────┬───────────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │ SELECT SUM(...) FROM                 │
                │ point_transactions WHERE youth_id = ?│
                └──────────────────┬───────────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │ UPSERT INTO gamification_points      │
                │ (arcade_xp, growth_xp, event_xp, ...)│
                └──────────────────┬───────────────────┘
                                   │
                                   ▼
                ┌──────────────────────────────────────┐
                │ logActivity(actor, 'POINTS_AWARDED') │
                └──────────────────────────────────────┘
```

### Detailed Trace of `awardPoints()` (`server.js` Lines 1258–1269)
1. **Ledger Record:** Every point grant creates an entry in `point_transactions`:
   ```sql
   INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) 
   VALUES (?, ?, ?, ?, ?);
   ```
2. **Type Aggregation:** SQLite calculates the exact sum of all past transactions partitioned by type:
   - `arcade` XP (from mini-games like David's Slingshot, Noah's Ark)
   - `growth` XP (from Bible scrambles, daily journal, prayer pals, weekly challenges)
   - `event` XP (from event check-in and pre-registration bonuses)
3. **Materialized Balance Update:** Updates `gamification_points`:
   ```sql
   INSERT INTO gamification_points (youth_id, arcade_xp, growth_xp, event_xp, points, created_at)
   VALUES (?, ?, ?, ?, ?, ?)
   ON CONFLICT(youth_id) DO UPDATE SET 
     arcade_xp = excluded.arcade_xp, 
     growth_xp = excluded.growth_xp, 
     event_xp = excluded.event_xp, 
     points = excluded.points;
   ```
4. **Audit Trail:** Invokes `logActivity(actor, 'POINTS_AWARDED', ...)` recording the event in `activity_logs`.

### Findings on Ledger and Deductions
- **Transaction Ledger Exists:** Yes, `point_transactions` acts as the ledger.
- **Point Deductions:** Currently, Koinonia does not deduct points. Points are strictly earned/accumulated.
- **Deduplication:** Performed at the caller level (e.g., checking `brain_user_logs` or verifying `created_at LIKE today + '%'`).
- **Quest Reuse:** Koinonia Quest will call `awardPoints(youthId, 'growth', pts, 'Koinonia Quest', questTitle)` when rewarding global Life Points, ensuring 100% consistency with existing leaderboards. Quest-specific XP (Character XP, Skill XP) will live in dedicated Quest tables.

---

## 6. Events and Attendance

### Implementation Analysis
- **Event Creation:** `POST /api/events` inserts event name, date, venue, and `event_points` (default: 10).
- **Pre-Registration:** `POST /api/preregister` creates a record in `pre_registrations` (`UNIQUE(youth_id, event_id)`).
- **Check-In API:** `POST /api/checkin` checks `attendance` for duplicate check-in. If valid, records attendance, awards base `event_points`, plus a 50% bonus if pre-registered, calling `awardPoints(targetYouthId, 'event', finalPts, ...)`.

### Safe Quest Progression Integration
Future Quest quests linked to real-world event attendance (e.g., "Attend Youth Hangout") **must not alter `/api/checkin`**. Instead:
- When a player opens Koinonia Quest, the Quest verification engine performs a safe, read-only check:
  ```sql
  SELECT a.id, a.checked_in_at FROM attendance a 
  WHERE a.youth_id = ? AND a.event_id = ?;
  ```
- If verified, the Quest system marks the quest completed in `quest_player_progress` and issues Quest XP. This requires **zero changes** to the mission-critical attendance check-in workflow.

---

## 7. Fit Quest (Faith Quest / Arcade)

### Implementation Analysis
In the current codebase, the gamified challenge and mini-game suite is branded as **Faith Quest** (code identifiers: `fq_daily_scores`, `/seeker-arcade.html`, and `v8-*`/`v9-*` games):
- **Action Arcade Games:** David's Slingshot (`v8-slingshot.js`), Noah's Ark (`v8-noahs-ark.js`), Moses' Red Sea Dash (`v8-red-sea.js`), Peter's Leap of Faith (`v8-peters-leap.js`), Jonah's Dive (`v8-jonahs-dive.js`).
- **Growth / Brain Games:** Catechism Clash (trivia), Daily Manna Scramble, Emoji Sermon, The Narrow Gate, Reflex Tap, Who Am I?, Verse Chain, Word Matrix.
- **Leaderboards:** `/api/public/arcade-leaderboards-v2` aggregates scores from `point_transactions` and `arcade_score_logs`. `/api/fq-leaderboard/top3` queries `fq_daily_scores`.

### Safe Quest Progression Integration
Quests requiring fitness or mental discipline (e.g., "Reflex Mastery: Complete Reflex Tap") can be verified asynchronously by inspecting `brain_user_logs` or `arcade_score_logs` for timestamped completions by `youth_id`. This grants Quest Discipline XP without touching any existing Faith Quest logic.

---

## 8. Notifications

### Implementation Analysis
- **Web Push Protocol:** Uses `web-push` with VAPID credentials configured via `webpush.setVapidDetails(...)`.
- **Subscriptions:** Browser push subscriptions are stored in `push_subscriptions` (`username UNIQUE`, `subscription JSON`).
- **Notification Function:** `sendCustomPush(db, webpush, youthId, title, message, urlPath)` dispatches push notifications directly to user devices.
- **In-App Notification:** Stored in `personal_inbox` (`sender_id`, `receiver_id`, `title`, `message`, `status`, `created_at`) and `user_notifications`.

### Safe Quest Progression Integration
Quest can invoke `sendCustomPush` and insert into `personal_inbox` for out-of-game notifications (e.g., "Your leader approved your Community Garden Quest! +15 Stewardship XP awarded").

---

## 9. API Architecture

### Characteristics
- Standard HTTP/REST with JSON payloads.
- Authentication state transmitted via `Cookie: koinonia_session=...`.
- Consistent response envelopes: `{ success: true, ... }` or `{ success: false, error: '...' }`.
- Error status codes: `401 Unauthorized`, `403 Forbidden`, `400 Bad Request`, `500 Internal Server Error`.
- No route-level rate limiting is currently configured.

### Quest API Boundary
All Quest endpoints will be isolated under the `/api/quest/*` namespace in an independent router module (`routes/quest.js`). Core Koinonia endpoints will remain untouched.

---

## 10. PWA Architecture

### Implementation Analysis
- **Web Manifest:** `/manifest.json` provides PWA metadata, icons, and standalone launch configuration.
- **Service Worker:** `public/sw.js` registers cache `fog-portal-v6`.
- **Pre-cached Shell Assets:** 21 static assets are defined in `ESSENTIAL_SHELL_ASSETS` with version tag `?v=12.2`.
- **Caching Strategy:**
  - Network-First for navigation requests (`mode === 'navigate'`).
  - Cache-First for assets explicitly declared in `ESSENTIAL_SHELL_ASSETS`.
  - Network-Only / un-intercepted for `/api/*` and any other path.

### Critical Launch Safety Warning
**DO NOT add Koinonia Quest game assets, sprites, audio files, or maps to `ESSENTIAL_SHELL_ASSETS` in `sw.js`.**  
Adding heavy game assets to the main service worker would dramatically slow initial PWA download times, exhaust browser storage limits, and risk service worker installation failures on spotty mobile connections during next week's launch. Quest assets must load on demand or utilize a dedicated secondary cache.

---

## 11. Security Architecture

1. **Session & Cookie Protection:** Cookies are marked `HttpOnly` and `SameSite=Strict`. The `Secure` flag is conditionally applied when HTTPS is detected or forced via environment.
2. **Authorization Boundaries:** Granular RBAC permissions stored in `users.permissions`. Verified via `requirePermission(...)`.
3. **Data Protection & Resource Ownership:** `isCanonicalResourceOwner` validates that members can only view or modify their own private journals, inbox messages, and attendance records.
4. **Youth & Minor Privacy:** Public directory queries project sanitized fields (`id`, `name` only). Sensitive minor data (parents' name, contact numbers, birthdates) is strictly restricted to authenticated staff.
5. **Quest Security Requirement:** Quest leaderboards and virtual-world displays must display only member first names or avatars, completely shielding private contact information.

---

## 12. Proposed Quest Integration Points

```
[ Koinonia Core ]                              [ Koinonia Quest ]
─────────────────                              ──────────────────
koinonia_session Cookie  ─────────────►  Reused via requireAuth
youth.id                 ─────────────►  Foreign Key: quest_players.youth_id
awardPoints()            ◄─────────────  Life Points reward issuance
attendance Table         ◄─────────────  Read-only event quest verification
arcade_score_logs        ◄─────────────  Read-only mini-game quest verification
sendCustomPush()         ◄─────────────  Quest alert notifications
```

---

## 13. RPG Engine Evaluation

### Evaluation of RPGJS
RPGJS is an open-source framework designed for 2D multiplayer RPGs in the browser, built on PixiJS and Node.js.

| Evaluation Criterion | RPGJS Assessment | Risk to Koinonia Launch |
| :--- | :--- | :--- |
| **Technology Stack Fit** | Requires TypeScript & bundler (Vite/Rollup). Koinonia is buildless vanilla JS. | **High Risk:** Introducing a bundler disrupts the existing buildless deployment pipeline. |
| **Server Runtime** | Runs an active game tick loop (20–60 FPS) and Socket.io WebSockets. | **High Risk:** Real-time game loops on Node.js can block the event loop and spike CPU on Raspberry Pi 4. |
| **Raspberry Pi 4 Resources** | Shared 4-core ARM CPU and limited RAM. Node event-loop starvation affects HTTP check-ins. | **High Risk:** Core portal response latency could degrade during Sunday check-in rushes. |
| **Mobile & PWA Overhead** | PixiJS WebGL engine bundle size is ~1.5–3 MB minified. Heavy battery/GPU drain on older phones. | **Moderate-High Risk:** Youth on budget mobile devices will experience lag and crashes. |
| **Dependency Footprint** | Introduces dozens of nested npm dependencies into `package.json`. | **High Risk:** Violates the pre-launch dependency freeze policy. |

### Verdict on RPGJS
**RPGJS is NOT recommended for Phase 1.** Installing it now violates launch safety.

### Recommended Lightweight Alternatives
1. **Lightweight HTML5 2D Canvas Engine (Custom or LittleJS / Phaser Micro-bundle):** A 2D top-down canvas renderer decoupled from server tick loops. The server remains stateless REST for quest logic, avoiding heavy WebSocket overhead.
2. **Stateless Virtual World:** The initial virtual world (Home map, Community Garden, Quest Board) can be rendered as an interactive 2D tilemap or isometric canvas driven by REST state, upgrading to real-time multiplayer WebSockets only in Phase 5 after launch stability is proven.

---

## 14. Architecture Alternatives

### Option A: Monolithic Direct Embed
*Implement Koinonia Quest directly inside `server.js` and `index.html`.*
- **Launch Safety:** **FAIL.** Directly modifies production-bound files right before launch.
- **Maintainability:** Poor. `server.js` is already 2,905 lines; adding game logic creates a fragile mega-monolith.
- **Rollback:** Difficult. Rollback requires editing core files.

### Option B: Separate Game Frontend, Shared Backend
*Create a standalone frontend in `/public/quest/` using existing Express backend endpoints.*
- **Launch Safety:** Moderate. Keeps client files separate, but risks polluting `server.js` with game routes.
- **Maintainability:** Moderate. Clean client separation, but backend remains coupled.

### Option C: Standalone Microservice
*Koinonia Quest runs as a completely independent Node.js process on another port (e.g. 3001) with its own database.*
- **Launch Safety:** Excellent. Complete process and database isolation.
- **Maintainability:** Complex. Requires managing multiple PM2 processes, reverse proxies, and cross-service auth tokens on Raspberry Pi 4.
- **Performance:** Double Node.js runtime memory footprint on Raspberry Pi 4.

### Option D: Decoupled Hybrid Architecture (Recommended)
*An isolated modular router (`routes/quest.js`) dynamically mounted in Express only when enabled by a feature flag, coupled with a standalone client bundle (`public/quest/index.html`).*
- **Launch Safety:** **PERFECT.** When the feature flag is `false`, zero Quest code or routes are activated.
- **Maintainability:** High. Quest code is cleanly partitioned into its own directory without touching core files.
- **Authentication:** Direct reuse of `koinonia_session`.
- **Database:** Dedicated `quest_*` tables, zero alterations to existing tables.
- **Rollback:** Set `KOINONIA_QUEST_ENABLED=false` and restart. 100% instant recovery.

### Comparative Decision Matrix
| Criterion | Option A (Direct Embed) | Option B (Split Frontend) | Option C (Microservice) | Option D (Decoupled Hybrid) |
| :--- | :---: | :---: | :---: | :---: |
| **Launch Safety** | ❌ Unacceptable | ⚠️ Moderate | ✅ Excellent | ✅ **Optimal** |
| **Code Isolation** | ❌ None | ⚠️ Partial | ✅ Complete | ✅ **Complete** |
| **Auth Reuse** | ✅ Easy | ✅ Easy | ⚠️ Complex | ✅ **Seamless** |
| **RPi 4 Performance** | ⚠️ Moderate | ⚠️ Moderate | ❌ Heavy Memory | ✅ **Lightweight** |
| **PWA Impact** | ❌ Degrades Core | ⚠️ Potential Risk | ✅ Zero Impact | ✅ **Zero Impact** |
| **Rollback Capability** | ❌ Complex Git | ⚠️ Manual edits | ✅ Process kill | ✅ **Instant Flag Toggle** |

---

## 15. Recommended Architecture: Decoupled Hybrid (Option D)

```
[ Raspberry Pi 4 Server: Express 5 ]
│
├── Core Koinonia Routes (Protected)
│   ├── /api/login, /api/auth/*
│   ├── /api/events, /api/checkin
│   └── awardPoints() [Ledger Engine]
│
└── [ FEATURE FLAG CHECK: KOINONIA_QUEST_ENABLED === 'true' ]
    │
    ├── (IF DISABLED): Returns 404 / Hidden from Navigation
    │
    └── (IF ENABLED): Conditionally loads
        ├── Router: /routes/quest.js (Mounts /api/quest/*)
        ├── Static View: /public/quest/ (Isolated Game Client)
        └── Database Tables: Dedicated 'quest_*' tables
```

### Architectural Guarantees
1. **Zero Core File Contamination:** No edits to `server.js`, `app.js`, or `index.html` during the launch window.
2. **Session Inheritance:** Reuses the existing authenticated `koinonia_session` cookie via `requireAuth`.
3. **Ledger Integrity:** Awards Life Points strictly through the existing `awardPoints()` function.
4. **Independent Evolution:** Can be upgraded to a standalone WebSocket service (Option C) in Phase 5 without refactoring frontend API contracts.

---

## 16. Proposed Database Strategy

### Principles
- **100% Additive:** Zero `ALTER TABLE` commands on existing core tables.
- **Table Name Isolation:** All tables prefixed with `quest_`.
- **Foreign Key Referencing:** `youth_id INTEGER REFERENCES youth(id)`.
- **Idempotency:** Unique constraints prevent duplicate reward issuance.

### Proposed Schema Design (For Future Implementation)
```sql
-- Player game profile and avatar configuration
CREATE TABLE IF NOT EXISTS quest_players (
    youth_id INTEGER PRIMARY KEY,
    character_xp INTEGER DEFAULT 0,
    character_level INTEGER DEFAULT 1,
    avatar_config TEXT DEFAULT '{}',
    current_title TEXT DEFAULT 'Novice Pilgrim',
    created_at DATETIME,
    updated_at DATETIME
);

-- Skill progression (10 Core Christian Formation Skills)
-- Compassion, Teamwork, Stewardship, Wisdom, Responsibility,
-- Communication, Creativity, Discipline, Service, Leadership
CREATE TABLE IF NOT EXISTS quest_skill_xp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER,
    skill_name TEXT,
    xp_amount INTEGER DEFAULT 0,
    UNIQUE(youth_id, skill_name)
);

-- Quest master catalog
CREATE TABLE IF NOT EXISTS quest_definitions (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    category TEXT, -- 'Home', 'Ministry', 'Community', 'Discipleship'
    verification_mode TEXT, -- 'TRUST', 'FAMILY', 'LEADER', 'EVENT', 'SYSTEM'
    reward_life_points INTEGER DEFAULT 0,
    reward_character_xp INTEGER DEFAULT 0,
    reward_skill_name TEXT,
    reward_skill_xp INTEGER DEFAULT 0,
    is_repeatable INTEGER DEFAULT 0,
    cooldown_hours INTEGER DEFAULT 24,
    is_active INTEGER DEFAULT 1
);

-- Player quest progress and completion states
CREATE TABLE IF NOT EXISTS quest_player_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER,
    quest_id TEXT,
    status TEXT DEFAULT 'AVAILABLE', -- 'AVAILABLE', 'ACCEPTED', 'PENDING_VERIFICATION', 'COMPLETED'
    verification_status TEXT DEFAULT 'NONE',
    verifier_id INTEGER,
    proof_text TEXT,
    completed_at DATETIME,
    created_at DATETIME,
    UNIQUE(youth_id, quest_id, completed_at)
);

-- Shared community project progression (e.g. Community Garden)
CREATE TABLE IF NOT EXISTS quest_community_projects (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    target_stewardship INTEGER DEFAULT 0,
    target_teamwork INTEGER DEFAULT 0,
    target_service INTEGER DEFAULT 0,
    current_stewardship INTEGER DEFAULT 0,
    current_teamwork INTEGER DEFAULT 0,
    current_service INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED'
    unlocked_features TEXT DEFAULT '[]'
);

-- Contribution audit log for community projects
CREATE TABLE IF NOT EXISTS quest_community_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    youth_id INTEGER,
    quest_id TEXT,
    skill_name TEXT,
    contribution_amount INTEGER,
    created_at DATETIME
);
```

---

## 17. Feature Flag Strategy

### Configuration
The module will be controlled via an environment variable and fallback database setting:
```bash
KOINONIA_QUEST_ENABLED=false
```

### Backend Implementation Concept
In `server.js` (to be hooked post-launch):
```javascript
const QUEST_ENABLED = process.env.KOINONIA_QUEST_ENABLED === 'true';

if (QUEST_ENABLED) {
    const questRouter = require('./routes/quest');
    app.use('/api/quest', questRouter);
    app.use('/quest', express.static(path.join(__dirname, 'public/quest')));
    console.log('[FEATURE] Koinonia Quest module mounted successfully.');
} else {
    app.use('/api/quest', (req, res) => res.status(404).json({ error: 'Koinonia Quest is not enabled.' }));
}
```

### Client Navigation Visibility
In `index.html`, the Quest navigation button and action hub card are wrapped with conditional rendering or hidden by default via CSS `display: none;`, displayed only when `/api/quest/status` reports `{ enabled: true }`.

---

## 18. Rollback Strategy

If any issue arises during future Quest testing or staging:

1. **Instant Disabling (Zero Downtime):**
   Update `.env` or run PM2 with `KOINONIA_QUEST_ENABLED=false` and reload:
   ```bash
   pm2 restart fog-staging
   ```
   All Quest routes immediately return 404. All game client loading ceases. Core Koinonia runs unaltered.

2. **Clean Database Reversion:**
   Because all Quest tables are isolated and additive:
   ```sql
   DROP TABLE IF EXISTS quest_community_contributions;
   DROP TABLE IF EXISTS quest_community_projects;
   DROP TABLE IF EXISTS quest_player_progress;
   DROP TABLE IF EXISTS quest_definitions;
   DROP TABLE IF EXISTS quest_skill_xp;
   DROP TABLE IF EXISTS quest_players;
   ```
   Core tables (`youth`, `users`, `attendance`, `point_transactions`, `gamification_points`) retain 100% data integrity without any schema rollback risk.

---

## 19. Launch Safety Risks & Mitigations

| Risk | Probability | Severity | Mitigation Strategy |
| :--- | :---: | :---: | :--- |
| **Code Regression in Core Portal** | Low | Critical | **Zero edits** to existing source code until production launch passes. |
| **Database Lock Contention (SQLite)** | Medium | High | Keep WAL mode active (`PRAGMA journal_mode = WAL;`). Quest tables are isolated; heavy queries won't block core writes. |
| **Raspberry Pi 4 Resource Exhaustion** | Medium | High | No heavy game engines (RPGJS). Keep Quest logic lightweight REST/Canvas during early phases. |
| **Service Worker Cache Bloat** | High | High | Keep Quest assets **out** of `ESSENTIAL_SHELL_ASSETS` in `sw.js`. Load assets on demand. |
| **Dependency Conflict** | Medium | Critical | Zero new packages added to `package.json` before launch. |
| **Youth / Minor Privacy Leak** | Low | High | Enforce strict field projection; leaderboards show only avatars and first names. |
| **Accidental Branch Merge** | Low | Critical | All work quarantined in `feature/koinonia-quest` worktree; never push to main launch branch. |

---

## 20. Recommendations

1. **Immediate Pre-Launch Freeze:**
   Enforce a strict moratorium on all application and database modifications until the Koinonia production launch is successfully executed and verified next week.
2. **Quarantine Development in Git Worktree:**
   Keep all Koinonia Quest exploration strictly confined to `/home/raspi4/koinonia-quest` on branch `feature/koinonia-quest`.
3. **Execute Post-Launch Implementation in Phased Slices:**
   Begin Phase 1 (Isolated Vertical Slice) only after production launch stability is verified. Follow the phased schedule outlined in `KOINONIA_QUEST_ROADMAP.md`.
4. **Preserve Buildless Simplicity:**
   Build the initial 2D virtual world prototype using lightweight HTML5 Canvas / tilemap techniques that respect Raspberry Pi 4 hardware limitations and require zero complex bundling pipelines.
