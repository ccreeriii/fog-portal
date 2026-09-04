/**
 * KOINONIA — PHASE 0.9 MASTER GAME ENGINE & DYNAMIC CAMERA
 *
 * Product Name: KOINONIA
 * Subtitle: Fire of God Ministries Virtual Community
 * Supportive Branding: KOINONIA by Fire of God Ministries
 *
 * Architecture: Mobile-First Responsive Viewport Engine,
 *               Dynamic Clamped Camera with Direction Bias,
 *               5-Tab Bottom Navigation, Slide-Up Bottom Sheets,
 *               Mobile Studio 7-Step Wizard, Non-Casino Economy,
 *               and Multi-Pane Desktop Preservation.
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

  // ============================================================
  // 2. LOGICAL WORLD CONSTANTS & CAMERA
  // ============================================================
  const TILE_SIZE = 32;
  const WORLD_COLS = 25; // 800px logical
  const WORLD_ROWS = 18; // 576px logical
  const LOGICAL_WIDTH = WORLD_COLS * TILE_SIZE;  // 800
  const LOGICAL_HEIGHT = WORLD_ROWS * TILE_SIZE; // 576

  // Logical Camera State
  const camera = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    scale: 1.0,
    lookaheadX: 0,
    lookaheadY: 0,
    isMobile: false
  };

  // Prototype Global State
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

    // Avatar
    avatar: {
      x: 4.5,
      y: 14.5,
      targetX: null,
      targetY: null,
      speed: 3.8,
      facing: 'down', // 'down' | 'up' | 'left' | 'right'
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
      currentLineIndex: 0,
      typewriterIndex: 0,
      typewriterTimer: null,
      onComplete: null
    },

    // Inactivity timer for touch controls fading
    controlsInactiveTimer: null,

    // Studio Wizard Step (Mobile)
    wizardStep: 1,

    // Custom runtime created places
    customPlaces: {}
  };

  // Collision Grid: 0 = walkable, 1 = solid
  let collisionGrid = [];

  // DOM Elements cache
  let canvas, ctx;

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

        // Place-specific collision tiles
        if (state.activePlaceId === 'home') {
          // Bedroom furniture
          if (c >= 2 && c <= 5 && r >= 2 && r <= 4) collisionGrid[r][c] = 1; // Bed
          if (c >= 7 && c <= 9 && r >= 2 && r <= 3) collisionGrid[r][c] = 1; // Desk
          // Veranda railing
          if (c >= 12 && c <= 17 && r === 8) collisionGrid[r][c] = 1;
          // Garden perimeter fence
          if (c >= 12 && c <= 22 && r === 15) {
            // Gate opens when completed!
            if (state.gateOpen && (c === 16 || c === 17)) {
              collisionGrid[r][c] = 0;
            } else {
              collisionGrid[r][c] = 1;
            }
          }
        } else if (state.activePlaceId === 'fog_center') {
          // Worship stage
          if (c >= 8 && c <= 16 && r >= 2 && r <= 4) collisionGrid[r][c] = 1;
          // Sound booth
          if (c >= 18 && c <= 22 && r >= 13 && r <= 15) collisionGrid[r][c] = 1;
        } else if (state.activePlaceId === 'school') {
          // Teacher podium & blackboard
          if (c >= 4 && c <= 10 && r === 2) collisionGrid[r][c] = 1;
          // Bookshelves
          if (c >= 16 && c <= 22 && (r === 4 || r === 8)) collisionGrid[r][c] = 1;
        } else if (state.activePlaceId === 'sports_hub') {
          // Basketball hoop post
          if (c >= 11 && c <= 13 && r === 3) collisionGrid[r][c] = 1;
          // Bleachers
          if (c >= 8 && c <= 16 && r >= 14 && r <= 15) collisionGrid[r][c] = 1;
        } else if (state.activePlaceId === 'outreach') {
          // Welcome canopy tent poles
          if (c >= 4 && c <= 9 && r >= 3 && r <= 6) collisionGrid[r][c] = 1;
          // Distribution table
          if (c >= 14 && c <= 20 && r >= 3 && r <= 5) collisionGrid[r][c] = 1;
        }
      }
    }
  }

  function isWalkable(col, row) {
    if (col < 0 || col >= WORLD_COLS || row < 0 || row >= WORLD_ROWS) return false;
    return collisionGrid[row][col] === 0;
  }

  // ============================================================
  // 4. RESPONSIVE CANVAS & DYNAMIC CAMERA CONTROLLER
  // ============================================================
  function updateCanvasDimensions() {
    if (!canvas) return;
    const container = document.getElementById('canvas-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Viewport classification
    const isMobile = window.innerWidth < 640;
    const isLandscape = window.innerHeight < 500 && window.innerWidth > window.innerHeight;
    camera.isMobile = isMobile;

    // CSS Display Size matches container bounds
    const displayWidth = rect.width;
    const displayHeight = rect.height;

    // Backing buffer scaled for high-DPI crisp rendering
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);

    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    // Camera scale calculation
    if (isMobile) {
      // Mobile portrait: Zoom in (1.55x) so avatar & NPCs are large, clear, and visible
      camera.scale = 1.55;
    } else if (isLandscape) {
      camera.scale = 1.15;
    } else {
      // Desktop / Tablet: Fit entire room or comfortable 1.0x scale
      const scaleX = displayWidth / LOGICAL_WIDTH;
      const scaleY = displayHeight / LOGICAL_HEIGHT;
      camera.scale = Math.min(scaleX, scaleY, 1.25);
    }
  }

  function updateCamera(dt) {
    const container = document.getElementById('canvas-container');
    if (!container) return;
    const viewWidth = container.clientWidth / camera.scale;
    const viewHeight = container.clientHeight / camera.scale;

    // Avatar center in logical world coordinates
    const playerWorldX = (state.avatar.x + 0.5) * TILE_SIZE;
    const playerWorldY = (state.avatar.y + 0.5) * TILE_SIZE;

    // Directional lookahead bias
    let lookX = 0;
    let lookY = 0;
    if (state.avatar.facing === 'left') lookX = -24;
    if (state.avatar.facing === 'right') lookX = 24;
    if (state.avatar.facing === 'up') lookY = -24;
    if (state.avatar.facing === 'down') lookY = 24;

    camera.lookaheadX += (lookX - camera.lookaheadX) * 0.1;
    camera.lookaheadY += (lookY - camera.lookaheadY) * 0.1;

    // Desired camera center
    camera.targetX = playerWorldX + camera.lookaheadX - viewWidth / 2;
    camera.targetY = playerWorldY + camera.lookaheadY - viewHeight / 2;

    // Clamp camera within room boundaries if room is larger than viewport
    if (LOGICAL_WIDTH > viewWidth) {
      camera.targetX = Math.max(0, Math.min(camera.targetX, LOGICAL_WIDTH - viewWidth));
    } else {
      camera.targetX = (LOGICAL_WIDTH - viewWidth) / 2; // Center horizontally
    }

    if (LOGICAL_HEIGHT > viewHeight) {
      camera.targetY = Math.max(0, Math.min(camera.targetY, LOGICAL_HEIGHT - viewHeight));
    } else {
      camera.targetY = (LOGICAL_HEIGHT - viewHeight) / 2; // Center vertically
    }

    // Smooth camera interpolation
    camera.x += (camera.targetX - camera.x) * 0.15;
    camera.y += (camera.targetY - camera.y) * 0.15;
  }

  // ============================================================
  // 5. WORLD RENDERING (5 CANONICAL PLACES)
  // ============================================================
  function renderWorld() {
    ctx.save();

    // Fill background with warm parchment tint
    ctx.fillStyle = '#EBDAC9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply camera transformation
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-Math.round(camera.x), -Math.round(camera.y));

    // Render active place environment
    if (state.activePlaceId === 'home') {
      renderMyHome();
    } else if (state.activePlaceId === 'fog_center') {
      renderFogCenter();
    } else if (state.activePlaceId === 'school') {
      renderSchool();
    } else if (state.activePlaceId === 'sports_hub') {
      renderSportsHub();
    } else if (state.activePlaceId === 'outreach') {
      renderOutreachSite();
    }

    // Render active NPC
    renderActiveNpc();

    // Render player avatar
    renderAvatar();

    ctx.restore();
  }

  // 5.1 My Home Environment
  function renderMyHome() {
    // Floor: Warm wooden planks
    ctx.fillStyle = '#D9B48F';
    ctx.fillRect(TILE_SIZE, TILE_SIZE, (WORLD_COLS - 2) * TILE_SIZE, (WORLD_ROWS - 2) * TILE_SIZE);

    // Bedroom rug
    ctx.fillStyle = '#E6CDB2';
    ctx.fillRect(2 * TILE_SIZE, 12 * TILE_SIZE, 5 * TILE_SIZE, 4 * TILE_SIZE);

    // Bed
    ctx.fillStyle = '#6A0E04'; // Burgundy quilt
    ctx.fillRect(2 * TILE_SIZE + 4, 13 * TILE_SIZE + 4, 3 * TILE_SIZE, 2 * TILE_SIZE);
    ctx.fillStyle = '#FFF9F3'; // White pillow
    ctx.fillRect(2 * TILE_SIZE + 6, 13 * TILE_SIZE + 6, 20, 16);

    // Study Desk with Bible
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(6 * TILE_SIZE, 13 * TILE_SIZE, 2 * TILE_SIZE, 1.5 * TILE_SIZE);
    ctx.fillStyle = '#FDC63F'; // Lamp glow
    ctx.beginPath();
    ctx.arc(6.5 * TILE_SIZE, 13.5 * TILE_SIZE, 8, 0, Math.PI * 2);
    ctx.fill();

    // Living Area circular woven rug
    ctx.fillStyle = '#F2E4E1';
    ctx.beginPath();
    ctx.arc(7.5 * TILE_SIZE, 7.5 * TILE_SIZE, 2.5 * TILE_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Veranda Wood Decking (Right Side)
    ctx.fillStyle = '#C49B72';
    ctx.fillRect(12 * TILE_SIZE, 2 * TILE_SIZE, 11 * TILE_SIZE, 14 * TILE_SIZE);
    ctx.strokeStyle = '#A87D53';
    ctx.strokeRect(12 * TILE_SIZE, 2 * TILE_SIZE, 11 * TILE_SIZE, 14 * TILE_SIZE);

    // Garden Patch
    ctx.fillStyle = state.gardenState === 'dry' ? '#8F7E77' : '#3E5C38';
    ctx.fillRect(14 * TILE_SIZE, 9 * TILE_SIZE, 8 * TILE_SIZE, 5 * TILE_SIZE);

    if (state.gardenState === 'dry') {
      // Wilted sprouts
      ctx.fillStyle = '#9C886B';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect((15 + i * 2) * TILE_SIZE + 8, 11 * TILE_SIZE + 8, 8, 12);
      }
    } else {
      // Lush blossoming flowers
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#48C774';
        ctx.beginPath();
        ctx.arc((15 + i * 1.5) * TILE_SIZE + 8, 11 * TILE_SIZE + 8, 9, 0, Math.PI * 2);
        ctx.fill();
        // Flower blossom
        ctx.fillStyle = '#FDC63F';
        ctx.beginPath();
        ctx.arc((15 + i * 1.5) * TILE_SIZE + 8, 11 * TILE_SIZE + 4, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Perimeter Garden Fence & Gate
    ctx.fillStyle = '#5C4028';
    ctx.fillRect(12 * TILE_SIZE, 14.8 * TILE_SIZE, 4 * TILE_SIZE, 6);
    ctx.fillRect(18 * TILE_SIZE, 14.8 * TILE_SIZE, 5 * TILE_SIZE, 6);

    // Gate Latch
    if (state.gateOpen) {
      // Open gate swing
      ctx.fillStyle = '#EB5F12';
      ctx.fillRect(16 * TILE_SIZE, 14 * TILE_SIZE, 6, 24);
    } else {
      // Closed gate latch
      ctx.fillStyle = '#A10F06';
      ctx.fillRect(16 * TILE_SIZE, 14.8 * TILE_SIZE, 2 * TILE_SIZE, 6);
    }
  }

  // 5.2 FOG Community Center Environment
  function renderFogCenter() {
    ctx.fillStyle = '#EBDAC9'; // Stone pavers
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Sanctuary Hall Timber Decking
    ctx.fillStyle = '#D9B48F';
    ctx.fillRect(2 * TILE_SIZE, 3 * TILE_SIZE, 10 * TILE_SIZE, 12 * TILE_SIZE);
    ctx.strokeStyle = '#B88F66';
    ctx.strokeRect(2 * TILE_SIZE, 3 * TILE_SIZE, 10 * TILE_SIZE, 12 * TILE_SIZE);

    // Worship Stage with Banner
    ctx.fillStyle = '#6A0E04';
    ctx.fillRect(8 * TILE_SIZE, 2 * TILE_SIZE, 9 * TILE_SIZE, 2.5 * TILE_SIZE);
    ctx.fillStyle = '#FFF9F3';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('FIRE OF GOD SANCTUARY', 8.5 * TILE_SIZE, 3.5 * TILE_SIZE);

    // Grand Quest Board
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(11 * TILE_SIZE, 5 * TILE_SIZE, 3 * TILE_SIZE, 2 * TILE_SIZE);
    ctx.fillStyle = '#FFFDFB';
    ctx.fillRect(11.2 * TILE_SIZE, 5.2 * TILE_SIZE, 2.6 * TILE_SIZE, 1.6 * TILE_SIZE);
    ctx.fillStyle = '#EB5F12';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('QUEST BOARD', 11.4 * TILE_SIZE, 6.2 * TILE_SIZE);

    // Community Garden beds
    ctx.fillStyle = '#4A3728';
    ctx.fillRect(15 * TILE_SIZE, 6 * TILE_SIZE, 8 * TILE_SIZE, 8 * TILE_SIZE);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = '#48C774';
        ctx.beginPath();
        ctx.arc(16 * TILE_SIZE + c * 38, 7 * TILE_SIZE + r * 42, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Timber Cross Landmark
    ctx.fillStyle = '#6A0E04';
    ctx.fillRect(20 * TILE_SIZE, 12 * TILE_SIZE, 6, 26);
    ctx.fillRect(19.6 * TILE_SIZE, 12.5 * TILE_SIZE, 18, 6);
  }

  // 5.3 School Learning Hall Environment
  function renderSchool() {
    ctx.fillStyle = '#EBE2D5';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Classroom Floor
    ctx.fillStyle = '#D6CCBA';
    ctx.fillRect(2 * TILE_SIZE, 2 * TILE_SIZE, 10 * TILE_SIZE, 13 * TILE_SIZE);

    // Blackboard
    ctx.fillStyle = '#262220';
    ctx.fillRect(4 * TILE_SIZE, 2 * TILE_SIZE, 6 * TILE_SIZE, 16);
    ctx.fillStyle = '#FFF9F3';
    ctx.font = '9px sans-serif';
    ctx.fillText('ACADEMIC DILIGENCE', 4.4 * TILE_SIZE, 2.8 * TILE_SIZE);

    // Study Carrels & Desks
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = '#8F7257';
      ctx.fillRect(4 * TILE_SIZE, (5 + i * 3) * TILE_SIZE, 3 * TILE_SIZE, 1.4 * TILE_SIZE);
    }

    // Library Floor (Right side)
    ctx.fillStyle = '#CCA37E';
    ctx.fillRect(14 * TILE_SIZE, 2 * TILE_SIZE, 9 * TILE_SIZE, 13 * TILE_SIZE);
    // Bookshelves
    ctx.fillStyle = '#6A0E04';
    ctx.fillRect(15 * TILE_SIZE, 4 * TILE_SIZE, 7 * TILE_SIZE, 20);
    ctx.fillRect(15 * TILE_SIZE, 8 * TILE_SIZE, 7 * TILE_SIZE, 20);
  }

  // 5.4 Sports Hub Court Environment
  function renderSportsHub() {
    // Grass
    ctx.fillStyle = '#5A7D50';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Red clay perimeter running track
    ctx.strokeStyle = '#D22F0A';
    ctx.lineWidth = 14;
    ctx.strokeRect(2 * TILE_SIZE, 2 * TILE_SIZE, 21 * TILE_SIZE, 14 * TILE_SIZE);

    // Hardwood Basketball Half-Court
    ctx.fillStyle = '#E0AC69';
    ctx.fillRect(6 * TILE_SIZE, 4 * TILE_SIZE, 13 * TILE_SIZE, 9 * TILE_SIZE);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(6 * TILE_SIZE, 4 * TILE_SIZE, 13 * TILE_SIZE, 9 * TILE_SIZE);

    // Free Throw Key Circle
    ctx.strokeRect(10 * TILE_SIZE, 4 * TILE_SIZE, 5 * TILE_SIZE, 5 * TILE_SIZE);
    ctx.beginPath();
    ctx.arc(12.5 * TILE_SIZE, 9 * TILE_SIZE, 2.5 * TILE_SIZE, 0, Math.PI * 2);
    ctx.stroke();

    // Hoop & Backboard
    ctx.fillStyle = '#EB5F12';
    ctx.fillRect(12 * TILE_SIZE + 8, 3.8 * TILE_SIZE, 16, 5);

    // Shaded Bleachers
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(8 * TILE_SIZE, 14.2 * TILE_SIZE, 9 * TILE_SIZE, 1.6 * TILE_SIZE);
  }

  // 5.5 Outreach Site Environment
  function renderOutreachSite() {
    // Neighborhood park grass
    ctx.fillStyle = '#6E9462';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Welcome Canopy Tent (Flame Gold / Fire Orange roof)
    ctx.fillStyle = '#EB5F12';
    ctx.fillRect(4 * TILE_SIZE, 3 * TILE_SIZE, 6 * TILE_SIZE, 4 * TILE_SIZE);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('WELCOME TENT', 4.4 * TILE_SIZE, 4.6 * TILE_SIZE);

    // Food Distribution Tables with Food Boxes
    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(14 * TILE_SIZE, 3.5 * TILE_SIZE, 6 * TILE_SIZE, 2 * TILE_SIZE);
    ctx.fillStyle = '#FDC63F';
    for (let b = 0; b < 4; b++) {
      ctx.fillRect(14.5 * TILE_SIZE + b * 36, 4 * TILE_SIZE, 22, 16);
    }
  }

  // 5.6 Render Active NPC
  function renderActiveNpc() {
    let npcName = 'Uncle Barnaby';
    let npcIcon = '👴';
    let npcX = 14;
    let npcY = 6;

    if (state.activePlaceId === 'fog_center') {
      npcName = 'Ate Joy';
      npcIcon = '👩‍💼';
      npcX = 9;
      npcY = 6;
    } else if (state.activePlaceId === 'school') {
      npcName = 'Teacher Clara';
      npcIcon = '👩‍🏫';
      npcX = 8;
      npcY = 4;
    } else if (state.activePlaceId === 'sports_hub') {
      npcName = 'Coach Marcus';
      npcIcon = '🏃';
      npcX = 12.5;
      npcY = 11;
    } else if (state.activePlaceId === 'outreach') {
      npcName = 'Sister Miriam';
      npcIcon = '👵';
      npcX = 12;
      npcY = 5;
    }

    const drawX = npcX * TILE_SIZE;
    const drawY = npcY * TILE_SIZE;

    // NPC Shadow
    ctx.fillStyle = 'rgba(38, 34, 32, 0.2)';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 28, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // NPC Body & Head
    ctx.fillStyle = '#EB5F12';
    ctx.beginPath();
    ctx.arc(drawX + 16, drawY + 16, 12, 0, Math.PI * 2);
    ctx.fill();

    // NPC Icon
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(npcIcon, drawX + 16, drawY + 22);

    // Name tag
    ctx.fillStyle = '#262220';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(npcName, drawX + 16, drawY - 4);
    ctx.textAlign = 'left';
  }

  // 5.7 Render Avatar
  function renderAvatar() {
    const drawX = state.avatar.x * TILE_SIZE;
    const drawY = state.avatar.y * TILE_SIZE;

    // Shadow
    ctx.fillStyle = 'rgba(38, 34, 32, 0.25)';
    ctx.beginPath();
    ctx.ellipse(drawX + 16, drawY + 28, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Clothing (Fire of God Youth: Olive shirt, warm charcoal pants)
    ctx.fillStyle = '#4B6B44';
    ctx.fillRect(drawX + 8, drawY + 14, 16, 12);

    // Head
    ctx.fillStyle = state.avatar.skinTone;
    ctx.beginPath();
    ctx.arc(drawX + 16, drawY + 10, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = state.avatar.hairColor;
    ctx.beginPath();
    ctx.arc(drawX + 16, drawY + 6, 8, Math.PI, Math.PI * 2);
    ctx.fill();

    // Walking animation bobbing
    if (state.avatar.isMoving) {
      state.avatar.frameTimer++;
      if (state.avatar.frameTimer > 8) {
        state.avatar.frame = (state.avatar.frame + 1) % 4;
        state.avatar.frameTimer = 0;
      }
    } else {
      state.avatar.frame = 0;
    }

    // Floating Emote Bubble if triggered
    if (state.activeEmote) {
      ctx.fillStyle = '#FFF9F3';
      ctx.strokeStyle = '#EB5F12';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(drawX + 4, drawY - 32, 24, 24, [6]);
      ctx.fill();
      ctx.stroke();

      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.activeEmote, drawX + 16, drawY - 15);
      ctx.textAlign = 'left';
    }
  }

  // ============================================================
  // 6. AVATAR MOVEMENT & PHYSICS
  // ============================================================
  function updateAvatar(dt) {
    if (state.avatar.targetX !== null && state.avatar.targetY !== null) {
      const dx = state.avatar.targetX - state.avatar.x;
      const dy = state.avatar.targetY - state.avatar.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.1) {
        state.avatar.x = state.avatar.targetX;
        state.avatar.y = state.avatar.targetY;
        state.avatar.targetX = null;
        state.avatar.targetY = null;
        state.avatar.isMoving = false;
      } else {
        const step = state.avatar.speed * dt;
        state.avatar.x += (dx / dist) * step;
        state.avatar.y += (dy / dist) * step;
        state.avatar.isMoving = true;

        if (Math.abs(dx) > Math.abs(dy)) {
          state.avatar.facing = dx > 0 ? 'right' : 'left';
        } else {
          state.avatar.facing = dy > 0 ? 'down' : 'up';
        }
      }
    }

    // Check NPC proximity for interaction prompt
    checkNpcProximity();
  }

  function checkNpcProximity() {
    let npcX = 14;
    let npcY = 6;
    if (state.activePlaceId === 'fog_center') { npcX = 9; npcY = 6; }
    if (state.activePlaceId === 'school') { npcX = 8; npcY = 4; }
    if (state.activePlaceId === 'sports_hub') { npcX = 12.5; npcY = 11; }
    if (state.activePlaceId === 'outreach') { npcX = 12; npcY = 5; }

    const dist = Math.hypot(state.avatar.x - npcX, state.avatar.y - npcY);
    const prompt = document.getElementById('proximity-prompt');
    if (prompt) {
      if (dist < 2.2 && !state.dialogue.active) {
        prompt.classList.remove('hidden');
      } else {
        prompt.classList.add('hidden');
      }
    }
  }

  function moveInDirection(dx, dy) {
    const targetCol = Math.round(state.avatar.x + dx);
    const targetRow = Math.round(state.avatar.y + dy);

    if (isWalkable(targetCol, targetRow)) {
      state.avatar.targetX = targetCol;
      state.avatar.targetY = targetRow;
      resetControlsInactivity();
    }
  }

  // ============================================================
  // 7. DIALOGUE & UNCLE BARNABY QUEST #001 FLOW
  // ============================================================
  function interactWithNearbyNpc() {
    if (state.activePlaceId === 'home') {
      startUncleBarnabyDialogue();
    } else {
      showToast('Fellowship elder greeted you with warm blessing!');
    }
  }

  function startUncleBarnabyDialogue() {
    const lines = [
      "Morning, Alex. Look at our garden patch out here by the veranda.",
      "The sun has been bright all week, and the young herbs are thirsty.",
      "Caring for God's creation begins at home with small, faithful chores.",
      "Would you take a few moments in the real world to water the plants?"
    ];

    state.dialogue.active = true;
    state.dialogue.speaker = 'Uncle Barnaby';
    state.dialogue.portrait = '👴';
    state.dialogue.lines = lines;
    state.dialogue.currentLineIndex = 0;

    const overlay = document.getElementById('dialogue-overlay');
    if (overlay) overlay.classList.remove('hidden');

    displayCurrentDialogueLine();
  }

  function displayCurrentDialogueLine() {
    const speakerEl = document.getElementById('dialogue-speaker');
    const textEl = document.getElementById('dialogue-text');
    if (speakerEl) speakerEl.textContent = state.dialogue.speaker;
    if (textEl) textEl.textContent = state.dialogue.lines[state.dialogue.currentLineIndex];
  }

  function advanceDialogue() {
    state.dialogue.currentLineIndex++;
    if (state.dialogue.currentLineIndex < state.dialogue.lines.length) {
      displayCurrentDialogueLine();
    } else {
      // Finished dialogue -> Open Quest Card Bottom Sheet!
      closeDialogue();
      openModal('quest-modal');
    }
  }

  function closeDialogue() {
    state.dialogue.active = false;
    const overlay = document.getElementById('dialogue-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ============================================================
  // 8. SIGNATURE EXIT RAMP, STANDBY & VERIFICATION
  // ============================================================
  function acceptQuest() {
    closeModal('quest-modal');
    state.questStatus = 'active';
    // Open Signature Full-Screen Real-World Exit Ramp
    openModal('exit-ramp-modal');
  }

  function exitToRealWorld() {
    closeModal('exit-ramp-modal');
    state.questStatus = 'in_progress';
    // Open Standby Mode
    openModal('standby-modal');
  }

  function returnFromRealWorld() {
    closeModal('standby-modal');
    // Open Verification Selection Sheet
    openModal('verification-modal');
  }

  function verifyTrust() {
    closeModal('verification-modal');
    // Open Reflection Journal
    openModal('reflection-modal');
  }

  function verifyFamily() {
    closeModal('verification-modal');
    // Open Parent Handoff Demo
    openModal('family-modal');
  }

  function parentConfirmed() {
    closeModal('family-modal');
    openModal('reflection-modal');
  }

  function submitReflection() {
    closeModal('reflection-modal');
    completeQuest001();
  }

  function completeQuest001() {
    state.questStatus = 'completed';
    state.lp += 5;
    state.skills.stewardship += 15;
    state.skills.responsibility += 5;
    state.gardenState = 'lush';
    state.gateOpen = true;

    initCollisionGrid();
    updateLpDisplay();

    // Open Non-Casino Celebratory Rewards Sheet
    openModal('reward-modal');
  }

  // ============================================================
  // 9. PLACE FAST TRAVEL CONTROLLER (WORLD MAP)
  // ============================================================
  function travelToPlace(placeId) {
    if (!PLACES[placeId]) return;
    state.activePlaceId = placeId;

    // Reset player position based on place entrance
    state.avatar.x = 4.5;
    state.avatar.y = 12.5;
    state.avatar.targetX = null;
    state.avatar.targetY = null;
    state.avatar.facing = 'down';

    initCollisionGrid();
    updatePlaceHeaderAndBadge();
    closeModal('world-map-modal');

    showToast(`Arrived at ${PLACES[placeId].name}`);
  }

  function updatePlaceHeaderAndBadge() {
    const current = PLACES[state.activePlaceId];
    if (!current) return;

    const iconEl = document.getElementById('canvas-place-icon');
    const labelEl = document.getElementById('canvas-place-label');
    const chipEl = document.getElementById('canvas-place-lifecycle');

    if (iconEl) iconEl.textContent = current.icon;
    if (labelEl) labelEl.textContent = current.name;
    if (chipEl) {
      chipEl.textContent = current.lifecycle === 'permanent' ? 'Permanent Place' : 'Temporary Event Site';
      chipEl.className = `lifecycle-chip ${current.lifecycle}`;
    }
  }

  function renderWorldMapList() {
    const container = document.getElementById('world-places-list');
    if (!container) return;
    container.innerHTML = '';

    Object.values(PLACES).forEach(p => {
      const isCurrent = p.id === state.activePlaceId;
      const card = document.createElement('div');
      card.className = `place-card-node ${isCurrent ? 'current-place' : ''}`;
      card.innerHTML = `
        <div class="place-node-left">
          <div class="place-node-icon">${p.icon}</div>
          <div class="place-node-info">
            <span class="place-node-title">${p.name}</span>
            <span class="place-node-tag">${p.category} • ${p.lifecycle}</span>
          </div>
        </div>
        <button class="place-node-travel-btn ${isCurrent ? 'disabled' : ''}" data-place="${p.id}" ${isCurrent ? 'disabled' : ''}>
          ${isCurrent ? 'HERE NOW' : 'TRAVEL'}
        </button>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.place-node-travel-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const placeId = e.currentTarget.getAttribute('data-place');
        travelToPlace(placeId);
      });
    });
  }

  // ============================================================
  // 10. MODAL & BOTTOM SHEET HELPERS
  // ============================================================
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
    // Dim touch controls when modal opens
    const controls = document.getElementById('mobile-controls');
    if (controls) controls.classList.add('controls-dimmed');
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
    // Restore touch controls
    const controls = document.getElementById('mobile-controls');
    if (controls) controls.classList.remove('controls-dimmed');
  }

  function showToast(message) {
    const toast = document.getElementById('world-toast');
    const msg = document.getElementById('toast-message');
    if (!toast || !msg) return;
    msg.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2800);
  }

  function updateLpDisplay() {
    const el = document.getElementById('header-lp-amount');
    if (el) el.textContent = state.lp;
  }

  // ============================================================
  // 11. MOBILE ADMIN STUDIO: 7-STEP WIZARD
  // ============================================================
  function setupAdminStudioWizard() {
    state.wizardStep = 1;
    renderWizardStep();

    const prevBtn = document.getElementById('wiz-btn-prev');
    const nextBtn = document.getElementById('wiz-btn-next');

    if (prevBtn) {
      prevBtn.onclick = () => {
        if (state.wizardStep > 1) {
          state.wizardStep--;
          renderWizardStep();
        }
      };
    }

    if (nextBtn) {
      nextBtn.onclick = () => {
        if (state.wizardStep < 7) {
          state.wizardStep++;
          renderWizardStep();
        } else {
          // Save Demo Place
          saveWizardPlace();
        }
      };
    }
  }

  function renderWizardStep() {
    // Update pips
    for (let i = 1; i <= 7; i++) {
      const pip = document.getElementById(`pip-${i}`);
      const content = document.getElementById(`step-${i}-content`);
      if (pip) {
        pip.className = `wizard-step-pip ${i === state.wizardStep ? 'active' : (i < state.wizardStep ? 'done' : '')}`;
      }
      if (content) {
        if (i === state.wizardStep) {
          content.classList.remove('hidden');
        } else {
          content.classList.add('hidden');
        }
      }
    }

    // Update buttons
    const prevBtn = document.getElementById('wiz-btn-prev');
    const nextBtn = document.getElementById('wiz-btn-next');
    if (prevBtn) prevBtn.disabled = state.wizardStep === 1;
    if (nextBtn) {
      nextBtn.textContent = state.wizardStep === 7 ? 'SAVE PLACE TO PROTOTYPE' : 'NEXT';
      nextBtn.className = state.wizardStep === 7 ? 'primary-btn' : 'primary-btn';
    }

    // Update Step 6 Preview
    const nameInput = document.getElementById('wiz-place-name');
    const prevName = document.getElementById('wiz-prev-name');
    if (nameInput && prevName) {
      prevName.textContent = nameInput.value.trim() || 'Custom Place';
    }
  }

  function saveWizardPlace() {
    const nameInput = document.getElementById('wiz-place-name');
    const name = nameInput ? nameInput.value.trim() : 'Custom Place';
    const id = 'custom_' + Date.now();

    const newPlace = {
      id: id,
      communityId: 'fog',
      name: name,
      category: 'Formation & Retreat',
      icon: '⛰️',
      accentColor: '#EB5F12',
      lifecycle: 'permanent',
      tagline: 'A new retreat place in Fire of God Ministries Virtual Community.',
      zones: [{ id: 'main', name: 'Main Sanctuary' }]
    };

    PLACES[id] = newPlace;
    state.customPlaces[id] = newPlace;

    closeModal('admin-studio-modal');
    renderWorldMapList();
    showToast(`Created place "${name}" in prototype state!`);
  }

  // ============================================================
  // 12. PROTOTYPE DATA RESET
  // ============================================================
  function resetDemoData() {
    state.lp = 120;
    state.charXp = 0;
    state.skills = { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 };
    state.gardenState = 'dry';
    state.gateOpen = false;
    state.questStatus = 'ready';
    state.activePlaceId = 'home';
    state.avatar.x = 4.5;
    state.avatar.y = 14.5;
    state.avatar.targetX = null;
    state.avatar.targetY = null;
    state.avatar.facing = 'down';

    initCollisionGrid();
    updateLpDisplay();
    updatePlaceHeaderAndBadge();

    // Close any open modals
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      if (m.id !== 'title-screen') m.classList.add('hidden');
    });

    showToast('Prototype state reset to clean initial conditions.');
  }

  function resetControlsInactivity() {
    const controls = document.getElementById('mobile-controls');
    if (controls) controls.classList.remove('controls-dimmed');
    clearTimeout(state.controlsInactiveTimer);
    state.controlsInactiveTimer = setTimeout(() => {
      if (controls && !state.avatar.isMoving) {
        controls.classList.add('controls-dimmed');
      }
    }, 4500);
  }

  // ============================================================
  // 13. EVENT LISTENERS & INITIALIZATION
  // ============================================================
  function setupEventListeners() {
    // Title Screen
    const beginBtn = document.getElementById('btn-begin-adventure');
    if (beginBtn) {
      beginBtn.onclick = () => {
        closeModal('title-screen');
        openModal('avatar-modal');
      };
    }

    // Avatar Setup
    const saveAvatarBtn = document.getElementById('btn-save-avatar');
    if (saveAvatarBtn) {
      saveAvatarBtn.onclick = () => {
        const nameInput = document.getElementById('avatar-name-input');
        if (nameInput) state.avatar.name = nameInput.value.trim() || 'Alex';
        closeModal('avatar-modal');
        showToast(`Welcome, Pilgrim ${state.avatar.name}!`);
      };
    }

    document.querySelectorAll('.skin-swatch').forEach(sw => {
      sw.onclick = (e) => {
        document.querySelectorAll('.skin-swatch').forEach(s => s.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.avatar.skinTone = e.currentTarget.getAttribute('data-skin');
      };
    });

    document.querySelectorAll('.hair-btn').forEach(hb => {
      hb.onclick = (e) => {
        document.querySelectorAll('.hair-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.avatar.hairStyle = e.currentTarget.getAttribute('data-hair');
      };
    });

    // Audio Toggle
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) {
      audioBtn.onclick = () => {
        state.audioMuted = !state.audioMuted;
        audioBtn.classList.toggle('muted', state.audioMuted);
        const icon = document.getElementById('audio-icon');
        if (icon) icon.textContent = state.audioMuted ? '🔈' : '🔊';
        showToast(state.audioMuted ? 'Audio muted' : 'Audio enabled');
      };
    }

    // Reset Button
    const resetBtn = document.getElementById('dev-reset-btn');
    if (resetBtn) resetBtn.onclick = resetDemoData;

    // Proximity Prompt & Action Button
    const actionBtn = document.getElementById('mobile-action-btn');
    if (actionBtn) actionBtn.onclick = interactWithNearbyNpc;
    const prompt = document.getElementById('proximity-prompt');
    if (prompt) prompt.onclick = interactWithNearbyNpc;

    // Dialogue Next
    const dialogueNext = document.getElementById('dialogue-next-btn');
    if (dialogueNext) dialogueNext.onclick = advanceDialogue;

    // Quest Flow
    const acceptBtn = document.getElementById('btn-accept-quest');
    if (acceptBtn) acceptBtn.onclick = acceptQuest;

    const exitRealBtn = document.getElementById('btn-exit-to-real-world');
    if (exitRealBtn) exitRealBtn.onclick = exitToRealWorld;

    const backBtn = document.getElementById('btn-im-back');
    if (backBtn) backBtn.onclick = returnFromRealWorld;

    const verifyTrustBtn = document.getElementById('btn-verify-trust');
    if (verifyTrustBtn) verifyTrustBtn.onclick = verifyTrust;

    const verifyFamilyBtn = document.getElementById('btn-verify-family');
    if (verifyFamilyBtn) verifyFamilyBtn.onclick = verifyFamily;

    const parentYesBtn = document.getElementById('btn-parent-yes');
    if (parentYesBtn) parentYesBtn.onclick = parentConfirmed;

    const parentCancelBtn = document.getElementById('btn-parent-cancel');
    if (parentCancelBtn) parentCancelBtn.onclick = () => closeModal('family-modal');

    const submitRefBtn = document.getElementById('btn-submit-reflection');
    if (submitRefBtn) submitRefBtn.onclick = submitReflection;

    const closeRewardBtn = document.getElementById('btn-close-reward');
    if (closeRewardBtn) closeRewardBtn.onclick = () => closeModal('reward-modal');

    // Bottom Navigation 5 Tabs
    document.getElementById('nav-tab-home').onclick = () => {
      setActiveNavTab('nav-tab-home');
      // Returns to main canvas view
      document.querySelectorAll('.modal-backdrop').forEach(m => {
        if (m.id !== 'title-screen') m.classList.add('hidden');
      });
    };

    document.getElementById('nav-tab-world').onclick = () => {
      setActiveNavTab('nav-tab-world');
      renderWorldMapList();
      openModal('world-map-modal');
    };

    document.getElementById('nav-tab-quests').onclick = () => {
      setActiveNavTab('nav-tab-quests');
      openModal('quest-modal');
    };

    document.getElementById('nav-tab-journey').onclick = () => {
      setActiveNavTab('nav-tab-journey');
      renderJourneyTimeline();
      openModal('journey-modal');
    };

    document.getElementById('nav-tab-me').onclick = () => {
      setActiveNavTab('nav-tab-me');
      openModal('me-modal');
    };

    // "Me" Sheet Sub-Buttons
    const openMemoriesBtn = document.getElementById('btn-open-memories-from-me');
    if (openMemoriesBtn) {
      openMemoriesBtn.onclick = () => {
        closeModal('me-modal');
        renderMemoriesGrid();
        openModal('memories-modal');
      };
    }

    const openSportsBtn = document.getElementById('btn-open-sports-from-me');
    if (openSportsBtn) {
      openSportsBtn.onclick = () => {
        closeModal('me-modal');
        openModal('sports-modal');
      };
    }

    const openCampBtn = document.getElementById('btn-open-camp-from-me');
    if (openCampBtn) {
      openCampBtn.onclick = () => {
        closeModal('me-modal');
        openModal('campaigns-modal');
      };
    }

    const openAdminBtn = document.getElementById('btn-open-admin-from-me');
    if (openAdminBtn) {
      openAdminBtn.onclick = () => {
        closeModal('me-modal');
        setupAdminStudioWizard();
        openModal('admin-studio-modal');
      };
    }

    const resetFromMe = document.getElementById('btn-reset-from-me');
    if (resetFromMe) {
      resetFromMe.onclick = () => {
        closeModal('me-modal');
        resetDemoData();
      };
    }

    // Modal Close Buttons
    document.getElementById('btn-close-map').onclick = () => closeModal('world-map-modal');
    document.getElementById('btn-close-quest-modal').onclick = () => closeModal('quest-modal');
    document.getElementById('btn-close-verify').onclick = () => closeModal('verification-modal');
    document.getElementById('btn-close-camp').onclick = () => closeModal('campaigns-modal');
    document.getElementById('btn-close-sports').onclick = () => closeModal('sports-modal');
    document.getElementById('btn-close-mem').onclick = () => closeModal('memories-modal');
    document.getElementById('btn-close-journey').onclick = () => closeModal('journey-modal');
    document.getElementById('btn-close-me').onclick = () => closeModal('me-modal');
    document.getElementById('btn-close-admin').onclick = () => closeModal('admin-studio-modal');
    document.getElementById('btn-close-lightbox').onclick = () => closeModal('lightbox-modal');

    // Quick Glance Bar
    const glanceBar = document.getElementById('mobile-quest-glance');
    if (glanceBar) glanceBar.onclick = () => openModal('quest-modal');

    // Desktop Sidebars Collapse Toggles
    const closeLeft = document.getElementById('close-left-panel');
    if (closeLeft) {
      closeLeft.onclick = () => {
        document.getElementById('panel-left').classList.toggle('collapsed');
        closeLeft.textContent = document.getElementById('panel-left').classList.contains('collapsed') ? '▶' : '◀';
        updateCanvasDimensions();
      };
    }

    const closeRight = document.getElementById('close-right-panel');
    if (closeRight) {
      closeRight.onclick = () => {
        document.getElementById('panel-right').classList.toggle('collapsed');
        closeRight.textContent = document.getElementById('panel-right').classList.contains('collapsed') ? '◀' : '▶';
        updateCanvasDimensions();
      };
    }

    // Touch D-Pad Events
    setupDpadTouch('dpad-up', 0, -1);
    setupDpadTouch('dpad-down', 0, 1);
    setupDpadTouch('dpad-left', -1, 0);
    setupDpadTouch('dpad-right', 1, 0);

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (state.dialogue.active) {
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
          advanceDialogue();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') moveInDirection(0, -1);
      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') moveInDirection(0, 1);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveInDirection(-1, 0);
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveInDirection(1, 0);
      if (e.key === 'e' || e.key === 'E' || e.key === ' ') interactWithNearbyNpc();
      if (e.key === 'm' || e.key === 'M') {
        renderWorldMapList();
        openModal('world-map-modal');
      }
    });

    // Emotes
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.onclick = (e) => {
        const emote = e.currentTarget.getAttribute('data-emote');
        state.activeEmote = emote;
        setTimeout(() => { state.activeEmote = null; }, 2400);
      };
    });

    // Click/Tap on Canvas for Click-to-Move
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert from screen pixels to logical world tile
      const logicalX = clickX / camera.scale + camera.x;
      const logicalY = clickY / camera.scale + camera.y;

      const targetCol = Math.floor(logicalX / TILE_SIZE);
      const targetRow = Math.floor(logicalY / TILE_SIZE);

      if (isWalkable(targetCol, targetRow)) {
        state.avatar.targetX = targetCol;
        state.avatar.targetY = targetRow;
      }
    });

    // Window Resize & Orientation Change
    window.addEventListener('resize', updateCanvasDimensions);
    window.addEventListener('orientationchange', updateCanvasDimensions);
  }

  function setupDpadTouch(btnId, dx, dy) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    let interval = null;

    const startMove = (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      moveInDirection(dx, dy);
      clearInterval(interval);
      interval = setInterval(() => moveInDirection(dx, dy), 160);
    };

    const endMove = (e) => {
      e.preventDefault();
      btn.classList.remove('pressed');
      clearInterval(interval);
    };

    btn.addEventListener('touchstart', startMove, { passive: false });
    btn.addEventListener('touchend', endMove);
    btn.addEventListener('mousedown', startMove);
    btn.addEventListener('mouseup', endMove);
    btn.addEventListener('mouseleave', endMove);
  }

  function setActiveNavTab(activeId) {
    document.querySelectorAll('.nav-tab-item').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(activeId);
    if (tab) tab.classList.add('active');
  }

  // ============================================================
  // 14. MEMORIES GALLERY & JOURNEY TIMELINE INJECTION
  // ============================================================
  function renderMemoriesGrid() {
    const grid = document.getElementById('memories-photo-grid');
    if (!grid) return;
    grid.innerHTML = '';

    EVENT_MEMORIES.forEach(m => {
      const card = document.createElement('div');
      card.className = 'memory-photo-card';
      card.innerHTML = `
        <div class="memory-img-box" style="background: ${m.bgGradient};">
          <span>${m.icon}</span>
        </div>
        <div class="memory-card-caption">
          <div class="memory-card-title">${m.title}</div>
          <div class="memory-card-date">${m.caption}</div>
        </div>
      `;
      card.onclick = () => {
        openLightbox(m);
      };
      grid.appendChild(card);
    });
  }

  function openLightbox(memory) {
    const title = document.getElementById('lightbox-title');
    const caption = document.getElementById('lightbox-caption');
    const meta = document.getElementById('lightbox-meta');
    const area = document.getElementById('lightbox-img-area');
    const icon = document.getElementById('lightbox-icon');

    if (title) title.textContent = memory.title;
    if (caption) caption.textContent = memory.caption;
    if (meta) meta.textContent = `${memory.uploadedBy} • September 2026`;
    if (area) area.style.background = memory.bgGradient;
    if (icon) icon.textContent = memory.icon;

    openModal('lightbox-modal');
  }

  function renderJourneyTimeline() {
    const container = document.getElementById('journey-timeline-list');
    if (!container) return;
    container.innerHTML = '';

    if (MY_JOURNEY.timeline) {
      MY_JOURNEY.timeline.forEach(item => {
        const row = document.createElement('div');
        row.className = 'journey-milestone-item';
        row.innerHTML = `
          <div class="journey-milestone-dot"></div>
          <div class="journey-milestone-card">
            <div class="journey-card-meta">
              <span class="journey-month">${item.month}</span>
              <span class="journey-badge">${item.badge}</span>
            </div>
            <h4 class="journey-card-title">${item.icon} ${item.title}</h4>
            <p class="journey-card-desc">${item.description}</p>
          </div>
        `;
        container.appendChild(row);
      });
    }
  }

  // ============================================================
  // 15. MAIN GAME LOOP
  // ============================================================
  let lastTime = 0;
  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    updateAvatar(dt);
    updateCamera(dt);
    renderWorld();

    requestAnimationFrame(gameLoop);
  }

  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    initCollisionGrid();
    updateCanvasDimensions();
    updatePlaceHeaderAndBadge();
    updateLpDisplay();
    setupEventListeners();

    requestAnimationFrame(gameLoop);
  });

})();
