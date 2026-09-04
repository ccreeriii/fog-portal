# KOINONIA — Phase 0.12.2 Prototype
**Mobile Virtual Analog Joystick / Thumbstick Controls**  
*KOINONIA — Fire of God Ministries Virtual Community*

> *"A virtual world that grows when you grow in real life."*

---

## 1. Executive Summary & Controls Architecture

Following the successful physical-device verification of Phase 0.12.1 across iPhone 8 Plus, iPhone 12 Pro, and Android phones, Phase 0.12.2 upgrades the mobile movement controls from the four-button D-Pad to a **modern circular virtual analog joystick / thumbstick** integrated with Koinonia's warm brand identity.

### Key Architecture & Engineering Decisions:

1. **Virtual Analog Joystick (Lower-Left Thumb Zone):**
   - Replaces the separate `▲`, `▼`, `◀`, `▶` buttons with a single unified circular joystick.
   - **Outer Base:** ~112–124px diameter circular base styled in warm translucent amber-tinted glass (35–55% opacity) with a subtle dashed inner guide ring.
   - **Inner Knob:** ~48–54px diameter thumb knob in rich Flame Gold / Fire Orange gradient with soft depth and 2px crisp border.
2. **Analog Drag & Continuous 360° Movement:**
   - Tracks finger displacement relative to the joystick center using modern Pointer Events (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`).
   - Uses `setPointerCapture(e.pointerId)` on touch down, ensuring smooth tracking even if the thumb slides outside the base boundary.
   - Inner knob smoothly follows the player's touch, clamped to the maximum outer radius.
3. **Dead Zone (12% of Radius):**
   - Displacements under 12% of the base radius (~7.2px on a 60px radius) output a zero vector, filtering micro-jitters and resting thumb pressure.
4. **Diagonal Speed Normalization & Analog Intensity:**
   - Beyond the dead zone, displacement is normalized from 0.0 to 1.0.
   - A comfortable analog intensity curve ($\text{intensity} = \text{normalizedDist}^{0.85}$) provides fine-grained control at low deflection while smoothly ramping to full walking speed.
   - The vector magnitude is strictly capped at 1.0, ensuring diagonal movement never exceeds horizontal or vertical speed.
5. **Multi-Touch Independence:**
   - The joystick tracks its own active `pointerId` (`activeJoystickPointerId`).
   - The player can hold and steer the joystick with their **left thumb** while simultaneously tapping **Action / Talk** or **Emote** with their **right thumb** without canceling or dropping joystick movement.
6. **Robust Interruption & Reset Safeguards:**
   - Joystick vector, pointer ID, and knob position are immediately reset to center under all interruption states:
     - Finger release (`pointerup`)
     - Touch cancel / gesture interception (`pointercancel`)
     - Window blur / task switching (`blur`)
     - Browser tab backgrounding (`visibilitychange`)
     - Orientation change to landscape
     - Exiting the virtual world (`[ ✕ EXIT WORLD ]`)
7. **Unified Movement Pipeline:**
   - Both desktop keyboard (WASD / Arrows) and mobile joystick feed into a single vector-based movement pipeline with natural axis sliding collision detection.
8. **Expanded Diagnostics HUD (`?debug=1`):**
   - Telemetry HUD displays real-time joystick active status, raw and normalized vectors, magnitude, and speed percentage alongside all Phase 0.12.1 device metrics.
9. **Cache-Busting Versioning:**
   - All CSS, data, and JS resources versioned with `?v=0.12.2`.

---

## 2. Quick Start & Testing Instructions

### Method 1: Local HTTP Test Server (Port 8094)
Run the dedicated test server for Phase 0.12.2:
```bash
python3 -m http.server 8094 --bind 127.0.0.1 --directory prototype/koinonia-phase122/
```
Open in your browser:
```
http://127.0.0.1:8094
```

### Diagnostic Debug HUD Mode
Append `?debug=1` to observe live joystick telemetry, viewport dimensions, and camera coordinates:
```
http://127.0.0.1:8094/?debug=1
```

### Method 2: Direct File Open
Open directly in any modern browser without needing a server:
```
file:///home/raspi4/koinonia-quest/prototype/koinonia-phase122/index.html
```

### Method 3: Run Automated Test Suite
```bash
node prototype/koinonia-phase122/test_phase122_suite.js
```

---

## 3. Physical Device Acceptance Matrix

| Physical Device | Orientation | Viewport (W × H) | Resolved Class | Expected Mobile Controls Behavior |
|---|---|---|---|---|
| **iPhone 8 Plus** | Portrait | `414 × 736` | `phone` | Circular analog joystick (lower-left), Action & Emote (lower-right), 1.35x zoom, smooth continuous 360° steering |
| **iPhone 8 Plus** | Landscape | `736 × 414` | `phone` | Landscape Companion Screen only; joystick & map hidden; gameplay paused |
| **iPhone 12/13/14 Pro** | Portrait | `390 × 844` | `phone` | Analog joystick responsive to touch drag, dead-zone filtering, multi-touch Action tapping |
| **iPhone 12/13/14 Pro** | Landscape | `844 × 390` | `phone` | Landscape Companion Screen only; joystick reset to center; gameplay paused |
| **Android Compact** | Portrait | `360 × 800` | `phone` | Scaled ~112px joystick, ergonomic left-thumb placement, zero page scroll |
| **Android Compact** | Landscape | `800 × 360` | `phone` | Landscape Companion Screen only; zero collision with desktop studio |
| **Google Pixel 7 / Modern** | Portrait | `412 × 915` | `phone` | Full portrait RPG stage, generous safe area spacing, independent multi-touch |
| **Google Pixel 7 / Modern** | Landscape | `915 × 412` | `phone` | Landscape Companion Screen only; upright prompt; safe pause |
| **iPhone 14 Pro Max** | Portrait | `430 × 932` | `phone` | ~124px joystick base, 52px thumb knob, natural wall sliding on diagonal input |
| **iPhone 14 Pro Max** | Landscape | `932 × 430` | `phone` | Landscape Companion Screen only; zero tablet/desktop collision |
| **Desktop Studio** | Landscape | `1366–1920px` | `desktop` | Joystick hidden; WASD and Arrow keys drive unified movement pipeline |

---

## 4. Controls Guide

### Mobile Phone Portrait (On-Screen Touch Controls)
- **Movement (Left Thumb):** Touch and drag the **circular analog joystick** in the lower-left thumb zone (`touch-action: none`). Dragging further moves Alex faster; releasing stops movement immediately.
- **Action / Talk (Right Thumb):** Tap the large circular `[ 💬 ACTION ]` button (68px) in the lower-right thumb zone.
- **Emote (Right Thumb):** Tap `[ 🙏 ]` (44px) above the Action button to display a prayer bubble over the avatar.
- **Simultaneous Play (Multi-Touch):** Steer Alex with your left thumb while simultaneously tapping Action or Emote with your right thumb.
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
- Previous prototypes (Phase 0.7 on 8087, Phase 0.8 on 8088, Phase 0.9 on 8089, Phase 0.10 on 8090, Phase 0.11 on 8091, Phase 0.12 on 8092, Phase 0.12.1 on 8093) remain fully operational and unmodified.
