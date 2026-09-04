/**
 * KOINONIA — PHASE 0.10 MASTER GAME ENGINE & GAME-FIRST UX
 *
 * Product Name: KOINONIA
 * Subtitle: Fire of God Ministries &bull; Virtual Community
 * Supportive Branding: KOINONIA by Fire of God Ministries
 *
 * Architecture: Phase 0.8 Playability Baseline + Phase 0.9 Brand Integration,
 *               Mobile Rescue (Game First, Panels Second),
 *               Compact Header, Dominant 2D Canvas Stage,
 *               5-Tab Bottom Navigation, Slide-Up Bottom Sheets,
 *               7-Step Mobile Studio Wizard, Non-Casino Economy,
 *               and Preserved Desktop Multi-Pane Studio.
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

  // Runtime State (Phase 0.8 Baseline + Koinonia Branding)
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

    // Active Navigation Tab
    activeNavTab: 'home',

    // Studio Wizard Step
    wizardStep: 1,

    // In-memory Custom Places & Quests
    customPlaces: {},
    customQuests: []
  };

  // Collision Grid: 0 = walkable, 1 = solid
  let collisionGrid = [];
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
      }
    }

    if (state.activePlaceId === 'home') {
      // Bed
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
  // 4. WORLD RENDERING (PHASE 0.8 GAMEPLAY BASELINE)
  // ============================================================
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
      // Blooming Flowers
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
      // Dry sprout mounds
      ctx.fillStyle = '#BCAAA4';
      for (let i = 0; i < 8; i++) {
        const sx = 4 * 32 + i * 36;
        ctx.fillRect(sx, 13 * 32 + 8, 16, 10);
      }
    }
  }

  function renderFogCenterWorld(ctx) {
    // Sanctuary Deck
    ctx.fillStyle = '#EFEBE9';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Worship Stage Deck
    ctx.fillStyle = '#D7CCC8';
    ctx.fillRect(3 * 32, 2 * 32, (WORLD_COLS - 6) * 32, 4 * 32);

    // Cross Banner
    ctx.fillStyle = '#6A0E04';
    ctx.fillRect(12 * 32, 32, 32, 3 * 32);
    ctx.fillRect(11 * 32, 2 * 32, 3 * 32, 20);

    // Sound Booth
    ctx.fillStyle = '#455A64';
    ctx.fillRect(4 * 32, 12 * 32, 4 * 32, 2 * 32);

    renderNpc(ctx, 10, 4, '👩‍💼', 'Ate Joy', '#EB5F12');
    renderNpc(ctx, 16, 12, '👨‍💼', 'Pastor David', '#6A0E04');
  }

  function renderSchoolWorld(ctx) {
    // Learning Hall
    ctx.fillStyle = '#F5F5F5';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Blackboard
    ctx.fillStyle = '#2E7D32';
    ctx.fillRect(6 * 32, 32, 13 * 32, 2 * 32);

    // Desks
    ctx.fillStyle = '#D7CCC8';
    for (let r = 5; r <= 11; r += 3) {
      for (let c = 5; c <= 19; c += 4) {
        ctx.fillRect(c * 32, r * 32, 2 * 32, 32);
      }
    }

    renderNpc(ctx, 12, 4, '👩‍🏫', 'Teacher Clara', '#0288D1');
  }

  function renderSportsHubWorld(ctx) {
    // Court Surface
    ctx.fillStyle = '#E0E0E0';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Basketball Half-Court
    ctx.fillStyle = '#FFE0B2';
    ctx.fillRect(4 * 32, 2 * 32, 17 * 32, 12 * 32);
    ctx.strokeStyle = '#EB5F12';
    ctx.lineWidth = 3;
    ctx.strokeRect(4 * 32, 2 * 32, 17 * 32, 12 * 32);

    // Key Circle & Hoop
    ctx.beginPath();
    ctx.arc(12 * 32 + 16, 8 * 32, 48, 0, Math.PI * 2);
    ctx.stroke();

    renderNpc(ctx, 7, 5, '🏀', 'Coach Marcus', '#EB5F12');
  }

  function renderOutreachWorld(ctx) {
    // Outreach Mission Ground
    ctx.fillStyle = '#FFF3E0';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Mission Tent Canopy
    ctx.fillStyle = '#D22F0A';
    ctx.fillRect(5 * 32, 2 * 32, 15 * 32, 6 * 32);
    ctx.fillStyle = '#FDC63F';
    ctx.fillRect(5 * 32, 2 * 32, 15 * 32, 16);

    // Food Distribution Boxes
    ctx.fillStyle = '#8D6E63';
    for (let c = 6; c <= 18; c += 3) {
      ctx.fillRect(c * 32, 10 * 32, 2 * 32, 32);
    }

    renderNpc(ctx, 12, 6, '🤝', 'Sister Miriam', '#A10F06');
  }

  function renderNpc(ctx, col, row, emoji, name, badgeColor) {
    const x = col * 32;
    const y = row * 32;

    // Sprite Avatar
    ctx.font = '24px sans-serif';
    ctx.fillText(emoji, x + 4, y + 26);

    // Name Banner
    ctx.fillStyle = badgeColor || 'rgba(38, 34, 32, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x - 14, y - 10, 60, 16, 8);
    ctx.fill();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 9px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.split(' ')[0], x + 16, y + 2);
    ctx.textAlign = 'left';
  }

  // Avatar Sprite Renderer
  function renderAvatar(ctx) {
    const av = state.avatar;
    const px = av.x * TILE_SIZE;
    const py = av.y * TILE_SIZE;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 30, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body / Outfit
    ctx.fillStyle = '#EB5F12'; // Flame Orange Tunic
    ctx.fillRect(px + 8, py + 14, 16, 14);

    // Head
    ctx.fillStyle = av.skinTone;
    ctx.beginPath();
    ctx.arc(px + 16, py + 10, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = av.hairColor;
    ctx.beginPath();
    ctx.arc(px + 16, py + 8, 8, Math.PI, Math.PI * 2);
    ctx.fill();

    // Name Tag
    ctx.fillStyle = 'rgba(38, 34, 32, 0.85)';
    ctx.beginPath();
    ctx.roundRect(px - 6, py - 8, 44, 14, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 9px "Clear Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(av.name, px + 16, py + 3);
    ctx.textAlign = 'left';
  }

  // Master Render Loop
  function render() {
    if (!ctx) return;

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // Render active place
    if (state.activePlaceId === 'home') renderHomeWorld(ctx);
    else if (state.activePlaceId === 'fog_center') renderFogCenterWorld(ctx);
    else if (state.activePlaceId === 'school') renderSchoolWorld(ctx);
    else if (state.activePlaceId === 'sports_hub') renderSportsHubWorld(ctx);
    else if (state.activePlaceId === 'outreach') renderOutreachWorld(ctx);
    else renderHomeWorld(ctx);

    // Render avatar
    renderAvatar(ctx);

    // Proximity check for Uncle Barnaby
    updateProximity();

    requestAnimationFrame(render);
  }

  // ============================================================
  // 5. PLAYER MOVEMENT & COLLISION
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
      // Normalize diagonal
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
        openUncleBarnabyDialogue();
      }
    }
  }

  // ============================================================
  // 6. DIALOGUE & QUEST FLOW (PHASE 0.7 VERTICAL SLICE PRESERVED)
  // ============================================================
  const barnabyLines = [
    "Morning, Alex! Look at our garden patch outside the window. The soil is quite dry.",
    "A faithful steward doesn't wait to be told twice. Will you water the living plants in the real world today?",
    "Every small act of service waters the soul just as water feeds the root."
  ];

  function openUncleBarnabyDialogue() {
    state.dialogue.active = true;
    state.dialogue.lines = barnabyLines;
    state.dialogue.currentLineIndex = 0;

    const overlay = document.getElementById('dialogue-overlay');
    const speaker = document.getElementById('dialogue-speaker');
    const text = document.getElementById('dialogue-text');

    if (overlay && speaker && text) {
      speaker.textContent = 'Uncle Barnaby';
      text.textContent = barnabyLines[0];
      overlay.classList.remove('hidden');
      playPluckSound();
    }
  }

  function nextDialogue() {
    state.dialogue.currentLineIndex++;
    if (state.dialogue.currentLineIndex < state.dialogue.lines.length) {
      const text = document.getElementById('dialogue-text');
      if (text) text.textContent = state.dialogue.lines[state.dialogue.currentLineIndex];
      playPluckSound();
    } else {
      // Dialogue finished: close dialogue and open Quest bottom sheet
      closeDialogue();
      openQuestSheet();
    }
  }

  function closeDialogue() {
    state.dialogue.active = false;
    const overlay = document.getElementById('dialogue-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function openQuestSheet() {
    const modal = document.getElementById('quest-modal');
    if (modal) {
      modal.classList.remove('hidden');
      playBellSound();
    }
  }

  // Quest Flow Actions
  function acceptQuest() {
    document.getElementById('quest-modal').classList.add('hidden');
    // Open Signature Exit Ramp Modal
    const exitRamp = document.getElementById('exit-ramp-modal');
    if (exitRamp) exitRamp.classList.remove('hidden');
  }

  function exitToRealWorld() {
    document.getElementById('exit-ramp-modal').classList.add('hidden');
    // Open Standby Modal ("Mission in Progress")
    const standby = document.getElementById('standby-modal');
    if (standby) standby.classList.remove('hidden');
  }

  function imBackCompleted() {
    document.getElementById('standby-modal').classList.add('hidden');
    // Open Verification Method Modal
    const verify = document.getElementById('verification-modal');
    if (verify) verify.classList.remove('hidden');
  }

  function chooseTrustVerify() {
    document.getElementById('verification-modal').classList.add('hidden');
    openReflectionModal();
  }

  function chooseFamilyVerify() {
    document.getElementById('verification-modal').classList.add('hidden');
    const fam = document.getElementById('family-modal');
    if (fam) fam.classList.remove('hidden');
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
  }

  function updateSkillDisplays() {
    const stew = document.getElementById('dt-stewardship-xp');
    const resp = document.getElementById('dt-responsibility-xp');
    if (stew) stew.textContent = `${state.skills.stewardship} XP`;
    if (resp) resp.textContent = `${state.skills.responsibility} XP`;
  }

  function showToast(msg) {
    const toast = document.getElementById('world-toast');
    const text = document.getElementById('toast-message');
    if (toast && text) {
      text.textContent = msg;
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 3000);
    }
  }

  // ============================================================
  // 7. 5-TAB MOBILE BOTTOM NAVIGATION & VIEW SWITCHING
  // ============================================================
  function switchNavTab(tabName) {
    state.activeNavTab = tabName;

    // Update active tab buttons
    document.querySelectorAll('.nav-tab-item').forEach(btn => {
      if (btn.getAttribute('data-view') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Close all open modals first
    document.querySelectorAll('.modal-backdrop').forEach(m => {
      if (m.id !== 'title-screen') m.classList.add('hidden');
    });
    document.querySelectorAll('.studio-panel').forEach(p => p.classList.remove('open'));

    // Open view for selected tab
    if (tabName === 'home') {
      // Returns to 2D gameplay canvas
      closeDialogue();
    } else if (tabName === 'world') {
      openWorldMap();
    } else if (tabName === 'quests') {
      openQuestsTab();
    } else if (tabName === 'journey') {
      openJourneyArchive();
    } else if (tabName === 'me') {
      openMeMenu();
    }
  }

  function openWorldMap() {
    const modal = document.getElementById('world-map-modal');
    populateWorldMapList();
    if (modal) modal.classList.remove('hidden');
  }

  function populateWorldMapList() {
    const list = document.getElementById('world-places-list');
    if (!list) return;

    list.innerHTML = '';
    Object.values(PLACES).forEach(place => {
      const card = document.createElement('div');
      card.className = 'place-card-node';
      card.innerHTML = `
        <div class="place-node-left">
          <div class="place-node-icon">${place.icon || '📍'}</div>
          <div class="place-node-info">
            <span class="place-node-title">${place.name}</span>
            <span class="place-node-tag">${place.description || 'Place of Fellowship'}</span>
          </div>
        </div>
        <button class="secondary-btn" style="width: auto; padding: 4px 12px; font-size: 0.75rem;">TRAVEL</button>
      `;
      card.onclick = () => travelToPlace(place.id);
      list.appendChild(card);
    });
  }

  function travelToPlace(placeId) {
    if (!PLACES[placeId]) return;
    state.activePlaceId = placeId;
    state.avatar.x = 12;
    state.avatar.y = 9;
    initCollisionGrid();

    // Update Watermark Badge
    const p = PLACES[placeId];
    const icon = document.getElementById('canvas-place-icon');
    const label = document.getElementById('canvas-place-label');
    const chip = document.getElementById('canvas-place-lifecycle');
    if (icon) icon.textContent = p.icon || '📍';
    if (label) label.textContent = p.name;
    if (chip) {
      chip.textContent = p.lifecycle === 'temporary' ? 'Temporary' : 'Permanent';
      chip.className = `lifecycle-chip ${p.lifecycle}`;
    }

    // Close map and switch to Home tab
    document.getElementById('world-map-modal').classList.add('hidden');
    switchNavTab('home');
    showToast(`📍 Traveled to ${p.name}`);
  }

  function openQuestsTab() {
    const modal = document.getElementById('quests-tab-modal');
    populateQuestsTab();
    if (modal) modal.classList.remove('hidden');
  }

  function populateQuestsTab() {
    const container = document.getElementById('quests-tab-list');
    if (!container) return;

    const filtered = QUESTS.filter(q => q.placeId === state.activePlaceId);
    container.innerHTML = '';
    filtered.forEach(q => {
      const div = document.createElement('div');
      div.className = 'place-card-node';
      div.innerHTML = `
        <div class="place-node-left">
          <span style="font-size: 1.2rem;">${q.icon || '🌱'}</span>
          <div>
            <div style="font-weight: 700; font-size: 0.85rem; color: var(--brand-charcoal);">${q.title}</div>
            <span style="font-size: 0.7rem; color: var(--text-secondary);">${q.verification} &bull; +${q.rewards?.lp || 5} LP</span>
          </div>
        </div>
        <button class="primary-btn" style="width: auto; padding: 4px 10px; font-size: 0.72rem;">VIEW</button>
      `;
      div.onclick = () => {
        document.getElementById('quests-tab-modal').classList.add('hidden');
        openQuestSheet();
      };
      container.appendChild(div);
    });

    const count = document.getElementById('place-quests-count');
    if (count) count.textContent = filtered.length;

    // Populate Place History
    const hist = document.getElementById('place-history-content');
    const place = PLACES[state.activePlaceId];
    if (hist && place && place.history) {
      hist.innerHTML = place.history.map(h => `
        <div style="margin-bottom: 6px; padding: 6px; background: var(--surface-card-subtle); border-radius: 4px;">
          <strong>${h.date}:</strong> ${h.description}
        </div>
      `).join('');
    }
  }

  function openJourneyArchive() {
    const modal = document.getElementById('journey-modal');
    populateJourneyTimeline();
    if (modal) modal.classList.remove('hidden');
  }

  function populateJourneyTimeline() {
    const list = document.getElementById('journey-timeline-list');
    if (!list || !MY_JOURNEY.timeline) return;

    list.innerHTML = MY_JOURNEY.timeline.map(m => `
      <div class="timeline-step-card">
        <span style="font-size: 0.72rem; font-weight: 700; color: var(--brand-fire-orange);">${m.date} &bull; ${m.placeName}</span>
        <div style="font-weight: 700; font-size: 0.88rem; color: var(--brand-charcoal);">${m.title}</div>
        <p style="font-size: 0.78rem; color: var(--text-secondary);">${m.reflection}</p>
      </div>
    `).join('');
  }

  function openMeMenu() {
    const modal = document.getElementById('me-modal');
    if (modal) modal.classList.remove('hidden');
  }

  // ============================================================
  // 8. KOINONIA STUDIO (7-STEP WIZARD)
  // ============================================================
  function openAdminStudio() {
    state.wizardStep = 1;
    updateWizardUI();
    const modal = document.getElementById('admin-studio-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function updateWizardUI() {
    // Update step pips
    for (let i = 1; i <= 7; i++) {
      const pip = document.getElementById(`pip-${i}`);
      if (pip) {
        if (i <= state.wizardStep) pip.classList.add('active');
        else pip.classList.remove('active');
      }
      const content = document.getElementById(`step-${i}-content`);
      if (content) {
        if (i === state.wizardStep) content.classList.remove('hidden');
        else content.classList.add('hidden');
      }
    }

    const prevBtn = document.getElementById('wiz-btn-prev');
    const nextBtn = document.getElementById('wiz-btn-next');
    if (prevBtn) prevBtn.disabled = (state.wizardStep === 1);
    if (nextBtn) {
      if (state.wizardStep === 7) {
        nextBtn.textContent = 'SAVE & REGISTER';
      } else {
        nextBtn.textContent = 'NEXT';
      }
    }
  }

  function wizardNext() {
    if (state.wizardStep < 7) {
      state.wizardStep++;
      updateWizardUI();
    } else {
      // Save and register custom place
      const name = document.getElementById('wiz-place-name').value || 'Custom Retreat';
      const id = 'custom_' + Date.now();
      state.customPlaces[id] = { id, name, lifecycle: 'permanent', icon: '⛰️' };
      document.getElementById('admin-studio-modal').classList.add('hidden');
      showToast(`✅ Registered place: ${name}`);
    }
  }

  function wizardPrev() {
    if (state.wizardStep > 1) {
      state.wizardStep--;
      updateWizardUI();
    }
  }

  // ============================================================
  // 9. CLEAN PROTOTYPE RESET
  // ============================================================
  function resetDemoData() {
    state.lp = 120;
    state.skills = { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 };
    state.gardenState = 'dry';
    state.gateOpen = false;
    state.activePlaceId = 'home';
    state.avatar.x = 4.5;
    state.avatar.y = 14.5;
    initCollisionGrid();

    updateLpDisplay();
    updateSkillDisplays();
    switchNavTab('home');
    showToast('🔄 Prototype demo reset to initial state (120 LP)');
  }

  // ============================================================
  // 10. REAL-TIME SYNTHESIZED WEB AUDIO API (MUTED BY DEFAULT)
  // ============================================================
  function initAudio() {
    if (!state.audioContext && typeof AudioContext !== 'undefined') {
      state.audioContext = new AudioContext();
    }
  }

  function toggleAudio() {
    state.audioMuted = !state.audioMuted;
    const btn = document.getElementById('audio-toggle-btn');
    const icon = document.getElementById('audio-icon');
    if (btn && icon) {
      if (state.audioMuted) {
        btn.classList.add('muted');
        icon.textContent = '🔈';
      } else {
        btn.classList.remove('muted');
        icon.textContent = '🔊';
        initAudio();
        playBellSound();
      }
    }
  }

  function playPluckSound() {
    if (state.audioMuted || !state.audioContext) return;
    try {
      const osc = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, state.audioContext.currentTime);
      gain.gain.setValueAtTime(0.2, state.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(state.audioContext.destination);
      osc.start();
      osc.stop(state.audioContext.currentTime + 0.25);
    } catch (e) {}
  }

  function playBellSound() {
    if (state.audioMuted || !state.audioContext) return;
    try {
      const osc = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, state.audioContext.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, state.audioContext.currentTime + 0.3); // E5
      gain.gain.setValueAtTime(0.25, state.audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, state.audioContext.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(state.audioContext.destination);
      osc.start();
      osc.stop(state.audioContext.currentTime + 0.5);
    } catch (e) {}
  }

  // ============================================================
  // 11. INITIALIZATION & EVENT LISTENERS
  // ============================================================
  window.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('gameCanvas');
    if (canvas) {
      ctx = canvas.getContext('2d');
      // High-DPI Canvas Scaling
      const dpr = window.devicePixelRatio || 1;
      canvas.width = LOGICAL_WIDTH * dpr;
      canvas.height = LOGICAL_HEIGHT * dpr;
      ctx.scale(dpr, dpr);
    }

    initCollisionGrid();
    render();

    // Title Screen Start Button
    const startBtn = document.getElementById('btn-begin-adventure');
    if (startBtn) {
      startBtn.onclick = () => {
        document.getElementById('title-screen').classList.add('hidden');
      };
    }

    // Audio Toggle
    const audioBtn = document.getElementById('audio-toggle-btn');
    if (audioBtn) audioBtn.onclick = toggleAudio;

    // Reset Demo
    const resetBtn = document.getElementById('dev-reset-btn');
    if (resetBtn) resetBtn.onclick = resetDemoData;

    // Admin Studio Buttons
    const adminBtn = document.getElementById('btn-open-admin');
    if (adminBtn) adminBtn.onclick = openAdminStudio;
    const adminFromMe = document.getElementById('btn-open-admin-from-me');
    if (adminFromMe) {
      adminFromMe.onclick = () => {
        document.getElementById('me-modal').classList.add('hidden');
        openAdminStudio();
      };
    }

    // Wizard Next & Prev
    const wizNext = document.getElementById('wiz-btn-next');
    if (wizNext) wizNext.onclick = wizardNext;
    const wizPrev = document.getElementById('wiz-btn-prev');
    if (wizPrev) wizPrev.onclick = wizardPrev;
    const closeAdmin = document.getElementById('btn-close-admin');
    if (closeAdmin) closeAdmin.onclick = () => document.getElementById('admin-studio-modal').classList.add('hidden');

    // Bottom Navigation Tabs
    document.getElementById('nav-tab-home').onclick = () => switchNavTab('home');
    document.getElementById('nav-tab-world').onclick = () => switchNavTab('world');
    document.getElementById('nav-tab-quests').onclick = () => switchNavTab('quests');
    document.getElementById('nav-tab-journey').onclick = () => switchNavTab('journey');
    document.getElementById('nav-tab-me').onclick = () => switchNavTab('me');

    // Compact Quest Chip
    const questChip = document.getElementById('compact-quest-chip');
    if (questChip) questChip.onclick = openQuestSheet;

    // Dialogue Buttons
    const diaNext = document.getElementById('dialogue-next-btn');
    if (diaNext) diaNext.onclick = nextDialogue;

    // Quest Flow Buttons
    const acceptBtn = document.getElementById('btn-accept-quest');
    if (acceptBtn) acceptBtn.onclick = acceptQuest;
    const closeQuest = document.getElementById('btn-close-quest-modal');
    if (closeQuest) closeQuest.onclick = () => document.getElementById('quest-modal').classList.add('hidden');

    const exitBtn = document.getElementById('btn-exit-to-real-world');
    if (exitBtn) exitBtn.onclick = exitToRealWorld;

    const backBtn = document.getElementById('btn-im-back');
    if (backBtn) backBtn.onclick = imBackCompleted;

    const trustBtn = document.getElementById('btn-verify-trust');
    if (trustBtn) trustBtn.onclick = chooseTrustVerify;

    const famBtn = document.getElementById('btn-verify-family');
    if (famBtn) famBtn.onclick = chooseFamilyVerify;

    const closeVerify = document.getElementById('btn-close-verify');
    if (closeVerify) closeVerify.onclick = () => document.getElementById('verification-modal').classList.add('hidden');

    const parentYes = document.getElementById('btn-parent-yes');
    if (parentYes) parentYes.onclick = parentConfirmed;
    const parentCancel = document.getElementById('btn-parent-cancel');
    if (parentCancel) parentCancel.onclick = () => document.getElementById('family-modal').classList.add('hidden');

    const submitRef = document.getElementById('btn-submit-reflection');
    if (submitRef) submitRef.onclick = submitReflection;

    const closeReward = document.getElementById('btn-close-reward');
    if (closeReward) closeReward.onclick = closeRewardScreen;

    // Close Modal Buttons
    const closeMap = document.getElementById('btn-close-map');
    if (closeMap) closeMap.onclick = () => document.getElementById('world-map-modal').classList.add('hidden');

    const closeQuestsTab = document.getElementById('btn-close-quests-tab');
    if (closeQuestsTab) closeQuestsTab.onclick = () => document.getElementById('quests-tab-modal').classList.add('hidden');

    const closeJourney = document.getElementById('btn-close-journey');
    if (closeJourney) closeJourney.onclick = () => document.getElementById('journey-modal').classList.add('hidden');

    const closeMe = document.getElementById('btn-close-me');
    if (closeMe) closeMe.onclick = () => document.getElementById('me-modal').classList.add('hidden');

    // Sports & Memories from Me
    const openSports = document.getElementById('btn-open-sports-from-me');
    if (openSports) {
      openSports.onclick = () => {
        document.getElementById('me-modal').classList.add('hidden');
        document.getElementById('sports-modal').classList.remove('hidden');
      };
    }
    const closeSports = document.getElementById('btn-close-sports');
    if (closeSports) closeSports.onclick = () => document.getElementById('sports-modal').classList.add('hidden');

    const openMems = document.getElementById('btn-open-memories-from-me');
    if (openMems) {
      openMems.onclick = () => {
        document.getElementById('me-modal').classList.add('hidden');
        populateMemoriesGrid();
        document.getElementById('memories-modal').classList.remove('hidden');
      };
    }
    const closeMems = document.getElementById('btn-close-mem');
    if (closeMems) closeMems.onclick = () => document.getElementById('memories-modal').classList.add('hidden');

    const closeLight = document.getElementById('btn-close-lightbox');
    if (closeLight) closeLight.onclick = () => document.getElementById('lightbox-modal').classList.add('hidden');

    const resetFromMe = document.getElementById('btn-reset-from-me');
    if (resetFromMe) resetFromMe.onclick = resetDemoData;

    // Mobile Virtual D-Pad Touch Listeners
    setupVirtualDpad();

    // Mobile Action Button
    const actionBtn = document.getElementById('mobile-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleActionInteract();
      }, { passive: false });
      actionBtn.onclick = handleActionInteract;
    }

    // Proximity Prompt Click
    const prompt = document.getElementById('proximity-prompt');
    if (prompt) prompt.onclick = handleActionInteract;

    // Collapsible Accordions Toggle
    document.querySelectorAll('.collapsible-trigger').forEach(trigger => {
      trigger.onclick = () => {
        trigger.parentElement.classList.toggle('open');
      };
    });

    // Emote Buttons
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.onclick = () => {
        const emo = btn.getAttribute('data-emote');
        showToast(`Emote: ${emo}`);
      };
    });
  });

  function setupVirtualDpad() {
    const bindDpad = (id, keyName) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const start = (e) => {
        e.preventDefault();
        keys[keyName] = true;
        btn.classList.add('pressed');
      };
      const end = (e) => {
        e.preventDefault();
        keys[keyName] = false;
        btn.classList.remove('pressed');
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
      btn.addEventListener('mouseleave', end);
    };

    bindDpad('dpad-up', 'arrowup');
    bindDpad('dpad-down', 'arrowdown');
    bindDpad('dpad-left', 'arrowleft');
    bindDpad('dpad-right', 'arrowright');
  }

  function populateMemoriesGrid() {
    const grid = document.getElementById('memories-photo-grid');
    if (!grid || !EVENT_MEMORIES.length) return;
    grid.innerHTML = '';
    EVENT_MEMORIES.forEach(m => {
      const card = document.createElement('div');
      card.className = 'place-card-node';
      card.style.flexDirection = 'column';
      card.style.textAlign = 'center';
      card.innerHTML = `
        <div style="font-size: 2.2rem; margin-bottom: 4px;">📸</div>
        <strong style="font-size: 0.8rem; color: var(--brand-burgundy);">${m.title}</strong>
        <span style="font-size: 0.7rem; color: var(--text-secondary);">${m.caption}</span>
      `;
      card.onclick = () => {
        document.getElementById('lightbox-title').textContent = m.title;
        document.getElementById('lightbox-caption').textContent = m.caption;
        document.getElementById('lightbox-modal').classList.remove('hidden');
      };
      grid.appendChild(card);
    });
  }

})();
