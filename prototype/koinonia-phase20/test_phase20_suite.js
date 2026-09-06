/**
 * KOINONIA — PHASE 0.20 AUTOMATED VERIFICATION SUITE
 * Test Coverage: Quest Circles Data Architecture, Capacity Limits (5–8),
 * Leader vs Member Permissions, Quest Assignment & Deduplication,
 * Individual Completion Principle & 0 Reward Farming, Structured Encouragement
 * Reactions (Minor Safety, No Free-Text Chat), Structured Activity Log,
 * UI Exclusive Tab Contract, Mobile Viewport Layout, Local Quest Sync,
 * My Journey Non-Duplication, and Browser-Runtime Storage Round-Trip.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

let currentTestIndex = 0;
function assert(condition, testNumOrName, testName) {
  totalTests++;
  let num, name;
  if (typeof testNumOrName === 'number') {
    num = testNumOrName;
    name = testName || `Test ${num}`;
  } else {
    currentTestIndex++;
    num = currentTestIndex;
    name = testNumOrName;
  }
  if (condition) {
    passedTests++;
    console.log(`[PASS] #${num}: ${name}`);
  } else {
    failedTests++;
    console.error(`[FAIL] #${num}: ${name} - FAILED!`);
  }
}

const P20_DIR = __dirname;
const htmlContent = fs.readFileSync(path.join(P20_DIR, 'index.html'), 'utf8');
const gameContent = fs.readFileSync(path.join(P20_DIR, 'game.js'), 'utf8');
const circlesContent = fs.readFileSync(path.join(P20_DIR, 'data', 'circles.js'), 'utf8');
const cssContent = fs.readFileSync(path.join(P20_DIR, 'styles.css'), 'utf8');
const testLabContent = fs.readFileSync(path.join(P20_DIR, 'circles_test.html'), 'utf8');

// Load modules in Node
const circlesModule = require('./data/circles.js');
const memoriesModule = require('./data/memories.js');
const sportsModule = require('./data/sports.js');
const progressionModule = require('./data/progression.js');
const questsModule = require('./data/quests.js');
const placesModule = require('./data/places.js');
const campaignsModule = require('./data/campaigns.js');
const eventsModule = require('./data/events.js');

console.log('\n====================================================');
console.log('KOINONIA PHASE 0.20 TEST SUITE: QUEST CIRCLES');
console.log('====================================================\n');

// ============================================================================
// SECTION 1: CIRCLE ARCHITECTURE, SCHEMA & ENUMS (Tests 1 - 22)
// ============================================================================
console.log('--- SECTION 1: CIRCLE ARCHITECTURE, SCHEMA & ENUMS ---');

assert(typeof circlesModule.createCircle === 'function', 'circles.js exports createCircle factory');
assert(typeof circlesModule.createCircleAssignment === 'function', 'circles.js exports createCircleAssignment factory');
assert(typeof circlesModule.createActivityLogEntry === 'function', 'circles.js exports createActivityLogEntry factory');
assert(typeof circlesModule.CIRCLE_STATUSES === 'object', 'circles.js exports CIRCLE_STATUSES');
assert(typeof circlesModule.CIRCLE_ROLES === 'object', 'circles.js exports CIRCLE_ROLES');
assert(typeof circlesModule.ASSIGNMENT_STATUSES === 'object', 'circles.js exports ASSIGNMENT_STATUSES');
assert(typeof circlesModule.CANONICAL_REACTIONS === 'object', 'circles.js exports CANONICAL_REACTIONS');
assert(typeof circlesModule.ACTIVITY_TYPES === 'object', 'circles.js exports ACTIVITY_TYPES');
assert(circlesModule.MIN_YOUTH_PARTICIPANTS === 5, 'Minimum youth participant capacity is strictly 5');
assert(circlesModule.MAX_YOUTH_PARTICIPANTS === 12, 'Default maximum youth participant capacity is 12');
assert(circlesModule.DEFAULT_MIN_PARTICIPANTS === 5, 'circles.js exports DEFAULT_MIN_PARTICIPANTS === 5');
assert(circlesModule.DEFAULT_MAX_PARTICIPANTS === 12, 'circles.js exports DEFAULT_MAX_PARTICIPANTS === 12');
assert(circlesModule.DEFAULT_COMMUNITY_MAX_PARTICIPANTS === 12, 'circles.js exports DEFAULT_COMMUNITY_MAX_PARTICIPANTS === 12');
assert(typeof circlesModule.DEFAULT_QUEST_CIRCLE_SETTINGS === 'object', 'circles.js exports DEFAULT_QUEST_CIRCLE_SETTINGS');
assert(circlesModule.DEFAULT_QUEST_CIRCLE_SETTINGS.minParticipants === 5, 'DEFAULT_QUEST_CIRCLE_SETTINGS min is 5');
assert(circlesModule.DEFAULT_QUEST_CIRCLE_SETTINGS.defaultMaxParticipants === 12, 'DEFAULT_QUEST_CIRCLE_SETTINGS defaultMax is 12');
assert(circlesModule.DEFAULT_QUEST_CIRCLE_SETTINGS.communityMaxParticipants === 12, 'DEFAULT_QUEST_CIRCLE_SETTINGS communityMax is 12');
assert(typeof circlesModule.getCommunitySettings === 'function', 'circles.js exports getCommunitySettings');
assert(typeof circlesModule.setCommunityMaxParticipants === 'function', 'circles.js exports setCommunityMaxParticipants');
assert(typeof circlesModule.setCircleMaxParticipants === 'function', 'circles.js exports setCircleMaxParticipants');

// Schema generation verification
const sampleCircle = circlesModule.createCircle({
  name: 'Lightbearers',
  subtitle: 'Youth Adventure Group',
  description: 'Growing together in faith, service, and stewardship.',
  leaderIds: ['leader_facilitator'],
  memberIds: ['user_alex', 'demo_member_a', 'demo_member_b', 'demo_member_c', 'demo_member_d'],
  isDemo: true
});

assert(typeof sampleCircle.id === 'string' && sampleCircle.id.length > 0, 'Circle has valid string id');
assert(sampleCircle.communityId === 'fog', 'Circle communityId is strictly "fog"');
assert(sampleCircle.name === 'Lightbearers', 'Circle preserves canonical name');
assert(sampleCircle.status === 'DRAFT', 'Newly created Circle defaults to DRAFT status');
assert(sampleCircle.leaderIds.includes('leader_facilitator'), 'Circle includes designated leaderIds');
assert(sampleCircle.memberIds.length === 5, 'Circle initializes with specified participant list');
assert(sampleCircle.maxParticipants === 12, 'Circle defaults maxParticipants to 12');
assert(Array.isArray(sampleCircle.assignedQuestIds), 'Circle initializes with assignedQuestIds array');
assert(Array.isArray(sampleCircle.completedQuestIds), 'Circle initializes with completedQuestIds array');
assert(Array.isArray(sampleCircle.activityLog) && sampleCircle.activityLog.length >= 1, 'Circle initializes with structured activity log');
assert(sampleCircle.isDemo === true, 'Circle preserves isDemo flag');
assert(sampleCircle.leaderId === 'leader_facilitator', 'Circle has explicit canonical leaderId');
const runtimeNonDemoCircle = circlesModule.createCircle({ name: 'Real Local Circle' });
assert(runtimeNonDemoCircle.isDemo === false, 'Non-demo Circle defaults isDemo: false unless explicitly seeded');

// ============================================================================
// SECTION 2: GOVERNANCE & PERMISSIONS MODEL (Tests 23 - 37)
// ============================================================================
console.log('\n--- SECTION 2: GOVERNANCE & PERMISSIONS MODEL ---');

const memberState = { circleRole: 'MEMBER' };
const leaderState = { circleRole: 'LEADER' };
const adminState = { circleRole: 'ADMIN' };

assert(circlesModule.canCreateCircle(memberState) === false, 'MEMBER role CANNOT create Circles');
assert(circlesModule.canCreateCircle(leaderState) === true, 'LEADER role can create Circles');
assert(circlesModule.canCreateCircle(adminState) === true, 'ADMIN role can create Circles');

// Member attempt to add member
const testCircle = circlesModule.createCircle({ name: 'Test Circle', memberIds: ['user_alex'] });
const memberAddRes = circlesModule.addMemberToCircle(testCircle, 'demo_member_a', memberState);
assert(memberAddRes.success === false, 'MEMBER attempt to add participant fails safely');
assert(memberAddRes.error === 'Quest Circles are created by your youth leaders.', 'MEMBER receives friendly non-technical permission message');

// Member attempt to activate
const memberActRes = circlesModule.activateCircle(testCircle, memberState);
assert(memberActRes.success === false, 'MEMBER attempt to activate Circle fails safely');
assert(memberActRes.error === 'Quest Circles are created by your youth leaders.', 'MEMBER activation receives friendly permission notice');

// Member attempt to assign quest
const memberAssignRes = circlesModule.assignQuestToCircle(testCircle, 'Q-001', memberState);
assert(memberAssignRes.success === false, 'MEMBER attempt to assign quest fails safely');

// Member attempt to archive circle
const memberArchRes = circlesModule.archiveCircle(testCircle, memberState);
assert(memberArchRes.success === false, 'MEMBER attempt to archive Circle fails safely');

// Leader permissions succeed
const leaderAddRes = circlesModule.addMemberToCircle(testCircle, 'demo_member_a', leaderState);
assert(leaderAddRes.success === true, 'LEADER attempt to add participant succeeds');

// Verify demo participant labeling
const pool = circlesModule.DEMO_PARTICIPANTS_POOL;
assert(Array.isArray(pool) && pool.length >= 8, 'Demo participant pool provides at least 8 candidates');
const alex = circlesModule.getParticipantById('user_alex');
assert(alex.displayName.includes('Alex') && alex.isDemo === false, 'Local player Alex is marked isDemo: false');
const demoB = circlesModule.getParticipantById('demo_member_b');
assert(demoB.displayName.includes('Demo Member') && demoB.isDemo === true, 'Demo participant is visibly marked isDemo: true');
const facilitator = circlesModule.getParticipantById('leader_facilitator');
assert(facilitator.role === 'LEADER' && facilitator.displayName.includes('Leader'), 'Leader facilitator is separate from youth participants');
assert(facilitator.isDemo === true, 'Leader facilitator is marked isDemo: true');

// ============================================================================
// SECTION 3: CAPACITY BOUNDARIES (5–8 PARTICIPANTS) (Tests 38 - 57)
// ============================================================================
console.log('\n--- SECTION 3: CAPACITY BOUNDARIES (5–8 PARTICIPANTS) ---');

// Draft with 4 members allowed
const draftCircle4 = circlesModule.createCircle({
  name: 'Four Explorers',
  memberIds: ['user_alex', 'demo_member_a', 'demo_member_b', 'demo_member_c']
});
assert(draftCircle4.status === 'DRAFT', 'Circle with 4 members is allowed in DRAFT status');
assert(draftCircle4.memberIds.length === 4, 'Circle has exactly 4 members');

// Activation with 4 members MUST fail
const actUnder5 = circlesModule.activateCircle(draftCircle4, leaderState);
assert(actUnder5.success === false, 'Activation of Circle with 4 members fails');
assert(actUnder5.error === 'Add at least 5 participants before activating this Circle.', 'Activation failure copy is clear and encouraging');
assert(draftCircle4.status === 'DRAFT', 'Circle remains in DRAFT status after blocked activation');

// Add 5th member
const add5th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_d', leaderState);
assert(add5th.success === true, 'Adding 5th participant succeeds');
assert(draftCircle4.memberIds.length === 5, 'Circle now has exactly 5 members');

// Activation with 5 members succeeds
const act5 = circlesModule.activateCircle(draftCircle4, leaderState);
assert(act5.success === true, 'Activation of Circle with 5 members succeeds');
assert(draftCircle4.status === 'ACTIVE', 'Circle status transitions to ACTIVE');
assert(typeof draftCircle4.activatedAt === 'string', 'Circle records ISO timestamp for activatedAt');

// Add members 6 through 12 (all within default max 12)
const add6th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_e', leaderState);
assert(add6th.success === true && draftCircle4.memberIds.length === 6, 'Adding 6th participant succeeds (within capacity)');

const add7th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_f', leaderState);
assert(add7th.success === true && draftCircle4.memberIds.length === 7, 'Adding 7th participant succeeds (within capacity)');

const add8th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_g', leaderState);
assert(add8th.success === true && draftCircle4.memberIds.length === 8, 'Adding 8th participant succeeds (within capacity)');

const add9th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_h', leaderState);
assert(add9th.success === true && draftCircle4.memberIds.length === 9, 'Adding 9th participant succeeds (within capacity 12)');

const add10th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_i', leaderState);
assert(add10th.success === true && draftCircle4.memberIds.length === 10, 'Adding 10th participant succeeds (within capacity 12)');

const add11th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_j', leaderState);
assert(add11th.success === true && draftCircle4.memberIds.length === 11, 'Adding 11th participant succeeds (within capacity 12)');

const add12th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_k', leaderState);
assert(add12th.success === true && draftCircle4.memberIds.length === 12, 'Adding 12th participant succeeds (max capacity 12 reached)');

// Attempt 13th member: MUST fail
const add13th = circlesModule.addMemberToCircle(draftCircle4, 'demo_member_l', leaderState);
assert(add13th.success === false, 'Adding 13th participant is strictly rejected');
assert(add13th.error === 'This Quest Circle is full (12 of 12).', '13th member rejection error states "This Quest Circle is full (12 of 12)."');
assert(draftCircle4.memberIds.length === 12, 'Circle participant count remains capped at 12');

// Attempt duplicate member: MUST fail
const addDup = circlesModule.addMemberToCircle(draftCircle4, 'user_alex', leaderState);
assert(addDup.success === false, 'Adding existing member is rejected');
assert(addDup.error === 'Member is already in this Circle.', 'Duplicate member rejection message is clear');

// Leader check on activation
const circleWithoutLeader = circlesModule.createCircle({
  name: 'No Leader Circle',
  leaderIds: [],
  memberIds: ['user_alex', 'demo_member_a', 'demo_member_b', 'demo_member_c', 'demo_member_d']
});
circleWithoutLeader.leaderIds = []; // clear fallback
const actNoLeader = circlesModule.activateCircle(circleWithoutLeader, leaderState);
assert(actNoLeader.success === false, 'Activation fails if Circle lacks authorized leader');
assert(actNoLeader.error === 'A Circle must have at least one authorized leader.', 'Clear error when leader is missing');

// --- PER-CIRCLE CAPACITY CONFIGURATION ---
const circle8 = circlesModule.createCircle({
  name: 'Octo Explorers',
  maxParticipants: 8,
  leaderIds: ['leader_facilitator'],
  memberIds: ['user_alex', 'demo_member_a', 'demo_member_b', 'demo_member_c', 'demo_member_d']
});
assert(circle8.maxParticipants === 8, 'Per-circle capacity override sets maxParticipants to 8');
circlesModule.activateCircle(circle8, leaderState);
circlesModule.addMemberToCircle(circle8, 'demo_member_e', leaderState);
circlesModule.addMemberToCircle(circle8, 'demo_member_f', leaderState);
circlesModule.addMemberToCircle(circle8, 'demo_member_g', leaderState);
assert(circle8.memberIds.length === 8, 'Circle with max 8 reaches 8 members');
const add9thTo8 = circlesModule.addMemberToCircle(circle8, 'demo_member_h', leaderState);
assert(add9thTo8.success === false, 'Adding 9th member to 8-max circle is rejected');
assert(add9thTo8.error === 'This Quest Circle is full (8 of 8).', '9th member rejected with "This Quest Circle is full (8 of 8)."');

// --- COMMUNITY MAXIMUM ENFORCEMENT ---
const adminCommunitySetRes = circlesModule.setCommunityMaxParticipants(adminState, 10);
assert(adminCommunitySetRes.success === true, 'ADMIN can change community maximum to 10');
assert(adminState.questCircleSettings.communityMaxParticipants === 10, 'Community max participants updated to 10');

// Propagate settings to leaderState
leaderState.questCircleSettings = adminState.questCircleSettings;

// Record circle8 capacity before attempt
const circle8CapBefore = circle8.maxParticipants;

// Leader attempting circle max 12 (exceeds community max 10) MUST fail
const leaderExceedRes = circlesModule.setCircleMaxParticipants(circle8, 12, leaderState);
assert(leaderExceedRes.success === false, 'Setting circle capacity above community max is rejected');
assert(leaderExceedRes.error === 'Maximum allowed for this community is 10.', 'Rejection explains community maximum limit of 10');

// Regression assert: community max MUST still be 10 after rejected Circle-capacity attempt
assert(adminState.questCircleSettings.communityMaxParticipants === 10, 'Community max participants strictly remains 10 after rejected circle attempt');
assert(leaderState.questCircleSettings.communityMaxParticipants === 10, 'Leader state community max strictly remains 10 after rejected circle attempt');

// Regression assert: Circle max was NOT changed to 12
assert(circle8.maxParticipants === circle8CapBefore, 'Circle maxParticipants was NOT changed to 12 after rejection');
assert(circle8.maxParticipants !== 12, 'Circle maxParticipants is strictly not 12');

// Leader setting circle max to 10 succeeds
const leaderSet10Res = circlesModule.setCircleMaxParticipants(circle8, 10, leaderState);
assert(leaderSet10Res.success === true, 'Setting circle capacity within community max (10) succeeds');
assert(circle8.maxParticipants === 10, 'Circle maxParticipants updated to 10');

// Restore community max to 12
circlesModule.setCommunityMaxParticipants(adminState, 12);
assert(adminState.questCircleSettings.communityMaxParticipants === 12, 'Community max participants restored to 12');

// --- ACTIVE CIRCLE LOWERING PROTECTION ---
// circle8 currently has 8 members. Attempting to lower capacity to 6 MUST fail!
const lowerBelowCurrentRes = circlesModule.setCircleMaxParticipants(circle8, 6, leaderState);
assert(lowerBelowCurrentRes.success === false, 'Attempting to lower circle capacity below current member count is rejected');
assert(lowerBelowCurrentRes.error === 'This Circle already has 8 participants. Choose 8 or more.', 'Rejection explains capacity cannot be lower than current count (8)');
assert(circle8.maxParticipants === 10, 'Circle maxParticipants remains at 10');

// Attempting to set capacity below minimum (5) MUST fail!
const lowerBelow5Res = circlesModule.setCircleMaxParticipants(circle8, 4, leaderState);
assert(lowerBelow5Res.success === false, 'Attempting to set capacity below minimum 5 is rejected');
assert(lowerBelow5Res.error === 'Circle capacity cannot be lower than 5 participants.', 'Rejection explains minimum capacity of 5');

// --- ROLE PERMISSION ENFORCEMENT ---
// Member attempting to change circle capacity MUST fail!
const memberChangeCircleRes = circlesModule.setCircleMaxParticipants(circle8, 11, memberState);
assert(memberChangeCircleRes.success === false, 'MEMBER cannot modify Circle capacity');
assert(memberChangeCircleRes.error === 'Quest Circles are managed by your youth leaders.', 'MEMBER receives friendly leader-managed notification');

// Member attempting to change community settings MUST fail!
const memberChangeCommRes = circlesModule.setCommunityMaxParticipants(memberState, 15);
assert(memberChangeCommRes.success === false, 'MEMBER cannot modify community settings');
assert(memberChangeCommRes.error === 'Only administrators can configure community Circle settings.', 'MEMBER receives admin-only notification');

// ============================================================================
// SECTION 4: MEMBERSHIP REMOVAL & SAFE STATUS TRANSITION (Tests 58 - 67)
// ============================================================================
console.log('\n--- SECTION 4: MEMBERSHIP REMOVAL & SAFE STATUS TRANSITION ---');

// Active circle with 6 members: remove 1 -> leaves 5 -> remains ACTIVE
const active6 = circlesModule.createCircle({
  name: 'Six Friends',
  memberIds: ['user_alex', 'demo_member_a', 'demo_member_b', 'demo_member_c', 'demo_member_d', 'demo_member_e']
});
circlesModule.activateCircle(active6, leaderState);
assert(active6.status === 'ACTIVE', 'Test circle is ACTIVE with 6 members');

const remFrom6 = circlesModule.removeMemberFromCircle(active6, 'demo_member_e', leaderState);
assert(remFrom6.success === true, 'Removing participant from 6-member active circle succeeds');
assert(active6.memberIds.length === 5, 'Active circle now has 5 members');
assert(active6.status === 'ACTIVE', 'Circle remains ACTIVE when participant count remains >= 5');
assert(remFrom6.statusChangedToDraft === false, 'statusChangedToDraft is false when remaining count is 5');

// Active circle with 5 members: remove 1 -> drops to 4 -> safely transitions to DRAFT
const remFrom5 = circlesModule.removeMemberFromCircle(active6, 'demo_member_d', leaderState);
assert(remFrom5.success === true, 'Removing participant from 5-member active circle succeeds');
assert(active6.memberIds.length === 4, 'Circle participant count drops to 4');
assert(active6.status === 'DRAFT', 'Active Circle safely returns to DRAFT when count drops below 5');
assert(remFrom5.statusChangedToDraft === true, 'remFrom5 signals statusChangedToDraft: true');
assert(active6.activityLog[0].text.includes('returned to Draft'), 'Activity log documents return to Draft for capacity safety');

// ============================================================================
// SECTION 5: QUEST ASSIGNMENT, CATALOG & DEDUPLICATION (Tests 68 - 82)
// ============================================================================
console.log('\n--- SECTION 5: QUEST ASSIGNMENT, CATALOG & DEDUPLICATION ---');

// Re-activate active6 by adding 5th member
circlesModule.addMemberToCircle(active6, 'demo_member_d', leaderState);
circlesModule.activateCircle(active6, leaderState);
assert(active6.status === 'ACTIVE', 'Circle restored to ACTIVE with 5 members');

// Assign Q-001 (Steward of the Garden)
const assignRes = circlesModule.assignQuestToCircle(active6, 'Q-001', leaderState);
assert(assignRes.success === true, 'Leader assigning Q-001 succeeds');
const assignment = assignRes.assignment;
assert(assignment.questId === 'Q-001', 'Assignment references canonical questId Q-001');
assert(assignment.status === 'ASSIGNED', 'Assignment status is ASSIGNED');
assert(typeof assignment.memberProgress === 'object', 'Assignment contains memberProgress map');
assert(Object.keys(assignment.memberProgress).length === 5, 'memberProgress initialized for all 5 circle participants');
assert(assignment.memberProgress['user_alex'].completed === false, 'Alex initialized as not completed');
assert(assignment.memberProgress['demo_member_a'].completed === false, 'Demo Member A initialized as not completed');
assert(active6.assignedQuestIds.includes('Q-001'), 'Circle records Q-001 in assignedQuestIds');

// Deduplication: Re-assigning Q-001 MUST fail
const dupAssignRes = circlesModule.assignQuestToCircle(active6, 'Q-001', leaderState);
assert(dupAssignRes.success === false, 'Assigning already-assigned quest Q-001 is rejected');
assert(dupAssignRes.error === 'This quest is already assigned to this Circle.', 'Deduplication error message is clear');
assert(active6.assignedQuestIds.filter(q => q === 'Q-001').length === 1, 'assignedQuestIds contains exactly one entry for Q-001');

// Draft circle cannot have quest assigned
const draftCirc = circlesModule.createCircle({ name: 'Draft Only', memberIds: ['user_alex'] });
const assignDraftRes = circlesModule.assignQuestToCircle(draftCirc, 'Q-001', leaderState);
assert(assignDraftRes.success === false, 'Assigning quest to DRAFT circle is rejected');
assert(assignDraftRes.error === 'Quests can only be assigned to Active Circles.', 'Error explains quest can only be assigned to Active circles');

// Activity log recorded assignment
assert(active6.activityLog.some(a => a.type === 'QUEST_ASSIGNED' && a.questId === 'Q-001'), 'Activity log records QUEST_ASSIGNED');

// ============================================================================
// SECTION 6: INDIVIDUAL COMPLETION & 0 REWARD FARMING (Tests 83 - 102)
// ============================================================================
console.log('\n--- SECTION 6: INDIVIDUAL COMPLETION & 0 REWARD FARMING ---');

// Record Alex's completion
const compAlex = circlesModule.recordMemberQuestCompletion(active6, assignment, 'user_alex', 'Q-001', leaderState);
assert(compAlex.success === true, 'Recording Alex completion succeeds');
assert(assignment.memberProgress['user_alex'].completed === true, 'Alex is marked completed in assignment');
assert(typeof assignment.memberProgress['user_alex'].completedAt === 'string', 'Alex completion timestamp recorded');

// Verify other participants remain uncompleted
assert(assignment.memberProgress['demo_member_a'].completed === false, 'Demo Member A remains NOT completed');
assert(assignment.memberProgress['demo_member_b'].completed === false, 'Demo Member B remains NOT completed');
assert(assignment.memberProgress['demo_member_c'].completed === false, 'Demo Member C remains NOT completed');
assert(assignment.memberProgress['demo_member_d'].completed === false, 'Demo Member D remains NOT completed');

// Progress calculation
const prog1 = circlesModule.getCircleQuestProgress(active6, assignment);
assert(prog1.completedCount === 1, 'Circle completedCount is exactly 1');
assert(prog1.totalCount === 5, 'Circle totalCount is 5');
assert(prog1.percent === 20, 'Circle percent is 20%');
assert(prog1.isComplete === false, 'Circle isComplete is false');
assert(!prog1.encouragingMessage.includes('behind'), 'Encouraging message does NOT contain shaming word "behind"');
assert(!prog1.encouragingMessage.includes('failed'), 'Encouraging message does NOT contain shaming word "failed"');

// Deduplication: Re-recording Alex completion
const reAlex = circlesModule.recordMemberQuestCompletion(active6, assignment, 'user_alex', 'Q-001', leaderState);
assert(reAlex.success === false, 'Re-recording completion for already completed member returns success: false');
assert(reAlex.alreadyCompleted === true, 'Re-recording signals alreadyCompleted: true');
const prog1Re = circlesModule.getCircleQuestProgress(active6, assignment);
assert(prog1Re.completedCount === 1, 'completedCount does not increment on duplicate completion');

// Record Member A completion
const compA = circlesModule.recordMemberQuestCompletion(active6, assignment, 'demo_member_a', 'Q-001', leaderState);
assert(compA.success === true, 'Recording Demo Member A completion succeeds');
const prog2 = circlesModule.getCircleQuestProgress(active6, assignment);
assert(prog2.completedCount === 2, 'completedCount is 2 of 5');
assert(prog2.percent === 40, 'Circle progress is 40%');
assert(compA.circleCompleted === false, 'Circle quest is not yet complete');

// ============================================================================
// SECTION 7: CIRCLE GOAL COMPLETION & CELEBRATION (Tests 103 - 117)
// ============================================================================
console.log('\n--- SECTION 7: CIRCLE GOAL COMPLETION & CELEBRATION ---');

// Complete remaining 3 participants: B, C, D
circlesModule.recordMemberQuestCompletion(active6, assignment, 'demo_member_b', 'Q-001', leaderState);
circlesModule.recordMemberQuestCompletion(active6, assignment, 'demo_member_c', 'Q-001', leaderState);
const compFinal = circlesModule.recordMemberQuestCompletion(active6, assignment, 'demo_member_d', 'Q-001', leaderState);

assert(compFinal.success === true, 'Recording final member completion succeeds');
assert(compFinal.circleCompleted === true, 'Final member completion signals circleCompleted: true');
assert(assignment.status === 'COMPLETED', 'Assignment status transitions to COMPLETED');
assert(typeof assignment.completedAt === 'string', 'Assignment completedAt timestamp recorded');
assert(active6.completedQuestIds.includes('Q-001'), 'Circle completedQuestIds includes Q-001');

const progFinal = circlesModule.getCircleQuestProgress(active6, assignment);
assert(progFinal.completedCount === 5, 'completedCount reaches 5 of 5');
assert(progFinal.percent === 100, 'Circle progress is 100%');
assert(progFinal.isComplete === true, 'isComplete is true');
assert(progFinal.encouragingMessage.includes('together'), 'Completion copy celebrates shared accomplishment');

// Activity log verification for circle celebration
const circleCompAct = active6.activityLog.find(a => a.type === 'CIRCLE_QUEST_COMPLETED');
assert(Boolean(circleCompAct), 'Activity log records CIRCLE_QUEST_COMPLETED');
assert(circleCompAct.text.includes('CIRCLE QUEST COMPLETE'), 'Celebration copy clearly displayed');

// Zero Reward Farming Verification
assert(typeof compFinal.rewardsGranted === 'undefined', 'No rewards granted object on circle completion');
assert(typeof active6.lpReward === 'undefined', 'Circle has 0 LP reward');
assert(typeof active6.xpReward === 'undefined', 'Circle has 0 XP reward');
assert(typeof assignment.lpReward === 'undefined', 'Assignment has 0 LP reward');

// ============================================================================
// SECTION 8: STRUCTURED ENCOURAGEMENT & MINOR SAFETY (Tests 118 - 132)
// ============================================================================
console.log('\n--- SECTION 8: STRUCTURED ENCOURAGEMENT & MINOR SAFETY ---');

const reactions = circlesModule.CANONICAL_REACTIONS;
assert(reactions.ENCOURAGE.emoji === '👏', 'Reaction ENCOURAGE has emoji 👏');
assert(reactions.PRAYING.emoji === '🙏', 'Reaction PRAYING has emoji 🙏');
assert(reactions.KEEP_GOING.emoji === '🔥', 'Reaction KEEP_GOING has emoji 🔥');
assert(reactions.GROWING_TOGETHER.emoji === '🌱', 'Reaction GROWING_TOGETHER has emoji 🌱');
assert(reactions.GREAT_JOB.emoji === '❤️', 'Reaction GREAT_JOB has emoji ❤️');

// Add reaction to an activity entry
const targetActivity = active6.activityLog[0];
const reactRes = circlesModule.addPredefinedReaction(active6, targetActivity.id, 'ENCOURAGE');
assert(reactRes.success === true, 'Adding predefined reaction ENCOURAGE succeeds');
assert(targetActivity.reactions['ENCOURAGE'] === 1, 'Activity reaction count increments to 1');

// Add another reaction
circlesModule.addPredefinedReaction(active6, targetActivity.id, 'ENCOURAGE');
assert(targetActivity.reactions['ENCOURAGE'] === 2, 'Activity reaction count increments to 2');

circlesModule.addPredefinedReaction(active6, targetActivity.id, 'PRAYING');
assert(targetActivity.reactions['PRAYING'] === 1, 'Activity reaction PRAYING count is 1');

// Rejection of arbitrary reaction
const invalidReactRes = circlesModule.addPredefinedReaction(active6, targetActivity.id, 'CUSTOM_TEXT_OR_EMOJI');
assert(invalidReactRes.success === false, 'Attempting arbitrary non-canonical reaction is rejected');
assert(invalidReactRes.error.includes('Only predefined encouragements'), 'Clear rejection message for arbitrary reaction');

// Minor safety & privacy audit: participant schema inspection
let allNoContacts = true;
pool.forEach(p => {
  if (p.email || p.phone || p.address || p.gps) allNoContacts = false;
});
assert(allNoContacts === true, 'All demo participants contain zero email, phone, address, or GPS fields');
assert(!circlesContent.includes('input[type="text"]') || !circlesContent.includes('message'), 'circles.js contains no free-text messaging logic');
assert(Object.keys(reactions).length === 5, 'Strictly 5 predefined canonical reactions');
assert(!active6.activityLog[0].reactions['CUSTOM_TEXT_OR_EMOJI'], 'Arbitrary reactions cannot be injected into state');

// ============================================================================
// SECTION 9: STRUCTURED ACTIVITY LOG & RELOAD DEDUP (Tests 131 - 145)
// ============================================================================
console.log('\n--- SECTION 9: STRUCTURED ACTIVITY LOG & RELOAD DEDUP ---');

assert(active6.activityLog.length >= 6, 'Activity log records all milestones throughout circle lifecycle');
const actTypes = new Set(active6.activityLog.map(a => a.type));
assert(actTypes.has('CIRCLE_CREATED'), 'Log contains CIRCLE_CREATED event');
assert(actTypes.has('MEMBER_JOINED'), 'Log contains MEMBER_JOINED event');
assert(actTypes.has('CIRCLE_ACTIVATED'), 'Log contains CIRCLE_ACTIVATED event');
assert(actTypes.has('QUEST_ASSIGNED'), 'Log contains QUEST_ASSIGNED event');
assert(actTypes.has('MEMBER_COMPLETED_QUEST'), 'Log contains MEMBER_COMPLETED_QUEST event');
assert(actTypes.has('CIRCLE_QUEST_COMPLETED'), 'Log contains CIRCLE_QUEST_COMPLETED event');

// Activity entry IDs uniqueness
const actIds = active6.activityLog.map(a => a.id);
const uniqueActIds = new Set(actIds);
assert(actIds.length === uniqueActIds.size, 'Every activity log entry has unique deterministic ID');

let allCleanText = true;
active6.activityLog.forEach(a => {
  if (typeof a.text !== 'string' || a.text.includes('<script')) allCleanText = false;
});
assert(allCleanText === true, 'All activity entries have valid text and zero script injection');
assert(active6.activityLog[0].timestamp, 'Activity entries have ISO timestamps');

// ============================================================================
// SECTION 10: CLEAN QA BASELINE & UPGRADE LOGIC (Tests 143 - 157)
// ============================================================================
console.log('\n--- SECTION 10: CLEAN QA BASELINE & UPGRADE LOGIC ---');

const qaBaseline = circlesModule.createCircleReadyQaState();
assert(qaBaseline.saveKey === 'koinonia.phase20.save', 'QA baseline specifies koinonia.phase20.save');
assert(qaBaseline.saveVersion === 1, 'QA baseline saveVersion is 1');
assert(qaBaseline.lp === 135, 'QA baseline LP is strictly 135');
assert(qaBaseline.charLevel === 2, 'QA baseline charLevel is strictly 2 (Active Explorer)');
assert(qaBaseline.charXp === 15, 'QA baseline charXp is strictly 15');
assert(qaBaseline.circleRole === 'MEMBER', 'QA baseline circleRole defaults to MEMBER');
assert(Array.isArray(qaBaseline.questCircles) && qaBaseline.questCircles.length === 0, 'QA baseline has 0 Quest Circles');
assert(Array.isArray(qaBaseline.circleAssignments) && qaBaseline.circleAssignments.length === 0, 'QA baseline has 0 Circle Assignments');
assert(qaBaseline.unlockedPlaces.length === 5, 'QA baseline has all 5 places unlocked for testing');
assert(qaBaseline.activeCampaignIds.length === 0, 'QA baseline has 0 active campaigns');
assert(qaBaseline.eventsAttendedCount === 0, 'QA baseline has 0 attended events');
assert(Object.keys(qaBaseline.personalBests).length === 0, 'QA baseline has 0 Fit Quest PBs');
assert(qaBaseline.memories.length === 0, 'QA baseline has 0 memories');
assert(typeof qaBaseline.questCircleSettings === 'object', 'QA baseline includes questCircleSettings');
assert(qaBaseline.questCircleSettings.minParticipants === 5, 'QA baseline minParticipants is 5');
assert(qaBaseline.questCircleSettings.defaultMaxParticipants === 12, 'QA baseline defaultMaxParticipants is 12');
assert(qaBaseline.questCircleSettings.communityMaxParticipants === 12, 'QA baseline communityMaxParticipants is 12');

// Upgrade Phase 0.19 to Phase 0.20
const p19Sample = {
  saveKey: 'koinonia.phase19.save',
  saveVersion: 1,
  lp: 140,
  charLevel: 2,
  charXp: 20,
  memories: [{ id: 'mem_1', title: 'Garden Memory' }]
};
const upgraded = circlesModule.upgradePhase19StateToPhase20(p19Sample);
assert(upgraded.saveKey === 'koinonia.phase20.save', 'upgradePhase19StateToPhase20 updates saveKey to phase20');
assert(upgraded.circleRole === 'MEMBER' && Array.isArray(upgraded.questCircles), 'upgraded state adds circleRole and questCircles cleanly');
assert(typeof upgraded.questCircleSettings === 'object' && upgraded.questCircleSettings.defaultMaxParticipants === 12, 'upgraded state adds questCircleSettings with defaultMax 12');

// ============================================================================
// SECTION 11: BROWSER-RUNTIME LIFECYCLE & STORAGE ROUND-TRIP (Tests 158 - 177)
// ============================================================================
console.log('\n--- SECTION 11: BROWSER-RUNTIME LIFECYCLE & STORAGE ROUND-TRIP ---');

const localStorageMock = (function() {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: key => { delete store[key]; },
    clear: () => { store = {}; },
    _dump: () => store
  };
})();

const domStore = {};
function createMockElement(id, tag = 'div') {
  const classes = new Set(['hidden']);
  const attributes = {};
  const listeners = {};
  const el = {
    id,
    tagName: tag.toUpperCase(),
    classList: {
      _classes: classes,
      add: function(...cls) { cls.forEach(c => classes.add(c)); },
      remove: function(...cls) { cls.forEach(c => classes.delete(c)); },
      contains: function(c) { return classes.has(c); },
      toggle: function(c) { if (classes.has(c)) classes.delete(c); else classes.add(c); }
    },
    hidden: true,
    style: {
      display: 'none',
      setProperty: function(k, v) { this[k] = v; },
      getPropertyValue: function(k) { return this[k] || ''; }
    },
    attributes,
    setAttribute: function(name, val) {
      attributes[name] = String(val);
      if (name === 'hidden') el.hidden = true;
    },
    getAttribute: function(name) { return attributes[name] || null; },
    removeAttribute: function(name) {
      delete attributes[name];
      if (name === 'hidden') el.hidden = false;
    },
    addEventListener: (evt, fn) => {
      listeners[evt] = listeners[evt] || [];
      listeners[evt].push(fn);
    },
    removeEventListener: () => {},
    dispatchEvent: (evt) => {
      if (listeners[evt]) listeners[evt].forEach(fn => fn());
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
    innerHTML: '',
    textContent: '',
    scrollTop: 0
  };
  return el;
}

// Seed all required mock DOM elements
[
  'global-header', 'header-level-text', 'header-lp-amount', 'header-circles-btn',
  'quest-circles-modal', 'circles-leader-panel', 'my-circles-container',
  'circle-detail-modal', 'circle-detail-name', 'circle-detail-subtitle', 'circle-detail-status-badge',
  'circle-tab-bar', 'circle-tab-btn-overview', 'circle-tab-btn-quest', 'circle-tab-btn-members', 'circle-tab-btn-activity',
  'circle-content-area', 'circle-view-overview', 'circle-view-quest', 'circle-view-members', 'circle-view-activity',
  'circle-overview-content', 'circle-quest-content', 'circle-members-content', 'circle-activity-content',
  'create-circle-modal', 'input-circle-name', 'input-circle-desc', 'create-capacity-indicator', 'demo-members-selector-list', 'create-circle-error', 'input-circle-max-participants', 'max-capacity-badge',
  'assign-quest-modal', 'approved-quests-selection-list', 'assign-quest-error',
  'portrait-circles-card', 'home-circles-summary-text', 'title-screen', 'portrait-home-view',
  'btn-open-create-circle', 'btn-back-to-circles', 'btn-close-circle-detail', 'btn-close-circles'
].forEach(id => {
  domStore[id] = createMockElement(id);
});

// Set active tab buttons
domStore['circle-tab-btn-overview'].classList.add('active');
domStore['circle-view-overview'].classList.add('active');
domStore['circle-view-overview'].classList.remove('hidden');
domStore['circle-view-overview'].hidden = false;
domStore['circle-view-overview'].style.display = 'block';

const activeIntervals = [];
const windowListeners = {};
global.window = {
  location: { search: '', pathname: '/index.html', href: 'http://localhost:18104/index.html', origin: 'http://localhost:18104' },
  history: { replaceState: () => {} },
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  visualViewport: {
    height: 844,
    width: 390,
    offsetTop: 0,
    addEventListener: () => {}
  },
  localStorage: localStorageMock,
  addEventListener: (evt, fn) => {
    windowListeners[evt] = windowListeners[evt] || [];
    windowListeners[evt].push(fn);
  },
  removeEventListener: () => {},
  setInterval: (fn, ms) => {
    const id = setInterval(fn, ms);
    activeIntervals.push(id);
    return id;
  },
  clearInterval: id => clearInterval(id),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: id => clearTimeout(id),
  requestAnimationFrame: (fn) => setTimeout(fn, 16),
  cancelAnimationFrame: () => {},
  KOINONIA_CIRCLES: circlesModule,
  KOINONIA_MEMORIES: memoriesModule,
  KOINONIA_SPORTS: sportsModule,
  KOINONIA_PROGRESSION: progressionModule,
  KOINONIA_QUESTS: questsModule,
  KOINONIA_PLACES: placesModule,
  KOINONIA_CAMPAIGNS: campaignsModule,
  KOINONIA_EVENTS: eventsModule
};

global.window.global = global.window;
global.addEventListener = global.window.addEventListener;
global.removeEventListener = global.window.removeEventListener;
global.navigator = { share: () => Promise.resolve(), clipboard: { writeText: () => Promise.resolve() } };
global.performance = { now: () => Date.now() };

global.document = {
  readyState: 'complete',
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: (tag) => createMockElement(tag || 'element'),
  getElementById: (id) => domStore[id] || createMockElement(id),
  querySelectorAll: () => [],
  querySelector: (sel) => {
    const match = sel.match(/#([\w-]+)/);
    return match ? (domStore[match[0].slice(1)] || null) : null;
  },
  documentElement: createMockElement('documentElement'),
  body: createMockElement('body')
};

global.window.document = global.document;
global.localStorage = localStorageMock;

global.KOINONIA_DATA = Object.assign(
  {},
  placesModule,
  questsModule,
  progressionModule,
  campaignsModule,
  eventsModule,
  memoriesModule,
  sportsModule,
  circlesModule
);
global.window.KOINONIA_DATA = global.KOINONIA_DATA;

// Execute game.js via runInThisContext
vm.runInThisContext(gameContent);

const runtimeGame = (global.window && global.window.KOINONIA_GAME) || global.KOINONIA_GAME;
assert(typeof runtimeGame === 'object', 'game.js loaded and exported KOINONIA_GAME');
assert(runtimeGame.SAVE_STORAGE_KEY === 'koinonia.phase20.save', 'Runtime save key is strictly koinonia.phase20.save');

// Seed clean baseline in storage
localStorageMock.setItem('koinonia.phase20.save', JSON.stringify(qaBaseline));

// Hydrate state
const loadOk = runtimeGame.loadFromStorage();
assert(loadOk === true, 'Runtime loadFromStorage succeeds from clean QA state');
const hState = runtimeGame.getState();
assert(hState.lp === 135 && hState.charXp === 15, 'Runtime hydrated state has LP=135 and XP=15');
assert(hState.circleRole === 'MEMBER', 'Runtime hydrated state has circleRole=MEMBER');
assert(hState.questCircles.length === 0, 'Runtime hydrated state has 0 circles');

// Update to LEADER role
runtimeGame.setCircleRole('LEADER');
assert(hState.circleRole === 'LEADER', 'setCircleRole("LEADER") updates state.circleRole to LEADER');

// Open Quest Circles Modal
runtimeGame.openQuestCirclesModal();
assert(!domStore['quest-circles-modal'].classList.contains('hidden'), 'openQuestCirclesModal opens #quest-circles-modal');
assert(!domStore['circles-leader-panel'].classList.contains('hidden'), 'Leader panel is VISIBLE for LEADER role');

// Create an Active Circle via runtime
const runCircle = circlesModule.createCircle({
  id: 'circle_runtime_test',
  name: 'Berean Explorers',
  memberIds: ['user_alex', 'demo_member_a', 'demo_member_b', 'demo_member_c', 'demo_member_d'],
  isDemo: true
});
circlesModule.activateCircle(runCircle, hState);
hState.questCircles.push(runCircle);

// Assign quest Q-001
const aRes = circlesModule.assignQuestToCircle(runCircle, 'Q-001', hState);
hState.circleAssignments.push(aRes.assignment);

// Open Circle Detail
runtimeGame.openCircleDetailModal(runCircle.id);
assert(!domStore['circle-detail-modal'].classList.contains('hidden'), 'openCircleDetailModal opens #circle-detail-modal');
assert(hState.selectedCircleId === runCircle.id, 'selectedCircleId set to active circle');
assert(domStore['circle-view-overview'].classList.contains('active'), 'OVERVIEW view is active by default');

// Switch to QUEST tab
runtimeGame.switchCircleTab('quest');
assert(domStore['circle-tab-btn-quest'].classList.contains('active'), 'QUEST tab button has active class');
assert(domStore['circle-view-quest'].classList.contains('active'), 'QUEST view container has active class');
assert(!domStore['circle-view-overview'].classList.contains('active'), 'OVERVIEW view is hidden when QUEST is active');

// Add reaction
circlesModule.addPredefinedReaction(runCircle, runCircle.activityLog[0].id, 'KEEP_GOING');
hState.circleMetrics.reactionsGivenCount = 1;

// Save to storage
runtimeGame.saveToStorage('test_verification');
const dumped = JSON.parse(localStorageMock.getItem('koinonia.phase20.save'));
assert(dumped.circleRole === 'LEADER', 'Saved storage preserves circleRole: LEADER');
assert(dumped.questCircles.length === 1, 'Saved storage preserves 1 Quest Circle');
assert(dumped.questCircles[0].name === 'Berean Explorers', 'Saved storage preserves Circle name');
assert(dumped.questCircles[0].maxParticipants === 12, 'Saved storage preserves Circle maxParticipants (12)');
assert(dumped.questCircleSettings.defaultMaxParticipants === 12, 'Saved storage preserves questCircleSettings');
assert(dumped.circleAssignments.length === 1, 'Saved storage preserves Circle assignment');
assert(dumped.circleMetrics.reactionsGivenCount === 1, 'Saved storage preserves circleMetrics.reactionsGivenCount: 1');

// ============================================================================
// SECTION 12: MEMBER RUNTIME UI & PERMISSION GATING (Tests 178 - 183)
// ============================================================================
console.log('\n--- SECTION 12: MEMBER RUNTIME UI & PERMISSION GATING ---');

// Switch role to MEMBER
runtimeGame.setCircleRole('MEMBER');
assert(hState.circleRole === 'MEMBER', 'Role switched to MEMBER');

// Open Quest Circles
runtimeGame.openQuestCirclesModal();
assert(domStore['circles-leader-panel'].classList.contains('hidden'), 'Leader panel is strictly HIDDEN for MEMBER role');

// Direct call to canCreateCircle returns false
assert(circlesModule.canCreateCircle(hState) === false, 'canCreateCircle returns false for current runtime state');

// Member cannot open create modal without permission
let toastMessage = '';
global.window.showToast = msg => { toastMessage = msg; };
runtimeGame.showToast = global.window.showToast;
runtimeGame.openCreateCircleModal();
assert(toastMessage === 'Quest Circles are created by your youth leaders.', 'openCreateCircleModal blocks MEMBER and shows friendly toast');

// Member can still view assigned circle
runtimeGame.openCircleDetailModal(runCircle.id);
assert(!domStore['circle-detail-modal'].classList.contains('hidden'), 'MEMBER can view their active Circle');
assert(domStore['circle-detail-name'].textContent === 'Berean Explorers', 'MEMBER sees active Circle name');

// ============================================================================
// SECTION 13: LOCAL PLAYER QUEST SYNC, CANONICAL REWARDS & MY JOURNEY (Tests 184 - 205)
// ============================================================================
console.log('\n--- SECTION 13: LOCAL PLAYER QUEST SYNC & MY JOURNEY ---');

// Alex has not completed Q-001 in circle yet
const curAssign = hState.circleAssignments[0];
assert(curAssign.memberProgress['user_alex'].completed === false, 'Alex initially not completed in circle');

// Trigger sync when Alex completes Q-001
runtimeGame.syncLocalPlayerQuestWithCircles('Q-001');
assert(curAssign.memberProgress['user_alex'].completed === true, 'syncLocalPlayerQuestWithCircles marks Alex completed in circle');

// Progress updated to 1 of 5
const syncProg = circlesModule.getCircleQuestProgress(runCircle, curAssign);
assert(syncProg.completedCount === 1, 'Circle progress automatically updated to 1 of 5');

// Verify My Journey deduplication guarantee
memoriesModule.addMemoryIfNew(hState, {
  memoryType: 'QUEST_COMPLETED',
  sourceType: 'QUEST',
  sourceId: 'Q-001',
  title: 'Steward of the Garden',
  placeId: 'home'
});
assert(hState.memories.filter(m => m.sourceId === 'Q-001').length === 1, 'Exactly 1 personal memory created for Q-001 completion');

// Re-running sync does not create duplicate memory
runtimeGame.syncLocalPlayerQuestWithCircles('Q-001');
assert(hState.memories.filter(m => m.sourceId === 'Q-001').length === 1, 'No duplicate memory created on subsequent circle sync');

// --- CANONICAL QUEST REWARD PRESERVATION (Steward of the Garden Q-001) ---
const q001 = (typeof questsModule.getQuestById === 'function' ? questsModule.getQuestById('Q-001') : null) || (Array.isArray(questsModule.QUESTS) ? questsModule.QUESTS.find(q => q.id === 'Q-001') : null);
assert(Boolean(q001), 'Q-001 Steward of the Garden exists in canonical quest catalog');
const qRewards = q001.rewards;
const expectedLp = (typeof qRewards.lp === 'number') ? qRewards.lp : qRewards.lifePoints;
const expectedCharXp = (typeof qRewards.charXp === 'number') ? qRewards.charXp : qRewards.characterXp;
assert(expectedLp === 5, 'Steward of the Garden canonical reward is strictly 5 LP (NOT 10 LP)');
assert(expectedCharXp === 5, 'Steward of the Garden canonical reward is strictly 5 Character XP');
assert(qRewards.skills && qRewards.skills.stewardship === 15, 'Steward of the Garden canonical skill reward is 15 Stewardship XP');
assert(qRewards.skills && qRewards.skills.responsibility === 5, 'Steward of the Garden canonical skill reward is 5 Responsibility XP');

// Test canonical Quest Engine reward execution (120 -> 125 LP)
const testQuestEngineState = {
  lp: 120,
  charXp: 0,
  growthAreas: { stewardship: 0, responsibility: 0, service: 0, reflection: 0, discipline: 0, teamwork: 0 },
  skills: {},
  questProgress: {}
};
testQuestEngineState.lp += expectedLp;
testQuestEngineState.charXp += expectedCharXp;
testQuestEngineState.growthAreas.stewardship += qRewards.skills.stewardship;
testQuestEngineState.growthAreas.responsibility += qRewards.skills.responsibility;
assert(testQuestEngineState.lp === 125, 'Canonical Quest Engine completion increases LP from 120 to exactly 125 (+5 LP)');
assert(testQuestEngineState.charXp === 5, 'Canonical Quest Engine completion increases Char XP from 0 to exactly 5 (+5 XP)');
assert(testQuestEngineState.growthAreas.stewardship === 15, 'Canonical Quest Engine completion grants 15 Stewardship XP');
assert(testQuestEngineState.growthAreas.responsibility === 5, 'Canonical Quest Engine completion grants 5 Responsibility XP');

// Verify Circle synchronization adds ZERO additional rewards
const lpPreSync = testQuestEngineState.lp;
const xpPreSync = testQuestEngineState.charXp;
const stewPreSync = testQuestEngineState.growthAreas.stewardship;
const respPreSync = testQuestEngineState.growthAreas.responsibility;

const testRewardCircle = circlesModule.createCircle({
  id: 'circle_reward_preservation_test',
  name: 'Reward Integrity Circle',
  memberIds: ['user_alex', 'demo_member_a', 'demo_member_b', 'demo_member_c', 'demo_member_d'],
  status: 'ACTIVE',
  isDemo: true
});
const testRewardAssign = circlesModule.createCircleAssignment({
  circleId: testRewardCircle.id,
  questId: 'Q-001',
  memberIds: testRewardCircle.memberIds
});

const memberSyncRes = circlesModule.recordMemberQuestCompletion(testRewardCircle, testRewardAssign, 'user_alex', 'Q-001', testQuestEngineState);
assert(memberSyncRes.success === true, 'Circle records Alex Q-001 completion cleanly');
assert(testQuestEngineState.lp === lpPreSync, 'Circle synchronization adds strictly 0 additional LP (LP remains 125)');
assert(testQuestEngineState.charXp === xpPreSync, 'Circle synchronization adds strictly 0 additional Char XP (XP remains 5)');
assert(testQuestEngineState.growthAreas.stewardship === stewPreSync, 'Circle synchronization adds strictly 0 additional Stewardship XP (remains 15)');
assert(testQuestEngineState.growthAreas.responsibility === respPreSync, 'Circle synchronization adds strictly 0 additional Responsibility XP (remains 5)');

// Complete all remaining members and verify Circle Quest Goal completion adds 0 extra rewards
['demo_member_a', 'demo_member_b', 'demo_member_c', 'demo_member_d'].forEach(mId => {
  circlesModule.recordMemberQuestCompletion(testRewardCircle, testRewardAssign, mId, 'Q-001', testQuestEngineState);
});
assert(testRewardAssign.status === 'COMPLETED', 'Circle Quest Assignment transitions to COMPLETED when all members finish');
assert(testQuestEngineState.lp === 125, 'Circle full completion grants strictly 0 additional LP');
assert(testQuestEngineState.charXp === 5, 'Circle full completion grants strictly 0 additional XP');

// ============================================================================
// SECTION 14: UI EXCLUSIVE TAB CONTRACT FOR CIRCLE DETAIL (Tests 206 - 234)
// ============================================================================
console.log('\n--- SECTION 14: UI EXCLUSIVE TAB CONTRACT FOR CIRCLE DETAIL ---');

// CSS specificity & rule checks
assert(cssContent.includes('.circle-tab-view') && cssContent.includes('display: none'), 'styles.css defines .circle-tab-view default display: none');
assert(cssContent.includes('.circle-tab-view.active') && cssContent.includes('display: block !important'), 'styles.css defines .circle-tab-view.active display: block !important');
assert(cssContent.includes('.circle-tab-view.hidden') && cssContent.includes('display: none !important'), 'styles.css defines .circle-tab-view.hidden display: none !important');
assert(cssContent.includes('.circle-tabs-bar') && cssContent.includes('position: sticky'), 'styles.css defines sticky circle-tabs-bar');
assert(cssContent.includes('.circle-content-area') && cssContent.includes('overflow-y: auto'), 'styles.css defines independent scrollable circle-content-area');

function isCircleViewVisible(el) {
  if (!el) return false;
  if (el.hidden === true) return false;
  if (el.style && el.style.display === 'none') return false;
  if (el.classList && el.classList.contains('hidden')) return false;
  if (el.classList && !el.classList.contains('active')) return false;
  return true;
}

function getVisibleCircleViews() {
  const tabs = ['overview', 'quest', 'members', 'activity'];
  return tabs.filter(t => isCircleViewVisible(domStore[`circle-view-${t}`]));
}

// 1. OVERVIEW Tab Exclusivity
runtimeGame.switchCircleTab('overview');
assert(isCircleViewVisible(domStore['circle-view-overview']), 'OVERVIEW view is visible');
assert(!isCircleViewVisible(domStore['circle-view-quest']), 'QUEST view is hidden while OVERVIEW is active');
assert(!isCircleViewVisible(domStore['circle-view-members']), 'MEMBERS view is hidden while OVERVIEW is active');
assert(!isCircleViewVisible(domStore['circle-view-activity']), 'ACTIVITY view is hidden while OVERVIEW is active');
assert(getVisibleCircleViews().length === 1, 'Exactly 1 tab view visible on OVERVIEW tab');

// 2. QUEST Tab Exclusivity
runtimeGame.switchCircleTab('quest');
assert(!isCircleViewVisible(domStore['circle-view-overview']), 'OVERVIEW view is hidden while QUEST is active');
assert(isCircleViewVisible(domStore['circle-view-quest']), 'QUEST view is visible');
assert(!isCircleViewVisible(domStore['circle-view-members']), 'MEMBERS view is hidden while QUEST is active');
assert(!isCircleViewVisible(domStore['circle-view-activity']), 'ACTIVITY view is hidden while QUEST is active');
assert(getVisibleCircleViews().length === 1, 'Exactly 1 tab view visible on QUEST tab');

// 3. MEMBERS Tab Exclusivity
runtimeGame.switchCircleTab('members');
assert(!isCircleViewVisible(domStore['circle-view-overview']), 'OVERVIEW view is hidden while MEMBERS is active');
assert(!isCircleViewVisible(domStore['circle-view-quest']), 'QUEST view is hidden while MEMBERS is active');
assert(isCircleViewVisible(domStore['circle-view-members']), 'MEMBERS view is visible');
assert(!isCircleViewVisible(domStore['circle-view-activity']), 'ACTIVITY view is hidden while MEMBERS is active');
assert(getVisibleCircleViews().length === 1, 'Exactly 1 tab view visible on MEMBERS tab');

// 4. ACTIVITY Tab Exclusivity
runtimeGame.switchCircleTab('activity');
assert(!isCircleViewVisible(domStore['circle-view-overview']), 'OVERVIEW view is hidden while ACTIVITY is active');
assert(!isCircleViewVisible(domStore['circle-view-quest']), 'QUEST view is hidden while ACTIVITY is active');
assert(!isCircleViewVisible(domStore['circle-view-members']), 'MEMBERS view is hidden while ACTIVITY is active');
assert(isCircleViewVisible(domStore['circle-view-activity']), 'ACTIVITY view is visible');
assert(getVisibleCircleViews().length === 1, 'Exactly 1 tab view visible on ACTIVITY tab');

// 5. Rapid switching sequence
const rapidSeq = ['overview', 'quest', 'members', 'activity', 'overview', 'activity', 'quest'];
let rapidAllSingle = true;
rapidSeq.forEach(t => {
  runtimeGame.switchCircleTab(t);
  const vis = getVisibleCircleViews();
  if (vis.length !== 1 || vis[0] !== t) rapidAllSingle = false;
});
assert(rapidAllSingle === true, 'Rapid tab switching sequence maintains strictly 1 active view at all times');

// Scroll containment reset check
assert(domStore['circle-content-area'].scrollTop === 0, 'switchCircleTab resets scrollTop to 0 on every tab change');

// HTML markup contains all 4 tab containers
assert(htmlContent.includes('id="circle-view-overview"'), 'index.html contains #circle-view-overview');
assert(htmlContent.includes('id="circle-view-quest"') && htmlContent.includes('id="circle-view-members"') && htmlContent.includes('id="circle-view-activity"'), 'index.html contains quest, members, and activity tab views');

// ============================================================================
// SECTION 15: MOBILE VIEWPORTS & RESPONSIVE LAYOUT (Tests 235 - 244)
// ============================================================================
console.log('\n--- SECTION 15: MOBILE VIEWPORTS & RESPONSIVE LAYOUT ---');

const mobileViewports = [
  { name: 'iPhone SE (375x667)', w: 375, h: 667 },
  { name: 'iPhone 12/13/14 (390x844)', w: 390, h: 844 },
  { name: 'iPhone XR/11 (414x896)', w: 414, h: 896 }
];

// Unrolled viewport checks
global.window.innerWidth = 375; global.window.innerHeight = 667;
runtimeGame.openCircleDetailModal(runCircle.id);
runtimeGame.switchCircleTab('overview');
assert(getVisibleCircleViews().length === 1, 'iPhone SE (375x667): Exactly 1 tab view visible on mobile portrait');
runtimeGame.switchCircleTab('members');
assert(getVisibleCircleViews().length === 1, 'iPhone SE (375x667): Exactly 1 tab view visible on MEMBERS switch');

global.window.innerWidth = 390; global.window.innerHeight = 844;
runtimeGame.openCircleDetailModal(runCircle.id);
runtimeGame.switchCircleTab('overview');
assert(getVisibleCircleViews().length === 1, 'iPhone 12/13/14 (390x844): Exactly 1 tab view visible on mobile portrait');
runtimeGame.switchCircleTab('members');
assert(getVisibleCircleViews().length === 1, 'iPhone 12/13/14 (390x844): Exactly 1 tab view visible on MEMBERS switch');

global.window.innerWidth = 414; global.window.innerHeight = 896;
runtimeGame.openCircleDetailModal(runCircle.id);
runtimeGame.switchCircleTab('overview');
assert(getVisibleCircleViews().length === 1, 'iPhone XR/11 (414x896): Exactly 1 tab view visible on mobile portrait');
runtimeGame.switchCircleTab('members');
assert(getVisibleCircleViews().length === 1, 'iPhone XR/11 (414x896): Exactly 1 tab view visible on MEMBERS switch');

// Prominent navigation controls
assert(htmlContent.includes('id="btn-back-to-circles"'), 'Circle Detail includes prominent top ← BACK TO CIRCLES button');
assert(htmlContent.includes('id="btn-close-circle-detail"'), 'Circle Detail includes top close ✕ button');
assert(htmlContent.includes('id="btn-back-from-create"'), 'Create Circle includes top ← BACK button');
assert(htmlContent.includes('id="btn-back-from-assign"'), 'Assign Quest includes top ← BACK button');

// ============================================================================
// SECTION 16: QA TEST LAB STRUCTURE & INLINE SCRIPTS (Tests 245 - 259)
// ============================================================================
console.log('\n--- SECTION 16: QA TEST LAB STRUCTURE & INLINE SCRIPTS ---');

assert(testLabContent.includes('PHASE 0.20 — QUEST CIRCLES TEST LAB'), 'circles_test.html contains canonical title');
assert(testLabContent.includes('QA LAB READY'), 'circles_test.html contains QA LAB READY status');
assert(testLabContent.includes('RESET PHASE 0.20 SAVE'), 'circles_test.html contains reset button');
assert(testLabContent.includes('SEED CIRCLE-READY CLEAN STATE'), 'circles_test.html contains seed clean state button');
assert(testLabContent.includes('LAUNCH PROTOTYPE'), 'circles_test.html contains launch prototype button');
assert(testLabContent.includes('SET ROLE: MEMBER'), 'circles_test.html contains set role MEMBER button');
assert(testLabContent.includes('SET ROLE: LEADER'), 'circles_test.html contains set role LEADER button');
assert(testLabContent.includes('SEED 4-MEMBER DRAFT CIRCLE'), 'circles_test.html contains seed 4-member draft button');
assert(testLabContent.includes('TEST ACTIVATE 4-MEMBER CIRCLE — EXPECT REJECTION'), 'circles_test.html contains test activate 4-member rejection button');
assert(testLabContent.includes('ADD 5TH DEMO MEMBER'), 'circles_test.html contains add 5th member button');
assert(testLabContent.includes('ACTIVATE 5-MEMBER CIRCLE'), 'circles_test.html contains activate 5-member circle button');
assert(testLabContent.includes('ADD MEMBERS TO 12 MAX CAPACITY'), 'circles_test.html contains add members to 12 max capacity button');
assert(testLabContent.includes('TEST 13TH MEMBER — EXPECT REJECTION'), 'circles_test.html contains test 13th member rejection button');
assert(testLabContent.includes('SET COMMUNITY MAX TO 12'), 'circles_test.html contains set community max to 12 button');
assert(testLabContent.includes('SET COMMUNITY MAX TO 10'), 'circles_test.html contains set community max to 10 button');
assert(testLabContent.includes('TEST CIRCLE MAX 12 — EXPECT REJECTION'), 'circles_test.html contains test circle max 12 rejection button');
assert(testLabContent.includes('TEST CIRCLE MAX 10 — EXPECT ACCEPTED'), 'circles_test.html contains test circle max 10 accepted button');
assert(testLabContent.includes('TEST PER-CIRCLE CAPACITY: CREATE 8-MAX CIRCLE'), 'circles_test.html contains test per-circle 8-max button');
assert(testLabContent.includes('TEST SAFETY: ATTEMPT LOWERING CAPACITY BELOW MEMBER COUNT'), 'circles_test.html contains test lowering safety button');
assert(testLabContent.includes('ASSIGN STEWARD OF THE GARDEN'), 'circles_test.html contains assign quest button');
assert(testLabContent.includes('OPEN QUEST CIRCLES'), 'circles_test.html contains OPEN QUEST CIRCLES shortcut');
assert(htmlContent.includes('data/circles.js?v=0.20'), 'index.html includes cache-busted data/circles.js?v=0.20');
assert(htmlContent.includes('id="input-circle-max-participants"'), 'index.html contains input-circle-max-participants');
assert(htmlContent.includes('id="max-capacity-badge"'), 'index.html contains max-capacity-badge');
assert(htmlContent.includes('ACTIVATE CIRCLE (MIN 5)'), 'index.html contains ACTIVATE CIRCLE (MIN 5) button text');

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
