# KOINONIA — Phase 0.13 Prototype
**Core Game Loop + World Navigation Engine**  
*KOINONIA — Fire of God Ministries Virtual Community*

> *"A virtual world that grows when you grow in real life."*

---

## 1. Executive Summary

Phase 0.13 transforms Koinonia from an interactive prototype shell into a **functional game** featuring a complete, reusable gameplay loop and an expandable multi-place world navigation engine.

### Product Direction & Community Grounding:
- **Core Principle:** *"A virtual world that grows when you grow in real life."*
- **Community Identity:** Fire of God Ministries Virtual Community (`communityId: "fog"`). Single-community first, multi-community ready without exposing premature federation or selection UI.
- **Canonical Quest #001 Rewards:** Faithful stewardship awards **+5 LP (120 → 125 LP)**, **+15 Stewardship XP**, and **+5 Responsibility XP**. Idempotency guard prevents duplicate reward claims.

---

## 2. The Complete 9-Stage Game Loop

Phase 0.13 implements the full loop architecture:

```
[1. ENTER WORLD] ──▶ [2. EXPLORE] ──▶ [3. TALK TO NPC] ──▶ [4. RECEIVE QUEST]
                                                                  │
[7. RECEIVE REWARDS] ◀── [6. VERIFY/REFLECT] ◀── [5. RETURN] ◀────┘
         │
         ▼
[8. WORLD TRANSFORMATION] ──▶ [9. NEW PLACE UNLOCKS & TRAVEL]
```

1. **Enter World:** Player enters the virtual community starting at **My Home** (`home`).
2. **Explore:** Move smoothly around the bedroom, hearth, veranda, and garden using the virtual analog joystick (mobile) or WASD/Arrow keys (desktop).
3. **Interact with NPC:** Proximity prompt triggers when approaching Uncle Barnaby at the veranda `(13, 11)`. Pressing `[TALK / ACTION]` opens the state-reactive dialogue modal.
4. **Receive Quest:** Uncle Barnaby assigns **Quest #001: Steward of the Garden** (veranda plants are dry). Accepting sets quest status to `in_progress`.
5. **Real-Life Action:** Alex goes into real life to water plants / clean a bedroom area, then returns to Koinonia.
6. **Verify & Reflect:** Returning to Uncle Barnaby opens the reflection submission modal. The player logs their real-life stewardship deed.
7. **Receive Rewards:** Submission awards **+5 LP** (updating balance from **120 LP to 125 LP**), **+15 Stewardship XP**, and **+5 Responsibility XP**. Re-submission is blocked by an idempotency guard (`rewardClaimed: true`).
8. **World Transformation:** The virtual world changes immediately:
   - Garden potted plants transform visually from dry to **lush green ferns**.
   - The south perimeter gate unlocks, with open gates and warm lit lanterns.
   - Dynamic collision grid updates, allowing the player to walk through the south boundary.
   - Quest HUD objective updates: *"Visit FOG Community Center through the south gate"*.
9. **New Place Unlocks & Travel:**
   - **Fire of God Community Center** (`fog_center`) unlocks in the navigation registry and World Map.
   - Walking through the south gate triggers a seamless place transition with a branded glowing overlay.
   - Player arrives at FOG Community Center at spawn point `(12, 16)`.
   - Sister Grace greets Alex at the welcome station `(12, 5)` and commends their faithful stewardship.
   - Player can return through the south gateway back to My Home at spawn point `(12, 16)`.

---

## 3. World Navigation Architecture

### Implemented Places:
1. **My Home (`home`):**
   - **Tagline:** *"Personal living space & family garden"*
   - **Zones:** Bedroom, Living / Hearth, Veranda, Garden.
   - **Interactables:** Uncle Barnaby `(13, 11)`, Potted Ferns `(10-13, 13)`, South Perimeter Gate `(12, 17)`.
   - **Initial State:** Unlocked (`unlocked: true`).
