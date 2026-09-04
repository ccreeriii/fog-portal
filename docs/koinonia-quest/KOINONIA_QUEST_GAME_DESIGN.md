# Koinonia Quest — Game Design Document (GDD)

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.5 (Game Design & Technical Specification)  
**Status:** DRAFT SPECIFICATION ONLY — ZERO RUNTIME CODE MODIFICATIONS  
**Target Environment:** Koinonia v3 Community Portal (Raspberry Pi 4 / Node.js Express / SQLite WAL)  
**Expected Git Branch:** `feature/koinonia-quest`  

---

## 1. Executive Summary & Vision

### 1.1 Product Identity
- **Product Name:** KOINONIA QUEST
- **Tagline:** *"A virtual world that grows when you grow in real life."*
- **Target Audience:** Youth, young adults, and leaders aged approximately 11–21 within the Fellowship of God (FOG) / Koinonia community.
- **Platform:** Mobile-first web application running seamlessly inside the Koinonia PWA, rendered with a lightweight 2D canvas engine.

### 1.2 The Central Principle
> **REAL-WORLD GROWTH SHOULD PRODUCE VIRTUAL-WORLD GROWTH.**

Koinonia Quest is intentionally designed as an **anti-escapist life-simulation RPG**. While traditional video games create compelling digital loops that pull players deeper into virtual isolation, Koinonia Quest uses game mechanics to achieve the opposite: **to inspire, recognize, and celebrate concrete actions of love, responsibility, service, and spiritual maturity in the real world.**

The fundamental axiom of the game is:
> **The real character being developed is the person behind the avatar.**

The avatar is not an escape from reality; it is an encouraging virtual reflection of real-world stewardship, family participation, teamwork, discipline, and Christian formation.

### 1.3 Core Values & Behavioral Pillars
The game systems and narratives are structured around 13 real-world pillars:
1. **Responsibility:** Caring for one's own space, commitments, and habits.
2. **Family Participation:** Honoring parents, encouraging siblings, and contributing to household duties.
3. **Teamwork:** Learning to cooperate with diverse personalities in small groups.
4. **Friendship:** Welcoming newcomers, listening attentively, and resolving misunderstandings.
5. **Community:** Investing in the church family, school environment, and neighborhood.
6. **Service:** Willingly doing humble, often unnoticed tasks for others without complaint.
7. **Stewardship:** Caring for God's creation, resources, plants, tools, and shared spaces.
8. **Discipline:** Cultivating healthy daily habits in body, mind, and screen usage.
9. **Communication:** Expressing thoughts with kindness, truthfulness, and clarity.
10. **Creativity:** Offering musical, visual, technical, and storytelling gifts to the community.
11. **Leadership:** Serving as an apprentice or servant leader who lifts others up.
12. **Reflection:** Taking time in stillness to evaluate one's heart, mistakes, and gratitude.
13. **Christian Formation:** Rooting daily life in prayer, scripture, fellowship, and love.

---

## 2. Core Experience Loop

### 2.1 The Virtuous Cycle
Every interaction in Koinonia Quest follows a closed, virtuous feedback loop:

```
                  ┌──────────────────────────────┐
                  │        VIRTUAL NEED          │
                  │  (Garden wilts, NPC seeks   │
                  │    help, Hall needs setup)   │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │            QUEST             │
                  │ (Accepted at Board or NPC;   │
                  │   explains moral purpose)    │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │      REAL-WORLD ACTION       │
                  │  (Player puts down device;   │
                  │  waters plants, washes dishes│
                  │      or helps a neighbor)    │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │         VERIFICATION         │
                  │   (Trust, Family, Leader,    │
                  │      Event, or System)       │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │            REWARD            │
                  │ (Character XP, Skill XP,     │
                  │  Life Points, Furniture/Skin)│
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │       CHARACTER GROWTH       │
                  │  (Level-up, Skill unlocks,   │
                  │     new player titles)       │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │       COMMUNITY GROWTH       │
                  │ (Pooled XP added to shared   │
                  │     Community Project)       │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │         WORLD CHANGE         │
                  │  (Virtual Garden blooms,     │
                  │  Youth Hall gains lights)    │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │          REFLECTION          │
                  │ (Short prompt: "How did it   │
                  │ feel to help without asking?")│
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │      NEXT STORY / QUEST      │
                  │ (NPC acknowledges growth,    │
                  │   unlocks next narrative)    │
                  └──────────────────────────────┘
```

