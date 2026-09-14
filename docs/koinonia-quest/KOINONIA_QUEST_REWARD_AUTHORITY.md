# KOINONIA — Phase 0.23K Quest Progress & Reward Authority Specification

**Document Version:** 1.0.0  
**Phase:** 0.23K  
**Status:** ACCEPTED SPECIFICATION  
**Scope:** Koinonia-Side Quest Progress & Reward Authority Foundation  
**Target Repository:** `/home/raspi4/koinonia-quest/prototype/koinonia-phase23_8`  
**System Boundary:** Koinonia Staging Prototype (`koinonia-staging`, Port 3006). Zero Main App mutations. Zero Main App DB writes.

---

## Executive Summary

Phase 0.23K establishes the **KOINONIA-local prototype reward authority** and progression boundary on the KOINONIA side. Prior to this phase, client code directly mutated in-memory balances (`state.lp += ...; state.charXp += ...;`), without centralized validation, deterministic idempotency keys, transactional rollback protection, or an audit trail.

> [!IMPORTANT]
> **Scope & Terminology Boundary Notice**:
> In Phase 0.23K, this system is explicitly designated as a **KOINONIA-local prototype reward authority** (or *authority-managed prototype reward boundary*). It is **NOT** server-authoritative yet. Real server-authoritative progression will be introduced in future Shared Core stages when connected to the Main App backend. For prototype staging QA, the authority maintains member-namespaced `localStorage` persistence (`koinonia.reward_authority.${memberId}`) to guarantee state persistence across page reloads and browser sessions.

Phase 0.23K formalizes:
1. A **Canonical Quest Progress Contract** (`normalizeQuestProgress`).
2. A **Reward Authority Abstraction** (`BaseRewardAuthority`, `PrototypeRewardAuthority`, `SharedCoreRewardAuthority`, `KoinoniaRewardAuthority`).
3. **Generic & Specialized Authority Wrappers**:
   - Path A: Quests (`completeQuest`)
   - Path B: Events / Gatherings (`recordEventAttendance`)
   - Path C: Arcade & Mini-games / Sports Challenges (`recordArcadeReward`, `recordChallengeReward`)
   - Path D: Development Reset (isolated dev reset hydrating from growth baselines)
   - Path E: Non-reward Display / Hydration (profile sync; never mints)
4. **Deterministic Idempotency** via domain-specific completion keys (`community:member:domain:source:version`).
5. **Atomic Reward Transactions** with snapshot rollback upon failure (guaranteeing zero partial state).
6. **Trusted Reward Policies** enforcing hard upper bounds (0–50 LP, 0–100 XP) and rejecting negative amounts.
7. **Milestone Evaluation** triggered only after successful completion.
8. **Date-Aware Streak Model** preventing double counting on the same calendar day.
9. **Read-Only Reward History Ledger** providing a transparent gameplay audit trail.
10. **Member-Namespaced LocalStorage Persistence** ensuring prototype sessions survive page reloads.

---

## 1. Canonical Quest Progress Contract

The Quest Progress model represents a member's real-time state for any given quest in the Koinonia universe.

```typescript
interface QuestProgress {
  memberId: string;
  communityId: "fog";

  questId: string;
  questType: "STANDARD" | "EVENT" | "STUDIO_QUEST";

  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

  progress: {
    current: number;
    target: number;
    percent: number;
  };

  completion: {
    completedAt: string | null;  // ISO-8601 UTC
    completionId: string | null; // e.g. "fog:youth_demo_01:Q-001:v1"
  };

  rewards: {
    lifePoints: number;
    xp: number;
    milestoneIds: string[];
  };

  source: "prototype" | "shared-core";

  readOnly: boolean;
}
```

### Normalization Guarantees:
- **Always Read-Only (`Object.freeze`)**: Prevents UI tampering with status or rewards.
- **Fail-Closed Default**: Unknown quests or unauthenticated sessions normalize safely to `NOT_STARTED` with `current: 0, percent: 0`.
- **Clamped Progress**: `current` cannot exceed `target`, and `percent` is strictly clamped between `0` and `100`.

---

## 2. Reward Authority Responsibilities

The Reward Authority is the sole authority permitted to evaluate and issue rewards for quest completion:

```javascript
class BaseRewardAuthority {
  getQuestProgress(memberId, questId);
  completeQuest(memberId, questId, completionContext);
  getRewardHistory(memberId);
  hasRewardBeenGranted(memberId, rewardKeyOrCompletionId);
  previewQuestReward(questId);
}
```

