# Koinonia Quest — Phase 0.7 Standalone Playable Prototype

**Visual Identity:** The Handcrafted Hearth  
**Target Viewport:** 360–430px Mobile (Primary) & 1024px+ Multi-Pane Studio  
**Engine:** Zero-dependency HTML5 2D Canvas & Web Audio API synthesis  
**Status:** Standalone Experience Validation & Visual Prototype  

---

## 1. Prototype Overview & Launch Safety

This is the **Phase 0.7 Standalone Visually Playable Prototype** for **Koinonia Quest** (*"A virtual world that grows when you grow in real life"*).

> [!IMPORTANT]
> **Production Launch Isolation**:
> - This prototype uses **100% fake in-memory browser data**.
> - It is **completely isolated** from the production Koinonia application scheduled for launch next week.
> - **Zero connection** to SQLite databases (`fog_community.db`), production authentication, PM2 processes, or real Life Point ledgers.
> - No external npm packages, CDNs, or frameworks are required.

---

## 2. How to Launch & Run the Prototype

The prototype is completely self-contained. It can be opened directly or served over a temporary local static server:

### Option A: Local Python Test Server (Recommended)
From the repository root, start a lightweight static server bound to localhost on port `8087`:

```bash
python3 -m http.server 8087 --directory prototype/koinonia-quest-phase07/
```

Then open your browser to:
```
http://localhost:8087
```

### Option B: Direct Browser Open
Open `prototype/koinonia-quest-phase07/index.html` directly in any modern desktop or mobile browser (Chrome, Safari, Firefox, Edge).

---

## 3. Supported Controls

### Desktop Controls
- **Movement:**
  - `W` / `A` / `S` / `D` keys or `Arrow Keys` (Up, Down, Left, Right)
  - **Click-to-Move:** Click anywhere on the 2D Canvas to walk directly toward that point
- **Interaction:**
  - `E` or `Spacebar`: Talk to Uncle Barnaby when in proximity
  - Clicking on Uncle Barnaby directly initiates conversation
- **Side Panel Toggles:**
  - `[ 👤 Pilgrim ]` or `[ ◀ ]`: Collapse / expand the Left Profile & Skill Garden panel
  - `[ 📜 Ledger ]` or `[ ▶ ]`: Collapse / expand the Right Quest & Community Pool panel
- **Emotes:** Click any emote in the top-right overlay (`👋`, `❤️`, `🙏`, `💡`, `👍`, `🌱`)

### Mobile / Touch Controls
- **Virtual D-Pad:** On-screen directional buttons at the bottom thumb zone
- **Action Button:** Large circular `[ 💬 Talk / Act ]` button
- **Tap-to-Move:** Tap anywhere on the canvas to walk
- **Drawer Panels:** Swipe or tap `[ 👤 ]` and `[ 📜 ]` to open sliding side panels

---

## 4. Completed 18-Point Gameplay Flow

Experience the complete domestic stewardship loop:

1. **Title Screen:** Warm atmospheric splash screen with tagline, `[ BEGIN ADVENTURE ]`, and disabled continue button.
2. **Avatar Setup:** Choose from 4 skin tones, 4 hairstyles, and 3 clothing palettes with live canvas preview (Identity: *Alex*).
3. **Home Exploration:** Move through the Bedroom, Living Area, Kitchen, and step onto the Veranda.
4. **Uncle Barnaby Interaction:** Approach Uncle Barnaby by the garden railing; experience the typewriter dialogue tree.
5. **Quest #001 Card:** View *"Steward of the Garden"* (+5 LP, +5 Char XP, +15 Stew XP, +5 Resp XP) with household fallback.
6. **Signature Exit-Ramp:** Screen dims into calming twilight indigo: *"YOUR TURN — IN THE REAL WORLD. The next part of this adventure doesn't happen on this screen."*
7. **Standby Screen:** Minimalist *"MISSION IN PROGRESS"* card with resting avatar and zero FOMO/timers.
8. **Return Flow:** Tap `[ I'M BACK ]` when real-world chore is finished.
9. **Verification Simulation:** Compare **Trust (Honor System)** vs **Family Demo (Direct device handoff to parent)**.
10. **Reflection Journal:** Enter a short sentence in the reflection box (*"One small thing I noticed while doing this was..."*).
11. **Non-Casino Rewards:** Gentle warm light, floating leaves, and transparent reward ledger (+5 LP, +5 Char XP, +15 Stew XP, +5 Resp XP).
12. **Community Garden Contribution:** View shared FOG Community Garden meter update (+15 contribution, 142 → 157 / 500).
13. **Environmental Transformation:** Return to Canvas to see dry soil become rich dark loam, wilted plant blossom into healthy foliage, and a new green seedling sprout!
14. **Gate Unlocks:** Garden gate latch clicks open, unblocking the country path to the north.
15. **FOG Center Teaser:** Walk north through the open gate to see the distant FOG Community Center horizon teaser.
16. **Skill Garden Growth:** Inspect Left Sidebar to see botanical XP meters for Stewardship and Responsibility.
17. **Life Points Progression:** Secondary LP balance updates from 120 → 125 LP.
18. **Reset Prototype:** Tap `[ 🔄 Reset ]` anytime in the top bar to restore all states for fresh testing.

---

## 5. Audio Policy

- **Muted by Default:** In accordance with Product Owner decisions, audio is strictly muted on initial load.
- **Audio Toggle:** Tap `[ 🔈 Muted ]` in the top bar to toggle audio on (`🔊 Sound On`).
- **Web Audio Synthesis:** Uses 100% client-side synthesized acoustic chords and wooden clicks. No external audio files are downloaded.
- **Non-Audio Redundancy:** All progress and prompts have clear visual notifications.

---

## 6. Known Prototype Limitations

- **Phase 0.7 Scope:** This vertical slice is dedicated to validating the first domestic gameplay loop and environmental storytelling.
- **Single Map:** The FOG Community Center and broader town map will be built in subsequent phases.
- **In-Memory Only:** Refreshing the browser or clicking Reset restores initial test values (no server persistence).
- **Single NPC:** Uncle Barnaby is the primary active mentor in this domestic slice.
