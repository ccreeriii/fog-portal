/**
 * KOINONIA — PHASE 0.19 AUTOMATED VERIFICATION SUITE
 * Test Coverage: Memories Engine, Deduplication, Place History,
 * Event Memory Pages, Private Reflection, UI Modals, Clean QA Baseline,
 * LocalStorage Hydration, and Browser-Runtime Lifecycle.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testNum, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] #${testNum}: ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] #${testNum}: ${testName} - FAILED!`);
  }
}

const P19_DIR = __dirname;
const htmlContent = fs.readFileSync(path.join(P19_DIR, 'index.html'), 'utf8');
const gameContent = fs.readFileSync(path.join(P19_DIR, 'game.js'), 'utf8');
const memoriesContent = fs.readFileSync(path.join(P19_DIR, 'data', 'memories.js'), 'utf8');
const sportsContent = fs.readFileSync(path.join(P19_DIR, 'data', 'sports.js'), 'utf8');
const cssContent = fs.readFileSync(path.join(P19_DIR, 'styles.css'), 'utf8');

// Load memories.js and other data modules in Node
const memoriesModule = require('./data/memories.js');
const sportsModule = require('./data/sports.js');
const progressionModule = require('./data/progression.js');
const questsModule = require('./data/quests.js');
const placesModule = require('./data/places.js');
const campaignsModule = require('./data/campaigns.js');
const eventsModule = require('./data/events.js');

console.log('\n====================================================');
console.log('KOINONIA PHASE 0.19 TEST SUITE: MEMORIES & MY JOURNEY');
console.log('====================================================\n');

// ============================================================================
// SECTION 1: MEMORY ENGINE ARCHITECTURE & SCHEMA (Tests 1 - 15)
// ============================================================================
console.log('--- SECTION 1: MEMORY ENGINE ARCHITECTURE & SCHEMA ---');

assert(typeof memoriesModule.createMemory === 'function', 1, 'memories.js exports createMemory factory');
assert(typeof memoriesModule.addMemoryIfNew === 'function', 2, 'memories.js exports addMemoryIfNew helper');
assert(typeof memoriesModule.MEMORY_TYPES === 'object', 3, 'memories.js exports MEMORY_TYPES');
assert(typeof memoriesModule.SOURCE_TYPES === 'object', 4, 'memories.js exports SOURCE_TYPES');
assert(memoriesModule.PRIVACY_LABEL === '🔒 Private to you', 5, 'Privacy label is "🔒 Private to you"');

const testMem = memoriesModule.createMemory({
  title: 'Test Journey Memory',
  subtitle: 'Subtitle note',
  description: 'Full description of the remembered experience.',
  placeId: 'fog_center',
  memoryType: memoriesModule.MEMORY_TYPES.QUEST_COMPLETED,
  sourceType: memoriesModule.SOURCE_TYPES.QUEST,
  sourceId: 'Q-001'
});

assert(typeof testMem.id === 'string' && testMem.id.startsWith('mem_'), 6, 'Memory has canonical id format');
assert(testMem.communityId === 'fog', 7, 'Memory has communityId: "fog"');
assert(testMem.memoryType === 'QUEST_COMPLETED', 8, 'Memory has memoryType: "QUEST_COMPLETED"');
assert(testMem.sourceType === 'QUEST', 9, 'Memory has sourceType: "QUEST"');
assert(testMem.sourceId === 'Q-001', 10, 'Memory has sourceId: "Q-001"');
assert(testMem.placeId === 'fog_center', 11, 'Memory has placeId: "fog_center"');
assert(testMem.privacy === 'PRIVATE', 12, 'Memory privacy is PRIVATE by default');
assert(testMem.reflectionText === null, 13, 'Default reflectionText is null (no manufactured reflection)');
assert(Array.isArray(testMem.tags), 14, 'Memory has tags array');
assert(testMem.isDemo === false, 15, 'Default isDemo is false');

// ============================================================================
// SECTION 2: DETERMINISTIC DEDUPLICATION ENGINE (Tests 16 - 32)
// ============================================================================
console.log('\n--- SECTION 2: DETERMINISTIC DEDUPLICATION ENGINE ---');

const dummyState = { memories: [], placeHistory: {} };

// 1. Quest completion deduplication
const q1 = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.QUEST_COMPLETED,
  sourceType: memoriesModule.SOURCE_TYPES.QUEST,
  sourceId: 'Q-001',
  title: 'Steward of the Garden'
});
assert(q1.added === true, 16, 'First quest memory created successfully');
assert(dummyState.memories.length === 1, 17, 'State memories length is 1');

const q1Dup = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.QUEST_COMPLETED,
  sourceType: memoriesModule.SOURCE_TYPES.QUEST,
  sourceId: 'Q-001',
  title: 'Steward of the Garden'
});
assert(q1Dup.added === false, 18, 'Duplicate quest memory is blocked by deduplication');
assert(dummyState.memories.length === 1, 19, 'Memory count remains 1 after duplicate attempt');

// 2. Event attendance deduplication
const ev1 = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.EVENT_ATTENDED,
  sourceType: memoriesModule.SOURCE_TYPES.EVENT,
  sourceId: 'alpha_s01_20260912',
  title: 'Alpha Youth Series Session 1'
});
assert(ev1.added === true, 20, 'First event memory created successfully');
assert(dummyState.memories.length === 2, 21, 'State memories length is 2');

const ev1Dup = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.EVENT_ATTENDED,
  sourceType: memoriesModule.SOURCE_TYPES.EVENT,
  sourceId: 'alpha_s01_20260912',
  title: 'Alpha Youth Series Session 1'
});
assert(ev1Dup.added === false, 22, 'Duplicate event memory is blocked by deduplication');
assert(dummyState.memories.length === 2, 23, 'Memory count remains 2');

// 3. Place discovery deduplication
const pl1 = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.PLACE_DISCOVERED,
  sourceType: memoriesModule.SOURCE_TYPES.PLACE,
  sourceId: 'sports_hub',
  title: 'Discovered Sports Hub'
});
assert(pl1.added === true, 24, 'First place discovery memory created successfully');

const pl1Dup = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.PLACE_DISCOVERED,
  sourceType: memoriesModule.SOURCE_TYPES.PLACE,
  sourceId: 'sports_hub',
  title: 'Discovered Sports Hub'
});
assert(pl1Dup.added === false, 25, 'Duplicate place discovery memory is blocked');

// 4. Milestone unlocked deduplication
const m1 = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.MILESTONE_UNLOCKED,
  sourceType: memoriesModule.SOURCE_TYPES.MILESTONE,
  sourceId: 'm_first_fitquest',
  title: 'Milestone Unlocked'
});
assert(m1.added === true, 26, 'First milestone memory created successfully');

const m1Dup = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.MILESTONE_UNLOCKED,
  sourceType: memoriesModule.SOURCE_TYPES.MILESTONE,
  sourceId: 'm_first_fitquest',
  title: 'Milestone Unlocked'
});
assert(m1Dup.added === false, 27, 'Duplicate milestone memory is blocked');

// 5. Personal Best improvement rules
const pb1 = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.PERSONAL_BEST,
  sourceType: memoriesModule.SOURCE_TYPES.FIT_QUEST,
  sourceId: 'FQ-V001',
  placeId: 'sports_hub',
  title: 'Free Throw Focus PB',
  metadata: { isPersonalBest: true, newScore: 4 }
});
assert(pb1.added === true, 28, 'Initial PB memory created for 4 makes');

const pbWorse = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.PERSONAL_BEST,
  sourceType: memoriesModule.SOURCE_TYPES.FIT_QUEST,
  sourceId: 'FQ-V001',
  placeId: 'sports_hub',
  title: 'Free Throw Focus PB',
  metadata: { isPersonalBest: false, newScore: 3 }
});
assert(pbWorse.added === false, 29, 'Worse attempt (3 makes) rejected from creating PB memory');

const pbSame = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.PERSONAL_BEST,
  sourceType: memoriesModule.SOURCE_TYPES.FIT_QUEST,
  sourceId: 'FQ-V001',
  placeId: 'sports_hub',
  title: 'Free Throw Focus PB',
  metadata: { isPersonalBest: true, newScore: 4 }
});
assert(pbSame.added === false, 30, 'Exact same PB score (4 makes) does not create duplicate memory');

const pbImproved = memoriesModule.addMemoryIfNew(dummyState, {
  memoryType: memoriesModule.MEMORY_TYPES.PERSONAL_BEST,
  sourceType: memoriesModule.SOURCE_TYPES.FIT_QUEST,
  sourceId: 'FQ-V001',
  placeId: 'sports_hub',
  title: 'Free Throw Focus PB',
  metadata: { isPersonalBest: true, previousScore: 4, newScore: 7 }
});
assert(pbImproved.added === true, 31, 'Improved PB (7 makes) creates new PB memory');

assert(
  dummyState.memories.filter(m => m.sourceType === 'FIT_QUEST' && m.sourceId === 'FQ-V001').length === 2,
  32,
  'Exactly 2 PB memories exist for FQ-V001 (initial 4 makes, improved 7 makes)'
);

// ============================================================================
// SECTION 3: MEMORY QUERY & FILTERING API (Tests 33 - 44)
// ============================================================================
console.log('\n--- SECTION 3: MEMORY QUERY & FILTERING API ---');

const allMems = memoriesModule.getMemories(dummyState, 'ALL');
assert(Array.isArray(allMems) && allMems.length === 6, 33, 'getMemories(state, "ALL") returns all 6 memories');

const questMems = memoriesModule.getMemories(dummyState, 'QUESTS');
assert(questMems.length === 1 && questMems[0].sourceId === 'Q-001', 34, 'getMemories filter QUESTS returns 1 quest memory');

const eventMems = memoriesModule.getMemories(dummyState, 'EVENTS');
assert(eventMems.length === 1 && eventMems[0].sourceId === 'alpha_s01_20260912', 35, 'getMemories filter EVENTS returns 1 event memory');

const sportMems = memoriesModule.getMemories(dummyState, 'SPORTS');
assert(sportMems.length === 2, 36, 'getMemories filter SPORTS returns 2 PB memories');

const milestoneMems = memoriesModule.getMemories(dummyState, 'MILESTONES');
assert(milestoneMems.length === 1 && milestoneMems[0].sourceId === 'm_first_fitquest', 37, 'getMemories filter MILESTONES returns 1 milestone memory');

const memById = memoriesModule.getMemoryById(dummyState, allMems[0].id);
assert(memById && memById.id === allMems[0].id, 38, 'getMemoryById resolves existing memory');

const nonExistent = memoriesModule.getMemoryById(dummyState, 'non_existent_id');
assert(nonExistent === null, 39, 'getMemoryById returns null for missing memory');

const byPlace = memoriesModule.getMemoriesByPlace(dummyState, 'sports_hub');
assert(Array.isArray(byPlace) && byPlace.length >= 3, 40, 'getMemoriesByPlace returns all memories associated with sports_hub');

const bySource = memoriesModule.getMemoriesBySource(dummyState, 'QUEST', 'Q-001');
assert(bySource.length === 1 && bySource[0].title === 'Steward of the Garden', 41, 'getMemoriesBySource returns matching source memory');

// Test newest first ordering
const t1 = new Date('2026-09-02T10:00:00+08:00').getTime();
const t2 = new Date('2026-09-06T15:00:00+08:00').getTime();
const orderedState = {
  memories: [
    { id: 'm1', occurredAt: '2026-09-02T10:00:00+08:00', memoryType: 'QUEST_COMPLETED' },
    { id: 'm2', occurredAt: '2026-09-06T15:00:00+08:00', memoryType: 'QUEST_COMPLETED' }
  ]
};
const sorted = memoriesModule.getMemories(orderedState, 'ALL');
assert(sorted[0].id === 'm2' && sorted[1].id === 'm1', 42, 'getMemories sorts newest first descending by occurredAt');

assert(dummyState.memoryMetrics.totalCount === 6, 43, 'memoryMetrics tracks totalCount accurately');
assert(dummyState.memoryMetrics.personalBestCount === 2, 44, 'memoryMetrics tracks personalBestCount accurately');

// ============================================================================
// SECTION 4: PRIVATE REFLECTION ENGINE (Tests 45 - 55)
// ============================================================================
console.log('\n--- SECTION 4: PRIVATE REFLECTION ENGINE ---');

const targetMemId = allMems[0].id;
const addRefRes = memoriesModule.addPrivateReflection(dummyState, targetMemId, '   I learned to be patient with small tasks.   ');
assert(addRefRes.success === true, 45, 'addPrivateReflection returns success: true');
assert(addRefRes.memory.reflectionText === 'I learned to be patient with small tasks.', 46, 'Reflection trimmed and attached');

const filterRefMems = memoriesModule.getMemories(dummyState, 'REFLECTIONS');
assert(filterRefMems.length === 1 && filterRefMems[0].id === targetMemId, 47, 'getMemories filter REFLECTIONS returns memory with reflection');

// Update reflection
const updateRefRes = memoriesModule.updatePrivateReflection(dummyState, targetMemId, 'Updated reflection note.');
assert(updateRefRes.success === true && updateRefRes.memory.reflectionText === 'Updated reflection note.', 48, 'updatePrivateReflection updates note');

// Delete reflection
const delRefRes = memoriesModule.deletePrivateReflection(dummyState, targetMemId);
assert(delRefRes.success === true && delRefRes.memory.reflectionText === null, 49, 'deletePrivateReflection sets reflectionText to null');

const afterDelRefMems = memoriesModule.getMemories(dummyState, 'REFLECTIONS');
assert(afterDelRefMems.length === 0, 50, 'Filter REFLECTIONS returns 0 after reflection deletion');

// Non-destructive check:
dummyState.lp = 135;
dummyState.charXp = 15;
memoriesModule.addPrivateReflection(dummyState, targetMemId, 'Preservation check note');
assert(dummyState.lp === 135 && dummyState.charXp === 15, 51, 'Adding reflection preserves LP=135 and XP=15 (0 economic impact)');

memoriesModule.deletePrivateReflection(dummyState, targetMemId);
assert(dummyState.lp === 135 && dummyState.charXp === 15, 52, 'Deleting reflection preserves LP=135 and XP=15 (0 economic impact)');

// Missing memory handling
const missingRefRes = memoriesModule.addPrivateReflection(dummyState, 'unknown_id', 'Hello');
assert(missingRefRes.success === false && missingRefRes.reason === 'MEMORY_NOT_FOUND', 53, 'addPrivateReflection handles missing memory gracefully');

const missingDelRes = memoriesModule.deletePrivateReflection(dummyState, 'unknown_id');
assert(missingDelRes.success === false && missingDelRes.reason === 'MEMORY_NOT_FOUND', 54, 'deletePrivateReflection handles missing memory gracefully');

assert(dummyState.memories[0].privacy === 'PRIVATE', 55, 'Memory privacy remains PRIVATE');

// ============================================================================
// SECTION 5: PLACE HISTORY ENGINE (Tests 56 - 67)
// ============================================================================
console.log('\n--- SECTION 5: PLACE HISTORY ENGINE ---');

const placeState = { memories: [], placeHistory: {} };

// First visit to Sports Hub
const visit1 = memoriesModule.recordPlaceVisit(placeState, 'sports_hub', '2026-09-06T10:00:00+08:00');
assert(visit1.visitCount === 1, 56, 'First visit records visitCount: 1');
assert(visit1.firstVisit === '2026-09-06T10:00:00+08:00', 57, 'First visit timestamp recorded');
assert(visit1.recentVisit === '2026-09-06T10:00:00+08:00', 58, 'Recent visit timestamp recorded');
assert(placeState.memories.some(m => m.memoryType === 'PLACE_DISCOVERED' && m.sourceId === 'sports_hub'), 59, 'First visit creates PLACE_DISCOVERED memory');

// Revisit Sports Hub
const visit2 = memoriesModule.recordPlaceVisit(placeState, 'sports_hub', '2026-09-06T14:30:00+08:00');
assert(visit2.visitCount === 2, 60, 'Revisit increments visitCount to 2');
assert(visit2.firstVisit === '2026-09-06T10:00:00+08:00', 61, 'First visit timestamp preserved on revisit');
assert(visit2.recentVisit === '2026-09-06T14:30:00+08:00', 62, 'Recent visit timestamp updated on revisit');

const sportsHubDiscoveries = placeState.memories.filter(m => m.memoryType === 'PLACE_DISCOVERED' && m.sourceId === 'sports_hub');
assert(sportsHubDiscoveries.length === 1, 63, 'Revisit does NOT create duplicate PLACE_DISCOVERED memory');

// Query Place History
const sportsHistory = memoriesModule.getPlaceHistory(placeState, 'sports_hub');
assert(sportsHistory.visitCount === 2, 64, 'getPlaceHistory returns correct visitCount (2)');
assert(Array.isArray(sportsHistory.memories) && sportsHistory.memories.length === 1, 65, 'getPlaceHistory attaches related memories array');

// Unvisited place history
const unvisitedSchool = memoriesModule.getPlaceHistory(placeState, 'school');
assert(unvisitedSchool.visitCount === 0 && unvisitedSchool.firstVisit === null, 66, 'Unvisited place has visitCount: 0 and null visits');

// All places history
const allPlacesHist = memoriesModule.getAllPlacesHistory(placeState);
assert(Array.isArray(allPlacesHist) && allPlacesHist.length === 5, 67, 'getAllPlacesHistory returns all 5 canonical places');

// ============================================================================
// SECTION 6: CLEAN QA BASELINE & PROGRESSION FIDELITY (Tests 68 - 80)
// ============================================================================
console.log('\n--- SECTION 6: CLEAN QA BASELINE & PROGRESSION FIDELITY ---');

const cleanQa = memoriesModule.createJourneyReadyQaState();

assert(cleanQa.storageKey === 'koinonia.phase19.save', 68, 'QA state specifies koinonia.phase19.save');
assert(cleanQa.lp === 135, 69, 'QA state provides 135 LP');
assert(cleanQa.charXp === 15, 70, 'QA state provides 15 XP');
assert(cleanQa.charLevel === 2, 71, 'QA state provides Level 2');
assert(Array.isArray(cleanQa.memories) && cleanQa.memories.length === 0, 72, 'Clean QA state has STRICTLY 0 memories (no fake memories)');
assert(cleanQa.memoryMetrics && cleanQa.memoryMetrics.totalCount === 0, 73, 'Clean QA state has totalCount === 0');
assert(cleanQa.memoryMetrics && cleanQa.memoryMetrics.reflectionCount === 0, 74, 'Clean QA state has reflectionCount === 0');
assert(cleanQa.eventsAttendedCount === 0, 75, 'Clean QA state has 0 events attended (no fake attendance)');
assert(Array.isArray(cleanQa.completedEventInstances) && cleanQa.completedEventInstances.length === 0, 76, 'Clean QA state has completedEventInstances empty');
assert(Array.isArray(cleanQa.activeCampaignIds) && cleanQa.activeCampaignIds.length === 0, 77, 'Clean QA state has 0 active campaigns (Alpha not auto-started)');
assert(cleanQa.fitQuestMetrics && cleanQa.fitQuestMetrics.totalAttemptsCount === 0, 78, 'Clean QA state has 0 fitQuest attempts');
assert(typeof cleanQa.personalBests === 'object' && Object.keys(cleanQa.personalBests).length === 0, 79, 'Clean QA state has 0 personal bests');
assert(cleanQa.growthAreas.discipline === 0 && cleanQa.growthAreas.teamwork === 0, 80, 'Clean QA state has discipline=0 and teamwork=0');

// ============================================================================
// SECTION 7: DEMO HISTORY SEEDER & DATA SEPARATION (Tests 81 - 88)
// ============================================================================
console.log('\n--- SECTION 7: DEMO HISTORY SEEDER & DATA SEPARATION ---');

const demoState = memoriesModule.createJourneyReadyQaState();
memoriesModule.seedJourneyDemoHistory(demoState);

assert(demoState.memories.length > 0, 81, 'seedJourneyDemoHistory populates memories');
assert(demoState.memories.every(m => m.isDemo === true), 82, 'ALL seeded demo memories have isDemo === true');
assert(demoState.memories.some(m => m.memoryType === 'QUEST_COMPLETED'), 83, 'Demo dataset includes QUEST_COMPLETED');
assert(demoState.memories.some(m => m.memoryType === 'EVENT_ATTENDED'), 84, 'Demo dataset includes EVENT_ATTENDED');
assert(demoState.memories.some(m => m.memoryType === 'PERSONAL_BEST'), 85, 'Demo dataset includes PERSONAL_BEST');
assert(demoState.memories.some(m => m.memoryType === 'MILESTONE_UNLOCKED'), 86, 'Demo dataset includes MILESTONE_UNLOCKED');
assert(demoState.memories.some(m => m.memoryType === 'PLACE_DISCOVERED'), 87, 'Demo dataset includes PLACE_DISCOVERED');
assert(demoState.memories.some(m => Boolean(m.reflectionText)), 88, 'Demo dataset includes memories with reflections');

// ============================================================================
// SECTION 8: HTML MODALS & DOM STRUCTURE (Tests 89 - 104)
// ============================================================================
console.log('\n--- SECTION 8: HTML MODALS & DOM STRUCTURE ---');

assert(htmlContent.includes('id="journey-modal"'), 89, 'index.html contains #journey-modal');
assert(htmlContent.includes('MY JOURNEY'), 90, 'index.html contains MY JOURNEY title');
assert(htmlContent.includes('Look back at the moments that shaped your adventure.'), 91, 'index.html contains canonical Journey subtitle');
assert(htmlContent.includes('id="tab-btn-timeline"'), 92, 'index.html contains TIMELINE tab button');
assert(htmlContent.includes('id="tab-btn-memories"'), 93, 'index.html contains MEMORIES tab button');
assert(htmlContent.includes('id="tab-btn-places"'), 94, 'index.html contains PLACES tab button');
assert(htmlContent.includes('id="tab-btn-growth"'), 95, 'index.html contains GROWTH tab button');
assert(htmlContent.includes('Quests Completed:'), 96, 'index.html displays Quests Completed counter');
assert(htmlContent.includes('Events Attended:'), 97, 'index.html displays Events Attended counter');
assert(htmlContent.includes('Fit Quests Completed:'), 98, 'index.html displays Fit Quests Completed counter');
assert(htmlContent.includes('Personal Bests:'), 99, 'index.html displays Personal Bests counter');
assert(htmlContent.includes('Sports Tried:'), 100, 'index.html displays Sports Tried counter');
assert(htmlContent.includes('Places Visited:'), 101, 'index.html displays Places Visited counter');
assert(htmlContent.includes('Memories Collected:'), 102, 'index.html displays Memories Collected counter');
assert(htmlContent.includes('id="memory-detail-modal"'), 103, 'index.html contains #memory-detail-modal');
assert(htmlContent.includes('id="reflection-editor-modal"'), 104, 'index.html contains #reflection-editor-modal');

// ============================================================================
// SECTION 9: PRIVACY & SENSITIVITY SAFEGUARDS (Tests 105 - 112)
// ============================================================================
console.log('\n--- SECTION 9: PRIVACY & SENSITIVITY SAFEGUARDS ---');

assert(htmlContent.includes('🔒 Private to you'), 105, 'index.html contains "🔒 Private to you" reassurance');
assert(!htmlContent.includes('holiness score') && !htmlContent.includes('Holiness Score'), 106, 'No holiness score in UI');
assert(!htmlContent.includes('spiritual rank') && !htmlContent.includes('Spiritual Rank'), 107, 'No spiritual rank in UI');
assert(!htmlContent.includes('faith score') && !htmlContent.includes('Faith Score'), 108, 'No faith score in UI');
assert(!htmlContent.includes('prayer score') && !htmlContent.includes('Prayer Score'), 109, 'No prayer score in UI');
assert(gameContent.includes("SAVE_STORAGE_KEY = 'koinonia.phase19.save'"), 110, 'game.js uses storage key koinonia.phase19.save');
assert(!gameContent.includes("SAVE_STORAGE_KEY = 'koinonia.phase18.save'"), 111, 'game.js does not use koinonia.phase18.save as active key');
assert(htmlContent.includes('data/memories.js?v=0.19'), 112, 'index.html loads data/memories.js?v=0.19');

// ============================================================================
// SECTION 10: QA TEST LAB EXECUTION & INTEGRITY (Tests 113 - 125)
// ============================================================================
console.log('\n--- SECTION 10: QA TEST LAB EXECUTION & INTEGRITY ---');

const journeyTestHtml = fs.readFileSync(path.join(P19_DIR, 'journey_test.html'), 'utf8');

assert(journeyTestHtml.includes('PHASE 0.19 — JOURNEY TEST LAB'), 113, 'journey_test.html contains canonical title');
assert(journeyTestHtml.includes('QA LAB READY'), 114, 'journey_test.html contains QA LAB READY status');
assert(journeyTestHtml.includes('RESET PHASE 0.19 SAVE'), 115, 'journey_test.html contains reset button');
assert(journeyTestHtml.includes('SEED JOURNEY-READY CLEAN STATE'), 116, 'journey_test.html contains seed button');
assert(journeyTestHtml.includes('LAUNCH PROTOTYPE'), 117, 'journey_test.html contains launch prototype button');
assert(journeyTestHtml.includes('CREATE QUEST MEMORY'), 118, 'journey_test.html contains create quest memory button');
assert(journeyTestHtml.includes('CREATE EVENT MEMORY [DEMO]'), 119, 'journey_test.html contains create event memory button');
assert(journeyTestHtml.includes('CREATE PERSONAL BEST MEMORY [DEMO]'), 120, 'journey_test.html contains create PB memory button');
assert(journeyTestHtml.includes('CREATE PLACE DISCOVERY MEMORY'), 121, 'journey_test.html contains create place discovery button');
assert(journeyTestHtml.includes('CREATE MILESTONE MEMORY [DEMO]'), 122, 'journey_test.html contains create milestone memory button');
assert(journeyTestHtml.includes('OPEN MY JOURNEY'), 123, 'journey_test.html contains OPEN MY JOURNEY shortcut');
assert(journeyTestHtml.includes('SEED JOURNEY DEMO HISTORY'), 124, 'journey_test.html contains SEED JOURNEY DEMO HISTORY button');

// Inline script parse test
const testLabScriptMatch = journeyTestHtml.match(/<script>([\s\S]*?)<\/script>/);
assert(testLabScriptMatch && testLabScriptMatch[1].length > 100, 125, 'journey_test.html has executable inline script block');

// ============================================================================
// SECTION 11: BROWSER-RUNTIME DOM & REFLECTION HYDRATION (Tests 126 - 145)
// ============================================================================
console.log('\n--- SECTION 11: BROWSER-RUNTIME DOM & REFLECTION HYDRATION ---');

// Mock browser environment for game.js execution
const domStore = {};
function createMockElement(id) {
  if (domStore[id]) return domStore[id];
  const classes = new Set(['hidden']);
  const listeners = {};
  const attributes = {};
  const el = {
    id,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c) => { if (classes.has(c)) classes.delete(c); else classes.add(c); }
    },
    style: {
      display: '',
      setProperty: (k, v) => { el.style[k] = v; },
      getPropertyValue: (k) => el.style[k] || ''
    },
    textContent: '',
    innerHTML: '',
    value: '',
    hidden: false,
    setAttribute: (k, v) => {
      attributes[k] = String(v);
      if (k === 'hidden') el.hidden = true;
    },
    getAttribute: (k) => attributes[k] || null,
    removeAttribute: (k) => {
      delete attributes[k];
      if (k === 'hidden') el.hidden = false;
    },
    appendChild: () => {},
    removeChild: () => {},
    getBoundingClientRect: () => ({ width: 390, height: 844, top: 0, left: 0, right: 390, bottom: 844, x: 0, y: 0 }),
    focus: () => {},
    blur: () => {},
    click: () => {},
    matches: () => false,
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (evt, fn) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (evt) => {
      if (listeners[evt]) listeners[evt].forEach(fn => fn());
    }
  };
  domStore[id] = el;
  return el;
}

const windowListeners = {};
global.window = {
  location: { search: '', href: 'http://localhost:18102/index.html', pathname: '/index.html', origin: 'http://localhost:18102' },
  addEventListener: (evt, fn) => {
    windowListeners[evt] = windowListeners[evt] || [];
    windowListeners[evt].push(fn);
  },
  removeEventListener: () => {},
  history: { replaceState: () => {} },
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3
};
global.addEventListener = global.window.addEventListener;
global.removeEventListener = global.window.removeEventListener;

global.navigator = { share: () => Promise.resolve(), clipboard: { writeText: () => Promise.resolve() } };
global.performance = { now: () => Date.now() };

global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: (tag) => createMockElement(tag || 'element'),
  getElementById: (id) => createMockElement(id),
  querySelectorAll: () => [],
  querySelector: () => null,
  documentElement: createMockElement('documentElement'),
  body: createMockElement('body')
};

global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.cancelAnimationFrame = () => {};

const originalSetInterval = global.setInterval;
const activeIntervals = [];
global.setInterval = (fn, ms) => {
  const id = originalSetInterval(fn, ms);
  activeIntervals.push(id);
  return id;
};

global.localStorage = {
  store: {},
  getItem: (k) => global.localStorage.store[k] || null,
  setItem: (k, v) => { global.localStorage.store[k] = String(v); },
  removeItem: (k) => { delete global.localStorage.store[k]; }
};

global.KOINONIA_DATA = Object.assign(
  {},
  placesModule,
  questsModule,
  progressionModule,
  campaignsModule,
  eventsModule,
  memoriesModule,
  sportsModule
);
global.window.KOINONIA_DATA = global.KOINONIA_DATA;

// Execute game.js in mock environment
vm.runInThisContext(gameContent);

const runtimeGame = (global.window && global.window.KOINONIA_GAME) || global.KOINONIA_GAME;
assert(runtimeGame && typeof runtimeGame.getState === 'function', 126, 'game.js loaded and exported KOINONIA_GAME');
assert(runtimeGame.SAVE_STORAGE_KEY === 'koinonia.phase19.save', 127, 'Runtime save key is koinonia.phase19.save');

// Seed clean state into storage and hydrate
const cleanSeed = memoriesModule.createJourneyReadyQaState();
global.localStorage.setItem('koinonia.phase19.save', JSON.stringify(cleanSeed));
const loadSuccess = runtimeGame.loadFromStorage();
assert(loadSuccess === true, 128, 'Runtime loadFromStorage succeeds from clean QA state');

const hState = runtimeGame.getState();
assert(hState.lp === 135 && hState.charXp === 15, 129, 'Runtime hydrated state has LP=135 and XP=15');
assert(Array.isArray(hState.memories) && hState.memories.length === 0, 130, 'Runtime hydrated state has 0 memories');

// Open My Journey UI
runtimeGame.openJourneyModal('timeline');
assert(!domStore['journey-modal'].classList.contains('hidden'), 131, 'openJourneyModal opens #journey-modal');

// Create a quest memory
const addRes = memoriesModule.addMemoryIfNew(hState, {
  memoryType: 'QUEST_COMPLETED',
  sourceType: 'QUEST',
  sourceId: 'Q-001',
  title: 'Steward of the Garden',
  subtitle: 'Veranda plant watering',
  description: 'Watered the potted plants at home.',
  placeId: 'my_home',
  icon: '🌱'
});
assert(addRes.added === true, 132, 'Quest memory created in runtime state');

// Refresh Timeline
runtimeGame.renderJourneyTimeline();
assert(domStore['journey-timeline-list'].innerHTML.includes('Steward of the Garden'), 133, 'Timeline list renders quest memory card');

// Open Memory Detail
const qMemId = hState.memories[0].id;
runtimeGame.openMemoryDetail(qMemId);
assert(!domStore['memory-detail-modal'].classList.contains('hidden'), 134, 'openMemoryDetail opens #memory-detail-modal');
assert(domStore['memory-detail-title'].textContent === 'Steward of the Garden', 135, 'Detail modal shows quest title');

// Open Reflection Editor
runtimeGame.openReflectionEditor(qMemId);
assert(!domStore['reflection-editor-modal'].classList.contains('hidden'), 136, 'openReflectionEditor opens #reflection-editor-modal');

// Enter reflection and save
domStore['reflection-editor-textarea'].value = 'Caring for living plants honors God.';
runtimeGame.saveReflection();
assert(domStore['reflection-editor-modal'].classList.contains('hidden'), 137, 'saveReflection closes reflection editor modal');

// Verify reflection in state and detail view
assert(hState.memories[0].reflectionText === 'Caring for living plants honors God.', 138, 'Reflection stored in memory object');
assert(domStore['mem-detail-reflection-content'].textContent.includes('Caring for living plants honors God.'), 139, 'Detail modal displays reflection text');
assert(domStore['journey-stat-lp'].textContent.includes('135'), 140, 'LP display unchanged (135 LP)');

// Round-trip save and reload
runtimeGame.saveToStorage('test_reflection');
const rawStored = JSON.parse(global.localStorage.getItem('koinonia.phase19.save'));
assert(Array.isArray(rawStored.memories) && rawStored.memories.length === 1, 141, 'Storage contains exactly 1 memory');
assert(rawStored.memories[0].reflectionText === 'Caring for living plants honors God.', 142, 'Storage preserves reflection text with 100% fidelity');

// Re-hydrate
hState.memories = [];
runtimeGame.loadFromStorage();
const rehydratedState = runtimeGame.getState();
assert(rehydratedState.memories.length === 1, 143, 'Rehydrated state restores 1 memory');
assert(rehydratedState.memories[0].reflectionText === 'Caring for living plants honors God.', 144, 'Rehydrated memory has exact reflection preserved');

// Close detail
runtimeGame.closeMemoryDetail();
assert(domStore['memory-detail-modal'].classList.contains('hidden'), 145, 'closeMemoryDetail closes detail modal');

// ============================================================================
// SECTION 12: EVENT MEMORY RENDERING & DEDUPLICATION (Tests 146 - 155)
// ============================================================================
console.log('\n--- SECTION 12: EVENT MEMORY RENDERING & DEDUPLICATION ---');

// Record event attendance in runtime
const evRes = memoriesModule.addMemoryIfNew(hState, {
  id: 'ev_mem_alpha_s01',
  memoryType: 'EVENT_ATTENDED',
  sourceType: 'EVENT',
  sourceId: 'alpha_s01_20260912',
  title: 'Alpha Youth Series — Session 1',
  subtitle: 'Life: Is This It? • FOG Community Center',
  description: 'Gathered with youth fellowship for discussion.',
  placeId: 'fog_center',
  icon: '❓',
  metadata: {
    eventName: 'Alpha Youth Series',
    sessionTitle: 'Life: Is This It?',
    participated: true,
    badgeText: 'YOU WERE THERE'
  },
  isDemo: true
});
assert(evRes.added === true, 146, 'Event memory added to runtime state');

// Re-attempt event attendance memory
const evResDup = memoriesModule.addMemoryIfNew(hState, {
  memoryType: 'EVENT_ATTENDED',
  sourceType: 'EVENT',
  sourceId: 'alpha_s01_20260912',
  title: 'Alpha Youth Series — Session 1'
});
assert(evResDup.added === false, 147, 'Duplicate event attendance memory rejected');

// Render event in detail view
runtimeGame.openMemoryDetail('ev_mem_alpha_s01');
assert(domStore['mem-detail-badges'].innerHTML.includes('DEMO MEMORY'), 148, 'Detail view displays DEMO MEMORY badge');
assert(domStore['mem-detail-badges'].innerHTML.includes('YOU WERE THERE'), 149, 'Detail view displays YOU WERE THERE badge');
assert(domStore['mem-detail-meta-box'].innerHTML.includes('FOG Community Center'), 150, 'Detail view shows place name FOG Community Center');

// Filter memories tab by EVENTS
runtimeGame.filterMemories('EVENTS');
assert(domStore['journey-memories-list'].innerHTML.includes('Alpha Youth Series'), 151, 'Memories tab with EVENTS filter displays event card');

// Filter memories tab by QUESTS
runtimeGame.filterMemories('QUESTS');
assert(domStore['journey-memories-list'].innerHTML.includes('Steward of the Garden'), 152, 'Memories tab with QUESTS filter displays quest card');
assert(!domStore['journey-memories-list'].innerHTML.includes('Alpha Youth Series'), 153, 'Memories tab with QUESTS filter does not show event card');

// Filter memories tab by ALL
runtimeGame.filterMemories('ALL');
assert(domStore['journey-memories-list'].innerHTML.includes('Steward of the Garden') && domStore['journey-memories-list'].innerHTML.includes('Alpha Youth Series'), 154, 'Filter ALL displays both memories');

runtimeGame.closeMemoryDetail();
assert(domStore['memory-detail-modal'].classList.contains('hidden'), 155, 'Detail modal closed');

// ============================================================================
// SECTION 13: PLACE HISTORY LIVE NAVIGATION & REVISITS (Tests 156 - 165)
// ============================================================================
console.log('\n--- SECTION 13: PLACE HISTORY LIVE NAVIGATION & REVISITS ---');

// First visit to Sports Hub
memoriesModule.recordPlaceVisit(hState, 'sports_hub', '2026-09-06T11:00:00+08:00');
assert(hState.placeHistory['sports_hub'].visitCount === 1, 156, 'Sports Hub visit count is 1');
assert(hState.memories.some(m => m.memoryType === 'PLACE_DISCOVERED' && m.sourceId === 'sports_hub'), 157, 'Sports Hub discovery memory generated');

// Visit School
memoriesModule.recordPlaceVisit(hState, 'school', '2026-09-06T12:00:00+08:00');
assert(hState.placeHistory['school'].visitCount === 1, 158, 'School visit count is 1');

// Revisit Sports Hub
memoriesModule.recordPlaceVisit(hState, 'sports_hub', '2026-09-06T16:00:00+08:00');
assert(hState.placeHistory['sports_hub'].visitCount === 2, 159, 'Sports Hub visit count incremented to 2');

const sportsDiscCount = hState.memories.filter(m => m.memoryType === 'PLACE_DISCOVERED' && m.sourceId === 'sports_hub').length;
assert(sportsDiscCount === 1, 160, 'Exactly 1 PLACE_DISCOVERED memory exists for sports_hub');

// Render Places Tab
runtimeGame.switchJourneyTab('places');
assert(domStore['journey-places-list'].innerHTML.includes('Sports Hub'), 161, 'Places tab renders Sports Hub');
assert(domStore['journey-places-list'].innerHTML.includes('Visited: 2 times'), 162, 'Places tab displays Visited: 2 times for Sports Hub');

// Open Place History Modal
runtimeGame.openPlaceHistoryModal('sports_hub');
assert(!domStore['place-history-modal'].classList.contains('hidden'), 163, 'openPlaceHistoryModal opens #place-history-modal');
assert(domStore['place-hist-visits'].textContent === '2', 164, 'Place history modal displays 2 visits');

runtimeGame.closePlaceHistoryModal();
assert(domStore['place-history-modal'].classList.contains('hidden'), 165, 'closePlaceHistoryModal closes modal');

// ============================================================================
// SECTION 14: FIT QUEST PB PROGRESSION & ANTI-FARMING (Tests 166 - 175)
// ============================================================================
console.log('\n--- SECTION 14: FIT QUEST PB PROGRESSION & ANTI-FARMING ---');

// Attempt 1: 4 makes (Initial PB)
const pbRes1 = memoriesModule.addMemoryIfNew(hState, {
  memoryType: 'PERSONAL_BEST',
  sourceType: 'FIT_QUEST',
  sourceId: 'FQ-V001',
  title: 'New Personal Best: Free Throw Focus',
  subtitle: '4 / 10 makes',
  description: 'First personal best recorded.',
  placeId: 'sports_hub',
  metadata: { isPersonalBest: true, newScore: 4, scoreDisplay: '4/10 makes' }
});
assert(pbRes1.added === true, 166, 'PB memory generated for initial 4 makes');

// Attempt 2: 3 makes (Worse, no PB)
const pbRes2 = memoriesModule.addMemoryIfNew(hState, {
  memoryType: 'PERSONAL_BEST',
  sourceType: 'FIT_QUEST',
  sourceId: 'FQ-V001',
  title: 'Free Throw Focus',
  metadata: { isPersonalBest: false, newScore: 3 }
});
assert(pbRes2.added === false, 167, 'Worse attempt produces NO memory');

// Attempt 3: 4 makes (Repeat score, no PB)
const pbRes3 = memoriesModule.addMemoryIfNew(hState, {
  memoryType: 'PERSONAL_BEST',
  sourceType: 'FIT_QUEST',
  sourceId: 'FQ-V001',
  title: 'Free Throw Focus',
  metadata: { isPersonalBest: true, newScore: 4 }
});
assert(pbRes3.added === false, 168, 'Repeat score (4 makes) produces NO duplicate memory');

// Attempt 4: 7 makes (Improvement, PB!)
const pbRes4 = memoriesModule.addMemoryIfNew(hState, {
  memoryType: 'PERSONAL_BEST',
  sourceType: 'FIT_QUEST',
  sourceId: 'FQ-V001',
  title: 'New Personal Best: Free Throw Focus',
  subtitle: '7 / 10 makes (Previous: 4 / 10)',
  description: 'Improved timing and consistency.',
  placeId: 'sports_hub',
  metadata: { isPersonalBest: true, previousScore: 4, newScore: 7, scoreDisplay: '7/10 makes' }
});
assert(pbRes4.added === true, 169, 'Improved PB (7 makes) creates new PB memory');

const bballPbMems = hState.memories.filter(m => m.sourceType === 'FIT_QUEST' && m.sourceId === 'FQ-V001');
assert(bballPbMems.length === 2, 170, 'State has exactly 2 PB memories for FQ-V001');

// Economy verification: PB memory creation did not alter LP or XP
assert(hState.lp === 135, 171, 'LP remains at baseline 135 (0 inflation from PBs)');
assert(hState.charXp === 15, 172, 'Char XP remains at baseline 15 (0 inflation from PBs)');

// Render Growth Tab
runtimeGame.switchJourneyTab('growth');
assert(htmlContent.includes('Growth comes through practice'), 173, 'Growth tab renders encouraging guidance copy');
assert(domStore['journey-growth-list'].innerHTML.includes('Stewardship'), 174, 'Growth tab lists Stewardship growth area');
assert(domStore['journey-growth-list'].innerHTML.includes('Discipline'), 175, 'Growth tab lists Discipline growth area');

// ============================================================================
// SECTION 15: MOBILE PORTRAIT RUNTIME NAVIGATION & OVERLAY TESTS (Tests 176 - 205)
// ============================================================================
console.log('\n--- SECTION 15: MOBILE PORTRAIT RUNTIME NAVIGATION & OVERLAY TESTS ---');

// 1. Structural CSS & DOM Checks
assert(htmlContent.includes('class="bottom-sheet journey-bottom-sheet"'), 176, 'journey-modal uses isolated journey-bottom-sheet class');
assert(htmlContent.includes('class="journey-header-area"'), 177, 'Region A: .journey-header-area exists in DOM');
assert(htmlContent.includes('id="journey-tab-bar"'), 178, 'Region B: #journey-tab-bar exists in DOM');
assert(htmlContent.includes('id="journey-content-area"'), 179, 'Region C: #journey-content-area exists in DOM');

// Verify tab bar is sibling of header and content area (never trapped inside scrollable body)
const headerIndex = htmlContent.indexOf('journey-header-area');
const tabBarIndex = htmlContent.indexOf('id="journey-tab-bar"');
const contentIndex = htmlContent.indexOf('id="journey-content-area"');
assert(headerIndex < tabBarIndex && tabBarIndex < contentIndex, 180, 'DOM hierarchy: Region A (header) -> Region B (tab bar) -> Region C (content)');

// CSS properties verification
assert(cssContent.includes('.journey-bottom-sheet'), 181, 'styles.css defines .journey-bottom-sheet');
assert(cssContent.includes('overflow: hidden !important') || cssContent.includes('overflow: hidden;'), 182, 'journey-bottom-sheet has overflow: hidden');
assert(cssContent.includes('.journey-tabs-bar'), 183, 'styles.css defines .journey-tabs-bar');
assert(cssContent.includes('position: sticky'), 184, 'journey-tabs-bar specifies position: sticky');
assert(cssContent.includes('.journey-content-area'), 185, 'styles.css defines .journey-content-area');
assert(cssContent.includes('overflow-y: auto') && cssContent.includes('min-height: 0'), 186, 'journey-content-area has independent vertical scroll and min-height: 0');

// Subview top controls verification
assert(htmlContent.includes('id="btn-top-back-places"'), 187, 'Place History contains top ← BACK TO PLACES button');
assert(htmlContent.includes('id="btn-close-place-history"'), 188, 'Place History contains top close ✕ button');
assert(htmlContent.includes('id="btn-top-back-journey"'), 189, 'Memory Detail contains top ← BACK button');
assert(htmlContent.includes('id="btn-close-mem-detail"'), 190, 'Memory Detail contains top close ✕ button');

// Mobile Viewport Simulation across common devices
const mobileViewports = [
  { name: 'iPhone SE (375x667)', w: 375, h: 667 },
  { name: 'iPhone 12/13/14 (390x844)', w: 390, h: 844 },
  { name: 'iPhone XR/11 (414x896)', w: 414, h: 896 }
];

mobileViewports.forEach((vp, idx) => {
  global.window.innerWidth = vp.w;
  global.window.innerHeight = vp.h;

  // Open My Journey
  runtimeGame.openJourneyModal('timeline');
  assert(domStore['tab-btn-timeline'].classList.contains('active'), 191 + idx * 3, `${vp.name}: Journey opens cleanly with TIMELINE active`);

  // Navigate to MEMORIES tab
  runtimeGame.switchJourneyTab('memories');
  assert(domStore['tab-btn-memories'].classList.contains('active'), 192 + idx * 3, `${vp.name}: Navigates to MEMORIES tab without obscuring tabs`);

  // Navigate to PLACES tab
  runtimeGame.switchJourneyTab('places');
  assert(domStore['tab-btn-places'].classList.contains('active'), 193 + idx * 3, `${vp.name}: Navigates to PLACES tab without obscuring tabs`);
});

// Test Subview Navigation Flow:
// 1. Open Place History from Places tab
runtimeGame.openPlaceHistoryModal('sports_hub');
assert(!domStore['place-history-modal'].classList.contains('hidden'), 200, 'Place History modal opens');

// 2. Click top back button to return to Places tab
runtimeGame.closePlaceHistoryModal();
assert(domStore['place-history-modal'].classList.contains('hidden'), 201, 'Top back button closes Place History');
assert(!domStore['journey-modal'].classList.contains('hidden'), 202, 'User returns to My Journey sheet with all tabs accessible');
assert(domStore['tab-btn-places'].classList.contains('active'), 203, 'PLACES tab remains active upon return');

// 3. Navigate to Growth tab
runtimeGame.switchJourneyTab('growth');
assert(domStore['tab-btn-growth'].classList.contains('active'), 204, 'Navigates to GROWTH tab cleanly');

// 4. Return to Timeline tab
runtimeGame.switchJourneyTab('timeline');
assert(domStore['tab-btn-timeline'].classList.contains('active'), 205, 'Navigates back to TIMELINE with full tab cycle intact');

// ============================================================================
// SECTION 16: EXCLUSIVE TAB VIEW VISIBILITY & RAPID SWITCH TESTS (Tests 206 - 235)
// ============================================================================
console.log('\n--- SECTION 16: EXCLUSIVE TAB VIEW VISIBILITY & RAPID SWITCH TESTS ---');

function isViewVisible(el) {
  if (!el) return false;
  if (el.hidden === true) return false;
  if (el.style && el.style.display === 'none') return false;
  if (el.classList && el.classList.contains('hidden')) return false;
  if (el.classList && !el.classList.contains('active')) return false;
  return true;
}

function getVisibleJourneyViews() {
  const tabs = ['timeline', 'memories', 'places', 'growth'];
  return tabs.filter(t => isViewVisible(domStore[`journey-view-${t}`]));
}

// 1. CSS specificity & exclusivity rule validation
assert(cssContent.includes('.hidden') && cssContent.includes('display: none !important'), 206, 'styles.css enforces .hidden with display: none !important');
assert(cssContent.includes('[hidden]') && cssContent.includes('display: none !important'), 207, 'styles.css enforces [hidden] with display: none !important');
assert(cssContent.includes('.journey-tab-view') && cssContent.includes('display: none'), 208, 'styles.css defines .journey-tab-view default display: none');
assert(cssContent.includes('.journey-tab-view.active') && cssContent.includes('display: block !important'), 209, 'styles.css defines .journey-tab-view.active display: block !important');
assert(cssContent.includes('.journey-tab-view.hidden') && cssContent.includes('display: none !important'), 210, 'styles.css defines .journey-tab-view.hidden display: none !important');

// 2. DOM Isolation verification in HTML
// Ensure filter chips are ONLY inside memories view
const memViewStart = htmlContent.indexOf('id="journey-view-memories"');
const memViewEnd = htmlContent.indexOf('id="journey-view-places"');
const chipsPos = htmlContent.indexOf('id="memories-filter-chips"');
assert(chipsPos > memViewStart && chipsPos < memViewEnd, 211, '#memories-filter-chips is contained strictly inside #journey-view-memories');

// 3. Tab Exclusivity Verification: TIMELINE
global.window.innerWidth = 390;
global.window.innerHeight = 844;
runtimeGame.openJourneyModal('timeline');

assert(isViewVisible(domStore['journey-view-timeline']), 212, 'TIMELINE view is visible');
assert(!isViewVisible(domStore['journey-view-memories']), 213, 'MEMORIES view is hidden while TIMELINE is active');
assert(!isViewVisible(domStore['journey-view-places']), 214, 'PLACES view is hidden while TIMELINE is active');
assert(!isViewVisible(domStore['journey-view-growth']), 215, 'GROWTH view is hidden while TIMELINE is active');
assert(getVisibleJourneyViews().length === 1, 216, 'Exactly 1 Journey tab view visible on TIMELINE tab');

// 4. Tab Exclusivity Verification: MEMORIES
runtimeGame.switchJourneyTab('memories');
assert(!isViewVisible(domStore['journey-view-timeline']), 217, 'TIMELINE view is hidden while MEMORIES is active');
assert(isViewVisible(domStore['journey-view-memories']), 218, 'MEMORIES view is visible');
assert(!isViewVisible(domStore['journey-view-places']), 219, 'PLACES view is hidden while MEMORIES is active');
assert(!isViewVisible(domStore['journey-view-growth']), 220, 'GROWTH view is hidden while MEMORIES is active');
assert(getVisibleJourneyViews().length === 1, 221, 'Exactly 1 Journey tab view visible on MEMORIES tab');

// 5. Tab Exclusivity Verification: PLACES
runtimeGame.switchJourneyTab('places');
assert(!isViewVisible(domStore['journey-view-timeline']), 222, 'TIMELINE view is hidden while PLACES is active');
assert(!isViewVisible(domStore['journey-view-memories']), 223, 'MEMORIES view is hidden while PLACES is active');
assert(isViewVisible(domStore['journey-view-places']), 224, 'PLACES view is visible');
assert(!isViewVisible(domStore['journey-view-growth']), 225, 'GROWTH view is hidden while PLACES is active');
assert(getVisibleJourneyViews().length === 1, 226, 'Exactly 1 Journey tab view visible on PLACES tab');

// 6. Tab Exclusivity Verification: GROWTH
runtimeGame.switchJourneyTab('growth');
assert(!isViewVisible(domStore['journey-view-timeline']), 227, 'TIMELINE view is hidden while GROWTH is active');
assert(!isViewVisible(domStore['journey-view-memories']), 228, 'MEMORIES view is hidden while GROWTH is active');
assert(!isViewVisible(domStore['journey-view-places']), 229, 'PLACES view is hidden while GROWTH is active');
assert(isViewVisible(domStore['journey-view-growth']), 230, 'GROWTH view is visible');
assert(getVisibleJourneyViews().length === 1, 231, 'Exactly 1 Journey tab view visible on GROWTH tab');

// 7. Rapid Switching Sequence: TIMELINE -> MEMORIES -> PLACES -> GROWTH -> TIMELINE -> PLACES -> MEMORIES
const rapidSequence = ['timeline', 'memories', 'places', 'growth', 'timeline', 'places', 'memories'];
let rapidAllSingle = true;
rapidSequence.forEach(tab => {
  runtimeGame.switchJourneyTab(tab);
  const visibleViews = getVisibleJourneyViews();
  if (visibleViews.length !== 1 || visibleViews[0] !== tab) {
    rapidAllSingle = false;
  }
});
assert(rapidAllSingle === true, 232, 'Rapid tab switching sequence maintains strictly 1 active visible view at all times');

// 8. Data Duplication Verification
const currentMemories = hState.memories || [];
const uniqueIds = new Set(currentMemories.map(m => m.id));
assert(uniqueIds.size === currentMemories.length, 233, 'Underlying state.memories contains 100% unique IDs (0 data duplication)');

// 9. Multi-viewport exclusive verification (375x667, 390x844, 414x896)
let allViewportsExclusive = true;
[375, 390, 414].forEach(w => {
  global.window.innerWidth = w;
  ['timeline', 'memories', 'places', 'growth'].forEach(t => {
    runtimeGame.switchJourneyTab(t);
    if (getVisibleJourneyViews().length !== 1) allViewportsExclusive = false;
  });
});
assert(allViewportsExclusive === true, 234, 'All mobile phone viewports maintain strictly exclusive 1-tab visibility');

// 10. Cache buster verification
assert(htmlContent.includes('styles.css?v=0.19.2'), 235, 'index.html references cache-busted styles.css?v=0.19.2');

// Final cleanup and summary
activeIntervals.forEach(clearInterval);

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
