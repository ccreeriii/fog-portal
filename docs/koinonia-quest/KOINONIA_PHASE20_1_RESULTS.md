# KOINONIA — PHASE 0.20.1 RESULTS REPORT
## Game Consolidation, Physical UX Polish, Official Branding & PWA Implementation

---

### Executive Overview

- **Phase**: 0.20.1
- **Focus**: Game Consolidation, Physical UX Polish, Official Branding, Restored My Profile Access, Level Simplification & PWA Implementation
- **Approved Architecture**: Two experiences (Main FOG App & Koinonia), one community (Fire of God), one member account, one shared core data source of truth.
- **Implementation Status**: **COMPLETE** (387 / 387 tests passing in `test_phase20_1_suite.js`).
- **Regression Status**: **100% PASSING** across all 4 prior phases:
  - Phase 20: 315 / 315 passing
  - Phase 19: 235 / 235 passing
  - Phase 18: 201 / 201 passing
  - Phase 17: 120 / 120 passing
- **Restored My Profile / Me Access**:
  - **Tappable Level & LP Header Trigger (`#header-profile-trigger`)**: The header status area (`LV 2` and `🪙 135 LP`) is a unified, accessible interactive trigger (`role="button"`, `aria-label="View My Profile"`) opening My Profile (`#me-modal`) directly with zero extra header icons, preserving banner space.
  - **Settings Profile Summary (`#settings-profile-summary`)**: Added a compact member identity card at the very top of the Settings bottom sheet with member avatar, display name (`Alex Rivera`), level (`LV 2`), LP (`🪙 135 LP`), and a prominent `VIEW MY PROFILE` action button.
  - **Current Member Identity & Community Status**: Preserved and populated all available canonical member data in `#me-modal`: avatar (`🧑`), display name (`Alex Rivera`), member handle (`youth_demo_01 • @alex_r`), level & rank title (`Level 2 • Active Explorer`), community role (`Role: Member`), campfire membership (`Fire of God Alpha Seed`), ministry membership (`Seraphs Music Ministry`), bio (`"Young Pilgrim walking in faith and stewardship."`), Character XP bar (`15 / 20 XP`), and LP balance (`135 LP`).
  - **Profile vs Journey Separation**: Maintained strict architectural separation: My Profile (`#me-modal`) represents current member identity and flourishing status, while Journey (`#journey-modal`) tracks historical progression, memories, place history, and reflections over time.
  - **Role-Based Admin Access Gating**: Studio Admin in Settings (`#settings-item-admin`) and Profile (`#btn-open-admin-from-me`) is strictly restricted to authorized admin/superadmin roles. Normal members (`role: 'MEMBER'`) cannot see Studio Admin.
- **Canonical Terminology Alignment**:
  - `FAITH QUEST CHALLENGE` (compact UI: `FAITH QUEST`, spelling: F-A-I-T-H): Established Bible / catechism / faith-oriented challenge game from the Main FOG App (`/?faith=quest`). Integrated inside the unified `FOG GAMES` destination alongside `FOG ARCADE`.
  - `SPORTS HUB` (compact nav: `Sports`, 🏃): Dedicated physical sports and fitness destination (basketball, running, badminton, pickleball, active motion drills, personal bests). All visible Faith Quest and legacy Fit Quest wording removed.
- **Top Header Cleanup & Official Branding Replacement**:
  - Replaced old/generated header branding (old icon, standalone "K" mark, "KOINONIA" text, and "by Fire of God Ministries" subtitle) with the official crisp banner logo (`assets/branding/koinonia-header-logo.png` / `koinonia-logo-banner.png`).
  - Simplified Level Indicator: removed star icon (`⭐`), replaced with compact text indicator (`LV 1`, `LV 2`, `LV 3`), with LP pill (`🪙 135 LP`) beside it.
  - Moved Audio + Reset to Settings: removed visible volume/mute button, reset prototype button, and studio admin button from the top header. Replaced with a single settings gear button (`#header-settings-btn`, `⚙️`) opening a compact, mobile-friendly bottom sheet (`#settings-modal`).
  - Mobile portrait first layout: Guaranteed clean fit on 360px–414px viewports without wrapping or overlapping.
