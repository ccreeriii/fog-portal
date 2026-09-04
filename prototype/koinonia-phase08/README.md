# KOINONIA — Phase 0.8 Standalone Prototype
**"by Fire of God Ministries"**

*A virtual world that grows when you grow in real life.*

---

## Overview

The **KOINONIA Phase 0.8 Standalone Prototype** expands upon the Phase 0.7 single-room slice into a modular, multi-place virtual world featuring place-specific quests, seasonal campaigns, sports scoreboards with personal best tracking, event memories, a personal journey archive, place history, and an administrative **Koinonia Studio** with no-code Place and Quest builders.

This prototype is completely self-contained within `prototype/koinonia-phase08/` and operates entirely isolated from the Koinonia production application.

---

## Key Features

### 1. Modular World Architecture
- **5 Canonical Places**:
  1. **My Home** (Permanent) — Cozy Hearth room with Uncle Barnaby, bedside lamp, desk, and Quest #001 flow.
  2. **Fire of God Community Center** (Permanent) — Community Sanctuary with stage, sound booth, and banner.
  3. **School** (Permanent) — Learning Hall with study desks and chalkboards.
  4. **Sports Hub** (Permanent) — Activity court with hoop and sports equipment.
  5. **Outreach Site** (Temporary Lifecycle) — Mission tent and hospitality packing station.
- **World Map Navigation**: Instant place-to-place fast travel with connectivity validation.
- **Place History**: Chronological log of real-world community events, service projects, and milestones tied to each location.

### 2. Campaigns & Event Build-Up
- **Get Into the Glory (Gratitude Week)**: 7-day community-wide campaign with a live **Community Readiness Dashboard** across 5 teams (Hospitality 72%, Music 85%, Prayer 67%, Tech 94%, Attendance 78% → **79% overall community readiness**).
- **AYS: Week of Questions**: 6-day youth ministry campaign building anticipation for Saturday evening service.
- **Responsibility Growth Path**: 5-day sequential journey without streak-punishment mechanics.

### 3. Sports Activities & Personal Best Tracking
- **FOG Youth Basketball Day**: Event memory with official scoreboard (Team Fire 68 - Team Grace 62), top scorers (Alex 24 pts), MVPs, and sportsmanship recognitions.
- **Personal Best (PB) System**: Track, compare, and log personal records across sports (e.g. Free Throws 12/20 → 15/20 = +3 PB, Badminton rally, Mile run).

### 4. Event Memories & Personal Journey Archive
- **Event Memories Gallery**: Photo cards with warm captions and community tags from community life.
- **Personal Journey Archive**: Chronological timeline of Alex's spiritual, personal, and community milestones across 2026.

### 5. Admin Koinonia Studio (No-Code Builders)
- **Place Builder**: Create new world locations with customizable zone types, lifecycles, and initial components.
- **Quest Builder**: Author new place-specific real-world quests with verification types (`TRUST`, `FAMILY`, `LEADER`, `EVENT`, `SYSTEM`), Life Point / XP rewards, and community goal contributions.
- **Strict Data-Driven Design**: No `eval`, no runtime script injection, no arbitrary code execution. All modifications populate pure JSON data models.

### 6. Architectural Principles
- **Single-Community First, Multi-Community Ready**: Fire of God (`fog`) is the sole active community context. Every place, quest, and campaign model includes internal `communityId: 'fog'` ready for future multi-tenancy without user-facing complexity.
- **Handcrafted Hearth Aesthetic**: Warm pixel art aesthetic, rich tactile UI, muted audio by default, desktop multi-pane studio layout, and mobile thumb zone touch controls.

---

## Running the Prototype

Start the local HTTP test server:
```bash
python3 -m http.server 8088 --bind 127.0.0.1 --directory prototype/koinonia-phase08/
```

Access in your browser:
```
http://localhost:8088/
```

---

## Controls

- **Desktop Movement**: Arrow Keys or `W`, `A`, `S`, `D`.
- **Interact / Action**: `Space` or `E` key (talk to NPCs, inspect objects).
- **World Map**: Click the **World Map** HUD button or press `M`.
- **Campaigns & Readiness**: Click the **Campaigns** HUD button or view sidebar.
- **Sports & Personal Bests**: Click the **Sports** HUD button or view sidebar.
- **Memories & Journey**: Click the **Memories** HUD button or view sidebar.
- **Admin Studio**: Click the **Admin Studio** button to open Place & Quest Builders.
- **Mobile Controls**: On-screen directional pad and Action / Interact touch buttons.
- **Audio Toggle**: Ambient audio is muted by default on launch; click the Audio button to toggle.

---

## Launch Safety Compliance

This prototype adheres strictly to the Koinonia Launch Safety rules:
- Zero modifications to `/home/raspi4/fog-portal-staging`.
- Zero modifications to production source code, `server.js`, databases, or `.env`.
- Phase 0.7 prototype preserved untouched in `prototype/koinonia-quest-phase07/`.
- Temporary testing server runs on dedicated port 8088.