2. **Fire of God Community Center (`fog_center`):**
   - **Tagline:** *"Fire of God Ministries Fellowship Hall"*
   - **Zones:** Entrance Hall, Sanctuary Platform, Notice Board, Prayer Cross, Pews & Aisle.
   - **Interactables:** Sister Grace `(12, 5)`, Notice Board `(7, 5)`, Timber Prayer Cross `(18, 5)`, Return Gateway `(12, 17)`.
   - **Initial State:** Locked (`unlocked: false`). Unlocks upon Quest #001 completion.
3. **Placeholder Places (Locked for Future Phases):**
   - **School Campus (`school`)**: Locked (`unlocked: false`). Selecting in World Map shows: *"🔒 School Campus is locked (Coming soon in future phase)"*.
   - **Sports Hub (`sports_hub`)**: Locked (`unlocked: false`).
   - **Outreach Sites (`outreach`)**: Locked (`unlocked: false`).

### Transition Engine:
- `transitionToPlace(targetPlaceId, spawnId)` validates place unlocking.
- Displays `#place-transition-overlay` with smooth radial flare and brand fade.
- Rebuilds the collision grid dynamically for the target world.
- Updates player coordinates and orientation to match the target spawn point.
- Updates HUD place tags, title cards, and World Map indicators.

---

## 4. Local Save & Restore Engine

### Configuration:
- **Storage Key:** `koinonia.phase13.save`
- **Version:** `1`

### Persisted Schema:
```json
{
  "version": 1,
  "timestamp": "2026-09-04T15:30:00.000Z",
  "activePlaceId": "home",
  "spawnId": "default",
  "avatar": { "x": 12.0, "y": 14.5, "dir": "down" },
  "lp": 125,
  "charLevel": 1,
  "charXp": 5,
  "skills": { "stewardship": 15, "responsibility": 5, "discipline": 0, "teamwork": 0, "service": 0, "compassion": 0 },
  "gardenState": "lush",
  "gateOpen": true,
  "fogCenterUnlocked": true,
  "visitedFogCenter": true,
  "unlockedPlaces": ["home", "fog_center"],
  "questStatus": "completed",
  "rewardClaimed": true,
  "currentObjective": "Explore Fire of God Community Center",
  "reflectionText": "Watered the family plants and swept the veranda.",
  "audioMuted": false
}
```

### Developer Reset:
- **Button:** UI reset button resets prototype state and purges `koinonia.phase13.save`.
- **Query Parameter:** Loading `http://127.0.0.1:8095/?reset=1` immediately purges `koinonia.phase13.save` and restores pristine defaults.

---

## 5. Controls & Diagnostics

- **Mobile Touch (Portrait):** Virtual analog joystick in lower-left thumb zone with 12% deadzone, smooth analog curve, and normalized vector magnitude. Action / Talk button in lower-right zone. Independent multi-touch allows simultaneous steering and action tapping.
- **Desktop Keyboard:** WASD or Arrow Keys for 8-directional movement. Spacebar or Enter for Action / Talk.
- **Diagnostics HUD (`?debug=1`):** Real-time telemetry displaying:
  - Device Class & Orientation
  - Viewport & Stage Dimensions
  - Active Place & Player Coordinates `(x, y)`
  - Quest Status & Objective
  - Garden State, Gate Open, FOG Center Unlocked, Visited FOG Center
  - Reward Claimed Status & LP Balance
  - Joystick Active Status, Angle, Vector, and Speed %

---

## 6. Quick Start & Testing

### Local HTTP Test Server (Port 8095):
```bash
python3 -m http.server 8095 --bind 127.0.0.1 --directory prototype/koinonia-phase13/
```
Open in browser:
```
http://127.0.0.1:8095
```

### Diagnostics Debug Mode:
```
http://127.0.0.1:8095/?debug=1
```

### Reset Prototype State:
```
http://127.0.0.1:8095/?reset=1
```

### Run Automated Test Suite:
```bash
node prototype/koinonia-phase13/test_phase13_suite.js
```
*Result: 38 / 38 Tests Passing (100%).*