### Core Responsibilities:
1. **Member Identity Verification**: Confirms caller is a recognized member within the community scope.
2. **Quest Verification**: Ensures the quest exists in the trusted catalog or validated Studio published registry.
3. **Idempotency Enforcement**: Checks if the quest completion ID has already been recorded.
4. **Authoritative Calculation**: Computes effective LP, XP, and milestone unlocks from trusted definitions. Client-provided reward amounts are discarded.
5. **Transactional Mutation**: Atomically applies LP/XP increments, updates streaks, grants milestones, and records audit ledger entries.
6. **Rollback on Error**: If any step fails, restores the prior state snapshot.

---

## 3. Trusted Reward Definitions & Policy Limits

Quest reward values cannot be dictated by arbitrary client parameters or untrusted draft inputs. All rewards are verified against trusted definitions and global policy limits.

### Canonical Catalog (`TRUSTED_QUEST_REWARDS`):
- `Q-001` (Steward of the Garden): 5 LP, 5 XP, Milestones: `['first_quest']`
- `Q-002` (Light at Home): 5 LP, 5 XP
- `Q-003` (Morning Blessing): 5 LP, 5 XP
- `Q-004` (Encouraging Words): 5 LP, 5 XP
- `Q-005` (Orderly Homework Haven): 5 LP, 5 XP, Milestones: `['growth_series_completed']`
- `E-Q001` (Glory Gate Gathering): 5 LP, 5 XP, Milestones: `['attended_gathering', 'ministry_service']`
- `E-Q002` (Agape Welcome): 5 LP, 5 XP, Milestones: `['attended_gathering', 'ministry_service']`
- `E-Q003` (Gathering Blessing): 5 LP, 5 XP, Milestones: `['attended_gathering']`

### Global Policy Bounds (`LIMITS`):
- `MIN_LP`: 0, `MAX_LP`: 50
- `MIN_XP`: 0, `MAX_XP`: 100
- **Negative Rejection**: Any reward payload containing `lifePoints < 0` or `xp < 0` is strictly rejected (`valid: false`).
- **Excessive Clamping**: Rewards greater than 50 LP or 100 XP are clamped to policy maximums.

---

## 4. Idempotency & Duplicate Protection

A completed quest must never grant rewards twice, regardless of network retries, double-clicks, or replay attempts.

### Deterministic Completion Key:
```
completionId = `${communityId}:${memberId}:${questId}:${version}`
```
Example: `fog:youth_demo_01:Q-001:v1`

### Idempotency Behavior:
1. When `completeQuest(memberId, questId)` is invoked, the authority checks `hasRewardBeenGranted(memberId, completionId)`.
2. If already recorded:
   - Returns `{ success: true, alreadyCompleted: true, completionId, rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }, questProgress, rewardHistoryEntry }`.
   - **Zero additional Life Points granted.**
   - **Zero additional XP granted.**
   - **Zero duplicate history entries written.**

---

## 5. Life Points Mutation Rules

- **Nature of Life Points (LP)**: Stewardship & participation currency within Koinonia.
- **Authority Boundary**: Only the active `RewardAuthority` can grant LP. UI components must never execute `state.lp += value`.
- **Non-Negativity Invariant**: Life Points can never drop below 0.
- **Clamped Grants**: No single quest completion can award more than 50 LP.

---

## 6. Character XP Mutation Rules

- **Nature of Character XP**: Journey progression metric used exclusively for deterministic level calculation.
- **Authority Boundary**: Only the active `RewardAuthority` can grant Character XP.
- **Deterministic Level Calculation**: XP maps to Levels 1–5 (`XP_LEVEL_THRESHOLDS`: 0, 10, 25, 45, 70 XP).
- **No Spiritual Scoring**: XP measures participation diligence, not spiritual worth or holiness.

---

## 7. Milestone Evaluation

Milestones are evaluated server-authoritatively by the Reward Authority upon quest completion:
1. `first_quest`: Unlocked upon the first completed quest.
2. `quest_streak_3`: Unlocked when the member's diligence streak reaches 3 consecutive days.
3. `growth_series_completed`: Unlocked when all 5 foundational quests (`Q-001` through `Q-005`) are completed.
4. `ministry_service`: Unlocked upon completing a quest flagged with `SERVICE` category or ministry service triggers.
5. `attended_gathering`: Unlocked upon completing an in-person or community gathering event quest.

Client UI cannot unlock milestones directly.

---

## 8. Deterministic Streak Model

