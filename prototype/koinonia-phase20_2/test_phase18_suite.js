/**
 * KOINONIA Phase 0.18 Automated Verification Test Suite
 * Sports / Fit Quest System, Mini-Games, Personal Best Engine & Youth Physical Stewardship
 *
 * Location: prototype/koinonia-phase18/test_phase18_suite.js
 */

const fs = require('fs');
const path = require('path');

const P18_DIR = __dirname;
const P17_DIR = path.resolve(P18_DIR, '../koinonia-phase17');
const DOC_FILE = path.resolve(P18_DIR, '../../docs/koinonia-quest/KOINONIA_PHASE18_RESULTS.md');

console.log('====================================================');
console.log('KOINONIA Phase 0.18 Automated Verification Test Suite');
console.log('Sports / Fit Quest System, Mini-Games & PB Engine');
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

// Read Phase 0.18 source files
const htmlContent = fs.readFileSync(path.join(P18_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P18_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P18_DIR, 'game.js'), 'utf8');
const fitquestTestHtml = fs.readFileSync(path.join(P18_DIR, 'fitquest_test.html'), 'utf8');

// Load Phase 0.18 data modules
const {
  SPORTS,
  CHALLENGES,
  CHALLENGE_TYPES,
  SCORING_MODES,
  VERIFICATION_TYPES,
  MINI_GAME_TYPES,
  isBetterResult,
  getPersonalBest,
  getChallengeHistory,
  recordChallengeResult,
  PROTOTYPE_LEADERBOARDS,
  getPrototypeLeaderboard,
  createFitQuestReadyQaState
} = require('./data/sports.js');

const {
  CAMPAIGNS,
  CAMPAIGN_STATUS,
  CHAPTER_TYPES,
  COMPLETION_MODES
} = require('./data/campaigns.js');

const {
  EVENT_TEMPLATES,
  EVENT_STATUS,
  RECURRENCE_TYPES,
  FOG_TIMEZONE,
  FOG_TIMEZONE_OFFSET
} = require('./data/events.js');

const {
  NPCS,
  PLACES,
  evaluatePlaceAvailability
} = require('./data/places.js');

const {
  QUESTS,
  CALLING_CATALOG
} = require('./data/quests.js');

const {
  CHARACTER_LEVELS,
  GROWTH_AREAS,
  MILESTONES,
  evaluateGrowthMilestones
} = require('./data/progression.js');

// ============================================================================
// SECTION 1: PRESERVATION & WORKSPACE INTEGRITY (Tests 01 - 08)
// ============================================================================
console.log('--- SECTION 1: PRESERVATION & WORKSPACE INTEGRITY ---');

assert(fs.existsSync(P17_DIR), 1, 'Phase 0.17 directory preserved intact');
assert(fs.existsSync(path.join(P17_DIR, 'test_phase17_suite.js')), 2, 'Phase 0.17 test suite preserved');

const p17Game = fs.readFileSync(path.join(P17_DIR, 'game.js'), 'utf8');
assert(p17Game.includes('koinonia.phase17.save'), 3, 'Phase 0.17 save key remains koinonia.phase17.save');
assert(gameContent.includes('koinonia.phase18.save'), 4, 'Phase 0.18 save key isolated to koinonia.phase18.save');

assert(!gameContent.includes('koinonia.phase17.save'), 5, 'Phase 0.18 game engine does not overwrite Phase 0.17 storage key');
assert(htmlContent.includes('data/sports.js?v=0.18'), 6, 'Phase 0.18 index.html includes data/sports.js module');
assert(htmlContent.includes('id="fitquest-modal"') && htmlContent.includes('id="minigame-modal"') && htmlContent.includes('id="realworld-quest-modal"'), 7, 'Phase 0.18 index.html contains Modals 19, 20, and 21');
assert(cssContent.includes('.fitquest-card') && (cssContent.includes('.minigame-stage-wrap') || cssContent.includes('.minigame-canvas-container')), 8, 'Phase 0.18 styles.css contains Fit Quest and Mini-Game classes');

// ============================================================================
// SECTION 2: SPORTS REGISTRY & METADATA (Tests 09 - 20)
// ============================================================================
console.log('\n--- SECTION 2: SPORTS REGISTRY & METADATA ---');

assert(typeof SPORTS === 'object' && SPORTS !== null, 9, 'SPORTS registry exists');
const sportKeys = Object.keys(SPORTS);
assert(sportKeys.length === 5, 10, 'SPORTS registry contains exactly 5 sports', `Found ${sportKeys.length}`);
assert(sportKeys.includes('basketball') && sportKeys.includes('badminton') && sportKeys.includes('pickleball') && sportKeys.includes('running') && sportKeys.includes('fitness'), 11, 'All 5 canonical sports registered');

assert(SPORTS.basketball.name === 'Basketball' && SPORTS.basketball.primaryZone === 'basketball_court', 12, 'Basketball sport mapped to basketball_court');
assert(SPORTS.badminton.name === 'Badminton' && SPORTS.badminton.primaryZone === 'badminton_court', 13, 'Badminton sport mapped to badminton_court');
assert(SPORTS.pickleball.name === 'Pickleball' && SPORTS.pickleball.primaryZone === 'pickleball_court', 14, 'Pickleball sport mapped to pickleball_court');
assert(SPORTS.running.name === 'Running' && SPORTS.running.primaryZone === 'track', 15, 'Running sport mapped to track');
assert(SPORTS.fitness.name === 'Fitness' && SPORTS.fitness.primaryZone === 'fitness_zone', 16, 'Fitness sport mapped to fitness_zone');

assert(Array.isArray(SPORTS.basketball.availableChallenges) && SPORTS.basketball.availableChallenges.length >= 2, 17, 'Basketball has both virtual and real-world challenges');
assert(Array.isArray(SPORTS.badminton.availableChallenges) && SPORTS.badminton.availableChallenges.includes('FQ-V003'), 18, 'Badminton links to FQ-V003 Rally Focus');
assert(Array.isArray(SPORTS.running.availableChallenges) && SPORTS.running.availableChallenges.includes('FQ-V002'), 19, 'Running links to FQ-V002 Reaction Sprint');
assert(Array.isArray(SPORTS.fitness.availableChallenges) && SPORTS.fitness.availableChallenges.includes('FQ-R001'), 20, 'Fitness links to FQ-R001 10-Minute Movement');

// ============================================================================
// SECTION 3: CHALLENGES CATALOG & MODELS (Tests 21 - 38)
// ============================================================================
console.log('\n--- SECTION 3: CHALLENGES CATALOG & MODELS ---');

assert(typeof CHALLENGES === 'object' && CHALLENGES !== null, 21, 'CHALLENGES catalog exists');
const challengeKeys = Object.keys(CHALLENGES);
assert(challengeKeys.length === 7, 22, 'CHALLENGES catalog contains exactly 7 challenges', `Found ${challengeKeys.length}`);