- **Campfire Bottom Sheet Flicker Fix**:
  - Resolved bottom sheet animation conflict in `styles.css`. Removed `.circle-bottom-sheet` properties `left: 50%; transform: translateX(-50%)` which conflicted with `.bottom-sheet` `animation: slideUpSheet` (causing a right-shifted visual flash on entry). Replaced with centered `position: relative; margin: 0 auto; max-width: 540px; animation: slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1);`.
- **Campfire + Quest Circles Unification**:
  - Unified into a single authoritative roster (`Campfire.memberIds`). Removed redundant Quest Circles card (`#portrait-circles-card`) below Gatherings & Campaigns Hub on the home screen while preserving Gatherings & Campaigns Hub (`#portrait-events-card`).
- **Home Destination Grid**:
  - Exactly 6 primary destination cards in a balanced 2 columns × 3 rows grid:
    1. 🔥 CAMPFIRE (`#home-dest-campfire`)
    2. 📜 QUESTS (`#home-dest-quests`)
    3. 📅 EVENTS (`#home-dest-events`)
    4. 🎮 FOG GAMES (`#home-dest-games`) — Faith Quest Challenge + FOG Arcade
    5. 🏃 SPORTS HUB (`#home-dest-sports`) — Physical sports, active drills, personal bests
    6. 📖 JOURNEY (`#home-dest-journey`) — Faith milestones, memories, scrapbook
- **Bottom Navigation**:
  - Exactly 7 primary tabs: `Home`, `Campfire`, `Quests`, `Events`, `Games`, `Sports`, `Journey`.
- **Official Branding & PWA Implementation**:
  - Sourced from read-only master artwork in `branding-source/` (`koinonia-icon.png` 591×591, `koinonia-logo-banner.png` 1920×576).
  - Generated 7 production-grade optimized branding assets in `prototype/koinonia-phase20_1/assets/branding/`.
  - Created standalone PWA Web App Manifest (`prototype/koinonia-phase20_1/manifest.json`) with theme color `#6A0E04` and background color `#FDFBF7`.
  - Configured `index.html` `<head>` with favicons, apple touch icon, manifest, and mobile web app meta tags.
- **Staging Safety**: **READ-ONLY AUDIT STRICTLY MAINTAINED**. Zero files modified in `/home/raspi4/fog-portal-staging`. Database, PM2, and environment untouched.
- **Product Owner Physical Acceptance**: **PENDING** (ready for physical device verification).

---

### 1. Read-Only Main-App Overlap Inventory

The read-only audit of `/home/raspi4/fog-portal-staging` cataloged the following domain overlaps and mappings:

| Data Domain | Main App Staging Implementation | Koinonia Implementation | Target Shared Core Alignment |
|---|---|---|---|
| **Member Identity** | SQLite `youth` & `users` tables | Local Pilgrim Profile (`Alex Rivera`, `youth_demo_01`) | Canonical `youth` table (One Member Account) |
| **Life Points** | `point_transactions`, `gamification_points` | Life Points (`state.lp`, `LocalSharedCoreProvider`) | Canonical ledger with idempotency key |
| **Small Groups** | `small_groups`, `small_group_members`, UI `#groupSpaceTitle` ("🔥 Campfire") | Campfire Unification (`cf_alpha_seed`, 5 members) | Canonical `small_groups` table with `CampfireGameState` |
| **Events** | `events` table (name, date, time, venue, points) | Canonical Event Templates (`events.js`, Asia/Manila) | Shared event ID & schedules |
| **Attendance** | `attendance` table (`youth_id`, `event_id`, UNIQUE) | Check-in adapter (`checkIn()`, idempotency) | Unified check-in record in `attendance` |
| **Ministries** | `ministries`, `ministry_members` tables | Ministry Missions (`MM-001` to `MM-004`) | Shared ministry membership driving missions |
| **Discipleship/Milestones**| `discipleship_pathways`, `member_milestones` | 19 Canonical Milestones (`progression.js`) | Shared milestones catalog & evaluation |
| **Arcade Games** | `public/seeker-arcade.html`, `v8-*`, `v9-*` | `FOG ARCADE` View in `FOG GAMES` Shell (`data/arcade.js`) | Koinonia as primary interactive gameplay home |
| **Faith Quest Challenge** | Main app route `/?faith=quest`, `fq_daily_scores` | `FAITH QUEST` View in `FOG GAMES` Shell (`data/arcade.js`) | Shared daily Bible & catechism challenges |
| **Sports & Fitness** | None in Main App | `SPORTS HUB` Destination (`data/sports.js`, 4 sports, 3 drills) | Dedicated physical health & sports tracking |

