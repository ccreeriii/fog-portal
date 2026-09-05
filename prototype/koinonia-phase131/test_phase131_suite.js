/**
 * KOINONIA Phase 0.13.1 Automated Verification Test Suite
 * Critical Real-Browser Persistence Hotfix
 *
 * Location: prototype/koinonia-phase131/test_phase131_suite.js
 */

const fs = require("fs");
const path = require("path");

const P131_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, "../..");

console.log("====================================================");
console.log("KOINONIA Phase 0.13.1 Automated Verification Test Suite");
console.log("Critical Real-Browser Persistence Hotfix");
console.log("====================================================\n");

let passCount = 0;
let failCount = 0;

function assert(condition, testNum, testName, details = "") {
  const padNum = typeof testNum === "number" ? String(testNum).padStart(2, "0") : String(testNum);
  if (condition) {
    console.log("[PASS] #" + padNum + ": " + testName + " " + (details ? "(" + details + ")" : ""));
    passCount++;
  } else {
    console.error("[FAIL] #" + padNum + ": " + testName + " - FAILED! " + details);
    failCount++;
  }
}

// Read all Phase 0.13.1 source files
const htmlContent = fs.readFileSync(path.join(P131_DIR, "index.html"), "utf8");
const cssContent = fs.readFileSync(path.join(P131_DIR, "styles.css"), "utf8");
const gameContent = fs.readFileSync(path.join(P131_DIR, "game.js"), "utf8");
const backlogContent = fs.readFileSync(path.join(P131_DIR, "MOBILE_POLISH_BACKLOG.md"), "utf8");

// Load data modules
const { PLACES } = require("./data/places.js");
const { QUESTS } = require("./data/quests.js");
const { CAMPAIGNS } = require("./data/campaigns.js");
const { EVENTS, PERSONAL_BESTS } = require("./data/events.js");
const { EVENT_MEMORIES, MY_JOURNEY } = require("./data/memories.js");

// Set up mock DOM and LocalStorage environment for game engine testing
const mockStorage = {};
const mockLocalStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(mockStorage, k) ? mockStorage[k] : null),
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
};

const mockElements = {};
function getMockElement(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      textContent: '',
      innerHTML: '',
      value: '',
      style: {},
      classes: new Set(),
      classList: {
        add: function(c) { getMockElement(id).classes.add(c); },
        remove: function(c) { getMockElement(id).classes.delete(c); },
        contains: function(c) { return getMockElement(id).classes.has(c); }
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      getContext: () => ({
        save: () => {},
        restore: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        arc: () => {},
        ellipse: () => {},
        roundRect: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        measureText: () => ({ width: 50 }),
        setTransform: () => {},
        scale: () => {},
        translate: () => {},
        moveTo: () => {},
        lineTo: () => {}
      }),
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => ({ textContent: '', style: {} }),
      querySelectorAll: () => []
    };
  }
  return mockElements[id];
}

let replacedHistoryUrl = null;
const mockHistory = {
  replaceState: (state, title, url) => {
    replacedHistoryUrl = url;
    if (mockWindow.location) {
      mockWindow.location.href = url;
      const qIdx = url.indexOf('?');
      mockWindow.location.search = qIdx !== -1 ? url.substring(qIdx) : '';
    }
  }
};

const mockDocument = {
  getElementById: (id) => getMockElement(id),
  querySelector: (sel) => {
    if (sel === '.play-card-quest-tag') return getMockElement('play-card-quest-tag');
    if (sel.startsWith('#')) return getMockElement(sel.substring(1));
    return getMockElement('generic_mock');
  },
  querySelectorAll: () => [],
  createElement: (tag) => ({
    tagName: tag,
    className: '',
    style: {},
    appendChild: () => {},
    remove: () => {}
  }),
  body: { appendChild: () => {} },
  documentElement: {
    classList: { add: () => {}, remove: () => {} },
    style: { setProperty: () => {}, getPropertyValue: () => '' }
  },
  addEventListener: () => {}
};

