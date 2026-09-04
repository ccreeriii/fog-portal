# Koinonia Quest — Technical Specification (Draft)

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.5 (Game Design & Technical Specification)  
**Status:** DRAFT TECHNICAL SPECIFICATION ONLY — ZERO RUNTIME MODIFICATIONS  
**Target Environment:** Raspberry Pi 4 Model B (Quad-Core Cortex-A72 @ 1.5GHz, 4GB RAM)  
**Platform Stack:** Node.js (CommonJS), Express `^5.2.1`, SQLite3 `^6.0.1` (WAL Mode), PM2 (`fog-staging`)  
**Expected Git Branch:** `feature/koinonia-quest`  

---

## 1. Architectural Boundaries & Isolation

### 1.1 Decoupled Hybrid Architecture (Option D)
To ensure zero disruption to the upcoming Koinonia v3 production launch, Koinonia Quest is architected as an **isolated, dynamically mounted module**:

```
                              [ Incoming Client Request ]
                                           │
                                           ▼
                                 [ server.js (Core) ]
                                           │
                        ┌──────────────────┴──────────────────┐
                        │                                     │
                 [ Core Routes ]                     [ Feature Flag Check ]
             (/api/login, /api/events,              KOINONIA_QUEST_ENABLED === 'true'
              /api/checkin, etc.)                             │
                        │                       ┌─────────────┴─────────────┐
                        ▼                       ▼                           ▼
                 [ Core Tables ]          [ Disabled ]                [ Enabled ]
             (youth, users, attendance,   Returns 404           Mounts /routes/quest.js
              gamification_points)                              Serves /public/quest/
                                                                Connects quest_* tables
```

### 1.2 Module Directory Boundaries
When implemented in future Phase 1, all Quest code will be strictly sequestered:
- **Backend Router:** `routes/quest.js` (Self-contained Express Router).
- **Service Layer:** `services/questService.js` (Business logic, reward calculations, validation).
- **Client Application:** `public/quest/` (Independent HTML5 Canvas SPA, CSS, and JS).
- **Assets:** `public/quest/assets/` (Tilemaps, sprites, audio loaded on demand).
- **Core Files:** `server.js`, `public/js/app.js`, `public/index.html`, `public/sw.js` **must not be touched** prior to verified post-launch stabilization.

---

## 2. Feature Flag, Rollback & Implementation Timing

### 2.1 Configuration
The Quest module is governed by an explicit environment variable:
```env
# /home/raspi4/koinonia-quest/.env
KOINONIA_QUEST_ENABLED=false
```

### 2.2 Mount Logic (Post-Launch Target)
In `server.js` (deferred to Phase 1):
```javascript
// Target mount pattern for Phase 1
const isQuestEnabled = process.env.KOINONIA_QUEST_ENABLED === 'true';

if (isQuestEnabled) {
    try {
        const questRouter = require('./routes/quest');
        app.use('/api/quest', questRouter);
        app.use('/quest', express.static(path.join(__dirname, 'public/quest'), {
            maxAge: '1h',
            etag: true
        }));
        console.log('[FEATURE] Koinonia Quest module activated at /api/quest and /quest');
    } catch (err) {
        console.error('[FEATURE ERROR] Failed to initialize Koinonia Quest module:', err);
    }
} else {
    // Graceful fallback: complete black hole for Quest endpoints
    app.use('/api/quest', (req, res) => {
        res.status(404).json({ success: false, error: 'Koinonia Quest module is currently disabled.' });
    });
}
```

### 2.3 Rollback Mechanism
If any runtime instability, memory leak, or query lock occurs:
1. Set `KOINONIA_QUEST_ENABLED=false` in `.env`.
2. Execute `pm2 restart fog-staging`.
3. Recovery is **instantaneous (sub-second)** with zero residual memory footprint or route interception.
4. Core tables remain 100% pristine because all Quest data resides in isolated `quest_*` tables.

### 2.4 Strict Implementation Timing Gate
> **PRODUCT OWNER DIRECTIVE:**
> Phase 1 implementation must **NOT** begin until:
> 1. The Koinonia production launch has completed successfully.
> 2. At least **72 hours of production stabilization** have passed.
> 3. There are **no significant unresolved production issues**.
> 4. **Explicit product-owner authorization** is given to begin Phase 1.
>
> If the production application requires stabilization work, all Quest implementation waits.

---

## 3. Client & Server Responsibilities & Game Engine

### 3.1 Approved Engine Architecture (Phase 1)
- **Approved Engine:** **Lightweight HTML5 2D Canvas + Stateless REST**.
- **Engine Moratorium:** Do **NOT** introduce RPGJS, Phaser, WebSockets, or another full game framework during Phase 1 unless prototype evidence proves that the lightweight approach is insufficient.
- **Upgradability:** The architecture maintains strict modular decoupling, keeping the system fully capable of adopting a stronger engine in Phase 5 without breaking API or progression contracts.