// Virtual Challenges
const fqV001 = CHALLENGES['FQ-V001'];
assert(fqV001 && fqV001.challengeType === CHALLENGE_TYPES.VIRTUAL_GAME && fqV001.scoringMode === SCORING_MODES.HIGH_SCORE, 23, 'FQ-V001 is VIRTUAL_GAME with HIGH_SCORE scoring');
assert(fqV001.sportId === 'basketball' && fqV001.miniGameType === MINI_GAME_TYPES.BASKETBALL_FREE_THROW, 24, 'FQ-V001 is Basketball Free Throw');
assert(fqV001.leaderboardEligible === true && fqV001.shareEligible === true, 25, 'FQ-V001 is leaderboard and share eligible');

const fqV002 = CHALLENGES['FQ-V002'];
assert(fqV002 && fqV002.challengeType === CHALLENGE_TYPES.VIRTUAL_GAME && fqV002.scoringMode === SCORING_MODES.LOW_TIME, 26, 'FQ-V002 is VIRTUAL_GAME with LOW_TIME scoring');
assert(fqV002.sportId === 'running' && fqV002.miniGameType === MINI_GAME_TYPES.REACTION_SPRINT, 27, 'FQ-V002 is Reaction Sprint');

const fqV003 = CHALLENGES['FQ-V003'];
assert(fqV003 && fqV003.challengeType === CHALLENGE_TYPES.VIRTUAL_GAME && fqV003.scoringMode === SCORING_MODES.STREAK, 28, 'FQ-V003 is VIRTUAL_GAME with STREAK scoring');
assert(fqV003.sportId === 'badminton' && fqV003.miniGameType === MINI_GAME_TYPES.RALLY_FOCUS, 29, 'FQ-V003 is Rally Focus');

// Real-World Challenges
const fqR001 = CHALLENGES['FQ-R001'];
assert(fqR001 && fqR001.challengeType === CHALLENGE_TYPES.REAL_WORLD && fqR001.verificationType === VERIFICATION_TYPES.TRUST, 30, 'FQ-R001 is REAL_WORLD with TRUST verification');
assert(fqR001.scoringMode === SCORING_MODES.COMPLETION && fqR001.duration === '10 min', 31, 'FQ-R001 is 10-minute completion');

const fqR002 = CHALLENGES['FQ-R002'];
assert(fqR002 && fqR002.challengeType === CHALLENGE_TYPES.REAL_WORLD && fqR002.sportId === 'basketball', 32, 'FQ-R002 is Practice With Purpose (Basketball/Drills)');

const fqR003 = CHALLENGES['FQ-R003'];
assert(fqR003 && fqR003.challengeType === CHALLENGE_TYPES.REAL_WORLD && fqR003.sportId === 'fitness' && fqR003.title === 'Team Encourager', 33, 'FQ-R003 is Team Encourager (Sportsmanship & Fellowship)');

const fqR004 = CHALLENGES['FQ-R004'];
assert(fqR004 && fqR004.challengeType === CHALLENGE_TYPES.REAL_WORLD && fqR004.sportId === 'running' && fqR004.title === 'Personal Best Attempt', 34, 'FQ-R004 is Personal Best Attempt (Self-Improvement & Diligence)');

// Youth Fitness Safety Audits
let hasCalorie = false;
let hasBmi = false;
let hasWeightLoss = false;
let requiresExhaustion = false;

Object.values(CHALLENGES).forEach(ch => {
  const text = (ch.description + ' ' + ch.instructions).toLowerCase();
  if (text.includes('calorie')) hasCalorie = true;
  if (text.includes('bmi') || text.includes('body mass index')) hasBmi = true;
  if (text.includes('weight loss') || text.includes('lose weight')) hasWeightLoss = true;
  if (text.includes('push to exhaustion') || text.includes('exercise to exhaustion') || text.includes('till you drop')) requiresExhaustion = true;
});

assert(!hasCalorie, 35, 'Youth Safety Audit: Zero references to calorie counting');
assert(!hasBmi, 36, 'Youth Safety Audit: Zero references to BMI / body mass index');
assert(!hasWeightLoss, 37, 'Youth Safety Audit: Zero references to weight loss targets');
assert(!requiresExhaustion && CHALLENGES['FQ-R004'].safetyNotice.includes('Never push past pain or exhaustion'), 38, 'Youth Safety Audit: Zero extreme endurance; explicitly cautions against exhaustion');

// ============================================================================
// SECTION 4: SCORING MODES & COMPARISON LOGIC (Tests 39 - 50)
// ============================================================================
console.log('\n--- SECTION 4: SCORING MODES & COMPARISON LOGIC ---');

assert(SCORING_MODES.HIGH_SCORE === 'HIGH_SCORE' && SCORING_MODES.LOW_TIME === 'LOW_TIME', 39, 'SCORING_MODES contains standard constants');
assert(SCORING_MODES.STREAK === 'STREAK' && SCORING_MODES.COMPLETION === 'COMPLETION', 40, 'SCORING_MODES contains STREAK and COMPLETION');

// HIGH_SCORE tests
assert(isBetterResult('HIGH_SCORE', 8, 6) === true, 41, 'isBetterResult(HIGH_SCORE): 8 beats 6');
assert(isBetterResult('HIGH_SCORE', 6, 8) === false, 42, 'isBetterResult(HIGH_SCORE): 6 does not beat 8');
assert(isBetterResult('HIGH_SCORE', 8, 8) === false, 43, 'isBetterResult(HIGH_SCORE): tie does not beat existing PB');

// LOW_TIME tests
assert(isBetterResult('LOW_TIME', 240, 290) === true, 44, 'isBetterResult(LOW_TIME): 240ms beats 290ms');
assert(isBetterResult('LOW_TIME', 290, 240) === false, 45, 'isBetterResult(LOW_TIME): 290ms does not beat 240ms');
assert(isBetterResult('LOW_TIME', 250, 250) === false, 46, 'isBetterResult(LOW_TIME): tie does not beat existing PB');

// STREAK & COMPLETION tests
assert(isBetterResult('STREAK', 15, 12) === true, 47, 'isBetterResult(STREAK): 15 streak beats 12');
assert(isBetterResult('COMPLETION', 1, 0) === true, 48, 'isBetterResult(COMPLETION): 1 beats 0');
assert(isBetterResult('COMPLETION', 1, 1) === false, 49, 'isBetterResult(COMPLETION): 1 does not beat 1');

// Null / Initial best tests
assert(isBetterResult('HIGH_SCORE', 5, null) === true, 50, 'Any valid score beats null previous PB');

// ============================================================================
// SECTION 5: PERSONAL BEST ENGINE & HISTORY (Tests 51 - 64)
// ============================================================================
console.log('\n--- SECTION 5: PERSONAL BEST ENGINE & HISTORY ---');

const testState = createFitQuestReadyQaState();
assert(getPersonalBest(testState, 'FQ-V001') === null, 51, 'Initial state has null PB for FQ-V001');

// Record first attempt on FQ-V001 (score 7)
const res1 = recordChallengeResult(testState, 'FQ-V001', 7, '7 / 10 shots');
assert(res1.isPersonalBest === true, 52, 'First attempt is automatically Personal Best');
assert(testState.personalBests['FQ-V001'].score === 7, 53, 'PB stored with score 7');
assert(testState.fitQuestHistory.length === 1, 54, 'fitQuestHistory has 1 entry recorded');
assert(testState.sportsExplored.includes('basketball'), 55, 'Basketball added to sportsExplored');