---

### 2. Shared-Core Architecture Implemented

- **Module**: `prototype/koinonia-phase20_1/data/shared_core.js`
- **Class**: `LocalSharedCoreProvider`
- **Architecture Principle**:
  - Implements Stage 1 of the migration strategy.
  - Zero external dependencies.
  - Uniform query and mutation interfaces for member identity, Life Points, quests, events, attendance, campfires, ministries, and milestones.
  - Acts as the drop-in boundary that will connect to the HTTP Shared Core API in Stage 4 without rewriting gameplay code.

---

### 3. Campfire Unification & Flicker Fix

- **Module**: `prototype/koinonia-phase20_1/data/campfires.js` & `prototype/koinonia-phase20_1/data/circles.js`
- **One Group Concept**: "Quest Circle" is formally unified into the canonical **Campfire** group concept.
- **Separation of Concerns**:
  - `Campfire` owns identity, name, leaders, member list, capacity, and activation status.
  - `CampfireGameState` references `campfireId` and owns assigned quests, completion progress, positive reactions, and activity log.
  - **No Duplicate Membership**: Member IDs are stored only in `Campfire`, never duplicated in game state.
- **Capacity & Safety Rules**:
  - Minimum activation: 5 participants.
  - Default maximum: 12 participants.
  - Community maximum: Configurable by Admin (default 12).
  - Leader configuration: Leader may set campfire maximum between 5 and community maximum.
  - Over-community rejection: Attempting to set campfire maximum above community maximum is strictly rejected.
  - Active lowering guard: Leader cannot reduce capacity below current active member count (e.g., 4 when 5 members exist).
  - Progress denominator: Uses actual active member count (`memberIds.length = 5`), NOT max capacity (12).
  - Structured reactions only: Predefined encouraging emojis (`👏`, `🙏`, `🔥`, `🌱`, `❤️`). No free-text youth messaging.
- **Flicker Fix**:
  - Removed conflicting `.circle-bottom-sheet` styles in `styles.css`. Sheet now smoothly translates from bottom to center with zero horizontal flicker.

---

### 4. FOG Games: Faith Quest Challenge & FOG Arcade

- **Unified Destination**: `#arcade-modal` provides a unified shell for all Fire of God mini-games and challenges.
- **Segmented Selector**:
  `[ 📖 FAITH QUEST ]   [ 🕹️ FOG ARCADE ]`
- **Faith Quest View** (`#games-view-faithquest`):
  - Deep link to Main App: Direct button to `/?faith=quest`.
  - Interactive Catechism Clash Practice: Local quiz practice awarding +5 LP via `SharedCore` (idempotency protected).
  - 6 Audited Daily Challenges: Catechism Clash, The Narrow Gate, Daily Manna Scramble, Emoji Sermon, Shield of Faith, Fruits of the Spirit.
  - Rules & Leaderboard Note: 3 daily attempts, 100 max points, reset at midnight Asia/Manila.
- **FOG Arcade View** (`#games-view-arcade`):
  - 5 Biblical physics mini-games: David's Slingshot, Noah's Ark, Moses' Red Sea, Peter's Leap, Jonah's Dive.
  - 9 Growth and fellowship games: Catechism Clash, Daily Manna, Emoji Sermon, The Narrow Gate, Shield of Faith, Who Am I?, Would You Rather, Verse Chain, Group Clash Live Trivia.

---

### 5. Sports Hub (Physical Sports & Fitness)

- **Modal Title**: `🏃 SPORTS HUB`
- **Subtitle**: `Sports, Fitness & Personal Bests • Active Challenges`
- **Clean Separation**: Dedicated entirely to physical fitness, sports, and active drills. Zero references to Faith Quest or legacy Fit Quest in visible UI.
- **5 Navigation Tabs**:
  1. `Active Drills`: Motion-based reaction and timing drills (Free Throw Focus, Sprint Intervals, Rally Drills).
  2. `Real-World Sports`: Basketball, Running, Badminton, Pickleball session logging.
  3. `My Bests`: Personal best records with timestamps and metrics.
  4. `Leaderboard`: Safe local leaderboard by active minutes and drill completions.
  5. `History`: Chronological session history.