The diligence streak tracks faithful, day-by-day consistency:
- **Timezone Awareness**: Evaluated using canonical ministry timezone (`Asia/Manila`, ISO `YYYY-MM-DD`).
- **Same-Day Repeat**: Completing multiple quests on the same calendar day maintains the current streak; it does **not** double count.
- **Consecutive Day**: Completing a quest exactly 1 calendar day after the last recorded completion increments the streak (`streak + 1`).
- **Broken Streak**: If more than 1 calendar day elapses between completions, the streak resets to 1.
- **Tamper Resistance**: No client buttons or browser payloads can artificially increment the streak.

---

## 9. Read-Only Reward History Ledger

Every authoritative grant appends an immutable entry to the member's reward history ledger:

```typescript
interface RewardHistoryEntry {
  id: string;               // e.g. "rew_fog_youth_demo_01_Q-001_1726300000"
  memberId: string;
  questId: string;
  type: "QUEST_COMPLETION";
  lifePointsDelta: number;
  xpDelta: number;
  milestoneIds: string[];
  createdAt: string;        // ISO-8601 UTC
  completionId: string;     // Idempotency key
}
```

The ledger is strictly read-only and member-scoped, serving as a transparent audit log for growth progress.

---

## 10. Member Isolation

All progression, quest status, streaks, and reward ledgers are keyed strictly by canonical `memberId`:
- `youth_demo_01` (Alex Rivera)
- `admin_sarah` (Sarah Jenkins)
- `father_alex` (Father Alex)

**Isolation Rules:**
- Alex's quest completions and LP/XP grants never modify Sarah's or Father Alex's profile.
- Switching active identities in the prototype completely isolates the active save state and reward history.
- Studio content and governance remain shared, but progression is strictly individual.

---

## 11. Prototype Authority Behavior (`PrototypeRewardAuthority`)

During Phase 0.23K:
- `PrototypeRewardAuthority` serves as the active provider.
- It operates as a **KOINONIA-local prototype reward authority** managing member progression state seeded from canonical demo baselines.
- **Member-Namespaced Persistence**: Persists state to `localStorage.getItem('koinonia.reward_authority.' + memberId)`. This ensures prototype testing, physical QA, and browser refreshes preserve granted rewards, completed quests, streaks, and audit history.
- It updates the canonical `KoinoniaGrowth` read model so UI components (Profile, Dashboard, Journey Cards) reflect authoritative grants instantly.
- Provides test hooks (`resetMemberState`, `resetAll`) for automated verification.

### Unified Grant Architecture (`grantTrustedReward`)
All reward domains are unified under `grantTrustedReward(params)` with specialized wrappers:
1. **Path A: Quests (`completeQuest(identity, questId, context)`)**:
   - Idempotency Key: `fog:${memberId}:${questId}:v1`
   - Authority catalog: `TRUSTED_QUEST_REWARDS`
   - Prevents duplicate quest completion rewards.
2. **Path B: Events / Gatherings (`recordEventAttendance(identity, eventId, context)`)**:
   - Idempotency Key: `fog:${memberId}:event:${eventId}`
   - Authority catalog: `TRUSTED_EVENT_REWARDS` (5 LP, 5 XP default)
   - Prevents double granting for the same gathering attendance.
3. **Path C: Arcade & Mini-games (`recordArcadeReward(identity, gameId, context)`)**:
   - Idempotency Key: `fog:${memberId}:arcade:${gameId}:${YYYY-MM-DD}`
   - Authority catalog: `TRUSTED_ARCADE_REWARDS` (5 LP, 5 XP default)
   - Enforces daily replay protection: the first play on a calendar day awards LP and XP; subsequent plays on the same day grant 0 LP and 0 XP.
4. **Path C: Sports & Fit Quest Challenges (`recordChallengeReward(identity, challengeId, context)`)**:
   - Idempotency Key: `fog:${memberId}:challenge:${challengeId}:v1`
   - Authority catalog: `TRUSTED_CHALLENGE_REWARDS` (5 LP, 5 XP default)
   - Governs first-time completion rewards; subsequent attempts reward 0 LP / 0 XP.
5. **Path D: Development-Only Reset (`resetPrototypeState`)**:
   - Isolated and quarantined in `game.js`.
   - Calls `KoinoniaRewardAuthority.resetMemberState(memberId)` to wipe prototype reward storage and resets in-memory runtime state to hydrated values from `KoinoniaGrowth.getGrowthProfile(memberId)`.
6. **Path E: Non-Reward Display / Hydration**:
   - Profile switching, page initialization, and UI sync read authoritative values via `KoinoniaGrowth.getGrowthProfile(memberId)` or `RewardAuthority.getRewardSummary(memberId)`.
   - These assignments hydrate displays without minting new progression currency.

