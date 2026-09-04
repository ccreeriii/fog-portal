# Koinonia Quest — Phased Development Roadmap

**Document Version:** 1.0.0  
**Date:** September 4, 2026  
**Repository Branch:** `feature/koinonia-quest`  
**Execution Context:** Isolated Git Worktree (`/home/raspi4/koinonia-quest`)  
**Launch Integrity Policy:** Work on Phases 1 through 5 is strictly deferred until AFTER next week's Koinonia production launch is completed and stable.

---

## Strategic Overview & Deployment Gates

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PRE-LAUNCH PERIOD                             │
│                         (Current Week — Gate 0)                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 [ PHASE 0: Safe Architecture Audit ]
                 - Read-only inspection
                 - Zero code edits, zero migrations, zero packages
                                     │
                                     ▼
═══════════════════════════════════════════════════════════════════════════
                 PRODUCTION LAUNCH & STABILIZATION GATE
     - Official Koinonia production launch executed
     - 48-to-72 hour post-launch burn-in period verified
     - Core systems stable (Auth, Check-In, Attendance, Life Points)
═══════════════════════════════════════════════════════════════════════════
                                     │
┌────────────────────────────────────┴────────────────────────────────────┐
│                           POST-LAUNCH PHASES                            │
│                        (Safe Progressive Rollout)                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 [ PHASE 1: Isolated Vertical Slice ]
                 - Feature-flagged prototype behind KOINONIA_QUEST_ENABLED=false
                 - First playable loop: Avatar -> Home -> Quest -> XP
                                     │
                 [ PHASE 2: Koinonia Core Integration ]
                 - Read-only Attendance, Fit Quest, & Daily Habit verification
                 - Web push notifications & in-app inbox
                                     │
                 [ PHASE 3: Community Systems ]
                 - Multi-user Community Projects (e.g., Garden Restoration)
                 - Leader & Family verification queues
                                     │
                 [ PHASE 4: AYS Adventure ]
                 - Alpha Youth Series narrative story integration
                 - Chapter progression linked to real-world sessions
                                     │
                 [ PHASE 5: Living Community & Multiplayer ]
                 - Multiplayer hub, real-time presence & fellowship
```

---

## Phase 0: Safe Architecture & Safety Audit
**Timeline:** Current Pre-Launch Week  
**Status:** COMPLETE (Active Phase)  
**Launch Safety Constraint:** 100% Read-Only. No application files modified, no packages installed, no databases altered.

### Deliverables
- [x] Comprehensive application architecture audit: `KOINONIA_QUEST_ARCHITECTURE_AUDIT.md`
- [x] Phased implementation roadmap: `KOINONIA_QUEST_ROADMAP.md`
- [x] Identification of core hooks: `koinonia_session`, `awardPoints()`, `attendance`, `fq_daily_scores`
- [x] Engine suitability assessment (rejection of monolithic RPGJS in favor of buildless 2D canvas)
- [x] Feature flag and zero-downtime rollback specifications

---

## Phase 1: Isolated Vertical Slice
**Timeline:** Post-Launch (Week 1–2 After Stable Launch)  
**Prerequisite:** Production launch completed; 72-hour zero-incident milestone passed.  
**Launch Safety Constraint:** Strict feature flag `KOINONIA_QUEST_ENABLED=false` by default. Work confined to `routes/quest.js` and `public/quest/`.

### Objectives
Build the complete first playable loop end-to-end in isolation, validating identity inheritance, the 10-skill progression model, and Life Points synchronization without touching core Koinonia UI.

### User Journey (Vertical Slice)
```
Existing Koinonia Member Session
              │
              ▼
    Enter Koinonia Quest (/quest)
              │
              ▼
   Avatar Customization Screen
              │
              ▼
    Interactive Home Map (2D Canvas)
              │
              ▼
         Quest Board
              │
              ▼
Accept Real-World Task: "Steward of the Garden"
    (Real-World Action: Water household plants)
              │
              ▼
    Complete Task & Self/Family Confirm
              │
              ▼
   Idempotent Reward Issuance
   ├── +10 Global Life Points (via awardPoints)
   ├── +5 Quest Character XP
   ├── +15 Stewardship XP
   └── +5 Responsibility XP
              │
              ▼
