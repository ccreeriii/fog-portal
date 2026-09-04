/**
 * KOINONIA QUEST — PHASE 0.7 STANDALONE VISUALLY PLAYABLE PROTOTYPE
 *
 * Visual Identity: "The Handcrafted Hearth"
 * World Perspective: 3/4 Top-Down 2D HTML5 Canvas
 * Architecture: Zero-dependency vanilla JavaScript, Web Audio API synthesis
 * Launch Safety: 100% isolated, fake in-memory data, zero production database connection
 */

(function () {
  'use strict';

  // ============================================================
  // 1. GAME STATE & IN-MEMORY TEST DATA
  // ============================================================
  const state = {
    // Screen & Flow State
    currentScreen: 'title', // 'title' | 'avatar' | 'game'
    dialogueStep: 0,
    isDialogueOpen: false,
    questStatus: 'ready', // 'ready' | 'active' | 'in_progress_real_world' | 'completed'
    verificationMethod: null, // 'trust' | 'family'
    reflectionText: '',
    
    // Fake Prototype Currency & XP (Secondary to character formation)
    lp: 120, // 120 LP -> 125 LP post-quest
    charXp: 0, // 0 -> 5 XP
    stewardshipXp: 0, // 0 -> 15 XP
    responsibilityXp: 0, // 0 -> 5 XP
    communityPool: 142, // 142 -> 157 / 500 post-quest
    
    // Environmental Progression
    gardenState: 'dry', // 'dry' | 'lush'
    gateOpen: false,
    
    // Player Customization
    avatar: {
      name: 'Alex',
      skinIndex: 0,
      hairIndex: 0,
      outfitIndex: 0,
      x: 4.5, // Tile coordinates
      y: 14.5,
      targetX: null,
      targetY: null,
      dir: 'down', // 'down' | 'up' | 'left' | 'right'
      isMoving: false,
      walkFrame: 0,
      animTimer: 0,
      emote: null,
      emoteTimer: 0
    },
    
    // Audio Policy: MUTED BY DEFAULT per Product Owner mandate
    audio: {
      ctx: null,
      isMuted: true
    }
  };

  // Color Swatches for Customizer
  const SKIN_COLORS = ['#FFE0BD', '#E0AC69', '#8D5524', '#4A2C11'];
  const HAIR_COLORS = ['#3D2314', '#1F1713', '#663B1C', '#8C562A'];
  const OUTFIT_PALETTES = [
    { shirt: '#C86A4B', pants: '#374E32', trim: '#F2B84B', name: 'Terracotta Tunic' },
    { shirt: '#4B6B44', pants: '#4A3323', trim: '#FAF7F0', name: 'Olive Gardener' },
    { shirt: '#2C3E55', pants: '#6B7465', trim: '#F2B84B', name: 'Sky Pilgrim' }
  ];

  // Tile Map Constants
  const TILE_SIZE = 32;
  const COLS = 25; // 800px width
  const ROWS = 18; // 576px height

  // Uncle Barnaby Coordinates
  const BARNABY = {
    x: 14,
    y: 6,
    name: 'Uncle Barnaby',
    dir: 'down',
    proximityDist: 1.8
  };

  // ============================================================
  // 2. WORLD MAP & COLLISION DEFINITION
  // ============================================================
  // 0 = Walkable, 1 = Wall/Obstacle, 2 = Door/Open Path, 3 = Gate (Locked initially)
  const collisionGrid = [];

  function initCollisionGrid() {
    for (let r = 0; r < ROWS; r++) {
      collisionGrid[r] = [];
      for (let c = 0; c < COLS; c++) {
        // Outer boundaries
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          collisionGrid[r][c] = 1;
          continue;
        }

        // Bedroom walls (x: 0..8, y: 10..17)
        if (c === 8 && r >= 10 && r <= 17 && r !== 13 && r !== 14) {
          collisionGrid[r][c] = 1; // Wall separating Bedroom and Living Area (door at r=13,14)
          continue;
        }
        if (r === 10 && c <= 8 && c !== 4) {
          collisionGrid[r][c] = 1; // Wall separating Bedroom and Kitchen (door at c=4)
          continue;
        }

        // Bedroom Furniture
        if (c >= 1 && c <= 3 && r >= 14 && r <= 16) {
          collisionGrid[r][c] = 1; // Platform Bed
          continue;
        }
        if (c >= 5 && c <= 6 && r === 11) {
          collisionGrid[r][c] = 1; // Study Desk
          continue;
        }
        if (c === 1 && r === 11) {
          collisionGrid[r][c] = 1; // Wardrobe
          continue;
        }

        // Kitchen walls & counters (x: 0..8, y: 1..9)
        if (c === 8 && r >= 1 && r <= 9 && r !== 6 && r !== 7) {
          collisionGrid[r][c] = 1; // Wall between Kitchen and Veranda (door at r=6,7)
          continue;
        }
        if (r === 3 && c <= 6) {
          collisionGrid[r][c] = 1; // Kitchen Counter & Sink
          continue;
        }
        if (c >= 3 && c <= 5 && r >= 6 && r <= 7) {
          collisionGrid[r][c] = 1; // Dining Table
          continue;
        }

        // Living Area Furniture (x: 9..15, y: 10..17)
        if (c >= 10 && c <= 13 && r === 14) {
          collisionGrid[r][c] = 1; // Sofa
          continue;
        }
        if (c >= 11 && c <= 13 && r === 11) {
          collisionGrid[r][c] = 1; // Bookshelf
          continue;
        }

        // Veranda railing & boundary (x: 9..15, y: 3..9)
        if (r === 3 && c >= 9 && c <= 15) {
          collisionGrid[r][c] = 1; // North Veranda Railing
          continue;
        }
        if (c === 15 && r >= 3 && r <= 9 && r !== 6 && r !== 7) {
          collisionGrid[r][c] = 1; // East Veranda Steps rail (stairs to garden at r=6,7)
          continue;
        }

        // Garden Perimeter Fence (x: 16..24, y: 3..17)
        if (c === COLS - 2 && r >= 3 && r <= ROWS - 2) {
          collisionGrid[r][c] = 1; // East Garden Fence
          continue;
        }
        if (r === ROWS - 2 && c >= 16 && c <= COLS - 2) {
          collisionGrid[r][c] = 1; // South Garden Fence
          continue;
        }
        if (r === 4 && c >= 16 && c <= COLS - 2 && c !== 19 && c !== 20) {
          collisionGrid[r][c] = 1; // North Garden Fence (Gate at c=19,20)
          continue;
        }

        // Garden Gate at (c: 19, 20, r: 4)
        if (r === 4 && (c === 19 || c === 20)) {
          collisionGrid[r][c] = state.gateOpen ? 0 : 1;
          continue;
        }

        // North trail boundaries (y: 1..3)
        if (r <= 3 && (c < 18 || c > 21)) {
          collisionGrid[r][c] = 1; // Thick shrubbery flanking the north trail
          continue;
        }

        // Uncle Barnaby tile obstacle
        if (c === BARNABY.x && r === BARNABY.y) {
          collisionGrid[r][c] = 1;
          continue;
        }

        // Garden plant obstacle
        if (c === 17 && r === 6) {
          collisionGrid[r][c] = 1;
          continue;
        }

        collisionGrid[r][c] = 0; // Walkable
      }
    }
  }

  function isWalkable(tileX, tileY) {
    if (tileX < 0 || tileX >= COLS || tileY < 0 || tileY >= ROWS) return false;
    // Gate behavior
    if (tileY === 4 && (tileX === 19 || tileX === 20)) {
      return state.gateOpen;
    }
    return collisionGrid[tileY][tileX] === 0;
  }

  // ============================================================
  // 3. WEB AUDIO API SYNTHESIZER (MUTED BY DEFAULT)
  // ============================================================
  function initAudio() {
    if (!state.audio.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        state.audio.ctx = new AudioCtx();
      }
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
      btn.setAttribute('aria-label', 'Toggle Sound (Currently Muted)');
    } else {
      btn.className = 'pill-btn audio-btn unmuted';
      icon.textContent = '🔊';
      label.textContent = 'Sound On';
      btn.setAttribute('aria-label', 'Toggle Sound (Currently Unmuted)');
      playAcousticChime([523.25, 659.25, 783.99]); // C5 chord greeting
    }
  }

  // Gentle acoustic chime (nylon guitar / harmonic chime)
  function playAcousticChime(freqs = [587.33, 739.99, 880.00]) { // D Major
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
    } catch (e) {
      // Audio fallback safe
    }
  }

  // Subtle wooden floorboard footstep tap
  function playWoodTap() {
    if (state.audio.isMuted || !state.audio.ctx) return;
    try {
      const now = state.audio.ctx.currentTime;
      const osc = state.audio.ctx.createOscillator();
      const gain = state.audio.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.05);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(state.audio.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {}
  }

  // Soft typewriter click for dialogue
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

  // Tactile wooden gate opening creak
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
  // 4. CANVAS RENDERING ENGINE (3/4 TOP-DOWN)
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

  // DRAW THE 3/4 TOP-DOWN WORLD
  function renderWorld() {
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. TILE LAYER: FLOORS & OUTDOOR TERRAIN
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;

        // A. North Trail / Rolling Hills (r <= 3)
        if (r <= 3) {
          if (c >= 18 && c <= 21) {
            // Cobblestone path heading to FOG Center
            ctx.fillStyle = '#D6CCBA';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#B8A892';
            ctx.fillRect(x + 4, y + 4, 10, 8);
            ctx.fillRect(x + 18, y + 14, 8, 10);
          } else {
            // Sunny grassy hillside
            ctx.fillStyle = '#618556';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#537549';
            ctx.fillRect(x + 8, y + 8, 4, 4);
          }
          continue;
        }

        // B. Bedroom (c: 0..8, r: 10..17)
        if (c <= 8 && r >= 10) {
          // Warm cedar wood planks
          ctx.fillStyle = (r % 2 === 0) ? '#D9B48F' : '#CCA37E';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#B38B65';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          continue;
        }

        // C. Kitchen (c: 0..8, r: 4..9)
        if (c <= 8 && r >= 4 && r <= 9) {
          // Terracotta / cream checkered tile floor
          const isCheck = (c + r) % 2 === 0;
          ctx.fillStyle = isCheck ? '#EADBC8' : '#C86A4B';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          continue;
        }

        // D. Veranda (Batalan) (c: 9..15, r: 4..9)
        if (c >= 9 && c <= 15 && r >= 4 && r <= 9) {
          // Slatted timber decking with morning sunlight
          ctx.fillStyle = '#B08865';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#8A6342';
          ctx.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3); // slat shadow
          continue;
        }

        // E. Living Area (c: 9..15, r: 10..17)
        if (c >= 9 && c <= 15 && r >= 10) {
          // Polished pine wood floor
          ctx.fillStyle = (r % 2 === 0) ? '#E0BC96' : '#D4AC83';
          ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#B88F66';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
          continue;
        }

        // F. The Outdoor Garden Plot (c >= 16)
        if (c >= 16) {
          if (state.gardenState === 'dry') {
            // INITIAL: Dry, cracked earthen soil
            ctx.fillStyle = '#A38B72';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#8C745C';
            ctx.fillRect(x + 6, y + 10, 8, 3);
            ctx.fillRect(x + 18, y + 20, 6, 3);
          } else {
            // TRANSFORMED: Rich, dark, fertile loam with morning sparkle
            ctx.fillStyle = '#423325';
            ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#2E2218';
            ctx.fillRect(x + 8, y + 12, 10, 4);
            ctx.fillStyle = '#5A7D50'; // tiny moss/clover flecks
            ctx.fillRect(x + 14, y + 6, 3, 3);
          }
          continue;
        }

        // Default floor
        ctx.fillStyle = '#D9B48F';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }

    // 2. ROOM INTERIOR FURNITURE & DETAILS

    // A. Bedroom Furniture
    // Platform Bed (c: 1..3, r: 14..16)
    ctx.fillStyle = '#6E4C32';
    ctx.fillRect(1 * TILE_SIZE, 14 * TILE_SIZE, 3 * TILE_SIZE, 2.5 * TILE_SIZE);
    // Blanket & Pillows
    ctx.fillStyle = '#FAF7F0';
    ctx.fillRect(1.2 * TILE_SIZE, 14.2 * TILE_SIZE, 2.6 * TILE_SIZE, 0.6 * TILE_SIZE); // pillow
    ctx.fillStyle = '#6AA6B8';
    ctx.fillRect(1.2 * TILE_SIZE, 14.8 * TILE_SIZE, 2.6 * TILE_SIZE, 1.6 * TILE_SIZE); // blanket

    // Study Desk & Lamp (c: 5..6, r: 11)
    ctx.fillStyle = '#8B5A36';
    ctx.fillRect(5 * TILE_SIZE, 11 * TILE_SIZE, 2 * TILE_SIZE, TILE_SIZE);
    // Open Bible / Notebook
    ctx.fillStyle = '#FFFDF8';
    ctx.fillRect(5.3 * TILE_SIZE, 11.2 * TILE_SIZE, 16, 12);
    ctx.fillStyle = '#D49B35';
    ctx.fillRect(6.2 * TILE_SIZE, 11.2 * TILE_SIZE, 8, 12); // brass desk lamp

    // Wardrobe (c: 1, r: 11)
    ctx.fillStyle = '#543722';
    ctx.fillRect(1 * TILE_SIZE, 11 * TILE_SIZE, 1.5 * TILE_SIZE, 1.2 * TILE_SIZE);
    ctx.fillStyle = '#D49B35';
    ctx.fillRect(1.7 * TILE_SIZE, 11.6 * TILE_SIZE, 3, 6); // brass handle

    // Bedroom Rug
    ctx.fillStyle = 'rgba(75, 107, 68, 0.4)';
    ctx.beginPath();
    ctx.ellipse(5 * TILE_SIZE, 14.5 * TILE_SIZE, 40, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // B. Kitchen Counter & Stove
    // Counter & Sink (c: 1..4, r: 3)
    ctx.fillStyle = '#DFD6C8';
    ctx.fillRect(1 * TILE_SIZE, 3.2 * TILE_SIZE, 4 * TILE_SIZE, 0.8 * TILE_SIZE);
    ctx.fillStyle = '#88AAB5';
    ctx.fillRect(2.2 * TILE_SIZE, 3.4 * TILE_SIZE, 24, 16); // porcelain sink

    // Stove (c: 5..6, r: 3)
    ctx.fillStyle = '#3E444B';
    ctx.fillRect(5 * TILE_SIZE, 3.2 * TILE_SIZE, 1.8 * TILE_SIZE, 0.8 * TILE_SIZE);

    // Dining Table (c: 3..5, r: 6..7)
    ctx.fillStyle = '#855633';
    ctx.fillRect(3 * TILE_SIZE, 6 * TILE_SIZE, 2.5 * TILE_SIZE, 1.6 * TILE_SIZE);
    ctx.fillStyle = '#F2B84B';
    ctx.fillRect(4 * TILE_SIZE, 6.5 * TILE_SIZE, 16, 12); // fruit bowl

    // C. Living Area
    // Sofa (c: 10..13, r: 14)
    ctx.fillStyle = '#C86A4B'; // Terracotta woven couch
    ctx.fillRect(10 * TILE_SIZE, 14 * TILE_SIZE, 3.5 * TILE_SIZE, 1.4 * TILE_SIZE);
    ctx.fillStyle = '#4B6B44'; // cushions
    ctx.fillRect(10.2 * TILE_SIZE, 14.2 * TILE_SIZE, 14, 14);
    ctx.fillRect(12.8 * TILE_SIZE, 14.2 * TILE_SIZE, 14, 14);

    // Circular Woven Living Rug
    ctx.strokeStyle = '#D49B35';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(12 * TILE_SIZE, 12.5 * TILE_SIZE, 34, 20, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Bookshelf (c: 11..13, r: 11)
    ctx.fillStyle = '#5A3D28';
    ctx.fillRect(11 * TILE_SIZE, 10.8 * TILE_SIZE, 2.5 * TILE_SIZE, 0.8 * TILE_SIZE);

    // D. Wall Dividers
    ctx.fillStyle = '#4A3323';
    // Bedroom/Living wall
    ctx.fillRect(8 * TILE_SIZE - 3, 10 * TILE_SIZE, 6, 3 * TILE_SIZE); // top half
    ctx.fillRect(8 * TILE_SIZE - 3, 15 * TILE_SIZE, 6, 3 * TILE_SIZE); // bottom half

    // Kitchen/Living wall
    ctx.fillRect(0, 10 * TILE_SIZE - 3, 4 * TILE_SIZE, 6);
    ctx.fillRect(5 * TILE_SIZE, 10 * TILE_SIZE - 3, 3 * TILE_SIZE, 6);

    // Kitchen/Veranda wall
    ctx.fillRect(8 * TILE_SIZE - 3, 4 * TILE_SIZE, 6, 2 * TILE_SIZE);
    ctx.fillRect(8 * TILE_SIZE - 3, 8 * TILE_SIZE, 6, 2 * TILE_SIZE);

    // Veranda railing (top & bottom)
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(9 * TILE_SIZE, 3.8 * TILE_SIZE, 6 * TILE_SIZE, 6);

    // E. Garden Perimeter Fence
    ctx.fillStyle = '#7A573C';
    ctx.fillRect(16 * TILE_SIZE, 4 * TILE_SIZE - 3, 3 * TILE_SIZE, 6); // west gate fence
    ctx.fillRect(21 * TILE_SIZE, 4 * TILE_SIZE - 3, 3 * TILE_SIZE, 6); // east gate fence
    ctx.fillRect(COLS * TILE_SIZE - 2 * TILE_SIZE, 4 * TILE_SIZE, 6, 13 * TILE_SIZE); // east outer fence
    ctx.fillRect(16 * TILE_SIZE, ROWS * TILE_SIZE - 2 * TILE_SIZE, 8 * TILE_SIZE, 6); // south fence

    // F. THE GARDEN GATE (c: 19..20, r: 4)
    if (!state.gateOpen) {
      // CLOSED GATE: Thick timber gate bars with locked brass latch
      ctx.fillStyle = '#5A3D28';
      ctx.fillRect(19 * TILE_SIZE, 4 * TILE_SIZE - 4, 2 * TILE_SIZE, 8);
      // Vertical pickets
      for (let p = 0; p < 6; p++) {
        ctx.fillStyle = '#8B5A36';
        ctx.fillRect(19 * TILE_SIZE + p * 10 + 2, 4 * TILE_SIZE - 10, 6, 16);
      }
      // Brass padlock glyph
      ctx.fillStyle = '#D49B35';
      ctx.beginPath();
      ctx.arc(20 * TILE_SIZE, 4 * TILE_SIZE - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // OPEN GATE: Gates swung wide outward to left and right!
      ctx.fillStyle = '#8B5A36';
      // Left gate wing swung open
      ctx.fillRect(18.6 * TILE_SIZE, 3.2 * TILE_SIZE, 6, 20);
      // Right gate wing swung open
      ctx.fillRect(21.2 * TILE_SIZE, 3.2 * TILE_SIZE, 6, 20);
      // Golden pathway sparkles
      ctx.fillStyle = '#F2B84B';
      ctx.beginPath();
      ctx.arc(20 * TILE_SIZE, 4 * TILE_SIZE, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // G. THE GARDEN PLANTS & VEGETATION
    // Potted Fern at (c: 17, r: 6)
    ctx.fillStyle = '#C86A4B'; // Terracotta clay pot
    ctx.fillRect(17 * TILE_SIZE + 4, 6 * TILE_SIZE + 10, 24, 20);

    if (state.gardenState === 'dry') {
      // Wilting, drooping faded fern
      ctx.fillStyle = '#879177';
      ctx.beginPath();
      ctx.arc(17 * TILE_SIZE + 16, 6 * TILE_SIZE + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      // Droop leaves
      ctx.strokeStyle = '#758066';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(17 * TILE_SIZE + 16, 6 * TILE_SIZE + 10);
      ctx.lineTo(17 * TILE_SIZE + 6, 6 * TILE_SIZE + 24);
      ctx.moveTo(17 * TILE_SIZE + 16, 6 * TILE_SIZE + 10);
      ctx.lineTo(17 * TILE_SIZE + 26, 6 * TILE_SIZE + 22);
      ctx.stroke();
    } else {
      // Lush, perky, vibrant green fern with blooms
      ctx.fillStyle = '#2E8B57';
      ctx.beginPath();
      ctx.arc(17 * TILE_SIZE + 16, 6 * TILE_SIZE + 8, 14, 0, Math.PI * 2);
      ctx.fill();
      // Green sprouting fronds
      ctx.fillStyle = '#48C774';
      ctx.beginPath();
      ctx.arc(17 * TILE_SIZE + 12, 6 * TILE_SIZE + 4, 6, 0, Math.PI * 2);
      ctx.arc(17 * TILE_SIZE + 20, 6 * TILE_SIZE + 4, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // New Fresh Seedling Bed at (c: 20, r: 9)
    if (state.gardenState === 'lush') {
      // Glowing green seedling sprout
      ctx.fillStyle = 'rgba(242, 184, 75, 0.3)';
      ctx.beginPath();
      ctx.arc(20 * TILE_SIZE + 16, 9 * TILE_SIZE + 16, 16, 0, Math.PI * 2);
      ctx.fill();

      // Tender shoot & twin leaves
      ctx.strokeStyle = '#3E8E58';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(20 * TILE_SIZE + 16, 9 * TILE_SIZE + 22);
      ctx.lineTo(20 * TILE_SIZE + 16, 9 * TILE_SIZE + 12);
      ctx.stroke();

      ctx.fillStyle = '#48C774';
      ctx.beginPath();
      ctx.ellipse(20 * TILE_SIZE + 12, 9 * TILE_SIZE + 12, 6, 3, -0.4, 0, Math.PI * 2);
      ctx.ellipse(20 * TILE_SIZE + 20, 9 * TILE_SIZE + 12, 6, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Dewdrop sparkle
      ctx.fillStyle = '#FFF';
      ctx.fillRect(20 * TILE_SIZE + 15, 9 * TILE_SIZE + 10, 3, 3);
    }

    // 3. RENDER UNCLE BARNABY (NPC)
    renderUncleBarnaby();

    // 4. RENDER PLAYER AVATAR
    renderPlayerAvatar();

    // 5. PROXIMITY SPEECH BUBBLE OVER BARNABY
    const dist = Math.hypot(state.avatar.x - BARNABY.x, state.avatar.y - BARNABY.y);
    if (dist <= BARNABY.proximityDist) {
      renderSpeechPrompt(BARNABY.x * TILE_SIZE + 16, BARNABY.y * TILE_SIZE - 12);
      document.getElementById('proximity-prompt').classList.remove('hidden');
    } else {
      document.getElementById('proximity-prompt').classList.add('hidden');
    }

    // 6. RENDER FLOATING EMOTE OVER AVATAR
    if (state.avatar.emote && state.avatar.emoteTimer > 0) {
      renderEmoteBubble(
        state.avatar.x * TILE_SIZE,
        state.avatar.y * TILE_SIZE - 28,
        state.avatar.emote
      );
    }
  }

  // RENDER UNCLE BARNABY NPC SPRITE
  function renderUncleBarnaby() {
    const px = BARNABY.x * TILE_SIZE;
    const py = BARNABY.y * TILE_SIZE;

    // Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Denim Overalls (Legs & Torso)
    ctx.fillStyle = '#2C3E55';
    ctx.fillRect(px + 10, py + 14, 12, 14);

    // Warm Flannel Shirt Sleeves
    ctx.fillStyle = '#C86A4B';
    ctx.fillRect(px + 6, py + 12, 4, 10);
    ctx.fillRect(px + 22, py + 12, 4, 10);

    // Gardening Gloves / Pruning Tool
    ctx.fillStyle = '#D49B35';
    ctx.fillRect(px + 5, py + 20, 5, 5);
    ctx.fillRect(px + 22, py + 20, 5, 5);

    // Head
    ctx.fillStyle = '#E0AC69';
    ctx.beginPath();
    ctx.arc(px + 16, py + 10, 7, 0, Math.PI * 2);
    ctx.fill();

    // Friendly White Beard
    ctx.fillStyle = '#EDE8DF';
    ctx.beginPath();
    ctx.arc(px + 16, py + 13, 5, 0, Math.PI);
    ctx.fill();

    // Straw Sun Hat (Signature)
    ctx.fillStyle = '#D4B06A';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 5, 14, 4, 0, 0, Math.PI * 2); // brim
    ctx.fill();
    ctx.fillStyle = '#B88F47';
    ctx.fillRect(px + 10, py - 2, 12, 7); // crown
  }

  // RENDER PLAYER AVATAR
  function renderPlayerAvatar() {
    const px = (state.avatar.x - 0.5) * TILE_SIZE;
    const py = (state.avatar.y - 0.5) * TILE_SIZE;

    const skin = SKIN_COLORS[state.avatar.skinIndex] || SKIN_COLORS[0];
    const hair = HAIR_COLORS[state.avatar.hairIndex] || HAIR_COLORS[0];
    const outfit = OUTFIT_PALETTES[state.avatar.outfitIndex] || OUTFIT_PALETTES[0];

    // Drop Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Walking leg alternation
    const legOffset = state.avatar.isMoving ? Math.sin(state.avatar.walkFrame) * 4 : 0;

    // Pants / Boots
    ctx.fillStyle = outfit.pants;
    ctx.fillRect(px + 10, py + 20 + legOffset, 4, 8);
    ctx.fillRect(px + 18, py + 20 - legOffset, 4, 8);

    // Shirt / Tunic
    ctx.fillStyle = outfit.shirt;
    ctx.fillRect(px + 9, py + 12, 14, 10);

    // Trim / Belt
    ctx.fillStyle = outfit.trim;
    ctx.fillRect(px + 9, py + 19, 14, 2);

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(px + 16, py + 9, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = hair;
    if (state.avatar.hairIndex === 0) {
      // Short Crop
      ctx.fillRect(px + 11, py + 4, 10, 4);
    } else if (state.avatar.hairIndex === 1) {
      // Side Swept
      ctx.fillRect(px + 10, py + 4, 12, 5);
      ctx.fillRect(px + 8, py + 7, 3, 6);
    } else if (state.avatar.hairIndex === 2) {
      // Curls
      ctx.beginPath();
      ctx.arc(px + 12, py + 5, 4, 0, Math.PI * 2);
      ctx.arc(px + 16, py + 4, 4, 0, Math.PI * 2);
      ctx.arc(px + 20, py + 5, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Top Bun
      ctx.fillRect(px + 11, py + 4, 10, 4);
      ctx.beginPath();
      ctx.arc(px + 16, py + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // RENDER FLOATING SPEECH PROMPT
  function renderSpeechPrompt(x, y) {
    ctx.fillStyle = '#FAF7F0';
    ctx.strokeStyle = '#D49B35';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#232B20';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💬', x, y);
  }

  // RENDER FLOATING EMOTE
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
  }

  // RENDER PREVIEW CANVAS (FOR AVATAR CUSTOMIZER & PROFILE)
  function renderAvatarPreview(targetCtx, size = 128) {
    if (!targetCtx) return;
    targetCtx.clearRect(0, 0, size, size);

    const skin = SKIN_COLORS[state.avatar.skinIndex] || SKIN_COLORS[0];
    const hair = HAIR_COLORS[state.avatar.hairIndex] || HAIR_COLORS[0];
    const outfit = OUTFIT_PALETTES[state.avatar.outfitIndex] || OUTFIT_PALETTES[0];

    const cx = size / 2;
    const cy = size / 2;
    const scale = size / 32;

    // Shadow
    targetCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    targetCtx.beginPath();
    targetCtx.ellipse(cx, cy + 12 * scale, 10 * scale, 4 * scale, 0, 0, Math.PI * 2);
    targetCtx.fill();

    // Legs
    targetCtx.fillStyle = outfit.pants;
    targetCtx.fillRect(cx - 5 * scale, cy + 4 * scale, 4 * scale, 8 * scale);
    targetCtx.fillRect(cx + 1 * scale, cy + 4 * scale, 4 * scale, 8 * scale);

    // Torso
    targetCtx.fillStyle = outfit.shirt;
    targetCtx.fillRect(cx - 7 * scale, cy - 4 * scale, 14 * scale, 10 * scale);
    targetCtx.fillStyle = outfit.trim;
    targetCtx.fillRect(cx - 7 * scale, cy + 3 * scale, 14 * scale, 2 * scale);

    // Head
    targetCtx.fillStyle = skin;
    targetCtx.beginPath();
    targetCtx.arc(cx, cy - 7 * scale, 6 * scale, 0, Math.PI * 2);
    targetCtx.fill();

    // Eyes
    targetCtx.fillStyle = '#232B20';
    targetCtx.fillRect(cx - 3 * scale, cy - 7 * scale, 1.5 * scale, 2 * scale);
    targetCtx.fillRect(cx + 1.5 * scale, cy - 7 * scale, 1.5 * scale, 2 * scale);

    // Hair
    targetCtx.fillStyle = hair;
    if (state.avatar.hairIndex === 0) {
      targetCtx.fillRect(cx - 5 * scale, cy - 12 * scale, 10 * scale, 4 * scale);
    } else if (state.avatar.hairIndex === 1) {
      targetCtx.fillRect(cx - 6 * scale, cy - 12 * scale, 12 * scale, 5 * scale);
      targetCtx.fillRect(cx - 8 * scale, cy - 9 * scale, 3 * scale, 6 * scale);
    } else if (state.avatar.hairIndex === 2) {
      targetCtx.beginPath();
      targetCtx.arc(cx - 4 * scale, cy - 11 * scale, 4 * scale, 0, Math.PI * 2);
      targetCtx.arc(cx, cy - 12 * scale, 4 * scale, 0, Math.PI * 2);
      targetCtx.arc(cx + 4 * scale, cy - 11 * scale, 4 * scale, 0, Math.PI * 2);
      targetCtx.fill();
    } else {
      targetCtx.fillRect(cx - 5 * scale, cy - 12 * scale, 10 * scale, 4 * scale);
      targetCtx.beginPath();
      targetCtx.arc(cx, cy - 14 * scale, 4 * scale, 0, Math.PI * 2);
      targetCtx.fill();
    }
  }

  // ============================================================
  // 5. PLAYER MOVEMENT & GAME LOOP
  // ============================================================
  const keysPressed = {};

  function handleKeyDown(e) {
    if (state.currentScreen !== 'game') return;

    // Ignore if typing in reflection textarea
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    keysPressed[e.key.toLowerCase()] = true;

    // E or Space to interact with Barnaby
    if (e.key === 'e' || e.key === 'E' || e.key === ' ') {
      e.preventDefault();
      tryInteract();
    }
  }

  function handleKeyUp(e) {
    keysPressed[e.key.toLowerCase()] = false;
  }

  function tryInteract() {
    const dist = Math.hypot(state.avatar.x - BARNABY.x, state.avatar.y - BARNABY.y);
    if (dist <= BARNABY.proximityDist) {
      openBarnabyDialogue();
    }
  }

  function updatePlayerMovement(dt) {
    // Check if moving via target coordinates (mouse click / touch tap)
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
      // Keyboard WASD / Arrows
      if (keysPressed['w'] || keysPressed['arrowup']) moveY -= 1;
      if (keysPressed['s'] || keysPressed['arrowdown']) moveY += 1;
      if (keysPressed['a'] || keysPressed['arrowleft']) moveX -= 1;
      if (keysPressed['d'] || keysPressed['arrowright']) moveX += 1;
    }

    if (moveX !== 0 || moveY !== 0) {
      state.avatar.isMoving = true;
      const speed = 4.0 * dt; // tiles per second

      // Normalize diagonal
      if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.7071;
        moveY *= 0.7071;
      }

      const newX = state.avatar.x + moveX * speed;
      const newY = state.avatar.y + moveY * speed;

      // Axis-by-axis collision check
      const tileX1 = Math.floor(newX);
      const tileY1 = Math.floor(state.avatar.y);
      if (isWalkable(tileX1, tileY1)) {
        state.avatar.x = newX;
      }

      const tileX2 = Math.floor(state.avatar.x);
      const tileY2 = Math.floor(newY);
      if (isWalkable(tileX2, tileY2)) {
        state.avatar.y = newY;
      }

      // Walking cycle animation
      state.avatar.walkFrame += 12 * dt;

      // Play soft footstep tap occasionally
      if (Math.floor(state.avatar.walkFrame) % 4 === 0) {
        playWoodTap();
      }

      // Check if player reached the North Trail to FOG Center (y <= 1.5, x: 18..21)
      if (state.avatar.y <= 1.5 && state.avatar.x >= 18 && state.avatar.x <= 21) {
        triggerFogCenterTeaser();
      }
    } else {
      state.avatar.isMoving = false;
    }

    // Emote timer countdown
    if (state.avatar.emoteTimer > 0) {
      state.avatar.emoteTimer -= dt;
      if (state.avatar.emoteTimer <= 0) {
        state.avatar.emote = null;
      }
    }
  }

  let lastTime = performance.now();
  function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (state.currentScreen === 'game') {
      updatePlayerMovement(dt);
      renderWorld();
    }

    requestAnimationFrame(gameLoop);
  }

  // ============================================================
  // 6. UNCLE BARNABY DIALOGUE FLOW
  // ============================================================
  const BARNABY_LINES = [
    {
      speaker: 'Uncle Barnaby',
      text: 'Morning, Alex. Look at our garden patch out here.',
      btn: 'NEXT ▶'
    },
    {
      speaker: 'Uncle Barnaby',
      text: 'See this little plant? It doesn\'t need another button pressed. It needs someone to care for it.',
      btn: 'NEXT ▶'
    },
    {
      speaker: 'Uncle Barnaby',
      text: 'The water won\'t pour itself through glass, anak. Your first quest happens outside this world.',
      btn: 'WHAT DO I NEED TO DO? ▶'
    }
  ];

  let typewriterTimer = null;

  function openBarnabyDialogue() {
    state.isDialogueOpen = true;
    state.dialogueStep = 0;
    document.getElementById('dialogue-overlay').classList.remove('hidden');
    showDialogueLine(0);
    playWoodTap();
  }

  function showDialogueLine(index) {
    const line = BARNABY_LINES[index];
    if (!line) return;

    const textEl = document.getElementById('dialogue-text');
    const btnTextEl = document.getElementById('dialogue-btn-text');

    btnTextEl.textContent = line.btn;
    textEl.textContent = '';

    if (typewriterTimer) clearInterval(typewriterTimer);

    let charIdx = 0;
    typewriterTimer = setInterval(() => {
      if (charIdx < line.text.length) {
        textEl.textContent += line.text[charIdx];
        charIdx++;
        if (charIdx % 3 === 0) playParchmentTick();
      } else {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
      }
    }, 24);
  }

  function advanceDialogue() {
    // If typewriter is still animating, complete it immediately
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      document.getElementById('dialogue-text').textContent = BARNABY_LINES[state.dialogueStep].text;
      return;
    }

    state.dialogueStep++;
    if (state.dialogueStep < BARNABY_LINES.length) {
      showDialogueLine(state.dialogueStep);
    } else {
      // Finished dialogue, open Quest #001 Card
      document.getElementById('dialogue-overlay').classList.add('hidden');
      state.isDialogueOpen = false;
      openQuestModal();
    }
  }

  // ============================================================
  // 7. QUEST #001 & REAL-WORLD WORKFLOW
  // ============================================================
  function openQuestModal() {
    document.getElementById('quest-modal').classList.remove('hidden');
    playAcousticChime([523.25, 659.25]); // C5, E5
  }

  function acceptQuest() {
    document.getElementById('quest-modal').classList.add('hidden');
    state.questStatus = 'active';

    // Update Right Panel Badge
    const badge = document.getElementById('quest-status-badge');
    badge.className = 'quest-status-badge status-active';
    badge.textContent = 'IN PROGRESS';

    // Open Signature Exit Ramp Screen
    openExitRampScreen();
  }

  function openExitRampScreen() {
    document.getElementById('exit-ramp-modal').classList.remove('hidden');
  }

  function stepOutToRealWorld() {
    document.getElementById('exit-ramp-modal').classList.add('hidden');
    state.questStatus = 'in_progress_real_world';

    // Open Calm Standby Screen
    document.getElementById('standby-modal').classList.remove('hidden');
    showWorldToast('🌿 Standby Mode Active. Go be a blessing out there.');
  }

  function returnFromRealWorld() {
    document.getElementById('standby-modal').classList.add('hidden');

    // Open Verification Selection Modal
    document.getElementById('verification-modal').classList.remove('hidden');
    playAcousticChime([587.33, 739.99, 880.00]); // D Major
  }

  function chooseTrustVerification() {
    state.verificationMethod = 'trust';
    document.getElementById('verification-modal').classList.add('hidden');
    openReflectionModal();
  }

  function chooseFamilyDemoVerification() {
    state.verificationMethod = 'family';
    document.getElementById('verification-modal').classList.add('hidden');
    document.getElementById('family-modal').classList.remove('hidden');
  }

  function confirmParentVerification() {
    document.getElementById('family-modal').classList.add('hidden');
    openReflectionModal();
  }

  function openReflectionModal() {
    document.getElementById('reflection-modal').classList.remove('hidden');
    const input = document.getElementById('reflection-input');
    input.focus();
  }

  function submitReflection() {
    const input = document.getElementById('reflection-input');
    state.reflectionText = input.value.trim() || 'Watered the potted ferns on the veranda. The dry soil drank it right up.';

    // Update reflection display on right panel
    const logDisplay = document.getElementById('reflection-entry-display');
    logDisplay.className = 'reflection-logged-text';
    logDisplay.textContent = `"${state.reflectionText}"`;

    document.getElementById('reflection-modal').classList.add('hidden');

    // Execute Reward Sequence!
    executeRewards();
  }

  // ============================================================
  // 8. NON-CASINO REWARD EXPERIENCE & WORLD GROWTH
  // ============================================================
  function executeRewards() {
    state.questStatus = 'completed';

    // Update Currency & XP
    state.lp += 5; // 120 -> 125 LP
    state.charXp += 5;
    state.stewardshipXp += 15;
    state.responsibilityXp += 5;
    state.communityPool += 15; // 142 -> 157

    // Update UI Stats in Left Sidebar
    document.getElementById('lp-amount').textContent = state.lp;
    document.getElementById('lp-delta').classList.remove('hidden');
    document.getElementById('char-xp-display').textContent = `(${state.charXp} / 100 XP)`;

    document.getElementById('stewardship-xp-text').textContent = `${state.stewardshipXp} XP`;
    document.getElementById('stewardship-meter-fill').style.width = `${(state.stewardshipXp / 50) * 100}%`;

    document.getElementById('responsibility-xp-text').textContent = `${state.responsibilityXp} XP`;
    document.getElementById('responsibility-meter-fill').style.width = `${(state.responsibilityXp / 50) * 100}%`;

    // Update Community Pool in Right Sidebar
    document.getElementById('comm-progress-fraction').textContent = `${state.communityPool} / 500`;
    document.getElementById('comm-meter-fill').style.width = `${(state.communityPool / 500) * 100}%`;
    document.getElementById('comm-recent-add').classList.remove('hidden');

    // Update Quest Badge in Right Sidebar
    const badge = document.getElementById('quest-status-badge');
    badge.className = 'quest-status-badge status-completed';
    badge.textContent = 'COMPLETED ✓';

    // Play gentle acoustic celebration chord
    playAcousticChime([523.25, 659.25, 783.99, 1046.50]); // C major chord arpeggio

    // Show Reward Fanfare Modal
    document.getElementById('reward-modal').classList.remove('hidden');
  }

  function showCommunityImpactModal() {
    document.getElementById('reward-modal').classList.add('hidden');

    // Update Community Impact Modal numbers
    document.getElementById('comm-modal-meter-num').textContent = `${state.communityPool} / 500`;
    document.getElementById('comm-modal-meter-fill').style.width = `${(state.communityPool / 500) * 100}%`;

    document.getElementById('community-modal').classList.remove('hidden');
  }

  function returnAndTransformGarden() {
    document.getElementById('community-modal').classList.add('hidden');

    // Transform the Garden in Canvas
    state.gardenState = 'lush';
    state.gateOpen = true;
    initCollisionGrid(); // Refresh collision grid so gate is walkable

    playGateCreak();
    showWorldToast('✨ NEW PATH UNLOCKED — FOG COMMUNITY CENTER');

    // Make Uncle Barnaby wave and celebrate
    state.avatar.emote = '🌱';
    state.avatar.emoteTimer = 4.0;
  }

  // ============================================================
  // 9. FOG CENTER TEASER
  // ============================================================
  function triggerFogCenterTeaser() {
    document.getElementById('teaser-modal').classList.remove('hidden');
    playAcousticChime([659.25, 783.99, 987.77]); // E5, G5, B5
  }

  function endPrototypeReview() {
    document.getElementById('teaser-modal').classList.add('hidden');
    showWorldToast('🏁 Prototype review complete. You may reset or continue exploring.');
  }

  function returnToHomeVeranda() {
    document.getElementById('teaser-modal').classList.add('hidden');
    // Position player just south of the opened gate so they can keep exploring
    state.avatar.x = 19.5;
    state.avatar.y = 5.5;
    state.avatar.targetX = null;
    state.avatar.targetY = null;
  }

  // ============================================================
  // 10. PROTOTYPE RESET (DEVELOPER / TESTING CONTROL)
  // ============================================================
  function resetPrototypeState() {
    // Reset all fake in-memory values
    state.lp = 120;
    state.charXp = 0;
    state.stewardshipXp = 0;
    state.responsibilityXp = 0;
    state.communityPool = 142;
    state.gardenState = 'dry';
    state.gateOpen = false;
    state.questStatus = 'ready';
    state.verificationMethod = null;
    state.reflectionText = '';

    // Reset player position to bedroom start
    state.avatar.x = 4.5;
    state.avatar.y = 14.5;
    state.avatar.targetX = null;
    state.avatar.targetY = null;
    state.avatar.emote = null;

    initCollisionGrid();

    // Reset Left Sidebar UI
    document.getElementById('lp-amount').textContent = '120';
    document.getElementById('lp-delta').classList.add('hidden');
    document.getElementById('char-xp-display').textContent = '(0 / 100 XP)';
    document.getElementById('stewardship-xp-text').textContent = '0 XP';
    document.getElementById('stewardship-meter-fill').style.width = '0%';
    document.getElementById('responsibility-xp-text').textContent = '0 XP';
    document.getElementById('responsibility-meter-fill').style.width = '0%';

    // Reset Right Sidebar UI
    document.getElementById('comm-progress-fraction').textContent = '142 / 500';
    document.getElementById('comm-meter-fill').style.width = '28.4%';
    document.getElementById('comm-recent-add').classList.add('hidden');

    const badge = document.getElementById('quest-status-badge');
    badge.className = 'quest-status-badge status-ready';
    badge.textContent = 'READY';

    const reflectionDisplay = document.getElementById('reflection-entry-display');
    reflectionDisplay.className = 'reflection-empty-state';
    reflectionDisplay.textContent = 'Complete Quest #001 to record your first real-world reflection.';

    // Close any open modals
    const openModals = document.querySelectorAll('.modal-backdrop:not(#title-screen)');
    openModals.forEach(m => m.classList.add('hidden'));
    document.getElementById('dialogue-overlay').classList.add('hidden');

    showWorldToast('🔄 Prototype state reset to initial values.');
    playWoodTap();
  }

  // ============================================================
  // 11. WORLD NOTIFICATION TOAST
  // ============================================================
  let toastTimer = null;
  function showWorldToast(msg) {
    const toast = document.getElementById('world-toast');
    const msgEl = document.getElementById('toast-message');
    msgEl.textContent = msg;
    toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3800);
  }

  // ============================================================
  // 12. EVENT LISTENERS & INITIALIZATION
  // ============================================================
  function setupEventListeners() {
    // Keyboard controls
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Canvas click / tap to move
    canvas.addEventListener('pointerdown', (e) => {
      if (state.currentScreen !== 'game') return;
      initAudio();

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const tileX = clickX / TILE_SIZE;
      const tileY = clickY / TILE_SIZE;

      // Check if clicking near Uncle Barnaby
      const distToBarnaby = Math.hypot(tileX - BARNABY.x, tileY - BARNABY.y);
      if (distToBarnaby <= 1.5) {
        openBarnabyDialogue();
        return;
      }

      state.avatar.targetX = tileX;
      state.avatar.targetY = tileY;
    });

    // Mobile D-Pad Controls
    const dpadUp = document.getElementById('dpad-up');
    const dpadDown = document.getElementById('dpad-down');
    const dpadLeft = document.getElementById('dpad-left');
    const dpadRight = document.getElementById('dpad-right');
    const mobileActionBtn = document.getElementById('mobile-action-btn');

    const bindDpad = (btn, key) => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        initAudio();
        keysPressed[key] = true;
      });
      btn.addEventListener('pointerup', () => { keysPressed[key] = false; });
      btn.addEventListener('pointerleave', () => { keysPressed[key] = false; });
    };

    bindDpad(dpadUp, 'arrowup');
    bindDpad(dpadDown, 'arrowdown');
    bindDpad(dpadLeft, 'arrowleft');
    bindDpad(dpadRight, 'arrowright');

    mobileActionBtn.addEventListener('click', () => {
      initAudio();
      tryInteract();
    });

    // Title Screen buttons
    document.getElementById('btn-begin-adventure').addEventListener('click', () => {
      initAudio();
      document.getElementById('title-screen').classList.remove('active');
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('avatar-modal').classList.remove('hidden');
      state.currentScreen = 'avatar';
      renderAvatarPreview(customizerCtx, 128);
    });

    // Avatar Customizer Swatches & Choices
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

    // Enter My Home button
    document.getElementById('btn-enter-home').addEventListener('click', () => {
      document.getElementById('avatar-modal').classList.add('hidden');
      state.currentScreen = 'game';
      renderAvatarPreview(profileCtx, 64);
      showWorldToast('🏡 Welcome home, Alex. Head out to the veranda to meet Uncle Barnaby.');
      playAcousticChime([523.25, 659.25, 783.99]);
    });

    // Uncle Barnaby Dialogue button
    document.getElementById('dialogue-next-btn').addEventListener('click', advanceDialogue);

    // Quest Modal buttons
    document.getElementById('btn-accept-quest').addEventListener('click', acceptQuest);
    document.getElementById('btn-close-quest-modal').addEventListener('click', () => {
      document.getElementById('quest-modal').classList.add('hidden');
    });

    // Exit Ramp button
    document.getElementById('btn-step-out').addEventListener('click', stepOutToRealWorld);

    // Standby buttons
    document.getElementById('btn-im-back').addEventListener('click', returnFromRealWorld);
    document.getElementById('btn-review-quest').addEventListener('click', () => {
      document.getElementById('standby-modal').classList.add('hidden');
      document.getElementById('quest-modal').classList.remove('hidden');
    });

    // Verification Selection buttons
    document.getElementById('btn-choose-trust').addEventListener('click', chooseTrustVerification);
    document.getElementById('btn-choose-family').addEventListener('click', chooseFamilyDemoVerification);

    // Family Modal buttons
    document.getElementById('btn-parent-confirm').addEventListener('click', confirmParentVerification);
    document.getElementById('btn-family-back').addEventListener('click', () => {
      document.getElementById('family-modal').classList.add('hidden');
      document.getElementById('verification-modal').classList.remove('hidden');
    });

    // Reflection button
    document.getElementById('btn-submit-reflection').addEventListener('click', submitReflection);

    // Reward Fanfare button
    document.getElementById('btn-see-community').addEventListener('click', showCommunityImpactModal);

    // Community Impact button
    document.getElementById('btn-watch-garden-transform').addEventListener('click', returnAndTransformGarden);

    // Teaser Modal buttons
    document.getElementById('btn-end-prototype').addEventListener('click', endPrototypeReview);
    document.getElementById('btn-back-to-veranda').addEventListener('click', returnToHomeVeranda);

    // Header Controls (Audio & Reset)
    document.getElementById('audio-toggle-btn').addEventListener('click', toggleAudio);
    document.getElementById('dev-reset-btn').addEventListener('click', resetPrototypeState);

    // Sidebar Toggles (Desktop & Mobile Drawers)
    const panelLeft = document.getElementById('panel-left');
    const panelRight = document.getElementById('panel-right');

    document.getElementById('toggle-left-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) {
        panelLeft.classList.toggle('collapsed');
      } else {
        panelLeft.classList.toggle('open');
      }
    });

    document.getElementById('close-left-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) {
        panelLeft.classList.add('collapsed');
      } else {
        panelLeft.classList.remove('open');
      }
    });

    document.getElementById('toggle-right-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) {
        panelRight.classList.toggle('collapsed');
      } else {
        panelRight.classList.toggle('open');
      }
    });

    document.getElementById('close-right-panel').addEventListener('click', () => {
      if (window.innerWidth >= 1024) {
        panelRight.classList.add('collapsed');
      } else {
        panelRight.classList.remove('open');
      }
    });

    // Canvas Quick Emote Buttons
    document.querySelectorAll('.emote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        state.avatar.emote = e.currentTarget.dataset.emote;
        state.avatar.emoteTimer = 3.0;
        playWoodTap();
      });
    });
  }

  // ============================================================
  // 13. BOOTSTRAP ENTRYPOINT
  // ============================================================
  window.addEventListener('DOMContentLoaded', () => {
    initCollisionGrid();
    initCanvases();
    setupEventListeners();
    requestAnimationFrame(gameLoop);
  });

})();