---

### 6. Official Branding & PWA Implementation

#### Optimized Assets Generated on Disk
All assets were resampled using separable area-averaging with premultiplied alpha from master artwork in `branding-source/`:

| File Path | Dimensions | File Size | MIME Type | Purpose |
|---|---|---|---|---|
| `assets/branding/favicon-32x32.png` | 32×32 | 2,122 B | `image/png` | Standard browser tab favicon |
| `assets/branding/favicon.ico` | 32×32 | 2,144 B | `image/vnd.microsoft.icon` | Legacy browser & bookmark icon |
| `assets/branding/apple-touch-icon.png` | 180×180 | 40,651 B | `image/png` | iOS Home Screen bookmark icon |
| `assets/branding/icon-192.png` | 192×192 | 45,579 B | `image/png` | Android PWA standard launcher icon |
| `assets/branding/icon-512.png` | 512×512 | 260,603 B | `image/png` | High-res PWA splash & store icon |
| `assets/branding/icon-maskable-512.png` | 512×512 | 145,011 B | `image/png` | Android adaptive icon (75% safe-zone margin on `#FFF9F3`) |
| `assets/branding/koinonia-header-logo.png` | 640×192 | 102,679 B | `image/png` | 3:1 integer downscaled crisp header banner |
| `assets/logo.png` | 192×192 | 45,579 B | `image/png` | Backward-compatible fallback logo |

#### PWA Web App Manifest (`manifest.json`)
```json
{
  "name": "Koinonia — Fire of God Ministries",
  "short_name": "Koinonia",
  "description": "Fire of God Ministries Virtual Community, Quests, Campfires & Fellowship",
  "start_url": "index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FDFBF7",
  "theme_color": "#6A0E04",
  "icons": [
    {
      "src": "assets/branding/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "assets/branding/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "assets/branding/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

#### HTML `<head>` Integration in `index.html`
- `<link rel="icon" type="image/x-icon" href="assets/branding/favicon.ico">`
- `<link rel="icon" type="image/png" sizes="32x32" href="assets/branding/favicon-32x32.png">`
- `<link rel="apple-touch-icon" sizes="180x180" href="assets/branding/apple-touch-icon.png">`
- `<link rel="manifest" href="manifest.json">`
- `<meta name="theme-color" content="#6A0E04">`
- `<meta name="mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="Koinonia">`
- Header brand group updated with the official banner logo (`assets/branding/koinonia-header-logo.png`).

#### Header Layout & Settings Modal Architecture
1. **Header Layout (Mobile-Portrait First)**:
   - Left brand container (`.header-brand-group`): Displays `<img src="assets/branding/koinonia-header-logo.png" class="brand-header-banner" ...>` with enlarged responsive height (`height: 46px;` default, `height: 44px;` on <= 360px) and `max-height: calc(var(--header-height) - 8px);` leaving comfortable 4px top/bottom margins within a balanced `--header-height: 54px;` header. Sized primarily on height with `width: auto;` (preserving natural 10:3 aspect ratio without distortion or artificial max-width constraints), cleanly presenting the official "KOINONIA by Fire of God Ministries" logo banner with high subtitle readability on physical smartphones.
   - Right status container (`.header-status-group`):
     - `#header-profile-trigger`: Tappable interactive status group (`role="button"`, `tabindex="0"`, `aria-label="View My Profile"`, `title="View My Profile"`) wrapping:
       - `#header-level-pill`: Simplified to `<span id="header-level-text">LV 2</span>` (star icon `⭐` removed).
       - `#lp-pill`: Non-gambling Life Points indicator (`🪙 135 LP`).
     - `#header-settings-btn`: Single compact settings gear button (`⚙️`).
   - Clearances across mobile viewports:
     - 360px: 58.3px clearance
     - 375px: 66.7px clearance
     - 390px: 81.7px clearance
     - 414px: 105.7px clearance
     - Zero overlap, zero clipping, zero wrapping, zero horizontal overflow.
