/**
 * KOINONIA — PHASE 0.12 GAME ENGINE
 * Portrait-First Mobile Gameplay + Orientation Strategy
 *
 * Key Architecture:
 * 1. Mobile Gameplay is PORTRAIT-FIRST:
 *    - Young users play directly in portrait; phone rotation is NOT required.
 *    - Tapping [ 🌿 ENTER WORLD ] on the Home card enters full-stage portrait RPG exploration.
 *    - Tapping [ ✕ EXIT WORLD ] in header returns smoothly to the Home card.
 * 2. Responsive Portrait Camera Viewport:
 *    - Canvas dynamically fills available stage space (width x height x dpr).
 *    - Camera centers and smoothly follows player avatar with room clamping and directional lookahead.
 *    - Logical room flows vertically (Bedroom -> Living -> Veranda -> Garden -> Gate).
 * 3. Paused Landscape Companion Screen:
 *    - If rotated to landscape on mobile phone, active gameplay pauses safely.
 *    - Branded Companion screen prompts user: "↻ Turn your phone upright to play".
 *    - Displays quick companion overview: Current Place, Active Quest, LP, Today's Focus.
 *    - Returning upright instantly auto-resumes gameplay at exact same coordinates.
 * 4. Desktop 3-Column Studio Preserved:
 *    - Centered 1560px max shell, expanding center canvas, zero black voids.
 * 5. Safari VisualViewport Resilience:
 *    - Dynamically adapts to Safari address bar collapse and system chrome using visualViewport.
 * 6. Diagnostics HUD (?debug=1):
 *    - Real-time display of camera, viewport, coordinates, orientation, and game mode.
 * 7. Approved Quest #001 Rewards:
 *    - Strictly +5 LP (120 -> 125 LP), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP.
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

  // Runtime State
  const state = {
    activePlaceId: 'home',
    lp: 120,
    charLevel: 1,
    charXp: 0,
    charXpMax: 100,
    skills: { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 },
    gardenState: 'dry', // 'dry' | 'lush'
    gateOpen: false,
    questStatus: 'ready', // 'ready' | 'active' | 'in_progress' | 'verified' | 'completed'
    audioMuted: true,
    audioContext: null,

    // Portrait-First Navigation & Gameplay State
    isPlayingGame: false,
    isPaused: false,
    activeNavTab: 'home',
    emoteBubble: null,
    emoteTimer: 0,

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

  // Collision Grid: 0 = walkable, 1 = solid
  let collisionGrid = [];
  let canvas, ctx, gameStage, appContainer;

  // Diagnostic HUD check (?debug=1)
  const isDebugMode = (typeof window !== 'undefined' && window.location) ?
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
      // Garden Gate (solid if closed)
      if (!state.gateOpen) {
        collisionGrid[11][10] = 1;
        collisionGrid[11][13] = 1;
      }
    }
  }

  function isWalkable(col, row) {
    const r = Math.floor(row);
    const c = Math.floor(col);
    if (r < 0 || r >= WORLD_ROWS || c < 0 || c >= WORLD_COLS) return false;
    return collisionGrid[r][c] === 0;
  }

  // ============================================================
  // 4. RESPONSIVE PORTRAIT CAMERA VIEWPORT ENGINE
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

  function resizeGameCanvas() {
    if (!canvas) canvas = document.getElementById('gameCanvas');
    if (!gameStage) gameStage = document.getElementById('game-stage');
    if (!canvas || !gameStage) return;

    // Update Safari visual viewport variable
    updateVisualViewportHeight();

    const rect = gameStage.getBoundingClientRect();
    const width = Math.floor(rect.width);
    const height = Math.floor(rect.height);

    if (width <= 0 || height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    camera.viewportWidth = width;
    camera.viewportHeight = height;
    camera.dpr = dpr;

    // Portrait-First Camera Zoom Calibration:
    // On portrait mobile (width <= 767px): zoom ~1.35x ensures ~8-9 horizontal tiles and ~14-16 vertical tiles visible
    // On desktop studio viewports (window >= 1200px or stage >= 850px): zoom ~1.6x for crisp high-density pixel art
    const isDesktop = (typeof window !== 'undefined' && window.matchMedia) ?
      window.matchMedia('(min-width: 1200px)').matches : (width >= 850);

    if (width <= 767) {
      camera.zoom = 1.35;
    } else if (isDesktop || width >= 850) {
      camera.zoom = 1.6;
    } else {
      camera.zoom = 1.45;
    }

    // Refresh Diagnostic HUD if active
    updateDebugHud();
  }

  function updateVisualViewportHeight() {
    if (typeof window === 'undefined') return;
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${vh}px`);
  }

  // ============================================================
  // 5. WORLD RENDERING (WARM PAINTERLY PIXEL ART, ZERO BLACK VOIDS)
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

    // Garden Patch
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
    } else {
      // Dry sprout / thirsty soil indicator
      ctx.fillStyle = '#8D6E63';
      ctx.font = '13px "Clear Sans", sans-serif';
      ctx.fillText('🥀 Thirsty Soil (Needs Water)', 4 * 32, 14 * 32);
    }
  }

  function renderFogCenterWorld(ctx) {
    ctx.fillStyle = '#F5ECE1';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    ctx.fillStyle = '#8D6E63';
    for (let r = 5; r <= 13; r += 2) {
      ctx.fillRect(3 * 32, r * 32, 8 * 32, 18);
      ctx.fillRect(14 * 32, r * 32, 8 * 32, 18);
    }
    ctx.fillStyle = '#6A0E04';
    ctx.fillRect(9 * 32, 2 * 32, 7 * 32, 40);
    renderNpc(ctx, 12, 3, '👩‍💼', 'Sister Grace', '#D22F0A');
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
  // 6. MAIN RENDER LOOP & DIAGNOSTIC HUD
  // ============================================================
  function render() {
    if (!ctx || !canvas) {
      requestAnimationFrame(render);
      return;
    }

    // If game is paused (e.g. mobile rotated to landscape), do not re-render active world
    if (state.isPaused) {
      requestAnimationFrame(render);
      return;
    }

    // Only render canvas if active on desktop or if in portrait active gameplay
    const isDesktop = window.matchMedia('(min-width: 1200px)').matches;
    if (!isDesktop && !state.isPlayingGame) {
      requestAnimationFrame(render);
      return;
    }

    updateCamera();

    // Clear whole canvas with environmental background tone
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#263124'; // Environmental deep courtyard tone
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Apply camera transformation
    ctx.save();
    ctx.scale(camera.dpr * camera.zoom, camera.dpr * camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Draw environmental grass/courtyard
    drawEnvironmentalSurroundings(ctx);

    // Render active place room
    if (state.activePlaceId === 'home') renderHomeWorld(ctx);
    else if (state.activePlaceId === 'fog_center') renderFogCenterWorld(ctx);
    else if (state.activePlaceId === 'school') renderSchoolWorld(ctx);
    else if (state.activePlaceId === 'sports_hub') renderSportsHubWorld(ctx);
    else if (state.activePlaceId === 'outreach') renderOutreachWorld(ctx);
    else renderHomeWorld(ctx);

    // Render player avatar
    renderAvatar(ctx);

    ctx.restore();

    // Decrement emote timer
    if (state.emoteTimer > 0) state.emoteTimer--;
    else state.emoteBubble = null;

    // Proximity check for NPC interaction
    updateProximity();

    // Update diagnostic HUD
    if (isDebugMode) updateDebugHud();

    requestAnimationFrame(render);
  }

  function updateDebugHud() {
    const hud = document.getElementById('debug-hud');
    if (!hud) return;
    if (!isDebugMode) {
      hud.classList.remove('visible');
      return;
    }
    hud.classList.add('visible');

    const isPhonePortrait = window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
    const isDesktop = window.matchMedia('(min-width: 1200px)').matches;
    const visibleTilesX = (camera.viewportWidth / camera.zoom / TILE_SIZE).toFixed(1);
    const visibleTilesY = (camera.viewportHeight / camera.zoom / TILE_SIZE).toFixed(1);

    hud.innerHTML = `
      <strong>KOINONIA Phase 0.12 HUD</strong><br>
      Shell: ${isPhonePortrait ? 'Portrait Mobile' : isDesktop ? 'Desktop Studio' : 'Landscape/Tablet'}<br>
      Mode: ${state.isPlayingGame ? 'PORTRAIT ACTIVE GAME' : 'PORTRAIT HOME CARD'} | Paused: ${state.isPaused}<br>
      Viewport: ${camera.viewportWidth}x${camera.viewportHeight}px | DPR: ${camera.dpr} | Zoom: ${camera.zoom}x<br>
      Visible World: ${Math.round(camera.viewportWidth / camera.zoom)}x${Math.round(camera.viewportHeight / camera.zoom)}px (${visibleTilesX}x${visibleTilesY} tiles)<br>
      Camera: (${Math.round(camera.x)}, ${Math.round(camera.y)}) | Pos: (${state.avatar.x.toFixed(2)}, ${state.avatar.y.toFixed(2)})<br>
      LP: ${state.lp} | Quest: ${state.questStatus}
    `;
  }

  // ============================================================
  // 7. PLAYER MOVEMENT & COLLISION
  // ============================================================
  const keys = {};

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

  function updatePlayerMovement() {
    if (state.isPaused) return;
    const isDesktop = window.matchMedia('(min-width: 1200px)').matches;
    if (!isDesktop && !state.isPlayingGame) return;

    const av = state.avatar;
    let dx = 0;
    let dy = 0;

    if (keys['arrowup'] || keys['w']) { dy -= 1; av.dir = 'up'; }
    if (keys['arrowdown'] || keys['s']) { dy += 1; av.dir = 'down'; }
    if (keys['arrowleft'] || keys['a']) { dx -= 1; av.dir = 'left'; }
    if (keys['arrowright'] || keys['d']) { dx += 1; av.dir = 'right'; }

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      const step = (av.speed / 60) * (1 / length);
      const nextX = av.x + dx * step;
      const nextY = av.y + dy * step;

      if (isWalkable(nextX, av.y)) av.x = nextX;
      if (isWalkable(av.x, nextY)) av.y = nextY;
      av.isMoving = true;
    } else {
      av.isMoving = false;
    }
  }

  setInterval(updatePlayerMovement, 1000 / 60);

  // Proximity Detection
  function updateProximity() {
    const prompt = document.getElementById('proximity-prompt');
    if (!prompt) return;

    if (state.activePlaceId === 'home') {
      const dist = Math.hypot(state.avatar.x - 10, state.avatar.y - 6);
      if (dist < 2.5 && !state.dialogue.active) {
        prompt.classList.remove('hidden');
        return;
      }
    }
    prompt.classList.add('hidden');
  }

  function handleActionInteract() {
    if (state.activePlaceId === 'home') {
      const dist = Math.hypot(state.avatar.x - 10, state.avatar.y - 6);
      if (dist < 2.8) {
        openDialogueModal();
        return;
      }
    }
    // Fallback: open active quest modal
    openQuestDetailModal('Q-001');
  }

  function triggerEmote(emoji) {
    state.emoteBubble = emoji;
    state.emoteTimer = 120; // 2 seconds @ 60fps
    playBellSound();
  }

  // ============================================================
  // 8. PORTRAIT-FIRST GAMEPLAY TRANSITIONS
  // ============================================================
  function enterWorldFromHomeCard() {
    state.isPlayingGame = true;
    if (appContainer) {
      appContainer.classList.add('playing-game');
    }
    resizeGameCanvas();
    playBellSound();
  }

  function exitWorldToHomeCard() {
    state.isPlayingGame = false;
    if (appContainer) {
      appContainer.classList.remove('playing-game');
    }
  }

  // Orientation State Machine & Companion Screen Handling
  function checkOrientation() {
    const isMobileLandscape = window.matchMedia('(max-width: 932px) and (orientation: landscape) and (max-height: 560px)').matches;
    const companionScreen = document.getElementById('landscape-companion-screen');

    if (isMobileLandscape) {
      // Phone is held in landscape: pause active game & show companion
      state.isPaused = true;
      if (companionScreen) companionScreen.style.display = 'flex';

      // Update companion overview data
      const compPlace = document.getElementById('companion-place');
      const compQuest = document.getElementById('companion-quest');
      const compLp = document.getElementById('companion-lp');
      const compVirtue = document.getElementById('companion-virtue');
      if (compPlace) compPlace.textContent = PLACES[state.activePlaceId] ? PLACES[state.activePlaceId].name : 'My Home';
      if (compQuest) compQuest.textContent = state.questStatus === 'completed' ? 'Completed' : 'Garden Care';
      if (compLp) compLp.textContent = `${state.lp} LP`;
      if (compVirtue) compVirtue.textContent = 'Stewardship';
    } else {
      // Phone is in portrait (or user is on desktop): hide companion & resume
      if (companionScreen) companionScreen.style.display = 'none';
      if (state.isPaused) {
        state.isPaused = false;
        // Resume directly at exact avatar coordinates
        resizeGameCanvas();
      }
    }
  }

  // ============================================================
  // 9. QUEST LIFECYCLE & APPROVED REWARDS (+5 LP: 120 -> 125)
  // ============================================================
  function openDialogueModal() {
    state.dialogue.active = true;
    const modal = document.getElementById('npc-dialogue-modal');
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

  function acceptQuest() {
    document.getElementById('quest-detail-modal').classList.add('hidden');
    state.questStatus = 'in_progress';
    const exitModal = document.getElementById('exit-ramp-modal');
    if (exitModal) exitModal.classList.remove('hidden');
  }

  function exitToRealWorld() {
    document.getElementById('exit-ramp-modal').classList.add('hidden');
    const standbyModal = document.getElementById('standby-modal');
    if (standbyModal) standbyModal.classList.remove('hidden');
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
    document.getElementById('reflection-modal').classList.add('hidden');

    // Grant Approved Quest #001 Rewards:
    // +5 LP (120 -> 125 LP), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP
    state.lp += 5;
    state.charXp = (state.charXp || 0) + 5;
    state.skills.stewardship += 15;
    state.skills.responsibility += 5;
    state.gardenState = 'lush';
    state.gateOpen = true;
    state.questStatus = 'completed';
    initCollisionGrid(); // Rebuild grid with gate open

    // Update UI elements across all shells
    updateLpDisplay();
    updateSkillDisplays();

    // Show Reward Celebration Screen
    const rewardModal = document.getElementById('reward-modal');
    if (rewardModal) rewardModal.classList.remove('hidden');
    playBellSound();
  }

  function closeRewardScreen() {
    document.getElementById('reward-modal').classList.add('hidden');
    showToast('✨ Garden bloomed! Gate unlocked!');
  }

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

  function showToast(msg) {
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
  // 10. NAVIGATION TAB VIEW SWITCHING
  // ============================================================
  function switchNavTab(tabName) {
    state.activeNavTab = tabName;

    // Update bottom nav active classes
    const tabs = ['home', 'world', 'quests', 'journey', 'me'];
    tabs.forEach(t => {
      const btn = document.getElementById(`nav-tab-${t}`);
      if (btn) {
        if (t === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
      }
    });

    // Close any open tab modals first
    document.getElementById('world-map-modal').classList.add('hidden');
    document.getElementById('quests-tab-modal').classList.add('hidden');
    document.getElementById('journey-modal').classList.add('hidden');
    document.getElementById('me-modal').classList.add('hidden');

    if (tabName === 'home') {
      // Return to Home play card
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
      list.innerHTML = Object.values(PLACES).map(p => `
        <div class="team-chip" style="cursor: pointer; padding: 12px;" onclick="window.KOINONIA_GAME.selectPlace('${p.id}')">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.6rem;">${p.emblem || '📍'}</span>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: var(--brand-burgundy);">${p.name}</div>
              <div style="font-size: 0.7rem; color: var(--brand-fire-orange); font-weight: 700;">${p.zone || p.tagline}</div>
            </div>
          </div>
          <span style="font-size: 0.75rem; font-weight: 800; color: var(--brand-burgundy);">${p.status || 'Active'}</span>
        </div>
      `).join('');
    }
    document.getElementById('world-map-modal').classList.remove('hidden');
  }

  function openQuestsTabModal() {
    const list = document.getElementById('quests-tab-list');
    if (list) {
      list.innerHTML = QUESTS.map(q => `
        <div class="team-chip" style="padding: 12px;">
          <div>
            <div style="font-weight: 800; font-size: 0.9rem; color: var(--brand-burgundy);">${q.title}</div>
            <div style="font-size: 0.72rem; color: var(--brand-charcoal); opacity: 0.85; margin: 3px 0;">${q.realWorldAction}</div>
            <div style="font-size: 0.65rem; font-weight: 700; color: var(--brand-fire-orange);">${q.rewards ? q.rewards.lp + ' LP • ' + q.rewards.xp + ' XP' : ''}</div>
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
  // 11. AUDIO ENGINE (MUTED BY DEFAULT, CLEAN PENTATONIC CHIMES)
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
  // 12. PROTOTYPE STATE RESET
  // ============================================================
  function resetPrototypeState() {
    state.lp = 120;
    state.charLevel = 1;
    state.charXp = 0;
    state.skills = { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 };
    state.gardenState = 'dry';
    state.gateOpen = false;
    state.questStatus = 'ready';
    state.isPlayingGame = false;
    state.isPaused = false;
    state.avatar.x = 4.5;
    state.avatar.y = 14.5;
    state.avatar.dir = 'down';

    initCollisionGrid();
    updateLpDisplay();
    updateSkillDisplays();
    exitWorldToHomeCard();

    // Close open modals
    const openModals = document.querySelectorAll('.modal-backdrop:not(#title-screen)');
    openModals.forEach(m => m.classList.add('hidden'));

    showToast('🔄 Prototype State Reset');
  }

  // ============================================================
  // 13. KOINONIA STUDIO ADMIN 7-STEP WIZARD
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

    const prevBtn = document.getElementById('btn-wizard-prev');
    const nextBtn = document.getElementById('btn-wizard-next');
    if (prevBtn) prevBtn.style.display = (state.wizardStep > 1) ? 'block' : 'none';
    if (nextBtn) nextBtn.textContent = (state.wizardStep === 7) ? 'Create Custom Place' : 'Next Step';
  }

  function advanceWizard() {
    if (state.wizardStep < 7) {
      state.wizardStep++;
      updateWizardUI();
    } else {
      // Complete creation safely
      const name = document.getElementById('wizard-place-name').value || 'Custom Place';
      const id = 'custom_' + Date.now();
      state.customPlaces[id] = { id, name, zone: 'Sanctuary Bower', status: 'Custom Active' };
      document.getElementById('admin-studio-modal').classList.add('hidden');
      showToast(`✨ Created custom place: ${name}`);
    }
  }

  function rewindWizard() {
    if (state.wizardStep > 1) {
      state.wizardStep--;
      updateWizardUI();
    }
  }

  // ============================================================
  // 14. EVENT LISTENERS SETUP
  // ============================================================
  function setupEventListeners() {
    appContainer = document.getElementById('app-container');
    canvas = document.getElementById('gameCanvas');
    if (canvas) ctx = canvas.getContext('2d');
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

    // Exit World button in Header
    const btnExitWorld = document.getElementById('btn-exit-world');
    if (btnExitWorld) {
      btnExitWorld.addEventListener('click', exitWorldToHomeCard);
    }

    // Audio & Reset buttons
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) audioBtn.addEventListener('click', toggleAudio);

    const resetBtn = document.getElementById('dev-reset-btn');
    if (resetBtn) resetBtn.addEventListener('click', resetPrototypeState);

    const adminBtn = document.getElementById('btn-open-admin');
    if (adminBtn) adminBtn.addEventListener('click', openAdminStudio);

    // Quick Action shortcuts on Home Card
    const btnQuickWorld = document.getElementById('btn-quick-world-portrait');
    if (btnQuickWorld) btnQuickWorld.addEventListener('click', openWorldPlacesModal);

    const btnQuickQuests = document.getElementById('btn-quick-quests-portrait');
    if (btnQuickQuests) btnQuickQuests.addEventListener('click', openQuestsTabModal);

    // Floating Quest Chip on canvas
    const compactQuestChip = document.getElementById('compact-quest-chip');
    if (compactQuestChip) {
      compactQuestChip.addEventListener('click', () => openQuestDetailModal('Q-001'));
    }

    // Dialogue modal buttons
    const btnDiagAction = document.getElementById('btn-dialogue-action');
    if (btnDiagAction) btnDiagAction.addEventListener('click', () => openQuestDetailModal('Q-001'));

    const btnDiagClose = document.getElementById('btn-dialogue-close');
    if (btnDiagClose) btnDiagClose.addEventListener('click', closeDialogueModal);

    // Quest Detail modal
    const btnAcceptQuest = document.getElementById('btn-accept-quest');
    if (btnAcceptQuest) btnAcceptQuest.addEventListener('click', acceptQuest);

    const btnCloseQuestDetail = document.getElementById('btn-close-quest-detail');
    if (btnCloseQuestDetail) {
      btnCloseQuestDetail.addEventListener('click', () => {
        document.getElementById('quest-detail-modal').classList.add('hidden');
      });
    }

    // Exit Ramp & Standby
    const btnExitRealWorld = document.getElementById('btn-exit-to-real-world');
    if (btnExitRealWorld) btnExitRealWorld.addEventListener('click', exitToRealWorld);

    const btnReturnCompleted = document.getElementById('btn-return-completed');
    if (btnReturnCompleted) btnReturnCompleted.addEventListener('click', returnFromRealWorld);

    const btnFamilyConfirm = document.getElementById('btn-family-confirm');
    if (btnFamilyConfirm) btnFamilyConfirm.addEventListener('click', parentConfirmed);

    const btnSubmitReflection = document.getElementById('btn-submit-reflection');
    if (btnSubmitReflection) btnSubmitReflection.addEventListener('click', submitReflection);

    const btnCloseReward = document.getElementById('btn-close-reward');
    if (btnCloseReward) btnCloseReward.addEventListener('click', closeRewardScreen);

    // Close Tab modals
    const closeWorldBtn = document.getElementById('btn-close-world-map');
    if (closeWorldBtn) closeWorldBtn.addEventListener('click', () => document.getElementById('world-map-modal').classList.add('hidden'));

    const closeQuestsBtn = document.getElementById('btn-close-quests-tab');
    if (closeQuestsBtn) closeQuestsBtn.addEventListener('click', () => document.getElementById('quests-tab-modal').classList.add('hidden'));

    const closeJourneyBtn = document.getElementById('btn-close-journey');
    if (closeJourneyBtn) closeJourneyBtn.addEventListener('click', () => document.getElementById('journey-modal').classList.add('hidden'));

    const closeMeBtn = document.getElementById('btn-close-me');
    if (closeMeBtn) closeMeBtn.addEventListener('click', () => document.getElementById('me-modal').classList.add('hidden'));

    const closeAdminBtn = document.getElementById('btn-close-admin-studio');
    if (closeAdminBtn) closeAdminBtn.addEventListener('click', () => document.getElementById('admin-studio-modal').classList.add('hidden'));

    // Admin Wizard buttons
    const btnWizNext = document.getElementById('btn-wizard-next');
    if (btnWizNext) btnWizNext.addEventListener('click', advanceWizard);

    const btnWizPrev = document.getElementById('btn-wizard-prev');
    if (btnWizPrev) btnWizPrev.addEventListener('click', rewindWizard);

    // Me tab quick actions
    const btnAdminFromMe = document.getElementById('btn-open-admin-from-me');
    if (btnAdminFromMe) {
      btnAdminFromMe.addEventListener('click', () => {
        document.getElementById('me-modal').classList.add('hidden');
        openAdminStudio();
      });
    }

    // Bottom Navigation tabs
    const navTabs = ['home', 'world', 'quests', 'journey', 'me'];
    navTabs.forEach(tab => {
      const tabEl = document.getElementById(`nav-tab-${tab}`);
      if (tabEl) {
        tabEl.addEventListener('click', () => switchNavTab(tab));
      }
    });

    // Touch D-Pad Controls Setup
    setupDpadTouch('dpad-up', 'arrowup', 'up');
    setupDpadTouch('dpad-down', 'arrowdown', 'down');
    setupDpadTouch('dpad-left', 'arrowleft', 'left');
    setupDpadTouch('dpad-right', 'arrowright', 'right');

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

    // Responsive and Orientation Listeners
    window.addEventListener('resize', () => {
      checkOrientation();
      resizeGameCanvas();
    });

    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        checkOrientation();
        resizeGameCanvas();
      }, 100);
    });

    // Safari Visual Viewport listeners
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        updateVisualViewportHeight();
        resizeGameCanvas();
      });
      window.visualViewport.addEventListener('scroll', () => {
        updateVisualViewportHeight();
      });
    }
  }

  function setupDpadTouch(elemId, keyName, dir) {
    const btn = document.getElementById(elemId);
    if (!btn) return;

    const startHandler = (e) => {
      e.preventDefault();
      keys[keyName] = true;
      state.avatar.dir = dir;
    };

    const endHandler = (e) => {
      e.preventDefault();
      keys[keyName] = false;
    };

    btn.addEventListener('pointerdown', startHandler);
    btn.addEventListener('pointerup', endHandler);
    btn.addEventListener('pointercancel', endHandler);
    btn.addEventListener('touchstart', startHandler, { passive: false });
    btn.addEventListener('touchend', endHandler, { passive: false });
  }

  // ============================================================
  // 15. INITIALIZATION
  // ============================================================
  function init() {
    initCollisionGrid();
    setupEventListeners();
    checkOrientation();
    resizeGameCanvas();
    updateLpDisplay();
    updateSkillDisplays();
    requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export safe API for tests and inspection
  root.KOINONIA_GAME = {
    state,
    camera,
    resizeGameCanvas,
    updateCamera,
    checkOrientation,
    enterWorldFromHomeCard,
    exitWorldToHomeCard,
    handleActionInteract,
    submitReflection,
    resetPrototypeState,
    selectPlace: (id) => {
      if (PLACES[id] || state.customPlaces[id]) {
        state.activePlaceId = id;
        document.getElementById('world-map-modal').classList.add('hidden');
        document.getElementById('canvas-place-label').textContent = (PLACES[id] || state.customPlaces[id]).name;
        document.getElementById('portrait-place-title').textContent = (PLACES[id] || state.customPlaces[id]).name;
        showToast(`Entered ${(PLACES[id] || state.customPlaces[id]).name}`);
      }
    }
  };

})();