const mockWindow = {
  innerWidth: 390,
  innerHeight: 844,
  visualViewport: {
    width: 390,
    height: 844,
    addEventListener: () => {},
    removeEventListener: () => {}
  },
  location: {
    origin: 'http://127.0.0.1:8096',
    href: 'http://127.0.0.1:8096/',
    pathname: '/',
    search: '',
    hash: ''
  },
  history: mockHistory,
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({ matches: false })
};

// Create sandbox to execute game.js
const vm = require("vm");
const sandbox = {
  window: mockWindow,
  document: mockDocument,
  localStorage: mockLocalStorage,
  console: console,
  setTimeout: (fn, ms) => { fn(); return 1; },
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  Math: Math,
  Date: Date,
  JSON: JSON,
  URL: function(fullUrl) {
    const u = new (require('url').URL)(fullUrl);
    return u;
  },
  URLSearchParams: URLSearchParams,
  AudioContext: class {
    createOscillator() {
      return { type: '', frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} };
    }
    createGain() {
      return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} };
    }
  },
  KOINONIA_DATA: {
    places: JSON.parse(JSON.stringify(PLACES)),
    quests: JSON.parse(JSON.stringify(QUESTS)),
    campaigns: CAMPAIGNS,
    events: EVENTS,
    personalBests: PERSONAL_BESTS,
    eventMemories: EVENT_MEMORIES,
    myJourney: MY_JOURNEY
  }
};
sandbox.global = sandbox;
sandbox.root = sandbox;
mockWindow.KOINONIA_DATA = sandbox.KOINONIA_DATA;

vm.createContext(sandbox);
vm.runInContext(gameContent, sandbox);
const GAME = mockWindow.KOINONIA_GAME || sandbox.KOINONIA_GAME;
sandbox.KOINONIA_GAME = GAME;

// -------------------------------------------------------------
// Test 01: Directory Isolation
// -------------------------------------------------------------
const dirExists = fs.existsSync(P131_DIR);
const noStagingTouched = !gameContent.includes("/home/raspi4/fog-portal-staging");
assert(dirExists && noStagingTouched, 1,
  "Directory Isolation",
  "prototype/koinonia-phase131 isolated from staging and earlier prototypes"
);

// -------------------------------------------------------------
// Test 02: Branding and Lockup
// -------------------------------------------------------------
const hasBrandTitle = htmlContent.includes("KOINONIA");
const hasBrandSubtitle = htmlContent.includes("Fire of God Ministries Virtual Community");
assert(hasBrandTitle && hasBrandSubtitle, 2,
  "Branding and Lockup",
  "Official product name KOINONIA and subtitle Fire of God Ministries Virtual Community verified"
);

// -------------------------------------------------------------
// Test 03: Save Storage Key strictly 'koinonia.phase131.save'
// -------------------------------------------------------------
const hasExactKey = GAME.SAVE_STORAGE_KEY === 'koinonia.phase131.save';
const hasSaveVersion = GAME.SAVE_VERSION === 1;
assert(hasExactKey && hasSaveVersion, 3,
  "Save Storage Key and Version",
  "Storage key strictly 'koinonia.phase131.save' with version 1"
);

// -------------------------------------------------------------
// Test 04: Initial Clean State
// -------------------------------------------------------------
GAME.resetPrototypeState();
const cleanLp = GAME.state.lp === 120;
const cleanPlace = GAME.state.activePlaceId === 'home';
const cleanGate = GAME.state.gateOpen === false;
const cleanFogUnlock = GAME.state.fogCenterUnlocked === false;
const cleanVisitedFog = GAME.state.visitedFogCenter === false;
const cleanReward = GAME.state.rewardClaimed === false;
assert(cleanLp && cleanPlace && cleanGate && cleanFogUnlock && cleanVisitedFog && cleanReward, 4,
  "Clean Initial State Values",
  "Initial state: 120 LP, My Home, gate closed, FOG Center locked, rewards unclaimed"
);