2. **Settings Bottom Sheet (`#settings-modal`)**:
   - Member Identity Summary Card (`#settings-profile-summary`): Positioned at the very top of the settings sheet. Surfaces member avatar (`#settings-profile-avatar`), display name (`#settings-profile-name`), current level (`#settings-profile-level`), and current Life Points balance (`#settings-profile-lp`), with a direct action button: `VIEW MY PROFILE` (`#btn-view-profile-from-settings`). Tapping closes settings and opens My Profile.
   - Audio Mute / Unmute Toggle (`#audio-toggle-btn` with `#audio-icon` 🔊/🔇 and `#audio-label`).
   - Reset Prototype State (`#dev-reset-btn`): Resets state to Canonical QA Baseline (Level 2, 135 LP, 15 XP) and refreshes UI.
   - Studio Admin (`#settings-item-admin`): Gated behind role check (`isAuthorizedAdmin()`). Hidden (`display: none`) for normal members (`role: 'MEMBER'`), visible only for authorized `ADMIN` and `SUPERADMIN` roles.
   - Close Button (`#btn-close-settings`): Neatly closes the bottom sheet.
   - Accessible via backdrop click, Esc key, or close button.

#### Restored My Profile / Me Architecture & Progression Separation
1. **Unified Tappable Status Trigger (`#header-profile-trigger`)**:
   - Level (`LV 2`) and Life Points (`🪙 135 LP`) pills are wrapped in an interactive element with subtle touch feedback and full accessibility attributes (`role="button"`, `aria-label="View My Profile"`).
   - Direct tap opens My Profile (`#me-modal`) without adding extra icons to the compact mobile header.
2. **Settings Profile Summary Integration**:
   - Opening Settings (`⚙️`) immediately displays the current member identity card at the top.
   - Tapping `VIEW MY PROFILE` transitions seamlessly from Settings to the full My Profile view.
3. **Canonical Member Identity & Community Affiliation**:
   - My Profile (`#me-modal`) dynamically populates from the canonical data model:
     - Avatar (`🧑`) and Display Name (`Alex Rivera`).
     - Identity Tag (`youth_demo_01 • @alex_r`) and Community Role (`Role: Member`).
     - Active Campfire Affiliation (`Fire of God Alpha Seed`).
     - Active Ministry Affiliation (`Seraphs Music Ministry`).
     - Member Bio (`"Young Pilgrim walking in faith and stewardship."`).
     - Character Level & Rank Title (`Level 2 • Active Explorer`).
     - Character XP Bar (`15 / 20 XP`) and Life Points Balance (`135 LP`).
4. **Architectural Separation: Profile vs. Journey**:
   - **My Profile (`#me-modal`)**: Current member identity, spiritual flourishing dimensions, campfire & ministry affiliation, and real-time status.
   - **Journey (`#journey-modal`)**: Historical chronological progression, discipleship milestone timeline, place history, memories, and scrapbook reflections over time.
   - Modals are mutually exclusive; opening one cleanly ensures the other is dismissed without collision or modal stacking bugs.
5. **Role-Based Admin Access Gating**:
   - Standard youth members (`role: 'MEMBER'`) cannot see Studio Admin anywhere in the UI (`#settings-item-admin` and `#btn-open-admin-from-me` are hidden).
   - Only authorized roles (`ADMIN` or `SUPERADMIN`) have access to studio administration tools.

---

### 7. Automated Test Suite Results

- **Suite**: `prototype/koinonia-phase20_1/test_phase20_1_suite.js`
- **Total Tests**: **387**
- **Passed**: **387** (100%)
- **Failed**: **0**
- **Sections Covered**:
  1. File & Environment Integrity (16 tests)
  2. Canonical QA Baseline & Member Identity (14 tests)
  3. Shared Core Provider Contracts (34 tests)
  4. Life Points Ledger & Quest Idempotency (16 tests)
  5. Campfire Unification & Capacity Safety (27 tests)
  6. Event Attendance & Check-In Idempotency (10 tests)
  7. Ministry Membership & Mission Discovery (8 tests)
  8. FOG Games: Faith Quest & FOG Arcade Catalogs (12 tests)
  9. Header Branding, 6-Card Grid, 7-Tab Nav, Profile Triggers & Terminology (75 tests)
  10. Mobile Viewport, CSS Integrity, Enlarged Banner & Flicker Fix (25 tests)
  11. Runtime DOM & Navigation Interaction Verification (80 tests)
  12. Consolidation Test Lab HTML Integrity (34 tests)
  13. Official Branding, PWA Manifest & HTML Head Assets (36 tests)

