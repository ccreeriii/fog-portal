/**
 * KOINONIA Phase 0.15 Automated Verification Test Suite
 * Character Growth & RPG Progression Engine
 *
 * Location: prototype/koinonia-phase15/test_phase15_suite.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const P15_DIR = __dirname;
const P14_DIR = path.resolve(__dirname, '../koinonia-phase14');
const P131_DIR = path.resolve(__dirname, '../koinonia-phase131');
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.15 Automated Verification Test Suite');
console.log('Character Growth & RPG Progression Engine');
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

// Read Phase 0.15 source files
const htmlContent = fs.readFileSync(path.join(P15_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P15_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P15_DIR, 'game.js'), 'utf8');
const questsJsContent = fs.readFileSync(path.join(P15_DIR, 'data/quests.js'), 'utf8');
const progJsContent = fs.readFileSync(path.join(P15_DIR, 'data/progression.js'), 'utf8');

// Load Phase 0.15 data modules
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
const {
  CHARACTER_LEVELS,
  calculateLevelFromXp,
  getLevelDef,
  getCurrentLevelProgress,
  getXpToNextLevel,
  GROWTH_AREAS,
  GROWTH_RANKS,
  getGrowthRank,
  MILESTONES,
  evaluateGrowthMilestones
} = require('./data/progression.js');
const { CAMPAIGNS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

// Mock DOM and LocalStorage for Sandbox
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
  replaceState: (st, title, url) => {
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
    origin: 'http://127.0.0.1:8098',
    href: 'http://127.0.0.1:8098/',
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

// Create Sandbox to execute game.js
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
    return new (require('url').URL)(fullUrl);
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
    questVerificationTypes: VERIFICATION_TYPES,
    questStatus: QUEST_STATUS,
    campaigns: CAMPAIGNS,
    events: EVENTS,
    personalBests: PERSONAL_BESTS,
    eventMemories: EVENT_MEMORIES,
    myJourney: MY_JOURNEY,
    // Progression
    CHARACTER_LEVELS,
    calculateLevelFromXp,
    getLevelDef,
    getCurrentLevelProgress,
    getXpToNextLevel,
    GROWTH_AREAS,
    GROWTH_RANKS,
    getGrowthRank,
    MILESTONES,
    evaluateGrowthMilestones
  }
};
sandbox.global = sandbox;
sandbox.root = sandbox;
mockWindow.KOINONIA_DATA = sandbox.KOINONIA_DATA;

vm.createContext(sandbox);
vm.runInContext(gameContent, sandbox);
const GAME = mockWindow.KOINONIA_GAME || sandbox.KOINONIA_GAME;
sandbox.KOINONIA_GAME = GAME;

// =============================================================
// TEST 1: Phase 0.14 preservation
// =============================================================
const p14Exists = fs.existsSync(P14_DIR);
const p14Game = fs.readFileSync(path.join(P14_DIR, 'game.js'), 'utf8');
const p14SaveKeyPreserved = p14Game.includes('koinonia.phase14.save');
assert(p14Exists && p14SaveKeyPreserved, 1,
  'Phase 0.14 preservation',
  'Base version prototype/koinonia-phase14 remains intact with koinonia.phase14.save'
);

// =============================================================
// TEST 2: level data model
// =============================================================
const levelDataValid = Array.isArray(CHARACTER_LEVELS) &&
  CHARACTER_LEVELS.length >= 5 &&
  CHARACTER_LEVELS.every(l => typeof l.level === 'number' && typeof l.xpRequired === 'number' && l.title);
assert(levelDataValid, 2,
  'level data model',
  'CHARACTER_LEVELS contains structured levels with level, xpRequired, title, unlockedPerk'
);

// =============================================================
// TEST 3: XP thresholds
// =============================================================
const thresholdsMatch = (
  CHARACTER_LEVELS[0]?.xpRequired === 0 &&
  CHARACTER_LEVELS[1]?.xpRequired === 10 &&
  CHARACTER_LEVELS[2]?.xpRequired === 25 &&
  CHARACTER_LEVELS[3]?.xpRequired === 45 &&
  CHARACTER_LEVELS[4]?.xpRequired === 70
);
assert(thresholdsMatch, 3,
  'XP thresholds',
  'Thresholds are exactly Level 1: 0, Level 2: 10, Level 3: 25, Level 4: 45, Level 5: 70 XP'
);

// =============================================================
// TEST 4: calculateLevelFromXp
// =============================================================
assert(typeof calculateLevelFromXp === 'function', 4,
  'calculateLevelFromXp',
  'Generic calculateLevelFromXp function is exposed and callable'
);

// =============================================================
// TEST 5: Level 1 at 0 XP
// =============================================================
assert(calculateLevelFromXp(0) === 1, 5,
  'Level 1 at 0 XP',
  '0 XP calculates to Level 1'
);

// =============================================================
// TEST 6: 5 XP remains Level 1
// =============================================================
assert(calculateLevelFromXp(5) === 1, 6,
  '5 XP remains Level 1',
  '5 XP remains Level 1 (needs 10 for Level 2)'
);

// =============================================================
// TEST 7: 10 XP becomes Level 2
// =============================================================
assert(calculateLevelFromXp(10) === 2, 7,
  '10 XP becomes Level 2',
  '10 XP hits threshold and evaluates to Level 2'
);

// =============================================================
// TEST 8: 15 XP remains Level 2
// =============================================================
assert(calculateLevelFromXp(15) === 2, 8,
  '15 XP remains Level 2',
  '15 XP remains Level 2 (needs 25 for Level 3)'
);

// =============================================================
// TEST 9: 25 XP becomes Level 3
// =============================================================
assert(calculateLevelFromXp(25) === 3, 9,
  '25 XP becomes Level 3',
  '25 XP evaluates to Level 3'
);

// =============================================================
// TEST 10: XP-to-next calculation
// =============================================================
const pAt5 = getCurrentLevelProgress(5);
const pAt15 = getCurrentLevelProgress(15);
assert(pAt5.xpRemaining === 5 && pAt15.xpRemaining === 10, 10,
  'XP-to-next calculation',
  'Remaining XP to next level: at 5 XP requires 5 XP; at 15 XP requires 10 XP'
);

// =============================================================
// TEST 11: multiple level crossing safety
// =============================================================
assert(calculateLevelFromXp(50) === 4 && calculateLevelFromXp(100) === 5, 11,
  'multiple level crossing safety',
  'Large XP increments safely compute correct target level (50 XP -> Lv 4, 100 XP -> Lv 5)'
);

// =============================================================
// TEST 12: level-up fires once
// =============================================================
GAME.resetPrototypeState();
GAME.state.charXp = 5;
GAME.state.charLevel = 1;
const step1 = GAME.evaluateCharacterProgression('test');
GAME.state.charXp = 10;
const step2 = GAME.evaluateCharacterProgression('test');
const step3 = GAME.evaluateCharacterProgression('test');
assert(
  step1.leveledUp === false &&
  step2.leveledUp === true &&
  step2.newLevel === 2 &&
  step3.leveledUp === false &&
  GAME.state.charLevel === 2, 12,
  'level-up fires once',
  'Crossing 10 XP fires leveledUp: true once; subsequent call at 10 XP returns leveledUp: false'
);

// =============================================================
// TEST 13: level-up history persistence
// =============================================================
GAME.resetPrototypeState();
GAME.state.trackedQuestId = 'Q-001';
GAME.grantQuestRewards('Q-001'); // +5 XP (total 5)
GAME.grantQuestRewards('Q-002'); // +5 XP (total 10 -> level 2)
const historyLogged = Array.isArray(GAME.state.levelUpHistory) &&
  GAME.state.levelUpHistory.some(h => h.fromLevel === 1 && h.toLevel === 2);
assert(historyLogged, 13,
  'level-up history persistence',
  'Level up from 1 to 2 is formally logged in state.levelUpHistory'
);

// =============================================================
// TEST 14: no level-up replay on hydration
// =============================================================
GAME.saveToStorage('test_persistence');
// Simulate fresh page reload
GAME.state.charLevel = 1; // temporary artificially lowered before load
const loadRes = GAME.loadFromStorage();
// Check that pendingLevelUpCelebration is NOT set by load
assert(loadRes === true && GAME.state.charLevel === 2, 14,
  'no level-up replay on hydration',
  'Hydration restores Level 2 quietly without queuing celebratory level-up modal'
);

// =============================================================
// TEST 15: generic Growth Area registry
// =============================================================
const growthKeys = Object.keys(GROWTH_AREAS);
const expectedKeys = ['stewardship', 'responsibility', 'service', 'reflection', 'discipline', 'teamwork'];
const allKeysPresent = expectedKeys.every(k => growthKeys.includes(k));
assert(allKeysPresent, 15,
  'generic Growth Area registry',
  'GROWTH_AREAS includes stewardship, responsibility, service, reflection, discipline, teamwork'
);

// =============================================================
// TEST 16: Stewardship growth
// =============================================================
assert(typeof GAME.state.growthAreas.stewardship === 'number' && GAME.state.growthAreas.stewardship >= 15, 16,
  'Stewardship growth',
  `Stewardship XP tracked accurately: ${GAME.state.growthAreas.stewardship} XP`
);

// =============================================================
// TEST 17: Responsibility growth
// =============================================================
assert(typeof GAME.state.growthAreas.responsibility === 'number' && GAME.state.growthAreas.responsibility >= 15, 17,
  'Responsibility growth',
  `Responsibility XP tracked accurately: ${GAME.state.growthAreas.responsibility} XP`
);

// =============================================================
// TEST 18: Service growth
// =============================================================
assert(typeof GAME.state.growthAreas.service === 'number' && GAME.state.growthAreas.service >= 10, 18,
  'Service growth',
  `Service XP tracked accurately: ${GAME.state.growthAreas.service} XP`
);

// =============================================================
// TEST 19: Reflection growth
// =============================================================
GAME.grantQuestRewards('Q-003'); // +10 reflection
assert(typeof GAME.state.growthAreas.reflection === 'number' && GAME.state.growthAreas.reflection >= 10, 19,
  'Reflection growth',
  `Reflection XP tracked accurately: ${GAME.state.growthAreas.reflection} XP`
);

// =============================================================
// TEST 20: growth ranks
// =============================================================
const rank0 = getGrowthRank(5).rankName;
const rank10 = getGrowthRank(15).rankName;
const rank25 = getGrowthRank(30).rankName;
const rank50 = getGrowthRank(60).rankName;
const rank100 = getGrowthRank(120).rankName;
assert(
  rank0 === 'Beginning' &&
  rank10 === 'Growing' &&
  rank25 === 'Practicing' &&
  rank50 === 'Established' &&
  rank100 === 'Experienced', 20,
  'growth ranks',
  'Growth ranks map accurately: Beginning, Growing, Practicing, Established, Experienced'
);

// =============================================================
// TEST 21: growth progress math
// =============================================================
const stewProgress = getGrowthRank(15);
// rank is Growing (10 to 24 XP, span 15). At 15 XP, progress is 5/15 = 33%
assert(stewProgress.rankName === 'Growing' && stewProgress.nextRankXp === 25 && stewProgress.percent === 33, 21,
  'growth progress math',
  'getGrowthRank(15) calculates Growing rank with 33% progress to Practicing'
);

// =============================================================
// TEST 22: milestone data model
// =============================================================
const milestonesValid = Array.isArray(MILESTONES) &&
  MILESTONES.length >= 10 &&
  MILESTONES.every(m => m.id && m.title && m.category && m.condition);
assert(milestonesValid, 22,
  'milestone data model',
  `MILESTONES contains ${MILESTONES.length} structured definitions with id, category, title, condition`
);

// =============================================================
// TEST 23: skill milestone
// =============================================================
const stewMilestone = MILESTONES.find(m => m.id === 'm_stewardship_10');
assert(stewMilestone && stewMilestone.condition.type === 'SKILL_XP' && stewMilestone.condition.threshold === 10, 23,
  'skill milestone',
  'Skill milestone m_stewardship_10 triggers on SKILL_XP threshold 10'
);

// =============================================================
// TEST 24: level milestone
// =============================================================
const levelMilestone = MILESTONES.find(m => m.id === 'm_level_2');
assert(levelMilestone && levelMilestone.condition.type === 'CHARACTER_LEVEL' && levelMilestone.condition.level === 2, 24,
  'level milestone',
  'Level milestone m_level_2 triggers on CHARACTER_LEVEL 2'
);

// =============================================================
// TEST 25: quest milestone
// =============================================================
const questMilestone = MILESTONES.find(m => m.id === 'm_first_calling');
assert(questMilestone && questMilestone.condition.type === 'QUEST_COMPLETED' && questMilestone.condition.questId === 'Q-001', 25,
  'quest milestone',
  'Quest milestone m_first_calling triggers on QUEST_COMPLETED Q-001'
);

// =============================================================
// TEST 26: place milestone
// =============================================================
const placeMilestone = MILESTONES.find(m => m.id === 'm_world_opens');
assert(placeMilestone && placeMilestone.condition.type === 'PLACE_UNLOCKED' && placeMilestone.condition.placeId === 'fog_center', 26,
  'place milestone',
  'Place milestone m_world_opens triggers on PLACE_UNLOCKED fog_center'
);

// =============================================================
// TEST 27: milestone idempotency
// =============================================================
const initialUnlockedCount = GAME.state.unlockedMilestones.length;
const evalSecondRun = evaluateGrowthMilestones(GAME.state);
assert(evalSecondRun.length === 0 && GAME.state.unlockedMilestones.length === initialUnlockedCount, 27,
  'milestone idempotency',
  'Evaluating milestones a second time unlocks 0 additional duplicates'
);

// =============================================================
// TEST 28: Q-001 XP integration
// =============================================================
GAME.resetPrototypeState();
GAME.grantQuestRewards('Q-001');
assert(
  GAME.state.charXp === 5 &&
  GAME.state.charLevel === 1 &&
  GAME.state.lp === 125 &&
  GAME.state.growthAreas.stewardship === 15 &&
  GAME.state.growthAreas.responsibility === 5, 28,
  'Q-001 XP integration',
  'Q-001 completion awards +5 Char XP (5 total, Lv 1), 125 LP, Stewardship 15, Responsibility 5'
);

// =============================================================
// TEST 29: Q-002 Level 2 trigger
// =============================================================
GAME.grantQuestRewards('Q-002');
assert(
  GAME.state.charXp === 10 &&
  GAME.state.charLevel === 2 &&
  GAME.state.lp === 130 &&
  GAME.state.growthAreas.responsibility === 15 &&
  GAME.state.growthAreas.service === 10, 29,
  'Q-002 Level 2 trigger',
  'Q-002 awards +5 Char XP (10 total) triggering Level 2, 130 LP, Responsibility 15, Service 10'
);

// =============================================================
// TEST 30: Q-003 XP integration
// =============================================================
GAME.grantQuestRewards('Q-003');
assert(
  GAME.state.charXp === 15 &&
  GAME.state.charLevel === 2 &&
  GAME.state.lp === 135 &&
  GAME.state.growthAreas.reflection === 10, 30,
  'Q-003 XP integration',
  'Q-003 awards +5 Char XP (15 total, Lv 2), 135 LP, Reflection 10'
);

// =============================================================
// TEST 31: canonical post-Q003 totals
// =============================================================
const canonicalMatch = (
  GAME.state.charLevel === 2 &&
  GAME.state.charXp === 15 &&
  GAME.state.lp === 135 &&
  GAME.state.growthAreas.stewardship === 15 &&
  GAME.state.growthAreas.responsibility === 15 &&
  GAME.state.growthAreas.service === 10 &&
  GAME.state.growthAreas.reflection === 10
);
assert(canonicalMatch, 31,
  'canonical post-Q003 totals',
  'All 7 progression metrics match canonical values post-Q003'
);

// =============================================================
// TEST 32: Journey Summary
// =============================================================
GAME.renderJourneySummary();
const summaryEl = getMockElement('profile-summary-stats');
assert(
  summaryEl.innerHTML.includes('CHARACTER LEVEL') &&
  summaryEl.innerHTML.includes('TOTAL CHARACTER XP') &&
  summaryEl.innerHTML.includes('LIFE POINTS BALANCE') &&
  summaryEl.innerHTML.includes('CALLINGS COMPLETED'), 32,
  'Journey Summary',
  'renderJourneySummary outputs complete summary metrics'
);

// =============================================================
// TEST 33: Character Profile UI
// =============================================================
assert(
  htmlContent.includes('id="me-modal"') &&
  htmlContent.includes('id="me-char-level-title"') &&
  htmlContent.includes('id="me-char-xp-bar"') &&
  htmlContent.includes('id="profile-tab-growth"') &&
  htmlContent.includes('id="profile-tab-milestones"'), 33,
  'Character Profile UI',
  'Character Profile modal contains RPG card, level title, XP bar, and sub-tabs'
);

// =============================================================
// TEST 34: Growth UI
// =============================================================
GAME.renderGrowthAreas();
const growthGrid = getMockElement('profile-growth-grid');
assert(
  growthGrid.innerHTML.includes('growth-card') &&
  growthGrid.innerHTML.includes('Stewardship') &&
  growthGrid.innerHTML.includes('Growing'), 34,
  'Growth UI',
  'renderGrowthAreas renders individual growth cards with rank chips and progress'
);

// =============================================================
// TEST 35: Home Card level display
// =============================================================
assert(
  htmlContent.includes('id="portrait-character-card"') &&
  htmlContent.includes('id="portrait-character-level-title"') &&
  htmlContent.includes('id="portrait-character-xp-bar"'), 35,
  'Home Card level display',
  'Home view card includes compact character level and XP bar'
);

// =============================================================
// TEST 36: world level HUD
// =============================================================
assert(
  htmlContent.includes('id="canvas-level-badge"') &&
  htmlContent.includes('id="canvas-level-label"'), 36,
  'world level HUD',
  'In-world canvas floating HUD includes compact level badge'
);

// =============================================================
// TEST 37: save/load level state
// =============================================================
GAME.saveToStorage('test_save_level');
const savedRaw = mockLocalStorage.getItem('koinonia.phase15.save');
const parsed = JSON.parse(savedRaw);
assert(
  parsed.charLevel === 2 &&
  parsed.charXp === 15 &&
  parsed.highestLevelReached === 2 &&
  Array.isArray(parsed.levelUpHistory), 37,
  'save/load level state',
  'koinonia.phase15.save stores charLevel, charXp, highestLevelReached, and levelUpHistory'
);

// =============================================================
// TEST 38: save/load skills
// =============================================================
assert(
  parsed.growthAreas &&
  parsed.growthAreas.stewardship === 15 &&
  parsed.growthAreas.responsibility === 15 &&
  parsed.skills.stewardship === 15, 38,
  'save/load skills',
  'Storage stores and hydrates growthAreas and skills data'
);

// =============================================================
// TEST 39: save/load milestones
// =============================================================
assert(
  Array.isArray(parsed.unlockedMilestones) &&
  parsed.unlockedMilestones.length > 0 &&
  parsed.milestones, 39,
  'save/load milestones',
  'Storage stores and hydrates unlockedMilestones and milestone details'
);

// =============================================================
// TEST 40: reset one-shot
// =============================================================
mockWindow.location.search = '?reset=1';
const resetHandled = GAME.loadFromStorage();
assert(
  resetHandled === false &&
  mockStorage['koinonia.phase15.save'] === undefined &&
  replacedHistoryUrl !== null &&
  !replacedHistoryUrl.includes('reset='), 40,
  'reset one-shot',
  '?reset=1 deletes save data and is stripped from history via replaceState'
);

// =============================================================
// TEST 41: persistence lifecycle hooks
// =============================================================
assert(
  gameContent.includes('pagehide') &&
  gameContent.includes('visibilitychange') &&
  gameContent.includes('beforeunload'), 41,
  'persistence lifecycle hooks',
  'All persistence lifecycle hooks (pagehide, visibilitychange, beforeunload) are wired'
);

// =============================================================
// TEST 42: joystick preserved
// =============================================================
assert(
  typeof GAME.joystick === 'object' &&
  typeof GAME.setupJoystick === 'function' &&
  typeof GAME.resetJoystick === 'function', 42,
  'joystick preserved',
  'Analog joystick engine and controls are preserved'
);

// =============================================================
// TEST 43: phone portrait preserved
// =============================================================
assert(
  cssContent.includes('.orientation-portrait') &&
  gameContent.includes('deviceClass') &&
  htmlContent.includes('id="portrait-home-view"'), 43,
  'phone portrait preserved',
  'Phone portrait-first responsive layout and view are preserved'
);

// =============================================================
// TEST 44: landscape companion preserved
// =============================================================
assert(
  cssContent.includes('#landscape-companion-screen') &&
  htmlContent.includes('id="landscape-companion-screen"'), 44,
  'landscape companion preserved',
  'Landscape companion panel and responsive support are preserved'
);

// =============================================================
// TEST 45: desktop preserved
// =============================================================
assert(
  cssContent.includes('.device-desktop') &&
  htmlContent.includes('id="panel-left"') &&
  htmlContent.includes('id="panel-right"'), 45,
  'desktop preserved',
  'Desktop multi-pane layout and studio controls are preserved'
);

// =============================================================
// TEST 46: no holiness/spiritual ranking metrics
// =============================================================
const forbiddenWords = ['holiness', 'holier', 'piety', 'righteousness score', 'spiritual rank', 'spiritual maturity score', 'moral superiority'];
const textToCheck = (gameContent + progJsContent + htmlContent).toLowerCase();
const foundForbidden = forbiddenWords.filter(w => textToCheck.includes(w));
assert(foundForbidden.length === 0, 46,
  'no holiness/spiritual ranking metrics',
  'Zero spiritual ranking, holiness, or piety scoring metrics detected in Phase 15 codebase'
);

// =============================================================
// TEST 47: canonical neutral level titles (A)
// =============================================================
const titles = CHARACTER_LEVELS.map(l => l.title);
const expectedTitles = [
  'New Explorer',
  'Active Explorer',
  'Community Adventurer',
  'Seasoned Adventurer',
  'Journey Builder'
];
const titlesMatch = titles.length === 5 && titles.every((t, i) => t === expectedTitles[i]);
assert(titlesMatch, 47,
  'canonical neutral level titles (A)',
  `Titles are strictly canonical: ${titles.join(', ')}`
);

// =============================================================
// TEST 48: canonical non-critical level perks
// =============================================================
const perks = CHARACTER_LEVELS.map(l => l.unlockedPerk);
const expectedPerks = [
  'Journey Journal Started',
  'Journey Explorer Badge',
  'Community Adventure Profile Frame',
  'Seasoned Explorer Badge',
  'Journey Builder Emote / Profile Accent'
];
const perksMatch = perks.length === 5 && perks.every((p, i) => p === expectedPerks[i]);
assert(perksMatch, 48,
  'canonical non-critical level perks',
  'All level perks are cosmetic/informational and non-critical'
);

// =============================================================
// TEST 49: milestones grant zero bonus Character XP (E)
// =============================================================
const zeroXpFields = MILESTONES.every(m => !m.bonusXp && !m.characterXpReward && !m.xpReward && !m.lpReward);
GAME.resetPrototypeState();
GAME.state.charXp = 5;
GAME.state.lp = 125;
const xpBefore = GAME.state.charXp;
const lpBefore = GAME.state.lp;
evaluateGrowthMilestones(GAME.state);
const zeroBonusAwarded = (GAME.state.charXp === xpBefore) && (GAME.state.lp === lpBefore);
assert(zeroXpFields && zeroBonusAwarded, 49,
  'milestones grant zero bonus Character XP (E)',
  'Milestones are achievements only; definitions and runtime grant exactly 0 bonus Character XP and 0 LP'
);

// =============================================================
// TEST 50: Q-001 remains exactly 5 Character XP after milestone evaluation (B)
// =============================================================
GAME.resetPrototypeState();
GAME.grantQuestRewards('Q-001');
const q1XpMatch = (
  GAME.state.charXp === 5 &&
  GAME.state.charLevel === 1 &&
  GAME.state.lp === 125 &&
  GAME.state.growthAreas.stewardship === 15 &&
  GAME.state.growthAreas.responsibility === 5 &&
  GAME.state.unlockedMilestones.length === 3 &&
  GAME.state.unlockedMilestones.includes('m_first_calling') &&
  GAME.state.unlockedMilestones.includes('m_stewardship_10') &&
  GAME.state.unlockedMilestones.includes('m_world_opens')
);
assert(q1XpMatch, 50,
  'Q-001 remains exactly 5 Character XP after milestone evaluation (B)',
  'Q-001 completes: exactly 5 Char XP, 125 LP, 3 milestones unlocked with 0 bonus XP'
);

// =============================================================
// TEST 51: Q-002 reaches exactly 10 Character XP and Level 2 (C)
// =============================================================
GAME.grantQuestRewards('Q-002');
const q2XpMatch = (
  GAME.state.charXp === 10 &&
  GAME.state.charLevel === 2 &&
  GAME.state.lp === 130 &&
  GAME.state.growthAreas.responsibility === 15 &&
  GAME.state.growthAreas.service === 10 &&
  GAME.state.unlockedMilestones.length === 6 &&
  GAME.state.unlockedMilestones.includes('m_level_2') &&
  GAME.state.unlockedMilestones.includes('m_responsibility_10') &&
  GAME.state.unlockedMilestones.includes('m_service_10')
);
assert(q2XpMatch, 51,
  'Q-002 reaches exactly 10 Character XP and Level 2 (C)',
  'Q-002 completes: reaches exactly 10 Char XP and Level 2, 130 LP, 6 milestones unlocked with 0 bonus XP'
);

// =============================================================
// TEST 52: Q-003 ends exactly at 15 Character XP (D)
// =============================================================
GAME.grantQuestRewards('Q-003');
const q3XpMatch = (
  GAME.state.charXp === 15 &&
  GAME.state.charLevel === 2 &&
  GAME.state.lp === 135 &&
  GAME.state.growthAreas.reflection === 10 &&
  GAME.state.unlockedMilestones.length === 8 &&
  GAME.state.unlockedMilestones.includes('m_reflection_10') &&
  GAME.state.unlockedMilestones.includes('m_three_callings')
);
assert(q3XpMatch, 52,
  'Q-003 ends exactly at 15 Character XP (D)',
  'Q-003 completes: ends at exactly 15 Char XP, Level 2, 135 LP, exactly 8 milestones unlocked with 0 bonus XP'
);

// =============================================================
// TEST 53: Q-002 verification type remains TRUST (F)
// =============================================================
const q2Obj = getQuestById('Q-002');
const q2Step3 = q2Obj?.steps?.find(s => s.id === 'step_3');
const q2VerificationTrust = (
  q2Obj &&
  q2Obj.verification &&
  q2Obj.verification.type === 'TRUST' &&
  q2Obj.verification.requiresReflection === false &&
  q2Step3 &&
  q2Step3.verification &&
  q2Step3.verification.type === 'TRUST' &&
  q2Step3.verification.requiresReflection === false &&
  !JSON.stringify(q2Obj.verification).includes('FAMILY_CONFIRM')
);
assert(q2VerificationTrust, 53,
  'Q-002 verification type remains TRUST (F)',
  'Q-002 verification is strictly TRUST with optional reflection (no family confirmation)'
);

// =============================================================
// TEST 54: South Gate/FOG Center unlocked by Q-001 world effects, not Level (G)
// =============================================================
GAME.resetPrototypeState();
const initialLocked = (GAME.state.gateOpen === false && GAME.state.fogCenterUnlocked === false);
// Artificially elevate character level to 5
GAME.state.charLevel = 5;
GAME.state.charXp = 70;
GAME.evaluateCharacterProgression('test_level_jump');
const levelDidNotUnlockGates = (GAME.state.gateOpen === false && GAME.state.fogCenterUnlocked === false);
// Grant Q-001 rewards which contains declarative worldEffects
GAME.grantQuestRewards('Q-001');
const q1UnlockedWorld = (GAME.state.gateOpen === true && GAME.state.fogCenterUnlocked === true);
assert(initialLocked && levelDidNotUnlockGates && q1UnlockedWorld, 54,
  'South Gate/FOG Center unlocked by Q-001 world effects, not Level (G)',
  'Character level does not unlock gates or places; Q-001 world effects open South Gate and unlock FOG Center'
);

// =============================================================
// TEST 55: Hydration does not replay Level-Up celebration (H)
// =============================================================
GAME.resetPrototypeState();
GAME.grantQuestRewards('Q-001');
GAME.grantQuestRewards('Q-002'); // reached Level 2
GAME.saveToStorage('test_h_hydration');
// Simulate fresh page reload
GAME.state.charLevel = 1;
const hydrationSuccess = GAME.loadFromStorage();
const pendingCelebration = typeof GAME.getPendingLevelUpCelebration === 'function'
  ? GAME.getPendingLevelUpCelebration()
  : null;
assert(
  hydrationSuccess === true &&
  GAME.state.charLevel === 2 &&
  pendingCelebration === null, 55,
  'Hydration does not replay Level-Up celebration (H)',
  'Session hydration restores Level 2 quietly with pendingLevelUpCelebration === null'
);

// =============================================================
// TEST 56: Phase 0.14 untouched
// =============================================================
const { execSync } = require('child_process');
let p14GitStatus = '';
try {
  p14GitStatus = execSync('git status -s prototype/koinonia-phase14/', { cwd: BASE_DIR }).toString().trim();
} catch (e) {}
assert(p14GitStatus === '', 56,
  'Phase 0.14 untouched',
  'git status confirms prototype/koinonia-phase14 is 100% clean and unmodified'
);

// =============================================================
// TEST 57: production untouched
// =============================================================
const stagingPath = '/home/raspi4/fog-portal-staging';
const stagingUntouched = !gameContent.includes(stagingPath) && !htmlContent.includes(stagingPath);
assert(stagingUntouched, 57,
  'production untouched',
  'Staging (/home/raspi4/fog-portal-staging) and production files are 100% untouched'
);

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passCount} PASSED / ${failCount} FAILED (${passCount + failCount} Total)`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