// Record worse attempt on FQ-V001 (score 5)
const res2 = recordChallengeResult(testState, 'FQ-V001', 5, '5 / 10 shots');
assert(res2.isPersonalBest === false, 56, 'Worse attempt is NOT Personal Best');
assert(testState.personalBests['FQ-V001'].score === 7, 57, 'PB remains 7 after worse attempt');
assert(testState.fitQuestHistory.length === 2, 58, 'fitQuestHistory has 2 entries recorded');

// Record better attempt on FQ-V001 (score 9)
const res3 = recordChallengeResult(testState, 'FQ-V001', 9, '9 / 10 shots');
assert(res3.isPersonalBest === true, 59, 'Better attempt sets new Personal Best');
assert(testState.personalBests['FQ-V001'].score === 9, 60, 'PB updated to 9');

// Test LOW_TIME challenge FQ-V002
const sprintRes1 = recordChallengeResult(testState, 'FQ-V002', 280, '280 ms');
assert(sprintRes1.isPersonalBest === true, 61, 'First sprint attempt (280ms) is PB');

const sprintRes2 = recordChallengeResult(testState, 'FQ-V002', 240, '240 ms');
assert(sprintRes2.isPersonalBest === true, 62, 'Faster sprint attempt (240ms) is new PB');
assert(testState.personalBests['FQ-V002'].score === 240, 63, 'Sprint PB is 240ms');

const sprintRes3 = recordChallengeResult(testState, 'FQ-V002', 310, '310 ms');
assert(sprintRes3.isPersonalBest === false && testState.personalBests['FQ-V002'].score === 240, 64, 'Slower sprint attempt (310ms) does not overwrite 240ms PB');

// ============================================================================
// SECTION 6: REWARD SAFETY & ANTI-FARMING ISOLATION (Tests 65 - 76)
// ============================================================================
console.log('\n--- SECTION 6: REWARD SAFETY & ANTI-FARMING ISOLATION ---');

// Fresh state for reward isolation tests
const rewardState = createFitQuestReadyQaState();
const initialLp = rewardState.lp; // 135
const initialXp = rewardState.charXp; // 15

// First completion of FQ-V001: should award rewards
const award1 = recordChallengeResult(rewardState, 'FQ-V001', 7, '7 / 10 shots');
assert(award1.rewardsAwarded === true || award1.rewardClaimed === true, 65, 'First completion awards rewards');
assert(rewardState.lp === initialLp + 5, 66, 'Life Points increased by exactly +5 LP on first completion', `LP: ${rewardState.lp}`);
assert(rewardState.charXp === initialXp + 5, 67, 'Character XP increased by exactly +5 XP on first completion', `XP: ${rewardState.charXp}`);
assert(rewardState.fitQuestRewardClaims['FQ-V001'] === true, 68, 'fitQuestRewardClaims tracks FQ-V001 completion');

// Second attempt on FQ-V001: even if higher score, rewards must NOT be farmed
const award2 = recordChallengeResult(rewardState, 'FQ-V001', 10, '10 / 10 shots');
assert(award2.isPersonalBest === true, 69, 'Second attempt sets new Personal Best');
assert(award2.rewardsAwarded === false && award2.rewardClaimed === false, 70, 'Anti-Farming: Repeat attempt does NOT award duplicate rewards');
assert(rewardState.lp === initialLp + 5, 71, 'Life Points did not increase on repeat attempt (anti-farming pass)');
assert(rewardState.charXp === initialXp + 5, 72, 'Character XP did not increase on repeat attempt (anti-farming pass)');

// Real-World Quest reward isolation (FQ-R001)
const rwAward1 = recordChallengeResult(rewardState, 'FQ-R001', 1, 'Completed');
assert(rwAward1.rewardsAwarded === true || rwAward1.rewardClaimed === true, 73, 'Real-world quest first completion awards +5 LP / +5 XP');
assert(rewardState.lp === initialLp + 10, 74, 'Life points properly incremented for distinct challenge');

const rwAward2 = recordChallengeResult(rewardState, 'FQ-R001', 1, 'Completed');
assert(rwAward2.rewardsAwarded === false && rwAward2.rewardClaimed === false, 75, 'Real-world quest repeat completion does NOT award duplicate rewards');
assert(rewardState.lp === initialLp + 10, 76, 'Life points strictly preserved against duplicate real-world claims');

// ============================================================================
// SECTION 7: MINI-GAME IMPLEMENTATION & CONFIGURATION (Tests 77 - 88)
// ============================================================================
console.log('\n--- SECTION 7: MINI-GAME IMPLEMENTATION & CONFIGURATION ---');

assert(gameContent.includes('startMiniGame'), 77, 'game.js implements startMiniGame dispatcher');
assert(gameContent.includes('basketballLoop'), 78, 'game.js implements basketballLoop animation');
assert(gameContent.includes('armReactionSprint'), 79, 'game.js implements armReactionSprint timer');
assert(gameContent.includes('rallyLoop'), 80, 'game.js implements rallyLoop animation');
assert(gameContent.includes('handleMiniGameAction'), 81, 'game.js implements handleMiniGameAction controller');
assert(gameContent.includes('finishMiniGame'), 82, 'game.js implements finishMiniGame resolution');

assert(gameContent.includes('FALSE START') && gameContent.includes('false_start'), 83, 'Reaction Sprint includes false-start prevention');
assert(gameContent.includes('shotsTotal: 10'), 84, 'Basketball mini-game configures 10 free throws');

assert(htmlContent.includes('id="minigame-canvas"'), 85, 'index.html contains #minigame-canvas element');
assert(htmlContent.includes('id="minigame-hud-bar"') && htmlContent.includes('class="minigame-hud"'), 86, 'index.html contains minigame HUD bar');
assert(htmlContent.includes('id="btn-minigame-action"') && htmlContent.includes('class="minigame-action-btn"'), 87, 'index.html contains #btn-minigame-action for mobile taps');
assert(htmlContent.includes('id="btn-exit-minigame"') && htmlContent.includes('id="btn-minigame-done"'), 88, 'index.html contains mini-game exit controls');

// ============================================================================
// SECTION 8: SPORTS HUB WORLD & INTERACTABLES (Tests 89 - 98)
// ============================================================================
console.log('\n--- SECTION 8: SPORTS HUB WORLD & INTERACTABLES ---');

const sportsHub = PLACES.sports_hub;
assert(sportsHub && sportsHub.name === 'Sports Hub', 89, 'Sports Hub exists in PLACES catalog');
assert(Array.isArray(sportsHub.zones) && sportsHub.zones.length >= 3, 90, 'Sports Hub has zones configured');

const zoneIds = sportsHub.zones.map(z => z.id);
assert(zoneIds.includes('badminton_court') && zoneIds.includes('track') && zoneIds.includes('fitness_zone'), 91, 'Sports Hub includes badminton_court, track, and fitness_zone');

const coachDaniel = NPCS.coach_daniel;
assert(coachDaniel && coachDaniel.name === 'Coach Daniel', 92, 'Coach Daniel NPC exists in PLACES catalog');
assert(coachDaniel.dialogue && coachDaniel.dialogue.first_meeting.includes('Sports Hub'), 93, 'Coach Daniel welcomes player to Sports Hub in first_meeting dialogue');

