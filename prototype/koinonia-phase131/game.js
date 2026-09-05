/**
 * KOINONIA — PHASE 0.12.2 GAME ENGINE
 * Mobile Virtual Analog Joystick / Thumbstick Controls
 *
 * Key Architecture:
 * 1. Mobile Virtual Analog Joystick:
 *    - Replaces 4-way D-pad with modern circular thumbstick in lower-left thumb zone.
 *    - Captured pointer drag tracking with setPointerCapture().
 *    - Center dead zone (12% of radius) prevents jitter/accidental movement.
 *    - Smooth analog intensity curve and 360° continuous movement vector.
 *    - Strict diagonal speed normalization (magnitude capped at 1.0).
 * 2. Multi-Touch Independence:
 *    - Independent pointer tracking (active joystick pointerId) allows simultaneous left-thumb
 *      analog steering and right-thumb Action/Emote taps.
 * 3. Robust Interruption Safeguards:
 *    - Resets joystick on pointerup, pointercancel, window blur, visibilitychange, orientation change, and Exit World.
 * 4. Unified Movement Pipeline:
 *    - Both desktop keyboard (WASD/Arrows) and mobile joystick feed into a single vector pipeline
 *      with collision checks and natural axis sliding.
 * 5. Diagnostics HUD Telemetry (?debug=1):
 *    - Real-time display of joystick active status, raw & normalized vectors, magnitude, and speed percentage.
 * 6. Full Preservation of Phase 0.12.1 Features:
 *    - Short-side phone classification, portrait-first RPG gameplay, paused landscape companion,
 *      non-zero stage calibration, and Quest #001 rewards (+5 LP: 120 -> 125 LP).
 */

