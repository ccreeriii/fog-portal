# KOINONIA — Phase 0.12 Prototype
**Portrait-First Mobile Gameplay + Orientation Strategy**  
*KOINONIA — Fire of God Ministries Virtual Community*

> *"A virtual world that grows when you grow in real life."*

---

## 1. Executive Summary & Product Owner Decisions

Phase 0.12 executes a decisive architectural pivot based on direct Product Owner feedback:

1. **Landscape-First Mobile Strategy Cancelled:**  
   - Young players should **NOT** be required to rotate their mobile phones sideways to explore the virtual world.
   - **New Core Principle:** **KOINONIA MOBILE IS PORTRAIT-FIRST** across all experiences: Home, World, Quests, Journey, Profile, Campaigns, Memories, **AND active 2D RPG gameplay**.
2. **Direct Home $\rightarrow$ Enter World Transition:**  
   - The polished Phase 0.11 portrait Home screen design (compact header, hero play card, calling box, stat pills, 5-tab bottom navigation) is preserved.
   - Tapping **`[ 🌿 ENTER WORLD ]`** transitions immediately into a full-stage portrait 2D RPG exploration view—without any rotate modal or forced orientation prompt.
   - A prominent **`[ ✕ EXIT WORLD ]`** button in the header allows young users to smoothly return to the Home card anytime.
   - Bottom navigation automatically hides during active gameplay to maximize vertical canvas height.
3. **Responsive Portrait Camera Viewport:**  
   - The canvas dynamically sizes to `stage.clientWidth × stage.clientHeight × dpr`.
   - The camera centers and smoothly follows the player avatar with boundary clamping and subtle directional lookahead.
   - The logical room flows naturally vertically: Bedroom $\rightarrow$ Living / Hearth Elder $\rightarrow$ Veranda $\rightarrow$ Garden $\rightarrow$ Gate.
4. **Paused Landscape Companion Screen:**  
   - Mobile phone landscape is intentionally **not** an active game orientation.
   - If a mobile phone is turned to landscape, active gameplay safely pauses and displays a branded Companion Screen:
     - `↻ Turn your phone upright to play`
     - Quick summary cards: Current Place, Active Quest, Life Points, Today's Focus.
   - Returning the phone upright instantly auto-resumes gameplay at the exact same player coordinates.
5. **Safari & VisualViewport Resilience:**  
   - Automatically adapts to Safari address bar collapse and expansion using `window.visualViewport` listeners and `--app-height` CSS custom properties.
6. **Desktop 3-Column Studio Preserved:**  
   - Centered 1560px max shell on warm `#EFE8DF` neutral body, expanding center stage, zero black voids.
7. **Approved Quest #001 Rewards:**  
   - Strictly **+5 LP** (Initial: 120 LP $\rightarrow$ After Quest: **125 LP**; strictly no +15 LP reward).
   - +5 Character XP, +15 Stewardship XP, +5 Responsibility XP, unlocking lush blooming garden and gate.

---

## 2. Quick Start & Testing Instructions

### Method 1: Local HTTP Test Server (Port 8092)
Run the dedicated test server for Phase 0.12:
```bash
python3 -m http.server 8092 --bind 127.0.0.1 --directory prototype/koinonia-phase12/
```
Open in your browser:
```
http://127.0.0.1:8092
```

### Diagnostic Debug HUD Mode
Append `?debug=1` to observe live viewport dimensions, camera coordinates, visible tile counts, zoom factor, and orientation state:
```
http://127.0.0.1:8092/?debug=1
```

### Method 2: Direct File Open
Open directly in any modern browser without needing a server:
```
file:///home/raspi4/koinonia-quest/prototype/koinonia-phase12/index.html
```

### Method 3: Run Automated Test Suite
```bash
node prototype/koinonia-phase12/test_phase12_suite.js
```

---

## 3. Real-Device Viewport Testing Guide

| Device / Viewport | Dimensions | Mode & Experience |
|---|---|---|
| **iPhone 12 / 13 / 14 / 15 Pro** | `390 × 844` | **Portrait Active RPG**: Zoom ~1.35x, ~9 tiles wide × ~18 tiles tall visible. D-Pad & Action buttons active. |
| **iPhone 8 Plus / SE** | `414 × 736` | **Portrait Active RPG**: Full stage, bottom nav hidden during play, exit world header button. |
| **Samsung Galaxy S20 / S22** | `360 × 800` | **Portrait Active RPG**: Fluid responsive vertical camera following. |
| **Google Pixel 7 / Pro** | `412 × 915` | **Portrait Active RPG**: Generous vertical viewing of bedroom, veranda, and garden. |
| **Mobile Phone Landscape** | `844 × 390` / `932 × 430` | **Paused Companion Screen**: Prompts user upright; displays Place, Quest, LP, and Virtue cards. |
| **Tablet Portrait** | `768 × 1024` | Fluid portrait shell with Home Play Card and active gameplay stage. |
| **Tablet Landscape** | `1024 × 768` | 2-column layout with expanding canvas stage. |
| **Desktop Standard / Wide** | `1440 × 900` / `1920 × 1080` | 3-Column Studio: Left profile, Center expanding canvas (~960px), Right ledger, centered 1560px shell. |

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
- Previous prototypes (Phase 0.7 on 8087, Phase 0.8 on 8088, Phase 0.9 on 8089, Phase 0.10 on 8090, Phase 0.11 on 8091) remain fully operational and unmodified.