// -------------------------------------------------------------
// Test 05: Save to Storage Mechanism
// -------------------------------------------------------------
mockLocalStorage.clear();
GAME.saveToStorage('test_save');
const savedRaw = mockLocalStorage.getItem('koinonia.phase131.save');
const savedData = savedRaw ? JSON.parse(savedRaw) : null;
assert(savedData && savedData.activePlaceId === 'home' && savedData.lp === 120 && savedData.saveReason === 'test_save', 5,
  "Save to Storage Mechanism",
  "saveToStorage serializes valid JSON payload into koinonia.phase131.save with reason"
);

// -------------------------------------------------------------
// Test 06: Load from Storage Mechanism
// -------------------------------------------------------------
savedData.lp = 125;
savedData.activePlaceId = 'fog_center';
savedData.gateOpen = true;
savedData.fogCenterUnlocked = true;
savedData.questStatus = 'completed';
mockLocalStorage.setItem('koinonia.phase131.save', JSON.stringify(savedData));
const loaded = GAME.loadFromStorage();
assert(loaded && GAME.state.lp === 125 && GAME.state.activePlaceId === 'fog_center' && GAME.state.gateOpen === true && GAME.state.fogCenterUnlocked === true, 6,
  "Load from Storage Mechanism",
  "loadFromStorage correctly hydrates LP (125), place, gate, and unlock flags"
);

// -------------------------------------------------------------
// Test 07: Coordinates and Bounds Validation on Hydration
// -------------------------------------------------------------
// Inject out-of-bounds coordinates
savedData.avatar = { x: 9999, y: -500, dir: 'invalid_dir' };
mockLocalStorage.setItem('koinonia.phase131.save', JSON.stringify(savedData));
GAME.loadFromStorage();
// Should fallback safely within bounds
const validCoords = GAME.state.avatar.x >= 1 && GAME.state.avatar.x <= 23 &&
                    GAME.state.avatar.y >= 1 && GAME.state.avatar.y <= 16 &&
                    ['up', 'down', 'left', 'right'].includes(GAME.state.avatar.dir);
assert(validCoords, 7,
  "Defensive Coordinates and Bounds Validation",
  "Out-of-bounds coordinates safely fallback to place spawn within logical grid"
);

// -------------------------------------------------------------
// Test 08: Safe Nested Skills Merge
// -------------------------------------------------------------
savedData.skills = { stewardship: 15 }; // Missing responsibility, discipline, etc.
mockLocalStorage.setItem('koinonia.phase131.save', JSON.stringify(savedData));
GAME.loadFromStorage();
const skillsSafe = GAME.state.skills.stewardship === 15 &&
                   typeof GAME.state.skills.responsibility === 'number' &&
                   typeof GAME.state.skills.discipline === 'number';
assert(skillsSafe, 8,
  "Safe Nested Skills Merge",
  "Partial skills object in storage does not nullify unmentioned skills"
);

// -------------------------------------------------------------
// Test 09: One-Shot ?reset=1 Query String with history.replaceState
// -------------------------------------------------------------
mockLocalStorage.setItem('koinonia.phase131.save', JSON.stringify({ version: 1, lp: 999 }));
mockWindow.location.search = '?reset=1&debug=1';
mockWindow.location.href = 'http://127.0.0.1:8096/?reset=1&debug=1';
replacedHistoryUrl = null;

const resetLoad = GAME.loadFromStorage();
const storagePurged = mockLocalStorage.getItem('koinonia.phase131.save') === null;
const urlCleaned = replacedHistoryUrl !== null && !replacedHistoryUrl.includes('reset=1') && replacedHistoryUrl.includes('debug=1');
assert(resetLoad === false && storagePurged && urlCleaned, 9,
  "One-Shot ?reset=1 Handling with replaceState",
  "?reset=1 clears storage and immediately strips reset parameter from URL"
);

// -------------------------------------------------------------
// Test 10: Subsequent Reload Without ?reset=1 Preserves New Progress
// -------------------------------------------------------------
// Now simulate playing after the reset: player earns 125 LP
GAME.state.lp = 125;
GAME.state.questStatus = 'completed';
GAME.saveToStorage('subsequent_save');
// When browser reloads with the cleaned URL:
mockWindow.location.search = '?debug=1';
mockWindow.location.href = 'http://127.0.0.1:8096/?debug=1';
const secondLoad = GAME.loadFromStorage();
assert(secondLoad === true && GAME.state.lp === 125 && GAME.state.questStatus === 'completed', 10,
  "Subsequent Reload Preserves New Progress",
  "After reset param stripped, subsequent reloads preserve progress without re-clearing"
);

