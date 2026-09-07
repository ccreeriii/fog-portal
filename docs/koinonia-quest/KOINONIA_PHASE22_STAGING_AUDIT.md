# Koinonia Phase 0.22 — Main App Deep Read-Only Audit & Integration Contract

**Document Version**: 1.1.0  
**Audit Date**: 2026-09-07  
**Auditor**: Koinonia Architecture Team  
**Audit Mode**: STRICTLY READ-ONLY (`file:...mode=ro`, zero mutations, verified SHA256)  
**Target Repository**: `/home/raspi4/fog-portal-staging`  
**Target Database**: `/home/raspi4/fog-portal-staging/fog_community.db`  
**Database SHA256 Baseline**: `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12` (12,365,824 bytes)  

---

## 1. Executive Summary

This document establishes the factual baseline for **Shared Core Stage 2** by executing an exhaustive, read-only architectural audit of the active Main FOG App staging environment (`/home/raspi4/fog-portal-staging`). Every finding in this report is grounded in the live source files (`server.js`, `public/js/*.js`) and the real SQLite database (`fog_community.db`).

### Key Discoveries
1. **Active Database Engine**: Staging runs exclusively on `./fog_community.db` (53 tables, WAL mode). The sibling database `ministry.db` is an obsolete artifact not referenced anywhere in `server.js`.
2. **Identity Separation**: Member authentication distinguishes between administrative users (`users` table, 141 rows) and youth/church directory members (`youth` table, 147 rows). Members authenticate against `youth.password` using their `qr_code`, `email`, or `name`.
3. **Points Architecture**: Life Points exist across two tables: a ledger table `point_transactions` (90 rows) and an aggregated cache `gamification_points` (8 rows). Transactions use three coarse types: `'arcade'`, `'growth'`, and `'event'`. Main App lacks fine-grained Virtue XP dimensions and has no database-level idempotency key.
4. **Discrepancy in Points Ledger**: 4 of the 8 members in `gamification_points` have diverged cached point totals compared to the sum of `point_transactions`, stemming from legacy migration scripts. `point_transactions` will serve as the eventual authoritative Life Points ledger.
5. **Foreign Key Enforcement**: `PRAGMA foreign_keys` is **DISABLED** (`foreign_keys = 0`) in runtime connections. As a result, 4 orphaned records exist in `attendance` referencing non-existent `youth_id`s.
6. **Events & Attendance**: Attendance tracking (`attendance`, 220 rows) enforces duplicate check-in prevention strictly at the application layer in `POST /api/checkin`. Pre-registration (`pre_registrations`, 26 rows) confers an automatic +50% bonus on attendance points.
7. **Campfires (Small Groups)**: Main App `small_groups` (4 rows) and `small_group_members` (11 rows) lack capacity constraints and allow unrestricted free-text chat (`small_group_chats`), conflicting with Koinonia / Fire of God youth-safety policy (no unrestricted free-text messaging for minors).
8. **📖 FAITH QUEST CHALLENGE vs 📜 QUEST**: The existing Main App Bible/catechism game is canonically named **📖 FAITH QUEST CHALLENGE** (`fq_daily_scores`, 12 rows, utilizing trivia and quiz mechanics). Generic Koinonia Studio content uses the template **📜 QUEST**. Main App contains zero tables or routes for structured real-world quests, steps, places, or artifacts.
9. **Sports / Fit Quest**: Sports, fitness, and athletic activity tracking are **100% absent** in Main App. The SPORTS HUB / Fit Quest system remains completely separate from FAITH QUEST CHALLENGE.
10. **Shared Core API Security**: Multiple existing staging mutation routes appear callable without authentication. Future `/api/v1/shared/*` mutation routes must enforce rigorous server-side authentication, authorization, idempotency, and reward boundaries.

---

## 2. Target Database Overview & SQLite Pragmas

### 2.1 Database Files in Staging
| File | Size | Role | State |
|:---|:---|:---|:---|
| `fog_community.db` | 12,365,824 B | Active Canonical SQLite Database | WAL mode, SHA256 verified |
| `fog_community.db-wal` | Variable | SQLite Write-Ahead Log | Active runtime transaction log |
| `fog_community.db-shm` | 32,768 B | SQLite Shared Memory Index | Active runtime index |
| `ministry.db` | 24,576 B | Legacy database | Dead artifact (0 references in codebase) |
| `fog_community.backup.db`| 1,228,800 B | Historical backup snapshot | Static |