```
┌──────────────────────────────────────┐      ┌──────────────────────────────────────┐
│       CLIENT ENGINE (Browser)        │      │       BACKEND SERVER (Node.js)       │
├──────────────────────────────────────┤      ├──────────────────────────────────────┤
│ • 60 FPS RequestAnimationFrame Loop  │      │ • 100% Stateless REST API endpoints  │
│ • 2D HTML5 Canvas Tilemap Rendering  │      │ • ZERO game tick loops or physics    │
│ • Local Keyboard & Touch Input       │      │ • Atomic SQLite transactions         │
│ • Sprite Animation State Machine     │      │ • Idempotent reward calculation      │
│ • UI Overlays (Dialogue, Quest Modals)│     │ • Authority on XP, Levels & Skills   │
│ • Audio Synthesis / Web Audio API    │      │ • Read-only verification engine      │
└──────────────────────────────────────┘      └──────────────────────────────────────┘
                   │                                             ▲
                   └─────────── HTTP REST / JSON ────────────────┘
```

---

## 4. Proposed API Contracts

All endpoints live strictly under `/api/quest/*` and require the standard Koinonia session cookie (`koinonia_session`).

### 4.1 Authentication & Profile Endpoints

#### `GET /api/quest/me`
Fetches the authenticated player's complete quest profile, level, skill matrix, leadership stage, and active titles.
- **Middleware:** `requireAuth`
- **Response (200 OK):**
```json
{
  "success": true,
  "profile": {
    "youthId": 42,
    "displayName": "Gabriel M.",
    "characterLevel": 3,
    "characterXp": 285,
    "nextLevelXp": 390,
    "currentTitle": "Faithful Helper",
    "avatarConfig": {
      "skinTone": 2,
      "hairStyle": "curly_short",
      "hairColor": "dark_brown",
      "outfit": "gardener_tunic",
      "accessory": "straw_hat"
    },
    "servantStage": "Helper",
    "leadershipEligible": true,
    "createdAt": "2026-09-04T08:00:00+08:00"
  },
  "lifePoints": {
    "total": 340,
    "arcadeXp": 45,
    "growthXp": 195,
    "eventXp": 100
  },
  "skills": [
    { "skill": "Stewardship", "xp": 45, "level": 2 },
    { "skill": "Responsibility", "xp": 50, "level": 2 },
    { "skill": "Service", "xp": 60, "level": 2 }
  ]
}
```

---

### 4.2 Quest Progression Endpoints

#### `GET /api/quest/quests`
Retrieves available, active, and recently completed quests.
- **Middleware:** `requireAuth`
- **Response (200 OK — Showing calibrated +5 LP for Q-001):**
```json
{
  "success": true,
  "quests": [
    {
      "id": "Q-001",
      "name": "Steward of the Garden",
      "category": "HOME",
      "description": "Water the plants at home (or equivalent home stewardship).",
      "difficulty": "Simple",
      "verificationMode": "TRUST",
      "rewards": {
        "lifePoints": 5,
        "characterXp": 5,
        "skills": [
          { "skill": "Stewardship", "xp": 15 },
          { "skill": "Responsibility", "xp": 5 }
        ],
        "communityProject": { "projectId": "PRJ-001", "xp": 15 }
      },
      "playerStatus": "AVAILABLE"
    }
  ]
}
```

#### `POST /api/quest/quests/:id/submit`
Submits completed real-world action with reflection and requested verification mode.
- **Middleware:** `requireAuth`
- **Request Body (FAMILY Mode — Direct Handover):**
```json
{
  "verificationMode": "FAMILY",
  "reflectionText": "Watered the porch plants and swept the fallen leaves.",
  "parentConfirmed": true
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "questId": "Q-001",
  "status": "COMPLETED",
  "awarded": {
    "lifePoints": 5,
    "characterXp": 5,
    "skillXp": [
      { "skill": "Stewardship", "xp": 15 },
      { "skill": "Responsibility", "xp": 5 }
    ],
    "communityContribution": 15
  }
}
```

---

### 4.3 Quest Circles Endpoints (Governance & Linkage)

#### `POST /api/quest/circles`
Creates a new Quest Circle.
- **Middleware:** `requireAuth`, `requireAnyPermission(['manage_attendance', 'access_permissions'])`
- **Governance Rule:** Only authorized leaders/admins can create Quest Circles in Phase 1.
- **Request Body:**
```json
{
  "name": "Berean Circle",
  "leaderId": 12,
  "linkedSmallGroupId": null,
  "targetCohort": "Youth Fellowship Batch 2026",
  "memberIds": [42, 45, 48, 51, 55]
}
```

#### `POST /api/quest/circles/:id/accept`
Youth accepts an invitation to join a Quest Circle.
- **Middleware:** `requireAuth`

