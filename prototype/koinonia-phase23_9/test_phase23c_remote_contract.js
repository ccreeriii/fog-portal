/**
 * KOINONIA — PHASE 0.23C
 * REMOTE SHARED CORE CONTRACT & MOCK INTEGRATION TEST SUITE
 *
 * Requirements Verified:
 * A. Mock server lifecycle
 * B. localhost-only binding
 * C. dynamic ephemeral port
 * D. provider explicit opt-in
 * E. read gate
 * F. mutation gate
 * G. actual HTTP reads
 * H. actual HTTP mutations
 * I. request paths
 * J. request methods
 * K. JSON headers
 * L. credentials configuration behavior
 * M. idempotency header
 * N. replay behavior
 * O. no duplicate LP award
 * P. no automatic mutation retry
 * Q. 401 mapping (SHARED_CORE_UNAUTHORIZED)
 * R. 403 mapping (SHARED_CORE_FORBIDDEN)
 * S. 404 mapping (SHARED_CORE_NOT_FOUND)
 * T. 409 mapping (SHARED_CORE_CONFLICT)
 * U. 422 mapping (SHARED_CORE_VALIDATION_ERROR)
 * V. 429 mapping (SHARED_CORE_RATE_LIMITED)
 * W. 500 mapping (SHARED_CORE_SERVER_ERROR)
 * X. malformed JSON (SHARED_CORE_MALFORMED_RESPONSE)
 * Y. timeout behavior (SHARED_CORE_TIMEOUT)
 * Z. connection/network failure (SHARED_CORE_NETWORK_ERROR)
 * AA. no local fallback (no split-brain)
 * AB. raw route rejection
 * AC. path traversal rejection
 * AD. absolute URL injection rejection
 * AE. no SQLite/Main DB dependency
 * AF. no Main App hostname dependency
 * AG. full provider contract remains intact (30 methods)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { MockSharedCoreServer } = require('./test_support/mock_shared_core_server.js');
const { RemoteSharedCoreProvider, SharedCoreHttpClient, SHARED_CORE_ERRORS } = require('./data/remote_shared_core.js');
const { createSharedCoreProvider, getSharedCoreProvider, resetSharedCoreProvider } = require('./data/shared_core_provider.js');
const { LocalSharedCoreProvider } = require('./data/shared_core.js');

async function runContractTests() {
  console.log('================================================================');
  console.log('KOINONIA PHASE 0.23C — REMOTE SHARED CORE CONTRACT TEST SUITE');
  console.log('================================================================');

  let passed = 0;
  function check(condition, message) {
    assert(condition, message);
    passed++;
    console.log(`  ✓ [${passed}] ${message}`);
  }

  const mock = new MockSharedCoreServer();

  try {
    // ============================================================
    // A, B, C: MOCK SERVER LIFECYCLE & NETWORK BINDING
    // ============================================================
    console.log('\n[REQUIREMENTS A, B, C] Mock Server Lifecycle & Network Binding');

    const startInfo = await mock.start();
    check(mock.server !== null, 'Requirement A: Mock server starts cleanly');
    check(startInfo.port > 0 && typeof startInfo.port === 'number', 'Requirement C: Dynamic ephemeral port assigned by OS');
    check(mock.server.address().address === '127.0.0.1', 'Requirement B: Mock server binds STRICTLY to 127.0.0.1 (localhost-only)');
    check(startInfo.baseUrl === `http://127.0.0.1:${startInfo.port}`, 'Requirement B/C: Base URL dynamically constructed from local binding');

    // Test clean shutdown and restart
    await mock.stop();
    check(mock.server === null, 'Requirement A: Mock server stops cleanly without socket leaks');
    const restarted = await mock.start();
    check(restarted.port > 0, 'Requirement A: Mock server restarts cleanly on new ephemeral port');

    // ============================================================
    // D, E, F: PROVIDER OPT-IN & GATE ENFORCEMENT
    // ============================================================
    console.log('\n[REQUIREMENTS D, E, F] Provider Explicit Opt-In & Gates');

    const defaultProvider = createSharedCoreProvider();
    check(defaultProvider.getCapabilities().providerMode === 'local', 'Requirement D: Provider factory defaults to local mode');
    check(defaultProvider.getCapabilities().remote === false, 'Requirement D: Default provider remote flag is false');

    const remoteGated = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: restarted.baseUrl,
      remoteReadsEnabled: false,
      remoteMutationsEnabled: false
    });

    check(remoteGated.getCapabilities().providerMode === 'remote', 'Requirement D: RemoteSharedCoreProvider opt-in creates remote mode');
    check(remoteGated.getCapabilities().remote === true, 'Requirement D: Remote provider remote flag is true');

    // Read Gate (Requirement E)
    const gatedRead = await remoteGated.getCurrentMember();
    check(gatedRead.success === false, 'Requirement E: Remote read fails closed when remoteReadsEnabled is false');
    check(gatedRead.error === SHARED_CORE_ERRORS.READS_DISABLED, 'Requirement E: Error code is SHARED_CORE_READS_DISABLED');
    check(mock.getRecordedRequests().length === 0, 'Requirement E: Zero HTTP traffic generated when read gate is active');

    // Mutation Gate (Requirement F)
    const gatedMutation = await remoteGated.awardLifePoints({ amount: 10, idempotencyKey: 'gate_test_01' });
    check(gatedMutation.success === false, 'Requirement F: Remote mutation fails closed when remoteMutationsEnabled is false');
    check(gatedMutation.error === SHARED_CORE_ERRORS.MUTATIONS_DISABLED, 'Requirement F: Error code is SHARED_CORE_MUTATIONS_DISABLED');
    check(mock.getRecordedRequests().length === 0, 'Requirement F: Zero HTTP traffic generated when mutation gate is active');

    // ============================================================
    // CORRECTION 1: REMOTE RESET MUST NEVER EXIST & LOCAL RESET PRESERVED
    // ============================================================
    console.log('\n[CORRECTION 1] Remote Reset Must Never Exist & Local Reset Preservation');

    // 1. Local resetToBaseline still works for prototype/local testing
    const testLocal = new LocalSharedCoreProvider();
    const initialLocalBalance = testLocal.getLifePoints().balance;
    testLocal.awardLifePoints({ amount: 250, idempotencyKey: 'local_pre_reset_01' });
    const localPreBalance = testLocal.getLifePoints().balance;
    check(localPreBalance === initialLocalBalance + 250, `Correction 1: Local provider balance increased by 250 before reset (${localPreBalance})`);
    const localResetRes = testLocal.resetToBaseline();
    check(localResetRes.success === true, 'Correction 1: Local resetToBaseline() still works for prototype testing');
    check(testLocal.getLifePoints().balance === initialLocalBalance, `Correction 1: Local resetToBaseline() successfully resets state to baseline (${initialLocalBalance} LP)`);

    // 2. Remote resetToBaseline performs zero HTTP traffic
    const reqCountBeforeRemoteReset = mock.getRecordedRequests().length;
    const remoteResetSync = remoteGated.resetToBaseline();
    check(mock.getRecordedRequests().length === reqCountBeforeRemoteReset, 'Correction 1: Remote resetToBaseline() performs ZERO HTTP requests');

    // 3. Remote resetToBaseline returns SHARED_CORE_OPERATION_UNSUPPORTED
    check(remoteResetSync.success === false, 'Correction 1: Remote resetToBaseline() fails closed immediately');
    check(remoteResetSync.error === SHARED_CORE_ERRORS.OPERATION_UNSUPPORTED, 'Correction 1: Remote reset error is SHARED_CORE_OPERATION_UNSUPPORTED');
    check(remoteResetSync.code === 'SHARED_CORE_OPERATION_UNSUPPORTED', 'Correction 1: Remote reset code is SHARED_CORE_OPERATION_UNSUPPORTED');
    check(remoteResetSync.message === 'resetToBaseline is available only for the local prototype provider.', 'Correction 1: Message explains resetToBaseline is local prototype only');

    // Even when mutations enabled on remote provider, resetToBaseline still fails closed with zero HTTP traffic
    const enabledRemoteResetClient = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: restarted.baseUrl,
      remoteMutationsEnabled: true
    });
    const enabledRemoteResetRes = await enabledRemoteResetClient.resetToBaseline();
    check(enabledRemoteResetRes.success === false, 'Correction 1: Remote resetToBaseline() fails closed even when remoteMutationsEnabled is true');
    check(enabledRemoteResetRes.error === SHARED_CORE_ERRORS.OPERATION_UNSUPPORTED, 'Correction 1: Remote reset still returns OPERATION_UNSUPPORTED with mutations enabled');
    check(mock.getRecordedRequests().length === reqCountBeforeRemoteReset, 'Correction 1: Zero HTTP requests dispatched even when remoteMutationsEnabled is true');

    // 4. Mock server has no /api/v1/shared/member/reset route
    const resetProbeClient = new SharedCoreHttpClient({
      remoteMutationsEnabled: true,
      baseUrl: restarted.baseUrl
    });
    const probeRes = await resetProbeClient.request('POST', '/api/v1/shared/member/reset', {}, { idempotencyKey: 'reset_probe_01' });
    check(probeRes.success === false, 'Correction 1: /api/v1/shared/member/reset is NOT a route on mock server');
    check(probeRes.code === SHARED_CORE_ERRORS.NOT_FOUND, 'Correction 1: Request to /api/v1/shared/member/reset returns 404 NOT_FOUND');

    // 5. Frozen endpoint matrix and contract documentation contain no remote reset endpoint
    const contractDocPath = path.join(__dirname, '..', '..', 'docs', 'koinonia-quest', 'KOINONIA_PHASE23C_REMOTE_SHARED_CORE_CONTRACT.md');
    const contractDocContent = fs.readFileSync(contractDocPath, 'utf8');
    check(!contractDocContent.includes('/api/v1/shared/member/reset'), 'Correction 1: Frozen contract doc contains NO /api/v1/shared/member/reset endpoint');
    check(!contractDocContent.includes('X-Koinonia-Phase'), 'Correction 2: Frozen contract doc contains NO X-Koinonia-Phase header');

    // ============================================================
    // G, I, J, K: REAL HTTP READ CONTRACT
    // ============================================================
    console.log('\n[REQUIREMENTS G, I, J, K] Real HTTP Read Contract');

    mock.reset();
    const readClient = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: restarted.baseUrl,
      remoteReadsEnabled: true,
      remoteMutationsEnabled: false
    });

    // 1. getCurrentMember()
    const memberRes = await readClient.getCurrentMember();
    check(memberRes.success === true, 'Requirement G: getCurrentMember() over real HTTP succeeds');
    check(memberRes.member && memberRes.member.name === 'Alex Rivera', 'Requirement G: Decoded member data matches mock state');

    // 2. getLifePoints()
    const pointsRes = await readClient.getLifePoints();
    check(pointsRes.success === true, 'Requirement G: getLifePoints() over real HTTP succeeds');
    check(pointsRes.lifePoints === 120, 'Requirement G: Decoded Life Points balance matches mock state');

    // 3. getEvents()
    const eventsRes = await readClient.getEvents();
    check(eventsRes.success === true, 'Requirement G: getEvents() over real HTTP succeeds');
    check(Array.isArray(eventsRes.events) && eventsRes.events.length >= 2, 'Requirement G: Decoded events list returned');

    // 4. getMyCampfires()
    const campfiresRes = await readClient.getMyCampfires();
    check(campfiresRes.success === true, 'Requirement G: getMyCampfires() over real HTTP succeeds');
    check(Array.isArray(campfiresRes.campfires) && campfiresRes.campfires.length >= 1, 'Requirement G: Decoded campfires returned');

    // 5. getMinistries()
    const minRes = await readClient.getMinistries();
    check(minRes.success === true, 'Requirement G: getMinistries() over real HTTP succeeds');
    check(Array.isArray(minRes.ministries) && minRes.ministries.length >= 1, 'Requirement G: Decoded ministries returned');

    // 6. getMilestones()
    const mlsRes = await readClient.getMilestones();
    check(mlsRes.success === true, 'Requirement G: getMilestones() over real HTTP succeeds');
    check(Array.isArray(mlsRes.milestones), 'Requirement G: Decoded milestones returned');

    // 7. getQuests()
    const questRes = await readClient.getQuests();
    check(questRes.success === true, 'Requirement G: getQuests() over real HTTP succeeds');
    check(Array.isArray(questRes.quests) && questRes.quests.length >= 2, 'Requirement G: Decoded quests returned');

    // Verify Recorded HTTP Request Properties (Requirements I, J, K)
    const recordedReads = mock.getRecordedRequests();
    check(recordedReads.length === 7, 'Requirement G: Exactly 7 HTTP requests received by mock server');
    for (const req of recordedReads) {
      check(req.method === 'GET', `Requirement J: Read method is GET (${req.pathname})`);
      check(req.pathname.startsWith('/api/v1/shared/'), `Requirement I: Request path starts with /api/v1/shared/ (${req.pathname})`);
      check(req.headers['accept'] === 'application/json', `Requirement K: Request header includes Accept: application/json (${req.pathname})`);
      check(!req.headers['x-koinonia-phase'], `Correction 2: Request DOES NOT contain internal header X-Koinonia-Phase (${req.pathname})`);
      check(!req.rawBody || req.rawBody === '', `Requirement G: GET request does not transmit a request body (${req.pathname})`);
    }

    // ============================================================
    // H, I, J, K, M: REAL HTTP MUTATION CONTRACT
    // ============================================================
    console.log('\n[REQUIREMENTS H, I, J, K, M] Real HTTP Mutation Contract');

    mock.reset();
    const mutationClient = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: restarted.baseUrl,
      remoteReadsEnabled: true,
      remoteMutationsEnabled: true
    });

    // 1. awardLifePoints()
    const awardRes = await mutationClient.awardLifePoints({
      amount: 40,
      charXp: 20,
      idempotencyKey: 'idem_award_01'
    });
    check(awardRes.success === true, 'Requirement H: awardLifePoints() over real HTTP succeeds');
    check(awardRes.awarded === 40, 'Requirement H: awardLifePoints() returns awarded amount');
    check(awardRes.balance === 160, 'Requirement H: awardLifePoints() returns updated balance (120+40=160)');

    // 2. checkIn()
    const checkinRes = await mutationClient.checkIn({
      eventInstanceId: 'EVT-001',
      idempotencyKey: 'idem_checkin_01'
    });
    check(checkinRes.success === true, 'Requirement H: checkIn() over real HTTP succeeds');
    check(checkinRes.status === 'checked_in', 'Requirement H: checkIn() returns checked_in status');

    // 3. completeQuest()
    const questCompRes = await mutationClient.completeQuest({
      questId: 'Q-001',
      idempotencyKey: 'idem_quest_01'
    });
    check(questCompRes.success === true, 'Requirement H: completeQuest() over real HTTP succeeds');
    check(questCompRes.completed === true, 'Requirement H: completeQuest() returns completed: true');

    // 4. setCampfireCapacity()
    const capRes = await mutationClient.setCampfireCapacity('CF-001', 18, 'LEADER');
    check(capRes.success === true, 'Requirement H: setCampfireCapacity() over real HTTP succeeds');

    // 5. addReactionToCampfire()
    const reactRes = await mutationClient.addReactionToCampfire('CF-001', '🔥');
    check(reactRes.success === true, 'Requirement H: addReactionToCampfire() over real HTTP succeeds');

    // 6. emitActivityEvent()
    const actRes = await mutationClient.emitActivityEvent({
      eventType: 'FELLOWSHIP_JOIN',
      idempotencyKey: 'idem_act_01'
    });
    check(actRes.success === true, 'Requirement H: emitActivityEvent() over real HTTP succeeds');

    // Verify Recorded Mutation Request Properties (Requirements I, J, K, M)
    const recordedMutations = mock.getRecordedRequests();
    check(recordedMutations.length === 6, 'Requirement H: Exactly 6 HTTP mutations recorded by mock');
    for (const req of recordedMutations) {
      check(req.method === 'POST', `Requirement J: Mutation method is POST (${req.pathname})`);
      check(req.pathname.startsWith('/api/v1/shared/'), `Requirement I: Path is canonical /api/v1/shared/* (${req.pathname})`);
      check(req.headers['accept'] === 'application/json', `Requirement K: Request has Accept: application/json (${req.pathname})`);
      check(req.headers['content-type'] === 'application/json', `Requirement K: Request has Content-Type: application/json (${req.pathname})`);
      check(!req.headers['x-koinonia-phase'], `Correction 2: Request DOES NOT contain internal header X-Koinonia-Phase (${req.pathname})`);
      check(Boolean(req.headers['idempotency-key']), `Requirement M: Request contains canonical Idempotency-Key header (${req.pathname})`);
    }

    // ============================================================
    // L: CREDENTIALS & EXTENSION POINTS
    // ============================================================
    console.log('\n[REQUIREMENT L] Credentials & Header Extension Points');

    const credClient = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: restarted.baseUrl,
      remoteReadsEnabled: true,
      credentials: 'include',
      authHeader: 'Bearer mock_token_for_contract_test',
      csrfToken: 'mock_csrf_token_test'
    });

    mock.reset();
    await credClient.getCurrentMember();
    const credReq = mock.getRecordedRequests()[0];
    check(credClient.options.credentials === 'include', 'Requirement L: Configurable credentials option preserved');
    check(credReq.headers['authorization'] === 'Bearer mock_token_for_contract_test', 'Requirement L: Auth extension header dispatched');
    check(credReq.headers['x-csrf-token'] === 'mock_csrf_token_test', 'Requirement L: CSRF extension header dispatched');

    // ============================================================
    // N, O: IDEMPOTENCY REPLAY & NO DUPLICATE LP AWARD
    // ============================================================
    console.log('\n[REQUIREMENTS N, O] Idempotency Replay & No Duplicate LP Award');

    mock.reset();
    const idemKey = 'award_replay_unique_key_999';

    // First award
    const firstAward = await mutationClient.awardLifePoints({
      amount: 50,
      idempotencyKey: idemKey
    });
    check(firstAward.success === true, 'Requirement N: First award with idempotency key succeeds');
    check(firstAward.replayed === false, 'Requirement N: First award is marked replayed: false');
    check(firstAward.awarded === 50, 'Requirement O: First award yields +50 Life Points');
    const balanceAfterFirst = firstAward.balance;

    // Second award with EXACT SAME key (replay)
    const secondAward = await mutationClient.awardLifePoints({
      amount: 50,
      idempotencyKey: idemKey
    });
    check(secondAward.success === true, 'Requirement N: Replayed award request succeeds deterministically');
    check(secondAward.replayed === true, 'Requirement N: Second request marked replayed: true');
    check(secondAward.awarded === 0, 'Requirement O: Zero additional Life Points awarded on replay (awarded: 0)');
    check(secondAward.balance === balanceAfterFirst, 'Requirement O: Balance unchanged after duplicate/replay request');

    const recordedReplays = mock.getRecordedRequests();
    check(recordedReplays.length === 2, 'Requirement N: Exactly 2 HTTP requests made');
    check(recordedReplays[0].idempotencyKey === idemKey, 'Requirement M: First request contains Idempotency-Key');
    check(recordedReplays[1].idempotencyKey === idemKey, 'Requirement M: Replay request contains IDENTICAL Idempotency-Key');

    // ============================================================
    // P: NO AUTOMATIC MUTATION RETRY
    // ============================================================
    console.log('\n[REQUIREMENT P] Zero Automatic Mutation Retry');

    mock.reset();
    mock.setRouteFault('/api/v1/shared/points/award', {
      status: 500,
      body: { error: 'INTERNAL_ERROR', message: 'Simulated database failure' }
    });

    const failedMutation = await mutationClient.awardLifePoints({
      amount: 100,
      idempotencyKey: 'retry_test_key_001'
    });
    check(failedMutation.success === false, 'Requirement P: Failed mutation returns success: false');
    check(failedMutation.code === SHARED_CORE_ERRORS.SERVER_ERROR, 'Requirement P: Error mapped to SERVER_ERROR');
    check(mock.getRecordedRequests().length === 1, 'Requirement P: Exactly 1 HTTP attempt made — ZERO automatic silent retries');

    mock.clearFaults();

    // ============================================================
    // Q, R, S, T, U, V, W: HTTP STATUS CODE MAPPING
    // ============================================================
    console.log('\n[REQUIREMENTS Q-W] Deterministic HTTP Status Code Mapping');

    // 401 Unauthorized (Requirement Q)
    mock.setNextFault({ status: 401, body: { error: 'UNAUTHORIZED', message: 'Auth required' } });
    const res401 = await readClient.getCurrentMember();
    check(res401.success === false, 'Requirement Q: 401 returns success: false');
    check(res401.code === SHARED_CORE_ERRORS.UNAUTHORIZED, 'Requirement Q: HTTP 401 maps to SHARED_CORE_UNAUTHORIZED');

    // 403 Forbidden (Requirement R)
    mock.setNextFault({ status: 403, body: { error: 'FORBIDDEN', message: 'Access denied' } });
    const res403 = await readClient.getCurrentMember();
    check(res403.success === false, 'Requirement R: 403 returns success: false');
    check(res403.code === SHARED_CORE_ERRORS.FORBIDDEN, 'Requirement R: HTTP 403 maps to SHARED_CORE_FORBIDDEN');

    // 404 Not Found (Requirement S)
    mock.setNextFault({ status: 404, body: { error: 'NOT_FOUND', message: 'Endpoint missing' } });
    const res404 = await readClient.getCurrentMember();
    check(res404.success === false, 'Requirement S: 404 returns success: false');
    check(res404.code === SHARED_CORE_ERRORS.NOT_FOUND, 'Requirement S: HTTP 404 maps to SHARED_CORE_NOT_FOUND');

    // 409 Conflict (Requirement T)
    mock.setNextFault({ status: 409, body: { error: 'CONFLICT', message: 'State conflict' } });
    const res409 = await readClient.getCurrentMember();
    check(res409.success === false, 'Requirement T: 409 returns success: false');
    check(res409.code === SHARED_CORE_ERRORS.CONFLICT, 'Requirement T: HTTP 409 maps to SHARED_CORE_CONFLICT');

    // 422 Validation Error (Requirement U)
    mock.setNextFault({ status: 422, body: { error: 'VALIDATION_ERROR', message: 'Invalid payload' } });
    const res422 = await readClient.getCurrentMember();
    check(res422.success === false, 'Requirement U: 422 returns success: false');
    check(res422.code === SHARED_CORE_ERRORS.VALIDATION_ERROR, 'Requirement U: HTTP 422 maps to SHARED_CORE_VALIDATION_ERROR');

    // 429 Rate Limited (Requirement V)
    mock.setNextFault({ status: 429, body: { error: 'RATE_LIMITED', message: 'Slow down' } });
    const res429 = await readClient.getCurrentMember();
    check(res429.success === false, 'Requirement V: 429 returns success: false');
    check(res429.code === SHARED_CORE_ERRORS.RATE_LIMITED, 'Requirement V: HTTP 429 maps to SHARED_CORE_RATE_LIMITED');

    // 500 Server Error (Requirement W)
    mock.setNextFault({ status: 500, body: { error: 'SERVER_ERROR', message: 'Internal crash' } });
    const res500 = await readClient.getCurrentMember();
    check(res500.success === false, 'Requirement W: 500 returns success: false');
    check(res500.code === SHARED_CORE_ERRORS.SERVER_ERROR, 'Requirement W: HTTP 500 maps to SHARED_CORE_SERVER_ERROR');

    // ============================================================
    // X: MALFORMED JSON RESPONSE
    // ============================================================
    console.log('\n[REQUIREMENT X] Malformed JSON Handling');

    // SyntaxError malformed JSON
    mock.setNextFault({ status: 200, malformedJson: true });
    const malformedRes = await readClient.getCurrentMember();
    check(malformedRes.success === false, 'Requirement X: Malformed JSON returns success: false');
    check(malformedRes.code === SHARED_CORE_ERRORS.MALFORMED_RESPONSE, 'Requirement X: Malformed JSON maps to SHARED_CORE_MALFORMED_RESPONSE');

    // Non-JSON Content-Type
    mock.setNextFault({ status: 200, nonJson: true, body: '<html><body>502 Bad Gateway</body></html>' });
    const nonJsonRes = await readClient.getCurrentMember();
    check(nonJsonRes.success === false, 'Requirement X: Non-JSON body returns success: false');
    check(nonJsonRes.code === SHARED_CORE_ERRORS.MALFORMED_RESPONSE, 'Requirement X: Non-JSON Content-Type maps to SHARED_CORE_MALFORMED_RESPONSE');

    // ============================================================
    // Y: REQUEST TIMEOUT BEHAVIOR
    // ============================================================
    console.log('\n[REQUIREMENT Y] Request Timeout Behavior');

    const timeoutClient = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: restarted.baseUrl,
      remoteReadsEnabled: true,
      timeoutMs: 150 // Very tight timeout
    });

    mock.setNextFault({ delayMs: 400 });
    const timeoutRes = await timeoutClient.getCurrentMember();
    check(timeoutRes.success === false, 'Requirement Y: Timed-out request returns success: false');
    check(timeoutRes.code === SHARED_CORE_ERRORS.TIMEOUT, 'Requirement Y: Timeout maps to SHARED_CORE_TIMEOUT');

    // ============================================================
    // Z: CONNECTION / NETWORK FAILURE
    // ============================================================
    console.log('\n[REQUIREMENT Z] Connection / Network Failure');

    // Point to a closed port on 127.0.0.1
    const closedPortClient = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: 'http://127.0.0.1:49991',
      remoteReadsEnabled: true,
      timeoutMs: 1000
    });

    const netFailRes = await closedPortClient.getCurrentMember();
    check(netFailRes.success === false, 'Requirement Z: Connection refusal returns success: false');
    check(netFailRes.code === SHARED_CORE_ERRORS.NETWORK_ERROR, 'Requirement Z: Network error maps to SHARED_CORE_NETWORK_ERROR');

    // ============================================================
    // AA: NO-SPLIT-BRAIN (ZERO LOCAL FALLBACK)
    // ============================================================
    console.log('\n[REQUIREMENT AA] No-Split-Brain Invariant (Zero Local Fallback)');

    const localBaseline = new LocalSharedCoreProvider();
    localBaseline.resetToBaseline();
    const baselineBalance = localBaseline.getLifePoints().balance;

    // Fail a remote mutation
    mock.setNextFault({ status: 500, body: { error: 'DB_DOWN' } });
    const failedRemoteAward = await mutationClient.awardLifePoints({
      amount: 1000,
      idempotencyKey: 'split_brain_check_01'
    });
    check(failedRemoteAward.success === false, 'Requirement AA: Remote mutation failed as expected');
    check(localBaseline.getLifePoints().balance === baselineBalance, 'Requirement AA: Local LP balance untouched — NO silent local fallback');
    check(localBaseline.getQuestCompletion('Q-001') === null, 'Requirement AA: Local quest completion untouched — NO split brain');

    // ============================================================
    // AB, AC, AD: STRICT ROUTE SECURITY & GATING
    // ============================================================
    console.log('\n[REQUIREMENTS AB, AC, AD] Route Security, Traversal & URL Injection Gating');

    const httpClient = new SharedCoreHttpClient({
      remoteReadsEnabled: true,
      remoteMutationsEnabled: true,
      baseUrl: restarted.baseUrl
    });

    // Requirement AB: Raw route rejection
    const rawRoutes = [
      '/api/checkin',
      '/api/games/universal-submit',
      '/api/growth-games/memory',
      '/api/growth-games/quiz',
      '/api/youth/attendance',
      '/api/admin/users',
      '/api/ministries/legacy',
      '/api/small-groups/join',
      '/auth/google',
      '/auth/session'
    ];

    for (const raw of rawRoutes) {
      check(httpClient.isValidSharedCoreEndpoint(raw) === false, `Requirement AB: Strictly rejects raw route ${raw}`);
      const res = await httpClient.request('POST', raw, {}, { idempotencyKey: 'sec_test' });
      check(res.success === false && res.code === SHARED_CORE_ERRORS.INVALID_ROUTE, `Requirement AB: Request to ${raw} rejected with SHARED_CORE_INVALID_ROUTE before network`);
    }

    // Requirement AC: Path traversal rejection
    const traversalRoutes = [
      '../api/checkin',
      '/api/v1/shared/../../api/checkin',
      '/api/v1/shared/..',
      '/api/v1/shared/points/../admin',
      '/api/v1/shared/%2e%2e/checkin',
      '/api/v1/shared/quests/../../auth/session'
    ];

    for (const trav of traversalRoutes) {
      check(httpClient.isValidSharedCoreEndpoint(trav) === false, `Requirement AC: Strictly rejects path traversal ${trav}`);
      const res = await httpClient.request('GET', trav);
      check(res.success === false && res.code === SHARED_CORE_ERRORS.INVALID_ROUTE, `Requirement AC: Request to ${trav} rejected with SHARED_CORE_INVALID_ROUTE`);
    }

    // Requirement AD: Absolute URL injection rejection
    const injectedUrls = [
      '//evil.example/path',
      '\\\\evil.example\\path',
      'https://evil.example/api/v1/shared/me',
      'http://127.0.0.1/api/v1/shared/me',
      'ftp://evil.example/file',
      'javascript:alert(1)'
    ];

    for (const url of injectedUrls) {
      check(httpClient.isValidSharedCoreEndpoint(url) === false, `Requirement AD: Strictly rejects absolute/injected URL ${url}`);
      const res = await httpClient.request('GET', url);
      check(res.success === false && res.code === SHARED_CORE_ERRORS.INVALID_ROUTE, `Requirement AD: Request to ${url} rejected with SHARED_CORE_INVALID_ROUTE`);
    }

    // ============================================================
    // AE, AF: OUTBOUND NETWORK SAFETY & ZERO DB DEPENDENCIES
    // ============================================================
    console.log('\n[REQUIREMENTS AE, AF] Zero DB & Outbound Network Safety');

    const filesToScan = [
      path.join(__dirname, 'data', 'remote_shared_core.js'),
      path.join(__dirname, 'data', 'shared_core_provider.js'),
      path.join(__dirname, 'test_support', 'mock_shared_core_server.js')
    ];

    for (const file of filesToScan) {
      const content = fs.readFileSync(file, 'utf8');
      const relName = path.relative(__dirname, file);

      check(!content.includes("require('sqlite3')"), `Requirement AE: ${relName} does not import sqlite3`);
      check(!content.includes("require('better-sqlite3')"), `Requirement AE: ${relName} does not import better-sqlite3`);
      check(!content.includes('staging.fogmin.site'), `Requirement AF: ${relName} does not contain staging.fogmin.site`);
      check(!content.includes('checkin.fogmin.site'), `Requirement AF: ${relName} does not contain checkin.fogmin.site`);
      check(!content.includes('192.168.1.'), `Requirement AF: ${relName} does not contain staging LAN IP (192.168.1.*)`);
    }

    // Verify staging DB SHA256 remains bit-for-bit unchanged
    const crypto = require('crypto');
    const stagingDbPath = '/home/raspi4/fog-portal-staging/fog_community.db';
    if (fs.existsSync(stagingDbPath)) {
      const dbBuf = fs.readFileSync(stagingDbPath);
      const dbSha = crypto.createHash('sha256').update(dbBuf).digest('hex');
      check(dbSha === 'f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12', 'Requirement AE: Staging database bit-for-bit identical (SHA: f545bd91...)');
    }

    // ============================================================
    // AG: FULL PROVIDER CONTRACT INTACT (30 METHODS)
    // ============================================================
    console.log('\n[REQUIREMENT AG] Full Provider Contract Intact (30 Methods)');

    const fullMethods = [
      // 1. Baseline
      'resetToBaseline',
      // 2. Member
      'getCurrentMember',
      // 3. Life Points
      'getLifePoints', 'awardLifePoints',
      // 4. Quests
      'getQuests', 'getQuest', 'getQuestCompletion', 'completeQuest',
      // 5. Events & Attendance
      'getEvents', 'getEvent', 'getAttendance', 'getAllAttendanceRecords', 'checkIn',
      // 6. Campfires
      'getMyCampfires', 'getCampfire', 'getCampfireMembers', 'getCampfireLeaders',
      'getCampfireGameState', 'getCampfireSettings', 'setCommunityMaxParticipants',
      'setCampfireCapacity', 'addReactionToCampfire',
      // 7. Ministries
      'getMinistries', 'getMyMinistries', 'getMinistryMissions', 'getMyMinistryMissions',
      // 8. Milestones & Growth
      'getMilestones', 'getGrowthProgress',
      // 9. Activity Event Bus
      'emitActivityEvent', 'getActivityEvents'
    ];

    check(fullMethods.length === 30, 'Requirement AG: Exactly 30 methods in canonical public provider contract');

    const providerInstance = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      baseUrl: restarted.baseUrl,
      remoteReadsEnabled: false,
      remoteMutationsEnabled: false
    });

    for (const method of fullMethods) {
      check(typeof providerInstance[method] === 'function', `Requirement AG: RemoteSharedCoreProvider implements ${method}()`);
      // Calling each when disabled must return fail-closed with dual sync/async properties
      const result = providerInstance[method]('test_param', 'extra_param');
      check(typeof result.then === 'function', `Requirement AG: ${method}() returns Promise / thenable`);
      check(result.success === false, `Requirement AG: ${method}() fails closed synchronously when disabled`);
      check(typeof result.error === 'string', `Requirement AG: ${method}() provides structured error code`);
    }

    console.log('\n================================================================');
    console.log(`TOTAL PHASE 0.23C CONTRACT TESTS: ${passed} | PASSED: ${passed} | FAILED: 0`);
    console.log('================================================================');

  } finally {
    await mock.stop();
  }
}

runContractTests().catch((err) => {
  console.error('\n❌ Contract test failed with unhandled exception:');
  console.error(err);
  process.exit(1);
});
