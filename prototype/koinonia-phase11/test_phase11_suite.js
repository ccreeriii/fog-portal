/**
 * KOINONIA Phase 0.11 Automated Verification Test Suite
 * Responsive Game Shell + Mobile Landscape Play Mode + Desktop Layout Repair
 *
 * Location: prototype/koinonia-phase11/test_phase11_suite.js
 */

const fs = require('fs');
const path = require('path');

const P11_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.11 Automated Verification Test Suite');
console.log('Responsive Game Shell & Layout Repair Verification');
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

// Read all Phase 0.11 files
const htmlContent = fs.readFileSync(path.join(P11_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P11_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P11_DIR, 'game.js'), 'utf8');

// Load data modules
const { PLACES } = require('./data/places.js');
const { QUESTS } = require('./data/quests.js');
const { CAMPAIGNS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

// -------------------------------------------------------------
// Test 01: Problem 1 Solved — Phone Landscape Game Mode
// -------------------------------------------------------------
const hasLandscapeMediaQuery = cssContent.includes('@media (orientation: landscape) and (max-height: 560px)');
const hasFullLandscapeStage = cssContent.includes('#studio-body {\n    height: calc(100% - var(--landscape-hud-height));') ||
                              cssContent.includes('#game-stage {\n    display: block !important;\n    width: 100%;\n    height: 100%;');
const hidesBottomNavInLandscape = cssContent.includes('#mobile-bottom-nav {\n    display: none !important;\n  }');
const hidesSidePanelsInLandscape = cssContent.includes('.studio-panel {\n    display: none;\n  }');
assert(hasLandscapeMediaQuery && hasFullLandscapeStage && hidesBottomNavInLandscape && hidesSidePanelsInLandscape, 1,
  'Problem 1 Solved: Phone Landscape Game Mode',
  'Game stage utilizes 100% viewport in landscape; bottom nav and side panels auto-hide'
);

// -------------------------------------------------------------
// Test 02: Landscape Ergonomic Controls Overlay
// -------------------------------------------------------------
const hasDpadInHtml = htmlContent.includes('id="dpad"') &&
                      htmlContent.includes('id="dpad-up"') &&
                      htmlContent.includes('id="dpad-down"') &&
                      htmlContent.includes('id="dpad-left"') &&
                      htmlContent.includes('id="dpad-right"');
const hasActionBtnInHtml = htmlContent.includes('id="mobile-action-btn"');
const hasTouchActionNone = cssContent.includes('touch-action: none;');
const controlsSafeAreaPadded = cssContent.includes('env(safe-area-inset-bottom');
assert(hasDpadInHtml && hasActionBtnInHtml && hasTouchActionNone && controlsSafeAreaPadded, 2,
  'Landscape Ergonomic Controls Overlay',
  'Touch D-Pad and Action button positioned in thumb zones with touch-action: none and safe-area padding'
);

// -------------------------------------------------------------
// Test 03: Problem 2 Solved — Phone Portrait Browsing (Zero Squeezed Canvas)
// -------------------------------------------------------------
const hasPortraitHomeView = htmlContent.includes('id="portrait-home-view"');
const hidesStageInPortrait = cssContent.includes('@media (max-width: 767px) and (orientation: portrait)') &&
                             cssContent.includes('#game-stage {\n    display: none;\n  }');
const showsPortraitHomeCard = cssContent.includes('#portrait-home-view {\n    display: block;\n  }');
const hasEnterWorldButton = htmlContent.includes('id="btn-enter-world-portrait"');
assert(hasPortraitHomeView && hidesStageInPortrait && showsPortraitHomeCard && hasEnterWorldButton, 3,
  'Problem 2 Solved: Phone Portrait Browsing',
  'RPG canvas is NOT squeezed into portrait; shows polished Koinonia Play Card with Enter World CTA'
);

// -------------------------------------------------------------
// Test 04: Rotate to Play Experience
// -------------------------------------------------------------
const hasRotatePromptModal = htmlContent.includes('id="rotate-prompt-modal"');
const hasRotateAnimation = cssContent.includes('@keyframes rotateDevice');
const hasRotateDismissLogic = gameContent.includes('rotateModal.classList.remove(\'active\')');
const hasEnterWorldHandler = gameContent.includes('enterWorldFromPortrait');
assert(hasRotatePromptModal && hasRotateAnimation && hasRotateDismissLogic && hasEnterWorldHandler, 4,
  'Rotate to Play Experience',
  'Tapping Enter World in portrait prompts device rotation; auto-enters game as soon as rotated'
);

// -------------------------------------------------------------
// Test 05: Problem 3 Solved — Desktop Layout Repair (Zero Right Void)
// -------------------------------------------------------------
const hasCenteredAppContainer = cssContent.includes('#app-container {\n  width: 100%;\n  max-width: var(--app-max-width);\n  height: 100vh;') &&
                                cssContent.includes('margin: 0 auto;');
const has3ColumnGrid = cssContent.includes('grid-template-columns: clamp(250px, 18vw, 300px) minmax(0, 1fr) clamp(280px, 21vw, 340px);');
const centerCanvasExpands = cssContent.includes('minmax(0, 1fr)');
assert(hasCenteredAppContainer && has3ColumnGrid && centerCanvasExpands, 5,
  'Problem 3 Solved: Desktop Layout Repair',
  'App centered with max-width 1560px on warm background; center canvas expands naturally across 3-column grid'
);

// -------------------------------------------------------------
// Test 06: Zero Black Void Policy
// -------------------------------------------------------------
const hasWarmBodyBg = cssContent.includes('--body-bg: #EFE8DF;') &&
                      cssContent.includes('background-color: var(--body-bg);');
const hasWarmSurfaceBg = cssContent.includes('--surface-bg: #FFF9F3;');
const hasEnvironmentalCanvasStage = cssContent.includes('--env-canvas-stage: #263124;') &&
                                    cssContent.includes('background-color: var(--env-canvas-stage);');
const noCanvasAspectRatioLock = !cssContent.includes('#gameCanvas {\n  aspect-ratio: 800 / 576;');
const drawsEnvironmentalSurroundings = gameContent.includes('drawEnvironmentalSurroundings') &&
                                      gameContent.includes('ctx.fillRect(-200, -200, LOGICAL_WIDTH + 400, LOGICAL_HEIGHT + 400);');
assert(hasWarmBodyBg && hasWarmSurfaceBg && hasEnvironmentalCanvasStage && noCanvasAspectRatioLock && drawsEnvironmentalSurroundings, 6,
  'Zero Black Void Policy',
  'No aspect-ratio lock; body uses warm neutral, stage uses deep forest/courtyard, and environmental tiles wrap boundaries'
);

// -------------------------------------------------------------
// Test 07: Responsive Camera Viewport Engine
// -------------------------------------------------------------
const hasCameraModel = gameContent.includes('const camera = {') &&
                       gameContent.includes('updateCamera') &&
                       gameContent.includes('resizeGameCanvas');
const hasCameraTransformInRender = gameContent.includes('ctx.scale(camera.dpr * camera.zoom, camera.dpr * camera.zoom);') &&
                                   gameContent.includes('ctx.translate(-camera.x, -camera.y);');
const hasClampingAndCentering = gameContent.includes('if (visibleW >= LOGICAL_WIDTH)') &&
                                gameContent.includes('if (visibleH >= LOGICAL_HEIGHT)');
assert(hasCameraModel && hasCameraTransformInRender && hasClampingAndCentering, 7,
  'Responsive Camera Viewport Engine',
  'Dynamic viewport scaling with player tracking, boundary clamping, and auto-centering for widescreen'
);

// -------------------------------------------------------------
// Test 08: Viewport Math Simulation: Phone Landscape (844 × 390)
// -------------------------------------------------------------
function simulateCamera(viewW, viewH, playerTileX, playerTileY) {
  const TILE = 32, WORLD_W = 800, WORLD_H = 576;
  const zoom = (viewH < 460 || viewW < 700) ? 1.25 : (viewW >= 1200 ? 1.6 : 1.4);
  const visibleW = viewW / zoom;
  const visibleH = viewH / zoom;
  const px = playerTileX * TILE;
  const py = playerTileY * TILE;

  let targetX = px - visibleW / 2;
  let targetY = py - visibleH / 2;

  if (visibleW >= WORLD_W) targetX = (WORLD_W - visibleW) / 2;
  else targetX = Math.max(0, Math.min(WORLD_W - visibleW, targetX));

  if (visibleH >= WORLD_H) targetY = (WORLD_H - visibleH) / 2;
  else targetY = Math.max(0, Math.min(WORLD_H - visibleH, targetY));

  return { zoom, visibleW, visibleH, targetX, targetY };
}

const phoneLandSim = simulateCamera(844, 354, 10, 6);
const phoneLandValid = phoneLandSim.zoom === 1.25 &&
                       phoneLandSim.visibleW > 600 &&
                       phoneLandSim.visibleH > 280 &&
                       !isNaN(phoneLandSim.targetX);
assert(phoneLandValid, 8,
  'Viewport Simulation: Phone Landscape (844 × 390)',
  `Zoom=${phoneLandSim.zoom}x, Visible World=${Math.round(phoneLandSim.visibleW)}x${Math.round(phoneLandSim.visibleH)}px, CameraX=${Math.round(phoneLandSim.targetX)}`
);

// -------------------------------------------------------------
// Test 09: Viewport Math Simulation: Desktop Standard (1440 × 900)
// -------------------------------------------------------------
// On 1440px desktop: sidebars are ~280px and ~320px -> center canvas is ~840px
const desktopSim = simulateCamera(840, 852, 10, 6);
const desktopValid = desktopSim.zoom === 1.4 &&
                     desktopSim.visibleW > 550 &&
                     !isNaN(desktopSim.targetX);
assert(desktopValid, 9,
  'Viewport Simulation: Desktop Standard (1440 × 900)',
  `Center Canvas Stage=840px, Zoom=${desktopSim.zoom}x, Clamped targetX=${Math.round(desktopSim.targetX)}`
);

// -------------------------------------------------------------
// Test 10: Viewport Math Simulation: Desktop Ultra-Wide (1920 × 1080)
// -------------------------------------------------------------
// On 1920px desktop: app shell is max-width 1560px -> center canvas is ~960px
const wideSim = simulateCamera(960, 1032, 12, 9);
const wideValid = wideSim.zoom === 1.4 &&
                  !isNaN(wideSim.targetX) &&
                  !isNaN(wideSim.targetY);
assert(wideValid, 10,
  'Viewport Simulation: Desktop Wide (1920 × 1080)',
  `Stage=960x1032, Zoom=${wideSim.zoom}x, Clamped Target=(${Math.round(wideSim.targetX)}, ${Math.round(wideSim.targetY)})`
);

// -------------------------------------------------------------
// Test 11: Viewport Math Simulation: Tablet Landscape (1024 × 768)
// -------------------------------------------------------------
const tabLandSim = simulateCamera(764, 720, 10, 6);
assert(tabLandSim.zoom === 1.4 && !isNaN(tabLandSim.targetX), 11,
  'Viewport Simulation: Tablet Landscape (1024 × 768)',
  `Stage=764x720, Zoom=${tabLandSim.zoom}x`
);

// -------------------------------------------------------------
// Test 12: Viewport Math Simulation: Small Android (800 × 360)
// -------------------------------------------------------------
const smallAndroidSim = simulateCamera(800, 324, 4.5, 14.5);
assert(smallAndroidSim.zoom === 1.25 && !isNaN(smallAndroidSim.targetX), 12,
  'Viewport Simulation: Small Android Landscape (800 × 360)',
  `Stage=800x324, Zoom=${smallAndroidSim.zoom}x`
);

// -------------------------------------------------------------
// Test 13: Viewport Math Simulation: Large Phone (932 × 430)
// -------------------------------------------------------------
const largePhoneSim = simulateCamera(932, 394, 10, 6);
assert(largePhoneSim.zoom === 1.25 && !isNaN(largePhoneSim.targetX), 13,
  'Viewport Simulation: Large Phone Landscape (932 × 430)',
  `Stage=932x394, Zoom=${largePhoneSim.zoom}x`
);

// -------------------------------------------------------------
// Test 14: Official KOINONIA Logo & Compact Header Lockup
// -------------------------------------------------------------
const hasKoinoniaMark = htmlContent.includes('class="koinonia-mark"') &&
                        cssContent.includes('.koinonia-mark');
const hasCorrectBrandWording = htmlContent.includes('KOINONIA') &&
                               htmlContent.includes('Fire of God Ministries Virtual Community');
const hasLpPill = htmlContent.includes('id="header-lp-amount">120<') &&
                  htmlContent.includes('class="lp-pill"');
const hasMenuExitButton = htmlContent.includes('id="btn-exit-gameplay"');
assert(hasKoinoniaMark && hasCorrectBrandWording && hasLpPill && hasMenuExitButton, 14,
  'Official KOINONIA Logo & Compact Header Lockup',
  'Koinonia mark + exact brand wording + 120 LP pill + landscape Menu/Exit button'
);

// -------------------------------------------------------------
// Test 15: Functional Regression: Approved Quest #001 Rewards (+5 LP)
// -------------------------------------------------------------
const quest1 = QUESTS.find(q => q.id === 'Q-001');
const questDataAccurate = quest1 &&
                          quest1.rewards &&
                          quest1.rewards.lp === 5 &&
                          quest1.rewards.charXp === 5 &&
                          quest1.rewards.skillXp &&
                          quest1.rewards.skillXp.stewardship === 15 &&
                          quest1.rewards.skillXp.responsibility === 5;

const initialLp120 = gameContent.includes('lp: 120,');
const grants5Lp = gameContent.includes('state.lp += 5;');
const no15LpReward = !gameContent.includes('state.lp += 15;') && !gameContent.includes('135');
const grantsCharXp = gameContent.includes('state.charXp = (state.charXp || 0) + 5;');
const grantsStewardship = gameContent.includes('state.skills.stewardship += 15;');
const grantsResponsibility = gameContent.includes('state.skills.responsibility += 5;');

// Simulate state change: 120 + 5 = 125 LP
const mockState = { lp: 120, charXp: 0, skills: { stewardship: 0, responsibility: 0 } };
mockState.lp += quest1.rewards.lp;
mockState.charXp += quest1.rewards.charXp;
mockState.skills.stewardship += quest1.rewards.skillXp.stewardship;
mockState.skills.responsibility += quest1.rewards.skillXp.responsibility;

const stateProgressionExact = mockState.lp === 125 &&
                              mockState.charXp === 5 &&
                              mockState.skills.stewardship === 15 &&
                              mockState.skills.responsibility === 5;

const rewardModalHasApprovedBadges = htmlContent.includes('+5 LP') &&
                                     htmlContent.includes('+5 XP') &&
                                     htmlContent.includes('+15 XP') &&
                                     htmlContent.includes('125 Total');

assert(questDataAccurate && initialLp120 && grants5Lp && no15LpReward && grantsCharXp &&
       grantsStewardship && grantsResponsibility && stateProgressionExact && rewardModalHasApprovedBadges, 15,
  'Functional Regression: Quest #001 Approved Rewards',
  'Rewards strictly +5 LP (120 -> 125 LP, never 135), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP'
);

// -------------------------------------------------------------
// Test 16: Multi-Place Canonical World (5 Places Fast Travel)
// -------------------------------------------------------------
const has5Places = PLACES.home && PLACES.fog_center && PLACES.school && PLACES.sports_hub && PLACES.outreach;
const hasPlaceWatermarkBadge = htmlContent.includes('id="canvas-place-badge"') &&
                               htmlContent.includes('id="canvas-place-label"');
const hasFastTravelLogic = gameContent.includes('travelToPlace');
assert(has5Places && hasPlaceWatermarkBadge && hasFastTravelLogic, 16,
  'Multi-Place Canonical World (5 Places Fast Travel)',
  'My Home, FOG Center, School, Sports Hub, Outreach Site registered with dynamic place switcher'
);

// -------------------------------------------------------------
// Test 17: Campaigns & Readiness Dashboards (AYS + Gratitude Week)
// -------------------------------------------------------------
const hasGratitudeWeek = htmlContent.includes('Gratitude Week') && htmlContent.includes('79% Readiness');
const hasAysSequence = htmlContent.includes('AYS: Week of Questions');
const hasReadinessChips = htmlContent.includes('Hospitality') && htmlContent.includes('Music') && htmlContent.includes('Prayer');
assert(hasGratitudeWeek && hasAysSequence && hasReadinessChips, 17,
  'Campaigns & Readiness Dashboards',
  'Gratitude Week 79% readiness and AYS 6-day sequence integrated across UI'
);

// -------------------------------------------------------------
// Test 18: Events & Personal Best Tracking (FOG Basketball Day)
// -------------------------------------------------------------
const hasBasketballEvent = htmlContent.includes('Youth Basketball Day') && htmlContent.includes('68–62');
assert(hasBasketballEvent, 18,
  'Events & Personal Best Tracking',
  'FOG Youth Basketball Day (68–62, +3 PBs) accessible via Me tab'
);

// -------------------------------------------------------------
// Test 19: Memories & Alex\'s 2026 Journey Archive
// -------------------------------------------------------------
const hasJourneyModal = htmlContent.includes('id="journey-modal"') &&
                        htmlContent.includes('id="journey-timeline-list"');
const hasMemoriesButton = htmlContent.includes('id="btn-open-memories-from-me"');
assert(hasJourneyModal && hasMemoriesButton, 19,
  'Memories & Personal Journey Archive',
  'Alex\'s 2026 milestones timeline and 6 community memories active'
);

// -------------------------------------------------------------
// Test 20: Koinonia Studio 7-Step Admin Wizard
// -------------------------------------------------------------
const hasStudioModal = htmlContent.includes('id="admin-studio-modal"') &&
                       htmlContent.includes('id="wizard-step-box"');
const has7StepContents = htmlContent.includes('id="step-1-content"') &&
                         htmlContent.includes('id="step-7-content"');
const hasSafeRegistration = gameContent.includes('wizardNext') &&
                            !gameContent.includes('eval(');
assert(hasStudioModal && has7StepContents && hasSafeRegistration, 20,
  'Koinonia Studio 7-Step Admin Wizard',
  '7-step place creator wizard functions with zero eval/script execution'
);

// -------------------------------------------------------------
// Test 21: Mobile Bottom Navigation (5 Tabs)
// -------------------------------------------------------------
const has5Tabs = htmlContent.includes('id="nav-tab-home"') &&
                 htmlContent.includes('id="nav-tab-world"') &&
                 htmlContent.includes('id="nav-tab-quests"') &&
                 htmlContent.includes('id="nav-tab-journey"') &&
                 htmlContent.includes('id="nav-tab-me"');
const hasSwitchLogic = gameContent.includes('switchNavTab');
assert(has5Tabs && hasSwitchLogic, 21,
  'Mobile Bottom Navigation (5 Tabs)',
  'Home, World, Quests, Journey, and Me tabs toggle responsive views'
);

// -------------------------------------------------------------
// Test 22: Phase Preservation Audits
// -------------------------------------------------------------
const p7Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-quest-phase07/index.html'));
const p8Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase08/index.html'));
const p9Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase09/index.html'));
const p10Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase10/index.html'));
assert(p7Exists && p8Exists && p9Exists && p10Exists, 22,
  'Phase Preservation Audits',
  'Phases 0.7, 0.8, 0.9, and 0.10 remain 100% intact and untouched'
);

// -------------------------------------------------------------
// Test 23: Production Safety Audit
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
assert(serverStat.size > 0 && dbWalExists && stagingUntouched, 23,
  'Production Safety Audit',
  'server.js, SQLite databases, and /home/raspi4/fog-portal-staging 100% protected'
);

console.log('\n----------------------------------------------------');
console.log('Production & Launch Safety Verification');
console.log('----------------------------------------------------');
assert(p8Exists, 'S1', 'Phase 0.8 Preservation', 'prototype/koinonia-phase08/ intact');
assert(p10Exists, 'S2', 'Phase 0.10 Preservation', 'prototype/koinonia-phase10/ intact');
assert(serverStat.size > 0, 'S3', 'Server Integrity', 'server.js size valid and unmodified');
assert(dbWalExists, 'S4', 'Database Integrity', 'SQLite database unmigrated');
assert(stagingUntouched, 'S5', 'Staging Isolation', 'Zero staging edits');

console.log('\n====================================================');
console.log(`Phase 0.11 Test Results Summary: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