### 2.2 SQLite Runtime Pragmas (from `fog_community.db`)
| Pragma | Value | Architectural Consequence |
|:---|:---|:---|
| `journal_mode` | `wal` | Concurrent readers do not block writers; serialized single writer. |
| `synchronous` | `2` (`FULL`) | Crash-resilient durability; writes flushed before commit returns. |
| `foreign_keys` | `0` (`OFF`) | Foreign key constraints defined in DDL are **not enforced** at runtime. Orphaned rows can occur upon row deletion. |
| `busy_timeout` | `5000` | 5000ms lock-wait retry before returning `SQLITE_BUSY`. |
| `page_size` | `4096` | 4KB physical page size. |
| `cache_size` | `-2000` | 2MB default page cache. |
| `wal_autocheckpoint`| `1000` | WAL checkpoints back to DB file every 1,000 pages. |

---

## 3. Core Audit Area 1: Member Identity & Authentication

### 3.1 Table DDL: `users`
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    permissions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    youth_id INTEGER
);
```
- **Row Count**: 141 rows.
- **Unique Indexes**: `sqlite_autoindex_users_1` on `username`.
- **Purpose**: System administration logins and staff portal access.
- **Key Columns**:
  - `username`: Admin handle or email.
  - `password`: Scrypt/Argon2/bcrypt hashed password.
  - `permissions`: JSON array of strings (e.g., `["access_checkin", "access_events", "edit_entries", "delete_entries"]`).
  - `youth_id`: Optional link to a corresponding record in `youth`. If `NULL`, user is an external staff administrator without a member profile.

### 3.2 Table DDL: `youth`
```sql
CREATE TABLE youth (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    email TEXT,
    mobile TEXT,
    social_media TEXT,
    birthday TEXT,
    parents_name TEXT,
    qr_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    username TEXT,
    password TEXT,
    permissions TEXT DEFAULT '[]',
    profile_picture TEXT,
    gender TEXT,
    commitment_intent TEXT,
    google_id TEXT,
    facebook_id TEXT,
    account_tier TEXT DEFAULT 'New Member',
    commitment_date DATETIME,
    commitment_accepted_at DATETIME,
    commitment_accepted_by TEXT,
    address TEXT
);
```
- **Row Count**: 147 rows.
- **Unique Indexes**: `sqlite_autoindex_youth_1` on `qr_code`.
- **Purpose**: Canonical church member directory, youth identity, physical pass identifier.
- **Key Columns**:
  - `id`: Primary canonical member ID (`youth_id`).
  - `name`: Full member name.
  - `qr_code`: Unique alphanumeric identifier (e.g., `YTH-9481`) used for physical badges, quick check-in, and member login.
  - `password`: Optional credential allowing members to sign in to their personal portal profile.
  - `account_tier`: Member discipleship tier (`'New Member'` [135], `'Integration Period'` [0], `'Committed Member'` [11], `'Leader'` [1]).

### 3.3 Authentication & Session Mechanics in `server.js`
- **Session Store**: In-memory `Map` (`sessionStore`) storing session objects indexed by a cryptographically generated session cookie.
- **Dual-Path Login (`POST /api/login`)**:
  1. *Admin Login*: Checks `users` table where `username = ?`. If password matches, sets session identity:
     ```javascript
     { userId: user.id, youthId: user.youth_id, username: user.username }
     ```
     Response returns `{ success: true, is_admin: true, permissions: [...], member }`.
  2. *Member Login*: Checks `youth` table where `qr_code = ? OR email = ? OR name = ?`. If password matches, sets session identity:
     ```javascript
     { userId: null, youthId: member.id, username: member.qr_code }
     ```
     Response returns `{ success: true, is_admin: false, permissions: [], member }`.
- **Identity Resolution (`GET /api/auth/me`)**: Resolves current session cookie against `sessionStore`, queries database for updated profile, and returns canonical user identity.
- **Authorization Middlewares**:
  - `requireAuth`: Rejects non-authenticated sessions with HTTP 401.
  - `requirePermission(perm)`: Verifies user permissions JSON contains required permission.
  - `requireSelfOr(perm, extractTargetYouthId)`: Grants access if user's own `youthId` matches target or if user possesses admin permission.

### 3.4 Identity Audit Findings
- **Terminology**: The database uses `youth` as the table name and `youth_id` as foreign keys across the entire application, even though the member base includes young adults, leaders, and general parishioners.
- **Koinonia Integration Requirement**: The Koinonia Shared Core must use `youth.id` as the canonical `memberId`. In Koinonia, `currentMember.id` maps directly to `youth.id`.

---

## 4. Core Audit Area 2: Life Points (LP) & Points Ledger

### 4.1 Table DDL: `point_transactions` (Ledger)
```sql
CREATE TABLE point_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER,
    type TEXT,
    game_name TEXT,
    amount INTEGER,
    created_at DATETIME
);
```
- **Row Count**: 90 rows.
- **Indexes**: None.
- **Transaction Types Observed**:
  - `'arcade'`: 48 transactions, total 3,715 points (games: Jonah's Deep Sea Dive, Noah's Ark, Slingshot, Red Sea Dash, Peter's Leap).
  - `'growth'`: 40 transactions, total 990 points (Daily Prayer Covenant, Emoji Sermon Translator, Joined Group, Catechism Clash, Daily Journal, Verse Chain, Reflex Tap).
  - `'event'`: 2 transactions, total 154 points (Event Check-In).
- **Idempotency**: Main App has **NO `idempotency_key` column** on `point_transactions`. Deduplication is performed procedurally in select routes via timestamp matching or single-record existence checks.
- **Authoritative Status**: `point_transactions` is confirmed as the eventual authoritative Life Points ledger.

### 4.2 Table DDL: `gamification_points` (Balance Cache)
```sql
CREATE TABLE gamification_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER UNIQUE,
    points INTEGER DEFAULT 0,
    created_at DATETIME,
    arcade_xp INTEGER DEFAULT 0,
    growth_xp INTEGER DEFAULT 0,
    event_xp INTEGER DEFAULT 0
);
```
- **Row Count**: 8 rows.
- **Unique Indexes**: `sqlite_autoindex_gamification_points_1` on `youth_id`.
- **Purpose**: Fast-lookup summary table for profile badges and leaderboards.
- **Columns**: `points` (overall total), `arcade_xp`, `growth_xp`, `event_xp`.

### 4.3 Points Awarding Engine: `awardPoints()` in `server.js` (L1879)
```javascript
function awardPoints(youthId, type, amount, actor, gameName = null) {
    const amt = parseInt(amount) || 0;
    db.run(`INSERT INTO point_transactions (youth_id, type, game_name, amount, created_at) VALUES (?, ?, ?, ?, ?)`,
        [youthId, type, gameName, amt, getManilaTime()]);
    db.get(`SELECT 
        SUM(CASE WHEN type='arcade' THEN amount ELSE 0 END) as arc, 
        SUM(CASE WHEN type='growth' THEN amount ELSE 0 END) as gro, 
        SUM(CASE WHEN type='event' THEN amount ELSE 0 END) as eve 
        FROM point_transactions WHERE youth_id = ?`, [youthId], (err, row) => {
        let arcade = row ? (row.arc || 0) : 0;
        let growth = row ? (row.gro || 0) : 0;
        let event = row ? (row.eve || 0) : 0;
        const overall = arcade + growth + event;
        db.run(`INSERT INTO gamification_points (youth_id, arcade_xp, growth_xp, event_xp, points, created_at) 
            VALUES (?, ?, ?, ?, ?, ?) 
            ON CONFLICT(youth_id) DO UPDATE SET 
                arcade_xp = excluded.arcade_xp, 
                growth_xp = excluded.growth_xp, 
                event_xp = excluded.event_xp, 
                points = excluded.points`,
            [youthId, arcade, growth, event, overall, getManilaTime()],
            function(err2) { 
                if(!err2 && actor) logActivity(actor, 'POINTS_AWARDED', 
                    `Awarded ${amt} ${type} XP to Youth ID ${youthId}. Game: ${gameName||'N/A'}`); 
            }
        );
    });
}
```

### 4.4 Discrepancy Analysis (Cached vs Ledger)
Auditing all 8 members in `gamification_points` against `SUM(amount)` from `point_transactions` reveals:
| Youth ID | Cached `points` | Cached (Arc / Gro / Eve) | Ledger `SUM` | Ledger (Arc / Gro / Eve) | Discrepancy Cause |
|:---|:---|:---|:---|:---|:---|
| **3** | 246 | (347 / 180 / 0) | **527** | (347 / 180 / 0) | Column `points` was not updated during legacy migration; sub-totals sum to 527. |
| **162** | 18 | (0 / 30 / 0) | **30** | (0 / 30 / 0) | Legacy migration inserted initial balance without recalculating total. |
| **158** | 27 | (0 / 45 / 0) | **45** | (0 / 45 / 0) | Legacy migration inserted initial balance without recalculating total. |
| **163** | 9 | (0 / 15 / 0) | **15** | (0 / 15 / 0) | Legacy migration inserted initial balance without recalculating total. |
| 164 | 15 | (0 / 15 / 0) | 15 | (0 / 15 / 0) | Balanced (0 diff). |
| 165 | 30 | (0 / 30 / 0) | 30 | (0 / 30 / 0) | Balanced (0 diff). |
| 160 | 3820 | (3368 / 298 / 154) | 3820 | (3368 / 298 / 154) | Balanced (0 diff). |
| 161 | 400 | (0 / 400 / 0) | 400 | (0 / 400 / 0) | Balanced (0 diff). |

**Architectural Implication for Stage 3**: The Shared Core provider must treat `point_transactions` as the primary Source of Truth and dynamically recompute balances or reconcile discrepancies upon read.

---

## 5. Core Audit Area 3: XP & Growth Models

### 5.1 Main App Growth Tracking
- Main App groups progression into three buckets:
  1. **Arcade XP**: Earned by playing mini-games (`arcade_score_logs`). Capped at 5 points per submission in universal submit.
  2. **Growth XP**: Earned through spiritual habits (Daily Prayer, Daily Journal, Catechism, Small Group joining, Milestones).
  3. **Event XP**: Earned through physical event check-ins (`attendance` + `pre_registrations` bonus).
- Main App calculates weekly points dynamically from `point_transactions` using Manila timezone (Monday 00:00:00 start).

### 5.2 Koinonia Virtue Growth Model vs Main App
| Dimension | Main App Reality | Koinonia Shared Core Model | Target Architecture |
|:---|:---|:---|:---|
| **Primary Currency** | `points` (integer sum) | Life Points (`LP`, integer balance + ledger) | `point_transactions` authoritative ledger |
| **Character Level** | None (only in-game procedural levels) | Level 1..N Pilgrim (based on `charXp`) | Derived / Projected |
| **XP Categories** | `arcade_xp`, `growth_xp`, `event_xp` (3 coarse buckets) | 6 Virtue XP dimensions: Stewardship, Responsibility, Discipline, Teamwork, Service, Reflection | Main App projects aggregate `growth_xp`; canonical server-side Virtue XP storage designed in Stage 3 (NO DB migration in 0.22) |
| **Streak Tracking** | None in database | Daily prayer/quest streak in Koinonia state | Shared Core Service State |
| **Level Progress Bar** | None | `charXp` vs `charXpMax` with dynamic curve | Shared Core Client Layer |

---

## 6. Core Audit Area 4: Events & Attendance

### 6.1 Table DDL: `events`
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_date TEXT,
    time_start TEXT,
    venue TEXT,
    poster TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    photos_url TEXT,
    materials_url TEXT,
    gallery TEXT,
    prereg_banner TEXT,
    prereg_info TEXT,
    additional_info TEXT,
    prereg_title TEXT,
    prereg_bottom_banner TEXT,
    roles_restricted_notes TEXT,
    event_points INTEGER DEFAULT 10
);
```
- **Row Count**: 10 rows.
- **Key Columns**:
  - `name`: Event title.
  - `event_date`: ISO date string (`YYYY-MM-DD`).
  - `event_points`: Points awarded upon attendance (defaults to 10).
  - `roles_restricted_notes`: Restricted notes visible only to staff with `edit_entries` permission.

