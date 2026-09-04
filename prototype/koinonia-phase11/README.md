# KOINONIA — Phase 0.11 Prototype
**Responsive Game Shell + Mobile Landscape Play Mode + Desktop Layout Repair**  
*KOINONIA — Fire of God Ministries Virtual Community*

> *"A virtual world that grows when you grow in real life."*

---

## 1. Executive Summary & Problems Resolved

Phase 0.11 executes a structural architectural overhaul to eliminate the three layout defects identified by the Product Owner during real-device testing of Phase 0.10:

1. **Problem 1 (Phone Landscape Void):**  
   - *Previous:* Canvas was locked to a fixed 800×576 aspect ratio, leaving a massive black void on widescreen mobile displays (~350px on iPhone/Android landscape).
   - *Solution:* Active mobile RPG gameplay is now **Landscape-First**. The game canvas expands to 100% of the viewport. A dynamic **Responsive Camera Viewport** follows the avatar, rendering environmental surroundings and eliminating black voids.
2. **Problem 2 (Phone Portrait Squeeze):**  
   - *Previous:* Forcing the 2D RPG canvas into a 390px portrait viewport produced an unreadable, squeezed box with clunky controls.
   - *Solution:* Portrait mode is now dedicated to **Browsing & Preparation** (World Map, Quests, Campaigns, Journey, Profile). When the Home/Play tab is active in portrait, a polished **Koinonia Play Card** appears with a prominent `[ 🌿 ENTER WORLD ]` CTA. Tapping this prompts an animated **Rotate to Play** experience, which automatically transitions to active gameplay the instant the phone is rotated sideways.
3. **Problem 3 (Desktop Right-Side Black Void):**  
   - *Previous:* Fixed-width desktop layout left enormous unused black space on modern 1080p and 1440p displays.
   - *Solution:* The desktop application shell is now centered (`max-width: 1560px; margin: 0 auto;`) on a warm neutral background (`#EFE8DF`). A responsive 3-column grid (`clamp(250px, 18vw, 300px)` left, `minmax(0, 1fr)` center, `clamp(280px, 21vw, 340px)` right) allows the center game canvas to expand dynamically to fill the available space.

---

## 2. Quick Start & Testing Instructions

### Method 1: Local HTTP Test Server (Port 8091)
Run the dedicated test server for Phase 0.11:
```bash
python3 -m http.server 8091 --bind 127.0.0.1 --directory prototype/koinonia-phase11/
```
Open in your browser:
```
http://127.0.0.1:8091
```

### Method 2: Direct File Open
Open directly in any modern browser without needing server build steps:
```
file:///home/raspi4/koinonia-quest/prototype/koinonia-phase11/index.html
```

### Method 3: Run Automated Test Suite
```bash
node prototype/koinonia-phase11/test_phase11_suite.js
```

---

## 3. Recommended Real-Device Viewport Testing

| Device Category | Viewport Dimension | Target Behavior |
|---|---|---|
| **Phone Portrait** | `390 × 844` (iPhone) / `360 × 800` (Android) | Koinonia Play Card, clean browsing, bottom nav active, zero squeezed canvas |
| **Phone Landscape** | `844 × 390` / `800 × 360` / `932 × 430` | Full-screen RPG game, on-screen D-Pad and Action button, compact HUD bar, 0 black voids |
| **Tablet Portrait** | `768 × 1024` | Application shell with Play Card |
| **Tablet Landscape**| `1024 × 768` | 2-column or 3-column layout with expanding canvas |
| **Desktop Standard**| `1366 × 768` / `1440 × 900` | 3-column multi-pane studio, expanding center canvas, centered shell |
| **Desktop Wide**    | `1920 × 1080` / `2560 × 1440` | Centered 1560px container on warm neutral background, 0 black margins |

---

## 4. Controls Guide

### Mobile Phone Landscape
- **Movement:** Touch and drag the 4-way virtual D-Pad on the lower-left thumb area.
- **Action / Talk:** Tap the large circular `[ ACTION ]` button on the lower-right thumb area.
- **Emote:** Tap `[ 🙏 ]` on the right side above the Action button.
- **Menu / Exit:** Tap `[ ☰ MENU ]` in the compact header to pause and browse quests.

### Desktop / Keyboard
- **Movement:** `W, A, S, D` or Arrow Keys.
- **Interact / Action:** `E` or `Spacebar`.

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
- Previous prototypes (Phase 0.7 on 8087, Phase 0.8 on 8088, Phase 0.9 on 8089, Phase 0.10 on 8090) remain fully operational and unmodified.
