# KOINONIA — Phase 0.12.1 Prototype
**Real Phone Device-Classification & Portrait Gameplay Fix**  
*KOINONIA — Fire of God Ministries Virtual Community*

> *"A virtual world that grows when you grow in real life."*

---

## 1. Executive Summary & Root Cause Analysis

### The Physical Device Finding
Testing Phase 0.12 across three physical phones revealed:
1. **iPhone 8 Plus:** Behaved correctly.
2. **iPhone 12 Pro:** Failed (broken landscape companion, uncalibrated portrait).
3. **Android Phone:** Failed.

### Root Cause Identification
- iPhone 8 Plus landscape viewport is **736 × 414px**. Its width (736px) stayed below older 767px/768px breakpoints.
- iPhone 12 Pro landscape viewport is **844 × 390px**, and modern Android phones often report **800–915 × 360–412px**.
- Because their landscape **width exceeded 767px**, width-only media queries accidentally misclassified them as tablets or desktops.
- This suppressed the Landscape Companion Screen, hid touch controls, and broke responsive layout synchronization.

### Phase 0.12.1 Architectural Solution
1. **Elimination of Width-Only Breakpoints:**
   - Width-only media queries (`@media (max-width: 767px)`, `@media (min-width: 768px)`, etc.) have been completely eliminated.
2. **Short-Side Classification (`shortSide <= 600px`):**
   - By calculating `shortSide = Math.min(vw, vh)` and `longSide = Math.max(vw, vh)`, every smartphone in the physical device matrix—iPhone 8+, iPhone 12 Pro, Android 800–915px, iPhone 14 Pro Max—has `shortSide <= 600px`.
   - Classification is **strictly invariant under rotation**: a phone never flips to a tablet or desktop when rotated.
3. **Single Central Responsive State:**
   - Central state in `game.js` manages `.device-phone`, `.device-tablet`, `.device-desktop`, `.orientation-portrait`, `.orientation-landscape`, `.active-game`, and `.app-shell` on the root `#app-container`.
4. **Phone Portrait Guarantee:**
   - App shell browsing (Home Play Card, Quests, World, Journey, Me) with bottom navigation.
   - Tapping `[ 🌿 ENTER WORLD ]` seamlessly enters active 2D RPG exploration mode.
   - Canvas expands to 100% stage, bottom nav hides, virtual D-Pad and Action button appear, and `[ ✕ EXIT WORLD ]` header button is displayed.
   - Zero rotate prompt modal.
5. **Phone Landscape Guarantee:**
   - In landscape, active RPG gameplay is paused and the RPG canvas is hidden (`display: none !important`).
   - The branded **Landscape Companion Screen** is displayed with:
     - `↻ Turn your phone upright to play`
     - 4 quick summary cards: Current Place, Active Quest, Life Points, Today's Focus.
   - Returning upright instantly resumes gameplay at the exact same player coordinates.
6. **Robust Canvas Calibration:**
   - `calibrateGameViewport()` checks for non-zero dimensions (`width <= 0 || height <= 0`) before camera computation.
   - Schedules via `requestAnimationFrame` after layout class transitions.
7. **Expanded Diagnostics HUD (`?debug=1`):**
   - Live real-time readout of `vw`, `vh`, `shortSide`, `longSide`, `deviceClass`, `orientation`, `activeGame`, `stage width/height`, `canvas backing width/height`, `zoom`, player coordinates, and quest state.
8. **Cache-Busting Versioning:**
   - All CSS and JS files versioned with `?v=0.12.1`.

---

## 2. Quick Start & Testing Instructions

### Method 1: Local HTTP Test Server (Port 8093)
Run the dedicated test server for Phase 0.12.1:
```bash
python3 -m http.server 8093 --bind 127.0.0.1 --directory prototype/koinonia-phase121/
```
Open in your browser:
```
http://127.0.0.1:8093
```

### Diagnostic Debug HUD Mode
Append `?debug=1` to observe live viewport dimensions, short/long side classification, camera coordinates, and backing buffer:
```
http://127.0.0.1:8093/?debug=1
```

### Method 2: Direct File Open
Open directly in any modern browser without needing a server:
```
file:///home/raspi4/koinonia-quest/prototype/koinonia-phase121/index.html
```