### 6.2 Table DDL: `attendance`
```sql
CREATE TABLE attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    is_walkin INTEGER DEFAULT 0,
    checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (youth_id) REFERENCES youth(id),
    FOREIGN KEY (event_id) REFERENCES events(id)
);
```
- **Row Count**: 220 rows.
- **Indexes**: None (no unique index on `(youth_id, event_id)`).
- **Orphaned Records**: 4 rows exist with `youth_id` values (92, 37, 125, 124) that do not exist in `youth`.
- **Duplicate Records**: 0 duplicate check-ins exist across all 220 rows.

### 6.3 Table DDL: `pre_registrations`
```sql
CREATE TABLE pre_registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER,
    event_id INTEGER,
    created_at DATETIME,
    UNIQUE(youth_id, event_id)
);
```
- **Row Count**: 26 rows.
- **Note**: A duplicate table `preregistrations` (without underscore) exists with 0 rows and is unused.

### 6.4 Check-In Workflow in `server.js` (`POST /api/checkin`)
```javascript
// Check for duplicate check-in
db.get(`SELECT id FROM attendance WHERE youth_id = ? AND event_id = ?`, [targetYouthId, event_id], (err, row) => {
    if (row) return res.status(400).json({ error: 'Member is ALREADY checked in for this event.' });
    
    db.run(`INSERT INTO attendance (youth_id, event_id, is_walkin, checked_in_at) VALUES (?, ?, ?, ?)`, ...);
    
    // Calculate points: base event_points + 50% bonus if pre-registered
    db.get(`SELECT event_points FROM events WHERE id = ?`, [event_id], (err, evt) => {
        const pts = (evt && evt.event_points !== null) ? evt.event_points : 10;
        db.get(`SELECT id FROM pre_registrations WHERE youth_id = ? AND event_id = ?`, [targetYouthId, event_id], (err, pre) => {
            const preRegBonus = pre ? Math.floor(pts * 0.5) : 0;
            const finalPts = pts + preRegBonus;
            awardPoints(targetYouthId, 'event', finalPts, actor, pre ? 'Event Check-In + Pre-Reg Bonus' : 'Event Check-In');
        });
    });
});
```
- Supports lookup via either `qr_code` (from badge scan) or raw `youth_id`.
- Successfully prevents duplicate check-ins at runtime.
- Automatically credits `point_transactions` with `type: 'event'`.

