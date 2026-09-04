# KOINONIA — Phase 0.9 Standalone Prototype
**Fire of God Ministries Virtual Community**  
*KOINONIA by Fire of God Ministries*

> *"A virtual world that grows when you grow in real life."*

---

## Overview

The **KOINONIA Phase 0.9 Standalone Prototype** integrates the official Fire of God Ministries brand identity into a world-class, mobile-first responsive RPG and virtual community experience. Building directly upon the modular architecture of Phase 0.8, Phase 0.9 establishes mobile phones as the primary device—optimizing for portrait-first interaction while preserving and refining the desktop multi-pane studio experience.

This prototype is completely self-contained within `prototype/koinonia-phase09/` and operates entirely isolated from the Koinonia production application.

---

## Brand Integration & Design System

### 1. Official Color Palette & Derived Pastel Tints
- **Core Flame Brand Colors**:
  - **Flame Gold**: `#FDC63F`
  - **Amber**: `#F99320`
  - **Fire Orange**: `#EB5F12`
  - **Revival Red**: `#D22F0A`
  - **Deep Ember**: `#A10F06`
  - **Burgundy**: `#6A0E04`
  - **Charcoal**: `#262220`
  - **Warm White**: `#FFF9F3`
- **Derived Soft Pastel UI Tints** (for readable card backgrounds, panels, and bottom sheets):
  - **Soft Gold**: `#FFF4CC`
  - **Soft Amber**: `#FFE4C7`
  - **Soft Orange**: `#FFD9C6`
  - **Soft Coral**: `#F8D6CF`
  - **Soft Burgundy Neutral**: `#F2E4E1`

### 2. Typographic Hierarchy
- **Devotional & Reflective**: `EB Garamond`, Georgia, serif (Scripture references, quest reflections, journey quotes, community milestones).
- **Interface & Digital**: `Clear Sans`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif (HUD badges, timers, bottom navigation, scoreboard metrics, buttons).

---

## Mobile-First Responsive UX

### 1. Portrait-First Single-Column Layout
- **Tested Across Standard Mobile Viewports**: 320px (SE), 360px (Android compact), 375px (iPhone mini), 390px (iPhone 14/15/16), 412px (Pixel), 430px (Pro Max).
- **Fixed Top Brand Bar**: Clean, branded header displaying **KOINONIA**, community context (*Fire of God Ministries*), current place badge, Life Point counter, and audio toggle.
- **Glanceable Quest Pill**: Tappable pill banner below the header showing current objective ("Make Your Bed" or "Talk to Uncle Barnaby").
- **Dynamic Camera Tracking Canvas**:
  - Automatically scales to **~1.55x zoom** on mobile portrait so 32×32 pixel sprites remain distinct, readable, and tactile.
  - Smooth camera interpolation with directional lookahead and room-boundary clamping.
  - High-DPI canvas backing store scaling (`window.devicePixelRatio`) prevents blurriness on Retina and OLED screens.
  - Desktop viewports smoothly adapt to display the complete room.
- **5-Tab Bottom Navigation**:
  - `Home`: Returns to active room canvas view.
  - `World`: Opens bottom sheet for 5 canonical places with fast travel and place histories.
  - `Quests`: Lists active and available quests categorized by place and verification type.
  - `Journey`: Displays Alex's 2026 spiritual and community growth archive and campaign readiness.
  - `Me`: Profile, Life Points (+15 earned), badges, and personal sports bests (+3 PB record).
- **Thumb-Zone Touch Controls**:
  - Virtual 4-way D-Pad positioned in the bottom-left thumb zone.
  - Primary Action / Interact button (`E`) and Quick Map button (`M`) positioned in the bottom-right thumb zone.
  - Auto-hides on desktop or when bottom sheets are open.

### 2. Bottom Sheets (Mobile-Native Interaction)
- Replaces jarring desktop-style modal popups with smooth mobile bottom sheets sliding up from the bottom with grab handles:
  - **Quest Detail Sheet**: Life Points reward, verification type, and Accept button.
  - **Dialogue Sheet**: Uncle Barnaby conversational flow with portrait avatar.
  - **Real-World Exit Ramp Sheet**: Encourages youth to put down the screen and complete real-world tasks ("Make Your Bed").
  - **Verification Flow**: Parent/guardian handoff card for family verification.
  - **Reflection & Celebration**: Post-quest devotional reflection and celebration card.
  - **Campaign Readiness Dashboard**: 7-day Gratitude Week countdown (79% community readiness).
  - **Sports & PB Scoreboard**: FOG Basketball Day (68–62) and Personal Best records.

### 3. Koinonia Studio: 7-Step Mobile Wizard
- Administrative world-building redesigned for mobile viewports as a clean 7-step sequential wizard:
  - **Step 1**: Place Identity (Title, Slug, Community Context).
  - **Step 2**: Template Selection (Hearth, Sanctuary, Learning Hall, Court, Mission Tent).
  - **Step 3**: Zone Configuration (Walkable, Interactive, Gathering, Quiet).
  - **Step 4**: Component Placement (NPCs, Furniture, Signboards, Decor).
  - **Step 5**: Quest Association (Assign real-world quests to place).
  - **Step 6**: Live Preview (Visual verification of place parameters).
  - **Step 7**: Save & Publish (Validation and persistent JSON export).

### 4. Preserved Desktop Experience
- On screens `≥ 1024px`, the layout seamlessly adapts into the **Multi-Pane Studio Layout**:
  - Left Sidebar: World Map, Navigation, and Quick Travel.
  - Center: Full-fidelity 800×576 2D Canvas viewport.
  - Right Sidebar: Active Quests, Campaign Readiness, Sports Scoreboard, and Journey Milestones.

---

## Running the Prototype

Start the local HTTP test server on dedicated port **8089**:
```bash
python3 -m http.server 8089 --bind 127.0.0.1 --directory prototype/koinonia-phase09/
```

Access in your browser:
```
http://localhost:8089/
```

---

## Controls

- **Desktop Movement**: Arrow Keys or `W`, `A`, `S`, `D`.
- **Interact / Action**: `Space` or `E` key (talk to NPCs, inspect objects).
- **World Map**: Bottom tab **World** or `M` key.
- **Quests**: Bottom tab **Quests** or `Q` key.
- **Audio Toggle**: Ambient audio is **MUTED BY DEFAULT** on first launch; tap the speaker icon in the top bar to enable.
- **Mobile Touch Controls**: Touch virtual D-Pad and Action buttons directly on touchscreens.

---

## Launch Safety Compliance

This prototype adheres strictly to the Koinonia Launch Safety rules:
- Zero modifications to `/home/raspi4/fog-portal-staging`.
- Zero modifications to production source code, `server.js`, SQLite databases, or `.env`.
- Phase 0.7 (`prototype/koinonia-quest-phase07/` on port 8087) and Phase 0.8 (`prototype/koinonia-phase08/` on port 8088) remain 100% intact and runnable side-by-side.
- Temporary testing server runs on dedicated port **8089**.