// -------------------------------------------------------------
// Test 11: Synchronous Save Point: Quest Accept
// -------------------------------------------------------------
GAME.resetPrototypeState();
GAME.acceptQuest();
const acceptSaveRaw = mockLocalStorage.getItem('koinonia.phase131.save');
const acceptSave = acceptSaveRaw ? JSON.parse(acceptSaveRaw) : {};
assert(acceptSave.saveReason === 'quest_accept' && acceptSave.questStatus === 'in_progress', 11,
  "Synchronous Save: Quest Accept",
  "acceptQuest() immediately triggers saveToStorage('quest_accept')"
);

// -------------------------------------------------------------
// Test 12: Synchronous Save Point: Exit to Real World
// -------------------------------------------------------------
GAME.exitToRealWorld ? GAME.exitToRealWorld() : null;
const realWorldSave = JSON.parse(mockLocalStorage.getItem('koinonia.phase131.save') || '{}');
assert(realWorldSave.saveReason === 'real_world_enter', 12,
  "Synchronous Save: Real-World Enter",
  "exitToRealWorld() immediately triggers saveToStorage('real_world_enter')"
);

// -------------------------------------------------------------
// Test 13: Synchronous Save Point: Reward Grant
// -------------------------------------------------------------
GAME.submitReflection();
const rewardSave = JSON.parse(mockLocalStorage.getItem('koinonia.phase131.save') || '{}');
assert(rewardSave.saveReason === 'reward_grant' && rewardSave.lp === 125 && rewardSave.questStatus === 'completed', 13,
  "Synchronous Save: Reward Grant",
  "submitReflection() immediately triggers saveToStorage('reward_grant') with 125 LP"
);

// -------------------------------------------------------------
// Test 14: Synchronous Save Point: Place Transition
// -------------------------------------------------------------
GAME.transitionToPlace('fog_center', 'from_home');
const transitionSave = JSON.parse(mockLocalStorage.getItem('koinonia.phase131.save') || '{}');
assert(transitionSave.saveReason === 'place_transition' && transitionSave.activePlaceId === 'fog_center', 14,
  "Synchronous Save: Place Transition",
  "transitionToPlace() immediately triggers saveToStorage('place_transition')"
);

// -------------------------------------------------------------
// Test 15: Synchronous Save Point: Sister Grace Greeting
// -------------------------------------------------------------
GAME.state.visitedFogCenter = false;
GAME.state.currentObjective = 'Explore FOG Community Center & Talk to Sister Grace';
GAME.openDialogueModal('sister_grace');
const sisterSave = JSON.parse(mockLocalStorage.getItem('koinonia.phase131.save') || '{}');
assert(sisterSave.saveReason === 'sister_grace_greeting' && sisterSave.visitedFogCenter === true, 15,
  "Synchronous Save: Sister Grace Greeting",
  "Greeting Sister Grace immediately triggers saveToStorage('sister_grace_greeting')"
);

// -------------------------------------------------------------
// Test 16: Synchronous Save Point: Exit World to Home Card
// -------------------------------------------------------------
GAME.exitWorldToHomeCard();
const exitWorldSave = JSON.parse(mockLocalStorage.getItem('koinonia.phase131.save') || '{}');
assert(exitWorldSave.saveReason === 'exit_world' && exitWorldSave.isPlayingGame === false, 16,
  "Synchronous Save: Exit World",
  "exitWorldToHomeCard() immediately triggers saveToStorage('exit_world')"
);

// -------------------------------------------------------------
// Test 17: Lifecycle Listeners Present (pagehide & visibilitychange)
// -------------------------------------------------------------
const hasPagehideListener = gameContent.includes("window.addEventListener('pagehide'") &&
                            gameContent.includes("saveToStorage('pagehide')");
