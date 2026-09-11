# KOINONIA PHASE 0.22.1 — INTERNET BETA DEPLOYMENT & VERIFICATION REPORT

**Document Version:** 1.1.0 (Mobile UX, World Presentation & Beta Identity Polish Pass)
**Phase:** 0.22.1 — KOINONIA INTERNET BETA
**Date:** September 7, 2026
**Status:** READY FOR PRODUCT OWNER 5G ACCEPTANCE
**Target Beta Domain:** `https://koinonia-beta.fogmin.site`
**Internal Process:** PM2 `koinonia-beta` (ID: 7, Port: 3005)
**Git Branch:** `feature/koinonia-quest` (HEAD: `f799fe9`, UNCOMMITTED)
**Safety Status:** 100% Isolated; Zero DB Connections; Staging DB Hash Bit-for-Bit Verified

---

## 1. Executive Summary

Phase 0.22.1 establishes the **Koinonia Internet Beta** deployment environment, making Koinonia available as a Progressive Web App (PWA) over the public internet via secure HTTPS and WebSockets (`wss://`).

Following the explicit acceptance of Phase 0.22 (Shared Core Staging Audit), this deployment strictly preserves all architectural boundaries and safety guarantees:
1. **Dedicated Host Port:** Koinonia Beta runs exclusively on **Port 3005**. It does not bind to, conflict with, or proxy through ports `3000` (Legacy v1 portal), `3001` (Main App Staging), `3002` (v2), or `3003` (Production v3).
2. **Dedicated PM2 Process:** Managed under process name `koinonia-beta` in fork mode. Protected PM2 processes (`fog-portal`, `fog-staging`, `fog-v2`, `fog-v3`) remain online and completely untouched.
3. **Dedicated Beta Domain:** Configured exclusively for `https://koinonia-beta.fogmin.site`. The future production domain `koinonia.fogmin.site` is strictly guarded and unused.
4. **Zero Database Mutation:** The beta server contains **zero** database driver dependencies (`better-sqlite3`, `sqlite3`), zero SQL queries, and zero filesystem writes to `fog_community.db`. Staging DB SHA256 remains bit-for-bit identical to baseline (`f545bd91...`).
5. **QA Test Isolation:** All internal QA test harnesses (`studio_test.html`, `presence_test.html`, `consolidation_test.html`, `load_test.js`, `*_test.html`) are strictly blocked with HTTP 404 responses. Member UI contains zero links or references to test suites.
6. **Safe Structured Social Interaction:** Realtime communication on `/realtime` is strictly limited to 5 approved encouragement emotes and 5 approved preset pastoral messages. Free-text chat is technically blocked (`FREE_TEXT_NOT_ALLOWED`), burst messaging is rate-limited (`RATE_LIMITED`), and social interactions award exactly 0 Life Points and 0 Virtue XP.
7. **PWA Mobile Readiness:** Complete Progressive Web App manifest (`manifest.json`), service worker (`sw.js`) with offline caching, responsive viewport, and official Fire of God Ministries branding assets (192px, 512px, maskable icons).

---

## 2. Infrastructure & Ingress Architecture Discovery

An inspection of the host networking and tunnel infrastructure was conducted:

| Parameter | Host Finding |
|---|---|
| **Tunnel Daemon** | `/usr/bin/cloudflared` (running under `cloudflared.service`) |
| **Execution Command** | `/usr/bin/cloudflared --no-autoupdate tunnel run --token-file /etc/cloudflared/token` |
| **Tunnel Management Mode** | **Cloudflare Zero Trust Remotely-Managed Tunnel** |
| **Local Config Files** | `/etc/cloudflared/` contains only `token` (no local `config.yml` or `cert.pem`) |
| **Ingress Rule Authority** | Dynamically synchronized from Cloudflare Zero Trust Edge via remote tunnel token |
| **Local Listen Ports** | `3000` (fog-portal), `3001` (fog-staging), `3002` (fog-v2), `3003` (fog-v3), **`3005` (koinonia-beta)** |
| **DNS Resolution** | `fogmin.site` Anycast IPs: `104.21.61.173`, `172.67.212.99` (Cloudflare Proxy) |
| **TLS / SSL Termination** | Cloudflare Edge terminates TLS 1.3 / HTTPS (port 443) and proxies HTTP / WS to `localhost:<port>` |