---

## 7. Core Audit Area 5: Campfires / Small Groups

### 7.1 Table DDL: `small_groups`
```sql
CREATE TABLE small_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    leader_id INTEGER,
    meeting_schedule TEXT,
    venue TEXT,
    created_at DATETIME,
    points INTEGER DEFAULT 20,
    logo TEXT,
    privacy_level TEXT DEFAULT 'Open'
);
```
- **Row Count**: 4 rows (`St. Timothy TorchBearers`, `CrossWalk Youth`, `Living Waters`, `Faith Warriors`).
- **Privacy Levels**: `'Open'`, `'Approval'`, `'Invite-Only'`.
- **Capacity**: No capacity column exists in Main App `small_groups`.
- **Architectural Policy**: Campfire remains the canonical group system; Quest Circles remain a gameplay layer attached to Campfire. Capacity must be enforced through the future Shared Core service: Minimum participants required to ACTIVATE = 5; default maximum = 12; community maximum = configurable by Admin, default 12; Leader may configure per-Campfire maximum between 5 and community maximum; active Campfire cannot have capacity lowered below its current active member count. Quest Circles remain a gameplay layer attached to canonical Campfire with no duplicate roster. Application/API level for prototype/beta; long-term server-side persisted, e.g. `max_capacity`, through later approved non-destructive migration; NO schema change in Phase 0.22.

