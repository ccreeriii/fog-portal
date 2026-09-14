# KOINONIA — GROWTH PROFILE & JOURNEY FOUNDATION CONTRACT
**Phase 0.23J Architecture Document**  
**Status**: SPECIFICATION & IMPLEMENTATION CONTRACT  
**Scope**: KOINONIA Staging & Prototype Member Profile Architecture  
**Isolation Boundary**: KOINONIA ONLY — Zero mutation of Main App (`fog_community.db`, PM2 processes, routes, or auth).

---

## 1. Executive Summary & Purpose

The purpose of this specification is to define the canonical client-side and service-side **Growth Profile Contract**, **Progression Model (Life Points vs. Character XP)**, **Deterministic Level Hierarchy**, **Milestone System**, and **Provider Abstraction Layer** for KOINONIA.

Prior to Phase 0.23J, player progression existed only as transient in-game local state with loose coupling to member identity. Life Points (participation/reward currency) and Character XP (RPG journey progression) lacked formal schema definitions, provider boundaries, and persona scoping.

Phase 0.23J establishes a canonical, normalized growth architecture that:
1. Standardizes member growth profiles across all KOINONIA subsystems, Account Drawers, Profile ("Me") Modals, and future Shared Core integrations.
2. Clearly delineates **Life Points (LP)** as an exchangeable/spendable reward currency from **Character XP** as a cumulative progression metric.
3. Implements deterministic, non-hierarchical level calculations using journey and community vocabulary (Levels 1–5: *New Explorer* to *Journey Builder*), strictly prohibiting any "holiness ranking" or spiritual-worth scoring.
4. Provides a robust provider abstraction (`BaseGrowthProvider`, `PrototypeGrowthProvider`, and fail-closed `SharedCoreGrowthProvider`).
5. Enforces strict identity scoping: progression data is keyed to `memberId` to prevent state leakage during persona switching.
6. Safeguards minor members through explicit privacy protections (`safeguards.isMinor`) while strictly stripping sensitive secrets, passwords, or personal details.
7. Remains strictly read-only and fail-closed in Phase 0.23J, laying the foundation for future server-authoritative mutations without risking data integrity.

---

## 2. Growth Profile Schema

The canonical schema represents an immutable, normalized growth profile object returned by `KoinoniaGrowth.normalizeGrowthProfile(raw, identityContext)`:

```typescript
interface CanonicalGrowthProfile {
  /** Canonical persistent member identifier (e.g. 'youth_demo_01', 'admin_sarah', 'father_alex') */
  memberId: string;

  /** Community domain namespace, fixed to 'fog' (Fire of God Ministries) */
  communityId: 'fog';

  /** Identity presentation attributes */
  identity: {
    displayName: string;
    avatarUrl: string | null;
    avatarEmoji: string;
  };

  /** Core progression state (Life Points and XP) */
  progression: {
    /** Redeemable/spendable participation currency */
    lifePoints: number;
    /** Cumulative character growth XP */
    xp: number;
    /** Current deterministic level (1 to 5) */
    level: number;
    /** Growth level title (e.g., 'New Explorer', 'Active Explorer') */
    levelTitle: string;
    /** Base XP required for current level */
    currentLevelXp: number;
    /** XP required to reach next level */
    nextLevelXp: number;
    /** Percentage completed toward next level (0-100) */
    progressPercent: number;
  };

  /** Real-world actions and participation activity metrics */
  activity: {
    questsCompleted: number;
    currentQuestStreak: number;
    eventsAttended: number;
    serviceActivities: number;
  };

  /** Ministry and Campfire fellowship circles */
  memberships: {
    ministries: Array<{
      id: string;
      name: string;
      role: 'MEMBER' | 'LEADER' | 'OVERSEER' | string;
    }>;
    campfires: Array<{
      id: string;
      name: string;
      role: 'MEMBER' | 'MENTOR' | 'OVERSEER' | string;
    }>;
  };

  /** Achieved milestones with timestamps */
  milestones: Array<{
    id: string;
    title: string;
    description: string;
    category: 'QUEST' | 'FELLOWSHIP' | 'COMMUNITY' | 'DISCIPLESHIP' | 'SERVICE' | 'DILIGENCE' | string;
    icon: string;
    achievedAt: string | null;
  }>;

  /** Minor safety and privacy safeguards */
  safeguards: {
    isMinor: boolean | null;
  };

  /** Data origin: 'prototype' | 'shared-core' */
  source: 'prototype' | 'shared-core';

  /** Read-only indicator for Phase 0.23J */
  readOnly: true;

  /** Optional reason if unauthenticated guest fallback was applied */
  guestReason?: string;
}
```

---

## 3. Life Points (LP) Semantics

- **Definition**: Life Points (LP) represent a spendable and exchangeable community reward/participation currency.
- **Acquisition**: Earned through real-world actions, attending gatherings, completing community callings, and participating in campfire activities.
- **Usage**: Intended for unlocking avatar cosmetic accents, special campfire embers, devotional journal themes, and community celebratory items.
- **Key Property**: LP can fluctuate, increase, or decrease (upon expenditure). It is **not** an indicator of spiritual maturity, rank, or character level.

---

## 4. Character XP Semantics

- **Definition**: Character XP represents cumulative, non-decreasing character growth points accumulated through sustained participation, quest completion, and habit development.
- **Acquisition**: Awarded upon completing educational modules, daily stewardship duties, and reflections.
- **Key Property**: Character XP is strictly monotonically non-decreasing. It directly drives the member's Character Level (1–5) and level progression bars.