#### `POST /api/quest/leadership/:youthId/approve`
Explicit human leader/mentor authorization for higher leadership tiers (*Apprentice Leader* or *Servant Leader*).
- **Middleware:** `requireAuth`, `requireStrongAdmin` or authorized pastoral permission.
- **Request Body:**
```json
{
  "targetStage": "Apprentice Leader",
  "mentorNotes": "Consistently models humility, faithful in Sunday setup, mentored younger youth."
}
```

---

## 5. Verification Engine & Family Progression

```
┌────────────────────────────────────────────────────────────────────────┐
│                          VERIFICATION ENGINE                           │
├───────────┬───────────┬─────────────┬──────────────┬───────────────────┤
│   TRUST   │  FAMILY   │   LEADER    │    EVENT     │      SYSTEM       │
│ Self-Cert │ Direct    │ Small Group │ Read-Only    │ Read-Only         │
│           │ Handover  │ Leader Queue│ attendance   │ arcade_score_logs │
└───────────┴───────────┴─────────────┴──────────────┴───────────────────┘
```

### 5.1 Model 1: TRUST (Self-Confirmation)
- **Use Case:** Personal private habits (watering home plants, morning quiet time, personal bedroom tidying, daily reflection).
- **Execution:** Instant verification with moral prompt.

### 5.2 Model 2: FAMILY (Approved Two-Stage Progression)
- **Phase 1 Implementation:**
  - Simple **"Hand device to parent/guardian"** modal.
  - Parent/guardian views the task summary and taps `[ Confirm as Parent/Guardian ]`.
  - **No 4-digit PIN** is implemented in Phase 1 (avoids PIN sharing and reset friction).
- **Long-Term Target:**
  - Asynchronous push/in-app notification to registered parent Koinonia accounts once parent-child database relationships mature.

### 5.3 Model 3: LEADER (Human Ministry Sign-Off)
- **Use Case:** Church setup, tech booth volunteering, newcomer hospitality, chair stacking.
- **Execution:** Submissions enter `quest_completions` with `status = 'PENDING_LEADER'`. Leaders review and approve via the Leader Dashboard queue.

### 5.4 Model 4: EVENT & Model 5: SYSTEM (Zero-Touch Read-Only Polling)
- **Zero-Disruption Guarantee:** Zero edits to `/api/checkin` or `/api/growth-games/*`. The Quest verification engine reads `attendance`, `brain_user_logs`, and `arcade_score_logs` on demand.

---

## 6. Reflection Safety Architecture

> ### CRITICAL POLICY SPECIFICATION
> **REFLECTION SAFETY ARCHITECTURE — REQUIRES SEPARATE SAFEGUARDING AND PRIVACY REVIEW.**

### 6.1 Strict Policy Directives
1. **Private by Default:** All youth reflections remain strictly private to the author.
2. **No Automated Alerts in Phase 1:** Do **NOT** implement an automated scanning or alert-to-pastor mechanism in Phase 1.
3. **Mandatory Independent Review:** Prior to any automated safety scanning or escalation tool being implemented in future phases, a comprehensive safeguarding and privacy review must be completed and approved by church leadership addressing:
   - **Consent and disclosure:** Clear, age-appropriate notice to youth regarding any safety monitoring.
   - **Access control:** Strict role-based boundaries on who can view flagged content.
   - **Authorized recipients:** Designated safeguarding officers only.
   - **False-positive handling:** Protocols for poetic, biblical, or metaphorical expressions (e.g., "crucified with Christ", "dying to self").
   - **Escalation thresholds:** Objective criteria for human pastoral intervention.
   - **Data minimization:** Scanning without persistent surveillance logs.
   - **Retention:** Automated expiration of sensitive private drafts.
   - **Audit trails:** Strict immutable logging of any administrative access to private reflections.
   - **Youth/minor privacy:** Compliance with applicable minor data protection standards.
   - **Parent/guardian considerations:** Policies for when and how parents are informed.
   - **Emergency limitations:** Clear UI disclaimers that the app is **not a live crisis intervention service** and displays emergency crisis hotline numbers directly.

---

## 7. Reward Transaction Flow & Idempotency Strategy

- **Compound Idempotency Key:** `(youth_id, quest_id, completion_cycle)` prevents duplicate point claims from network retries.
- **Atomic Operations:** Completions, XP updates, and community contributions execute within a single SQLite WAL transaction executing in <8ms.
- **Life Points Interface:** Calls `awardPoints(youthId, 'growth', calibratedPts, 'Koinonia Quest', questTitle)` ensuring seamless integration with existing leaderboards.

---

## 8. Secondary PWA Cache & Raspberry Pi 4 Performance

- **Zero Core Shell Bloat:** Game assets are strictly excluded from `ESSENTIAL_SHELL_ASSETS` in `public/sw.js`.
- **Secondary On-Demand Cache:** Assets load on demand into `koinonia-quest-v1`.
- **Hardware Safeguards:** Node.js memory capped at 512 MB via PM2; SQLite runs in WAL mode with normal synchronous writes; initial total Quest asset package capped under 3.5 MB.
