# KOINONIA SHARED CORE BLUEPRINT
## Game Consolidation & Shared Data Architecture for the Fire of God Community

---

### Executive Summary

This blueprint establishes the official product architecture approved by the Product Owner for the digital ecosystem of the **Fire of God (FOG) Community**:

```
                 FIRE OF GOD COMMUNITY
                         │
                 ONE MEMBER ACCOUNT
                         │
              ONE SHARED CORE DATA
                         │
       ┌─────────────────┴─────────────────┐
       │                                   │
   MAIN FOG APP                        KOINONIA
   Growth-focused                    Experience-focused
       │                                   │
   Scripture                           Quests
   Prayer                              Campfires
   Journal                             Events
   Growth Path                         Faith Quest
   Formation                           FOG Arcade
   Ministry info                       Exploration
   Community utilities                 Ministry Missions
   Admin moderation                        │
       │                                   │
       └───────────────┬───────────────────┘
                       │
                 SAME LIFE POINTS
                 SAME MILESTONES
                 SAME ATTENDANCE
                 SAME EVENTS
                 SAME GROUPS
                 SAME MINISTRIES
                 SAME GROWTH JOURNEY
```

**Two experiences. One community. One member identity. One growth journey. One shared source of truth.**

---

### Strict Architecture Separation Note

In accordance with autonomous repository safety rules:
- **CURRENT IMPLEMENTATION (Phase 0.20.1)**: All shared-core abstractions exist in Koinonia prototype space via `LocalSharedCoreProvider` (`prototype/koinonia-phase20_1/data/shared_core.js`). The main staging application (`/home/raspi4/fog-portal-staging`) and production database (`fog_community.db`) are strictly **READ-ONLY** and were **NOT MODIFIED**.
- **FUTURE TARGET (Stages 2–6)**: Architecture, data contracts, and integration models documented below define the staged migration plan for future unified deployment.

---

### Table of Contents