---

## 5. Level Calculation & Deterministic Thresholds

Character levels are calculated deterministically from `progression.xp`. There are no randomized rolls or discretionary promotions.

| Level | Minimum XP | Title | Unlocked Perk | Description |
| :--- | :--- | :--- | :--- | :--- |
| **1** | 0 XP | New Explorer | Journey Journal Started | Beginning your journey of fellowship, stewardship, and community. |
| **2** | 10 XP | Active Explorer | Journey Explorer Badge | Taking faithful, consistent steps in daily duties and learning. |
| **3** | 25 XP | Community Adventurer | Community Adventure Accent | Deepening fellowship and service across community spaces. |
| **4** | 45 XP | Seasoned Adventurer | Seasoned Contributor Badge | A reliable helper and faithful contributor in youth and family life. |
| **5** | 70 XP | Journey Builder | Journey Builder Profile Accent | Inspiring peers through quiet, sustained diligence and mentorship. |

### Ethical Alignment Rule: Zero Spiritual-Worth Scoring
Titles and descriptions intentionally reflect **community journey and participation terminology**. KOINONIA explicitly rejects and prohibits:
- "Holiness scores" or "Spiritual rankings"
- Gamified metrics of personal spiritual standing or divine favor
- Public leaderboards ranking members by spiritual merit

---

## 6. Milestone Model

Milestones celebrate concrete achievements across distinct community spheres:

1. `first_quest` (`QUEST`, icon: ✨): Completed first community or devotional quest.
2. `joined_campfire` (`FELLOWSHIP`, icon: 🔥): Connected with brothers and sisters in a campfire circle.
3. `attended_gathering` (`COMMUNITY`, icon: ⛪): Joined church gathering or community fellowship.
4. `growth_series_completed` (`DISCIPLESHIP`, icon: 📜): Steadfastly completed an entire growth journey series.
5. `ministry_service` (`SERVICE`, icon: 🤝): Offered time and service in a ministry activity.
6. `quest_streak_3` (`DILIGENCE`, icon: ⚡): Maintained a 3-day quest streak of daily consistency.

---

## 7. Membership Model (Ministries & Campfires)

A member's growth journey is grounded in real community fellowship:
- **Ministries**: Structured service bodies within Fire of God Ministries (e.g., *Seraphs Music Ministry*, *Youth Shepherding*, *Pastoral Care*, *Elders Council*).
- **Campfires**: Small, relational peer circles (e.g., *Fire of God Alpha Seed*, *Beacon Youth Fellowship*, *Council Fire*) fostering mutual prayer, mentorship, and encouragement.

---

## 8. Prototype Provider Behavior

`PrototypeGrowthProvider` is the active provider in Phase 0.23J:
- Supplies deterministic, isolated profiles for the standard test personas:
  - `youth_demo_01` (Alex Rivera): Level 2 Active Explorer (15 XP, 135 LP), Minor (`isMinor: true`), member of Seraphs Music Ministry and Alpha Seed Campfire.
  - `admin_sarah` (Sarah Jenkins): Level 4 Seasoned Adventurer (50 XP, 320 LP), Adult Leader (`isMinor: false`), Youth Shepherding Leader, Beacon Youth Mentor.
  - `father_alex` (Father Alex): Level 5 Journey Builder (85 XP, 500 LP), Adult Overseer (`isMinor: false`), Pastoral Care Overseer, Council Fire Overseer.
- Generates a fail-closed guest profile (`guest_anonymous`, Level 1, 0 LP, 0 XP) when an unknown or invalid identity is queried.

---

## 9. Future Shared Core Provider Boundary

`SharedCoreGrowthProvider` is intentionally scaffolded with `enabled: false` in Phase 0.23J:
- When queried, it fails closed to `createGuestGrowthProfile()` unless explicitly enabled by runtime configuration.
- Will connect to the future Shared Core API (`/api/koinonia/growth-profile`) via standard token/session exchange without direct database access.
- Ensures zero Main App SQLite imports, zero database locks, and zero cross-process risks.

---

## 10. Identity Scoping & Persona Isolation

- Growth profiles are strictly indexed by `memberId`.
- When a user switches personas (e.g., via Beta Persona Selector), the client state (`state.lp`, `state.charXp`, `state.charLevel`, `state.unlockedMilestones`) is re-synchronized from that persona's profile.
- Persona progression cannot leak or overwrite other personas' progression data.

---

## 11. Minor Safety & Privacy (`isMinor`)

- `safeguards.isMinor` explicitly flags whether parental consent or youth protections apply (`true` for `youth_demo_01`, `false` for adult personas, `null` for guests).
- The normalization function actively filters out and strips all sensitive keys:
  - `password`, `token`, `access_token`, `refresh_token`, `secret`, `bearer`, `authorization`, `cookie`, `session`, `hash`, `private_key`
  - `birthdate`, `dob`, `dateOfBirth`, `ssn`, `phone`, `address`
- Raw dates of birth and contact information are strictly forbidden from entering KOINONIA client state.

---

## 12. Read-Only Limitations & Future Server-Authoritative Boundary

- **Phase 0.23J Limitation**: All growth profiles returned by providers are marked `readOnly: true`.
- Arbitrary client-side modification of LP, XP, or levels is prohibited.
- In future phases, all progression mutations (granting XP, awarding LP, achieving milestones) will occur through authenticated, server-authoritative endpoints validating completion conditions, preserving trust and preventing exploits.