(function () {
  'use strict';

  // ============================================================
  // 1. DATA STORES ACCESS
  // ============================================================
  const root = typeof window !== 'undefined' ? window : global;
  const data = root.KOINONIA_DATA || {};
  const PLACES = data.places || {};
  const QUESTS = data.quests || [];
  const CAMPAIGNS = data.campaigns || {};
  const EVENTS = data.events || {};
  const PERSONAL_BESTS = data.personalBests || {};
  const EVENT_MEMORIES = data.eventMemories || [];
  const MY_JOURNEY = data.myJourney || {};
  const GROWTH_PATHS = data.growthPaths || {};
  const PLACE_TEMPLATES = data.placeTemplates || [];

  // ============================================================
  // 2. LOGICAL WORLD CONSTANTS & RUNTIME STATE
  // ============================================================
  const TILE_SIZE = 32;
  const WORLD_COLS = 25; // 800px logical
  const WORLD_ROWS = 18; // 576px logical
  const LOGICAL_WIDTH = WORLD_COLS * TILE_SIZE;  // 800
  const LOGICAL_HEIGHT = WORLD_ROWS * TILE_SIZE; // 576

  // Prototype Local Save Storage Configuration
  const SAVE_STORAGE_KEY = 'koinonia.phase131.save';
  const SAVE_VERSION = 1;

  // Registered Spawn Points per Place
  const SPAWN_POINTS = {
    home: {
      default: { x: 4.5, y: 14.5, dir: 'down' },
      from_fog_center: { x: 12.0, y: 15.2, dir: 'up' },
      from_gate: { x: 12.0, y: 15.2, dir: 'up' }
    },
    fog_center: {
      default: { x: 12.0, y: 14.8, dir: 'up' },
      from_home: { x: 12.0, y: 14.8, dir: 'up' }
    }
  };

  // Runtime State (Single-community first: communityId = 'fog')
  const state = {
    saveVersion: SAVE_VERSION,
    lastSaveTime: null,
    activePlaceId: 'home',
    spawnId: 'default',
    lp: 120,
    charLevel: 1,
    charXp: 0,
    charXpMax: 100,
    skills: { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 },
    gardenState: 'dry', // 'dry' | 'lush'
    gateOpen: false,
    fogCenterUnlocked: false,
    visitedFogCenter: false,
    unlockedPlaces: ['home'],
    questStatus: 'ready', // 'ready' | 'active' | 'in_progress' | 'completed'
    rewardClaimed: false,
    currentObjective: 'Talk to Uncle Barnaby at the veranda',
    reflectionText: '',
    audioMuted: true,
    audioContext: null,

    // Step 2 & 14: Diagnostics and Storage Metadata
    storageMeta: {
      available: false,
      origin: '',
      saveKey: SAVE_STORAGE_KEY,
      saveExists: false,
      saveVersion: SAVE_VERSION,
      lastSaveTime: null,
      lastSaveReason: 'initial_defaults',
      lastLoadTime: null,
      loadResult: 'pending',
      storedLP: null,
      runtimeLP: 120,
      storedQuest: null,
      runtimeQuest: 'ready',
      storedGate: null,
      runtimeGate: false,
      storedFogUnlock: null,
      runtimeFogUnlock: false
    },

    // Portrait-First Navigation & Central Responsive State
    isPlayingGame: false,
    isPaused: false,
    isTransitioning: false,
    activeNavTab: 'home',
    emoteBubble: null,
    emoteTimer: 0,

    responsive: {
      vw: 800,
      vh: 600,
      shortSide: 600,
      longSide: 800,
      deviceClass: 'phone',
      orientation: 'portrait',
      activeGame: false
    },

    // Avatar
    avatar: {
      x: 4.5,
      y: 14.5,
      targetX: null,
      targetY: null,
      speed: 4.2,
      dir: 'down',
      isMoving: false,
      frame: 0,
      frameTimer: 0,
      name: 'Alex',
      skinTone: '#F8D9B8',
      hairStyle: 'crop',
      hairColor: '#332219'
    },

    // Active Dialogue State
    dialogue: {
      active: false,
      speaker: 'Uncle Barnaby',
      role: 'Garden Mentor • My Home',
      portrait: '👴',
      lines: [],
      currentLineIndex: 0
    },

    // Studio Wizard Step
    wizardStep: 1,

    // In-memory Custom Places & Quests
    customPlaces: {},
    customQuests: []
  };

  // Responsive Camera Model
  const camera = {
    x: 0,
    y: 0,
    zoom: 1.35,
    viewportWidth: 800,
    viewportHeight: 576,
    dpr: 1
  };

  // Mobile Virtual Analog Joystick Model
  const joystick = {
    active: false,
    pointerId: null,
    baseX: 0,
    baseY: 0,
    baseRadius: 60,
    knobRadius: 26,
    deadZoneRatio: 0.12, // 12% dead zone
    rawDx: 0,
    rawDy: 0,
    distance: 0,
    angle: 0,
    vectorX: 0, // normalized -1..1
    vectorY: 0, // normalized -1..1
    intensity: 0, // 0..1
    speedPercent: 0 // 0..100%
  };

  // Collision Grid: 0 = walkable, 1 = solid
  let collisionGrid = [];
  let canvas, ctx, gameStage, appContainer;

  // Diagnostic HUD check (?debug=1)
  const isDebugMode = (typeof window !== 'undefined' && window.location && typeof URLSearchParams !== 'undefined') ?
    (new URLSearchParams(window.location.search).get('debug') === '1') : false;

  // ============================================================
  // 3. COLLISION GRID INITIALIZATION
  // ============================================================
  function initCollisionGrid() {
    collisionGrid = [];
    for (let r = 0; r < WORLD_ROWS; r++) {
      collisionGrid[r] = [];
      for (let c = 0; c < WORLD_COLS; c++) {
        // Outer room boundaries
        if (r === 0 || r === WORLD_ROWS - 1 || c === 0 || c === WORLD_COLS - 1) {
          collisionGrid[r][c] = 1;
        } else {
          collisionGrid[r][c] = 0;
        }
      }
    }

    if (state.activePlaceId === 'home') {
      // Bed (top-left)
      for (let r = 2; r <= 5; r++) {
        for (let c = 2; c <= 4; c++) collisionGrid[r][c] = 1;
      }
      // Study Desk
      for (let c = 6; c <= 8; c++) collisionGrid[2][c] = 1;
      // Dresser & Bookshelf
      for (let c = 12; c <= 15; c++) collisionGrid[2][c] = 1;
      // Veranda Partition Wall with open doorway
      for (let c = 1; c <= WORLD_COLS - 2; c++) {
        if (c < 10 || c > 13) collisionGrid[11][c] = 1;
      }
      // Perimeter Garden Gate (col 11-13 row 17)
      if (state.gateOpen) {
        // Gate is open: allows player to walk south out of home into FOG Center
        collisionGrid[17][11] = 0;
        collisionGrid[17][12] = 0;
        collisionGrid[17][13] = 0;
      } else {
        collisionGrid[17][11] = 1;
        collisionGrid[17][12] = 1;
        collisionGrid[17][13] = 1;
      }
    } else if (state.activePlaceId === 'fog_center') {
      // Top worship platform / Sanctuary altar
      for (let r = 1; r <= 3; r++) {
        for (let c = 8; c <= 16; c++) collisionGrid[r][c] = 1;
      }
      // Sister Grace welcome station (tile 12, row 4-5)
      collisionGrid[4][12] = 1;
      // Notice Board at tile 7, row 5
      collisionGrid[5][7] = 1;
      // Timber Cross Landmark at tile 18, row 5
      collisionGrid[5][18] = 1;
      // Timber Columns
      [6, 11].forEach(r => {
        collisionGrid[r][4] = 1;
        collisionGrid[r][20] = 1;
      });
      // Pews / Seating rows (leaving wide central aisle cols 10-14 clear)
      for (let r = 8; r <= 13; r += 2) {
        for (let c = 4; c <= 8; c++) collisionGrid[r][c] = 1;
        for (let c = 16; c <= 20; c++) collisionGrid[r][c] = 1;
      }
      // South Exit Gateway to My Home (col 11-13, row 17 is walkable exit)
      collisionGrid[17][11] = 0;
      collisionGrid[17][12] = 0;
      collisionGrid[17][13] = 0;
    }
  }

  function isWalkable(col, row) {
    const r = Math.floor(row);
    const c = Math.floor(col);
    if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) return false;
    return collisionGrid[r][c] === 0;
  }


  // ============================================================
  // 4. ROBUST SHORT-SIDE DEVICE CLASSIFICATION & RESPONSIVE STATE
  // ============================================================
  function getViewportDimensions() {
    const vw = (typeof window !== 'undefined' && window.visualViewport && window.visualViewport.width) ?
      window.visualViewport.width : (typeof window !== 'undefined' ? window.innerWidth : 800);
    const vh = (typeof window !== 'undefined' && window.visualViewport && window.visualViewport.height) ?
      window.visualViewport.height : (typeof window !== 'undefined' ? window.innerHeight : 600);
    return { vw, vh };
  }

  function determineDeviceClass(shortSide, longSide) {
    // Rule 1: A phone is identified primarily by its short side!
    // All mobile phones (iPhone 8+, 12/13/14/15 Pro, Android, Pro Max) have short side <= 600px
    if (shortSide <= 600) {
      return 'phone';
    }

    // Coarse pointer detection for touch tablets
    const isCoarse = (typeof window !== 'undefined' && window.matchMedia) ?
      window.matchMedia('(pointer: coarse)').matches : false;

    // Rule 2: Tablet has shortSide <= 1024px AND (coarse pointer OR longSide <= 1199px)
    if (shortSide <= 1024 && (isCoarse || longSide <= 1199)) {
      return 'tablet';
    }

    // Rule 3: Desktop
    return 'desktop';
  }

  function updateResponsiveState() {
    const { vw, vh } = getViewportDimensions();
    const shortSide = Math.min(vw, vh);
    const longSide = Math.max(vw, vh);
    const orientation = (vw >= vh) ? 'landscape' : 'portrait';
    const deviceClass = determineDeviceClass(shortSide, longSide);

    state.responsive = {
      vw,
      vh,
      shortSide,
      longSide,
      deviceClass,
      orientation,
      activeGame: state.isPlayingGame
    };

    // Sync classes to root element (#app-container and documentElement)
    if (!appContainer) appContainer = document.getElementById('app-container');
    const rootEls = [appContainer, typeof document !== 'undefined' ? document.documentElement : null].filter(Boolean);

    rootEls.forEach(el => {
      // Device Class
      el.classList.remove('device-phone', 'device-tablet', 'device-desktop');
      el.classList.add(`device-${deviceClass}`);

      // Orientation
      el.classList.remove('orientation-portrait', 'orientation-landscape');
      el.classList.add(`orientation-${orientation}`);

      // Active Game vs App Shell
      if (state.isPlayingGame) {
        el.classList.add('active-game');
        el.classList.remove('app-shell');
        el.classList.add('playing-game'); // backwards compatibility
      } else {
        el.classList.add('app-shell');
        el.classList.remove('active-game');
        el.classList.remove('playing-game');
      }
    });

    // Phone Landscape Guardian:
    // If phone AND landscape: pause active RPG map and reveal companion screen
    const companionScreen = typeof document !== 'undefined' ? document.getElementById('landscape-companion-screen') : null;
    if (deviceClass === 'phone' && orientation === 'landscape') {
      state.isPaused = true;
      resetJoystick();
      if (companionScreen) {
        companionScreen.style.display = 'flex';
        const compPlace = document.getElementById('companion-place');
        const compQuest = document.getElementById('companion-quest');
        const compLp = document.getElementById('companion-lp');
        const compVirtue = document.getElementById('companion-virtue');
        if (compPlace) compPlace.textContent = PLACES[state.activePlaceId] ? PLACES[state.activePlaceId].name : 'My Home';
        if (compQuest) compQuest.textContent = state.questStatus === 'completed' ? 'Completed' : 'Garden Care';
        if (compLp) compLp.textContent = `${state.lp} LP`;
        if (compVirtue) compVirtue.textContent = 'Stewardship';
      }
    } else {
      if (companionScreen) {
        companionScreen.style.display = 'none';
      }
      if (state.isPaused) {
        state.isPaused = false;
      }
    }

    // Sync visual viewport height
    updateVisualViewportHeight();

    // If active game on portrait phone or desktop, calibrate viewport
    if ((deviceClass === 'phone' && orientation === 'portrait' && state.isPlayingGame) || deviceClass === 'desktop') {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          calibrateGameViewport();
        });
      }
    }

    updateDebugHud();
  }

  // ============================================================
  // 5. RESPONSIVE PORTRAIT CAMERA VIEWPORT & CALIBRATION ENGINE
  // ============================================================
  function updateCamera() {
    const visibleW = camera.viewportWidth / camera.zoom;
    const visibleH = camera.viewportHeight / camera.zoom;
    const playerPixelX = state.avatar.x * TILE_SIZE;
    const playerPixelY = state.avatar.y * TILE_SIZE;

    // Directional Lookahead (slight vertical offset for natural viewing)
    let lookaheadX = 0;
    let lookaheadY = 0;
    if (state.avatar.dir === 'up') lookaheadY = -24;
    else if (state.avatar.dir === 'down') lookaheadY = 24;
    else if (state.avatar.dir === 'left') lookaheadX = -24;
    else if (state.avatar.dir === 'right') lookaheadX = 24;

    let targetX = (playerPixelX + lookaheadX) - visibleW / 2;
    let targetY = (playerPixelY + lookaheadY) - visibleH / 2;

    // Clamping to logical room bounds & centering when stage is larger
    if (visibleW >= LOGICAL_WIDTH) {
      targetX = (LOGICAL_WIDTH - visibleW) / 2;
    } else {
      targetX = Math.max(0, Math.min(LOGICAL_WIDTH - visibleW, targetX));
    }

    if (visibleH >= LOGICAL_HEIGHT) {
      targetY = (LOGICAL_HEIGHT - visibleH) / 2;
    } else {
      targetY = Math.max(0, Math.min(LOGICAL_HEIGHT - visibleH, targetY));
    }

    camera.x = targetX;
    camera.y = targetY;
  }

  function calibrateGameViewport() {
    if (!canvas && typeof document !== 'undefined') canvas = document.getElementById('gameCanvas');
    if (!gameStage && typeof document !== 'undefined') gameStage = document.getElementById('game-stage');
    if (!canvas || !gameStage) return false;

    updateVisualViewportHeight();

    const rect = gameStage.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    // Verify non-zero dimensions before calculating camera!
    if (width <= 0 || height <= 0) return false;

    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    camera.viewportWidth = width;
    camera.viewportHeight = height;
    camera.dpr = dpr;

    // Zoom calibration based on robust device class:
    // Phone portrait: zoom ~1.35x ensures ~8.5-10 horizontal tiles and ~16-20 vertical tiles visible
    // Desktop studio: zoom ~1.6x for crisp high-density pixel art
    if (state.responsive?.deviceClass === 'phone') {
      camera.zoom = 1.35;
    } else if (state.responsive?.deviceClass === 'desktop' || width >= 850) {
      camera.zoom = 1.6;
    } else {
      camera.zoom = 1.45;
    }

    updateCamera();
    renderFrame();
    updateDebugHud();
    return true;
  }

  // Alias for backward compatibility
  function resizeGameCanvas() {
    return calibrateGameViewport();
  }

  function updateVisualViewportHeight() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
  }

  // ============================================================
  // 6. WORLD RENDERING (WARM PAINTERLY PIXEL ART, ZERO BLACK VOIDS)
  // ============================================================
  function drawEnvironmentalSurroundings(ctx) {
    // Rich, warm courtyard lawn outside room borders
    ctx.fillStyle = '#222C20';
    ctx.fillRect(-300, -300, LOGICAL_WIDTH + 600, LOGICAL_HEIGHT + 600);

    // Subtle grass blade textures
    ctx.fillStyle = '#2D3A2B';
    for (let x = -240; x < LOGICAL_WIDTH + 240; x += 44) {
      for (let y = -240; y < LOGICAL_HEIGHT + 240; y += 44) {
        if (x < 0 || x > LOGICAL_WIDTH || y < 0 || y > LOGICAL_HEIGHT) {
          ctx.fillRect(x, y, 4, 8);
          ctx.fillRect(x + 12, y + 14, 4, 8);
        }
      }
    }
  }

  function renderHomeWorld(ctx) {
    // Floor
    ctx.fillStyle = '#E8DEC8';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Warm wooden floorboards in bedroom
    ctx.strokeStyle = '#D4C6AB';
    ctx.lineWidth = 1;
    for (let r = 1; r < 11; r++) {
      ctx.beginPath();
      ctx.moveTo(32, r * 32);
      ctx.lineTo(LOGICAL_WIDTH - 32, r * 32);
      ctx.stroke();
    }

    // Veranda / Garden lower section
    if (state.gardenState === 'lush') {
      ctx.fillStyle = '#C8E6C9'; // Soft blooming green
    } else {
      ctx.fillStyle = '#D7CCC8'; // Dry sandy earth
    }
    ctx.fillRect(32, 11 * 32, LOGICAL_WIDTH - 64, 6 * 32);

    // Veranda railing / partition
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(32, 11 * 32 - 4, 9 * 32, 8);
    ctx.fillRect(14 * 32, 11 * 32 - 4, (WORLD_COLS - 15) * 32, 8);

    // Garden Gate Archway
    ctx.fillStyle = state.gateOpen ? '#81C784' : '#A1887F';
    ctx.fillRect(10 * 32, 11 * 32 - 6, 4 * 32, 12);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 9px "Clear Sans", sans-serif';
    ctx.fillText(state.gateOpen ? 'GATE OPEN' : 'GARDEN GATE', 10 * 32 + 10, 11 * 32 + 3);

    // Bed (Hearth Room)
    ctx.fillStyle = '#6A0E04'; // Brand Burgundy bed frame
    ctx.fillRect(2 * 32, 2 * 32, 3 * 32, 4 * 32);
    ctx.fillStyle = '#FFF9F3'; // Warm White linen
    ctx.fillRect(2 * 32 + 4, 2 * 32 + 4, 3 * 32 - 8, 3 * 32);
    ctx.fillStyle = '#FDC63F'; // Flame Gold blanket
    ctx.fillRect(2 * 32 + 4, 3 * 32, 3 * 32 - 8, 3 * 32 - 4);

    // Desk & Study Lamp
    ctx.fillStyle = '#A1887F';
    ctx.fillRect(6 * 32, 2 * 32, 3 * 32, 32);
    ctx.fillStyle = '#FDC63F'; // Lamp glow
    ctx.beginPath();
    ctx.arc(8 * 32, 2 * 32 + 12, 10, 0, Math.PI * 2);
    ctx.fill();

    // Bookshelf
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(12 * 32, 2 * 32, 4 * 32, 32);
    ctx.fillStyle = '#EB5F12';
    ctx.fillRect(12 * 32 + 4, 2 * 32 + 4, 8, 24);
    ctx.fillStyle = '#F99320';
    ctx.fillRect(13 * 32 + 2, 2 * 32 + 4, 8, 24);

    // Uncle Barnaby (Hearth Elder NPC) at (10, 6)
    renderNpc(ctx, 10, 6, '👴', 'Uncle Barnaby', '#6A0E04');

    // Garden Patch & Potted Ferns
    if (state.gardenState === 'lush') {
      // 12 Blooming Flowers
      for (let i = 0; i < 12; i++) {
        const fx = 3 * 32 + (i % 6) * 44;
        const fy = 13 * 32 + Math.floor(i / 6) * 36;
        ctx.fillStyle = (i % 2 === 0) ? '#EB5F12' : '#FDC63F';
        ctx.beginPath();
        ctx.arc(fx, fy, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#D22F0A';
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = '24px sans-serif';
      ctx.fillText('🪴', 4 * 32 - 12, 14 * 32 + 8);
      ctx.fillStyle = '#2E7D32';
      ctx.font = 'bold 12px "Clear Sans", sans-serif';
      ctx.fillText('🌸 Flourishing Garden Plot', 4 * 32 + 16, 14 * 32);
    } else {
      // Dry sprout / thirsty soil indicator
      ctx.font = '24px sans-serif';
      ctx.fillText('🥀', 4 * 32 - 12, 14 * 32 + 8);
      ctx.fillStyle = '#8D6E63';
      ctx.font = 'bold 12px "Clear Sans", sans-serif';
      ctx.fillText('Thirsty Soil (Needs Water)', 4 * 32 + 16, 14 * 32);
    }

    // South Perimeter Timber Gate (Leading out to FOG Community Center)
    const gateY = (WORLD_ROWS - 1) * 32;
    ctx.fillStyle = state.gateOpen ? '#2E7D32' : '#8D6E63';
    ctx.fillRect(10 * 32, gateY - 8, 5 * 32, 14);

    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.gateOpen ? 'GATE OPEN — TO FOG CENTER' : 'LOCKED — PERIMETER GATE', 12.5 * 32, gateY + 2);
    ctx.textAlign = 'left';

    if (!state.gateOpen) {
      ctx.font = '16px sans-serif';
      ctx.fillText('🔒', 12.5 * 32 - 8, gateY - 14);
    } else {
      ctx.font = '16px sans-serif';
      ctx.fillText('🏮', 10 * 32 + 4, gateY - 14);
      ctx.fillText('🏮', 14 * 32 + 12, gateY - 14);
    }
  }

  function renderFogCenterWorld(ctx) {
    // 1. Flooring: Polished light travertine / timber church campus
    ctx.fillStyle = '#F5ECE1';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Warm stone tiled grid pattern
    ctx.strokeStyle = 'rgba(213, 194, 177, 0.45)';
    ctx.lineWidth = 1;
    for (let c = 1; c < WORLD_COLS - 1; c++) {
      ctx.beginPath();
      ctx.moveTo(c * 32, 32);
      ctx.lineTo(c * 32, (WORLD_ROWS - 1) * 32);
      ctx.stroke();
    }
    for (let r = 1; r < WORLD_ROWS - 1; r++) {
      ctx.beginPath();
      ctx.moveTo(32, r * 32);
      ctx.lineTo((WORLD_COLS - 1) * 32, r * 32);
      ctx.stroke();
    }

    // Central aisle runner (Burgundy with gold border)
    ctx.fillStyle = '#6A0E04';
    ctx.fillRect(10 * 32, 3 * 32, 5 * 32, 14 * 32);
    ctx.strokeStyle = '#FDC63F';
    ctx.lineWidth = 2;
    ctx.strokeRect(10 * 32, 3 * 32, 5 * 32, 14 * 32);

    // 2. Sanctuary Platform & Altar (North)
    ctx.fillStyle = '#5D4037'; // Rich teak platform
    ctx.fillRect(8 * 32, 32, 9 * 32, 3 * 32);
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(8 * 32 + 4, 32 + 4, 9 * 32 - 8, 3 * 32 - 8);

    // Church Banner
    ctx.fillStyle = 'rgba(106, 14, 4, 0.95)';
    ctx.beginPath();
    ctx.roundRect(8 * 32 + 8, 38, 9 * 32 - 16, 26, 6);
    ctx.fill();
    ctx.strokeStyle = '#FDC63F';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 10px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FIRE OF GOD COMMUNITY CENTER', 12.5 * 32, 55);
    ctx.textAlign = 'left';

    // 3. Wooden Pews (Left and Right Wings)
    ctx.fillStyle = '#8D6E63';
    for (let r = 8; r <= 13; r += 2) {
      // Left seating rows
      ctx.fillRect(4 * 32, r * 32 + 6, 5 * 32, 18);
      // Right seating rows
      ctx.fillRect(16 * 32, r * 32 + 6, 5 * 32, 18);
    }

    // 4. Timber Columns / Pillars
    [6, 11].forEach(r => {
      [4, 20].forEach(c => {
        ctx.fillStyle = '#5D4037';
        ctx.beginPath();
        ctx.arc(c * 32 + 16, r * 32 + 16, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A1887F';
        ctx.beginPath();
        ctx.arc(c * 32 + 16, r * 32 + 16, 10, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // 5. Community Notice Board (Left)
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(7 * 32 - 4, 5 * 32 - 6, 36, 40);
    ctx.fillStyle = '#FFE4C7';
    ctx.fillRect(7 * 32, 5 * 32 - 2, 28, 32);
    ctx.font = '18px sans-serif';
    ctx.fillText('📜', 7 * 32 + 4, 5 * 32 + 20);

    ctx.fillStyle = '#6A0E04';
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillText('NOTICE BOARD', 7 * 32 - 12, 5 * 32 + 44);

    // 6. Timber Cross & Jasmine Arbor (Right)
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(18 * 32 + 12, 4 * 32, 8, 36);
    ctx.fillRect(18 * 32 + 4, 4 * 32 + 8, 24, 8);

    ctx.fillStyle = '#2E7D32';
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillText('PRAYER CROSS', 18 * 32 - 8, 5 * 32 + 44);

    // 7. Potted Palm Plants & Planters
    [[2, 4], [2, 14], [22, 4], [22, 14]].forEach(([c, r]) => {
      ctx.fillStyle = '#A1887F';
      ctx.fillRect(c * 32 + 6, r * 32 + 12, 20, 16);
      ctx.font = '22px sans-serif';
      ctx.fillText('🪴', c * 32 + 4, r * 32 + 16);
    });

    // 8. South Exit Gateway (To My Home)
    const exitY = (WORLD_ROWS - 1) * 32;
    ctx.fillStyle = '#8D6E63';
    ctx.fillRect(10 * 32, exitY - 8, 5 * 32, 14);
    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GATEWAY — TO MY HOME', 12.5 * 32, exitY + 2);
    ctx.textAlign = 'left';

    // 9. Render Sister Grace (Welcome Coordinator) at (12, 5)
    renderNpc(ctx, 12, 5, '👩‍💼', 'Sister Grace', '#D22F0A');
  }

  function renderSchoolWorld(ctx) {
    ctx.fillStyle = '#EFEBE9';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(7 * 32, 1 * 32, 11 * 32, 36);
    renderNpc(ctx, 12, 3, '👨‍🏫', 'Brother David', '#2E7D32');
  }

  function renderSportsHubWorld(ctx) {
    ctx.fillStyle = '#D7CCC8';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.strokeStyle = '#D22F0A';
    ctx.lineWidth = 3;
    ctx.strokeRect(3 * 32, 3 * 32, 19 * 32, 12 * 32);
    renderNpc(ctx, 12, 5, '🏃', 'Coach Marcus', '#EB5F12');
  }

  function renderOutreachWorld(ctx) {
    ctx.fillStyle = '#E0F2F1';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = '#A1887F';
    ctx.fillRect(4 * 32, 4 * 32, 17 * 32, 28);
    renderNpc(ctx, 12, 3, '🧔', 'Deacon Thomas', '#00796B');
  }

  function renderNpc(ctx, tileX, tileY, emoji, name, tagColor) {
    const px = tileX * TILE_SIZE;
    const py = tileY * TILE_SIZE;

    // NPC Shadow
    ctx.fillStyle = 'rgba(38, 34, 32, 0.22)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // NPC Emoji
    ctx.font = '26px sans-serif';
    ctx.fillText(emoji, px + 2, py + 24);

    // NPC Name Tag
    ctx.fillStyle = 'rgba(255, 249, 243, 0.95)';
    ctx.strokeStyle = tagColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px - 14, py - 14, 60, 16, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = tagColor;
    ctx.font = 'bold 9px "Clear Sans", sans-serif';
    ctx.fillText(name.split(' ')[0], px - 8, py - 2);
  }

  function renderAvatar(ctx) {
    const av = state.avatar;
    const px = av.x * TILE_SIZE;
    const py = av.y * TILE_SIZE;

    // Shadow
    ctx.fillStyle = 'rgba(38, 34, 32, 0.28)';
    ctx.beginPath();
    ctx.ellipse(px, py + 12, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body / Tunic (Burgundy)
    ctx.fillStyle = '#6A0E04';
    ctx.beginPath();
    ctx.roundRect(px - 9, py - 4, 18, 16, 4);
    ctx.fill();

    // Head
    ctx.fillStyle = av.skinTone;
    ctx.beginPath();
    ctx.arc(px, py - 10, 9, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = av.hairColor;
    ctx.beginPath();
    ctx.arc(px, py - 13, 8, Math.PI, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#262220';
    if (av.dir === 'down') {
      ctx.fillRect(px - 4, py - 10, 2, 2);
      ctx.fillRect(px + 2, py - 10, 2, 2);
    } else if (av.dir === 'left') {
      ctx.fillRect(px - 5, py - 10, 2, 2);
    } else if (av.dir === 'right') {
      ctx.fillRect(px + 3, py - 10, 2, 2);
    }

    // Name Tag
    ctx.fillStyle = 'rgba(255, 249, 243, 0.9)';
    ctx.strokeStyle = '#D5C2B1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px - 18, py - 30, 36, 14, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6A0E04';
    ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
    ctx.fillText(av.name, px - 11, py - 20);

    // Emote Bubble if active
    if (state.emoteBubble && state.emoteTimer > 0) {
      ctx.fillStyle = '#FFF9F3';
      ctx.strokeStyle = '#F99320';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(px - 14, py - 60, 28, 24, 8);
      ctx.fill();
      ctx.stroke();

      ctx.font = '16px sans-serif';
      ctx.fillText(state.emoteBubble, px - 8, py - 42);
    }
  }

  // ============================================================
  // 7. MAIN RENDER LOOP & DIAGNOSTIC HUD (?debug=1)
  // ============================================================
  function renderFrame() {
    if (!ctx || !canvas) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#263124'; // Environmental deep courtyard tone
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.save();
    ctx.scale(camera.dpr * camera.zoom, camera.dpr * camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawEnvironmentalSurroundings(ctx);

    if (state.activePlaceId === 'home') renderHomeWorld(ctx);
    else if (state.activePlaceId === 'fog_center') renderFogCenterWorld(ctx);
    else if (state.activePlaceId === 'school') renderSchoolWorld(ctx);
    else if (state.activePlaceId === 'sports_hub') renderSportsHubWorld(ctx);
    else if (state.activePlaceId === 'outreach') renderOutreachWorld(ctx);
    else renderHomeWorld(ctx);

    renderAvatar(ctx);
    ctx.restore();
  }

  function render() {
    if (!ctx || !canvas) {
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(render);
      return;
    }

    // If game is paused (e.g. mobile phone rotated to landscape), do not re-render active map
    if (state.isPaused) {
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(render);
      return;
    }

    const isPhone = state.responsive?.deviceClass === 'phone';
    const isLandscape = state.responsive?.orientation === 'landscape';

    // On phone: only render if active game AND in portrait
    if (isPhone && (!state.isPlayingGame || isLandscape)) {
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(render);
      return;
    }

    updateCamera();
    renderFrame();

    // Decrement emote timer
    if (state.emoteTimer > 0) state.emoteTimer--;
    else state.emoteBubble = null;

    // Proximity check for NPC interaction
    updateProximity();

    // Update diagnostic HUD
    if (isDebugMode) updateDebugHud();

    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(render);
  }

  function updateDebugHud() {
    const hud = typeof document !== 'undefined' ? document.getElementById('debug-hud') : null;
    if (!hud) return;
    if (!isDebugMode) {
      hud.classList.remove('visible');
      return;
    }
    hud.classList.add('visible');

    const r = state.responsive || {};
    const stageRect = gameStage ? gameStage.getBoundingClientRect() : { width: 0, height: 0 };
    const stageW = Math.round(stageRect.width);
    const stageH = Math.round(stageRect.height);
    const backingW = canvas ? canvas.width : 0;
    const backingH = canvas ? canvas.height : 0;
    const visibleTilesX = (camera.viewportWidth / (camera.zoom || 1) / TILE_SIZE).toFixed(1);
    const visibleTilesY = (camera.viewportHeight / (camera.zoom || 1) / TILE_SIZE).toFixed(1);

    const nearest = getNearestInteractable ? getNearestInteractable() : null;
    const nearestDesc = nearest ? `${nearest.item.name} (${nearest.dist.toFixed(1)}m)` : 'None';

    const sm = state.storageMeta || {};

    hud.innerHTML = `
      <strong>KOINONIA Phase 0.13.1 Engine HUD</strong><br>
      Place: <b>${state.activePlaceId}</b> | Spawn: <b>${state.spawnId || 'default'}</b><br>
      Pos: <b>(${state.avatar.x.toFixed(1)}, ${state.avatar.y.toFixed(1)})</b> | Dir: <b>${state.avatar.dir}</b><br>
      Nearest: <span style="color:var(--brand-flame-gold);font-weight:700;">${nearestDesc}</span><br>
      Quest: <b>${state.questStatus}</b> | Objective: <b>${state.currentObjective}</b><br>
      Gate Open: <b>${state.gateOpen}</b> | FOG Unlocked: <b>${state.fogCenterUnlocked}</b><br>
      Visited FOG: <b>${state.visitedFogCenter}</b> | Reward Claimed: <b>${state.rewardClaimed}</b><br>
      LP: <b>${state.lp}</b> | Stew XP: <b>${state.skills.stewardship}</b> | Resp XP: <b>${state.skills.responsibility}</b><br>
      Device: <b>${(r.deviceClass || '').toUpperCase()}</b> | Orient: <b>${(r.orientation || '').toUpperCase()}</b><br>
      Stage: <b>${stageW}x${stageH}px</b> | Cam: (${Math.round(camera.x)}, ${Math.round(camera.y)})<br>
      Joystick: <b>${joystick.active ? 'ACTIVE' : 'IDLE'}</b> | Vec: (${joystick.vectorX.toFixed(2)}, ${joystick.vectorY.toFixed(2)}) | Mag: ${(joystick.intensity * 100).toFixed(0)}%
      <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.25); font-size:10px; line-height:1.35;">
        <strong style="color:var(--brand-flame-gold);">PERSISTENCE TELEMETRY:</strong><br>
        Origin: <b>${sm.origin || 'Same-Origin'}</b><br>
        Storage available: <b>${sm.available ? 'TRUE' : 'FALSE'}</b><br>
        Save key: <code>${SAVE_STORAGE_KEY}</code><br>
        Save exists: <b>${sm.saveExists ? 'TRUE' : 'FALSE'}</b><br>
        Save version: <b>${sm.saveVersion || SAVE_VERSION}</b><br>
        Last save: <small>${sm.lastSaveTime || 'None'}</small><br>
        Last save reason: <b>${sm.lastSaveReason || 'N/A'}</b><br>
        Last load: <small>${sm.lastLoadTime || 'None'}</small><br>
        Load result: <b>${sm.loadResult || 'pending'}</b><br>
        Stored LP: <b>${sm.storedLP !== null && sm.storedLP !== undefined ? sm.storedLP : 'N/A'}</b> | Runtime LP: <b>${state.lp}</b><br>
        Stored quest: <b>${sm.storedQuest || 'N/A'}</b> | Runtime quest: <b>${state.questStatus}</b><br>
        Stored gate: <b>${sm.storedGate !== null && sm.storedGate !== undefined ? sm.storedGate : 'N/A'}</b> | Runtime gate: <b>${state.gateOpen}</b><br>
        Stored FOG unlock: <b>${sm.storedFogUnlock !== null && sm.storedFogUnlock !== undefined ? sm.storedFogUnlock : 'N/A'}</b> | Runtime FOG unlock: <b>${state.fogCenterUnlocked}</b>
      </div>
    `;
  }

  // ============================================================
  // 8. PLAYER MOVEMENT & COLLISION
  // ============================================================
  const keys = {};

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        handleActionInteract();
      }
      if (e.key === 'p' || e.key === 'P') {
        triggerEmote('🙏');
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.key.toLowerCase()] = false;
    });
  }

  // Virtual Analog Joystick Controller Logic
  function updateJoystickPosition(clientX, clientY) {
    const baseEl = typeof document !== 'undefined' ? document.getElementById('joystick-base') : null;
    const knobEl = typeof document !== 'undefined' ? document.getElementById('joystick-knob') : null;
    if (!baseEl || !knobEl) return;

    // Refresh center & radius from base element bounding box
    const rect = baseEl.getBoundingClientRect();
    joystick.baseX = rect.left + rect.width / 2;
    joystick.baseY = rect.top + rect.height / 2;
    joystick.baseRadius = rect.width / 2;

    const dx = clientX - joystick.baseX;
    const dy = clientY - joystick.baseY;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const maxRadius = joystick.baseRadius;
    const deadZone = maxRadius * joystick.deadZoneRatio;

    joystick.rawDx = dx;
    joystick.rawDy = dy;
    joystick.distance = distance;
    joystick.angle = angle;

    // Constrain knob within outer joystick boundary
    const clampedDist = Math.min(distance, maxRadius);
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;
    knobEl.style.transform = `translate(${Math.round(knobX)}px, ${Math.round(knobY)}px)`;

    // Dead zone check (12% of radius)
    if (distance <= deadZone) {
      joystick.vectorX = 0;
      joystick.vectorY = 0;
      joystick.intensity = 0;
      joystick.speedPercent = 0;
    } else {
      // Normalized distance beyond dead zone [0.0, 1.0]
      const normalizedDist = Math.min(1.0, (distance - deadZone) / (maxRadius - deadZone));
      // Comfortable analog intensity response curve
      const intensity = Math.min(1.0, Math.pow(normalizedDist, 0.85));

      joystick.vectorX = Math.cos(angle) * intensity;
      joystick.vectorY = Math.sin(angle) * intensity;
      joystick.intensity = intensity;
      joystick.speedPercent = Math.round(intensity * 100);

      // Facing direction update based on primary axis
      const absX = Math.abs(joystick.vectorX);
      const absY = Math.abs(joystick.vectorY);
      if (absY >= absX) {
        state.avatar.dir = joystick.vectorY > 0 ? 'down' : 'up';
      } else {
        state.avatar.dir = joystick.vectorX > 0 ? 'right' : 'left';
      }
    }

    if (isDebugMode) updateDebugHud();
  }

  function resetJoystick() {
    const baseEl = typeof document !== 'undefined' ? document.getElementById('joystick-base') : null;
    const knobEl = typeof document !== 'undefined' ? document.getElementById('joystick-knob') : null;

    if (baseEl && joystick.pointerId !== null) {
      try {
        if (typeof baseEl.hasPointerCapture === 'function' && baseEl.hasPointerCapture(joystick.pointerId)) {
          baseEl.releasePointerCapture(joystick.pointerId);
        }
      } catch (err) {}
    }

    joystick.active = false;
    joystick.pointerId = null;
    joystick.rawDx = 0;
    joystick.rawDy = 0;
    joystick.distance = 0;
    joystick.vectorX = 0;
    joystick.vectorY = 0;
    joystick.intensity = 0;
    joystick.speedPercent = 0;

    if (baseEl) baseEl.classList.remove('active');
    if (knobEl) knobEl.style.transform = 'translate(0px, 0px)';
    if (state.avatar) state.avatar.isMoving = false;

    if (isDebugMode) updateDebugHud();
  }

  function setupJoystick() {
    const baseEl = typeof document !== 'undefined' ? document.getElementById('joystick-base') : null;
    if (!baseEl) return;

    baseEl.addEventListener('pointerdown', (e) => {
      // Independent pointer tracking: multi-touch ignores non-primary touch on joystick
      if (joystick.active) return;
      e.preventDefault();

      joystick.active = true;
      joystick.pointerId = e.pointerId;
      baseEl.classList.add('active');

      try {
        if (typeof baseEl.setPointerCapture === 'function') {
          baseEl.setPointerCapture(e.pointerId);
        }
      } catch (err) {}

      updateJoystickPosition(e.clientX, e.clientY);
    });

    baseEl.addEventListener('pointermove', (e) => {
      if (!joystick.active || e.pointerId !== joystick.pointerId) return;
      e.preventDefault();
      updateJoystickPosition(e.clientX, e.clientY);
    });

    const handlePointerEnd = (e) => {
      if (!joystick.active || e.pointerId !== joystick.pointerId) return;
      e.preventDefault();
      resetJoystick();
    };

    baseEl.addEventListener('pointerup', handlePointerEnd);
    baseEl.addEventListener('pointercancel', handlePointerEnd);
  }

  // Unified Movement Pipeline (Keyboard + Mobile Virtual Joystick)
  function updatePlayerMovement() {
    if (state.isPaused) return;
    const isPhone = state.responsive?.deviceClass === 'phone';
    const isLandscape = state.responsive?.orientation === 'landscape';
    if (isPhone && (!state.isPlayingGame || isLandscape)) return;

    const av = state.avatar;
    let vx = 0;
    let vy = 0;

    // 1. Keyboard Input Pipeline (WASD / Arrow Keys)
    let kx = 0;
    let ky = 0;
    if (keys['arrowup'] || keys['w']) ky -= 1;
    if (keys['arrowdown'] || keys['s']) ky += 1;
    if (keys['arrowleft'] || keys['a']) kx -= 1;
    if (keys['arrowright'] || keys['d']) kx += 1;

    if (kx !== 0 || ky !== 0) {
      const kLen = Math.hypot(kx, ky);
      vx = kx / kLen;
      vy = ky / kLen;
      if (Math.abs(ky) >= Math.abs(kx)) {
        av.dir = ky > 0 ? 'down' : 'up';
      } else {
        av.dir = kx > 0 ? 'right' : 'left';
      }
    }

    // 2. Mobile Analog Joystick Input Pipeline (continuous 360° analog vector)
    if (joystick.active && (joystick.vectorX !== 0 || joystick.vectorY !== 0)) {
      vx = joystick.vectorX;
      vy = joystick.vectorY;
    }

    // 3. Unified Movement Execution with Diagonal Speed Normalization & Natural Sliding
    const mag = Math.hypot(vx, vy);
    if (mag > 0.001) {
      // Magnitude strictly capped at 1.0 (diagonal speed normalization)
      const clampedMag = Math.min(1.0, mag);
      const normX = (vx / mag) * clampedMag;
      const normY = (vy / mag) * clampedMag;

      const step = (av.speed / 60);
      const stepX = normX * step;
      const stepY = normY * step;

      const nextX = av.x + stepX;
      const nextY = av.y + stepY;

      // Natural axis sliding collision: test horizontal and vertical independently
      // Natural axis sliding collision: test horizontal and vertical independently
      const movedX = isWalkable(nextX, av.y);
      const movedY = isWalkable(av.x, nextY);
      if (movedX) av.x = nextX;
      if (movedY) av.y = nextY;
      av.isMoving = movedX || movedY;

      // Auto-trigger gate transition if walking through South Gate
      if (state.activePlaceId === 'home' && state.gateOpen && av.y >= 16.2 && av.x >= 10.2 && av.x <= 14.8) {
        if (!state.isTransitioning) {
          transitionToPlace('fog_center', 'from_home');
        }
      } else if (state.activePlaceId === 'fog_center' && av.y >= 16.2 && av.x >= 10.2 && av.x <= 14.8) {
        if (!state.isTransitioning) {
          transitionToPlace('home', 'from_fog_center');
        }
      }

      if (av.isMoving) {
        queuePositionSave();
      }
    } else {
      if (av.isMoving) {
        av.isMoving = false;
        queuePositionSave();
      }
    }
  }

  if (typeof setInterval !== 'undefined') {
    setInterval(updatePlayerMovement, 1000 / 60);
  }

  // ============================================================
  // 9. UNIFIED INTERACTABLES REGISTRY & PROXIMITY SYSTEM
  // ============================================================
  function getInteractablesForPlace(placeId) {
    if (placeId === 'home') {
      return [
        {
          id: 'barnaby',
          name: 'Uncle Barnaby',
          x: 10.0,
          y: 6.0,
          radius: 2.3,
          type: 'npc',
          getPrompt: () => 'TALK — Uncle Barnaby [E]',
          onInteract: () => openDialogueModal('barnaby')
        },
        {
          id: 'garden_plants',
          name: 'Garden Potted Plants',
          x: 4.0,
          y: 14.0,
          radius: 2.3,
          type: 'object',
          getPrompt: () => state.gardenState === 'lush' ? 'INSPECT — Blooming Ferns [E]' : 'INSPECT — Thirsty Plants [E]',
          onInteract: () => handleGardenInspect()
        },
        {
          id: 'home_gate',
          name: 'Perimeter Garden Gate',
          x: 12.0,
          y: 16.8,
          radius: 2.2,
          type: 'gate',
          getPrompt: () => state.gateOpen ? 'TRAVEL — Enter FOG Community Center [E]' : 'LOCKED — Complete Garden Quest First',
          onInteract: () => handleHomeGateInteract()
        },
        {
          id: 'veranda_arch',
          name: 'Veranda Archway',
          x: 11.5,
          y: 11.0,
          radius: 1.8,
          type: 'object',
          getPrompt: () => state.gateOpen ? 'GARDEN GATE — Unlocked [E]' : 'GARDEN GATE — Open Veranda Doorway',
          onInteract: () => {
            if (!state.gateOpen) showToast('🌱 Veranda doorway open. Complete Quest #001 to unlock the outer perimeter gate south!');
            else showToast('🌿 The path to FOG Center is open south at the perimeter gate!');
          }
        }
      ];
    } else if (placeId === 'fog_center') {
      return [
        {
          id: 'sister_grace',
          name: 'Sister Grace',
          x: 12.0,
          y: 5.0,
          radius: 2.4,
          type: 'npc',
          getPrompt: () => 'TALK — Sister Grace [E]',
          onInteract: () => openDialogueModal('sister_grace')
        },
        {
          id: 'center_board',
          name: 'Community Notice Board',
          x: 7.0,
          y: 5.0,
          radius: 2.2,
          type: 'object',
          getPrompt: () => 'READ — Community Notice Board [E]',
          onInteract: () => openQuestsTabModal()
        },
        {
          id: 'prayer_cross',
          name: 'Timber Cross & Jasmine Arbor',
          x: 18.0,
          y: 5.0,
          radius: 2.2,
          type: 'object',
          getPrompt: () => 'PRAY — Timber Cross [E]',
          onInteract: () => {
            triggerEmote('🙏');
            showToast('✝️ "Where two or three gather in my name, there am I with them."');
          }
        },
        {
          id: 'center_exit_gate',
          name: 'Gate to My Home',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          type: 'gate',
          getPrompt: () => 'TRAVEL — Return to My Home [E]',
          onInteract: () => handleFogCenterExitInteract()
        }
      ];
    }
    return [];
  }

  function getNearestInteractable() {
    const list = getInteractablesForPlace(state.activePlaceId);
    let nearest = null;
    let minDist = Infinity;
    for (const item of list) {
      const d = Math.hypot(state.avatar.x - item.x, state.avatar.y - item.y);
      if (d < item.radius && d < minDist) {
        minDist = d;
        nearest = { item, dist: d };
      }
    }
    return nearest;
  }

  function updateProximity() {
    const prompt = typeof document !== 'undefined' ? document.getElementById('proximity-prompt') : null;
    if (!prompt) return;

    if (state.dialogue.active || state.isTransitioning) {
      prompt.classList.add('hidden');
      return;
    }

    const nearest = getNearestInteractable();
    if (nearest) {
      prompt.textContent = nearest.item.getPrompt();
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }
  }

  function handleActionInteract() {
    const nearest = getNearestInteractable();
    if (nearest) {
      nearest.item.onInteract();
      return;
    }

    // Fallback if nothing nearby
    if (state.questStatus !== 'completed') {
      openQuestDetailModal('Q-001');
    } else {
      showToast('Explore the world and talk to community members!');
    }
  }

  function handleHomeGateInteract() {
    if (!state.gateOpen) {
      playBellSound();
      showToast('🔒 Gate is locked! Complete Quest #001: Steward of the Garden to unlock.');
      return;
    }
    transitionToPlace('fog_center', 'from_home');
  }

  function handleFogCenterExitInteract() {
    transitionToPlace('home', 'from_fog_center');
  }

  function handleGardenInspect() {
    if (state.questStatus === 'completed' || state.gardenState === 'lush') {
      showToast('🌸 The garden is flourishing with fresh green leaves and blooming flowers!');
      triggerEmote('🌱');
    } else if (state.questStatus === 'in_progress') {
      openQuestDetailModal('Q-001');
    } else {
      openQuestDetailModal('Q-001');
    }
  }

  function triggerEmote(emoji) {
    state.emoteBubble = emoji;
    state.emoteTimer = 120; // 2 seconds @ 60fps
    playBellSound();
  }

  // ============================================================
  // 10. SEAMLESS PLACE TRANSITION ENGINE
  // ============================================================
  function transitionToPlace(targetPlaceId, spawnId = 'default') {
    if (state.isTransitioning) return;
    state.isTransitioning = true;

    const targetPlace = PLACES[targetPlaceId] || { name: 'New Place', icon: '📍', tagline: 'Fire of God Community' };
    const overlay = document.getElementById('place-transition-overlay');
    const iconEl = document.getElementById('transition-icon');
    const titleEl = document.getElementById('transition-title');
    const subtitleEl = document.getElementById('transition-subtitle');

    if (iconEl) iconEl.textContent = targetPlace.icon || '⛪';
    if (titleEl) titleEl.textContent = `Entering ${targetPlace.name}...`;
    if (subtitleEl) subtitleEl.textContent = targetPlace.tagline || 'Fire of God Ministries Virtual Community';

    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
    }

    playBellSound();

    setTimeout(() => {
      // Switch place
      state.activePlaceId = targetPlaceId;
      state.spawnId = spawnId;

      // Apply spawn coordinates
      const placeSpawns = SPAWN_POINTS[targetPlaceId] || {};
      const spawn = placeSpawns[spawnId] || placeSpawns.default || { x: 12.0, y: 10.0, dir: 'down' };
      state.avatar.x = spawn.x;
      state.avatar.y = spawn.y;
      state.avatar.dir = spawn.dir || 'down';
      state.avatar.isMoving = false;

      // First-time arrival moment in FOG Center
      if (targetPlaceId === 'fog_center' && !state.visitedFogCenter) {
        state.visitedFogCenter = true;
        state.currentObjective = 'Explore FOG Community Center & Talk to Sister Grace';
        showToast('⛪ Welcome to FOG Community Center!');
      }

      // Rebuild collision grid for target place
      initCollisionGrid();

      // Update UI headers and labels
      updatePlaceUiDisplays();

      // Recalibrate camera and viewport
      calibrateGameViewport();

      // Save state
      saveToStorage('place_transition');

      // Fade out overlay
      setTimeout(() => {
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
            state.isTransitioning = false;
          }, 350);
        } else {
          state.isTransitioning = false;
        }
      }, 350);
    }, 350);
  }

  // ============================================================
  // 11. PORTRAIT-FIRST GAMEPLAY TRANSITIONS
  // ============================================================
  function enterWorldFromHomeCard() {
    state.isPlayingGame = true;
    updateResponsiveState();
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          calibrateGameViewport();
        });
      });
    }
    playBellSound();
  }

  function exitWorldToHomeCard(skipSave = false) {
    state.isPlayingGame = false;
    resetJoystick();
    updateResponsiveState();
    if (!skipSave) {
      saveToStorage('exit_world');
    }
  }

  // ============================================================
  // 12. REUSABLE NPC & STATE-REACTIVE DIALOGUE ENGINE
  // ============================================================
  function openDialogueModal(npcId = 'barnaby') {
    state.dialogue.active = true;
    const modal = document.getElementById('npc-dialogue-modal');
    const speakerEl = document.getElementById('dialogue-speaker');
    const roleEl = document.getElementById('dialogue-role');
    const portraitEl = document.getElementById('dialogue-portrait');
    const textEl = document.getElementById('dialogue-text');
    const actionBtn = document.getElementById('btn-dialogue-action');

    if (npcId === 'barnaby') {
      state.dialogue.speaker = 'Uncle Barnaby';
      state.dialogue.role = 'Garden Mentor • My Home';
      state.dialogue.portrait = '👴';

      if (state.questStatus === 'ready') {
        if (textEl) textEl.textContent = '"Peace be with you, Alex! The plants on our veranda are looking thirsty today. Faithful stewardship begins at home in small, quiet chores."';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'VIEW GARDEN QUEST';
          actionBtn.onclick = () => openQuestDetailModal('Q-001');
        }
      } else if (state.questStatus === 'in_progress') {
        if (textEl) textEl.textContent = '"Remember, Alex: real stewardship isn\'t finished on this screen. Step outside, water those living plants, and come back when you\'re done!"';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'CHECK MISSION PROGRESS';
          actionBtn.onclick = () => {
            closeDialogueModal();
            const standby = document.getElementById('standby-modal');
            if (standby) standby.classList.remove('hidden');
          };
        }
      } else {
        // Completed
        if (textEl) textEl.textContent = '"Glory to God! Look how lush and vibrant our garden is now. Because you were faithful in this small duty, the perimeter gate is unlocked. Walk south to visit the FOG Community Center!"';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'WALK TO FOG CENTER';
          actionBtn.onclick = () => {
            closeDialogueModal();
            transitionToPlace('fog_center', 'from_home');
          };
        }
      }
    } else if (npcId === 'sister_grace') {
      state.dialogue.speaker = 'Sister Grace';
      state.dialogue.role = 'Welcome Coordinator • FOG Community Center';
      state.dialogue.portrait = '👩‍💼';

      if (!state.visitedFogCenter || state.currentObjective.includes('Sister Grace')) {
        state.visitedFogCenter = true;
        state.currentObjective = 'Explore FOG Community Center';
        updateObjectiveDisplay();
        saveToStorage('sister_grace_greeting');
        if (textEl) textEl.textContent = '"Welcome to Fire of God Community Center, Alex! Uncle Barnaby sent word of your faithful garden stewardship. In our church community, every small act of diligence strengthens our fellowship."';
      } else {
        if (textEl) textEl.textContent = '"The Lord bless you, Alex! Feel free to walk around our fellowship hall and youth areas. More community service callings will be posted on the notice board soon."';
      }

      if (actionBtn) {
        actionBtn.style.display = 'inline-flex';
        actionBtn.querySelector('span').textContent = 'CHECK NOTICE BOARD';
        actionBtn.onclick = () => {
          closeDialogueModal();
          openQuestsTabModal();
        };
      }
    }

    if (speakerEl) speakerEl.textContent = state.dialogue.speaker;
    if (roleEl) roleEl.textContent = state.dialogue.role;
    if (portraitEl) portraitEl.textContent = state.dialogue.portrait;
    if (modal) modal.classList.remove('hidden');
    playBellSound();
  }

  function closeDialogueModal() {
    state.dialogue.active = false;
    const modal = document.getElementById('npc-dialogue-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openQuestDetailModal(questId = 'Q-001') {
    closeDialogueModal();
    const modal = document.getElementById('quest-detail-modal');
    if (modal) modal.classList.remove('hidden');
  }

  // ============================================================
  // 13. QUEST LIFECYCLE & CANONICAL REWARDS (+5 LP: 120 -> 125)
  // ============================================================
  function acceptQuest() {
    document.getElementById('quest-detail-modal').classList.add('hidden');
    state.questStatus = 'in_progress';
    state.currentObjective = 'Real-World Task: Water home plants';
    updateObjectiveDisplay();
    saveToStorage('quest_accept');
    const exitModal = document.getElementById('exit-ramp-modal');
    if (exitModal) exitModal.classList.remove('hidden');
  }

  function exitToRealWorld() {
    document.getElementById('exit-ramp-modal').classList.add('hidden');
    const standbyModal = document.getElementById('standby-modal');
    if (standbyModal) standbyModal.classList.remove('hidden');
    saveToStorage('real_world_enter');
  }

  function returnFromRealWorld() {
    document.getElementById('standby-modal').classList.add('hidden');
    const familyModal = document.getElementById('family-modal');
    if (familyModal) familyModal.classList.remove('hidden');
  }

  function parentConfirmed() {
    document.getElementById('family-modal').classList.add('hidden');
    openReflectionModal();
  }

  function openReflectionModal() {
    const ref = document.getElementById('reflection-modal');
    if (ref) ref.classList.remove('hidden');
  }

  function submitReflection() {
    const refInput = document.getElementById('reflection-input');
    if (refInput && refInput.value) {
      state.reflectionText = refInput.value;
    }
    document.getElementById('reflection-modal').classList.add('hidden');

    // IDEMPOTENCY GUARD: Prevent duplicate reward grants!
    if (!state.rewardClaimed) {
      state.rewardClaimed = true;
      // Grant Canonical Quest #001 Rewards:
      // +5 LP (120 -> 125 LP), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP
      state.lp += 5;
      state.charXp = (state.charXp || 0) + 5;
      state.skills.stewardship = (state.skills.stewardship || 0) + 15;
      state.skills.responsibility = (state.skills.responsibility || 0) + 5;
    }

    state.gardenState = 'lush';
    state.gateOpen = true;
    state.fogCenterUnlocked = true;
    if (!state.unlockedPlaces.includes('fog_center')) {
      state.unlockedPlaces.push('fog_center');
    }
    if (PLACES.fog_center) {
      PLACES.fog_center.unlocked = true;
    }
    state.questStatus = 'completed';
    state.currentObjective = 'Walk through the South Gate to visit FOG Community Center';

    initCollisionGrid(); // Rebuild grid with gate open
    updateLpDisplay();
    updateSkillDisplays();
    updateObjectiveDisplay();
    updatePlaceUiDisplays();
    saveToStorage('reward_grant');

    // Show Reward Celebration Screen
    const rewardModal = document.getElementById('reward-modal');
    if (rewardModal) rewardModal.classList.remove('hidden');
    playBellSound();
  }

  function closeRewardScreen() {
    document.getElementById('reward-modal').classList.add('hidden');
    showToast('✨ Garden bloomed! Gate unlocked!');
  }

  // ============================================================
  // 14. UI SYNC & HUD QUEST TRACKER
  // ============================================================
  function updateLpDisplay() {
    const el = document.getElementById('header-lp-amount');
    if (el) el.textContent = state.lp;
    const portraitLp = document.getElementById('portrait-stat-lp');
    if (portraitLp) portraitLp.textContent = state.lp;
    const compLp = document.getElementById('companion-lp');
    if (compLp) compLp.textContent = `${state.lp} LP`;
  }

  function updateSkillDisplays() {
    const stew = document.getElementById('dt-stewardship-xp');
    const resp = document.getElementById('dt-responsibility-xp');
    if (stew) stew.textContent = `${state.skills.stewardship} XP`;
    if (resp) resp.textContent = `${state.skills.responsibility} XP`;

    // Sidebar XP progress
    const xpText = document.getElementById('sidebar-xp-text');
    const xpFill = document.getElementById('sidebar-xp-fill');
    if (xpText) xpText.textContent = `${state.charXp} / ${state.charXpMax} XP`;
    if (xpFill) {
      const pct = Math.min(100, (state.charXp / state.charXpMax) * 100);
      xpFill.style.width = `${pct}%`;
    }
  }

  function updateObjectiveDisplay() {
    const chipTag = document.getElementById('chip-quest-tag');
    const chipTitle = document.getElementById('chip-quest-title');
    const chipIcon = document.getElementById('chip-quest-icon');

    if (state.questStatus === 'ready') {
      if (chipTag) chipTag.textContent = 'ACTIVE OBJECTIVE';
      if (chipTitle) chipTitle.textContent = state.currentObjective || 'Talk to Uncle Barnaby';
      if (chipIcon) chipIcon.textContent = '🌱';
    } else if (state.questStatus === 'in_progress') {
      if (chipTag) chipTag.textContent = 'REAL-WORLD TASK';
      if (chipTitle) chipTitle.textContent = 'Water home plants or pet water';
      if (chipIcon) chipIcon.textContent = '⏳';
    } else if (state.questStatus === 'completed' && !state.visitedFogCenter) {
      if (chipTag) chipTag.textContent = 'NEXT OBJECTIVE';
      if (chipTitle) chipTitle.textContent = 'Visit FOG Community Center';
      if (chipIcon) chipIcon.textContent = '⛪';
    } else {
      if (chipTag) chipTag.textContent = 'COMMUNITY MISSION';
      if (chipTitle) chipTitle.textContent = state.currentObjective || 'Explore FOG Community Center';
      if (chipIcon) chipIcon.textContent = '✨';
    }
  }

  function updatePlaceUiDisplays() {
    const place = PLACES[state.activePlaceId] || { name: 'My Home', icon: '🏡', tagline: 'Domestic Stewardship' };

    const canvasBadgeLabel = document.getElementById('canvas-place-label');
    const canvasBadgeIcon = document.getElementById('canvas-place-icon');
    const portraitTitle = document.getElementById('portrait-place-title');
    const portraitEmblem = document.getElementById('portrait-place-emblem');
    const portraitZone = document.getElementById('portrait-place-zone');

    if (canvasBadgeLabel) canvasBadgeLabel.textContent = place.name;
    if (canvasBadgeIcon) canvasBadgeIcon.textContent = place.icon || '📍';
    if (portraitTitle) portraitTitle.textContent = place.name;
    if (portraitEmblem) portraitEmblem.textContent = place.icon || '🏡';
    if (portraitZone) portraitZone.textContent = place.tagline || place.category || 'Places of Fellowship';

    // Step 13: Immediate Home Play Card quest synchronization
    const homeQuestBoxTag = document.querySelector('.play-card-quest-tag');
    const homeQuestTitle = document.getElementById('portrait-quest-title');
    const homeQuestDesc = document.getElementById('portrait-quest-desc');
    const homeStatVirtue = document.getElementById('portrait-stat-virtue');

    if (state.questStatus === 'completed') {
      if (homeQuestBoxTag) homeQuestBoxTag.textContent = 'CALLING COMPLETED';
      if (homeQuestTitle) homeQuestTitle.textContent = '🌱 Quest #001 Completed!';
      if (homeQuestDesc) homeQuestDesc.textContent = 'You tended living creation at home. Your garden is lush and the perimeter gate is open to FOG Center!';
      if (homeStatVirtue) homeStatVirtue.textContent = 'Stewardship';
    } else if (state.questStatus === 'in_progress') {
      if (homeQuestBoxTag) homeQuestBoxTag.textContent = 'IN PROGRESS (REAL WORLD)';
      if (homeQuestTitle) homeQuestTitle.textContent = '🌱 Steward of the Garden';
      if (homeQuestDesc) homeQuestDesc.textContent = 'Mission in the real world: Water your home plants or pet water, then return.';
      if (homeStatVirtue) homeStatVirtue.textContent = 'Caring';
    } else {
      if (homeQuestBoxTag) homeQuestBoxTag.textContent = 'ACTIVE REAL-WORLD CALLING';
      if (homeQuestTitle) homeQuestTitle.textContent = '🌱 Steward of the Garden';
      if (homeQuestDesc) homeQuestDesc.textContent = 'Water the potted plants at home to care for living creation right outside your window.';
      if (homeStatVirtue) homeStatVirtue.textContent = 'Garden';
    }

    updateObjectiveDisplay();
  }

  function showToast(msg) {
    if (typeof root !== 'undefined' && typeof root.showToast === 'function') {
      root.showToast(msg);
    }
    if (typeof document === 'undefined') return;
    const toast = document.createElement('div');
    toast.className = 'proximity-prompt';
    toast.style.top = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // ============================================================
  // 15. LOCAL SAVE & RESTORE ENGINE (koinonia.phase131.save)
  // ============================================================
  function isLocalStorageAvailable() {
    try {
      if (typeof localStorage === 'undefined') return false;
      const testK = '__koinonia_test__';
      localStorage.setItem(testK, '1');
      localStorage.removeItem(testK);
      return true;
    } catch (e) {
      return false;
    }
  }

  let saveDebounceTimer = null;
  function queuePositionSave() {
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => saveToStorage('position_update'), 600);
  }

  function saveToStorage(reason = 'manual') {
    const isAvail = isLocalStorageAvailable();
    state.storageMeta.available = isAvail;
    state.storageMeta.origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
    if (!isAvail) return;

    try {
      const saveData = {
        version: SAVE_VERSION,
        communityId: 'fog',
        timestamp: new Date().toISOString(),
        saveReason: reason,
        activePlaceId: state.activePlaceId,
        spawnId: state.spawnId,
        isPlayingGame: state.isPlayingGame,
        avatar: {
          x: Number(state.avatar.x.toFixed(2)),
          y: Number(state.avatar.y.toFixed(2)),
          dir: state.avatar.dir
        },
        lp: state.lp,
        charLevel: state.charLevel,
        charXp: state.charXp,
        skills: {
          stewardship: state.skills.stewardship || 0,
          responsibility: state.skills.responsibility || 0,
          discipline: state.skills.discipline || 0,
          teamwork: state.skills.teamwork || 0,
          service: state.skills.service || 0,
          compassion: state.skills.compassion || 0
        },
        gardenState: state.gardenState,
        gateOpen: state.gateOpen,
        fogCenterUnlocked: state.fogCenterUnlocked,
        visitedFogCenter: state.visitedFogCenter,
        unlockedPlaces: Array.from(new Set(state.unlockedPlaces)),
        questStatus: state.questStatus,
        rewardClaimed: state.rewardClaimed,
        currentObjective: state.currentObjective,
        reflectionText: state.reflectionText,
        audioMuted: state.audioMuted
      };

      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(saveData));
      state.lastSaveTime = saveData.timestamp;

      // Update storage metadata diagnostics
      state.storageMeta.saveExists = true;
      state.storageMeta.lastSaveTime = saveData.timestamp;
      state.storageMeta.lastSaveReason = reason;
      state.storageMeta.storedLP = saveData.lp;
      state.storageMeta.storedQuest = saveData.questStatus;
      state.storageMeta.storedGate = saveData.gateOpen;
      state.storageMeta.storedFogUnlock = saveData.fogCenterUnlocked;
      state.storageMeta.runtimeLP = state.lp;
      state.storageMeta.runtimeQuest = state.questStatus;
      state.storageMeta.runtimeGate = state.gateOpen;
      state.storageMeta.runtimeFogUnlock = state.fogCenterUnlocked;
    } catch (e) {
      console.warn('Failed to save state to localStorage:', e);
      state.storageMeta.lastSaveReason = `error: ${e.message}`;
    }
  }

  function loadFromStorage() {
    const isAvail = isLocalStorageAvailable();
    state.storageMeta.available = isAvail;
    state.storageMeta.origin = (typeof window !== 'undefined' && window.location) ? window.location.origin : '';
    if (!isAvail) {
      state.storageMeta.loadResult = 'storage_unavailable';
      return false;
    }

    try {
      // Step 9: One-Shot Reset Parameter Handling
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('reset') === '1') {
          try {
            localStorage.removeItem(SAVE_STORAGE_KEY);
          } catch (e) {}

          state.storageMeta.saveExists = false;
          state.storageMeta.loadResult = 'reset_cleared';
          state.storageMeta.lastLoadTime = new Date().toISOString();

          // Strip reset=1 immediately via replaceState, preserving other params (?debug=1, ?v=0.13.1)
          try {
            if (window.history && typeof window.history.replaceState === 'function') {
              const cleanUrl = new URL(window.location.href);
              cleanUrl.searchParams.delete('reset');
              const searchStr = cleanUrl.searchParams.toString();
              const newUrl = cleanUrl.pathname + (searchStr ? '?' + searchStr : '') + cleanUrl.hash;
              window.history.replaceState(null, '', newUrl);
            }
          } catch (urlErr) {
            console.warn('Could not rewrite URL after reset:', urlErr);
          }
          return false;
        }
      }

      const raw = localStorage.getItem(SAVE_STORAGE_KEY);
      if (!raw) {
        state.storageMeta.saveExists = false;
        state.storageMeta.loadResult = 'no_save';
        return false;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== SAVE_VERSION) {
        state.storageMeta.saveExists = true;
        state.storageMeta.loadResult = 'version_mismatch';
        return false;
      }

      state.storageMeta.saveExists = true;
      state.storageMeta.storedLP = parsed.lp;
      state.storageMeta.storedQuest = parsed.questStatus;
      state.storageMeta.storedGate = parsed.gateOpen;
      state.storageMeta.storedFogUnlock = parsed.fogCenterUnlocked;

      // Step 6 & 12: Defensive Nested State Hydration & Place Validation
      if (parsed.activePlaceId && PLACES[parsed.activePlaceId]) {
        state.activePlaceId = parsed.activePlaceId;
      } else {
        state.activePlaceId = 'home';
      }

      if (parsed.spawnId) state.spawnId = parsed.spawnId;

      // Validate avatar coordinates
      if (parsed.avatar) {
        const placeSpawns = SPAWN_POINTS[state.activePlaceId] || {};
        const defaultSpawn = placeSpawns[state.spawnId] || placeSpawns.default || { x: 4.5, y: 14.5, dir: 'down' };

        let x = (typeof parsed.avatar.x === 'number' && Number.isFinite(parsed.avatar.x)) ? parsed.avatar.x : defaultSpawn.x;
        let y = (typeof parsed.avatar.y === 'number' && Number.isFinite(parsed.avatar.y)) ? parsed.avatar.y : defaultSpawn.y;

        if (x < 1 || x > WORLD_COLS - 2) x = defaultSpawn.x;
        if (y < 1 || y > WORLD_ROWS - 2) y = defaultSpawn.y;

        state.avatar.x = x;
        state.avatar.y = y;
        state.avatar.dir = ['up', 'down', 'left', 'right'].includes(parsed.avatar.dir) ? parsed.avatar.dir : defaultSpawn.dir;
      }

      // Restore progression values
      if (typeof parsed.lp === 'number' && Number.isFinite(parsed.lp)) state.lp = parsed.lp;
      if (typeof parsed.charLevel === 'number') state.charLevel = parsed.charLevel;
      if (typeof parsed.charXp === 'number') state.charXp = parsed.charXp;

      if (parsed.skills && typeof parsed.skills === 'object') {
        state.skills.stewardship = typeof parsed.skills.stewardship === 'number' ? parsed.skills.stewardship : state.skills.stewardship;
        state.skills.responsibility = typeof parsed.skills.responsibility === 'number' ? parsed.skills.responsibility : state.skills.responsibility;
        state.skills.discipline = typeof parsed.skills.discipline === 'number' ? parsed.skills.discipline : state.skills.discipline;
        state.skills.teamwork = typeof parsed.skills.teamwork === 'number' ? parsed.skills.teamwork : state.skills.teamwork;
        state.skills.service = typeof parsed.skills.service === 'number' ? parsed.skills.service : state.skills.service;
        state.skills.compassion = typeof parsed.skills.compassion === 'number' ? parsed.skills.compassion : state.skills.compassion;
      }

      if (typeof parsed.gardenState === 'string') state.gardenState = parsed.gardenState;
      if (typeof parsed.gateOpen === 'boolean') state.gateOpen = parsed.gateOpen;
      if (typeof parsed.fogCenterUnlocked === 'boolean') state.fogCenterUnlocked = parsed.fogCenterUnlocked;
      if (typeof parsed.visitedFogCenter === 'boolean') state.visitedFogCenter = parsed.visitedFogCenter;
      if (Array.isArray(parsed.unlockedPlaces)) {
        state.unlockedPlaces = Array.from(new Set(['home', ...parsed.unlockedPlaces]));
      }
      if (typeof parsed.questStatus === 'string') state.questStatus = parsed.questStatus;
      if (typeof parsed.rewardClaimed === 'boolean') state.rewardClaimed = parsed.rewardClaimed;
      if (typeof parsed.currentObjective === 'string') state.currentObjective = parsed.currentObjective;
      if (typeof parsed.reflectionText === 'string') state.reflectionText = parsed.reflectionText;
      if (typeof parsed.audioMuted === 'boolean') state.audioMuted = parsed.audioMuted;
      if (typeof parsed.isPlayingGame === 'boolean') state.isPlayingGame = parsed.isPlayingGame;
      if (parsed.timestamp) state.lastSaveTime = parsed.timestamp;

      // Sync places registry
      if (state.fogCenterUnlocked && PLACES.fog_center) {
        PLACES.fog_center.unlocked = true;
      }

      // Sync QUESTS array if present
      if (QUESTS && QUESTS.length > 0) {
        QUESTS[0].status = state.questStatus;
      }

      state.storageMeta.loadResult = 'success';
      state.storageMeta.lastLoadTime = new Date().toISOString();
      state.storageMeta.runtimeLP = state.lp;
      state.storageMeta.runtimeQuest = state.questStatus;
      state.storageMeta.runtimeGate = state.gateOpen;
      state.storageMeta.runtimeFogUnlock = state.fogCenterUnlocked;

      return true;
    } catch (e) {
      console.warn('Failed to load state from localStorage:', e);
      state.storageMeta.loadResult = `error: ${e.message}`;
      return false;
    }
  }

  // ============================================================
  // 16. NAVIGATION TAB VIEW SWITCHING & WORLD MAP SELECTION
  // ============================================================
  function switchNavTab(tabName) {
    state.activeNavTab = tabName;

    const tabs = ['home', 'world', 'quests', 'journey', 'me'];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav-tab-${t}`);
      if (btn) {
        if (t === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    document.getElementById('world-map-modal').classList.add('hidden');
    document.getElementById('quests-tab-modal').classList.add('hidden');
    document.getElementById('journey-modal').classList.add('hidden');
    document.getElementById('me-modal').classList.add('hidden');

    if (tabName === 'home') {
      exitWorldToHomeCard();
    } else if (tabName === 'world') {
      openWorldPlacesModal();
    } else if (tabName === 'quests') {
      openQuestsTabModal();
    } else if (tabName === 'journey') {
      openJourneyModal();
    } else if (tabName === 'me') {
      openMeModal();
    }
  }

  function openWorldPlacesModal() {
    const list = document.getElementById('world-places-list');
    if (list) {
      list.innerHTML = Object.values(PLACES).map(p => {
        const isCurrent = state.activePlaceId === p.id;
        const isUnlocked = p.id === 'home' || (p.id === 'fog_center' && state.fogCenterUnlocked);
        let statusBadge = isCurrent ? 'Current' : (isUnlocked ? 'Unlocked' : 'Locked');
        let statusColor = isCurrent ? 'var(--brand-fire-orange)' : (isUnlocked ? 'var(--accent-success)' : 'var(--brand-charcoal)');
        let opacity = isUnlocked ? '1' : '0.6';

        return `
          <div class="team-chip" style="cursor: pointer; padding: 12px; opacity: ${opacity};" onclick="window.KOINONIA_GAME.handlePlaceSelect('${p.id}')">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.6rem;">${p.icon || '📍'}</span>
              <div>
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--brand-burgundy);">${p.name}</div>
                <div style="font-size: 0.7rem; color: var(--brand-fire-orange); font-weight: 700;">${p.category || p.tagline}</div>
              </div>
            </div>
            <span style="font-size: 0.75rem; font-weight: 800; color: ${statusColor};">${statusBadge}</span>
          </div>
        `;
      }).join('');
    }
    document.getElementById('world-map-modal').classList.remove('hidden');
  }

  function handlePlaceSelect(placeId) {
    if (placeId === state.activePlaceId) {
      document.getElementById('world-map-modal').classList.add('hidden');
      return;
    }
    if (placeId === 'home') {
      document.getElementById('world-map-modal').classList.add('hidden');
      transitionToPlace('home', 'default');
    } else if (placeId === 'fog_center') {
      if (!state.fogCenterUnlocked) {
        showToast('🔒 FOG Community Center is locked! Complete Quest #001 to unlock.');
      } else {
        document.getElementById('world-map-modal').classList.add('hidden');
        transitionToPlace('fog_center', 'default');
      }
    } else {
      const pName = PLACES[placeId] ? PLACES[placeId].name : 'This place';
      showToast(`🔒 ${pName} is locked (Coming soon in future phase)`);
    }
  }

  function openQuestsTabModal() {
    const list = document.getElementById('quests-tab-list');
    if (list) {
      list.innerHTML = QUESTS.map(q => `
        <div class="team-chip" style="padding: 12px;">
          <div>
            <div style="font-weight: 800; font-size: 0.9rem; color: var(--brand-burgundy);">${q.title}</div>
            <div style="font-size: 0.72rem; color: var(--brand-charcoal); opacity: 0.85; margin: 3px 0;">${q.realWorldAction}</div>
            <div style="font-size: 0.65rem; font-weight: 700; color: var(--brand-fire-orange);">${q.rewards ? q.rewards.lp + ' LP • ' + (q.rewards.charXp || 5) + ' XP' : ''}</div>
          </div>
          <span class="lifecycle-chip">${q.lifecycle || 'Open'}</span>
        </div>
      `).join('');
    }
    document.getElementById('quests-tab-modal').classList.remove('hidden');
  }

  function openJourneyModal() {
    const list = document.getElementById('journey-timeline-list');
    if (list) {
      list.innerHTML = (MY_JOURNEY.milestones || []).map(m => `
        <div class="team-chip" style="padding: 12px; gap: 10px;">
          <span style="font-size: 1.5rem;">${m.icon || '🏅'}</span>
          <div style="flex: 1;">
            <div style="font-weight: 800; font-size: 0.88rem; color: var(--brand-burgundy);">${m.title}</div>
            <div style="font-size: 0.72rem; color: var(--brand-charcoal); opacity: 0.85;">${m.date} • ${m.verse || ''}</div>
          </div>
        </div>
      `).join('');
    }
    document.getElementById('journey-modal').classList.remove('hidden');
  }

  function openMeModal() {
    document.getElementById('me-modal').classList.remove('hidden');
  }

  // ============================================================
  // 17. AUDIO ENGINE (MUTED BY DEFAULT, CLEAN PENTATONIC CHIMES)
  // ============================================================
  function toggleAudio() {
    state.audioMuted = !state.audioMuted;
    const btn = document.getElementById('audio-toggle-btn');
    const icon = document.getElementById('audio-icon');
    const label = document.getElementById('audio-label');

    if (state.audioMuted) {
      if (btn) btn.classList.add('muted');
      if (icon) icon.textContent = '🔈';
      if (label) label.textContent = 'Muted';
      showToast('🔇 Audio Muted');
    } else {
      if (btn) btn.classList.remove('muted');
      if (icon) icon.textContent = '🔊';
      if (label) label.textContent = 'Sound On';
      initAudio();
      playBellSound();
      showToast('🔊 Audio Enabled');
    }
    saveToStorage('audio_toggle');
  }

  function initAudio() {
    if (!state.audioContext && typeof AudioContext !== 'undefined') {
      state.audioContext = new AudioContext();
    }
  }

  function playBellSound() {
    if (state.audioMuted) return;
    try {
      initAudio();
      if (!state.audioContext) return;
      const ctx = state.audioContext;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.15); // G5

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {}
  }

  // ============================================================
  // 18. PROTOTYPE STATE RESET (DEVELOPER RESET)
  // ============================================================
  function resetPrototypeState() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    }
    state.activePlaceId = 'home';
    state.spawnId = 'default';
    state.lp = 120;
    state.charLevel = 1;
    state.charXp = 0;
    state.skills = { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 };
    state.gardenState = 'dry';
    state.gateOpen = false;
    state.fogCenterUnlocked = false;
    state.visitedFogCenter = false;
    state.unlockedPlaces = ['home'];
    state.questStatus = 'ready';
    state.rewardClaimed = false;
    state.currentObjective = 'Talk to Uncle Barnaby at the veranda';
    state.isPlayingGame = false;
    state.isPaused = false;
    state.isTransitioning = false;
    state.avatar.x = 4.5;
    state.avatar.y = 14.5;
    state.avatar.dir = 'down';
    state.reflectionText = '';
    state.lastSaveTime = null;

    if (PLACES.fog_center) PLACES.fog_center.unlocked = false;

    // Reset storage metadata diagnostics
    state.storageMeta.saveExists = false;
    state.storageMeta.lastSaveReason = 'reset_prototype';
    state.storageMeta.storedLP = null;
    state.storageMeta.storedQuest = null;
    state.storageMeta.storedGate = null;
    state.storageMeta.storedFogUnlock = null;
    state.storageMeta.runtimeLP = 120;
    state.storageMeta.runtimeQuest = 'ready';
    state.storageMeta.runtimeGate = false;
    state.storageMeta.runtimeFogUnlock = false;

    initCollisionGrid();
    updateLpDisplay();
    updateSkillDisplays();
    updatePlaceUiDisplays();
    exitWorldToHomeCard(true);

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    }

    // Close open modals
    const openModals = document.querySelectorAll('.modal-backdrop:not(#title-screen)');
    openModals.forEach(m => m.classList.add('hidden'));

    // Show title screen again
    const titleScreen = document.getElementById('title-screen');
    if (titleScreen) {
      titleScreen.classList.remove('hidden');
      titleScreen.classList.add('active');
    }

    showToast('🔄 Prototype State Reset');
  }

  // ============================================================
  // 19. KOINONIA STUDIO ADMIN 7-STEP WIZARD
  // ============================================================
  function openAdminStudio() {
    state.wizardStep = 1;
    updateWizardUI();
    document.getElementById('admin-studio-modal').classList.remove('hidden');
  }

  function updateWizardUI() {
    const num = document.getElementById('wizard-step-num');
    if (num) num.textContent = state.wizardStep;

    for (let i = 1; i <= 7; i++) {
      const stepEl = document.getElementById(`step-${i}-content`);
      if (stepEl) {
        stepEl.style.display = (i === state.wizardStep) ? 'block' : 'none';
      }
    }
  }

  function advanceWizard() {
    if (state.wizardStep < 7) {
      state.wizardStep++;
      updateWizardUI();
    }
  }

  function rewindWizard() {
    if (state.wizardStep > 1) {
      state.wizardStep--;
      updateWizardUI();
    }
  }

  function closeAdminStudio() {
    document.getElementById('admin-studio-modal').classList.add('hidden');
  }

  function saveCustomPlaceFromStudio() {
    const nameInput = document.getElementById('wizard-place-name');
    const placeName = nameInput ? nameInput.value.trim() : '';
    if (!placeName) {
      showToast('⚠️ Please enter a place name');
      return;
    }

    const placeId = 'custom_' + Date.now();
    const newPlace = {
      id: placeId,
      name: placeName,
      category: 'Community Fellowship',
      icon: '🏛️',
      tagline: 'Custom Community Space',
      unlocked: true,
      spawn: { x: 12, y: 14, dir: 'up' },
      interactables: []
    };

    PLACES[placeId] = newPlace;
    state.unlockedPlaces.push(placeId);
    saveToStorage('custom_place_created');
    closeAdminStudio();
    showToast(`🏛️ Created "${placeName}"!`);
  }

  // ============================================================
  // 20. EVENT LISTENERS SETUP
  // ============================================================
  function setupEventListeners() {
    appContainer = document.getElementById('app-container');
    canvas = document.getElementById('gameCanvas');
    if (canvas && typeof canvas.getContext === 'function') ctx = canvas.getContext('2d');
    gameStage = document.getElementById('game-stage');

    // Title Screen button
    const btnBegin = document.getElementById('btn-begin-adventure');
    if (btnBegin) {
      btnBegin.addEventListener('click', () => {
        document.getElementById('title-screen').classList.remove('active');
        document.getElementById('title-screen').classList.add('hidden');
      });
    }

    // Enter World button on Portrait Home Card
    const btnEnterWorldPortrait = document.getElementById('btn-enter-world-portrait');
    if (btnEnterWorldPortrait) {
      btnEnterWorldPortrait.addEventListener('click', enterWorldFromHomeCard);
    }

    // Quick Action shortcuts on Home Card
    const btnQuickWorld = document.getElementById('btn-quick-world-portrait');
    if (btnQuickWorld) btnQuickWorld.addEventListener('click', openWorldPlacesModal);

    const btnQuickQuests = document.getElementById('btn-quick-quests-portrait');
    if (btnQuickQuests) btnQuickQuests.addEventListener('click', openQuestsTabModal);

    // Floating Quest Chip on canvas
    const compactQuestChip = document.getElementById('compact-quest-chip');
    if (compactQuestChip) {
      compactQuestChip.addEventListener('click', () => {
        if (state.questStatus !== 'completed') {
          openQuestDetailModal('Q-001');
        } else if (!state.visitedFogCenter) {
          showToast('🧭 Walk south through the gate to visit FOG Community Center!');
        } else {
          openQuestsTabModal();
        }
      });
    }

    // Exit World button in Header
    const btnExitWorld = document.getElementById('btn-exit-world');
    if (btnExitWorld) {
      btnExitWorld.addEventListener('click', () => exitWorldToHomeCard(false));
    }

    // Audio toggle button
    const btnAudio = document.getElementById('audio-toggle-btn');
    if (btnAudio) {
      btnAudio.addEventListener('click', toggleAudio);
    }

    // Reset Prototype button (both dev-reset-btn and btn-reset-prototype)
    const resetBtn = document.getElementById('dev-reset-btn') || document.getElementById('btn-reset-prototype');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetPrototypeState);
    }

    // Admin Studio buttons
    const adminBtn = document.getElementById('btn-open-admin');
    if (adminBtn) adminBtn.addEventListener('click', openAdminStudio);

    const btnAdminFromMe = document.getElementById('btn-open-admin-from-me');
    if (btnAdminFromMe) {
      btnAdminFromMe.addEventListener('click', () => {
        document.getElementById('me-modal').classList.add('hidden');
        openAdminStudio();
      });
    }

    // Quest dialog buttons
    const btnAcceptQuest = document.getElementById('btn-accept-quest');
    if (btnAcceptQuest) btnAcceptQuest.addEventListener('click', acceptQuest);

    const btnExitToRealWorld = document.getElementById('btn-exit-to-real-world');
    if (btnExitToRealWorld) btnExitToRealWorld.addEventListener('click', exitToRealWorld);

    const btnReturnFromRealWorld = document.getElementById('btn-return-completed') || document.getElementById('btn-return-from-real-world');
    if (btnReturnFromRealWorld) btnReturnFromRealWorld.addEventListener('click', returnFromRealWorld);

    const btnParentConfirm = document.getElementById('btn-family-confirm') || document.getElementById('btn-parent-confirm');
    if (btnParentConfirm) btnParentConfirm.addEventListener('click', parentConfirmed);

    const btnSubmitReflection = document.getElementById('btn-submit-reflection');
    if (btnSubmitReflection) btnSubmitReflection.addEventListener('click', submitReflection);

    const btnCloseReward = document.getElementById('btn-close-reward');
    if (btnCloseReward) btnCloseReward.addEventListener('click', closeRewardScreen);

    // Modal Close Buttons
    const btnCloseNpcDialogue = document.getElementById('btn-dialogue-close') || document.getElementById('btn-close-npc-dialogue');
    if (btnCloseNpcDialogue) btnCloseNpcDialogue.addEventListener('click', closeDialogueModal);

    const btnCloseQuestDetail = document.getElementById('btn-close-quest-detail');
    if (btnCloseQuestDetail) btnCloseQuestDetail.addEventListener('click', () => {
      document.getElementById('quest-detail-modal').classList.add('hidden');
    });

    const btnCloseWorldMap = document.getElementById('btn-close-world-map');
    if (btnCloseWorldMap) btnCloseWorldMap.addEventListener('click', () => {
      document.getElementById('world-map-modal').classList.add('hidden');
    });

    const btnCloseQuestsTab = document.getElementById('btn-close-quests-tab');
    if (btnCloseQuestsTab) btnCloseQuestsTab.addEventListener('click', () => {
      document.getElementById('quests-tab-modal').classList.add('hidden');
    });

    const btnCloseJourney = document.getElementById('btn-close-journey');
    if (btnCloseJourney) btnCloseJourney.addEventListener('click', () => {
      document.getElementById('journey-modal').classList.add('hidden');
    });

    const btnCloseMe = document.getElementById('btn-close-me');
    if (btnCloseMe) btnCloseMe.addEventListener('click', () => {
      document.getElementById('me-modal').classList.add('hidden');
    });

    const btnCloseAdmin = document.getElementById('btn-close-admin-studio');
    if (btnCloseAdmin) btnCloseAdmin.addEventListener('click', closeAdminStudio);

    const btnSaveCustomPlace = document.getElementById('btn-save-custom-place');
    if (btnSaveCustomPlace) btnSaveCustomPlace.addEventListener('click', saveCustomPlaceFromStudio);

    const btnWizNext = document.getElementById('btn-wizard-next');
    if (btnWizNext) btnWizNext.addEventListener('click', advanceWizard);

    const btnWizPrev = document.getElementById('btn-wizard-prev');
    if (btnWizPrev) btnWizPrev.addEventListener('click', rewindWizard);

    // Bottom Navigation tabs
    const navTabs = ['home', 'world', 'quests', 'journey', 'me'];
    navTabs.forEach(tab => {
      const tabEl = document.getElementById(`nav-tab-${tab}`);
      if (tabEl) {
        tabEl.addEventListener('click', () => switchNavTab(tab));
      }
    });

    // Virtual Analog Joystick Controls Setup
    setupJoystick();

    // On-screen Action & Emote buttons
    const actionBtn = document.getElementById('mobile-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        handleActionInteract();
      });
    }

    const emoteBtn = document.getElementById('mobile-emote-btn');
    if (emoteBtn) {
      emoteBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        triggerEmote('🙏');
      });
    }

    // Interruption Safety Listeners
    window.addEventListener('blur', () => {
      resetJoystick();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        resetJoystick();
        saveToStorage('visibility_hidden');
      }
    });

    window.addEventListener('pagehide', () => {
      resetJoystick();
      saveToStorage('pagehide');
    });

    window.addEventListener('beforeunload', () => {
      saveToStorage('beforeunload');
    });

    // Central Responsive and Orientation Listeners
    window.addEventListener('resize', () => {
      updateResponsiveState();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        updateResponsiveState();
      }, 100);
    });

    // Safari Visual Viewport listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        updateResponsiveState();
      });
      window.visualViewport.addEventListener('scroll', () => {
        updateVisualViewportHeight();
      });
    }
  }

  // ============================================================
  // 21. INITIALIZATION
  // ============================================================
  function init() {
    const loaded = loadFromStorage();
    initCollisionGrid();
    setupEventListeners();
    updateResponsiveState();
    updateLpDisplay();
    updateSkillDisplays();
    updatePlaceUiDisplays();

    // Auto-dismiss title splash screen on reload if active progress was loaded
    if (loaded && (state.lp > 120 || state.questStatus !== 'ready' || state.visitedFogCenter || state.fogCenterUnlocked)) {
      const titleScreen = document.getElementById('title-screen');
      if (titleScreen) {
        titleScreen.classList.remove('active');
        titleScreen.classList.add('hidden');
      }
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(render);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // Export safe API for tests and inspection
  root.KOINONIA_GAME = {
    state,
    camera,
    joystick,
    SAVE_STORAGE_KEY,
    SAVE_VERSION,
    saveToStorage,
    loadFromStorage,
    resetPrototypeState,
    transitionToPlace,
    getInteractablesForPlace,
    getNearestInteractable,
    handleActionInteract,
    openDialogueModal,
    closeDialogueModal,
    acceptQuest,
    exitToRealWorld,
    returnFromRealWorld,
    submitReflection,
    enterWorldFromHomeCard,
    exitWorldToHomeCard,
    showToast,
    determineDeviceClass,
    getViewportDimensions,
    updateResponsiveState,
    calibrateGameViewport,
    resizeGameCanvas, // alias
    checkOrientation: updateResponsiveState, // alias
    updateCamera,
    updatePlayerMovement,
    updateJoystickPosition,
    resetJoystick,
    setupJoystick,
    handlePlaceSelect,
    selectPlace: handlePlaceSelect,
    updatePlaceUiDisplays,
    updateLpDisplay,
    updateSkillDisplays,
    init
  };

})();