### Method 3: Run Automated Test Suite
```bash
node prototype/koinonia-phase121/test_phase121_suite.js
```

---

## 3. Physical Device Acceptance Matrix

| Physical Device | Orientation | Viewport (W × H) | Short Side | Resolved Class | Expected UX Behavior |
|---|---|---|---|---|---|
| **iPhone 8 Plus** | Portrait | `414 × 736` | 414px | `phone` | Full portrait RPG exploration, D-pad, Action button, Exit World header button |
| **iPhone 8 Plus** | Landscape | `736 × 414` | 414px | `phone` | Landscape Companion Screen only; RPG map hidden; upright prompt |
| **iPhone 12/13/14 Pro** | Portrait | `390 × 844` | 390px | `phone` | Full portrait RPG exploration; calibrated zoom ~1.35x; no rotate modal |
| **iPhone 12/13/14 Pro** | Landscape | `844 × 390` | 390px | `phone` | Landscape Companion Screen only; 4 summary cards; paused gameplay |
| **Android Compact** | Portrait | `360 × 800` | 360px | `phone` | Full portrait RPG exploration; smooth vertical camera tracking |
| **Android Compact** | Landscape | `800 × 360` | 360px | `phone` | Landscape Companion Screen only; zero layout collision with desktop |
| **Google Pixel 7 / Modern** | Portrait | `412 × 915` | 412px | `phone` | Full portrait RPG exploration; generous vertical viewing |
| **Google Pixel 7 / Modern** | Landscape | `915 × 412` | 412px | `phone` | Landscape Companion Screen only; upright prompt; safe pause |
| **iPhone 14 Pro Max** | Portrait | `430 × 932` | 430px | `phone` | Full portrait RPG exploration; ergonomic thumb zones |
| **iPhone 14 Pro Max** | Landscape | `932 × 430` | 430px | `phone` | Landscape Companion Screen only; zero tablet/desktop collision |
| **iPad (Tablet)** | Portrait | `768 × 1024` | 768px | `tablet` | Portrait tablet shell; active game and bottom navigation |
| **iPad (Tablet)** | Landscape | `1024 × 768` | 768px | `tablet` | Tablet layout with expanding canvas stage |
| **Desktop Studio** | Landscape | `1366 × 768` | 768px | `desktop` | 3-column studio grid; centered 1560px shell; warm neutral body |
| **Desktop Full HD** | Landscape | `1920 × 1080` | 1080px | `desktop` | 3-column studio grid; 1.6x zoom; zero black voids |

---

## 4. Controls Guide

### Mobile Phone Portrait (On-Screen Touch Controls)
- **Movement:** Touch and hold the 4-way virtual D-Pad (`▲`, `▼`, `◀`, `▶`) in the lower-left thumb zone (`touch-action: none`).
- **Action / Talk:** Tap the large circular `[ 💬 ACTION ]` button (68px) in the lower-right thumb zone.
- **Emote:** Tap `[ 🙏 ]` (44px) on the right side above the Action button to display a prayer bubble over the avatar.
- **Exit to Home:** Tap `[ ✕ EXIT WORLD ]` in the top header to return to the Home play card.

### Desktop / Keyboard
- **Movement:** `W, A, S, D` or Arrow Keys.
- **Interact / Action:** `E` or `Spacebar`.
- **Emote:** `P` key (Prayer bubble).

---

## 5. Approved Reward Calibration
- **Quest #001 (*Steward of the Garden*):**
  - **+5 Life Points** (Initial: 120 LP $\rightarrow$ After Quest: **125 LP**; strictly NO +15 LP reward)
  - **+5 Character XP** (Progression towards Level 2)
  - **+15 Stewardship XP** (Triggers garden blooming to lush green)
  - **+5 Responsibility XP** (Daily domestic habit progression)

---

## 6. Launch Safety & Isolation
- Production files (`server.js`, auth, DB, `.env`, `/home/raspi4/fog-portal-staging`) are 100% untouched.
- Previous prototypes (Phase 0.7 on 8087, Phase 0.8 on 8088, Phase 0.9 on 8089, Phase 0.10 on 8090, Phase 0.11 on 8091, Phase 0.12 on 8092) remain fully operational and unmodified.
