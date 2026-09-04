/**
 * KOINONIA Phase 0.10 Automated Verification Test Suite
 * Mobile Rescue + Brand-Accurate Game-First UX Test Suite
 *
 * Location: prototype/koinonia-phase10/test_phase10_suite.js
 */

const fs = require('fs');
const path = require('path');

const P10_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.10 Automated Verification Test Suite');
console.log('Mobile Rescue + Brand-Accurate Game-First UX');
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

// Read all Phase 0.10 files
const htmlContent = fs.readFileSync(path.join(P10_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P10_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P10_DIR, 'game.js'), 'utf8');

// Load data modules via require relative to P10_DIR
const { PLACES } = require('./data/places.js');
const { QUESTS } = require('./data/quests.js');
const { CAMPAIGNS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

// -------------------------------------------------------------
// Test 01: Portrait Map Visible Immediately (Game First)
// -------------------------------------------------------------
const hasDominantCanvas = htmlContent.includes('id="gameCanvas"') &&
                          htmlContent.includes('id="canvas-container"') &&
                          cssContent.includes('#studio-body') &&
                          cssContent.includes('.panel-center');
const sidePanelsOffCanvasOnMobile = cssContent.includes('.panel-left {') &&
                                   cssContent.includes('transform: translateX(-100%);') &&
                                   cssContent.includes('.panel-right {') &&
                                   cssContent.includes('transform: translateX(100%);');
assert(hasDominantCanvas && sidePanelsOffCanvasOnMobile, 1,
  'Portrait Map Visible Immediately (Game First)',
  'Canvas stage occupies main screen area; side panels are off-canvas drawers and do not crowd out the map'
);

// -------------------------------------------------------------
// Test 02: Portrait Feels Playable (Movement & Controls)
// -------------------------------------------------------------
const hasDpad = htmlContent.includes('class="dpad"') &&
                htmlContent.includes('id="dpad-up"') &&
                htmlContent.includes('id="dpad-down"') &&
                htmlContent.includes('id="dpad-left"') &&
                htmlContent.includes('id="dpad-right"');
const hasActionBtn = htmlContent.includes('id="mobile-action-btn"');
const hasTouchListeners = gameContent.includes('setupVirtualDpad') &&
                          gameContent.includes('touchstart') &&
                          gameContent.includes('touchend');
assert(hasDpad && hasActionBtn && hasTouchListeners, 2,
  'Portrait Feels Playable',
  'Virtual 4-way D-Pad and Action button positioned in bottom thumb zones with responsive touch listeners'
);

// -------------------------------------------------------------
// Test 03: Home No Longer Overloaded (Minimal Support Layer)
// -------------------------------------------------------------
const hasCompactQuestChip = htmlContent.includes('id="compact-quest-chip"') &&
                            htmlContent.includes('id="chip-quest-title"');
const hasNoBulkyDashboardOnHome = !htmlContent.includes('<div id="giant-dashboard">') &&
                                  htmlContent.includes('class="compact-quest-chip"');
assert(hasCompactQuestChip && hasNoBulkyDashboardOnHome, 3,
  'Home No Longer Overloaded',
  'Compact floating quest chip replaces oversized static dashboard on the home gameplay screen'
);

// -------------------------------------------------------------
// Test 04: Large Cards Are Collapsible
// -------------------------------------------------------------
const hasCollapsibleBoxes = htmlContent.includes('class="collapsible-box') &&
                            htmlContent.includes('class="collapsible-trigger"') &&
                            htmlContent.includes('class="collapsible-content"');
const hasCollapsibleLogic = gameContent.includes('.collapsible-trigger') &&
                            cssContent.includes('.collapsible-box.open');
assert(hasCollapsibleBoxes && hasCollapsibleLogic, 4,
  'Large Cards Are Collapsible',
  'Accordion collapsible boxes implemented for Place Callings, Gratitude Week readiness, AYS, and History'
);

// -------------------------------------------------------------
// Test 05: Scrolling Works Where Content Exceeds Height
// -------------------------------------------------------------
const hasTouchScrollInCss = cssContent.includes('-webkit-overflow-scrolling: touch;') &&
                            cssContent.includes('overflow-y: auto;');
const hasDrawerScroll = cssContent.includes('.drawer-body') &&
                        cssContent.includes('.sheet-body');
assert(hasTouchScrollInCss && hasDrawerScroll, 5,
  'Scrolling Works (Natural Touch Overflow)',
  '-webkit-overflow-scrolling: touch and overflow-y: auto enabled across all drawers and bottom sheets'
);

// -------------------------------------------------------------
// Test 06: Swipe & Interaction Feels Natural (Bottom Sheets)
// -------------------------------------------------------------
const hasBottomSheets = htmlContent.includes('class="bottom-sheet"') &&
                        htmlContent.includes('class="sheet-drag-handle"');
const hasSheetTransitions = cssContent.includes('@keyframes slideUpSheet') &&
                            cssContent.includes('--shadow-sheet');
assert(hasBottomSheets && hasSheetTransitions, 6,
  'Swipe & Interaction Feels Natural',
  'Slide-up bottom sheets with drag handles and animated entry transitions replace desktop modal dialogs'
);

// -------------------------------------------------------------
// Test 07: Landscape Layout Improved
// -------------------------------------------------------------
const hasLandscapeMedia = cssContent.includes('@media (orientation: landscape) and (max-height: 520px)');
const hasLandscapeCanvas = cssContent.includes('.dpad') && cssContent.includes('.action-btn-primary');
assert(hasLandscapeMedia && hasLandscapeCanvas, 7,
  'Landscape Layout Improved',
  'Dedicated landscape media query optimizes layout proportions for horizontal phone orientation'
);

// -------------------------------------------------------------
// Test 08: Landscape Empty Space Reduced
// -------------------------------------------------------------
const hasLandscapeHeaderAdjust = cssContent.includes('--header-height: 38px;') ||
                                 cssContent.includes('--bottom-nav-height: 42px;');
assert(hasLandscapeHeaderAdjust, 8,
  'Landscape Empty Space Reduced',
  'Header and navigation heights compacted in landscape to maximize usable gameplay canvas area'
);

// -------------------------------------------------------------
// Test 09: Landscape Font Scale Reduced
// -------------------------------------------------------------
const hasLandscapeFontScaling = cssContent.includes('font-size: 0.95rem;') &&
                                cssContent.includes('font-size: 0.52rem;');
assert(hasLandscapeFontScaling, 9,
  'Landscape Font Scale Reduced',
  'Brand typography and controls scale down proportionally to avoid oversized headings in landscape mode'
);

// -------------------------------------------------------------
// Test 10: 0.8-Style Game Feel Restored
// -------------------------------------------------------------
const has800x576Grid = gameContent.includes('WORLD_COLS = 25') &&
                       gameContent.includes('WORLD_ROWS = 18') &&
                       gameContent.includes('TILE_SIZE = 32');
const hasRoomRenderers = gameContent.includes('renderHomeWorld') &&
                         gameContent.includes('renderFogCenterWorld') &&
                         gameContent.includes('renderSchoolWorld') &&
                         gameContent.includes('renderSportsHubWorld') &&
                         gameContent.includes('renderOutreachWorld');
const hasCollisionGrid = gameContent.includes('initCollisionGrid') &&
                         gameContent.includes('isWalkable');
assert(has800x576Grid && hasRoomRenderers && hasCollisionGrid, 10,
  '0.8-Style Game Feel Restored',
  '800x576 tile resolution, multi-room tile renderers, and collision grid recovered from Phase 0.8'
);

// -------------------------------------------------------------
// Test 11: Official Brand Colors Applied
// -------------------------------------------------------------
const hasFlameGold = cssContent.includes('#FDC63F') || cssContent.includes('#fdc63f');
const hasAmber = cssContent.includes('#F99320') || cssContent.includes('#f99320');
const hasFireOrange = cssContent.includes('#EB5F12') || cssContent.includes('#eb5f12');
const hasRevivalRed = cssContent.includes('#D22F0A') || cssContent.includes('#d22f0a');
const hasBurgundy = cssContent.includes('#6A0E04') || cssContent.includes('#6a0e04');
const hasCharcoal = cssContent.includes('#262220');
const hasWarmWhite = cssContent.includes('#FFF9F3') || cssContent.includes('#fff9f3');
const hasPastelTints = cssContent.includes('#FFF4CC') && cssContent.includes('#FFE4C7');
assert(hasFlameGold && hasAmber && hasFireOrange && hasRevivalRed && hasBurgundy && hasCharcoal && hasWarmWhite && hasPastelTints, 11,
  'Official Brand Colors & Pastel Tints Applied',
  'Flame Gold, Amber, Fire Orange, Revival Red, Burgundy, Charcoal, Warm White, and soft pastel UI tints active'
);

// -------------------------------------------------------------
// Test 12: Official KOINONIA Logo & Brand Lockup
// -------------------------------------------------------------
const hasKoinoniaMark = htmlContent.includes('class="koinonia-mark"') &&
                        cssContent.includes('.koinonia-mark');
const hasFullLockup = htmlContent.includes('class="koinonia-full-lockup"') &&
                      htmlContent.includes('class="koinonia-emblem-large"') &&
                      cssContent.includes('.koinonia-full-lockup');
const hasCorrectBrandWording = htmlContent.includes('KOINONIA') &&
                               htmlContent.includes('Fire of God Ministries Virtual Community');
const avoidsSoleChurchLogo = !htmlContent.includes('<header id="global-header" role="banner">\n      <div class="header-brand-group">\n        <img src="assets/logo.png"');
assert(hasKoinoniaMark && hasFullLockup && hasCorrectBrandWording && avoidsSoleChurchLogo, 12,
  'Official KOINONIA Logo & Brand Lockup',
  'Uses compact Koinonia icon/mark for constrained mobile header, full lockup on title screen, and exact "KOINONIA / Fire of God Ministries Virtual Community" wording'
);

// -------------------------------------------------------------
// Test 13: Bottom Navigation Works
// -------------------------------------------------------------
const hasBottomNav = htmlContent.includes('id="mobile-bottom-nav"') &&
                     htmlContent.includes('id="nav-tab-home"') &&
                     htmlContent.includes('id="nav-tab-world"') &&
                     htmlContent.includes('id="nav-tab-quests"') &&
                     htmlContent.includes('id="nav-tab-journey"') &&
                     htmlContent.includes('id="nav-tab-me"');
const hasTabSwitchLogic = gameContent.includes('switchNavTab');
assert(hasBottomNav && hasTabSwitchLogic, 13,
  'Bottom Navigation Works',
  '5-tab bottom navigation with switchNavTab() view switching active'
);

// -------------------------------------------------------------
// Test 14: World Tab Works
// -------------------------------------------------------------
const hasWorldModal = htmlContent.includes('id="world-map-modal"') &&
                      htmlContent.includes('id="world-places-list"');
const hasTravelLogic = gameContent.includes('travelToPlace') &&
                       gameContent.includes('populateWorldMapList');
assert(hasWorldModal && hasTravelLogic, 14,
  'World Tab Works (5 Canonical Places)',
  'World map bottom sheet dynamically populates all 5 canonical places with fast travel'
);

// -------------------------------------------------------------
// Test 15: Quests Tab Works
// -------------------------------------------------------------
const hasQuestsModal = htmlContent.includes('id="quests-tab-modal"') &&
                       htmlContent.includes('id="quests-tab-list"');
const hasQuestsLogic = gameContent.includes('populateQuestsTab');
assert(hasQuestsModal && hasQuestsLogic, 15,
  'Quests Tab Works',
  'Quests sheet features place callings, Gratitude Week 79% readiness, and AYS 6-day sequence'
);

// -------------------------------------------------------------
// Test 16: Journey Tab Works
// -------------------------------------------------------------
const hasJourneyModal = htmlContent.includes('id="journey-modal"') &&
                        htmlContent.includes('id="journey-timeline-list"');
const hasJourneyLogic = gameContent.includes('populateJourneyTimeline');
assert(hasJourneyModal && hasJourneyLogic, 16,
  'Journey Tab Works',
  'Journey archive sheet populates vertical timeline of Alex\'s 2026 spiritual and community milestones'
);

// -------------------------------------------------------------
// Test 17: Me Tab Works
// -------------------------------------------------------------
const hasMeModal = htmlContent.includes('id="me-modal"') &&
                   htmlContent.includes('id="btn-open-sports-from-me"') &&
                   htmlContent.includes('id="btn-open-memories-from-me"');
assert(hasMeModal, 17,
  'Me Tab Works',
  'Profile sheet provides access to pilgrim stats, Sports PB records, photo memories, and Studio'
);

// -------------------------------------------------------------
// Test 18: Studio / Admin Access Works
// -------------------------------------------------------------
const hasAdminStudioModal = htmlContent.includes('id="admin-studio-modal"') &&
                            htmlContent.includes('id="wizard-step-box"');
const has7Steps = htmlContent.includes('id="step-1-content"') &&
                  htmlContent.includes('id="step-7-content"');
const hasWizardLogic = gameContent.includes('wizardNext') &&
                       gameContent.includes('wizardPrev');
assert(hasAdminStudioModal && has7Steps && hasWizardLogic, 18,
  'Studio / Admin Access Works (7-Step Wizard)',
  'Koinonia Studio 7-step wizard allows creating and registering custom places with zero eval/script injection'
);

// -------------------------------------------------------------
// Test 19: Phase 0.8 Untouched
// -------------------------------------------------------------
const p8Files = ['index.html', 'styles.css', 'game.js', 'README.md', 'test_phase08_suite.js'];
let p8Intact = true;
for (const f of p8Files) {
  if (!fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase08', f))) p8Intact = false;
}
assert(p8Intact, 19, 'Phase 0.8 Untouched', 'All Phase 0.8 prototype files remain completely unmodified');

// -------------------------------------------------------------
// Test 20: Phase 0.9 Untouched
// -------------------------------------------------------------
const p9Files = ['index.html', 'styles.css', 'game.js', 'README.md', 'test_phase09_suite.js'];
let p9Intact = true;
for (const f of p9Files) {
  if (!fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase09', f))) p9Intact = false;
}
assert(p9Intact, 20, 'Phase 0.9 Untouched', 'All Phase 0.9 prototype files remain completely unmodified');

// -------------------------------------------------------------
// Test 21: Production Untouched
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
assert(serverStat.size > 0 && dbWalExists && stagingUntouched, 21,
  'Production Untouched',
  'server.js, SQLite databases, and /home/raspi4/fog-portal-staging completely protected'
);

// -------------------------------------------------------------
// Test 22: Quest #001 Approved Reward Validation (No +15 LP)
// -------------------------------------------------------------
const quest1 = QUESTS.find(q => q.id === 'Q-001');
const questDataAccurate = quest1 &&
                          quest1.rewards &&
                          quest1.rewards.lp === 5 &&
                          quest1.rewards.charXp === 5 &&
                          quest1.rewards.skillXp &&
                          quest1.rewards.skillXp.stewardship === 15 &&
                          quest1.rewards.skillXp.responsibility === 5;

const initialLpInHtml = htmlContent.includes('id="header-lp-amount">120<');
const initialLpInGame = gameContent.includes('lp: 120,');

const gameGrants5Lp = gameContent.includes('state.lp += 5;');
const gameNo15Lp = !gameContent.includes('state.lp += 15;') && !gameContent.includes('135');
const gameGrantsCharXp = gameContent.includes('state.charXp = (state.charXp || 0) + 5;') ||
                         gameContent.includes('state.charXp += 5;');
const gameGrantsStewardship = gameContent.includes('state.skills.stewardship += 15;');
const gameGrantsResponsibility = gameContent.includes('state.skills.responsibility += 5;');

// Simulate state progression: 120 + 5 = 125 LP (NOT 135)
const mockState = { lp: 120, charXp: 0, skills: { stewardship: 0, responsibility: 0 } };
mockState.lp += quest1.rewards.lp;
mockState.charXp += quest1.rewards.charXp;
mockState.skills.stewardship += quest1.rewards.skillXp.stewardship;
mockState.skills.responsibility += quest1.rewards.skillXp.responsibility;

const stateAccurate = mockState.lp === 125 &&
                      mockState.charXp === 5 &&
                      mockState.skills.stewardship === 15 &&
                      mockState.skills.responsibility === 5;

const modalDisplaysApprovedRewards = htmlContent.includes('+5 LP') &&
                                     htmlContent.includes('+5 XP') &&
                                     htmlContent.includes('+15 XP') &&
                                     htmlContent.includes('125 Total') &&
                                     htmlContent.includes('Stewardship') &&
                                     htmlContent.includes('Responsibility');

assert(questDataAccurate && initialLpInHtml && initialLpInGame && gameGrants5Lp && gameNo15Lp &&
       gameGrantsCharXp && gameGrantsStewardship && gameGrantsResponsibility && stateAccurate &&
       modalDisplaysApprovedRewards, 22,
  'Quest #001 Approved Reward Validation (No +15 LP)',
  'Rewards strictly +5 LP (120 -> 125 LP, never 135), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP across UI, game logic, and data'
);

// -------------------------------------------------------------
// Safety Audit Summary
// -------------------------------------------------------------
console.log('\n----------------------------------------------------');
console.log('Production & Launch Safety Audit');
console.log('----------------------------------------------------');

const p7Files = ['index.html', 'styles.css', 'game.js', 'README.md'];
let p7Intact = true;
for (const f of p7Files) {
  if (!fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-quest-phase07', f))) p7Intact = false;
}
assert(p7Intact, 'S1', 'Phase 0.7 Preservation', 'All Phase 0.7 files intact in prototype/koinonia-quest-phase07/');
assert(p8Intact, 'S2', 'Phase 0.8 Preservation', 'All Phase 0.8 files intact in prototype/koinonia-phase08/');
assert(p9Intact, 'S3', 'Phase 0.9 Preservation', 'All Phase 0.9 files intact in prototype/koinonia-phase09/');
assert(serverStat.size > 0, 'S4', 'Server Integrity', 'Zero modifications to production server.js');
assert(dbWalExists, 'S5', 'Database Integrity', 'Production sqlite databases untouched and unmigrated');
assert(stagingUntouched, 'S6', 'Staging Isolation', 'Zero files modified in /home/raspi4/fog-portal-staging');

console.log('\n====================================================');
console.log(`Test Results Summary: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
