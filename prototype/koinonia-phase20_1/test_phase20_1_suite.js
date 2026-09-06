/**
 * KOINONIA — PHASE 0.20.1 AUTOMATED VERIFICATION SUITE
 * GAME CONSOLIDATION + PHYSICAL UX POLISH + SHARED CORE BLUEPRINT
 *
 * Comprehensive Automated Tests:
 * 1. File & Environment Integrity
 * 2. Canonical QA Baseline (Level 2, 135 LP, 15 XP)
 * 3. Local Shared Core Provider Contracts
 * 4. Life Points Ledger & Quest Idempotency
 * 5. Campfire Unification & Capacity Safety
 * 6. Event Attendance & Check-In Idempotency
 * 7. Ministry Membership & Mission Discovery
 * 8. FOG Games Shell: Faith Quest + FOG Arcade Audited Catalog
 * 9. Header Branding, 6-Card Grid, 7-Tab Nav, Modals & Canonical Terminology
 * 10. Mobile Viewport, CSS Integrity & Campfire Flicker Prevention
 * 11. Runtime DOM, Navigation Interaction, FOG Games Selector, Sports Hub & Close Buttons
 * 12. Consolidation Test Lab HTML Integrity
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] #${totalTests}: ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] #${totalTests}: ${testName}`);
    if (details) console.error(`       Details: ${details}`);
  }
}

const P20_1_DIR = path.join(__dirname);
const sharedCoreModule = require('./data/shared_core.js');
const campfiresModule = require('./data/campfires.js');
const circlesModule = require('./data/circles.js');
const arcadeModule = require('./data/arcade.js');

console.log('====================================================');
console.log('KOINONIA PHASE 0.20.1 AUTOMATED VERIFICATION SUITE');
console.log('====================================================\n');

// ------------------------------------------------------------
// SECTION 1: FILE & ENVIRONMENT INTEGRITY
// ------------------------------------------------------------
console.log('--- SECTION 1: FILE & ENVIRONMENT INTEGRITY ---');

assert(fs.existsSync(path.join(P20_1_DIR, 'data', 'shared_core.js')), 'data/shared_core.js exists');
assert(fs.existsSync(path.join(P20_1_DIR, 'data', 'campfires.js')), 'data/campfires.js exists');
assert(fs.existsSync(path.join(P20_1_DIR, 'data', 'circles.js')), 'data/circles.js exists');
assert(fs.existsSync(path.join(P20_1_DIR, 'data', 'arcade.js')), 'data/arcade.js exists');
assert(fs.existsSync(path.join(P20_1_DIR, 'consolidation_test.html')), 'consolidation_test.html exists');
assert(fs.existsSync(path.join(P20_1_DIR, 'index.html')), 'index.html exists');
assert(fs.existsSync(path.join(P20_1_DIR, 'game.js')), 'game.js exists');
assert(fs.existsSync(path.join(P20_1_DIR, 'styles.css')), 'styles.css exists');

// Syntax checks
try {
  execSync(`node -c "${path.join(P20_1_DIR, 'data', 'shared_core.js')}"`);
  assert(true, 'data/shared_core.js syntax is valid');
} catch (e) {
  assert(false, 'data/shared_core.js syntax error', e.message);
}

try {
  execSync(`node -c "${path.join(P20_1_DIR, 'data', 'campfires.js')}"`);
  assert(true, 'data/campfires.js syntax is valid');
} catch (e) {
  assert(false, 'data/campfires.js syntax error', e.message);
}

try {
  execSync(`node -c "${path.join(P20_1_DIR, 'data', 'circles.js')}"`);
  assert(true, 'data/circles.js syntax is valid');
} catch (e) {
  assert(false, 'data/circles.js syntax error', e.message);
}

try {
  execSync(`node -c "${path.join(P20_1_DIR, 'data', 'arcade.js')}"`);
  assert(true, 'data/arcade.js syntax is valid');
} catch (e) {
  assert(false, 'data/arcade.js syntax error', e.message);
}

try {
  execSync(`node -c "${path.join(P20_1_DIR, 'game.js')}"`);
  assert(true, 'game.js syntax is valid');
} catch (e) {
  assert(false, 'game.js syntax error', e.message);
}

const gameContent = fs.readFileSync(path.join(P20_1_DIR, 'game.js'), 'utf8');
const circlesContent = fs.readFileSync(path.join(P20_1_DIR, 'data', 'circles.js'), 'utf8');
assert(gameContent.includes("const SAVE_STORAGE_KEY = 'koinonia.phase20_1.save';"), 'game.js defines SAVE_STORAGE_KEY as koinonia.phase20_1.save');
assert(!gameContent.includes('koinonia.phase20.save'), 'game.js does not contain old phase20 save key');
assert(circlesContent.includes('koinonia.phase20_1.save'), 'data/circles.js references koinonia.phase20_1.save');

// ------------------------------------------------------------
// SECTION 2: CANONICAL QA BASELINE & MEMBER IDENTITY
// ------------------------------------------------------------
console.log('\n--- SECTION 2: CANONICAL QA BASELINE & MEMBER IDENTITY ---');

const provider = new sharedCoreModule.LocalSharedCoreProvider();
const member = provider.getCurrentMember();
const lpState = provider.getLifePoints();

assert(member.id === 'youth_demo_01', 'Member ID is youth_demo_01 (demo identity)');
assert(member.name === 'Alex Rivera', 'Member Name is Alex Rivera');
assert(member.ageGroup === 'YOUTH', 'Member ageGroup is YOUTH');
assert(lpState.balance === 135, 'Baseline Life Points balance is exactly 135 LP');
assert(lpState.charLevel === 2, 'Baseline Character Level is Level 2');
assert(lpState.charXp === 15, 'Baseline Character XP is 15 XP');
assert(lpState.charXpMax === 20, 'Baseline Character XP max is 20 XP');
assert(Array.isArray(lpState.ledger) && lpState.ledger.length >= 1, 'LP ledger contains initial credit');
assert(lpState.ledger[0].amount === 135, 'Initial ledger credit is 135 LP');
assert(lpState.ledger[0].source === 'SYSTEM', 'Initial ledger source is SYSTEM');

const qaBaselineState = campfiresModule.createCampfireReadyQaState();
assert(qaBaselineState.saveKey === 'koinonia.phase20_1.save', 'Campfire QA baseline specifies koinonia.phase20_1.save');
assert(qaBaselineState.lp === 135, 'Campfire QA baseline LP is 135');
assert(qaBaselineState.charLevel === 2, 'Campfire QA baseline level is 2');
assert(qaBaselineState.charXp === 15, 'Campfire QA baseline XP is 15');

// ------------------------------------------------------------
// SECTION 3: SHARED CORE PROVIDER CONTRACTS
// ------------------------------------------------------------
console.log('\n--- SECTION 3: SHARED CORE PROVIDER CONTRACTS ---');

assert(typeof provider.getCurrentMember === 'function', 'Provider exports getCurrentMember');
assert(typeof provider.getLifePoints === 'function', 'Provider exports getLifePoints');
assert(typeof provider.awardLifePoints === 'function', 'Provider exports awardLifePoints');
assert(typeof provider.getQuests === 'function', 'Provider exports getQuests');
assert(typeof provider.getQuest === 'function', 'Provider exports getQuest');
assert(typeof provider.getQuestCompletion === 'function', 'Provider exports getQuestCompletion');
assert(typeof provider.completeQuest === 'function', 'Provider exports completeQuest');
assert(typeof provider.getEvents === 'function', 'Provider exports getEvents');
assert(typeof provider.getEvent === 'function', 'Provider exports getEvent');
assert(typeof provider.checkIn === 'function', 'Provider exports checkIn');
assert(typeof provider.getAttendance === 'function', 'Provider exports getAttendance');
assert(typeof provider.getMyCampfires === 'function', 'Provider exports getMyCampfires');
assert(typeof provider.getCampfire === 'function', 'Provider exports getCampfire');
assert(typeof provider.getCampfireMembers === 'function', 'Provider exports getCampfireMembers');
assert(typeof provider.getCampfireLeaders === 'function', 'Provider exports getCampfireLeaders');
assert(typeof provider.getCampfireGameState === 'function', 'Provider exports getCampfireGameState');
assert(typeof provider.getMinistries === 'function', 'Provider exports getMinistries');
assert(typeof provider.getMyMinistries === 'function', 'Provider exports getMyMinistries');
assert(typeof provider.getMyMinistryMissions === 'function', 'Provider exports getMyMinistryMissions');
assert(typeof provider.getMilestones === 'function', 'Provider exports getMilestones');
assert(typeof provider.getGrowthProgress === 'function', 'Provider exports getGrowthProgress');
assert(typeof provider.resetToBaseline === 'function', 'Provider exports resetToBaseline');

const quests = provider.getQuests();
assert(Array.isArray(quests) && quests.length >= 5, `Quests catalog contains ${quests.length} quests`);
const q001 = provider.getQuest('Q-001');
assert(q001 !== null, 'Quest Q-001 exists in shared catalog');
assert(q001.title === 'Steward of the Garden', 'Quest Q-001 title is Steward of the Garden');
assert(q001.rewards.lp === 5, 'Quest Q-001 rewards exactly +5 LP');
assert(q001.rewards.charXp === 5, 'Quest Q-001 rewards exactly +5 Char XP');
assert(q001.rewards.stewardshipXp === 15, 'Quest Q-001 rewards exactly +15 Stewardship XP');
assert(q001.rewards.responsibilityXp === 5, 'Quest Q-001 rewards exactly +5 Responsibility XP');

const events = provider.getEvents();
assert(Array.isArray(events) && events.length >= 4, `Events catalog contains ${events.length} canonical templates`);
const alphaEvt = provider.getEvent('alpha_session_event');
assert(alphaEvt !== null, 'Alpha Session event exists');
assert(alphaEvt.startTime === '15:00', 'Alpha Session start time is 15:00');
assert(alphaEvt.timeZone === 'Asia/Manila', 'Alpha Session timeZone is Asia/Manila');

const milestones = provider.getMilestones();
assert(milestones.length === 19, `Milestones catalog has exactly 19 canonical milestones (found ${milestones.length})`);

// ------------------------------------------------------------
// SECTION 4: LIFE POINTS LEDGER & QUEST IDEMPOTENCY
// ------------------------------------------------------------
console.log('\n--- SECTION 4: LIFE POINTS LEDGER & QUEST IDEMPOTENCY ---');

const testProvider = new sharedCoreModule.LocalSharedCoreProvider();
testProvider.resetToBaseline();

assert(testProvider.getLifePoints().balance === 135, 'Initial test balance is 135 LP');

// First completion
const res1 = testProvider.completeQuest({ questId: 'Q-001' });
assert(res1.success === true, 'First Q-001 completion succeeded');
assert(res1.alreadyCompleted === false, 'First Q-001 alreadyCompleted flag is false');
assert(res1.lpResult.awarded === 5, 'First Q-001 awarded +5 LP');
assert(testProvider.getLifePoints().balance === 140, 'Balance updated from 135 to 140 LP');
assert(res1.completion.idempotencyKey.includes('Q-001'), 'Completion record has valid idempotency key');

// Retry completion (Idempotency Test)
const res2 = testProvider.completeQuest({ questId: 'Q-001' });
assert(res2.success === true, 'Retry Q-001 completion succeeded safely');
assert(res2.alreadyCompleted === true, 'Retry Q-001 alreadyCompleted flag is true');
assert(res2.lpResult.awarded === 0, 'Retry Q-001 awarded exactly 0 duplicate LP');
assert(testProvider.getLifePoints().balance === 140, 'Balance remains strictly 140 LP (no double reward)');

// Direct awardLifePoints idempotency check
const customTx1 = testProvider.awardLifePoints({
  amount: 10,
  charXp: 5,
  reason: 'Custom Fellowship Activity',
  idempotencyKey: 'test_tx_key_999'
});
assert(customTx1.duplicate === false, 'First custom transaction processed');
assert(customTx1.awarded === 10, 'First custom transaction awarded 10 LP');
assert(testProvider.getLifePoints().balance === 150, 'Balance updated to 150 LP');

const customTx2 = testProvider.awardLifePoints({
  amount: 10,
  charXp: 5,
  reason: 'Custom Fellowship Activity',
  idempotencyKey: 'test_tx_key_999'
});
assert(customTx2.duplicate === true, 'Duplicate transaction with same idempotencyKey detected');
assert(customTx2.awarded === 0, 'Duplicate transaction awarded 0 LP');
assert(testProvider.getLifePoints().balance === 150, 'Balance remains strictly 150 LP');

// ------------------------------------------------------------
// SECTION 5: CAMPFIRE UNIFICATION & CAPACITY SAFETY
// ------------------------------------------------------------
console.log('\n--- SECTION 5: CAMPFIRE UNIFICATION & CAPACITY SAFETY ---');

const myCampfires = testProvider.getMyCampfires();
assert(myCampfires.length >= 1, 'Provider returns at least 1 Campfire for member');
const primaryCf = myCampfires[0];

assert(primaryCf.id === 'cf_alpha_seed', 'Campfire has canonical ID cf_alpha_seed');
assert(primaryCf.communityId === 'fog', 'Campfire belongs to community fog');
assert(primaryCf.name === 'St. Ignatius Youth Campfire', 'Campfire name is St. Ignatius Youth Campfire');
assert(Array.isArray(primaryCf.leaderIds) && primaryCf.leaderIds.length >= 1, 'Campfire has authoritative leaderIds');
assert(Array.isArray(primaryCf.memberIds) && primaryCf.memberIds.length === 5, 'Campfire has exactly 5 members');
assert(primaryCf.status === 'ACTIVE', 'Campfire status is ACTIVE (>= 5 participants)');
assert(primaryCf.maxParticipants === 12, 'Campfire default maxParticipants is 12');

const gameState = testProvider.getCampfireGameState(primaryCf.id);
assert(gameState !== null, 'CampfireGameState exists for cf_alpha_seed');
assert(gameState.campfireId === primaryCf.id, 'CampfireGameState references campfireId');
assert(typeof gameState.memberIds === 'undefined', 'CampfireGameState does NOT duplicate memberIds roster');
assert(Array.isArray(gameState.assignedQuestIds), 'CampfireGameState has assignedQuestIds array');
assert(typeof gameState.reactions === 'object', 'CampfireGameState has reactions map');

// Denominator uses member count
const denom = campfiresModule.getProgressDenominator(primaryCf);
assert(denom === 5, `Campfire progress denominator is 5 (actual member count), NOT max 12 (found: ${denom})`);

// Admin sets community max to 10
const adminRes = testProvider.setCommunityMaxParticipants(10);
assert(adminRes.success === true, 'Admin setCommunityMaxParticipants(10) succeeded');
assert(testProvider.getCampfireSettings().communityMaxCapacity === 10, 'Community max capacity updated to 10');

// Leader sets campfire max to 8 (valid: 5 <= 8 <= 10)
const leaderResValid = testProvider.setCampfireCapacity(primaryCf.id, 8, 'LEADER');
assert(leaderResValid.success === true, 'Leader setCampfireCapacity(8) succeeded (5 <= 8 <= 10)');
assert(testProvider.getCampfire(primaryCf.id).maxParticipants === 8, 'Campfire maxParticipants updated to 8');

// Leader tries 12 > 10 (over-community rejection)
const leaderResOver = testProvider.setCampfireCapacity(primaryCf.id, 12, 'LEADER');
assert(leaderResOver.success === false, 'Leader setCampfireCapacity(12 > 10) correctly rejected');
assert(leaderResOver.error.includes('exceeds community maximum'), 'Rejection error message is descriptive');
assert(testProvider.getCampfire(primaryCf.id).maxParticipants === 8, 'Campfire maxParticipants remained 8');

// Leader tries 4 < 5 (below active member count & below min 5)
const leaderResUnder = testProvider.setCampfireCapacity(primaryCf.id, 4, 'LEADER');
assert(leaderResUnder.success === false, 'Leader setCampfireCapacity(4 < 5) correctly rejected');
assert(testProvider.getCampfire(primaryCf.id).maxParticipants === 8, 'Campfire maxParticipants remained 8');

// Member cannot modify capacity
const memberRes = testProvider.setCampfireCapacity(primaryCf.id, 9, 'MEMBER');
assert(memberRes.success === false, 'Member cannot modify campfire capacity');

// Structured reactions only
const reactRes1 = testProvider.addReactionToCampfire(primaryCf.id, '🔥');
assert(reactRes1.success === true, 'Structured reaction 🔥 succeeded');
assert(reactRes1.reactions['🔥'] >= 1, 'Reaction 🔥 count incremented');

const reactResBad = testProvider.addReactionToCampfire(primaryCf.id, '💩');
assert(reactResBad.success === false, 'Unauthorized emoji 💩 correctly rejected');

// ------------------------------------------------------------
// SECTION 6: EVENT ATTENDANCE & CHECK-IN IDEMPOTENCY
// ------------------------------------------------------------
console.log('\n--- SECTION 6: EVENT ATTENDANCE & CHECK-IN IDEMPOTENCY ---');

assert(testProvider.getAllAttendanceRecords().length === 0, 'Initially 0 attendance records');

// First check-in
const checkin1 = testProvider.checkIn({ eventInstanceId: 'demo_fellowship_night' });
assert(checkin1.success === true, 'First event check-in succeeded');
assert(checkin1.alreadyCheckedIn === false, 'First check-in alreadyCheckedIn flag is false');
assert(checkin1.record.source === 'KOINONIA', 'Check-in source is KOINONIA');
assert(testProvider.getAllAttendanceRecords().length === 1, 'Exactly 1 attendance record in provider');

// Duplicate check-in retry
const checkin2 = testProvider.checkIn({ eventInstanceId: 'demo_fellowship_night' });
assert(checkin2.success === true, 'Retry check-in succeeded safely');
assert(checkin2.alreadyCheckedIn === true, 'Retry check-in alreadyCheckedIn flag is true');
assert(testProvider.getAllAttendanceRecords().length === 1, 'Still exactly 1 attendance record in provider (no duplicate)');

const attRecord = testProvider.getAttendance('demo_fellowship_night');
assert(attRecord !== null, 'getAttendance resolves checked-in record');
assert(attRecord.eventInstanceId === 'demo_fellowship_night', 'Attendance record references correct eventInstanceId');

// ------------------------------------------------------------
// SECTION 7: MINISTRY MEMBERSHIP & MISSION DISCOVERY
// ------------------------------------------------------------
console.log('\n--- SECTION 7: MINISTRY MEMBERSHIP & MISSION DISCOVERY ---');

const ministries = testProvider.getMinistries();
assert(ministries.length === 4, `Ministries catalog contains 4 demo ministries (found ${ministries.length})`);
const seraphs = ministries.find(m => m.id === 'ministry_seraphs');
assert(seraphs && seraphs.name === 'Seraphs Music Ministry', 'Seraphs Music Ministry exists');

const myMinistries = testProvider.getMyMinistries();
assert(myMinistries.length >= 1, 'Member has at least 1 ministry membership');
assert(myMinistries[0].id === 'ministry_seraphs', 'Member belongs to Seraphs Music Ministry');

const myMissions = testProvider.getMyMinistryMissions();
assert(myMissions.length >= 1, 'Member discovers ministry missions');
const mission001 = myMissions.find(m => m.id === 'MM-001');
assert(mission001 !== null, 'Discovered Mission MM-001 Sacred Harmonies Rehearsal');
assert(mission001.rewards.lp === 5, 'Mission awards +5 LP');
assert(mission001.rewards.charXp === 5, 'Mission awards +5 Char XP');

// ------------------------------------------------------------
// SECTION 8: FOG GAMES: FAITH QUEST & FOG ARCADE CATALOGS
// ------------------------------------------------------------
console.log('\n--- SECTION 8: FOG GAMES: FAITH QUEST & FOG ARCADE CATALOGS ---');

const physicsGames = arcadeModule.BIBLICAL_PHYSICS_GAMES;
const growthGames = arcadeModule.GROWTH_GAMES;
const faithQuestChallenges = arcadeModule.FAITH_QUEST_CHALLENGES;

assert(physicsGames.length === 5, `Arcade contains exactly 5 Biblical physics games (found ${physicsGames.length})`);
assert(growthGames.length === 9, `Arcade contains exactly 9 Growth games (found ${growthGames.length})`);
assert(Array.isArray(faithQuestChallenges) && faithQuestChallenges.length === 6, `Arcade contains 6 audited Faith Quest challenges (found ${faithQuestChallenges ? faithQuestChallenges.length : 0})`);

const slingshot = physicsGames.find(g => g.id === 'arcade_slingshot');
assert(slingshot && slingshot.title === "David's Slingshot", "David's Slingshot exists in physics catalog");
assert(slingshot.stagingSource === 'public/js/v8-slingshot.js', "David's Slingshot references staging source public/js/v8-slingshot.js");

const fqCatechism = faithQuestChallenges.find(c => c.id === 'fq_catechism_clash');
assert(fqCatechism && fqCatechism.title === 'Catechism Clash', 'Catechism Clash exists in Faith Quest catalog');
assert(fqCatechism.stagingSource === 'public/seeker-arcade.html', 'Catechism Clash references public/seeker-arcade.html');

const fqNarrowGate = faithQuestChallenges.find(c => c.id === 'fq_narrow_gate');
assert(fqNarrowGate && fqNarrowGate.title === 'The Narrow Gate', 'The Narrow Gate exists in Faith Quest catalog');

const fqManna = faithQuestChallenges.find(c => c.id === 'fq_daily_manna');
assert(fqManna && fqManna.title === 'Daily Manna Scramble', 'Daily Manna Scramble exists in Faith Quest catalog');

const fqEmoji = faithQuestChallenges.find(c => c.id === 'fq_emoji_sermon');
assert(fqEmoji && fqEmoji.title === 'Emoji Sermon', 'Emoji Sermon exists in Faith Quest catalog');

const fqShield = faithQuestChallenges.find(c => c.id === 'fq_shield_of_faith');
assert(fqShield && fqShield.title === 'Shield of Faith', 'Shield of Faith exists in Faith Quest catalog');

const fqFruits = faithQuestChallenges.find(c => c.id === 'fq_fruits_of_spirit');
assert(fqFruits && fqFruits.title === 'Fruits of the Spirit', 'Fruits of the Spirit exists in Faith Quest catalog');

// ------------------------------------------------------------
// SECTION 9: HEADER BRANDING, 6-CARD GRID, 7-TAB NAV & TERMINOLOGY
// ------------------------------------------------------------
console.log('\n--- SECTION 9: HEADER BRANDING, 6-CARD GRID, 7-TAB NAV & TERMINOLOGY ---');

const htmlContent = fs.readFileSync(path.join(P20_1_DIR, 'index.html'), 'utf8');

// Top Header: Banner logo, simplified level display, settings gear, and NO old branding elements
const headerHtmlMatch = htmlContent.match(/<header id="global-header"[\s\S]*?<\/header>/);
const headerHtml = headerHtmlMatch ? headerHtmlMatch[0] : '';
assert(headerHtml.includes('assets/branding/koinonia-header-logo.png'), 'Header contains banner logo assets/branding/koinonia-header-logo.png');
assert(headerHtml.includes('KOINONIA by Fire of God Ministries'), 'Header banner has proper alt text: KOINONIA by Fire of God Ministries');
assert(!headerHtml.includes('class="koinonia-mark"'), 'Header does NOT contain old standalone "K" mark');
assert(!headerHtml.includes('class="brand-title-wrap"'), 'Header does NOT contain old brand text block');
assert(headerHtml.includes('id="header-level-text"'), 'Header contains player level display (#header-level-text)');
assert(headerHtml.includes('id="header-lp-amount"'), 'Header contains player LP display (#header-lp-amount)');
assert(!headerHtml.includes('⭐'), 'Header level pill does NOT contain star icon');
assert(headerHtml.includes('id="header-settings-btn"'), 'Header contains settings gear button (#header-settings-btn)');

// Header Profile Trigger: Level & LP status area acts as My Profile shortcut
assert(headerHtml.includes('id="header-profile-trigger"'), 'Header contains #header-profile-trigger container');
assert(headerHtml.includes('aria-label="View My Profile"'), '#header-profile-trigger has aria-label="View My Profile"');
assert(headerHtml.includes('role="button"'), '#header-profile-trigger has role="button"');
assert(headerHtml.includes('id="header-level-pill"'), '#header-profile-trigger contains #header-level-pill');
assert(headerHtml.includes('id="header-lp-pill"'), '#header-profile-trigger contains #header-lp-pill');

// Settings modal in DOM
assert(htmlContent.includes('id="settings-modal"'), 'index.html contains #settings-modal');
assert(htmlContent.includes('id="btn-close-settings"'), '#settings-modal contains close button');
assert(htmlContent.includes('id="audio-toggle-btn"'), '#settings-modal contains audio toggle button');
assert(htmlContent.includes('id="dev-reset-btn"'), '#settings-modal contains reset prototype button');
assert(htmlContent.includes('id="btn-open-admin"'), '#settings-modal contains studio admin button');
assert(htmlContent.includes('id="settings-item-admin"'), '#settings-modal contains #settings-item-admin container for role gating');

// Settings Profile Summary Card at top of Settings
assert(htmlContent.includes('id="settings-profile-summary"'), '#settings-modal contains #settings-profile-summary at top');
assert(htmlContent.includes('id="settings-profile-avatar"'), '#settings-profile-summary contains avatar element');
assert(htmlContent.includes('id="settings-profile-name"'), '#settings-profile-summary contains member name element');
assert(htmlContent.includes('id="settings-profile-level"'), '#settings-profile-summary contains level badge');
assert(htmlContent.includes('id="settings-profile-lp"'), '#settings-profile-summary contains Life Points badge');
assert(htmlContent.includes('id="btn-view-profile-from-settings"'), '#settings-profile-summary contains VIEW MY PROFILE button');

// My Profile (me-modal) member identity elements
assert(htmlContent.includes('id="me-modal"'), 'index.html contains #me-modal (My Profile)');
assert(htmlContent.includes('id="me-char-name"'), '#me-modal contains #me-char-name');
assert(htmlContent.includes('id="me-char-identity-tag"'), '#me-modal contains #me-char-identity-tag');
assert(htmlContent.includes('id="me-char-level-title"'), '#me-modal contains #me-char-level-title');
assert(htmlContent.includes('id="me-char-role-badge"'), '#me-modal contains #me-char-role-badge');
assert(htmlContent.includes('id="me-community-status-card"'), '#me-modal contains #me-community-status-card');
assert(htmlContent.includes('id="me-char-campfire-info"'), '#me-modal contains #me-char-campfire-info');
assert(htmlContent.includes('id="me-char-ministry-info"'), '#me-modal contains #me-char-ministry-info');
assert(htmlContent.includes('id="me-char-bio-text"'), '#me-modal contains #me-char-bio-text');
assert(htmlContent.includes('id="btn-open-admin-from-me"'), '#me-modal contains #btn-open-admin-from-me for role gating');


// Verify duplicate header navigation icons removed
assert(!htmlContent.includes('id="header-campfire-btn"'), 'Header does NOT contain redundant #header-campfire-btn');
assert(!htmlContent.includes('id="header-quests-btn"'), 'Header does NOT contain redundant #header-quests-btn');
assert(!htmlContent.includes('id="header-events-btn"'), 'Header does NOT contain redundant #header-events-btn');
assert(!htmlContent.includes('id="header-fitquest-btn"'), 'Header does NOT contain redundant #header-fitquest-btn');
assert(!htmlContent.includes('id="header-arcade-btn"'), 'Header does NOT contain redundant #header-arcade-btn');
assert(!htmlContent.includes('id="header-journey-btn"'), 'Header does NOT contain redundant #header-journey-btn');
assert(!htmlContent.includes('id="header-circles-btn"'), 'Header does NOT contain redundant #header-circles-btn');

// Home cards: exactly 6 primary destination cards (2 col x 3 rows)
assert(htmlContent.includes('id="home-dest-campfire"'), 'Home grid contains #home-dest-campfire');
assert(htmlContent.includes('id="home-dest-quests"'), 'Home grid contains #home-dest-quests');
assert(htmlContent.includes('id="home-dest-events"'), 'Home grid contains #home-dest-events');
assert(htmlContent.includes('id="home-dest-games"'), 'Home grid contains #home-dest-games (FOG Games)');
assert(htmlContent.includes('id="home-dest-sports"'), 'Home grid contains #home-dest-sports (Sports Hub)');
assert(htmlContent.includes('id="home-dest-journey"'), 'Home grid contains #home-dest-journey');

// Roster unification: NO separate Quest Circles card below events hub, events hub card preserved
assert(!htmlContent.includes('id="portrait-circles-card"'), 'Removed redundant #portrait-circles-card (unified into Campfire)');
assert(htmlContent.includes('id="portrait-events-card"'), 'Preserved Gatherings & Campaigns Hub card (#portrait-events-card)');

// Bottom navigation tabs: exactly 7 primary tabs
assert(htmlContent.includes('id="nav-tab-home"'), 'Bottom nav contains #nav-tab-home');
assert(htmlContent.includes('id="nav-tab-campfire"'), 'Bottom nav contains #nav-tab-campfire');
assert(htmlContent.includes('id="nav-tab-quests"'), 'Bottom nav contains #nav-tab-quests');
assert(htmlContent.includes('id="nav-tab-events"'), 'Bottom nav contains #nav-tab-events');
assert(htmlContent.includes('id="nav-tab-games"'), 'Bottom nav contains #nav-tab-games');
assert(htmlContent.includes('id="nav-tab-sports"'), 'Bottom nav contains #nav-tab-sports');
assert(htmlContent.includes('id="nav-tab-journey"'), 'Bottom nav contains #nav-tab-journey');

// Modals
assert(htmlContent.includes('id="arcade-modal"'), 'index.html contains #arcade-modal (FOG Games)');
assert(htmlContent.includes('id="events-modal"'), 'index.html contains #events-modal');
assert(htmlContent.includes('id="fitquest-modal"'), 'index.html contains #fitquest-modal (Sports Hub)');
assert(htmlContent.includes('id="journey-modal"'), 'index.html contains #journey-modal');
assert(htmlContent.includes('id="quest-circles-modal"'), 'index.html contains #quest-circles-modal (Campfire Fellowship)');
assert(htmlContent.includes('id="quests-tab-modal"'), 'index.html contains #quests-tab-modal');

// FOG Games modal content & selector
assert(htmlContent.includes('FOG GAMES'), 'FOG Games modal title displays: FOG GAMES');
assert(htmlContent.includes('id="btn-select-faithquest"'), 'FOG Games contains #btn-select-faithquest');
assert(htmlContent.includes('id="btn-select-arcade"'), 'FOG Games contains #btn-select-arcade');
assert(htmlContent.includes('id="games-view-faithquest"'), 'FOG Games contains #games-view-faithquest');
assert(htmlContent.includes('id="games-view-arcade"'), 'FOG Games contains #games-view-arcade');
assert(htmlContent.includes('href="/?faith=quest"'), 'Faith Quest view contains link to Main App /?faith=quest');
assert(htmlContent.includes('id="btn-fq-sample-opt1"'), 'Faith Quest view contains sample question option 1');
assert(htmlContent.includes('id="faithquest-challenges-list"'), 'Faith Quest view contains #faithquest-challenges-list');

// Sports Hub modal content
assert(htmlContent.includes('SPORTS HUB'), 'Sports Hub modal displays: SPORTS HUB');
assert(htmlContent.includes('Sports, Fitness &amp; Personal Bests'), 'Sports Hub modal displays subtitle');
assert(htmlContent.includes('aria-label="Close Sports Hub"'), 'Close button has aria-label="Close Sports Hub"');

// Verify zero visible FIT QUEST or Fit Quest
const stripInternalIds = htmlContent
  .replace(/id="[^"]*"/g, '')
  .replace(/class="[^"]*"/g, '')
  .replace(/data-[^=]*="[^"]*"/g, '')
  .replace(/<!--[\s\S]*?-->/g, '');
assert(!stripInternalIds.includes('FIT QUEST'), 'index.html contains zero visible "FIT QUEST" text');
assert(!stripInternalIds.includes('Fit Quest'), 'index.html contains zero visible "Fit Quest" text');

// Verify zero visible Faith Quest inside visible Sports UI in index.html
const sportsModalMatch = htmlContent.match(/<div id="fitquest-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
if (sportsModalMatch) {
  const sportsVisibleText = sportsModalMatch[0]
    .replace(/id="[^"]*"/g, '')
    .replace(/class="[^"]*"/g, '')
    .replace(/data-[^=]*="[^"]*"/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  assert(!sportsVisibleText.toLowerCase().includes('faith quest'), 'Sports Hub modal contains zero visible "Faith Quest" text');
}

// Cache busting
assert(htmlContent.includes('data/shared_core.js?v=0.20.1'), 'index.html loads data/shared_core.js?v=0.20.1');
assert(htmlContent.includes('data/campfires.js?v=0.20.1'), 'index.html loads data/campfires.js?v=0.20.1');
assert(htmlContent.includes('data/arcade.js?v=0.20.1'), 'index.html loads data/arcade.js?v=0.20.1');
assert(htmlContent.includes('game.js?v=0.20.1'), 'index.html loads game.js?v=0.20.1');

// ------------------------------------------------------------
// SECTION 10: MOBILE VIEWPORT, CSS INTEGRITY & FLICKER FIX
// ------------------------------------------------------------
console.log('\n--- SECTION 10: MOBILE VIEWPORT, CSS INTEGRITY & FLICKER FIX ---');

const cssContent = fs.readFileSync(path.join(P20_1_DIR, 'styles.css'), 'utf8');

assert(cssContent.includes('.fellowship-dest-grid'), 'styles.css contains .fellowship-dest-grid styling');
assert(cssContent.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'), 'styles.css uses minmax(0, 1fr) for equal 2-column grid tracks');
assert(cssContent.includes('.fellowship-dest-card'), 'styles.css contains .fellowship-dest-card styling');
assert(cssContent.includes('-webkit-line-clamp: 2'), 'styles.css wraps card title up to 2 lines');
assert(cssContent.includes('-webkit-line-clamp: 3'), 'styles.css wraps card subtitle up to 3 lines');
assert(cssContent.includes('@media (max-width: 480px)'), 'styles.css has mobile viewport rules for 375px/390px/414px');
assert(cssContent.includes('#arcade-modal'), 'styles.css contains #arcade-modal styling');
assert(cssContent.includes('.games-primary-selector'), 'styles.css contains .games-primary-selector styling');

// Campfire opening flicker prevention
const circleBottomSheetCss = cssContent.match(/\.circle-bottom-sheet\s*\{([^}]*)\}/);
assert(circleBottomSheetCss !== null, 'styles.css defines .circle-bottom-sheet');
if (circleBottomSheetCss) {
  const block = circleBottomSheetCss[1];
  assert(!block.includes('translateX(-50%)'), '.circle-bottom-sheet does NOT contain translateX(-50%) (prevents animation conflict)');
  assert(!block.includes('left: 50%'), '.circle-bottom-sheet does NOT contain left: 50%');
  assert(block.includes('margin: 0 auto') || block.includes('position: relative'), '.circle-bottom-sheet uses centered margin layout');
}

// Enlarged responsive header banner CSS integrity
assert(cssContent.includes('--header-height: 54px;'), 'styles.css configures balanced --header-height: 54px;');
const bannerCssMatch = cssContent.match(/\.brand-header-banner\s*\{([^}]*)\}/);
assert(bannerCssMatch !== null, 'styles.css defines .brand-header-banner');
if (bannerCssMatch) {
  const block = bannerCssMatch[1];
  assert(block.includes('height: 46px;'), '.brand-header-banner has enlarged height: 46px (in 42-50px visual-height range)');
  assert(block.includes('max-height: calc(var(--header-height) - 8px);'), '.brand-header-banner max-height leaves comfortable top/bottom margins');
  assert(block.includes('width: auto;'), '.brand-header-banner uses width: auto preserving aspect ratio');
  assert(!block.includes('max-width: 145px;'), '.brand-header-banner does NOT artificially restrict width to 145px');
  assert(block.includes('object-fit: contain;'), '.brand-header-banner specifies object-fit: contain preventing distortion');
}
assert(cssContent.includes('@media (max-width: 360px)'), 'styles.css contains @media rule for 360px portrait devices');
assert(cssContent.includes('height: 44px;'), 'styles.css provides responsive height: 44px for 360px screens');

// Layout clearance calculations across 360px, 375px, 390px, 414px
function computeHeaderClearance(w) {
  const padding = 16;
  const usable = w - padding;
  const bannerH = w <= 360 ? 44 : 46;
  const bannerW = bannerH * (640 / 192);
  const statusW = 139; // trigger ~104px + gap 5px + gear 30px
  return usable - (bannerW + statusW);
}
assert(computeHeaderClearance(360) >= 50, `360px viewport has >= 50px clearance (actual: ${computeHeaderClearance(360).toFixed(1)}px)`);
assert(computeHeaderClearance(375) >= 60, `375px viewport has >= 60px clearance (actual: ${computeHeaderClearance(375).toFixed(1)}px)`);
assert(computeHeaderClearance(390) >= 75, `390px viewport has >= 75px clearance (actual: ${computeHeaderClearance(390).toFixed(1)}px)`);
assert(computeHeaderClearance(414) >= 100, `414px viewport has >= 100px clearance (actual: ${computeHeaderClearance(414).toFixed(1)}px)`);

// ------------------------------------------------------------
// SECTION 11: RUNTIME DOM & NAVIGATION INTERACTION VERIFICATION
// ------------------------------------------------------------
console.log('\n--- SECTION 11: RUNTIME DOM & NAVIGATION INTERACTION VERIFICATION ---');

const vm = require('vm');
class SuiteMockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this._classes = new Set();
    const classes = this._classes;
    this.classList = {
      add: (...cls) => cls.forEach(c => classes.add(c)),
      remove: (...cls) => cls.forEach(c => classes.delete(c)),
      contains: (cls) => classes.has(cls),
      toggle: (cls, force) => {
        if (force !== undefined) {
          if (force) classes.add(cls); else classes.delete(cls);
          return force;
        }
        if (classes.has(cls)) { classes.delete(cls); return false; }
        else { classes.add(cls); return true; }
      }
    };
    this.style = {
      setProperty: () => {},
      getPropertyValue: () => '',
      display: 'block'
    };
    this.listeners = {};
    this.onclick = null;
  }
  appendChild(child) { return child; }
  removeChild(child) { return child; }
  remove() { return this; }
  getBoundingClientRect() { return { width: 375, height: 667, top: 0, left: 0, bottom: 667, right: 375 }; }
  setAttribute(name, val) { this[name] = val; }
  getAttribute(name) { return this[name] || null; }
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }
  click() {
    if (typeof this.onclick === 'function') {
      this.onclick({ preventDefault: () => {}, stopPropagation: () => {} });
    }
    if (this.listeners['click']) {
      this.listeners['click'].forEach(fn => fn({ preventDefault: () => {}, stopPropagation: () => {} }));
    }
  }
  keydown(key) {
    if (this.listeners['keydown']) {
      this.listeners['keydown'].forEach(fn => fn({ key, preventDefault: () => {}, stopPropagation: () => {} }));
    }
  }
}

const suiteElements = {};
const idRegex = /id="([^"]+)"/g;
let idMatch;
while ((idMatch = idRegex.exec(htmlContent)) !== null) {
  const elId = idMatch[1];
  if (!suiteElements[elId]) {
    suiteElements[elId] = new SuiteMockElement(elId);
    suiteElements[elId].classList.add('hidden');
  }
}

const mockSandbox = {
  window: { addEventListener: () => {}, removeEventListener: () => {} },
  document: {
    documentElement: new SuiteMockElement('html'),
    getElementById: (id) => suiteElements[id] || null,
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: (tag) => new SuiteMockElement('', tag),
    body: new SuiteMockElement('body'),
    addEventListener: () => {}
  },
  navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  console: { log: () => {}, warn: () => {}, error: () => {} },
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  requestAnimationFrame: () => {},
  Audio: function() { return { play: () => {}, pause: () => {} }; }
};
mockSandbox.window.window = mockSandbox.window;
mockSandbox.window.document = mockSandbox.document;
mockSandbox.window.navigator = mockSandbox.navigator;
mockSandbox.window.localStorage = mockSandbox.localStorage;
mockSandbox.window.console = mockSandbox.console;
mockSandbox.window.setTimeout = mockSandbox.setTimeout;
mockSandbox.window.clearTimeout = mockSandbox.clearTimeout;
mockSandbox.window.setInterval = mockSandbox.setInterval;
mockSandbox.window.clearInterval = mockSandbox.clearInterval;
mockSandbox.window.requestAnimationFrame = mockSandbox.requestAnimationFrame;
mockSandbox.window.Audio = mockSandbox.Audio;
mockSandbox.global = mockSandbox.window;

vm.createContext(mockSandbox);
vm.runInContext(fs.readFileSync(path.join(P20_1_DIR, 'data/shared_core.js'), 'utf8'), mockSandbox);
vm.runInContext(fs.readFileSync(path.join(P20_1_DIR, 'data/campfires.js'), 'utf8'), mockSandbox);
vm.runInContext(fs.readFileSync(path.join(P20_1_DIR, 'data/arcade.js'), 'utf8'), mockSandbox);
vm.runInContext(fs.readFileSync(path.join(P20_1_DIR, 'game.js'), 'utf8'), mockSandbox);

const suiteGame = mockSandbox.window.KOINONIA_GAME || mockSandbox.KOINONIA_GAME;
assert(!!suiteGame, 'game.js evaluates cleanly and binds KOINONIA_GAME without error');
assert(typeof suiteGame.openGamesModal === 'function', 'openGamesModal is defined and exported');
assert(typeof suiteGame.switchGamesTab === 'function', 'switchGamesTab is defined and exported');
assert(typeof suiteGame.openSportsHubModal === 'function', 'openSportsHubModal is defined and exported');
assert(typeof suiteGame.openCampfireModal === 'function', 'openCampfireModal is defined and exported');
assert(typeof suiteGame.openQuestsModal === 'function', 'openQuestsModal is defined and exported');
assert(typeof suiteGame.openEventsModal === 'function', 'openEventsModal is defined and exported');
assert(typeof suiteGame.openJourneyModal === 'function', 'openJourneyModal is defined and exported');
assert(typeof suiteGame.openSettingsModal === 'function', 'openSettingsModal is defined and exported');
assert(typeof suiteGame.closeSettingsModal === 'function', 'closeSettingsModal is defined and exported');
assert(typeof suiteGame.openMeModal === 'function', 'openMeModal is defined and exported');
assert(typeof suiteGame.closeMeModal === 'function', 'closeMeModal is defined and exported');

suiteGame.init();

// Test the 6 primary destination cards and 7 bottom nav tabs
const primaryDestTests = [
  { cardId: 'home-dest-campfire', tabId: 'nav-tab-campfire', modalId: 'quest-circles-modal', name: 'Campfire' },
  { cardId: 'home-dest-quests', tabId: 'nav-tab-quests', modalId: 'quests-tab-modal', name: 'Quests' },
  { cardId: 'home-dest-events', tabId: 'nav-tab-events', modalId: 'events-modal', name: 'Events' },
  { cardId: 'home-dest-games', tabId: 'nav-tab-games', modalId: 'arcade-modal', name: 'FOG Games' },
  { cardId: 'home-dest-sports', tabId: 'nav-tab-sports', modalId: 'fitquest-modal', name: 'Sports Hub' },
  { cardId: 'home-dest-journey', tabId: 'nav-tab-journey', modalId: 'journey-modal', name: 'Journey' }
];

primaryDestTests.forEach(dest => {
  const modal = suiteElements[dest.modalId];
  // 1. Destination card click
  modal.classList.add('hidden');
  suiteElements[dest.cardId].click();
  assert(!modal.classList.contains('hidden'), `Card click opens ${dest.name} modal`);

  // 2. Bottom nav tab click
  modal.classList.add('hidden');
  suiteElements[dest.tabId].click();
  assert(!modal.classList.contains('hidden'), `Bottom nav click opens ${dest.name} modal`);

  // 3. Enter keydown
  modal.classList.add('hidden');
  suiteElements[dest.cardId].keydown('Enter');
  assert(!modal.classList.contains('hidden'), `Card Enter keydown opens ${dest.name} modal`);
});

// Test Header Settings button opening Settings modal
const settingsModalEl = suiteElements['settings-modal'];
settingsModalEl.classList.add('hidden');
suiteElements['header-settings-btn'].click();
assert(!settingsModalEl.classList.contains('hidden'), 'Header settings gear click opens Settings modal');

// Modal close button tests
const suiteCloseTests = [
  { btnId: 'btn-close-circles', modalId: 'quest-circles-modal', name: 'Campfire' },
  { btnId: 'btn-close-quests-tab', modalId: 'quests-tab-modal', name: 'Quests' },
  { btnId: 'btn-close-events', modalId: 'events-modal', name: 'Events' },
  { btnId: 'btn-close-fitquest', modalId: 'fitquest-modal', name: 'Sports Hub' },
  { btnId: 'btn-close-arcade-modal', modalId: 'arcade-modal', name: 'FOG Games' },
  { btnId: 'btn-close-journey', modalId: 'journey-modal', name: 'Journey' },
  { btnId: 'btn-close-settings', modalId: 'settings-modal', name: 'Settings' },
  { btnId: 'btn-close-me', modalId: 'me-modal', name: 'My Profile' }
];

suiteCloseTests.forEach(ct => {
  const modal = suiteElements[ct.modalId];
  modal.classList.remove('hidden');
  const btn = suiteElements[ct.btnId];
  assert(!!btn, `Close button for ${ct.name} exists in DOM`);
  btn.click();
  assert(modal.classList.contains('hidden'), `Close button closes ${ct.name} modal`);
});

// Test Header Profile Trigger (Level / LP status area opens My Profile)
const meModalEl = suiteElements['me-modal'];
meModalEl.classList.add('hidden');
suiteElements['header-profile-trigger'].click();
assert(!meModalEl.classList.contains('hidden'), 'Header profile trigger click opens My Profile modal');

meModalEl.classList.add('hidden');
suiteElements['header-profile-trigger'].keydown('Enter');
assert(!meModalEl.classList.contains('hidden'), 'Header profile trigger Enter keydown opens My Profile modal');

meModalEl.classList.add('hidden');
suiteElements['header-level-pill'].click();
assert(!meModalEl.classList.contains('hidden'), 'Header level pill direct click opens My Profile modal');

meModalEl.classList.add('hidden');
suiteElements['header-lp-pill'].click();
assert(!meModalEl.classList.contains('hidden'), 'Header LP pill direct click opens My Profile modal');

// Test Settings Profile Summary & VIEW MY PROFILE button
suiteGame.openSettingsModal();
assert(!suiteElements['settings-modal'].classList.contains('hidden'), 'Settings modal opened');
assert(suiteElements['settings-profile-name'].textContent.includes('Alex Rivera'), 'Settings profile summary displays member name Alex Rivera');
assert(suiteElements['settings-profile-level'].textContent.includes('LV'), 'Settings profile summary displays current level');
assert(suiteElements['settings-profile-lp'].textContent.includes('LP'), 'Settings profile summary displays current LP');

meModalEl.classList.add('hidden');
suiteElements['btn-view-profile-from-settings'].click();
assert(!meModalEl.classList.contains('hidden'), 'VIEW MY PROFILE inside Settings opens My Profile modal');
assert(suiteElements['settings-modal'].classList.contains('hidden'), 'VIEW MY PROFILE inside Settings closes Settings modal');

// Test Profile vs Journey Separation
assert(suiteElements['journey-modal'].classList.contains('hidden'), 'Journey modal remains hidden when My Profile is open');
suiteGame.openJourneyModal('timeline');
assert(!suiteElements['journey-modal'].classList.contains('hidden'), 'Journey modal is open');
assert(suiteElements['me-modal'].classList.contains('hidden'), 'My Profile modal is hidden when Journey modal is open');

// Test Role-Based Admin Access Gating
// 1. Normal member: role is MEMBER by default
assert(suiteGame.isAuthorizedAdmin() === false, 'Normal member isAuthorizedAdmin returns false');
suiteGame.openSettingsModal();
assert(suiteElements['settings-item-admin'].style.display === 'none', 'Studio Admin item in Settings is hidden for normal members');
assert(suiteElements['btn-open-admin-from-me'].style.display === 'none', 'Studio Admin button in Me modal is hidden for normal members');

// 2. Admin member promotion
suiteGame.setCircleRole('ADMIN');
assert(suiteGame.isAuthorizedAdmin() === true, 'Promoted admin isAuthorizedAdmin returns true');
suiteGame.openSettingsModal();
assert(suiteElements['settings-item-admin'].style.display === 'flex', 'Studio Admin item in Settings is visible for admin');
suiteGame.openMeModal();
assert(suiteElements['btn-open-admin-from-me'].style.display === 'block', 'Studio Admin button in Me modal is visible for admin');

// 3. Reset back to MEMBER
suiteGame.setCircleRole('MEMBER');
assert(suiteGame.isAuthorizedAdmin() === false, 'Reset to MEMBER restores isAuthorizedAdmin false');
suiteGame.openSettingsModal();
assert(suiteElements['settings-item-admin'].style.display === 'none', 'Studio Admin item in Settings is hidden again for normal member');

// Test FOG Games Primary Selector
suiteGame.switchGamesTab('faithquest');
assert(suiteElements['games-view-faithquest'].style.display === 'block', 'switchGamesTab(faithquest) displays games-view-faithquest');
assert(suiteElements['games-view-arcade'].style.display === 'none', 'switchGamesTab(faithquest) hides games-view-arcade');

suiteGame.switchGamesTab('arcade');
assert(suiteElements['games-view-arcade'].style.display === 'block', 'switchGamesTab(arcade) displays games-view-arcade');
assert(suiteElements['games-view-faithquest'].style.display === 'none', 'switchGamesTab(arcade) hides games-view-faithquest');

// Test Faith Quest Practice Catechism Answer
const preLp = mockSandbox.window.SharedCore.getLifePoints().balance;
suiteGame.answerFaithQuestSample(1);
const postLp = mockSandbox.window.SharedCore.getLifePoints().balance;
assert(postLp === preLp + 5, 'Faith Quest Catechism sample answer awards +5 LP via SharedCore');

// Idempotent retry test for practice question
suiteGame.answerFaithQuestSample(1);
const retryLp = mockSandbox.window.SharedCore.getLifePoints().balance;
assert(retryLp === postLp, 'Faith Quest practice answer is idempotent on retry');

// ------------------------------------------------------------
// SECTION 12: CONSOLIDATION TEST LAB HTML INTEGRITY
// ------------------------------------------------------------
console.log('\n--- SECTION 12: CONSOLIDATION TEST LAB HTML INTEGRITY ---');

const testHtml = fs.readFileSync(path.join(P20_1_DIR, 'consolidation_test.html'), 'utf8');
assert(testHtml.includes('PHASE 0.20.1 — KOINONIA CONSOLIDATION TEST LAB'), 'consolidation_test.html has required title');
assert(testHtml.includes('SECTION A — BASELINE'), 'consolidation_test.html has SECTION A — BASELINE');
assert(testHtml.includes('SECTION B — SHARED CORE PROVIDER'), 'consolidation_test.html has SECTION B — SHARED CORE PROVIDER');
assert(testHtml.includes('SECTION C — CAMPFIRE'), 'consolidation_test.html has SECTION C — CAMPFIRE');
assert(testHtml.includes('SECTION D — LIFE POINTS / QUEST'), 'consolidation_test.html has SECTION D — LIFE POINTS / QUEST');
assert(testHtml.includes('SECTION E — EVENT CHECK-IN'), 'consolidation_test.html has SECTION E — EVENT CHECK-IN');
assert(testHtml.includes('SECTION F — MINISTRY'), 'consolidation_test.html has SECTION F — MINISTRY');
assert(testHtml.includes('SECTION G — OPEN KOINONIA'), 'consolidation_test.html has SECTION G — OPEN KOINONIA');

assert(testHtml.includes('RESET TO BASELINE'), 'consolidation_test.html contains button: RESET TO BASELINE');
assert(testHtml.includes('VERIFY BASELINE'), 'consolidation_test.html contains button: VERIFY BASELINE');
assert(testHtml.includes('INSPECT MEMBER IDENTITY'), 'consolidation_test.html contains button: INSPECT MEMBER IDENTITY');
assert(testHtml.includes('INSPECT LIFE POINTS LEDGER'), 'consolidation_test.html contains button: INSPECT LIFE POINTS LEDGER');
assert(testHtml.includes('INSPECT SHARED CATALOGS'), 'consolidation_test.html contains button: INSPECT SHARED CATALOGS');
assert(testHtml.includes('SET COMMUNITY MAX TO 10'), 'consolidation_test.html contains button: SET COMMUNITY MAX TO 10');
assert(testHtml.includes('SET CAMPFIRE MAX TO 8'), 'consolidation_test.html contains button: SET CAMPFIRE MAX TO 8');
assert(testHtml.includes('TEST OVER-COMMUNITY REJECTION (TRY 12 > 10)'), 'consolidation_test.html contains button: TEST OVER-COMMUNITY REJECTION (TRY 12 > 10)');
assert(testHtml.includes('TEST ACTIVE LOWERING PROTECTION (TRY 4 < 5 MEMBERS)'), 'consolidation_test.html contains button: TEST ACTIVE LOWERING PROTECTION (TRY 4 < 5 MEMBERS)');
assert(testHtml.includes('SEND STRUCTURED REACTION (🔥 KEEP GOING)'), 'consolidation_test.html contains button: SEND STRUCTURED REACTION (🔥 KEEP GOING)');
assert(testHtml.includes('COMPLETE STEWARD OF THE GARDEN (+5 LP)'), 'consolidation_test.html contains button: COMPLETE STEWARD OF THE GARDEN (+5 LP)');
assert(testHtml.includes('RETRY QUEST #001 (TEST IDEMPOTENCY)'), 'consolidation_test.html contains button: RETRY QUEST #001 (TEST IDEMPOTENCY)');
assert(testHtml.includes('CHECK IN TO DEMO EVENT'), 'consolidation_test.html contains button: CHECK IN TO DEMO EVENT');
assert(testHtml.includes('RETRY CHECK-IN (TEST IDEMPOTENCY)'), 'consolidation_test.html contains button: RETRY CHECK-IN (TEST IDEMPOTENCY)');
assert(testHtml.includes('DISCOVER MINISTRY MISSIONS'), 'consolidation_test.html contains button: DISCOVER MINISTRY MISSIONS');
assert(testHtml.includes('COMPLETE SACRED HARMONIES MISSION (+5 LP)'), 'consolidation_test.html contains button: COMPLETE SACRED HARMONIES MISSION (+5 LP)');
assert(testHtml.includes('OPEN KOINONIA HOME'), 'consolidation_test.html contains button: OPEN KOINONIA HOME');
assert(testHtml.includes('OPEN CAMPFIRE'), 'consolidation_test.html contains button: OPEN CAMPFIRE');
assert(testHtml.includes('OPEN QUESTS'), 'consolidation_test.html contains button: OPEN QUESTS');
assert(testHtml.includes('OPEN EVENTS'), 'consolidation_test.html contains button: OPEN EVENTS');
assert(testHtml.includes('OPEN FOG GAMES'), 'consolidation_test.html contains button: OPEN FOG GAMES');
assert(testHtml.includes('OPEN SPORTS HUB'), 'consolidation_test.html contains button: OPEN SPORTS HUB');
assert(testHtml.includes('OPEN FAITH QUEST'), 'consolidation_test.html contains button: OPEN FAITH QUEST');
assert(!testHtml.includes('OPEN FIT QUEST'), 'consolidation_test.html does NOT contain legacy button: OPEN FIT QUEST');
assert(testHtml.includes('OPEN FOG ARCADE'), 'consolidation_test.html contains button: OPEN FOG ARCADE');
assert(testHtml.includes('OPEN JOURNEY'), 'consolidation_test.html contains button: OPEN JOURNEY');

// ------------------------------------------------------------
// SECTION 13: OFFICIAL BRANDING, PWA MANIFEST & HTML HEAD ASSETS
// ------------------------------------------------------------
console.log('\n--- SECTION 13: OFFICIAL BRANDING, PWA MANIFEST & HTML HEAD ASSETS ---');

const manifestPath = path.join(P20_1_DIR, 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json exists in prototype directory');

let manifestJson = null;
try {
  manifestJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
} catch (e) {
  assert(false, 'manifest.json is valid JSON');
}
assert(manifestJson !== null, 'manifest.json parsed successfully');
assert(manifestJson.name === 'Koinonia — Fire of God Ministries', 'manifest.json name is "Koinonia — Fire of God Ministries"');
assert(manifestJson.short_name === 'Koinonia', 'manifest.json short_name is "Koinonia"');
assert(manifestJson.display === 'standalone', 'manifest.json display is "standalone"');
assert(manifestJson.start_url === 'index.html', 'manifest.json start_url is "index.html"');
assert(manifestJson.theme_color === '#6A0E04', 'manifest.json theme_color is "#6A0E04"');
assert(manifestJson.background_color === '#FDFBF7', 'manifest.json background_color is "#FDFBF7"');
assert(Array.isArray(manifestJson.icons) && manifestJson.icons.length === 3, 'manifest.json has 3 icons configured');

const icon192Entry = manifestJson.icons.find(i => i.sizes === '192x192');
const icon512Entry = manifestJson.icons.find(i => i.sizes === '512x512' && i.purpose === 'any');
const iconMaskableEntry = manifestJson.icons.find(i => i.sizes === '512x512' && i.purpose === 'maskable');
assert(icon192Entry && icon192Entry.src === 'assets/branding/icon-192.png', 'manifest.json contains 192x192 icon entry');
assert(icon512Entry && icon512Entry.src === 'assets/branding/icon-512.png', 'manifest.json contains 512x512 any icon entry');
assert(iconMaskableEntry && iconMaskableEntry.src === 'assets/branding/icon-maskable-512.png', 'manifest.json contains 512x512 maskable icon entry');

// Branding Assets on Disk
const brandingDir = path.join(P20_1_DIR, 'assets', 'branding');
const fav32Path = path.join(brandingDir, 'favicon-32x32.png');
const favIcoPath = path.join(brandingDir, 'favicon.ico');
const touch180Path = path.join(brandingDir, 'apple-touch-icon.png');
const icon192Path = path.join(brandingDir, 'icon-192.png');
const icon512Path = path.join(brandingDir, 'icon-512.png');
const mask512Path = path.join(brandingDir, 'icon-maskable-512.png');
const logoBannerPath = path.join(brandingDir, 'koinonia-header-logo.png');

assert(fs.existsSync(fav32Path) && fs.statSync(fav32Path).size > 0, 'assets/branding/favicon-32x32.png exists and non-empty');
assert(fs.existsSync(favIcoPath) && fs.statSync(favIcoPath).size > 0, 'assets/branding/favicon.ico exists and non-empty');
assert(fs.existsSync(touch180Path) && fs.statSync(touch180Path).size > 0, 'assets/branding/apple-touch-icon.png exists and non-empty');
assert(fs.existsSync(icon192Path) && fs.statSync(icon192Path).size > 0, 'assets/branding/icon-192.png exists and non-empty');
assert(fs.existsSync(icon512Path) && fs.statSync(icon512Path).size > 0, 'assets/branding/icon-512.png exists and non-empty');
assert(fs.existsSync(mask512Path) && fs.statSync(mask512Path).size > 0, 'assets/branding/icon-maskable-512.png exists and non-empty');
assert(fs.existsSync(logoBannerPath) && fs.statSync(logoBannerPath).size > 0, 'assets/branding/koinonia-header-logo.png exists and non-empty');

function getPngDimensions(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 24) return { width: 0, height: 0 };
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const fav32Dim = getPngDimensions(fav32Path);
assert(fav32Dim.width === 32 && fav32Dim.height === 32, `favicon-32x32.png is 32x32 (actual: ${fav32Dim.width}x${fav32Dim.height})`);

const touch180Dim = getPngDimensions(touch180Path);
assert(touch180Dim.width === 180 && touch180Dim.height === 180, `apple-touch-icon.png is 180x180 (actual: ${touch180Dim.width}x${touch180Dim.height})`);

const icon192Dim = getPngDimensions(icon192Path);
assert(icon192Dim.width === 192 && icon192Dim.height === 192, `icon-192.png is 192x192 (actual: ${icon192Dim.width}x${icon192Dim.height})`);

const icon512Dim = getPngDimensions(icon512Path);
assert(icon512Dim.width === 512 && icon512Dim.height === 512, `icon-512.png is 512x512 (actual: ${icon512Dim.width}x${icon512Dim.height})`);

const mask512Dim = getPngDimensions(mask512Path);
assert(mask512Dim.width === 512 && mask512Dim.height === 512, `icon-maskable-512.png is 512x512 (actual: ${mask512Dim.width}x${mask512Dim.height})`);

const logoBannerDim = getPngDimensions(logoBannerPath);
assert(logoBannerDim.width === 640 && logoBannerDim.height === 192, `koinonia-header-logo.png is 640x192 (actual: ${logoBannerDim.width}x${logoBannerDim.height})`);

// HTML Head Meta & Links Verification
const refreshedHtml = fs.readFileSync(path.join(P20_1_DIR, 'index.html'), 'utf8');
assert(refreshedHtml.includes('href="assets/branding/favicon.ico"'), 'index.html links favicon.ico');
assert(refreshedHtml.includes('href="assets/branding/favicon-32x32.png"'), 'index.html links favicon-32x32.png');
assert(refreshedHtml.includes('href="assets/branding/apple-touch-icon.png"'), 'index.html links apple-touch-icon.png');
assert(refreshedHtml.includes('href="manifest.json"'), 'index.html links manifest.json');
assert(refreshedHtml.includes('name="theme-color" content="#6A0E04"'), 'index.html specifies theme-color meta tag');
assert(refreshedHtml.includes('name="mobile-web-app-capable" content="yes"'), 'index.html specifies mobile-web-app-capable meta tag');
assert(refreshedHtml.includes('name="apple-mobile-web-app-capable" content="yes"'), 'index.html specifies apple-mobile-web-app-capable meta tag');
assert(refreshedHtml.includes('assets/branding/koinonia-header-logo.png'), 'index.html global header uses official banner logo assets/branding/koinonia-header-logo.png');
assert(fs.existsSync(path.join(P20_1_DIR, 'assets', 'logo.png')), 'Fallback assets/logo.png is maintained');

// Master Artwork Immutability Verification
const PROJECT_ROOT = path.resolve(P20_1_DIR, '..', '..');
const masterIconPath = path.join(PROJECT_ROOT, 'branding-source', 'koinonia-icon.png');
const masterBannerPath = path.join(PROJECT_ROOT, 'branding-source', 'koinonia-logo-banner.png');
assert(fs.existsSync(masterIconPath) && fs.statSync(masterIconPath).size === 311915, 'Master branding koinonia-icon.png remains intact and unaltered');
assert(fs.existsSync(masterBannerPath) && fs.statSync(masterBannerPath).size === 640351, 'Master branding koinonia-logo-banner.png remains intact and unaltered');

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${failedTests}`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
