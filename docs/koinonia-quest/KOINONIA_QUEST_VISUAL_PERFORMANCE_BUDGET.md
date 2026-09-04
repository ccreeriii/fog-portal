# Koinonia Quest — Visual Performance Budget & Asset Optimization

**Document Version:** 1.1.0 (Amended per Product Owner Decisions)  
**Phase:** Phase 0.6 (Visual Identity, World Art Direction & Screen Experience)  
**Status:** SPECIFICATION ONLY — ZERO RUNTIME CODE MODIFICATIONS  
**Hardware Target:** Raspberry Pi 4 Model B Server & Budget Mobile Devices (2GB–4GB RAM, 3G/4G Networks)  
**Engine Profile:** Lightweight HTML5 2D Canvas + Stateless REST (Phase 1 Approved Architecture)  

---

## 1. Executive Performance Directive & Realistic Targets

The Koinonia Quest client is designed to run responsively on entry-level smartphones while maintaining **minimal Raspberry Pi server-side game-loop load** (by keeping all rendering client-side and using stateless REST endpoints).

```
┌────────────────────────────────────────────────────────────────────────┐
│                      PHASE 1 REALISTIC TARGETS                         │
├───────────────────────────────┬───────────────────┬────────────────────┤
│ Performance Metric            │ Hard Budget Cap   │ Target Production  │
├───────────────────────────────┼───────────────────┼────────────────────┤
│ Total Initial Asset Download  │ < 2.5 MB (gzipped)│ ~ 1.8 MB (gzipped) │
│ Uncompressed Total Assets     │ < 4.0 MB          │ ~ 2.8 MB           │
│ Time to Interactive (3G Net)  │ < 2.5 Seconds     │ < 1.8 Seconds      │
│ Target Rendering Framerate    │ Target 60 FPS     │ 30 FPS fallback    │
│ Client Memory Footprint (RAM) │ < 45 MB           │ ~ 28 MB            │
│ Server-Side Game-Loop Load    │ Minimal REST-only │ Measured in testing│
│ Asset HTTP Requests           │ < 12 Requests     │ 8 Consolidated Req │
└───────────────────────────────┴───────────────────┴────────────────────┘
```

> **PRODUCT OWNER SPECIFICATION DIRECTIVE:**  
> Avoid absolute claims of "flawless 60 FPS" or "zero CPU load." The production targets are:  
> - **Target 60 FPS on typical supported devices.**  
> - **Graceful 30 FPS fallback on constrained devices.**  
> - **Minimal Raspberry Pi server-side game-loop load.**  
> - **Measure actual performance during prototype testing.**  

---

## 2. Texture Atlas & Sprite Specifications

To minimize HTTP requests and GPU draw calls, all graphical assets are packed into **two consolidated texture atlases**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TEXTURE ATLAS ARCHITECTURE                      │
├───────────────────┬───────────────────┬──────────────┬─────────────────┤
│ Atlas Name        │ Dimensions        │ File Format  │ File Size Target│
├───────────────────┼───────────────────┼──────────────┼─────────────────┤
│ `world-tiles.png` │ 1024 × 1024 px    │ WebP / PNG   │ < 450 KB        │
│ `avatars-npcs.png`│ 1024 × 1024 px    │ WebP / PNG   │ < 550 KB        │
│ `ui-elements.png` │ 512 × 512 px      │ WebP / PNG   │ < 200 KB        │
└───────────────────┴───────────────────┴──────────────┴─────────────────┘
```

### 2.1 Tile & Sprite Dimensional Standards
- **Grid Unit:** Base tile unit is **32 × 32 pixels**, authored in high-density handcrafted pixel art designed to remain crisp at integer 2× and 3× scaling.
- **Character Sprites:** Bounded at **32 × 48 pixels** (1.5 vertical tiles in 3/4 perspective).
- **NPC Sprites:** Bounded at **32 × 48 pixels** (elders like Uncle Barnaby may extend to 36×48px for wide sun hat brim).
- **UI Icons:** Master iconography authored at **24 × 24 pixels** (scaled cleanly to 32px and 48px).

### 2.2 Animation Frame Economy
Every animated entity adheres to a strict frame budget to preserve browser memory:
- **World Ambient Elements (Trees, Water, Lanterns):** Maximum **2 to 3 frames** per loop (frame rate: 2–3 FPS).
- **Player & NPC Walk Cycles:** Maximum **4 frames per direction** (Down, Up, Left, Right). Left and right directions reuse the same 4 frames via horizontal Canvas flipping (`ctx.scale(-1, 1)`), cutting sprite storage in half.
- **Player Idle & Breathing:** Maximum **2 frames** (subtle 1px chest rise/fall every 800ms).
- **Emote Bubbles (Phase 1 Approved Set):** Maximum **3 frames** for the 6 approved emotes (`Wave`, `Heart`, `Prayer/Gratitude`, `Lightbulb`, `Thumbs-Up`, `Sprout`).

---

## 3. Audio Budget & Muted-by-Default Policy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          AUDIO ASSET BUDGET                            │
├───────────────────┬───────────────────┬──────────────┬─────────────────┤
│ Audio Category    │ Technology Used   │ File Format  │ Budget Cap      │
├───────────────────┼───────────────────┼──────────────┼─────────────────┤
│ UI Click & Taps   │ Web Audio API     │ Programmatic │ 0 KB (Code only)│
│ Ambient Sound FX  │ Compressed Opus   │ OGG / M4A    │ < 180 KB Total  │
│ Acoustic Theme    │ Loopable Stream   │ OGG / M4A    │ < 650 KB (Lazy) │
└───────────────────┴───────────────────┴──────────────┴─────────────────┘
```

