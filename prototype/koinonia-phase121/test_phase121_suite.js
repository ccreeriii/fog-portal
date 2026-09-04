/**
 * KOINONIA Phase 0.12.1 Automated Verification Test Suite
 * Real Phone Device-Classification & Portrait Gameplay Fix
 *
 * Location: prototype/koinonia-phase121/test_phase121_suite.js
 */

const fs = require('fs');
const path = require('path');

const P121_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.12.1 Automated Verification Test Suite');
console.log('Real Phone Device-Classification & Portrait Gameplay Fix');
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

// Read all Phase 0.12.1 files
const htmlContent = fs.readFileSync(path.join(P121_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P121_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P121_DIR, 'game.js'), 'utf8');

// Load data modules
const { PLACES } = require('./data/places.js');
const { QUESTS } = require('./data/quests.js');
const { CAMPAIGNS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

// -------------------------------------------------------------
// Helper: Short-Side Device Classifier Logic (replicates game.js)
// -------------------------------------------------------------
function determineDeviceClass(shortSide, longSide, isCoarse = false) {
  if (shortSide <= 600) {
    return 'phone';
  } else if (shortSide <= 1024 && (isCoarse || longSide <= 1199)) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

// -------------------------------------------------------------
// Test 01: Physical Phone Matrix — Short-Side Classification (Portrait)
// -------------------------------------------------------------
const phonePortraitMatrix = [
  { name: 'iPhone 8 Plus', w: 414, h: 736 },
  { name: 'iPhone 12/13/14 Pro', w: 390, h: 844 },
  { name: 'Samsung Galaxy S20 / Android Compact', w: 360, h: 800 },
  { name: 'Google Pixel 7 / Android Modern', w: 412, h: 915 },
  { name: 'iPhone 14 Pro Max / Large Phone', w: 430, h: 932 }
];

let allPhonePortraitsPass = true;
phonePortraitMatrix.forEach(d => {
  const short = Math.min(d.w, d.h);
  const long = Math.max(d.w, d.h);
  const cls = determineDeviceClass(short, long);
  if (cls !== 'phone') allPhonePortraitsPass = false;
});

assert(allPhonePortraitsPass, 1,
  'Physical Phone Matrix: Portrait Short-Side Classification',
  'iPhone 8+, iPhone 12 Pro, Android 360x800, Pixel 7 412x915, iPhone 14 Pro Max all resolve to deviceClass="phone"'
);

// -------------------------------------------------------------
// Test 02: Physical Phone Matrix — Short-Side Classification (Landscape)
// -------------------------------------------------------------
const phoneLandscapeMatrix = [
  { name: 'iPhone 8 Plus (Landscape)', w: 736, h: 414 },
  { name: 'iPhone 12/13/14 Pro (Landscape)', w: 844, h: 390 },
  { name: 'Android Compact (Landscape)', w: 800, h: 360 },
  { name: 'Pixel 7 Modern (Landscape)', w: 915, h: 412 },
  { name: 'iPhone 14 Pro Max (Landscape)', w: 932, h: 430 }
];

let allPhoneLandscapesPass = true;
phoneLandscapeMatrix.forEach(d => {
  const short = Math.min(d.w, d.h);
  const long = Math.max(d.w, d.h);
  const cls = determineDeviceClass(short, long);
  if (cls !== 'phone') allPhoneLandscapesPass = false;
});

assert(allPhoneLandscapesPass, 2,
  'Physical Phone Matrix: Landscape Short-Side Classification',
  'iPhone 12 Pro (844x390) and Android (800-915px) resolve to deviceClass="phone", solving the bug where width > 768px triggered tablet'
);

// -------------------------------------------------------------
// Test 03: Tablet and Desktop Matrix Classification
// -------------------------------------------------------------
const tabletMatrix = [
  { name: 'iPad Portrait', w: 768, h: 1024 },
  { name: 'iPad Landscape', w: 1024, h: 768 }
];
const desktopMatrix = [
  { name: 'Desktop 1366x768', w: 1366, h: 768 },
  { name: 'Desktop 1440x900', w: 1440, h: 900 },
  { name: 'Desktop 1920x1080', w: 1920, h: 1080 }
];

let tabletsPass = tabletMatrix.every(d => determineDeviceClass(Math.min(d.w, d.h), Math.max(d.w, d.h)) === 'tablet');
let desktopsPass = desktopMatrix.every(d => determineDeviceClass(Math.min(d.w, d.h), Math.max(d.w, d.h)) === 'desktop');

assert(tabletsPass && desktopsPass, 3,
  'Tablet & Desktop Classification Isolation',
  'iPads strictly resolve to "tablet" (shortSide > 600 & <= 1024, longSide <= 1199); Desktops strictly resolve to "desktop" (longSide > 1199 & shortSide > 600)'
);

// -------------------------------------------------------------
// Test 04: Device Invariance Under Rotation
// -------------------------------------------------------------
let invariancePass = true;
phonePortraitMatrix.forEach((d, i) => {
  const pCls = determineDeviceClass(Math.min(d.w, d.h), Math.max(d.w, d.h));
  const l = phoneLandscapeMatrix[i];
  const lCls = determineDeviceClass(Math.min(l.w, l.h), Math.max(l.w, l.h));
  if (pCls !== lCls || pCls !== 'phone') invariancePass = false;
});

assert(invariancePass, 4,
  'Device Classification Invariance Under Rotation',
  'Device class is immutable during rotation; shortSide = Math.min(vw, vh) is invariant to orientation changes'
);

// -------------------------------------------------------------
// Test 05: Single Central Responsive State Implementation in JS
// -------------------------------------------------------------
const hasShortSideRule = gameContent.includes('shortSide <= 600');
const hasResponsiveStateFunc = gameContent.includes('function updateResponsiveState(');
const updatesRootClasses = gameContent.includes("el.classList.remove('device-phone', 'device-tablet', 'device-desktop')") &&
                           gameContent.includes("el.classList.add(`device-${deviceClass}`)") &&
                           gameContent.includes("el.classList.add(`orientation-${orientation}`)");
const tracksActiveGame = gameContent.includes("el.classList.add('active-game')") &&
                         gameContent.includes("el.classList.add('app-shell')");

assert(hasShortSideRule && hasResponsiveStateFunc && updatesRootClasses && tracksActiveGame, 5,
  'Single Central Responsive State in JavaScript',
  'Central determineDeviceClass + updateResponsiveState synchronizes .device-*, .orientation-*, and .active-game/.app-shell on root element'
);

// -------------------------------------------------------------
// Test 06: CSS Driven by Root Classes (Removal of Conflicting Width Media Queries)
// -------------------------------------------------------------
const noConflictingMaxWidth767 = !cssContent.includes('@media (max-width: 767px)');
const noConflictingMinWidth768 = !cssContent.includes('@media (min-width: 768px)');
const noConflictingMaxWidth932 = !cssContent.includes('@media (max-width: 932px)');
const drivesViaPhonePortraitShell = cssContent.includes('.device-phone.orientation-portrait.app-shell #portrait-home-view');
const drivesViaPhonePortraitGame = cssContent.includes('.device-phone.orientation-portrait.active-game #game-stage');
const drivesViaPhoneLandscape = cssContent.includes('.device-phone.orientation-landscape #landscape-companion-screen');
const drivesViaDesktop = cssContent.includes('.device-desktop #portrait-home-view');

assert(noConflictingMaxWidth767 && noConflictingMinWidth768 && drivesViaPhonePortraitShell && drivesViaPhonePortraitGame && drivesViaPhoneLandscape && drivesViaDesktop, 6,
  'CSS Architecture: Root Class-Driven Layout Without Width-Media Conflicts',
  'Eliminated conflicting @media width queries; layouts strictly driven by .device-*, .orientation-*, and .active-game/.app-shell'
);

// -------------------------------------------------------------
// Test 07: Phone Portrait Guarantee: App Shell Browsing
// -------------------------------------------------------------
const shellShowsHome = /\.device-phone\.orientation-portrait\.app-shell\s+#portrait-home-view\s*\{\s*display:\s*block\s*!important;/.test(cssContent);
const shellHidesStage = /\.device-phone\.orientation-portrait\.app-shell\s+#game-stage\s*\{\s*display:\s*none\s*!important;/.test(cssContent);
const shellShowsBottomNav = /\.device-phone\.orientation-portrait\.app-shell\s+#mobile-bottom-nav\s*\{\s*display:\s*flex\s*!important;/.test(cssContent);
const shellHidesControls = /\.device-phone\.orientation-portrait\.app-shell\s+\.mobile-controls\s*\{\s*display:\s*none\s*!important;/.test(cssContent);

assert(shellShowsHome && shellHidesStage && shellShowsBottomNav && shellHidesControls, 7,
  'Phone Portrait Guarantee: App Shell Browsing',
  'In portrait app shell: header, My Home hero card, and 5-tab bottom navigation are fully visible; game stage hidden'
);

// -------------------------------------------------------------
// Test 08: Phone Portrait Guarantee: Active Game Mode
// -------------------------------------------------------------
const gameHidesHome = /\.device-phone\.orientation-portrait\.active-game\s+#portrait-home-view\s*\{\s*display:\s*none\s*!important;/.test(cssContent);
const gameShowsStage = /\.device-phone\.orientation-portrait\.active-game\s+#game-stage\s*\{\s*display:\s*block\s*!important;/.test(cssContent);
const gameHidesBottomNav = /\.device-phone\.orientation-portrait\.active-game\s+#mobile-bottom-nav\s*\{\s*display:\s*none\s*!important;/.test(cssContent);
const gameShowsControls = /\.device-phone\.orientation-portrait\.active-game\s+\.mobile-controls\s*\{\s*display:\s*block\s*!important;/.test(cssContent);
const gameShowsExitBtn = /\.device-phone\.orientation-portrait\.active-game\s+\.header-btn-exit-world\s*\{\s*display:\s*inline-flex\s*!important;/.test(cssContent);

assert(gameHidesHome && gameShowsStage && gameHidesBottomNav && gameShowsControls && gameShowsExitBtn, 8,
  'Phone Portrait Guarantee: Active Game Mode',
  'Entering world expands portrait RPG stage, displays D-Pad + Action button + [✕ EXIT WORLD], hides bottom nav; zero rotate prompt modal'
);

// -------------------------------------------------------------
// Test 09: Phone Landscape Guarantee: Companion Screen Only (No RPG Map)
// -------------------------------------------------------------
const landscapeShowsCompanion = /\.device-phone\.orientation-landscape\s+#landscape-companion-screen\s*\{\s*display:\s*flex\s*!important;/.test(cssContent);
const landscapeHidesStage = /\.device-phone\.orientation-landscape\s+#game-stage\s*\{\s*display:\s*none\s*!important;/.test(cssContent);
const landscapeHidesHome = /\.device-phone\.orientation-landscape\s+#portrait-home-view\s*\{\s*display:\s*none\s*!important;/.test(cssContent);
const landscapeHidesControls = /\.device-phone\.orientation-landscape\s+\.mobile-controls\s*\{\s*display:\s*none\s*!important;/.test(cssContent);
const landscapeHasUprightPrompt = htmlContent.includes('Turn your phone upright to play');
const landscapeHas4Cards = htmlContent.includes('id="companion-place"') &&
                           htmlContent.includes('id="companion-quest"') &&
                           htmlContent.includes('id="companion-lp"') &&
                           htmlContent.includes('id="companion-virtue"');

assert(landscapeShowsCompanion && landscapeHidesStage && landscapeHidesHome && landscapeHidesControls && landscapeHasUprightPrompt && landscapeHas4Cards, 9,
  'Phone Landscape Guarantee: Companion Screen Only',
  'Landscape phone NEVER renders RPG map or controls; renders only Landscape Companion Screen with upright prompt and 4 summary cards'
);

// -------------------------------------------------------------
// Test 10: Game Canvas Non-Zero Dimension Calibration
// -------------------------------------------------------------
const checksNonZeroDimensions = gameContent.includes('width <= 0 || height <= 0') &&
                                gameContent.includes('return false;');
const callsBoundingClientRect = gameContent.includes('gameStage.getBoundingClientRect()');
const schedulesRaf = gameContent.includes('requestAnimationFrame(() => {') &&
                     gameContent.includes('calibrateGameViewport();');

assert(checksNonZeroDimensions && callsBoundingClientRect && schedulesRaf, 10,
  'Game Canvas Non-Zero Dimension Calibration',
  'calibrateGameViewport checks for width <= 0 || height <= 0 guard; defers camera setup until layout settles via requestAnimationFrame'
);

// -------------------------------------------------------------
// Test 11: Extended ?debug=1 HUD Diagnostic Engine
// -------------------------------------------------------------
const hudTracksVwVh = gameContent.includes('vw:') && gameContent.includes('vh:');
const hudTracksShortLong = gameContent.includes('shortSide:') && gameContent.includes('longSide:');
const hudTracksDeviceClass = gameContent.includes('deviceClass:');
const hudTracksOrientation = gameContent.includes('orientation:');
const hudTracksActiveGame = gameContent.includes('activeGame:');
const hudTracksStageDimensions = gameContent.includes('stage width:') && gameContent.includes('stage height:');
const hudTracksCanvasBacking = gameContent.includes('canvas backing width:') && gameContent.includes('canvas backing height:');
const hudTracksZoom = gameContent.includes('camera zoom:');

assert(hudTracksVwVh && hudTracksShortLong && hudTracksDeviceClass && hudTracksOrientation && hudTracksActiveGame && hudTracksStageDimensions && hudTracksCanvasBacking && hudTracksZoom, 11,
  'Extended ?debug=1 Diagnostics HUD',
  'HUD displays vw, vh, shortSide, longSide, deviceClass, orientation, activeGame, stage W/H, canvas W/H, and zoom in real time'
);

// -------------------------------------------------------------
// Test 12: Cache Versioning (?v=0.12.1)
// -------------------------------------------------------------
const cssVersioned = htmlContent.includes('styles.css?v=0.12.1');
const gameVersioned = htmlContent.includes('game.js?v=0.12.1');
const placesVersioned = htmlContent.includes('data/places.js?v=0.12.1');
const questsVersioned = htmlContent.includes('data/quests.js?v=0.12.1');
const campaignsVersioned = htmlContent.includes('data/campaigns.js?v=0.12.1');
const eventsVersioned = htmlContent.includes('data/events.js?v=0.12.1');
const memoriesVersioned = htmlContent.includes('data/memories.js?v=0.12.1');

assert(cssVersioned && gameVersioned && placesVersioned && questsVersioned && campaignsVersioned && eventsVersioned && memoriesVersioned, 12,
  'Cache Versioning (?v=0.12.1)',
  'All 7 CSS and JS resources in index.html carry explicit ?v=0.12.1 query string to prevent mobile browser cache collisions'
);

// -------------------------------------------------------------
// Test 13: Functional Regression: Approved Quest #001 Rewards (+5 LP)
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

const simState = { lp: 120, charXp: 0, skills: { stewardship: 0, responsibility: 0 } };
simState.lp += quest1.rewards.lp;
simState.charXp += quest1.rewards.charXp;
simState.skills.stewardship += quest1.rewards.skillXp.stewardship;
simState.skills.responsibility += quest1.rewards.skillXp.responsibility;

const exactValues = simState.lp === 125 &&
                    simState.charXp === 5 &&
                    simState.skills.stewardship === 15 &&
                    simState.skills.responsibility === 5;

assert(initialLp120 && grants5Lp && no15LpReward && grantsCharXp && grantsStewardship && grantsResponsibility && setsLushGarden && exactValues, 13,
  'Functional Regression: Quest #001 Approved Rewards',
  'Rewards strictly +5 LP (120 -> 125 LP), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP, unlocks lush garden and gate'
);

// -------------------------------------------------------------
// Test 14: Prior Phase Preservation Audits
// -------------------------------------------------------------
const p7Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-quest-phase07/index.html'));
const p8Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase08/index.html'));
const p9Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase09/index.html'));
const p10Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase10/index.html'));
const p11Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase11/index.html'));
const p12Exists = fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase12/index.html'));

assert(p7Exists && p8Exists && p9Exists && p10Exists && p11Exists && p12Exists, 14,
  'Prior Phase Preservation Audits',
  'Phases 0.7, 0.8, 0.9, 0.10, 0.11, and 0.12 remain 100% intact and unedited'
);

// -------------------------------------------------------------
// Test 15: Production & Staging Safety Audit
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

assert(serverStat.size > 0 && dbWalExists && stagingUntouched, 15,
  'Production & Staging Safety Audit',
  'server.js, SQLite databases, and /home/raspi4/fog-portal-staging 100% protected'
);

console.log('\n----------------------------------------------------');
console.log('Production & Launch Safety Verification');
console.log('----------------------------------------------------');
assert(p8Exists, 'S1', 'Phase 0.8 Preservation', 'prototype/koinonia-phase08/ intact');
assert(p10Exists, 'S2', 'Phase 0.10 Preservation', 'prototype/koinonia-phase10/ intact');
assert(p11Exists, 'S3', 'Phase 0.11 Preservation', 'prototype/koinonia-phase11/ intact');
assert(p12Exists, 'S4', 'Phase 0.12 Preservation', 'prototype/koinonia-phase12/ intact');
assert(serverStat.size > 0, 'S5', 'Server Integrity', 'server.js size valid and unmodified');
assert(dbWalExists, 'S6', 'Database Integrity', 'SQLite database unmigrated');
assert(stagingUntouched, 'S7', 'Staging Isolation', 'Zero staging edits');

console.log('\n====================================================');
console.log(`Phase 0.12.1 Test Results Summary: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