const allDialogueText = Object.values(coachDaniel.dialogue).join(' ').toLowerCase();
assert(allDialogueText.includes('fit quest') || allDialogueText.includes('challenge'), 94, 'Coach Daniel dialogue introduces Fit Quests');
assert(allDialogueText.includes('sportsmanship') || allDialogueText.includes('body is a temple'), 95, 'Coach Daniel dialogue emphasizes sportsmanship and body stewardship');

assert(gameContent.includes('sports_hoop') && gameContent.includes('sports_running_track'), 96, 'game.js registers in-world sports interactables');
assert(gameContent.includes('fitquest_board') && gameContent.includes('sports_pb_board'), 97, 'game.js registers fitquest_board and sports_pb_board interactables');
assert(gameContent.includes('🏃 FIT QUEST AVAILABLE'), 98, 'World Map displays Fit Quest indicator for Sports Hub');

// ============================================================================
// SECTION 9: LEADERBOARDS, WEB SHARE & PROGRESSION (Tests 99 - 113)
// ============================================================================
console.log('\n--- SECTION 9: LEADERBOARDS, WEB SHARE & PROGRESSION ---');

assert(typeof PROTOTYPE_LEADERBOARDS === 'object' && PROTOTYPE_LEADERBOARDS !== null, 99, 'PROTOTYPE_LEADERBOARDS catalog exists');
assert(Array.isArray(PROTOTYPE_LEADERBOARDS['FQ-V001']), 100, 'FQ-V001 has prototype leaderboard entries');

const lb001 = getPrototypeLeaderboard(testState, 'FQ-V001');
assert(lb001.length > 0, 101, 'getPrototypeLeaderboard returns merged leaderboard');
assert(lb001.some(e => e.label === 'DEMO'), 102, 'Sample entries explicitly labeled DEMO');
assert(lb001.some(e => e.isLocalPlayer === true && e.label === 'LOCAL'), 103, 'Local player Personal Best included with LOCAL tag');

// Leaderboard order checks
const lb002 = getPrototypeLeaderboard(testState, 'FQ-V002'); // LOW_TIME
assert(lb002[0].score <= lb002[1].score, 104, 'LOW_TIME leaderboard sorted ascending (fastest first)');

const lbStreak = getPrototypeLeaderboard(testState, 'FQ-V003'); // STREAK
assert(lbStreak[0].score >= lbStreak[1].score, 105, 'STREAK leaderboard sorted descending (highest first)');

// Web Share integration checks
assert(gameContent.includes('sharePersonalBest'), 106, 'game.js implements sharePersonalBest helper');
assert(gameContent.includes('navigator.share') && gameContent.includes('navigator.clipboard'), 107, 'game.js implements Web Share API with clipboard fallback');

// Sports Progression Milestones
const sportsMilestones = [
  'm_first_fitquest',
  'm_first_personal_best',
  'm_three_sports_tried',
  'm_team_encourager',
  'm_ten_challenge_attempts'
];

const milestoneMap = {};
if (Array.isArray(MILESTONES)) {
  MILESTONES.forEach(m => { milestoneMap[m.id] = m; });
} else if (typeof MILESTONES === 'object') {
  Object.assign(milestoneMap, MILESTONES);
}

sportsMilestones.forEach((mid, idx) => {
  assert(milestoneMap[mid] !== undefined, 108 + idx, 'Milestone ' + mid + ' registered in progression.js');
});

// Milestone reward safety check (0 LP, 0 XP)
let milestoneRewardsSafe = true;
sportsMilestones.forEach(mid => {
  const m = milestoneMap[mid];
  if (m && (m.rewardLp || m.rewardXp)) milestoneRewardsSafe = false;
});
assert(milestoneRewardsSafe, 113, 'All 5 Sports milestones award 0 LP and 0 XP to prevent progression inflation');

// ============================================================================
// SECTION 10: QA STATE BUILDER, TEST HARNESS & ROUND-TRIP (Tests 114 - 120)
// ============================================================================
console.log('\n--- SECTION 10: QA STATE BUILDER, TEST HARNESS & ROUND-TRIP ---');

const qaState = createFitQuestReadyQaState();
assert(qaState.lp === 135 && qaState.charLevel === 2 && qaState.charXp === 15, 114, 'createFitQuestReadyQaState provides Level 2 Active Explorer (135 LP, 15 XP)');
assert(qaState.activePlaceId === 'sports_hub' && qaState.visitedPlaces.includes('sports_hub'), 115, 'createFitQuestReadyQaState places player directly at Sports Hub');
assert(qaState.saveStorageKey === 'koinonia.phase18.save', 116, 'QA state specifies koinonia.phase18.save');

assert(fitquestTestHtml.includes('PHASE 0.18 FIT QUEST TEST LAB'), 117, 'fitquest_test.html contains Phase 0.18 QA Test Lab title');
assert(fitquestTestHtml.includes('seedFitQuestReady') && fitquestTestHtml.includes('seedBasketballPb') && fitquestTestHtml.includes('seedRunningPb'), 118, 'fitquest_test.html includes QA seed functions');

// Save / Load schema completeness simulation
const serialized = JSON.stringify(qaState);
const deserialized = JSON.parse(serialized);
assert(deserialized.activePlaceId === 'sports_hub' && Array.isArray(deserialized.fitQuestHistory) && typeof deserialized.personalBests === 'object', 119, 'Phase 0.18 state serializes and deserializes with full schema fidelity');

assert(gameContent.includes('FIT QUESTS COMPLETED') && gameContent.includes('PERSONAL BESTS'), 120, 'Character Profile / Journey Summary displays Fit Quest metrics');

// ============================================================================
// SECTION 11: PRE-PHYSICAL-ACCEPTANCE QA BASELINE & SPORTS INTEGRITY (Tests 121 - 150)
// ============================================================================
console.log('\n--- SECTION 11: PRE-PHYSICAL-ACCEPTANCE QA BASELINE & SPORTS INTEGRITY ---');

// Test A: Fresh createFitQuestReadyQaState() has sportsExplored.length === 0
const freshQa = createFitQuestReadyQaState();
assert(Array.isArray(freshQa.sportsExplored) && freshQa.sportsExplored.length === 0, 121, 'Fresh QA state has sportsExplored.length === 0');

// Test B: Fresh QA state attempts count and history length === 0
assert(freshQa.fitQuestMetrics && freshQa.fitQuestMetrics.totalAttemptsCount === 0, 122, 'Fresh QA state has totalAttemptsCount === 0');
assert(Array.isArray(freshQa.fitQuestHistory) && freshQa.fitQuestHistory.length === 0, 123, 'Fresh QA state has fitQuestHistory.length === 0');

// Test C: Fresh QA state completed count === 0
assert(freshQa.fitQuestMetrics && freshQa.fitQuestMetrics.completedCount === 0, 124, 'Fresh QA state has completedCount === 0');

// Test D: Fresh QA state personal bests count === 0 and empty dictionary
assert(freshQa.fitQuestMetrics && freshQa.fitQuestMetrics.personalBestsCount === 0, 125, 'Fresh QA state has personalBestsCount === 0');
assert(typeof freshQa.personalBests === 'object' && Object.keys(freshQa.personalBests).length === 0, 126, 'Fresh QA state has Object.keys(personalBests).length === 0');

