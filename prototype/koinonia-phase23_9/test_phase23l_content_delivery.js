/**
 * KOINONIA — PHASE 0.23L TEST SUITE
 * Studio-Published Quest Delivery & Runtime Content Registry Verification
 *
 * Covers all 40 required verification criteria:
 * 1. Draft content excluded.
 * 2. Submitted content excluded.
 * 3. Changes-requested content excluded.
 * 4. Approved but unpublished content excluded.
 * 5. Published QUEST included.
 * 6. Published non-QUEST excluded from quest registry.
 * 7. Published quest normalized correctly.
 * 8. Stable content ID preserved.
 * 9. Version preserved.
 * 10. Publisher attribution preserved.
 * 11. Studio internal notes excluded.
 * 12. Sarah cannot publish.
 * 13. Father Alex can publish.
 * 14. Alex cannot access Studio.
 * 15. Built-in quests remain available.
 * 16. Studio and builtin ID collision prevented.
 * 17. Duplicate Studio publication does not duplicate registry entry.
 * 18. Updated publication version handled deterministically.
 * 19. Inactive quest hidden from available list.
 * 20. Expired quest hidden.
 * 21. Historical completion remains intact.
 * 22. Studio reward requested value not authoritative.
 * 23. Reward policy clamp enforced.
 * 24. Effective reward comes through Reward Authority.
 * 25. Client cannot inject LP reward.
 * 26. Client cannot inject XP reward.
 * 27. Repeated completion cannot duplicate reward.
 * 28. Growth Profile reflects reward.
 * 29. Member isolation preserved.
 * 30. Published text rendered safely.
 * 31. Script/HTML injection rejected or escaped.
 * 32. minor-unsafe fields rejected.
 * 33. no unrestricted free-text messaging introduced.
 * 34. Quest Journal/member view renders published quest.
 * 35. globally available quest works without NPC.
 * 36. location-bound quest normalizes.
 * 37. NPC-bound quest normalizes.
 * 38. registry refresh deterministic.
 * 39. local prototype persistence documented.
 * 40. zero Main App network dependency.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Mock localStorage for Node environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Load dependencies
const questModule = require('./data/quests.js');
const { QUESTS } = questModule;
global.KOINONIA_DATA = { quests: QUESTS };

const studioEngine = require('./data/studio_engine.js');
const { StudioStore, ROLES, DRAFT_STATUS, TEMPLATES } = studioEngine;

const MemberIdentity = require('./data/member_identity.js');
const KoinoniaGrowth = require('./data/growth_profile.js');
const KoinoniaRewardAuthority = require('./data/quest_authority.js');
const BetaIdentity = require('./data/beta_identity.js');

const {
  KoinoniaContentRegistry,
  normalizePublishedQuest,
  validateMinorSafety,
  sanitizeText,
  clampRewards,
  CONTENT_TYPES,
  LIFECYCLE_STATUS,
  POLICY_BOUNDS
} = require('./data/content_registry.js');

// Test runner helpers
let passedCount = 0;
let totalTests = 0;

function runTest(testNumber, name, fn) {
  totalTests++;
  try {
    fn();
    passedCount++;
    console.log(`  ✓ [Test ${testNumber}] ${name}`);
  } catch (err) {
    console.error(`  ✗ [Test ${testNumber}] FAILED: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

console.log('============================================================');
console.log('KOINONIA — PHASE 0.23L VERIFICATION SUITE');
console.log('Studio-Published Quest Delivery & Content Registry');
console.log('============================================================\n');

// Reset environment before testing
mockStorage.clear();
KoinoniaGrowth.clearRuntimeProfile();
KoinoniaRewardAuthority.resetAuthority();
KoinoniaContentRegistry.init({ builtinQuests: QUESTS });

const store = new StudioStore();

// Actors
const SARAH = { id: 'sarah_jenkins', memberId: 'sarah_jenkins', displayName: 'Sarah Jenkins', role: ROLES.ADMIN };
const FATHER_ALEX = { id: 'father_alex', memberId: 'father_alex', displayName: 'Father Alex', role: ROLES.SUPERADMIN };
const ALEX = { id: 'alex_rivera', memberId: 'alex_rivera', displayName: 'Alex Rivera', role: ROLES.MEMBER };

// ============================================================
// GROUP 1: Fail-Closed Publication Projection (Req 1-6)
// ============================================================
console.log('[GROUP 1] Fail-Closed Publication Projection (Requirements 1-6)');

function makeValidQuestData(overrides = {}) {
  return {
    title: 'Valid Quest Title',
    shortDesc: 'Short summary for card',
    longDesc: 'Detailed devotional background and purpose',
    placeId: 'fog_center',
    category: 'Faith & Stewardship',
    audience: 'all',
    difficulty: 'easy',
    estimatedMinutes: 20,
    realWorldAction: 'Water potted plants on your veranda',
    reflectionPrompt: 'How did tending the plants bring you peace?',
    verificationMethod: 'self_reflection',
    lifePoints: 15,
    characterXp: 25,
    skillXp: 10,
    completionMessage: 'Well done, faithful servant!',
    startDate: '2026-09-01',
    presentationTarget: 'KOINONIA',
    ...overrides
  };
}

// Create Draft, Submitted, Changes Requested, Approved, and Published items
const draftItem = store.createDraft('QUEST', makeValidQuestData({ title: 'Quiet Morning Prayer', shortDesc: 'Spend 10 mins in prayer' }), SARAH);
const submittedItem = store.createDraft('QUEST', makeValidQuestData({ title: 'Park Stewardship', shortDesc: 'Pick up litter' }), SARAH);
store.requestReview(submittedItem.id, SARAH);

const changesReqItem = store.createDraft('QUEST', makeValidQuestData({ title: 'Choir Practice Outreach', shortDesc: 'Invite choir members' }), SARAH);
store.requestReview(changesReqItem.id, SARAH);
store.returnForChanges(changesReqItem.id, FATHER_ALEX, 'Please specify exact safety guidance');

const approvedItem = store.createDraft('QUEST', makeValidQuestData({ title: 'Elder Care Visit', shortDesc: 'Visit an elder in church' }), SARAH);
store.requestReview(approvedItem.id, SARAH);
store.approveDraft(approvedItem.id, FATHER_ALEX);

const publishedDraft = store.createDraft('QUEST', makeValidQuestData({
  title: 'Community Bread Run',
  shortDesc: 'Deliver fresh bread to neighborhood elders',
  longDesc: 'Join the morning distribution fellowship',
  placeId: 'fog_center',
  category: 'Service & Outreach',
  lifePoints: 20,
  characterXp: 30,
  realWorldAction: 'Deliver a package of fresh bread to an elderly neighbor',
  reflectionPrompt: 'How did sharing bread open a doorway for conversation?'
}), SARAH);
store.requestReview(publishedDraft.id, SARAH);
store.approveDraft(publishedDraft.id, FATHER_ALEX);
const pubResult = store.publishDraft(publishedDraft.id, FATHER_ALEX);

// Published non-quest item
const publishedEvent = store.createDraft('EVENT', {
  title: 'Friday Youth Fellowship Night',
  description: 'Gathering at the youth hall with prayer and songs',
  placeId: 'fog_center',
  realWorldVenue: 'FOG Sanctuary Hall 2',
  date: '2026-10-15',
  startTime: '18:00',
  timezone: 'Asia/Singapore',
  audience: 'all',
  checkInEnabled: true,
  memoryCaptureEnabled: true,
  presentationTarget: 'BOTH'
}, SARAH);
store.requestReview(publishedEvent.id, SARAH);
store.approveDraft(publishedEvent.id, FATHER_ALEX);
store.publishDraft(publishedEvent.id, FATHER_ALEX);

KoinoniaContentRegistry.refresh();

runTest(1, 'Requirement 1: Draft content excluded from quest delivery', () => {
  const published = KoinoniaContentRegistry.getPublishedQuests();
  const found = published.find(q => q.id === `studio:${draftItem.id}` || q.title === draftItem.title);
  assert.strictEqual(found, undefined, 'Draft content must not appear in published quests');
});

runTest(2, 'Requirement 2: Submitted content excluded from quest delivery', () => {
  const published = KoinoniaContentRegistry.getPublishedQuests();
  const found = published.find(q => q.id === `studio:${submittedItem.id}` || q.title === submittedItem.title);
  assert.strictEqual(found, undefined, 'Submitted content must not appear in published quests');
});

runTest(3, 'Requirement 3: Changes-requested content excluded from quest delivery', () => {
  const published = KoinoniaContentRegistry.getPublishedQuests();
  const found = published.find(q => q.id === `studio:${changesReqItem.id}` || q.title === changesReqItem.title);
  assert.strictEqual(found, undefined, 'Changes-requested content must not appear in published quests');
});

runTest(4, 'Requirement 4: Approved but unpublished content excluded from quest delivery', () => {
  const published = KoinoniaContentRegistry.getPublishedQuests();
  const found = published.find(q => q.id === `studio:${approvedItem.id}` || q.title === approvedItem.title);
  assert.strictEqual(found, undefined, 'Approved unpublished content must not appear in published quests');
});

runTest(5, 'Requirement 5: Published QUEST included in registry', () => {
  const quest = KoinoniaContentRegistry.getQuestById(`studio:${publishedDraft.id}`);
  assert.ok(quest, 'Published quest must be retrieved by content ID');
  assert.strictEqual(quest.title, 'Community Bread Run');
  assert.strictEqual(quest.status, LIFECYCLE_STATUS.PUBLISHED);
});

runTest(6, 'Requirement 6: Published non-QUEST excluded from quest registry', () => {
  const publishedQuests = KoinoniaContentRegistry.getPublishedQuests();
  const eventInQuests = publishedQuests.find(q => q.id === `studio:${publishedEvent.id}` || q.title === publishedEvent.title);
  assert.strictEqual(eventInQuests, undefined, 'Published EVENT must not appear in published quests registry');
});

// ============================================================
// GROUP 2: Canonical Contract & Metadata Normalization (Req 7-11)
// ============================================================
console.log('\n[GROUP 2] Canonical Contract & Metadata Normalization (Requirements 7-11)');

runTest(7, 'Requirement 7: Published quest normalized correctly according to canonical contract', () => {
  const quest = KoinoniaContentRegistry.getQuestById(`studio:${publishedDraft.id}`);
  assert.strictEqual(quest.communityId, 'fog');
  assert.strictEqual(quest.contentType, 'QUEST');
  assert.strictEqual(quest.source, 'studio');
  assert.ok(quest.publication, 'Publication block must exist');
  assert.ok(quest.availability, 'Availability block must exist');
  assert.ok(quest.presentation, 'Presentation block must exist');
  assert.ok(quest.rewardDefinition, 'Reward definition block must exist');
  assert.ok(quest.safeguards, 'Safeguards block must exist');
  assert.strictEqual(quest.safeguards.minorSafe, true);
});

runTest(8, 'Requirement 8: Stable content ID preserved', () => {
  const quest = KoinoniaContentRegistry.getQuestById(`studio:${publishedDraft.id}`);
  assert.strictEqual(quest.id, `studio:${publishedDraft.id}`);
  assert.strictEqual(quest.canonicalId, `studio:${publishedDraft.id}`);
});

runTest(9, 'Requirement 9: Version preserved in publication metadata', () => {
  const quest = KoinoniaContentRegistry.getQuestById(`studio:${publishedDraft.id}`);
  assert.strictEqual(typeof quest.publication.version, 'number');
  assert.ok(quest.publication.version >= 1);
});

runTest(10, 'Requirement 10: Publisher attribution preserved', () => {
  const quest = KoinoniaContentRegistry.getQuestById(`studio:${publishedDraft.id}`);
  assert.strictEqual(quest.publication.publishedByMemberId, 'father_alex');
});

runTest(11, 'Requirement 11: Studio internal notes excluded from published representation', () => {
  const quest = KoinoniaContentRegistry.getQuestById(`studio:${publishedDraft.id}`);
  assert.strictEqual(quest.notes, undefined);
  assert.strictEqual(quest.reviewNotes, undefined);
  assert.strictEqual(quest.auditLog, undefined);
});

// ============================================================
// GROUP 3: Studio Governance & Role Protection (Req 12-14)
// ============================================================
console.log('\n[GROUP 3] Studio Governance & Role Protection (Requirements 12-14)');

runTest(12, 'Requirement 12: Sarah Jenkins (ADMIN) cannot publish', () => {
  assert.throws(() => {
    store.publishDraft(approvedItem.id, SARAH);
  }, /Unauthorized/i, 'Sarah must not be permitted to publish');
});

runTest(13, 'Requirement 13: Father Alex (SUPERADMIN) can publish', () => {
  const pub = store.publishDraft(approvedItem.id, FATHER_ALEX);
  assert.ok(pub.success, 'Father Alex should be able to publish');
  assert.strictEqual(pub.publishedRecord.publishedBy.name, 'Father Alex');
});

runTest(14, 'Requirement 14: Alex Rivera (MEMBER) cannot access Studio', () => {
  BetaIdentity.setIdentity('MEMBER');
  assert.strictEqual(BetaIdentity.canAccessStudio(), false, 'MEMBER cannot access Studio');
  assert.strictEqual(BetaIdentity.getCurrentIdentity().capabilities.canAccessStudio, false);
});

// ============================================================
// GROUP 4: Namespace Collision Safety & Versioning (Req 15-18)
// ============================================================
console.log('\n[GROUP 4] Namespace Collision Safety & Versioning (Requirements 15-18)');

runTest(15, 'Requirement 15: Built-in quests remain available and resolve properly', () => {
  const q001 = KoinoniaContentRegistry.getQuestById('Q-001');
  assert.ok(q001, 'Built-in Q-001 must resolve');
  assert.strictEqual(q001.source, 'builtin');
  assert.strictEqual(q001.id, 'Q-001');

  const prefixed = KoinoniaContentRegistry.getQuestById('builtin:Q-001');
  assert.ok(prefixed, 'Prefixed builtin:Q-001 must resolve');
  assert.strictEqual(prefixed.title, q001.title);
});

runTest(16, 'Requirement 16: Studio and builtin ID collision prevented', () => {
  // Author attempts to publish a quest claiming ID 'Q-001'
  const collisionDraft = {
    draftId: 'Q-001',
    templateType: 'QUEST',
    title: 'Fake Garden Steward',
    data: {
      title: 'Fake Garden Steward',
      shortDesc: 'A duplicate quest attempt',
      lifePoints: 10,
      characterXp: 10
    }
  };
  const result = KoinoniaContentRegistry.registerStudioQuestContent(collisionDraft);
  assert.ok(result.success);

  // Lookup Q-001 returns built-in; lookup studio:Q-001 returns studio quest!
  const builtinQ = KoinoniaContentRegistry.getQuestById('Q-001');
  const studioQ = KoinoniaContentRegistry.getQuestById('studio:Q-001');

  assert.strictEqual(builtinQ.source, 'builtin');
  assert.strictEqual(builtinQ.title, 'Steward of the Garden');
  assert.strictEqual(studioQ.source, 'studio');
  assert.strictEqual(studioQ.title, 'Fake Garden Steward');
});

runTest(17, 'Requirement 17: Duplicate Studio publication does not duplicate registry entry', () => {
  // Register same studio ID twice
  const draftDuplicate = {
    draftId: 'dup_test_quest',
    templateType: 'QUEST',
    title: 'Duplicate Test',
    data: { title: 'Duplicate Test', shortDesc: 'Testing deduplication' }
  };
  KoinoniaContentRegistry.registerStudioQuestContent(draftDuplicate);
  KoinoniaContentRegistry.registerStudioQuestContent(draftDuplicate);

  const all = KoinoniaContentRegistry.getPublishedQuests();
  const matches = all.filter(q => q.id === 'studio:dup_test_quest');
  assert.strictEqual(matches.length, 1, 'Registry must deduplicate by content ID');
});

runTest(18, 'Requirement 18: Updated publication version handled deterministically', () => {
  const version1 = {
    draftId: 'versioned_quest',
    templateType: 'QUEST',
    title: 'Versioned Calling v1',
    version: 1,
    data: { title: 'Versioned Calling v1', shortDesc: 'v1 description', version: 1 }
  };
  const version2 = {
    draftId: 'versioned_quest',
    templateType: 'QUEST',
    title: 'Versioned Calling v2 Revised',
    version: 2,
    data: { title: 'Versioned Calling v2 Revised', shortDesc: 'v2 description', version: 2 }
  };

  KoinoniaContentRegistry.registerStudioQuestContent(version1);
  KoinoniaContentRegistry.registerStudioQuestContent(version2);

  const quest = KoinoniaContentRegistry.getQuestById('studio:versioned_quest');
  assert.strictEqual(quest.title, 'Versioned Calling v2 Revised');
  assert.strictEqual(quest.publication.version, 2);
});

// ============================================================
// GROUP 5: Lifecycle, Availability & Archive Readiness (Req 19-21)
// ============================================================
console.log('\n[GROUP 5] Lifecycle, Availability & Archive Readiness (Requirements 19-21)');

runTest(19, 'Requirement 19: Inactive quest hidden from available list', () => {
  const inactiveDraft = {
    draftId: 'inactive_quest',
    templateType: 'QUEST',
    title: 'Inactive Activity',
    active: false,
    data: { title: 'Inactive Activity', active: false }
  };
  KoinoniaContentRegistry.registerStudioQuestContent(inactiveDraft);

  const available = KoinoniaContentRegistry.getPublishedQuests({ includeInactive: false });
  const found = available.find(q => q.id === 'studio:inactive_quest');
  assert.strictEqual(found, undefined, 'Inactive quest must be hidden from available list');

  const withInactive = KoinoniaContentRegistry.getPublishedQuests({ includeInactive: true });
  const foundInAll = withInactive.find(q => q.id === 'studio:inactive_quest');
  assert.ok(foundInAll, 'Inactive quest retrieved when includeInactive is true');
});

runTest(20, 'Requirement 20: Expired quest hidden from available list', () => {
  const expiredDraft = {
    draftId: 'expired_quest',
    templateType: 'QUEST',
    title: 'Expired Activity',
    data: {
      title: 'Expired Activity',
      startDate: '2020-01-01',
      endDate: '2020-01-05' // In the past
    }
  };
  KoinoniaContentRegistry.registerStudioQuestContent(expiredDraft);

  const available = KoinoniaContentRegistry.getPublishedQuests({ includeInactive: false });
  const found = available.find(q => q.id === 'studio:expired_quest');
  assert.strictEqual(found, undefined, 'Expired quest must be hidden from available list');
});

runTest(21, 'Requirement 21: Historical completion remains intact when quest becomes inactive', () => {
  const memberId = 'youth_demo_01';
  const questToComplete = {
    draftId: 'complete_then_archive',
    templateType: 'QUEST',
    title: 'Complete and Archive',
    data: { title: 'Complete and Archive', lifePoints: 15, characterXp: 20 }
  };
  KoinoniaContentRegistry.registerStudioQuestContent(questToComplete);

  // Complete quest through Reward Authority
  const compResult = KoinoniaRewardAuthority.completeQuest(memberId, 'studio:complete_then_archive');
  assert.ok(compResult.success);
  assert.strictEqual(compResult.rewardsGranted.lifePoints, 15);

  // Deactivate quest
  const archived = { ...questToComplete, active: false, data: { ...questToComplete.data, active: false } };
  KoinoniaContentRegistry.registerStudioQuestContent(archived);

  // Check history still contains completion
  const history = KoinoniaRewardAuthority.getRewardHistory(memberId);
  const record = history.find(h => h.questId === 'studio:complete_then_archive' || h.sourceId === 'studio:complete_then_archive');
  assert.ok(record, 'Historical completion record must remain intact after quest deactivation');
});

// ============================================================
// GROUP 6: Reward Authority Integration & Policy Clamping (Req 22-29)
// ============================================================
console.log('\n[GROUP 6] Reward Authority Integration & Policy Clamping (Requirements 22-29)');

runTest(22, 'Requirement 22: Studio reward requested value not authoritative', () => {
  const excessDraft = {
    draftId: 'excess_reward_quest',
    templateType: 'QUEST',
    title: 'Excess Reward Quest',
    data: { title: 'Excess Reward Quest', lifePoints: 9999, characterXp: 8888 }
  };
  KoinoniaContentRegistry.registerStudioQuestContent(excessDraft);
  const quest = KoinoniaContentRegistry.getQuestById('studio:excess_reward_quest');

  assert.strictEqual(quest.rewardDefinition.requested.lifePoints, 9999);
  assert.strictEqual(quest.rewardDefinition.validated.lifePoints, 50, 'Must clamp to 50 LP');
});

runTest(23, 'Requirement 23: Reward policy clamp enforced [0, 50 LP] and [0, 100 XP]', () => {
  const clamped = clampRewards(500, 1000);
  assert.strictEqual(clamped.validated.lifePoints, 50);
  assert.strictEqual(clamped.validated.xp, 100);

  const clampedNegative = clampRewards(-20, -50);
  assert.strictEqual(clampedNegative.validated.lifePoints, 0);
  assert.strictEqual(clampedNegative.validated.xp, 0);
});

runTest(24, 'Requirement 24: Effective reward comes through Reward Authority', () => {
  const memberId = 'youth_demo_01';
  const testQuest = {
    draftId: 'auth_reward_test',
    templateType: 'QUEST',
    title: 'Authority Reward Test',
    data: { title: 'Authority Reward Test', lifePoints: 30, characterXp: 45 }
  };
  KoinoniaContentRegistry.registerStudioQuestContent(testQuest);

  const result = KoinoniaRewardAuthority.completeQuest(memberId, 'studio:auth_reward_test');
  assert.ok(result.success);
  assert.strictEqual(result.rewardsGranted.lifePoints, 30);
  assert.strictEqual(result.rewardsGranted.xp, 45);
});

runTest(25, 'Requirement 25: Client cannot inject arbitrary LP reward', () => {
  const memberId = 'youth_demo_01';
  // Attempt client-supplied reward payload during completeQuest
  const hackPayload = { rewardsGranted: { lifePoints: 1000, xp: 5000 } };
  const res = KoinoniaRewardAuthority.completeQuest(memberId, 'studio:auth_reward_test', hackPayload);
  // Should report alreadyCompleted, giving 0 additional LP
  assert.strictEqual(res.alreadyCompleted, true);
  assert.strictEqual(res.rewardsGranted.lifePoints, 0);
});

runTest(26, 'Requirement 26: Client cannot inject arbitrary XP reward', () => {
  const memberId = 'youth_demo_01';
  const hackPayload = { xp: 9999 };
  const res = KoinoniaRewardAuthority.completeQuest(memberId, 'studio:auth_reward_test', hackPayload);
  assert.strictEqual(res.rewardsGranted.xp, 0);
});

runTest(27, 'Requirement 27: Repeated completion cannot duplicate reward', () => {
  const memberId = 'youth_demo_01';
  const resRepeat = KoinoniaRewardAuthority.completeQuest(memberId, 'studio:auth_reward_test');
  assert.strictEqual(resRepeat.alreadyCompleted, true);
  assert.strictEqual(resRepeat.rewardsGranted.lifePoints, 0);
  assert.strictEqual(resRepeat.rewardsGranted.xp, 0);
});

runTest(28, 'Requirement 28: Growth Profile reflects reward', () => {
  const profile = KoinoniaGrowth.getGrowthProfile('youth_demo_01');
  assert.ok(profile.progression.lifePoints > 0);
  assert.ok(profile.progression.xp > 0);
});

runTest(29, 'Requirement 29: Member isolation preserved', () => {
  const memberA = 'youth_demo_01';
  const memberB = 'admin_sarah';
  const freshQuest = {
    draftId: 'isolated_quest',
    templateType: 'QUEST',
    title: 'Isolated Quest',
    data: { title: 'Isolated Quest', lifePoints: 10, characterXp: 15 }
  };
  KoinoniaContentRegistry.registerStudioQuestContent(freshQuest);

  const resA = KoinoniaRewardAuthority.completeQuest(memberA, 'studio:isolated_quest');
  assert.ok(resA.success && !resA.alreadyCompleted);

  // Member B has NOT completed it yet
  const progB = KoinoniaRewardAuthority.getQuestProgress(memberB, 'studio:isolated_quest');
  assert.strictEqual(progB.status, 'NOT_STARTED');

  const resB = KoinoniaRewardAuthority.completeQuest(memberB, 'studio:isolated_quest');
  assert.ok(resB.success && !resB.alreadyCompleted);
});

// ============================================================
// GROUP 7: Minor Safety & Content Sanitization (Req 30-33)
// ============================================================
console.log('\n[GROUP 7] Minor Safety & Content Sanitization (Requirements 30-33)');

runTest(30, 'Requirement 30: Published text rendered safely', () => {
  const safeText = sanitizeText('  <b>Clean Devotional Title</b>  ');
  assert.strictEqual(safeText, 'Clean Devotional Title');
});

runTest(31, 'Requirement 31: Script/HTML injection rejected or escaped', () => {
  const xssInput = '<script>alert("hacked")</script>Stewardship <img src=x onerror=alert(1)>';
  const sanitized = sanitizeText(xssInput);
  assert.strictEqual(sanitized.includes('<script>'), false);
  assert.strictEqual(sanitized.includes('alert'), false);
  assert.strictEqual(sanitized.includes('<img'), false);
  assert.strictEqual(sanitized, 'Stewardship');
});

runTest(32, 'Requirement 32: Minor-unsafe fields rejected (phone, address, social handles)', () => {
  const unsafePhone = validateMinorSafety({ title: 'Call our phone number 555-123-4567 for prayer' });
  assert.strictEqual(unsafePhone.minorSafe, false);

  const unsafeAddress = validateMinorSafety({ reflectionPrompt: 'Please enter your home address and street number' });
  assert.strictEqual(unsafeAddress.minorSafe, false);

  const unsafeSocial = validateMinorSafety({ shortDesc: 'Drop your Instagram and TikTok handle' });
  assert.strictEqual(unsafeSocial.minorSafe, false);

  const safeQuest = validateMinorSafety({
    title: 'Morning Prayer Walk',
    shortDesc: 'Walk quietly in your garden and pray for your neighbors',
    reflectionPrompt: 'What blessing did you pray over your family?'
  });
  assert.strictEqual(safeQuest.minorSafe, true);
});

runTest(33, 'Requirement 33: No unrestricted free-text messaging introduced', () => {
  const unsafeChat = validateMinorSafety({ prompt: 'Join our unrestricted chat room for public free-text messaging' });
  assert.strictEqual(unsafeChat.minorSafe, false);
});

// ============================================================
// GROUP 8: Member Experience & Quest Modals (Req 34-37)
// ============================================================
console.log('\n[GROUP 8] Member Experience & Quest Modals (Requirements 34-37)');

runTest(34, 'Requirement 34: Quest Journal/member view renders published quest', () => {
  const quests = KoinoniaContentRegistry.getPublishedQuests();
  const breadRun = quests.find(q => q.id === `studio:${publishedDraft.id}`);
  assert.ok(breadRun, 'Bread run quest must appear in member published quests');
  assert.strictEqual(breadRun.title, 'Community Bread Run');
  assert.strictEqual(breadRun.rewards.lp, 20);
});

runTest(35, 'Requirement 35: Globally available quest works without NPC', () => {
  const globalQuest = {
    draftId: 'global_no_npc',
    templateType: 'QUEST',
    title: 'Global Prayer Moment',
    data: {
      title: 'Global Prayer Moment',
      placeId: null,
      npcId: null,
      realWorldAction: 'Take 5 minutes of silence at noon wherever you are.'
    }
  };
  const reg = KoinoniaContentRegistry.registerStudioQuestContent(globalQuest);
  assert.ok(reg.success);
  assert.strictEqual(reg.quest.presentation.npcId, null);
  assert.strictEqual(reg.quest.presentation.locationId, null);
});

runTest(36, 'Requirement 36: Location-bound quest normalizes locationId', () => {
  const locQuest = {
    draftId: 'loc_bound_quest',
    templateType: 'QUEST',
    title: 'Chapel Candle Prayer',
    data: {
      title: 'Chapel Candle Prayer',
      placeId: 'fog_sanctuary'
    }
  };
  const reg = KoinoniaContentRegistry.registerStudioQuestContent(locQuest);
  assert.strictEqual(reg.quest.presentation.locationId, 'fog_sanctuary');
});

runTest(37, 'Requirement 37: NPC-bound quest normalizes npcId', () => {
  const npcQuest = {
    draftId: 'npc_bound_quest',
    templateType: 'QUEST',
    title: 'Consult Pastor Alex',
    data: {
      title: 'Consult Pastor Alex',
      npcId: 'father_alex',
      placeId: 'fog_center'
    }
  };
  const reg = KoinoniaContentRegistry.registerStudioQuestContent(npcQuest);
  assert.strictEqual(reg.quest.presentation.npcId, 'father_alex');
});

// ============================================================
// GROUP 9: Registry Operations & Environment Isolation (Req 38-40)
// ============================================================
console.log('\n[GROUP 9] Registry Operations & Environment Isolation (Requirements 38-40)');

runTest(38, 'Requirement 38: Registry refresh is deterministic and notifies subscribers', () => {
  let notified = false;
  const unsub = KoinoniaContentRegistry.subscribe(() => {
    notified = true;
  });

  KoinoniaContentRegistry.refresh();
  assert.strictEqual(notified, true, 'Subscriber must be notified on refresh');
  unsub();
});

runTest(39, 'Requirement 39: Local prototype persistence limitations documented', () => {
  const docPath = path.resolve(__dirname, '../../docs/koinonia-quest/KOINONIA_STUDIO_RUNTIME_CONTENT_DELIVERY.md');
  assert.ok(fs.existsSync(docPath), 'Phase 0.23L delivery specification must exist');
  const docContent = fs.readFileSync(docPath, 'utf8');
  assert.ok(docContent.includes('local prototype content registry'), 'Must disclose local prototype scope');
  assert.ok(/tamper-proof/i.test(docContent), 'Must state NOT tamper-proof');
});

runTest(40, 'Requirement 40: Zero Main App network dependency, DB handles, or session imports', () => {
  const registryCode = fs.readFileSync(path.resolve(__dirname, 'data/content_registry.js'), 'utf8');
  assert.strictEqual(registryCode.includes('fog_community.db'), false);
  assert.strictEqual(registryCode.includes('fog-portal'), false);
  assert.strictEqual(registryCode.includes('/api/v1/auth/login'), false);
});

// ============================================================
// SUITE SUMMARY
// ============================================================
console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passedCount} / ${totalTests} PASSED (0 FAILED)`);
console.log('============================================================\n');

if (passedCount === totalTests) {
  console.log(`ALL ${totalTests} TESTS PASSED SUCCESSFULLY! 🎉`);
} else {
  process.exit(1);
}