Dynamic Virtual World Feedback:
Community Garden visual state upgrades (First seedling blooms)
```

### Technical Deliverables
1. **Modular Backend Router:** `/routes/quest.js` mounted conditionally on Express via `KOINONIA_QUEST_ENABLED=true`.
2. **Dedicated Additive Database Tables:**
   - `quest_players` (linked to `youth_id`)
   - `quest_skill_xp` (tracking the 10 Christian formation skills)
   - `quest_definitions`
   - `quest_player_progress`
   - `quest_community_projects`
3. **Isolated Client View:** `/public/quest/index.html` featuring a lightweight 2D HTML5 Canvas tilemap renderer.
4. **First Quest Definition:** `Q-001: Steward of the Garden` (+10 Life Points, +5 Character XP, +15 Stewardship XP, +5 Responsibility XP).
5. **Rollback & Verification Test:** Staging verification confirming that setting `KOINONIA_QUEST_ENABLED=false` renders the entire module inert with zero impact on the portal.

---

## Phase 2: Koinonia Integration
**Timeline:** Post-Launch (Week 3–4 After Stable Launch)  
**Prerequisite:** Phase 1 verified on staging.  
**Launch Safety Constraint:** Zero invasive alterations to core handlers. All verification must use read-only polling or safe event hooks.

### Objectives
Connect Koinonia Quest to the broader Koinonia ecosystem so that daily Christian habits, Sunday event attendance, and Fit Quest arcade challenges contribute directly to character growth.

### Integration Streams
1. **Event Attendance Linking (Mode: EVENT):**
   - Read-only evaluation against the `attendance` table.
   - Example Quest: *"Fellowship Gathering — Attend Sunday Youth Service"* (+20 Life Points, +15 Teamwork XP, +10 Service XP).
   - Zero modification to `/api/checkin`.
2. **Fit Quest / Faith Quest Linking (Mode: SYSTEM):**
   - Read-only evaluation against `arcade_score_logs` and `brain_user_logs`.
   - Example Quest: *"Shield of Faith — Score 5+ in Reflex Tap or Moses' Red Sea Dash"* (+10 Life Points, +15 Discipline XP).
3. **Daily Spiritual Habits Linking (Mode: SYSTEM):**
   - Read-only evaluation against `private_journals` and `point_transactions` (Daily Prayer Covenant).
   - Example Quest: *"Daily Devotion — Submit a private journal entry"* (+10 Life Points, +15 Wisdom XP).
4. **Push & In-App Alerts:**
   - Integration with `sendCustomPush()` and `personal_inbox` for quest rewards, weekly reset notifications, and new quest board announcements.

---

## Phase 3: Community Systems
**Timeline:** Post-Launch (Month 2)  
**Prerequisite:** Phase 2 stable in production.

### Objectives
Foster collective responsibility, youth teamwork, and pastoral mentorship through shared virtual community projects and multi-party quest verification.

### Core Features
1. **Shared Community Projects:**
   - Virtual community assets whose visual state depends on pooled contributions from all youth.
   - **Project 1: The Community Garden**
     - Target: 500 Stewardship XP, 300 Teamwork XP, 300 Service XP.
     - As youth complete real-world gardening, church cleanup, and recycling tasks, the virtual garden progresses from barren soil to lush botanical beds with interactive elements.
   - **Project 2: The Campfire Gathering Pavilion**
     - Target: 400 Teamwork XP, 400 Communication XP, 200 Leadership XP.
2. **Multi-Mode Verification Workflows:**
   - **FAMILY Mode:** Parent/guardian confirmation via family code or verification link for domestic responsibilities (e.g., chores, family prayer, homework discipline).
   - **LEADER Mode:** Ministry leader dashboard tab where leaders review and approve service activities (e.g., church setup, outreach assistance).
3. **Team & Small Group Quests:**
   - Cell group collaborative goals linking `small_groups` to shared virtual guild banners.

---

## Phase 4: AYS Adventure (Alpha Youth Series Campaign)
**Timeline:** Post-Launch (Month 3)  
**Prerequisite:** Phase 3 operational.

### Objectives
Turn the Alpha Youth Series (AYS) curriculum into an immersive, serialized story campaign in Koinonia Quest. Real-world attendance and engagement in AYS sessions unlock corresponding virtual narrative chapters, dialogue trees, and biblical exploration quests.

### Campaign Structure
| AYS Chapter / Topic | Real-World Trigger | Quest Adventure Layer | Unlocked Reward & Skills |
| :--- | :--- | :--- | :--- |
| **Ep 1: Life — Is This It?** | Attend AYS Launch Session | *"The Seeker's Trail"* — Explore the Crossroads Map; talk to village seekers. | +Wisdom XP, Pilgrim's Staff cosmetic |
| **Ep 2: Jesus — Who Is He?** | AYS Session 2 Attendance | *"The Ancient Scrolls"* — Biblical historical evidence mini-investigation. | +Wisdom XP, Scripture Codex item |
| **Ep 3: Cross — Why Did Jesus Die?** | AYS Session 3 Attendance | *"The Bridge of Grace"* — Symbolic traversal of the chasm map. | +Compassion XP, Grace Emblem |
| **Ep 4: Faith — How Can I Have Faith?** | AYS Small Group Discussion | *"Stepping into the Mist"* — Faith walk puzzle challenge. | +Discipline XP, Shield of Faith skin |
| **Ep 5: Prayer — Why and How Do I Pray?** | Prayer Habit Completion | *"The Quiet Sanctuary"* — Restoring the virtual prayer garden. | +Wisdom XP, Prayer Lantern |
| **Ep 6: Bible — Why and How Do I Read It?** | Scripture Scramble Streak | *"The Living Word"* — Solve the illuminated manuscript puzzle. | +Wisdom XP, Scribe's Cloak |
| **Ep 7: Spirit — Who Is the Holy Spirit?** | AYS Weekend / Retreat Check-in | *"The Guiding Wind"* — Wilderness orientation journey. | +Leadership XP, Pentecost Flame aura |
| **Ep 8: Evil & Healing** | Leader-Verified Service Quest | *"Bearing Another's Burden"* — Community relief mission. | +Compassion XP, +Service XP |
| **Ep 9: Sharing — Tell Others?** | Bring a Friend Check-in | *"The Light on the Hill"* — Light beacons across the community map. | +Communication XP, Beacon Banner |

---

## Phase 5: Living Community & Multiplayer
**Timeline:** Post-Launch (Long-Term Evolution)  
**Prerequisite:** Phases 1–4 stable; evaluation of server performance under production load.

### Objectives
Introduce real-time presence and synchronous multiplayer fellowship in the virtual world without endangering core Koinonia operations.

### Technical Architecture for Multiplayer
1. **Architecture Evolution (Shift to Option C):**
   - Extract real-time multiplayer networking into a dedicated, isolated microservice (`quest-engine-service`) running on a dedicated internal port (e.g., 3005) or container.
   - Core Koinonia Express server remains 100% decoupled; reverse proxy (Nginx) routes `/quest/socket.io` to the game service.
   - Guarantees that any spike in multiplayer game ticks, collision physics, or WebSocket traffic cannot exhaust Node.js event-loop cycles on the core portal.
2. **Multiplayer Features:**
   - **Real-Time World Hub:** Youth avatars can walk, emote, and gather in the virtual church quad, community garden, and hangout terrace.
   - **Campfire Fellowship:** Synchronous virtual hangouts with ambient worship music streams (reusing Koinonia's `songs` library).
   - **Live Collaborative Projects:** Youth working together in real time on virtual building projects.

---

## Work Authorization Schedule Relative to Launch

| Task / Work Item | Permitted Before Launch? | Required Post-Launch Timing |
| :--- | :---: | :--- |
| Phase 0: Safe Architecture Audit | **YES (Complete)** | Active Now |
| Editing `server.js` or `app.js` | **STRICTLY PROHIBITED** | Wait for Post-Launch Phase 1 |
| Installing RPGJS or Game Packages | **STRICTLY PROHIBITED** | Wait for Post-Launch Evaluation |
| Running `CREATE TABLE` / Migrations | **STRICTLY PROHIBITED** | Wait for Post-Launch Phase 1 |
| Modifying Authentication or OAuth | **STRICTLY PROHIBITED** | Strictly Prohibited Indefinitely |
| Modifying Life Points / `awardPoints` | **STRICTLY PROHIBITED** | Strictly Prohibited Indefinitely |
| Creating `/routes/quest.js` | **NO** | Post-Launch Phase 1 |
| Creating `/public/quest/` Client | **NO** | Post-Launch Phase 1 |
| Deploying Feature Flag to Staging | **NO** | Post-Launch Phase 1 |
| Community Projects & Leader Queue | **NO** | Post-Launch Phase 3 |
| Alpha Youth Series Campaign | **NO** | Post-Launch Phase 4 |
| Real-Time Multiplayer WebSockets | **NO** | Post-Launch Phase 5 |