### 7.2 Table DDL: `small_group_members`
```sql
CREATE TABLE small_group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    youth_id INTEGER,
    joined_at DATETIME,
    status TEXT DEFAULT 'Approved',
    UNIQUE(group_id, youth_id)
);
```
- **Row Count**: 11 rows.
- **Statuses**: `'Approved'`, `'Pending'`.

### 7.3 Table DDL: `small_group_chats` & Youth Safety Policy
```sql
CREATE TABLE small_group_chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    youth_id INTEGER,
    message TEXT,
    created_at DATETIME,
    reactions TEXT DEFAULT '{}'
);
```
- **Row Count**: 14 rows.
- **Youth Safety Audit**: Main App allows any member to post arbitrary free-text strings (`message TEXT`) without moderation, profanity filtering, or adult chaperone notification.
- **Koinonia / Fire of God Youth-Safety Policy**:
  - **CANONICAL PRODUCT RULE: NO UNRESTRICTED FREE-TEXT MESSAGING FOR MINORS**.
  - Structured reactions (👏, 🙏, 🔥, 🌱, ❤️) and approved/preset social interactions remain the default.
  - Future architecture may allow separately gated adult/staff communication with appropriate moderation/authorization, but minor accounts must not receive unrestricted free-text messaging.
  - Zero chat implementation changes in Phase 0.22.