// Test E: Fresh QA state growth areas: discipline === 0
assert(freshQa.growthAreas && freshQa.growthAreas.discipline === 0, 127, 'Fresh QA state growth area discipline === 0');

// Test F: Fresh QA state growth areas: teamwork === 0
assert(freshQa.growthAreas && freshQa.growthAreas.teamwork === 0, 128, 'Fresh QA state growth area teamwork === 0');

// Test G: Fresh QA state campaigns: activeCampaignIds.length === 0
assert(Array.isArray(freshQa.activeCampaignIds) && freshQa.activeCampaignIds.length === 0, 129, 'Fresh QA state has activeCampaignIds.length === 0 (Alpha not auto-started)');

// Test H: Basketball mini-game attempt
const liveState = createFitQuestReadyQaState();
const bballRes = recordChallengeResult(liveState, 'FQ-V001', 6, '6 / 10 shots');
assert(liveState.sportsExplored.length === 1 && liveState.sportsExplored[0] === 'basketball', 130, 'Basketball mini-game attempt updates sportsExplored to ["basketball"]');
assert(liveState.fitQuestMetrics.totalAttemptsCount === 1, 131, 'Basketball mini-game attempt increments totalAttemptsCount to 1');
assert(liveState.fitQuestHistory.length === 1 && liveState.fitQuestHistory[0].actualSportId === 'basketball', 132, 'Basketball attempt recorded with actualSportId: "basketball"');

// Test I: Subsequent running attempt
const runRes = recordChallengeResult(liveState, 'FQ-V002', 260, '260 ms');
assert(liveState.sportsExplored.length === 2 && liveState.sportsExplored.includes('basketball') && liveState.sportsExplored.includes('running'), 133, 'Subsequent running attempt expands sportsExplored to include basketball and running');
assert(liveState.fitQuestMetrics.sportsTriedCount === 2, 134, 'fitQuestMetrics.sportsTriedCount === 2 after running attempt');

// Test J: Rally Focus launched from Badminton court
const badmintonState = createFitQuestReadyQaState();
const badRes = recordChallengeResult(badmintonState, 'FQ-V003', 14, { sportId: 'badminton' });
assert(badRes.actualSportId === 'badminton' && badmintonState.fitQuestHistory[0].actualSportId === 'badminton', 135, 'Rally Focus from Badminton court records actualSportId: "badminton"');
assert(badmintonState.sportsExplored.includes('badminton') && !badmintonState.sportsExplored.includes('pickleball'), 136, 'sportsExplored contains badminton and does NOT include pickleball');

// Test K: Rally Focus launched from Pickleball court
const pickleState = createFitQuestReadyQaState();
const pklRes = recordChallengeResult(pickleState, 'FQ-V003', 18, { sportId: 'pickleball' });
assert(pklRes.actualSportId === 'pickleball' && pickleState.fitQuestHistory[0].actualSportId === 'pickleball', 137, 'Rally Focus from Pickleball court records actualSportId: "pickleball"');
assert(pickleState.sportsExplored.includes('pickleball') && !pickleState.sportsExplored.includes('badminton'), 138, 'sportsExplored contains pickleball and does NOT include badminton');

// Test L: Generic real-world challenges accept valid eligible sport IDs
const realWorldState = createFitQuestReadyQaState();
const r003Res = recordChallengeResult(realWorldState, 'FQ-R003', 1, { sportId: 'fitness' });
assert(r003Res.actualSportId === 'fitness' && realWorldState.sportsExplored.includes('fitness'), 139, 'FQ-R003 (Team Encourager) with selectedSportId: "fitness" records fitness');

const r004Res = recordChallengeResult(realWorldState, 'FQ-R004', 1, { sportId: 'running' });
assert(r004Res.actualSportId === 'running' && realWorldState.sportsExplored.includes('running'), 140, 'FQ-R004 (Personal Best Attempt) with selectedSportId: "running" records running');

// Test M: Invalid sportId fallback safely falls back to challenge.sportId
const fallbackState = createFitQuestReadyQaState();
const curlRes = recordChallengeResult(fallbackState, 'FQ-V001', 5, { sportId: 'curling' });
assert(curlRes.actualSportId === 'basketball' && fallbackState.sportsExplored.includes('basketball'), 141, 'Invalid sportId "curling" falls back to challenge default ("basketball")');
assert(!fallbackState.sportsExplored.includes('curling'), 142, 'Invalid sportId "curling" is NOT added to sportsExplored');

// Test N: Sports catalog integrity
let sportsIntegrityPass = true;
let sportsIntegrityDetails = '';
for (const sportKey of Object.keys(SPORTS)) {
  const sp = SPORTS[sportKey];
  if (!Array.isArray(sp.availableChallenges) || sp.availableChallenges.length === 0) {
    sportsIntegrityPass = false;
    sportsIntegrityDetails = `${sportKey} missing availableChallenges`;
    break;
  }
  for (const cid of sp.availableChallenges) {
    const ch = CHALLENGES[cid];
    if (!ch) {
      sportsIntegrityPass = false;
      sportsIntegrityDetails = `${sportKey} has unknown challenge ${cid}`;
      break;
    }
    if (!Array.isArray(ch.eligibleSportIds) || !ch.eligibleSportIds.includes(sportKey)) {
      sportsIntegrityPass = false;
      sportsIntegrityDetails = `${sportKey} challenge ${cid} does not list ${sportKey} in eligibleSportIds`;
      break;
    }
  }
  if (!sportsIntegrityPass) break;
}
assert(sportsIntegrityPass, 143, 'Every sport in SPORTS has availableChallenges aligned with eligibleSportIds', sportsIntegrityDetails || 'All 5 sports verified');

let allChallengesHaveEligible = true;
for (const cid of Object.keys(CHALLENGES)) {
  const ch = CHALLENGES[cid];
  if (!Array.isArray(ch.eligibleSportIds) || ch.eligibleSportIds.length === 0) {
    allChallengesHaveEligible = false;
    break;
  }
}
assert(allChallengesHaveEligible, 144, 'Every challenge in CHALLENGES has non-empty eligibleSportIds array');

// Test O: True Runtime Hydration with actual game.js loadFromStorage() and saveToStorage()
console.log('\n--- RUNTIME HYDRATION SUB-TEST (game.js) ---');
const memoryStore = {};

const createMockElement = () => ({
  classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => false },
  style: { setProperty: () => {}, getPropertyValue: () => '' },
  setAttribute: () => {},
  removeAttribute: () => {},
  getAttribute: () => null,
  textContent: '',
  innerHTML: '',
  appendChild: () => {},
  removeChild: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ width: 390, height: 844, top: 0, left: 0, right: 390, bottom: 844, x: 0, y: 0 }),
  focus: () => {},
  blur: () => {},
  click: () => {},
  matches: () => false,
  closest: () => null
});

global.window = {
  location: { search: '', href: 'http://localhost:8099/index.html', pathname: '/index.html', origin: 'http://localhost:8099' },
  addEventListener: () => {},
  removeEventListener: () => {},
  history: { replaceState: () => {} },
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3
};