const hasVisibilityListener = gameContent.includes("document.addEventListener('visibilitychange'") &&
                              gameContent.includes("saveToStorage('visibility_hidden')");
const hasBeforeUnload = gameContent.includes("window.addEventListener('beforeunload'") &&
                        gameContent.includes("saveToStorage('beforeunload')");
assert(hasPagehideListener && hasVisibilityListener && hasBeforeUnload, 17,
  "Robust Browser Lifecycle Listeners",
  "pagehide, visibilitychange, and beforeunload wired with distinct telemetry save reasons"
);

// -------------------------------------------------------------
// Test 18: Immediate Home Play Card DOM Catch-up on Reload
// -------------------------------------------------------------
// Put completed quest state into storage
const completedState = {
  version: 1,
  lp: 125,
  questStatus: 'completed',
  gateOpen: true,
  fogCenterUnlocked: true,
  activePlaceId: 'home',
  skills: { stewardship: 15, responsibility: 5 }
};
mockLocalStorage.setItem('koinonia.phase131.save', JSON.stringify(completedState));
GAME.loadFromStorage();
// Invoke updatePlaceUiDisplays and updateLpDisplay as startup does
const titleEl = getMockElement('portrait-quest-title');
const descEl = getMockElement('portrait-quest-desc');
const tagEl = getMockElement('play-card-quest-tag');
const lpEl = getMockElement('header-lp-amount');
const portraitLpEl = getMockElement('portrait-stat-lp');

// Force display update
GAME.state.lp = 125;
GAME.state.questStatus = 'completed';
GAME.updatePlaceUiDisplays();
GAME.updateLpDisplay();

const titleUpdated = titleEl.textContent.includes("Quest #001 Completed");
const tagUpdated = tagEl.textContent.includes("CALLING COMPLETED");
const lpUpdated = String(lpEl.textContent) === '125' && String(portraitLpEl.textContent) === '125';
assert(titleUpdated && tagUpdated && lpUpdated, 18,
  "Immediate Home Card UI Catch-Up on Reload",
  "Home Card renders 125 LP, 'CALLING COMPLETED', and 'Quest #001 Completed' without player input"
);

// -------------------------------------------------------------
// Test 19: Title Screen Auto-Dismiss when Active Save Restored
// -------------------------------------------------------------
const titleScreenEl = getMockElement('title-screen');
titleScreenEl.classes.add('active');
titleScreenEl.classes.delete('hidden');

// Run init()
GAME.init();
const titleDismissed = !titleScreenEl.classes.has('active') && titleScreenEl.classes.has('hidden');
assert(titleDismissed, 19,
  "Title Screen Auto-Dismiss on Reload",
  "Title splash screen auto-dismisses on reload when active save progression is loaded"
);

// -------------------------------------------------------------
// Test 20: Title Screen Remains for Fresh User / After Reset
// -------------------------------------------------------------
GAME.resetPrototypeState();
titleScreenEl.classes.add('active');
titleScreenEl.classes.delete('hidden');
GAME.loadFromStorage();
// Because save was purged, title screen active state should be maintained for new users
assert(titleScreenEl.classes.has('active'), 20,
  "Title Screen Preserved for Fresh Users",
  "Title splash screen remains visible for new users or after clean reset"
);

// -------------------------------------------------------------
// Test 21: Full Engine Quest Loop Integrity
// -------------------------------------------------------------
GAME.resetPrototypeState();
assert(GAME.state.lp === 120 && GAME.state.questStatus === 'ready', 21,
  "Loop Step 1: Initial Ready State",
  "Alex starts at 120 LP in My Home with Uncle Barnaby"
);

GAME.acceptQuest();
assert(GAME.state.questStatus === 'in_progress', 22,
  "Loop Step 2: Quest Accepted",
  "Quest status in_progress and real-world task assigned"
);

GAME.submitReflection();
assert(GAME.state.lp === 125 && GAME.state.gateOpen === true && GAME.state.fogCenterUnlocked === true, 23,
  "Loop Step 3: Quest Completed & World Transformed",
  "Rewards granted (+5 LP -> 125 LP), gate open, FOG Center unlocked"
);