#### Historical Regression Suites
- Phase 20 (`test_phase20_suite.js`): **315 / 315 passed** (100%)
- Phase 19 (`test_phase19_suite.js`): **235 / 235 passed** (100%)
- Phase 18 (`test_phase18_suite.js`): **201 / 201 passed** (100%)
- Phase 17 (`test_phase17_suite.js`): **120 / 120 passed** (100%)

---

### 8. Product Owner Physical Test Script

#### Straight-Through Physical Device Sequence

1. **TEST LAB VERIFICATION**:
   - Open browser on phone to `http://<device-ip>:18106/consolidation_test.html`.
   - Tap `🔄 RESET TO BASELINE`. Verify feedback: `✅ State reset to canonical QA baseline: Alex Rivera, Level 2, 135 LP, 15 XP`.
   - Tap `🔍 VERIFY BASELINE`. Verify: `✅ Baseline verified!`.
   - Tap `👤 INSPECT MEMBER IDENTITY`. Verify member Alex Rivera.
   - Tap `💰 INSPECT LIFE POINTS LEDGER`. Verify balance 135 LP.
   - Tap `📚 INSPECT SHARED CATALOGS`. Verify 5 quests, 4 event templates, 4 ministries, 19 milestones, 14 arcade games.
   - Under Section C (Campfire), tap `🛡️ SET COMMUNITY MAX TO 10`, then `👥 SET CAMPFIRE MAX TO 8`.
   - Tap `❌ TEST OVER-COMMUNITY REJECTION (TRY 12 > 10)`. Verify rejected.
   - Tap `🔒 TEST ACTIVE LOWERING PROTECTION (TRY 4 < 5 MEMBERS)`. Verify rejected.
   - Tap `🔥 SEND STRUCTURED REACTION (🔥 KEEP GOING)`. Verify reaction recorded.
   - Under Section D (Life Points), tap `🌱 COMPLETE STEWARD OF THE GARDEN (+5 LP)`. Verify LP reaches 140.
   - Tap `🔁 RETRY QUEST #001 (TEST IDEMPOTENCY)`. Verify 0 duplicate LP awarded (balance remains 140 LP).
   - Under Section E (Event Check-In), tap `🎟️ CHECK IN TO DEMO EVENT`. Verify +5 LP awarded (145 LP).
   - Tap `🔁 RETRY CHECK-IN (TEST IDEMPOTENCY)`. Verify 0 duplicate LP awarded (balance remains 145 LP).
   - Under Section F (Ministry), tap `⛪ DISCOVER MINISTRY MISSIONS`. Verify Sacred Harmonies mission discovered.
   - Tap `🎵 COMPLETE SACRED HARMONIES MISSION (+5 LP)`. Verify LP reaches 150.