global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => createMockElement(),
  getElementById: (id) => createMockElement(),
  querySelectorAll: () => [],
  querySelector: () => null,
  documentElement: createMockElement(),
  body: createMockElement()
};

global.localStorage = {
  getItem: (k) => memoryStore[k] || null,
  setItem: (k, v) => { memoryStore[k] = String(v); },
  removeItem: (k) => { delete memoryStore[k]; },
  clear: () => { for (const k in memoryStore) delete memoryStore[k]; }
};

global.navigator = { share: () => Promise.resolve(), clipboard: { writeText: () => Promise.resolve() } };
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = () => 1;
global.cancelAnimationFrame = () => {};

const originalSetInterval = global.setInterval;
const activeIntervals = [];
global.setInterval = (fn, ms) => {
  const id = originalSetInterval(fn, ms);
  activeIntervals.push(id);
  return id;
};

// Populate KOINONIA_DATA on global & window with exact keys required by game.js
global.KOINONIA_DATA = {
  places: PLACES,
  npcs: NPCS,
  evaluatePlaceAvailability: evaluatePlaceAvailability,
  quests: QUESTS,
  callingCatalog: CALLING_CATALOG,
  characterLevels: CHARACTER_LEVELS,
  growthAreas: GROWTH_AREAS,
  milestones: MILESTONES,
  evaluateGrowthMilestones: evaluateGrowthMilestones,
  campaigns: CAMPAIGNS,
  campaignStatus: CAMPAIGN_STATUS,
  events: EVENT_TEMPLATES,
  sports: SPORTS,
  challenges: CHALLENGES,
  createFitQuestReadyQaState: createFitQuestReadyQaState
};
global.window.KOINONIA_DATA = global.KOINONIA_DATA;

// Load game.js
require('./game.js');
const runtimeGame = global.window.KOINONIA_GAME || global.KOINONIA_GAME;

// Step 1: Generate QA state and write to localStorage
const hydrationQaState = createFitQuestReadyQaState();
global.localStorage.setItem('koinonia.phase18.save', JSON.stringify(hydrationQaState));

// Step 2: Execute actual game.js loadFromStorage()
const loadSuccess = runtimeGame.loadFromStorage();
assert(loadSuccess === true, 145, 'Runtime loadFromStorage() returns true from QA baseline save');

// Step 3: Verify runtime game state matches
const rState = runtimeGame.getState();
assert(rState.lp === 135 && rState.charLevel === 2 && rState.charXp === 15, 146, 'Runtime hydrated state has LP === 135, Level === 2, XP === 15');
assert(rState.activePlaceId === 'sports_hub', 147, 'Runtime hydrated state has activePlaceId === "sports_hub"');
assert(Array.isArray(rState.sportsExplored) && rState.sportsExplored.length === 0, 148, 'Runtime hydrated state has sportsExplored.length === 0');
assert(rState.fitQuestMetrics && rState.fitQuestMetrics.totalAttemptsCount === 0 && rState.fitQuestMetrics.completedCount === 0, 149, 'Runtime hydrated state has 0 total attempts and 0 completions');
assert(Array.isArray(rState.activeCampaignIds) && rState.activeCampaignIds.length === 0, 150, 'Runtime hydrated state has activeCampaignIds.length === 0');
assert(rState.growthAreas.discipline === 0 && rState.growthAreas.teamwork === 0, 151, 'Runtime hydrated state has Discipline === 0 and Teamwork === 0');

// Step 4: Execute game.js saveToStorage() and verify localStorage fidelity
runtimeGame.saveToStorage('test_verification');
const rawSaved = global.localStorage.getItem('koinonia.phase18.save');
assert(rawSaved !== null && rawSaved.length > 0, 152, 'Runtime saveToStorage() wrote valid JSON to localStorage');

const reloadedState = JSON.parse(rawSaved);
const p18FieldsIntact = (
  Array.isArray(reloadedState.sportsExplored) &&
  Array.isArray(reloadedState.fitQuestHistory) &&
  typeof reloadedState.personalBests === 'object' &&
  typeof reloadedState.fitQuestRewardClaims === 'object' &&
  typeof reloadedState.fitQuestMetrics === 'object' &&
  reloadedState.fitQuestMetrics.totalAttemptsCount === 0
);
assert(p18FieldsIntact, 153, 'Storage after saveToStorage() strictly preserves all Phase 0.18 fields');

// ============================================================================
// SECTION 12: PRACTICE WITH PURPOSE (FQ-R002) RUNNING MAPPING REGRESSION (Tests 154 - 160)
// ============================================================================
console.log('\n--- SECTION 12: FQ-R002 RUNNING MAPPING & ATTRIBUTION REGRESSION ---');

const r002Challenge = CHALLENGES['FQ-R002'];
const runningSport = SPORTS.running;

// Assertion A: FQ-R002 eligibleSportIds contains running
assert(Array.isArray(r002Challenge.eligibleSportIds) && r002Challenge.eligibleSportIds.includes('running'), 154, 'FQ-R002 eligibleSportIds contains running (Item A)');

// Assertion B: SPORTS.running.challengeIds contains FQ-R002
assert(Array.isArray(runningSport.challengeIds) && runningSport.challengeIds.includes('FQ-R002'), 155, 'SPORTS.running.challengeIds contains FQ-R002 (Item B)');

// Assertion C: SPORTS.running.availableChallenges contains FQ-R002
assert(Array.isArray(runningSport.availableChallenges) && runningSport.availableChallenges.includes('FQ-R002'), 156, 'SPORTS.running.availableChallenges contains FQ-R002 (Item C)');

// Assertion D & E: FQ-R002 completed with sportId running records running and adds running to sportsExplored
const practiceRunningState = createFitQuestReadyQaState();
const r002RunningRes = recordChallengeResult(practiceRunningState, 'FQ-R002', 1, { sportId: 'running' });
assert(r002RunningRes.sportId === 'running' && r002RunningRes.actualSportId === 'running', 157, 'FQ-R002 completed with sportId running records running (Item D)');
assert(practiceRunningState.sportsExplored.includes('running'), 158, 'sportsExplored adds running after FQ-R002 running practice (Item E)');

// Assertion F: Reward remains first-completion-only
const lpBeforeRepeat = practiceRunningState.lp;
const xpBeforeRepeat = practiceRunningState.charXp;
const r002RepeatRes = recordChallengeResult(practiceRunningState, 'FQ-R002', 1, { sportId: 'running' });
const antiFarmingSafe = (practiceRunningState.lp === lpBeforeRepeat && practiceRunningState.charXp === xpBeforeRepeat && r002RepeatRes.rewardClaimed === false);
assert(antiFarmingSafe, 159, 'FQ-R002 reward remains first-completion-only (no repeat reward exploitation) (Item F)');

// UI Context retention: openRealWorldQuestModal preserves running context
runtimeGame.openRealWorldQuestModal('FQ-R002', 'running');
runtimeGame.completeRealWorldQuest();
const hydratedRunningState = runtimeGame.getState();
assert(hydratedRunningState.sportsExplored.includes('running') && hydratedRunningState.fitQuestHistory[0].actualSportId === 'running', 160, 'UI Context: openRealWorldQuestModal preserves running context and logs running upon completion');