---

## 8. Core Audit Area 6: Ministries & Volunteer Service

### 8.1 Table DDL: `ministries`
```sql
CREATE TABLE ministries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    restricted_notes TEXT,
    created_at DATETIME,
    logo TEXT
);
```
- **Row Count**: 6 rows (Music & Worship, Media & Production, Hospitality & Ushers, Altar Servers, Youth Catechesis, Outreach & Missions).

### 8.2 Table DDL: `ministry_members`
```sql
CREATE TABLE ministry_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ministry_id INTEGER,
    youth_id INTEGER,
    role TEXT,
    assigned_at DATETIME,
    sub_role TEXT,
    is_priority INTEGER DEFAULT 0,
    intent_message TEXT,
    UNIQUE(ministry_id, youth_id)
);
```
- **Row Count**: 61 rows.

### 8.3 Table DDL: `event_roles` (Ministry Service Assignments)
```sql
CREATE TABLE event_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    youth_id INTEGER,
    role_name TEXT,
    assigned_at DATETIME,
    sub_role TEXT,
    status TEXT DEFAULT 'Pending',
    UNIQUE(event_id, youth_id, role_name)
);
```
- **Row Count**: 40 rows.
- **Scheduling Conflicts**: Scheduling checks against `blockout_dates`. Rejects if member is blocked out.

---

## 9. Core Audit Area 7: Milestones & Discipleship

### 9.1 Table DDL: `discipleship_pathways`
```sql
CREATE TABLE discipleship_pathways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    step_order INTEGER,
    created_at DATETIME,
    points INTEGER DEFAULT 50
);
```
- **Row Count**: 5 rows.
- **Steps**:
  1. Welcome & Connect (50 pts)
  2. First Steps in Faith (50 pts)
  3. Foundations of Fellowship (50 pts)
  4. Active Ministry Servant (50 pts)
  5. Disciple & Steward Leader (50 pts)

### 9.2 Table DDL: `member_milestones`
```sql
CREATE TABLE member_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youth_id INTEGER,
    pathway_id INTEGER,
    status TEXT DEFAULT 'In Progress',
    completed_at DATETIME,
    notes TEXT,
    UNIQUE(youth_id, pathway_id)
);
```
- **Row Count**: 2 rows.
- **Point Trigger**: When a milestone is marked `'Completed'` via `POST /api/discipleship/milestones`, `awardPoints` automatically credits the pathway's points with `type: 'growth'`.
- **Architectural Separation**: `member_milestones` is **NOT** the permanent storage mechanism for Quest completions. Milestones and Quests are separate canonical concepts.

---

## 10. Core Audit Area 8: 📖 FAITH QUEST CHALLENGE vs 📜 QUEST

### 10.1 Table DDL: `fq_daily_scores`
```sql
CREATE TABLE fq_daily_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT,
    game_name TEXT,
    score REAL,
    avatar TEXT,
    date_played TEXT
);
```
- **Row Count**: 12 rows.
- **Nature of Existing System**: Injected in `server.js` (L1896) as a standalone daily trivia game leaderboard. Does not join with `youth` or `users`; stores plain strings (`player_name`, `game_name`, `score`, `avatar`, `date_played`).
- **Trivia Engine Tables**:
  - `brain_trivia_questions`: 50 rows of multiple choice catechism questions.
  - `daily_game_attempts`: 10 rows tracking daily plays.
