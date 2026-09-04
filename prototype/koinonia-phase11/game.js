/**
 * KOINONIA — PHASE 0.11 GAME ENGINE
 * Responsive Game Shell + Mobile Landscape Play Mode + Desktop Layout Repair
 *
 * Key Architecture:
 * 1. Responsive Camera Viewport (Dynamic canvas sizing to stage.clientWidth/Height, no letterboxing)
 * 2. Landscape-First Mobile RPG Experience (Full viewport, on-screen controls, compact HUD)
 * 3. Mobile Portrait Browsing Mode (Play card with Rotate to Play flow)
 * 4. Desktop 3-Column Studio Grid (Expanding central game canvas, zero black void)
 * 5. Approved Quest #001 Rewards (+5 LP: 120 -> 125, +5 Char XP, +15 Stewardship, +5 Responsibility)
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

    // Orientation & Layout Mode
    isLandscape: false,
    forcePortraitPlay: false,
    activeNavTab: 'home',

    // Avatar
    avatar: {
      x: 4.5,
      y: 14.5,
      targetX: null,
      targetY: null,
      speed: 4.0,
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
    zoom: 1.4,
    viewportWidth: 800,
    viewportHeight: 576,
    dpr: 1
  };

  // Collision Grid: 0 = walkable, 1 = solid
  let collisionGrid = [];
  let canvas, ctx, gameStage;

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
  // 4. RESPONSIVE CAMERA VIEWPORT ENGINE
  // ============================================================
  function updateCamera() {
    const visibleW = camera.viewportWidth / camera.zoom;
    const visibleH = camera.viewportHeight / camera.zoom;
    const playerPixelX = state.avatar.x * TILE_SIZE;
    const playerPixelY = state.avatar.y * TILE_SIZE;

    let targetX = playerPixelX - visibleW / 2;
    let targetY = playerPixelY - visibleH / 2;

    // Clamping & Centering
    if (visibleW >= LOGICAL_WIDTH) {
      // Stage is wider than world -> center the world horizontally
      targetX = (LOGICAL_WIDTH - visibleW) / 2;
    } else {
      targetX = Math.max(0, Math.min(LOGICAL_WIDTH - visibleW, targetX));
    }

    if (visibleH >= LOGICAL_HEIGHT) {
      // Stage is taller than world -> center the world vertically
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

    // Responsive Camera Zoom Calculation
    // On mobile phone landscape (height < 460px): zoom ~1.25x for expansive view
    // On desktop large viewports (width >= 1200px): zoom ~1.5x - 1.7x for crisp pixel art
    if (height < 460 || width < 700) {
      camera.zoom = 1.25;
    } else if (width >= 1200) {
      camera.zoom = 1.6;
    } else {
      camera.zoom = 1.4;
    }
  }

  // ============================================================
  // 5. WORLD RENDERING (ZERO BLACK VOID ENVIRONMENT)
  // ============================================================

  // Environmental surrounds drawn outside the room bounds
  function drawEnvironmentalSurroundings(ctx) {
    // Rich, warm courtyard lawn outside room borders
    ctx.fillStyle = '#222C20';
    ctx.fillRect(-200, -200, LOGICAL_WIDTH + 400, LOGICAL_HEIGHT + 400);

    // Subtle grass texture
    ctx.fillStyle = '#2D3A2B';
    for (let x = -160; x < LOGICAL_WIDTH + 160; x += 48) {
      for (let y = -160; y < LOGICAL_HEIGHT + 160; y += 48) {
        if (x < 0 || x > LOGICAL_WIDTH || y < 0 || y > LOGICAL_HEIGHT) {
          ctx.fillRect(x, y, 4, 8);
          ctx.fillRect(x + 12, y + 16, 4, 8);
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
    ctx.font = '10px "Clear Sans", sans-serif';
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
      ctx.font = '14px "Clear Sans", sans-serif';
      ctx.fillText('🥀 Thirsty Soil (Needs Water)', 4 * 32, 14 * 32);
    }
  }

  function renderFogCenterWorld(ctx) {
    ctx.fillStyle = '#F5ECE1';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Pews
    ctx.fillStyle = '#8D6E63';
    for (let r = 5; r <= 13; r += 2) {
      ctx.fillRect(3 * 32, r * 32, 8 * 32, 18);
      ctx.fillRect(14 * 32, r * 32, 8 * 32, 18);
    }
    // Altar
    ctx.fillStyle = '#6A0E04';
    ctx.fillRect(9 * 32, 2 * 32, 7 * 32, 40);
    renderNpc(ctx, 12, 3, '👩‍💼', 'Sister Grace', '#D22F0A');
  }

  function renderSchoolWorld(ctx) {
    ctx.fillStyle = '#EFEBE9';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Chalkboard
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(7 * 32, 1 * 32, 11 * 32, 36);
    renderNpc(ctx, 12, 3, '👨‍🏫', 'Brother David', '#2E7D32');
  }

  function renderSportsHubWorld(ctx) {
    ctx.fillStyle = '#D7CCC8';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Hardwood court lines
    ctx.strokeStyle = '#D22F0A';
    ctx.lineWidth = 3;
    ctx.strokeRect(3 * 32, 3 * 32, 19 * 32, 12 * 32);
    renderNpc(ctx, 12, 5, '🏃', 'Coach Marcus', '#EB5F12');
  }

  function renderOutreachWorld(ctx) {
    ctx.fillStyle = '#E0F2F1';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Supply tables
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

    // NPC Emoji / Sprite
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
    } else if (av.dir === 'up') {
      // Back of head
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
  }

  // Main Render Loop
  function render() {
    if (!ctx || !canvas) return;

    // Check if phone portrait mode on home tab: if so, we don't render stage
    const isPhonePortrait = window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
    if (isPhonePortrait && state.activeNavTab === 'home' && !state.forcePortraitPlay) {
      requestAnimationFrame(render);
      return;
    }

    updateCamera();

    // Clear whole canvas with environmental tone
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

    // Render avatar
    renderAvatar(ctx);

    ctx.restore();

    // Proximity check for NPC interaction
    updateProximity();

    requestAnimationFrame(render);
  }

  // ============================================================
  // 6. PLAYER MOVEMENT & COLLISION
  // ============================================================
  const keys = {};

  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
      handleActionInteract();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  function updatePlayerMovement() {
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
    // Fallback: open current quest
    openQuestDetailModal('Q-001');
  }

  // ============================================================
  // 7. QUEST LIFECYCLE & APPROVED REWARDS (+5 LP: 120 -> 125)
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

    // Grant Approved Quest #001 Rewards: +5 LP (120 -> 125 LP), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP
    state.lp += 5;
    state.charXp = (state.charXp || 0) + 5;
    state.skills.stewardship += 15;
    state.skills.responsibility += 5;
    state.gardenState = 'lush';
    state.gateOpen = true;
    initCollisionGrid(); // Rebuild grid with gate open

    // Update UI elements
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
  // 8. ORIENTATION & RESPONSIVE STATE MACHINE
  // ============================================================
  function checkOrientation() {
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    const isPhonePortrait = window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches;
    state.isLandscape = isLandscape;

    const rotateModal = document.getElementById('rotate-prompt-modal');
    const portraitHome = document.getElementById('portrait-home-view');
    const gameStage = document.getElementById('game-stage');

    if (isLandscape) {
      // Auto-dismiss Rotate to Play modal when rotated!
      if (rotateModal) rotateModal.classList.remove('active');

      if (portraitHome) portraitHome.style.display = 'none';
      if (gameStage) gameStage.style.display = 'block';

      resizeGameCanvas();
    } else {
      // In portrait
      if (isPhonePortrait) {
        if (state.activeNavTab === 'home' && !state.forcePortraitPlay) {
          if (portraitHome) portraitHome.style.display = 'block';
          if (gameStage) gameStage.style.display = 'none';
        }
      } else {
        // Tablet / Desktop
        if (portraitHome) portraitHome.style.display = 'none';
        if (gameStage) gameStage.style.display = 'block';
        resizeGameCanvas();
      }
    }
  }

  function enterWorldFromPortrait() {
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    if (isLandscape || isDesktop) {
      // Already in landscape or desktop: go directly to canvas
      state.forcePortraitPlay = true;
      checkOrientation();
      resizeGameCanvas();
    } else {
      // On mobile portrait: show the polished Rotate to Play experience
      const rotateModal = document.getElementById('rotate-prompt-modal');
      if (rotateModal) rotateModal.classList.add('active');

      // Attempt Screen Orientation lock if available
      try {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {
            // Rejection is expected in Safari / desktop browsers
          });
        }
      } catch (e) {}
    }
  }

  // ============================================================
  // 9. NAVIGATION TAB VIEW SWITCHING
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

    // Close any other open full modals
    ['world-map-modal', 'quests-tab-modal', 'journey-modal', 'me-modal'].forEach(mId => {
      const m = document.getElementById(mId);
      if (m) m.classList.add('hidden');
    });

    if (tabName === 'home') {
      checkOrientation();
    } else if (tabName === 'world') {
      openWorldMap();
    } else if (tabName === 'quests') {
      openQuestsTab();
    } else if (tabName === 'journey') {
      openJourneyTab();
    } else if (tabName === 'me') {
      openMeTab();
    }
  }

  function openWorldMap() {
    populateWorldMapList();
    const modal = document.getElementById('world-map-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function populateWorldMapList() {
    const list = document.getElementById('world-places-list');
    if (!list) return;
    list.innerHTML = '';

    const placesArray = Object.values(PLACES);
    placesArray.forEach(p => {
      const card = document.createElement('div');
      card.className = 'team-chip';
      card.style.cursor = 'pointer';
      card.style.padding = '12px 14px';

      const isCurrent = p.id === state.activePlaceId;
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.6rem;">${p.icon || '📍'}</span>
          <div>
            <div style="font-weight: 800; color: var(--brand-burgundy); font-size: 0.95rem;">${p.name}</div>
            <div style="font-size: 0.72rem; color: var(--brand-charcoal); opacity: 0.75;">${p.tagline || ''}</div>
          </div>
        </div>
        <div>
          ${isCurrent ? '<span class="lifecycle-chip">CURRENT</span>' : '<button class="secondary-btn" style="font-size: 0.75rem;">VISIT</button>'}
        </div>
      `;

      card.onclick = () => {
        travelToPlace(p.id);
        document.getElementById('world-map-modal').classList.add('hidden');
      };

      list.appendChild(card);
    });
  }

  function travelToPlace(placeId) {
    if (!PLACES[placeId]) return;
    state.activePlaceId = placeId;
    const p = PLACES[placeId];

    // Update watermark chip
    const icon = document.getElementById('canvas-place-icon');
    const label = document.getElementById('canvas-place-label');
    const chip = document.getElementById('canvas-place-lifecycle');
    if (icon) icon.textContent = p.icon || '📍';
    if (label) label.textContent = p.name;
    if (chip) chip.textContent = p.lifecycleState || 'Fellowship';

    // Update portrait play card
    const portIcon = document.getElementById('portrait-place-emblem');
    const portTitle = document.getElementById('portrait-place-title');
    if (portIcon) portIcon.textContent = p.icon || '📍';
    if (portTitle) portTitle.textContent = p.name;

    // Reset avatar coordinates to center
    state.avatar.x = 12.5;
    state.avatar.y = 9.5;
    initCollisionGrid();

    showToast(`🕊️ Arrived at ${p.name}`);
  }

  function openQuestsTab() {
    populateQuestsTab();
    const modal = document.getElementById('quests-tab-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function populateQuestsTab() {
    const list = document.getElementById('quests-tab-list');
    if (!list) return;
    list.innerHTML = '';

    const questsForPlace = QUESTS.filter(q => q.placeId === state.activePlaceId);
    questsForPlace.forEach(q => {
      const item = document.createElement('div');
      item.className = 'team-chip';
      item.style.padding = '12px';
      item.style.marginBottom = '6px';
      item.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 10px;">
          <span style="font-size: 1.5rem;">${q.icon || '🌱'}</span>
          <div>
            <div style="font-weight: 800; color: var(--brand-burgundy); font-size: 0.9rem;">${q.title}</div>
            <div style="font-size: 0.74rem; color: var(--brand-charcoal); opacity: 0.8; margin-top: 2px;">${q.description}</div>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <span style="font-size: 0.68rem; font-weight: 800; color: var(--brand-fire-orange);">+${q.rewards.lp} LP</span>
              <span style="font-size: 0.68rem; font-weight: 700; color: var(--brand-charcoal); opacity: 0.7;">${q.verification}</span>
            </div>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
  }

  function openJourneyTab() {
    populateJourneyTimeline();
    const modal = document.getElementById('journey-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function populateJourneyTimeline() {
    const list = document.getElementById('journey-timeline-list');
    if (!list) return;
    list.innerHTML = '';

    const milestones = [
      { date: 'Sep 4, 2026', title: 'Steward of the Garden Completed', note: 'Watered domestic veranda plants. +5 Life Points.' },
      { date: 'Aug 28, 2026', title: 'AYS Week of Questions', note: 'Shared intercessory questions with fellowship circle.' },
      { date: 'Aug 14, 2026', title: 'FOG Youth Basketball Day', note: '68–62 victory. Scored 18 points (+3 Personal Best).' }
    ];

    milestones.forEach(m => {
      const card = document.createElement('div');
      card.className = 'team-chip';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'flex-start';
      card.style.gap = '4px';
      card.innerHTML = `
        <span style="font-size: 0.68rem; font-weight: 800; color: var(--brand-fire-orange);">${m.date}</span>
        <strong style="font-size: 0.88rem; color: var(--brand-burgundy);">${m.title}</strong>
        <p style="font-size: 0.76rem; color: var(--brand-charcoal); opacity: 0.85;">${m.note}</p>
      `;
      list.appendChild(card);
    });
  }

  function openMeTab() {
    const modal = document.getElementById('me-modal');
    if (modal) modal.classList.remove('hidden');
  }

  // ============================================================
  // 10. KOINONIA STUDIO 7-STEP ADMIN WIZARD
  // ============================================================
  function openAdminStudio() {
    state.wizardStep = 1;
    updateWizardUI();
    const modal = document.getElementById('admin-studio-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function updateWizardUI() {
    const stepNum = document.getElementById('wizard-step-num');
    if (stepNum) stepNum.textContent = state.wizardStep;

    for (let i = 1; i <= 7; i++) {
      const el = document.getElementById(`step-${i}-content`);
      if (el) el.style.display = (i === state.wizardStep) ? 'block' : 'none';
    }

    const prevBtn = document.getElementById('btn-wizard-prev');
    const nextBtn = document.getElementById('btn-wizard-next');
    if (prevBtn) prevBtn.style.display = state.wizardStep > 1 ? 'block' : 'none';
    if (nextBtn) {
      nextBtn.textContent = state.wizardStep === 7 ? '✓ REGISTER PLACE' : 'Next Step';
    }
  }

  function wizardNext() {
    if (state.wizardStep < 7) {
      state.wizardStep++;
      updateWizardUI();
    } else {
      // Register custom place safely without eval
      const placeName = document.getElementById('wizard-place-name')?.value || 'New Fellowship Bower';
      showToast(`✨ Registered Place: ${placeName}`);
      document.getElementById('admin-studio-modal').classList.add('hidden');
    }
  }

  function wizardPrev() {
    if (state.wizardStep > 1) {
      state.wizardStep--;
      updateWizardUI();
    }
  }

  // ============================================================
  // 11. AUDIO ENGINE (MUTED BY DEFAULT)
  // ============================================================
  function toggleAudio() {
    state.audioMuted = !state.audioMuted;
    const btn = document.getElementById('audio-toggle-btn');
    const icon = document.getElementById('audio-icon');

    if (state.audioMuted) {
      btn.classList.add('muted');
      icon.textContent = '🔈';
      showToast('Audio muted');
    } else {
      btn.classList.remove('muted');
      icon.textContent = '🔊';
      playBellSound();
      showToast('Audio enabled');
    }
  }

  function playBellSound() {
    if (state.audioMuted) return;
    try {
      if (!state.audioContext) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        state.audioContext = new AudioContext();
      }
      if (state.audioContext.state === 'suspended') {
        state.audioContext.resume();
      }
      const osc = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, state.audioContext.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, state.audioContext.currentTime + 0.15); // E5
      gain.gain.setValueAtTime(0.2, state.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(state.audioContext.destination);
      osc.start();
      osc.stop(state.audioContext.currentTime + 0.6);
    } catch (e) {}
  }

  // ============================================================
  // 12. INITIALIZATION & EVENT LISTENERS
  // ============================================================
  window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    gameStage = document.getElementById('game-stage');
    if (canvas) {
      ctx = canvas.getContext('2d');
    }

    initCollisionGrid();
    checkOrientation();
    resizeGameCanvas();
    render();

    // Window Resize & Orientation Listeners
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

    // ResizeObserver for #game-stage
    if (window.ResizeObserver && gameStage) {
      const ro = new ResizeObserver(() => {
        resizeGameCanvas();
      });
      ro.observe(gameStage);
    }

    // Title Screen Start
    const startBtn = document.getElementById('btn-begin-adventure');
    if (startBtn) {
      startBtn.onclick = () => {
        document.getElementById('title-screen').classList.add('hidden');
        checkOrientation();
      };
    }

    // Enter World in Portrait Button
    const enterWorldBtn = document.getElementById('btn-enter-world-portrait');
    if (enterWorldBtn) enterWorldBtn.onclick = enterWorldFromPortrait;

    const forcePortraitBtn = document.getElementById('btn-force-portrait-play');
    if (forcePortraitBtn) {
      forcePortraitBtn.onclick = () => {
        state.forcePortraitPlay = true;
        document.getElementById('rotate-prompt-modal').classList.remove('active');
        const portraitHome = document.getElementById('portrait-home-view');
        const stage = document.getElementById('game-stage');
        if (portraitHome) portraitHome.style.display = 'none';
        if (stage) stage.style.display = 'block';
        resizeGameCanvas();
      };
    }

    const cancelRotateBtn = document.getElementById('btn-cancel-rotate');
    if (cancelRotateBtn) {
      cancelRotateBtn.onclick = () => {
        document.getElementById('rotate-prompt-modal').classList.remove('active');
      };
    }

    // Landscape Exit / Menu Button
    const exitGameplayBtn = document.getElementById('btn-exit-gameplay');
    if (exitGameplayBtn) {
      exitGameplayBtn.onclick = () => {
        openQuestsTab();
      };
    }

    // Header Buttons
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) audioBtn.onclick = toggleAudio;

    const resetBtn = document.getElementById('dev-reset-btn');
    if (resetBtn) {
      resetBtn.onclick = () => {
        state.lp = 120;
        state.charXp = 0;
        state.skills = { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 };
        state.gardenState = 'dry';
        state.gateOpen = false;
        initCollisionGrid();
        updateLpDisplay();
        updateSkillDisplays();
        showToast('🔄 Demo reset to initial state');
      };
    }

    const adminBtn = document.getElementById('btn-open-admin');
    if (adminBtn) adminBtn.onclick = openAdminStudio;

    // Mobile Bottom Nav Tabs
    ['home', 'world', 'quests', 'journey', 'me'].forEach(tab => {
      const btn = document.getElementById(`nav-tab-${tab}`);
      if (btn) btn.onclick = () => switchNavTab(tab);
    });

    // Close Modal Buttons
    const closeWorldBtn = document.getElementById('btn-close-world-map');
    if (closeWorldBtn) closeWorldBtn.onclick = () => document.getElementById('world-map-modal').classList.add('hidden');

    const closeQuestsBtn = document.getElementById('btn-close-quests-tab');
    if (closeQuestsBtn) closeQuestsBtn.onclick = () => document.getElementById('quests-tab-modal').classList.add('hidden');

    const closeJourneyBtn = document.getElementById('btn-close-journey');
    if (closeJourneyBtn) closeJourneyBtn.onclick = () => document.getElementById('journey-modal').classList.add('hidden');

    const closeMeBtn = document.getElementById('btn-close-me');
    if (closeMeBtn) closeMeBtn.onclick = () => document.getElementById('me-modal').classList.add('hidden');

    const closeAdminBtn = document.getElementById('btn-close-admin-studio');
    if (closeAdminBtn) closeAdminBtn.onclick = () => document.getElementById('admin-studio-modal').classList.add('hidden');

    // Quick Portrait Shortcuts
    const quickWorld = document.getElementById('btn-quick-world-portrait');
    if (quickWorld) quickWorld.onclick = openWorldMap;

    const quickQuests = document.getElementById('btn-quick-quests-portrait');
    if (quickQuests) quickQuests.onclick = openQuestsTab;

    // Quest Flow Buttons
    const compactQuestChip = document.getElementById('compact-quest-chip');
    if (compactQuestChip) compactQuestChip.onclick = () => openQuestDetailModal('Q-001');

    const dlgAction = document.getElementById('btn-dialogue-action');
    if (dlgAction) dlgAction.onclick = () => openQuestDetailModal('Q-001');

    const dlgClose = document.getElementById('btn-dialogue-close');
    if (dlgClose) dlgClose.onclick = closeDialogueModal;

    const acceptBtn = document.getElementById('btn-accept-quest');
    if (acceptBtn) acceptBtn.onclick = acceptQuest;

    const closeQuestBtn = document.getElementById('btn-close-quest-detail');
    if (closeQuestBtn) closeQuestBtn.onclick = () => document.getElementById('quest-detail-modal').classList.add('hidden');

    const exitRampBtn = document.getElementById('btn-exit-to-real-world');
    if (exitRampBtn) exitRampBtn.onclick = exitToRealWorld;

    const returnBtn = document.getElementById('btn-return-completed');
    if (returnBtn) returnBtn.onclick = returnFromRealWorld;

    const familyConfirmBtn = document.getElementById('btn-family-confirm');
    if (familyConfirmBtn) familyConfirmBtn.onclick = parentConfirmed;

    const submitRefBtn = document.getElementById('btn-submit-reflection');
    if (submitRefBtn) submitRefBtn.onclick = submitReflection;

    const closeRewardBtn = document.getElementById('btn-close-reward');
    if (closeRewardBtn) closeRewardBtn.onclick = closeRewardScreen;

    // Touch D-Pad Setup
    setupTouchDpad();

    // Mobile Action Button
    const mobAction = document.getElementById('mobile-action-btn');
    if (mobAction) {
      mobAction.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleActionInteract();
      });
      mobAction.addEventListener('click', handleActionInteract);
    }

    // Mobile Emote Button
    const mobEmote = document.getElementById('mobile-emote-btn');
    if (mobEmote) {
      mobEmote.addEventListener('touchstart', (e) => {
        e.preventDefault();
        showToast('🙏 Alex offered a prayer of gratitude');
      });
      mobEmote.addEventListener('click', () => {
        showToast('🙏 Alex offered a prayer of gratitude');
      });
    }

    // Studio Wizard Nav
    const wizNext = document.getElementById('btn-wizard-next');
    if (wizNext) wizNext.onclick = wizardNext;

    const wizPrev = document.getElementById('btn-wizard-prev');
    if (wizPrev) wizPrev.onclick = wizardPrev;

    // Me tab sub-buttons
    const sportsFromMe = document.getElementById('btn-open-sports-from-me');
    if (sportsFromMe) {
      sportsFromMe.onclick = () => {
        showToast('🏀 FOG Youth Basketball Day: 68–62 (+3 PBs recorded)');
      };
    }

    const memoriesFromMe = document.getElementById('btn-open-memories-from-me');
    if (memoriesFromMe) {
      memoriesFromMe.onclick = () => {
        showToast('📸 6 Fellowship Memories saved in Archive');
      };
    }

    const adminFromMe = document.getElementById('btn-open-admin-from-me');
    if (adminFromMe) {
      adminFromMe.onclick = () => {
        document.getElementById('me-modal').classList.add('hidden');
        openAdminStudio();
      };
    }

    // Accordions
    document.querySelectorAll('.collapsible-trigger').forEach(trigger => {
      trigger.onclick = () => {
        const box = trigger.closest('.collapsible-box');
        if (box) box.classList.toggle('open');
      };
    });

    // Populate Initial Right Ledger Quests
    populateLedgerQuests();
  });

  function setupTouchDpad() {
    const bindDir = (id, keyName) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        keys[keyName] = true;
      }, { passive: false });

      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        keys[keyName] = false;
      }, { passive: false });

      btn.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        keys[keyName] = false;
      }, { passive: false });
    };

    bindDir('dpad-up', 'arrowup');
    bindDir('dpad-down', 'arrowdown');
    bindDir('dpad-left', 'arrowleft');
    bindDir('dpad-right', 'arrowright');
  }

  function populateLedgerQuests() {
    const list = document.getElementById('ledger-quests-list');
    if (!list) return;
    list.innerHTML = '';

    const questsForPlace = QUESTS.filter(q => q.placeId === state.activePlaceId);
    questsForPlace.slice(0, 3).forEach(q => {
      const div = document.createElement('div');
      div.className = 'team-chip';
      div.style.cursor = 'pointer';
      div.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${q.icon || '🌱'}</span>
          <div>
            <div style="font-weight: 700; font-size: 0.82rem; color: var(--brand-burgundy);">${q.title}</div>
            <div style="font-size: 0.68rem; color: var(--brand-fire-orange);">${q.category}</div>
          </div>
        </div>
        <span style="font-size: 0.75rem; font-weight: 800; color: var(--brand-burgundy);">+${q.rewards.lp} LP</span>
      `;
      div.onclick = () => openQuestDetailModal(q.id);
      list.appendChild(div);
    });
  }

})();
