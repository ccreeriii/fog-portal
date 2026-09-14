/**
 * KOINONIA — PHASE 0.23J TEST SUITE
 * Member Profile & Growth Journey Foundation Verification
 *
 * Covers all 35 required verification criteria:
 * 1. Canonical schema validation
 * 2. LP positive integer validation
 * 3. XP non-negative validation
 * 4. Level calculation (0 XP = Lv 1)
 * 5. Level calculation (10 XP = Lv 2)
 * 6. Level calculation (25 XP = Lv 3)
 * 7. Level calculation (45 XP = Lv 4)
 * 8. Level calculation (70 XP = Lv 5)
 * 9. Level calculation (100 XP = Lv 5 capped)
 * 10. Level progress percentage calculation
 * 11. Level XP remaining calculation
 * 12. Level perk assignment
 * 13. Prototype provider returns Alex Rivera
 * 14. Prototype provider returns Sarah Jenkins
 * 15. Prototype provider returns Father Alex
 * 16. Unknown member returns guest fallback
 * 17. Guest profile has 0 LP, 0 XP, Lv 1
 * 18. SharedCore provider disabled by default
 * 19. SharedCore provider fails closed when disabled
 * 20. Sensitive field stripping (password, token, hash)
 * 21. Sensitive field stripping (birthdate, SSN)
 * 22. Minor flag preservation (isMinor: true for Alex)
 * 23. Minor flag preservation (isMinor: false for Sarah)
 * 24. Milestone catalog completeness (all 6 defined)
 * 25. Alex Rivera milestones (first_quest, joined_campfire)
 * 26. Sarah Jenkins milestones (first_quest, joined_campfire, ministry_service)
 * 27. Father Alex milestones (first_quest, joined_campfire, attended_gathering, growth_series_completed)
 * 28. Milestone achievedAt date parsing/validation
 * 29. Ministry memberships structure validation
 * 30. Campfire memberships structure validation
 * 31. Identity scoping: switching persona changes returned profile
 * 32. Identity scoping: Alex LP != Sarah LP != Father Alex LP
 * 33. Read-only enforcement: readOnly: true on all profiles
 * 34. Zero holiness score: no religious rank fields exist
 * 35. Provider abstraction: KoinoniaGrowth.getGrowthProfile() works with any valid provider
 */

const assert = require('assert');
const path = require('path');

// Mock localStorage for Node environment before requiring modules
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Require Phase 0.23J modules
const KoinoniaGrowth = require('./data/growth_profile.js');
const KoinoniaIdentity = require('./data/member_identity.js');
const BetaIdentityProvider = require('./data/beta_identity.js');

let passCount = 0;
let failCount = 0;
const failures = [];

