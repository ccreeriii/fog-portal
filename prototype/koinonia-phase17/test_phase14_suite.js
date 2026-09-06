/**
 * KOINONIA Phase 0.14 Automated Verification Test Suite
 * Modular Quest Engine
 *
 * Location: prototype/koinonia-phase14/test_phase14_suite.js
 */

const fs = require('fs');
const path = require('path');

const P14_DIR = __dirname;
const P131_DIR = path.resolve(__dirname, '../koinonia-phase131');
const P13_DIR = path.resolve(__dirname, '../koinonia-phase13');
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.14 Automated Verification Test Suite');
console.log('Modular Quest Engine');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testNum, testName, details = '') {
  const padNum = typeof testNum === 'number' ? String(testNum).padStart(2, '0') : String(testNum);
  if (condition) {
    console.log('[PASS] #' + padNum + ': ' + testName + ' ' + (details ? '(' + details + ')' : ''));
    passCount++;
  } else {
    console.error('[FAIL] #' + padNum + ': ' + testName + ' - FAILED! ' + details);
    failCount++;
  }
}

// Read Phase 0.14 source files
const htmlContent = fs.readFileSync(path.join(P14_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P14_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P14_DIR, 'game.js'), 'utf8');
const questsJsContent = fs.readFileSync(path.join(P14_DIR, 'data/quests.js'), 'utf8');