### 3.1 Muted by Default Policy
- **Background Music is MUTED BY DEFAULT on First Launch:** No audio plays automatically.
- **Explicit Opt-In:** An audio toggle allows users to unmute sound when desired.
- **Non-Audio Equivalents:** Every sound cue has on-screen visual and haptic equivalents.

### 3.2 Programmatic Web Audio Synthesis (0 KB Assets)
When unmuted, standard interactive UI sounds are synthesized in real time via the browser's native `AudioContext`:
- **Button Wood-Tap:** Short damped sine oscillator burst (180 Hz fading to 60 Hz over 45ms).
- **Parchment Scroll Open:** Filtered pink noise burst with soft bandpass sweep.
- **Quest Chime:** Dual triangle oscillators generating harmonic C5 and G5 intervals.

---

## 4. Client-Side Rendering & Framerate Budget

### 4.1 Frame Timing & The 16.6ms Target
To target 60 FPS on typical supported mobile devices, the Canvas render loop aims to complete draw operations within **16.6 milliseconds** per frame, with a graceful 30 FPS fallback on constrained devices.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     16.6ms FRAME TIME ALLOCATION                       │
├────────────────────────────────┬─────────────────┬─────────────────────┤
│ Render Subsystem               │ Time Allocation │ Optimization Rule   │
├────────────────────────────────┼─────────────────┼─────────────────────┤
│ Input & Touch Processing       │ 1.0 ms          │ Debounced gestures  │
│ Spatial Sorting & Frustum Cull │ 2.5 ms          │ Only draw viewport  │
│ Static Tilemap Pass            │ 4.0 ms          │ Cached off-screen   │
│ Dynamic Entities & Sprites     │ 4.5 ms          │ Max 20 entities     │
│ UI Overlays & Floating Prompts │ 2.0 ms          │ DOM-based overlays  │
│ Headroom / GC Margin           │ 2.6 ms          │ Measured in testing │
└────────────────────────────────┴─────────────────┴─────────────────────┘
```

### 4.2 Viewport Frustum Culling
The Canvas engine renders **only the tiles visible inside the current camera viewport** plus a 1-tile safety buffer. For a standard mobile screen showing a 15×25 tile view (375 tiles), the engine never loops over the entire 30×24 map (720 tiles).

### 4.3 Off-Screen Tilemap Pre-Rendering
- The static background layers (ground tiles, stone walls, fixed wooden fences) are rendered **once** onto an off-screen `HTMLCanvasElement`.
- On every render tick, the entire background is drawn to the screen with a **single `ctx.drawImage()` call**, rather than iterating through 375 individual tile draw calls per frame.

---

## 5. Low-Memory & Battery Scaling (Optional Progressive Enhancement)

> **PRODUCT OWNER SPECIFICATION DIRECTIVE:**  
> Device-memory and battery-based optimizations are specified as **optional progressive enhancements** because browser API support (e.g., `navigator.deviceMemory`, Battery Status API) varies across platforms (such as iOS Safari).

```
┌────────────────────────────────────────────────────────────────────────┐
│                     PERFORMANCE SCALING TIERS                          │
├───────────────────┬──────────────────────┬─────────────────────────────┤
│ Setting           │ Standard (Target)    │ Constrained Fallback Tier   │
├───────────────────┼──────────────────────┼─────────────────────────────┤
│ Frame Rate        │ Target 60 FPS        │ Graceful 30 FPS Cap         │
│ Pixel Ratio       │ Device Native (2x/3x)│ Locked at 1.5x (Downscaled) │
│ Flora Animation   │ Active 2-Frame Sway  │ Static Still Tiles          │
│ Particle Effects  │ Drifting Leaves/Seeds│ Completely Disabled         │
│ Backdrop Blur     │ CSS Blur (4px)       │ Solid Tint Overlay (0px)    │
│ Screen Transitions│ 300ms Ease-in Panning│ Instant 100ms Dissolve      │
└───────────────────┴──────────────────────┴─────────────────────────────┘
```

### 5.1 Fallback Triggers
When supported by the browser, constrained mode may be triggered by:
1. Low CPU / thread count (`navigator.hardwareConcurrency <= 4`).
2. Low reported device memory (`navigator.deviceMemory <= 2`).
3. Low battery status reports.
4. **Universal Runtime Fallback:** If the render loop detects 3 consecutive frame drops below 25 FPS, the engine automatically throttles to the 30 FPS fallback tier regardless of browser API availability.

---

## 6. Caching & Secondary Service Worker Architecture

### 6.1 Launch Safety Directive
> **NEVER include Koinonia Quest assets in `ESSENTIAL_SHELL_ASSETS` in `public/sw.js`.**

### 6.2 The Dedicated Secondary Cache: `koinonia-quest-v1`
Quest assets are managed strictly by an isolated client cache manager (`quest-cache.js`):

```
                       [ Player Visits /quest ]
                                  │
                                  ▼
               [ Check Cache: 'koinonia-quest-v1' ]
               ├── (Hit) ──► Serve from Cache (< 50ms)
               └── (Miss)
                                  │
                                  ▼
               [ Lazy Fetch WebP Texture Atlases ]
               ├── Load UI & World Atlas (900 KB)
               ├── Cache response for 30 days
               └── Render Loading Progress Bar
```

### 6.3 Cache Invalidation
When game assets are updated in future releases, the version key increments to `koinonia-quest-v2`. The old cache is purged silently in the background without clearing the user's saved offline journal entries or preferences stored in `localStorage`.
