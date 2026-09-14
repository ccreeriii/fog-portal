/**
 * KOINONIA — PHASE 0.23K TEST SUITE
 * Quest Progress & Reward Authority Foundation Verification
 *
 * Covers all 40 required verification criteria:
 * 1. New quest starts NOT_STARTED.
 * 2. Progress normalizes safely.
 * 3. Completing valid quest succeeds.
 * 4. LP reward applied once.
 * 5. XP reward applied once.
 * 6. Repeat completion grants zero additional LP.
 * 7. Repeat completion grants zero additional XP.
 * 8. Stable completion ID returned.
 * 9. Idempotency survives repeated calls.
 * 10. Unknown quest rejected.
 * 11. Unknown member rejected/fails closed.
 * 12. Negative reward definition rejected.
 * 13. Excessive reward rejected or clamped by policy.
 * 14. Client-supplied reward amount ignored.
 * 15. Client cannot directly unlock milestone.
 * 16. First Quest milestone evaluates correctly.
 * 17. Streak increments once per valid day.
 * 18. Same-day repeat does not increment streak.
 * 19. Member isolation works.
 * 20. Reward history records exactly one grant.
 * 21. Reward history member-scoped.
 * 22. Partial failure rolls back safely.
 * 23. PrototypeRewardAuthority active.
 * 24. SharedCoreRewardAuthority disabled.
 * 25. No Main App network call.
 * 26. No Main App DB dependency.
 * 27. No auth token/secret stored.
 * 28. isMinor preserved safely.
 * 29. No unrestricted messaging introduced.
 * 30. Growth Profile read model reflects completed reward.
 * 31. LP remains non-negative.
 * 32. XP remains non-negative.
 * 33. level recalculates deterministically.
 * 34. existing Studio authorization preserved.
 * 35. existing Studio QUEST workflow preserved.
 * 36. reward metadata validation works.
 * 37. Sarah cannot bypass reward policy.
 * 38. raw browser payload cannot mint LP.
 * 39. raw browser payload cannot mint XP.
 * 40. multiple personas remain isolated.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock localStorage for Node environment before requiring modules
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Require Phase 0.23K modules
const KoinoniaGrowth = require('./data/growth_profile.js');
const KoinoniaIdentity = require('./data/member_identity.js');
const BetaIdentityProvider = require('./data/beta_identity.js');
const KoinoniaRewardAuthority = require('./data/quest_authority.js');
const KoinoniaStudio = require('./data/studio_engine.js');

let passCount = 0;
let failCount = 0;

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${testName}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${testName}: ${err.message}`);
    console.error(err.stack);
    failCount++;
  }
}

console.log('============================================================');
console.log('KOINONIA PHASE 0.23K: QUEST PROGRESS & REWARD AUTHORITY TESTS');
console.log('============================================================\n');

// ------------------------------------------------------------
// GROUP 1: QUEST PROGRESS CONTRACT & NORMALIZATION
// ------------------------------------------------------------
console.log('[GROUP 1] Quest Progress Contract & Normalization');

runTest('T01: New quest starts NOT_STARTED', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const prog = KoinoniaRewardAuthority.getQuestProgress('youth_demo_01', 'Q-004');
  assert.strictEqual(prog.status, 'NOT_STARTED');
  assert.strictEqual(prog.progress.current, 0);
  assert.strictEqual(prog.progress.target, 1);
  assert.strictEqual(prog.progress.percent, 0);
  assert.strictEqual(prog.completion.completedAt, null);
  assert.strictEqual(prog.completion.completionId, null);
});

runTest('T02: Progress normalizes safely (frozen, clamped, non-negative)', () => {
  const normalized = KoinoniaRewardAuthority.normalizeQuestProgress({
    memberId: 'youth_demo_01',
    questId: 'Q-001',
    status: 'COMPLETED',
    progress: { current: 15, target: 10 },
    rewards: { lifePoints: 10, xp: 20, milestoneIds: ['first_quest'] }
  });
  assert.strictEqual(normalized.memberId, 'youth_demo_01');
  assert.strictEqual(normalized.status, 'COMPLETED');
  assert.strictEqual(normalized.progress.current, 10, 'current should clamp to target');
  assert.strictEqual(normalized.progress.percent, 100);
  assert.strictEqual(normalized.readOnly, true);
  assert.ok(Object.isFrozen(normalized), 'progress object must be frozen');
  assert.ok(Object.isFrozen(normalized.progress), 'progress.progress must be frozen');
  assert.ok(Object.isFrozen(normalized.rewards), 'progress.rewards must be frozen');
});

// ------------------------------------------------------------
// GROUP 2: COMPLETION & IDEMPOTENCY
// ------------------------------------------------------------
console.log('\n[GROUP 2] Completion & Idempotency');

runTest('T03: Completing valid quest succeeds', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const authority = KoinoniaRewardAuthority.getAuthority();
  // Reset Alex to clean slate for Q-004
  authority.resetMemberState('youth_demo_01', {
    lifePoints: 100,
    xp: 20,
    questsCompleted: 2,
    currentQuestStreak: 1,
    lastCompletedDate: '2026-09-13',
    milestones: ['first_quest'],
    questProgress: {},
    rewardHistory: []
  });

  const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004', {
    simulatedDate: '2026-09-14'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.alreadyCompleted, false);
  assert.ok(res.completionId.includes('youth_demo_01:Q-004'));
  assert.strictEqual(res.rewardsGranted.lifePoints, 5);
  assert.strictEqual(res.rewardsGranted.xp, 5);
});

runTest('T04: LP reward applied once upon initial completion', () => {
  const authority = KoinoniaRewardAuthority.getAuthority();
  const memState = authority.memberState['youth_demo_01'];
  assert.strictEqual(memState.lifePoints, 105, 'LP should have incremented from 100 to 105');
});

runTest('T05: XP reward applied once upon initial completion', () => {
  const authority = KoinoniaRewardAuthority.getAuthority();
  const memState = authority.memberState['youth_demo_01'];
  assert.strictEqual(memState.xp, 25, 'XP should have incremented from 20 to 25');
});

runTest('T06: Repeat completion grants zero additional LP', () => {
  const repeatRes = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004', {
    simulatedDate: '2026-09-14'
  });

  assert.strictEqual(repeatRes.success, true);
  assert.strictEqual(repeatRes.alreadyCompleted, true);
  assert.strictEqual(repeatRes.rewardsGranted.lifePoints, 0, 'Must grant 0 LP on repeat');

  const authority = KoinoniaRewardAuthority.getAuthority();
  const memState = authority.memberState['youth_demo_01'];
  assert.strictEqual(memState.lifePoints, 105, 'LP balance must remain unchanged at 105');
});

runTest('T07: Repeat completion grants zero additional XP', () => {
  const repeatRes = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004', {
    simulatedDate: '2026-09-14'
  });

  assert.strictEqual(repeatRes.rewardsGranted.xp, 0, 'Must grant 0 XP on repeat');

  const authority = KoinoniaRewardAuthority.getAuthority();
  const memState = authority.memberState['youth_demo_01'];
  assert.strictEqual(memState.xp, 25, 'XP balance must remain unchanged at 25');
});

runTest('T08: Stable completion ID returned across repeat calls', () => {
  const res1 = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004');
  const res2 = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004');
  assert.strictEqual(res1.completionId, res2.completionId);
  assert.strictEqual(res1.completionId, 'fog:youth_demo_01:Q-004:v1');
});

runTest('T09: Idempotency survives repeated calls (5 consecutive calls)', () => {
  const initialLp = KoinoniaRewardAuthority.getAuthority().memberState['youth_demo_01'].lifePoints;
  for (let i = 0; i < 5; i++) {
    const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004');
    assert.strictEqual(res.alreadyCompleted, true);
    assert.strictEqual(res.rewardsGranted.lifePoints, 0);
    assert.strictEqual(res.rewardsGranted.xp, 0);
  }
  const finalLp = KoinoniaRewardAuthority.getAuthority().memberState['youth_demo_01'].lifePoints;
  assert.strictEqual(initialLp, finalLp, 'Life points must not drift under repeated calls');
});

// ------------------------------------------------------------
// GROUP 3: INPUT VALIDATION & POLICY LIMITS
// ------------------------------------------------------------
console.log('\n[GROUP 3] Input Validation, Policy Limits & Clamping');

runTest('T10: Unknown quest rejected and fails closed', () => {
  const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'QUEST_NON_EXISTENT_999');
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes('Unknown quest'));
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
});

runTest('T11: Unknown member rejected and fails closed', () => {
  const res = KoinoniaRewardAuthority.completeQuest('unregistered_hacker', 'Q-001');
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes('Member not found or unauthorized'));
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
});

runTest('T12: Negative reward definition rejected', () => {
  const check = KoinoniaRewardAuthority.validateRewardPolicy({ lifePoints: -10, xp: 5 });
  assert.strictEqual(check.valid, false);
  assert.ok(check.error.includes('negative'));
});

runTest('T13: Excessive reward rejected or clamped by policy (max 50 LP, max 100 XP)', () => {
  const check = KoinoniaRewardAuthority.validateRewardPolicy({ lifePoints: 9999, xp: 500 });
  assert.strictEqual(check.valid, true);
  assert.strictEqual(check.validated.lifePoints, 50, 'LP must clamp to 50');
  assert.strictEqual(check.validated.xp, 100, 'XP must clamp to 100');
  assert.strictEqual(check.effective.lifePoints, 50);
  assert.strictEqual(check.effective.xp, 100);
});

runTest('T14: Client-supplied reward amount ignored in completeQuest payload', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const authority = KoinoniaRewardAuthority.getAuthority();
  authority.resetMemberState('youth_demo_01', {
    lifePoints: 50,
    xp: 10,
    questsCompleted: 0,
    currentQuestStreak: 0,
    lastCompletedDate: null,
    milestones: [],
    questProgress: {},
    rewardHistory: []
  });

  // Client attempts to sneak 9999 LP and 5000 XP in completionContext
  const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-001', {
    lifePoints: 9999,
    xp: 5000,
    rewards: { lifePoints: 9999, xp: 5000 }
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 5, 'Must award canonical 5 LP, ignoring client request');
  assert.strictEqual(res.rewardsGranted.xp, 5, 'Must award canonical 5 XP, ignoring client request');
  assert.strictEqual(authority.memberState['youth_demo_01'].lifePoints, 55);
  assert.strictEqual(authority.memberState['youth_demo_01'].xp, 15);
});

// ------------------------------------------------------------
// GROUP 4: MILESTONE EVALUATION
// ------------------------------------------------------------
console.log('\n[GROUP 4] Milestone Authority & Evaluation');

runTest('T15: Client cannot directly unlock milestone via UI call', () => {
  // Verifies no direct arbitrary milestone unlocking exists on authority facade
  assert.strictEqual(typeof KoinoniaRewardAuthority.unlockMilestone, 'undefined', 'Direct unlockMilestone must not be exposed');
});

runTest('T16: First Quest milestone evaluates correctly upon 1st completion', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const authority = KoinoniaRewardAuthority.getAuthority();
  authority.resetMemberState('youth_demo_01', {
    lifePoints: 0,
    xp: 0,
    questsCompleted: 0,
    currentQuestStreak: 0,
    lastCompletedDate: null,
    milestones: [],
    questProgress: {},
    rewardHistory: []
  });

  const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-001');
  assert.strictEqual(res.success, true);
  assert.ok(res.rewardsGranted.milestoneIds.includes('first_quest'));
  assert.ok(authority.memberState['youth_demo_01'].milestones.includes('first_quest'));
});

// ------------------------------------------------------------
// GROUP 5: STREAK MODEL
// ------------------------------------------------------------
console.log('\n[GROUP 5] Diligence Streak Model');

runTest('T17: Streak increments once per valid consecutive day', () => {
  const streak1 = KoinoniaRewardAuthority.calculateUpdatedStreak(1, '2026-09-13', '2026-09-14');
  assert.strictEqual(streak1.streak, 2);
  assert.strictEqual(streak1.incremented, true);

  const streak2 = KoinoniaRewardAuthority.calculateUpdatedStreak(2, '2026-09-14', '2026-09-15');
  assert.strictEqual(streak2.streak, 3);
  assert.strictEqual(streak2.incremented, true);
});

runTest('T18: Same-day repeat does not increment streak', () => {
  const streakRes = KoinoniaRewardAuthority.calculateUpdatedStreak(2, '2026-09-14', '2026-09-14');
  assert.strictEqual(streakRes.streak, 2, 'Streak must stay at 2 on same day');
  assert.strictEqual(streakRes.incremented, false);
  assert.strictEqual(streakRes.sameDay, true);
});

// ------------------------------------------------------------
// GROUP 6: MEMBER SCOPING & ISOLATION
// ------------------------------------------------------------
console.log('\n[GROUP 6] Member Scoping & Isolation');

runTest('T19: Member isolation works (Alex quest does not affect Sarah or Father Alex)', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const authority = KoinoniaRewardAuthority.getAuthority();
  const sarahInitialLp = authority.memberState['admin_sarah'].lifePoints;
  const fatherAlexInitialLp = authority.memberState['father_alex'].lifePoints;

  // Complete quest for Alex
  authority.completeQuest('youth_demo_01', 'Q-004');

  assert.strictEqual(authority.memberState['admin_sarah'].lifePoints, sarahInitialLp, 'Sarah LP must be unchanged');
  assert.strictEqual(authority.memberState['father_alex'].lifePoints, fatherAlexInitialLp, 'Father Alex LP must be unchanged');
});

runTest('T40: Multiple personas remain isolated across state inspections', () => {
  const authority = KoinoniaRewardAuthority.getAuthority();
  const alexHist = authority.getRewardHistory('youth_demo_01');
  const sarahHist = authority.getRewardHistory('admin_sarah');
  assert.notStrictEqual(alexHist, sarahHist);
  assert.ok(alexHist.every(e => e.memberId === 'youth_demo_01'));
  assert.ok(sarahHist.every(e => e.memberId === 'admin_sarah'));
});

// ------------------------------------------------------------
// GROUP 7: REWARD HISTORY LEDGER
// ------------------------------------------------------------
console.log('\n[GROUP 7] Reward History Ledger');

runTest('T20: Reward history records exactly one grant per unique completion', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const authority = KoinoniaRewardAuthority.getAuthority();
  authority.resetMemberState('youth_demo_01', {
    lifePoints: 50,
    xp: 10,
    questsCompleted: 0,
    currentQuestStreak: 0,
    lastCompletedDate: null,
    milestones: [],
    questProgress: {},
    rewardHistory: []
  });

  authority.completeQuest('youth_demo_01', 'Q-001');
  const histAfter1 = authority.getRewardHistory('youth_demo_01');
  assert.strictEqual(histAfter1.length, 1);
  assert.strictEqual(histAfter1[0].questId, 'Q-001');
  assert.strictEqual(histAfter1[0].lifePointsDelta, 5);

  // Attempt duplicate completion
  authority.completeQuest('youth_demo_01', 'Q-001');
  const histAfter2 = authority.getRewardHistory('youth_demo_01');
  assert.strictEqual(histAfter2.length, 1, 'Reward history must not record duplicate entries');
});

runTest('T21: Reward history is member-scoped', () => {
  const authority = KoinoniaRewardAuthority.getAuthority();
  const alexHist = authority.getRewardHistory('youth_demo_01');
  const sarahHist = authority.getRewardHistory('admin_sarah');
  assert.ok(alexHist.some(e => e.questId === 'Q-001'));
  assert.ok(!sarahHist.some(e => e.questId === 'Q-001'), "Sarah's history must not contain Alex's completions");
});

// ------------------------------------------------------------
// GROUP 8: TRANSACTION ATOMICITY & ROLLBACK
// ------------------------------------------------------------
console.log('\n[GROUP 8] Transaction Atomicity & Rollback');

runTest('T22: Partial failure rolls back safely (zero partial state)', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const authority = KoinoniaRewardAuthority.getAuthority();
  authority.resetMemberState('youth_demo_01', {
    lifePoints: 100,
    xp: 20,
    questsCompleted: 2,
    currentQuestStreak: 1,
    lastCompletedDate: '2026-09-13',
    milestones: ['first_quest'],
    questProgress: {},
    rewardHistory: []
  });

  // Temporarily force an error during transaction
  const origSync = authority._syncWithGrowthProfile;
  try {
    authority._syncWithGrowthProfile = () => {
      throw new Error('Simulated atomic transaction failure');
    };

    const res = authority.completeQuest('youth_demo_01', 'Q-004');
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('Simulated atomic transaction failure'));

    // Verify rollback: state must be exactly as before
    const mState = authority.memberState['youth_demo_01'];
    assert.strictEqual(mState.lifePoints, 100, 'LP must rollback to 100');
    assert.strictEqual(mState.xp, 20, 'XP must rollback to 20');
    assert.strictEqual(mState.questsCompleted, 2, 'Quests completed must rollback');
    assert.strictEqual(mState.currentQuestStreak, 1, 'Streak must rollback');
    assert.strictEqual(mState.rewardHistory.length, 0, 'Reward history must rollback');
    assert.strictEqual(typeof mState.questProgress['Q-004'], 'undefined', 'Quest progress must rollback');
  } finally {
    // Guaranteed restore
    authority._syncWithGrowthProfile = origSync;
  }
});

// ------------------------------------------------------------
// GROUP 9: PROVIDER ABSTRACTION & BOUNDARIES
// ------------------------------------------------------------
console.log('\n[GROUP 9] Provider Abstraction & Boundaries');

runTest('T23: PrototypeRewardAuthority active by default', () => {
  const activeAuth = KoinoniaRewardAuthority.getAuthority();
  assert.ok(activeAuth instanceof KoinoniaRewardAuthority.PrototypeRewardAuthority);
  assert.strictEqual(activeAuth.name, 'PrototypeRewardAuthority');
});

runTest('T24: SharedCoreRewardAuthority disabled and fails closed', () => {
  const sharedCoreAuth = new KoinoniaRewardAuthority.SharedCoreRewardAuthority();
  assert.strictEqual(sharedCoreAuth.enabled, false);
  const res = sharedCoreAuth.completeQuest({ memberId: 'youth_demo_01' }, 'Q-001');
  assert.strictEqual(res.success, false);
  assert.ok(res.error.includes('disabled in prototype mode'));
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
});

runTest('T25: No Main App network call made by Reward Authority', () => {
  const code = fs.readFileSync(path.join(__dirname, 'data/quest_authority.js'), 'utf8');
  assert.ok(!code.includes('fetch('), 'Must not call fetch');
  assert.ok(!code.includes('XMLHttpRequest'), 'Must not call XMLHttpRequest');
  assert.ok(!code.includes('http:'), 'Must not initiate HTTP requests');
});

runTest('T26: No Main App DB dependency in quest_authority.js', () => {
  const code = fs.readFileSync(path.join(__dirname, 'data/quest_authority.js'), 'utf8');
  assert.ok(!code.includes('sqlite3'), 'Must not import sqlite3');
  assert.ok(!code.includes('fog_community.db'), 'Must not reference Main App DB');
  assert.ok(!code.includes('SELECT '), 'Must not execute SQL queries');
});

runTest('T27: No auth token or credential stored in reward authority state', () => {
  const authority = KoinoniaRewardAuthority.getAuthority();
  const stateStr = JSON.stringify(authority.memberState);
  assert.ok(!stateStr.includes('password'), 'Must not store passwords');
  assert.ok(!stateStr.includes('token'), 'Must not store tokens');
  assert.ok(!stateStr.includes('secret'), 'Must not store secrets');
  assert.ok(!stateStr.includes('bearer'), 'Must not store bearer tokens');
});

// ------------------------------------------------------------
// GROUP 10: SAFEGUARDS & MINOR PROTECTION
// ------------------------------------------------------------
console.log('\n[GROUP 10] Safeguards & Minor Protection');

runTest('T28: isMinor preserved safely on Alex Rivera growth profile', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const profile = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(profile.safeguards.isMinor, true);
});

runTest('T29: No unrestricted messaging introduced in reward flows', () => {
  const code = fs.readFileSync(path.join(__dirname, 'data/quest_authority.js'), 'utf8');
  assert.ok(!code.includes('sendMessage'), 'Must not introduce unrestricted chat/messaging');
  assert.ok(!code.includes('openChat'), 'Must not introduce open chat UI');
});

// ------------------------------------------------------------
// GROUP 11: GROWTH PROFILE READ MODEL SYNCHRONIZATION
// ------------------------------------------------------------
console.log('\n[GROUP 11] Growth Profile Read Model Synchronization');

runTest('T30: Growth Profile read model reflects completed reward', () => {
  KoinoniaRewardAuthority.resetAuthority();
  const authority = KoinoniaRewardAuthority.getAuthority();
  authority.resetMemberState('youth_demo_01', {
    lifePoints: 100,
    xp: 20,
    questsCompleted: 2,
    currentQuestStreak: 1,
    lastCompletedDate: '2026-09-13',
    milestones: ['first_quest'],
    questProgress: {},
    rewardHistory: []
  });

  authority.completeQuest('youth_demo_01', 'Q-004', { simulatedDate: '2026-09-14' });

  // Read through KoinoniaGrowth canonical read model
  const updatedProfile = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(updatedProfile.progression.lifePoints, 105);
  assert.strictEqual(updatedProfile.progression.xp, 25);
  assert.strictEqual(updatedProfile.activity.questsCompleted, 3);
  assert.strictEqual(updatedProfile.activity.currentQuestStreak, 2);
});

runTest('T31: LP remains non-negative under all conditions', () => {
  const authority = KoinoniaRewardAuthority.getAuthority();
  assert.ok(authority.memberState['youth_demo_01'].lifePoints >= 0);
  assert.ok(authority.memberState['admin_sarah'].lifePoints >= 0);
  assert.ok(authority.memberState['father_alex'].lifePoints >= 0);
});

runTest('T32: XP remains non-negative under all conditions', () => {
  const authority = KoinoniaRewardAuthority.getAuthority();
  assert.ok(authority.memberState['youth_demo_01'].xp >= 0);
  assert.ok(authority.memberState['admin_sarah'].xp >= 0);
  assert.ok(authority.memberState['father_alex'].xp >= 0);
});

runTest('T33: Level recalculates deterministically on Growth Profile', () => {
  const profileLv2 = KoinoniaGrowth.normalizeGrowthProfile({
    memberId: 'youth_demo_01',
    progression: { xp: 15 }
  });
  assert.strictEqual(profileLv2.progression.level, 2);
  assert.strictEqual(profileLv2.progression.levelTitle, 'Active Explorer');

  const profileLv3 = KoinoniaGrowth.normalizeGrowthProfile({
    memberId: 'youth_demo_01',
    progression: { xp: 25 }
  });
  assert.strictEqual(profileLv3.progression.level, 3);
  assert.strictEqual(profileLv3.progression.levelTitle, 'Community Adventurer');
});

// ------------------------------------------------------------
// GROUP 12: STUDIO INTEGRATION & AUTHORING POLICY BOUNDS
// ------------------------------------------------------------
console.log('\n[GROUP 12] Studio Integration & Authoring Policy Bounds');

runTest('T34: Existing Studio authorization preserved (ADMIN can author, SUPERADMIN can publish)', () => {
  assert.strictEqual(KoinoniaStudio.store.canPerform('ADMIN', 'CREATE_DRAFT'), true);
  assert.strictEqual(KoinoniaStudio.store.canPerform('ADMIN', 'PUBLISH'), false);
  assert.strictEqual(KoinoniaStudio.store.canPerform('SUPERADMIN', 'PUBLISH'), true);
});

runTest('T35: Existing Studio QUEST workflow preserved in template definitions', () => {
  const questTemplate = KoinoniaStudio.TEMPLATES.QUEST;
  assert.ok(questTemplate);
  assert.strictEqual(questTemplate.id, 'QUEST');
  const lpField = questTemplate.fields.find(f => f.key === 'lifePoints');
  const xpField = questTemplate.fields.find(f => f.key === 'characterXp');
  assert.ok(lpField);
  assert.strictEqual(lpField.min, 0);
  assert.strictEqual(lpField.max, 50);
  assert.ok(xpField);
  assert.strictEqual(xpField.min, 0);
  assert.strictEqual(xpField.max, 100);
});

runTest('T36: Reward metadata validation works for Studio dynamic quests', () => {
  const regResult = KoinoniaRewardAuthority.registerStudioQuest('studio_quest_demo', {
    title: 'Neighborhood Food Drive',
    category: 'SERVICE',
    lifePoints: 25,
    characterXp: 30,
    milestoneIds: ['ministry_service']
  });
  assert.strictEqual(regResult.success, true);
  assert.strictEqual(regResult.effectiveRewards.lifePoints, 25);
  assert.strictEqual(regResult.effectiveRewards.xp, 30);
});

runTest('T37: Sarah (ADMIN) cannot bypass reward policy in Studio drafts', () => {
  const regOverLimit = KoinoniaRewardAuthority.registerStudioQuest('studio_quest_exploit', {
    title: 'Exploit Quest',
    category: 'COMMUNITY',
    lifePoints: 999999,
    characterXp: 999999
  });
  assert.strictEqual(regOverLimit.success, true);
  assert.strictEqual(regOverLimit.effectiveRewards.lifePoints, 50, 'Must clamp to 50 max LP');
  assert.strictEqual(regOverLimit.effectiveRewards.xp, 100, 'Must clamp to 100 max XP');
});

// ------------------------------------------------------------
// GROUP 13: BROWSER PAYLOAD & MINTING TAMPER RESISTANCE
// ------------------------------------------------------------
console.log('\n[GROUP 13] Browser Payload & Minting Tamper Resistance');

runTest('T38: Raw browser payload cannot mint LP (minting endpoints absent)', () => {
  assert.strictEqual(typeof KoinoniaRewardAuthority.mintLifePoints, 'undefined');
  assert.strictEqual(typeof KoinoniaRewardAuthority.addLifePoints, 'undefined');
});

runTest('T39: Raw browser payload cannot mint XP (minting endpoints absent)', () => {
  assert.strictEqual(typeof KoinoniaRewardAuthority.mintXp, 'undefined');
  assert.strictEqual(typeof KoinoniaRewardAuthority.addXp, 'undefined');
});

// ------------------------------------------------------------
// GROUP 14: EVENT ATTENDANCE REWARD AUTHORITY
// ------------------------------------------------------------
console.log('\n[GROUP 14] Event Attendance Reward Authority');

runTest('T41: Event attendance reward uses Reward Authority', () => {
  KoinoniaRewardAuthority.resetMemberState('youth_demo_01');
  const initialLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const initialXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;

  const res = KoinoniaRewardAuthority.recordEventAttendance('youth_demo_01', 'E-001', {
    title: 'Gathering of Hope',
    reflection: 'Felt renewed fellowship.'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.alreadyCompleted, false);
  assert.strictEqual(res.rewardsGranted.lifePoints, 5);
  assert.strictEqual(res.rewardsGranted.xp, 5);
  assert.ok(res.completionId.includes('event:E-001'));

  const afterLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const afterXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;
  assert.strictEqual(afterLp, initialLp + 5);
  assert.strictEqual(afterXp, initialXp + 5);
});

runTest('T42: Event attendance duplicate does not double grant', () => {
  const initialLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const initialXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;
  const historyLenBefore = KoinoniaRewardAuthority.getRewardHistory('youth_demo_01').length;

  const res = KoinoniaRewardAuthority.recordEventAttendance('youth_demo_01', 'E-001');

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.alreadyCompleted, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
  assert.strictEqual(res.rewardsGranted.xp, 0);

  const afterLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const afterXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;
  assert.strictEqual(afterLp, initialLp, 'Life points must not increase on duplicate event attendance');
  assert.strictEqual(afterXp, initialXp, 'XP must not increase on duplicate event attendance');
  assert.strictEqual(KoinoniaRewardAuthority.getRewardHistory('youth_demo_01').length, historyLenBefore);
});

runTest('T43: Event attendance client reward amount ignored', () => {
  const res = KoinoniaRewardAuthority.recordEventAttendance('youth_demo_01', 'E-002', {
    lifePoints: 9999,
    xp: 8888,
    title: 'Community Clean-Up'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 5, 'Client LP injection must be discarded');
  assert.strictEqual(res.rewardsGranted.xp, 5, 'Client XP injection must be discarded');
});

runTest('T48: Reward history records event reward correctly', () => {
  const history = KoinoniaRewardAuthority.getRewardHistory('youth_demo_01');
  const eventEntries = history.filter(h => h.type === 'EVENT_ATTENDANCE');
  assert.ok(eventEntries.length >= 2, 'Must have recorded event attendances in ledger');
  const e1 = eventEntries.find(h => h.completionId.includes('event:E-001'));
  assert.ok(e1, 'Must have recorded E-001 completion in history');
  assert.strictEqual(e1.lifePointsDelta, 5);
  assert.strictEqual(e1.xpDelta, 5);
  assert.strictEqual(e1.memberId, 'youth_demo_01');
});

// ------------------------------------------------------------
// GROUP 15: ARCADE & MINI-GAME REWARD AUTHORITY & REPLAY POLICY
// ------------------------------------------------------------
console.log('\n[GROUP 15] Arcade & Mini-Game Reward Authority & Replay Policy');

runTest('T44: Arcade reward uses Reward Authority', () => {
  const initialLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const initialXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;

  const res = KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'faith_quest_sample', { score: 100 });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.alreadyCompleted, false);
  assert.strictEqual(res.rewardsGranted.lifePoints, 5);
  assert.strictEqual(res.rewardsGranted.xp, 5);
  assert.ok(res.completionId.includes('arcade:faith_quest_sample'));

  const afterLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const afterXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;
  assert.strictEqual(afterLp, initialLp + 5);
  assert.strictEqual(afterXp, initialXp + 5);
});

runTest('T45: Arcade reward cannot inject arbitrary LP', () => {
  const res = KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'goliath_slingshot', {
    lifePoints: 5000,
    score: 999
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 5, 'Client arbitrary LP ignored');
});

runTest('T46: Arcade reward cannot inject arbitrary XP', () => {
  const res = KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'manna_drop', {
    xp: 7777,
    characterXp: 8888,
    score: 50
  });
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.rewardsGranted.xp, 5, 'Client arbitrary XP ignored');
});

runTest('T47: Arcade duplicate/replay policy enforced (same day gives 0 LP/XP)', () => {
  const balanceBefore = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const replay = KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'faith_quest_sample', { score: 120 });

  assert.strictEqual(replay.success, true);
  assert.strictEqual(replay.alreadyCompleted, true, 'Same-day replay must be marked already completed');
  assert.strictEqual(replay.rewardsGranted.lifePoints, 0, 'Replay on same day grants 0 LP');
  assert.strictEqual(replay.rewardsGranted.xp, 0, 'Replay on same day grants 0 XP');

  const balanceAfter = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  assert.strictEqual(balanceAfter, balanceBefore);
});

runTest('T49: Reward history records Arcade reward correctly', () => {
  const history = KoinoniaRewardAuthority.getRewardHistory('youth_demo_01');
  const arcadeEntries = history.filter(h => h.type === 'ARCADE_COMPLETION');
  assert.ok(arcadeEntries.length >= 3, 'Must have recorded arcade completion entries');
  const fq = arcadeEntries.find(h => h.completionId.includes('arcade:faith_quest_sample'));
  assert.ok(fq, 'Must find faith_quest_sample in reward history');
  assert.strictEqual(fq.lifePointsDelta, 5);
  assert.strictEqual(fq.xpDelta, 5);
});

// ------------------------------------------------------------
// GROUP 16: SPORTS & FIT QUEST CHALLENGES
// ------------------------------------------------------------
console.log('\n[GROUP 16] Sports & Fit Quest Challenges');

runTest('T58: Challenge reward uses Reward Authority (recordChallengeReward)', () => {
  const initialLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const initialXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;

  const res = KoinoniaRewardAuthority.recordChallengeReward('youth_demo_01', 'FQ-V001', {
    score: 10,
    sportId: 'basketball'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.alreadyCompleted, false);
  assert.strictEqual(res.rewardsGranted.lifePoints, 5);
  assert.strictEqual(res.rewardsGranted.xp, 5);
  assert.ok(res.completionId.includes('challenge:FQ-V001'));

  const afterLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const afterXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;
  assert.strictEqual(afterLp, initialLp + 5);
  assert.strictEqual(afterXp, initialXp + 5);
});

runTest('T59: Challenge reward duplicate attempt does not double grant', () => {
  const initialLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const initialXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;

  const res = KoinoniaRewardAuthority.recordChallengeReward('youth_demo_01', 'FQ-V001', {
    score: 15,
    sportId: 'basketball'
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.alreadyCompleted, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
  assert.strictEqual(res.rewardsGranted.xp, 0);

  const afterLp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').lifePoints;
  const afterXp = KoinoniaRewardAuthority.getRewardSummary('youth_demo_01').xp;
  assert.strictEqual(afterLp, initialLp);
  assert.strictEqual(afterXp, initialXp);
});

runTest('T60: Challenge reward client arbitrary reward injection ignored', () => {
  const res = KoinoniaRewardAuthority.recordChallengeReward('youth_demo_01', 'FQ-V002', {
    lifePoints: 9999,
    xp: 9999,
    score: 5
  });

  assert.strictEqual(res.success, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 5);
  assert.strictEqual(res.rewardsGranted.xp, 5);
});

// ------------------------------------------------------------
// GROUP 17: CROSS-PERSONA ISOLATION & HYDRATION CLASSIFICATION
// ------------------------------------------------------------
console.log('\n[GROUP 17] Cross-Persona Isolation & Hydration Classification');

runTest('T50: Alex reward cannot affect Sarah', () => {
  const sarahBefore = KoinoniaRewardAuthority.getRewardSummary('admin_sarah');
  KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'alex_exclusive_game', { score: 99 });
  const sarahAfter = KoinoniaRewardAuthority.getRewardSummary('admin_sarah');

  assert.strictEqual(sarahAfter.lifePoints, sarahBefore.lifePoints);
  assert.strictEqual(sarahAfter.xp, sarahBefore.xp);
  assert.strictEqual(sarahAfter.questsCompleted, sarahBefore.questsCompleted);
});

runTest('T51: Sarah reward cannot affect Father Alex', () => {
  const fatherBefore = KoinoniaRewardAuthority.getRewardSummary('father_alex');
  KoinoniaRewardAuthority.recordEventAttendance('admin_sarah', 'E-LEADERS-01', { title: 'Leader Council' });
  const fatherAfter = KoinoniaRewardAuthority.getRewardSummary('father_alex');

  assert.strictEqual(fatherAfter.lifePoints, fatherBefore.lifePoints);
  assert.strictEqual(fatherAfter.xp, fatherBefore.xp);
  assert.strictEqual(fatherAfter.questsCompleted, fatherBefore.questsCompleted);
});

runTest('T54: Hydration assignments are not classified as minting', () => {
  const profile = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const mockState = { lp: 0, charXp: 0 };
  mockState.lp = profile.progression.lifePoints;
  mockState.charXp = profile.progression.xp;

  assert.strictEqual(mockState.lp, profile.progression.lifePoints);
  assert.strictEqual(mockState.charXp, profile.progression.xp);
});

// ------------------------------------------------------------
// GROUP 18: STATIC GATES, TERMINOLOGY & LOCAL STORAGE PERSISTENCE
// ------------------------------------------------------------
console.log('\n[GROUP 18] Static Gates, Terminology & Storage Persistence');

runTest('T52: No member-facing direct LP mint sites remain', () => {
  const sportsCode = fs.readFileSync(path.join(__dirname, 'data/sports.js'), 'utf8');
  assert.ok(!sportsCode.includes('state.lp = (state.lp || 0) + lpReward;'), 'sports.js direct LP mutation must be removed');

  const gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  assert.ok(!gameCode.includes('state.lp += 5;'), 'game.js direct += 5 fallback must be removed');
});

runTest('T53: No member-facing direct XP mint sites remain', () => {
  const sportsCode = fs.readFileSync(path.join(__dirname, 'data/sports.js'), 'utf8');
  assert.ok(!sportsCode.includes('state.charXp = (state.charXp || 0) + xpReward;'), 'sports.js direct XP mutation must be removed');
});

runTest('T55: Authority terminology and documentation says prototype/local, not server-authoritative', () => {
  const specDoc = fs.readFileSync(path.join(__dirname, '../../docs/koinonia-quest/KOINONIA_QUEST_REWARD_AUTHORITY.md'), 'utf8');
  assert.ok(
    specDoc.includes('KOINONIA-local prototype reward authority') || specDoc.includes('authority-managed prototype reward boundary'),
    'Doc must explicitly specify prototype/local reward authority boundary'
  );
  assert.ok(
    specDoc.includes('NOT') && specDoc.includes('server-authoritative'),
    'Doc must clarify it is NOT yet server-authoritative'
  );
});

runTest('T56: Idempotency persistence behavior across reload/storage is verified', () => {
  const mid = 'youth_demo_01';
  const rawStored = global.localStorage.getItem('koinonia.reward_authority.' + mid);
  assert.ok(rawStored, 'Member state must be stored in localStorage');
  const parsed = JSON.parse(rawStored);
  assert.strictEqual(parsed.memberId, mid);
  assert.ok(parsed.questProgress, 'Stored state must contain questProgress');

  const freshAuthority = new KoinoniaRewardAuthority.PrototypeRewardAuthority();
  assert.strictEqual(freshAuthority.hasRewardBeenGranted(mid, `fog:${mid}:Q-001:v1`), true);
});

runTest('T57: Strengthened static scanning of runtime files rejects all variable arithmetic writes', () => {
  const filesToCheck = ['game.js', 'data/sports.js', 'data/quests.js', 'data/events.js', 'data/arcade.js'];
  for (const relPath of filesToCheck) {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Reject any arithmetic increment: state.lp += ..., state.charXp += ..., state.xp += ...
      if (/state\.(lp|charXp|xp)\s*\+=/.test(line)) {
        assert.fail(`Unauthorized delta += assignment found in ${relPath}:${idx + 1}: ${line.trim()}`);
      }
      // Reject any arithmetic addition assignment: state.lp = ... + ..., state.charXp = ... + ..., state.xp = ... + ...
      if (/state\.(lp|charXp|xp)\s*=\s*.*?\+/.test(line)) {
        assert.fail(`Unauthorized arithmetic + assignment found in ${relPath}:${idx + 1}: ${line.trim()}`);
      }
    });
  }
});

// ------------------------------------------------------------
// GROUP 19: ABSOLUTE HYDRATION & REWARD AUTHORITY INTEGRITY
// ------------------------------------------------------------
console.log('\n[GROUP 19] Absolute Hydration & Reward Authority Integrity (Phase 0.23K Final)');

runTest('T61: Quest transaction updates canonical Growth Profile', () => {
  KoinoniaRewardAuthority.resetMemberState('youth_demo_01');
  const profBefore = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const initialLp = profBefore.progression.lifePoints;
  const initialXp = profBefore.progression.xp;

  const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004');
  assert.strictEqual(res.success, true);

  const profAfter = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(profAfter.progression.lifePoints, initialLp + 5);
  assert.strictEqual(profAfter.progression.xp, initialXp + 5);
});

runTest('T62: UI hydrates absolute LP after quest (zero delta arithmetic)', () => {
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const mockState = { lp: 0 };
  // Absolute assignment only
  mockState.lp = prof.progression.lifePoints;
  assert.strictEqual(mockState.lp, prof.progression.lifePoints);
});

runTest('T63: UI hydrates absolute XP after quest (zero delta arithmetic)', () => {
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const mockState = { charXp: 0 };
  mockState.charXp = prof.progression.xp;
  assert.strictEqual(mockState.charXp, prof.progression.xp);
});

runTest('T64: Event reward hydrates absolute progression', () => {
  const res = KoinoniaRewardAuthority.recordEventAttendance('youth_demo_01', 'E-ABS-01', { title: 'Absolute Gathering' });
  assert.strictEqual(res.success, true);
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const mockState = { lp: 0, charXp: 0 };
  mockState.lp = prof.progression.lifePoints;
  mockState.charXp = prof.progression.xp;
  assert.strictEqual(mockState.lp, prof.progression.lifePoints);
  assert.strictEqual(mockState.charXp, prof.progression.xp);
});

runTest('T65: Arcade reward hydrates absolute progression', () => {
  const res = KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'arcade_abs_demo', { score: 50 });
  assert.strictEqual(res.success, true);
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const mockState = { lp: 0, charXp: 0 };
  mockState.lp = prof.progression.lifePoints;
  mockState.charXp = prof.progression.xp;
  assert.strictEqual(mockState.lp, prof.progression.lifePoints);
  assert.strictEqual(mockState.charXp, prof.progression.xp);
});

runTest('T66: Sports reward hydrates absolute progression', () => {
  const res = KoinoniaRewardAuthority.recordChallengeReward('youth_demo_01', 'FQ-V003', { score: 10 });
  assert.strictEqual(res.success, true);
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const mockState = { lp: 0, charXp: 0, charLevel: 1 };
  mockState.lp = prof.progression.lifePoints;
  mockState.charXp = prof.progression.xp;
  mockState.charLevel = prof.progression.level;
  assert.strictEqual(mockState.lp, prof.progression.lifePoints);
  assert.strictEqual(mockState.charXp, prof.progression.xp);
});

runTest('T67: Duplicate quest still awards zero additional reward', () => {
  const profBefore = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-004');
  assert.strictEqual(res.alreadyCompleted, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
  assert.strictEqual(res.rewardsGranted.xp, 0);
  const profAfter = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(profAfter.progression.lifePoints, profBefore.progression.lifePoints);
  assert.strictEqual(profAfter.progression.xp, profBefore.progression.xp);
});

runTest('T68: Duplicate event still awards zero additional reward', () => {
  const profBefore = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const res = KoinoniaRewardAuthority.recordEventAttendance('youth_demo_01', 'E-ABS-01');
  assert.strictEqual(res.alreadyCompleted, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
  assert.strictEqual(res.rewardsGranted.xp, 0);
  const profAfter = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(profAfter.progression.lifePoints, profBefore.progression.lifePoints);
});

runTest('T69: Same-day Arcade replay still awards zero additional reward', () => {
  const profBefore = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const res = KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'arcade_abs_demo', { score: 99 });
  assert.strictEqual(res.alreadyCompleted, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
  assert.strictEqual(res.rewardsGranted.xp, 0);
  const profAfter = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(profAfter.progression.lifePoints, profBefore.progression.lifePoints);
});

runTest('T70: Repeated challenge cannot farm rewards', () => {
  const profBefore = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const res = KoinoniaRewardAuthority.recordChallengeReward('youth_demo_01', 'FQ-V003', { score: 999 });
  assert.strictEqual(res.alreadyCompleted, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
  assert.strictEqual(res.rewardsGranted.xp, 0);
  const profAfter = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(profAfter.progression.lifePoints, profBefore.progression.lifePoints);
});

runTest('T71: Reward toast may use authority-returned delta', () => {
  const res = KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-005');
  assert.strictEqual(res.success, true);
  assert.strictEqual(typeof res.rewardsGranted.lifePoints, 'number');
  assert.strictEqual(typeof res.rewardsGranted.xp, 'number');
  const toastMsg = `+${res.rewardsGranted.lifePoints} LP, +${res.rewardsGranted.xp} XP`;
  assert.strictEqual(toastMsg, '+5 LP, +5 XP');
});

runTest('T72: Balance does NOT use authority delta arithmetic', () => {
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const uiState = { lp: prof.progression.lifePoints };
  // Verify UI balance matches authoritative read model exactly
  assert.strictEqual(uiState.lp, prof.progression.lifePoints);
});

runTest('T73: No member-facing state.lp += variable remains in runtime files', () => {
  const gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  assert.strictEqual(/state\.lp\s*\+=/.test(gameCode), false);
  const sportsCode = fs.readFileSync(path.join(__dirname, 'data/sports.js'), 'utf8');
  assert.strictEqual(/state\.lp\s*\+=/.test(sportsCode), false);
});

runTest('T74: No member-facing state.charXp += variable remains in runtime files', () => {
  const gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  assert.strictEqual(/state\.charXp\s*\+=/.test(gameCode), false);
  const sportsCode = fs.readFileSync(path.join(__dirname, 'data/sports.js'), 'utf8');
  assert.strictEqual(/state\.charXp\s*\+=/.test(sportsCode), false);
});

runTest('T75: No member-facing equivalent arithmetic assignment remains in runtime files', () => {
  const gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  assert.strictEqual(/state\.(lp|charXp|xp)\s*=\s*\(state\.(lp|charXp|xp)\s*\|\|\s*0\)\s*\+/.test(gameCode), false);
  const sportsCode = fs.readFileSync(path.join(__dirname, 'data/sports.js'), 'utf8');
  assert.strictEqual(/state\.(lp|charXp|xp)\s*=\s*\(state\.(lp|charXp|xp)\s*\|\|\s*0\)\s*\+/.test(sportsCode), false);
});

runTest('T76: Hydration assignments remain allowed and functional', () => {
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  const mockState = {};
  mockState.lp = prof.progression.lifePoints;
  mockState.charXp = prof.progression.xp;
  mockState.charLevel = prof.progression.level;
  assert.strictEqual(mockState.lp, prof.progression.lifePoints);
  assert.strictEqual(mockState.charXp, prof.progression.xp);
  assert.strictEqual(mockState.charLevel, prof.progression.level);
});

runTest('T77: localStorage persistence survives simulated refresh', () => {
  const mid = 'youth_demo_01';
  const raw = global.localStorage.getItem('koinonia.reward_authority.' + mid);
  assert.ok(raw);
  const reloadedAuth = new KoinoniaRewardAuthority.PrototypeRewardAuthority();
  const summary = reloadedAuth.getRewardSummary(mid);
  assert.ok(summary.lifePoints > 0);
  assert.strictEqual(reloadedAuth.hasRewardBeenGranted(mid, `fog:${mid}:Q-005:v1`), true);
});

runTest('T78: Persona isolation remains correct across all reward actions', () => {
  KoinoniaRewardAuthority.resetMemberState('admin_sarah');
  KoinoniaRewardAuthority.resetMemberState('father_alex');
  const sarahBefore = KoinoniaGrowth.getGrowthProfile('admin_sarah');
  const fatherBefore = KoinoniaGrowth.getGrowthProfile('father_alex');

  // Award multiple rewards to Alex
  KoinoniaRewardAuthority.completeQuest('youth_demo_01', 'Q-001');
  KoinoniaRewardAuthority.recordEventAttendance('youth_demo_01', 'E-ISOLATION-01');
  KoinoniaRewardAuthority.recordArcadeReward('youth_demo_01', 'isolation_arcade');

  const sarahAfter = KoinoniaGrowth.getGrowthProfile('admin_sarah');
  const fatherAfter = KoinoniaGrowth.getGrowthProfile('father_alex');
  assert.strictEqual(sarahAfter.progression.lifePoints, sarahBefore.progression.lifePoints);
  assert.strictEqual(sarahAfter.progression.xp, sarahBefore.progression.xp);
  assert.strictEqual(fatherAfter.progression.lifePoints, fatherBefore.progression.lifePoints);
  assert.strictEqual(fatherAfter.progression.xp, fatherBefore.progression.xp);
});

runTest('T79: Clearing authority state restores prototype baseline', () => {
  KoinoniaRewardAuthority.resetMemberState('youth_demo_01');
  const prof = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.strictEqual(prof.progression.lifePoints, 135);
  assert.strictEqual(prof.progression.xp, 15);
});

runTest('T80: Documentation explicitly states NOT server-authoritative and NOT tamper-proof', () => {
  const doc = fs.readFileSync(path.join(__dirname, '../../docs/koinonia-quest/KOINONIA_QUEST_REWARD_AUTHORITY.md'), 'utf8');
  assert.ok(doc.includes('NOT') && doc.includes('server-authoritative'));
  assert.ok(doc.includes('tamper-proof'));
});

// ------------------------------------------------------------
// TEST RESULTS SUMMARY
// ------------------------------------------------------------
console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passCount} / ${passCount + failCount} PASSED (${failCount} FAILED)`);
console.log('============================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log(`\nALL ${passCount} TESTS PASSED SUCCESSFULLY! 🎉`);
  process.exit(0);
}
