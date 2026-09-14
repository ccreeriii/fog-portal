/**
 * KOINONIA — PHASE 0.23I TEST SUITE
 * Member Identity Readiness & Authorization Foundation Verification
 *
 * Covers all 20 required verification criteria:
 * 1. Normalization of valid member identity payload
 * 2. Normalization of minimal payload with defaults applied
 * 3. Fail-closed behavior on null/undefined input
 * 4. Fail-closed behavior on missing memberId
 * 5. Role validation: unknown role defaults to MEMBER
 * 6. Role validation: ADMIN gets correct role and capabilities
 * 7. Role validation: SUPERADMIN gets correct role and capabilities
 * 8. Capability derivation: MEMBER has no Studio capabilities
 * 9. Capability derivation: ADMIN has authoring but no approval/publishing capabilities
 * 10. Capability derivation: SUPERADMIN has authoring, approval, and publishing capabilities
 * 11. Capability derivation: campfire management capability correctly assigned
 * 12. Sensitive field exclusion: password, tokens, birthdates not present in normalized identity
 * 13. Minor safety: isMinor correctly captured and defaults safely
 * 14. PrototypeIdentityProvider returns current identity
 * 15. PrototypeIdentityProvider persona switching works
 * 16. BetaIdentityProvider backward compatibility: personas accessible, getPersonas() works
 * 17. BetaIdentityProvider backward compatibility: canAccessStudio() returns correct results
 * 18. BetaIdentityProvider backward compatibility: canPublish() returns correct results
 * 19. StudioEngine integration: audit log records actorMemberId and actorDisplayName
 * 20. StudioEngine integration: canPerform() respects normalized capabilities
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock localStorage for Node environment before requiring identity modules
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Require Phase 0.23I modules
const KoinoniaIdentity = require('./data/member_identity.js');
const BetaIdentityProvider = require('./data/beta_identity.js');
const StudioEngine = require('./data/studio_engine.js');

let passCount = 0;
let failCount = 0;
const failures = [];

function check(desc, condition, extraInfo = '') {
  if (condition) {
    passCount++;
    console.log(`  ✅ [PASS] ${desc}`);
  } else {
    failCount++;
    const errMsg = `FAILED: ${desc} ${extraInfo}`;
    failures.push(errMsg);
    console.error(`  ❌ [FAIL] ${errMsg}`);
  }
}

async function runTests() {
  console.log('============================================================');
  console.log('KOINONIA PHASE 0.23I: MEMBER IDENTITY & AUTHORIZATION TESTS');
  console.log('============================================================\n');

  // ------------------------------------------------------------
  // GROUP 1: Normalization & Fail-Closed Validation
  // ------------------------------------------------------------
  console.log('[GROUP 1] Normalization & Fail-Closed Validation');

  // Test 1: Valid payload
  const validRaw = {
    memberId: 'mem_12345',
    displayName: 'Brother Marcus',
    role: 'ADMIN',
    firstName: 'Marcus',
    lastName: 'Vance',
    safeguards: { isMinor: false },
    source: 'shared-core',
    authenticated: true
  };
  const norm1 = KoinoniaIdentity.normalizeMemberIdentity(validRaw);
  check('1. Normalization of valid member identity payload produces correct memberId and role',
    norm1.memberId === 'mem_12345' && norm1.displayName === 'Brother Marcus' && norm1.role === 'ADMIN');

  // Test 2: Minimal payload with defaults
  const minimalRaw = { memberId: 'mem_min_01' };
  const norm2 = KoinoniaIdentity.normalizeMemberIdentity(minimalRaw);
  check('2. Minimal payload defaults to MEMBER role with standard fallback display name and profile',
    norm2.memberId === 'mem_min_01' && norm2.role === 'MEMBER' && norm2.displayName === 'Community Member' && norm2.profile.growthLevel === 1);

  // Test 3: Null/undefined input fail-closed
  const normNull = KoinoniaIdentity.normalizeMemberIdentity(null);
  const normUndef = KoinoniaIdentity.normalizeMemberIdentity(undefined);
  check('3. Fail-closed on null/undefined input returns unauthenticated guest identity',
    normNull.authenticated === false && normNull.memberId === 'guest_anonymous' &&
    normUndef.authenticated === false && normUndef.capabilities.canAccessStudio === false);

  // Test 4: Missing memberId fail-closed
  const normMissingId = KoinoniaIdentity.normalizeMemberIdentity({ displayName: 'No ID' });
  const normBlankId = KoinoniaIdentity.normalizeMemberIdentity({ memberId: '   ' });
  check('4. Fail-closed on missing/blank memberId returns guest identity',
    normMissingId.memberId === 'guest_anonymous' && normMissingId.authenticated === false &&
    normBlankId.memberId === 'guest_anonymous' && normBlankId.authenticated === false);

  // Test 5: Unknown role defaults to MEMBER
  const normUnknownRole = KoinoniaIdentity.normalizeMemberIdentity({
    memberId: 'mem_hacker',
    role: 'SUPER_ROOT_ADMIN'
  });
  check('5. Unknown role defaults safely to MEMBER (least privilege)',
    normUnknownRole.role === 'MEMBER' && normUnknownRole.capabilities.canAccessStudio === false);

  // Test 6: ADMIN gets correct role and capabilities
  const normAdmin = KoinoniaIdentity.normalizeMemberIdentity({
    memberId: 'admin_test',
    role: 'ADMIN',
    authenticated: true
  });
  check('6. ADMIN gets correct role and capabilities (canAccessStudio: true, canAuthorContent: true, canPublishContent: false)',
    normAdmin.role === 'ADMIN' && normAdmin.capabilities.canAccessStudio === true &&
    normAdmin.capabilities.canAuthorContent === true && normAdmin.capabilities.canPublishContent === false);

  // Test 7: Untrusted input claiming SUPERADMIN (even with father_alex memberId) is clamped to MEMBER
  const untrustedFatherAlex = KoinoniaIdentity.normalizeMemberIdentity({
    memberId: 'father_alex',
    displayName: 'Father Alex',
    role: 'SUPERADMIN',
    authenticated: true
  });
  const untrustedSuper = KoinoniaIdentity.normalizeMemberIdentity({
    memberId: 'untrusted_attacker',
    role: 'SUPERADMIN',
    authenticated: true
  });
  check('7. Untrusted raw input claiming SUPERADMIN (even with father_alex memberId) is clamped to MEMBER',
    untrustedFatherAlex.role === 'MEMBER' && untrustedFatherAlex.capabilities.canAccessStudio === false &&
    untrustedSuper.role === 'MEMBER' && untrustedSuper.capabilities.canAccessStudio === false);

  // ------------------------------------------------------------
  // GROUP 2: Capability Derivation & Role Matrix
  // ------------------------------------------------------------
  console.log('\n[GROUP 2] Capability Derivation & Role Matrix');

  // Test 8: MEMBER has no Studio capabilities
  const normMember = KoinoniaIdentity.normalizeMemberIdentity({
    memberId: 'member_test',
    role: 'MEMBER',
    capabilities: { canAccessStudio: true, canPublishContent: true } // Attempted client elevation
  });
  check('8. MEMBER has no Studio capabilities, ignoring attempted client elevation',
    normMember.capabilities.canAccessStudio === false &&
    normMember.capabilities.canAuthorContent === false &&
    normMember.capabilities.canReviewContent === false &&
    normMember.capabilities.canPublishContent === false);

  // Test 9: ADMIN has authoring but no approval/publishing
  check('9. ADMIN has authoring capabilities but strictly NO review or publishing capabilities',
    normAdmin.capabilities.canAuthorContent === true &&
    normAdmin.capabilities.canReviewContent === false &&
    normAdmin.capabilities.canPublishContent === false);

  // Test 10: SUPERADMIN has authoring, approval, and publishing
  const trustedSuper = KoinoniaIdentity.PROTOTYPE_PERSONAS.SUPERADMIN;
  check('10. SUPERADMIN has complete authoring, review, and publishing capabilities',
    trustedSuper.capabilities.canAuthorContent === true &&
    trustedSuper.capabilities.canReviewContent === true &&
    trustedSuper.capabilities.canPublishContent === true);

  // Test 11: Campfire management capability
  check('11. Campfire management capability correctly assigned to leaders (ADMIN/SUPERADMIN) but not regular MEMBER',
    normMember.capabilities.canManageCampfire === false &&
    normAdmin.capabilities.canManageCampfire === true &&
    trustedSuper.capabilities.canManageCampfire === true);

  // ------------------------------------------------------------
  // GROUP 3: Privacy & Minor Safety
  // ------------------------------------------------------------
  console.log('\n[GROUP 3] Privacy & Minor Safety');

  // Test 12: Sensitive field exclusion
  const taintedPayload = {
    memberId: 'mem_safe_01',
    displayName: 'Safe Member',
    role: 'MEMBER',
    password: 'super_secret_password',
    token: 'jwt.token.here',
    birthdate: '1990-05-12',
    dob: '1990-05-12',
    access_token: 'abc123token',
    secret: 'hidden_secret'
  };
  const normSafe = KoinoniaIdentity.normalizeMemberIdentity(taintedPayload);
  const keys = Object.keys(normSafe);
  const hasSensitiveKey = keys.some(k => ['password', 'token', 'birthdate', 'dob', 'access_token', 'secret'].includes(k));
  check('12. Sensitive fields (password, tokens, raw birthdates) are strictly excluded from normalized identity',
    !hasSensitiveKey && normSafe.password === undefined && normSafe.token === undefined && normSafe.birthdate === undefined);

  // Test 13: Minor safety handling
  const minorPayload = { memberId: 'youth_01', safeguards: { isMinor: true } };
  const adultPayload = { memberId: 'adult_01', safeguards: { isMinor: false } };
  const unknownMinorPayload = { memberId: 'unknown_age_01' };
  const normMinor = KoinoniaIdentity.normalizeMemberIdentity(minorPayload);
  const normAdult = KoinoniaIdentity.normalizeMemberIdentity(adultPayload);
  const normUnknown = KoinoniaIdentity.normalizeMemberIdentity(unknownMinorPayload);

  check('13. Minor safety flag is correctly preserved as boolean and defaults safely to null when unknown',
    normMinor.safeguards.isMinor === true &&
    normAdult.safeguards.isMinor === false &&
    normUnknown.safeguards.isMinor === null);

  // ------------------------------------------------------------
  // GROUP 4: Provider Abstraction & Beta Provider Compatibility
  // ------------------------------------------------------------
  console.log('\n[GROUP 4] Provider Abstraction & Beta Provider Compatibility');

  // Test 14: PrototypeIdentityProvider returns current identity
  const currentId = KoinoniaIdentity.getCurrentIdentity();
  check('14. PrototypeIdentityProvider returns a valid current identity with canonical fields',
    currentId && Boolean(currentId.memberId) && Boolean(currentId.role) && Boolean(currentId.capabilities));

  // Test 15: PrototypeIdentityProvider persona switching works
  KoinoniaIdentity.setIdentity('ADMIN');
  const adminSwitched = KoinoniaIdentity.getCurrentIdentity();
  KoinoniaIdentity.setIdentity('SUPERADMIN');
  const superSwitched = KoinoniaIdentity.getCurrentIdentity();
  KoinoniaIdentity.setIdentity('MEMBER');
  const memberSwitched = KoinoniaIdentity.getCurrentIdentity();

  check('15. PrototypeIdentityProvider switching updates active persona correctly',
    adminSwitched.role === 'ADMIN' && adminSwitched.memberId === 'admin_sarah' &&
    superSwitched.role === 'SUPERADMIN' && superSwitched.memberId === 'father_alex' &&
    memberSwitched.role === 'MEMBER' && memberSwitched.memberId === 'youth_demo_01');

  // Test 16: BetaIdentityProvider backward compatibility: personas & getPersonas()
  const betaPersonas = BetaIdentityProvider.getPersonas();
  const betaMember = BetaIdentityProvider.getPersona('MEMBER');
  const betaAdmin = BetaIdentityProvider.getPersona('ADMIN');
  const betaSuper = BetaIdentityProvider.getPersona('SUPERADMIN');

  check('16. BetaIdentityProvider getPersonas() returns 3 personas with id, name, role, and capabilities',
    betaPersonas.length === 3 &&
    betaMember.id === 'youth_demo_01' &&
    betaAdmin.id === 'admin_sarah' &&
    betaSuper.id === 'father_alex');

  // Test 17: BetaIdentityProvider canAccessStudio() returns correct results
  check('17. BetaIdentityProvider canAccessStudio() correctly authorizes ADMIN & SUPERADMIN but denies MEMBER',
    BetaIdentityProvider.canAccessStudio(betaMember) === false &&
    BetaIdentityProvider.canAccessStudio(betaAdmin) === true &&
    BetaIdentityProvider.canAccessStudio(betaSuper) === true);

  // Test 18: BetaIdentityProvider canPublish() returns correct results
  check('18. BetaIdentityProvider canPublish() correctly authorizes ONLY SUPERADMIN',
    BetaIdentityProvider.canPublish(betaMember) === false &&
    BetaIdentityProvider.canPublish(betaAdmin) === false &&
    BetaIdentityProvider.canPublish(betaSuper) === true);

  // ------------------------------------------------------------
  // GROUP 5: Studio Engine & Governance Integration
  // ------------------------------------------------------------
  console.log('\n[GROUP 5] Studio Engine & Governance Integration');

  // Test 19: StudioEngine audit log records actorMemberId and actorDisplayName
  mockStorage.clear();
  const store = new StudioEngine.StudioStore();

  const testActorSarah = {
    memberId: 'admin_sarah',
    id: 'admin_sarah',
    displayName: 'Sarah Jenkins',
    name: 'Sarah Jenkins',
    role: 'ADMIN'
  };

  const draft = store.createDraft('QUEST', { title: 'Test Sanctuary Quest' }, testActorSarah);
  const auditLogs = store.getAuditLogs();
  const createdLog = auditLogs.find(l => l.action === 'DRAFT_CREATED');

  check('19. StudioEngine audit log records actorMemberId, actorDisplayName, and legacy actor object',
    createdLog !== undefined &&
    createdLog.actorMemberId === 'admin_sarah' &&
    createdLog.actorDisplayName === 'Sarah Jenkins' &&
    createdLog.actor.id === 'admin_sarah' &&
    createdLog.actor.name === 'Sarah Jenkins' &&
    createdLog.actor.role === 'ADMIN');

  // Test 20: StudioEngine canPerform() respects normalized capabilities and role transitions
  const memberActor = { role: 'MEMBER', capabilities: { canAuthorContent: false, canPublishContent: false } };
  const adminActor = { role: 'ADMIN', capabilities: { canAuthorContent: true, canPublishContent: false } };
  const superActor = { role: 'SUPERADMIN', capabilities: { canAuthorContent: true, canReviewContent: true, canPublishContent: true } };

  check('20. StudioEngine canPerform() respects capabilities and blocks unauthorized role actions',
    store.canPerform(memberActor, 'CREATE_DRAFT') === false &&
    store.canPerform(adminActor, 'CREATE_DRAFT') === true &&
    store.canPerform(adminActor, 'PUBLISH') === false &&
    store.canPerform(superActor, 'PUBLISH') === true &&
    store.canPerform('ADMIN', 'CREATE_DRAFT') === true &&
    store.canPerform('MEMBER', 'CREATE_DRAFT') === false);

  // ------------------------------------------------------------
  // GROUP 6: Versioning & Infrastructure Checks (Phase 0.23I)
  // ------------------------------------------------------------
  console.log('\n[GROUP 6] Versioning & Infrastructure Checks (Phase 0.23I)');

  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  check('21. server.js defines PHASE = "0.23I" and VERSION = "0.23I"',
    serverSrc.includes('const PHASE = "0.23I";') && serverSrc.includes('const VERSION = "0.23I";'));

  const swSrc = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  check('22. sw.js defines CACHE_NAME = "koinonia-v0.23i-r1" and includes member_identity.js',
    swSrc.includes('const CACHE_NAME = "koinonia-v0.23i-r1";') &&
    swSrc.includes('"./data/member_identity.js?v=0.23i-r1"'));

  const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  check('23. index.html includes member_identity.js?v=0.23i-r1 script tag before beta_identity.js',
    indexSrc.includes('<script src="data/member_identity.js?v=0.23i-r1"></script>') &&
    indexSrc.indexOf('data/member_identity.js?v=0.23i-r1') < indexSrc.indexOf('data/beta_identity.js?v=0.23i-r1'));

  // ------------------------------------------------------------
  // GROUP 7: SUPERADMIN Trust-Boundary Hardening & Attack Resistance (12 Mandatory Tests)
  // ------------------------------------------------------------
  console.log('\n[GROUP 7] SUPERADMIN Trust-Boundary Hardening & Attack Resistance (12 Tests)');

  // Attack 1: Direct attacker payload claiming SUPERADMIN
  const atk1 = KoinoniaIdentity.normalizeMemberIdentity({ memberId: 'attacker', role: 'SUPERADMIN', authenticated: true });
  check('24. [Attack 1] Direct { memberId: "attacker", role: "SUPERADMIN" } clamped to MEMBER with zero privileged capabilities',
    atk1.role === 'MEMBER' && atk1.capabilities.canAccessStudio === false && atk1.capabilities.canPublishContent === false);

  // Attack 2: Direct payload with memberId: 'father_alex' claiming SUPERADMIN
  const atk2 = KoinoniaIdentity.normalizeMemberIdentity({ memberId: 'father_alex', role: 'SUPERADMIN', authenticated: true });
  check('25. [Attack 2] Direct { memberId: "father_alex", role: "SUPERADMIN" } clamped to MEMBER',
    atk2.role === 'MEMBER' && atk2.capabilities.canAccessStudio === false && atk2.capabilities.canPublishContent === false);

  // Attack 3: Direct payload with id: 'father_alex' claiming SUPERADMIN
  const atk3 = KoinoniaIdentity.normalizeMemberIdentity({ id: 'father_alex', role: 'SUPERADMIN', authenticated: true });
  check('26. [Attack 3] Direct { id: "father_alex", role: "SUPERADMIN" } clamped to MEMBER',
    atk3.role === 'MEMBER' && atk3.capabilities.canAccessStudio === false && atk3.capabilities.canPublishContent === false);

  // Attack 4: Attacker with source: 'prototype' claiming SUPERADMIN
  const atk4 = KoinoniaIdentity.normalizeMemberIdentity({ memberId: 'attacker', role: 'SUPERADMIN', authenticated: true, source: 'prototype' });
  check('27. [Attack 4] Attacker with source: "prototype" clamped to MEMBER',
    atk4.role === 'MEMBER' && atk4.capabilities.canAccessStudio === false && atk4.capabilities.canPublishContent === false);

  // Attack 5: father_alex with source: 'prototype' passed directly outside provider
  const atk5 = KoinoniaIdentity.normalizeMemberIdentity({ memberId: 'father_alex', role: 'SUPERADMIN', authenticated: true, source: 'prototype' });
  check('28. [Attack 5] { memberId: "father_alex", source: "prototype" } passed directly outside provider clamped to MEMBER',
    atk5.role === 'MEMBER' && atk5.capabilities.canAccessStudio === false && atk5.capabilities.canPublishContent === false);

  // Attack 6: Attacker claiming source: 'shared-core', trustedSource: true
  const atk6 = KoinoniaIdentity.normalizeMemberIdentity({ memberId: 'attacker', role: 'SUPERADMIN', authenticated: true, source: 'shared-core', trustedSource: true });
  check('29. [Attack 6] Attacker self-declaring source: "shared-core", trustedSource: true clamped to MEMBER',
    atk6.role === 'MEMBER' && atk6.capabilities.canAccessStudio === false && atk6.capabilities.canPublishContent === false);

  // Attack 7: father_alex claiming source: 'shared-core', trustedSource: true passed directly
  const atk7 = KoinoniaIdentity.normalizeMemberIdentity({ memberId: 'father_alex', role: 'SUPERADMIN', authenticated: true, source: 'shared-core', trustedSource: true });
  check('30. [Attack 7] father_alex self-declaring source: "shared-core", trustedSource: true clamped to MEMBER',
    atk7.role === 'MEMBER' && atk7.capabilities.canAccessStudio === false && atk7.capabilities.canPublishContent === false);

  // Attack 8: Capability injection on MEMBER
  const atk8 = KoinoniaIdentity.normalizeMemberIdentity({
    memberId: 'attacker_caps',
    role: 'MEMBER',
    authenticated: true,
    capabilities: {
      canAccessStudio: true,
      canAuthorContent: true,
      canReviewContent: true,
      canPublishContent: true,
      canManageCampfire: true
    }
  });
  check('31. [Attack 8] Injected capabilities on MEMBER strictly ignored; zero privileged capabilities granted',
    atk8.capabilities.canAccessStudio === false &&
    atk8.capabilities.canAuthorContent === false &&
    atk8.capabilities.canReviewContent === false &&
    atk8.capabilities.canPublishContent === false &&
    atk8.capabilities.canManageCampfire === false);

  // Trust 9: Trusted PrototypeIdentityProvider selecting Father Alex legitimately receives SUPERADMIN
  KoinoniaIdentity.setIdentity('SUPERADMIN');
  const trustedFatherAlex = KoinoniaIdentity.getCurrentIdentity();
  check('32. [Trust 9] Trusted PrototypeIdentityProvider Father Alex persona legitimately granted SUPERADMIN role & capabilities',
    trustedFatherAlex.role === 'SUPERADMIN' &&
    trustedFatherAlex.memberId === 'father_alex' &&
    trustedFatherAlex.capabilities.canAccessStudio === true &&
    trustedFatherAlex.capabilities.canAuthorContent === true &&
    trustedFatherAlex.capabilities.canReviewContent === true &&
    trustedFatherAlex.capabilities.canPublishContent === true &&
    trustedFatherAlex.capabilities.canManageCampfire === true);

  // Trust 10: Trusted PrototypeIdentityProvider selecting Sarah legitimately receives ADMIN
  KoinoniaIdentity.setIdentity('ADMIN');
  const trustedSarah = KoinoniaIdentity.getCurrentIdentity();
  check('33. [Trust 10] Trusted PrototypeIdentityProvider Sarah persona legitimately granted ADMIN role & authoring capabilities, but NO review/publish',
    trustedSarah.role === 'ADMIN' &&
    trustedSarah.memberId === 'admin_sarah' &&
    trustedSarah.capabilities.canAccessStudio === true &&
    trustedSarah.capabilities.canAuthorContent === true &&
    trustedSarah.capabilities.canReviewContent === false &&
    trustedSarah.capabilities.canPublishContent === false &&
    trustedSarah.capabilities.canManageCampfire === true);

  // Trust 11: Trusted PrototypeIdentityProvider selecting Alex Rivera legitimately receives MEMBER
  KoinoniaIdentity.setIdentity('MEMBER');
  const trustedAlex = KoinoniaIdentity.getCurrentIdentity();
  check('34. [Trust 11] Trusted PrototypeIdentityProvider Alex Rivera persona receives MEMBER role with zero privileged capabilities',
    trustedAlex.role === 'MEMBER' &&
    trustedAlex.memberId === 'youth_demo_01' &&
    trustedAlex.capabilities.canAccessStudio === false &&
    trustedAlex.capabilities.canAuthorContent === false &&
    trustedAlex.capabilities.canReviewContent === false &&
    trustedAlex.capabilities.canPublishContent === false &&
    trustedAlex.capabilities.canManageCampfire === false);

  // Boundary 12: SharedCoreIdentityProvider remains disabled and fail-closed
  const sharedProvider = new KoinoniaIdentity.SharedCoreIdentityProvider();
  const sharedCurrent = sharedProvider.getCurrentIdentity();
  const sharedFetch = await sharedProvider.fetchIdentity();
  check('35. [Boundary 12] SharedCoreIdentityProvider strictly disabled (enabled: false) and fails closed to unauthenticated guest',
    sharedProvider.enabled === false &&
    sharedCurrent.authenticated === false &&
    sharedCurrent.memberId === 'guest_anonymous' &&
    sharedFetch.authenticated === false &&
    sharedFetch.memberId === 'guest_anonymous');

  // Bonus: BetaIdentityProvider getNormalizedIdentity trust boundary enforcement
  const betaAtk = BetaIdentityProvider.getNormalizedIdentity({ memberId: 'attacker', role: 'SUPERADMIN', authenticated: true });
  BetaIdentityProvider.setIdentity('SUPERADMIN');
  const betaSuperId = BetaIdentityProvider.getNormalizedIdentity();
  BetaIdentityProvider.setIdentity('MEMBER');
  check('36. BetaIdentityProvider.getNormalizedIdentity clamps untrusted payloads while honoring authentic internal personas',
    betaAtk.role === 'MEMBER' && betaAtk.capabilities.canAccessStudio === false &&
    betaSuperId.role === 'SUPERADMIN' && betaSuperId.capabilities.canPublishContent === true);

  // Summary
  console.log('\n============================================================');
  console.log(`PHASE 0.23I TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED (TOTAL: ${passCount + failCount})`);
  console.log('============================================================\n');

  if (failCount > 0) {
    console.error('FAILURES:');
    failures.forEach(f => console.error(` - ${f}`));
    process.exit(1);
  } else {
    console.log('ALL PHASE 0.23I MEMBER IDENTITY TESTS PASSED PERFECTLY!');
  }
}

runTests().catch(err => {
  console.error('Unexpected test error:', err);
  process.exit(1);
});
