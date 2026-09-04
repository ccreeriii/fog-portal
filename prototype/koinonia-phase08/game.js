/**
 * KOINONIA — PHASE 0.8 MODULAR WORLD & ADMIN STUDIO PROTOTYPE
 *
 * Product Name: KOINONIA by Fire of God Ministries
 * Architecture: Modular Place renderer, dynamic collision grids, campaigns,
 *               sports personal bests, event memories, personal journey archive,
 *               and no-code Admin Koinonia Studio.
 * Launch Safety: 100% isolated, fake in-memory data, zero production database connection.
 */

(function () {
  'use strict';

  // ============================================================
  // 1. DATA STORES ACCESS
  // ============================================================
  const data = window.KOINONIA_DATA || {};
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
  // 2. RUNTIME GAME STATE
  // ============================================================
  const state = {
    currentScreen: 'title', // 'title' | 'avatar' | 'game'
    activePlaceId: 'home',  // 'home' | 'fog_center' | 'school' | 'sports_hub' | 'outreach'
    selectedMapPlace: 'home',

    // In-memory Custom Places & Quests created via Admin Studio
    customPlaces: {},
    customQuests: [],

    // Dialogue State
    isDialogueOpen: false,
    dialogueStep: 0,
    currentNpc: null,

    // Quest & Real-World Flow State (Phase 0.7 preserved)
    activeQuest: null,
    questStatus: 'ready',
    verificationMethod: null,
    reflectionText: '',

    // Fake Player Progress (Alex)
    lp: 120, // 120 -> 125 LP post Quest 001
    charXp: 0,
    skills: {
      stewardship: 0,
      responsibility: 0,
      discipline: 0,
      teamwork: 0,
      service: 0,
      compassion: 0
    },
    communityPool: 142, // 142 -> 157 / 500

    // Environmental States
    gardenState: 'dry', // 'dry' | 'lush'
    gateOpen: false,

    // Avatar Configuration
    avatar: {
      name: 'Alex',
      skinIndex: 0,
      hairIndex: 0,
      outfitIndex: 0,
      x: 4.5,
      y: 14.5,
      targetX: null,
      targetY: null,
      dir: 'down',
      isMoving: false,
      walkFrame: 0,
      emote: null,
      emoteTimer: 0
    },

    // Audio: MUTED BY DEFAULT per PO Mandate
    audio: {
      ctx: null,
      isMuted: true
    }
  };

  const SKIN_COLORS = ['#FFE0BD', '#E0AC69', '#8D5524', '#4A2C11'];
  const HAIR_COLORS = ['#3D2314', '#1F1713', '#663B1C', '#8C562A'];
  const OUTFIT_PALETTES = [
    { shirt: '#C86A4B', pants: '#374E32', trim: '#F2B84B', name: 'Terracotta Tunic' },
    { shirt: '#4B6B44', pants: '#4A3323', trim: '#FAF7F0', name: 'Olive Gardener' },
    { shirt: '#2C3E55', pants: '#6B7465', trim: '#F2B84B', name: 'Sky Pilgrim' }
  ];

  const TILE_SIZE = 32;
  const COLS = 25; // 800px width
  const ROWS = 18; // 576px height

  // NPC Locations across places
  const NPCS = {
    home: { id: 'uncle_barnaby', name: 'Uncle Barnaby', role: 'Garden Elder & Mentor', x: 14, y: 6, icon: '👴', color: '#D4B06A' },
    fog_center: { id: 'ate_joy', name: 'Ate Joy', role: 'Welcome Coordinator', x: 6, y: 8, icon: '👩', color: '#C86A4B' },
    sports_hub: { id: 'coach_marcus', name: 'Marcus', role: 'Sports & Fitness Lead', x: 12, y: 14, icon: '🏀', color: '#2C3E55' },
    outreach: { id: 'volunteer_sarah', name: 'Sarah', role: 'Outreach Team Lead', x: 6, y: 8, icon: '🤝', color: '#3E8E58' },
    school: { id: 'mentor_david', name: 'Mr. David', role: 'Study Mentor', x: 6, y: 6, icon: '📚', color: '#4B6B44' }
  };

  // ============================================================
  // 3. COLLISION SYSTEM (PER PLACE)
  // ============================================================
  const collisionGrid = [];

  function initCollisionGrid() {
    for (let r = 0; r < ROWS; r++) {
      collisionGrid[r] = [];
      for (let c = 0; c < COLS; c++) {
        // Outer map boundaries
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          collisionGrid[r][c] = 1;
          continue;
        }

        const place = state.activePlaceId;

        if (place === 'home') {
          // Bedroom wall
          if (c === 8 && r >= 10 && r <= 17 && r !== 13 && r !== 14) { collisionGrid[r][c] = 1; continue; }
          if (r === 10 && c <= 8 && c !== 4) { collisionGrid[r][c] = 1; continue; }
          // Bedroom Furniture
          if (c >= 1 && c <= 3 && r >= 14 && r <= 16) { collisionGrid[r][c] = 1; continue; }
          if (c >= 5 && c <= 6 && r === 11) { collisionGrid[r][c] = 1; continue; }
          if (c === 1 && r === 11) { collisionGrid[r][c] = 1; continue; }
          // Kitchen walls & counters
          if (c === 8 && r >= 1 && r <= 9 && r !== 6 && r !== 7) { collisionGrid[r][c] = 1; continue; }
          if (r === 3 && c <= 6) { collisionGrid[r][c] = 1; continue; }
          if (c >= 3 && c <= 5 && r >= 6 && r <= 7) { collisionGrid[r][c] = 1; continue; }
          // Living Area Sofa & Bookshelf
          if (c >= 10 && c <= 13 && r === 14) { collisionGrid[r][c] = 1; continue; }
          if (c >= 11 && c <= 13 && r === 11) { collisionGrid[r][c] = 1; continue; }
          // Veranda railing
          if (r === 3 && c >= 9 && c <= 15) { collisionGrid[r][c] = 1; continue; }
          if (c === 15 && r >= 3 && r <= 9 && r !== 6 && r !== 7) { collisionGrid[r][c] = 1; continue; }
          // Garden perimeter & gate
          if (c === COLS - 2 && r >= 3 && r <= ROWS - 2) { collisionGrid[r][c] = 1; continue; }
          if (r === ROWS - 2 && c >= 16 && c <= COLS - 2) { collisionGrid[r][c] = 1; continue; }
          if (r === 4 && c >= 16 && c <= COLS - 2 && c !== 19 && c !== 20) { collisionGrid[r][c] = 1; continue; }
          if (r === 4 && (c === 19 || c === 20)) {
            collisionGrid[r][c] = state.gateOpen ? 0 : 1;
            continue;
          }
          if (r <= 3 && (c < 18 || c > 21)) { collisionGrid[r][c] = 1; continue; }
          // Barnaby and potted fern
          if (c === 14 && r === 6) { collisionGrid[r][c] = 1; continue; }
          if (c === 17 && r === 6) { collisionGrid[r][c] = 1; continue; }
        }
        else if (place === 'sports_hub') {
          // Half-court perimeter lines and hoop
          if (c === 12 && r === 3) { collisionGrid[r][c] = 1; continue; } // Hoop
          if (r === 15 && c >= 8 && c <= 16) { collisionGrid[r][c] = 1; continue; } // Bleachers
          if (c === 12 && r === 14) { collisionGrid[r][c] = 1; continue; } // Marcus
        }
        else if (place === 'fog_center') {
          // Grand Quest Board in Youth Hall
          if (c >= 11 && c <= 13 && r === 5) { collisionGrid[r][c] = 1; continue; }
          if (c >= 18 && c <= 20 && r === 12) { collisionGrid[r][c] = 1; continue; } // Garden Well
          if (c === 6 && r === 8) { collisionGrid[r][c] = 1; continue; } // Ate Joy
        }
        else if (place === 'school') {
          if (c >= 4 && c <= 7 && r === 5) { collisionGrid[r][c] = 1; continue; } // Teacher desk
          if (c >= 16 && c <= 19 && r === 5) { collisionGrid[r][c] = 1; continue; } // Library shelf
          if (c === 6 && r === 6) { collisionGrid[r][c] = 1; continue; } // Mentor David
        }
        else if (place === 'outreach') {
          if (c >= 4 && c <= 8 && r === 4) { collisionGrid[r][c] = 1; continue; } // Welcome Canopy
          if (c >= 14 && c <= 18 && r === 4) { collisionGrid[r][c] = 1; continue; } // Food distribution table
          if (c === 6 && r === 8) { collisionGrid[r][c] = 1; continue; } // Sarah
        }

        collisionGrid[r][c] = 0; // Walkable
      }
    }
  }

  function isWalkable(tileX, tileY) {
    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return false;
    if (state.activePlaceId === 'home' && tileY === 4 && (tileX === 19 || tileX === 20)) {
      return state.gateOpen;
    }
    return collisionGrid[tileY][tileX] === 0;
  }

  // ============================================================
  // 4. WEB AUDIO API SYNTHESIZER (MUTED BY DEFAULT)
  // ============================================================
  function initAudio() {
    if (!state.audio.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) state.audio.ctx = new AudioCtx();
    }
    if (state.audio.ctx && state.audio.ctx.state === 'suspended') {
      state.audio.ctx.resume();
    }
  }

  function toggleAudio() {
    initAudio();
    state.audio.isMuted = !state.audio.isMuted;
    const btn = document.getElementById('audio-toggle-btn');
    const icon = document.getElementById('audio-icon');
    const label = document.getElementById('audio-label');

    if (state.audio.isMuted) {
      btn.className = 'pill-btn audio-btn muted';
      icon.textContent = '🔈';
      label.textContent = 'Muted';
    } else {
      btn.className = 'pill-btn audio-btn unmuted';
      icon.textContent = '🔊';
      label.textContent = 'Sound On';
      playAcousticChime([523.25, 659.25, 783.99]);
    }
  }

  function playAcousticChime(freqs = [587.33, 739.99, 880.00]) {
    if (state.audio.isMuted || !state.audio.ctx) return;
    try {
      const now = state.audio.ctx.currentTime;
      freqs.forEach((freq, i) => {
        const osc = state.audio.ctx.createOscillator();
        const gain = state.audio.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.08);

        gain.gain.setValueAtTime(0.001, now + i * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.12, now + i * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.8);

        osc.connect(gain);
        gain.connect(state.audio.ctx.destination);
        osc.start(now + i * 0.08);
        osc.stop(now + i * 0.08 + 0.85);
      });
    } catch (e) {}
  }

  function playWoodTap() {
    if (state.audio.isMuted || !state.audio.ctx) return;
    try {
      const now = state.audio.ctx.currentTime;
      const osc = state.audio.ctx.createOscillator();
      const gain = state.audio.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.05);

      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(state.audio.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {}
  }

  function playParchmentTick() {
    if (state.audio.isMuted || !state.audio.ctx) return;
    try {
      const now = state.audio.ctx.currentTime;
      const osc = state.audio.ctx.createOscillator();
      const gain = state.audio.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      osc.connect(gain);
      gain.connect(state.audio.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    } catch (e) {}
  }

  function playGateCreak() {
    if (state.audio.isMuted || !state.audio.ctx) return;
    try {
      const now = state.audio.ctx.currentTime;
      const osc = state.audio.ctx.createOscillator();
      const gain = state.audio.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.linearRampToValueAtTime(120, now + 0.3);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(state.audio.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } catch (e) {}
  }

  // ============================================================
  // 5. CANVAS RENDERING ENGINE (3/4 TOP-DOWN FOR ALL PLACES)
  // ============================================================
  let canvas, ctx;
  let customizerCanvas, customizerCtx;
  let profileCanvas, profileCtx;

  function initCanvases() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    customizerCanvas = document.getElementById('customizer-canvas');
    customizerCtx = customizerCanvas.getContext('2d');
    profileCanvas = document.getElementById('profile-avatar-canvas');
    profileCtx = profileCanvas.getContext('2d');
  }

  function renderActivePlaceWorld() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const place = state.activePlaceId;

    if (place === 'home') {
      renderHomeWorld();
    } else if (place === 'fog_center') {
      renderFogCenterWorld();
    } else if (place === 'sports_hub') {
      renderSportsHubWorld();
    } else if (place === 'school') {
      renderSchoolWorld();
    } else if (place === 'outreach') {
      renderOutreachWorld();
    } else {
      // Generic template world for user-created custom places
      renderCustomTemplateWorld();
    }

    // Render active place NPC
    renderPlaceNPC();

    // Render Player Avatar
    renderPlayerAvatar();

    // Proximity Speech Indicator
    checkNpcProximity();

    // Emote Bubble
    if (state.avatar.emote && state.avatar.emoteTimer > 0) {
      renderEmoteBubble(
        state.avatar.x * TILE_SIZE,
        state.avatar.y * TILE_SIZE - 28,
        state.avatar.emote
      );
    }
  }

  // PLACE 1: MY HOME (FULL PHASE 0.7 ENVIRONMENT PRESERVED)
  function renderHomeWorld() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        if (r <= 3) {
          if (c >= 18 && c <= 21) {
            ctx.fillStyle = '#D6CCBA';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#B8A892';
            ctx.fillRect(x + 4, y + 4, 10, 8);
          } else {
            ctx.fillStyle = '#618556';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          }
          continue;
        }

        if (c <= 8 && r >= 10) {
          ctx.fillStyle = (r % 2 === 0) ? '#D9B48F' : '#CCA37E';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          continue;
        }

        if (c <= 8 && r >= 4 && r <= 9) {
          const isCheck = (c + r) % 2 === 0;
          ctx.fillStyle = isCheck ? '#EADBC8' : '#C86A4B';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          continue;
        }

        if (c >= 9 && c <= 15 && r >= 4 && r <= 9) {
          ctx.fillStyle = '#B08865';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#8A6342';
          ctx.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3);
          continue;
        }

        if (c >= 9 && c <= 15 && r >= 10) {
          ctx.fillStyle = (r % 2 === 0) ? '#E0BC96' : '#D4AC83';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          continue;
        }

        if (c >= 16) {
          if (state.gardenState === 'dry') {
            ctx.fillStyle = '#A38B72';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = '#423325';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#5A7D50';
            ctx.fillRect(x + 14, y + 6, 3, 3);
          }
          continue;
        }

        ctx.fillStyle = '#D9B48F';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // Bedroom Bed & Desk
    ctx.fillStyle = '#6E4C32';
    ctx.fillRect(1 * TILE_SIZE, 14 * TILE_SIZE, 3 * TILE_SIZE, 2.5 * TILE_SIZE);
    ctx.fillStyle = '#6AA6B8';
    ctx.fillRect(1.2 * TILE_SIZE, 14.8 * TILE_SIZE, 2.6 * TILE_SIZE, 1.6 * TILE_SIZE);
    ctx.fillStyle = '#8B5A36';
    ctx.fillRect(5 * TILE_SIZE, 11 * TILE_SIZE, 2 * TILE_SIZE, TILE_SIZE);

    // Sofa
    ctx.fillStyle = '#C86A4B';
    ctx.fillRect(10 * TILE_SIZE, 14 * TILE_SIZE, 3.5 * TILE_SIZE, 1.4 * TILE_SIZE);

    // Walls
    ctx.fillStyle = '#4A3323';
    ctx.fillRect(8 * TILE_SIZE - 3, 10 * TILE_SIZE, 6, 3 * TILE_SIZE);
    ctx.fillRect(8 * TILE_SIZE - 3, 15 * TILE_SIZE, 6, 3 * TILE_SIZE);
    ctx.fillRect(0, 10 * TILE_SIZE - 3, 4 * TILE_SIZE, 6);
    ctx.fillRect(5 * TILE_SIZE, 10 * TILE_SIZE - 3, 3 * TILE_SIZE, 6);

    // Fences & Gate
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(16 * TILE_SIZE, 4 * TILE_SIZE - 3, 3 * TILE_SIZE, 6);
    ctx.fillRect(21 * TILE_SIZE, 4 * TILE_SIZE - 3, 3 * TILE_SIZE, 6);
    ctx.fillRect(COLS * TILE_SIZE - 2 * TILE_SIZE, 4 * TILE_SIZE, 6, 13 * TILE_SIZE);

    if (!state.gateOpen) {
      ctx.fillStyle = '#5A3D28';
      ctx.fillRect(19 * TILE_SIZE, 4 * TILE_SIZE - 4, 2 * TILE_SIZE, 8);
      ctx.fillStyle = '#D49B35';
      ctx.beginPath();
      ctx.arc(20 * TILE_SIZE, 4 * TILE_SIZE - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#8B5A36';
      ctx.fillRect(18.6 * TILE_SIZE, 3.2 * TILE_SIZE, 6, 20);
      ctx.fillRect(21.2 * TILE_SIZE, 3.2 * TILE_SIZE, 6, 20);
    }

    // Potted Fern
    ctx.fillStyle = '#C86A4B';
    ctx.fillRect(17 * TILE_SIZE + 4, 6 * TILE_SIZE + 10, 24, 20);
    ctx.fillStyle = state.gardenState === 'dry' ? '#879177' : '#2E8B57';
    ctx.beginPath();
    ctx.arc(17 * TILE_SIZE + 16, 6 * TILE_SIZE + 8, 12, 0, Math.PI * 2);
    ctx.fill();

    // Sprout if lush
    if (state.gardenState === 'lush') {
      ctx.fillStyle = '#48C774';
      ctx.beginPath();
      ctx.arc(20 * TILE_SIZE + 16, 9 * TILE_SIZE + 16, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // PLACE 2: FOG COMMUNITY CENTER
  function renderFogCenterWorld() {
    // Courtyard stone pavers
    ctx.fillStyle = '#E3D8C8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Youth Hall Wood Deck (left half)
    ctx.fillStyle = '#D9B48F';
    ctx.fillRect(2 * TILE_SIZE, 3 * TILE_SIZE, 10 * TILE_SIZE, 12 * TILE_SIZE);
    ctx.strokeStyle = '#B88F66';
    ctx.strokeRect(2 * TILE_SIZE, 3 * TILE_SIZE, 10 * TILE_SIZE, 12 * TILE_SIZE);

    // Grand Quest Board
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(11 * TILE_SIZE, 4 * TILE_SIZE, 3 * TILE_SIZE, 1.8 * TILE_SIZE);
    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(11.2 * TILE_SIZE, 4.2 * TILE_SIZE, 2.6 * TILE_SIZE, 1.4 * TILE_SIZE);
    ctx.fillStyle = '#C86A4B';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('QUEST BOARD', 11.4 * TILE_SIZE, 5 * TILE_SIZE);

    // Community Garden beds (right side)
    ctx.fillStyle = '#4A3728';
    ctx.fillRect(15 * TILE_SIZE, 4 * TILE_SIZE, 8 * TILE_SIZE, 10 * TILE_SIZE);
    // Green seedling rows
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        ctx.fillStyle = '#48C774';
        ctx.beginPath();
        ctx.arc(16 * TILE_SIZE + col * 36, 5 * TILE_SIZE + row * 40, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Reflection Arbor Timber Cross
    ctx.fillStyle = '#5A3D28';
    ctx.fillRect(20 * TILE_SIZE, 12 * TILE_SIZE, 6, 24);
    ctx.fillRect(19.6 * TILE_SIZE, 12.4 * TILE_SIZE, 18, 6);
  }

  // PLACE 3: SPORTS HUB
  function renderSportsHubWorld() {
    // Green grass surroundings
    ctx.fillStyle = '#618556';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Running Track (perimeter red oval)
    ctx.strokeStyle = '#B3543D';
    ctx.lineWidth = 14;
    ctx.strokeRect(2 * TILE_SIZE, 2 * TILE_SIZE, 21 * TILE_SIZE, 14 * TILE_SIZE);

    // Hardwood Basketball Half-Court
    ctx.fillStyle = '#E0AC69';
    ctx.fillRect(6 * TILE_SIZE, 4 * TILE_SIZE, 13 * TILE_SIZE, 9 * TILE_SIZE);
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(6 * TILE_SIZE, 4 * TILE_SIZE, 13 * TILE_SIZE, 9 * TILE_SIZE);

    // Key & Free Throw Circle
    ctx.strokeRect(10 * TILE_SIZE, 4 * TILE_SIZE, 5 * TILE_SIZE, 5 * TILE_SIZE);
    ctx.beginPath();
    ctx.arc(12.5 * TILE_SIZE, 9 * TILE_SIZE, 2.5 * TILE_SIZE, 0, Math.PI * 2);
    ctx.stroke();

    // Basketball Hoop
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(12 * TILE_SIZE + 8, 3.8 * TILE_SIZE, 16, 4);
    ctx.fillStyle = '#FFF';
    ctx.fillRect(12 * TILE_SIZE + 10, 3.4 * TILE_SIZE, 12, 4);

    // Bleachers
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(8 * TILE_SIZE, 14.5 * TILE_SIZE, 9 * TILE_SIZE, 1.5 * TILE_SIZE);
  }

  // PLACE 4: SCHOOL
  function renderSchoolWorld() {
    ctx.fillStyle = '#E8E0D5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Classroom Floor
    ctx.fillStyle = '#D6CCBA';
    ctx.fillRect(2 * TILE_SIZE, 2 * TILE_SIZE, 10 * TILE_SIZE, 13 * TILE_SIZE);
    ctx.strokeStyle = '#999';
    ctx.strokeRect(2 * TILE_SIZE, 2 * TILE_SIZE, 10 * TILE_SIZE, 13 * TILE_SIZE);

    // Blackboard
    ctx.fillStyle = '#232B20';
    ctx.fillRect(4 * TILE_SIZE, 2.2 * TILE_SIZE, 6 * TILE_SIZE, 14);

    // Library Floor (Right side)
    ctx.fillStyle = '#CCA37E';
    ctx.fillRect(14 * TILE_SIZE, 2 * TILE_SIZE, 9 * TILE_SIZE, 13 * TILE_SIZE);
    // Bookshelves
    ctx.fillStyle = '#5A3D28';
    ctx.fillRect(15 * TILE_SIZE, 4 * TILE_SIZE, 7 * TILE_SIZE, 20);
    ctx.fillRect(15 * TILE_SIZE, 8 * TILE_SIZE, 7 * TILE_SIZE, 20);
  }

  // PLACE 5: OUTREACH SITE
  function renderOutreachWorld() {
    // Neighborhood park grass
    ctx.fillStyle = '#6E9462';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Welcome Canopy Tent
    ctx.fillStyle = '#C86A4B'; // Terracotta canvas roof
    ctx.fillRect(4 * TILE_SIZE, 3 * TILE_SIZE, 6 * TILE_SIZE, 4 * TILE_SIZE);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('WELCOME TENT', 4.5 * TILE_SIZE, 4.5 * TILE_SIZE);

    // Food Distribution Table
    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(14 * TILE_SIZE, 3.5 * TILE_SIZE, 6 * TILE_SIZE, 2 * TILE_SIZE);
    ctx.fillStyle = '#D49B35';
    // Food boxes
    for (let b = 0; b < 4; b++) {
      ctx.fillRect(14.5 * TILE_SIZE + b * 32, 4 * TILE_SIZE, 20, 16);
    }

    // Children's Story Mat
    ctx.fillStyle = '#6AA6B8';
    ctx.beginPath();
    ctx.ellipse(10 * TILE_SIZE, 12 * TILE_SIZE, 60, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // GENERIC CUSTOM TEMPLATE WORLD
  function renderCustomTemplateWorld() {
    ctx.fillStyle = '#E8E0D2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#C86A4B';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('NEW COMMUNITY PLACE (CONFIGURED IN STUDIO)', 4 * TILE_SIZE, 8 * TILE_SIZE);
  }

  // RENDER PLACE NPC
  function renderPlaceNPC() {
    const npc = NPCS[state.activePlaceId];
    if (!npc) return;

    const px = npc.x * TILE_SIZE;
    const py = npc.y * TILE_SIZE;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = npc.color;
    ctx.fillRect(px + 8, py + 12, 16, 14);

    // Head
    ctx.fillStyle = '#FFE0BD';
    ctx.beginPath();
    ctx.arc(px + 16, py + 8, 8, 0, Math.PI * 2);
    ctx.fill();

    // Label tag
    ctx.fillStyle = '#232B20';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(npc.name, px + 16, py - 4);
    ctx.textAlign = 'start';
  }

  // RENDER PLAYER AVATAR
  function renderPlayerAvatar() {
    const px = (state.avatar.x - 0.5) * TILE_SIZE;
    const py = (state.avatar.y - 0.5) * TILE_SIZE;

    const skin = SKIN_COLORS[state.avatar.skinIndex] || SKIN_COLORS[0];
    const hair = HAIR_COLORS[state.avatar.hairIndex] || HAIR_COLORS[0];
    const outfit = OUTFIT_PALETTES[state.avatar.outfitIndex] || OUTFIT_PALETTES[0];

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const legOffset = state.avatar.isMoving ? Math.sin(state.avatar.walkFrame) * 4 : 0;

    // Pants
    ctx.fillStyle = outfit.pants;
    ctx.fillRect(px + 10, py + 20 + legOffset, 4, 8);
    ctx.fillRect(px + 18, py + 20 - legOffset, 4, 8);

    // Shirt & Trim
    ctx.fillStyle = outfit.shirt;
    ctx.fillRect(px + 9, py + 12, 14, 10);
    ctx.fillStyle = outfit.trim;
    ctx.fillRect(px + 9, py + 19, 14, 2);

    // Head & Hair
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(px + 16, py + 9, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hair;
    ctx.fillRect(px + 11, py + 4, 10, 4);
  }

  function renderEmoteBubble(x, y, emote) {
    ctx.fillStyle = 'rgba(250, 247, 240, 0.95)';
    ctx.strokeStyle = '#4B6B44';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 16, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emote, x + 16, y);
    ctx.textAlign = 'start';
  }

  function renderAvatarPreview(targetCtx, size = 128) {
    if (!targetCtx) return;
    targetCtx.clearRect(0, 0, size, size);

    const skin = SKIN_COLORS[state.avatar.skinIndex] || SKIN_COLORS[0];
    const hair = HAIR_COLORS[state.avatar.hairIndex] || HAIR_COLORS[0];
    const outfit = OUTFIT_PALETTES[state.avatar.outfitIndex] || OUTFIT_PALETTES[0];

    const cx = size / 2;
    const cy = size / 2;
    const scale = size / 32;

    targetCtx.fillStyle = outfit.pants;
    targetCtx.fillRect(cx - 5 * scale, cy + 4 * scale, 4 * scale, 8 * scale);
    targetCtx.fillRect(cx + 1 * scale, cy + 4 * scale, 4 * scale, 8 * scale);

    targetCtx.fillStyle = outfit.shirt;
    targetCtx.fillRect(cx - 7 * scale, cy - 4 * scale, 14 * scale, 10 * scale);
    targetCtx.fillStyle = outfit.trim;
    targetCtx.fillRect(cx - 7 * scale, cy + 3 * scale, 14 * scale, 2 * scale);

    targetCtx.fillStyle = skin;
    targetCtx.beginPath();
    targetCtx.arc(cx, cy - 7 * scale, 6 * scale, 0, Math.PI * 2);
    targetCtx.fill();

    targetCtx.fillStyle = hair;
    targetCtx.fillRect(cx - 5 * scale, cy - 12 * scale, 10 * scale, 4 * scale);
  }

  function checkNpcProximity() {
    const npc = NPCS[state.activePlaceId];
    if (!npc) {
      document.getElementById('proximity-prompt').classList.add('hidden');
      return;
    }
    const dist = Math.hypot(state.avatar.x - npc.x, state.avatar.y - npc.y);
    if (dist <= 1.8) {
      document.getElementById('proximity-prompt').classList.remove('hidden');
    } else {
      document.getElementById('proximity-prompt').classList.add('hidden');
    }
  }

  // ============================================================
  // 6. MOVEMENT & CONTROLS
  // ============================================================
  const keysPressed = {};

  function handleKeyDown(e) {
    if (state.currentScreen !== 'game') return;
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    keysPressed[e.key.toLowerCase()] = true;

    if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
      e.preventDefault();
      tryInteractWithPlaceNPC();
    }
  }

  function handleKeyUp(e) {
    keysPressed[e.key.toLowerCase()] = false;
  }

  function tryInteractWithPlaceNPC() {
    const npc = NPCS[state.activePlaceId];
    if (!npc) return;

    const dist = Math.hypot(state.avatar.x - npc.x, state.avatar.y - npc.y);
    if (dist <= 1.8) {
      if (state.activePlaceId === 'home') {
        openBarnabyDialogue();
      } else if (state.activePlaceId === 'fog_center') {
        openNpcDialogue(npc.name, 'Welcome to the FOG Community Center! Check out Get Into the Glory or Alpha Youth Series in your Ledger.');
      } else if (state.activePlaceId === 'sports_hub') {
        openNpcDialogue(npc.name, 'Great hustle out here! Check our Basketball Day scores and practice your free throws Personal Best.');
      } else {
        openNpcDialogue(npc.name, `Welcome to ${PLACES[state.activePlaceId]?.name || 'here'}! What calling are you ready to take on today?`);
      }
    }
  }

  function updatePlayerMovement(dt) {
    let moveX = 0;
    let moveY = 0;

    if (state.avatar.targetX !== null && state.avatar.targetY !== null) {
      const dx = state.avatar.targetX - state.avatar.x;
      const dy = state.avatar.targetY - state.avatar.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 0.1) {
        state.avatar.targetX = null;
        state.avatar.targetY = null;
        state.avatar.isMoving = false;
      } else {
        moveX = dx / dist;
        moveY = dy / dist;
      }
    } else {
      if (keysPressed['w'] || keysPressed['arrowup']) moveY -= 1;
      if (keysPressed['s'] || keysPressed['arrowdown']) moveY += 1;
      if (keysPressed['a'] || keysPressed['arrowleft']) moveX -= 1;
      if (keysPressed['d'] || keysPressed['arrowright']) moveX += 1;
    }

    if (moveX !== 0 || moveY !== 0) {
      state.avatar.isMoving = true;
      const speed = 4.0 * dt;

      if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.7071;
        moveY *= 0.7071;
      }

      const newX = state.avatar.x + moveX * speed;
      const newY = state.avatar.y + moveY * speed;

      if (isWalkable(Math.floor(newX), Math.floor(state.avatar.y))) state.avatar.x = newX;
      if (isWalkable(Math.floor(state.avatar.x), Math.floor(newY))) state.avatar.y = newY;

      state.avatar.walkFrame += 12 * dt;
      if (Math.floor(state.avatar.walkFrame) % 4 === 0) playWoodTap();

      // Home North Gate Walkway Trigger
      if (state.activePlaceId === 'home' && state.avatar.y <= 1.5 && state.avatar.x >= 18 && state.avatar.x <= 21) {
        openWorldMapModal();
        showWorldToast('🗺️ Reached the country road! Select FOG Center on the World Map.');
      }
    } else {
      state.avatar.isMoving = false;
    }

    if (state.avatar.emoteTimer > 0) {
      state.avatar.emoteTimer -= dt;
      if (state.avatar.emoteTimer <= 0) state.avatar.emote = null;
    }
  }

  let lastTime = performance.now();
  function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (state.currentScreen === 'game') {
      updatePlayerMovement(dt);
      renderActivePlaceWorld();
    }
    requestAnimationFrame(gameLoop);
  }

  // ============================================================
  // 7. DIALOGUE SYSTEM
  // ============================================================
  let typewriterTimer = null;

  function openBarnabyDialogue() {
    state.isDialogueOpen = true;
    state.dialogueStep = 0;
    document.getElementById('dialogue-speaker').textContent = 'Uncle Barnaby';
    document.getElementById('dialogue-overlay').classList.remove('hidden');
    showDialogueLine([
      'Morning, Alex. Look at our garden patch out here.',
      'See this little plant? It doesn\'t need another button pressed. It needs someone to care for it.',
      'The water won\'t pour itself through glass, anak. Your first quest happens outside this world.'
    ], 0);
    playWoodTap();
  }

  function openNpcDialogue(speaker, message) {
    state.isDialogueOpen = true;
    state.dialogueStep = 0;
    document.getElementById('dialogue-speaker').textContent = speaker;
    document.getElementById('dialogue-overlay').classList.remove('hidden');
    showDialogueLine([message], 0);
    playWoodTap();
  }

  function showDialogueLine(lines, index) {
    const textEl = document.getElementById('dialogue-text');
    const btnTextEl = document.getElementById('dialogue-btn-text');
    const line = lines[index];
    if (!line) return;

    btnTextEl.textContent = (index === lines.length - 1) ? 'READY ▶' : 'NEXT ▶';
    textEl.textContent = '';
    if (typewriterTimer) clearInterval(typewriterTimer);

    let charIdx = 0;
    typewriterTimer = setInterval(() => {
      if (charIdx < line.length) {
        textEl.textContent += line[charIdx];
        charIdx++;
        if (charIdx % 3 === 0) playParchmentTick();
      } else {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
      }
    }, 20);
  }

  function advanceDialogue() {
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      return;
    }
    document.getElementById('dialogue-overlay').classList.add('hidden');
    state.isDialogueOpen = false;

    if (state.activePlaceId === 'home') {
      openQuestModalById('Q-001');
    }
  }

  // ============================================================
  // 8. QUEST FLOW (PRESERVING PHASE 0.7 & SUPPORTING NEW PLACES)
  // ============================================================
  function openQuestModalById(questId) {
    const q = QUESTS.find(item => item.id === questId) || state.customQuests.find(item => item.id === questId);
    if (!q) return;

    state.activeQuest = q;
    document.getElementById('quest-modal-category').textContent = `${q.category} • ${q.id}`;
    document.getElementById('quest-modal-title').textContent = q.title;
    document.getElementById('quest-modal-mission').textContent = q.realWorldAction;
    document.getElementById('quest-modal-fallback-text').textContent = q.fallback || 'Take quiet responsibility at home or with a peer.';

    const rewardsGrid = document.getElementById('quest-modal-rewards-grid');
    rewardsGrid.innerHTML = `
      <div class="reward-entry"><span class="reward-icon">🪙</span><span class="reward-val">+${q.rewards.lp} Life Points</span></div>
      <div class="reward-entry"><span class="reward-icon">🛡️</span><span class="reward-val">+${q.rewards.charXp} Char XP</span></div>
      <div class="reward-entry"><span class="reward-icon">🌱</span><span class="reward-val">+15 Main Skill XP</span></div>
      <div class="reward-entry"><span class="reward-icon">🤝</span><span class="reward-val">+${q.rewards.communityContribution} Community XP</span></div>
    `;

    document.getElementById('quest-modal').classList.remove('hidden');
    playAcousticChime([523.25, 659.25]);
  }

  function acceptActiveQuest() {
    document.getElementById('quest-modal').classList.add('hidden');
    state.questStatus = 'active';

    // Signature Exit Ramp
    document.getElementById('exit-ramp-mission-text').textContent = state.activeQuest.realWorldAction;
    document.getElementById('exit-ramp-modal').classList.remove('hidden');
  }

  function stepOutToRealWorld() {
    document.getElementById('exit-ramp-modal').classList.add('hidden');
    state.questStatus = 'in_progress_real_world';

    document.getElementById('standby-task-reminder').textContent = state.activeQuest.realWorldAction;
    document.getElementById('standby-modal').classList.remove('hidden');
    showWorldToast('🌿 Standby Mode Active. Go be a blessing out there.');
  }

  function returnFromRealWorld() {
    document.getElementById('standby-modal').classList.add('hidden');
    document.getElementById('verification-modal').classList.remove('hidden');
    playAcousticChime([587.33, 739.99, 880.00]);
  }

  function chooseTrustVerification() {
    state.verificationMethod = 'trust';
    document.getElementById('verification-modal').classList.add('hidden');
    openReflectionModal();
  }

  function chooseFamilyVerification() {
    state.verificationMethod = 'family';
    document.getElementById('verification-modal').classList.add('hidden');
    document.getElementById('family-quest-name-text').textContent = `${state.activeQuest.realWorldAction} (${state.activeQuest.title})`;
    document.getElementById('family-modal').classList.remove('hidden');
  }

  function confirmParentVerification() {
    document.getElementById('family-modal').classList.add('hidden');
    openReflectionModal();
  }

  function openReflectionModal() {
    document.getElementById('reflection-modal').classList.remove('hidden');
    document.getElementById('reflection-prompt-label').textContent = state.activeQuest.reflectionPrompt;
    document.getElementById('reflection-input').focus();
  }

  function submitReflection() {
    const input = document.getElementById('reflection-input');
    state.reflectionText = input.value.trim() || 'Carried out quiet faithfulness in the real world.';
    document.getElementById('reflection-modal').classList.add('hidden');
    executeRewards();
  }

  function executeRewards() {
    state.questStatus = 'completed';
    const q = state.activeQuest;

    state.lp += q.rewards.lp;
    state.charXp += q.rewards.charXp;
    state.communityPool += q.rewards.communityContribution;

    // Allocate skill XP
    if (q.rewards.skillXp) {
      for (const [skill, val] of Object.entries(q.rewards.skillXp)) {
        if (state.skills[skill] !== undefined) {
          state.skills[skill] += val;
        }
      }
    } else {
      state.skills.stewardship += 15;
    }

    // Update Left Sidebar UI
    document.getElementById('lp-amount').textContent = state.lp;
    document.getElementById('lp-delta').classList.remove('hidden');
    document.getElementById('char-xp-display').textContent = `(${state.charXp} / 100 XP)`;

    document.getElementById('stewardship-xp-text').textContent = `${state.skills.stewardship} XP`;
    document.getElementById('stewardship-meter-fill').style.width = `${Math.min((state.skills.stewardship / 50) * 100, 100)}%`;

    document.getElementById('responsibility-xp-text').textContent = `${state.skills.responsibility} XP`;
    document.getElementById('responsibility-meter-fill').style.width = `${Math.min((state.skills.responsibility / 50) * 100, 100)}%`;

    document.getElementById('discipline-xp-text').textContent = `${state.skills.discipline} XP`;
    document.getElementById('discipline-meter-fill').style.width = `${Math.min((state.skills.discipline / 50) * 100, 100)}%`;

    document.getElementById('teamwork-xp-text').textContent = `${state.skills.teamwork} XP`;
    document.getElementById('teamwork-meter-fill').style.width = `${Math.min((state.skills.teamwork / 50) * 100, 100)}%`;

    document.getElementById('service-xp-text').textContent = `${state.skills.service} XP`;
    document.getElementById('service-meter-fill').style.width = `${Math.min((state.skills.service / 50) * 100, 100)}%`;

    document.getElementById('compassion-xp-text').textContent = `${state.skills.compassion} XP`;
    document.getElementById('compassion-meter-fill').style.width = `${Math.min((state.skills.compassion / 50) * 100, 100)}%`;

    // Community Pool in Right Sidebar
    document.getElementById('comm-progress-fraction').textContent = `${state.communityPool} / 500`;
    document.getElementById('comm-meter-fill').style.width = `${Math.min((state.communityPool / 500) * 100, 100)}%`;
    document.getElementById('comm-recent-add').classList.remove('hidden');

    // Reward Modal
    document.getElementById('reward-quest-name').textContent = q.title;
    document.getElementById('reward-lp-val').textContent = `+${q.rewards.lp} LP`;
    document.getElementById('reward-lp-balance-note').textContent = `(${state.lp - q.rewards.lp} → ${state.lp} LP)`;
    document.getElementById('reward-char-xp-val').textContent = `+${q.rewards.charXp} XP`;

    playAcousticChime([523.25, 659.25, 783.99, 1046.50]);
    document.getElementById('reward-modal').classList.remove('hidden');

    // If Home Quest 001, transform garden!
    if (q.id === 'Q-001') {
      state.gardenState = 'lush';
      state.gateOpen = true;
      initCollisionGrid();
      playGateCreak();
    }
  }

  // ============================================================
  // 9. PLACE TRAVEL & WORLD MAP CONTROLLER
  // ============================================================
  function openWorldMapModal() {
    document.getElementById('world-map-modal').classList.remove('hidden');
    updateMapPlaceSelection(state.activePlaceId);
  }

  function updateMapPlaceSelection(placeId) {
    state.selectedMapPlace = placeId;
    const place = PLACES[placeId] || state.customPlaces[placeId];
    if (!place) return;

    // Highlight node
    document.querySelectorAll('.map-node').forEach(node => {
      node.classList.toggle('active-node', node.dataset.place === placeId);
    });

    // Update Details
    document.getElementById('map-detail-icon').textContent = place.icon || '📍';
    document.getElementById('map-detail-title').textContent = place.name;
    document.getElementById('map-detail-tagline').textContent = place.tagline || place.category;
    document.getElementById('map-detail-desc').textContent = place.description;
  }

  function travelToSelectedMapPlace() {
    const targetPlaceId = state.selectedMapPlace;
    document.getElementById('world-map-modal').classList.add('hidden');

    travelToPlace(targetPlaceId);
  }

  function travelToPlace(placeId) {
    const place = PLACES[placeId] || state.customPlaces[placeId];
    if (!place) return;

    state.activePlaceId = placeId;

    // Reset player position inside new place
    state.avatar.x = 6.5;
    state.avatar.y = 8.5;
    state.avatar.targetX = null;
    state.avatar.targetY = null;

    initCollisionGrid();

    // Update Header Pill
    document.getElementById('header-place-name').textContent = place.name;

    // Update Canvas Badge
    document.getElementById('canvas-place-icon').textContent = place.icon || '📍';
    document.getElementById('canvas-place-label').textContent = place.name;
    const lifecycleEl = document.getElementById('canvas-place-lifecycle');
    lifecycleEl.className = `lifecycle-chip ${place.lifecycle}`;
    lifecycleEl.textContent = `${place.lifecycle} Place`;

    // Refresh Right Sidebar Quests & History for new place
    populateRightPanelQuests(placeId);
    populatePlaceHistory(placeId);

    showWorldToast(`✨ Traveled to ${place.name}`);
    playAcousticChime([587.33, 739.99, 880.00]);
  }

  function populateRightPanelQuests(placeId) {
    const place = PLACES[placeId] || state.customPlaces[placeId];
    document.getElementById('place-ledger-title').textContent = `${place.name} Calling`;
    document.getElementById('place-ledger-sub').textContent = place.category || 'Ministry Service';

    const container = document.getElementById('active-place-quests-list');
    const placeQuests = QUESTS.filter(q => q.placeId === placeId).concat(
      state.customQuests.filter(q => q.placeId === placeId)
    );

    if (placeQuests.length === 0) {
      container.innerHTML = `<p class="small-text" style="color: #888;">No active callings right now for this zone.</p>`;
      return;
    }

    container.innerHTML = placeQuests.map(q => `
      <div class="quest-item-card">
        <div class="quest-item-header">
          <h4>${q.icon} ${q.title}</h4>
          <span class="quest-tag-badge">${q.verification}</span>
        </div>
        <p class="quest-item-desc">${q.description}</p>
        <div class="quest-item-rewards">
          <span class="quest-reward-chip">🪙 +${q.rewards.lp} LP</span>
          <span class="quest-reward-chip">🛡️ +${q.rewards.charXp} Char XP</span>
          <span class="quest-reward-chip">🤝 +${q.rewards.communityContribution} Comm XP</span>
        </div>
        <button class="primary-btn small-btn btn-start-quest" data-quest-id="${q.id}" style="margin-top: 4px;">
          Take Calling ▶
        </button>
      </div>
    `).join('');

    // Attach click handlers
    container.querySelectorAll('.btn-start-quest').forEach(btn => {
      btn.addEventListener('click', (e) => {
        openQuestModalById(e.currentTarget.dataset.questId);
      });
    });
  }

  function populatePlaceHistory(placeId) {
    const place = PLACES[placeId] || state.customPlaces[placeId];
    document.getElementById('history-place-title').textContent = `${place.name} Chronicle`;

    const container = document.getElementById('place-history-list');
    if (!place.history || place.history.length === 0) {
      container.innerHTML = `<p class="small-text" style="color: #888;">No recorded memories yet for this place.</p>`;
      return;
    }

    container.innerHTML = place.history.map(h => `
      <div class="history-item-card">
        <div class="history-date">${h.date} &bull; ${h.badge}</div>
        <div class="history-title">${h.title}</div>
        <div class="history-desc">${h.description}</div>
      </div>
    `).join('');
  }

  // ============================================================
  // 10. MODAL POPULATORS: EVENT MEMORIES & MY JOURNEY
  // ============================================================
  function populateEventMemoriesModal() {
    const container = document.getElementById('photo-cards-container');
    container.innerHTML = EVENT_MEMORIES.map(m => `
      <div class="photo-memory-card">
        <div class="photo-placeholder-canvas" style="background: ${m.bgGradient}; color: #fff;">
          <span>${m.icon}</span>
        </div>
        <div class="photo-card-body">
          <span class="photo-card-title">${m.title}</span>
          <p class="photo-card-caption">${m.caption}</p>
          <span class="photo-card-meta">Uploaded by ${m.uploadedBy} &bull; Community</span>
        </div>
      </div>
    `).join('');
  }

  function populateMyJourneyModal() {
    // Timeline
    const timelineContainer = document.getElementById('journey-timeline-container');
    timelineContainer.innerHTML = MY_JOURNEY.timeline.map(t => `
      <div class="timeline-entry-card">
        <div class="timeline-icon">${t.icon}</div>
        <div class="timeline-content">
          <div class="timeline-meta">${t.month} &bull; ${t.placeName}</div>
          <h4>${t.title}</h4>
          <p>${t.description}</p>
        </div>
      </div>
    `).join('');

    // Badges
    const badgesContainer = document.getElementById('journey-badges-container');
    badgesContainer.innerHTML = MY_JOURNEY.achievements.map(a => `
      <div class="badge-item ${a.unlocked ? 'unlocked' : 'locked'}">
        <span>${a.icon}</span>
        <span>${a.name}</span>
      </div>
    `).join('');
  }

  // ============================================================
  // 11. ADMIN KOINONIA STUDIO (NO-CODE BUILDERS)
  // ============================================================
  function openAdminStudioModal() {
    document.getElementById('admin-studio-modal').classList.remove('hidden');
    refreshAdminPlacesList();
    refreshAdminQuestsList();
  }

  function refreshAdminPlacesList() {
    const container = document.getElementById('admin-places-cards-list');
    const allPlaces = Object.values(PLACES).concat(Object.values(state.customPlaces));

    container.innerHTML = allPlaces.map(p => `
      <div class="admin-place-card-item">
        <div>
          <strong>${p.icon || '📍'} ${p.name}</strong>
          <div style="font-size: 10px; color: #777;">${p.lifecycle} &bull; ${p.zones ? p.zones.length : 0} Zones</div>
        </div>
        <span class="quest-tag-badge">${p.communityId || 'fog'}</span>
      </div>
    `).join('');
  }

  function refreshAdminQuestsList() {
    const container = document.getElementById('admin-quests-cards-list');
    const allQuests = QUESTS.concat(state.customQuests);

    container.innerHTML = allQuests.map(q => `
      <div class="admin-place-card-item">
        <div>
          <strong>${q.icon} ${q.title}</strong>
          <div style="font-size: 10px; color: #777;">Place: ${q.placeId} &bull; +${q.rewards.lp} LP</div>
        </div>
        <span class="quest-tag-badge">${q.verification}</span>
      </div>
    `).join('');
  }

  function saveNewPlaceFromStudio() {
    const nameInput = document.getElementById('new-place-name');
    const name = nameInput.value.trim();
    if (!name) {
      alert('Please provide a place name.');
      return;
    }

    const template = document.getElementById('new-place-template').value;
    const lifecycle = document.getElementById('new-place-lifecycle').value;
    const desc = document.getElementById('new-place-desc').value.trim() || 'A new community place in Fire of God.';

    const id = 'custom_' + Date.now();
    const newPlace = {
      id,
      communityId: 'fog', // Forward compatible
      name,
      lifecycle,
      category: 'Community Place',
      icon: '🏛️',
      accentColor: '#C86A4B',
      tagline: 'Custom place configured in Koinonia Studio.',
      description: desc,
      mapCoords: { x: 400, y: 250 },
      unlocked: true,
      zones: [
        { id: 'zone_entrance', name: 'Entrance', icon: '🚪', description: 'Welcoming threshold' },
        { id: 'zone_hall', name: 'Main Hall', icon: '🏛️', description: 'Assembly area' }
      ],
      history: [
        { date: 'September 2026', title: 'Place Configured', description: 'Created in Koinonia Studio prototype.', badge: 'Studio' }
      ]
    };

    state.customPlaces[id] = newPlace;
    nameInput.value = '';
    document.getElementById('new-place-desc').value = '';

    refreshAdminPlacesList();
    showWorldToast(`✅ Place "${name}" created in Koinonia Studio!`);
    playAcousticChime([523.25, 659.25, 783.99]);
  }

  function saveNewQuestFromStudio() {
    const titleInput = document.getElementById('new-quest-title');
    const title = titleInput.value.trim();
    if (!title) {
      alert('Please enter a quest title.');
      return;
    }

    const placeId = document.getElementById('new-quest-place').value;
    const verification = document.getElementById('new-quest-verification').value;
    const action = document.getElementById('new-quest-action').value.trim() || 'Faithful real-world stewardship.';
    const lp = parseInt(document.getElementById('new-quest-lp').value, 10) || 5;
    const skill = document.getElementById('new-quest-skill').value;

    const newQuest = {
      id: 'Q-' + (QUESTS.length + state.customQuests.length + 1).toString().padStart(3, '0'),
      communityId: 'fog',
      placeId,
      title,
      category: 'Community Calling',
      icon: '📜',
      description: action,
      fallback: 'Help quietly with family or peer needs.',
      realWorldAction: action,
      verification,
      rewards: {
        lp,
        charXp: 5,
        skillXp: { [skill]: 15 },
        communityContribution: 15
      },
      repeatability: 'daily',
      reflectionPrompt: 'What did you notice while serving?',
      status: 'ready'
    };

    state.customQuests.push(newQuest);
    titleInput.value = '';
    document.getElementById('new-quest-action').value = '';

    refreshAdminQuestsList();
    populateRightPanelQuests(state.activePlaceId);
    showWorldToast(`✅ Quest "${title}" added to ${placeId}!`);
    playAcousticChime([587.33, 739.99]);
  }

  // ============================================================
  // 12. PROTOTYPE DATA RESET
  // ============================================================
  function resetDemoData() {
    state.lp = 120;
    state.charXp = 0;
    state.skills = { stewardship: 0, responsibility: 0, discipline: 0, teamwork: 0, service: 0, compassion: 0 };
    state.communityPool = 142;
    state.gardenState = 'dry';
    state.gateOpen = false;
    state.questStatus = 'ready';
    state.activePlaceId = 'home';
    state.customPlaces = {};
    state.customQuests = [];

    state.avatar.x = 4.5;
    state.avatar.y = 14.5;
    state.avatar.targetX = null;
    state.avatar.targetY = null;

    initCollisionGrid();

    // Reset Left Sidebar UI
    document.getElementById('lp-amount').textContent = '120';
    document.getElementById('lp-delta').classList.add('hidden');
    document.getElementById('char-xp-display').textContent = '(0 / 100 XP)';

    ['stewardship', 'responsibility', 'discipline', 'teamwork', 'service', 'compassion'].forEach(sk => {
      const txt = document.getElementById(`${sk}-xp-text`);
      const fill = document.getElementById(`${sk}-meter-fill`);
      if (txt) txt.textContent = '0 XP';
      if (fill) fill.style.width = '0%';
    });

    // Reset Header Pill
    document.getElementById('header-place-name').textContent = 'My Home';

    // Reset Right Sidebar
    document.getElementById('comm-progress-fraction').textContent = '142 / 500';
    document.getElementById('comm-meter-fill').style.width = '28.4%';
    document.getElementById('comm-recent-add').classList.add('hidden');

    populateRightPanelQuests('home');
    populatePlaceHistory('home');

    // Close any open modals
    document.querySelectorAll('.modal-backdrop:not(#title-screen)').forEach(m => m.classList.add('hidden'));

    showWorldToast('🔄 Demo data reset to fresh state.');
    playWoodTap();
  }

  function showWorldToast(msg) {
    const toast = document.getElementById('world-toast');
    document.getElementById('toast-message').textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => { toast.classList.add('hidden'); }, 3500);
  }

  // ============================================================
  // 13. EVENT LISTENERS SETUP
  // ============================================================
  function setupEventListeners() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Canvas click-to-move
    canvas.addEventListener('pointerdown', (e) => {
      if (state.currentScreen !== 'game') return;
      initAudio();

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      state.avatar.targetX = clickX / TILE_SIZE;
      state.avatar.targetY = clickY / TILE_SIZE;
    });

    // Mobile D-Pad
    const bindDpad = (id, key) => {
      const btn = document.getElementById(id);
      btn.addEventListener('pointerdown', (e) => { e.preventDefault(); initAudio(); keysPressed[key] = true; });
      btn.addEventListener('pointerup', () => { keysPressed[key] = false; });
      btn.addEventListener('pointerleave', () => { keysPressed[key] = false; });
    };
    bindDpad('dpad-up', 'arrowup');
    bindDpad('dpad-down', 'arrowdown');
    bindDpad('dpad-left', 'arrowleft');
    bindDpad('dpad-right', 'arrowright');

    document.getElementById('mobile-action-btn').addEventListener('click', () => {
      initAudio();
      tryInteractWithPlaceNPC();
    });

    // Title Screen
    document.getElementById('btn-begin-adventure').addEventListener('click', () => {
      initAudio();
      document.getElementById('title-screen').classList.remove('active');
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('avatar-modal').classList.remove('hidden');
      state.currentScreen = 'avatar';
      renderAvatarPreview(customizerCtx, 128);
    });

    // Avatar Customizer
    document.querySelectorAll('.swatch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.swatch-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.avatar.skinIndex = parseInt(e.currentTarget.dataset.skin, 10);
        renderAvatarPreview(customizerCtx, 128);
        playWoodTap();
      });
    });

    document.querySelectorAll('.choice-pill[data-hair]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.choice-pill[data-hair]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.avatar.hairIndex = parseInt(e.currentTarget.dataset.hair, 10);
        renderAvatarPreview(customizerCtx, 128);
        playWoodTap();
      });
    });

    document.querySelectorAll('.choice-pill[data-outfit]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.choice-pill[data-outfit]').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        state.avatar.outfitIndex = parseInt(e.currentTarget.dataset.outfit, 10);
        renderAvatarPreview(customizerCtx, 128);
        playWoodTap();
      });
    });

    document.getElementById('btn-enter-home').addEventListener('click', () => {
      document.getElementById('avatar-modal').classList.add('hidden');
      state.currentScreen = 'game';
      renderAvatarPreview(profileCtx, 64);
      travelToPlace('home');
      showWorldToast('🏡 Welcome home, Alex. Explore or check the World Map.');
    });

    // World Map Travel Modal
    document.getElementById('btn-quick-map').addEventListener('click', openWorldMapModal);
    document.getElementById('btn-close-map').addEventListener('click', () => {
      document.getElementById('world-map-modal').classList.add('hidden');
    });

    document.querySelectorAll('.map-node').forEach(node => {
      node.addEventListener('click', (e) => {
        updateMapPlaceSelection(e.currentTarget.dataset.place);
      });
    });

    document.getElementById('btn-map-travel-now').addEventListener('click', travelToSelectedMapPlace);

    // Dialogue Overlay
    document.getElementById('dialogue-next-btn').addEventListener('click', advanceDialogue);

    // Quest Flow
    document.getElementById('btn-accept-quest').addEventListener('click', acceptActiveQuest);
    document.getElementById('btn-close-quest-modal').addEventListener('click', () => {
      document.getElementById('quest-modal').classList.add('hidden');
    });

    document.getElementById('btn-step-out').addEventListener('click', stepOutToRealWorld);
    document.getElementById('btn-im-back').addEventListener('click', returnFromRealWorld);
    document.getElementById('btn-review-quest').addEventListener('click', () => {
      document.getElementById('standby-modal').classList.add('hidden');
      document.getElementById('quest-modal').classList.remove('hidden');
    });

    document.getElementById('btn-choose-trust').addEventListener('click', chooseTrustVerification);
    document.getElementById('btn-choose-family').addEventListener('click', chooseFamilyVerification);
    document.getElementById('btn-parent-confirm').addEventListener('click', confirmParentVerification);
    document.getElementById('btn-family-back').addEventListener('click', () => {
      document.getElementById('family-modal').classList.add('hidden');
      document.getElementById('verification-modal').classList.remove('hidden');
    });

    document.getElementById('btn-submit-reflection').addEventListener('click', submitReflection);
    document.getElementById('btn-dismiss-rewards').addEventListener('click', () => {
      document.getElementById('reward-modal').classList.add('hidden');
    });

    // Right Sidebar Tab Switching
    const tabBtnQuests = document.getElementById('tab-btn-quests');
    const tabBtnCampaigns = document.getElementById('tab-btn-campaigns');
    const tabBtnHistory = document.getElementById('tab-btn-history');
    const paneQuests = document.getElementById('tab-content-quests');
    const paneCampaigns = document.getElementById('tab-content-campaigns');
    const paneHistory = document.getElementById('tab-content-history');

    const switchRightTab = (activeBtn, activePane) => {
      [tabBtnQuests, tabBtnCampaigns, tabBtnHistory].forEach(b => b.classList.remove('active'));
      [paneQuests, paneCampaigns, paneHistory].forEach(p => p.classList.add('hidden'));
      activeBtn.classList.add('active');
      activePane.classList.remove('hidden');
    };

    tabBtnQuests.addEventListener('click', () => switchRightTab(tabBtnQuests, paneQuests));
    tabBtnCampaigns.addEventListener('click', () => switchRightTab(tabBtnCampaigns, paneCampaigns));
    tabBtnHistory.addEventListener('click', () => switchRightTab(tabBtnHistory, paneHistory));

    // Campaigns & Events Modals
    document.getElementById('btn-view-gitg').addEventListener('click', () => {
      document.getElementById('gitg-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-gitg').addEventListener('click', () => {
      document.getElementById('gitg-modal').classList.add('hidden');
    });

    document.getElementById('btn-view-ays').addEventListener('click', () => {
      document.getElementById('ays-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-ays').addEventListener('click', () => {
      document.getElementById('ays-modal').classList.add('hidden');
    });

    document.getElementById('btn-view-sports-event').addEventListener('click', () => {
      document.getElementById('sports-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-sports').addEventListener('click', () => {
      document.getElementById('sports-modal').classList.add('hidden');
    });

    // Photo Memories Gallery
    document.getElementById('btn-view-event-memories').addEventListener('click', () => {
      populateEventMemoriesModal();
      document.getElementById('memories-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-memories').addEventListener('click', () => {
      document.getElementById('memories-modal').classList.add('hidden');
    });

    // My Journey Archive
    document.getElementById('btn-open-journey').addEventListener('click', () => {
      populateMyJourneyModal();
      document.getElementById('journey-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-journey').addEventListener('click', () => {
      document.getElementById('journey-modal').classList.add('hidden');
    });

    // Admin Koinonia Studio
    document.getElementById('btn-open-admin').addEventListener('click', openAdminStudioModal);
    document.getElementById('btn-close-admin').addEventListener('click', () => {
      document.getElementById('admin-studio-modal').classList.add('hidden');
    });

    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-pane').forEach(p => p.classList.add('hidden'));

        e.currentTarget.classList.add('active');
        const targetPane = document.getElementById('tab-' + e.currentTarget.dataset.tab);
        if (targetPane) targetPane.classList.remove('hidden');
      });
    });

    document.getElementById('btn-save-new-place').addEventListener('click', saveNewPlaceFromStudio);
    document.getElementById('btn-save-new-quest').addEventListener('click', saveNewQuestFromStudio);

    // Global Header Controls
    document.getElementById('audio-toggle-btn').addEventListener('click', toggleAudio);
    document.getElementById('dev-reset-btn').addEventListener('click', resetDemoData);

    // Panels Toggles
    const panelLeft = document.getElementById('panel-left');
    const panelRight = document.getElementById('panel-right');

    document.getElementById('toggle-left-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) panelLeft.classList.toggle('collapsed');
      else panelLeft.classList.toggle('open');
    });
    document.getElementById('close-left-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) panelLeft.classList.add('collapsed');
      else panelLeft.classList.remove('open');
    });

    document.getElementById('toggle-right-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) panelRight.classList.toggle('collapsed');
      else panelRight.classList.toggle('open');
    });
    document.getElementById('close-right-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) panelRight.classList.add('collapsed');
      else panelRight.classList.remove('open');
    });

    // Emotes
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.avatar.emote = e.currentTarget.dataset.emote;
        state.avatar.emoteTimer = 3.0;
        playWoodTap();
      });
    });
  }

  // ============================================================
  // 14. INITIAL BOOTSTRAP
  // ============================================================
  window.addEventListener('DOMContentLoaded', () => {
    initCollisionGrid();
    initCanvases();
    setupEventListeners();
    populateRightPanelQuests('home');
    populatePlaceHistory('home');
    requestAnimationFrame(gameLoop);
  });

})();