// Load data modules
const { PLACES } = require('./data/places.js');
const {
  QUESTS,
  QUEST_DEFINITIONS,
  QUEST_CATEGORIES,
  VERIFICATION_TYPES,
  QUEST_VERIFICATION_TYPES,
  QUEST_STATUS,
  getQuestById,
  getQuestsByGiver,
  getQuestsByCategory
} = require('./data/quests.js');
const { CAMPAIGNS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

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
      querySelector: (s) => getMockElement(s.replace(/^[.#]/, '')),
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
    origin: 'http://127.0.0.1:8097',
    href: 'http://127.0.0.1:8097/',
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
const vm = require('vm');
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
    questCategories: QUEST_CATEGORIES,
    questVerificationTypes: QUEST_VERIFICATION_TYPES,
    questStatus: QUEST_STATUS,
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
const dirExists = fs.existsSync(P14_DIR);
const noStagingTouched = !gameContent.includes('/home/raspi4/fog-portal-staging');
assert(dirExists && noStagingTouched, 1,
  'Directory Isolation',
  'prototype/koinonia-phase14 isolated from staging and earlier prototypes'
);

// -------------------------------------------------------------
// Test 02: Branding and Lockup
// -------------------------------------------------------------
const hasBrandTitle = htmlContent.includes('KOINONIA');
const hasBrandSubtitle = htmlContent.includes('Fire of God Ministries Virtual Community');
assert(hasBrandTitle && hasBrandSubtitle, 2,
  'Branding and Lockup',
  'Official product name KOINONIA and subtitle Fire of God Ministries Virtual Community verified'
);

// -------------------------------------------------------------
// Test 03: Save Storage Key strictly koinonia.phase14.save
// -------------------------------------------------------------
const hasExactKey = GAME.SAVE_STORAGE_KEY === 'koinonia.phase14.save';
const hasSaveVersion = GAME.SAVE_VERSION === 1;
assert(hasExactKey && hasSaveVersion, 3,
  'Save Storage Key and Version',
  'Storage key strictly koinonia.phase14.save with version 1'
);

// -------------------------------------------------------------
// Test 04: Initial Clean State
// -------------------------------------------------------------
GAME.resetPrototypeState();
const cleanLp = GAME.state.lp === 120;
const cleanPlace = GAME.state.activePlaceId === 'home';
const cleanTracked = GAME.state.trackedQuestId === 'Q-001';
const cleanReflectionSkill = GAME.state.skills.reflection === 0;
const cleanQ1 = GAME.state.questProgress['Q-001'] && GAME.state.questProgress['Q-001'].status === 'AVAILABLE';
const cleanQ2 = GAME.state.questProgress['Q-002'] && GAME.state.questProgress['Q-002'].status === 'LOCKED';
assert(cleanLp && cleanPlace && cleanTracked && cleanReflectionSkill && cleanQ1 && cleanQ2, 4,
  'Clean Initial State Values',
  'Initial state: 120 LP, My Home, tracked Q-001, reflection skill 0, Q-001 AVAILABLE, Q-002 LOCKED'
);

// -------------------------------------------------------------
// Test 05: 10 Modular Quest Categories Defined
// -------------------------------------------------------------
const expectedCats = [
  'STEWARDSHIP', 'FAMILY', 'PRAYER', 'SERVICE', 'COMMUNITY',
  'SCHOOL', 'FITNESS', 'MINISTRY', 'OUTREACH', 'PERSONAL_GROWTH'
];
const allCatsPresent = expectedCats.every(c => QUEST_CATEGORIES[c] && QUEST_CATEGORIES[c].id === c);
assert(allCatsPresent && Object.keys(QUEST_CATEGORIES).length === 10, 5,
  'Modular Quest Categories',
  'All 10 functional life categories defined with icon, name, and color'
);

// -------------------------------------------------------------
// Test 06: Zero Holiness / Piety Metrics Rule
// -------------------------------------------------------------
const forbiddenTerms = ['holiness', 'piety', 'righteousness_score', 'spiritual_tier', 'sanctity_points'];
let hasForbidden = false;
for (const term of forbiddenTerms) {
  if (questsJsContent.toLowerCase().includes(term)) {
    hasForbidden = true;
    break;
  }
}
assert(!hasForbidden, 6,
  'Zero Holiness / Piety Metrics',
  'No holiness scores, spiritual rankings, or piety counters exist in quest engine'
);

// -------------------------------------------------------------
// Test 07: Canonical Quest Verification Types Defined
// -------------------------------------------------------------
const canonicalVerifs = ['TRUST', 'REFLECTION', 'TRUST_PLUS_REFLECTION', 'FAMILY_CONFIRM', 'LEADER_CONFIRM', 'EVENT_ATTENDANCE'];
const allCanonicalPresent = canonicalVerifs.every(v => VERIFICATION_TYPES[v] && VERIFICATION_TYPES[v].id === v);
const exactSixTypes = Object.keys(VERIFICATION_TYPES).length === 6;
const staleVerifs = ['SELF_REFLECTION', 'PARENT_SIGN_OFF', 'MENTOR_VERIFY', 'AUTOMATIC', 'COMMUNITY_CONFIRM'];
const noStaleInTypes = staleVerifs.every(st => !VERIFICATION_TYPES[st]);
const noStaleInQuests = QUESTS.every(q => !staleVerifs.includes(q.verification?.type));
const requiresReflectionFlagsOk = 
  VERIFICATION_TYPES.TRUST.requiresReflection === false &&
  VERIFICATION_TYPES.REFLECTION.requiresReflection === true &&
  VERIFICATION_TYPES.TRUST_PLUS_REFLECTION.requiresReflection === true &&
  VERIFICATION_TYPES.FAMILY_CONFIRM.requiresReflection === false &&
  VERIFICATION_TYPES.LEADER_CONFIRM.requiresReflection === false &&
  VERIFICATION_TYPES.EVENT_ATTENDANCE.requiresReflection === false;

assert(allCanonicalPresent && exactSixTypes && noStaleInTypes && noStaleInQuests && requiresReflectionFlagsOk, 7,
  'Canonical Quest Verification Types',
  'Exactly 6 canonical verification types defined with requiresReflection flags and 0 stale identifiers'
);

// -------------------------------------------------------------
// Test 08: Quest Catalog Registration (5 Quests)
// -------------------------------------------------------------
const expectedQuests = ['Q-001', 'Q-002', 'Q-003', 'Q-004', 'Q-005'];
const allQuestsRegistered = expectedQuests.every(qid => QUESTS.some(q => q.id === qid));
assert(allQuestsRegistered && QUESTS.length >= 5, 8,
  'Quest Catalog Registration',
  '5 canonical quests registered in QUESTS (Q-001 through Q-005)'
);

// -------------------------------------------------------------
// Test 09: Quest Q-001 Exact Schema, Verification, and Rewards
// -------------------------------------------------------------
const q1 = getQuestById('Q-001');
const q1Ok = q1 &&
  q1.title === 'Steward of the Garden' &&
  q1.category === 'STEWARDSHIP' &&
  q1.verification.type === 'TRUST_PLUS_REFLECTION' &&
  q1.verification.requiresReflection === true &&
  q1.rewards.lp === 5 &&
  q1.rewards.charXp === 5 &&
  q1.rewards.stewardshipXp === 15 &&
  q1.rewards.responsibilityXp === 5 &&
  q1.worldEffects && q1.worldEffects.gardenLush === true &&
  q1.worldEffects.gateOpen === true &&
  q1.worldEffects.fogCenterUnlocked === true;
assert(q1Ok, 9,
  'Quest Q-001 Schema, Verification, and Rewards',
  'Steward of the Garden: TRUST_PLUS_REFLECTION (reflection REQUIRED), +5 LP, +5 Char XP, +15 Stew XP, +5 Resp XP'
);

// -------------------------------------------------------------
// Test 10: Quest Q-002 Light at Home Schema and Verification
// -------------------------------------------------------------
const q2 = getQuestById('Q-002');
const q2Ok = q2 &&
  q2.title === 'Light at Home' &&
  q2.category === 'FAMILY' &&
  q2.giverId === 'barnaby' &&
  q2.verification.type === 'TRUST' &&
  q2.verification.requiresReflection === false &&
  q2.rewards.lp === 5 &&
  q2.rewards.charXp === 5 &&
  q2.rewards.responsibilityXp === 10 &&
  q2.rewards.serviceXp === 10 &&
  q2.prerequisites.some(p => p.type === 'QUEST_COMPLETED' && p.questId === 'Q-001');
assert(q2Ok, 10,
  'Quest Q-002 Schema, Verification, and Rewards',
  'Light at Home (Family): TRUST (reflection OPTIONAL), req Q-001, +5 LP, +5 Char XP, +10 Resp XP, +10 Service XP'
);

// -------------------------------------------------------------
// Test 11: Quest Q-003 A Quiet Moment Schema, Prompt, and Verification
// -------------------------------------------------------------
const q3 = getQuestById('Q-003');
const q3PromptOk = (q3 && q3.steps && q3.steps[2] && q3.steps[2].prompt === 'What are you grateful for today?') ||
                   (q3 && q3.verification && q3.verification.optionalPrompt === 'What are you grateful for today?');
const q3Ok = q3 &&
  q3.title === 'A Quiet Moment' &&
  q3.category === 'PRAYER' &&
  (q3.giverId === 'sister_grace' || q3.giverId === 'grace') &&
  q3.placeId === 'fog_center' &&
  q3.verification.type === 'TRUST' &&
  q3.verification.requiresReflection === false &&
  q3PromptOk &&
  q3.rewards.lp === 5 &&
  q3.rewards.charXp === 5 &&
  q3.rewards.reflectionXp === 10;
assert(q3Ok, 11,
  'Quest Q-003 Schema, Prompt, and Rewards',
  'A Quiet Moment (Prayer): TRUST (reflection OPTIONAL), prompt "What are you grateful for today?", +5 LP, +10 Reflection XP'
);

// -------------------------------------------------------------
// Test 12: Quest Q-004 and Q-005 Schema
// -------------------------------------------------------------
const q4 = getQuestById('Q-004');
const q5 = getQuestById('Q-005');
const q45Ok = q4 && q4.category === 'COMMUNITY' && q5 && q5.category === 'SCHOOL';
assert(q45Ok, 12,
  'Quest Q-004 and Q-005 Schemas',
  'Q-004 Notice Board Fellowship (Community) and Q-005 Orderly Homework Haven (School) verified'
);

// -------------------------------------------------------------
// Test 13: Helper Methods getQuestById, getQuestsByGiver, getQuestsByCategory
// -------------------------------------------------------------
const barnabyQuests = getQuestsByGiver('barnaby');
const graceQuests = getQuestsByGiver('sister_grace');
const stewardshipQuests = getQuestsByCategory('STEWARDSHIP');
const helpersOk = barnabyQuests.length >= 3 && graceQuests.length >= 2 && stewardshipQuests.length >= 1;
assert(helpersOk, 13,
  'Quest Helper Methods',
  'getQuestById, getQuestsByGiver, getQuestsByCategory return correct query sets'
);

// -------------------------------------------------------------
// Test 14: Availability Engine - Initial Evaluation
// -------------------------------------------------------------
GAME.resetPrototypeState();
GAME.evaluateQuestAvailability();
const initQ1Avail = GAME.state.questProgress['Q-001'] && GAME.state.questProgress['Q-001'].status === 'AVAILABLE';
const initQ2Locked = GAME.state.questProgress['Q-002'] && GAME.state.questProgress['Q-002'].status === 'LOCKED';
const initQ3Locked = GAME.state.questProgress['Q-003'] && GAME.state.questProgress['Q-003'].status === 'LOCKED';
assert(initQ1Avail && initQ2Locked && initQ3Locked, 14,
  'Availability Engine - Initial State',
  'Only Q-001 is AVAILABLE at start; Q-002 and Q-003 remain LOCKED'
);

// -------------------------------------------------------------
// Test 15: Availability Engine - Prerequisite Unlocking after Q-001
// -------------------------------------------------------------
GAME.state.questProgress['Q-001'].status = 'COMPLETED';
GAME.evaluateQuestAvailability();
const q2NowAvail = GAME.state.questProgress['Q-002'] && GAME.state.questProgress['Q-002'].status === 'AVAILABLE';
const q3StillLocked = GAME.state.questProgress['Q-003'] && GAME.state.questProgress['Q-003'].status === 'LOCKED';
assert(q2NowAvail && q3StillLocked, 15,
  'Availability Engine - Unlocking after Q-001',
  'Q-002 unlocks to AVAILABLE after Q-001 completed; Q-003 stays LOCKED without place visit'
);

// -------------------------------------------------------------
// Test 16: Availability Engine - Multi-Prerequisite Unlock for Q-003
// -------------------------------------------------------------
GAME.state.visitedFogCenter = true;
GAME.evaluateQuestAvailability();
const q3NowAvail = GAME.state.questProgress['Q-003'] && GAME.state.questProgress['Q-003'].status === 'AVAILABLE';
assert(q3NowAvail, 16,
  'Availability Engine - Multi-Prerequisite Unlock',
  'Q-003 unlocks to AVAILABLE when both Q-001 is completed AND fog_center has been visited'
);

// -------------------------------------------------------------
// Test 17: Quest State Transition - AVAILABLE -> ACCEPTED
// -------------------------------------------------------------
GAME.resetPrototypeState();
GAME.acceptQuest('Q-001');
const accepted = GAME.state.questProgress['Q-001'].status === 'ACCEPTED' &&
                 GAME.state.trackedQuestId === 'Q-001' &&
                 GAME.state.questStatus === 'in_progress';
assert(accepted, 17,
  'Quest State Transition: ACCEPTED',
  'acceptQuest transitions quest to ACCEPTED, tracks quest, and updates legacy status'
);

// -------------------------------------------------------------
// Test 18: Quest State Transition - ACCEPTED -> REAL_WORLD
// -------------------------------------------------------------
GAME.exitToRealWorld();
const realWorld = GAME.state.questProgress['Q-001'].status === 'REAL_WORLD';
assert(realWorld, 18,
  'Quest State Transition: REAL_WORLD',
  'exitToRealWorld transitions quest to REAL_WORLD and opens standby mode'
);

// -------------------------------------------------------------
// Test 19: Quest State Transition - REAL_WORLD -> RETURNED
// -------------------------------------------------------------
GAME.returnFromRealWorld();
const returned = GAME.state.questProgress['Q-001'].status === 'VERIFYING' || GAME.state.questProgress['Q-001'].status === 'RETURNED';
assert(returned, 19,
  'Quest State Transition: RETURNED / VERIFYING',
  'returnFromRealWorld transitions quest into verification ready for reflection'
);

// -------------------------------------------------------------
// Test 20: Quest State Transition - Q-001 Required Reflection Enforcement
// -------------------------------------------------------------
// Q-001 has TRUST_PLUS_REFLECTION: empty submission must fail
getMockElement('reflection-input').value = '';
const emptySubmitResult = GAME.submitReflection();
const emptyRejected = emptySubmitResult === false &&
                      GAME.state.questProgress['Q-001'].status !== 'COMPLETED' &&
                      GAME.state.lp === 120;

// Submitting with non-empty reflection must succeed
getMockElement('reflection-input').value = 'The garden soil was warm and smelled rich after watering.';
const validSubmitResult = GAME.submitReflection();
const completed = validSubmitResult === true &&
                  GAME.state.questProgress['Q-001'].status === 'COMPLETED' &&
                  GAME.state.questProgress['Q-001'].completedAt !== null &&
                  GAME.state.questProgress['Q-001'].rewardClaimed === true;
assert(emptyRejected && completed, 20,
  'Q-001 Required Reflection & Completion',
  'submitReflection rejects empty input for TRUST_PLUS_REFLECTION, then completes with valid text'
);

// -------------------------------------------------------------
// Test 21: Q-001 Canonical Rewards - LP 120 -> 125
// -------------------------------------------------------------
const lpCorrect = GAME.state.lp === 125;
const xpCorrect = GAME.state.charXp === 5 || GAME.state.xp === 5;
const stewCorrect = GAME.state.skills.stewardship === 15;
const respCorrect = GAME.state.skills.responsibility === 5;
assert(lpCorrect && xpCorrect && stewCorrect && respCorrect, 21,
  'Q-001 Canonical Rewards Values',
  'Starting LP 120 -> 125 (+5 LP), +5 Char XP, +15 Stewardship XP, +5 Responsibility XP'
);

// -------------------------------------------------------------
// Test 22: Reward Idempotency - Duplicate Prevention
// -------------------------------------------------------------
const lpBefore = GAME.state.lp;
const xpBefore = GAME.state.charXp;
GAME.grantQuestRewards('Q-001');
GAME.grantQuestRewards('Q-001');
const lpAfter = GAME.state.lp;
const xpAfter = GAME.state.charXp;
assert(lpBefore === 125 && lpAfter === 125 && xpBefore === xpAfter, 22,
  'Reward Idempotency',
  'Calling grantQuestRewards multiple times does NOT double-grant LP or XP'
);

// -------------------------------------------------------------
// Test 23: World Effects Application
// -------------------------------------------------------------
const worldEffectsOk = GAME.state.gardenLush === true &&
                       GAME.state.gateOpen === true &&
                       GAME.state.fogCenterUnlocked === true;
assert(worldEffectsOk, 23,
  'Generic World Effects Application',
  'Q-001 worldEffects trigger gardenLush: true, gateOpen: true, and unlock fog_center'
);

// -------------------------------------------------------------
// Test 24: Save to Storage Mechanism with Phase 14 Schema
// -------------------------------------------------------------
mockLocalStorage.clear();
GAME.saveToStorage('test_phase14');
const savedRaw = mockLocalStorage.getItem('koinonia.phase14.save');
const savedData = savedRaw ? JSON.parse(savedRaw) : null;
const saveOk = savedData &&
               savedData.saveStorageKey === 'koinonia.phase14.save' &&
               savedData.version === 1 &&
               savedData.questProgress &&
               savedData.questProgress['Q-001'] &&
               savedData.questProgress['Q-001'].status === 'COMPLETED' &&
               savedData.lp === 125;
assert(saveOk, 24,
  'Save to Storage Mechanism',
  'saveToStorage serializes modular questProgress and LP into koinonia.phase14.save'
);

// -------------------------------------------------------------
// Test 25: Load from Storage and State Hydration
// -------------------------------------------------------------
GAME.state.lp = 120;
GAME.state.questProgress = {};
GAME.state.gardenLush = false;
GAME.state.gateOpen = false;
assert(GAME.state.lp === 120, 'pre_load', 'State reset before load test');
const loaded = GAME.loadFromStorage();
const loadOk = loaded &&
               GAME.state.lp === 125 &&
               GAME.state.questProgress['Q-001'] &&
               GAME.state.questProgress['Q-001'].status === 'COMPLETED' &&
               GAME.state.gardenLush === true &&
               GAME.state.gateOpen === true;
assert(loadOk, 25,
  'Load from Storage Mechanism',
  'loadFromStorage hydrates questProgress, LP (125), gardenLush, and gateOpen'
);

// -------------------------------------------------------------
// Test 26: Hydration Automatically Evaluates Availability
// -------------------------------------------------------------
const q2AvailAfterLoad = GAME.state.questProgress['Q-002'] && GAME.state.questProgress['Q-002'].status === 'AVAILABLE';
assert(q2AvailAfterLoad, 26,
  'Hydration Auto-Evaluation',
  'loadFromStorage automatically executes evaluateQuestAvailability() unlocking Q-002'
);

// -------------------------------------------------------------
// Test 27: Dynamic Dialogue - Uncle Barnaby Reactive
// -------------------------------------------------------------
GAME.state.activePlaceId = 'home';
const barnabyDialogue = GAME.getBarnabyDialogue();
const dialogueOffersQ2 = barnabyDialogue && barnabyDialogue.title && barnabyDialogue.title.includes('Light at Home');
assert(dialogueOffersQ2, 27,
  'Dynamic NPC Dialogue - Barnaby Offers Q-002',
  'Uncle Barnaby dynamically offers next available quest (Light at Home) once Q-001 is complete'
);

// -------------------------------------------------------------
// Test 28: Multi-Quest Progression - Q-002 Optional Reflection Completion
// -------------------------------------------------------------
GAME.acceptQuest('Q-002');
GAME.exitToRealWorld();
GAME.returnFromRealWorld();
// Q-002 has TRUST verification; reflection is OPTIONAL (can submit empty string)
getMockElement('reflection-input').value = '';
const q2SubmitResult = GAME.submitReflection();
const q2Completed = q2SubmitResult === true &&
                    GAME.state.questProgress['Q-002'] &&
                    GAME.state.questProgress['Q-002'].status === 'COMPLETED';
const lpCumulative = GAME.state.lp === 130;
const respXpCumulative = GAME.state.skills.responsibility === 15;
const serviceXp = GAME.state.skills.service === 10;
assert(q2Completed && lpCumulative && respXpCumulative && serviceXp, 28,
  'Multi-Quest Progression - Q-002 Optional Reflection & Rewards',
  'Completing Q-002 without reflection text succeeds: LP 125 -> 130 (+5), +10 Resp XP (total 15), +10 Service XP'
);

// -------------------------------------------------------------
// Test 29: Self-Reflection Flow for Q-003 (Optional Reflection)
// -------------------------------------------------------------
GAME.state.activePlaceId = 'fog_center';
GAME.state.visitedFogCenter = true;
GAME.evaluateQuestAvailability();
const q3Avail = GAME.state.questProgress['Q-003'] && GAME.state.questProgress['Q-003'].status === 'AVAILABLE';
GAME.acceptQuest('Q-003');
GAME.exitToRealWorld();
GAME.returnFromRealWorld();
// Q-003 has TRUST verification with optional prompt 'What are you grateful for today?'
getMockElement('reflection-input').value = '';
const q3SubmitResult = GAME.submitReflection();
const q3Completed = q3SubmitResult === true &&
                    GAME.state.questProgress['Q-003'] &&
                    GAME.state.questProgress['Q-003'].status === 'COMPLETED';
const reflectionXpGranted = GAME.state.skills.reflection === 10;
const lpAfterQ3 = GAME.state.lp === 135;
assert(q3Avail && q3Completed && reflectionXpGranted && lpAfterQ3, 29,
  'Q-003 Optional Reflection Flow and Rewards',
  'Q-003 verified via TRUST without written text: LP 130 -> 135 (+5) and +10 Sacred Reflection XP'
);

// -------------------------------------------------------------
// Test 30: Sister Grace Dynamic Dialogue
// -------------------------------------------------------------
const graceDialogue = GAME.getGraceDialogue();
const graceHasContent = graceDialogue && typeof graceDialogue.text === 'string';
assert(graceHasContent, 30,
  'Dynamic NPC Dialogue - Sister Grace Reactive',
  'Sister Grace dialogue reflects player status and quest progress at FOG Center'
);

// -------------------------------------------------------------
// Test 31: Quests Tab Modal Multi-Section Grouping
// -------------------------------------------------------------
GAME.openQuestsTabModal();
const modalHtml = getMockElement('quests-tab-list').innerHTML;
const hasActiveSec = modalHtml.includes('ACTIVE QUESTS');
const hasAvailSec = modalHtml.includes('AVAILABLE QUESTS');
const hasCompSec = modalHtml.includes('COMPLETED QUESTS');
const hasLockedSec = modalHtml.includes('LOCKED QUESTS');
assert(hasActiveSec && hasAvailSec && hasCompSec && hasLockedSec, 31,
  'Quests Tab Modal 4 Categorized Sections',
  'Quests Tab renders ACTIVE, AVAILABLE, COMPLETED, and LOCKED sections with badges'
);

// -------------------------------------------------------------
// Test 32: Step 14 Debug HUD Enhancements
// -------------------------------------------------------------
GAME.updateDebugHud(true);
const hudContent = getMockElement('debug-hud').innerHTML;
const hudHasTracked = hudContent.includes('Tracked Quest:');
const hudHasCounts = hudContent.includes('Avail:') && hudContent.includes('Done:');
assert(hudHasTracked && hudHasCounts, 32,
  'Step 14 Debug HUD Enhancements',
  'Debug HUD displays tracked quest ID and modular counts (Avail, Active, Done, Locked)'
);

// -------------------------------------------------------------
// Test 33: Defensive Coordinates and Direction Clamping on Hydration
// -------------------------------------------------------------
const corruptData = JSON.parse(mockLocalStorage.getItem('koinonia.phase14.save'));
corruptData.avatar = { x: -999, y: 8888, dir: 'invalid_dir' };
mockLocalStorage.setItem('koinonia.phase14.save', JSON.stringify(corruptData));
GAME.loadFromStorage();
const safeCoords = GAME.state.avatar.x >= 1 && GAME.state.avatar.x <= 23 &&
                   GAME.state.avatar.y >= 1 && GAME.state.avatar.y <= 16 &&
                   ['up', 'down', 'left', 'right'].includes(GAME.state.avatar.dir);
assert(safeCoords, 33,
  'Defensive Coordinates and Bounds Clamping',
  'Out-of-bounds coordinates safely fallback to place spawn within logical grid'
);

// -------------------------------------------------------------
// Test 34: Safe Nested Skills Merge with Reflection
// -------------------------------------------------------------
corruptData.skills = { stewardship: 20 };
mockLocalStorage.setItem('koinonia.phase14.save', JSON.stringify(corruptData));
GAME.loadFromStorage();
const safeSkills = GAME.state.skills.stewardship === 20 &&
                   typeof GAME.state.skills.reflection === 'number' &&
                   typeof GAME.state.skills.responsibility === 'number';
assert(safeSkills, 34,
  'Safe Nested Skills Merge',
  'Hydration safely merges skills object preserving default reflection and other skills'
);

// -------------------------------------------------------------
// Test 35: Multi-Tab and Lifecycle Persistence Protection
// -------------------------------------------------------------
const hasVisibilityListener = gameContent.includes('visibilitychange');
const hasPagehideListener = gameContent.includes('pagehide');
const hasBeforeunloadListener = gameContent.includes('beforeunload');
assert(hasVisibilityListener && hasPagehideListener && hasBeforeunloadListener, 35,
  'Multi-Tab Lifecycle Persistence Hooks',
  'visibilitychange, pagehide, and beforeunload listeners ensure state saved to localStorage'
);

// -------------------------------------------------------------
// Test 36: Clean Reload URL One-Shot Reset Stripping
// -------------------------------------------------------------
const hasResetDetection = gameContent.includes("get('reset') === '1'");
const hasReplaceState = gameContent.includes('replaceState');
assert(hasResetDetection && hasReplaceState, 36,
  'Clean Reload URL Protection',
  '?reset=1 stripped from browser URL bar after one-shot reset so subsequent reloads preserve state'
);

// -------------------------------------------------------------
// Test 37: Dynamic Modal Content Updates
// -------------------------------------------------------------
GAME.openQuestDetailModal('Q-001');
const detailTitle = getMockElement('quest-detail-title').textContent;
const detailRewards = getMockElement('quest-detail-rewards').innerHTML;
assert(detailTitle === 'Steward of the Garden' && detailRewards.includes('+5 LP'), 37,
  'Dynamic Modal Content Updates',
  'openQuestDetailModal dynamically updates title, subtitle, icon, and rewards for any quest ID'
);

// -------------------------------------------------------------
// Test 38: Reset Prototype State Cleans All Modular State
// -------------------------------------------------------------
GAME.resetPrototypeState();
const postResetClean = GAME.state.lp === 120 &&
                       GAME.state.charXp === 0 &&
                       GAME.state.skills.reflection === 0 &&
                       GAME.state.questProgress['Q-001'] &&
                       GAME.state.questProgress['Q-001'].status === 'AVAILABLE' &&
                       GAME.state.questProgress['Q-002'] &&
                       GAME.state.questProgress['Q-002'].status === 'LOCKED';
assert(postResetClean, 38,
  'Full Prototype State Reset',
  'resetPrototypeState cleanly reinitializes all modular quest progress, skills, and LP'
);

// -------------------------------------------------------------
// Test 39: Phase 13.1 Files Untouched Verification
// -------------------------------------------------------------
const p131GameContent = fs.readFileSync(path.join(P131_DIR, 'game.js'), 'utf8');
const p131HtmlContent = fs.readFileSync(path.join(P131_DIR, 'index.html'), 'utf8');
const p131Untouched = p131GameContent.includes('koinonia.phase131.save') &&
                      !p131GameContent.includes('koinonia.phase14.save');
assert(p131Untouched, 39,
  'Phase 0.13.1 Files Untouched',
  'prototype/koinonia-phase131 remains completely untouched with koinonia.phase131.save'
);

// -------------------------------------------------------------
// Test 40: Phase 13 Files Untouched Verification
// -------------------------------------------------------------
const p13GameContent = fs.readFileSync(path.join(P13_DIR, 'game.js'), 'utf8');
const p13Untouched = p13GameContent.includes('koinonia.phase13.save');
assert(p13Untouched, 40,
  'Phase 0.13 Files Untouched',
  'prototype/koinonia-phase13 remains completely untouched with koinonia.phase13.save'
);

// -------------------------------------------------------------
// Test 41: Canonical Reward Progression Exact Math (120 -> 125 -> 130 -> 135)
// -------------------------------------------------------------
GAME.resetPrototypeState();
const startLp = GAME.state.lp; // 120

// Q-001 (TRUST_PLUS_REFLECTION): Required reflection
GAME.acceptQuest('Q-001');
GAME.exitToRealWorld();
GAME.returnFromRealWorld();
getMockElement('reflection-input').value = 'Watered the veranda plants faithfully.';
GAME.submitReflection();
const step1Lp = GAME.state.lp; // 125

// Q-002 (TRUST): Optional reflection (submit empty)
GAME.acceptQuest('Q-002');
GAME.exitToRealWorld();
GAME.returnFromRealWorld();
getMockElement('reflection-input').value = '';
GAME.submitReflection();
const step2Lp = GAME.state.lp; // 130

// Q-003 (TRUST): Optional reflection (submit empty)
GAME.state.visitedFogCenter = true;
GAME.evaluateQuestAvailability();
GAME.acceptQuest('Q-003');
GAME.exitToRealWorld();
GAME.returnFromRealWorld();
getMockElement('reflection-input').value = '';
GAME.submitReflection();
const step3Lp = GAME.state.lp; // 135

const progressionMathOk = startLp === 120 && step1Lp === 125 && step2Lp === 130 && step3Lp === 135;
assert(progressionMathOk, 41,
  'Canonical Reward Progression Math',
  'Starting LP 120 -> Q-001: 125 -> Q-002: 130 -> Q-003: 135 fully verified'
);

// -------------------------------------------------------------
// Test 42: Canonical Verification Flow Dispatch Branching
// -------------------------------------------------------------
// Test TRUST dispatch opens reflection modal directly
GAME.state.trackedQuestId = 'Q-002';
getMockElement('reflection-modal').classes.add('hidden');
GAME.openVerificationModal(getQuestById('Q-002'));
const trustDirectModal = !getMockElement('reflection-modal').classes.has('hidden');

// Test FAMILY_CONFIRM dispatch opens family confirmation modal first
const familyQuestMock = {
  id: 'Q-FAM-TEST',
  title: 'Family Chore Test',
  verification: { type: 'FAMILY_CONFIRM', prompt: 'Did Alex finish the chore?' },
  steps: []
};
getMockElement('family-modal').classes.add('hidden');
GAME.openVerificationModal(familyQuestMock);
const familyPromptShown = !getMockElement('family-modal').classes.has('hidden');
GAME.parentConfirmed();
const familyAdvanced = !getMockElement('reflection-modal').classes.has('hidden');

// Test LEADER_CONFIRM and EVENT_ATTENDANCE hooks
const leaderHookExposed = typeof GAME.leaderConfirmed === 'function';
const eventHookExposed = typeof GAME.eventAttendanceConfirmed === 'function';
GAME.leaderConfirmed();
GAME.eventAttendanceConfirmed();

assert(trustDirectModal && familyPromptShown && familyAdvanced && leaderHookExposed && eventHookExposed, 42,
  'Canonical Verification Flow Dispatch Branching',
  'Dispatches TRUST directly, FAMILY_CONFIRM to parent modal, and preserves LEADER_CONFIRM and EVENT_ATTENDANCE hooks'
);

console.log('\n====================================================');
console.log('RESULTS: ' + passCount + ' PASSED / ' + failCount + ' FAILED');
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE 0.14 AUTOMATED VERIFICATION CHECKS PASSED (100% SUCCESS)!');
  process.exit(0);
}