- **Mandatory Canonical Terminology**:
  - **Main App Bible/catechism game**: **📖 FAITH QUEST CHALLENGE**. It uses trivia and game mechanics, but its official product name is **FAITH QUEST CHALLENGE**. It must NOT be renamed to alternative trivia titles.
  - **Generic Koinonia Studio template**: **📜 QUEST**. It must NOT be renamed to alternative quest titles.
  - **SPORTS HUB / Fit Quest**: Completely separate from FAITH QUEST CHALLENGE.

---

## 11. Core Audit Area 9: Sports & Fit Quest Absence

A full lexical and SQL schema audit across `fog_community.db` and `server.js` was conducted:
- `SELECT sql FROM sqlite_master` searched for `sport`, `fit`, `fitness`, `athletic`, `workout`, `exercise`. Result: **0 matches**.
- `server.js` searched for corresponding endpoints or models. Result: **0 matches**.
- **Conclusion**: Sports and fitness features are **100% absent** from the Main App. Sports / Fit Quest is unique to Koinonia (first introduced in Phase 0.18) and remains cleanly separate from FAITH QUEST CHALLENGE.

---

## 12. Core Audit Area 10: API Route Inventory & Security Audit

### 12.1 Staging Route Inventory
| Method | Endpoint | Auth Required | Parameters / Body | Staging Behavior / Response | Shared Core Stage 3 Utility |
|:---|:---|:---|:---|:---|:---|
| `GET` | `/api/auth/me` | Session Cookie | None | Returns `{ userId, youthId, username, permissions, member, is_admin }` | Identity Provider |
| `POST` | `/api/login` | None | `{ username, password }` | Authenticates against `users` or `youth`; sets cookie | Identity Provider |
| `POST` | `/api/logout` | Session Cookie | None | Destroys session | Identity Provider |
| `GET` | `/api/youth/:id` | `requireAuth` | None | Returns member directory record | Member Profile |
| `GET` | `/api/gamification/points/:youth_id` | None | `youth_id` in path | Returns `{ points, arcade_xp, growth_xp, event_xp, weekly_points }` | Balance Provider |
| `POST` | `/api/games/universal-submit` | None | `{ youth_id, game_name, score, type, actor }` | Calls `awardPoints` (points capped at `Math.min(score, 5)`) | Insecure Raw Mutation |
| `POST` | `/api/checkin` | None | `{ youth_id, event_id, is_walkin, actor, qr_code }` | Idempotent check-in; calculates base + pre-reg bonus; awards points | Insecure Raw Mutation (Internal logic reusable behind secure Shared Core wrapper; NOT a direct Koinonia client write path) |
| `GET` | `/api/events` | Optional | None | Returns list of events (sanitized for public or staff) | Event Catalog |
| `GET` | `/api/events/:id/preregs` | None | `id` in path | Returns list of pre-registered `youth_id`s | Event Pre-Reg |
| `GET` | `/api/small-groups` | None | `youth_id` in query | Returns small groups with `leader_name`, `member_count`, `user_status` | Campfire Catalog |
| `POST` | `/api/small-groups/:id/join` | None | `{ youth_id }` | Joins group (awards 20 pts if Approved) | Campfire Join |
| `GET` | `/api/small-groups/:id/roster-status`| None | `id` in path | Returns group members, status, and last active date | Campfire Roster |
| `PATCH`| `/api/small-groups/:id/privacy` | None | `{ privacy_level }` | Updates group privacy ('Open', 'Approval', 'Invite-Only') | Campfire Privacy |
| `GET` | `/api/ministries` | Optional | None | Returns active ministries and member count | Ministry Catalog |
| `GET` | `/api/youth/:id/ministries` | None | `id` in path | Returns ministries the youth belongs to | My Ministries |
| `GET` | `/api/discipleship/pathways` | None | None | Returns 5 discipleship pathway milestones | Milestones Catalog |
| `GET` | `/api/discipleship/member-progress/:youth_id` | None | `youth_id` in path | Returns member's milestone statuses | Member Milestones |
| `POST` | `/api/discipleship/milestones` | None | `{ youth_id, pathway_id, status, notes, actor }` | Upserts milestone; awards points upon completion | Milestone Award |
| `GET` | `/api/activity-logs` | `access_activity` | None | Returns recent audit activity logs | Audit Feed |

