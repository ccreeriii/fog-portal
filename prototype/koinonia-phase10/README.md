# KOINONIA — Phase 0.10 Standalone Prototype
**Fire of God Ministries Virtual Community**  
*KOINONIA by Fire of God Ministries*

> *"A virtual world that grows when you grow in real life."*

---

## Overview

The **KOINONIA Phase 0.10 Standalone Prototype** is a **Mobile Rescue + Brand-Accurate Game-First UX** redesign responding directly to real-device Product Owner feedback on Phase 0.9.

### Key Corrections in Phase 0.10:
1. **GAME FIRST, PANELS SECOND**: The 2D world map and character avatar are immediately front-and-center upon launching in mobile portrait. The experience feels like a mobile game/community app first, not a dense dashboard.
2. **Phase 0.8 Playability Baseline Restored**: Recovered the clean presentation, crisp tile-based rendering, natural movement, and immediate spatial immersion of Phase 0.8.
3. **Official Koinonia Brand Integration**: Features the official logo asset, flame color palette (`#FDC63F`, `#F99320`, `#EB5F12`, `#D22F0A`, `#A10F06`, `#6A0E04`, `#262220`, `#FFF9F3`), soft pastel UI tints (`#FFF4CC`, `#FFE4C7`, `#FFD9C6`, `#F8D6CF`, `#F2E4E1`), and `EB Garamond` / `Clear Sans` typography.
4. **Compact Non-Bloated Top Bar (48px)**: Compact logo image + wordmark + subtitle, LP pill (`🪙 120 LP`), audio toggle, reset, and studio admin gear. No oversized text blocks.
5. **Secondary Content Restructured**: Pilgrim Profile, Skill Garden, Pilgrim's Ledger, Campaigns, and History have been moved out of the primary viewport into:
   - Off-canvas sliding drawers
   - 5-tab bottom navigation (`Home`, `World`, `Quests`, `Journey`, `Me`)
   - Collapsible accordion sections
   - Slide-up bottom sheets
6. **Landscape Ergonomics**: Reduced font sizes, tightened loose spacing, made canvas dominant across the width, and eliminated giant empty margins.
7. **Desktop Multi-Pane Studio Preserved**: On screens `≥ 1024px`, the 3-pane layout (Left Profile, Dominant Center Canvas, Right Ledger) is preserved with clean brand hierarchy.

---

## Running the Prototype

Start the local HTTP test server on dedicated port **8090**:
```bash
python3 -m http.server 8090 --bind 127.0.0.1 --directory prototype/koinonia-phase10/
```

Access in your browser:
```
http://localhost:8090/
```

---

## Mobile Controls & Interaction

- **Virtual D-Pad**: Positioned in the bottom-left thumb zone for comfortable 4-way movement.
- **Action Button (`Talk / Act`)**: Positioned in the bottom-right thumb zone to interact with NPCs (Uncle Barnaby) and objects.
- **Desktop Keyboard**: Arrow Keys or `W`, `A`, `S`, `D` to move; `Space` or `E` to talk/interact.
- **Bottom Navigation Tabs**:
  - `Home`: Returns to active 2D game canvas.
  - `World`: Opens Places of Fellowship with fast travel across 5 canonical places.
  - `Quests`: Opens Quests ledger with collapsible Place Callings, Gratitude Week 79% readiness, and AYS 6-day sequence.
  - `Journey`: Opens Alex's 2026 Personal Journey Archive & Milestones timeline.
  - `Me`: Opens Pilgrim Profile, Skill Garden, Sports PB records (+3 PB), and Admin Studio access.
- **Audio Policy**: Muted by default on initial launch; tap the speaker icon in the header to enable synthesized sound cues.

---

## Launch Safety Compliance

This prototype adheres strictly to the Koinonia Launch Safety rules:
- Zero modifications to `/home/raspi4/fog-portal-staging`.
- Zero modifications to production source code, `server.js`, SQLite databases, or `.env`.
- Phase 0.7 (`prototype/koinonia-quest-phase07/` on port 8087), Phase 0.8 (`prototype/koinonia-phase08/` on port 8088), and Phase 0.9 (`prototype/koinonia-phase09/` on port 8089) remain 100% intact and runnable side-by-side.
- Phase 0.10 operates isolated on dedicated port **8090**.