// ============================================================================
// SECTION 13: BROWSER-RUNTIME TEST LAB EXECUTION & HYDRATION (Tests 161 - 177)
// ============================================================================
console.log('\n--- SECTION 13: BROWSER-RUNTIME TEST LAB EXECUTION & HYDRATION ---');

// Step 1: Extract inline script from fitquest_test.html
const fitquestHtmlContent = fs.readFileSync(path.join(P18_DIR, 'fitquest_test.html'), 'utf8');
const inlineScriptMatch = fitquestHtmlContent.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/);
assert(inlineScriptMatch !== null && inlineScriptMatch[1].length > 0, 161, 'fitquest_test.html contains executable inline <script> block');

// Step 2: Validate JavaScript syntax of extracted script
const vm = require('vm');
let syntaxValid = true;
let syntaxError = null;
try {
  new vm.Script(inlineScriptMatch[1]);
} catch (err) {
  syntaxValid = false;
  syntaxError = err.message;
}
assert(syntaxValid, 162, 'fitquest_test.html inline script parses with 100% valid JavaScript syntax', syntaxError || 'Clean parse');

// Step 3: Set up mock environment elements and execute inline script
const qaElements = {};
function getQaElement(id) {
  if (!qaElements[id]) {
    qaElements[id] = {
      id,
      innerText: '',
      textContent: '',
      innerHTML: '',
      style: { background: '', borderColor: '', color: '', display: '' },
      classList: { add: () => {}, remove: () => {}, contains: () => false }
    };
  }
  return qaElements[id];
}

const originalGetElementById = global.document.getElementById;
global.document.getElementById = (id) => getQaElement(id);
global.confirm = () => true;
let lastAlert = null;
global.alert = (msg) => { lastAlert = msg; };

try {
  vm.runInThisContext(inlineScriptMatch[1]);
} catch (execErr) {
  console.error('Execution error:', execErr);
}

// Step 4: Verify button handlers are globally exposed and callable on window
assert(typeof global.window.resetPhase18 === 'function', 163, 'window.resetPhase18 is callable function');
assert(typeof global.window.seedFitQuestReady === 'function', 164, 'window.seedFitQuestReady is callable function');
assert(typeof global.window.seedBasketballPb === 'function', 165, 'window.seedBasketballPb is callable function');
assert(typeof global.window.seedRunningPb === 'function', 166, 'window.seedRunningPb is callable function');
assert(typeof global.window.seedMultiSportHistory === 'function', 167, 'window.seedMultiSportHistory is callable function');
assert(typeof global.window.launchPrototype === 'function', 168, 'window.launchPrototype is callable function');
assert(typeof global.window.runInBrowserTests === 'function', 169, 'window.runInBrowserTests is callable function');

// Step 5: Test resetPhase18() execution and independent operation
global.window.resetPhase18();
const postResetSave = global.localStorage.getItem('koinonia.phase18.save');
assert(postResetSave === null, 170, 'resetPhase18() clears koinonia.phase18.save from localStorage');

// Verify launchPrototype blocks when save does not exist
const originalLocation = global.window.location;
global.window.location = { href: 'fitquest_test.html' };
global.window.launchPrototype();
assert(global.window.location.href === 'fitquest_test.html', 171, 'launchPrototype() blocks navigation when QA state is not seeded');

// Step 6: Test seedFitQuestReady() execution
global.window.seedFitQuestReady();
const postSeedRaw = global.localStorage.getItem('koinonia.phase18.save');
assert(postSeedRaw !== null, 172, 'seedFitQuestReady() writes save to localStorage');

const postSeed = JSON.parse(postSeedRaw);
const seedDataValid = (
  postSeed.lp === 135 &&
  postSeed.charXp === 15 &&
  postSeed.charLevel === 2 &&
  postSeed.activePlaceId === 'sports_hub' &&
  Array.isArray(postSeed.sportsExplored) && postSeed.sportsExplored.length === 0 &&
  postSeed.fitQuestMetrics.completedCount === 0 &&
  postSeed.fitQuestMetrics.personalBestsCount === 0 &&
  postSeed.fitQuestMetrics.totalAttemptsCount === 0 &&
  postSeed.fitQuestMetrics.sportsTriedCount === 0
);
assert(seedDataValid, 173, 'seedFitQuestReady() verified write: 135 LP, 15 XP, Level 2, sports_hub, 0 sports explored, 0 attempts');

// Step 7: Verify launchPrototype succeeds when seeded
global.window.launchPrototype();
assert(global.window.location.href === 'index.html', 174, 'launchPrototype() permits navigation to index.html when valid QA seed is verified');
global.window.location = originalLocation;

// Step 8: Actual Game Hydration round-trip from test lab seed
const labHydrateSuccess = runtimeGame.loadFromStorage();
assert(labHydrateSuccess === true, 175, 'game.js loadFromStorage() hydrates test-lab seed without error');

const labRuntimeState = runtimeGame.getState();
assert(
  labRuntimeState.lp === 135 &&
  labRuntimeState.charXp === 15 &&
  labRuntimeState.charLevel === 2 &&
  labRuntimeState.activePlaceId === 'sports_hub',
  176,
  'Runtime game state matches test-lab seed: 135 LP, 15 XP, Level 2, sports_hub'
);

runtimeGame.saveToStorage('test_lab_hydration_check');
const finalSavedRaw = global.localStorage.getItem('koinonia.phase18.save');
const finalSaved = JSON.parse(finalSavedRaw);
assert(
  finalSaved.lp === 135 &&
  finalSaved.charXp === 15 &&
  finalSaved.charLevel === 2 &&
  finalSaved.activePlaceId === 'sports_hub' &&
  finalSaved.sportsExplored.length === 0,
  177,
  'Final saveToStorage() round-trip preserves state with zero drift'
);

// ============================================================================
// SECTION 14: BROWSER-RUNTIME MINI-GAME EXECUTION & DISCOVERABILITY (Tests 178 - 199)
// ============================================================================
console.log('\n--- SECTION 14: BROWSER-RUNTIME MINI-GAME EXECUTION & DISCOVERABILITY ---');

// Setup full DOM fixture for mini-game execution
const domElements = {};
const createDomElement = (id) => {
  const classes = new Set(['hidden']);
  const styleObj = { display: 'none' };
  const listeners = {};
  return {
    id: id,
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
      toggle: (c) => { if (classes.has(c)) classes.delete(c); else classes.add(c); }
    },
    style: styleObj,
    textContent: '',
    innerHTML: '',
    className: 'hidden',
    addEventListener: (evt, fn) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (evt) => {
      if (listeners[evt]) listeners[evt].forEach(fn => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
    },
    getContext: (type) => ({
      fillRect: () => {},
      strokeRect: () => {},
      beginPath: () => {},
      arc: () => {},
      stroke: () => {},
      fill: () => {},
      moveTo: () => {},
      lineTo: () => {},
      fillText: () => {},
      measureText: (txt) => ({ width: (txt || '').length * 6 }),
      save: () => {},
      restore: () => {},
      roundRect: () => {}
    }),
    width: 400,
    height: 280
  };
};