function check(testNum, desc, condition, extraInfo = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS] T${testNum.toString().padStart(2, '0')}: ${desc}`);
  } else {
    failCount++;
    const errMsg = `FAILED T${testNum.toString().padStart(2, '0')}: ${desc} ${extraInfo}`;
    failures.push(errMsg);
    console.error(`  ❌ [FAIL] ${errMsg}`);
  }
}

async function runTests() {
  console.log('============================================================');
  console.log('KOINONIA PHASE 0.23J: GROWTH PROFILE & JOURNEY TESTS');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // GROUP 1: Canonical Schema & Sanitization
  // ------------------------------------------------------------
  console.log('[GROUP 1] Canonical Schema & Sanitization');

  // Test 1: Canonical schema validation
  const rawSample = {
    memberId: 'alex_test',
    displayName: 'Alex Test',
    progression: { lifePoints: 100, xp: 20 },
    activity: { questsCompleted: 5, currentQuestStreak: 3 },
    memberships: {
      ministries: [{ id: 'm1', name: 'Music', role: 'MEMBER' }],
      campfires: [{ id: 'c1', name: 'Youth', role: 'MEMBER' }]
    },
    milestones: [{ id: 'first_quest', title: 'First Quest', category: 'QUEST' }],
    safeguards: { isMinor: true }
  };
  const normalized = KoinoniaGrowth.normalizeGrowthProfile(rawSample);
  const requiredKeys = ['memberId', 'communityId', 'identity', 'progression', 'activity', 'memberships', 'milestones', 'safeguards', 'source', 'readOnly'];
  const hasAllKeys = requiredKeys.every(k => k in normalized);
  check(1, 'Canonical schema validation (all top-level keys present)', hasAllKeys);

  // Test 2: LP positive integer validation
  const lpNegative = KoinoniaGrowth.normalizeGrowthProfile({ memberId: 'u1', lifePoints: -45 });
  const lpFloat = KoinoniaGrowth.normalizeGrowthProfile({ memberId: 'u2', lifePoints: 89.9 });
  check(2, 'LP positive integer validation (non-negative, floored)',
    lpNegative.progression.lifePoints === 0 && lpFloat.progression.lifePoints === 89);

  // Test 3: XP non-negative validation
  const xpNegative = KoinoniaGrowth.normalizeGrowthProfile({ memberId: 'u1', xp: -30 });
  const xpString = KoinoniaGrowth.normalizeGrowthProfile({ memberId: 'u2', xp: '45' });
  check(3, 'XP non-negative validation (non-negative integer)',
    xpNegative.progression.xp === 0 && xpString.progression.xp === 45);

  // ------------------------------------------------------------
  // GROUP 2: Level Calculations & Thresholds
  // ------------------------------------------------------------
  console.log('\n[GROUP 2] Deterministic Level Calculations');

  // Test 4: Level calculation (0 XP = Lv 1)
  const p0 = KoinoniaGrowth.getLevelProgress(0);
  check(4, 'Level calculation: 0 XP = Level 1 (New Explorer)',
    p0.level === 1 && p0.levelTitle === 'New Explorer');

  // Test 5: Level calculation (10 XP = Lv 2)
  const p10 = KoinoniaGrowth.getLevelProgress(10);
  check(5, 'Level calculation: 10 XP = Level 2 (Active Explorer)',
    p10.level === 2 && p10.levelTitle === 'Active Explorer');

  // Test 6: Level calculation (25 XP = Lv 3)
  const p25 = KoinoniaGrowth.getLevelProgress(25);
  check(6, 'Level calculation: 25 XP = Level 3 (Community Adventurer)',
    p25.level === 3 && p25.levelTitle === 'Community Adventurer');

  // Test 7: Level calculation (45 XP = Lv 4)
  const p45 = KoinoniaGrowth.getLevelProgress(45);
  check(7, 'Level calculation: 45 XP = Level 4 (Seasoned Adventurer)',
    p45.level === 4 && p45.levelTitle === 'Seasoned Adventurer');

  // Test 8: Level calculation (70 XP = Lv 5)
  const p70 = KoinoniaGrowth.getLevelProgress(70);
  check(8, 'Level calculation: 70 XP = Level 5 (Journey Builder)',
    p70.level === 5 && p70.levelTitle === 'Journey Builder');

  // Test 9: Level calculation (100 XP = Lv 5 capped)
  const p100 = KoinoniaGrowth.getLevelProgress(100);
  check(9, 'Level calculation: 100 XP = Level 5 capped (isMaxLevel: true)',
    p100.level === 5 && p100.isMaxLevel === true);

  // Test 10: Level progress percentage calculation
  // Between Lv 1 (0 XP) and Lv 2 (10 XP), 5 XP should be 50%
  const pHalf = KoinoniaGrowth.getLevelProgress(5);
  check(10, 'Level progress percentage calculation (5 XP = 50% in Lv 1)',
    pHalf.progressPercent === 50);

  // Test 11: Level XP remaining calculation
  // At 5 XP, remaining XP to next level (10 XP) is 5
  check(11, 'Level XP remaining calculation (5 XP in Lv 1 has 5 XP remaining)',
    pHalf.xpRemaining === 5);

  // Test 12: Level perk assignment
  check(12, 'Level perk assignment (Lv 1 Journey Journal Started, Lv 2 Journey Explorer Badge)',
    p0.unlockedPerk === 'Journey Journal Started' && p10.unlockedPerk === 'Journey Explorer Badge');

  // ------------------------------------------------------------
  // GROUP 3: Prototype Provider & Personas
  // ------------------------------------------------------------
  console.log('\n[GROUP 3] Prototype Provider & Personas');

  const protoProvider = new KoinoniaGrowth.PrototypeGrowthProvider();

  // Test 13: Prototype provider returns Alex Rivera
  const alexProfile = protoProvider.getGrowthProfile('youth_demo_01');
  check(13, 'Prototype provider returns Alex Rivera (youth_demo_01)',
    alexProfile && alexProfile.identity.displayName === 'Alex Rivera' && alexProfile.memberId === 'youth_demo_01');

  // Test 14: Prototype provider returns Sarah Jenkins
  const sarahProfile = protoProvider.getGrowthProfile('admin_sarah');
  check(14, 'Prototype provider returns Sarah Jenkins (admin_sarah)',
    sarahProfile && sarahProfile.identity.displayName === 'Sarah Jenkins' && sarahProfile.memberId === 'admin_sarah');

  // Test 15: Prototype provider returns Father Alex
  const fatherProfile = protoProvider.getGrowthProfile('father_alex');
  check(15, 'Prototype provider returns Father Alex (father_alex)',
    fatherProfile && fatherProfile.identity.displayName === 'Father Alex' && fatherProfile.memberId === 'father_alex');

  // Test 16: Unknown member returns guest fallback
  const unknownProfile = protoProvider.getGrowthProfile('nonexistent_user_xyz');
  check(16, 'Unknown member returns guest fallback (memberId: guest_anonymous)',
    unknownProfile && unknownProfile.memberId === 'guest_anonymous');

  // Test 17: Guest profile has 0 LP, 0 XP, Lv 1
  check(17, 'Guest profile has 0 LP, 0 XP, Level 1',
    unknownProfile.progression.lifePoints === 0 &&
    unknownProfile.progression.xp === 0 &&
    unknownProfile.progression.level === 1 &&
    unknownProfile.progression.levelTitle === 'New Explorer');

  // ------------------------------------------------------------
  // GROUP 4: Shared Core Provider Boundary
  // ------------------------------------------------------------
  console.log('\n[GROUP 4] Shared Core Provider Boundary');

  const scProvider = new KoinoniaGrowth.SharedCoreGrowthProvider();

  // Test 18: SharedCore provider disabled by default
  check(18, 'SharedCore provider disabled by default in Phase 0.23J',
    scProvider.enabled === false);

  // Test 19: SharedCore provider fails closed when disabled
  const scResult = scProvider.getGrowthProfile('youth_demo_01');
  check(19, 'SharedCore provider fails closed to guest profile when disabled',
    scResult && scResult.memberId === 'guest_anonymous' && scResult.guestReason.includes('SharedCore'));

  // ------------------------------------------------------------
  // GROUP 5: Privacy, Minor Safety & Sanitization
  // ------------------------------------------------------------
  console.log('\n[GROUP 5] Privacy, Minor Safety & Sanitization');

  // Test 20: Sensitive field stripping (password, token, hash)
  const dirtyPayload = {
    memberId: 'secure_user',
    displayName: 'Secure User',
    password: 'SuperSecretPassword!',
    token: 'jwt.token.here',
    access_token: 'bearer_token_123',
    hash: 'sha256_hash_here',
    progression: { lifePoints: 50, xp: 10 }
  };
  const sanitized = KoinoniaGrowth.normalizeGrowthProfile(dirtyPayload);
  check(20, 'Sensitive field stripping: password, token, hash absent',
    !('password' in sanitized) && !('token' in sanitized) && !('access_token' in sanitized) && !('hash' in sanitized));

  // Test 21: Sensitive field stripping (birthdate, SSN)
  const dirtyPii = {
    memberId: 'pii_user',
    displayName: 'PII User',
    birthdate: '2010-05-14',
    dob: '2010-05-14',
    ssn: '000-11-2222',
    phone: '555-0199',
    address: '123 Church Way',
    progression: { lifePoints: 10, xp: 5 }
  };
  const sanitizedPii = KoinoniaGrowth.normalizeGrowthProfile(dirtyPii);
  check(21, 'Sensitive field stripping: birthdate, dob, SSN, phone, address absent',
    !('birthdate' in sanitizedPii) && !('dob' in sanitizedPii) && !('ssn' in sanitizedPii) && !('phone' in sanitizedPii) && !('address' in sanitizedPii));

  // Test 22: Minor flag preservation (isMinor: true for Alex)
  check(22, 'Minor flag preservation: Alex Rivera has safeguards.isMinor === true',
    alexProfile.safeguards.isMinor === true);

  // Test 23: Minor flag preservation (isMinor: false for Sarah)
  check(23, 'Minor flag preservation: Sarah Jenkins has safeguards.isMinor === false',
    sarahProfile.safeguards.isMinor === false);

  // ------------------------------------------------------------
  // GROUP 6: Milestones & Memberships
  // ------------------------------------------------------------
  console.log('\n[GROUP 6] Milestones & Memberships');

  // Test 24: Milestone catalog completeness (all 6 defined)
  const catalogKeys = Object.keys(KoinoniaGrowth.MILESTONE_CATALOG);
  const expectedMilestones = ['first_quest', 'joined_campfire', 'attended_gathering', 'growth_series_completed', 'ministry_service', 'quest_streak_3'];
  const catalogComplete = expectedMilestones.every(m => catalogKeys.includes(m)) && catalogKeys.length === 6;
  check(24, 'Milestone catalog completeness: all 6 canonical milestones defined', catalogComplete);

  // Test 25: Alex Rivera milestones (first_quest, joined_campfire)
  const alexMilestoneIds = alexProfile.milestones.map(m => m.id);
  check(25, 'Alex Rivera milestones: first_quest and joined_campfire present',
    alexMilestoneIds.includes('first_quest') && alexMilestoneIds.includes('joined_campfire') && alexMilestoneIds.length === 2);

  // Test 26: Sarah Jenkins milestones (first_quest, joined_campfire, ministry_service)
  const sarahMilestoneIds = sarahProfile.milestones.map(m => m.id);
  check(26, 'Sarah Jenkins milestones: first_quest, joined_campfire, ministry_service present',
    sarahMilestoneIds.includes('first_quest') && sarahMilestoneIds.includes('joined_campfire') && sarahMilestoneIds.includes('ministry_service') && sarahMilestoneIds.length === 3);

  // Test 27: Father Alex milestones (first_quest, joined_campfire, attended_gathering, growth_series_completed)
  const fatherMilestoneIds = fatherProfile.milestones.map(m => m.id);
  check(27, 'Father Alex milestones: 4 canonical milestones present',
    fatherMilestoneIds.includes('first_quest') &&
    fatherMilestoneIds.includes('joined_campfire') &&
    fatherMilestoneIds.includes('attended_gathering') &&
    fatherMilestoneIds.includes('growth_series_completed') &&
    fatherMilestoneIds.length === 4);

  // Test 28: Milestone achievedAt date parsing/validation
  const allAchievedDatesValid = alexProfile.milestones.every(m => {
    if (!m.achievedAt) return false;
    const d = new Date(m.achievedAt);
    return !isNaN(d.getTime());
  });
  check(28, 'Milestone achievedAt date parsing/validation: ISO-8601 timestamps valid', allAchievedDatesValid);

  // Test 29: Ministry memberships structure validation
  const alexMinistriesValid = Array.isArray(alexProfile.memberships.ministries) &&
    alexProfile.memberships.ministries.every(m => m.id && m.name && m.role);
  check(29, 'Ministry memberships structure validation (id, name, role present)', alexMinistriesValid);

  // Test 30: Campfire memberships structure validation
  const alexCampfiresValid = Array.isArray(alexProfile.memberships.campfires) &&
    alexProfile.memberships.campfires.every(c => c.id && c.name && c.role);
  check(30, 'Campfire memberships structure validation (id, name, role present)', alexCampfiresValid);

  // ------------------------------------------------------------
  // GROUP 7: Identity Scoping & Non-Leakage
  // ------------------------------------------------------------
  console.log('\n[GROUP 7] Identity Scoping & Non-Leakage');

  // Test 31: Identity scoping: switching persona changes returned profile
  BetaIdentityProvider.setIdentity('youth_demo_01');
  const pAlex = BetaIdentityProvider.getGrowthProfile();
  BetaIdentityProvider.setIdentity('admin_sarah');
  const pSarah = BetaIdentityProvider.getGrowthProfile();
  check(31, 'Identity scoping: switching persona changes returned growth profile',
    pAlex.memberId === 'youth_demo_01' && pSarah.memberId === 'admin_sarah');

  // Test 32: Identity scoping: Alex LP != Sarah LP != Father Alex LP
  check(32, 'Identity scoping: Alex LP (135) != Sarah LP (320) != Father Alex LP (500)',
    alexProfile.progression.lifePoints === 135 &&
    sarahProfile.progression.lifePoints === 320 &&
    fatherProfile.progression.lifePoints === 500);

  // ------------------------------------------------------------
  // GROUP 8: Ethics, Read-Only & Provider Abstraction
  // ------------------------------------------------------------
  console.log('\n[GROUP 8] Ethics, Read-Only & Provider Abstraction');

  // Test 33: Read-only enforcement: readOnly: true on all profiles
  check(33, 'Read-only enforcement: readOnly === true on all normalized profiles',
    alexProfile.readOnly === true && sarahProfile.readOnly === true && unknownProfile.readOnly === true);

  // Test 34: Zero holiness score: no religious rank fields exist
  const forbiddenKeys = ['holinessScore', 'spiritualRank', 'pietyScore', 'sanctity', 'holinessRank', 'spiritualWorth'];
  const allProfiles = [alexProfile, sarahProfile, fatherProfile, unknownProfile];
  const zeroHolinessScore = allProfiles.every(p => {
    const pKeys = Object.keys(p);
    const progKeys = Object.keys(p.progression || {});
    return forbiddenKeys.every(fk => !pKeys.includes(fk) && !progKeys.includes(fk));
  });
  check(34, 'Zero holiness score: no religious rank or spiritual-worth fields exist', zeroHolinessScore);

  // Test 35: Provider abstraction: KoinoniaGrowth.getGrowthProfile() works with any valid provider
  class MockCustomGrowthProvider extends KoinoniaGrowth.BaseGrowthProvider {
    getGrowthProfile(identity) {
      return KoinoniaGrowth.normalizeGrowthProfile({
        memberId: 'mock_custom_id',
        displayName: 'Custom Provider Member',
        progression: { lifePoints: 777, xp: 33 }
      });
    }
  }
  const originalProvider = KoinoniaGrowth.getProvider();
  KoinoniaGrowth.setProvider(new MockCustomGrowthProvider());
  const customProfile = KoinoniaGrowth.getGrowthProfile('any');
  KoinoniaGrowth.setProvider(originalProvider); // Restore original
  check(35, 'Provider abstraction: KoinoniaGrowth works with pluggable custom BaseGrowthProvider',
    customProfile && customProfile.memberId === 'mock_custom_id' && customProfile.progression.lifePoints === 777);

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passCount} / 35 PASSED (${failCount} FAILED)`);
  console.log('============================================================\n');

  if (failCount > 0) {
    console.error('FAILURES DETECTED:');
    failures.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('ALL 35 TESTS PASSED SUCCESSFULLY! 🎉');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('UNCAUGHT ERROR DURING TESTS:', err);
  process.exit(1);
});