### UI Absolute Hydration Architecture (Zero UI Delta Arithmetic)
UI and gameplay code must **NEVER** maintain authoritative member progression balances via arithmetic:
- **Disallowed in UI**: `state.lp += delta`, `state.lp = state.lp + delta`, `state.charXp += delta`, `state.xp += delta`.
- **Allowed in UI**: Absolute hydration from read model:
  ```javascript
  const profile = KoinoniaGrowth.getGrowthProfile(memberId);
  state.lp = profile.progression.lifePoints;
  state.charXp = profile.progression.xp;
  state.charLevel = profile.progression.level;
  ```
- **Authority Result Semantics**: The authority returns `rewardsGranted.lifePoints` and `rewardsGranted.xp` strictly as metadata for UI animations, toast messages, and audit logs. The canonical balance itself is always hydrated from the updated read model.

### Prototype Security Terminology & Non-Tamper-Proof Disclosure
Phase 0.23K is explicitly a **KOINONIA-local prototype reward authority**, **NOT** a secure production server authority:
- **Client Storage Accessibility**: `localStorage` data remains accessible via browser devtools and must **NOT** be described as tamper-proof or cheat-proof.
- **Production Boundary**: Real server-authoritative progression requires future secure backend storage in Shared Core with cryptographic signatures / session authority.
- **Phase 0.23K Guarantees**:
  1. Clean, decoupled application architecture (Authority writes, Growth Profile reads, UI hydrates).
  2. Trusted internal reward definitions and policy bounds.
  3. Duplicate protection and idempotency under normal application usage.
  4. Member isolation and persona boundaries.
  5. Deterministic replay and streak policies.
  6. Device-scoped prototype persistence.
- **Explicit Non-Guarantee**: Does not protect against a user manually editing their browser storage or modifying prototype memory.

### Persistence Boundaries & Lifecycle
- **Normal Repeat Invocations**: Idempotency keys prevent double granting within active runtime.
- **Persona Switching**: Each persona stores state independently under `koinonia.reward_authority.${memberId}`.
- **Page Reload / Tab Close & Reopen**: Restored from `localStorage`.
- **Clearing Site Data / Storage**: Purges local prototype storage; authority automatically seeds from canonical prototype baselines.
- **Private / Incognito Browsing**: Bounded to the incognito session; discarded on window close.
- **Multi-Device / Multi-Browser**: Strictly device-local; no cross-device sync until Shared Core Stage 3.

---

## 12. Future Shared Core Authority Boundary (`SharedCoreRewardAuthority`)

The future Shared Core stage will connect to the Main App's authoritative backend:
- In Phase 0.23K, `SharedCoreRewardAuthority` is **strictly disabled** (`enabled: false`).
- Fails closed to zero rewards and returns an error if called.
- Makes **zero network requests** (`fetch`, `XMLHttpRequest`, WebSocket).
- Makes **zero database connections** to Main App SQLite databases (`fog_community.db`).

---

## 13. Failure & Rollback Semantics

To prevent corrupt or partial state (e.g. LP granted but XP or milestone failed):
1. The authority takes a full in-memory **snapshot** of the member's progression before applying any mutations.
2. Updates are applied inside a transactional `try / catch` boundary.
3. If an unhandled exception or policy validation failure occurs:
   - The member's state is immediately restored from the snapshot.
   - The canonical `KoinoniaGrowth` runtime profile is rolled back.
   - Zero partial LP, XP, streak, milestone, or history entries remain.

---

## 14. Minor Safety & Data Protection

Alex Rivera is marked as a youth minor (`safeguards: { isMinor: true }`).
- **No Personal Data Prompts**: Quest verification prompts do not ask for or store phone numbers, addresses, school names, or social media handles.
- **Private Reflections**: Personal reflections written during quests remain strictly private to the member.
- **No Unrestricted Messaging**: Quest reward flows do not expose open free-text chat or direct messaging.

---

## 15. What Phase 0.23K Intentionally Does NOT Implement

To preserve strict safety and maintain clean architectural stages:
1. **No Main App Database Writes**: Does not touch `fog_community.db` or any staging/production portal tables.
2. **No Main App API Endpoints**: Does not implement or call `/api/v1/quests/complete` on the Community Portal.
3. **No Real Monetary Currency**: Life Points remain a non-financial community stewardship metric.
4. **No Peer-to-Peer LP Transfers**: Members cannot transfer LP or XP to other members.
5. **No Production Deployment**: Running locally on candidate snapshot `prototype/koinonia-phase23_8`; live staging PM2 process (`koinonia-staging`) is not touched.
