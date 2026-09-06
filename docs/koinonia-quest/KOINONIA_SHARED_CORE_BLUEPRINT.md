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

### 22.1 Approved Next Phase: Phase 0.20.2 — Real-Time Shared Presence & Safe Social Interaction

> **CRITICAL ROADMAP SEQUENCING**:
> The Product Owner has officially approved **Phase 0.20.2 — Real-Time Shared Presence & Safe Social Interaction** as the NEXT phase of development.
> This phase will occur **BEFORE** Koinonia Studio.
> 
> *IMPORTANT: Multiplayer networking is NOT implemented in Phase 0.20.1. It is documented here as the officially approved next phase specification.*

#### Phase 0.20.2 Scope & Requirements:
1. **Live Avatar Presence**: Players in the same Koinonia place can see each other's avatars on screen in real time.
2. **Movement & Facing Synchronization**: Smooth position updates (x, y coordinates), movement animation states (walking vs idle), and facing direction (down, left, right, up).
3. **Room/Place-Based Presence**: Automatic join/leave announcements and presence tracking partitioned by place (`home`, `fog_center`, `sanctuary`, `courtyard`, `sports_hub`).
4. **Campfire Presence**: Real-time member presence around the active Campfire fellowship circle.
5. **Event Presence**: Real-time co-presence during scheduled live gatherings and liturgical celebrations.
6. **Faith Quest Location Presence**: Visible co-presence of peers at Faith Quest athletic drill stations and courts at the Sports Hub.
7. **Safe Structured Emotes**: Predefined positive emotional gestures (🔥, 🙏, 👏, 🌱, ❤️, 💧, ⚽) displayed above avatars with rate limiting.
8. **Approved Preset Messages**: Canonical canned fellowship greetings and encouragement phrases (e.g., *"Peace be with you!"*, *"Good to see you!"*, *"Let's do this quest together!"*, *"Great effort!"*).
9. **Connection Lifecycle & Reliability**:
   - Automatic reconnection with exponential backoff on intermittent network drops.
   - Stale-session detection and cleanup (heartbeat ping/pong with timeout).
   - Duplicate connection handling (gracefully disconnect older socket if same account connects from a new tab/device).
10. **Strict Safety & Minor Protection Constraints**:
    - **NO unrestricted free-text chat** (prevents harassment, bullying, and predatory behavior).
    - **NO private / direct 1-on-1 messaging** between members.
    - **NO voice chat** and **NO video chat**.
    - All social interactions remain strictly structured, transparent, encouraging, and safe for minors and families.

---

### 23. Staging-Audit Safety Report

- **Staging Directory**: `/home/raspi4/fog-portal-staging`
- **Files Modified**: **ZERO (0)**
- **SQLite Database**: **TOUCHED: NO. ALTERED: NO. READ-ONLY INSPECTION ONLY.**
- **PM2 Process**: `fog-staging` running uninterrupted.
- **Secrets / Environment**: `.env` and VAPID keys preserved unread and uncommitted.

---

### 24. Unresolved Questions Discovered During Read-Only Audit

The following technical questions were identified during the audit and will be addressed in Stage 2/3 planning:
1. **XP Category Alignment**: Staging categorizes XP into `arcade_xp`, `growth_xp`, and `event_xp`. Koinonia structures character development into six Catholic virtues (Stewardship, Responsibility, Discipline, Teamwork, Service, Reflection). In Stage 3, should the shared database store virtue XP in a JSON column, or maintain separate tables?
2. **Small Groups Schema Migration**: Staging's `small_groups` table currently lacks a `max_participants` column. A non-destructive migration will be needed in Stage 3 to add `max_participants INTEGER DEFAULT 12`.
3. **Minor Chat Policy**: Staging has a `small_group_chats` table with free-text messaging. Koinonia Phase 0.20 strictly enforces predefined structured reactions (👏, 🙏, 🔥, 🌱, ❤️) for minor safety. The community leadership must decide whether to retain free-text chat with adult moderation or adopt structured reactions community-wide.
4. **Quests Table Introduction**: Staging currently has no `quests` table. A canonical `quests` and `quest_completions` schema will be introduced in Stage 3.