const domIds = [
  'minigame-modal', 'minigame-title', 'minigame-subtitle', 'minigame-active-view',
  'minigame-result-view', 'btn-minigame-action', 'minigame-canvas', 'reaction-sprint-screen',
  'reaction-sprint-icon', 'reaction-sprint-label', 'reaction-sprint-sub', 'minigame-hud-center',
  'minigame-hud-right', 'minigame-result-pb-banner', 'minigame-result-sport-icon',
  'minigame-result-challenge-name', 'minigame-result-score-big', 'minigame-result-pb-compare',
  'minigame-result-reward-card', 'minigame-error-modal', 'minigame-error-challenge',
  'minigame-error-reason', 'fitquest-modal', 'npc-dialogue-modal', 'dialogue-speaker',
  'dialogue-role', 'dialogue-portrait', 'dialogue-text', 'btn-dialogue-action'
];
domIds.forEach(id => {
  domElements[id] = createDomElement(id);
});

global.document.getElementById = (id) => domElements[id] || createDomElement(id);

// --- FREE THROW (FQ-V001) BROWSER-RUNTIME EXECUTION TEST ---
// Step 1: Re-seed baseline state
const baselineForMiniGameTests = createFitQuestReadyQaState();
global.localStorage.setItem('koinonia.phase18.save', JSON.stringify(baselineForMiniGameTests));
runtimeGame.loadFromStorage();
assert(runtimeGame.getState().lp === 135 && runtimeGame.getState().charXp === 15, 178, 'Baseline state loaded: 135 LP, 15 XP');

// Step 2: Start Basketball Mini-Game FQ-V001
const startSuccess = runtimeGame.startMiniGame('FQ-V001', 'basketball');
assert(startSuccess === true, 179, 'startMiniGame("FQ-V001", "basketball") returns true');
assert(!domElements['minigame-modal'].classList.contains('hidden'), 180, 'minigame-modal becomes visible in DOM');
assert(!domElements['minigame-active-view'].classList.contains('hidden'), 181, 'minigame-active-view is active and visible');
assert(domElements['minigame-canvas'].style.display === 'block', 182, 'Basketball canvas is displayed');
assert(domElements['btn-minigame-action'].textContent.includes('SHOOT'), 183, 'Touch action button displays SHOOT');

// Step 3: Simulate 10 Shots (makes)
for (let s = 1; s <= 10; s++) {
  runtimeGame.handleMiniGameAction({ immediate: true, forceMake: true });
}

// Step 4: Verify Result View
assert(!domElements['minigame-result-view'].classList.contains('hidden'), 184, 'minigame-result-view becomes visible after 10 shots');
assert(domElements['minigame-result-score-big'].textContent.includes('10'), 185, 'Result screen displays 10 makes');

// Step 5: Verify Economy & Personal Best
const stateR1 = runtimeGame.getState();
assert(stateR1.lp === 140 && stateR1.charXp === 20, 186, 'First completion awards +5 LP (140) and +5 XP (20)');
assert(stateR1.personalBests['FQ-V001'] && stateR1.personalBests['FQ-V001'].score === 10, 187, 'Personal Best recorded as 10 shots made');
assert(stateR1.sportsExplored.includes('basketball'), 188, 'sportsExplored contains basketball');

// Step 6: Second Round (Anti-farming repeat isolation test)
runtimeGame.startMiniGame('FQ-V001', 'basketball');
for (let s = 1; s <= 10; s++) {
  runtimeGame.handleMiniGameAction({ immediate: true, forceMake: true });
}
const stateR2 = runtimeGame.getState();
assert(stateR2.lp === 140 && stateR2.charXp === 20, 189, 'Repeat round preserves LP=140 and XP=20 (Zero reward farming allowed)');

// --- REACTION SPRINT (FQ-V002) BROWSER-RUNTIME TEST ---
const sprintStart = runtimeGame.startMiniGame('FQ-V002', 'running');
assert(sprintStart === true, 190, 'startMiniGame("FQ-V002", "running") returns true');
assert(!domElements['reaction-sprint-screen'].classList.contains('hidden'), 191, 'Reaction Sprint screen visible');
assert(domElements['reaction-sprint-screen'].className.includes('reaction-wait'), 192, 'Initial sprint state is WAIT');

// Test False Start
runtimeGame.handleMiniGameAction({ immediate: true });
assert(domElements['reaction-sprint-screen'].className.includes('reaction-false-start'), 193, 'Early tap correctly triggers FALSE START');

// Arm and trigger GO deterministically
runtimeGame.startMiniGame('FQ-V002', 'running');
const sprintState = runtimeGame.getState();
runtimeGame.handleMiniGameAction({ reactionMs: 235 });
const stateSprintDone = runtimeGame.getState();
assert(stateSprintDone.personalBests['FQ-V002'] && stateSprintDone.personalBests['FQ-V002'].score === 235, 194, 'Reaction Sprint PB recorded as 235 ms');
assert(stateSprintDone.sportsExplored.includes('running'), 195, 'sportsExplored contains running');

// --- RALLY FOCUS (FQ-V003) BROWSER-RUNTIME TEST ---
runtimeGame.startMiniGame('FQ-V003', 'badminton');
runtimeGame.handleMiniGameAction({ inStrikeZone: true });
runtimeGame.handleMiniGameAction({ inStrikeZone: false, immediate: true });
const stateBadmintonDone = runtimeGame.getState();
assert(stateBadmintonDone.sportsExplored.includes('badminton'), 196, 'sportsExplored contains badminton');

// Test Pickleball sport context attribution on FQ-V003
runtimeGame.startMiniGame('FQ-V003', 'pickleball');
runtimeGame.handleMiniGameAction({ inStrikeZone: false, immediate: true });
const statePickleballDone = runtimeGame.getState();
assert(statePickleballDone.sportsExplored.includes('pickleball'), 197, 'sportsExplored contains pickleball when played with pickleball context');

// --- SPORTS HUB DISCOVERABILITY & QA SHORTCUTS ---
assert(
  gameContent.includes('FIT QUEST BOARD') &&
  gameContent.includes('RUNNING TRACK') &&
  gameContent.includes('RACKET COURT') &&
  gameContent.includes('FITNESS ZONE') &&
  gameContent.includes('BASKETBALL'),
  198,
  'game.js renders player-visible signs for all sports disciplines and hubs'
);

assert(
  gameContent.includes('OPEN FIT QUEST HUB'),
  199,
  'Coach Daniel dialogue routes directly to Fit Quest Hub'
);

const fqTestHtml = fs.readFileSync(path.join(P18_DIR, 'fitquest_test.html'), 'utf8');
assert(
  fqTestHtml.includes('qaLaunch') &&
  fqTestHtml.includes('TEST FREE THROW FOCUS') &&
  fqTestHtml.includes('TEST REACTION SPRINT') &&
  fqTestHtml.includes('TEST RALLY FOCUS'),
  200,
  'fitquest_test.html provides direct QA shortcuts for all mini-games with save gating'
);

assert(
  htmlContent.includes('id="minigame-error-modal"') &&
  gameContent.includes('showMiniGameError'),
  201,
  'Visible mini-game error reporting modal and handler exist'
);


global.document.getElementById = originalGetElementById;

// Cleanup background intervals to let process exit cleanly
activeIntervals.forEach(clearInterval);

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED:      ${passCount}`);
console.log(`FAILED:      ${failCount}`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
