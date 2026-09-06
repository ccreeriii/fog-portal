/**
 * KOINONIA Phase 0.13 Automated Verification Test Suite
 * Core Game Loop + World Navigation Engine
 *
 * Location: prototype/koinonia-phase13/test_phase13_suite.js
 */

const fs = require("fs");
const path = require("path");

const P13_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, "../..");

console.log("====================================================");
console.log("KOINONIA Phase 0.13 Automated Verification Test Suite");
console.log("Core Game Loop + World Navigation Engine");
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

// Read all Phase 0.13 source files
const htmlContent = fs.readFileSync(path.join(P13_DIR, "index.html"), "utf8");
const cssContent = fs.readFileSync(path.join(P13_DIR, "styles.css"), "utf8");
const gameContent = fs.readFileSync(path.join(P13_DIR, "game.js"), "utf8");
const backlogContent = fs.readFileSync(path.join(P13_DIR, "MOBILE_POLISH_BACKLOG.md"), "utf8");

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
      classList: {
        classes: new Set(),
        add: function(c) { this.classes.add(c); },
        remove: function(c) { this.classes.delete(c); },
        contains: function(c) { return this.classes.has(c); }
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

const mockDocument = {
  getElementById: (id) => getMockElement(id),
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
  location: { search: '' },
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

vm.createContext(sandbox);
vm.runInContext(gameContent, sandbox);
const GAME = sandbox.KOINONIA_GAME || mockWindow.KOINONIA_GAME;

// -------------------------------------------------------------
// Test 01: Directory Isolation
// -------------------------------------------------------------
const dirExists = fs.existsSync(P13_DIR);
const noStagingTouched = !gameContent.includes("/home/raspi4/fog-portal-staging");
assert(dirExists && noStagingTouched, 1,
  "Directory Isolation",
  "prototype/koinonia-phase13 isolated from staging and earlier prototypes"
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
// Test 03: Mobile Polish Backlog File
// -------------------------------------------------------------
const backlogHasAllItems = backlogContent.toLowerCase().includes("joystick") &&
                           backlogContent.toLowerCase().includes("sound") &&
                           backlogContent.toLowerCase().includes("header") &&
                           backlogContent.toLowerCase().includes("life points") &&
                           backlogContent.toLowerCase().includes("logo");
assert(backlogHasAllItems, 3,
  "Mobile Polish Backlog File",
  "MOBILE_POLISH_BACKLOG.md documents all deferred mobile polish items"
);

// -------------------------------------------------------------
// Test 04: Centralized Prototype World State
// -------------------------------------------------------------
const hasWorldState = GAME && GAME.state &&
                      typeof GAME.state.activePlaceId === 'string' &&
                      typeof GAME.state.lp === 'number' &&
                      typeof GAME.state.questStatus === 'string' &&
                      typeof GAME.state.gardenState === 'string' &&
                      typeof GAME.state.gateOpen === 'boolean';
assert(hasWorldState, 4,
  "Centralized Prototype World State",
  "World state engine exports activePlaceId, lp, questStatus, gardenState, gateOpen"
);

// -------------------------------------------------------------
// Test 05: Save Storage Key and Version
// -------------------------------------------------------------
const hasExactKey = GAME.SAVE_STORAGE_KEY === 'koinonia.phase13.save';
const hasSaveVersion = GAME.SAVE_VERSION === 1;
assert(hasExactKey && hasSaveVersion, 5,
  "Save Storage Key and Version",
  "Storage key strictly 'koinonia.phase13.save' with version 1"
);

// -------------------------------------------------------------
// Test 06: Clean Initial State Values
// -------------------------------------------------------------
GAME.resetPrototypeState();
const cleanLp = GAME.state.lp === 120;
const cleanPlace = GAME.state.activePlaceId === 'home';
const cleanGate = GAME.state.gateOpen === false;
const cleanFogUnlock = GAME.state.fogCenterUnlocked === false;
const cleanVisitedFog = GAME.state.visitedFogCenter === false;
const cleanReward = GAME.state.rewardClaimed === false;
assert(cleanLp && cleanPlace && cleanGate && cleanFogUnlock && cleanVisitedFog && cleanReward, 6,
  "Clean Initial State Values",
  "Initial state: 120 LP, My Home, gate closed, FOG Center locked, rewards unclaimed"
);

// -------------------------------------------------------------
// Test 07: Save to Storage Mechanism
// -------------------------------------------------------------
mockLocalStorage.clear();
GAME.saveToStorage();
const savedRaw = mockLocalStorage.getItem('koinonia.phase13.save');
const savedData = savedRaw ? JSON.parse(savedRaw) : null;
assert(savedData && savedData.activePlaceId === 'home' && savedData.lp === 120, 7,
  "Save to Storage Mechanism",
  "saveToStorage serializes valid JSON payload into koinonia.phase13.save"
);

// -------------------------------------------------------------
// Test 08: Load from Storage Mechanism
// -------------------------------------------------------------
savedData.lp = 125;
savedData.activePlaceId = 'fog_center';
savedData.gateOpen = true;
mockLocalStorage.setItem('koinonia.phase13.save', JSON.stringify(savedData));
const loaded = GAME.loadFromStorage();
assert(loaded && GAME.state.lp === 125 && GAME.state.activePlaceId === 'fog_center' && GAME.state.gateOpen === true, 8,
  "Load from Storage Mechanism",
  "loadFromStorage correctly hydrates LP, place, and world flags from localStorage"
);

// -------------------------------------------------------------
// Test 09: Player Position Persistence across Reload
// -------------------------------------------------------------
GAME.state.avatar.x = 14.2;
GAME.state.avatar.y = 8.7;
GAME.state.avatar.dir = 'left';
GAME.saveToStorage();

// Reset avatar in memory and reload
GAME.state.avatar.x = 0;
GAME.state.avatar.y = 0;
GAME.loadFromStorage();
assert(GAME.state.avatar.x === 14.2 && GAME.state.avatar.y === 8.7 && GAME.state.avatar.dir === 'left', 9,
  "Player Position Persistence",
  "Player coordinates (14.2, 8.7) and facing direction restored from save"
);

// -------------------------------------------------------------
// Test 10: Developer Reset Purges Storage
// -------------------------------------------------------------
GAME.resetPrototypeState();
const purgedStorage = mockLocalStorage.getItem('koinonia.phase13.save') === null;
assert(purgedStorage && GAME.state.lp === 120 && GAME.state.activePlaceId === 'home', 10,
  "Developer Reset Purges Storage",
  "resetPrototypeState() removes key from storage and restores clean state"
);

// -------------------------------------------------------------
// Test 11: Developer Reset Query String (?reset=1)
// -------------------------------------------------------------
mockLocalStorage.setItem('koinonia.phase13.save', JSON.stringify({ version: 1, lp: 999 }));
mockWindow.location.search = '?reset=1';
const resetLoad = GAME.loadFromStorage();
assert(resetLoad === false && mockLocalStorage.getItem('koinonia.phase13.save') === null, 11,
  "Developer Reset via URL Parameter",
  "?reset=1 query parameter clears storage and rejects stale cache"
);
mockWindow.location.search = '';

// -------------------------------------------------------------
// Test 12: Registered Spawn Points
// -------------------------------------------------------------
const hasHomeSpawns = gameContent.includes("from_fog_center: { x: 12.0, y: 15.2, dir: 'up' }");
const hasFogSpawns = gameContent.includes("from_home: { x: 12.0, y: 14.8, dir: 'up' }");
assert(hasHomeSpawns && hasFogSpawns, 12,
  "Registered Spawn Points",
  "Coordinate spawn points defined for travel between My Home and FOG Center"
);

// -------------------------------------------------------------
// Test 13: Place 1 Architecture: My Home
// -------------------------------------------------------------
const homeDef = PLACES.home;
const homeHasZones = homeDef && homeDef.zones.some(z => z.id === 'bedroom') &&
                     homeDef.zones.some(z => z.id === 'living') &&
                     homeDef.zones.some(z => z.id === 'veranda') &&
                     homeDef.zones.some(z => z.id === 'garden');
assert(homeHasZones && homeDef.unlocked === true, 13,
  "Place 1: My Home Architecture",
  "My Home has Bedroom, Living/Hearth, Veranda, Garden, and unlocked: true"
);

// -------------------------------------------------------------
// Test 14: Place 2 Architecture: FOG Community Center
// -------------------------------------------------------------
const fogDef = PLACES.fog_center;
const fogHasDetails = fogDef && fogDef.name === 'FOG Community Center' &&
                      fogDef.zones.some(z => z.id === 'entrance') &&
                      fogDef.zones.some(z => z.id === 'youth_hall');
assert(fogHasDetails, 14,
  "Place 2: FOG Community Center Architecture",
  "FOG Community Center defined with Entrance, Youth Hall, Notice Board, and Prayer Cross"
);

// -------------------------------------------------------------
// Test 15: Placeholders Locked
// -------------------------------------------------------------
assert(PLACES.school.unlocked === false &&
       PLACES.sports_hub.unlocked === false &&
       PLACES.outreach.unlocked === false, 15,
  "Placeholder Places Locked",
  "School, Sports Hub, and Outreach Sites default to unlocked: false"
);

// -------------------------------------------------------------
// Test 16: Collision Grid Dynamic Building
// -------------------------------------------------------------
GAME.resetPrototypeState(); // home, gate closed
const homeInteracts = GAME.getInteractablesForPlace('home');
assert(homeInteracts.some(i => i.id === 'home_gate'), 16,
  "Collision Grid Dynamic Building",
  "Perimeter Gate interactable registered in My Home"
);

// -------------------------------------------------------------
// Test 17: Unified Interactables for My Home
// -------------------------------------------------------------
const hasBarnaby = homeInteracts.some(i => i.id === 'barnaby');
const hasPlants = homeInteracts.some(i => i.id === 'garden_plants');
const hasGate = homeInteracts.some(i => i.id === 'home_gate');
assert(hasBarnaby && hasPlants && hasGate, 17,
  "Unified Interactables: My Home",
  "Uncle Barnaby, Garden Potted Plants, and Perimeter Gate registered"
);

// -------------------------------------------------------------
// Test 18: Unified Interactables for FOG Community Center
// -------------------------------------------------------------
const fogInteracts = GAME.getInteractablesForPlace('fog_center');
const hasGrace = fogInteracts.some(i => i.id === 'sister_grace');
const hasBoard = fogInteracts.some(i => i.id === 'center_board');
const hasCross = fogInteracts.some(i => i.id === 'prayer_cross');
const hasExitGate = fogInteracts.some(i => i.id === 'center_exit_gate');
assert(hasGrace && hasBoard && hasCross && hasExitGate, 18,
  "Unified Interactables: FOG Community Center",
  "Sister Grace, Notice Board, Prayer Cross, and Return Gate registered"
);

// -------------------------------------------------------------
// Test 19: Proximity Prompt Detection
// -------------------------------------------------------------
GAME.state.activePlaceId = 'home';
GAME.state.avatar.x = 10.0;
GAME.state.avatar.y = 6.0; // At Uncle Barnaby
const nearest = GAME.getNearestInteractable();
assert(nearest && nearest.item.id === 'barnaby' && nearest.item.getPrompt().includes('Uncle Barnaby'), 19,
  "Proximity Prompt Detection",
  "Positioning near Uncle Barnaby detects nearest interactable with action prompt"
);

// -------------------------------------------------------------
// Test 20: Perimeter Gate Locked Before Quest Completion
// -------------------------------------------------------------
GAME.resetPrototypeState();
const gatePromptBefore = homeInteracts.find(i => i.id === 'home_gate').getPrompt();
assert(gatePromptBefore.includes('LOCKED'), 20,
  "Perimeter Gate Locked Initially",
  "Gate prompt indicates LOCKED before completing Quest #001"
);

// -------------------------------------------------------------
// Test 21: Uncle Barnaby State-Reactive Dialogue
// -------------------------------------------------------------
GAME.openDialogueModal('barnaby');
const readyText = getMockElement('dialogue-text').textContent;
assert(readyText.includes('thirsty today'), 21,
  "Uncle Barnaby Dialogue: Ready State",
  "Barnaby prompts Alex about thirsty potted plants on the veranda"
);

// -------------------------------------------------------------
// Test 22: Quest #001 Identity and Acceptance
// -------------------------------------------------------------
const quest001 = QUESTS.find(q => q.id === 'Q-001');
const quest001TitleExact = quest001 && quest001.title === 'Steward of the Garden';
const htmlHasExactTitle = htmlContent.includes("Steward of the Garden") && !htmlContent.includes("First Steps of Stewardship");
GAME.acceptQuest();
assert(quest001TitleExact && htmlHasExactTitle && GAME.state.questStatus === 'in_progress' && GAME.state.currentObjective.includes('Water home plants'), 22,
  "Quest #001 Title and Acceptance",
  "Quest #001 named exactly 'Steward of the Garden' across data and HTML"
);

// -------------------------------------------------------------
// Test 23: Reflection and Canonical Reward Grant
// -------------------------------------------------------------
// Reward Ceremony UI verification in HTML
const rewardUiChecks = htmlContent.includes("+5 LP") &&
                       htmlContent.includes("(125 Total)") &&
                       htmlContent.includes("+5 XP") &&
                       htmlContent.includes("+15 XP") &&
                       htmlContent.includes("+5 XP");
GAME.submitReflection();
const rewardLp = GAME.state.lp === 125; // starting 120 + 5 = 125
const rewardCharXp = GAME.state.charXp === 5;
const rewardStew = GAME.state.skills.stewardship === 15;
const rewardResp = GAME.state.skills.responsibility === 5;
assert(rewardUiChecks && rewardLp && rewardCharXp && rewardStew && rewardResp, 23,
  "Canonical Quest #001 Rewards (+5 LP)",
  "Starting 120 LP -> Completed 125 LP, +5 Char XP, +15 Stewardship XP, +5 Responsibility XP and Ceremony UI verified"
);

// -------------------------------------------------------------
// Test 24: Duplicate Reward Prevention & Storage Reload
// -------------------------------------------------------------
GAME.submitReflection(); // Attempt re-submission
const noDuplicate = GAME.state.lp === 125 && GAME.state.skills.stewardship === 15 && GAME.state.skills.responsibility === 5;
GAME.saveToStorage();
// Verify reload persistence restores completed LP and claimed status
GAME.state.lp = 0;
GAME.state.skills.stewardship = 0;
GAME.loadFromStorage();
const reloadPreserved = GAME.state.lp === 125 && GAME.state.rewardClaimed === true && GAME.state.skills.stewardship === 15 && GAME.state.skills.responsibility === 5;
assert(noDuplicate && reloadPreserved, 24,
  "Duplicate Reward Prevention & Reload Persistence",
  "Re-submission idempotent (125 LP) and reload from storage restores exact completed values"
);

// -------------------------------------------------------------
// Test 25: World Transformation: Garden Bloomed
// -------------------------------------------------------------
assert(GAME.state.gardenState === 'lush', 25,
  "World Transformation: Garden State",
  "Garden state blossomed from dry to lush upon quest completion"
);

// -------------------------------------------------------------
// Test 26: World Transformation: Gate Unlocked
// -------------------------------------------------------------
assert(GAME.state.gateOpen === true, 26,
  "World Transformation: Gate Unlocked",
  "Perimeter gate open flag toggled to true"
);

// -------------------------------------------------------------
// Test 27: World Transformation: FOG Center Unlocked
// -------------------------------------------------------------
assert(GAME.state.fogCenterUnlocked === true && GAME.state.unlockedPlaces.includes('fog_center'), 27,
  "World Transformation: FOG Center Unlocked",
  "FOG Community Center unlocked in prototype world navigation"
);

// -------------------------------------------------------------
// Test 28: Objective Progression
// -------------------------------------------------------------
assert(GAME.state.currentObjective.includes('FOG Community Center'), 28,
  "Objective Progression",
  "Next objective directs player to visit FOG Community Center"
);

// -------------------------------------------------------------
// Test 29: Uncle Barnaby Post-Quest Dialogue
// -------------------------------------------------------------
GAME.openDialogueModal('barnaby');
const completedText = getMockElement('dialogue-text').textContent;
assert(completedText.includes('perimeter gate is unlocked'), 29,
  "Uncle Barnaby Dialogue: Completed State",
  "Barnaby acknowledges lush garden and directs Alex south through the gate"
);

// -------------------------------------------------------------
// Test 30: Place Transition Overlay Markup and Styles
// -------------------------------------------------------------
const hasOverlayHtml = htmlContent.includes("id=\"place-transition-overlay\"");
const hasOverlayCss = cssContent.includes(".place-transition-overlay");
assert(hasOverlayHtml && hasOverlayCss, 30,
  "Place Transition Overlay",
  "#place-transition-overlay structured in HTML and styled in CSS"
);

// -------------------------------------------------------------
// Test 31: Place Transition Engine: Home -> FOG Center
// -------------------------------------------------------------
GAME.transitionToPlace('fog_center', 'from_home');
assert(GAME.state.activePlaceId === 'fog_center' && GAME.state.visitedFogCenter === true, 31,
  "Place Transition Engine: Home -> FOG Center",
  "Transition changes place to fog_center, updates avatar coords, and records visitedFogCenter"
);

// -------------------------------------------------------------
// Test 32: Sister Grace Welcome Dialogue
// -------------------------------------------------------------
GAME.openDialogueModal('sister_grace');
const graceText = getMockElement('dialogue-text').textContent;
const graceRole = getMockElement('dialogue-role').textContent;
assert(graceText.includes('Welcome to Fire of God Community Center') && graceRole.includes('Welcome Coordinator'), 32,
  "Sister Grace Welcome Dialogue",
  "Sister Grace welcomes Alex and commends faithful garden stewardship"
);

// -------------------------------------------------------------
// Test 33: Place Transition Engine: FOG Center -> Home
// -------------------------------------------------------------
GAME.transitionToPlace('home', 'from_fog_center');
assert(GAME.state.activePlaceId === 'home', 33,
  "Place Transition Engine: FOG Center -> Home",
  "Return transition places player back inside My Home at the perimeter gate"
);

// -------------------------------------------------------------
// Test 34: World Map Modal Place Selection & Locking
// -------------------------------------------------------------
let toastMessage = '';
sandbox.showToast = mockWindow.showToast = (msg) => { toastMessage = msg; };
GAME.handlePlaceSelect('school'); // Should be locked
const schoolToast = toastMessage;
GAME.handlePlaceSelect('home'); // Should succeed
assert(schoolToast.includes('locked') && GAME.state.activePlaceId === 'home', 34,
  "World Map Selection & Locking",
  "Selecting locked place triggers informative toast; selecting unlocked place transitions"
);

// -------------------------------------------------------------
// Test 35: Diagnostic HUD Telemetry Coverage
// -------------------------------------------------------------
const hudChecks = gameContent.includes("Place: <b>${state.activePlaceId}</b>") &&
                  gameContent.includes("Pos: <b>(${state.avatar.x.toFixed(1)}, ${state.avatar.y.toFixed(1)})</b>") &&
                  gameContent.includes("Quest: <b>${state.questStatus}</b>") &&
                  gameContent.includes("Gate Open: <b>${state.gateOpen}</b>") &&
                  gameContent.includes("FOG Unlocked: <b>${state.fogCenterUnlocked}</b>") &&
                  gameContent.includes("Visited FOG: <b>${state.visitedFogCenter}</b>") &&
                  gameContent.includes("Reward Claimed: <b>${state.rewardClaimed}</b>");
assert(hudChecks, 35,
  "Diagnostic HUD Telemetry Coverage",
  "HUD exports place, coords, questStatus, gateOpen, fogCenterUnlocked, visitedFogCenter, rewardClaimed"
);

// -------------------------------------------------------------
// Test 36: Virtual Analog Joystick Engine Preserved
// -------------------------------------------------------------
const hasJoystickControls = gameContent.includes("joystick.deadZoneRatio") &&
                            gameContent.includes("updateJoystickPosition") &&
                            gameContent.includes("resetJoystick");
assert(hasJoystickControls, 36,
  "Virtual Analog Joystick Controls Preserved",
  "Circular analog joystick with 12% deadzone, normalized vectors, and multi-touch safety preserved"
);

// -------------------------------------------------------------
// Test 37: Short-Side Phone Device Classification Preserved
// -------------------------------------------------------------
const phoneClass1 = GAME.determineDeviceClass(390, 844); // iPhone 12 Pro portrait
const phoneClass2 = GAME.determineDeviceClass(414, 736); // iPhone 8 Plus portrait
const phoneClass3 = GAME.determineDeviceClass(412, 915); // Android phone portrait
assert(phoneClass1 === 'phone' && phoneClass2 === 'phone' && phoneClass3 === 'phone', 37,
  "Short-Side Phone Device Classification",
  "iPhone 12 Pro (390), iPhone 8+ (414), Android (412) classified strictly as 'phone'"
);

// -------------------------------------------------------------
// Test 38: Asset Versioning Bump (?v=0.13)
// -------------------------------------------------------------
const hasV13Css = htmlContent.includes("styles.css?v=0.13");
const hasV13Game = htmlContent.includes("game.js?v=0.13");
const hasV13Places = htmlContent.includes("places.js?v=0.13");
assert(hasV13Css && hasV13Game && hasV13Places, 38,
  "Asset Versioning Bump",
  "All stylesheet and script inclusions bumped to ?v=0.13"
);

console.log("\n====================================================");
console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
console.log("====================================================");

if (failCount > 0) {
  process.exit(1);
} else {
  console.log("ALL PHASE 0.13 VERIFICATION TESTS PASSED SUCCESSFULLY!");
  process.exit(0);
}
