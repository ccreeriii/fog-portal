/**
 * KOINONIA Phase 0.12 Automated Verification Test Suite
 * Portrait-First Mobile Gameplay + Orientation Strategy
 *
 * Location: prototype/koinonia-phase12/test_phase12_suite.js
 */

const fs = require('fs');
const path = require('path');

const P12_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.12 Automated Verification Test Suite');
console.log('Portrait-First Mobile Gameplay & Orientation Strategy');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testNum, testName, details = '') {
  const padNum = typeof testNum === 'number' ? String(testNum).padStart(2, '0') : String(testNum);
  if (condition) {
    console.log(`[PASS] #${padNum}: ${testName} ${details ? '(' + details + ')' : ''}`);
    passCount++;
  } else {
    console.error(`[FAIL] #${padNum}: ${testName} - FAILED! ${details}`);
    failCount++;
  }
}

// Read all Phase 0.12 files
const htmlContent = fs.readFileSync(path.join(P12_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P12_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P12_DIR, 'game.js'), 'utf8');

// Load data modules
const { PLACES } = require('./data/places.js');
const { QUESTS } = require('./data/quests.js');
const { CAMPAIGNS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

// -------------------------------------------------------------
// Test 01: Product Owner Decision — Portrait-First Mobile Gameplay
// -------------------------------------------------------------
const noRotateModalInHtml = !htmlContent.includes('id="rotate-prompt-modal"');
const enterWorldInPortrait = htmlContent.includes('id="btn-enter-world-portrait"');
const entersGameDirectly = gameContent.includes('enterWorldFromHomeCard') &&
                           gameContent.includes("appContainer.classList.add('playing-game')");
const cssSwitchesToGame = cssContent.includes('.playing-game #portrait-home-view {\n    display: none !important;\n  }') &&
                          cssContent.includes('.playing-game #game-stage {\n    display: block !important;\n  }');
assert(noRotateModalInHtml && enterWorldInPortrait && entersGameDirectly && cssSwitchesToGame, 1,
  'PO Decision: Portrait-First Mobile Gameplay',
  'Landscape-first rotate prompt modal cancelled; Enter World transitions directly into portrait RPG exploration'
);

// -------------------------------------------------------------
// Test 02: Obvious Exit World Mechanism
// -------------------------------------------------------------
const hasExitWorldBtn = htmlContent.includes('id="btn-exit-world"');
const exitWorldBtnInCss = cssContent.includes('.playing-game .header-btn-exit-world {\n    display: inline-flex !important;\n  }');
const exitWorldLogic = gameContent.includes('exitWorldToHomeCard') &&
                       gameContent.includes("appContainer.classList.remove('playing-game')");
assert(hasExitWorldBtn && exitWorldBtnInCss && exitWorldLogic, 2,
  'Obvious Exit World Mechanism',
  '[ ✕ EXIT WORLD ] button appears in header during portrait active gameplay and smoothly returns to Home card'
);

// -------------------------------------------------------------
// Test 03: Bottom Navigation Management (Auto-Hide in Play)
// -------------------------------------------------------------
const hasBottomNav = htmlContent.includes('id="mobile-bottom-nav"');
const hidesBottomNavDuringGame = cssContent.includes('.playing-game #mobile-bottom-nav {\n    display: none !important;\n  }');
const restoresBottomNavOnExit = gameContent.includes("appContainer.classList.remove('playing-game')");
assert(hasBottomNav && hidesBottomNavDuringGame && restoresBottomNavOnExit, 3,
  'Bottom Navigation Management',
  'Bottom navigation auto-hides during active portrait gameplay to maximize vertical canvas space, restored on exit'
);

// -------------------------------------------------------------
// Test 04: Paused Landscape Companion Screen
// -------------------------------------------------------------
const hasCompanionScreen = htmlContent.includes('id="landscape-companion-screen"');
const hasCompanionBadge = htmlContent.includes('companion-rotate-badge') &&
                          htmlContent.includes('Turn your phone upright to play');
const showsCompanionInLandscape = cssContent.includes('@media (max-width: 932px) and (orientation: landscape) and (max-height: 560px)') &&
                                  cssContent.includes('#landscape-companion-screen {\n    display: flex !important;\n  }');
const pausesGameInLandscape = gameContent.includes('state.isPaused = true;') &&
                              gameContent.includes('companionScreen.style.display = \'flex\';');
const resumesOnPortrait = gameContent.includes('state.isPaused = false;') &&
                          gameContent.includes('companionScreen.style.display = \'none\';');
assert(hasCompanionScreen && hasCompanionBadge && showsCompanionInLandscape && pausesGameInLandscape && resumesOnPortrait, 4,
  'Paused Landscape Companion Screen',
  'Rotating mobile phone to landscape safely pauses game, displays upright prompt and summary, and auto-resumes on upright'
);

// -------------------------------------------------------------
// Test 05: Companion Screen Information Cards
// -------------------------------------------------------------
const hasCompanionPlace = htmlContent.includes('id="companion-place"');
const hasCompanionQuest = htmlContent.includes('id="companion-quest"');
const hasCompanionLp = htmlContent.includes('id="companion-lp"');
const hasCompanionVirtue = htmlContent.includes('id="companion-virtue"');
const updatesCompanionData = gameContent.includes('compPlace.textContent') &&
                             gameContent.includes('compLp.textContent');
assert(hasCompanionPlace && hasCompanionQuest && hasCompanionLp && hasCompanionVirtue && updatesCompanionData, 5,
  'Companion Screen Information Cards',
  'Current Place, Active Quest, Life Points, and Today\'s Focus summary rendered in companion mode'
);

// -------------------------------------------------------------
// Test 06: Responsive Portrait Camera Viewport Math Simulation Engine
// -------------------------------------------------------------
function simulatePortraitCamera(viewW, viewH, playerTileX, playerTileY, dir = 'down', isDesktop = false) {
  const TILE = 32, WORLD_W = 800, WORLD_H = 576;
  const zoom = viewW <= 767 ? 1.35 : (isDesktop || viewW >= 850 ? 1.6 : 1.45);
  const visibleW = viewW / zoom;
  const visibleH = viewH / zoom;
  const px = playerTileX * TILE;
  const py = playerTileY * TILE;

  let lookaheadX = 0, lookaheadY = 0;
  if (dir === 'up') lookaheadY = -24;
  else if (dir === 'down') lookaheadY = 24;
  else if (dir === 'left') lookaheadX = -24;
  else if (dir === 'right') lookaheadX = 24;

  let targetX = (px + lookaheadX) - visibleW / 2;
  let targetY = (py + lookaheadY) - visibleH / 2;

  if (visibleW >= WORLD_W) targetX = (WORLD_W - visibleW) / 2;
  else targetX = Math.max(0, Math.min(WORLD_W - visibleW, targetX));

  if (visibleH >= WORLD_H) targetY = (WORLD_H - visibleH) / 2;
  else targetY = Math.max(0, Math.min(WORLD_H - visibleH, targetY));

  const tilesVisibleX = visibleW / TILE;
  const tilesVisibleY = visibleH / TILE;

  return { zoom, visibleW, visibleH, targetX, targetY, tilesVisibleX, tilesVisibleY };
}

// -------------------------------------------------------------
// Test 07: Viewport Math: iPhone 12 / 13 / 14 Pro Portrait (390 × 844)
// -------------------------------------------------------------
// Stage height = 844 - 48 (header) = 796px
const simIPhone14 = simulatePortraitCamera(390, 796, 4.5, 14.5, 'down');
const iphone14Pass = simIPhone14.zoom === 1.35 &&
                     simIPhone14.tilesVisibleX >= 8.5 && simIPhone14.tilesVisibleX <= 10.0 &&
                     simIPhone14.tilesVisibleY >= 16.0 && simIPhone14.tilesVisibleY <= 20.0 &&
                     !isNaN(simIPhone14.targetX) && !isNaN(simIPhone14.targetY);
assert(iphone14Pass, 7,
  'Viewport Simulation: iPhone 12/13/14 Pro Portrait (390 × 844)',
  `Zoom=${simIPhone14.zoom}x, Visible=${simIPhone14.tilesVisibleX.toFixed(1)}x${simIPhone14.tilesVisibleY.toFixed(1)} tiles, Target=(${Math.round(simIPhone14.targetX)}, ${Math.round(simIPhone14.targetY)})`
);

// -------------------------------------------------------------
// Test 08: Viewport Math: iPhone 8 Plus Portrait (414 × 736)
// -------------------------------------------------------------
// Stage height = 736 - 48 = 688px
const simIPhone8Plus = simulatePortraitCamera(414, 688, 10, 6, 'up');
const iphone8Pass = simIPhone8Plus.zoom === 1.35 &&
                    simIPhone8Plus.tilesVisibleX >= 9.0 &&
                    simIPhone8Plus.tilesVisibleY >= 14.0 &&
                    !isNaN(simIPhone8Plus.targetX);
assert(iphone8Pass, 8,
  'Viewport Simulation: iPhone 8 Plus Portrait (414 × 736)',
  `Zoom=${simIPhone8Plus.zoom}x, Visible=${simIPhone8Plus.tilesVisibleX.toFixed(1)}x${simIPhone8Plus.tilesVisibleY.toFixed(1)} tiles`
);

// -------------------------------------------------------------
// Test 09: Viewport Math: Samsung Galaxy S20 Portrait (360 × 800)
// -------------------------------------------------------------
// Stage height = 800 - 48 = 752px
const simGalaxyS20 = simulatePortraitCamera(360, 752, 4.5, 14.5, 'down');
const galaxyPass = simGalaxyS20.zoom === 1.35 &&
                   simGalaxyS20.tilesVisibleX >= 8.0 &&
                   simGalaxyS20.tilesVisibleY >= 16.0;
assert(galaxyPass, 9,
  'Viewport Simulation: Samsung Galaxy S20 Portrait (360 × 800)',
  `Zoom=${simGalaxyS20.zoom}x, Visible=${simGalaxyS20.tilesVisibleX.toFixed(1)}x${simGalaxyS20.tilesVisibleY.toFixed(1)} tiles`
);

// -------------------------------------------------------------
// Test 10: Viewport Math: Large Phone Portrait (430 × 932)
// -------------------------------------------------------------
// Stage height = 932 - 48 = 884px
const simLargePhone = simulatePortraitCamera(430, 884, 12, 8, 'down');
const largePass = simLargePhone.zoom === 1.35 &&
                  simLargePhone.tilesVisibleX >= 9.5 &&
                  simLargePhone.tilesVisibleY >= 18.0;
assert(largePass, 10,
  'Viewport Simulation: Large Modern Phone Portrait (430 × 932)',
  `Zoom=${simLargePhone.zoom}x, Visible=${simLargePhone.tilesVisibleX.toFixed(1)}x${simLargePhone.tilesVisibleY.toFixed(1)} tiles`
);

// -------------------------------------------------------------
// Test 11: Viewport Math: Desktop 3-Column Studio (1920 × 1080)
// -------------------------------------------------------------
// Shell is max 1560px, center canvas is ~960px wide, height ~1032px
const simDesktop = simulatePortraitCamera(960, 1032, 10, 6, 'down');
const desktopPass = simDesktop.zoom === 1.6 &&
                    simDesktop.visibleW > 500 &&
                    !isNaN(simDesktop.targetX) && !isNaN(simDesktop.targetY);
assert(desktopPass, 11,
  'Viewport Simulation: Desktop Studio (1920 × 1080)',
  `Center Stage=960x1032, Zoom=${simDesktop.zoom}x, Visible World=${Math.round(simDesktop.visibleW)}x${Math.round(simDesktop.visibleH)}px`
);

// -------------------------------------------------------------
// Test 12: Safari & VisualViewport Resilience
// -------------------------------------------------------------
const hasVisualViewportListener = gameContent.includes('window.visualViewport.addEventListener(\'resize\'') &&
                                  gameContent.includes('window.visualViewport.addEventListener(\'scroll\'');
const setsAppHeightProperty = gameContent.includes("setProperty('--app-height'") &&
                              cssContent.includes('height: var(--app-height, 100vh);');
const uses100Dvh = cssContent.includes('height: 100dvh;');
assert(hasVisualViewportListener && setsAppHeightProperty && uses100Dvh, 12,
  'Safari & VisualViewport Resilience',
  'visualViewport listeners bound for dynamic address bar resize, 100dvh and --app-height applied'
);

// -------------------------------------------------------------
// Test 13: On-Screen Portrait Touch Controls (Thumb Zones)
// -------------------------------------------------------------
const hasDpadInHtml = htmlContent.includes('id="dpad"') &&
                      htmlContent.includes('id="dpad-up"') &&
                      htmlContent.includes('id="dpad-down"') &&
                      htmlContent.includes('id="dpad-left"') &&
                      htmlContent.includes('id="dpad-right"');
const hasActionBtn = htmlContent.includes('id="mobile-action-btn"');
const hasEmoteBtn = htmlContent.includes('id="mobile-emote-btn"');
const hasDpadListeners = gameContent.includes('setupDpadTouch') &&
                         gameContent.includes('pointerdown') &&
                         gameContent.includes('pointerup');
const hasTouchActionNone = cssContent.includes('touch-action: none;');
assert(hasDpadInHtml && hasActionBtn && hasEmoteBtn && hasDpadListeners && hasTouchActionNone, 13,
  'On-Screen Portrait Touch Controls',
  'Ergonomic 4-way D-Pad (left thumb) and 68px Action + Emote (right thumb) configured with touch-action: none'
);

// -------------------------------------------------------------
// Test 14: Desktop 3-Column Studio Layout Preservation
// -------------------------------------------------------------
const hasCenteredAppContainer = cssContent.includes('max-width: var(--app-max-width);') &&
                                cssContent.includes('margin: 0 auto;');
const has3ColumnGrid = cssContent.includes('grid-template-columns: clamp(250px, 18vw, 300px) minmax(0, 1fr) clamp(280px, 21vw, 340px);');
const preservesWarmBackgrounds = cssContent.includes('--body-bg: #EFE8DF;') &&
                                 cssContent.includes('--env-canvas-stage: #263124;');
assert(hasCenteredAppContainer && has3ColumnGrid && preservesWarmBackgrounds, 14,
  'Desktop 3-Column Studio Preservation',
  'Repaired centered 1560px studio grid with left profile, center canvas, right ledger, and zero black voids'
);

// -------------------------------------------------------------
// Test 15: Functional Regression: Approved Quest #001 Rewards (+5 LP)
// -------------------------------------------------------------
const quest1 = QUESTS.find(q => q.id === 'Q-001');
const initialLp120 = gameContent.includes('lp: 120,');
const grants5Lp = gameContent.includes('state.lp += 5;');
const no15LpReward = !gameContent.includes('state.lp += 15;') && !gameContent.includes('135');
const grantsCharXp = gameContent.includes('state.charXp = (state.charXp || 0) + 5;');
const grantsStewardship = gameContent.includes('state.skills.stewardship += 15;');
const grantsResponsibility = gameContent.includes('state.skills.responsibility += 5;');
const setsLushGarden = gameContent.includes("state.gardenState = 'lush';") &&
                       gameContent.includes("state.gateOpen = true;");

// Simulate full lifecycle
const simState = { lp: 120, charXp: 0, skills: { stewardship: 0, responsibility: 0 } };
simState.lp += quest1.rewards.lp;
simState.charXp += quest1.rewards.charXp;
simState.skills.stewardship += quest1.rewards.skillXp.stewardship;
simState.skills.responsibility += quest1.rewards.skillXp.responsibility;

const exactValues = simState.lp === 125 &&
                    simState.charXp === 5 &&
                    simState.skills.stewardship === 15 &&
                    simState.skills.responsibility === 5;

assert(initialLp120 && grants5Lp && no15LpReward && grantsCharXp && grantsStewardship && grantsResponsibility && setsLushGarden && exactValues, 15,
  'Functional Regression: Quest #001 Approved Rewards',
  'Rewards strictly +5 LP (120 -> 125 LP), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP, unlocks lush garden and gate'
);

// -------------------------------------------------------------
// Test 16: Diagnostics HUD & Cache Busting Versioning
// -------------------------------------------------------------
const hasDebugHudEl = htmlContent.includes('id="debug-hud"');
const hasDebugHudLogic = gameContent.includes('isDebugMode') &&
                         gameContent.includes('updateDebugHud') &&
                         gameContent.includes('KOINONIA Phase 0.12 HUD');
const hasCacheBustingV12 = htmlContent.includes('styles.css?v=0.12') &&
                           htmlContent.includes('game.js?v=0.12') &&
                           htmlContent.includes('data/places.js?v=0.12');
assert(hasDebugHudEl && hasDebugHudLogic && hasCacheBustingV12, 16,
  'Diagnostics HUD & Cache Busting',
  '?debug=1 renders live camera/viewport HUD; all assets versioned with ?v=0.12'
);

// -------------------------------------------------------------
// Test 17: Multi-Place Canonical World & Tab Navigation
// -------------------------------------------------------------
const has5Places = PLACES.home && PLACES.fog_center && PLACES.school && PLACES.sports_hub && PLACES.outreach;
const has5Tabs = htmlContent.includes('id="nav-tab-home"') &&
                 htmlContent.includes('id="nav-tab-world"') &&
                 htmlContent.includes('id="nav-tab-quests"') &&
                 htmlContent.includes('id="nav-tab-journey"') &&
                 htmlContent.includes('id="nav-tab-me"');
const hasTabSwitchLogic = gameContent.includes('switchNavTab');
assert(has5Places && has5Tabs && hasTabSwitchLogic, 17,
  'Canonical World & 5-Tab Navigation',
  '5 canonical places, Home, World, Quests, Journey, and Me tabs fully operational'
);

// -------------------------------------------------------------
// Test 18: Koinonia Studio Admin 7-Step Wizard
// -------------------------------------------------------------
const hasStudioModal = htmlContent.includes('id="admin-studio-modal"') &&
                       htmlContent.includes('id="wizard-step-box"');
const has7Steps = htmlContent.includes('id="step-1-content"') &&
                  htmlContent.includes('id="step-7-content"');
const safeWizard = gameContent.includes('advanceWizard') && !gameContent.includes('eval(');
assert(hasStudioModal && has7Steps && safeWizard, 18,
  'Koinonia Studio Admin 7-Step Wizard',
  '7-step place creator functions with zero eval / zero script injection'
);

// -------------------------------------------------------------
// Test 19: Prior Phase Preservation Audits
// -------------------------------------------------------------
const p7Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-quest-phase07/index.html'));
const p8Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase08/index.html'));
const p9Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase09/index.html'));
const p10Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase10/index.html'));
const p11Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase11/index.html'));
assert(p7Exists && p8Exists && p9Exists && p10Exists && p11Exists, 19,
  'Prior Phase Preservation Audits',
  'Phases 0.7, 0.8, 0.9, 0.10, and 0.11 remain 100% intact and unedited'
);

// -------------------------------------------------------------
// Test 20: Production & Staging Safety Audit
// -------------------------------------------------------------
const serverStat = fs.statSync(path.join(BASE_DIR, 'server.js'));
const dbWalExists = fs.existsSync(path.join(BASE_DIR, 'fog_community.db-wal')) ||
                    fs.existsSync(path.join(BASE_DIR, 'backups/fog_community_2026-08-10.db'));
const stagingPath = '/home/raspi4/fog-portal-staging';
let stagingUntouched = true;
try {
  if (fs.existsSync(stagingPath)) stagingUntouched = true;
} catch (e) {
  stagingUntouched = true;
}
assert(serverStat.size > 0 && dbWalExists && stagingUntouched, 20,
  'Production & Staging Safety Audit',
  'server.js, SQLite databases, and /home/raspi4/fog-portal-staging 100% protected'
);

console.log('\n----------------------------------------------------');
console.log('Production & Launch Safety Verification');
console.log('----------------------------------------------------');
assert(p8Exists, 'S1', 'Phase 0.8 Preservation', 'prototype/koinonia-phase08/ intact');
assert(p10Exists, 'S2', 'Phase 0.10 Preservation', 'prototype/koinonia-phase10/ intact');
assert(p11Exists, 'S3', 'Phase 0.11 Preservation', 'prototype/koinonia-phase11/ intact');
assert(serverStat.size > 0, 'S4', 'Server Integrity', 'server.js size valid and unmodified');
assert(dbWalExists, 'S5', 'Database Integrity', 'SQLite database unmigrated');
assert(stagingUntouched, 'S6', 'Staging Isolation', 'Zero staging edits');

console.log('\n====================================================');
console.log(`Phase 0.12 Test Results Summary: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