### 12.2 Shared Core API Security Requirements
The audit discovered existing staging mutation routes (e.g., `/api/games/universal-submit`, `/api/checkin`) that appear callable without session authentication.

**CRITICAL ARCHITECTURAL MANDATE**: Stage 3 **MUST NOT** simply expose or reuse these raw mutation endpoints as Koinonia's public Shared Core contract. Future `/api/v1/shared/*` mutation endpoints must enforce:
1. **Authenticated Member/Session Identity**: Strict session validation. For production/shared authenticated member data, an invalid or missing authenticated session must NOT silently grant member privileges through a generic guest identity. Authenticated Shared Core operations must return/reject appropriately with HTTP 401 when no valid member session exists. (Guest/anonymous mode may exist only as an explicitly scoped read-only experience if later approved.)
2. **Server-Side Authorization**: Ensuring caller has rights to execute action.
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
4. **Idempotency Keys**: Mandatory unique tokens for progression and LP mutations.
5. **Server Authority**: Complete server calculation over LP and XP awards (clients must NEVER declare arbitrary LP amounts).
6. **Validation & Bounded Rewards**: All LP and XP rewards must be bounded by server-side canonical content/reward definitions. Exact reward ceilings are governed configuration and must never be supplied or controlled by the client.
7. **Replay & Double-Submit Protection**: Preventing race condition exploits.
8. **CSRF Protection**: Defenses against cross-site request forgery if cookie authentication is utilized.
9. **Audit Logging**: Comprehensive activity logs for all consequential mutations.
10. **Secure Wrapper Requirement**: Raw unauthenticated staging mutation routes (such as `POST /api/checkin` and `POST /api/games/universal-submit`) must NOT be used as direct Koinonia client write APIs. All consequential Koinonia mutations must go through authenticated `/api/v1/shared/*` services (with existing Main App business logic called internally behind the secure service wrapper where applicable).

---

## 13. Core Audit Area 11: Database Constraints & Integrity Analysis

1. **Foreign Key Integrity**:
   - SQLite connections in `server.js` do not run `PRAGMA foreign_keys = ON`.
   - Orphaned rows exist in `attendance` (4 rows).
   - *Stage 3 Safeguard*: All SQL queries or API adapters must use `LEFT JOIN` with fallback defaults (e.g. `COALESCE(y.name, 'Unknown Pilgrim')`).
2. **Unique Constraints**:
   - `users.username` (UNIQUE)
   - `youth.qr_code` (UNIQUE)
   - `gamification_points.youth_id` (UNIQUE)
   - `small_group_members(group_id, youth_id)` (UNIQUE)
   - `ministry_members(ministry_id, youth_id)` (UNIQUE)
   - `pre_registrations(youth_id, event_id)` (UNIQUE)
   - `user_challenge_logs(youth_id, challenge_id)` (UNIQUE)
   - `member_milestones(youth_id, pathway_id)` (UNIQUE)
   - `event_roles(event_id, youth_id, role_name)` (UNIQUE)
   - **`attendance(youth_id, event_id)` is NOT UNIQUE in schema**. Uniqueness is enforced solely by `server.js` route code.
   - **`point_transactions` has NO UNIQUE or IDEMPOTENCY constraint**.
3. **Concurrency & Locking**:
   - WAL mode allows high-throughput concurrent reads.
   - Database writes lock the file briefly; `busy_timeout = 5000` prevents immediate collision errors under normal church loads (<1,000 concurrent users).
   - Write operations must remain fast and short to prevent thread starvation on the Raspberry Pi 4 host.

---

## 14. Verification & Audit Integrity

- Baseline SHA256 of `/home/raspi4/fog-portal-staging/fog_community.db`:
  `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`
- Post-Audit SHA256 of `/home/raspi4/fog-portal-staging/fog_community.db`:
  `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`
- Staging directory Git status: **Clean, 0 modifications**.
- Zero write statements, migrations, or process restarts were performed.
