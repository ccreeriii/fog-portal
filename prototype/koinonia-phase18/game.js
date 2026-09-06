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
  const evaluatePlaceAvailability = data.evaluatePlaceAvailability || function (placeId, st) {
    const p = PLACES[placeId];
    if (!p) return { available: false, reason: 'Unknown place' };
    if (p.unlockedByDefault) return { available: true, reason: 'Unlocked by default' };
    return { available: true, reason: 'Available' };
  };

  // ============================================================
  // 2. LOGICAL WORLD CONSTANTS & RUNTIME STATE
  // ============================================================
  const TILE_SIZE = 32;
  const WORLD_COLS = 25; // 800px logical
  const WORLD_ROWS = 18; // 576px logical
  const LOGICAL_WIDTH = WORLD_COLS * TILE_SIZE;  // 800
  const LOGICAL_HEIGHT = WORLD_ROWS * TILE_SIZE; // 576

  // Prototype Local Save Storage Configuration
  const SAVE_STORAGE_KEY = 'koinonia.phase18.save';
  const SAVE_VERSION = 1;

  // Registered Spawn Points per Place
  const SPAWN_POINTS = {
    home: {
      default: { x: 4.5, y: 14.5, dir: 'down' },
      entrance: { x: 4.5, y: 14.5, dir: 'down' },
      veranda: { x: 10.0, y: 8.0, dir: 'down' },
      from_fog_center: { x: 12.0, y: 15.2, dir: 'up' },
      from_gate: { x: 12.0, y: 15.2, dir: 'up' }
    },
    fog_center: {
      default: { x: 12.0, y: 14.8, dir: 'up' },
      entrance: { x: 12.0, y: 14.8, dir: 'up' },
      from_home: { x: 12.0, y: 14.8, dir: 'up' },
      fellowship_hall: { x: 12.0, y: 8.0, dir: 'down' }
    },
    school: {
      default: { x: 12.0, y: 14.5, dir: 'up' },
      entrance: { x: 12.0, y: 14.5, dir: 'up' },
      classroom: { x: 12.0, y: 8.0, dir: 'up' },
      library: { x: 5.0, y: 6.0, dir: 'right' }
    },
    sports_hub: {
      default: { x: 12.0, y: 14.5, dir: 'up' },
      entrance: { x: 12.0, y: 14.5, dir: 'up' },
      court: { x: 12.0, y: 8.0, dir: 'down' },
      bleachers: { x: 20.0, y: 6.0, dir: 'left' }
    },
    outreach_site: {
      default: { x: 12.0, y: 14.5, dir: 'up' },
      entrance: { x: 12.0, y: 14.5, dir: 'up' },
      packing_tables: { x: 12.0, y: 7.0, dir: 'down' },
      donation_shelf: { x: 6.0, y: 5.0, dir: 'right' }
    }
  };
  SPAWN_POINTS.outreach = SPAWN_POINTS.outreach_site;

  // Runtime State (Single-community first: communityId = 'fog')
  const state = {
    saveVersion: SAVE_VERSION,
    lastSaveTime: null,
    activePlaceId: 'home',
    spawnId: 'default',
    lp: 120,
    charLevel: 1,
    charXp: 0,
    charXpMax: 10,
    highestLevelReached: 1,
    levelUpHistory: [],
    growthAreas: { stewardship: 0, responsibility: 0, service: 0, reflection: 0, discipline: 0, teamwork: 0 },
    skills: { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0, reflection: 0 },
    growthAreaRanks: {},
    milestones: {},
    unlockedMilestones: [],
    unlockedPerks: [],
    gardenState: 'dry', // 'dry' | 'lush'
    gateOpen: false,
    fogCenterUnlocked: false,
    visitedFogCenter: false,
    unlockedPlaces: ['home'],
    visitedPlaces: ['home'],
    firstVisitedAt: { home: new Date().toISOString() },
    visitCount: { home: 1 },
    spokenToNpc: {},
    questStatus: 'ready', // backwards compat: 'ready' | 'active' | 'in_progress' | 'completed'
    rewardClaimed: false,
    currentObjective: 'Talk to Uncle Barnaby at the veranda',
    reflectionText: '',
    audioMuted: true,
    audioContext: null,

    // Modular Quest Engine Phase 0.14
    trackedQuestId: 'Q-001',
    questProgress: {},

    // Campaigns & Events Engine Phase 0.17
    campaignProgress: {},
    activeCampaignIds: [],
    completedCampaignIds: [],
    eventParticipation: [],
    completedEventInstances: [],
    eventsAttendedCount: 0,
    eventQuestProgress: {},
    demoNow: null,

    // Phase 0.18: Sports & Fit Quest Engine
    fitQuestResults: {},
    fitQuestHistory: [],
    personalBests: {},
    fitQuestRewardClaims: {},
    sportsExplored: [],
    fitQuestMetrics: {
      completedCount: 0,
      personalBestsCount: 0,
      totalAttemptsCount: 0,
      sportsTriedCount: 0
    },
    selectedChallengeId: 'FQ-V001',
    activeFitQuestTab: 'play',

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
      runtimeFogUnlock: false,
      trackedQuestId: 'Q-001'
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

  // Phase 0.15 Pending Level-Up Queue
  let pendingLevelUpCelebration = null;

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

    const place = PLACES[state.activePlaceId];

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
    } else if (place && Array.isArray(place.worldObjects)) {
      // Data-driven collision grid built dynamically from place.worldObjects
      for (const obj of place.worldObjects) {
        if (obj.solid) {
          const startR = Math.max(1, Math.floor(obj.y));
          const endR = Math.min(WORLD_ROWS - 2, Math.floor(obj.y + (obj.h || 1) - 0.01));
          const startC = Math.max(1, Math.floor(obj.x));
          const endC = Math.min(WORLD_COLS - 2, Math.floor(obj.x + (obj.w || 1) - 0.01));
          for (let r = startR; r <= endR; r++) {
            for (let c = startC; c <= endC; c++) {
              collisionGrid[r][c] = 1;
            }
          }
        }
      }
      // Guarantee exit tiles are walkable
      if (Array.isArray(place.exits)) {
        for (const exit of place.exits) {
          const startR = Math.max(0, Math.floor(exit.y));
          const endR = Math.min(WORLD_ROWS - 1, Math.floor(exit.y + (exit.h || 1) - 0.01));
          const startC = Math.max(0, Math.floor(exit.x));
          const endC = Math.min(WORLD_COLS - 1, Math.floor(exit.x + (exit.w || 1) - 0.01));
          for (let r = startR; r <= endR; r++) {
            for (let c = startC; c <= endC; c++) {
              collisionGrid[r][c] = 0;
            }
          }
        }
      }
    }
  }

  function getSpawnPoint(placeId, spawnId = 'default') {
    const pId = (placeId === 'outreach') ? 'outreach_site' : placeId;
    const place = PLACES[pId] || PLACES[placeId];
    if (place && place.spawnPoints) {
      if (place.spawnPoints[spawnId]) return place.spawnPoints[spawnId];
      if (place.spawnPoints.default) return place.spawnPoints.default;
      if (place.spawnPoints.entrance) return place.spawnPoints.entrance;
    }
    const spawns = SPAWN_POINTS[pId] || SPAWN_POINTS[placeId] || {};
    if (spawns[spawnId]) return spawns[spawnId];
    if (spawns.default) return spawns.default;
    return { x: 12.0, y: 10.0, dir: 'down' };
  }

  function isPlaceVisited(placeId) {
    const pId = (placeId === 'outreach') ? 'outreach_site' : placeId;
    if (!state.visitedPlaces) return pId === 'home';
    if (Array.isArray(state.visitedPlaces)) {
      return state.visitedPlaces.includes(pId) || (pId === 'outreach_site' && state.visitedPlaces.includes('outreach'));
    }
    if (typeof state.visitedPlaces === 'object') {
      return Boolean(state.visitedPlaces[pId] || (pId === 'outreach_site' && state.visitedPlaces.outreach));
    }
    return false;
  }

  function markPlaceVisited(placeId) {
    const pId = (placeId === 'outreach') ? 'outreach_site' : placeId;
    if (!Array.isArray(state.visitedPlaces)) {
      if (state.visitedPlaces && typeof state.visitedPlaces === 'object') {
        state.visitedPlaces = Object.keys(state.visitedPlaces).filter(k => state.visitedPlaces[k]);
      } else {
        state.visitedPlaces = ['home'];
      }
    }
    if (!state.visitedPlaces.includes(pId)) {
      state.visitedPlaces.push(pId);
    }
    if (pId === 'fog_center') {
      state.visitedFogCenter = true;
    }
    if (!state.firstVisitedAt) state.firstVisitedAt = {};
    if (!state.firstVisitedAt[pId]) {
      state.firstVisitedAt[pId] = new Date().toISOString();
    }
    if (!state.visitCount) state.visitCount = {};
    state.visitCount[pId] = (state.visitCount[pId] || 0) + 1;
  }

  function syncUnlockedPlaces() {
    const unlocked = ['home'];
    const placeKeys = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'];
    for (const pId of placeKeys) {
      if (unlocked.includes(pId)) continue;
      const res = evaluatePlaceAvailability(pId, state);
      if (res && res.available) {
        unlocked.push(pId);
      }
    }
    state.unlockedPlaces = unlocked;
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

    // Phase 0.17: Event World Themes & Temporary Objects (When Live)
    const nowFog = getCurrentTime();
    const liveEventFog = (data.getLiveEventForPlace ? data.getLiveEventForPlace('fog_center', nowFog) : null);
    if (liveEventFog && liveEventFog.worldEffects) {
      const we = liveEventFog.worldEffects;
      if (we.banner) {
        ctx.fillStyle = we.accentColor || '#D97706';
        ctx.beginPath();
        ctx.roundRect(6 * 32, 68, 13 * 32, 20, 4);
        ctx.fill();
        ctx.strokeStyle = '#FDC63F';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFF9F3';
        ctx.font = 'bold 8px "Clear Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔴 LIVE GATHERING: ' + we.banner, 12.5 * 32, 82);
        ctx.textAlign = 'left';
      }

      if (Array.isArray(we.temporaryObjects)) {
        we.temporaryObjects.forEach(obj => {
          ctx.font = '18px sans-serif';
          ctx.fillText(obj.icon || '✨', obj.x, obj.y);
          ctx.fillStyle = we.accentColor || '#6A0E04';
          ctx.font = 'bold 7.5px "Clear Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(obj.name, obj.x + 10, obj.y + 14);
          ctx.textAlign = 'left';
        });
      }
    }

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
    const place = PLACES.school || {};
    // Base floor: Soft academic tile
    ctx.fillStyle = place.atmosphere?.floorColor || '#EBF2FA';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Subtle floor tile grid
    ctx.strokeStyle = 'rgba(200, 215, 235, 0.4)';
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

    // Classroom banner / Blackboard at north
    ctx.fillStyle = '#1E4620'; // Chalkboard green
    ctx.fillRect(8 * 32, 32, 9 * 32, 2 * 32);
    ctx.strokeStyle = '#8D5B4C';
    ctx.lineWidth = 3;
    ctx.strokeRect(8 * 32, 32, 9 * 32, 2 * 32);
    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 10px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CAMPUS CLASSROOM — DILIGENCE & HONOR', 12.5 * 32, 46);
    ctx.font = '8px "Clear Sans", sans-serif';
    ctx.fillText('"Whatever you do, work at it with all your heart" • Col 3:23', 12.5 * 32, 58);
    ctx.textAlign = 'left';

    // Teacher's Desk
    ctx.fillStyle = '#8D5B4C';
    ctx.fillRect(11 * 32, 4 * 32, 3 * 32, 24);
    ctx.fillStyle = '#C89B7B';
    ctx.fillRect(11 * 32 + 4, 4 * 32 + 3, 3 * 32 - 8, 18);
    ctx.font = '14px sans-serif';
    ctx.fillText('📚', 11 * 32 + 8, 4 * 32 + 18);
    ctx.fillText('🍎', 13 * 32, 4 * 32 + 18);

    // Student Desks (2 rows)
    const desks = [
      [5, 8], [11, 8], [17, 8],
      [8, 11], [14, 11]
    ];
    desks.forEach(([c, r]) => {
      ctx.fillStyle = '#8D5B4C';
      ctx.fillRect(c * 32, r * 32, 2.5 * 32, 20);
      ctx.fillStyle = '#D4A373';
      ctx.fillRect(c * 32 + 2, r * 32 + 2, 2.5 * 32 - 4, 16);
      ctx.fillStyle = '#4A3525';
      ctx.font = '9px sans-serif';
      ctx.fillText('📖', c * 32 + 6, r * 32 + 14);
    });

    // Campus Library Bookshelves (West)
    ctx.fillStyle = '#4A2810';
    ctx.fillRect(2 * 32, 3 * 32, 2 * 32, 5 * 32);
    ctx.fillStyle = '#795548';
    ctx.fillRect(2 * 32 + 4, 3 * 32 + 4, 2 * 32 - 8, 5 * 32 - 8);
    ctx.font = '20px sans-serif';
    ctx.fillText('📚', 2 * 32 + 8, 5 * 32);
    ctx.fillText('📖', 2 * 32 + 8, 7 * 32);
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillText('LIBRARY', 2 * 32, 8 * 32 + 16);

    // School Notice Board (East)
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(20 * 32, 4 * 32, 2 * 32, 3 * 32);
    ctx.fillStyle = '#FFE4C7';
    ctx.fillRect(20 * 32 + 4, 4 * 32 + 4, 2 * 32 - 8, 3 * 32 - 8);
    ctx.font = '16px sans-serif';
    ctx.fillText('📋', 20 * 32 + 10, 5 * 32 + 16);
    ctx.fillStyle = '#2563EB';
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillText('NOTICES', 20 * 32 + 2, 7 * 32 + 14);

    // South Exit Gateway
    const exitY = (WORLD_ROWS - 1) * 32;
    ctx.fillStyle = '#2563EB';
    ctx.fillRect(10 * 32, exitY - 8, 5 * 32, 14);
    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GATEWAY — WORLD MAP', 12.5 * 32, exitY + 2);
    ctx.textAlign = 'left';

    // Render Teacher Mia at (12, 4.5)
    renderNpc(ctx, 12, 4.5, '👩‍🏫', 'Teacher Mia', '#2563EB');
  }

  // Helper to draw prominent, readable world signs on canvas
  function drawWorldSign(ctx, x, y, title, subtitle, icon, accentColor) {
    ctx.save();
    ctx.font = 'bold 9px "Clear Sans", sans-serif';
    const titleW = ctx.measureText(title).width;
    ctx.font = '7.5px "Clear Sans", sans-serif';
    const subW = subtitle ? ctx.measureText(subtitle).width : 0;
    const boxW = Math.max(titleW, subW) + 28;
    const boxH = subtitle ? 25 : 18;
    const boxX = Math.round(x - boxW / 2);
    const boxY = Math.round(y - boxH / 2);

    // Shadow & Background pill
    ctx.fillStyle = 'rgba(30, 27, 24, 0.90)';
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
    } else {
      ctx.fillRect(boxX, boxY, boxW, boxH);
    }

    // Border
    ctx.strokeStyle = accentColor || '#D97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Icon
    ctx.font = '12px sans-serif';
    ctx.fillText(icon || '📌', boxX + 5, boxY + (subtitle ? 17 : 13));

    // Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, boxX + 22, boxY + 11);
    if (subtitle) {
      ctx.fillStyle = '#FDE68A';
      ctx.font = '7.5px "Clear Sans", sans-serif';
      ctx.fillText(subtitle, boxX + 22, boxY + 21);
    }
    ctx.restore();
  }

  function renderSportsHubWorld(ctx) {
    const place = PLACES.sports_hub || {};
    // Floor: Outdoor warm court tone
    ctx.fillStyle = place.atmosphere?.floorColor || '#F5E6CC';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // 1. RUNNING TRACK PERIMETER RING (Terracotta / Red brick)
    ctx.fillStyle = '#C05A3E';
    ctx.fillRect(32, 32, (WORLD_COLS - 2) * 32, (WORLD_ROWS - 2) * 32);
    ctx.fillStyle = '#F5E6CC';
    ctx.fillRect(2 * 32 + 16, 2 * 32 + 16, (WORLD_COLS - 5) * 32, (WORLD_ROWS - 5) * 32);

    // Track lane lines
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(32 + 8, 32 + 8, (WORLD_COLS - 2) * 32 - 16, (WORLD_ROWS - 2) * 32 - 16);

    // Running Track Start/Sprint Line at (7, 13)
    const trackStartX = 6 * 32;
    const trackStartY = 12.5 * 32;
    ctx.fillStyle = '#FFFFFF';
    for (let c = 0; c < 4; c++) {
      ctx.fillRect(trackStartX + c * 10, trackStartY, 6, 18);
    }
    drawWorldSign(ctx, 7 * 32 + 10, 13 * 32 + 18, 'RUNNING TRACK', 'Reaction Sprint', '🏃', '#F87171');

    // 2. BASKETBALL HALF-COURT (Center-North)
    const courtX = 5 * 32;
    const courtY = 3 * 32;
    const courtW = 10 * 32;
    const courtH = 8 * 32;
    ctx.fillStyle = '#E87A1E';
    ctx.fillRect(courtX, courtY, courtW, courtH);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(courtX, courtY, courtW, courtH);

    // Basketball Key / Paint & Free-throw circle
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(8.5 * 32, courtY, 3 * 32, 4 * 32);
    ctx.strokeStyle = '#FFFFFF';
    ctx.strokeRect(8.5 * 32, courtY, 3 * 32, 4 * 32);
    ctx.beginPath();
    ctx.arc(10 * 32, courtY + 4 * 32, 1.8 * 32, 0, Math.PI);
    ctx.stroke();

    // 3-Point Arc
    ctx.beginPath();
    ctx.arc(10 * 32, courtY + 16, 4.2 * 32, 0, Math.PI);
    ctx.stroke();

    // Hoop & Backboard at (12, 3) / rim at (10, 3)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(9 * 32, courtY + 4, 2 * 32, 6);
    ctx.fillStyle = '#E65100';
    ctx.beginPath();
    ctx.arc(10 * 32, courtY + 14, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = '16px sans-serif';
    ctx.fillText('🏀', 10 * 32 - 8, courtY + 18);
    drawWorldSign(ctx, 12 * 32, 2 * 32 + 4, 'BASKETBALL', 'Free Throw Focus', '🏀', '#FB923C');

    // 3. RACKET COURT (Badminton & Pickleball) on East side at (17, 7.5)
    const racketX = 15.5 * 32;
    const racketY = 4 * 32;
    const racketW = 4 * 32;
    const racketH = 6 * 32;
    ctx.fillStyle = '#065F46'; // Forest green athletic court
    ctx.fillRect(racketX, racketY, racketW, racketH);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(racketX, racketY, racketW, racketH);

    // Net across middle
    ctx.strokeStyle = '#FEF3C7';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(racketX, racketY + racketH / 2);
    ctx.lineTo(racketX + racketW, racketY + racketH / 2);
    ctx.stroke();
    ctx.font = '14px sans-serif';
    ctx.fillText('🏸', racketX + racketW / 2 - 7, racketY + racketH / 2 + 5);
    drawWorldSign(ctx, 17 * 32 + 8, 3.5 * 32, 'RACKET COURT', 'Rally Focus', '🏸', '#34D399');

    // 4. FITNESS & MOVEMENT ZONE (West/South) at (3, 11)
    const fitX = 2 * 32;
    const fitY = 9.5 * 32;
    const fitW = 2.5 * 32;
    const fitH = 3 * 32;
    ctx.fillStyle = '#D1FAE5'; // Soft green exercise mat
    ctx.fillRect(fitX, fitY, fitW, fitH);
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2;
    ctx.strokeRect(fitX, fitY, fitW, fitH);
    ctx.font = '16px sans-serif';
    ctx.fillText('🧘', fitX + fitW / 2 - 8, fitY + fitH / 2 + 5);
    drawWorldSign(ctx, 3 * 32 + 10, 13 * 32 + 4, 'FITNESS ZONE', 'Real-World Quests', '💪', '#10B981');

    // 5. FIT QUEST BOARD at (3, 5) & PB BOARD at (3, 8)
    // Board posts & signs
    ctx.fillStyle = '#78350F';
    ctx.fillRect(2 * 32, 4.5 * 32, 28, 36);
    ctx.fillStyle = '#FDE68A';
    ctx.fillRect(2 * 32 + 3, 4.5 * 32 + 3, 22, 30);
    ctx.font = '16px sans-serif';
    ctx.fillText('📋', 2 * 32 + 6, 4.5 * 32 + 22);
    drawWorldSign(ctx, 3 * 32 + 12, 4 * 32 + 6, 'FIT QUEST BOARD', 'All Challenges', '⚡', '#F59E0B');

    // PB Board at (3, 8)
    ctx.fillStyle = '#78350F';
    ctx.fillRect(2 * 32, 7.5 * 32, 28, 32);
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(2 * 32 + 3, 7.5 * 32 + 3, 22, 26);
    ctx.font = '16px sans-serif';
    ctx.fillText('🌟', 2 * 32 + 6, 7.5 * 32 + 20);
    drawWorldSign(ctx, 3 * 32 + 12, 7 * 32 + 8, 'PERSONAL BESTS', 'Local Records', '🌟', '#F59E0B');

    // Bleachers on East side (South-East)
    ctx.fillStyle = '#8D6E63';
    for (let r = 10; r <= 12; r += 2) {
      ctx.fillRect(20 * 32, r * 32, 2.5 * 32, 16);
      ctx.fillStyle = '#A1887F';
      ctx.fillRect(20 * 32 + 2, r * 32 + 2, 2.5 * 32 - 4, 12);
      ctx.fillStyle = '#8D6E63';
    }
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillStyle = '#78350F';
    ctx.fillText('BLEACHERS', 20 * 32, 13 * 32 + 12);

    // Hydration Station (East)
    ctx.fillStyle = '#0288D1';
    ctx.fillRect(20 * 32, 7 * 32, 32, 32);
    ctx.font = '18px sans-serif';
    ctx.fillText('💧', 20 * 32 + 6, 7 * 32 + 22);
    ctx.fillStyle = '#0277BD';
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillText('HYDRATION', 20 * 32 - 4, 8 * 32 + 14);

    // South Exit Gateway
    const exitY = (WORLD_ROWS - 1) * 32;
    ctx.fillStyle = '#D97706';
    ctx.fillRect(10 * 32, exitY - 8, 5 * 32, 14);
    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GATEWAY — WORLD MAP', 12.5 * 32, exitY + 2);
    ctx.textAlign = 'left';

    // Render Coach Daniel at (12, 5.0)
    renderNpc(ctx, 12, 5.0, '🏃', 'Coach Daniel', '#D97706');
  }

  function renderOutreachWorld(ctx) {
    const place = PLACES.outreach_site || PLACES.outreach || {};
    // Floor: Earthy warm green/grass lawn
    ctx.fillStyle = place.atmosphere?.floorColor || '#E8F5E9';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Shaded Mission Canopy Tent (Central shelter)
    const tentX = 7 * 32;
    const tentY = 2 * 32;
    const tentW = 11 * 32;
    const tentH = 8 * 32;
    ctx.fillStyle = '#A7F3D0';
    ctx.fillRect(tentX, tentY, tentW, tentH);
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 3;
    ctx.strokeRect(tentX, tentY, tentW, tentH);

    // Canopy striped trim
    ctx.fillStyle = '#047857';
    for (let x = tentX; x < tentX + tentW; x += 32) {
      ctx.fillRect(x, tentY, 16, 12);
      ctx.fillRect(x + 16, tentY + tentH - 12, 16, 12);
    }

    // Canopy Banner
    ctx.fillStyle = '#065F46';
    ctx.beginPath();
    ctx.roundRect(8 * 32, tentY + 16, 9 * 32, 24, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 9.5px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('COMMUNITY BLESSING & OUTREACH SITE', 12.5 * 32, tentY + 32);
    ctx.textAlign = 'left';

    // Packing & Assembly Table
    ctx.fillStyle = '#795548';
    ctx.fillRect(9 * 32, 5 * 32, 6 * 32, 28);
    ctx.fillStyle = '#A1887F';
    ctx.fillRect(9 * 32 + 4, 5 * 32 + 4, 6 * 32 - 8, 20);
    ctx.font = '16px sans-serif';
    ctx.fillText('📦', 10 * 32, 5 * 32 + 18);
    ctx.fillText('🥫', 11.5 * 32, 5 * 32 + 18);
    ctx.fillText('🍞', 13 * 32, 5 * 32 + 18);

    // Supply Crates & Ready Care Boxes
    ctx.fillStyle = '#D97706';
    ctx.fillRect(16 * 32, 5 * 32, 2 * 32, 2 * 32);
    ctx.fillStyle = '#B45309';
    ctx.fillRect(5 * 32, 11 * 32, 3 * 32, 2 * 32);
    ctx.font = '20px sans-serif';
    ctx.fillText('📦', 16 * 32 + 4, 6 * 32 + 16);
    ctx.fillText('📦', 5 * 32 + 4, 12 * 32 + 16);
    ctx.fillText('📦', 6.5 * 32 + 4, 12 * 32 + 16);

    // Donation Shelves / Food Pantry (West)
    ctx.fillStyle = '#4E342E';
    ctx.fillRect(3 * 32, 4 * 32, 2.5 * 32, 5 * 32);
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(3 * 32 + 4, 4 * 32 + 4, 2.5 * 32 - 8, 5 * 32 - 8);
    ctx.font = '18px sans-serif';
    ctx.fillText('🥫', 3 * 32 + 8, 5 * 32 + 16);
    ctx.fillText('🌾', 3 * 32 + 8, 7 * 32 + 16);
    ctx.fillStyle = '#059669';
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillText('DONATIONS', 3 * 32 - 2, 9 * 32 + 14);

    // Community Needs Board (East)
    ctx.fillStyle = '#047857';
    ctx.fillRect(19 * 32, 4 * 32, 2.5 * 32, 3 * 32);
    ctx.fillStyle = '#D1FAE5';
    ctx.fillRect(19 * 32 + 4, 4 * 32 + 4, 2.5 * 32 - 8, 3 * 32 - 8);
    ctx.font = '16px sans-serif';
    ctx.fillText('📋', 19 * 32 + 10, 5 * 32 + 18);
    ctx.fillStyle = '#047857';
    ctx.font = 'bold 8px "Clear Sans", sans-serif';
    ctx.fillText('NEEDS BOARD', 19 * 32 - 4, 7 * 32 + 14);

    // South Exit Gateway
    const exitY = (WORLD_ROWS - 1) * 32;
    ctx.fillStyle = '#059669';
    ctx.fillRect(10 * 32, exitY - 8, 5 * 32, 14);
    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GATEWAY — WORLD MAP', 12.5 * 32, exitY + 2);
    ctx.textAlign = 'left';

    // Render Ate Maria at (12, 4.5)
    renderNpc(ctx, 12, 4.5, '👩‍🌾', 'Ate Maria', '#059669');
  }

  function renderGenericPlace(ctx, place) {
    if (!place) return;
    // Base floor
    ctx.fillStyle = place.atmosphere?.floorColor || '#F5ECE1';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Subtle floor tile grid
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.35)';
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

    // World objects
    if (Array.isArray(place.worldObjects)) {
      for (const obj of place.worldObjects) {
        const ox = obj.x * TILE_SIZE;
        const oy = obj.y * TILE_SIZE;
        const ow = (obj.w || 1) * TILE_SIZE;
        const oh = (obj.h || 1) * TILE_SIZE;

        ctx.fillStyle = obj.color || '#8D6E63';
        if (obj.type === 'wall') {
          ctx.fillRect(ox, oy, ow, oh);
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.lineWidth = 1;
          ctx.strokeRect(ox, oy, ow, oh);
        } else if (obj.type === 'rug' || obj.type === 'floor_zone') {
          ctx.fillRect(ox, oy, ow, oh);
        } else {
          ctx.fillRect(ox, oy, ow, oh);
          if (obj.label) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 8px "Clear Sans", sans-serif';
            ctx.fillText(obj.label, ox + 4, oy + oh / 2 + 3);
          }
        }
      }
    }

    // Exits
    if (Array.isArray(place.exits)) {
      for (const exit of place.exits) {
        const ex = exit.x * TILE_SIZE;
        const ey = exit.y * TILE_SIZE;
        const ew = (exit.w || 1) * TILE_SIZE;
        const eh = (exit.h || 1) * TILE_SIZE;
        ctx.fillStyle = place.accentColor || '#EB5F12';
        ctx.fillRect(ex, ey, ew, eh);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8.5px "Clear Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(exit.label || 'EXIT', ex + ew / 2, ey + eh / 2 + 3);
        ctx.textAlign = 'left';
      }
    }

    // NPCs
    if (Array.isArray(place.npcs)) {
      for (const npc of place.npcs) {
        const pos = npc.defaultPosition || { x: 12, y: 5 };
        renderNpc(ctx, pos.x, pos.y, npc.emoji || '👤', npc.name || 'NPC', npc.tagColor || '#D22F0A');
      }
    }
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
    else if (state.activePlaceId === 'outreach_site' || state.activePlaceId === 'outreach') renderOutreachWorld(ctx);
    else {
      const p = PLACES[state.activePlaceId];
      if (p) renderGenericPlace(ctx, p);
      else renderHomeWorld(ctx);
    }

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

  function updateDebugHud(force = false) {
    const hud = typeof document !== 'undefined' ? document.getElementById('debug-hud') : null;
    if (!hud) return;
    if (!isDebugMode && !force) {
      hud.classList.remove('visible');
    } else {
      hud.classList.add('visible');
    }

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

    const q1Status = (state.questProgress && state.questProgress['Q-001']) ? state.questProgress['Q-001'].status : 'N/A';
    const q2Status = (state.questProgress && state.questProgress['Q-002']) ? state.questProgress['Q-002'].status : 'N/A';
    const q3Status = (state.questProgress && state.questProgress['Q-003']) ? state.questProgress['Q-003'].status : 'N/A';

    let availCount = 0, activeCount = 0, doneCount = 0, lockedCount = 0;
    if (state.questProgress) {
      Object.values(state.questProgress).forEach(p => {
        if (p.status === 'COMPLETED') doneCount++;
        else if (['ACCEPTED', 'REAL_WORLD', 'RETURNED', 'VERIFYING'].includes(p.status)) activeCount++;
        else if (p.status === 'AVAILABLE') availCount++;
        else lockedCount++;
      });
    }

    const pData = (typeof window !== 'undefined' && window.KOINONIA_DATA) ? window.KOINONIA_DATA : (typeof KOINONIA_DATA !== 'undefined' ? KOINONIA_DATA : null);
    const xpProg = pData && pData.getCurrentLevelProgress ? pData.getCurrentLevelProgress(state.charXp) : { nextLevelXp: 10, xpRemaining: Math.max(0, 10 - state.charXp) };
    const nextXpThreshold = xpProg.nextLevelXp || 10;
    const xpToNext = xpProg.xpRemaining !== undefined ? xpProg.xpRemaining : Math.max(0, 10 - state.charXp);
    const milestoneCatalog = (pData && (pData.MILESTONES || pData.milestones)) || [];
    const unlockedMCount = Array.isArray(state.unlockedMilestones) ? state.unlockedMilestones.length : 0;
    const totalMCount = milestoneCatalog.length > 0 ? milestoneCatalog.length : unlockedMCount;
    const visitedPlacesCount = Array.isArray(state.visitedPlaces) ? state.visitedPlaces.length : 1;
    const placesCatalogData = (pData && (pData.PLACES || pData.places)) || (typeof PLACES !== 'undefined' ? PLACES : null);
    const totalPlacesCount = placesCatalogData ? Object.keys(placesCatalogData).filter(k => k !== 'outreach').length : 5;
    const currentTimeObj = getCurrentTime();
    const nowIsoStr = currentTimeObj.toISOString().replace('T', ' ').slice(0, 19);
    const liveEventsCount = (pData && pData.getLiveEvents) ? pData.getLiveEvents(null, currentTimeObj).length : 0;
    const activeCampTitle = (state.activeCampaignIds && state.activeCampaignIds.length > 0) ? state.activeCampaignIds[0] : 'None';
    const campChaptersDone = getCompletedChaptersCount();

    hud.innerHTML = `
      <strong>KOINONIA Phase 0.18 Sports & Fit Quest Engine HUD</strong><br>
      Clock: <b>${nowIsoStr}</b> ${state.demoNow ? '<span style="color:#DC2626;">[DEMO OVERRIDE]</span>' : '[SYSTEM TIME]'}<br>
      Fit Quests: <b>${state.fitQuestMetrics?.completedCount || 0} Done</b> | PBs: <b>${state.fitQuestMetrics?.personalBestsCount || 0}</b> | Sports: <b>${(state.sportsExplored || []).length} / 5 Tried</b><br>
      Live Events: <b>${liveEventsCount}</b> | Campaign: <b>${activeCampTitle}</b> (<b>${campChaptersDone} / 12 Chapters</b>)<br>
      Events Attended: <b>${state.eventsAttendedCount || 0}</b> | Milestones: <b>${unlockedMCount} / ${totalMCount} Unlocked</b><br>
      Place: <b>${state.activePlaceId}</b> | Spawn: <b>${state.spawnId || 'default'}</b> | Discovered: <b>${visitedPlacesCount} / ${totalPlacesCount}</b><br>
      Pos: <b>(${state.avatar.x.toFixed(1)}, ${state.avatar.y.toFixed(1)})</b> | Dir: <b>${state.avatar.dir}</b><br>
      Nearest: <span style="color:var(--brand-flame-gold);font-weight:700;">${nearestDesc}</span><br>
      Character: <b>Lv ${state.charLevel}</b> | XP: <b>${state.charXp} / ${nextXpThreshold}</b> (Next: <b>${xpToNext} XP</b>) | Peak: <b>Lv ${state.highestLevelReached || state.charLevel}</b><br>
      Growth: Stew: <b>${state.skills.stewardship || 0}</b> | Resp: <b>${state.skills.responsibility || 0}</b> | Serv: <b>${state.skills.service || 0}</b> | Refl: <b>${state.skills.reflection || 0}</b><br>
      Tracked Quest: <b>${state.trackedQuestId}</b> [<b>${(state.questProgress && state.questProgress[state.trackedQuestId]) ? state.questProgress[state.trackedQuestId].status : state.questStatus}</b>]<br>
      Objective: <b>${state.currentObjective}</b><br>
      Quest Engine: Avail: <b>${availCount}</b> | Active: <b>${activeCount}</b> | Done: <b>${doneCount}</b> | Locked: <b>${lockedCount}</b><br>
      Quests: Q-001: <b>${q1Status}</b> | Q-002: <b>${q2Status}</b> | Q-003: <b>${q3Status}</b><br>
      LP: <b>${state.lp}</b> (Participation Currency)<br>
      Gate Open: <b>${state.gateOpen}</b> | FOG Unlocked: <b>${state.fogCenterUnlocked}</b> | Places: <b>${(state.unlockedPlaces || []).join(', ')}</b><br>
      Device: <b>${(r.deviceClass || '').toUpperCase()}</b> | Orient: <b>${(r.orientation || '').toUpperCase()}</b><br>
      Stage: <b>${stageW}x${stageH}px</b> | Cam: (${Math.round(camera.x)}, ${Math.round(camera.y)})<br>
      Joystick: <b>${joystick.active ? 'ACTIVE' : 'IDLE'}</b> | Vec: (${joystick.vectorX.toFixed(2)}, ${joystick.vectorY.toFixed(2)}) | Mag: ${(joystick.intensity * 100).toFixed(0)}%
      <div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(255,255,255,0.25); font-size:10px; line-height:1.35;">
        <strong style="color:var(--brand-flame-gold);">PERSISTENCE & WORLD TELEMETRY:</strong><br>
        Origin: <b>${sm.origin || 'Same-Origin'}</b><br>
        Storage available: <b>${sm.available ? 'TRUE' : 'FALSE'}</b><br>
        Save key: <code>${SAVE_STORAGE_KEY}</code><br>
        Save exists: <b>${sm.saveExists ? 'TRUE' : 'FALSE'}</b><br>
        Save version: <b>${sm.saveVersion || SAVE_VERSION}</b><br>
        Last save: <small>${sm.lastSaveTime || 'None'}</small><br>
        Last save reason: <b>${sm.lastSaveReason || 'N/A'}</b><br>
        Last load: <small>${sm.lastLoadTime || 'None'}</small><br>
        Load result: <b>${sm.loadResult || 'pending'}</b><br>
        Visited Places: <b>${(state.visitedPlaces || []).join(', ')}</b><br>
        Stored LP: <b>${sm.storedLP !== null && sm.storedLP !== undefined ? sm.storedLP : 'N/A'}</b> | Runtime LP: <b>${state.lp}</b><br>
        Stored quest: <b>${sm.storedQuest || 'N/A'}</b> | Runtime quest: <b>${state.questStatus}</b><br>
        Stored gate: <b>${sm.storedGate !== null && sm.storedGate !== undefined ? sm.storedGate : 'N/A'}</b> | Runtime gate: <b>${state.gateOpen}</b>
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
      if (activeMiniGameId) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          handleMiniGameAction();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          exitMiniGame();
          return;
        }
      }
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
        handleActionInteract();
      }
      if (e.key === 'p' || e.key === 'P') {
        triggerEmote('🙏');
      }
      if (e.key === 'm' || e.key === 'M') {
        openWorldPlacesModal();
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
      } else {
        // Generic exits check from PLACES[state.activePlaceId].exits
        const pId = (state.activePlaceId === 'outreach') ? 'outreach_site' : state.activePlaceId;
        const curPlace = PLACES[pId] || PLACES[state.activePlaceId];
        if (curPlace && Array.isArray(curPlace.exits) && !state.isTransitioning) {
          for (const exit of curPlace.exits) {
            if (exit.requiresGateOpen && !state.gateOpen) continue;
            if (av.x >= exit.x && av.x <= (exit.x + (exit.w || 1)) &&
                av.y >= exit.y && av.y <= (exit.y + (exit.h || 1))) {
              if (exit.destination === 'world_map') {
                openWorldPlacesModal();
              } else if (PLACES[exit.destination]) {
                transitionToPlace(exit.destination, exit.spawnId || 'default');
              }
              break;
            }
          }
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
    const pId = (placeId === 'outreach') ? 'outreach_site' : placeId;
    if (pId === 'home') {
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
          id: 'home_chore_board',
          name: 'Family Chore Board',
          x: 10.0,
          y: 2.0,
          radius: 2.0,
          type: 'notice_board',
          getPrompt: () => 'READ — Family Chore Board [E]',
          onInteract: () => openQuestsTabModal()
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
    } else if (pId === 'fog_center') {
      const interactables = [
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
          x: 6.0,
          y: 4.0,
          radius: 2.2,
          type: 'notice_board',
          getPrompt: () => 'READ — Community Notice Board [E]',
          onInteract: () => openNoticeBoardModal()
        },
        {
          id: 'prayer_cross',
          name: 'Timber Cross & Jasmine Arbor',
          x: 19.0,
          y: 5.0,
          radius: 2.2,
          type: 'reflection_point',
          getPrompt: () => 'PRAY — Timber Cross & Jasmine Arbor [E]',
          onInteract: () => {
            triggerEmote('🙏');
            showToast('✝️ "Where two or three gather in my name, there am I with them."');
          }
        },
        {
          id: 'fog_ministry_board',
          name: 'Ministry Opportunities Board',
          x: 15.0,
          y: 2.5,
          radius: 2.0,
          type: 'notice_board',
          getPrompt: () => 'VIEW — Ministry Opportunities [E]',
          onInteract: () => {
            triggerEmote('✨');
            showToast('✨ Ministry opportunities: Youth Mentorship, Music, Community Care.');
          }
        },
        {
          id: 'fog_youth_area',
          name: 'Youth Gathering Area',
          x: 6.0,
          y: 9.0,
          radius: 2.2,
          type: 'activity_point',
          getPrompt: () => 'JOIN — Youth Fellowship Circle [E]',
          onInteract: () => {
            triggerEmote('👥');
            showToast('👥 "Encourage one another and build each other up." (1 Thess 5:11)');
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

      // Phase 0.17: Temporary Event Interactables (Active only when event is live)
      const nowFog = getCurrentTime();
      const liveEventFog = (data.getLiveEventForPlace ? data.getLiveEventForPlace('fog_center', nowFog) : null);
      if (liveEventFog && liveEventFog.worldEffects && Array.isArray(liveEventFog.worldEffects.temporaryInteractables)) {
        liveEventFog.worldEffects.temporaryInteractables.forEach((ti, idx) => {
          interactables.push({
            id: ti.id,
            name: ti.name,
            x: 8.5 + (idx * 5.0),
            y: 8.0,
            radius: 2.2,
            type: 'event_interactable',
            getPrompt: () => `${ti.action || 'INTERACT'} — ${ti.name} [E]`,
            onInteract: () => {
              triggerEmote(ti.icon || '✨');
              showToast(`${ti.icon || '✨'} ${ti.name}: ${ti.prompt}`);
            }
          });
        });
      }

      return interactables;
    } else if (pId === 'school') {
      return [
        {
          id: 'teacher_mia',
          name: 'Teacher Mia',
          x: 12.0,
          y: 4.5,
          radius: 2.3,
          type: 'npc',
          getPrompt: () => 'TALK — Teacher Mia [E]',
          onInteract: () => openDialogueModal('teacher_mia')
        },
        {
          id: 'school_notice_board',
          name: 'School Notice Board',
          x: 20.0,
          y: 5.5,
          radius: 2.2,
          type: 'notice_board',
          getPrompt: () => 'READ — School Notice Board [E]',
          onInteract: () => openQuestsTabModal()
        },
        {
          id: 'school_study_shelf',
          name: 'Library & Reference Shelf',
          x: 3.0,
          y: 6.0,
          radius: 2.2,
          type: 'object',
          getPrompt: () => 'BROWSE — Campus Library Books [E]',
          onInteract: () => {
            triggerEmote('📚');
            showToast('📖 "The fear of the LORD is the beginning of wisdom." (Proverbs 9:10)');
          }
        },
        {
          id: 'school_study_desk',
          name: 'Student Study Desk',
          x: 12.0,
          y: 8.5,
          radius: 2.0,
          type: 'object',
          getPrompt: () => 'STUDY — Student Desk Notes [E]',
          onInteract: () => {
            triggerEmote('📝');
            showToast('📝 Quiet study habits build reliable discipline for real life.');
          }
        },
        {
          id: 'school_exit',
          name: 'School Entrance Exit',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          type: 'travel_point',
          getPrompt: () => 'TRAVEL — Leave School (Open World Map) [E]',
          onInteract: () => openWorldPlacesModal()
        }
      ];
    } else if (pId === 'sports_hub') {
      return [
        {
          id: 'coach_daniel',
          name: 'Coach Daniel',
          x: 12.0,
          y: 5.0,
          radius: 2.4,
          type: 'npc',
          getPrompt: () => 'TALK — Coach Daniel (Fit Quest Guide) [E]',
          onInteract: () => openDialogueModal('coach_daniel')
        },
        {
          id: 'fitquest_board',
          name: 'Fit Quest Board',
          x: 3.0,
          y: 5.0,
          radius: 2.2,
          type: 'activity_point',
          getPrompt: () => 'OPEN FIT QUEST — Fit Quest Hub [E]',
          onInteract: () => openFitQuestModal('play')
        },
        {
          id: 'sports_pb_board',
          name: 'Personal Best Board',
          x: 3.0,
          y: 8.0,
          radius: 2.2,
          type: 'activity_point',
          getPrompt: () => 'RECORDS — Check Personal Bests [E]',
          onInteract: () => openFitQuestModal('bests')
        },
        {
          id: 'sports_hoop',
          name: 'Basketball Hoop',
          x: 12.0,
          y: 3.0,
          radius: 2.2,
          type: 'object',
          getPrompt: () => 'BASKETBALL — Play Free Throw Focus [E]',
          onInteract: () => startMiniGame('FQ-V001', 'basketball')
        },
        {
          id: 'sports_running_track',
          name: 'Running Track & Sprint Lane',
          x: 7.0,
          y: 13.0,
          radius: 2.2,
          type: 'activity_point',
          getPrompt: () => 'RUNNING TRACK — Play Reaction Sprint [E]',
          onInteract: () => startMiniGame('FQ-V002', 'running')
        },
        {
          id: 'sports_racket_court',
          name: 'Badminton & Pickleball Court',
          x: 17.0,
          y: 7.5,
          radius: 2.2,
          type: 'activity_point',
          getPrompt: () => 'RACKET COURT — Play Rally Focus [E]',
          onInteract: () => startMiniGame('FQ-V003', 'badminton')
        },
        {
          id: 'sports_activity_board',
          name: 'Fitness Zone & Movement Mat',
          x: 3.0,
          y: 11.0,
          radius: 2.2,
          type: 'activity_point',
          getPrompt: () => 'FITNESS ZONE — Real-World Fit Quests [E]',
          onInteract: () => openFitQuestModal('realworld')
        },
        {
          id: 'sports_hydration_station',
          name: 'Hydration Station',
          x: 20.0,
          y: 11.5,
          radius: 2.0,
          type: 'object',
          getPrompt: () => 'DRINK — Cool Fresh Water [E]',
          onInteract: () => {
            triggerEmote('💧');
            showToast('💧 Cool fresh water! Stay hydrated during physical activity.');
          }
        },
        {
          id: 'sports_exit',
          name: 'Sports Hub Gate Exit',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          type: 'travel_point',
          getPrompt: () => 'TRAVEL — Leave Sports Hub (Open World Map) [E]',
          onInteract: () => openWorldPlacesModal()
        }
      ];
    } else if (pId === 'outreach_site' || pId === 'outreach') {
      return [
        {
          id: 'ate_maria',
          name: 'Ate Maria',
          x: 12.0,
          y: 4.5,
          radius: 2.4,
          type: 'npc',
          getPrompt: () => 'TALK — Ate Maria [E]',
          onInteract: () => openDialogueModal('ate_maria')
        },
        {
          id: 'outreach_notice_board',
          name: 'Outreach Notice Board',
          x: 3.0,
          y: 6.5,
          radius: 2.2,
          type: 'notice_board',
          getPrompt: () => 'READ — Outreach Board [E]',
          onInteract: () => openQuestsTabModal()
        },
        {
          id: 'packing_station',
          name: 'Community Care Packing Tables',
          x: 12.0,
          y: 7.0,
          radius: 2.2,
          type: 'activity_point',
          getPrompt: () => 'PACK — Relief Supplies [E]',
          onInteract: () => {
            triggerEmote('📦');
            showToast('📦 Packed with love! Serving families in quiet humility.');
          }
        },
        {
          id: 'donation_shelf',
          name: 'Donation & Food Pantry Shelf',
          x: 6.0,
          y: 5.0,
          radius: 2.0,
          type: 'object',
          getPrompt: () => 'ORGANIZE — Pantry Supplies [E]',
          onInteract: () => {
            triggerEmote('🤝');
            showToast('🤝 "Whatever you did for one of the least of these, you did for me."');
          }
        },
        {
          id: 'outreach_exit',
          name: 'Outreach Site Exit Gate',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          type: 'travel_point',
          getPrompt: () => 'TRAVEL — Leave Outreach Site (Open World Map) [E]',
          onInteract: () => openWorldPlacesModal()
        }
      ];
    }

    // Generic fallback for any future places defined in PLACES
    const place = PLACES[pId] || PLACES[placeId];
    if (place && Array.isArray(place.interactables)) {
      return place.interactables.map(item => ({
        id: item.id,
        name: item.name,
        x: item.x,
        y: item.y,
        radius: item.radius || 2.2,
        type: item.type ? item.type.toLowerCase() : 'object',
        getPrompt: () => `${item.label || item.name} [E]`,
        onInteract: () => {
          if (item.type === 'NPC' || item.dialogueNpcId) {
            openDialogueModal(item.dialogueNpcId || item.id);
          } else if (item.action === 'open_world_map') {
            openWorldPlacesModal();
          } else if (item.action === 'open_quests') {
            openQuestsTabModal();
          } else if (item.action === 'open_fitquest') {
            openFitQuestModal('play');
          } else if (item.action === 'sports_pb_board') {
            openFitQuestModal('bests');
          } else if (item.action === 'sports_board' || item.action === 'open_fitquest_realworld') {
            openFitQuestModal('realworld');
          } else if (item.action === 'sports_hoop_shot') {
            startMiniGame('FQ-V001', 'basketball');
          } else if (item.action === 'play_running') {
            startMiniGame('FQ-V002', 'running');
          } else if (item.action === 'play_rally') {
            startMiniGame('FQ-V003', 'badminton');
          } else if (item.action === 'drink_water') {
            triggerEmote('💧');
            showToast('💧 Cool fresh water! Stay hydrated during physical activity.');
          } else {
            showToast(item.label || item.name);
          }
        }
      }));
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

    // Normalize alias
    if (targetPlaceId === 'outreach') targetPlaceId = 'outreach_site';
    const targetPlace = PLACES[targetPlaceId] || PLACES.home;

    const overlay = document.getElementById('place-transition-overlay');
    const iconEl = document.getElementById('transition-icon');
    const titleEl = document.getElementById('transition-title');
    const subtitleEl = document.getElementById('transition-subtitle');

    if (iconEl) iconEl.textContent = targetPlace.icon || '📍';
    if (titleEl) titleEl.textContent = `Entering ${targetPlace.name}...`;
    if (subtitleEl) subtitleEl.textContent = targetPlace.subtitle || targetPlace.tagline || 'Fire of God Ministries Virtual Community';

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

      // Apply spawn coordinates with boundary safety
      const spawn = getSpawnPoint(targetPlaceId, spawnId);
      state.avatar.x = Math.max(1.5, Math.min(WORLD_COLS - 2.5, spawn.x));
      state.avatar.y = Math.max(1.5, Math.min(WORLD_ROWS - 2.5, spawn.y));
      state.avatar.dir = spawn.dir || 'down';
      state.avatar.isMoving = false;

      // Check first-time visit / discovery moment
      const wasVisited = isPlaceVisited(targetPlaceId);
      markPlaceVisited(targetPlaceId);

      if (!wasVisited) {
        // Discovery moment!
        showToast(`${targetPlace.icon || '📍'} Discovered ${targetPlace.name}! ${targetPlace.subtitle || targetPlace.tagline || ''}`);
        playBellSound();

        // Evaluate milestones (e.g. m_visit_school, m_visit_sports, m_visit_outreach, m_five_places)
        const progResult = evaluateCharacterProgression('place_discovery');
        if (progResult && Array.isArray(progResult.newlyUnlockedMilestones) && progResult.newlyUnlockedMilestones.length > 0) {
          progResult.newlyUnlockedMilestones.forEach(m => {
            setTimeout(() => {
              showToast(`🏆 Milestone Unlocked: ${m.title}`);
            }, 600);
          });
        }
      }

      // Objective hints on first visits
      if (targetPlaceId === 'fog_center' && !state.visitedFogCenter) {
        state.visitedFogCenter = true;
        state.currentObjective = 'Explore FOG Community Center & Talk to Sister Grace';
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
  // 12. MODULAR QUEST ENGINE & STATE-REACTIVE DIALOGUE
  // ============================================================
  function getQuest(questId) {
    if (!questId) return null;
    return QUESTS.find(q => q.id === questId) || null;
  }

  function evaluateQuestAvailability() {
    // Ensure all quests from data store have entries in questProgress
    QUESTS.forEach(q => {
      if (!state.questProgress[q.id]) {
        state.questProgress[q.id] = {
          status: 'LOCKED',
          currentStepIndex: 0,
          rewardClaimed: false,
          reflectionText: '',
          completedAt: null
        };
      }
    });

    // Check prerequisites for LOCKED quests
    QUESTS.forEach(q => {
      const prog = state.questProgress[q.id];
      if (prog && prog.status === 'LOCKED') {
        let allMet = true;
        const reqs = q.prerequisites || q.requirements || [];
        if (Array.isArray(reqs)) {
          for (const req of reqs) {
            if (req.type === 'QUEST_COMPLETED') {
              const reqProg = state.questProgress[req.questId] ||
                              state.questProgress[String(req.questId).toUpperCase()] ||
                              state.questProgress[String(req.questId).toLowerCase()];
              if (!reqProg || reqProg.status !== 'COMPLETED') {
                allMet = false;
                break;
              }
            } else if (req.type === 'PLACE_UNLOCKED') {
              const isUnlocked = state.unlockedPlaces.includes(req.placeId) ||
                (PLACES[req.placeId] && PLACES[req.placeId].unlocked);
              if (!isUnlocked) {
                allMet = false;
                break;
              }
            } else if (req.type === 'PLACE_VISITED') {
              const visited = (req.placeId === 'fog_center')
                ? (state.visitedFogCenter || (state.visitedPlaces && state.visitedPlaces.fog_center))
                : (state.visitedPlaces && state.visitedPlaces[req.placeId]);
              if (!visited) {
                allMet = false;
                break;
              }
            } else if (req.type === 'LEVEL') {
              if (state.charLevel < req.minLevel) {
                allMet = false;
                break;
              }
            } else if (req.type === 'FLAG') {
              if (state[req.flag] !== req.value) {
                allMet = false;
                break;
              }
            }
          }
        }
        if (allMet) {
          prog.status = 'AVAILABLE';
        }
      }
    });

    // Backward compatibility: sync Q-001 progress to legacy state.questStatus
    const q1 = state.questProgress['Q-001'];
    if (q1) {
      if (q1.status === 'COMPLETED') {
        state.questStatus = 'completed';
      } else if (['ACCEPTED', 'REAL_WORLD', 'RETURNED', 'VERIFYING'].includes(q1.status)) {
        state.questStatus = 'in_progress';
      } else if (q1.status === 'AVAILABLE') {
        state.questStatus = 'ready';
      }
    }
  }

  function openDialogueModal(npcId = 'barnaby') {
    state.dialogue.active = true;
    const modal = document.getElementById('npc-dialogue-modal');
    const speakerEl = document.getElementById('dialogue-speaker');
    const roleEl = document.getElementById('dialogue-role');
    const portraitEl = document.getElementById('dialogue-portrait');
    const textEl = document.getElementById('dialogue-text');
    const actionBtn = document.getElementById('btn-dialogue-action');

    evaluateQuestAvailability();

    if (npcId === 'barnaby') {
      state.dialogue.speaker = 'Uncle Barnaby';
      state.dialogue.role = 'Garden Mentor • My Home';
      state.dialogue.portrait = '👴';

      const q1Prog = state.questProgress['Q-001'] || { status: 'AVAILABLE' };
      const q2Prog = state.questProgress['Q-002'] || { status: 'LOCKED' };

      if (q1Prog.status === 'AVAILABLE') {
        state.trackedQuestId = 'Q-001';
        if (textEl) textEl.textContent = '"Peace be with you, Alex! The plants on our veranda are looking thirsty today. Faithful stewardship begins at home in small, quiet chores."';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'VIEW GARDEN QUEST';
          actionBtn.onclick = () => openQuestDetailModal('Q-001');
        }
      } else if (q1Prog.status === 'ACCEPTED' || q1Prog.status === 'REAL_WORLD') {
        state.trackedQuestId = 'Q-001';
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
      } else if (q1Prog.status === 'RETURNED' || q1Prog.status === 'VERIFYING') {
        state.trackedQuestId = 'Q-001';
        if (textEl) textEl.textContent = '"Welcome back inside, Alex! Let\'s verify your garden stewardship and record your reflection."';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'RECORD REFLECTION';
          actionBtn.onclick = () => {
            closeDialogueModal();
            returnFromRealWorld();
          };
        }
      } else {
        // Q-001 is COMPLETED. Now inspect Q-002 ("Light at Home")
        if (q2Prog.status === 'AVAILABLE') {
          state.trackedQuestId = 'Q-002';
          if (textEl) textEl.textContent = '"Peace be with you, Alex! A faithful heart serves quietly where no one is looking. Would you bring light and order to our home today?"';
          if (actionBtn) {
            actionBtn.style.display = 'inline-flex';
            actionBtn.querySelector('span').textContent = 'VIEW FAMILY CALLING';
            actionBtn.onclick = () => openQuestDetailModal('Q-002');
          }
        } else if (q2Prog.status === 'ACCEPTED' || q2Prog.status === 'REAL_WORLD') {
          state.trackedQuestId = 'Q-002';
          if (textEl) textEl.textContent = '"Diligence in small household duties honors God and blesses your whole family. Tidy up a common room or wash dishes, then return!"';
          if (actionBtn) {
            actionBtn.style.display = 'inline-flex';
            actionBtn.querySelector('span').textContent = 'CHECK MISSION PROGRESS';
            actionBtn.onclick = () => {
              closeDialogueModal();
              const standby = document.getElementById('standby-modal');
              if (standby) standby.classList.remove('hidden');
            };
          }
        } else if (q2Prog.status === 'RETURNED' || q2Prog.status === 'VERIFYING') {
          state.trackedQuestId = 'Q-002';
          if (textEl) textEl.textContent = '"Well done serving your household! Let\'s reflect on how quiet service builds humble discipline."';
          if (actionBtn) {
            actionBtn.style.display = 'inline-flex';
            actionBtn.querySelector('span').textContent = 'RECORD REFLECTION';
            actionBtn.onclick = () => {
              closeDialogueModal();
              openReflectionModal();
            };
          }
        } else {
          // Q-001 and Q-002 completed!
          if (textEl) textEl.textContent = '"Glory to God! Look how lush and vibrant our garden is now. Because you were faithful in these duties, the perimeter gate is unlocked. Walk south to visit the FOG Community Center!"';
          if (actionBtn) {
            actionBtn.style.display = 'inline-flex';
            actionBtn.querySelector('span').textContent = 'WALK TO FOG CENTER';
            actionBtn.onclick = () => {
              closeDialogueModal();
              transitionToPlace('fog_center', 'from_home');
            };
          }
        }
      }
    } else if (npcId === 'sister_grace') {
      state.dialogue.speaker = 'Sister Grace';
      state.dialogue.role = 'Welcome Coordinator • FOG Community Center';
      state.dialogue.portrait = '👩‍💼';

      state.visitedFogCenter = true;
      evaluateQuestAvailability();

      const q3Prog = state.questProgress['Q-003'] || { status: 'LOCKED' };

      if (q3Prog.status === 'AVAILABLE') {
        state.trackedQuestId = 'Q-003';
        if (textEl) textEl.textContent = '"Welcome to Fire of God Community Center, Alex! In the midst of fellowship and active service, quiet prayer anchors our hearts. Would you take a quiet moment today?"';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'VIEW PRAYER CALLING';
          actionBtn.onclick = () => openQuestDetailModal('Q-003');
        }
      } else if (q3Prog.status === 'ACCEPTED' || q3Prog.status === 'REAL_WORLD') {
        state.trackedQuestId = 'Q-003';
        if (textEl) textEl.textContent = '"Take three unhurried minutes in quiet reflection, Alex. Stillness in God\'s presence is never wasted time."';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'CHECK MISSION PROGRESS';
          actionBtn.onclick = () => {
            closeDialogueModal();
            const standby = document.getElementById('standby-modal');
            if (standby) standby.classList.remove('hidden');
          };
        }
      } else if (q3Prog.status === 'RETURNED' || q3Prog.status === 'VERIFYING') {
        state.trackedQuestId = 'Q-003';
        if (textEl) textEl.textContent = '"Welcome back from your stillness, Alex. What peace or truth did you receive in prayer?"';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'RECORD REFLECTION';
          actionBtn.onclick = () => {
            closeDialogueModal();
            openReflectionModal();
          };
        }
      } else if (q3Prog.status === 'COMPLETED') {
        const nowFog = getCurrentTime();
        const liveEventFog = (data.getLiveEventForPlace ? data.getLiveEventForPlace('fog_center', nowFog) : null);
        if (liveEventFog && liveEventFog.worldEffects && liveEventFog.worldEffects.dialogueOverrides && liveEventFog.worldEffects.dialogueOverrides.sister_grace) {
          if (textEl) textEl.textContent = '"' + liveEventFog.worldEffects.dialogueOverrides.sister_grace + '"';
          if (actionBtn) {
            actionBtn.style.display = 'inline-flex';
            actionBtn.querySelector('span').textContent = 'CHECK GATHERING DETAILS';
            actionBtn.onclick = () => {
              closeDialogueModal();
              openEventsHubModal('live');
            };
          }
        } else {
          if (textEl) textEl.textContent = '"The Lord bless you, Alex! Your faithful quiet time strengthens our entire fellowship. Feel free to walk around our fellowship hall. More community service callings are posted on the notice board!"';
          if (actionBtn) {
            actionBtn.style.display = 'inline-flex';
            actionBtn.querySelector('span').textContent = 'CHECK NOTICE BOARD';
            actionBtn.onclick = () => {
              closeDialogueModal();
              openNoticeBoardModal();
            };
          }
        }
      } else {
        if (textEl) textEl.textContent = '"Welcome to Fire of God Community Center, Alex! Uncle Barnaby sent word of your faithful garden stewardship. In our church community, every small act of diligence strengthens our fellowship."';
        if (actionBtn) {
          actionBtn.style.display = 'inline-flex';
          actionBtn.querySelector('span').textContent = 'CHECK NOTICE BOARD';
          actionBtn.onclick = () => {
            closeDialogueModal();
            openQuestsTabModal();
          };
        }
      }
    } else if (npcId === 'teacher_mia') {
      state.dialogue.speaker = 'Teacher Mia';
      state.dialogue.role = 'Educator & Academic Guide • School';
      state.dialogue.portrait = '👩‍🏫';
      const isFirst = !state.spokenToNpc.teacher_mia;
      state.spokenToNpc.teacher_mia = true;

      const q2Prog = state.questProgress['Q-002'] || { status: 'LOCKED' };
      if (isFirst) {
        if (textEl) textEl.textContent = '"Welcome to the campus, Alex! True scholarship isn\'t just about high grades—it\'s about diligence, honesty, and using your mind to bless others."';
      } else if (q2Prog.status === 'COMPLETED') {
        if (textEl) textEl.textContent = '"Well done! Orderly habits in school and family chores build reliable hands for real life. Keep honoring God in your daily studies."';
      } else {
        if (textEl) textEl.textContent = '"Keep up your study habits! A focused desk and an orderly mind help you serve your family and community with clarity."';
      }

      if (actionBtn) {
        actionBtn.style.display = 'inline-flex';
        actionBtn.querySelector('span').textContent = 'CHECK SCHOOL NOTICES';
        actionBtn.onclick = () => {
          closeDialogueModal();
          openQuestsTabModal();
        };
      }
    } else if (npcId === 'coach_daniel') {
      state.dialogue.speaker = 'Coach Daniel';
      state.dialogue.role = 'Athletics & Fitness Coach • Sports Hub';
      state.dialogue.portrait = '🏃';
      const isFirst = !state.spokenToNpc.coach_daniel;
      state.spokenToNpc.coach_daniel = true;

      if (isFirst) {
        if (textEl) textEl.textContent = '"Hey there, Alex! Welcome to the Sports Hub! Your body is a temple—let\'s build strength, discipline, and teamwork through active play. Use the Fit Quest Board beside the courts to choose Basketball, Reaction Sprint, Rally Focus, or a real-world challenge."';
      } else {
        if (textEl) textEl.textContent = '"Ready for a challenge? Use the Fit Quest Board beside the courts to choose Basketball, Reaction Sprint, Rally Focus, or a real-world challenge!"';
      }

      if (actionBtn) {
        actionBtn.style.display = 'inline-flex';
        actionBtn.querySelector('span').textContent = 'OPEN FIT QUEST HUB';
        actionBtn.onclick = () => {
          closeDialogueModal();
          openFitQuestModal('play');
        };
      }
    } else if (npcId === 'ate_maria') {
      state.dialogue.speaker = 'Ate Maria';
      state.dialogue.role = 'Outreach Coordinator • Outreach Site';
      state.dialogue.portrait = '👩‍🌾';
      const isFirst = !state.spokenToNpc.ate_maria;
      state.spokenToNpc.ate_maria = true;

      const q3Prog = state.questProgress['Q-003'] || { status: 'LOCKED' };
      if (isFirst) {
        if (textEl) textEl.textContent = '"Peace and blessings, Alex! Welcome to our community outreach station. Here we put our faith into action by serving families and neighbors in need."';
      } else if (q3Prog.status === 'COMPLETED') {
        if (textEl) textEl.textContent = '"Thank you for having a heart ready to serve. Love is not just words—it is packing food boxes and sharing what we have with cheerful hearts."';
      } else {
        if (textEl) textEl.textContent = '"Every small box packed brings comfort to a household. We are preparing community missions to bless families across our neighborhood."';
      }

      if (actionBtn) {
        actionBtn.style.display = 'inline-flex';
        actionBtn.querySelector('span').textContent = 'PACK CARE BOXES';
        actionBtn.onclick = () => {
          closeDialogueModal();
          triggerEmote('📦');
          showToast('📦 Box packed with rice, canned goods, and encouragement notes!');
        };
      }
    }

    state.spokenToNpc[npcId] = true;
    saveToStorage('npc_interaction');

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
    const quest = getQuest(questId);
    if (!quest) return;

    state.trackedQuestId = questId;

    const modal = document.getElementById('quest-detail-modal');
    const titleEl = document.getElementById('quest-detail-title');
    const subEl = document.getElementById('quest-detail-subtitle');
    const iconEl = document.getElementById('quest-detail-icon');
    const missionEl = document.getElementById('quest-modal-mission');
    const fallbackEl = document.getElementById('quest-modal-fallback');
    const rewardsContainer = document.getElementById('quest-detail-rewards');
    const acceptBtn = document.getElementById('btn-accept-quest');

    if (titleEl) titleEl.textContent = quest.title;
    if (subEl) subEl.textContent = `${quest.categoryTitle || quest.category} Calling`;
    if (iconEl) iconEl.textContent = quest.icon || '🌱';
    if (missionEl) missionEl.textContent = quest.realWorldAction;
    if (fallbackEl) {
      fallbackEl.textContent = (quest.realWorldFallbacks && quest.realWorldFallbacks.length > 0)
        ? quest.realWorldFallbacks.join(' • ')
        : 'Do a small quiet act of service or stewardship.';
    }

    if (rewardsContainer) {
      let rewardChips = `
        <div class="team-chip" style="text-align: center;">
          <span class="team-chip-title">Life Points</span>
          <span class="team-chip-score">+${quest.rewards.lp} LP</span>
        </div>
        <div class="team-chip" style="text-align: center;">
          <span class="team-chip-title">Character XP</span>
          <span class="team-chip-score" style="color: var(--brand-fire-orange);">+${quest.rewards.charXp || 5} XP</span>
        </div>
      `;
      if (quest.rewards.skills) {
        for (const [k, v] of Object.entries(quest.rewards.skills)) {
          const capName = k.charAt(0).toUpperCase() + k.slice(1);
          rewardChips += `
            <div class="team-chip" style="text-align: center;">
              <span class="team-chip-title">${capName}</span>
              <span class="team-chip-score" style="color: var(--accent-success);">+${v} XP</span>
            </div>
          `;
        }
      }
      rewardsContainer.innerHTML = rewardChips;
    }

    if (acceptBtn) {
      acceptBtn.querySelector('span').textContent = `🌿 ACCEPT THIS CALLING`;
      acceptBtn.onclick = () => acceptQuest(questId);
    }

    if (modal) modal.classList.remove('hidden');
  }

  // ============================================================
  // 13. MODULAR QUEST ENGINE & CANONICAL REWARDS
  // ============================================================
  function acceptQuest(questId = 'Q-001') {
    const modal = document.getElementById('quest-detail-modal');
    if (modal) modal.classList.add('hidden');

    const quest = getQuest(questId);
    if (!quest) return;

    if (!state.questProgress[questId]) {
      state.questProgress[questId] = { status: 'ACCEPTED', currentStepIndex: 0, rewardClaimed: false };
    }
    state.questProgress[questId].status = 'ACCEPTED';
    state.trackedQuestId = questId;

    if (questId === 'Q-001') {
      state.questStatus = 'in_progress';
    }

    state.currentObjective = `Real-World Task: ${quest.realWorldAction}`;
    updateObjectiveDisplay();
    updatePlaceUiDisplays();
    saveToStorage('quest_accept');

    // Populate Exit Ramp modal
    const exitModal = document.getElementById('exit-ramp-modal');
    const exitTask = document.getElementById('exit-ramp-task');
    const exitDesc = document.getElementById('exit-ramp-desc');
    const exitIcon = document.getElementById('exit-ramp-icon');
    if (exitTask) exitTask.textContent = quest.realWorldAction;
    if (exitDesc) exitDesc.textContent = quest.dialogue?.inProgress || '"The next part of this adventure doesn\'t happen on this screen."';
    if (exitIcon) exitIcon.textContent = quest.icon || '☀️';

    if (exitModal) exitModal.classList.remove('hidden');
  }

  function exitToRealWorld() {
    const exitModal = document.getElementById('exit-ramp-modal');
    if (exitModal) exitModal.classList.add('hidden');

    const questId = state.trackedQuestId || 'Q-001';
    const quest = getQuest(questId);

    if (state.questProgress[questId]) {
      state.questProgress[questId].status = 'REAL_WORLD';
    }
    if (questId === 'Q-001') {
      state.questStatus = 'in_progress';
    }

    const standbyDesc = document.getElementById('standby-desc');
    if (standbyDesc && quest) {
      standbyDesc.textContent = `Take your time in the physical world doing "${quest.realWorldAction}". When you're finished, return here to reflect and claim your rewards.`;
    }

    const standbyModal = document.getElementById('standby-modal');
    if (standbyModal) standbyModal.classList.remove('hidden');
    saveToStorage('real_world_enter');
  }

  function returnFromRealWorld() {
    const standbyModal = document.getElementById('standby-modal');
    if (standbyModal) standbyModal.classList.add('hidden');

    const questId = state.trackedQuestId || 'Q-001';
    const quest = getQuest(questId);
    if (state.questProgress[questId]) {
      state.questProgress[questId].status = 'RETURNED';
    }

    openVerificationModal(quest);
  }

  function openVerificationModal(quest) {
    if (!quest) {
      const questId = state.trackedQuestId || 'Q-001';
      quest = getQuest(questId);
    }
    const questId = quest?.id || state.trackedQuestId || 'Q-001';

    // Determine canonical verification type from quest definition
    let verifyType = (quest && quest.verification && quest.verification.type) ? quest.verification.type : 'TRUST';
    let verifyPrompt = '';
    if (quest && Array.isArray(quest.steps)) {
      for (const st of quest.steps) {
        if (st.verification) {
          verifyType = st.verification.type || verifyType;
          verifyPrompt = st.verification.prompt || st.verification.optionalPrompt || st.prompt || verifyPrompt;
          break;
        }
      }
    }

    if (verifyType === 'FAMILY_CONFIRM') {
      if (state.questProgress[questId]) {
        state.questProgress[questId].status = 'VERIFYING';
      }
      const familyPrompt = document.getElementById('family-confirm-prompt');
      if (familyPrompt && verifyPrompt) {
        familyPrompt.textContent = `"${verifyPrompt}"`;
      }
      const familyModal = document.getElementById('family-modal');
      if (familyModal) familyModal.classList.remove('hidden');
    } else if (verifyType === 'LEADER_CONFIRM') {
      leaderConfirmed();
    } else if (verifyType === 'EVENT_ATTENDANCE') {
      eventAttendanceConfirmed();
    } else {
      openReflectionModal();
    }
  }

  function parentConfirmed() {
    const familyModal = document.getElementById('family-modal');
    if (familyModal) familyModal.classList.add('hidden');
    openReflectionModal();
  }

  function leaderConfirmed() {
    // Preserve future hook for Ministry Leader verification
    openReflectionModal();
  }

  function eventAttendanceConfirmed() {
    // Preserve future hook for Event Attendance verification
    openReflectionModal();
  }

  function openReflectionModal() {
    const questId = state.trackedQuestId || 'Q-001';
    const quest = getQuest(questId);
    if (state.questProgress[questId]) {
      state.questProgress[questId].status = 'VERIFYING';
    }

    const promptEl = document.getElementById('reflection-prompt');
    const inputEl = document.getElementById('reflection-input');
    const submitBtn = document.getElementById('btn-submit-reflection');
    if (inputEl) inputEl.value = '';

    const verifyType = quest?.verification?.type || 'TRUST';
    const isRequired = Boolean(quest?.verification?.requiresReflection || verifyType === 'TRUST_PLUS_REFLECTION' || verifyType === 'REFLECTION');

    let promptText = 'One small thing I noticed while doing this was...';
    if (quest && Array.isArray(quest.steps)) {
      for (const st of quest.steps) {
        if (st.verification && (st.verification.prompt || st.verification.optionalPrompt)) {
          promptText = st.verification.prompt || st.verification.optionalPrompt;
          break;
        } else if (st.prompt) {
          promptText = st.prompt;
          break;
        }
      }
    }

    if (promptEl) {
      promptEl.textContent = isRequired ? `${promptText} (Required)` : `${promptText} (Optional)`;
    }

    if (inputEl) {
      inputEl.placeholder = isRequired ? 'Write your reflection here...' : 'Optional: Write a thought, or submit directly to complete...';
    }

    if (submitBtn) {
      const span = submitBtn.querySelector('span') || submitBtn;
      span.textContent = isRequired ? 'RECORD IN JOURNEY & CLAIM REWARDS' : 'CONFIRM COMPLETION & CLAIM REWARDS';
    }

    const ref = document.getElementById('reflection-modal');
    if (ref) ref.classList.remove('hidden');
  }

  function grantQuestRewards(questId) {
    if (!state.questProgress[questId]) {
      state.questProgress[questId] = { status: 'COMPLETED', currentStepIndex: 0, rewardClaimed: false };
    }
    const prog = state.questProgress[questId];
    if (prog.rewardClaimed) {
      console.warn(`Reward for quest ${questId} already claimed. Skipping duplicate grant.`);
      return;
    }
    prog.rewardClaimed = true;

    if (questId === 'Q-001') {
      state.rewardClaimed = true;
    }

    const quest = getQuest(questId);
    if (!quest || !quest.rewards) return;

    // 1. Life Points (Participation / reward currency)
    const lpVal = (typeof quest.rewards.lp === 'number') ? quest.rewards.lp :
                  (typeof quest.rewards.lifePoints === 'number') ? quest.rewards.lifePoints : 0;
    state.lp += lpVal;

    // 2. Character XP (Game progression)
    const xpVal = (typeof quest.rewards.charXp === 'number') ? quest.rewards.charXp :
                  (typeof quest.rewards.characterXp === 'number') ? quest.rewards.characterXp :
                  (typeof quest.rewards.xp === 'number') ? quest.rewards.xp : 0;
    state.charXp = (state.charXp || 0) + xpVal;
    state.xp = (state.xp || 0) + xpVal;

    // 3. Growth Area XP / Skills
    state.growthAreas = state.growthAreas || { stewardship: 0, responsibility: 0, service: 0, reflection: 0, discipline: 0, teamwork: 0 };
    state.skills = state.skills || {};

    if (quest.rewards.skills && typeof quest.rewards.skills === 'object') {
      for (const [sName, sVal] of Object.entries(quest.rewards.skills)) {
        if (typeof sVal === 'number') {
          state.growthAreas[sName] = (state.growthAreas[sName] || 0) + sVal;
          state.skills[sName] = (state.skills[sName] || 0) + sVal;
        }
      }
    } else {
      if (typeof quest.rewards.stewardshipXp === 'number') {
        state.growthAreas.stewardship = (state.growthAreas.stewardship || 0) + quest.rewards.stewardshipXp;
        state.skills.stewardship = (state.skills.stewardship || 0) + quest.rewards.stewardshipXp;
      }
      if (typeof quest.rewards.responsibilityXp === 'number') {
        state.growthAreas.responsibility = (state.growthAreas.responsibility || 0) + quest.rewards.responsibilityXp;
        state.skills.responsibility = (state.skills.responsibility || 0) + quest.rewards.responsibilityXp;
      }
      if (typeof quest.rewards.serviceXp === 'number') {
        state.growthAreas.service = (state.growthAreas.service || 0) + quest.rewards.serviceXp;
        state.skills.service = (state.skills.service || 0) + quest.rewards.serviceXp;
      }
      if (typeof quest.rewards.reflectionXp === 'number') {
        state.growthAreas.reflection = (state.growthAreas.reflection || 0) + quest.rewards.reflectionXp;
        state.skills.reflection = (state.skills.reflection || 0) + quest.rewards.reflectionXp;
      }
    }

    // 3.5 Mark Quest Completed and Apply World Effects
    if (state.questProgress[questId]) {
      state.questProgress[questId].status = 'COMPLETED';
      state.questProgress[questId].completedAt = new Date().toISOString();
    }
    if (questId === 'Q-001') {
      state.questStatus = 'completed';
    }
    if (quest.worldEffects) {
      applyWorldEffects(quest.worldEffects);
    }
    syncUnlockedPlaces();

    // 4. Character Progression & Level Evaluation
    const oldLevel = state.charLevel || 1;
    const progResult = evaluateCharacterProgression(`quest_${questId}`);
    if (progResult && progResult.leveledUp) {
      pendingLevelUpCelebration = progResult;
      state.levelUpHistory = state.levelUpHistory || [];
      state.levelUpHistory.push({
        fromLevel: oldLevel,
        toLevel: progResult.newLevel,
        sourceQuestId: questId,
        timestamp: new Date().toISOString()
      });
    }

    // Toast newly unlocked milestones
    if (progResult && Array.isArray(progResult.newlyUnlockedMilestones)) {
      progResult.newlyUnlockedMilestones.forEach(m => {
        showToast(`🏆 Milestone Unlocked: ${m.title}`);
      });
    }

    updateCharacterProgressDisplays();
  }

  function applyWorldEffects(effects) {
    if (!effects) return;
    if (Array.isArray(effects)) {
      for (const eff of effects) {
        if (!eff || !eff.type) continue;
        if (eff.type === 'GARDEN_STATE') {
          state.gardenState = eff.value;
          if (eff.value === 'lush') state.gardenLush = true;
        } else if (eff.type === 'GATE_STATE') {
          state.gateOpen = Boolean(eff.open);
          initCollisionGrid();
        } else if (eff.type === 'UNLOCK_PLACE') {
          state.fogCenterUnlocked = true;
          if (!state.unlockedPlaces.includes(eff.placeId)) {
            state.unlockedPlaces.push(eff.placeId);
          }
          if (PLACES[eff.placeId]) {
            PLACES[eff.placeId].unlocked = true;
          }
        } else if (eff.type === 'SET_FLAG') {
          state[eff.flag] = eff.value;
          if (eff.flag === 'gardenState' && eff.value === 'lush') {
            state.gardenLush = true;
          }
          if (eff.flag === 'gateOpen' && eff.value) {
            initCollisionGrid();
          }
        }
      }
    }
  }

  function getBarnabyDialogue() {
    evaluateQuestAvailability();
    const q1Prog = state.questProgress['Q-001'] || { status: 'AVAILABLE' };
    const q2Prog = state.questProgress['Q-002'] || { status: 'LOCKED' };
    if (q1Prog.status === 'AVAILABLE') {
      return { speaker: 'Uncle Barnaby', role: 'Garden Mentor', title: 'Steward of the Garden', text: '"Peace be with you, Alex! The plants on our veranda are looking thirsty today. Faithful stewardship begins at home in small, quiet chores."' };
    } else if (q1Prog.status === 'ACCEPTED' || q1Prog.status === 'REAL_WORLD') {
      return { speaker: 'Uncle Barnaby', role: 'Garden Mentor', title: 'Steward of the Garden', text: '"Remember, Alex: real stewardship isn\'t finished on this screen. Step outside, water those living plants, and come back when you\'re done!"' };
    } else if (q1Prog.status === 'RETURNED' || q1Prog.status === 'VERIFYING') {
      return { speaker: 'Uncle Barnaby', role: 'Garden Mentor', title: 'Steward of the Garden', text: '"Welcome back inside, Alex! Let\'s verify your garden stewardship and record your reflection."' };
    } else if (q2Prog.status === 'AVAILABLE') {
      return { speaker: 'Uncle Barnaby', role: 'Family Mentor', title: 'Light at Home', text: '"Peace be with you, Alex! A faithful heart serves quietly where no one is looking. Would you bring light and order to our home today?"' };
    } else if (q2Prog.status === 'ACCEPTED' || q2Prog.status === 'REAL_WORLD') {
      return { speaker: 'Uncle Barnaby', role: 'Family Mentor', title: 'Light at Home', text: '"Diligence in small household duties honors God and blesses your whole family. Tidy up a common room or wash dishes, then return!"' };
    } else {
      return { speaker: 'Uncle Barnaby', role: 'Elder Mentor', title: 'Garden Flourishing', text: '"Glory to God! Look how lush and vibrant our garden is now. Because you were faithful in these duties, the perimeter gate is unlocked. Walk south to visit the FOG Community Center!"' };
    }
  }

  function getGraceDialogue() {
    evaluateQuestAvailability();
    const q3Prog = state.questProgress['Q-003'] || { status: 'LOCKED' };
    if (q3Prog.status === 'AVAILABLE') {
      return { speaker: 'Sister Grace', role: 'Welcome Coordinator', title: 'A Quiet Moment', text: '"Welcome to Fire of God Community Center, Alex! In the midst of fellowship and active service, quiet prayer anchors our hearts. Would you take a quiet moment today?"' };
    } else if (q3Prog.status === 'ACCEPTED' || q3Prog.status === 'REAL_WORLD') {
      return { speaker: 'Sister Grace', role: 'Welcome Coordinator', title: 'A Quiet Moment', text: '"Take three unhurried minutes in quiet reflection, Alex. Stillness in God\'s presence is never wasted time."' };
    } else if (q3Prog.status === 'RETURNED' || q3Prog.status === 'VERIFYING') {
      return { speaker: 'Sister Grace', role: 'Welcome Coordinator', title: 'A Quiet Moment', text: '"Welcome back from your stillness, Alex. What peace or truth did you receive in prayer?"' };
    } else {
      return { speaker: 'Sister Grace', role: 'Welcome Coordinator', title: 'Community Fellowship', text: '"Welcome to Fire of God Community Center, Alex! In our church community, every small act of diligence strengthens our fellowship."' };
    }
  }

  function submitReflection() {
    const questId = state.trackedQuestId || 'Q-001';
    const quest = getQuest(questId);
    const refInput = document.getElementById('reflection-input');
    const reflectionText = (refInput && refInput.value) ? refInput.value.trim() : '';

    const verifyType = quest?.verification?.type || 'TRUST';
    const isRequired = Boolean(quest?.verification?.requiresReflection || verifyType === 'TRUST_PLUS_REFLECTION' || verifyType === 'REFLECTION');

    if (isRequired && !reflectionText) {
      showToast('Please write a brief reflection note to complete this calling.');
      return false;
    }

    if (state.questProgress[questId]) {
      state.questProgress[questId].reflectionText = reflectionText;
    }
    state.reflectionText = reflectionText;

    const refModal = document.getElementById('reflection-modal');
    if (refModal) refModal.classList.add('hidden');

    // Grant rewards with idempotency
    grantQuestRewards(questId);

    // Apply world effects
    if (quest && quest.worldEffects) {
      applyWorldEffects(quest.worldEffects);
    }

    if (state.questProgress[questId]) {
      state.questProgress[questId].status = 'COMPLETED';
      state.questProgress[questId].completedAt = new Date().toISOString();
    }

    if (questId === 'Q-001') {
      state.questStatus = 'completed';
      state.currentObjective = 'Walk through the South Gate to visit FOG Community Center';
    } else if (questId === 'Q-002') {
      state.currentObjective = 'Visit FOG Community Center and talk with Sister Grace';
    } else if (questId === 'Q-003') {
      state.currentObjective = 'Explore FOG Community Center and read the Notice Board';
    } else {
      state.currentObjective = `Completed ${quest ? quest.title : 'Quest'}!`;
    }

    // Re-evaluate quest availability for newly unlocked quests
    evaluateQuestAvailability();

    // Auto-advance tracked quest if there is a newly available quest
    const nextAvail = QUESTS.find(q => state.questProgress[q.id]?.status === 'AVAILABLE');
    if (nextAvail) {
      state.trackedQuestId = nextAvail.id;
    }

    updateLpDisplay();
    updateSkillDisplays();
    updateObjectiveDisplay();
    updatePlaceUiDisplays();
    saveToStorage(`reward_grant_${questId}`);

    // Populate Celebration Modal
    const rewardModal = document.getElementById('reward-modal');
    const rewardHeadline = document.getElementById('reward-headline');
    const rewardDesc = document.getElementById('reward-desc');
    const rewardLpNum = document.getElementById('reward-lp-num');
    const rewardLpTotal = document.getElementById('reward-lp-total');
    const rewardGrid = document.getElementById('reward-grid');

    if (rewardHeadline) {
      rewardHeadline.textContent = (quest && quest.dialogue?.completed) ? 'CALLING COMPLETED!' : 'YOUR WORLD GREW.';
    }
    if (rewardDesc && quest) {
      rewardDesc.textContent = `Because you completed "${quest.title}", your character and virtual world flourished!`;
    }
    if (rewardLpNum && quest) {
      rewardLpNum.textContent = `+${quest.rewards.lp} LP`;
    }
    if (rewardLpTotal) {
      rewardLpTotal.textContent = `(${state.lp} Total)`;
    }

    if (rewardGrid && quest) {
      let gridHtml = `
        <div class="team-chip">
          <span class="team-chip-title">Life Points</span>
          <span class="team-chip-score">+${quest.rewards.lp} LP</span>
          <span style="font-size: 0.65rem; color: var(--brand-charcoal); opacity: 0.7;">(${state.lp} Total)</span>
        </div>
        <div class="team-chip">
          <span class="team-chip-title">Character XP</span>
          <span class="team-chip-score" style="color: var(--brand-fire-orange);">+${quest.rewards.charXp || 5} XP</span>
          <span style="font-size: 0.65rem; color: var(--brand-charcoal); opacity: 0.7;">(Level ${state.charLevel})</span>
        </div>
      `;
      if (quest.rewards.skills) {
        for (const [k, v] of Object.entries(quest.rewards.skills)) {
          const capName = k.charAt(0).toUpperCase() + k.slice(1);
          gridHtml += `
            <div class="team-chip">
              <span class="team-chip-title">${capName}</span>
              <span class="team-chip-score" style="color: var(--accent-success);">+${v} XP</span>
              <span style="font-size: 0.65rem; color: var(--brand-charcoal); opacity: 0.7;">(${state.skills[k] || 0} XP)</span>
            </div>
          `;
        }
      }
      rewardGrid.innerHTML = gridHtml;
    }

    if (rewardModal) rewardModal.classList.remove('hidden');
    playBellSound();
    return true;
  }

  function closeRewardScreen() {
    const rewardModal = document.getElementById('reward-modal');
    if (rewardModal) rewardModal.classList.add('hidden');
    showToast('✨ Quest Completed! Rewards Claimed!');

    if (pendingLevelUpCelebration) {
      const evt = pendingLevelUpCelebration;
      pendingLevelUpCelebration = null;
      setTimeout(() => {
        openLevelUpModal(evt);
      }, 150);
    }
  }

  // ============================================================
  // 14. CHARACTER GROWTH & RPG PROGRESSION ENGINE (PHASE 0.15)
  // ============================================================
  function getProgressionData() {
    if (typeof window !== 'undefined' && window.KOINONIA_DATA) {
      return window.KOINONIA_DATA;
    }
    if (typeof KOINONIA_DATA !== 'undefined') {
      return KOINONIA_DATA;
    }
    if (typeof global !== 'undefined' && global.KOINONIA_DATA) {
      return global.KOINONIA_DATA;
    }
    return null;
  }

  function evaluateCharacterProgression(reason = 'update') {
    const pData = getProgressionData();
    const oldLevel = state.charLevel || 1;
    const currentXp = state.charXp || 0;

    let calculatedLevel = 1;
    if (pData && typeof pData.calculateLevelFromXp === 'function') {
      calculatedLevel = pData.calculateLevelFromXp(currentXp);
    } else {
      if (currentXp >= 70) calculatedLevel = 5;
      else if (currentXp >= 45) calculatedLevel = 4;
      else if (currentXp >= 25) calculatedLevel = 3;
      else if (currentXp >= 10) calculatedLevel = 2;
      else calculatedLevel = 1;
    }

    const levelDef = (pData && typeof pData.getLevelDef === 'function')
      ? pData.getLevelDef(calculatedLevel)
      : { level: calculatedLevel, title: 'Adventurer', unlockedPerk: 'Journey growth' };

    state.highestLevelReached = Math.max(state.highestLevelReached || 1, calculatedLevel);

    // Update Growth Area Ranks
    state.growthAreas = state.growthAreas || { stewardship: 0, responsibility: 0, service: 0, reflection: 0, discipline: 0, teamwork: 0 };
    state.growthAreaRanks = state.growthAreaRanks || {};
    const growthKeys = (pData?.GROWTH_AREAS || pData?.growthAreas) ? Object.keys(pData.GROWTH_AREAS || pData.growthAreas) : ['stewardship', 'responsibility', 'service', 'reflection', 'discipline', 'teamwork'];
    for (const areaKey of growthKeys) {
      const areaXp = (state.growthAreas && state.growthAreas[areaKey] !== undefined) ? state.growthAreas[areaKey] : (state.skills && state.skills[areaKey] !== undefined ? state.skills[areaKey] : 0);
      const rank = pData?.getGrowthRank ? pData.getGrowthRank(areaXp) : null;
      state.growthAreaRanks[areaKey] = rank ? rank.rankName : (areaXp >= 10 ? 'Growing' : 'Beginning');
    }

    // Check level up and update state.charLevel
    const leveledUp = calculatedLevel > oldLevel;
    state.charLevel = calculatedLevel;

    // Collect all unlocked perks up to current level
    state.unlockedPerks = state.unlockedPerks || [];
    const levelsList = (pData && (pData.CHARACTER_LEVELS || pData.characterLevels)) || [];
    if (levelsList.length > 0) {
      levelsList.forEach(l => {
        if (calculatedLevel >= l.level && l.unlockedPerk && !state.unlockedPerks.includes(l.unlockedPerk)) {
          state.unlockedPerks.push(l.unlockedPerk);
        }
      });
    } else if (levelDef?.unlockedPerk && !state.unlockedPerks.includes(levelDef.unlockedPerk)) {
      state.unlockedPerks.push(levelDef.unlockedPerk);
    }

    // Evaluate Milestones
    let newlyUnlockedMilestones = [];
    if (pData && typeof pData.evaluateGrowthMilestones === 'function') {
      newlyUnlockedMilestones = pData.evaluateGrowthMilestones(state);
    }

    return {
      leveledUp,
      oldLevel,
      newLevel: calculatedLevel,
      levelDef,
      newlyUnlockedMilestones,
      reason
    };
  }

  function updateCharacterProgressDisplays() {
    const pData = getProgressionData();
    const lvl = state.charLevel || 1;
    const xp = state.charXp || 0;
    const levelDef = (pData && typeof pData.getLevelDef === 'function')
      ? pData.getLevelDef(lvl)
      : { level: lvl, title: lvl === 1 ? 'New Explorer' : 'Active Explorer' };
    const progress = (pData && typeof pData.getCurrentLevelProgress === 'function')
      ? pData.getCurrentLevelProgress(xp)
      : { currentLevelXp: xp, nextLevelXp: 10, xpRemaining: Math.max(0, 10 - xp), percentInLevel: Math.min(100, xp * 10), isMaxLevel: false, totalXp: xp };

    if (typeof document === 'undefined') return;

    // 1. Header Level Pill
    const headerLevelText = document.getElementById('header-level-text');
    if (headerLevelText) headerLevelText.textContent = `Lv. ${lvl}`;

    // 2. In-canvas floating HUD badge
    const canvasLevelLabel = document.getElementById('canvas-level-label');
    if (canvasLevelLabel) canvasLevelLabel.textContent = `Lv. ${lvl}`;

    // 3. Portrait home view RPG card
    const portraitLevelTitle = document.getElementById('portrait-character-level-title');
    if (portraitLevelTitle) portraitLevelTitle.textContent = `Level ${lvl} • ${levelDef.title}`;

    const portraitXpText = document.getElementById('portrait-character-xp-text');
    if (portraitXpText) {
      portraitXpText.textContent = progress.isMaxLevel ? `${progress.totalXp} XP (Max)` : `${progress.totalXp} / ${progress.nextLevelXp} XP`;
    }

    const portraitXpBar = document.getElementById('portrait-character-xp-bar');
    if (portraitXpBar) portraitXpBar.style.width = `${progress.percentInLevel}%`;

    // 4. Me Modal character card
    const meLevelTitle = document.getElementById('me-char-level-title');
    if (meLevelTitle) meLevelTitle.textContent = `Level ${lvl} • ${levelDef.title}`;

    const mePerkBadge = document.getElementById('me-char-perk-badge');
    if (mePerkBadge) {
      mePerkBadge.textContent = levelDef.unlockedPerk || 'Journey Journal Started';
      mePerkBadge.title = `Current Level Perk: ${levelDef.unlockedPerk || 'Journey Journal Started'}`;
    }

    const meXpLabel = document.getElementById('me-char-xp-label');
    if (meXpLabel) {
      meXpLabel.textContent = progress.isMaxLevel ? `${progress.totalXp} XP (Max Level)` : `${progress.totalXp} / ${progress.nextLevelXp} XP (${progress.xpRemaining} XP to next)`;
    }

    const meXpNext = document.getElementById('me-char-xp-next');
    if (meXpNext) {
      meXpNext.textContent = progress.isMaxLevel ? 'Max Level' : `Next Level: ${progress.nextLevelXp} XP`;
    }

    const meXpBar = document.getElementById('me-char-xp-bar');
    if (meXpBar) meXpBar.style.width = `${progress.percentInLevel}%`;

    const meLp = document.getElementById('me-char-lp');
    if (meLp) meLp.textContent = `${state.lp} LP`;
  }

  function renderGrowthAreas() {
    if (typeof document === 'undefined') return;
    const pData = getProgressionData();
    const container = document.getElementById('profile-growth-grid');
    const growthCatalog = (pData && (pData.GROWTH_AREAS || pData.growthAreas));
    if (!container || !growthCatalog) return;

    let html = '';
    for (const [key, area] of Object.entries(growthCatalog)) {
      const areaXp = (state.growthAreas && state.growthAreas[key] !== undefined)
        ? state.growthAreas[key]
        : ((state.skills && state.skills[key] !== undefined) ? state.skills[key] : 0);
      const rankInfo = pData.getGrowthRank ? pData.getGrowthRank(areaXp) : { rankName: 'Beginning', nextRankXp: 10, percent: 0 };
      const rankName = rankInfo.rankName || 'Beginning';
      const rankClass = 'rank-' + rankName.toLowerCase();

      html += `
        <div class="growth-card">
          <div class="growth-card-header">
            <div class="growth-card-title-wrap">
              <span class="growth-card-icon">${area.icon || '🌱'}</span>
              <div>
                <div class="growth-card-title">${area.name}</div>
                <div class="growth-card-domain">Real-World Growth Area</div>
              </div>
            </div>
            <span class="growth-rank-chip ${rankClass}">${rankName}</span>
          </div>
          <div class="growth-card-desc">${area.description || ''}</div>
          <div class="growth-card-progress-row">
            <span>XP: <strong>${areaXp}</strong></span>
            <span>${rankInfo.isMaxRank ? 'Max Rank' : `Next: ${rankInfo.nextRankXp} XP`}</span>
          </div>
          <div class="growth-progress-bar-wrap">
            <div class="growth-progress-bar-fill" style="width: ${rankInfo.percent}%;"></div>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  function renderMilestones() {
    if (typeof document === 'undefined') return;
    const pData = getProgressionData();
    const container = document.getElementById('profile-milestones-list');
    const milestoneCatalog = (pData && (pData.MILESTONES || pData.milestones)) || [];
    if (!container || milestoneCatalog.length === 0) return;

    let html = '';
    milestoneCatalog.forEach(m => {
      const isUnlocked = Boolean(
        (Array.isArray(state.unlockedMilestones) && state.unlockedMilestones.includes(m.id)) ||
        (state.milestones && state.milestones[m.id]?.unlocked)
      );
      const unlockedDate = state.milestones && state.milestones[m.id]?.unlockedAt;
      const dateStr = unlockedDate ? new Date(unlockedDate).toLocaleDateString() : '';

      html += `
        <div class="milestone-item ${isUnlocked ? 'unlocked' : 'locked'}">
          <div class="milestone-icon">${m.icon}</div>
          <div class="milestone-info">
            <div class="milestone-title-row">
              <span class="milestone-title">${m.title}</span>
              <span class="milestone-tag">${m.category}</span>
            </div>
            <div class="milestone-desc">${m.description}</div>
            ${isUnlocked ? `<div class="milestone-unlocked-date">✓ Unlocked${dateStr ? ' ' + dateStr : ''}</div>` : '<div class="milestone-locked-text">🔒 Locked</div>'}
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  function renderJourneySummary() {
    if (typeof document === 'undefined') return;
    const pData = getProgressionData();
    const container = document.getElementById('profile-summary-stats');
    if (!container) return;

    const lvl = state.charLevel || 1;
    const levelDef = (pData && pData.getLevelDef) ? pData.getLevelDef(lvl) : { title: 'New Explorer' };
    const xp = state.charXp || 0;
    const completedCount = Object.values(state.questProgress || {}).filter(p => p.status === 'COMPLETED').length;
    const unlockedMilestonesCount = Array.isArray(state.unlockedMilestones) ? state.unlockedMilestones.length : 0;
    const milestoneCatalog = (pData && (pData.MILESTONES || pData.milestones)) || [];
    const totalMilestonesCount = milestoneCatalog.length > 0 ? milestoneCatalog.length : unlockedMilestonesCount;

    let activeAreas = 0;
    const growthKeys = (pData?.GROWTH_AREAS || pData?.growthAreas) ? Object.keys(pData.GROWTH_AREAS || pData.growthAreas) : ['stewardship', 'responsibility', 'service', 'reflection', 'discipline', 'teamwork'];
    for (const k of growthKeys) {
      const areaXp = (state.growthAreas && state.growthAreas[k] !== undefined) ? state.growthAreas[k] : (state.skills && state.skills[k] || 0);
      if (areaXp > 0) activeAreas++;
    }

    const visitedPlacesCount = Array.isArray(state.visitedPlaces) ? state.visitedPlaces.length : Object.keys(state.visitedPlaces || {}).length;
    const placesCatalogData = (pData && pData.places) || (typeof PLACES !== 'undefined' ? PLACES : null);
    const totalPlacesCount = placesCatalogData ? Object.values(placesCatalogData).filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx).length : 5;

    container.innerHTML = `
      <div class="summary-metric-card">
        <div class="summary-metric-label">CHARACTER LEVEL</div>
        <div class="summary-metric-value" style="color: var(--brand-fire-orange);">Lv. ${lvl}</div>
        <div class="summary-metric-sub">${levelDef.title}</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">TOTAL CHARACTER XP</div>
        <div class="summary-metric-value" style="color: var(--brand-burgundy);">${xp} XP</div>
        <div class="summary-metric-sub">RPG Journey Growth</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">LIFE POINTS BALANCE</div>
        <div class="summary-metric-value" style="color: var(--accent-success);">${state.lp} LP</div>
        <div class="summary-metric-sub">Participation Currency</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">CALLINGS COMPLETED</div>
        <div class="summary-metric-value" style="color: var(--brand-flame-gold);">${completedCount}</div>
        <div class="summary-metric-sub">Real-World Actions</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">GROWTH AREAS ACTIVE</div>
        <div class="summary-metric-value" style="color: var(--brand-burgundy);">${activeAreas} / 6</div>
        <div class="summary-metric-sub">Practiced Habits</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">MILESTONES UNLOCKED</div>
        <div class="summary-metric-value" style="color: var(--brand-fire-orange);">${unlockedMilestonesCount} / ${totalMilestonesCount}</div>
        <div class="summary-metric-sub">Achievements</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">PLACES DISCOVERED</div>
        <div class="summary-metric-value" style="color: var(--brand-fire-orange);">${visitedPlacesCount} / ${totalPlacesCount}</div>
        <div class="summary-metric-sub">World Locations</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">HIGHEST LEVEL REACHED</div>
        <div class="summary-metric-value" style="color: var(--brand-burgundy);">Level ${state.highestLevelReached || lvl}</div>
        <div class="summary-metric-sub">Journey Peak</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">FIT QUESTS COMPLETED</div>
        <div class="summary-metric-value" style="color: var(--brand-flame-gold);">${state.fitQuestMetrics?.completedCount || Object.keys(state.fitQuestRewardClaims || {}).length}</div>
        <div class="summary-metric-sub">Physical Stewardship</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">PERSONAL BESTS</div>
        <div class="summary-metric-value" style="color: var(--brand-fire-orange);">${state.fitQuestMetrics?.personalBestsCount || Object.keys(state.personalBests || {}).length}</div>
        <div class="summary-metric-sub">Self-Improvement Records</div>
      </div>
      <div class="summary-metric-card">
        <div class="summary-metric-label">SPORTS EXPLORED</div>
        <div class="summary-metric-value" style="color: var(--brand-burgundy);">${(state.sportsExplored || []).length} / 5</div>
        <div class="summary-metric-sub">Disciplines Tried</div>
      </div>
    `;
  }

  function openLevelUpModal(levelUpEvent) {
    if (!levelUpEvent || typeof document === 'undefined') return;
    const modal = document.getElementById('level-up-modal');
    if (!modal) return;

    const numEl = document.getElementById('level-up-number');
    const titleEl = document.getElementById('level-up-title');
    const perkEl = document.getElementById('level-up-perk-text');

    if (numEl) numEl.textContent = `Level ${levelUpEvent.newLevel}`;
    if (titleEl) titleEl.textContent = levelUpEvent.levelDef?.title || 'Adventurer';
    if (perkEl) perkEl.textContent = levelUpEvent.levelDef?.unlockedPerk || 'New journeys and community opportunities unlocked!';

    modal.classList.remove('hidden');
    playBellSound();
  }

  function closeLevelUpModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('level-up-modal');
    if (modal) modal.classList.add('hidden');
    showToast(`⭐ Embraced Level ${state.charLevel}!`);
  }

  function switchProfileTab(tabId) {
    if (typeof document === 'undefined') return;
    const tabs = ['growth', 'milestones', 'summary', 'activities'];
    tabs.forEach(t => {
      const btn = document.getElementById(`profile-tab-${t}`);
      const pane = document.getElementById(`profile-pane-${t}`);
      if (btn) {
        if (t === tabId) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (pane) {
        if (t === tabId) pane.style.display = 'block';
        else pane.style.display = 'none';
      }
    });

    if (tabId === 'growth') renderGrowthAreas();
    else if (tabId === 'milestones') renderMilestones();
    else if (tabId === 'summary') renderJourneySummary();
  }

  // ============================================================
  // 15. UI SYNC & HUD QUEST TRACKER
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
    const serv = document.getElementById('dt-service-xp');
    const refl = document.getElementById('dt-reflection-xp');
    if (stew) stew.textContent = `${state.skills.stewardship || 0} XP`;
    if (resp) resp.textContent = `${state.skills.responsibility || 0} XP`;
    if (serv) serv.textContent = `${state.skills.service || 0} XP`;
    if (refl) refl.textContent = `${state.skills.reflection || 0} XP`;

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

    const trackedQ = getQuest(state.trackedQuestId);
    const prog = (state.questProgress && state.questProgress[state.trackedQuestId]) || null;

    if (prog && prog.status === 'AVAILABLE') {
      if (chipTag) chipTag.textContent = 'AVAILABLE CALLING';
      if (chipTitle) chipTitle.textContent = state.currentObjective || (trackedQ ? `Talk to ${trackedQ.giverName || 'Elder'}` : 'New Calling');
      if (chipIcon) chipIcon.textContent = trackedQ?.icon || '🌱';
    } else if (prog && (prog.status === 'ACCEPTED' || prog.status === 'REAL_WORLD')) {
      if (chipTag) chipTag.textContent = 'REAL-WORLD TASK';
      if (chipTitle) chipTitle.textContent = trackedQ?.realWorldAction || 'Task in Progress';
      if (chipIcon) chipIcon.textContent = '⏳';
    } else if (prog && (prog.status === 'RETURNED' || prog.status === 'VERIFYING')) {
      if (chipTag) chipTag.textContent = 'READY TO REFLECT';
      if (chipTitle) chipTitle.textContent = 'Record Calling Reflection';
      if (chipIcon) chipIcon.textContent = '📝';
    } else if (prog && prog.status === 'COMPLETED' && !state.visitedFogCenter) {
      if (chipTag) chipTag.textContent = 'NEXT OBJECTIVE';
      if (chipTitle) chipTitle.textContent = 'Visit FOG Community Center';
      if (chipIcon) chipIcon.textContent = '⛪';
    } else if (prog && prog.status === 'COMPLETED') {
      if (chipTag) chipTag.textContent = 'CALLING COMPLETED';
      if (chipTitle) chipTitle.textContent = state.currentObjective || `${trackedQ?.title || 'Quest'} Finished`;
      if (chipIcon) chipIcon.textContent = '✨';
    } else {
      if (chipTag) chipTag.textContent = 'COMMUNITY MISSION';
      if (chipTitle) chipTitle.textContent = state.currentObjective || 'Explore Community';
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

    // Immediate Home Play Card quest synchronization
    const homeQuestBoxTag = document.querySelector('.play-card-quest-tag');
    const homeQuestTitle = document.getElementById('portrait-quest-title');
    const homeQuestDesc = document.getElementById('portrait-quest-desc');
    const homeStatVirtue = document.getElementById('portrait-stat-virtue');

    const trackedQ = getQuest(state.trackedQuestId) || getQuest('Q-001');
    const prog = (state.questProgress && state.questProgress[state.trackedQuestId]) ||
                 (state.questProgress && state.questProgress['Q-001']) || {};

    if (prog.status === 'COMPLETED') {
      if (homeQuestBoxTag) homeQuestBoxTag.textContent = 'CALLING COMPLETED';
      if (homeQuestTitle) homeQuestTitle.textContent = `${trackedQ ? trackedQ.icon : '🌱'} ${trackedQ ? trackedQ.title : 'Quest'} Completed!`;
      if (homeQuestDesc) homeQuestDesc.textContent = trackedQ?.id === 'Q-001'
        ? 'You tended living creation at home. Your garden is lush and the perimeter gate is open to FOG Center!'
        : `You completed "${trackedQ?.title}". Your fellowship and virtual community grow!`;
      if (homeStatVirtue) homeStatVirtue.textContent = trackedQ?.categoryTitle || 'Stewardship';
    } else if (prog.status === 'ACCEPTED' || prog.status === 'REAL_WORLD') {
      if (homeQuestBoxTag) homeQuestBoxTag.textContent = 'IN PROGRESS (REAL WORLD)';
      if (homeQuestTitle) homeQuestTitle.textContent = `${trackedQ ? trackedQ.icon : '🌱'} ${trackedQ ? trackedQ.title : 'Calling'}`;
      if (homeQuestDesc) homeQuestDesc.textContent = `Mission in the real world: ${trackedQ?.realWorldAction || 'Complete task, then return.'}`;
      if (homeStatVirtue) homeStatVirtue.textContent = 'Action';
    } else {
      if (homeQuestBoxTag) homeQuestBoxTag.textContent = 'ACTIVE REAL-WORLD CALLING';
      if (homeQuestTitle) homeQuestTitle.textContent = `${trackedQ ? trackedQ.icon : '🌱'} ${trackedQ ? trackedQ.title : 'Steward of the Garden'}`;
      if (homeQuestDesc) homeQuestDesc.textContent = trackedQ?.summary || 'Water the potted plants at home to care for living creation.';
      if (homeStatVirtue) homeStatVirtue.textContent = trackedQ?.categoryTitle || 'Stewardship';
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
  // 15. LOCAL SAVE & RESTORE ENGINE (koinonia.phase14.save)
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
        saveStorageKey: SAVE_STORAGE_KEY,
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
        highestLevelReached: state.highestLevelReached || state.charLevel || 1,
        levelUpHistory: state.levelUpHistory || [],
        growthAreas: state.growthAreas || {},
        skills: {
          stewardship: (state.growthAreas && state.growthAreas.stewardship !== undefined) ? state.growthAreas.stewardship : (state.skills.stewardship || 0),
          responsibility: (state.growthAreas && state.growthAreas.responsibility !== undefined) ? state.growthAreas.responsibility : (state.skills.responsibility || 0),
          discipline: (state.growthAreas && state.growthAreas.discipline !== undefined) ? state.growthAreas.discipline : (state.skills.discipline || 0),
          teamwork: (state.growthAreas && state.growthAreas.teamwork !== undefined) ? state.growthAreas.teamwork : (state.skills.teamwork || 0),
          service: (state.growthAreas && state.growthAreas.service !== undefined) ? state.growthAreas.service : (state.skills.service || 0),
          compassion: state.skills.compassion || 0,
          reflection: (state.growthAreas && state.growthAreas.reflection !== undefined) ? state.growthAreas.reflection : (state.skills.reflection || 0)
        },
        growthAreaRanks: state.growthAreaRanks || {},
        milestones: state.milestones || {},
        unlockedMilestones: state.unlockedMilestones || [],
        unlockedPerks: state.unlockedPerks || [],
        gardenState: state.gardenState,
        gardenLush: Boolean(state.gardenLush || (state.gardenState === 'lush')),
        gateOpen: state.gateOpen,
        fogCenterUnlocked: state.fogCenterUnlocked,
        visitedFogCenter: state.visitedFogCenter,
        visitedPlaces: Array.isArray(state.visitedPlaces) ? state.visitedPlaces : ['home'],
        firstVisitedAt: state.firstVisitedAt || { home: new Date().toISOString() },
        visitCount: state.visitCount || { home: 1 },
        unlockedPlaces: Array.from(new Set(state.unlockedPlaces || ['home'])),
        spokenToNpc: state.spokenToNpc || {},
        questStatus: state.questStatus,
        rewardClaimed: state.rewardClaimed,
        currentObjective: state.currentObjective,
        reflectionText: state.reflectionText,
        audioMuted: state.audioMuted,

        // Modular Quest Engine persistence
        trackedQuestId: state.trackedQuestId,
        questProgress: state.questProgress,

        // Phase 0.17: Campaigns & Events Engine
        campaignProgress: state.campaignProgress || {},
        activeCampaignIds: state.activeCampaignIds || [],
        completedCampaignIds: state.completedCampaignIds || [],
        eventParticipation: state.eventParticipation || [],
        completedEventInstances: state.completedEventInstances || [],
        eventsAttendedCount: state.eventsAttendedCount || 0,
        eventQuestProgress: state.eventQuestProgress || {},
        demoNow: state.demoNow || null,

        // Phase 0.18: Sports & Fit Quest Engine
        fitQuestResults: state.fitQuestResults || {},
        fitQuestHistory: state.fitQuestHistory || [],
        personalBests: state.personalBests || {},
        fitQuestRewardClaims: state.fitQuestRewardClaims || {},
        sportsExplored: state.sportsExplored || [],
        fitQuestMetrics: state.fitQuestMetrics || { completedCount: 0, personalBestsCount: 0, totalAttemptsCount: 0, sportsTriedCount: 0 },
        selectedChallengeId: state.selectedChallengeId || 'FQ-V001'
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
      state.storageMeta.trackedQuestId = state.trackedQuestId;
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

          // Strip reset=1 immediately via replaceState, preserving other params (?debug=1, ?v=0.14)
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
        evaluateQuestAvailability();
        return false;
      }

      const parsed = JSON.parse(raw);
      const isVersionMatch = parsed && (parsed.version === SAVE_VERSION || parsed.saveVersion === SAVE_VERSION || parsed.version === '0.18' || parsed.saveVersion === '0.18' || parsed.version === '0.17' || parsed.saveVersion === '0.17' || parsed.version === 1);
      if (!parsed || !isVersionMatch) {
        state.storageMeta.saveExists = true;
        state.storageMeta.loadResult = 'version_mismatch';
        evaluateQuestAvailability();
        return false;
      }

      state.storageMeta.saveExists = true;
      state.storageMeta.storedLP = parsed.lp;
      state.storageMeta.storedQuest = parsed.questStatus;
      state.storageMeta.storedGate = parsed.gateOpen;
      state.storageMeta.storedFogUnlock = parsed.fogCenterUnlocked;

      // Defensive Nested State Hydration & Place Validation
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
      else if (parsed.character && typeof parsed.character.lifePoints === 'number') state.lp = parsed.character.lifePoints;

      if (typeof parsed.charLevel === 'number') state.charLevel = parsed.charLevel;
      else if (parsed.character && typeof parsed.character.level === 'number') state.charLevel = parsed.character.level;

      if (typeof parsed.charXp === 'number') state.charXp = parsed.charXp;
      else if (parsed.character && typeof parsed.character.charXp === 'number') state.charXp = parsed.character.charXp;
      if (typeof parsed.highestLevelReached === 'number') state.highestLevelReached = parsed.highestLevelReached;
      else state.highestLevelReached = state.charLevel || 1;

      if (Array.isArray(parsed.levelUpHistory)) state.levelUpHistory = parsed.levelUpHistory;
      if (Array.isArray(parsed.unlockedMilestones)) state.unlockedMilestones = parsed.unlockedMilestones;
      if (Array.isArray(parsed.unlockedPerks)) state.unlockedPerks = parsed.unlockedPerks;
      if (parsed.milestones && typeof parsed.milestones === 'object') state.milestones = parsed.milestones;
      if (parsed.growthAreaRanks && typeof parsed.growthAreaRanks === 'object') state.growthAreaRanks = parsed.growthAreaRanks;

      state.growthAreas = state.growthAreas || { stewardship: 0, responsibility: 0, service: 0, reflection: 0, discipline: 0, teamwork: 0 };
      if (parsed.growthAreas && typeof parsed.growthAreas === 'object') {
        for (const [k, v] of Object.entries(parsed.growthAreas)) {
          if (typeof v === 'number') state.growthAreas[k] = v;
        }
      }

      if (parsed.skills && typeof parsed.skills === 'object') {
        state.skills.stewardship = typeof parsed.skills.stewardship === 'number' ? parsed.skills.stewardship : state.skills.stewardship;
        state.skills.responsibility = typeof parsed.skills.responsibility === 'number' ? parsed.skills.responsibility : state.skills.responsibility;
        state.skills.discipline = typeof parsed.skills.discipline === 'number' ? parsed.skills.discipline : state.skills.discipline;
        state.skills.teamwork = typeof parsed.skills.teamwork === 'number' ? parsed.skills.teamwork : state.skills.teamwork;
        state.skills.service = typeof parsed.skills.service === 'number' ? parsed.skills.service : state.skills.service;
        state.skills.compassion = typeof parsed.skills.compassion === 'number' ? parsed.skills.compassion : state.skills.compassion;
        state.skills.reflection = typeof parsed.skills.reflection === 'number' ? parsed.skills.reflection : (state.skills.reflection || 0);

        for (const [k, v] of Object.entries(state.skills)) {
          if (state.growthAreas[k] === undefined || state.growthAreas[k] === 0) {
            state.growthAreas[k] = v;
          }
        }
      }

      if (typeof parsed.gardenState === 'string') state.gardenState = parsed.gardenState;
      state.gardenLush = Boolean(parsed.gardenLush || (parsed.gardenState === 'lush'));
      if (typeof parsed.gateOpen === 'boolean') state.gateOpen = parsed.gateOpen;
      if (typeof parsed.fogCenterUnlocked === 'boolean') state.fogCenterUnlocked = parsed.fogCenterUnlocked;
      if (typeof parsed.visitedFogCenter === 'boolean') state.visitedFogCenter = parsed.visitedFogCenter;
      if (Array.isArray(parsed.visitedPlaces)) {
        state.visitedPlaces = Array.from(new Set(['home', ...parsed.visitedPlaces]));
      } else if (parsed.visitedPlaces && typeof parsed.visitedPlaces === 'object') {
        state.visitedPlaces = Array.from(new Set(['home', ...Object.keys(parsed.visitedPlaces).filter(k => parsed.visitedPlaces[k])]));
      } else {
        state.visitedPlaces = ['home'];
      }
      if (parsed.firstVisitedAt && typeof parsed.firstVisitedAt === 'object') {
        state.firstVisitedAt = parsed.firstVisitedAt;
      }
      if (parsed.visitCount && typeof parsed.visitCount === 'object') {
        state.visitCount = parsed.visitCount;
      }
      if (parsed.spokenToNpc && typeof parsed.spokenToNpc === 'object') {
        state.spokenToNpc = parsed.spokenToNpc;
      }
      if (state.visitedPlaces.includes('fog_center')) {
        state.visitedFogCenter = true;
      }
      if (Array.isArray(parsed.unlockedPlaces)) {
        state.unlockedPlaces = Array.from(new Set(['home', ...parsed.unlockedPlaces]));
      } else {
        syncUnlockedPlaces();
      }
      if (typeof parsed.questStatus === 'string') state.questStatus = parsed.questStatus;
      if (typeof parsed.rewardClaimed === 'boolean') state.rewardClaimed = parsed.rewardClaimed;
      if (typeof parsed.currentObjective === 'string') state.currentObjective = parsed.currentObjective;
      if (typeof parsed.reflectionText === 'string') state.reflectionText = parsed.reflectionText;
      if (typeof parsed.audioMuted === 'boolean') state.audioMuted = parsed.audioMuted;
      if (typeof parsed.isPlayingGame === 'boolean') state.isPlayingGame = parsed.isPlayingGame;
      if (parsed.timestamp) state.lastSaveTime = parsed.timestamp;

      // Modular Quest Engine hydration
      if (parsed.questProgress && typeof parsed.questProgress === 'object') {
        state.questProgress = parsed.questProgress;
      }
      if (typeof parsed.trackedQuestId === 'string') {
        state.trackedQuestId = parsed.trackedQuestId;
      }

      // Phase 0.17: Campaigns & Events Engine hydration
      if (parsed.campaignProgress && typeof parsed.campaignProgress === 'object') {
        state.campaignProgress = parsed.campaignProgress;
      }
      if (Array.isArray(parsed.activeCampaignIds)) state.activeCampaignIds = parsed.activeCampaignIds;
      if (Array.isArray(parsed.completedCampaignIds)) state.completedCampaignIds = parsed.completedCampaignIds;
      if (Array.isArray(parsed.eventParticipation)) state.eventParticipation = parsed.eventParticipation;
      if (Array.isArray(parsed.completedEventInstances)) state.completedEventInstances = parsed.completedEventInstances;
      if (typeof parsed.eventsAttendedCount === 'number') state.eventsAttendedCount = parsed.eventsAttendedCount;
      if (parsed.eventQuestProgress && typeof parsed.eventQuestProgress === 'object') {
        state.eventQuestProgress = parsed.eventQuestProgress;
      }
      if (typeof parsed.demoNow === 'string') state.demoNow = parsed.demoNow;

      // Phase 0.18: Sports & Fit Quest Engine hydration
      if (parsed.fitQuestResults && typeof parsed.fitQuestResults === 'object') {
        state.fitQuestResults = parsed.fitQuestResults;
      }
      if (Array.isArray(parsed.fitQuestHistory)) state.fitQuestHistory = parsed.fitQuestHistory;
      if (parsed.personalBests && typeof parsed.personalBests === 'object') {
        state.personalBests = parsed.personalBests;
      }
      if (parsed.fitQuestRewardClaims && typeof parsed.fitQuestRewardClaims === 'object') {
        state.fitQuestRewardClaims = parsed.fitQuestRewardClaims;
      }
      if (Array.isArray(parsed.sportsExplored)) state.sportsExplored = parsed.sportsExplored;
      if (parsed.fitQuestMetrics && typeof parsed.fitQuestMetrics === 'object') {
        state.fitQuestMetrics = parsed.fitQuestMetrics;
      }
      if (typeof parsed.selectedChallengeId === 'string') {
        state.selectedChallengeId = parsed.selectedChallengeId;
      }

      // Re-evaluate quest availability against loaded state
      evaluateQuestAvailability();

      // Re-evaluate progression state quietly without triggering level-up celebrations
      pendingLevelUpCelebration = null;
      evaluateCharacterProgression('storage_hydrate');
      updateCharacterProgressDisplays();

      // Sync places registry
      if (state.fogCenterUnlocked && PLACES.fog_center) {
        PLACES.fog_center.unlocked = true;
      }

      state.storageMeta.loadResult = 'success';
      state.storageMeta.lastLoadTime = new Date().toISOString();
      state.storageMeta.runtimeLP = state.lp;
      state.storageMeta.runtimeQuest = state.questStatus;
      state.storageMeta.runtimeGate = state.gateOpen;
      state.storageMeta.runtimeFogUnlock = state.fogCenterUnlocked;
      state.storageMeta.trackedQuestId = state.trackedQuestId;

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

    const mapModal = document.getElementById('world-map-modal');
    if (mapModal) mapModal.classList.add('hidden');
    const questsModal = document.getElementById('quests-tab-modal');
    if (questsModal) questsModal.classList.add('hidden');
    const journeyModal = document.getElementById('journey-modal');
    if (journeyModal) journeyModal.classList.add('hidden');
    const meModal = document.getElementById('me-modal');
    if (meModal) meModal.classList.add('hidden');

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
    evaluateQuestAvailability();
    syncUnlockedPlaces();
    const list = document.getElementById('world-places-list');
    if (list) {
      const placeKeys = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'];
      list.innerHTML = placeKeys.map(pId => {
        const p = PLACES[pId];
        if (!p) return '';
        const isCurrent = state.activePlaceId === p.id || (p.id === 'outreach_site' && state.activePlaceId === 'outreach');
        const availResult = evaluatePlaceAvailability(p.id, state);
        const isUnlocked = availResult.available;
        const isVisited = isPlaceVisited(p.id);

        let statusBadge = '';
        let statusColor = '';
        let badgeBg = '';

        if (isCurrent) {
          statusBadge = 'Current Location';
          statusColor = 'var(--brand-fire-orange)';
          badgeBg = 'rgba(235, 95, 18, 0.12)';
        } else if (isUnlocked && !isVisited) {
          statusBadge = 'New Place';
          statusColor = 'var(--brand-flame-gold)';
          badgeBg = 'rgba(253, 198, 63, 0.15)';
        } else if (isUnlocked) {
          statusBadge = 'Available';
          statusColor = 'var(--accent-success)';
          badgeBg = 'rgba(16, 185, 129, 0.12)';
        } else {
          statusBadge = 'Locked';
          statusColor = 'var(--brand-charcoal)';
          badgeBg = 'rgba(38, 34, 32, 0.08)';
        }

        const liveEvent = data.getLiveEventForPlace ? data.getLiveEventForPlace(p.id, getCurrentTime()) : null;
        const liveEventBadge = liveEvent ? `<span style="font-size: 0.65rem; font-weight: 800; background: #DC2626; color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🔥 LIVE GATHERING</span>` : '';
        const liveEventSubtitle = liveEvent ? `<div style="font-size: 0.70rem; color: #DC2626; font-weight: 700; margin-top: 2px;">🔴 Happening Now: ${liveEvent.title}</div>` : '';

        const fitQuestBadge = (p.id === 'sports_hub' && isUnlocked && !liveEvent)
          ? `<span style="font-size: 0.65rem; font-weight: 800; background: var(--brand-fire-orange); color: #fff; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">🏃 FIT QUEST AVAILABLE</span>`
          : '';
        const fitQuestSubtitle = (p.id === 'sports_hub' && isUnlocked && !liveEvent)
          ? `<div style="font-size: 0.70rem; color: var(--brand-fire-orange); font-weight: 700; margin-top: 2px;">⚡ Fit Quest Challenges Active</div>`
          : '';

        const opacity = isUnlocked ? '1' : '0.65';
        const requirementText = !isUnlocked
          ? `<div style="font-size: 0.72rem; color: var(--brand-fire-orange); margin-top: 4px;">🔒 ${availResult.reason || p.lockMessage || 'Progress further to unlock'}</div>`
          : '';

        return `
          <div class="team-chip" style="cursor: pointer; padding: 12px; opacity: ${opacity}; display: flex; align-items: center; justify-content: space-between; border-radius: var(--radius-md); border: 1px solid ${isCurrent ? 'var(--brand-fire-orange)' : 'rgba(0,0,0,0.08)'}; margin-bottom: 8px;" onclick="window.KOINONIA_GAME.handlePlaceSelect('${p.id}')">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 1.8rem;">${p.icon || '📍'}</span>
              <div>
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--brand-burgundy); display: flex; align-items: center;">${p.name} ${liveEventBadge || fitQuestBadge}</div>
                <div style="font-size: 0.72rem; color: var(--brand-charcoal); opacity: 0.85;">${p.subtitle || p.tagline}</div>
                ${liveEventSubtitle || fitQuestSubtitle}
                ${requirementText}
              </div>
            </div>
            <div style="text-align: right; min-width: 90px;">
              <span style="font-size: 0.72rem; font-weight: 800; color: ${statusColor}; background: ${badgeBg}; padding: 3px 8px; border-radius: 6px;">${statusBadge}</span>
              ${isUnlocked && !isCurrent ? `<div style="font-size: 0.7rem; color: var(--brand-fire-orange); font-weight: 700; margin-top: 4px;">TRAVEL ➔</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }
    const modal = document.getElementById('world-map-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function handlePlaceSelect(placeId) {
    if (placeId === 'outreach') placeId = 'outreach_site';
    if (placeId === state.activePlaceId || (placeId === 'outreach_site' && state.activePlaceId === 'outreach')) {
      const modal = document.getElementById('world-map-modal');
      if (modal) modal.classList.add('hidden');
      return;
    }

    const availResult = evaluatePlaceAvailability(placeId, state);
    if (availResult.available) {
      const modal = document.getElementById('world-map-modal');
      if (modal) modal.classList.add('hidden');
      transitionToPlace(placeId, 'default');
    } else {
      const p = PLACES[placeId];
      const msg = availResult.reason || p?.lockMessage || 'This place is locked. Progress further in callings to unlock!';
      showToast(`🔒 ${msg}`);
      playBellSound();
    }
  }

  function openQuestsTabModal() {
    evaluateQuestAvailability();
    const list = document.getElementById('quests-tab-list');
    if (list) {
      const activeQuests = [];
      const availableQuests = [];
      const completedQuests = [];
      const lockedQuests = [];

      QUESTS.forEach(q => {
        const prog = state.questProgress[q.id] || { status: 'LOCKED' };
        if (prog.status === 'COMPLETED') {
          completedQuests.push({ quest: q, prog });
        } else if (['ACCEPTED', 'REAL_WORLD', 'RETURNED', 'VERIFYING'].includes(prog.status)) {
          activeQuests.push({ quest: q, prog });
        } else if (prog.status === 'AVAILABLE') {
          availableQuests.push({ quest: q, prog });
        } else {
          lockedQuests.push({ quest: q, prog });
        }
      });

      let html = '';
      // Section 1: ACTIVE
      html += `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--brand-fire-orange); text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <span>⏳</span> ACTIVE QUESTS (${activeQuests.length})
          </div>
      `;
      if (activeQuests.length > 0) {
        activeQuests.forEach(({ quest: q, prog }) => {
          const statusLabel = prog.status === 'REAL_WORLD' ? 'In Real World' :
                              prog.status === 'RETURNED' ? 'Ready to Reflect' :
                              prog.status === 'VERIFYING' ? 'Awaiting Confirmation' : 'Accepted';
          html += `
            <div class="team-chip" style="padding: 12px; margin-bottom: 6px; cursor: pointer;" onclick="window.KOINONIA_GAME.openQuestDetailModal('${q.id}')">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 1.2rem;">${q.icon || '🌱'}</span>
                  <strong style="color: var(--brand-burgundy);">${q.title}</strong>
                  <span style="font-size: 0.65rem; background: var(--tint-amber); color: var(--brand-fire-orange); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${q.categoryTitle || q.category}</span>
                </div>
                <div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.9; margin: 4px 0;">Task: ${q.realWorldAction}</div>
                <div style="font-size: 0.68rem; color: var(--accent-success); font-weight: 700;">Rewards: +${q.rewards.lp} LP • +${q.rewards.charXp || 5} XP</div>
              </div>
              <span class="lifecycle-chip" style="background: var(--tint-amber); color: var(--brand-burgundy); font-weight: 800;">${statusLabel}</span>
            </div>
          `;
        });
      } else {
        html += `<div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.6; padding: 6px 12px; font-style: italic;">No active quests right now. Accept an available calling below!</div>`;
      }
      html += `</div>`;

      // Section 2: AVAILABLE
      html += `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--brand-fire-orange); text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <span>✨</span> AVAILABLE QUESTS (${availableQuests.length})
          </div>
      `;
      if (availableQuests.length > 0) {
        availableQuests.forEach(({ quest: q }) => {
          html += `
            <div class="team-chip" style="padding: 12px; margin-bottom: 6px; cursor: pointer;" onclick="window.KOINONIA_GAME.openQuestDetailModal('${q.id}')">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 1.2rem;">${q.icon || '🌱'}</span>
                  <strong style="color: var(--brand-burgundy);">${q.title}</strong>
                  <span style="font-size: 0.65rem; background: var(--surface-card-subtle); color: var(--brand-fire-orange); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${q.categoryTitle || q.category}</span>
                </div>
                <div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.85; margin: 4px 0;">${q.summary || q.description}</div>
                <div style="font-size: 0.68rem; color: var(--brand-fire-orange); font-weight: 700;">Offered by ${q.giverName || 'Elder'} • +${q.rewards.lp} LP</div>
              </div>
              <button class="primary-btn" style="padding: 6px 10px; font-size: 0.7rem;" onclick="event.stopPropagation(); window.KOINONIA_GAME.openQuestDetailModal('${q.id}');">Accept</button>
            </div>
          `;
        });
      } else {
        html += `<div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.6; padding: 6px 12px; font-style: italic;">No new callings available right now.</div>`;
      }
      html += `</div>`;

      // Section 3: COMPLETED
      html += `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--accent-success); text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <span>✓</span> COMPLETED QUESTS (${completedQuests.length})
          </div>
      `;
      if (completedQuests.length > 0) {
        completedQuests.forEach(({ quest: q, prog }) => {
          html += `
            <div class="team-chip" style="padding: 12px; margin-bottom: 6px; opacity: 0.9;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 1.2rem;">${q.icon || '🌱'}</span>
                  <strong style="color: var(--brand-charcoal);">${q.title}</strong>
                  <span style="font-size: 0.65rem; background: var(--surface-card-subtle); color: var(--brand-charcoal); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${q.categoryTitle || q.category}</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--brand-charcoal); opacity: 0.75; margin: 2px 0;">${q.realWorldAction}</div>
                <div style="font-size: 0.68rem; color: var(--accent-success); font-weight: 700;">Earned: +${q.rewards.lp} LP • +${q.rewards.charXp || 5} XP</div>
              </div>
              <span class="lifecycle-chip" style="background: rgba(46, 125, 50, 0.15); color: var(--accent-success); font-weight: 800;">✓ Completed</span>
            </div>
          `;
        });
      } else {
        html += `<div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.6; padding: 6px 12px; font-style: italic;">No completed callings yet.</div>`;
      }
      html += `</div>`;

      // Section 4: LOCKED
      html += `
        <div style="margin-bottom: 12px;">
          <div style="font-size: 0.72rem; font-weight: 800; color: var(--brand-charcoal); opacity: 0.7; text-transform: uppercase; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">
            <span>🔒</span> LOCKED QUESTS (${lockedQuests.length})
          </div>
      `;
      if (lockedQuests.length > 0) {
        lockedQuests.forEach(({ quest: q }) => {
          const reqDescriptions = (q.prerequisites || []).map(r => {
            if (r.type === 'QUEST_COMPLETED') {
              const reqQ = getQuest(r.questId);
              return `Complete "${reqQ ? reqQ.title : r.questId}"`;
            }
            if (r.type === 'PLACE_UNLOCKED' || r.type === 'PLACE_VISITED') {
              return `Visit FOG Community Center`;
            }
            if (r.type === 'LEVEL') {
              return `Reach Level ${r.minLevel}`;
            }
            return 'Prerequisites';
          }).join(', ');

          html += `
            <div class="team-chip" style="padding: 12px; margin-bottom: 6px; opacity: 0.65;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-size: 1.2rem;">🔒</span>
                  <strong style="color: var(--brand-charcoal);">${q.title}</strong>
                  <span style="font-size: 0.65rem; background: var(--surface-card-subtle); color: var(--brand-charcoal); padding: 2px 6px; border-radius: 4px; font-weight: 700;">${q.categoryTitle || q.category}</span>
                </div>
                <div style="font-size: 0.72rem; color: var(--brand-fire-orange); margin: 3px 0;">🔒 Requires: ${reqDescriptions || 'Progress further'}</div>
                <div style="font-size: 0.68rem; color: var(--brand-charcoal); opacity: 0.7;">Rewards: +${q.rewards.lp} LP</div>
              </div>
            </div>
          `;
        });
      } else {
        html += `<div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.6; padding: 6px 12px; font-style: italic;">All callings unlocked!</div>`;
      }
      html += `</div>`;

      list.innerHTML = html;
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
    updateCharacterProgressDisplays();
    updateLpDisplay();
    switchProfileTab('growth');
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
  // 17.5. CAMPAIGNS & REAL FOG EVENTS ENGINE (PHASE 0.17)
  // ============================================================
  let activeEventsTab = 'live';

  function toManilaIsoString(dateInput) {
    if (!dateInput) return null;
    if (typeof dateInput === 'string' && dateInput.includes('+08:00')) return dateInput;
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(dateInput)) {
      return dateInput.length === 16 ? dateInput + ':00+08:00' : dateInput + '+08:00';
    }
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return null;
    const manilaMs = d.getTime() + (8 * 3600000);
    const md = new Date(manilaMs);
    const y = md.getUTCFullYear();
    const m = String(md.getUTCMonth() + 1).padStart(2, '0');
    const day = String(md.getUTCDate()).padStart(2, '0');
    const h = String(md.getUTCHours()).padStart(2, '0');
    const min = String(md.getUTCMinutes()).padStart(2, '0');
    const s = String(md.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${day}T${h}:${min}:${s}+08:00`;
  }

  function getCurrentTime() {
    if (state.demoNow) {
      const parseFn = (typeof window !== 'undefined' && window.KOINONIA_EVENTS && window.KOINONIA_EVENTS.parseDate) || null;
      const d = parseFn ? parseFn(state.demoNow) : new Date(state.demoNow);
      if (!isNaN(d.getTime())) return d;
    }
    if (typeof window !== 'undefined' && window.location) {
      try {
        const p = new URLSearchParams(window.location.search);
        const dn = p.get('demoNow');
        if (dn) {
          const parseFn = (window.KOINONIA_EVENTS && window.KOINONIA_EVENTS.parseDate) || null;
          const d = parseFn ? parseFn(dn) : new Date(dn);
          if (!isNaN(d.getTime())) return d;
        }
      } catch (e) {}
    }
    return new Date();
  }

  function setDemoNow(val) {
    if (!val) {
      state.demoNow = null;
    } else {
      state.demoNow = toManilaIsoString(val);
    }
    saveToStorage('demo_time_update');
    updateDebugHud(true);
    if (typeof updateEventsCard === 'function') updateEventsCard();

    // Refresh modals if open
    const eventsModal = document.getElementById('events-modal');
    if (eventsModal && !eventsModal.classList.contains('hidden')) {
      renderEventsHub(activeEventsTab);
    }
    const nbModal = document.getElementById('notice-board-modal');
    if (nbModal && !nbModal.classList.contains('hidden')) {
      openNoticeBoardModal();
    }
    showToast(state.demoNow ? `⏱️ Demo clock set: ${new Date(state.demoNow).toLocaleString()}` : '⏱️ Demo clock reset to real time');
  }

  function getDemoNow() {
    return state.demoNow;
  }

  function startCampaign(campaignId) {
    if (!campaignId) return null;
    const cData = (data.campaigns && data.campaigns[campaignId]) || (CAMPAIGNS && CAMPAIGNS[campaignId]);
    if (!cData) return null;

    if (!state.campaignProgress) state.campaignProgress = {};
    if (!Array.isArray(state.activeCampaignIds)) state.activeCampaignIds = [];
    if (!Array.isArray(state.completedCampaignIds)) state.completedCampaignIds = [];

    const existing = state.campaignProgress[campaignId];
    if (!existing) {
      state.campaignProgress[campaignId] = {
        campaignId: campaignId,
        status: 'ACTIVE',
        enrolledAt: toManilaIsoString(getCurrentTime()),
        completedChapterIds: [],
        lastChapterCompletedAt: null
      };
    } else {
      if (existing.status !== 'COMPLETED') {
        existing.status = 'ACTIVE';
      }
    }

    if (!state.activeCampaignIds.includes(campaignId) && state.campaignProgress[campaignId].status === 'ACTIVE') {
      state.activeCampaignIds.push(campaignId);
    }

    evaluateCharacterProgression('campaign_start');
    saveToStorage('start_campaign');
    showToast(`🌟 Enrolled in ${cData.title}!`);

    // Refresh UI
    const eventsModal = document.getElementById('events-modal');
    if (eventsModal && !eventsModal.classList.contains('hidden')) {
      renderEventsHub(activeEventsTab);
    }
    return state.campaignProgress[campaignId];
  }

  function completeCampaignChapter(campaignId, chapterId, notes = '') {
    if (!campaignId || !chapterId) return false;
    const cData = (data.campaigns && data.campaigns[campaignId]) || (CAMPAIGNS && CAMPAIGNS[campaignId]);
    if (!cData) return false;

    if (!state.campaignProgress[campaignId] || state.campaignProgress[campaignId].status !== 'ACTIVE') {
      startCampaign(campaignId);
    }

    const prog = state.campaignProgress[campaignId];
    if (!Array.isArray(prog.completedChapterIds)) {
      prog.completedChapterIds = [];
    }

    // Prerequisite & sequential chapter check
    const targetChapter = cData.chapters ? cData.chapters.find(c => c.id === chapterId) : null;
    if (targetChapter) {
      if (Array.isArray(targetChapter.requirements)) {
        for (const req of targetChapter.requirements) {
          if (req.type === 'CHAPTER_COMPLETED' && !prog.completedChapterIds.includes(req.chapterId)) {
            showToast('⚠️ Complete previous chapter first.');
            return false;
          }
        }
      }
      if (targetChapter.sequence > 1) {
        const prevChapter = cData.chapters.find(item => item.sequence === targetChapter.sequence - 1);
        if (prevChapter && !prog.completedChapterIds.includes(prevChapter.id)) {
          showToast('⚠️ Complete previous chapter first.');
          return false;
        }
      }
    }

    if (!prog.completedChapterIds.includes(chapterId)) {
      prog.completedChapterIds.push(chapterId);
      prog.lastChapterCompletedAt = toManilaIsoString(getCurrentTime());
    }

    const totalChapters = cData.totalChapters || (cData.chapters ? cData.chapters.length : 12);
    if (prog.completedChapterIds.length >= totalChapters) {
      prog.status = 'COMPLETED';
      if (!state.completedCampaignIds.includes(campaignId)) {
        state.completedCampaignIds.push(campaignId);
      }
      state.activeCampaignIds = state.activeCampaignIds.filter(id => id !== campaignId);
      showToast(`🏆 Journey Complete! Finished ${cData.title}!`);
    } else {
      const ch = cData.chapters ? cData.chapters.find(c => c.id === chapterId) : null;
      const chTitle = ch ? (ch.shortTitle || ch.title) : chapterId;
      showToast(`✅ Chapter finished: ${chTitle}!`);
    }

    evaluateCharacterProgression('campaign_chapter');
    saveToStorage('complete_chapter');

    // Refresh modals if open
    const eventsModal = document.getElementById('events-modal');
    if (eventsModal && !eventsModal.classList.contains('hidden')) {
      renderEventsHub(activeEventsTab);
    }
    const campModal = document.getElementById('campaign-modal');
    if (campModal && !campModal.classList.contains('hidden')) {
      openCampaignModal(campaignId);
    }
    return true;
  }

  function getCampaignProgress(campaignId) {
    if (!campaignId || !state.campaignProgress) return null;
    return state.campaignProgress[campaignId] || null;
  }

  function getCompletedChaptersCount(campaignId) {
    if (campaignId) {
      const p = state.campaignProgress && state.campaignProgress[campaignId];
      return (p && Array.isArray(p.completedChapterIds)) ? p.completedChapterIds.length : 0;
    }
    let count = 0;
    if (state.campaignProgress) {
      for (const k in state.campaignProgress) {
        if (state.campaignProgress[k]?.completedChapterIds) {
          count += state.campaignProgress[k].completedChapterIds.length;
        }
      }
    }
    return count;
  }

  function markEventAttended(eventId, reflection = '') {
    if (!eventId) return false;
    if (!Array.isArray(state.eventParticipation)) state.eventParticipation = [];
    if (!Array.isArray(state.completedEventInstances)) state.completedEventInstances = [];

    const ev = (data.getEventById ? data.getEventById(eventId) : null) || (data.eventInstances && data.eventInstances[eventId]);
    const title = ev ? ev.title : eventId;

    if (!state.completedEventInstances.includes(eventId)) {
      state.completedEventInstances.push(eventId);
    }

    state.eventParticipation.push({
      eventId: eventId,
      templateId: ev ? (ev.templateId || ev.id) : eventId,
      title: title,
      attendedAt: toManilaIsoString(getCurrentTime()),
      reflection: reflection || '',
      mode: 'PROTOTYPE_LOCAL_EVENT_ATTENDANCE'
    });

    state.eventsAttendedCount = state.completedEventInstances.length;

    // Event rewards: +5 LP, +5 Character XP
    state.lp = (state.lp || 0) + 5;
    state.charXp = (state.charXp || 0) + 5;
    if (!state.growthAreas) state.growthAreas = {};
    state.growthAreas.service = (state.growthAreas.service || 0) + 5;
    if (!state.skills) state.skills = {};
    state.skills.service = (state.skills.service || 0) + 5;

    // Check if event is linked to a campaign chapter
    if (ev && ev.campaignId && ev.chapterId) {
      completeCampaignChapter(ev.campaignId, ev.chapterId, reflection);
    }

    evaluateCharacterProgression('event_attendance');
    updateCharacterProgressDisplays();
    updateLpDisplay();
    updateSkillDisplays();
    saveToStorage('event_attendance');

    showToast(`🎉 Gathered together! Attended: ${title} (+5 LP, +5 XP)`);

    // Refresh UI
    const eventsModal = document.getElementById('events-modal');
    if (eventsModal && !eventsModal.classList.contains('hidden')) {
      renderEventsHub(activeEventsTab);
    }
    const nbModal = document.getElementById('notice-board-modal');
    if (nbModal && !nbModal.classList.contains('hidden')) {
      openNoticeBoardModal();
    }
    return true;
  }

  function isEventAttended(eventId) {
    if (!eventId || !Array.isArray(state.completedEventInstances)) return false;
    return state.completedEventInstances.includes(eventId);
  }

  function openEventsHubModal(initialTab = 'live') {
    activeEventsTab = initialTab;
    renderEventsHub(initialTab);
    const modal = document.getElementById('events-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeEventsHubModal() {
    const modal = document.getElementById('events-modal');
    if (modal) modal.classList.add('hidden');
  }

  function switchEventsHubTab(tabName) {
    activeEventsTab = tabName;
    renderEventsHub(tabName);
  }

  function renderEventsHub(activeTab = 'live') {
    const content = document.getElementById('events-hub-content');
    if (!content) return;

    // Update tab button highlights
    ['live', 'upcoming', 'campaigns', 'past'].forEach(t => {
      const btn = document.getElementById(`tab-events-${t}`);
      if (btn) {
        if (t === activeTab) {
          btn.classList.add('active');
          btn.style.borderBottom = '3px solid var(--brand-fire-orange)';
          btn.style.color = 'var(--brand-burgundy)';
          btn.style.fontWeight = '800';
        } else {
          btn.classList.remove('active');
          btn.style.borderBottom = 'none';
          btn.style.color = 'var(--brand-charcoal)';
          btn.style.fontWeight = '600';
        }
      }
    });

    const now = getCurrentTime();

    if (activeTab === 'live') {
      const liveEvents = data.getLiveEvents ? data.getLiveEvents(null, now) : [];
      let html = '';

      if (liveEvents.length > 0) {
        html += `<div style="margin-bottom: 12px; font-size: 0.76rem; font-weight: 800; color: #DC2626; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
          <span>🔴</span> ACTIVE GATHERINGS RIGHT NOW (${liveEvents.length})
        </div>`;

        liveEvents.forEach(ev => {
          const attended = isEventAttended(ev.id);
          const we = ev.worldEffects || {};
          const objectsList = Array.isArray(we.temporaryObjects) ? we.temporaryObjects.map(o => `${o.icon || '✨'} ${o.name}`).join(' • ') : '';

          html += `
            <div class="team-chip" style="padding: 16px; margin-bottom: 12px; border: 2px solid ${ev.accentColor || '#D97706'}; background: #FFF9F3; border-radius: var(--radius-md); display: block;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                <div>
                  <span style="font-size: 0.68rem; background: #DC2626; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: 800;">🔴 LIVE NOW</span>
                  <span style="font-size: 0.68rem; background: rgba(0,0,0,0.06); color: var(--brand-charcoal); padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 4px;">${ev.category}</span>
                  <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--brand-burgundy); margin: 6px 0 2px 0;">${ev.icon || '⛪'} ${ev.title}</h3>
                  ${(ev.subtitle || ev.description) ? `<div style="font-size: 0.76rem; color: var(--brand-charcoal); opacity: 0.85;">${ev.subtitle || ev.description}</div>` : ''}
                </div>
              </div>

              <div style="font-size: 0.72rem; color: var(--brand-charcoal); margin: 8px 0; background: rgba(255,255,255,0.8); padding: 8px; border-radius: 6px; border: 1px solid rgba(0,0,0,0.05);">
                <div>📍 <b>Place:</b> ${ev.placeName || 'FOG Community Center'}</div>
                <div>⏰ <b>Time Window:</b> ${ev.startIso ? ev.startIso.slice(11, 16) : 'Now'} – ${ev.endIso ? ev.endIso.slice(11, 16) : 'Later'}</div>
                ${objectsList ? `<div style="margin-top: 4px; color: ${ev.accentColor || '#D97706'}; font-weight: 700;">✨ Atmosphere: ${objectsList}</div>` : ''}
              </div>

              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px;">
                <button class="primary-btn" style="flex: 1; padding: 8px 12px; font-size: 0.8rem; background: var(--brand-fire-orange);" onclick="window.KOINONIA_GAME.handlePlaceSelect('${ev.placeId || 'fog_center'}'); window.KOINONIA_GAME.closeEventsHubModal();">
                  <span>🚪 GO TO GATHERING</span>
                </button>
                ${attended ? `
                  <span style="padding: 8px 12px; font-size: 0.8rem; font-weight: 800; color: var(--accent-success); display: flex; align-items: center; gap: 4px;">
                    ✓ Attended Today (+5 LP, +5 XP Earned)
                  </span>
                ` : `
                  <button class="primary-btn" style="flex: 1; padding: 8px 12px; font-size: 0.8rem; background: var(--brand-forest-green);" onclick="window.KOINONIA_GAME.markEventAttended('${ev.id}')">
                    <span>✓ MARK ATTENDED (+5 LP, +5 XP)</span>
                  </button>
                `}
              </div>
            </div>
          `;
        });
      } else {
        html += `
          <div style="background: #FFF9F3; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 20px; text-align: center; margin-bottom: 16px;">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🕊️</div>
            <h3 style="font-size: 1.0rem; font-weight: 800; color: var(--brand-burgundy); margin-bottom: 4px;">No Gathering Live Right Now</h3>
            <p style="font-size: 0.78rem; color: var(--brand-charcoal); opacity: 0.8; margin-bottom: 14px;">
              No gathering is live right now. Check Upcoming or use the QA demo clock for testing.
            </p>
            <div style="background: rgba(0,0,0,0.03); border-radius: 8px; padding: 12px; font-size: 0.74rem;">
              <div style="font-weight: 800; color: var(--brand-fire-orange); margin-bottom: 8px; text-transform: uppercase;">⚡ Quick Demo Clock Fast-Forward:</div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <button class="primary-btn" style="padding: 6px 10px; font-size: 0.75rem;" onclick="window.KOINONIA_GAME.setDemoNow('2026-09-11T20:15:00+08:00')">
                  <span>▶ [QA DEMO] Worship Gathering (Demo Glory - 20:00)</span>
                </button>
                <button class="primary-btn" style="padding: 6px 10px; font-size: 0.75rem; background: var(--brand-flame-gold); color: #000;" onclick="window.KOINONIA_GAME.setDemoNow('2026-10-03T15:30:00+08:00')">
                  <span>▶ [QA DEMO] 1st Sat Youth Hangout (15:00)</span>
                </button>
                <button class="primary-btn" style="padding: 6px 10px; font-size: 0.75rem; background: #EA580C;" onclick="window.KOINONIA_GAME.setDemoNow('2026-09-12T15:30:00+08:00')">
                  <span>▶ [QA DEMO] Alpha Youth Session 1 (15:00)</span>
                </button>
                ${state.demoNow ? `
                  <button class="header-btn" style="margin-top: 4px; border: 1px solid var(--border-light); font-size: 0.72rem; padding: 4px;" onclick="window.KOINONIA_GAME.setDemoNow(null)">
                    <span>🔄 Reset Clock to Real Time</span>
                  </button>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }
      content.innerHTML = html;
    } else if (activeTab === 'upcoming') {
      const upcoming = data.getUpcomingEvents ? data.getUpcomingEvents(null, now, 10) : [];
      let html = `<div style="margin-bottom: 8px; font-size: 0.76rem; font-weight: 800; color: var(--brand-burgundy); text-transform: uppercase;">
        📅 UPCOMING GATHERINGS & REAL EXPERIENCES
      </div>`;

      if (upcoming.length > 0) {
        upcoming.forEach(ev => {
          const dtStr = ev.date || (ev.startIso ? ev.startIso.slice(0, 10) : 'Upcoming');
          const timeStr = (ev.startIso && ev.endIso) ? `${ev.startIso.slice(11, 16)} – ${ev.endIso.slice(11, 16)}` : '';

          html += `
            <div class="team-chip" style="padding: 14px; margin-bottom: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-light); background: #FFF9F3; display: block;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <span style="font-size: 0.68rem; font-weight: 800; background: rgba(0,0,0,0.06); color: var(--brand-charcoal); padding: 2px 6px; border-radius: 4px;">${ev.category}</span>
                  <span style="font-size: 0.68rem; font-weight: 700; color: var(--brand-fire-orange); margin-left: 6px;">📅 ${dtStr} ${timeStr ? '• ' + timeStr : ''}</span>
                  <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--brand-burgundy); margin: 4px 0 2px 0;">${ev.icon || '⛪'} ${ev.title}</h3>
                  ${(ev.subtitle || ev.description) ? `<div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.85;">${ev.subtitle || ev.description}</div>` : ''}
                  <div style="font-size: 0.70rem; color: var(--brand-charcoal); opacity: 0.7; margin-top: 4px;">📍 ${ev.placeName || 'FOG Community Center'}</div>
                </div>
              </div>
              <div style="display: flex; gap: 8px; margin-top: 10px;">
                <button class="primary-btn" style="flex: 1; padding: 6px 10px; font-size: 0.75rem;" onclick="window.KOINONIA_GAME.setDemoNow('${ev.startIso || dtStr}');">
                  <span>⏱️ JUMP DEMO CLOCK TO THIS EVENT</span>
                </button>
              </div>
            </div>
          `;
        });
      } else {
        html += `<div style="font-size: 0.76rem; color: var(--brand-charcoal); opacity: 0.7; padding: 12px; text-align: center;">No upcoming events scheduled.</div>`;
      }
      content.innerHTML = html;
    } else if (activeTab === 'campaigns') {
      const c = (data.campaigns && data.campaigns.alpha_youth_series) || (CAMPAIGNS && CAMPAIGNS.alpha_youth_series);
      const prog = getCampaignProgress('alpha_youth_series') || { status: 'AVAILABLE', completedChapterIds: [] };
      const completedCount = prog.completedChapterIds.length;
      const totalCount = (c && c.totalChapters) || 12;
      const pct = Math.round((completedCount / totalCount) * 100);

      let html = `
        <div class="team-chip" style="padding: 16px; margin-bottom: 14px; border: 2px solid ${c ? c.accentColor : '#EA580C'}; background: #FFF9F3; border-radius: var(--radius-md); display: block;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-size: 0.68rem; font-weight: 800; background: var(--tint-amber); color: var(--brand-fire-orange); padding: 2px 6px; border-radius: 4px;">FORMATION CAMPAIGN</span>
              <span style="font-size: 0.68rem; font-weight: 700; color: var(--brand-charcoal); margin-left: 6px;">👥 ${c ? c.audience : 'Youth (Ages 11–21)'}</span>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--brand-burgundy); margin: 6px 0 2px 0;">${c ? c.icon : '❓'} ${c ? c.title : 'Alpha Youth Series'}</h3>
              <div style="font-size: 0.76rem; color: var(--brand-charcoal); opacity: 0.85; margin-bottom: 8px;">${c ? c.description : ''}</div>
            </div>
          </div>

          <!-- Progress Bar -->
          <div style="margin: 12px 0 8px 0;">
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 800; margin-bottom: 4px;">
              <span style="color: var(--brand-burgundy);">Progress: ${completedCount} / ${totalCount} Chapters</span>
              <span style="color: var(--brand-fire-orange);">${pct}%</span>
            </div>
            <div style="height: 8px; background: rgba(0,0,0,0.08); border-radius: var(--radius-pill); overflow: hidden;">
              <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--brand-flame-gold), var(--brand-fire-orange)); border-radius: var(--radius-pill); transition: width 0.3s ease;"></div>
            </div>
          </div>

          <div style="display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
            ${prog.status === 'AVAILABLE' ? `
              <button class="primary-btn" style="flex: 1; padding: 8px 12px; font-size: 0.8rem;" onclick="window.KOINONIA_GAME.startCampaign('alpha_youth_series')">
                <span>🌟 START CAMPAIGN (ENROLL)</span>
              </button>
            ` : `
              <span style="padding: 6px 10px; font-size: 0.75rem; font-weight: 800; color: var(--accent-success); display: flex; align-items: center;">
                ✓ Enrolled & Active
              </span>
            `}
            <button class="primary-btn" style="flex: 1; padding: 8px 12px; font-size: 0.8rem; background: var(--brand-burgundy);" onclick="window.KOINONIA_GAME.openCampaignModal('alpha_youth_series')">
              <span>📖 VIEW ALL 12 CHAPTERS</span>
            </button>
          </div>
        </div>
      `;
      content.innerHTML = html;
    } else if (activeTab === 'past') {
      let html = `<div style="margin-bottom: 8px; font-size: 0.76rem; font-weight: 800; color: var(--brand-burgundy); text-transform: uppercase;">
        📜 PAST GATHERINGS & ATTENDED EXPERIENCES
      </div>`;

      if (state.eventParticipation && state.eventParticipation.length > 0) {
        html += `<div style="margin-bottom: 12px;">`;
        state.eventParticipation.forEach(ep => {
          html += `
            <div class="team-chip" style="padding: 10px 14px; margin-bottom: 6px; border-radius: var(--radius-md); border: 1px solid var(--border-light); background: #FFF9F3; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 800; font-size: 0.85rem; color: var(--brand-burgundy);">✓ ${ep.title || ep.eventId}</div>
                <div style="font-size: 0.68rem; color: var(--brand-charcoal); opacity: 0.7;">Attended: ${new Date(ep.attendedAt).toLocaleDateString()}</div>
              </div>
              <span style="font-size: 0.68rem; font-weight: 800; color: var(--accent-success); background: rgba(16,185,129,0.12); padding: 2px 6px; border-radius: 4px;">Attended</span>
            </div>
          `;
        });
        html += `</div>`;
      } else {
        html += `
          <div style="background: #FFF9F3; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 8px;">📜</div>
            <h3 style="font-size: 0.95rem; font-weight: 800; color: var(--brand-burgundy); margin-bottom: 4px;">No Past Gatherings Yet</h3>
            <p style="font-size: 0.76rem; color: var(--brand-charcoal); opacity: 0.8;">
              When you attend in-person gatherings or join live fellowship events, your participation history will appear here.
            </p>
          </div>
        `;
      }
      content.innerHTML = html;
    }
  }

  function openCampaignModal(campaignId = 'alpha_youth_series') {
    const modal = document.getElementById('campaign-modal');
    if (!modal) return;

    const c = (data.campaigns && data.campaigns[campaignId]) || (CAMPAIGNS && CAMPAIGNS[campaignId]);
    if (!c) return;

    const titleEl = document.getElementById('campaign-modal-title');
    if (titleEl) titleEl.textContent = `${c.icon || '❓'} ${c.title}`;

    const subtitleEl = document.getElementById('campaign-modal-subtitle');
    if (subtitleEl && c.subtitle) subtitleEl.textContent = c.subtitle;

    const prog = getCampaignProgress(campaignId) || { status: 'AVAILABLE', completedChapterIds: [] };
    const completedSet = new Set(prog.completedChapterIds || []);

    const chaptersListEl = document.getElementById('campaign-chapters-list');
    if (chaptersListEl && Array.isArray(c.chapters)) {
      chaptersListEl.innerHTML = c.chapters.map(ch => {
        const isDone = completedSet.has(ch.id);
        const typeLabel = (ch.type === 'DAY_EVENT' || ch.type === 'DAY_AWAY') ? 'RETREAT DAY' : (ch.type === 'FINALE' ? 'FINALE & CELEBRATION' : 'SESSION');
        const badgeBg = (ch.type === 'DAY_EVENT' || ch.type === 'DAY_AWAY') ? '#7C3AED' : (ch.type === 'FINALE' ? '#D97706' : 'var(--brand-fire-orange)');

        // Evaluate sequential chapter availability
        let isAvailable = !isDone;
        if (isAvailable && Array.isArray(ch.requirements)) {
          for (const req of ch.requirements) {
            if (req.type === 'CHAPTER_COMPLETED' && !completedSet.has(req.chapterId)) {
              isAvailable = false;
              break;
            }
          }
        }
        if (isAvailable && ch.sequence > 1) {
          const prev = c.chapters.find(item => item.sequence === ch.sequence - 1);
          if (prev && !completedSet.has(prev.id)) {
            isAvailable = false;
          }
        }

        const cardBg = isDone ? 'rgba(16,185,129,0.06)' : (isAvailable ? '#FFF9F3' : '#F5EFE6');
        const cardBorder = isDone ? 'var(--accent-success)' : (isAvailable ? 'var(--border-light)' : 'rgba(0,0,0,0.08)');
        const cardOpacity = isDone || isAvailable ? '1' : '0.75';

        return `
          <div class="team-chip" style="padding: 12px; margin-bottom: 8px; border-radius: var(--radius-md); border: 1px solid ${cardBorder}; background: ${cardBg}; opacity: ${cardOpacity}; display: block;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span style="font-size: 0.65rem; font-weight: 800; background: ${badgeBg}; color: #fff; padding: 2px 6px; border-radius: 4px;">${typeLabel}</span>
                <span style="font-size: 0.68rem; font-weight: 700; color: var(--brand-charcoal); opacity: 0.7; margin-left: 6px;">Chapter ${ch.sequence}</span>
                <h4 style="font-size: 0.88rem; font-weight: 800; color: var(--brand-burgundy); margin: 4px 0 2px 0;">${ch.title}</h4>
                <div style="font-size: 0.72rem; color: var(--brand-charcoal); opacity: 0.85;">${ch.description || ''}</div>
                ${ch.memoryHook ? `<div style="font-size: 0.68rem; color: var(--brand-burgundy); font-style: italic; margin-top: 4px;">📖 ${ch.memoryHook.verse}</div>` : ''}
              </div>
              <div style="text-align: right; min-width: 80px;">
                ${isDone ? `
                  <span style="font-size: 0.72rem; font-weight: 800; color: var(--accent-success); background: rgba(16,185,129,0.12); padding: 3px 8px; border-radius: 6px;">✓ DONE</span>
                ` : (isAvailable ? `
                  <button class="primary-btn" style="padding: 4px 8px; font-size: 0.68rem; background: var(--brand-fire-orange);" onclick="window.KOINONIA_GAME.completeCampaignChapter('${campaignId}', '${ch.id}')">
                    <span>COMPLETE</span>
                  </button>
                ` : `
                  <span style="font-size: 0.68rem; font-weight: 700; color: var(--brand-charcoal); opacity: 0.6; background: rgba(0,0,0,0.06); padding: 3px 8px; border-radius: 6px;">🔒 LOCKED</span>
                `)}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }

    modal.classList.remove('hidden');
  }

  function closeCampaignModal() {
    const modal = document.getElementById('campaign-modal');
    if (modal) modal.classList.add('hidden');
  }

  function openNoticeBoardModal() {
    const modal = document.getElementById('notice-board-modal');
    if (!modal) {
      openEventsHubModal('live');
      return;
    }

    const now = getCurrentTime();
    const liveEvents = data.getLiveEvents ? data.getLiveEvents(null, now) : [];
    const upcoming = data.getUpcomingEvents ? data.getUpcomingEvents(null, now, 3) : [];
    const c = (data.campaigns && data.campaigns.alpha_youth_series) || (CAMPAIGNS && CAMPAIGNS.alpha_youth_series);
    const prog = getCampaignProgress('alpha_youth_series') || { completedChapterIds: [] };

    const liveEl = document.getElementById('notice-board-live-section');
    if (liveEl) {
      if (liveEvents.length > 0) {
        const ev = liveEvents[0];
        liveEl.innerHTML = `
          <div style="background: #FEF2F2; border: 2px solid #DC2626; border-radius: var(--radius-md); padding: 12px; margin-bottom: 12px;">
            <span style="font-size: 0.68rem; font-weight: 800; background: #DC2626; color: #fff; padding: 2px 6px; border-radius: 4px;">🔴 LIVE GATHERING NOW</span>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--brand-burgundy); margin: 6px 0 2px 0;">${ev.icon || '⛪'} ${ev.title}</h4>
            ${(ev.subtitle || ev.description) ? `<p style="font-size: 0.74rem; color: var(--brand-charcoal); margin-bottom: 8px;">${ev.subtitle || ev.description}</p>` : ''}
            <div style="display: flex; gap: 8px;">
              <button class="primary-btn" style="padding: 6px 10px; font-size: 0.74rem; background: var(--brand-forest-green);" onclick="window.KOINONIA_GAME.markEventAttended('${ev.id}')">
                <span>✓ MARK ATTENDED (+5 LP, +5 XP)</span>
              </button>
            </div>
          </div>
        `;
      } else {
        liveEl.innerHTML = '';
      }
    }

    const upcomingEl = document.getElementById('notice-board-upcoming-list');
    if (upcomingEl) {
      upcomingEl.innerHTML = upcoming.map(ev => `
        <div style="padding: 8px 10px; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 800; font-size: 0.82rem; color: var(--brand-burgundy);">${ev.icon || '⛪'} ${ev.title}</div>
            <div style="font-size: 0.68rem; color: var(--brand-charcoal); opacity: 0.8;">${ev.date} • ${ev.category}</div>
          </div>
          <button class="header-btn" style="font-size: 0.68rem; padding: 3px 8px; border: 1px solid var(--border-light);" onclick="window.KOINONIA_GAME.setDemoNow('${ev.startIso || ev.date}'); window.KOINONIA_GAME.closeNoticeBoardModal();">
            <span>Fast-Forward</span>
          </button>
        </div>
      `).join('');
    }

    const campaignEl = document.getElementById('notice-board-campaign-progress');
    if (campaignEl && c) {
      const count = prog.completedChapterIds.length;
      campaignEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 0.74rem; font-weight: 800; margin-bottom: 4px;">
          <span>${c.title}</span>
          <span style="color: var(--brand-fire-orange);">${count} / 12 Chapters</span>
        </div>
        <div style="height: 6px; background: rgba(0,0,0,0.08); border-radius: var(--radius-pill); overflow: hidden; margin-bottom: 8px;">
          <div style="height: 100%; width: ${Math.round((count / 12) * 100)}%; background: linear-gradient(90deg, var(--brand-flame-gold), var(--brand-fire-orange)); border-radius: var(--radius-pill);"></div>
        </div>
        <button class="primary-btn" style="width: 100%; padding: 6px; font-size: 0.74rem;" onclick="window.KOINONIA_GAME.openCampaignModal('alpha_youth_series'); window.KOINONIA_GAME.closeNoticeBoardModal();">
          <span>VIEW 12 CHAPTERS ➔</span>
        </button>
      `;
    }

    modal.classList.remove('hidden');
  }

  function closeNoticeBoardModal() {
    const modal = document.getElementById('notice-board-modal');
    if (modal) modal.classList.add('hidden');
  }


  // ============================================================
  // 17B. PHASE 0.18 SPORTS & FIT QUEST ENGINE
  // ============================================================
  let activeFitQuestTab = 'play';
  let activeMiniGameId = null;
  let currentMiniGameSportContext = null;
  let miniGameLoopId = null;
  let miniGameTimerId = null;
  let currentMiniGameState = null;
  let lastMiniGameResult = null;
  let currentRwQuestId = null;
  let currentRwQuestSportContext = null;

  function getSportsData() {
    const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null);
    if (root && root.KOINONIA_DATA && root.KOINONIA_DATA.SPORTS) return root.KOINONIA_DATA;
    if (typeof require !== 'undefined') {
      try { return require('./data/sports.js'); } catch (e) {}
    }
    return {};
  }

  function openFitQuestModal(initialTab = 'play') {
    activeFitQuestTab = initialTab;
    state.activeFitQuestTab = initialTab;
    renderFitQuestHub(initialTab);
    const modal = document.getElementById('fitquest-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closeFitQuestModal() {
    const modal = document.getElementById('fitquest-modal');
    if (modal) modal.classList.add('hidden');
  }

  function switchFitQuestTab(tabName) {
    activeFitQuestTab = tabName;
    state.activeFitQuestTab = tabName;
    renderFitQuestHub(tabName);
  }

  function renderFitQuestHub(activeTab = 'play') {
    const content = document.getElementById('fitquest-hub-content');
    if (!content) return;

    const sData = getSportsData();
    const sports = sData.SPORTS || {};
    const challenges = sData.CHALLENGES || {};

    // Update tab button highlights
    ['play', 'realworld', 'bests', 'leaderboard', 'history'].forEach(t => {
      const btn = document.getElementById(`tab-fitquest-${t}`);
      if (btn) {
        if (t === activeTab) {
          btn.classList.add('active');
          btn.style.borderBottom = '3px solid var(--brand-fire-orange)';
          btn.style.color = 'var(--brand-burgundy)';
          btn.style.fontWeight = '800';
        } else {
          btn.classList.remove('active');
          btn.style.borderBottom = 'none';
          btn.style.color = 'var(--brand-charcoal)';
          btn.style.fontWeight = '600';
        }
      }
    });

    if (activeTab === 'play') {
      const virtualList = Object.values(challenges).filter(c => c.challengeType === 'VIRTUAL_GAME');
      let html = `<div style="margin-bottom: 12px; font-size: 0.74rem; font-weight: 800; color: var(--brand-burgundy); text-transform: uppercase;">
        🎮 VIRTUAL MINI-GAMES • SPORTS HUB
      </div>`;

      virtualList.forEach(c => {
        const sport = sports[c.sportId] || {};
        const pb = state.personalBests && state.personalBests[c.id];
        const claimed = Boolean(state.fitQuestRewardClaims && state.fitQuestRewardClaims[c.id]);

        html += `
          <div class="fitquest-card">
            <div class="fitquest-card-header">
              <div>
                <span class="fitquest-sport-tag">${sport.icon || '🏀'} ${sport.title || c.sportId}</span>
                <span style="font-size: 0.65rem; background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 4px;">${c.difficulty || 'EASY'}</span>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--brand-burgundy); margin: 6px 0 2px 0;">${c.title}</h3>
                <div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.85;">${c.subtitle || c.description}</div>
              </div>
              <div style="text-align: right;">
                ${pb ? `<span class="fitquest-badge-pb">🌟 PB: ${pb.scoreDisplay}</span>` : `<span style="font-size: 0.68rem; color: var(--brand-charcoal); opacity: 0.6;">No PB Yet</span>`}
              </div>
            </div>

            <div style="font-size: 0.72rem; color: var(--brand-charcoal); background: #FFF9F3; padding: 8px 10px; border-radius: 6px; margin: 4px 0;">
              <strong>Instructions:</strong> ${c.instructions}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span class="fitquest-reward-pill">
                ${claimed ? '✓ RPG Reward Claimed' : '🎁 First Play: +5 LP • +5 XP'}
              </span>
              <button class="primary-btn" style="padding: 6px 14px; font-size: 0.76rem;" onclick="window.KOINONIA_GAME.startMiniGame('${c.id}')">
                <span>${c.id === 'FQ-V001' ? 'PLAY FREE THROW' : c.id === 'FQ-V002' ? 'PLAY REACTION SPRINT' : c.id === 'FQ-V003' ? 'PLAY RALLY FOCUS' : 'PLAY CHALLENGE'} ➔</span>
              </button>
            </div>
          </div>
        `;
      });

      content.innerHTML = html;
    } else if (activeTab === 'realworld') {
      const rwList = Object.values(challenges).filter(c => c.challengeType === 'REAL_WORLD');
      let html = `
        <div style="background: #F0FDF4; border: 1px solid #86EFAC; border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 12px; font-size: 0.75rem; color: #166534; line-height: 1.4;">
          🛡️ <strong>Youth Fitness Safety:</strong> Choose an activity appropriate for you. Rest, skip, or try another activity anytime without penalty.
        </div>
        <div style="margin-bottom: 10px; font-size: 0.74rem; font-weight: 800; color: var(--brand-burgundy); text-transform: uppercase;">
          🌱 REAL-WORLD FIT QUESTS (HONOR & TRUST)
        </div>
      `;

      rwList.forEach(c => {
        const sport = sports[c.sportId] || {};
        const claimed = Boolean(state.fitQuestRewardClaims && state.fitQuestRewardClaims[c.id]);
        const attempts = (state.fitQuestHistory || []).filter(h => h.challengeId === c.id).length;

        html += `
          <div class="fitquest-card">
            <div class="fitquest-card-header">
              <div>
                <span class="fitquest-sport-tag">${sport.icon || '🌱'} ${sport.title || c.sportId}</span>
                <span style="font-size: 0.65rem; background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: 4px;">TRUST</span>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--brand-burgundy); margin: 6px 0 2px 0;">${c.title}</h3>
                <div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.85;">${c.subtitle || c.description}</div>
              </div>
              <div style="text-align: right;">
                <span style="font-size: 0.70rem; color: var(--brand-charcoal); opacity: 0.7;">Logged: ${attempts}</span>
              </div>
            </div>

            <div style="font-size: 0.72rem; color: var(--brand-charcoal); margin: 4px 0;">
              ${c.description}
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
              <span class="fitquest-reward-pill">
                ${claimed ? '✓ Reward Claimed' : '🎁 +5 LP • +5 XP'}
              </span>
              <button class="primary-btn" style="padding: 6px 14px; font-size: 0.76rem; background: var(--brand-forest-green);" onclick="window.KOINONIA_GAME.openRealWorldQuestModal('${c.id}')">
                <span>VIEW / LOG QUEST ➔</span>
              </button>
            </div>
          </div>
        `;
      });

      content.innerHTML = html;
    } else if (activeTab === 'bests') {
      const pbs = state.personalBests || {};
      const pbEntries = Object.values(pbs);

      let html = `<div style="margin-bottom: 12px; font-size: 0.74rem; font-weight: 800; color: var(--brand-burgundy); text-transform: uppercase;">
        🌟 MY PERSONAL BEST RECORDS (${pbEntries.length})
      </div>`;

      if (pbEntries.length === 0) {
        html += `
          <div style="padding: 24px; text-align: center; color: var(--brand-charcoal); opacity: 0.8; background: #FFF9F3; border-radius: var(--radius-md); border: 1px dashed var(--border-light);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🏃</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--brand-burgundy); margin-bottom: 4px;">No Personal Bests Recorded Yet</div>
            <div style="font-size: 0.75rem; max-width: 320px; margin: auto;">Play Basketball Free Throw, Reaction Sprint, or Rally Focus to set your first records!</div>
            <button class="primary-btn" style="margin-top: 14px; padding: 6px 14px; font-size: 0.76rem;" onclick="window.KOINONIA_GAME.switchFitQuestTab('play')">
              <span>VIEW VIRTUAL MINI-GAMES ➔</span>
            </button>
          </div>
        `;
      } else {
        pbEntries.forEach(pb => {
          const c = challenges[pb.challengeId] || {};
          const sport = sports[pb.sportId] || {};
          const dateStr = pb.completedAt ? new Date(pb.completedAt).toLocaleDateString() : 'Recent';

          html += `
            <div class="team-chip" style="padding: 12px 16px; margin-bottom: 8px; border-radius: var(--radius-md); background: #FFF9F3; border: 1px solid var(--brand-flame-gold); display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.8rem;">${sport.icon || '🌟'}</span>
                <div>
                  <div style="font-weight: 800; font-size: 0.92rem; color: var(--brand-burgundy);">${c.title || pb.challengeId}</div>
                  <div style="font-size: 0.68rem; color: var(--brand-charcoal); opacity: 0.75;">Set on ${dateStr} • Attempt #${pb.attemptNumber || 1}</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--brand-fire-orange);">${pb.scoreDisplay || pb.score}</div>
                <button class="secondary-btn" style="padding: 3px 8px; font-size: 0.65rem; margin-top: 2px;" onclick="window.KOINONIA_GAME.shareSpecificResult('${pb.challengeId}')">
                  <span>SHARE 📤</span>
                </button>
              </div>
            </div>
          `;
        });
      }

      content.innerHTML = html;
    } else if (activeTab === 'leaderboard') {
      const activeChallengeId = state.selectedChallengeId || 'FQ-V001';
      const c = challenges[activeChallengeId] || challenges['FQ-V001'];
      const lbList = sData.getPrototypeLeaderboard ? sData.getPrototypeLeaderboard(state, activeChallengeId) : [];

      let html = `
        <div class="demo-leaderboard-notice">
          <strong>⚠️ PROTOTYPE LOCAL LEADERBOARD (DEMO)</strong><br>
          Sample scores shown for demonstration. Community leaderboard account connection will be available later.
        </div>

        <!-- Challenge Selector -->
        <div style="display: flex; gap: 6px; margin-bottom: 12px; overflow-x: auto;">
          <button class="profile-tab-btn ${activeChallengeId === 'FQ-V001' ? 'active' : ''}" onclick="window.KOINONIA_GAME.selectLeaderboardChallenge('FQ-V001')">
            🏀 Free Throw
          </button>
          <button class="profile-tab-btn ${activeChallengeId === 'FQ-V002' ? 'active' : ''}" onclick="window.KOINONIA_GAME.selectLeaderboardChallenge('FQ-V002')">
            🏃 Reaction Sprint
          </button>
          <button class="profile-tab-btn ${activeChallengeId === 'FQ-V003' ? 'active' : ''}" onclick="window.KOINONIA_GAME.selectLeaderboardChallenge('FQ-V003')">
            🏸 Rally Focus
          </button>
        </div>

        <div style="background: var(--surface-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); overflow: hidden;">
          <div style="padding: 10px 12px; background: #FFF9F3; border-bottom: 1px solid var(--border-light); font-weight: 800; font-size: 0.8rem; color: var(--brand-burgundy);">
            ${c ? c.title : 'Challenge'} — Rankings
          </div>
      `;

      lbList.forEach(item => {
        const isMe = item.isLocalPlayer;
        html += `
          <div class="proto-leaderboard-row ${isMe ? 'local-player' : ''}">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: 800; width: 22px; color: ${item.rank <= 3 ? 'var(--brand-fire-orange)' : 'var(--brand-charcoal)'};">
                #${item.rank}
              </span>
              <div>
                <span style="color: var(--brand-burgundy);">${item.name}</span>
                <span style="font-size: 0.65rem; background: ${isMe ? 'var(--brand-fire-orange)' : 'rgba(0,0,0,0.06)'}; color: ${isMe ? '#fff' : 'var(--brand-charcoal)'}; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">
                  ${item.label || 'DEMO'}
                </span>
              </div>
            </div>
            <div style="font-weight: 800; color: var(--brand-fire-orange);">${item.scoreDisplay || item.score}</div>
          </div>
        `;
      });

      html += `</div>`;
      content.innerHTML = html;
    } else if (activeTab === 'history') {
      const history = state.fitQuestHistory || [];
      let html = `<div style="margin-bottom: 12px; font-size: 0.74rem; font-weight: 800; color: var(--brand-burgundy); text-transform: uppercase;">
        📜 LOCAL ATTEMPT HISTORY (${history.length} / 100 max)
      </div>`;

      if (history.length === 0) {
        html += `
          <div style="padding: 20px; text-align: center; color: var(--brand-charcoal); opacity: 0.7; background: #FFF9F3; border-radius: var(--radius-md);">
            No challenge attempts logged yet.
          </div>
        `;
      } else {
        history.slice(0, 30).forEach(h => {
          const dateStr = h.completedAt ? new Date(h.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';
          html += `
            <div class="team-chip" style="padding: 8px 12px; margin-bottom: 6px; border-radius: var(--radius-md); background: #FFF9F3; border: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 700; font-size: 0.84rem; color: var(--brand-burgundy);">${h.challengeTitle || h.challengeId}</div>
                <div style="font-size: 0.68rem; color: var(--brand-charcoal); opacity: 0.7;">${dateStr} • Attempt #${h.attemptNumber || 1}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--brand-fire-orange);">${h.scoreDisplay || h.score}</div>
                ${h.isPersonalBest ? `<span style="font-size: 0.65rem; color: #B45309; font-weight: 800;">🌟 PB</span>` : ''}
              </div>
            </div>
          `;
        });
      }

      content.innerHTML = html;
    }
  }

  function selectLeaderboardChallenge(cId) {
    state.selectedChallengeId = cId;
    renderFitQuestHub('leaderboard');
  }

  // ============================================================
  // 17C. MINI-GAME RUNTIMES (BASKETBALL, RUNNING, RALLY)
  // ============================================================
  function showMiniGameError(challengeId, reason) {
    console.error(`[MINI-GAME ERROR] Challenge: ${challengeId} | Reason: ${reason}`);
    const modal = document.getElementById('minigame-error-modal');
    const chEl = document.getElementById('minigame-error-challenge');
    const rEl = document.getElementById('minigame-error-reason');
    if (modal && chEl && rEl) {
      chEl.textContent = `Challenge: ${challengeId}`;
      rEl.textContent = reason;
      modal.classList.remove('hidden');
    }
    showToast(`⚠️ Unable to start ${challengeId}: ${reason}`);
  }

  function startMiniGame(challengeId, sportContext = null) {
    try {
      // Step A: Validate challenge exists
      const sData = getSportsData();
      const challenge = sData.CHALLENGES ? sData.CHALLENGES[challengeId] : null;
      if (!challenge) {
        showMiniGameError(challengeId, `Challenge "${challengeId}" not found in CHALLENGES catalog.`);
        return false;
      }

      // Determine active sport context
      currentMiniGameSportContext = sportContext || challenge.sportId;
      if (challenge.eligibleSportIds && !challenge.eligibleSportIds.includes(currentMiniGameSportContext)) {
        currentMiniGameSportContext = challenge.sportId;
      }
      const activeSport = (sData.SPORTS && sData.SPORTS[currentMiniGameSportContext]) || (sData.SPORTS && sData.SPORTS[challenge.sportId]) || {};

      // Step B: Validate required mini-game DOM elements exist
      const modal = document.getElementById('minigame-modal');
      const titleEl = document.getElementById('minigame-title');
      const subEl = document.getElementById('minigame-subtitle');
      const activeView = document.getElementById('minigame-active-view');
      const resultView = document.getElementById('minigame-result-view');
      const actionBtn = document.getElementById('btn-minigame-action');
      const canvas = document.getElementById('minigame-canvas');
      const reactionScreen = document.getElementById('reaction-sprint-screen');

      const missingElements = [];
      if (!modal) missingElements.push('#minigame-modal');
      if (!activeView) missingElements.push('#minigame-active-view');
      if (!resultView) missingElements.push('#minigame-result-view');
      if (!actionBtn) missingElements.push('#btn-minigame-action');

      if (challengeId === 'FQ-V001' || challengeId === 'FQ-V003') {
        if (!canvas) missingElements.push('#minigame-canvas');
      } else if (challengeId === 'FQ-V002') {
        if (!reactionScreen) missingElements.push('#reaction-sprint-screen');
      }

      if (missingElements.length > 0) {
        showMiniGameError(challengeId, `Missing required DOM element(s): ${missingElements.join(', ')}`);
        return false;
      }

      // In browser runtime, test canvas 2D context for canvas-based mini-games
      if ((challengeId === 'FQ-V001' || challengeId === 'FQ-V003') && canvas && typeof canvas.getContext === 'function') {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          showMiniGameError(challengeId, 'HTML5 2D Canvas context is not supported or failed to initialize.');
          return false;
        }
      }

      // Cancel any existing loop / timer
      if (miniGameLoopId) cancelAnimationFrame(miniGameLoopId);
      if (miniGameTimerId) clearTimeout(miniGameTimerId);

      activeMiniGameId = challengeId;
      const currentPB = state.personalBests && state.personalBests[challengeId];

      if (titleEl) titleEl.textContent = `${activeSport.icon || '🎮'} ${challenge.title}`;
      if (subEl) subEl.textContent = `${challenge.subtitle || challenge.description} • ${activeSport.name || activeSport.title || currentMiniGameSportContext}`;

      // Step C: Initialize game state successfully & configure views
      if (challengeId === 'FQ-V001') {
        // ------------------------------------------------------
        // A. BASKETBALL: FREE THROW FOCUS
        // ------------------------------------------------------
        if (canvas) canvas.style.display = 'block';
        if (reactionScreen) reactionScreen.classList.add('hidden');
        if (actionBtn) {
          actionBtn.style.display = 'block';
          actionBtn.textContent = '🏀 SHOOT [SPACE]';
          actionBtn.className = 'minigame-action-btn';
        }

        currentMiniGameState = {
          challengeId,
          shotsTotal: 10,
          shotsTaken: 0,
          shotsMade: 0,
          meterVal: 10,
          meterDir: 1,
          meterSpeed: 2.2,
          phase: 'aiming', // 'aiming' | 'shooting' | 'scored' | 'missed'
          ballY: 190,
          ballX: 200,
          feedback: 'Aim for the green center zone!',
          feedbackColor: '#FDE68A'
        };

        updateMiniGameHud('Shot 1/10 | Makes: 0', `PB: ${currentPB ? currentPB.scoreDisplay : '--'}`);

        function basketballLoop() {
          if (activeMiniGameId !== 'FQ-V001') return;
          const g = currentMiniGameState;
          if (!g) return;

          // Update meter oscillation
          if (g.phase === 'aiming') {
            g.meterVal += g.meterSpeed * g.meterDir;
            if (g.meterVal >= 90) { g.meterVal = 90; g.meterDir = -1; }
            if (g.meterVal <= 10) { g.meterVal = 10; g.meterDir = 1; }
          }

          // Draw basketball court view
          if (canvas && typeof canvas.getContext === 'function') {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const W = canvas.width || 400;
              const H = canvas.height || 280;

              // Background Court
              ctx.fillStyle = '#27221A';
              ctx.fillRect(0, 0, W, H);

              // Gym wall & floor
              ctx.fillStyle = '#3E2723';
              ctx.fillRect(0, 0, W, 120);
              ctx.fillStyle = '#D97706';
              ctx.fillRect(0, 120, W, H - 120);

              // Key & Free Throw Circle
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 2;
              ctx.strokeRect(100, 120, 200, 100);
              ctx.beginPath();
              ctx.arc(200, 220, 45, 0, Math.PI, true);
              ctx.stroke();

              // Backboard & Hoop
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(160, 30, 80, 50);
              ctx.strokeStyle = '#DC2626';
              ctx.lineWidth = 3;
              ctx.strokeRect(175, 45, 50, 30);

              // Rim
              ctx.strokeStyle = '#EA580C';
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(200, 85, 18, 0, Math.PI * 2);
              ctx.stroke();

              // Net
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(182, 85); ctx.lineTo(190, 115); ctx.lineTo(210, 115); ctx.lineTo(218, 85);
              ctx.stroke();

              // Ball
              ctx.fillStyle = '#EA580C';
              ctx.beginPath();
              ctx.arc(g.ballX, g.ballY, 14, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = 1;
              ctx.stroke();

              // Feedback text
              ctx.fillStyle = g.feedbackColor || '#FFFFFF';
              ctx.font = 'bold 14px "Clear Sans", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(g.feedback, 200, 150);

              // Accuracy Slider Meter Bar (Bottom)
              const barX = 60;
              const barY = 240;
              const barW = 280;
              const barH = 20;

              ctx.fillStyle = 'rgba(0,0,0,0.65)';
              ctx.fillRect(barX, barY, barW, barH);
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(barX, barY, barW, barH);

              // Sweet Zone (Green: 42% - 58%)
              const sweetX = barX + (barW * 0.42);
              const sweetW = barW * 0.16;
              ctx.fillStyle = '#10B981';
              ctx.fillRect(sweetX, barY + 1, sweetW, barH - 2);

              // Perfect Center Line
              ctx.strokeStyle = '#FDE68A';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(barX + barW * 0.5, barY);
              ctx.lineTo(barX + barW * 0.5, barY + barH);
              ctx.stroke();

              // Moving Needle
              const needlePos = barX + (barW * (g.meterVal / 100));
              ctx.fillStyle = '#FFFFFF';
              ctx.beginPath();
              ctx.arc(needlePos, barY + barH / 2, 9, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#DC2626';
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }

          miniGameLoopId = requestAnimationFrame(basketballLoop);
        }

        miniGameLoopId = requestAnimationFrame(basketballLoop);

      } else if (challengeId === 'FQ-V002') {
        // ------------------------------------------------------
        // B. RUNNING: REACTION SPRINT
        // ------------------------------------------------------
        if (canvas) canvas.style.display = 'none';
        if (reactionScreen) reactionScreen.classList.remove('hidden');
        if (actionBtn) {
          actionBtn.style.display = 'block';
          actionBtn.textContent = '🛑 WAIT FOR GREEN...';
          actionBtn.className = 'minigame-action-btn';
        }

        currentMiniGameState = {
          challengeId,
          state: 'wait', // 'wait' | 'go' | 'false_start' | 'done'
          startTime: 0
        };

        updateMiniGameHud('Sprint Start Line', `PB: ${currentPB ? currentPB.scoreDisplay : '--'}`);
        armReactionSprint();

      } else if (challengeId === 'FQ-V003') {
        // ------------------------------------------------------
        // C. RACKET: RALLY FOCUS (BADMINTON / PICKLEBALL)
        // ------------------------------------------------------
        if (canvas) canvas.style.display = 'block';
        if (reactionScreen) reactionScreen.classList.add('hidden');
        if (actionBtn) {
          actionBtn.style.display = 'block';
          actionBtn.textContent = '🏸 SWING / RETURN [SPACE]';
          actionBtn.className = 'minigame-action-btn';
        }

        currentMiniGameState = {
          challengeId,
          rallies: 0,
          shuttleX: 40,
          shuttleY: 130,
          shuttleVx: 3.5,
          shuttleDir: 1, // 1 = towards player (right), -1 = away (left)
          strikeMin: 280,
          strikeMax: 360,
          feedback: 'Time your swing in the strike zone!',
          feedbackColor: '#FDE68A',
          missed: false
        };

        updateMiniGameHud('Rally Streak: 0', `PB: ${currentPB ? currentPB.scoreDisplay : '--'}`);

        function rallyLoop() {
          if (activeMiniGameId !== 'FQ-V003') return;
          const g = currentMiniGameState;
          if (!g || g.missed) return;

          // Move shuttle
          g.shuttleX += g.shuttleVx * g.shuttleDir;

          // Rebound off left court (opponent auto return)
          if (g.shuttleX <= 40 && g.shuttleDir === -1) {
            g.shuttleDir = 1;
            g.shuttleVx = Math.min(7.5, 3.5 + g.rallies * 0.25);
          }

          // Passed player without hit
          if (g.shuttleX > 375 && g.shuttleDir === 1) {
            g.missed = true;
            g.feedback = 'MISSED! Rally dropped.';
            g.feedbackColor = '#EF4444';
            setTimeout(() => finishMiniGame('FQ-V003', g.rallies), 600);
            return;
          }

          // Draw rally court
          if (canvas && typeof canvas.getContext === 'function') {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const W = canvas.width || 400;
              const H = canvas.height || 280;

              // Court floor
              ctx.fillStyle = '#065F46';
              ctx.fillRect(0, 0, W, H);

              // White court boundary
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 2;
              ctx.strokeRect(20, 40, W - 40, H - 80);

              // Center Net
              ctx.strokeStyle = '#FDE68A';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.moveTo(180, 30); ctx.lineTo(180, H - 30);
              ctx.stroke();

              // Player Strike Zone (Right side)
              ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
              ctx.fillRect(g.strikeMin, 40, g.strikeMax - g.strikeMin, H - 80);
              ctx.strokeStyle = '#10B981';
              ctx.lineWidth = 2;
              ctx.strokeRect(g.strikeMin, 40, g.strikeMax - g.strikeMin, H - 80);

              // Shuttlecock
              ctx.fillStyle = '#FFFFFF';
              ctx.beginPath();
              ctx.arc(g.shuttleX, g.shuttleY, 8, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#DC2626';
              ctx.beginPath();
              ctx.arc(g.shuttleX, g.shuttleY, 4, 0, Math.PI * 2);
              ctx.fill();

              // Text / Streak
              ctx.fillStyle = g.feedbackColor || '#FFFFFF';
              ctx.font = 'bold 14px "Clear Sans", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(g.feedback, W / 2, 25);

              ctx.font = 'bold 12px "Clear Sans", sans-serif';
              ctx.fillStyle = '#10B981';
              ctx.fillText('STRIKE ZONE [SPACE]', 320, H - 15);
            }
          }

          miniGameLoopId = requestAnimationFrame(rallyLoop);
        }

        miniGameLoopId = requestAnimationFrame(rallyLoop);
      }

      // Step D: Make mini-game modal visible
      if (activeView) activeView.classList.remove('hidden');
      if (resultView) resultView.classList.add('hidden');
      if (modal) modal.classList.remove('hidden');

      // Step E: Verify mini-game view is visible
      const isModalVisible = modal && !modal.classList.contains('hidden');
      const isActiveViewVisible = activeView && !activeView.classList.contains('hidden');
      if (!isModalVisible || !isActiveViewVisible) {
        showMiniGameError(challengeId, 'Failed to make mini-game view visible in the DOM.');
        return false;
      }

      // ONLY THEN: Close previous modals
      closeFitQuestModal();
      closeDialogueModal();

      return true;
    } catch (err) {
      showMiniGameError(challengeId, err && err.message ? err.message : String(err));
      return false;
    }
  }

  function armReactionSprint(options = null) {
    const screen = document.getElementById('reaction-sprint-screen');
    const icon = document.getElementById('reaction-sprint-icon');
    const label = document.getElementById('reaction-sprint-label');
    const sub = document.getElementById('reaction-sprint-sub');
    const actionBtn = document.getElementById('btn-minigame-action');

    if (!currentMiniGameState) return;
    currentMiniGameState.state = 'wait';

    if (screen) {
      screen.className = 'reaction-screen reaction-wait';
    }
    if (icon) icon.textContent = '🛑';
    if (label) label.textContent = 'WAIT FOR GREEN...';
    if (sub) sub.textContent = 'Do not tap yet!';
    if (actionBtn) {
      actionBtn.textContent = '🛑 WAIT FOR GREEN...';
      actionBtn.style.background = '#B91C1C';
    }

    const triggerGo = () => {
      if (activeMiniGameId !== 'FQ-V002' || !currentMiniGameState) return;
      currentMiniGameState.state = 'go';
      currentMiniGameState.startTime = performance.now();
      if (screen) screen.className = 'reaction-screen reaction-go';
      if (icon) icon.textContent = '⚡';
      if (label) label.textContent = 'GO! SPRINT!';
      if (sub) sub.textContent = 'TAP NOW!';
      if (actionBtn) {
        actionBtn.textContent = '⚡ GO! SPRINT! [TAP NOW]';
        actionBtn.style.background = '#059669';
      }
    };

    if (options && options.deterministic) {
      currentMiniGameState.triggerGo = triggerGo;
    } else {
      const delayMs = 1600 + Math.floor(Math.random() * 1800);
      miniGameTimerId = setTimeout(triggerGo, delayMs);
    }
  }

  function handleMiniGameAction(options = null) {
    if (!activeMiniGameId || !currentMiniGameState) return;

    if (activeMiniGameId === 'FQ-V001') {
      // Basketball Shoot
      const g = currentMiniGameState;
      if (g.phase !== 'aiming') return;

      g.phase = 'shooting';
      g.shotsTaken++;

      // Check sweet zone (42 to 58)
      const isMake = (options && options.forceMake !== undefined)
        ? options.forceMake
        : (g.meterVal >= 42 && g.meterVal <= 58);

      if (isMake) {
        g.shotsMade++;
        g.feedback = 'SWISH! 🏀 +1 Make!';
        g.feedbackColor = '#10B981';
        triggerEmote('🏀');
      } else {
        g.feedback = 'OFF THE RIM! ❌ Miss';
        g.feedbackColor = '#EF4444';
      }

      updateMiniGameHud(`Shot ${g.shotsTaken}/10 | Makes: ${g.shotsMade}`);

      const resolveShot = () => {
        if (activeMiniGameId !== 'FQ-V001' || !currentMiniGameState) return;
        if (g.shotsTaken < g.shotsTotal) {
          g.phase = 'aiming';
          g.feedback = 'Aim for the green center zone!';
          g.feedbackColor = '#FDE68A';
        } else {
          g.phase = 'finished';
          finishMiniGame('FQ-V001', g.shotsMade);
        }
      };

      if (options && options.immediate) {
        resolveShot();
      } else {
        setTimeout(resolveShot, 700);
      }

    } else if (activeMiniGameId === 'FQ-V002') {
      // Reaction Sprint Tap
      const g = currentMiniGameState;
      if (options && (options.forceGo || options.reactionMs !== undefined)) {
        g.state = 'go';
        g.startTime = performance.now() - (options.reactionMs || 250);
      }
      if (g.state === 'wait') {
        // False start!
        if (miniGameTimerId) clearTimeout(miniGameTimerId);
        g.state = 'false_start';

        const screen = document.getElementById('reaction-sprint-screen');
        const icon = document.getElementById('reaction-sprint-icon');
        const label = document.getElementById('reaction-sprint-label');
        const sub = document.getElementById('reaction-sprint-sub');
        const actionBtn = document.getElementById('btn-minigame-action');

        if (screen) screen.className = 'reaction-screen reaction-false-start';
        if (icon) icon.textContent = '⚠️';
        if (label) label.textContent = 'FALSE START!';
        if (sub) sub.textContent = 'Tapped too early! Resetting start line...';
        if (actionBtn) {
          actionBtn.textContent = '⚠️ FALSE START! Resetting...';
          actionBtn.style.background = '#7F1D1D';
        }

        const resetDelay = (options && options.immediate) ? 10 : 1200;
        miniGameTimerId = setTimeout(() => {
          if (activeMiniGameId === 'FQ-V002') armReactionSprint();
        }, resetDelay);

      } else if (g.state === 'go') {
        g.state = 'done';
        const reactionMs = (options && options.reactionMs)
          ? options.reactionMs
          : Math.max(120, Math.round(performance.now() - g.startTime));
        finishMiniGame('FQ-V002', reactionMs);
      }

    } else if (activeMiniGameId === 'FQ-V003') {
      // Rally Swing
      const g = currentMiniGameState;
      if (g.missed) return;

      const inZone = (options && options.inStrikeZone !== undefined)
        ? options.inStrikeZone
        : (g.shuttleX >= g.strikeMin - 25 && g.shuttleX <= g.strikeMax + 20 && g.shuttleDir === 1);

      if (inZone) {
        g.rallies++;
        g.shuttleDir = -1;
        g.feedback = `GREAT HIT! 🏸 Rally: ${g.rallies}`;
        g.feedbackColor = '#10B981';
        updateMiniGameHud(`Rally Streak: ${g.rallies}`);
        triggerEmote('🏸');
        if (options && options.endGame) {
          finishMiniGame('FQ-V003', g.rallies);
        }
      } else {
        // Swung at empty air or wrong time
        g.missed = true;
        g.feedback = 'SWUNG TOO EARLY/LATE! Rally dropped.';
        g.feedbackColor = '#EF4444';
        const dropDelay = (options && options.immediate) ? 0 : 600;
        if (dropDelay === 0) {
          finishMiniGame('FQ-V003', g.rallies);
        } else {
          setTimeout(() => finishMiniGame('FQ-V003', g.rallies), dropDelay);
        }
      }
    }
  }

  function updateMiniGameHud(centerText, rightText = null) {
    const cEl = document.getElementById('minigame-hud-center');
    const rEl = document.getElementById('minigame-hud-right');
    if (cEl && centerText) cEl.textContent = centerText;
    if (rEl && rightText) rEl.textContent = rightText;
  }

  function finishMiniGame(challengeId, score) {
    if (miniGameLoopId) cancelAnimationFrame(miniGameLoopId);
    if (miniGameTimerId) clearTimeout(miniGameTimerId);

    const sData = getSportsData();
    const challenge = sData.CHALLENGES ? sData.CHALLENGES[challengeId] : null;

    // Record result through Personal Best Engine with actual sport context
    const result = sData.recordChallengeResult
      ? sData.recordChallengeResult(state, challengeId, score, { sportId: currentMiniGameSportContext })
      : { score, sportId: currentMiniGameSportContext, isPersonalBest: true };

    lastMiniGameResult = result;
    saveToStorage('fitquest_result');

    // Update UI displays
    updateCharacterProgressDisplays();
    updateLpDisplay();

    // Switch to Result View
    const activeView = document.getElementById('minigame-active-view');
    const resultView = document.getElementById('minigame-result-view');
    if (activeView) activeView.classList.add('hidden');
    if (resultView) resultView.classList.remove('hidden');

    // Populate Result Screen
    const pbBanner = document.getElementById('minigame-result-pb-banner');
    const sportIcon = document.getElementById('minigame-result-sport-icon');
    const challengeName = document.getElementById('minigame-result-challenge-name');
    const scoreBig = document.getElementById('minigame-result-score-big');
    const pbCompare = document.getElementById('minigame-result-pb-compare');
    const rewardCard = document.getElementById('minigame-result-reward-card');

    if (sportIcon && challenge) sportIcon.textContent = sData.SPORTS[challenge.sportId]?.icon || '🏆';
    if (challengeName && challenge) challengeName.textContent = challenge.title;
    if (scoreBig) scoreBig.textContent = result.scoreDisplay || `${score} ${challenge?.unit || ''}`;

    if (pbBanner) {
      if (result.isPersonalBest) pbBanner.classList.remove('hidden');
      else pbBanner.classList.add('hidden');
    }

    if (pbCompare) {
      if (result.previousPersonalBest !== null && result.previousPersonalBest !== undefined) {
        pbCompare.textContent = `Previous Best: ${result.previousPersonalBest} ${challenge?.unit || ''}`;
      } else {
        pbCompare.textContent = 'First recorded attempt!';
      }
    }

    if (rewardCard) {
      if (result.rewardClaimed) {
        rewardCard.innerHTML = `
          <div style="background:#ECFDF5; border:1px solid #10B981; color:#047857; padding:10px; border-radius:6px; font-weight:800;">
            🎁 Controlled RPG Reward: +5 LP • +5 Character XP • Growth XP
          </div>
        `;
      } else {
        rewardCard.innerHTML = `
          <div style="background:#FFFBEB; border:1px solid #F59E0B; color:#92400E; padding:10px; border-radius:6px; font-weight:700;">
            ⚡ Personal Best Recognition (No repeatable LP/XP)
          </div>
        `;
      }
    }
  }

  function retryMiniGame() {
    if (activeMiniGameId) {
      startMiniGame(activeMiniGameId, currentMiniGameSportContext);
    }
  }

  function exitMiniGame() {
    if (miniGameLoopId) cancelAnimationFrame(miniGameLoopId);
    if (miniGameTimerId) clearTimeout(miniGameTimerId);
    activeMiniGameId = null;
    currentMiniGameState = null;

    const modal = document.getElementById('minigame-modal');
    if (modal) modal.classList.add('hidden');
  }

  function shareMiniGameResult() {
    const res = lastMiniGameResult;
    if (!res) {
      showToast('No result to share');
      return;
    }

    const payload = res.sharePayload || {
      title: `KOINONIA Fit Quest — ${res.challengeTitle || 'Result'}`,
      text: `KOINONIA Fit Quest — ${res.challengeTitle}\nScore: ${res.scoreDisplay}${res.isPersonalBest ? '\n🌟 New Personal Best!' : ''}\n"A virtual world that grows when you grow in real life."`
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: payload.title,
        text: payload.text,
        url: window.location.href
      }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(payload.text).then(() => {
        showToast('✓ Result copied to clipboard!');
      }).catch(() => {
        showToast('Result: ' + payload.scoreText);
      });
    } else {
      showToast(payload.scoreText);
    }
  }

  function shareSpecificResult(challengeId) {
    const pb = state.personalBests && state.personalBests[challengeId];
    if (!pb) {
      showToast('No record to share');
      return;
    }
    lastMiniGameResult = pb;
    shareMiniGameResult();
  }

  function sharePersonalBest(challengeId) {
    return shareSpecificResult(challengeId);
  }

  // ============================================================
  // 17D. REAL-WORLD FIT QUEST DETAIL CONTROLLER
  // ============================================================
  function openRealWorldQuestModal(challengeId, sportContext = null) {
    currentRwQuestId = challengeId;
    const sData = getSportsData();
    const challenge = sData.CHALLENGES ? sData.CHALLENGES[challengeId] : null;
    if (!challenge) return;

    currentRwQuestSportContext = sportContext || challenge.sportId;
    if (challenge.eligibleSportIds && !challenge.eligibleSportIds.includes(currentRwQuestSportContext)) {
      currentRwQuestSportContext = challenge.sportId;
    }
    const activeSport = (sData.SPORTS && sData.SPORTS[currentRwQuestSportContext]) || (sData.SPORTS && sData.SPORTS[challenge.sportId]) || {};

    closeFitQuestModal();

    const modal = document.getElementById('realworld-quest-modal');
    const titleEl = document.getElementById('rw-modal-title');
    const subEl = document.getElementById('rw-modal-subtitle');
    const descEl = document.getElementById('rw-modal-desc');
    const instEl = document.getElementById('rw-modal-instructions');
    const rewardEl = document.getElementById('rw-modal-rewards-info');

    if (titleEl) titleEl.textContent = `${activeSport.icon || '🌱'} ${challenge.title}`;
    if (subEl) subEl.textContent = `${challenge.subtitle || 'Real-World Fit Quest'} • ${activeSport.name || activeSport.title || currentRwQuestSportContext}`;
    if (descEl) descEl.textContent = challenge.description;
    if (instEl) instEl.textContent = challenge.instructions;

    const claimed = Boolean(state.fitQuestRewardClaims && state.fitQuestRewardClaims[challengeId]);
    if (rewardEl) {
      rewardEl.textContent = claimed
        ? 'First Completion Claimed • Recognition Only'
        : 'First Completion: +5 LP • +5 Character XP • Growth XP';
    }

    // Render multi-sport context chips if challenge supports multiple sports
    const chipsEl = document.getElementById('rw-modal-sport-chips');
    if (chipsEl) {
      if (challenge.eligibleSportIds && challenge.eligibleSportIds.length > 1) {
        let chipsHtml = '';
        challenge.eligibleSportIds.forEach(spId => {
          const sp = (sData.SPORTS && sData.SPORTS[spId]) || { name: spId, icon: '🏃' };
          const isSelected = (spId === currentRwQuestSportContext);
          chipsHtml += `
            <button class="profile-tab-btn ${isSelected ? 'active' : ''}" style="padding: 4px 10px; font-size: 0.72rem; border-radius: 6px; cursor: pointer;" onclick="window.KOINONIA_GAME.selectRealWorldSport('${spId}')">
              ${sp.icon || ''} ${sp.name || sp.title || spId}
            </button>
          `;
        });
        chipsEl.innerHTML = `
          <div style="font-size: 0.68rem; font-weight: 700; color: var(--brand-burgundy); margin-bottom: 4px; text-transform: uppercase; width: 100%;">
            Selected Sport Context:
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${chipsHtml}
          </div>
        `;
        chipsEl.style.display = 'block';
      } else {
        chipsEl.innerHTML = '';
        chipsEl.style.display = 'none';
      }
    }

    if (modal) modal.classList.remove('hidden');
  }

  function selectRealWorldSport(sportId) {
    if (!currentRwQuestId) return;
    openRealWorldQuestModal(currentRwQuestId, sportId);
  }

  function closeRealWorldQuestModal() {
    const modal = document.getElementById('realworld-quest-modal');
    if (modal) modal.classList.add('hidden');
  }

  function completeRealWorldQuest() {
    if (!currentRwQuestId) return;
    const sData = getSportsData();

    // Record through Personal Best Engine with actual sport context (score = 1 for completion)
    const result = sData.recordChallengeResult
      ? sData.recordChallengeResult(state, currentRwQuestId, 1, { sportId: currentRwQuestSportContext, scoreDisplay: 'Completed' })
      : { score: 1, sportId: currentRwQuestSportContext, isPersonalBest: true };

    saveToStorage('fitquest_realworld');
    updateCharacterProgressDisplays();
    updateLpDisplay();

    closeRealWorldQuestModal();
    showToast('✓ Real-World Fit Quest logged with integrity!');
    triggerEmote('💪');
  }

  function skipRealWorldQuest() {
    closeRealWorldQuestModal();
    showToast('⏸️ Quest skipped. Rest and recovery are healthy!');
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
    state.charXpMax = 10;
    state.highestLevelReached = 1;
    state.levelUpHistory = [];
    state.growthAreas = { stewardship: 0, responsibility: 0, service: 0, reflection: 0, discipline: 0, teamwork: 0 };
    state.skills = { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0, reflection: 0 };
    state.growthAreaRanks = {};
    state.milestones = {};
    state.unlockedMilestones = [];
    state.unlockedPerks = [];
    state.questProgress = {};
    state.trackedQuestId = 'Q-001';
    pendingLevelUpCelebration = null;
    state.gardenState = 'dry';
    state.gateOpen = false;
    state.fogCenterUnlocked = false;
    state.visitedFogCenter = false;
    state.unlockedPlaces = ['home'];
    state.visitedPlaces = ['home'];
    state.firstVisitedAt = { home: new Date().toISOString() };
    state.visitCount = { home: 1 };
    state.spokenToNpc = {};
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

    // Reset Phase 0.17 Campaigns & Events
    state.campaignProgress = {};
    state.activeCampaignIds = [];
    state.completedCampaignIds = [];
    state.eventParticipation = [];
    state.completedEventInstances = [];
    state.eventsAttendedCount = 0;
    state.eventQuestProgress = {};
    state.demoNow = null;

    // Reset Phase 0.18 Sports & Fit Quest
    state.fitQuestResults = {};
    state.fitQuestHistory = [];
    state.personalBests = {};
    state.fitQuestRewardClaims = {};
    state.sportsExplored = [];
    state.fitQuestMetrics = {
      completedCount: 0,
      personalBestsCount: 0,
      totalAttemptsCount: 0,
      sportsTriedCount: 0
    };
    state.selectedChallengeId = 'FQ-V001';

    // Reset Modular Quest Engine
    state.trackedQuestId = 'Q-001';
    state.questProgress = {};
    evaluateQuestAvailability();

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
    state.storageMeta.trackedQuestId = 'Q-001';

    initCollisionGrid();
    evaluateCharacterProgression('reset');
    updateCharacterProgressDisplays();
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

    // Phase 0.17: Events Hub buttons & card
    const btnOpenEvents = document.getElementById('header-events-btn') || document.getElementById('btn-open-events');
    if (btnOpenEvents) btnOpenEvents.addEventListener('click', () => openEventsHubModal('live'));

    const portraitEventsCard = document.getElementById('portrait-events-card');
    if (portraitEventsCard) portraitEventsCard.addEventListener('click', () => openEventsHubModal('live'));

    const btnCloseEvents = document.getElementById('btn-close-events');
    if (btnCloseEvents) btnCloseEvents.addEventListener('click', closeEventsHubModal);

    const btnCloseCampaign = document.getElementById('btn-close-campaign');
    if (btnCloseCampaign) btnCloseCampaign.addEventListener('click', closeCampaignModal);

    const btnCloseNoticeBoard = document.getElementById('btn-close-notice-board');
    if (btnCloseNoticeBoard) btnCloseNoticeBoard.addEventListener('click', closeNoticeBoardModal);

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
      const m = document.getElementById('world-map-modal');
      if (m) m.classList.add('hidden');
    });

    const btnCloseQuestsTab = document.getElementById('btn-close-quests-tab');
    if (btnCloseQuestsTab) btnCloseQuestsTab.addEventListener('click', () => {
      const m = document.getElementById('quests-tab-modal');
      if (m) m.classList.add('hidden');
    });

    const btnCloseJourney = document.getElementById('btn-close-journey');
    if (btnCloseJourney) btnCloseJourney.addEventListener('click', () => {
      const m = document.getElementById('journey-modal');
      if (m) m.classList.add('hidden');
    });

    const btnCloseMe = document.getElementById('btn-close-me');
    if (btnCloseMe) btnCloseMe.addEventListener('click', () => {
      const m = document.getElementById('me-modal');
      if (m) m.classList.add('hidden');
    });

    // Level Up Celebration Close Buttons
    const btnCloseLevelUp = document.getElementById('btn-close-level-up');
    if (btnCloseLevelUp) btnCloseLevelUp.addEventListener('click', closeLevelUpModal);

    const btnLevelUpContinue = document.getElementById('btn-level-up-continue');
    if (btnLevelUpContinue) btnLevelUpContinue.addEventListener('click', closeLevelUpModal);

    // Profile Sub-Tabs
    const profileTabs = ['growth', 'milestones', 'summary', 'activities'];
    profileTabs.forEach(tab => {
      const tabEl = document.getElementById(`profile-tab-${tab}`);
      if (tabEl) {
        tabEl.addEventListener('click', () => switchProfileTab(tab));
      }
    });

    // Level Badges & RPG Card click to open Profile
    const headerLevelPill = document.getElementById('header-level-pill');
    if (headerLevelPill) headerLevelPill.addEventListener('click', openMeModal);

    const portraitCard = document.getElementById('portrait-character-card');
    if (portraitCard) portraitCard.addEventListener('click', openMeModal);

    const canvasBadge = document.getElementById('canvas-level-badge');
    if (canvasBadge) canvasBadge.addEventListener('click', openMeModal);

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

    // Mini-Game Action & Stage Touch Handlers
    const mgActionBtn = document.getElementById('btn-minigame-action');
    if (mgActionBtn) {
      mgActionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMiniGameAction();
      });
      mgActionBtn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMiniGameAction();
      });
    }

    const mgCanvas = document.getElementById('minigame-canvas');
    if (mgCanvas) {
      mgCanvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMiniGameAction();
      });
    }

    const mgReactionScreen = document.getElementById('reaction-sprint-screen');
    if (mgReactionScreen) {
      mgReactionScreen.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleMiniGameAction();
      });
    }

    // URL parameter auto-navigation (for QA shortcuts)
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const openParam = urlParams.get('open');
        const playParam = urlParams.get('play');
        if (openParam === 'fitquest') {
          setTimeout(() => openFitQuestModal('play'), 300);
        } else if (playParam) {
          setTimeout(() => startMiniGame(playParam), 300);
        }
      } catch (err) {
        console.warn('URL auto-action failed:', err);
      }
    }

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
    evaluateQuestAvailability();
    evaluateCharacterProgression('init');
    initCollisionGrid();
    setupEventListeners();
    updateResponsiveState();
    updateLpDisplay();
    updateSkillDisplays();
    updateCharacterProgressDisplays();
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
    getState: () => state,
    camera,
    joystick,
    SAVE_STORAGE_KEY,
    SAVE_VERSION,
    createEventReadyQaState: (typeof data !== 'undefined' && data.createEventReadyQaState) ? data.createEventReadyQaState : null,
    initCollisionGrid,
    getCollisionGrid: () => collisionGrid,
    saveToStorage,
    loadFromStorage,
    resetPrototypeState,
    transitionToPlace,
    getInteractablesForPlace,
    getNearestInteractable,
    handleActionInteract,
    openDialogueModal,
    closeDialogueModal,
    getBarnabyDialogue,
    getGraceDialogue,
    getQuest,
    evaluateQuestAvailability,
    openQuestDetailModal,
    acceptQuest,
    exitToRealWorld,
    returnFromRealWorld,
    openVerificationModal,
    parentConfirmed,
    leaderConfirmed,
    eventAttendanceConfirmed,
    openReflectionModal,
    submitReflection,
    grantQuestRewards,
    applyWorldEffects,
    openQuestsTabModal,
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
    openWorldPlacesModal,
    isPlaceVisited,
    markPlaceVisited,
    syncUnlockedPlaces,
    getSpawnPoint,
    renderGenericPlace,
    renderSchoolWorld,
    renderSportsHubWorld,
    renderOutreachWorld,
    updatePlaceUiDisplays,
    updateLpDisplay,
    updateSkillDisplays,
    updateCharacterProgressDisplays,
    evaluateCharacterProgression,
    renderGrowthAreas,
    renderMilestones,
    renderJourneySummary,
    openLevelUpModal,
    closeLevelUpModal,
    getPendingLevelUpCelebration: () => pendingLevelUpCelebration,
    switchProfileTab,
    getProgressionData,
    updateDebugHud,

    // Phase 0.17: Campaigns & Events Engine
    getCurrentTime,
    setDemoNow,
    getDemoNow,
    startCampaign,
    completeCampaignChapter,
    getCampaignProgress,
    getCompletedChaptersCount,
    markEventAttended,
    isEventAttended,
    openEventsHubModal,
    closeEventsHubModal,
    switchEventsHubTab,
    renderEventsHub,
    openCampaignModal,
    closeCampaignModal,
    openNoticeBoardModal,
    closeNoticeBoardModal,

    // Phase 0.18: Sports & Fit Quest Exports
    getSportsData,
    openFitQuestModal,
    closeFitQuestModal,
    switchFitQuestTab,
    renderFitQuestHub,
    showMiniGameError,
    startMiniGame,
    exitMiniGame,
    retryMiniGame,
    finishMiniGame,
    handleMiniGameAction,
    shareMiniGameResult,
    shareSpecificResult,
    sharePersonalBest,
    openRealWorldQuestModal,
    closeRealWorldQuestModal,
    selectRealWorldSport,
    completeRealWorldQuest,
    skipRealWorldQuest,
    selectLeaderboardChallenge,

    init
  };

  root.KOINONIA_API = root.KOINONIA_GAME;

})();