1. [Approved Two-App Architecture](#1-approved-two-app-architecture)
2. [Target Audiences & Specialization](#2-target-audiences--specialization)
3. [Cross-Access Principle](#3-cross-access-principle)
4. [Canonical Data Ownership](#4-canonical-data-ownership)
5. [Main App Responsibilities](#5-main-app-responsibilities)
6. [Koinonia Responsibilities](#6-koinonia-responsibilities)
7. [Shared Member Identity](#7-shared-member-identity)
8. [Shared Life Points Architecture](#8-shared-life-points-architecture)
9. [Life Points Ledger & Idempotency](#9-life-points-ledger--idempotency)
10. [Shared Quests Architecture](#10-shared-quests-architecture)
11. [Shared Milestones & Growth Formation](#11-shared-milestones--growth-formation)
12. [Shared Events Architecture](#12-shared-events-architecture)
13. [Shared Attendance & Check-In Contract](#13-shared-attendance--check-in-contract)
14. [Shared Campfire & Small Groups Unification](#14-shared-campfire--small-groups-unification)
15. [Shared Ministry Membership & Ministry Missions](#15-shared-ministry-membership--ministry-missions)
16. [Koinonia Journey vs Main App Growth Path](#16-koinonia-journey-vs-main-app-growth-path)
17. [Faith Quest Challenge Integration](#17-faith-quest-challenge-integration)
18. [FOG Arcade Integration & Audited Findings](#18-fog-arcade-integration--audited-findings)
19. [Activity Event Vocabulary](#19-activity-event-vocabulary)
20. [Provider & API Boundary Contract](#20-provider--api-boundary-contract)
21. [Offline & Sync Considerations](#21-offline--sync-considerations)
22. [Six-Stage Migration Strategy](#22-six-stage-migration-strategy)
23. [Staging-Audit Safety Report](#23-staging-audit-safety-report)
24. [Unresolved Questions Discovered During Read-Only Audit](#24-unresolved-questions-discovered-during-read-only-audit)

---

### 1. Approved Two-App Architecture

#### CURRENT IMPLEMENTATION
- Two distinct client codebases exist in the staging server environment:
  1. Main FOG App in `/home/raspi4/fog-portal-staging` (Node.js/Express, SQLite `fog_community.db`, PM2 process `fog-staging`).
  2. Koinonia Quest Prototype in `/home/raspi4/koinonia-quest` on branch `feature/koinonia-quest` (static web app running on deterministic testing ports 18100–18106).
- Phase 0.20.1 introduces the `LocalSharedCoreProvider` in `prototype/koinonia-phase20_1/data/shared_core.js`, implementing unified data structures locally without touching staging.

#### FUTURE TARGET
- Both applications connect to a unified FOG Shared Core API backend.
- The member logs in once with their Fire of God account and has seamless access to both the Main App and Koinonia.
- Both frontends consume shared canonical tables and emit domain activity events into a central ledger.

---

### 2. Target Audiences & Specialization

#### CURRENT IMPLEMENTATION & OFFICIAL PRINCIPLE
- **Koinonia**: Primarily targets younger members, youth, and young seekers through interactive, narrative-driven Christian/Catholic experiences, virtual fellowship exploration, physical Faith Quests, Campfires, and Biblical mini-games.
- **Main FOG App**: Primarily provides a conventional growth, community, devotional, and administrative experience that serves adults, young professionals, ministry coordinators, and pastoral facilitators.
- **Audience Balance**: Specialization is driven by UX modality, not identity partitioning. Youth are encouraged to use devotional tools (Scripture readings, prayer requests, personal journals), and adults and mentors are welcomed to participate in Koinonia adventures, Campfires, and challenges.

---

### 3. Cross-Access Principle

#### CURRENT IMPLEMENTATION
- Koinonia provides direct UI tabs, quick shortcuts, and top-level navigation to all experience destinations: Campfire, Quests, Events, Faith Quest, FOG Arcade, and Journey.

#### FUTURE TARGET
- Single Sign-On (SSO) session tokens will allow seamless deep-linking between applications:
  - Tapping "Play Campfire Quests" in the Main App deep-links into Koinonia at `koinonia.fogportal.com/?open=campfire&circleId=cf_01`.
  - Tapping "Open Gospel Reading" in Koinonia deep-links into the Main App Scripture module at `app.fogportal.com/scripture?date=today`.
- A member's identity, rank, and balance are identical across both URLs.

---

### 4. Canonical Data Ownership

The following table defines the single source of truth for all community data domains:

| Data Domain | Canonical Storage | Primary Authority | Read Access | Write Access |
|---|---|---|---|---|
| **Member Identity** | `users`, `youth` tables | Shared Core | Both Apps | Account Profile / Auth |
| **Life Points (LP)** | `point_transactions`, `gamification_points` | Shared Core | Both Apps | Central LP Service (Idempotent) |
| **Character XP / Virtues** | `member_virtues` (future) | Shared Core | Both Apps | Quests / Formation / Activities |
| **Quests & Missions** | `quests`, `quest_completions` (future) | Shared Core | Both Apps | Koinonia / Ministry Leads |
| **Campfires / Groups** | `small_groups`, `small_group_members` | Shared Core | Both Apps | Leaders / Admin |
| **Campfire Game State** | `campfire_game_state` (future) | Shared Core | Both Apps | Koinonia Gameplay |
| **Events** | `events` table | Shared Core | Both Apps | Admin / Pastoral Staff |
| **Attendance / Check-In**| `attendance` table | Shared Core | Both Apps | Self Check-In / Scanner / Admin |
| **Ministries & Roles** | `ministries`, `ministry_members` | Shared Core | Both Apps | Ministry Coordinators / Admin |
| **Milestones / Growth** | `member_milestones`, `discipleship_pathways` | Shared Core | Both Apps | Shared Evaluation Engine |
| **Personal Journals** | `private_journals` table | Main App | Main App Only | Member (Private) |
| **Prayer Requests** | `prayer_requests`, `prayer_intercessions` | Main App | Main App | Community Intercessors |
| **Faith Quest Records** | `fitquest_records` (legacy storage ID) | Koinonia / Shared Core | Both Apps | Faith Quest Engine |
| **Arcade Scores** | `arcade_score_logs` table | Koinonia / Shared Core | Both Apps | FOG Arcade Shell |

---

### 5. Main App Responsibilities

The Main FOG App is the **Growth & Community Portal**:
1. **Daily Devotionals & Scripture**: Daily Catholic lectionary readings, liturgical calendar, guided meditations.
2. **Prayer Wall & Intercession**: Private and community prayer requests, intercession counters, spiritual communion.
3. **Personal Spiritual Journal**: Encrypted private reflections, spiritual direction notes, examination of conscience.
4. **Growth Path & Formation Curriculum**: Structured discipleship pathways, sacramental preparation, catechism tracks.
5. **Ministry Information & Rostering**: Ministry descriptions, schedules, liturgical serving assignments, coordinator contacts.
6. **Community Announcements & Bulletin**: Official parish announcements, pastoral letters, push notifications.
7. **Administrative Moderation**: User role management, attendance reporting, safety moderation, compliance auditing.

---

### 6. Koinonia Responsibilities

Koinonia is the **Interactive Fellowship Experience**:
1. **Real-World Calling Quests**: Real-world chores, family service, environmental stewardship, kindness adventures.
2. **Campfire Small-Group Fellowship**: Team quests, peer encouragement, structured positive reactions, campfire storytelling.
3. **Interactive Event Experiences**: Self check-in via PIN/QR, on-site event missions, live fellowship interactions.
4. **Faith Quest Challenge (Physical Movement & Sports)**: Virtual sports drills, real-world sports logs (basketball, running, badminton, pickleball).
5. **FOG Arcade**: Biblical physics mini-games (David's Slingshot, Noah's Ark, Moses' Red Sea) and discipleship trivia.
6. **2D World Exploration**: Walkable virtual spaces (Home, FOG Center, Sanctuary, Courtyard, Outreach Site).
7. **Ministry Missions**: Ministry-specific service missions (choir practice, altar preparation, media documentation).
8. **My Journey (Memories Timeline)**: Reflective scrapbook of milestones, event encounters, photos, and spiritual moments.

---

### 7. Shared Member Identity

#### CURRENT IMPLEMENTATION
- Staging stores member records in SQLite tables `youth` (`id`, `name`, `age`, `email`, `mobile`, `birthday`, `qr_code`, `password`, `profile_picture`) and `users` (`id`, `username`, `permissions`, `youth_id`).
- Phase 0.20.1 implements `BASELINE_MEMBER` in `data/shared_core.js`:
  ```json
  {
    "id": "youth_demo_01",
    "name": "Alex Rivera",
    "username": "alex_r",
    "role": "MEMBER",
    "ageGroup": "YOUTH",
    "avatar": "seedling",
    "bio": "Young Pilgrim walking in faith and stewardship."
  }
  ```

#### FUTURE TARGET
- A single user token (JWT / Secure Session Cookie) will be recognized by both `fogportal.com` and `koinonia.fogportal.com`.
- Member profile edits (name, avatar, age group) made in either interface update the canonical `youth` record.

---

### 8. Shared Life Points Architecture

#### Non-Gambling & Christian Stewardship Principle
Life Points (LP) are **community participation incentives**, NOT gambling currency, NOT tradable tokens, and NOT a score of personal holiness. They cannot be wagered, bought with real money, or transferred between members.

#### Economy Rules
1. **Clean Baseline**: Level 2 Pilgrim, 135 LP, 15 XP (max 20 XP).
2. **Canonical Quest Reward (Steward of the Garden)**:
   - `+5 LP`
   - `+5 Character XP`
   - `+15 Stewardship XP`
   - `+5 Responsibility XP`
   - Starting from baseline 135 LP, completion results in **exactly 140 LP**.
3. **Daily Earning Caps**: Modest daily caps (e.g., maximum 25 LP per day across all activities) prevent unhealthy screen attachment.

---

### 9. Life Points Ledger & Idempotency

#### CURRENT IMPLEMENTATION
`LocalSharedCoreProvider.awardLifePoints()` enforces transaction uniqueness:
```javascript
awardLifePoints({ amount, charXp, reason, source, idempotencyKey, metadata })
```
- If `idempotencyKey` matches an existing transaction in `lifePoints.ledger`, the provider immediately returns `{ duplicate: true, awarded: 0, balance: currentBalance }`.
- No duplicate LP is awarded on retries, page refreshes, or network resends.

#### FUTURE TARGET
In PostgreSQL / SQLite backend:
```sql
CREATE TABLE point_transactions (
  id TEXT PRIMARY KEY,
  youth_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  char_xp INTEGER DEFAULT 0,
  reason TEXT NOT NULL,
  source TEXT NOT NULL, -- 'KOINONIA_QUEST', 'MAIN_APP', 'EVENT_CHECKIN', 'ARCADE'
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (youth_id) REFERENCES youth(id)
);
```
A database-level unique constraint on `idempotency_key` guarantees financial-grade integrity against race conditions.

---

### 10. Shared Quests Architecture

#### CURRENT IMPLEMENTATION
- Quests are defined with unique string IDs (`Q-001` through `Q-005`, `E-Q001` through `E-Q003`, `RW-001` through `RW-004`, and `MM-001` through `MM-004`).
- Completions are indexed by composite key `${questId}:${memberId}` in `questCompletions`.
- Retrying quest completion is 100% idempotent:
  ```javascript
  const res = provider.completeQuest({ questId: 'Q-001' });
  // res.alreadyCompleted === true; res.lpResult.awarded === 0; balance unchanged
  ```

#### FUTURE TARGET
- Quests catalog lives in shared storage. Both Main App and Koinonia can display active, available, and completed quests.
- When completed in Koinonia, the Main App's dashboard reflects the completed quest and updated LP immediately.

---

### 11. Shared Milestones & Growth Formation

#### Dynamic Milestones Catalog
- 19 canonical milestones cataloged across both apps:
  `m_welcome_pilgrim`, `m_first_step`, `m_all_places_visited`, `m_quest_first_complete`, `m_quest_three_complete`, `m_quest_all_complete`, `m_level_2_reached`, `m_level_3_reached`, `m_campaign_start`, `m_campaign_3_chapters`, `m_campaign_complete`, `m_first_event_attended`, `m_three_events_attended`, `m_circle_joined`, `m_circle_quest_complete`, `m_first_fitquest_virtual`, `m_first_fitquest_realworld`, `m_first_arcade_played`, `m_first_journey_reflection`.
- Dynamic denominator: Derived strictly from `MILESTONES.length` (never hardcoded as `/ 11` or `/ 15`).
- Milestones unlocked through verified activity events update both the Koinonia Journey and the Main App Discipleship Pathway.

---

### 12. Shared Events Architecture

#### Event Semantics
- Standard timeZone: `Asia/Manila` (UTC+08:00).
- Canonical events:
  1. `alpha_session_event`: Alpha Youth Series (Batch instances, 15:00 Asia/Manila, start times explicit).
  2. `youth_hangouts`: Monthly Youth Hangout (1st Saturday of month, 15:00 Asia/Manila).
  3. `get_into_the_glory`: Get Into the Glory (canonical abbreviation: `GiG`; NOT GIGO, G.I.G.O., or GIGO Night) (Special gathering, scheduleMode `CONFIG_REQUIRED`, no invented recurrence).
  4. `alpha_youth_day`: Alpha Youth Day (Holy Spirit retreat, 08:30 Asia/Manila).
  5. `demo_fellowship_night`: Demo Youth Fellowship Night (for testing).

---

### 13. Shared Attendance & Check-In Contract

#### CURRENT IMPLEMENTATION
- Check-in executed via `LocalSharedCoreProvider.checkIn({ eventInstanceId, memberId, source, verificationMethod, idempotencyKey })`.
- Checked-in state indexed by `${eventInstanceId}:${memberId}`.
- Re-checking in returns `{ success: true, alreadyCheckedIn: true, record }`. Exactly 1 attendance record is maintained.

#### FUTURE TARGET
- Database schema matches staging's existing `attendance` table:
  ```sql
  CREATE TABLE attendance (
    id TEXT PRIMARY KEY,
    youth_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    is_walkin INTEGER DEFAULT 0,
    source TEXT DEFAULT 'KOINONIA', -- 'KOINONIA', 'MAIN_APP', 'QR_SCAN', 'ADMIN'
    checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(youth_id, event_id)
  );
  ```
- If a youth checks in via Koinonia on their smartphone, the Main App's admin attendance counter increments in real time.

---

### 14. Shared Campfire & Small Groups Unification

#### Architectural Consolidation
In prior phases, "Quest Circles" risked becoming a parallel small-group system. Phase 0.20.1 unifies them:
- **Canonical Entity**: `Campfire` (representing the FOG small group / fire circle).
- **Gameplay Extension**: `CampfireGameState` (attaches quests, positive reactions, and activity log to that campfire).

```
┌────────────────────────────────────────────────────────┐
│                        CAMPFIRE                        │
│  id: "cf_alpha_seed"                                   │
│  communityId: "fog"                                    │
│  name: "St. Ignatius Youth Campfire"                   │
│  leaderIds: ["youth_leader_01"]                        │
│  memberIds: ["youth_leader_01", "youth_02", ... (5)]   │
│  maxParticipants: 12                                   │
│  status: "ACTIVE"                                      │
└───────────────────────────┬────────────────────────────┘
                            │ references campfireId
┌───────────────────────────▼────────────────────────────┐
│                   CAMPFIRE GAME STATE                  │
│  campfireId: "cf_alpha_seed"                           │
│  assignedQuestIds: ["Q-001", "Q-002"]                  │
│  completedQuestIds: []                                 │
│  reactions: { "👏": 3, "🙏": 5, "🔥": 8, ... }         │
│  activityLog: [...]                                    │
│  (NOTE: memberIds are NOT duplicated here)             │
└────────────────────────────────────────────────────────┘
```

#### Capacity Rules & Safety
1. **Minimum Activation Limit**: 5 participants required to transition from `DRAFT` to `ACTIVE`.
2. **Default Maximum Capacity**: 12 participants.
3. **Community Maximum**: Configurable by Administrator (default 12).
4. **Leader Configuration**: Leader may set capacity between 5 and the Community Maximum.
5. **Over-Community Protection**: Leader cannot set capacity greater than Community Maximum (e.g., trying 12 when Community Max is 10 is rejected).
6. **Active Lowering Protection**: Leader cannot reduce capacity below the current active member count (e.g., trying 4 when 5 members are in the campfire is rejected).
7. **Progress Denominator**: Derived strictly from `memberIds.length` (actual member count), never from maximum capacity.
8. **Minor Safety**: Predefined structured reactions only (`👏`, `🙏`, `🔥`, `🌱`, `❤️`). No free-text chat, no unmoderated DMs, no public member directory.

---

### 15. Shared Ministry Membership & Ministry Missions

#### CURRENT IMPLEMENTATION
- Demo ministries registered:
  - `ministry_seraphs`: Seraphs Music Ministry
  - `ministry_lighthouse`: Lighthouse Creative & Media
  - `ministry_genesis`: Genesis Events & Liturgy
  - `ministry_hospitality`: Food & Hospitality Ministry
- Koinonia discovers **Ministry Missions** through the member's canonical ministry membership:
  - Seraphs Member $
ightarrow$ `MM-001`: Sacred Harmonies Rehearsal (+5 LP, +5 Char XP)
  - Lighthouse Member $
ightarrow$ `MM-002`: Gospel Light Documentation (+5 LP, +5 Char XP)
  - Genesis Member $
ightarrow$ `MM-003`: Altar & Sanctuary Preparation (+5 LP, +5 Char XP)
  - Hospitality Member $
ightarrow$ `MM-004`: Agape Table Hospitality (+5 LP, +5 Char XP)

#### FUTURE TARGET
- Staging table `ministry_members` (`ministry_id`, `youth_id`, `role`, `assigned_at`) supplies authoritative membership to both applications.

---

### 16. Koinonia Journey vs Main App Growth Path

| Dimension | Koinonia My Journey | Main App Growth Path |
|---|---|---|
| **Purpose** | Narrative memory & pilgrimage scrapbooking | Structured Catholic formation & sacramental milestones |
| **Tone** | Warm, celebratory, personal, reflective | Clear, catechetical, directional, formative |
| **Key Views** | Timeline, Memories grid, Place History, Reflections | Pathway stages, Required steps, Resource links |
| **Data Source** | Consumes shared milestones, event attendances, quests | Consumes shared milestones, pathway definitions |
| **Storage** | Does not duplicate canonical completion records | Does not duplicate canonical completion records |

---

### 17. Faith Quest Challenge & FOG Games Architecture

- **Canonical Product Name**: **FAITH QUEST CHALLENGE** (short UI label: **FAITH QUEST**).
- **Spelling / Branding**: **F-A-I-T-H**. NEVER "Fit Quest" or "FitQuest".
- **Nature of Feature**: The established Bible / catechism / faith-oriented game from the Main FOG App (`/?faith=quest`). It tests scriptural knowledge, doctrine, catechism, and Christian values.
- **Unified Games Shell**:
  In Koinonia, **Faith Quest Challenge** and **FOG Arcade** are unified under the primary destination **FOG GAMES** (`#arcade-modal`, `#home-dest-games`, nav tab `Games`). A prominent segmented selector allows players to switch seamlessly:
  `[ 📖 FAITH QUEST ]   [ 🕹️ FOG ARCADE ]`
- **Faith Quest Integration Features**:
  1. **Main App Deep Link**: Direct launch button to `/?faith=quest` on the main portal.
  2. **Interactive Catechism Clash Practice**: Local quiz practice awarding +5 LP via `SharedCore` (idempotency protected).
  3. **6 Audited Daily Challenges**: Catechism Clash, The Narrow Gate, Daily Manna Scramble, Emoji Sermon, Shield of Faith, Fruits of the Spirit.
  4. **Daily Rules & Leaderboard Note**: 3 attempts per day, 100 max points, daily leaderboard reset at midnight Asia/Manila.

---

### 18. Sports Hub Architecture (Physical Fitness & Sports)

- **Canonical Product Name**: **SPORTS HUB** (compact navigation: `Sports`, 🏃).
- **Header**: `🏃 SPORTS HUB`
- **Subtitle**: `Sports, Fitness & Personal Bests • Active Challenges`
- **Separation from Faith Quest**:
  The physical sports/fitness feature is **completely separate** from the Bible/faith-oriented Faith Quest Challenge. All visible references to "Faith Quest" or legacy "Fit Quest" have been removed from the visible Sports Hub UI.
- **Activities Supported**:
  - **Real-World Sports**: Basketball (half-court/full-court), Running (outdoor/treadmill), Badminton (singles/doubles), Pickleball (rally/match play).
  - **Active Drills & Personal Bests**: Free Throw Focus, Sprint Intervals, Rally Drills, Elevation & Stamina tracking.
- **Biblical Anchor**:
  Honoring the body as a temple of the Holy Spirit (1 Corinthians 6:19). Physical fitness and active fellowship build healthy stewardship and discipline.
- **Legacy Technical Compatibility**:
  Internal technical identifiers (such as `#fitquest-modal`, `openSportsHubModal()`, `data/sports.js`) remain preserved to prevent breaking regressions with Phase 0.18-0.20 code, while all visible labels reflect canonical `SPORTS HUB`.

---

### 19. FOG Arcade Integration & Audited Findings

#### Read-Only Staging Audit Findings
- **Physical Location**: `/home/raspi4/fog-portal-staging/public/seeker-arcade.html`.
- **Biblical Physics Arcade Games** (5):
  1. `David's Slingshot` (`v8-slingshot.js`): Projectile tension and angle trajectory.
  2. `Noah's Ark Balance` (`v8-noahs-ark.js`): Mass distribution and wave oscillation.
  3. `Moses' Red Sea Crossing` (`v8-red-sea.js`): Timing run through seabed corridor.
  4. `Peter's Leap of Faith` (`v8-peters-leap.js`): Gaze tracking across stormy waves.
  5. `Jonah's Deep Dive` (`v8-jonahs-dive.js`): Buoyancy and submarine pressure.
- **Growth & Fellowship Games** (9 from `v9-growth-games.js`):
  Catechism Clash, Daily Manna, Emoji Sermon, The Narrow Gate, Shield of Faith, Who Am I?, Would You Rather, Verse Chain, Group Clash Live Trivia.
- **Points Architecture**: Staging awards points via `POST /api/arcade/submit` to `arcade_score_logs` and `gamification_points`.
- **Koinonia Integration Shell (Phase 0.20.1)**:
  - Accessible via `FOG ARCADE` primary destination card and modal `#arcade-modal`.
  - Displays all 14 audited titles with descriptions, scripture anchors, and staging source paths.
  - Interactive playable demo of David's Slingshot that awards +5 LP with idempotency verification.

---

### 19. Activity Event Vocabulary

Integration events provide loose coupling between experiences without duplicating records:

```typescript
type ActivityEventType =
  | 'QUEST_COMPLETED'           // payload: { questId, memberId, rewards }
  | 'EVENT_CHECKED_IN'          // payload: { eventInstanceId, memberId }
  | 'MINISTRY_SERVICE_COMPLETED'// payload: { ministryId, missionId, memberId }
  | 'FIT_QUEST_PB_SET'          // payload: { challengeId, score, memberId }
  | 'CAMPFIRE_QUEST_COMPLETED'  // payload: { campfireId, questId, memberId }
  | 'MILESTONE_UNLOCKED';       // payload: { milestoneId, memberId }
```

When an event fires, interested subsystems (Milestones evaluation, Journey memories, LP ledger) process it independently using the event's `idempotencyKey`.

---

### 20. Provider & API Boundary Contract

The TypeScript interface for the Shared Core Provider:

```typescript
interface ISharedCoreProvider {
  // Member
  getCurrentMember(): MemberProfile;

  // Life Points & Ledger
  getLifePoints(): LifePointsState;
  awardLifePoints(params: AwardLpParams): AwardLpResult;

  // Quests
  getQuests(): QuestDefinition[];
  getQuest(questId: string): QuestDefinition | null;
  getQuestCompletion(questId: string, memberId?: string): QuestCompletion | null;
  completeQuest(params: CompleteQuestParams): QuestCompletionResult;

  // Events & Attendance
  getEvents(): EventDefinition[];
  getEvent(eventId: string): EventDefinition | null;
  getAttendance(eventInstanceId: string, memberId?: string): AttendanceRecord | null;
  checkIn(params: CheckInParams): CheckInResult;

  // Campfires
  getMyCampfires(memberId?: string): Campfire[];
  getCampfire(campfireId: string): Campfire | null;
  getCampfireMembers(campfireId: string): string[];
  getCampfireGameState(campfireId: string): CampfireGameState | null;
  setCommunityMaxParticipants(adminMax: number): SettingsResult;
  setCampfireCapacity(campfireId: string, max: number, role: string): CapacityResult;
  addReactionToCampfire(campfireId: string, emoji: string): ReactionResult;

  // Ministries
  getMinistries(): MinistryDefinition[];
  getMyMinistries(memberId?: string): MinistryDefinition[];
  getMyMinistryMissions(memberId?: string): MinistryMission[];

  // Growth & Milestones
  getMilestones(): MilestoneDefinition[];
  getGrowthProgress(): GrowthProgressSummary;

  // Reset
  resetToBaseline(): ResetResult;
}
```

---

### 21. Offline & Sync Considerations

1. **Client Storage**: IndexedDB / LocalStorage with stable client UUIDs.
2. **Idempotency Keys**: Generated client-side as `${eventType}:${entityId}:${memberId}:${nonce}`.
3. **Server Authority**: Server is always authoritative for LP balance and milestone awards.
4. **Retry Queue**: Failed network requests are queued and retried with identical idempotency keys; server rejects duplicates safely.
5. **No Last-Write-Wins for LP**: LP balances are never overwritten by client state; balances are computed strictly by server replay of ledger delta transactions.

---

### 22. Six-Stage Migration Strategy

```
  ┌────────────────────────────────────────────────────────┐
  │ STAGE 1: LOCAL SHARED CORE PROVIDER (PHASE 0.20.1)      │
  │ • Implemented in prototype/koinonia-phase20_1          │
  │ • Isolated LocalSharedCoreProvider; zero staging edits │
  └───────────────────────────┬────────────────────────────┘
                              │
  ┌───────────────────────────▼────────────────────────────┐
  │ STAGE 2: COMPLETE MAIN APP STAGING AUDIT                │
  │ • Catalog all schema constraints and foreign keys      │
  │ • Document PM2 staging processes and service routes    │
  └───────────────────────────┬────────────────────────────┘
                              │
  ┌───────────────────────────▼────────────────────────────┐
  │ STAGE 3: DEFINE SHARED CORE API SERVICES                │
  │ • Design REST / WebSocket endpoints (/api/v1/shared/*) │
  │ • Implement shared auth token validation               │
  └───────────────────────────┬────────────────────────────┘
                              │
  ┌───────────────────────────▼────────────────────────────┐
  │ STAGE 4: CONNECT KOINONIA PROVIDER TO AUDITED BACKEND   │
  │ • Replace LocalProvider with HttpSharedCoreProvider    │
  │ • Test live synchronization with staging database      │
  └───────────────────────────┬────────────────────────────┘
                              │
  ┌───────────────────────────▼────────────────────────────┐
  │ STAGE 5: GAMEPLAY MIGRATION INTO KOINONIA               │
  │ • Move Arcade and Faith Quest primary UI into Koinonia  │
  │ • Main App links to Koinonia for interactive gameplay  │
  └───────────────────────────┬────────────────────────────┘
                              │
  ┌───────────────────────────▼────────────────────────────┐
  │ STAGE 6: UNIFIED ECOSYSTEM LAUNCH                       │
  │ • Single member account sign-in across both experiences│
  │ • Real-time shared attendance, LP, and discipleship    │
  └────────────────────────────────────────────────────────┘
```

*Note: Stages 2–6 are future roadmap targets. Only Stage 1 is implemented in Phase 0.20.1.*

---

#### 22.1 Phase 0.20.2 Specification & Implementation: Real-Time Shared Presence & Safe Social Interaction

> **IMPLEMENTATION STATUS (Phase 0.20.2)**:
> The real-time shared presence and safe social interaction engine is **FULLY IMPLEMENTED** in prototype space (`prototype/koinonia-phase20_2/`) running on port `18107` with WebSocket endpoint `ws://<host>:18107/realtime`.
> 
> - **In-Memory Transient State**: Coordinates, facing direction, room occupancy, and active bubbles reside strictly in server memory. **Zero database writes**.
> - **Strict Room Scoping**: Connections partitioned by `${communityId}:${placeId}:${instanceId}` (`home`, `fog_center`, `school`, `sports_hub`, `outreach_site`). Pilgrims in different rooms receive 0 packets from each other.
> - **Auto-Instancing**: Configured with target instance capacity of **30 members** and ceiling of **50 members** per room instance.
> - **Safe Structured Social Interaction**:
>   - Exactly 5 approved emotes: `👏` (Encourage), `🙏` (Praying), `🔥` (Keep Going), `🌱` (Growing Together), `❤️` (Great Job).
>   - Exactly 5 approved preset messages: `"Hi!"`, `"God bless!"`, `"Great job!"`, `"Let's go!"`, `"Praying for you."`.
>   - Zero free-text input, zero DMs, zero voice/video, zero media uploads.
>   - Zero LP / Zero XP economic farming guarantee (0 LP / 0 XP awarded).
>   - Rate limiting: Max 1 social action per second per connection.
> - **Client SDK**: `KoinoniaPresenceClient` (`data/presence_client.js`) with 10Hz movement throttling, monotonic sequence filtering, and 60fps linear interpolation (lerp).
> - **Raspberry Pi 4 Load Performance**: Benchmark verified 100% connection success across 25, 50, 100, 150 concurrent simulated clients with median broadcast latency of 1–2ms at 25–50 clients.

---

#### 22.2 Phase 0.21 Specification & Implementation: Koinonia Studio (Safe No-Code Content Creation)

> **IMPLEMENTATION STATUS (Phase 0.21)**:
> Koinonia Studio is **FULLY IMPLEMENTED** in prototype space (`prototype/koinonia-phase21/`) running on port `18108` with dedicated physical test harness at `http://192.168.2.163:18108/studio_test.html`.
>
> - **Product Purpose**: Safe, template-driven, no-code creation environment for authorized Fire of God Ministries leaders and administrators. Allows trusted leaders to create, preview, manage, and publish structured experiences (Quests, Events, Campaigns, Campfire Circles, Ministry Missions) without writing code.
> - **Strict Access Control**:
>   - Gated to `ADMIN` and `SUPERADMIN` roles only.
>   - Ordinary `MEMBER` users see ZERO Studio teasers, ZERO disabled buttons, and are runtime-rejected on any direct call.
> - **Predefined Safe Templates**:
>   1. `QUEST`: Stewardship & discipleship quests with bounded rewards (LP 0–50, Char XP 0–100, Skill XP 0–100).
>   2. `EVENT`: Services, youth nights, and rallies with canonical `Asia/Manila` local timezone and QR check-in toggle.
>   3. `CAMPAIGN`: Thematic spiritual journeys coordinating quests/events. Anti-exploit policy: zero direct LP on view/join.
>   4. `CAMPFIRE_ACTIVITY`: Circle discussions attached to canonical Campfires. Zero second group/roster systems.
>   5. `MINISTRY_MISSION`: Volunteer tasks with mandatory leader verification for service awards.
> - **Security Sanitization**: Strictly rejects `<script>`, `<iframe>`, arbitrary `<style>`, inline event handlers (`onclick=`, etc.), `javascript:` protocols, and `eval()`.
> - **Multi-Step Publishing Workflow**: `DRAFT` -> `READY_FOR_REVIEW` (Admin) -> `APPROVED` (Superadmin) -> `PUBLISHED` (Superadmin).
> - **Prototype-Local Isolation**: Publishing is strictly local to memory/storage. Zero writes to production/staging database or Main FOG App.
> - **Reflection Privacy**: Member reflection answers remain private by default; authors cannot inspect member responses.
> - **Safe Media Library**: Metadata references only (PNG, JPG, WEBP). Zero executable or binary storage in SQLite.
> - **Shared Core Boundary**: Studio is strictly an authoring layer. Never becomes a second source of truth for members, LP balances, attendance, or Campfires.

---

#### 22.3 Phase 0.22 Specification: Stage 2 Deep Read-Only Audit & Shared Core Integration Contract

> **IMPLEMENTATION STATUS (Phase 0.22)**:
> Stage 2 is **COMPLETE**. An exhaustive, fact-based read-only architectural audit of the active Main FOG App staging codebase (`/home/raspi4/fog-portal-staging`) and live SQLite database (`fog_community.db`) was executed.
>
> - **Factual Scope**: Audited all 53 database tables, their full DDLs, foreign key lists, unique indexes, and 192 Express API routes in `server.js`.
> - **Comprehensive Gap Matrix**: Mapped all 30 methods in `LocalSharedCoreProvider` against Main App reality:
>   - 9 methods (30.0%) **DIRECTLY MAPPABLE** (e.g. `getCurrentMember`, `getEvents`, `getMyCampfires`, `getMinistries`, `getMilestones`).
>   - 10 methods (33.3%) **MAPPABLE WITH ADAPTER** (e.g. `getLifePoints`, `getEvent`, `getCampfireMembers`, `getMyMinistryMissions`, `emitActivityEvent`).
>   - 6 methods (20.0%) **POLICY DECISION GOVERNED** (Campfire capacity, quest storage, minor chat safety, studio publishing).
>   - 2 methods (6.7%) **REQUIRES SCHEMA CHANGE** (canonical `quest_completions` contract).
>   - 2 methods (6.7%) **REQUIRES NEW BACKEND API** (authenticated idempotent points award, secured attendance check-in boundary).
>   - 1 method (3.3%) **PROTOTYPE ONLY** (`resetToBaseline`).
> - **Data Ownership Matrix Formalized**: Established the definitive System of Record (SoR) for Member Identity, Life Points, XP, Events, Attendance, Campfires, Ministries, Milestones, Quests, Artifacts, and Places, explicitly distinguishing current Main App write pathways from target secured Koinonia Shared Core endpoints.
> - **Integrity Insights Discovered**:
>   - `PRAGMA foreign_keys` is disabled at runtime in Main App connections, leading to 4 orphaned records in `attendance`. Safe joins (`LEFT JOIN` with fallbacks) required in Stage 3.
>   - 4 of 8 members in `gamification_points` show discrepancies with `point_transactions` due to legacy migration script semantics. Stage 3 will treat `point_transactions` as canonical ledger.
>   - Sports/Fit Quest is **100% absent** from Main App staging. The SPORTS HUB / Fit Quest system remains completely separate from FAITH QUEST CHALLENGE.
>   - Existing Bible/catechism game in Main App is canonically named **📖 FAITH QUEST CHALLENGE** (`fq_daily_scores`), cleanly segregated from generic Koinonia Studio template **📜 QUEST**.
> - **Architectural Security Contract**: Documented that future `/api/v1/shared/*` mutation endpoints must enforce authentication, role-aware target-member and target-resource authorization (preserving IDOR protection while supporting authorized staff/admin workflows), idempotency, server authority over LP/XP, bounded rewards, replay protection, and audit logging. Raw staging mutation routes (such as `POST /api/checkin` and `POST /api/games/universal-submit`) must NEVER be exposed as direct Koinonia client write paths.

---

### 23. Staging-Audit Safety Report (Phase 0.22 Verified)

- **Target Repository**: `/home/raspi4/fog-portal-staging`
- **Staging Working Tree**: **100% CLEAN (Zero files created, modified, or deleted)**.
- **SQLite Database**: `/home/raspi4/fog-portal-staging/fog_community.db`
  - **Baseline SHA256**: `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`
  - **Post-Audit SHA256**: `f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`
  - **Verification**: **MATCH CONFIRMED. ZERO BYTES ALTERED.**
- **Process Safety**: PM2 process `fog-staging` (id 4, port 3001) remained online and completely undisturbed throughout the audit.
- **Secrets & Credentials**: Zero credentials, tokens, or private keys accessed or stored.

---

### 24. Product Owner Architectural Directives (Stage 3 Integration Contract)

The Product Owner review of the Phase 0.22 read-only audit established the following binding architectural decisions governing Shared Core Stage 3:

#### Directive 1: Life Points & Virtue XP Architecture
- **Canonical Ledger**: `point_transactions` is confirmed as the eventual authoritative Life Points ledger.
- **Virtue XP Storage**: Koinonia's six detailed Virtue XP dimensions (**Stewardship, Responsibility, Discipline, Teamwork, Service, Reflection**) must NOT remain permanently client-only. They will eventually have canonical **server-side Shared Core storage**.
- **Compatibility Projection**: Main App may receive and project an aggregated `growth_xp` value for backward compatibility.
- **Stage 3 Scope**: Stage 3 will design the API and data contract for Virtue XP without migrating the staging database in Phase 0.22.

#### Directive 2: Campfire Capacity & Quest Circles
- **Canonical Group Hierarchy**: Campfire remains the canonical group system. Quest Circles are a gameplay layer attached directly to Campfire.
- **Capacity Rules & Enforcement**:
  - Minimum participants required to ACTIVATE: **5**.
  - Default maximum participants: **12**.
  - Community maximum: configurable by Admin, default **12**.
  - Leader may configure per-Campfire maximum between **5** and the Community Maximum.
  - Active Campfire cannot have capacity lowered below its current active member count.
  - No duplicate roster between Campfires and Quest Circles.
- **Rollout Strategy**: For the upcoming prototype and internet beta, application/API-level enforcement in the service layer is acceptable. Long-term, capacity will be persisted canonically server-side (e.g. `max_capacity`) via a later approved, non-destructive migration. Zero staging schema changes in Phase 0.22.

#### Directive 3: Youth Communication Safety Policy
- **Canonical Product Rule**: **NO UNRESTRICTED FREE-TEXT MESSAGING FOR MINORS**.
- **Default Interaction**: Koinonia strictly enforces structured reactions (👏, 🙏, 🔥, 🌱, ❤️) and approved/preset social interactions as the default for minor accounts.
- **Policy Attribution**: This is established as **Koinonia / Fire of God youth-safety policy** (and is not to be generalized as a universal Catholic standard without explicit policy citation).
- **Adult Communication**: Future architecture may allow separately gated adult/staff communication with appropriate moderation and authorization, but minor accounts must not receive unrestricted free-text messaging.
- **Phase 0.22 Boundary**: Zero chat implementation changes in Phase 0.22.

#### Directive 4: Canonical Quest Storage Architecture
- **Separation of Concepts**: `member_milestones` is **NOT** the permanent storage mechanism for Quest completions. Milestones and Quests are distinct canonical concepts.
- **Internet Beta Phase**: Static and prototype-local Quest definitions and completions are acceptable for the upcoming Koinonia internet beta.
- **Stage 3 Contract**: Stage 3 will design a proper canonical Quest content and completion contract conceptually supporting `quests` and `quest_completions`. Exact schema is not approved yet; zero tables created or migrated in Phase 0.22.

#### Directive 5: Mandatory Canonical Terminology
- **Main App Bible/Catechism Game**: **📖 FAITH QUEST CHALLENGE**. It uses trivia and game mechanics, but its official product name remains **FAITH QUEST CHALLENGE**. It must NOT be renamed to alternative trivia titles.
- **Generic Koinonia Studio Content Type**: **📜 QUEST**. It must NOT be renamed to alternative quest titles.
- **Sports & Fitness Separation**: The **SPORTS HUB / Fit Quest** system is completely separate from FAITH QUEST CHALLENGE.

#### Directive 6: Studio Publication Governance Contract
- **Governance Flow**: `ADMIN authors` → `Request Review` → `SUPERADMIN reviews & approves` → `Publish`.
- **Publication Destination**: After Superadmin approval, published Studio content must pass through a **validated Shared Core CONTENT REGISTRY / API**.
- **Prohibited Models**: Direct raw production-database writes are **prohibited** as the publication model. Direct Git or static-file commits to staging are **prohibited** as the publication model.
- **Interim State**: Phase 0.21 prototype-local publishing remains unchanged until the validated Content Registry API is implemented.

#### Directive 7: Shared Core API Security Architecture
Existing staging mutation routes (e.g. `/api/games/universal-submit`, `/api/checkin`) are callable without session authentication. Stage 3 **MUST NOT** simply expose or reuse these raw mutation endpoints as Koinonia's public Shared Core contract. Any consequential Koinonia mutation must go through authenticated `/api/v1/shared/*` services (including attendance check-in via `/api/v1/shared/attendance/check-in`, Life Points/progression, Campfire membership/settings, milestones/progression, Studio publication). Raw unauthenticated routes in Main App must NOT be used as direct Koinonia client write APIs (existing Main App business logic may later be called internally behind secure wrappers where applicable).

Future `/api/v1/shared/*` mutation endpoints must enforce:
1. **Authenticated Member/Session Identity**: Strict session validation. For production/shared authenticated member data, an invalid or missing authenticated session must NOT silently grant member privileges through a generic guest identity. Authenticated Shared Core operations must return/reject appropriately with HTTP 401 when no valid member session exists. (Guest/anonymous mode may exist only as an explicitly scoped read-only experience if later approved.)
2. **Server-Side Authorization**: Verification of caller roles and permissions.
3. **Target-Member / Target-Resource Authorization (Role-Aware IDOR Protection)**:
   - An authenticated ordinary MEMBER may mutate only their own authorized member state.
   - A mutation targeting another member or protected resource is permitted ONLY when the authenticated session possesses an explicit server-side role/permission authorizing that action.
   - The server must verify BOTH: (1) authenticated caller identity, and (2) authorization for the specific target member/resource and operation.
   - Never trust a client-supplied target `youth_id` merely because it was submitted. Preserve strict IDOR protection.
   - Unauthorized cross-member access must return an appropriate authorization error (HTTP 403 Forbidden).
   - Examples:
     - Normal member Quest completion: authenticated `youth_id` must equal target member ID.
     - Event check-in by member: authenticated `youth_id` must equal target member ID.
     - Event check-in by authorized check-in staff: target member may differ, but server must verify explicit check-in/admin permission.
     - Campfire settings: only authorized Campfire Leader/Admin/Superadmin.
     - Studio publication: only authorized SUPERADMIN after approved workflow.
4. **Mandatory Idempotency Keys**: Required unique tokens for progression and LP mutations.
5. **Server Authority Over Rewards**: Server calculates all awards; clients must NEVER declare arbitrary LP or XP amounts.
6. **Validation & Bounded Rewards**: All LP and XP rewards must be bounded by server-side canonical content/reward definitions. Exact reward ceilings are governed configuration and must never be supplied or controlled by the client.
7. **Replay & Double-Submit Protection**: Atomic or conditional writes preventing race conditions.
8. **Anti-CSRF Protection**: Defenses against cross-site request forgery if cookie authentication is utilized.
9. **Comprehensive Audit Logging**: Detailed logs in `activity_logs` for all consequential state changes.