### 2.2 Intentional Friction & Anti-Screen-Time Design
Most mobile games maximize "Time on App" (DAU/MAU retention, infinite scroll, predatory loot boxes). **Koinonia Quest embraces intentional exit ramps:**
1. **Action Prompts:** Quest acceptance screens explicitly command: *"Step away from the screen! Go complete this action, then come back to log your reflection."*
2. **Daily Pacing:** Quests have natural daily or weekly cooldowns. Once daily quests are logged, NPCs kindly tell the player: *"You have stewarded today well. Go spend time with family, enjoy God's world, or rest."*
3. **No Endless Grinding:** Quests cannot be repeated through mindless clicking. Virtual progress strictly requires real-world physical and relational effort.
4. **No Gacha / Pay-to-Win:** Cosmetics and titles are unlocked solely through faithful service, creative contribution, and community milestones.

---

## 3. Player Identity & Profile Hierarchy

### 3.1 Unified Authentication
Koinonia Quest is a direct module of Koinonia. It **strictly reuses the existing authenticated session** (`koinonia_session` cookie).
- **No separate username or password.**
- **No independent registration flow.**
- Authenticated state resolves directly to `req.auth.youthId` and `req.auth.member`.

### 3.2 Conceptual Profile Hierarchy

```
[ Koinonia User Account ] (users table: Google OAuth / Username)
          │
          ▼
[ Canonical Member Profile ] (youth table: Name, Age, Family, QR Pass)
          │
          ▼
[ Quest Player Profile ] (quest_players table: Level, Title, Settings)
          │
          ├────────► [ Avatar Configuration ] (Body, Hair, Outfits, Colors)
          │
          ├────────► [ Character XP & Level ] (Primary RPG progression)
          │
          ├────────► [ 10 Formation Skills ] (Radar matrix: 0–100 XP per skill)
          │
          ├────────► [ Quest Progress ] (Active, Pending, Completed Quests)
          │
          ├────────► [ Achievements & Badges ] (20+ non-competitive badges)
          │
          ├────────► [ Community Project Ledger ] (Shared contributions)
          │
          └────────► [ Story & AYS Progress ] (Narrative chapter unlocks)
```

### 3.3 Youth & Minor Privacy Guardrails
1. **Public Anonymity:** In the virtual world and on community boards, players are represented exclusively by their **Avatar and First Name (or chosen nickname)**.
2. **Data Shielding:** Never display email addresses, parent phone numbers, school details, or full home addresses inside any Quest screen or API payload.
3. **Safe Reflections:** Reflection journal entries are **private by default**, visible only to the player. (See Section 14 for Safeguarding and Privacy specifications).

---

## 4. Progression System: The Four Pillars