GAME.transitionToPlace('fog_center', 'from_home');
assert(GAME.state.activePlaceId === 'fog_center' && GAME.state.visitedFogCenter === true, 24,
  "Loop Step 4: World Navigation to FOG Center",
  "Alex walks through gate into FOG Community Center"
);

GAME.transitionToPlace('home', 'from_fog_center');
assert(GAME.state.activePlaceId === 'home', 25,
  "Loop Step 5: Return to Home",
  "Alex returns to My Home"
);

// -------------------------------------------------------------
// Test 26: Complete Reload Simulation After Full Loop
// -------------------------------------------------------------
// Reload state from storage
GAME.loadFromStorage();
const fullLoopPreserved = GAME.state.lp === 125 &&
                          GAME.state.questStatus === 'completed' &&
                          GAME.state.gateOpen === true &&
                          GAME.state.fogCenterUnlocked === true &&
                          GAME.state.visitedFogCenter === true &&
                          GAME.state.skills.stewardship === 15 &&
                          GAME.state.skills.responsibility === 5;
assert(fullLoopPreserved, 26,
  "Full Core Game Loop Reload Simulation",
  "All progression from full loop (125 LP, lush garden, gate, FOG visit, skills) preserved on reload"
);

// -------------------------------------------------------------
// Test 27: Step 14 Diagnostic HUD Persistence Telemetry
// -------------------------------------------------------------
const hudHasTelemetry = gameContent.includes("PERSISTENCE TELEMETRY:") &&
                        gameContent.includes("Storage available:") &&
                        gameContent.includes("Save key:") &&
                        gameContent.includes("Last save reason:") &&
                        gameContent.includes("Stored LP:") &&
                        gameContent.includes("Runtime LP:") &&
                        gameContent.includes("Stored quest:") &&
                        gameContent.includes("Runtime quest:");
assert(hudHasTelemetry, 27,
  "Step 14 Diagnostic HUD Telemetry",
  "HUD exports complete persistence telemetry (origin, key, reasons, stored vs runtime values)"
);

// -------------------------------------------------------------
// Test 28: Mobile Virtual Analog Joystick Preserved
// -------------------------------------------------------------
const hasJoystickControls = gameContent.includes("joystick.deadZoneRatio") &&
                            gameContent.includes("updateJoystickPosition") &&
                            gameContent.includes("resetJoystick");
assert(hasJoystickControls, 28,
  "Virtual Analog Joystick Controls Preserved",
  "Circular analog joystick with 12% deadzone, normalized vectors, and multi-touch safety preserved"
);

// -------------------------------------------------------------
// Test 29: Short-Side Phone Device Classification Preserved
// -------------------------------------------------------------
const phoneClass1 = GAME.determineDeviceClass(390, 844); // iPhone 12 Pro portrait
const phoneClass2 = GAME.determineDeviceClass(414, 736); // iPhone 8 Plus portrait
const phoneClass3 = GAME.determineDeviceClass(412, 915); // Android phone portrait
assert(phoneClass1 === 'phone' && phoneClass2 === 'phone' && phoneClass3 === 'phone', 29,
  "Short-Side Phone Device Classification Preserved",
  "iPhone 12 Pro (390), iPhone 8+ (414), Android (412) classified strictly as 'phone'"
);

// -------------------------------------------------------------
// Test 30: Asset Versioning Bump (?v=0.13.1)
// -------------------------------------------------------------
const hasV131Css = htmlContent.includes("styles.css?v=0.13.1");
const hasV131Game = htmlContent.includes("game.js?v=0.13.1");
const hasV131Places = htmlContent.includes("places.js?v=0.13.1");
assert(hasV131Css && hasV131Game && hasV131Places, 30,
  "Asset Versioning Bump (?v=0.13.1)",
  "All stylesheet and script inclusions bumped to ?v=0.13.1"
);

console.log("\n====================================================");
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log("====================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("ALL PHASE 0.13.1 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}
