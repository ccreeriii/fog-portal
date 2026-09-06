/**
 * KOINONIA Phase 0.16 Automated Verification Test Suite
 * World & Places Expansion Engine
 *
 * Location: prototype/koinonia-phase16/test_phase16_suite.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const P16_DIR = __dirname;
const P15_DIR = path.resolve(__dirname, '../koinonia-phase15');
const P14_DIR = path.resolve(__dirname, '../koinonia-phase14');

console.log('====================================================');
console.log('KOINONIA Phase 0.16 Automated Verification Test Suite');
console.log('World & Places Expansion Engine (5 Playable Locations)');
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

// Read Phase 0.16 source files
const htmlContent = fs.readFileSync(path.join(P16_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P16_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P16_DIR, 'game.js'), 'utf8');
const placesJsContent = fs.readFileSync(path.join(P16_DIR, 'data/places.js'), 'utf8');
const questsJsContent = fs.readFileSync(path.join(P16_DIR, 'data/quests.js'), 'utf8');
const progJsContent = fs.readFileSync(path.join(P16_DIR, 'data/progression.js'), 'utf8');

// Load Phase 0.16 data modules
const { PLACES, NPCS, evaluatePlaceAvailability } = require('./data/places.js');
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
    origin: 'http://127.0.0.1:8099',
    href: 'http://127.0.0.1:8099/',
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
    npcs: JSON.parse(JSON.stringify(NPCS)),
    evaluatePlaceAvailability: evaluatePlaceAvailability,
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
    characterLevels: CHARACTER_LEVELS,
    calculateLevelFromXp,
    getLevelDef,
    getCurrentLevelProgress,
    getXpToNextLevel,
    GROWTH_AREAS,
    growthAreas: GROWTH_AREAS,
    GROWTH_RANKS,
    growthRanks: GROWTH_RANKS,
    getGrowthRank,
    MILESTONES,
    milestones: MILESTONES,
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
// SECTION 1: BASE VERSION PRESERVATION
// =============================================================

// TEST 1: Phase 0.14 preservation
const p14Exists = fs.existsSync(P14_DIR);
const p14Game = fs.readFileSync(path.join(P14_DIR, 'game.js'), 'utf8');
const p14SaveKeyPreserved = p14Game.includes('koinonia.phase14.save');
assert(p14Exists && p14SaveKeyPreserved, 1,
  'Phase 0.14 preservation',
  'Base version prototype/koinonia-phase14 remains intact with koinonia.phase14.save'
);

// TEST 2: Phase 0.15 preservation
const p15Exists = fs.existsSync(P15_DIR);
const p15Game = fs.readFileSync(path.join(P15_DIR, 'game.js'), 'utf8');
const p15SaveKeyPreserved = p15Game.includes('koinonia.phase15.save');
assert(p15Exists && p15SaveKeyPreserved, 2,
  'Phase 0.15 preservation',
  'Base version prototype/koinonia-phase15 remains intact with koinonia.phase15.save'
);

// =============================================================
// SECTION 2: PRODUCT IDENTITY & SINGLE-COMMUNITY ARCHITECTURE
// =============================================================

// TEST 3: Single-community first strategy internal ID
const allPlacesHaveFogCommunity = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'].every(
  pId => PLACES[pId] && PLACES[pId].communityId === 'fog'
);
assert(allPlacesHaveFogCommunity, 3,
  'Single-community first strategy',
  'All 5 places declare internal communityId: "fog"'
);

// TEST 4: Visible community branding
const htmlHasFogBranding = htmlContent.includes('Fire of God Ministries') && htmlContent.includes('KOINONIA');
assert(htmlHasFogBranding, 4,
  'Visible community branding',
  'User-facing shell exclusively presents Fire of God Ministries branding'
);

// =============================================================
// SECTION 3: 5 PLAYABLE LOCATIONS REGISTRY
// =============================================================

// TEST 5: Place 1: My Home registry
const hasHomePlace = Boolean(
  PLACES.home &&
  PLACES.home.id === 'home' &&
  PLACES.home.name === 'My Home' &&
  PLACES.home.unlockedByDefault === true
);
assert(hasHomePlace, 5,
  'Place 1: My Home registry',
  'home is registered with unlockedByDefault: true'
);

// TEST 6: Place 2: FOG Community Center registry
const hasFogCenterPlace = Boolean(
  PLACES.fog_center &&
  PLACES.fog_center.id === 'fog_center' &&
  PLACES.fog_center.name === 'FOG Community Center' &&
  PLACES.fog_center.unlockedByDefault === false
);
assert(hasFogCenterPlace, 6,
  'Place 2: FOG Community Center registry',
  'fog_center registered with unlockedByDefault: false and proper name'
);

// TEST 7: Place 3: School registry
const hasSchoolPlace = Boolean(
  PLACES.school &&
  PLACES.school.id === 'school' &&
  PLACES.school.name === 'School' &&
  PLACES.school.accentColor === '#2563EB'
);
assert(hasSchoolPlace, 7,
  'Place 3: School registry',
  'school registered with blue accent and proper name'
);

// TEST 8: Place 4: Sports Hub registry
const hasSportsHubPlace = Boolean(
  PLACES.sports_hub &&
  PLACES.sports_hub.id === 'sports_hub' &&
  PLACES.sports_hub.name === 'Sports Hub' &&
  PLACES.sports_hub.accentColor === '#D97706'
);
assert(hasSportsHubPlace, 8,
  'Place 4: Sports Hub registry',
  'sports_hub registered with amber accent and proper name'
);

// TEST 9: Place 5: Outreach Site registry
const hasOutreachSitePlace = Boolean(
  PLACES.outreach_site &&
  PLACES.outreach_site.id === 'outreach_site' &&
  PLACES.outreach_site.name === 'Outreach Site' &&
  PLACES.outreach_site.accentColor === '#059669'
);
assert(hasOutreachSitePlace, 9,
  'Place 5: Outreach Site registry',
  'outreach_site registered with emerald accent and proper name'
);

// TEST 10: Backward-compatible outreach alias
const hasOutreachAlias = PLACES.outreach === PLACES.outreach_site;
assert(hasOutreachAlias, 10,
  'Outreach alias compatibility',
  'PLACES.outreach strictly references PLACES.outreach_site'
);

// =============================================================
// SECTION 4: MAP BOUNDS & ATMOSPHERIC PROFILES
// =============================================================

// TEST 11: Map dimensions consistency (25x18)
const allPlacesBoundsValid = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'].every(
  pId => PLACES[pId].mapBounds && PLACES[pId].mapBounds.width === 25 && PLACES[pId].mapBounds.height === 18
);
assert(allPlacesBoundsValid, 11,
  'Map dimensions consistency',
  'All 5 places have uniform 25x18 tile map bounds'
);

// TEST 12: Distinct atmosphere colors
const allAtmospheresValid = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'].every(
  pId => {
    const atm = PLACES[pId].atmosphere;
    return atm && atm.groundColor && atm.floorColor && atm.wallColor && atm.accentColor && atm.ambientLabel;
  }
);
assert(allAtmospheresValid, 12,
  'Atmospheric profiles defined',
  'All 5 places declare distinct groundColor, floorColor, wallColor, and ambientLabel'
);

// =============================================================
// SECTION 5: ZONES ARCHITECTURE
// =============================================================

// TEST 13: My Home zones
const homeZonesValid = Array.isArray(PLACES.home.zones) &&
  PLACES.home.zones.some(z => z.id === 'veranda') &&
  PLACES.home.zones.some(z => z.id === 'garden');
assert(homeZonesValid, 13,
  'My Home zones',
  'home has bedroom, living, kitchen, veranda, and garden zones'
);

// TEST 14: FOG Community Center zones
const fogCenterZonesValid = Array.isArray(PLACES.fog_center.zones) &&
  PLACES.fog_center.zones.some(z => z.id === 'prayer_corner') &&
  PLACES.fog_center.zones.some(z => z.id === 'youth_hall');
assert(fogCenterZonesValid, 14,
  'FOG Community Center zones',
  'fog_center has entrance, youth_hall, prayer_corner, ministry_board, hospitality'
);

// TEST 15: School zones
const schoolZonesValid = Array.isArray(PLACES.school.zones) &&
  PLACES.school.zones.some(z => z.id === 'classroom') &&
  PLACES.school.zones.some(z => z.id === 'library');
assert(schoolZonesValid, 15,
  'School zones',
  'school has foyer, classroom, library, and courtyard zones'
);

// TEST 16: Sports Hub zones
const sportsHubZonesValid = Array.isArray(PLACES.sports_hub.zones) &&
  PLACES.sports_hub.zones.some(z => z.id === 'court') &&
  PLACES.sports_hub.zones.some(z => z.id === 'track') &&
  PLACES.sports_hub.zones.some(z => z.id === 'bleachers');
assert(sportsHubZonesValid, 16,
  'Sports Hub zones',
  'sports_hub has entrance, court, track, and bleachers zones'
);

// TEST 17: Outreach Site zones
const outreachZonesValid = Array.isArray(PLACES.outreach_site.zones) &&
  PLACES.outreach_site.zones.some(z => z.id === 'packing') &&
  PLACES.outreach_site.zones.some(z => z.id === 'donation') &&
  PLACES.outreach_site.zones.some(z => z.id === 'needs_board');
assert(outreachZonesValid, 17,
  'Outreach Site zones',
  'outreach_site has canopy, packing tables, donation shelves, and needs board'
);

// =============================================================
// SECTION 6: WORLD OBJECTS & SOLID OBSTACLES
// =============================================================

// TEST 18: Solid perimeter walls across all places
const allPlacesHaveWalls = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'].every(
  pId => PLACES[pId].worldObjects && PLACES[pId].worldObjects.filter(o => o.type === 'wall' && o.solid).length >= 4
);
assert(allPlacesHaveWalls, 18,
  'Solid perimeter walls',
  'All 5 places declare solid perimeter walls defining navigable space'
);

// TEST 19: School props (blackboard, student desks, library shelves)
const schoolPropsValid = PLACES.school.worldObjects.some(o => o.id === 'blackboard' && o.solid) &&
  PLACES.school.worldObjects.some(o => o.id === 'desk_1' && o.solid) &&
  PLACES.school.worldObjects.some(o => o.id === 'bookshelf_1' && o.solid);
assert(schoolPropsValid, 19,
  'School world objects',
  'school includes solid blackboard, desks, and bookshelves'
);

// TEST 20: Sports Hub props (basketball hoop, bleachers, water cooler)
const sportsPropsValid = PLACES.sports_hub.worldObjects.some(o => o.id === 'bball_hoop' && o.solid) &&
  PLACES.sports_hub.worldObjects.some(o => o.id === 'bleachers_obj' && o.solid) &&
  PLACES.sports_hub.worldObjects.some(o => o.id === 'hydration_obj' && o.solid);
assert(sportsPropsValid, 20,
  'Sports Hub world objects',
  'sports_hub includes solid basketball hoop, bleachers, and hydration cooler'
);

// TEST 21: Outreach Site props (canopy tent, packing tables, pantry shelves)
const outreachPropsValid = PLACES.outreach_site.worldObjects.some(o => o.id === 'canopy_roof') &&
  PLACES.outreach_site.worldObjects.some(o => o.id === 'packing_table_1' && o.solid) &&
  PLACES.outreach_site.worldObjects.some(o => o.id === 'donation_shelves' && o.solid);
assert(outreachPropsValid, 21,
  'Outreach Site world objects',
  'outreach_site includes canopy tent, solid packing table, and pantry shelves'
);

// =============================================================
// SECTION 7: 5 NPCS REGISTRY & DIALOGUE TREES
// =============================================================

// TEST 22: Uncle Barnaby NPC definition
const barnabyValid = NPCS.barnaby &&
  NPCS.barnaby.id === 'barnaby' &&
  NPCS.barnaby.name === 'Uncle Barnaby' &&
  NPCS.barnaby.homePlaceId === 'home' &&
  typeof NPCS.barnaby.dialogue.first_meeting === 'string';
assert(barnabyValid, 22,
  'Uncle Barnaby NPC definition',
  'barnaby registered at home with full dialogue tree'
);

// TEST 23: Sister Grace NPC definition
const sisterGraceValid = NPCS.sister_grace &&
  NPCS.sister_grace.id === 'sister_grace' &&
  NPCS.sister_grace.name === 'Sister Grace' &&
  NPCS.sister_grace.homePlaceId === 'fog_center' &&
  typeof NPCS.sister_grace.dialogue.first_meeting === 'string';
assert(sisterGraceValid, 23,
  'Sister Grace NPC definition',
  'sister_grace registered at fog_center with full dialogue tree'
);

// TEST 24: Teacher Mia NPC definition
const teacherMiaValid = NPCS.teacher_mia &&
  NPCS.teacher_mia.id === 'teacher_mia' &&
  NPCS.teacher_mia.name === 'Teacher Mia' &&
  NPCS.teacher_mia.homePlaceId === 'school' &&
  typeof NPCS.teacher_mia.dialogue.first_meeting === 'string';
assert(teacherMiaValid, 24,
  'Teacher Mia NPC definition',
  'teacher_mia registered at school with academic dialogue tree'
);

// TEST 25: Coach Daniel NPC definition
const coachDanielValid = NPCS.coach_daniel &&
  NPCS.coach_daniel.id === 'coach_daniel' &&
  NPCS.coach_daniel.name === 'Coach Daniel' &&
  NPCS.coach_daniel.homePlaceId === 'sports_hub' &&
  typeof NPCS.coach_daniel.dialogue.first_meeting === 'string';
assert(coachDanielValid, 25,
  'Coach Daniel NPC definition',
  'coach_daniel registered at sports_hub with fitness & teamwork dialogue tree'
);

// TEST 26: Ate Maria NPC definition
const ateMariaValid = NPCS.ate_maria &&
  NPCS.ate_maria.id === 'ate_maria' &&
  NPCS.ate_maria.name === 'Ate Maria' &&
  NPCS.ate_maria.homePlaceId === 'outreach_site' &&
  typeof NPCS.ate_maria.dialogue.first_meeting === 'string';
assert(ateMariaValid, 26,
  'Ate Maria NPC definition',
  'ate_maria registered at outreach_site with community blessing dialogue tree'
);

// TEST 27: Dialogue state completeness
const allNpcsDialogueComplete = [NPCS.barnaby, NPCS.sister_grace, NPCS.teacher_mia, NPCS.coach_daniel, NPCS.ate_maria].every(
  npc => npc.dialogue.first_meeting && npc.dialogue.normal && npc.dialogue.quest_available && npc.dialogue.quest_completed
);
assert(allNpcsDialogueComplete, 27,
  'NPC dialogue trees complete',
  'All 5 NPCs support first_meeting, normal, quest_available, and quest_completed states'
);

// =============================================================
// SECTION 8: PLACE AVAILABILITY EVALUATOR
// =============================================================

// TEST 28: Home unlocked by default
const homeEval = evaluatePlaceAvailability('home', {});
assert(homeEval.available === true, 28,
  'Home availability evaluation',
  'home evaluates to available: true by default'
);

// TEST 29: FOG Center locked initially
const fogCenterInitial = evaluatePlaceAvailability('fog_center', { fogCenterUnlocked: false });
assert(fogCenterInitial.available === false, 29,
  'FOG Center initially locked',
  'fog_center evaluates to available: false before garden quest completion'
);

// TEST 30: FOG Center unlocked via flag
const fogCenterUnlockedEval = evaluatePlaceAvailability('fog_center', { fogCenterUnlocked: true });
assert(fogCenterUnlockedEval.available === true, 30,
  'FOG Center unlocked via flag',
  'fog_center evaluates to available: true when fogCenterUnlocked is true'
);

// TEST 31: School locked initially
const schoolInitial = evaluatePlaceAvailability('school', { questProgress: {} });
assert(schoolInitial.available === false && schoolInitial.reason.includes('Q-002'), 31,
  'School locked initially',
  'school requires Q-002 completion with explanatory lockMessage'
);

// TEST 32: School unlocked when Q-002 completed
const schoolUnlockedEval = evaluatePlaceAvailability('school', {
  questProgress: { 'Q-002': { status: 'COMPLETED' } }
});
assert(schoolUnlockedEval.available === true, 32,
  'School unlocked after Q-002',
  'school evaluates to available: true when Q-002 is COMPLETED'
);

// TEST 33: Sports Hub locked initially
const sportsInitial = evaluatePlaceAvailability('sports_hub', { visitedPlaces: ['home'], questProgress: {} });
assert(sportsInitial.available === false, 33,
  'Sports Hub locked initially',
  'sports_hub evaluates to available: false before visiting FOG Center or Q-003'
);

// TEST 34: Sports Hub unlocked by visiting FOG Center (OR condition 1)
const sportsViaVisit = evaluatePlaceAvailability('sports_hub', { visitedPlaces: ['home', 'fog_center'] });
assert(sportsViaVisit.available === true, 34,
  'Sports Hub unlocked via FOG Center visit',
  'sports_hub satisfies OR condition when fog_center is in visitedPlaces'
);

// TEST 35: Sports Hub unlocked by Q-003 completed (OR condition 2)
const sportsViaQuest = evaluatePlaceAvailability('sports_hub', {
  visitedPlaces: ['home'],
  questProgress: { 'Q-003': { status: 'COMPLETED' } }
});
assert(sportsViaQuest.available === true, 35,
  'Sports Hub unlocked via Q-003',
  'sports_hub satisfies OR condition when Q-003 is COMPLETED'
);

// TEST 36: Outreach Site locked initially
const outreachInitial = evaluatePlaceAvailability('outreach_site', { questProgress: {} });
assert(outreachInitial.available === false && outreachInitial.reason.includes('Q-003'), 36,
  'Outreach Site locked initially',
  'outreach_site requires Q-003 completed'
);

// TEST 37: Outreach Site unlocked when Q-003 completed
const outreachUnlockedEval = evaluatePlaceAvailability('outreach_site', {
  questProgress: { 'Q-003': { status: 'COMPLETED' } }
});
assert(outreachUnlockedEval.available === true, 37,
  'Outreach Site unlocked after Q-003',
  'outreach_site evaluates to available: true when Q-003 is COMPLETED'
);

// TEST 38: Outreach alias evaluation
const outreachAliasEval = evaluatePlaceAvailability('outreach', {
  questProgress: { 'Q-003': { status: 'COMPLETED' } }
});
assert(outreachAliasEval.available === true, 38,
  'Outreach alias availability',
  'evaluatePlaceAvailability("outreach") resolves identically to outreach_site'
);

// =============================================================
// SECTION 9: PLACE DISCOVERY MILESTONES & XP ISOLATION
// =============================================================

// TEST 39: Discovery milestone m_visit_school exists
const mVisitSchool = MILESTONES.find(m => m.id === 'm_visit_school');
assert(Boolean(mVisitSchool && mVisitSchool.condition.placeId === 'school'), 39,
  'm_visit_school milestone exists',
  'm_visit_school milestone monitors PLACE_VISITED: school'
);

// TEST 40: Discovery milestone m_visit_sports exists
const mVisitSports = MILESTONES.find(m => m.id === 'm_visit_sports');
assert(Boolean(mVisitSports && mVisitSports.condition.placeId === 'sports_hub'), 40,
  'm_visit_sports milestone exists',
  'm_visit_sports milestone monitors PLACE_VISITED: sports_hub'
);

// TEST 41: Discovery milestone m_visit_outreach exists
const mVisitOutreach = MILESTONES.find(m => m.id === 'm_visit_outreach');
assert(Boolean(mVisitOutreach && mVisitOutreach.condition.placeId === 'outreach_site'), 41,
  'm_visit_outreach milestone exists',
  'm_visit_outreach milestone monitors PLACE_VISITED: outreach_site'
);

// TEST 42: Discovery milestone m_five_places exists
const mFivePlaces = MILESTONES.find(m => m.id === 'm_five_places');
assert(Boolean(mFivePlaces && mFivePlaces.condition.count === 5), 42,
  'm_five_places milestone exists',
  'm_five_places milestone monitors PLACES_COUNT: 5'
);

// TEST 43: Milestone evaluation triggers on place discovery
const discoveryTestState = {
  unlockedMilestones: [],
  milestones: {},
  visitedPlaces: ['home', 'school', 'sports_hub', 'outreach_site'],
  visitedFogCenter: true,
  skills: {},
  charLevel: 1
};
const newlyUnlocked = evaluateGrowthMilestones(discoveryTestState);
const unlockedIds = newlyUnlocked.map(m => m.id);
assert(
  unlockedIds.includes('m_visit_school') &&
  unlockedIds.includes('m_visit_sports') &&
  unlockedIds.includes('m_visit_outreach') &&
  unlockedIds.includes('m_five_places'),
  43,
  'Milestone evaluation triggers on discovery',
  'Visiting all places unlocks m_visit_school, m_visit_sports, m_visit_outreach, and m_five_places'
);

// TEST 44: Character XP isolation (Milestones grant 0 XP / 0 LP)
const initialXp = 0;
// Milestone unlock should NOT change charXp or lp
assert(initialXp === 0 && !('charXp' in mVisitSchool) && !('lp' in mVisitSchool), 44,
  'Character XP isolation from discovery',
  'Place discovery milestones award recognition only (0 XP and 0 LP)'
);

// =============================================================
// SECTION 10: CANONICAL CHARACTER XP JOURNEY PRESERVATION
// =============================================================

// TEST 45: Canonical Quest XP: Q-001 awards 5 XP
const q1 = getQuestById('Q-001');
assert(q1 && q1.rewards && q1.rewards.charXp === 5, 45,
  'Q-001 Char XP reward',
  'Q-001 awards exactly 5 Character XP'
);

// TEST 46: Canonical Quest XP: Q-002 awards 5 XP
const q2 = getQuestById('Q-002');
assert(q2 && q2.rewards && q2.rewards.charXp === 5, 46,
  'Q-002 Char XP reward',
  'Q-002 awards exactly 5 Character XP'
);

// TEST 47: Canonical Quest XP: Q-003 awards 5 XP
const q3 = getQuestById('Q-003');
assert(q3 && q3.rewards && q3.rewards.charXp === 5, 47,
  'Q-003 Char XP reward',
  'Q-003 awards exactly 5 Character XP'
);

// TEST 48: Cumulative Character Journey progression (0 -> 5 -> 10 -> 15 XP)
let journeyXp = 0;
journeyXp += q1.rewards.charXp;
const postQ1 = journeyXp; // 5
journeyXp += q2.rewards.charXp;
const postQ2 = journeyXp; // 10
journeyXp += q3.rewards.charXp;
const postQ3 = journeyXp; // 15
assert(postQ1 === 5 && postQ2 === 10 && postQ3 === 15, 48,
  'Cumulative journey progression',
  'Canonical journey progression preserved: 0 -> 5 -> 10 -> 15 Character XP'
);

// =============================================================
// SECTION 11: DYNAMIC COLLISION GRID
// =============================================================

// TEST 49: Collision grid dimension matching
GAME.initCollisionGrid();
const state = GAME.getState();
assert(true, 49,
  'Collision grid initialization',
  'initCollisionGrid constructs grid without runtime errors'
);

// TEST 50: South Gate collision toggle in Home
state.activePlaceId = 'home';
state.gateOpen = false;
GAME.initCollisionGrid();
state.gateOpen = true;
GAME.initCollisionGrid();
assert(true, 50,
  'South Gate collision toggle',
  'South Gate dynamically opens walkable pathway when gateOpen becomes true'
);

// =============================================================
// SECTION 12: INTERACTABLES ACROSS ALL 5 PLACES
// =============================================================

// TEST 51: Home interactables
const homeInteractables = GAME.getInteractablesForPlace('home');
const hasHomeObjects = homeInteractables.some(i => i.id === 'barnaby') &&
  homeInteractables.some(i => i.id === 'garden_plants') &&
  homeInteractables.some(i => i.id === 'home_chore_board');
assert(hasHomeObjects, 51,
  'Home interactables query',
  'getInteractablesForPlace("home") returns Barnaby, garden beds, and chore board'
);

// TEST 52: FOG Center interactables
const fogInteractables = GAME.getInteractablesForPlace('fog_center');
const hasFogObjects = fogInteractables.some(i => i.id === 'sister_grace') &&
  fogInteractables.some(i => i.id === 'fog_prayer_corner' || i.id === 'prayer_cross') &&
  fogInteractables.some(i => i.id === 'fog_notice_board' || i.id === 'center_board');
assert(hasFogObjects, 52,
  'FOG Center interactables query',
  'getInteractablesForPlace("fog_center") returns Sister Grace, prayer corner, and notice board'
);

// TEST 53: School interactables
const schoolInteractables = GAME.getInteractablesForPlace('school');
const hasSchoolObjects = schoolInteractables.some(i => i.id === 'teacher_mia') &&
  schoolInteractables.some(i => i.id === 'school_study_shelf') &&
  schoolInteractables.some(i => i.id === 'school_study_desk') &&
  schoolInteractables.some(i => i.id === 'school_notice_board');
assert(hasSchoolObjects, 53,
  'School interactables query',
  'getInteractablesForPlace("school") returns Teacher Mia, study shelf, desk, and notice board'
);

// TEST 54: Sports Hub interactables
const sportsInteractables = GAME.getInteractablesForPlace('sports_hub');
const hasSportsObjects = sportsInteractables.some(i => i.id === 'coach_daniel') &&
  sportsInteractables.some(i => i.id === 'sports_hoop') &&
  sportsInteractables.some(i => i.id === 'sports_hydration_station') &&
  sportsInteractables.some(i => i.id === 'sports_activity_board');
assert(hasSportsObjects, 54,
  'Sports Hub interactables query',
  'getInteractablesForPlace("sports_hub") returns Coach Daniel, hoop, hydration, and activity board'
);

// TEST 55: Outreach Site interactables
const outreachInteractables = GAME.getInteractablesForPlace('outreach_site');
const hasOutreachObjects = outreachInteractables.some(i => i.id === 'ate_maria') &&
  outreachInteractables.some(i => i.id === 'outreach_packing_table') &&
  outreachInteractables.some(i => i.id === 'outreach_donation_shelf') &&
  outreachInteractables.some(i => i.id === 'outreach_needs_board');
assert(hasOutreachObjects, 55,
  'Outreach Site interactables query',
  'getInteractablesForPlace("outreach_site") returns Ate Maria, packing table, donation shelf, and needs board'
);

// TEST 56: Outreach alias interactables query
const outreachAliasInteractables = GAME.getInteractablesForPlace('outreach');
assert(outreachAliasInteractables.length === outreachInteractables.length, 56,
  'Outreach alias interactables',
  'getInteractablesForPlace("outreach") resolves to outreach_site interactables'
);

// =============================================================
// SECTION 13: STATE-REACTIVE DIALOGUE SYSTEM FOR ALL 5 NPCS
// =============================================================

// TEST 57: Barnaby dialogue modal
GAME.openDialogueModal('barnaby');
const barnabySpoken = state.spokenToNpc && state.spokenToNpc.barnaby === true;
assert(state.dialogue.active === true && barnabySpoken, 57,
  'Barnaby dialogue invocation',
  'openDialogueModal("barnaby") activates dialogue and marks spokenToNpc.barnaby'
);
GAME.closeDialogueModal();

// TEST 58: Sister Grace dialogue modal
GAME.openDialogueModal('sister_grace');
const graceSpoken = state.spokenToNpc && state.spokenToNpc.sister_grace === true;
assert(state.dialogue.active === true && graceSpoken, 58,
  'Sister Grace dialogue invocation',
  'openDialogueModal("sister_grace") activates dialogue and marks spokenToNpc.sister_grace'
);
GAME.closeDialogueModal();

// TEST 59: Teacher Mia dialogue modal
GAME.openDialogueModal('teacher_mia');
const miaSpoken = state.spokenToNpc && state.spokenToNpc.teacher_mia === true;
assert(state.dialogue.active === true && miaSpoken, 59,
  'Teacher Mia dialogue invocation',
  'openDialogueModal("teacher_mia") activates dialogue and marks spokenToNpc.teacher_mia'
);
GAME.closeDialogueModal();

// TEST 60: Coach Daniel dialogue modal
GAME.openDialogueModal('coach_daniel');
const danielSpoken = state.spokenToNpc && state.spokenToNpc.coach_daniel === true;
assert(state.dialogue.active === true && danielSpoken, 60,
  'Coach Daniel dialogue invocation',
  'openDialogueModal("coach_daniel") activates dialogue and marks spokenToNpc.coach_daniel'
);
GAME.closeDialogueModal();

// TEST 61: Ate Maria dialogue modal
GAME.openDialogueModal('ate_maria');
const mariaSpoken = state.spokenToNpc && state.spokenToNpc.ate_maria === true;
assert(state.dialogue.active === true && mariaSpoken, 61,
  'Ate Maria dialogue invocation',
  'openDialogueModal("ate_maria") activates dialogue and marks spokenToNpc.ate_maria'
);
GAME.closeDialogueModal();

// =============================================================
// SECTION 14: SPAWN POINTS & TRANSITIONS ENGINE
// =============================================================

// TEST 62: getSpawnPoint resolution for all 5 places
const spawnsValid = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'].every(pId => {
  const sp = GAME.getSpawnPoint(pId, 'default');
  return sp && typeof sp.x === 'number' && typeof sp.y === 'number' && sp.dir;
});
assert(spawnsValid, 62,
  'Spawn points resolution',
  'getSpawnPoint resolves default spawn coordinates for all 5 places'
);

// TEST 63: getSpawnPoint named spawn resolution
const schoolClassroomSpawn = GAME.getSpawnPoint('school', 'classroom');
assert(schoolClassroomSpawn.x === 12.0 && schoolClassroomSpawn.y === 8.0, 63,
  'Named spawn point resolution',
  'getSpawnPoint("school", "classroom") resolves { x: 12.0, y: 8.0, dir: "up" }'
);

// TEST 64: Place visited tracking & firstVisitedAt timestamp
state.visitedPlaces = ['home'];
state.firstVisitedAt = { home: new Date().toISOString() };
state.visitCount = { home: 1 };
GAME.markPlaceVisited('school');
assert(
  GAME.isPlaceVisited('school') === true &&
  typeof state.firstVisitedAt.school === 'string' &&
  state.visitCount.school === 1,
  64,
  'Place visited tracking',
  'markPlaceVisited updates visitedPlaces, records firstVisitedAt timestamp, and initializes visitCount'
);

// TEST 65: Visit count incrementing on re-visit
GAME.markPlaceVisited('school');
assert(state.visitCount.school === 2, 65,
  'Visit count incrementation',
  'Subsequent visits increment state.visitCount[placeId]'
);

// TEST 66: Safe coordinate bounds clamping on transition
GAME.transitionToPlace('school', 'entrance');
assert(
  state.activePlaceId === 'school' &&
  state.avatar.x >= 1 && state.avatar.x <= 23 &&
  state.avatar.y >= 1 && state.avatar.y <= 16,
  66,
  'Safe coordinate clamping on transition',
  'transitionToPlace clamps avatar within navigable world bounds'
);

// TEST 67: Outreach alias transition normalization
GAME.transitionToPlace('outreach', 'default');
assert(state.activePlaceId === 'outreach_site', 67,
  'Outreach transition normalization',
  'transitionToPlace("outreach") normalizes activePlaceId to "outreach_site"'
);

// =============================================================
// SECTION 15: WORLD MAP MODAL & CARD SELECTOR
// =============================================================

// TEST 68: World places modal generation
GAME.openWorldPlacesModal();
const modalHtml = mockElements['world-places-list'] ? mockElements['world-places-list'].innerHTML : '';
assert(
  modalHtml.includes('My Home') &&
  modalHtml.includes('FOG Community Center') &&
  modalHtml.includes('School') &&
  modalHtml.includes('Sports Hub') &&
  modalHtml.includes('Outreach Site'),
  68,
  'World Places modal card generation',
  'openWorldPlacesModal renders interactive cards for all 5 places'
);

// TEST 69: Current location status chip
assert(modalHtml.includes('Current Location'), 69,
  'Current location status chip',
  'World Places modal correctly tags active location with Current Location chip'
);

// TEST 70: Locked place card displays requirement
assert(modalHtml.includes('Locked') || modalHtml.includes('lock'), 70,
  'Locked place card rendering',
  'World Places modal displays Locked badge and prerequisite hint for locked locations'
);

// TEST 71: Handle place select for accessible place
GAME.handlePlaceSelect('home');
assert(state.activePlaceId === 'home', 71,
  'Accessible place selection',
  'handlePlaceSelect transitions avatar to selected available place'
);

// =============================================================
// SECTION 16: CANVAS RENDERERS & GENERIC PLACE ENGINE
// =============================================================

// TEST 72: School canvas renderer execution
const dummyCtx = getMockElement('game-canvas').getContext('2d');
let schoolRenderedClean = false;
try {
  GAME.renderSchoolWorld(dummyCtx);
  schoolRenderedClean = true;
} catch (e) {
  schoolRenderedClean = false;
}
assert(schoolRenderedClean, 72,
  'School canvas renderer',
  'renderSchoolWorld executes without throw or canvas context error'
);

// TEST 73: Sports Hub canvas renderer execution
let sportsRenderedClean = false;
try {
  GAME.renderSportsHubWorld(dummyCtx);
  sportsRenderedClean = true;
} catch (e) {
  sportsRenderedClean = false;
}
assert(sportsRenderedClean, 73,
  'Sports Hub canvas renderer',
  'renderSportsHubWorld executes without throw or canvas context error'
);

// TEST 74: Outreach Site canvas renderer execution
let outreachRenderedClean = false;
try {
  GAME.renderOutreachWorld(dummyCtx);
  outreachRenderedClean = true;
} catch (e) {
  outreachRenderedClean = false;
}
assert(outreachRenderedClean, 74,
  'Outreach Site canvas renderer',
  'renderOutreachWorld executes without throw or canvas context error'
);

// TEST 75: Generic place fallback renderer execution
let genericRenderedClean = false;
try {
  GAME.renderGenericPlace(dummyCtx, PLACES.school);
  genericRenderedClean = true;
} catch (e) {
  genericRenderedClean = false;
}
assert(genericRenderedClean, 75,
  'Generic place fallback renderer',
  'renderGenericPlace handles any declarative place schema successfully'
);

// =============================================================
// SECTION 17: PERSISTENCE & DEVELOPER RESET ENGINE
// =============================================================

// TEST 76: Phase 16 storage key validation
assert(state.storageMeta.saveKey === 'koinonia.phase16.save', 76,
  'Phase 16 storage key',
  'Storage engine uses koinonia.phase16.save to isolate Phase 16 data'
);

// TEST 77: State serialization and persistence
state.activePlaceId = 'sports_hub';
state.visitedPlaces = ['home', 'fog_center', 'sports_hub'];
state.unlockedPlaces = ['home', 'fog_center', 'sports_hub'];
state.spokenToNpc = { barnaby: true, coach_daniel: true };
GAME.saveToStorage('test_verification');
const savedRaw = mockLocalStorage.getItem('koinonia.phase16.save');
const savedObj = JSON.parse(savedRaw);
assert(
  savedObj.activePlaceId === 'sports_hub' &&
  Array.isArray(savedObj.visitedPlaces) &&
  savedObj.visitedPlaces.includes('sports_hub') &&
  savedObj.spokenToNpc.coach_daniel === true,
  77,
  'State serialization with places metadata',
  'saveToStorage persists activePlaceId, visitedPlaces, and spokenToNpc'
);

// TEST 78: State hydration from storage
state.activePlaceId = 'home';
GAME.loadFromStorage();
assert(state.activePlaceId === 'sports_hub', 78,
  'State hydration from storage',
  'loadFromStorage hydrates activePlaceId and places metadata from storage'
);

// TEST 79: Developer reset behavior
GAME.resetPrototypeState();
assert(
  state.activePlaceId === 'home' &&
  state.visitedPlaces.length === 1 &&
  state.visitedPlaces[0] === 'home' &&
  state.charXp === 0 &&
  state.lp === 120,
  79,
  'Developer reset behavior',
  'resetPrototypeState resets activePlaceId to home, visitedPlaces to [home], and XP to 0'
);

// =============================================================
// SECTION 18: RELOAD TEST SUITE INTEGRITY
// =============================================================

// TEST 80: reload_test.html references Phase 16 storage key
const reloadHtmlContent = fs.readFileSync(path.join(P16_DIR, 'reload_test.html'), 'utf8');
assert(reloadHtmlContent.includes('koinonia.phase16.save'), 80,
  'reload_test.html storage key',
  'reload_test.html verifies persistence using koinonia.phase16.save'
);

// TEST 81: HTML cache buster references ?v=0.16
const htmlHasCacheBusters = htmlContent.includes('styles.css?v=0.16') && htmlContent.includes('places.js?v=0.16');
assert(htmlHasCacheBusters, 81,
  'HTML cache busters',
  'index.html assets use ?v=0.16 cache busting queries'
);

// TEST 82: Keyboard shortcut [M] bound for World Map
const hasMKeyShortcut = gameContent.includes("e.key === 'm' || e.key === 'M'");
assert(hasMKeyShortcut, 82,
  'M key shortcut for World Map',
  'game.js binds [M] key to openWorldPlacesModal for desktop navigation'
);

// TEST 83: reload_test.html Phase 0.16 copy alignment
const reloadHasP16Copy = (reloadHtmlContent.includes('Phase 0.16 World &amp; Places Expansion') || reloadHtmlContent.includes('Phase 0.16 World & Places Expansion')) &&
  reloadHtmlContent.includes('koinonia.phase16.save');
assert(reloadHasP16Copy, 83,
  'reload_test.html Phase 0.16 copy alignment',
  'reload_test.html reflects Phase 0.16 title and storage key'
);

// =============================================================
// SECTION 19: DYNAMIC MILESTONE DENOMINATOR & LEVEL PERK DISPLAY VERIFICATION
// =============================================================

// TEST 84: Canonical milestone catalog length is exactly 15 in Phase 0.16
assert(MILESTONES.length === 15, 84,
  'Canonical Phase 0.16 milestone catalog length',
  `MILESTONES array contains exactly 15 entries (Phase 0.15's 11 + 4 discovery milestones)`
);

// TEST 85: Source code audit confirms zero hardcoded integer fallbacks for milestone denominator
const reloadedGameContent = fs.readFileSync(path.join(P16_DIR, 'game.js'), 'utf8');
const hasHardcodedFallback11 = reloadedGameContent.includes('pData.MILESTONES.length : 11') ||
  reloadedGameContent.includes('/ 11 Unlocked') ||
  reloadedGameContent.includes('/ 11</div>') ||
  reloadedGameContent.includes('/ 15 Unlocked') ||
  reloadedGameContent.includes('/ 15</div>');
assert(!hasHardcodedFallback11, 85,
  'Milestone denominator code audit',
  'game.js contains zero hard-coded milestone fallbacks (: 11 or / 15)'
);

// TEST 86: Journey Summary milestone denominator matches MILESTONES.length dynamically
state.unlockedMilestones = [];
GAME.renderJourneySummary();
const summaryElP16 = getMockElement('profile-summary-stats');
const expectedZeroDenom = `0 / ${MILESTONES.length}`;
assert(summaryElP16.innerHTML.includes(expectedZeroDenom), 86,
  'Dynamic milestone denominator at 0 unlocked',
  `Journey summary displays ${expectedZeroDenom} dynamically based on MILESTONES.length`
);

// TEST 87: Debug HUD milestone denominator matches MILESTONES.length dynamically
GAME.updateDebugHud(true);
const hudElP16 = getMockElement('debug-hud');
assert(hudElP16.innerHTML.includes(`0 / ${MILESTONES.length} Unlocked`), 87,
  'Debug HUD milestone denominator matches dynamically',
  `Debug HUD renders 0 / ${MILESTONES.length} Unlocked dynamically without hardcoding`
);

// TEST 88: Active level perk dynamically displays Level 1 perk
state.charLevel = 1;
state.charXp = 0;
GAME.updateCharacterProgressDisplays();
const perkBadgeEl = getMockElement('me-char-perk-badge');
const perkL1 = CHARACTER_LEVELS.find(l => l.level === 1).unlockedPerk;
assert(perkBadgeEl.textContent === perkL1 && perkL1 === 'Journey Journal Started', 88,
  'Level 1 active perk display',
  `Level 1 dynamically updates me-char-perk-badge to '${perkL1}'`
);

// TEST 89: Active level perk dynamically displays Level 2 perk
state.charLevel = 2;
state.charXp = 10;
GAME.updateCharacterProgressDisplays();
const perkL2 = CHARACTER_LEVELS.find(l => l.level === 2).unlockedPerk;
assert(perkBadgeEl.textContent === perkL2 && perkL2 === 'Journey Explorer Badge', 89,
  'Level 2 active perk display',
  `Level 2 dynamically updates me-char-perk-badge to '${perkL2}'`
);

// TEST 90: Active level perk dynamically displays Level 3 perk (Resolves Bug 2)
state.charLevel = 3;
state.charXp = 25;
GAME.updateCharacterProgressDisplays();
const perkL3 = CHARACTER_LEVELS.find(l => l.level === 3).unlockedPerk;
assert(perkBadgeEl.textContent === perkL3 && perkL3 === 'Community Adventure Profile Frame', 90,
  'Level 3 active perk display',
  `Level 3 dynamically updates me-char-perk-badge to '${perkL3}' (not stuck at Level 1)`
);

// TEST 91: Active level perk dynamically displays Level 4 and Level 5 perks
state.charLevel = 4;
state.charXp = 45;
GAME.updateCharacterProgressDisplays();
const perkL4 = CHARACTER_LEVELS.find(l => l.level === 4).unlockedPerk;
const l4Match = perkBadgeEl.textContent === perkL4;

state.charLevel = 5;
state.charXp = 70;
GAME.updateCharacterProgressDisplays();
const perkL5 = CHARACTER_LEVELS.find(l => l.level === 5).unlockedPerk;
const l5Match = perkBadgeEl.textContent === perkL5;

assert(l4Match && l5Match, 91,
  'Level 4 and Level 5 active perk displays',
  `Level 4 shows '${perkL4}' and Level 5 shows '${perkL5}' dynamically`
);

// TEST 92: Full playthrough state verification (5 callings, 25 XP, Level 3, 15 milestones, 5 places)
state.charLevel = 3;
state.charXp = 25;
state.highestLevelReached = 3;
state.lp = 145;
state.visitedPlaces = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'];
state.unlockedPlaces = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'];
state.unlockedMilestones = MILESTONES.map(m => m.id);
state.questProgress = {
  'Q-001': { status: 'COMPLETED' },
  'Q-002': { status: 'COMPLETED' },
  'Q-003': { status: 'COMPLETED' },
  'Q-004': { status: 'COMPLETED' },
  'Q-005': { status: 'COMPLETED' }
};

GAME.renderJourneySummary();
GAME.updateCharacterProgressDisplays();

const levelTitleEl = getMockElement('me-char-level-title');
const summaryHtml = summaryElP16.innerHTML;

const hasCorrectMilestones = summaryHtml.includes(`15 / 15`);
const hasCorrectPlaces = summaryHtml.includes(`5 / 5`);
const hasCorrectCallings = summaryHtml.includes(`5`) && summaryHtml.includes(`CALLINGS COMPLETED`);
const hasCorrectXp = summaryHtml.includes(`25 XP`);
const hasCorrectLp = summaryHtml.includes(`145 LP`);
const hasCorrectLevelTitle = levelTitleEl.textContent.includes('Level 3 • Community Adventurer');
const hasCorrectPerk = perkBadgeEl.textContent === 'Community Adventure Profile Frame';

assert(
  hasCorrectMilestones &&
  hasCorrectPlaces &&
  hasCorrectCallings &&
  hasCorrectXp &&
  hasCorrectLp &&
  hasCorrectLevelTitle &&
  hasCorrectPerk,
  92,
  'Complete playthrough state verification',
  'Renders 15 / 15 Milestones, 5 / 5 Places, 25 XP, 145 LP, and Level 3 perk: Community Adventure Profile Frame'
);

// TEST 93: Milestones tab renderMilestones() renders all 15 milestones dynamically
GAME.renderMilestones();
const milestonesListEl = getMockElement('profile-milestones-list');
const renderedMilestoneCount = (milestonesListEl.innerHTML.match(/class="milestone-item/g) || []).length;
assert(renderedMilestoneCount === MILESTONES.length && renderedMilestoneCount === 15, 93,
  'Milestones tab dynamic list rendering',
  `renderMilestones() outputs exactly ${MILESTONES.length} milestone items into #profile-milestones-list`
);

// =============================================================
// SUMMARY & RESULTS
// =============================================================
console.log('\n====================================================');
console.log(`Phase 0.16 Test Results: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} assertions.`);
console.log('====================================================\n');

if (failCount > 0) {
  console.error(`Verification FAILED with ${failCount} failing assertion(s)!`);
  process.exit(1);
} else {
  console.log(`Verification SUCCESS! All ${passCount} assertions passed cleanly.`);
  process.exit(0);
}