The game integrates four distinct, harmonious progression systems:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PROGRESSION SYSTEMS                             │
├──────────────────┬──────────────────┬──────────────────┬───────────────┤
│   LIFE POINTS    │   CHARACTER XP   │     SKILL XP     │   COMMUNITY   │
│  (Koinonia-Wide) │  (RPG Identity)  │  (Formation)     │ (Cooperative) │
│  Calibrated Bands│  Level 1 to 50   │  10 Life Skills  │ Shared Build  │
└──────────────────┴──────────────────┴──────────────────┴───────────────┘
```

### 4.1 Pillar 1: Life Points (Global Currency & Calibrated Economy)
- **Authority:** Life Points remain controlled exclusively by Koinonia core (`awardPoints()`). Quest awards Life Points strictly through this existing service.
- **Economic Calibration (Product Owner Approved):**
  Character XP and Skill XP carry the primary weight of game progression rather than inflating global Koinonia Life Points. Life Point rewards are strictly calibrated into four standardized tiers:

| Quest Tier | Calibrated Life Points | Example Tasks |
| :--- | :---: | :--- |
| **Simple Everyday Task** | **+3 to +5 LP** | Watering plants (`Q-001`), bedroom tidying (`Q-003`), 15-min stretch (`Q-022`) |
| **Moderate Real-World Quest** | **+5 to +10 LP** | Family meal help (`Q-002`), dishwashing (`Q-004`), 30-min exercise (`Q-020`) |
| **Community / Service Quest** | **+10 to +15 LP** | Welcoming a newcomer (`Q-011`), neighborhood cleanup (`Q-012`), hospital pack (`Q-013`) |
| **Major Team / Event Quest** | **+15 to +25 LP** | Sunday chair brigade (`Q-017`), tech setup (`Q-019`), leading station (`Q-027`) |
| **Exceptional Milestones** | **Achievement Bonus** | Unlocking major milestones (`ACH-12`, `ACH-20`: +25 to +50 LP) |

- **Quest #001 Baseline:** Quest #001 (*"Steward of the Garden"*) awards **+5 Life Points** (down from the initial draft of +10), alongside **+5 Character XP**, **+15 Stewardship XP**, and **+5 Responsibility XP**.

### 4.2 Pillar 2: Character XP & Player Level
- **Definition:** Character XP measures the player's overall RPG progression within the virtual world.
- **Level Curve:** Standard gentle exponential curve:
  $$\text{XP Required for Level } L = 50 \times L^{1.5}$$
  - Level 1: 0 XP (Novice Pilgrim)
  - Level 2: 70 XP (Curious Seeker)
  - Level 3: 260 XP (Faithful Helper)
  - Level 5: 560 XP (Community Builder)
  - Level 10: 1,580 XP (Cornerstone Steward)
- **Unlocks:** Reaching higher Character Levels unlocks new rooms in the virtual Home, new areas in the FOG Center, new avatar cosmetics, and more challenging quests.

### 4.3 Pillar 3: Skill XP (The 10 Formation Skills)
The 10 skills represent practical, holistic Christian virtues and life skills:

| Skill | Real-World Meaning | Typical Quests |
| :--- | :--- | :--- |
| **Compassion** | Caring for the hurting, sick, lonely, or struggling | Visiting an elderly neighbor, comforting a sad friend, writing encouragement cards |
| **Teamwork** | Cooperating selflessly, sharing tasks, resolving discord | Participating in group tasks, setting up events with peers, playing sports gracefully |
| **Stewardship** | Caring for God's creation, resources, spaces, and tools | Watering home plants, recycling, picking up litter, caring for musical equipment |
| **Wisdom** | Cultivating discernment, learning from truth and elders | Daily quiet time, interviewing parents/elders, meditating on scripture |
| **Responsibility** | Fulfilling commitments reliably without constant reminders | Making one's bed, finishing homework on time, returning borrowed items |
| **Communication** | Speaking truthfully, listening deeply, expressing gratitude | Saying a heartfelt thank you, speaking up respectfully, active listening |
| **Creativity** | Using imagination and artistic gifts to bless others | Drawing, worship music practice, designing slides, building crafts for children |
| **Discipline** | Managing desires, time, physical health, and screen habits | 30 minutes physical exercise, device-free family hour, consistent sleep habits |
| **Service** | Doing humble, unglamorous tasks behind the scenes | Washing dinner dishes, cleaning church bathrooms, stacking chairs after service |
| **Leadership** | Serving others first, delegating kindly, setting an example | Leading a small team chore, mentoring a younger youth, coordinating an outreach |

> ### CRITICAL THEOLOGICAL GUARDRAIL
> **STRICTLY PROHIBITED:**
> - NO "Holiness Level"
> - NO "Faith Ranking"
> - NO "Spiritual Leaderboard"
> - NO "Righteousness Points"
> 
> **Rationale:** Software can track whether someone watered a plant, washed the dishes, or attended a youth gathering. **Software must never pretend to quantify, grade, or measure a human soul's relationship with the Living God.** All skills measure observable acts of stewardship, character, and service.

### 4.4 Pillar 4: Community Contributions (Cooperative Progress)
- Rather than competing on individual leaderboards, player actions contribute to **shared community meters**.
- Example: **Project #001 — Restore the Community Garden**:
  - Target: 500 Stewardship XP, 300 Teamwork XP, 300 Service XP.
  - When Player A completes a home gardening quest (+15 Stewardship), that +15 is added to their personal profile AND also deposited into the FOG Community Center garden pool.
  - **Shared Joy:** Once the collective pool reaches 100%, the virtual Community Garden permanently transforms from an overgrown lot into a thriving, flowering community park for **all** players.
  - Slogan: *"We built this together."*

---

## 5. World Design

### 5.1 Overview & Spatial Philosophy
The virtual world is rendered in a clean, responsive 2D top-down / 3/4 perspective tilemap. The world starts deliberately small, intimate, and manageable for low-end mobile devices and Raspberry Pi 4 bandwidth.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1 VIRTUAL WORLD                           │
├───────────────────────────────────┬────────────────────────────────────┤
│         AREA 1: MY HOME           │     AREA 2: FOG COMMUNITY CENTER   │
│ ┌───────────────┬───────────────┐ │ ┌────────────────┬───────────────┐ │
│ │  1. Bedroom   │  2. Living    │ │ │  1. Entrance   │ 2. Youth Hall │ │
│ │ (Discipline)  │ (Connection)  │ │ │    (Lobby)     │  (Fellowship) │ │
│ ├───────────────┼───────────────┤ │ ├────────────────┼───────────────┤ │
│ │  3. Kitchen   │  4. Garden    │ │ │ 3. Quest Board │ 4. Comm Garden│ │
│ │  (Service)    │ (Stewardship) │ │ │  (Assignments) │ (Shared Build)│ │
│ └───────────────┴───────────────┘ │ └────────────────┴───────────────┘ │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 5.2 Area 1: My Home (Personal Responsibility Space)
Every player begins in their own virtual home. Each room corresponds to a domestic virtue:
1. **The Bedroom (Discipline & Personal Order):**
   - Interactive objects: The Unmade Bed (prompts room tidying quest), Study Desk (homework and reading discipline), Wardrobe (avatar dressing room), Journal Table (daily reflection).
   - Visual State: Untidy at first; becomes clean and cozy as domestic quests are completed.
2. **The Living Area (Family Connection):**
   - Interactive objects: Dining Table (family meal and device-free quest triggers), Family Bookshelf, Notice Board (family chore log).
3. **The Kitchen (Service & Hospitality):**
   - Interactive objects: Sink (dishwashing quest trigger), Pantry/Stove (meal assistance and grocery unloading quests).
4. **The Home Garden (Stewardship & Care):**
   - Interactive objects: Seedling Pots, Watering Can, Compost Bin.
   - Home of Quest #001: *"Steward of the Garden"*.

### 5.3 Area 2: FOG Community Center (Shared Fellowship Space)
The community hub reflects the actual life of the Fellowship of God youth ministry:
1. **The Entrance / Welcoming Foyer:**
   - Where Ate Joy (Community Coordinator) greets returning players and introduces newcomers.
2. **The Youth Hall & Fellowship Quad:**
   - Central meeting ground with couches, banner displays, and fellowship tables. Connects to the small group circles.
3. **The Main Quest Board:**
   - Large wooden notice board listing community, church service, and weekly team quests.
4. **The Community Garden Plot:**
   - A communal outdoor plot next to the hall. Evolves across 6 visual stages as youth contribute real-world service and stewardship XP.
5. **The Reflection Arbor / Quiet Corner:**
   - A peaceful wooden pavilion surrounded by flowering vines where players can sit their avatars and open the Reflection Journal or Prayer Pals.

### 5.4 Area 3: Future World Expansions (Deferred to Phase 3+)
The world is designed to expand organically as the youth ministry grows:
- **The Neighborhood & Town Square:** Outreach missions, elder visits, and neighborhood cleanup.
- **The Riverside Park:** Outdoor sports, wellness, and fitness quests.
- **The Schoolhouse / Campus Quad:** Peer encouragement, academic integrity, and campus Bible study.
- **The Worship & Creative Studio:** Music rehearsal, lighting booth, and media design.
- **The AYS Pavilion:** Dedicated narrative area for the Alpha Youth Series story chapters.
- **The Mission Frontier:** Regional mission and community aid outposts.

---

## 6. NPC System (Non-Player Characters)

To make Koinonia Quest feel like a living community rather than a clinical todo-list application, the world is inhabited by original recurring NPCs. Each NPC has a distinctive personality, role, strengths, growth areas, and relationships.

```
                         [ Uncle Barnaby ]
                          (Elder / Mentor)
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
            [ Ate Joy ]                     [ Kuya David ]
       (Community Coordinator)            (Family Big Brother)
                 │                               │
       ┌─────────┴─────────┐           ┌─────────┴─────────┐
       ▼                   ▼           ▼                   ▼
    [ Leo ]             [ Chloe ]   [ Marcus ]          [ Maya ]