2. **MAIN APP HOME SCREEN, HEADER & MY PROFILE VERIFICATION**:
   - Tap `🏡 OPEN KOINONIA HOME` (or browse to `http://<device-ip>:18106/index.html`).
   - **Header Layout Verification**:
     - Left: Official crisp "KOINONIA by Fire of God Ministries" banner logo (`koinonia-header-logo.png`). Old icon, standalone "K", and loose subtitle text are completely removed.
     - Right: Interactive Status Area (`LV 2` and `🪙 135 LP`), and single settings gear button (`⚙️`).
     - Verify layout: Fits neatly on mobile portrait (360px–414px) with zero line wrapping or overlap.
   - **A. Tap Level / LP to Open My Profile**:
     - Tap directly on the `LV 2` or `🪙 135 LP` pill area in the top header.
     - Verify `#me-modal` opens smoothly:
       - Header: Avatar `🧑`, Name `Alex Rivera`, Handle `youth_demo_01 • @alex_r`, Role `Role: Member`.
       - Community Affiliation Card: Campfire `Fire of God Alpha Seed`, Ministry `Seraphs Music Ministry`, Bio `"Young Pilgrim walking in faith and stewardship."`.
       - Flourishing & Progress: Level 2 (`Active Explorer`), XP bar (`15 / 20 XP`), Life Points (`135 LP`).
       - Confirm Studio Admin button is NOT visible in Me modal for normal member.
     - Tap `✕` (top right) to close My Profile.
   - **B. Settings Profile Summary & Admin Gating Verification**:
     - Tap the gear icon (`⚙️`) in top right header.
     - Verify `#settings-modal` slides up from bottom:
       - Top: Compact Member Identity Card showing avatar `🧑`, `Alex Rivera`, `LV 2`, `🪙 135 LP`, and button `VIEW MY PROFILE`.
       - Tap `VIEW MY PROFILE`. Verify Settings closes and My Profile opens with Alex Rivera's data. Tap `✕` to close My Profile.
       - Re-open Settings (`⚙️`).
       - Audio Toggle: displays current audio status (e.g. `🔊 Sound: ON` / `🔇 Sound: OFF`). Tap to toggle.
       - Reset Prototype State: tap `🔄 Reset Prototype State` to restore clean QA baseline.
       - Studio Admin: Confirm `🛠️ Studio Admin` is NOT visible for normal members.
     - Tap `✕` (Close) or backdrop to close settings sheet.
   - **Look at 6-Card Destination Grid**:
     1. 🔥 CAMPFIRE
     2. 📜 QUESTS
     3. 📅 EVENTS
     4. 🎮 FOG GAMES
     5. 🏃 SPORTS HUB
     6. 📖 JOURNEY
   - **Look at Bottom Navigation**: 7 tabs (`Home`, `Campfire`, `Quests`, `Events`, `Games`, `Sports`, `Journey`).

3. **TEST FOG GAMES DESTINATION**:
   - Tap the `🎮 FOG GAMES` card (or bottom tab `Games`).
   - Modal opens with title `🎮 FOG GAMES`.
   - Observe segmented selector: `[ 📖 FAITH QUEST ]   [ 🕹️ FOG ARCADE ]`.
   - In Faith Quest view:
     - Tap `📖 LAUNCH MAIN APP FAITH QUEST CHALLENGE` (opens `/?faith=quest`).
     - Under Catechism Clash practice, tap an option. Output confirms answer and +5 LP award.
     - Review the 6 daily challenges list.
   - Tap `🕹️ FOG ARCADE` button:
     - View switches smoothly to FOG Arcade.
     - Tap `🎯 LAUNCH SLINGSHOT DEMO (+5 LP)`. Observe David's Slingshot physics result.
   - Tap `✕` at top right to close modal.

4. **TEST CAMPFIRE DESTINATION & FLICKER RESOLUTION**:
   - Tap `🔥 CAMPFIRE` card (or bottom tab `Campfire`).
   - Verify modal opens smoothly from the bottom with ZERO horizontal flash or shift.
   - Tap campfire card to inspect Overview, Quest, Members, and Activity.
   - Close modal by tapping `← BACK TO CIRCLES` and `✕`.

5. **TEST SPORTS HUB DESTINATION**:
   - Tap `🏃 SPORTS HUB` card (or bottom tab `Sports`).
   - Modal opens with title `🏃 SPORTS HUB` and subtitle `Sports, Fitness & Personal Bests • Active Challenges`.
   - Verify all 5 tabs: Active Drills, Real-World Sports, My Bests, Leaderboard, History.
   - Confirm zero visible references to "Faith Quest" or "Fit Quest".
   - Tap `✕` to close.

6. **TEST QUESTS, EVENTS & JOURNEY (PROFILE VS JOURNEY SEPARATION)**:
   - Tap `📜 QUESTS`: Verify active quests and Ministry Missions section.
   - Tap `📅 EVENTS`: Verify upcoming gatherings and campaigns.
   - Tap `📖 JOURNEY`:
     - Modal opens with title `📖 PILGRIMAGE JOURNEY`.
     - Verify historical timeline, milestones, and scrapbook reflections over time.
     - Confirm Journey modal is completely separate from My Profile modal.
   - Tap `✕` to close Journey.

---

### Physical Product Owner Acceptance

- **Current Status**: **PENDING**
- Awaiting physical verification by the Product Owner on a physical smartphone using the straight-through test sequence above.
