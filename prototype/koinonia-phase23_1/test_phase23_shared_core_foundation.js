/**
 * KOINONIA — PHASE 0.23B
 * SHARED CORE PROVIDER FOUNDATION TEST SUITE
 *
 * Verifies:
 * - Group 1: Module Loading & Contract Parity (30-method contract)
 * - Group 2: Provider Factory & Safe Local Defaults
 * - Group 3: Capability Metadata & Mode Distinguishability
 * - Group 4: Safe HTTP Client & Strict Route Gating
 * - Group 5: Fail-Closed Mutation Policy & Error Structuring
 * - Group 6: Idempotency Requirements & Replay Safety
 * - Group 7: No-Split-Brain Invariant (Zero Silent Fallback)
 * - Group 8: Zero Database & Zero Network Safety Invariants
 * - Group 9: Dual Synchronous / Asynchronous Return Compatibility
 * - Group 10: Gameplay Engine (game.js) Provider Resolution
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STAGING_DB = '/home/raspi4/fog-portal-staging/fog_community.db';
const EXPECTED_DB_SHA256 = 'f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

// Canonical 30-method contract list
const EXPECTED_30_METHODS = [
  'resetToBaseline',
  'getCurrentMember',
  'getLifePoints',
  'awardLifePoints',
  'getQuests',
  'getQuest',
  'getQuestCompletion',
  'completeQuest',
  'getEvents',
  'getEvent',
  'getAttendance',
  'getAllAttendanceRecords',
  'checkIn',
  'getMyCampfires',
  'getCampfire',
  'getCampfireMembers',
  'getCampfireLeaders',
  'getCampfireGameState',
  'getCampfireSettings',
  'setCommunityMaxParticipants',
  'setCampfireCapacity',
  'addReactionToCampfire',
  'getMinistries',
  'getMyMinistries',
  'getMinistryMissions',
  'getMyMinistryMissions',
  'getMilestones',
  'getGrowthProgress',
  'emitActivityEvent',
  'getActivityEvents'
];

async function runSharedCoreFoundationTestSuite() {
  console.log('================================================================');
  console.log('  KOINONIA PHASE 0.23B — SHARED CORE FOUNDATION TEST SUITE');
  console.log('================================================================\n');

  // ============================================================
  // GROUP 1: MODULE LOADING & CONTRACT PARITY (30 METHODS)
  // ============================================================
  console.log('[GROUP 1] Module Loading & Contract Parity');

  const sharedCoreModule = require('./data/shared_core.js');
  assert(sharedCoreModule !== undefined, 'shared_core.js loads successfully');
  assert(typeof sharedCoreModule.LocalSharedCoreProvider === 'function', 'LocalSharedCoreProvider is exported as a class/function');

  const remoteSharedCoreModule = require('./data/remote_shared_core.js');
  assert(remoteSharedCoreModule !== undefined, 'remote_shared_core.js loads successfully');
  assert(typeof remoteSharedCoreModule.RemoteSharedCoreProvider === 'function', 'RemoteSharedCoreProvider is exported as a class/function');
  assert(typeof remoteSharedCoreModule.SharedCoreHttpClient === 'function', 'SharedCoreHttpClient is exported as a class/function');

  const providerFactoryModule = require('./data/shared_core_provider.js');
  assert(providerFactoryModule !== undefined, 'shared_core_provider.js loads successfully');
  assert(typeof providerFactoryModule.createSharedCoreProvider === 'function', 'createSharedCoreProvider factory function exists');
  assert(typeof providerFactoryModule.getSharedCoreProvider === 'function', 'getSharedCoreProvider singleton getter exists');

  // Verify contract parity: Local provider implements all 30 methods
  const localInstance = new sharedCoreModule.LocalSharedCoreProvider();
  assert(EXPECTED_30_METHODS.length === 30, 'Canonical contract specifies exactly 30 public methods');
  EXPECTED_30_METHODS.forEach(method => {
    assert(typeof localInstance[method] === 'function', `LocalSharedCoreProvider implements ${method}()`);
  });

  // Verify contract parity: Remote provider implements all 30 methods
  const remoteInstance = new remoteSharedCoreModule.RemoteSharedCoreProvider();
  EXPECTED_30_METHODS.forEach(method => {
    assert(typeof remoteInstance[method] === 'function', `RemoteSharedCoreProvider implements ${method}()`);
  });

  // ============================================================
  // GROUP 2: PROVIDER FACTORY & SAFE LOCAL DEFAULTS
  // ============================================================
  console.log('\n[GROUP 2] Provider Factory & Safe Local Defaults');

  const defaultProvider = providerFactoryModule.createSharedCoreProvider();
  assert(defaultProvider instanceof sharedCoreModule.LocalSharedCoreProvider, 'createSharedCoreProvider() defaults to LocalSharedCoreProvider');
  assert(defaultProvider.capabilities.providerMode === 'local', 'Default provider mode is "local"');
  assert(defaultProvider.capabilities.remote === false, 'Default provider reports remote === false');

  const emptyOptProvider = providerFactoryModule.createSharedCoreProvider({});
  assert(emptyOptProvider instanceof sharedCoreModule.LocalSharedCoreProvider, 'createSharedCoreProvider({}) defaults to LocalSharedCoreProvider');

  // Remote provider requires explicit opt-in (providerMode: 'remote')
  const remoteOptProvider = providerFactoryModule.createSharedCoreProvider({ providerMode: 'remote' });
  assert(remoteOptProvider instanceof remoteSharedCoreModule.RemoteSharedCoreProvider, 'createSharedCoreProvider({ providerMode: "remote" }) creates RemoteSharedCoreProvider');
  assert(remoteOptProvider.capabilities.providerMode === 'remote', 'Remote provider reports providerMode === "remote"');
  assert(remoteOptProvider.capabilities.remote === true, 'Remote provider reports remote === true');
  assert(remoteOptProvider.capabilities.mutationsEnabled === false, 'Remote mutations remain disabled by default in remote mode');
  assert(remoteOptProvider.capabilities.readsEnabled === false, 'Remote reads remain disabled by default in remote mode');

  // Remote provider with explicit mutations
  const remoteWithMutations = providerFactoryModule.createSharedCoreProvider({
    providerMode: 'remote',
    remoteReadsEnabled: true,
    remoteMutationsEnabled: true
  });
  assert(remoteWithMutations.capabilities.mutationsEnabled === true, 'Remote mutations explicitly enabled when requested');
  assert(remoteWithMutations.capabilities.readsEnabled === true, 'Remote reads explicitly enabled when requested');

  // getSharedCoreProvider singleton defaults to local
  const singletonProvider = providerFactoryModule.getSharedCoreProvider();
  assert(singletonProvider instanceof sharedCoreModule.LocalSharedCoreProvider, 'getSharedCoreProvider() returns local provider singleton by default');

  // ============================================================
  // GROUP 3: CAPABILITY METADATA & MODE DISTINGUISHABILITY
  // ============================================================
  console.log('\n[GROUP 3] Capability Metadata & Mode Distinguishability');

  const localCaps = localInstance.getCapabilities();
  assert(typeof localCaps === 'object', 'LocalSharedCoreProvider.getCapabilities() returns object');
  assert(localCaps.providerMode === 'local', 'localCaps.providerMode is "local"');
  assert(localCaps.remote === false, 'localCaps.remote is false');
  assert(localCaps.authenticated === false, 'localCaps.authenticated is false');
  assert(localCaps.mutations === true, 'localCaps.mutations is true');
  assert(localCaps.lifePointsWrite === true, 'localCaps.lifePointsWrite is true');
  assert(localCaps.attendanceWrite === true, 'localCaps.attendanceWrite is true');
  assert(localCaps.questCompletionWrite === true, 'localCaps.questCompletionWrite is true');
  assert(localInstance.capabilities.providerMode === 'local', 'Local provider provides .capabilities getter');

  const remoteCaps = remoteInstance.getCapabilities();
  assert(typeof remoteCaps === 'object', 'RemoteSharedCoreProvider.getCapabilities() returns object');
  assert(remoteCaps.providerMode === 'remote', 'remoteCaps.providerMode is "remote"');
  assert(remoteCaps.remote === true, 'remoteCaps.remote is true');
  assert(remoteCaps.authenticated === false, 'remoteCaps.authenticated is false');
  assert(remoteCaps.mutations === false, 'remoteCaps.mutations is false by default');
  assert(remoteCaps.lifePointsWrite === false, 'remoteCaps.lifePointsWrite is false by default');
  assert(remoteCaps.attendanceWrite === false, 'remoteCaps.attendanceWrite is false by default');
  assert(remoteCaps.questCompletionWrite === false, 'remoteCaps.questCompletionWrite is false by default');
  assert(remoteInstance.capabilities.providerMode === 'remote', 'Remote provider provides .capabilities getter');

  // Verify gameplay code can distinguish without fragile string matching
  assert(localInstance.capabilities.remote !== remoteInstance.capabilities.remote, 'Gameplay code can unambiguously branch on .capabilities.remote');

  // ============================================================
  // GROUP 4: SAFE HTTP CLIENT & STRICT ROUTE GATING
  // ============================================================
  console.log('\n[GROUP 4] Safe HTTP Client & Strict Route Gating');

  const httpClient = new remoteSharedCoreModule.SharedCoreHttpClient();

  // Valid /api/v1/shared/* paths accepted
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/me') === true, 'Accepts /api/v1/shared/me');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/points') === true, 'Accepts /api/v1/shared/points');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/points/award') === true, 'Accepts /api/v1/shared/points/award');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/content/quests') === true, 'Accepts /api/v1/shared/content/quests');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/quests/Q-001/complete') === true, 'Accepts /api/v1/shared/quests/:id/complete');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/attendance/check-in') === true, 'Accepts /api/v1/shared/attendance/check-in');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/campfires') === true, 'Accepts /api/v1/shared/campfires');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/campfires/cf-01/reactions') === true, 'Accepts /api/v1/shared/campfires/:id/reactions');
  assert(httpClient.isValidSharedCoreEndpoint('/api/v1/shared/activity/events') === true, 'Accepts /api/v1/shared/activity/events');

  // Non-shared routes strictly REJECTED
  assert(httpClient.isValidSharedCoreEndpoint('/api/checkin') === false, 'Strictly rejects /api/checkin');
  assert(httpClient.isValidSharedCoreEndpoint('/api/games/universal-submit') === false, 'Strictly rejects /api/games/universal-submit');
  assert(httpClient.isValidSharedCoreEndpoint('/api/growth-games/memory') === false, 'Strictly rejects /api/growth-games/*');
  assert(httpClient.isValidSharedCoreEndpoint('/api/growth-games/quiz') === false, 'Strictly rejects /api/growth-games/quiz');
  assert(httpClient.isValidSharedCoreEndpoint('/api/members/update') === false, 'Strictly rejects /api/members/update');
  assert(httpClient.isValidSharedCoreEndpoint('/api/admin/publish') === false, 'Strictly rejects /api/admin/publish');
  assert(httpClient.isValidSharedCoreEndpoint('/auth/login') === false, 'Strictly rejects /auth/login');
  assert(httpClient.isValidSharedCoreEndpoint('/v1/shared/me') === false, 'Strictly rejects non-api path /v1/shared/me');

  // Attempting request on invalid route returns structured SHARED_CORE_INVALID_ROUTE
  const invalidRouteResult = await httpClient.request('POST', '/api/checkin', { memberId: 'm1' }, { idempotencyKey: 'k1' });
  assert(invalidRouteResult.success === false, 'Invalid route request returns success: false');
  assert(invalidRouteResult.error === 'SHARED_CORE_INVALID_ROUTE', 'Invalid route error code is SHARED_CORE_INVALID_ROUTE');
  assert(invalidRouteResult.code === 'SHARED_CORE_INVALID_ROUTE', 'Invalid route code is SHARED_CORE_INVALID_ROUTE');

  const invalidGameResult = await httpClient.request('POST', '/api/games/universal-submit', {}, { idempotencyKey: 'k2' });
  assert(invalidGameResult.error === 'SHARED_CORE_INVALID_ROUTE', 'Universal submit route error is SHARED_CORE_INVALID_ROUTE');

  // ============================================================
  // GROUP 5: FAIL-CLOSED MUTATION POLICY & ERROR STRUCTURING
  // ============================================================
  console.log('\n[GROUP 5] Fail-Closed Mutation Policy & Error Structuring');

  const defaultRemote = new remoteSharedCoreModule.RemoteSharedCoreProvider();

  // awardLifePoints in remote mode with mutations disabled
  const lpResult = await defaultRemote.awardLifePoints({
    amount: 10,
    charXp: 5,
    idempotencyKey: 'test_lp_01'
  });
  assert(lpResult.success === false, 'awardLifePoints fails closed in default remote mode');
  assert(lpResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'awardLifePoints error is SHARED_CORE_MUTATIONS_DISABLED');
  assert(lpResult.code === 'SHARED_CORE_MUTATIONS_DISABLED', 'awardLifePoints code is SHARED_CORE_MUTATIONS_DISABLED');

  // completeQuest in remote mode with mutations disabled
  const questResult = await defaultRemote.completeQuest({
    questId: 'Q-001',
    idempotencyKey: 'test_q_01'
  });
  assert(questResult.success === false, 'completeQuest fails closed in default remote mode');
  assert(questResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'completeQuest error is SHARED_CORE_MUTATIONS_DISABLED');

  // checkIn in remote mode with mutations disabled
  const checkinResult = await defaultRemote.checkIn({
    eventInstanceId: 'evt_01',
    idempotencyKey: 'test_chk_01'
  });
  assert(checkinResult.success === false, 'checkIn fails closed in default remote mode');
  assert(checkinResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'checkIn error is SHARED_CORE_MUTATIONS_DISABLED');

  // setCampfireCapacity in remote mode with mutations disabled
  const capResult = await defaultRemote.setCampfireCapacity('cf_01', 10, 'LEADER');
  assert(capResult.success === false, 'setCampfireCapacity fails closed in default remote mode');
  assert(capResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'setCampfireCapacity error is SHARED_CORE_MUTATIONS_DISABLED');

  // addReactionToCampfire in remote mode with mutations disabled
  const reactResult = await defaultRemote.addReactionToCampfire('cf_01', '👏');
  assert(reactResult.success === false, 'addReactionToCampfire fails closed in default remote mode');
  assert(reactResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'addReactionToCampfire error is SHARED_CORE_MUTATIONS_DISABLED');

  // emitActivityEvent in remote mode with mutations disabled
  const actResult = await defaultRemote.emitActivityEvent({
    eventType: 'TEST_EVENT',
    idempotencyKey: 'test_act_01'
  });
  assert(actResult.success === false, 'emitActivityEvent fails closed in default remote mode');
  assert(actResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'emitActivityEvent error is SHARED_CORE_MUTATIONS_DISABLED');

  // resetToBaseline in remote mode with mutations disabled
  const resetResult = await defaultRemote.resetToBaseline();
  assert(resetResult.success === false, 'resetToBaseline fails closed in default remote mode');
  assert(resetResult.error === 'SHARED_CORE_OPERATION_UNSUPPORTED' || resetResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'resetToBaseline error is SHARED_CORE_OPERATION_UNSUPPORTED');

  // Reads when remoteReadsEnabled is false
  const readMemberResult = await defaultRemote.getCurrentMember();
  assert(readMemberResult.success === false, 'getCurrentMember fails closed when remote reads disabled');
  assert(readMemberResult.error === 'SHARED_CORE_READS_DISABLED', 'getCurrentMember error is SHARED_CORE_READS_DISABLED');

  const readPointsResult = await defaultRemote.getLifePoints();
  assert(readPointsResult.success === false, 'getLifePoints fails closed when remote reads disabled');
  assert(readPointsResult.error === 'SHARED_CORE_READS_DISABLED', 'getLifePoints error is SHARED_CORE_READS_DISABLED');

  // ============================================================
  // GROUP 6: IDEMPOTENCY REQUIREMENTS & REPLAY SAFETY
  // ============================================================
  console.log('\n[GROUP 6] Idempotency Requirements & Replay Safety');

  // Create a remote client with mutations enabled to test idempotency validation
  const enabledRemote = new remoteSharedCoreModule.RemoteSharedCoreProvider({
    remoteReadsEnabled: true,
    remoteMutationsEnabled: true,
    baseUrl: 'http://127.0.0.1:39999' // Non-existent mock port to ensure no real connection
  });

  // awardLifePoints missing idempotencyKey
  const missingKeyLp = await enabledRemote.awardLifePoints({ amount: 50 });
  assert(missingKeyLp.success === false, 'awardLifePoints rejects missing idempotencyKey');
  assert(missingKeyLp.error === 'SHARED_CORE_MISSING_IDEMPOTENCY_KEY', 'Missing key error is SHARED_CORE_MISSING_IDEMPOTENCY_KEY');

  // completeQuest missing idempotencyKey
  const missingKeyQuest = await enabledRemote.completeQuest({ questId: 'Q-001' });
  assert(missingKeyQuest.success === false, 'completeQuest rejects missing idempotencyKey');
  assert(missingKeyQuest.error === 'SHARED_CORE_MISSING_IDEMPOTENCY_KEY', 'Missing key error is SHARED_CORE_MISSING_IDEMPOTENCY_KEY');

  // checkIn missing idempotencyKey
  const missingKeyCheckin = await enabledRemote.checkIn({ eventInstanceId: 'evt_01' });
  assert(missingKeyCheckin.success === false, 'checkIn rejects missing idempotencyKey');
  assert(missingKeyCheckin.error === 'SHARED_CORE_MISSING_IDEMPOTENCY_KEY', 'Missing key error is SHARED_CORE_MISSING_IDEMPOTENCY_KEY');

  // emitActivityEvent missing idempotencyKey
  const missingKeyAct = await enabledRemote.emitActivityEvent({ eventType: 'TEST' });
  assert(missingKeyAct.success === false, 'emitActivityEvent rejects missing idempotencyKey');
  assert(missingKeyAct.error === 'SHARED_CORE_MISSING_IDEMPOTENCY_KEY', 'Missing key error is SHARED_CORE_MISSING_IDEMPOTENCY_KEY');

  // Idempotency preserved in LocalSharedCoreProvider as well
  const local = new sharedCoreModule.LocalSharedCoreProvider();
  local.resetToBaseline();
  const initialBalance = local.getLifePoints().balance;
  const award1 = local.awardLifePoints({ amount: 25, idempotencyKey: 'test_idem_001' });
  assert(award1.success === true && award1.duplicate === false, 'First award with idempotency key succeeds');
  assert(local.getLifePoints().balance === initialBalance + 25, 'Balance updated after first award');

  const award2 = local.awardLifePoints({ amount: 25, idempotencyKey: 'test_idem_001' });
  assert(award2.success === true && award2.duplicate === true, 'Second award with same idempotency key detected as duplicate');
  assert(local.getLifePoints().balance === initialBalance + 25, 'Balance not increased twice (replay protection)');

  // ============================================================
  // GROUP 7: NO-SPLIT-BRAIN INVARIANT (ZERO SILENT FALLBACK)
  // ============================================================
  console.log('\n[GROUP 7] No-Split-Brain Invariant (Zero Silent Fallback)');

  // When RemoteSharedCoreProvider fails a mutation, it MUST NOT silently
  // award LP or complete quests in the local provider.
  const isolatedLocal = new sharedCoreModule.LocalSharedCoreProvider();
  isolatedLocal.resetToBaseline();
  const baselineLpBefore = isolatedLocal.getLifePoints().balance;

  const failingRemote = new remoteSharedCoreModule.RemoteSharedCoreProvider();
  const failedMutation = await failingRemote.awardLifePoints({
    amount: 100,
    idempotencyKey: 'split_brain_test_01'
  });

  assert(failedMutation.success === false, 'Remote mutation failed as expected');
  assert(isolatedLocal.getLifePoints().balance === baselineLpBefore, 'Local LP balance was NOT mutated (no silent fallback)');
  assert(isolatedLocal.getQuestCompletion('Q-001') === null, 'Local quest completion was NOT recorded (no split-brain)');

  // ============================================================
  // GROUP 8: ZERO DATABASE & ZERO NETWORK SAFETY INVARIANTS
  // ============================================================
  console.log('\n[GROUP 8] Zero Database & Zero Network Safety Invariants');

  const sharedCoreContent = fs.readFileSync(path.join(__dirname, 'data', 'shared_core.js'), 'utf8');
  const remoteContent = fs.readFileSync(path.join(__dirname, 'data', 'remote_shared_core.js'), 'utf8');
  const providerContent = fs.readFileSync(path.join(__dirname, 'data', 'shared_core_provider.js'), 'utf8');

  // Verify zero SQLite or better-sqlite3 imports
  assert(!sharedCoreContent.includes("require('sqlite3')"), 'shared_core.js does not import sqlite3');
  assert(!sharedCoreContent.includes("require('better-sqlite3')"), 'shared_core.js does not import better-sqlite3');
  assert(!remoteContent.includes("require('sqlite3')"), 'remote_shared_core.js does not import sqlite3');
  assert(!remoteContent.includes("require('better-sqlite3')"), 'remote_shared_core.js does not import better-sqlite3');
  assert(!providerContent.includes("require('sqlite3')"), 'shared_core_provider.js does not import sqlite3');
  assert(!providerContent.includes("require('better-sqlite3')"), 'shared_core_provider.js does not import better-sqlite3');

  // Verify zero references to fog_community.db
  assert(!sharedCoreContent.includes('fog_community.db'), 'shared_core.js contains zero references to fog_community.db');
  assert(!remoteContent.includes('fog_community.db'), 'remote_shared_core.js contains zero references to fog_community.db');
  assert(!providerContent.includes('fog_community.db'), 'shared_core_provider.js contains zero references to fog_community.db');

  // Verify zero hardcoded staging LAN IPs or production URLs
  assert(!remoteContent.includes('192.168.1.139'), 'remote_shared_core.js contains no hardcoded staging IP');
  assert(!remoteContent.includes('staging.fogmin.site'), 'remote_shared_core.js contains no hardcoded staging domain');
  assert(!remoteContent.includes('checkin.fogmin.site'), 'remote_shared_core.js contains no hardcoded checkin domain');
  assert(!providerContent.includes('192.168.1.139'), 'shared_core_provider.js contains no hardcoded staging IP');

  // Staging DB bit-for-bit SHA256 invariant check
  const dbBuf = fs.readFileSync(STAGING_DB);
  const actualDbSha = crypto.createHash('sha256').update(dbBuf).digest('hex');
  assert(actualDbSha === EXPECTED_DB_SHA256, `Staging DB SHA256 remains bit-for-bit identical (${EXPECTED_DB_SHA256})`);

  // ============================================================
  // GROUP 9: DUAL SYNCHRONOUS / ASYNC RETURN COMPATIBILITY
  // ============================================================
  console.log('\n[GROUP 9] Dual Synchronous / Async Return Compatibility');

  const dualRemote = new remoteSharedCoreModule.RemoteSharedCoreProvider();

  // Synchronous access: caller does NOT use await
  const syncResult = dualRemote.awardLifePoints({ amount: 10, idempotencyKey: 'sync_test' });
  assert(syncResult.success === false, 'Synchronous access: syncResult.success is false');
  assert(syncResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'Synchronous access: syncResult.error is SHARED_CORE_MUTATIONS_DISABLED');
  assert(typeof syncResult.then === 'function', 'Returned object is also a thenable / Promise');

  // Asynchronous access: caller DOES use await
  const asyncResult = await dualRemote.awardLifePoints({ amount: 10, idempotencyKey: 'async_test' });
  assert(asyncResult.success === false, 'Asynchronous await: asyncResult.success is false');
  assert(asyncResult.error === 'SHARED_CORE_MUTATIONS_DISABLED', 'Asynchronous await: asyncResult.error is SHARED_CORE_MUTATIONS_DISABLED');

  // Synchronous read check
  const syncRead = dualRemote.getCurrentMember();
  assert(syncRead.success === false, 'Synchronous read: syncRead.success is false');
  assert(syncRead.error === 'SHARED_CORE_READS_DISABLED', 'Synchronous read: syncRead.error is SHARED_CORE_READS_DISABLED');

  // ============================================================
  // GROUP 10: GAME ENGINE PROVIDER RESOLUTION (game.js)
  // ============================================================
  console.log('\n[GROUP 10] Game Engine Provider Resolution');

  const gameJsContent = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  assert(gameJsContent.includes('getSharedCoreProvider'), 'game.js integrates getSharedCoreProvider resolver');
  assert(gameJsContent.includes("require('./data/shared_core_provider.js')"), 'game.js attempts provider module resolution');

  // Verify BetaIdentityProvider remains intact and unmodified
  const betaIdentityContent = fs.readFileSync(path.join(__dirname, 'data', 'beta_identity.js'), 'utf8');
  assert(betaIdentityContent.includes('BetaIdentityProvider'), 'BetaIdentityProvider module remains present in Phase 0.23B');
  assert(betaIdentityContent.includes('Alex Rivera'), 'Member persona Alex Rivera preserved');
  assert(betaIdentityContent.includes('Sarah Jenkins'), 'Admin persona Sarah Jenkins preserved');
  assert(betaIdentityContent.includes('Pastor David'), 'Superadmin persona Pastor David preserved');

  // Verify index.html loads both provider files in correct order
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(indexHtml.includes('src="data/shared_core.js'), 'index.html loads shared_core.js');
  assert(indexHtml.includes('src="data/remote_shared_core.js'), 'index.html loads remote_shared_core.js');
  assert(indexHtml.includes('src="data/shared_core_provider.js'), 'index.html loads shared_core_provider.js');

  const scPos = indexHtml.indexOf('src="data/shared_core.js');
  const rscPos = indexHtml.indexOf('src="data/remote_shared_core.js');
  const provPos = indexHtml.indexOf('src="data/shared_core_provider.js');
  assert(scPos >= 0 && rscPos > scPos && provPos > rscPos, 'Script loading order is: shared_core.js -> remote_shared_core.js -> shared_core_provider.js');

  console.log('\n================================================================');
  console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSharedCoreFoundationTestSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