(Shy Newcomer)     (High Achiever) (Aspiring Leader)  (Creative Artist)
                                       │
                                       ▼
                                    [ Sam ]
                                 (Tech Helper)
```

### 6.1 Character Dossiers
1. **Uncle Barnaby (Wise Elder & Community Mentor):** Patience, biblical wisdom, master gardener. Introduced Quest #001.
2. **Ate Joy (Community Coordinator & Welcomer):** Energetic, organized, notices anyone standing alone by the door.
3. **Leo (Shy Newcomer):** 13-year-old middle schooler, deep empathy, artistic, learning to find his voice.
4. **Chloe (High Achiever & Musician):** 17-year-old violinist, perfectionist, learning grace over performance.
5. **Marcus (Aspiring Young Leader):** 16-year-old sports captain, learning servant leadership through humble tasks.
6. **Maya (Creative Artist):** 15-year-old digital artist, sensitive to beauty, learning disciplined craftsmanship.
7. **Sam (Technical Helper):** 14-year-old audio-visual steward, analytical, discovering that tech serves worship.
8. **Kuya David (Family Big Brother):** 20-year-old college student, grounded mentor, balancing work and family service.

---

## 7. Relationship & Affinity System

### 7.1 Mechanics
The virtual world features a **lightweight, non-romantic affinity system** that tracks how NPCs perceive the player's integrity:
- **Affinity Points (0–100):** Earned when the player completes quests assigned by that NPC, honors commitments, selects thoughtful dialogue choices, and submits genuine reflections.
- **Tiers:** *Acquaintance (0–24)* → *Friend (25–49)* → *Trusted Partner (50–74)* → *Koinonia Family (75–100)*.

### 7.2 Strict Youth Safety Guardrails
- **Zero Romantic Mechanics:** No dating, flirting, or romantic affinity bars whatsoever.
- **Focus Areas:** Biblical friendship, intergenerational honor, family loyalty, and reconciliation.

---

## 8. Small Group & Team System: "Quest Circles"

### 8.1 Terminology & Target Size
- **Official Terminology:** **QUEST CIRCLES** (Approved by Product Owner).
- **Target Size:** **5 to 8 youth**.

### 8.2 Scope & Relationship to Koinonia Core
- **Not 1:1 with Sunday Small Groups:** Quest Circles do **NOT** automatically mirror the existing Koinonia `small_groups` table.
- **Cross-Cutting Cohorts:** Quest Circles are designed to be flexible cohorts that can span across:
  1. Different existing cell groups (`small_groups`)
  2. Ministry volunteer teams (e.g., Tech Booth, Worship Band)
  3. Alpha Youth Series (AYS) seasonal batches
  4. Seasonal youth event committees or project teams
- **Future Linkage:** A future optional configuration will allow a Quest Circle to link directly to a Koinonia small group if desired, but this is strictly optional.

### 8.3 Governance Model
- **Initial Governance (Phase 1–3):** **Leader / Admin Directed**.
  - A youth leader, pastor, or administrator creates the Quest Circle.
  - Youth are invited to the Circle and must explicitly accept the invitation.
  - **No Unrestricted Creation:** Youth are **NOT** permitted to create arbitrary open teams initially, preventing exclusionary cliques or unsupervised chat spaces.

### 8.4 Role-Based Collaboration & The "Armor Bearer"
- **Asymmetric Role Delegation:** Quests assigned to a Circle distribute complementary roles (e.g., Tool Steward, Water Bearer, Area Cleaner, Story Scribe, Coordinator).
- **Armor Bearer Mechanic:** If a member is sick, burdened with exams, or unable to finish their chore, a teammate can volunteer as their *Armor Bearer* to step in and help, unlocking a mutual Teamwork bonus.

---

## 9. Leadership Progression: The Servant Path

### 9.1 Philosophy of Leadership
In Koinonia Quest, leadership is modeled on Christ washing His disciples' feet (Mark 10:42–45).
> **Leadership unlocks greater responsibility, never dominance, authority, or status over peers.**

### 9.2 The Six Stages of Growth
1. **Explorer:** New to the community; focuses on personal home habits and discovering gifts.
2. **Contributor:** Reliably completes basic personal and family quests; participates in shared projects.
3. **Helper:** Actively assists peers; notices when someone needs help without being asked.
4. **Team Steward:** Trusted to coordinate small tasks within their Circle.
5. **Apprentice Leader:** Mentors a younger youth (Explorer); assists during Sunday youth events.
6. **Servant Leader:** Commissioned by youth pastors; models humility, integrity, and prayerful care.

### 9.3 Non-XP Gating & Human Leadership Approval
> **Product Owner Rule: Leadership advancement must NOT occur solely through XP.**

- **Eligibility vs. Advancement:** The software engine may determine **eligibility** (based on consistency, completion of formation quests, and attendance).
- **Mandatory Human Sign-Off:** Promotion to higher leadership tiers—specifically **Apprentice Leader** and **Servant Leader**—**strictly requires explicit human leader/mentor approval** in the Koinonia Admin/Leader portal.
- An automated system cannot discern spiritual maturity or character integrity; only human leaders walking with the youth in real life can authorize servant leadership.

---

## 10. Achievements System

Milestone achievements celebrate character, consistency, and kindness, awarding badges, titles, cosmetics, and modest Life Point bonuses.

| ID | Achievement Name | Category | Unlock Requirement | Rewards |
| :--- | :--- | :--- | :--- | :--- |
| **ACH-01** | **First Step** | Onboarding | Complete your first quest (Quest #001). | Title: *Green Sprout*, +5 Life Points |
| **ACH-02** | **Sanctuary of Peace** | Home | Complete 5 personal space cleaning quests. | Furniture: *Cozy Desk Lamp* |
| **ACH-03** | **Faithful Son / Daughter**| Family | Complete 7 domestic help or family meal quests. | Badge: *Heart of the Home*, +10 Life Points |
| **ACH-04** | **Unbroken Fellowship** | Habits | Maintain a 7-day streak of daily devotion/prayer. | Cosmetic: *Pilgrim's Linen Scarf*, +10 Life Points |
| **ACH-05** | **The Helping Hand** | Service | Complete 5 church setup or cleanup quests. | Title: *Willing Worker*, +15 Life Points |
| **ACH-06** | **Gentle Shepherd** | Compassion | Complete 3 newcomer welcoming or encouragement quests. | Badge: *Open Door*, +10 Life Points |
| **ACH-07** | **Earth Keeper** | Stewardship | Complete 10 recycling, plant care, or cleanup tasks. | Cosmetic: *Gardener's Straw Hat*, +10 Life Points |
| **ACH-08** | **Circle of Trust** | Teamwork | Complete 5 collaborative Circle team quests. | Title: *Faithful Companion*, +15 Life Points |
| **ACH-09** | **Digital Sabbath** | Discipline | Log 3 verified 2-hour device-free family sessions. | Badge: *Still Waters*, +10 Life Points |
| **ACH-10** | **Creative Offering** | Creativity | Contribute 3 visual, musical, or technical offerings. | Furniture: *Artisan's Easel*, +15 Life Points |
| **ACH-11** | **Behind the Scenes** | Service | Volunteer for church sound, slides, or ushering 3 times. | Cosmetic: *Steward's Tool Belt*, +15 Life Points |
| **ACH-12** | **Community Restorer** | Community | Contribute at least 100 XP to Community Garden Project. | Title: *Cornerstone Builder*, +25 Life Points |
| **ACH-13** | **Peacemaker** | Wisdom | Resolve a peer misunderstanding and record reflection. | Badge: *Olive Branch*, +10 Life Points |
| **ACH-14** | **Temple Steward** | Fitness | Complete 10 physical wellness or exercise quests. | Title: *Strong Runner*, +10 Life Points |
| **ACH-15** | **Armor Bearer** | Teamwork | Step in to complete a chore for an absent/sick teammate. | Badge: *True Friend*, +15 Life Points |
| **ACH-16** | **Honor Your Parents** | Family | Interview a parent/guardian about their life journey. | Title: *Wisdom Seeker*, +10 Life Points |
| **ACH-17** | **Silent Scribe** | Reflection | Record 14 personal journal reflections. | Cosmetic: *Scribe's Leather Journal*, +10 Life Points |
| **ACH-18** | **The Chair Champion** | Service | Help stack or arrange 100 chairs across church events. | Title: *Master of Chairs*, +20 Life Points |
| **ACH-19** | **AYS Pioneer** | Formation | Complete introductory chapter of the AYS Adventure. | Badge: *The Alpha Compass*, +10 Life Points |
| **ACH-20** | **Servant Heart** | Leadership | Achieve Servant Leader stage with pastoral sign-off. | Title: *Servant Leader*, +50 Life Points |

---

## 11. Community Projects: Shared World Transformation

- **Project #001: Restore the Community Garden** (Stages 0 to 5).
- **Project #002: Upgrade Youth Hall Fellowship Space** (Stage progression via Teamwork & Service).
- **Project #003: Build Reflection Garden & Quiet Arbor** (Stage progression via Wisdom & Stewardship).
- **Project #004: Restore Worship & Music Rehearsal Room** (Stage progression via Creativity & Teamwork).
- **Project #005: Equip the Community Kitchen** (Stage progression via Service & Responsibility).
- **Project #006: Create the Outreach & Care Center** (Stage progression via Compassion & Leadership).

---

## 12. Verification Progression: Family & Domestic Quests

To balance integrity with household reality, the verification workflow follows an approved two-stage evolution:

```
┌────────────────────────────────────────────────────────────────────────┐
│                     FAMILY VERIFICATION PROGRESSION                    │
├───────────────────────────────────┬────────────────────────────────────┤
│       PHASE 1 (VERTICAL SLICE)    │        LONG-TERM TARGET            │
├───────────────────────────────────┼────────────────────────────────────┤
│ • TRUST mode for ordinary habits  │ • Registered Parent Koinonia       │
│ • Direct "Hand Device to Parent"  │   Account Notification Workflow    │
│   confirmation button             │ • Parent receives push/in-app alert│
│ • NO 4-digit PIN in Phase 1       │ • Direct parent-child linkage      │
└───────────────────────────────────┴────────────────────────────────────┘
```

1. **Phase 1 Implementation:**  
   - Low-value household and personal habits continue to use **TRUST** mode.
   - Domestic chores requiring family confirmation use a simple **"Hand device to parent/guardian"** modal where a parent taps a single confirmation button.
   - **Do NOT implement a reusable 4-digit PIN in Phase 1.**
2. **Long-Term Target:**  
   - Once parent/child account relationships are mature in the core Koinonia portal, family quests will dispatch an asynchronous notification to the parent's registered Koinonia account for remote confirmation.

---

## 13. Game Engine Decision: Phase 1 Lightweight Canvas

- **Approved Approach:** Lightweight **HTML5 2D Canvas engine + Stateless REST**.
- **No Heavy Frameworks:** RPGJS, Phaser, and WebSockets are strictly excluded from Phase 1.
- **Architectural Future-Proofing:** The client/server interface remains clean REST JSON so that a stronger 2D engine or dedicated multiplayer microservice can be adopted in Phase 5 without breaking database or quest progression contracts.

---

## 14. Reflection Safety Architecture

> ### CRITICAL POLICY DIRECTIVE (PRODUCT OWNER APPROVED)
> **REFLECTION SAFETY ARCHITECTURE — REQUIRES SEPARATE SAFEGUARDING AND PRIVACY REVIEW.**

1. **Private by Default:** All youth reflections remain strictly private to the author.
2. **No Automated Alerts in Phase 1:** Do **NOT** implement an automated scanning or alert-to-pastor mechanism in Phase 1.
3. **Mandatory Pre-Implementation Review:** Prior to implementing any automated safety or escalation tool, a formal, independent review must be conducted and approved covering:
   - *Consent and disclosure* (clear notice to youth regarding how safety monitoring works)
   - *Access control* (strict limitations on who can see flagged entries)
   - *Authorized recipients* (designated safeguarding officers only)
   - *False-positive handling* (protocols for poetic, biblical, or metaphorical expressions)
   - *Escalation thresholds* (objective criteria for immediate human intervention)
   - *Data minimization* (scanning without persistent surveillance logging)
   - *Retention policies* (automated purging of private drafts)
   - *Audit trails* (logging access to private records)
   - *Youth / minor privacy laws* (compliance with child data protection standards)
   - *Parent / guardian considerations* (family notification protocols)
   - *Emergency limitations* (clear disclaimers that the app is not a live crisis hotline)

---

## 15. Implementation Timing Moratorium

Implementation of Phase 1 must **NOT** begin until:
1. The Koinonia production launch has completed successfully.
2. At least 72 hours of production stabilization have passed.
3. There are zero significant unresolved production issues.
4. **Explicit product-owner authorization is granted to begin Phase 1.**