---

## 3. Product Owner Action Required: Cloudflare Zero Trust Ingress Setup

Because the host tunnel is token-managed remotely via Cloudflare Zero Trust, adding the public hostname `koinonia-beta.fogmin.site` requires a one-time configuration in the Cloudflare Zero Trust Dashboard.

### Step-by-Step Configuration Guide

1. **Log in to Cloudflare Zero Trust:**
   Navigate to [https://one.dash.cloudflare.com/](https://one.dash.cloudflare.com/) and authenticate with the Fire of God Ministries Cloudflare account.
2. **Navigate to Tunnels:**
   In the left sidebar, go to **Networks** → **Tunnels** (or **Access** → **Tunnels**).
3. **Select Active Tunnel:**
   Find the active tunnel that currently routes traffic for `fogmin.site`, `staging.fogmin.site`, and `checkin.fogmin.site`. Click **Configure**.
4. **Add Public Hostname:**
   Click on the **Public Hostname** tab, then click the **Add a public hostname** button.
5. **Configure Ingress Route:**
   Enter the following values into the form:
   - **Subdomain:** `koinonia-beta`
   - **Domain:** `fogmin.site`
   - **Path:** *(leave empty)*
   - **Service Type:** `HTTP`
   - **URL:** `localhost:3005` *(or `127.0.0.1:3005`)*
6. **Additional Settings (Optional / Default):**
   Under **Additional application settings** → **HTTP Settings**:
   - HTTP Host Header: *(leave blank or set to `localhost:3005`)*
   - WebSockets: Enabled by default in Cloudflare tunnels.
7. **Save Hostname:**
   Click **Save hostname**.

> [!NOTE]
> Once saved, Cloudflare edge automatically creates the DNS CNAME record for `koinonia-beta.fogmin.site`, issues the managed SSL/TLS certificate, and begins streaming HTTPS and WSS traffic directly to the local PM2 process on port 3005.

> [!IMPORTANT]
> Do NOT create `koinonia.fogmin.site`. That hostname is strictly reserved for the final production deployment.

---

## 4. Port & Process Architecture

| Port | Process Name | PM2 ID | Status | Purpose / Environment | DB Access |
|---|---|---|---|---|---|
| **3000** | `fog-portal` | 0 | `online` | Legacy v1 Check-in Portal (`checkin.fogmin.site`) | Read/Write SQLite |
| **3001** | `fog-staging` | 4 | `online` | Main App Staging (`staging.fogmin.site`) | Read/Write SQLite |
| **3002** | `fog-v2` | 2 | `online` | Portal v2 Internal Service | Read/Write SQLite |
| **3003** | `fog-v3` | 6 | `online` | Main App Production (`fogmin.site`) | Read/Write SQLite |
| **3005** | `koinonia-beta` | 7 | `online` | **Koinonia Internet Beta (`koinonia-beta.fogmin.site`)** | **ZERO DB ACCESS** |

### PM2 Verification Output
```
┌────┬──────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name             │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼──────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ fog-portal       │ fork     │ 0    │ online    │ 0%       │ 106.9mb  │
│ 4  │ fog-staging      │ fork     │ 1    │ online    │ 0%       │ 161.3mb  │
│ 2  │ fog-v2           │ fork     │ 0    │ online    │ 0%       │ 89.1mb   │
│ 6  │ fog-v3           │ fork     │ 0    │ online    │ 0%       │ 149.6mb  │
│ 7  │ koinonia-beta    │ fork     │ 1    │ online    │ 0%       │ 14.4mb   │
└────┴──────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘
```

---

## 5. Security & Edge Hardening Verification

All HTTP and WebSocket responses from port 3005 implement defense-in-depth edge protection:

### 1. HTTP Security Headers
- `X-Content-Type-Options: nosniff` — Prevents MIME-type sniffing attacks.
- `X-Frame-Options: SAMEORIGIN` — Prevents clickjacking from external iframes.
- `Referrer-Policy: strict-origin-when-cross-origin` — Protects user browsing privacy.
- `Permissions-Policy: geolocation=(), camera=(), microphone=()` — Completely restricts unauthorized hardware sensors.
- `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' wss: ws:; media-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self';`

### 2. Route & Path Traversal Protection
- **Path Traversal Attack:** `GET /../../../etc/passwd` → Returns **HTTP 404/403** (Strict `path.normalize` boundary check).
- **Sensitive Dotfiles:** `GET /.env`, `GET /.git`, `GET /.token` → Returns **HTTP 404**.
- **Database Probing:** `GET /fog_community.db`, `GET /test.db`, `GET /data.sqlite` → Returns **HTTP 404**.
- **QA Test Harness Blocking:** `GET /studio_test.html`, `GET /presence_test.html`, `GET /*_test.html` → Returns **HTTP 404**.
- **Localhost Query Parameter Gating:** `?reset=1` one-shot reset in `game.js` is host-gated; external visitors cannot trigger state resets via URL injection.

### 3. Non-Sensitive Health Monitoring
- `GET /health` and `GET /api/health` return:
```json
{
  "status": "healthy",
  "service": "koinonia-beta",
  "phase": "0.22.1",
  "version": "0.22.1",
  "uptimeSeconds": 312,
  "timestamp": "2026-09-07T05:03:32.410Z"
}
```
*Zero internal file paths, zero environment variables, zero tokens, and zero database details are disclosed.*

---

## 6. Realtime WebSocket Protocol (`/realtime`)

The beta server hosts an in-memory realtime presence engine with zero database dependencies:

```
                  ┌─────────────────────────────────┐
                  │   Cloudflare Zero Trust Edge    │
                  │ (SSL / TLS 1.3 Termination)     │
                  └────────────────┬────────────────┘
                                   │ wss://koinonia-beta.fogmin.site/realtime
                                   ▼
                  ┌─────────────────────────────────┐
                  │    Local Node Server (Port 3005)│
                  │      Native ws WebSocketServer   │
                  └────────────────┬────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      ▼                            ▼                            ▼
[WELCOME Handshake]        [PRESENCE_SNAPSHOT]           [SPATIAL ISOLATION]
version: 1                 Room occupancy sync           Home / School / Center
connectionId: conn_xxx     self + remote members         Separate broadcast rooms
```

### Social Safeguards & Rules
1. **5 Approved Structured Emotes:**
   - `ENCOURAGE` (👏 Encourage)
   - `PRAYING` (🙏 Praying)
   - `KEEP_GOING` (🔥 Keep Going)
   - `GROWING_TOGETHER` (🌱 Growing Together)
   - `GREAT_JOB` (❤️ Great Job)
   *Any unapproved emote ID returns `INVALID_EMOTE_ID`.*
2. **5 Approved Preset Pastoral Messages:**
   - `MSG_HI` ("Hi!")
   - `MSG_GOD_BLESS` ("God bless!")
   - `MSG_GREAT_JOB` ("Great job!")
   - `MSG_LETS_GO` ("Let's go!")
   - `MSG_PRAYING` ("Praying for you.")
   *Any unapproved message ID returns `INVALID_PRESET_MESSAGE_ID`.*
3. **Zero Free-Text Chat:** Free-text payloads (`text`, `customText`, `body`) are rejected with `FREE_TEXT_NOT_ALLOWED`.
4. **Anti-Spam Rate Limiting:** Enforces 1 action/second (`RATE_LIMITED` error code).
5. **Economy Isolation:** Social interactions award exactly **0 Life Points** and **0 Virtue XP**.
6. **Dynamic WSS Derivation:** `data/presence_client.js` dynamically checks `window.location.protocol === 'https:' ? 'wss:' : 'ws:'` and `window.location.host`. No hardcoded LAN IP addresses exist.

---

## 7. Progressive Web App (PWA) Assets

- **PWA Manifest (`manifest.json`):**
  - Name: `Koinonia — Fire of God Ministries`
  - Short Name: `Koinonia`
  - Display: `standalone` (fullscreen native app experience)
  - Theme Color: `#6A0E04` (Burgundy)
  - Background Color: `#FDFBF7`
  - Icons: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`
- **Service Worker (`sw.js`):**
  - Offline cache strategy for core game assets (`index.html`, `styles.css`, `game.js`, branding assets).
  - Explicit bypass for `/realtime` (WebSocket upgrade) and `/health` (monitoring).
- **Favicon & Header Assets:**
  - `GET /favicon.ico` aliased directly to `/assets/branding/favicon.ico`.
  - Apple touch icon and banner graphics properly mapped.

---

## 8. Physical 5G QA Protocol (iPhone & Android)

Once the Product Owner adds `koinonia-beta.fogmin.site` to the Cloudflare Zero Trust tunnel, perform the following physical acceptance test over cellular 5G data:

### Physical Test Protocol

| Test # | Step Description | Expected Result |
|---|---|---|
| **1** | Turn OFF Wi-Fi on device. Ensure connection is pure **Cellular 5G / LTE**. | Device is on public cellular network. |
| **2** | Open mobile browser (Safari on iOS, Chrome on Android). Navigate to `https://koinonia-beta.fogmin.site/`. | Page loads instantly with HTTPS lock icon. Fire of God Ministries branding displays clearly. |
| **3** | Check PWA Installation: Tap Share → **Add to Home Screen** (iOS) or browser menu → **Install App** (Android). | App icon appears on device home screen with name "Koinonia". |
| **4** | Launch installed PWA from Home Screen. | App opens in standalone window without browser URL bar. |
| **5** | Verify Realtime Presence indicator. | Realtime status badge displays connected/green (`wss://` over Cloudflare). |
| **6** | Navigate avatar in **My Home** using on-screen virtual joystick or tap-to-move. | Avatar moves smoothly without lag. |
| **7** | Tap the Emote button and select 🙏 (Praying). | Emote bubble displays above avatar; no errors in console. |
| **8** | Tap the Message button and select "God bless!". | Preset pastoral text bubble displays cleanly. |
| **9** | Test QA Harness Isolation: Attempt to navigate to `https://koinonia-beta.fogmin.site/studio_test.html`. | Browser displays **HTTP 404 Not Found**. |
| **10** | Test Health Endpoint: Navigate to `https://koinonia-beta.fogmin.site/health`. | JSON response with `status: "healthy"` and `service: "koinonia-beta"`. |

---

## 9. Physical Beta Field Revisions & Root Cause Resolution

Following the first physical test over 4G/5G, the following field revisions and root-cause fixes were implemented:

### 1. Root Cause of Non-Responsive Entry CTA ("ENTER THE WORLD")
- **Forensic Diagnosis:** `game.js` contained a dangling closing brace (`}`) at line 4280 following the host-gated `?reset=1` logic. Node syntax validation (`node -c prototype/koinonia-phase22_1/game.js`) caught: `SyntaxError: Missing catch or finally after try`.
- **Impact:** Because of the syntax error, the browser aborted execution of `game.js` during initial script parsing. Consequently, `setupEventListeners()` never executed, and the click event listener was never bound to `#btn-begin-adventure`.
- **Resolution:**
  1. Corrected line 4280 in `game.js`. Strict syntax validation (`node -c`) now passes cleanly with 0 errors.
  2. Multi-layered event wiring: Bound `click`, `touchend`, and `pointerup` to `enterKoinoniaWorld(e)`.
  3. Inline fallback: Added `onclick="window.KOINONIA_GAME && window.KOINONIA_GAME.enterWorld ? ..."` directly in `index.html`.
  4. Global API export: Added `enterWorld: enterKoinoniaWorld` to `root.KOINONIA_GAME`.
  5. High z-index defense: Explicitly set `#title-screen { z-index: 1000; pointer-events: auto; }` and `.intro-cta-btn { z-index: 1002; pointer-events: auto; touch-action: manipulation; min-height: 52px; }`.

### 2. Official Branding Banner Hero Replacement
- Removed text-based hero presentation (lone "K" mark, "KOINONIA" text, and "FIRE OF GOD MINISTRIES VIRTUAL COMMUNITY" subtitle).
- Positioned official high-resolution artwork: `assets/branding/koinonia-logo-banner.png` (1920×576) with responsive `srcset` (`koinonia-header-logo.png 640w, koinonia-logo-banner.png 1920w`).
- Banner is centered, responsive, retains aspect ratio (`max-height: 110px`, `object-fit: contain`), crisp on Retina/iPhone displays, with accessible alt text `alt="Koinonia — Fire of God Ministries"`.

### 3. Canonical CTA Copy Lock
- Replaced `"ENTER THE WORLD"` with EXACTLY `"BEGIN YOUR JOURNEY"`.
- Button styled with `touch-action: manipulation;`, Apple HIG 52px tap target, `letter-spacing: 0.04em`, and `white-space: nowrap` to prevent awkward wrapping on narrow screens.

### 4. Tagline Preservation
- Preserved canonical tagline directly beneath the banner and above the CTA: `"A virtual world that grows when you grow in real life."`

### 5. Service Worker & PWA Cache Invalidation
- Incremented cache container in `sw.js` to `koinonia-v0.22.1-r2`.
- Updated asset query strings to `?v=0.22.1-r2` across `index.html` and `sw.js`.
- Added `reg.update()` call on service worker registration to force instant browser cache checks without waiting 24 hours.

---


---

## 10. Public Beta Mobile UX, World Presentation & Beta Identity Polish Pass

Following physical 4G/5G testing by the Product Owner on iPhone Safari, a consolidated polish pass was executed covering six major architectural revisions:

### Revision 1: Mobile Header Redesign
- **Eliminated Header Crowding:** Removed the oversized `"EXIT WORLD"` button from the mobile portrait header completely (`display: none !important` in `.device-phone.orientation-portrait.active-game`).
- **New Clean Hierarchy:**
  `[Koinonia Banner Logo] ... [LV Pill] [LP Pill] [Account/Profile Button] [Settings Gear]`
- **Dedicated Account/Profile Button:** `#header-account-btn` displays the current avatar (`🧑`) and role chip (`Member`, `Admin`, `Superadmin`), adapting cleanly on small screens (<375px) without horizontal overflow.
- **Safe-Area Aware:** Respects `env(safe-area-inset-top)`, `env(safe-area-inset-left)`, and `env(safe-area-inset-right)`. Zero clipping, zero wrapping.

### Revision 2: Professional Intentional Two-Row Mobile HUD
- **Resolved Collision:** Previously, `canvas-place-badge` ("My Home" + "Hearth"), `canvas-presence-badge`, and `compact-quest-chip` ("AVAILABLE CALLING") competed in the same horizontal band, causing visual collisions on mobile screens.
- **Restructured into Two Distinct Rows:**
  - **ROW 1 (`.hud-row-context`):** Place / World Context on the left (`🏡 My Home  [Hearth]`) and real-time room presence on the right (`🟢 1 in room`).
  - **ROW 2 (`.hud-row-calling`):** Separate full-width interactive calling card (`🌱 AVAILABLE CALLING: Talk to Uncle Barnaby ›`).
- **Graceful Truncation:** Enabled `text-overflow: ellipsis` and `white-space: nowrap` on `.chip-quest-title` to ensure titles truncate elegantly without awkward wrapping or covering other HUD elements.

### Revision 3: Virtual Joystick Safe-Area Ergonomics
- **Inward Placement:** Increased the bottom-left joystick offset from a narrow `max(18px, ...)` to a responsive, safe-area aware offset:
  `left: clamp(34px, calc(env(safe-area-inset-left, 0px) + 38px), 60px);`
  `bottom: clamp(20px, calc(env(safe-area-inset-bottom, 0px) + 24px), 48px);`
- **Ergonomic Buffer:** Prevents user thumb from slipping off-screen or hitting the physical iPhone bezel during rapid leftward movement, while keeping touch coordinate tracking 100% accurate via dynamic `getBoundingClientRect()`.

### Revision 4: Viewport Pinch-to-Zoom Engine
- **Two-Finger Touch Tracking:** Tracks distance between two touch points on canvas:
  - Moving fingers apart (`ratio > 1`) → **ZOOM IN**.
  - Moving fingers closer (`ratio < 1`) → **ZOOM OUT**.
- **Canonical Bounds Clamped:** Zoom clamped strictly between `MIN_ZOOM = 0.85` (wide room view) and `MAX_ZOOM = 2.0` (detailed pilgrim view).
- **Invariants Preserved:** Pure camera/view-layer transform (`camera.zoom`). Avatar world coordinates, collision grid geometry, NPC interaction areas, and proximity prompt bounds remain 100% unaltered.
- **Gesture Conflict Defense:** Invokes `e.preventDefault()` during 2-touch moves to block browser-native page zooming. Ignores single touches (joystick/movement/buttons operate without interference).

### Revision 5: Stylized Illustrative Realism Environment Art (Pass 1 - My Home)
- **Visual Direction:** Warm, readable, game-like, mobile-efficient "Stylized Illustrative Realism" replacing blocky flat rectangles with multi-layered architectural canvas primitives:
  - `drawWall`: Architectural walls with crown/top molding highlight, baseboard shadow trim, and mortar/groove dividing lines.
  - `drawFloorPlanks`: Staggered warm timber floorboards with subtle alternating tones, seam strokes, and butt joints.
  - `drawTable`: Study desk with beveled lip, drop shadow, study scroll with red ribbon, and warm brass reading lamp with soft radial gradient ambient light.
  - `drawBed`: Carved headboard, mattress, white cotton linen, bolster pillow, and warm Flame Gold quilt with woven pattern.
  - `drawBookshelf`: Hardwood case with crown molding, packed with books of varying heights and vibrant colors with gold foil spine bands.
  - `drawGate`: Sturdy timber posts with carved caps, top/bottom rails, vertical pickets, diagonal cross-braces, and iron center latch/padlock.
  - `drawGardenPlot`: Raised timber frame, rich dark tilled soil, blooming strawberries/flowers with leaf pairs and center pistils.
- **Preserved Geometry:** All collision coordinates (bed, desk, bookshelf, walls, gates) remain bit-for-bit identical to original game rules.

### Revision 6: Beta Identity Provider & Role Scoping (`BetaIdentityProvider`)
- **Scaffold Module:** Implemented `prototype/koinonia-phase22_1/data/beta_identity.js` providing three distinct test personas:
  - 👤 **MEMBER (Alex Rivera):** Full playable world, quests, campfires. Zero Studio authoring or admin tools.
  - 🛠️ **ADMIN (Sarah Jenkins):** Full playable world + Studio access (author Places and Drafts, request review). Cannot directly publish or approve.
  - 👑 **SUPERADMIN (Pastor David):** Full playable world + Studio access + governance (review, approve, publish Places, inspect audit logs).
- **Remove Automatic Demo Login:** Fresh sessions present the official landing screen; tapping "BEGIN YOUR JOURNEY" opens the `#modal-beta-profile-picker` ("Choose a Beta Profile").
- **Prominent Non-Production Disclaimer:** Both picker modal and account drawer explicitly display:
  `"Beta demo profile only. No real FOG account data or production server authority is being used."`
- **Account & Beta Identity Drawer (`#modal-account-drawer`):**
  - Displays active identity card, role badge, title, and disclaimer.
  - Options: My Profile & Skills, My Journey Timeline, Koinonia Studio (role-gated), Switch Beta Profile, Exit World to Home.
- **Namespaced Local Persistence:** Saves are namespaced per identity (`koinonia.phase22_1.save.${identity.id}`) so Alex, Sarah, and Pastor David do not overwrite each other's progress or Studio drafts.
- **Future Integration Swap Hook:** Interface mirrors the upcoming `SharedAuthProvider` for seamless replacement in Shared Core Stage 3.

### Revision 7: Service Worker & Build Invalidation
- Incremented cache container to `koinonia-v0.22.1-r3`.
- Updated all script and stylesheet query strings to `?v=0.22.1-r3`.
- Added `data/beta_identity.js?v=0.22.1-r3` to the service worker core asset cache list.

---

## 11. Future Authentication & Login Architecture (Shared Core Stage 3)

The Beta Identity Provider is designed as an architectural boundary hook for later production login.

### Intended Production UX Flow:
```
  [LANDING / OFFICIAL BRANDING BANNER]
                 ↓
      [SIGN IN TO KOINONIA]
  (OAuth 2.0 / Secure Session Cookie)
                 ↓
  [AUTHENTICATED FOG MEMBER IDENTITY]
   (Role verified from server token)
                 ↓
      [BEGIN YOUR JOURNEY]
                 ↓
         [PLAYABLE WORLD]
```

### Returning Authenticated User Flow:
```
  [LANDING / BRANDING]
          ↓
  [BEGIN YOUR JOURNEY]
          ↓
  [PLAYABLE WORLD]
```

### Role Placement Principles:
- **Top-Right Account Menu:** Contains Profile, Journey, Role-Specific Tools, and Logout / Exit.
- **Gated Studio Tools:** Admin and Superadmin authoring/governance tools live behind the Account/Tools menu and never visually dominate or crowd the normal game HUD.

## 12. Automated Test Verification Summary

The focused top-of-screen layout correction was tested across 15 test groups via `test_phase22_1_beta.js`:

```
================================================================
  KOINONIA PHASE 0.22.1 — INTERNET BETA TEST SUITE
================================================================

[GROUP 1] PM2 Process & Host Architecture Isolation: PASS (7/7)
[GROUP 2] Health Endpoints & Non-Disclosure Verification: PASS (9/9)
[GROUP 3] Security Headers & Defense in Depth: PASS (11/11)
[GROUP 4] Public Beta Route Gating & QA Test Isolation: PASS (14/14)
[GROUP 5] PWA Compliance & Asset Verification: PASS (14/14)
[GROUP 6] Realtime WebSocket Protocol (/realtime) & Safe Social Interaction: PASS (22/22)
[GROUP 7] Dynamic WSS Resolution & Network Edge Compatibility: PASS (3/3)
[GROUP 8] Staging Database Non-Mutation Verification: PASS (1/1)
[GROUP 9] Physical Beta Landing Hero & Entry CTA Wire Verification: PASS (24/24)
[GROUP 10] Mobile Top Header & Responsive Layout (Revision 1): PASS (9/9)
[GROUP 11] Consolidated One-Row World Utility HUD (Header + HUD Pass): PASS (16/16)
[GROUP 12] Virtual Joystick Safe-Area Ergonomics (Revision 3): PASS (5/5)
[GROUP 13] Camera Viewport Pinch-to-Zoom Engine (Revision 4): PASS (9/9)
[GROUP 14] Stylized Illustrative Realism Environment Art (Revision 5): PASS (17/17)
[GROUP 15] Beta Identity Provider & Role Scoping (Revision 6): PASS (29/29)

================================================================
TOTAL TESTS: 190 | PASSED: 190 | FAILED: 0
================================================================
```

### Key Layout Polish Results:
1. **Vertical Space Recovery:** Eliminated duplicate safe-area notch gap (`top: 6px` snug positioning below global header). Consolidates top HUD from ~90px two-row card stack into a single 36px horizontal row (`~90px` of vertical viewport recovered for gameplay map).
2. **Visible Primary Exit/Back Control:** Added `#btn-hud-exit-world` (`← HOME`) directly in the gameplay HUD, styled as a burgundy pill button with touch-action manipulation. Wires to `exitWorldToHomeCard(false)`.
3. **Demoted "My Home / Hearth":** Replaced its prime position with the `← HOME` button; element `#canvas-place-badge` is hidden (`display: none !important;`) while preserved in DOM for JS/test compatibility.
4. **Graceful Calling Card:** `#compact-quest-chip` fills the center of the utility row (`flex: 1; min-width: 0;`), truncating with `text-overflow: ellipsis` and `white-space: nowrap`.
5. **Compact Real-Time Presence Counter:** Positioned on the right as `#canvas-presence-badge` with active green pulsing indicator.
6. **Zero Database Writes:** Verified `fog_community.db` SHA256 bit-for-bit identical (`f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`).

---

## Final Phase 0.22.1 Acceptance — September 11, 2026

**STATUS: PHYSICALLY ACCEPTED AND AUTOMATICALLY VERIFIED**

This final acceptance appendix supersedes the earlier 190-test pre-final verification snapshot above.

### Product Owner Physical Acceptance

Physical testing on iPhone against the public Internet Beta passed.

Confirmed:
- `BEGIN YOUR JOURNEY` works correctly.
- Fresh sessions hide the intro before opening `CHOOSE A BETA PROFILE`.
- Profile selection successfully enters the world.
- The compact one-row HUD displays correctly.
- `← HOME`, Available Calling, and presence indicator work correctly.
- Excess top-screen spacing is removed.
- Returning Home works correctly.

### Final Runtime Hardening

Final public build:

`koinonia-v0.22.1-r5`

Update-critical `/sw.js` and `/index.html` responses now use no-cache/no-store policy.

Final public verification:
- Service worker: `koinonia-v0.22.1-r5`
- Cloudflare: `cf-cache-status: BYPASS`
- Stale r4 edge object successfully purged.

### PM2 Reboot Persistence

`koinonia-beta` is persisted in `/home/raspi4/.pm2/dump.pm2`.

Canonical runtime:
- Script: `/home/raspi4/koinonia-quest/prototype/koinonia-phase22_1/server.js`
- Working directory: `/home/raspi4/koinonia-quest/prototype/koinonia-phase22_1`
- Port: `3005`

The enabled `pm2-raspi4.service` provides reboot resurrection.

### Final Automated Verification

Current Phase 0.22.1 suite:

`TOTAL TESTS: 200 | PASSED: 200 | FAILED: 0`

The final 10 additional assertions protect:
- PM2 persistence and canonical runtime path.
- Browser/CDN cache prevention.
- Fresh-session entry branch.
- Intro removal before profile picker.
- Safe picker return behavior.
- Restoration of the intro when no profile is selected.

### Historical Regression Battery

Verified against each phase's correct immutable snapshot:

- Phase 0.17: 120 / 120
- Phase 0.18: 201 / 201
- Phase 0.19: 235 / 235
- Phase 0.20: 315 / 315
- Phase 0.20.1: 387 / 387
- Phase 0.20.2: 45 / 45
- Phase 0.21: 147 / 147
- Phase 0.22 historical audit: 103 / 103
- Phase 0.22.1 Internet Beta: 200 / 200

**Final verified battery: 1,753 / 1,753 passed.**

### SQLite WAL Verification

The staging database is operating in WAL mode.

Protected main-file SHA256 remained unchanged:

`f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12`

Historical main-file snapshot:
- 53 tables
- 141 users
- 147 youth

Current live WAL-aware state:
- 56 tables
- 143 users
- 149 youth

The Phase 0.22 audit was replayed read-only against a temporary copy of the exact historical main-file baseline and passed 103 / 103.

No WAL checkpoint, WAL deletion, staging shutdown, database replacement, or database mutation was performed.

### Final Acceptance

- Product Owner physical acceptance: **PASS**
- Phase 0.22.1 automated suite: **200 / 200 PASS**
- Historical Phase 0.22 audit: **103 / 103 PASS**
- Historical regression battery: **1,753 / 1,753 PASS**
- Public beta health: **PASS**
- PWA / Cloudflare cache hardening: **PASS**
- PM2 reboot persistence: **PASS**
- Protected staging database isolation: **PASS**

**Phase 0.22.1 is approved for its Git acceptance checkpoint.**
