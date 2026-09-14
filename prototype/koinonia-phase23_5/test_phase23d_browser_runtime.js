/**
 * KOINONIA — PHASE 0.23D
 * BROWSER RUNTIME SHARED CORE INTEGRATION & DEVELOPMENT HARNESS TEST SUITE
 *
 * Requirements Verified:
 * A. Phase 0.23D unique cache identity (koinonia-v0.23d-r1)
 * B. Phase 0.23D runtime config defaults to local
 * C. browser query parameter alone cannot activate remote mock
 * D. mock mode requires server environment configuration
 * E. mock mode rejected under NODE_ENV=production
 * F. remote mutations remain false
 * G. remote reads become true only in mock mode
 * H. same-origin /api/v1/shared/* proxy works
 * I. proxy rejects raw legacy routes
 * J. proxy rejects traversal
 * K. proxy cannot proxy arbitrary URLs
 * L. mock remains localhost-only (127.0.0.1)
 * M. mock uses ephemeral port
 * N. mock uses no database
 * O. getCurrentMember through real HTTP proxy
 * P. getLifePoints through real HTTP proxy
 * Q. getQuests through real HTTP proxy
 * R. getEvents through real HTTP proxy
 * S. getMyCampfires through real HTTP proxy
 * T. getMinistries through real HTTP proxy
 * U. getMilestones through real HTTP proxy
 * V. getGrowthProgress through real HTTP proxy
 * W. development diagnostics expose no secrets
 * X. mock development badge only appears in mock mode
 * Y. local/default mode does not display development badge
 * Z. remote failure does not switch providers
 * AA. remote failure does not award local LP
 * AB. remote failure does not complete local Quest
 * AC. remote failure does not create local attendance
 * AD. remote writes remain disabled
 * AE. service worker bypasses Shared Core API
 * AF. service worker bypasses runtime config
 * AG. health/config contains no secrets/paths
 * AH. public beta PM2 path remains Phase 0.22.1
 * AI. staging DB SHA remains unchanged
 * AJ. no Main App hostname/path/database dependency
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

const { createBetaServer } = require('./server.js');
const {
  createSharedCoreProvider,
  getSharedCoreProvider,
  setSharedCoreProvider,
  resetSharedCoreProvider,
  SharedCoreAsyncController,
  SHARED_CORE_ERRORS,
  resolveRuntimeConfig
} = require('./data/shared_core_provider.js');
const { RemoteSharedCoreProvider } = require('./data/remote_shared_core.js');
const { LocalSharedCoreProvider } = require('./data/shared_core.js');
const BetaIdentityProvider = require('./data/beta_identity.js');

// Helper to make an HTTP request to a test server
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runPhase23DTests() {
  console.log('================================================================');
  console.log('KOINONIA PHASE 0.23D — BROWSER RUNTIME SHARED CORE HARNESS TESTS');
  console.log('================================================================');

  let passed = 0;
  function check(condition, message) {
    assert(condition, message);
    passed++;
    console.log(`  ✓ [${passed}] ${message}`);
  }

  // ============================================================
  // GROUP 1: PWA CACHE IDENTITY & SERVICE WORKER BYPASS (A, AE, AF)
  // ============================================================
  console.log('\n[GROUP 1] PWA Cache Identity & Service Worker Scope (A, AE, AF)');

  const swContent = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  // A: Unique cache identity
  check(swContent.includes('koinonia-v0.23d-r1'), 'Requirement A: sw.js defines cache identity koinonia-v0.23d-r1');
  check(!swContent.includes('koinonia-v0.22.1-r5'), 'Requirement A: sw.js does not retain inherited Phase 0.22.1 cache name');
  check(indexHtml.includes('styles.css?v=0.23d-r1'), 'Requirement A: index.html references styles.css?v=0.23d-r1');
  check(indexHtml.includes('game.js?v=0.23d-r1'), 'Requirement A: index.html references game.js?v=0.23d-r1');
  check(indexHtml.includes('data/shared_core_provider.js?v=0.23d-r1'), 'Requirement A: index.html references shared_core_provider.js?v=0.23d-r1');

  // AE: Service worker bypasses Shared Core API
  check(swContent.includes('url.pathname.startsWith("/api/v1/shared/")') || swContent.includes('url.pathname.startsWith("/api/")'),
    'Requirement AE: sw.js fetch handler strictly bypasses Shared Core /api/v1/shared/* endpoints');

  // AF: Service worker bypasses runtime-config.js, health, and realtime
  check(swContent.includes('url.pathname === "/runtime-config.js"'), 'Requirement AF: sw.js fetch handler strictly bypasses /runtime-config.js');
  check(swContent.includes('url.pathname === "/health"'), 'Requirement AF: sw.js fetch handler bypasses /health');
  check(swContent.includes('url.pathname === "/realtime"'), 'Requirement AF: sw.js fetch handler bypasses /realtime');

  // ============================================================
  // GROUP 2: RUNTIME CONFIGURATION & SERVER SAFETY GATES (B, C, D, E, F, G, AG)
  // ============================================================
  console.log('\n[GROUP 2] Runtime Configuration & Server Safety Gates (B, C, D, E, F, G, AG)');

  // Test server in default mode (no mock)
  const defaultServer = createBetaServer({ port: 0, host: '127.0.0.1', devSharedCore: false });
  await defaultServer.start();
  const defaultPort = defaultServer.httpServer.address().port;

  try {
    // B: Runtime config defaults to local
    const cfgRes1 = await makeRequest({
      hostname: '127.0.0.1',
      port: defaultPort,
      path: '/runtime-config.js',
      method: 'GET'
    });
    check(cfgRes1.statusCode === 200, 'Requirement B: GET /runtime-config.js returns HTTP 200 in default mode');
    check(cfgRes1.body.includes('"sharedCoreMode": "local"'), 'Requirement B: Default sharedCoreMode is "local"');
    check(cfgRes1.body.includes('"remoteReadsEnabled": false'), 'Requirement B: Default remoteReadsEnabled is false');
    check(cfgRes1.body.includes('"remoteMutationsEnabled": false'), 'Requirement B: Default remoteMutationsEnabled is false');

    // C: Query parameters alone cannot activate mock mode
    const cfgResWithQuery = await makeRequest({
      hostname: '127.0.0.1',
      port: defaultPort,
      path: '/runtime-config.js?sharedCoreMode=mock&remote=true&enable=1',
      method: 'GET'
    });
    check(cfgResWithQuery.body.includes('"sharedCoreMode": "local"'), 'Requirement C: Query parameter ?sharedCoreMode=mock CANNOT activate remote mock');
    check(cfgResWithQuery.body.includes('"remoteReadsEnabled": false'), 'Requirement C: Query parameter cannot enable remote reads');

    // Default server proxy rejects /api/v1/shared/* when mock mode is disabled
    const blockedProxyRes = await makeRequest({
      hostname: '127.0.0.1',
      port: defaultPort,
      path: '/api/v1/shared/me',
      method: 'GET'
    });
    check(blockedProxyRes.statusCode === 404, 'Requirement H: Default server returns 404 on /api/v1/shared/* when mock mode disabled');
  } finally {
    await new Promise(resolve => defaultServer.close(resolve));
  }

  // E: Mock mode rejected under production
  const prodServer = createBetaServer({ port: 0, host: '127.0.0.1', devSharedCore: 'mock', isProduction: true });
  await prodServer.start();
  const prodPort = prodServer.httpServer.address().port;

  try {
    const prodCfgRes = await makeRequest({
      hostname: '127.0.0.1',
      port: prodPort,
      path: '/runtime-config.js',
      method: 'GET'
    });
    check(prodCfgRes.body.includes('"sharedCoreMode": "local"'), 'Requirement E: mock mode strictly rejected when isProduction is true');
    check(prodCfgRes.body.includes('"remoteReadsEnabled": false'), 'Requirement E: remote reads remain false in production');
  } finally {
    await new Promise(resolve => prodServer.close(resolve));
  }

  // Test server in mock dev mode (KOINONIA_DEV_SHARED_CORE=mock)
  const devMockServer = createBetaServer({ port: 0, host: '127.0.0.1', devSharedCore: 'mock', isProduction: false });
  await devMockServer.start();
  const devPort = devMockServer.httpServer.address().port;

  try {
    // D & G: Mock mode enabled through server configuration
    const devCfgRes = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/runtime-config.js',
      method: 'GET'
    });
    check(devCfgRes.body.includes('"sharedCoreMode": "mock"'), 'Requirement D: sharedCoreMode is "mock" when server-configured');
    check(devCfgRes.body.includes('"remoteReadsEnabled": true'), 'Requirement G: remoteReadsEnabled becomes true in mock mode');

    // F: Remote mutations remain false
    check(devCfgRes.body.includes('"remoteMutationsEnabled": false'), 'Requirement F: remoteMutationsEnabled remains strictly false in mock mode');

    // AG: Health and config contain no secrets or internal paths
    const healthRes = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/health',
      method: 'GET'
    });
    check(healthRes.statusCode === 200, 'Requirement AG: GET /health returns 200');
    check(healthRes.json.phase === '0.23D', 'Requirement AG: Health reports phase 0.23D');
    check(healthRes.json.sharedCoreMode === 'mock-readonly', 'Requirement AG: Health reports sharedCoreMode mock-readonly');
    check(!healthRes.body.includes('/home/raspi4'), 'Requirement AG: Health output contains zero filesystem paths');
    check(!healthRes.body.includes('password') && !healthRes.body.includes('secret') && !healthRes.body.includes('token'),
      'Requirement AG: Health output contains zero secrets, passwords, or tokens');
    check(!devCfgRes.body.includes('/home/raspi4'), 'Requirement AG: Runtime config contains zero filesystem paths');
    check(!devCfgRes.body.includes('secret') && !devCfgRes.body.includes('token'), 'Requirement AG: Runtime config contains zero secrets');

    // ============================================================
    // GROUP 3: SERVER PROXY ARCHITECTURE & SECURITY GATES (H, I, J, K, L, M, N)
    // ============================================================
    console.log('\n[GROUP 3] Server Proxy Architecture & Security Gates (H, I, J, K, L, M, N)');

    // L & M: Mock server binds to 127.0.0.1 and ephemeral port
    check(devMockServer.mockServer !== null, 'Requirement L: Internal mock server initialized');
    check(devMockServer.mockServer.port > 0, 'Requirement M: Internal mock server uses OS-assigned ephemeral port > 0');
    check(devMockServer.mockServer.baseUrl.startsWith('http://127.0.0.1:'), 'Requirement L: Mock server binds strictly to 127.0.0.1');

    // N: Mock server uses in-memory data, no database
    const mockFileContent = fs.readFileSync(path.join(__dirname, 'test_support/mock_shared_core_server.js'), 'utf8');
    check(!mockFileContent.includes('sqlite3') && !mockFileContent.includes('better-sqlite3'),
      'Requirement N: Mock server does not import SQLite or better-sqlite3');
    check(!mockFileContent.includes('fog_community.db'), 'Requirement N: Mock server contains zero references to fog_community.db');

    // H: Same-origin /api/v1/shared/* proxy works and forwards to mock
    const proxyMeRes = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/api/v1/shared/me',
      method: 'GET'
    });
    check(proxyMeRes.statusCode === 200, 'Requirement H: Same-origin GET /api/v1/shared/me proxied successfully (HTTP 200)');
    check(proxyMeRes.json && proxyMeRes.json.success === true, 'Requirement H: Proxied response contains success: true');
    check(proxyMeRes.json.member && proxyMeRes.json.member.name === 'Alex Rivera', 'Requirement H: Proxied member name is Alex Rivera');

    // I: Proxy rejects raw legacy routes
    const legacyCheckin = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/api/checkin',
      method: 'POST'
    });
    check(legacyCheckin.statusCode === 404, 'Requirement I: Proxy rejects raw legacy route /api/checkin with 404');

    const legacySubmit = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/api/games/universal-submit',
      method: 'POST'
    });
    check(legacySubmit.statusCode === 404, 'Requirement I: Proxy rejects /api/games/universal-submit with 404');

    const legacyGrowth = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/api/growth-games/quiz',
      method: 'POST'
    });
    check(legacyGrowth.statusCode === 404, 'Requirement I: Proxy rejects /api/growth-games/* with 404');

    // J: Proxy rejects path traversal
    const traversalRes1 = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/api/v1/shared/../../../etc/passwd',
      method: 'GET'
    });
    check(traversalRes1.statusCode === 403 || traversalRes1.statusCode === 404,
      'Requirement J: Proxy rejects path traversal /api/v1/shared/../../../etc/passwd with 403/404');

    const traversalRes2 = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/api/v1/shared/%2e%2e/%2e%2e/secret',
      method: 'GET'
    });
    check(traversalRes2.statusCode === 403 || traversalRes2.statusCode === 400,
      'Requirement J: Proxy rejects encoded traversal %2e%2e with 403/400');

    // K: Proxy cannot proxy arbitrary URLs
    const arbitraryUrlRes = await makeRequest({
      hostname: '127.0.0.1',
      port: devPort,
      path: '/api/v1/shared/https://evil.com/steal',
      method: 'GET'
    });
    check(arbitraryUrlRes.statusCode === 404 || arbitraryUrlRes.statusCode === 400,
      'Requirement K: Proxy rejects arbitrary absolute URLs with 404/400');

    // ============================================================
    // GROUP 4: REAL BROWSER RUNTIME PROXY READS VIA PROVIDER (O, P, Q, R, S, T, U, V)
    // ============================================================
    console.log('\n[GROUP 4] Real Browser Runtime Proxy Reads via Provider Abstraction (O - V)');

    // Create a client RemoteSharedCoreProvider pointing to the same-origin proxy
    const proxyClient = new RemoteSharedCoreProvider({
      providerMode: 'remote',
      remoteReadsEnabled: true,
      remoteMutationsEnabled: false,
      baseUrl: `http://127.0.0.1:${devPort}`
    });

    // O: getCurrentMember()
    const memberRes = await proxyClient.getCurrentMember();
    check(memberRes.success === true, 'Requirement O: getCurrentMember() succeeds via proxy');
    check(memberRes.member && memberRes.member.name === 'Alex Rivera', 'Requirement O: Member name is Alex Rivera');
    check(memberRes.member.role === 'MEMBER', 'Requirement O: Member role is MEMBER');

    // P: getLifePoints()
    const pointsRes = await proxyClient.getLifePoints();
    check(pointsRes.success === true, 'Requirement P: getLifePoints() succeeds via proxy');
    check(typeof pointsRes.balance === 'number' && pointsRes.balance === 120, 'Requirement P: Life Points balance is 120');

    // Q: getQuests()
    const questsRes = await proxyClient.getQuests();
    check(questsRes.success === true, 'Requirement Q: getQuests() succeeds via proxy');
    check(Array.isArray(questsRes.quests) && questsRes.quests.length >= 2, 'Requirement Q: Quests returned as array');

    // R: getEvents()
    const eventsRes = await proxyClient.getEvents();
    check(eventsRes.success === true, 'Requirement R: getEvents() succeeds via proxy');
    check(Array.isArray(eventsRes.events) && eventsRes.events.length >= 2, 'Requirement R: Events returned as array');

    // S: getMyCampfires()
    const campfiresRes = await proxyClient.getMyCampfires();
    check(campfiresRes.success === true, 'Requirement S: getMyCampfires() succeeds via proxy');
    check(Array.isArray(campfiresRes.campfires) && campfiresRes.campfires.length >= 1, 'Requirement S: Campfires returned as array');

    // T: getMinistries()
    const ministriesRes = await proxyClient.getMinistries();
    check(ministriesRes.success === true, 'Requirement T: getMinistries() succeeds via proxy');
    check(Array.isArray(ministriesRes.ministries) && ministriesRes.ministries.length >= 1, 'Requirement T: Ministries returned as array');

    // U: getMilestones()
    const milestonesRes = await proxyClient.getMilestones();
    check(milestonesRes.success === true, 'Requirement U: getMilestones() succeeds via proxy');
    check(Array.isArray(milestonesRes.milestones) && milestonesRes.milestones.length >= 1, 'Requirement U: Milestones returned as array');

    // V: getGrowthProgress()
    const growthRes = await proxyClient.getGrowthProgress();
    const growthData = growthRes.progress || growthRes.growthProgress;
    check(growthData && growthData.level === 2, 'Requirement V: Growth progress level is 2');

    // ============================================================
    // GROUP 5: DEVELOPMENT DIAGNOSTICS & UI BADGE GATING (W, X, Y)
    // ============================================================
    console.log('\n[GROUP 5] Development Diagnostics & UI Badge Gating (W, X, Y)');

    const asyncController = new SharedCoreAsyncController({ provider: proxyClient });
    check(asyncController.status === 'idle', 'Group 5: Async controller initializes in idle state');

    // Sync all representative reads via controller
    const syncResult = await asyncController.syncAllRepresentativeReads();
    check(syncResult.allSuccess === true, 'Group 5: syncAllRepresentativeReads succeeds across all 8 reads');
    check(asyncController.status === 'connected', 'Group 5: Controller status updates to connected');
    check(asyncController.cachedData.member.name === 'Alex Rivera', 'Group 5: Cached member mirror matches Alex Rivera');
    check(asyncController.cachedData.lifePoints.balance === 120, 'Group 5: Cached LP mirror is 120');

    // W: Diagnostics state exposes zero secrets
    const diagState = asyncController.getState();
    const diagStr = JSON.stringify(diagState);
    check(!diagStr.includes('Authorization'), 'Requirement W: Diagnostics state contains zero Authorization headers');
    check(!diagStr.includes('cookie') && !diagStr.includes('Cookie'), 'Requirement W: Diagnostics state contains zero cookies');
    check(!diagStr.includes('token') && !diagStr.includes('Token') && !diagStr.includes('secret'), 'Requirement W: Diagnostics state contains zero tokens or secrets');
    check(!diagStr.includes('/home/raspi4'), 'Requirement W: Diagnostics state contains zero internal filesystem paths');

    // X: Badge and banner in mock mode
    check(indexHtml.includes('id="shared-core-dev-badge"'), 'Requirement X: index.html defines #shared-core-dev-badge');
    check(indexHtml.includes('id="shared-core-dev-banner"'), 'Requirement X: index.html defines #shared-core-dev-banner');
    check(indexHtml.includes('id="shared-core-diagnostics-modal"'), 'Requirement X: index.html defines #shared-core-diagnostics-modal');
    check(indexHtml.includes('SHARED CORE DEV: MOCK • READ ONLY'), 'Requirement X: Badge text indicates MOCK • READ ONLY');

    // Y: Default mode keeps badge hidden
    const gameJsContent = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
    check(gameJsContent.includes('banner.classList.add(\'hidden\')'), 'Requirement Y: game.js hides banner when mock mode is disabled');
    check(gameJsContent.includes('badge.classList.add(\'hidden\')'), 'Requirement Y: game.js hides badge when mock mode is disabled');
    check(gameJsContent.includes('modal.classList.add(\'hidden\')'), 'Requirement Y: game.js hides modal when mock mode is disabled');

    // ============================================================
    // GROUP 6: REMOTE FAILURE & NO-SPLIT-BRAIN INVARIANTS (Z, AA, AB, AC, AD)
    // ============================================================
    console.log('\n[GROUP 6] Remote Failure & No-Split-Brain Invariants (Z, AA, AB, AC, AD)');

    // Inject fault into mock server to simulate failure
    devMockServer.mockServer.setNextFault({ status: 500, message: 'Internal Server Error' });

    // Execute read with injected failure
    const failedRead = await asyncController.executeRead('getLifePoints');
    check(failedRead.success === false, 'Requirement Z: Read fails closed during remote failure');
    check(asyncController.status === 'unavailable', 'Requirement Z: Controller status updates to unavailable');

    // Z: Remote failure does NOT switch provider
    check(asyncController.provider instanceof RemoteSharedCoreProvider,
      'Requirement Z: Provider remains RemoteSharedCoreProvider on failure (no silent switch to Local)');

    // AD: Remote writes remain disabled fail-closed
    const mutationAttempt = await asyncController.executeMutation('awardLifePoints', {
      amount: 5,
      idempotencyKey: 'test:mutation:fail'
    });
    check(mutationAttempt.success === false, 'Requirement AD: Mutation attempt fails closed');
    check(mutationAttempt.error === SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
      'Requirement AD: Error code is SHARED_CORE_MUTATIONS_DISABLED');

    // AA: Remote failure does not award local LP
    const localBefore = new LocalSharedCoreProvider();
    const baselineBalanceBefore = localBefore.getLifePoints().balance;
    check(baselineBalanceBefore === 135, 'Requirement AA: Baseline local LP is 135');

    // Attempting award through remote client
    const remoteAwardRes = await proxyClient.awardLifePoints({
      amount: 50,
      idempotencyKey: 'splitbrain:test:award'
    });
    check(remoteAwardRes.success === false, 'Requirement AA: Remote awardLifePoints returns success: false');

    const baselineBalanceAfter = localBefore.getLifePoints().balance;
    check(baselineBalanceAfter === 135, 'Requirement AA: Local LP balance unchanged at 135 (no split-brain LP award)');

    // AB: Remote failure does not complete local Quest
    const questsBefore = localBefore.getQuests();
    const uncompletedBefore = questsBefore.filter(q => !q.completed).length;

    const remoteQuestRes = await proxyClient.completeQuest('Q-001', {
      idempotencyKey: 'splitbrain:test:quest'
    });
    check(remoteQuestRes.success === false, 'Requirement AB: Remote completeQuest returns success: false');

    const questsAfter = localBefore.getQuests();
    const uncompletedAfter = questsAfter.filter(q => !q.completed).length;
    check(uncompletedBefore === uncompletedAfter, 'Requirement AB: Local Quest completions unchanged (no split-brain Quest completion)');

    // AC: Remote failure does not create local attendance
    const attendanceBefore = localBefore.getAttendance('EVT-001');
    check(attendanceBefore === null || attendanceBefore === false, 'Requirement AC: Local attendance not yet recorded');

    const remoteAttendanceRes = await proxyClient.checkIn('EVT-001', {
      idempotencyKey: 'splitbrain:test:checkin'
    });
    check(remoteAttendanceRes.success === false, 'Requirement AC: Remote checkIn returns success: false');

    const attendanceAfter = localBefore.getAttendance('EVT-001');
    check(attendanceAfter === null || attendanceAfter === false, 'Requirement AC: Local attendance remains unrecorded (no split-brain attendance)');

  } finally {
    await new Promise(resolve => devMockServer.close(resolve));
  }

  // ============================================================
  // GROUP 7: PRODUCTION & STAGING ISOLATION GUARANTEES (AH, AI, AJ)
  // ============================================================
  console.log('\n[GROUP 7] Production & Staging Isolation Guarantees (AH, AI, AJ)');

  // AH: Public beta PM2 path remains Phase 0.22.1
  const pm2Output = execSync('pm2 jlist', { encoding: 'utf8' });
  const pm2List = JSON.parse(pm2Output);
  const betaProc = pm2List.find(p => p.name === 'koinonia-beta' || p.pm_id === 4);
  check(betaProc !== undefined, 'Requirement AH: PM2 process koinonia-beta (pm_id 4) is running');
  check(betaProc.pm2_env.status === 'online', 'Requirement AH: PM2 process status is online');
  check(betaProc.pm2_env.pm_exec_path.includes('/prototype/koinonia-phase22_1/server.js'),
    'Requirement AH: PM2 process script remains strictly pinned to prototype/koinonia-phase22_1/server.js');
  check(betaProc.pm2_env.pm_cwd.includes('/prototype/koinonia-phase22_1'),
    'Requirement AH: PM2 process cwd remains strictly pinned to prototype/koinonia-phase22_1');

  // AI: Protected staging DB SHA remains unchanged
  const EXPECTED_STAGING_DB_SHA = 'f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12';
  const stagingDbPath = '/home/raspi4/fog-portal-staging/fog_community.db';
  const dbBuffer = fs.readFileSync(stagingDbPath);
  const actualDbSha = crypto.createHash('sha256').update(dbBuffer).digest('hex');
  check(actualDbSha === EXPECTED_STAGING_DB_SHA,
    `Requirement AI: Staging DB SHA256 remains bit-for-bit identical (${actualDbSha})`);

  // AJ: No Main App hostname, path, or database dependency
  const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  check(!serverCode.includes('/home/raspi4/fog-portal-staging'), 'Requirement AJ: server.js contains zero paths to staging');
  check(!serverCode.includes('/home/raspi4/fogmin-portal-v3'), 'Requirement AJ: server.js contains zero paths to production');
  check(!serverCode.includes('fog_community.db'), 'Requirement AJ: server.js contains zero references to fog_community.db');
  check(!serverCode.includes('staging.fogmin.site'), 'Requirement AJ: server.js contains zero references to staging.fogmin.site');
  check(!serverCode.includes('fogmin.site/api/'), 'Requirement AJ: server.js contains zero references to Main App API');

  // ============================================================
  // GROUP 8: FAIL-CLOSED RUNTIME CONFIG FALLBACK & CAPABILITIES (CORRECTION 1)
  // ============================================================
  console.log('\n[GROUP 8] Fail-Closed Runtime Config Fallback & Capabilities (Correction 1)');

  // 1. index.html defines bootstrap fallback before runtime-config.js
  check(indexHtml.includes('window.__KOINONIA_RUNTIME_CONFIG__ ='),
    'Correction 1: index.html defines inline bootstrap fallback for window.__KOINONIA_RUNTIME_CONFIG__');
  check(indexHtml.includes('sharedCoreMode: "unavailable"') || indexHtml.includes("sharedCoreMode: 'unavailable'"),
    'Correction 1: index.html bootstrap fallback sets sharedCoreMode: "unavailable"');
  check(indexHtml.includes('configLoadFailed: true'),
    'Correction 1: index.html bootstrap fallback sets configLoadFailed: true');

  const fallbackIdx = indexHtml.indexOf('window.__KOINONIA_RUNTIME_CONFIG__ =');
  const runtimeScriptIdx = indexHtml.indexOf('<script src="runtime-config.js"></script>');
  check(fallbackIdx > 0 && runtimeScriptIdx > 0 && fallbackIdx < runtimeScriptIdx,
    'Correction 1: Bootstrap fallback script is positioned BEFORE <script src="runtime-config.js"></script>');

  // 2. Normal server local config selects Local provider
  const localResolved = resolveRuntimeConfig({ sharedCoreMode: 'local' });
  check(localResolved.providerMode === 'local', 'Correction 1: resolveRuntimeConfig(local) returns providerMode: "local"');
  check(localResolved.sharedCoreMode === 'local', 'Correction 1: resolveRuntimeConfig(local) returns sharedCoreMode: "local"');
  const localInst = createSharedCoreProvider(localResolved);
  check(localInst instanceof LocalSharedCoreProvider, 'Correction 1: local config instantiates LocalSharedCoreProvider');

  // 3. Normal server mock config selects Remote provider / read-only
  const mockResolved = resolveRuntimeConfig({ sharedCoreMode: 'mock', remoteReadsEnabled: true });
  check(mockResolved.providerMode === 'remote', 'Correction 1: resolveRuntimeConfig(mock) returns providerMode: "remote"');
  check(mockResolved.sharedCoreMode === 'mock', 'Correction 1: resolveRuntimeConfig(mock) returns sharedCoreMode: "mock"');
  check(mockResolved.remoteReadsEnabled === true, 'Correction 1: resolveRuntimeConfig(mock) enables remote reads');
  check(mockResolved.remoteMutationsEnabled === false, 'Correction 1: resolveRuntimeConfig(mock) disables remote mutations');
  const mockInst = createSharedCoreProvider(mockResolved);
  check(mockInst instanceof RemoteSharedCoreProvider, 'Correction 1: mock config instantiates RemoteSharedCoreProvider');

  // 4. Missing / failed runtime config does NOT select Local provider
  const unavailableResolved = resolveRuntimeConfig({ sharedCoreMode: 'unavailable', configLoadFailed: true });
  check(unavailableResolved.providerMode === 'remote', 'Correction 1: unavailable config selects providerMode: "remote"');
  check(unavailableResolved.remoteReadsEnabled === false, 'Correction 1: unavailable config blocks remote reads');
  check(unavailableResolved.remoteMutationsEnabled === false, 'Correction 1: unavailable config blocks remote mutations');

  const emptyResolved = resolveRuntimeConfig({});
  check(emptyResolved.providerMode === 'remote', 'Correction 1: empty config fails closed to providerMode: "remote"');
  check(emptyResolved.remoteReadsEnabled === false, 'Correction 1: empty config blocks remote reads');
  check(emptyResolved.remoteMutationsEnabled === false, 'Correction 1: empty config blocks remote mutations');

  const nullResolved = resolveRuntimeConfig(null);
  check(nullResolved.providerMode === 'remote', 'Correction 1: null config fails closed to providerMode: "remote"');

  const unavailableInst = createSharedCoreProvider(unavailableResolved);
  check(unavailableInst instanceof RemoteSharedCoreProvider, 'Correction 1: unavailable config instantiates RemoteSharedCoreProvider (NOT Local)');
  check(!(unavailableInst instanceof LocalSharedCoreProvider), 'Correction 1: unavailable config does NOT select LocalSharedCoreProvider');

  // 5. Config failure blocks remote reads and writes without network activity
  const failedReadResult = await unavailableInst.getCurrentMember();
  check(failedReadResult.success === false, 'Correction 1: getCurrentMember() returns success: false under config failure');
  check(failedReadResult.error === SHARED_CORE_ERRORS.READS_DISABLED,
    'Correction 1: getCurrentMember() returns SHARED_CORE_READS_DISABLED');

  const failedMutationResult = await unavailableInst.awardLifePoints({ amount: 20, idempotencyKey: 'fail:cfg:test' });
  check(failedMutationResult.success === false, 'Correction 1: awardLifePoints() returns success: false under config failure');
  check(failedMutationResult.error === SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
    'Correction 1: awardLifePoints() returns SHARED_CORE_MUTATIONS_DISABLED');

  // 6. Config failure awards zero local LP, completes zero local quests, creates zero local attendance
  const localRef = new LocalSharedCoreProvider();
  const baselineLp = localRef.getLifePoints().balance;
  await unavailableInst.awardLifePoints({ amount: 50, idempotencyKey: 'cfg:fail:lp' });
  check(localRef.getLifePoints().balance === baselineLp, 'Correction 1: Config failure awards zero local LP');

  const questsBeforeCount = localRef.getQuests().filter(q => q.completed).length;
  await unavailableInst.completeQuest('Q-001', { idempotencyKey: 'cfg:fail:quest' });
  const questsAfterCount = localRef.getQuests().filter(q => q.completed).length;
  check(questsAfterCount === questsBeforeCount, 'Correction 1: Config failure completes zero local quests');

  await unavailableInst.checkIn('EVT-001', { idempotencyKey: 'cfg:fail:att' });
  check(localRef.getAttendance('EVT-001') === null || localRef.getAttendance('EVT-001') === false,
    'Correction 1: Config failure creates zero local attendance');

  // 7. Visible non-sensitive warning state in UI
  const gameJsContent = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
  const stylesCssContent = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
  check(stylesCssContent.includes('.banner-unavailable'), 'Correction 1: styles.css defines .banner-unavailable styling');
  check(stylesCssContent.includes('.badge-unavailable'), 'Correction 1: styles.css defines .badge-unavailable styling');
  check(gameJsContent.includes('SHARED CORE CONFIG UNAVAILABLE'),
    'Correction 1: game.js renders explicit "SHARED CORE CONFIG UNAVAILABLE" text');
  check(gameJsContent.includes('Progress writes disabled') || gameJsContent.includes('Progress writes are disabled'),
    'Correction 1: game.js warns that progress writes are disabled');

  // ============================================================
  // GROUP 9: REMOTE/MOCK ADMIN AUTHORIZATION & ELEVATION GUARDS (CORRECTION 2)
  // ============================================================
  console.log('\n[GROUP 9] Remote/Mock Admin Authorization & Elevation Guards (Correction 2)');

  check(gameJsContent.includes('function isAuthorizedAdmin()'), 'Correction 2: game.js defines isAuthorizedAdmin()');
  check(gameJsContent.includes('isRemoteMode'), 'Correction 2: isAuthorizedAdmin distinguishes remote/mock mode');

  // Create isolated environment to test isAuthorizedAdmin logic
  const vm = require('vm');
  const sandbox = {
    window: {
      __KOINONIA_RUNTIME_CONFIG__: { sharedCoreMode: 'mock', remoteReadsEnabled: true },
      BetaIdentityProvider: BetaIdentityProvider,
      SharedCore: mockInst
    },
    state: { role: 'MEMBER', circleRole: 'MEMBER' },
    getSharedCore: () => mockInst,
    BetaIdentityProvider: BetaIdentityProvider
  };
  sandbox.global = sandbox;

  const isAuthorizedAdminCode = `
    ${gameJsContent.substring(
      gameJsContent.indexOf('function isAuthorizedAdmin()'),
      gameJsContent.indexOf('function getActiveMemberInfo()')
    )}
  `;

  vm.createContext(sandbox);
  vm.runInContext(isAuthorizedAdminCode, sandbox);

  // 1. MEMBER persona cannot access Studio/admin even if state.role is SUPERADMIN
  BetaIdentityProvider.setIdentity('MEMBER'); // Alex Rivera (MEMBER)
  sandbox.state.role = 'SUPERADMIN';
  sandbox.state.circleRole = 'SUPERADMIN';
  check(sandbox.isAuthorizedAdmin() === false,
    'Correction 2: In mock mode, MEMBER persona returns isAuthorizedAdmin() === false even with state.role = SUPERADMIN');

  // 2. MEMBER persona cannot access Studio even if state.role says ADMIN
  sandbox.state.role = 'ADMIN';
  check(sandbox.isAuthorizedAdmin() === false,
    'Correction 2: In mock mode, MEMBER persona returns isAuthorizedAdmin() === false even with state.role = ADMIN');

  // 3. ADMIN Beta persona (Sarah Jenkins) is authorized
  BetaIdentityProvider.setIdentity('ADMIN');
  check(sandbox.isAuthorizedAdmin() === true,
    'Correction 2: In mock mode, ADMIN Beta persona returns isAuthorizedAdmin() === true');

  // 4. SUPERADMIN Beta persona (Father Alex) is authorized
  BetaIdentityProvider.setIdentity('SUPERADMIN');
  check(sandbox.isAuthorizedAdmin() === true,
    'Correction 2: In mock mode, SUPERADMIN Beta persona returns isAuthorizedAdmin() === true');

  // 5. In local mode, historical behavior preserved
  sandbox.window.__KOINONIA_RUNTIME_CONFIG__ = { sharedCoreMode: 'local' };
  sandbox.SharedCore = localInst;
  sandbox.getSharedCore = () => localInst;
  BetaIdentityProvider.setIdentity('MEMBER'); // MEMBER
  sandbox.state.role = 'ADMIN';
  check(sandbox.isAuthorizedAdmin() === true,
    'Correction 2: In local mode, historical state.role = "ADMIN" is preserved');

  sandbox.state.role = 'MEMBER';
  sandbox.state.circleRole = 'MEMBER';
  check(sandbox.isAuthorizedAdmin() === false,
    'Correction 2: In local mode, regular MEMBER returns isAuthorizedAdmin() === false');

  // 6. openAdminStudio guards
  check(gameJsContent.includes('!BetaIdentityProvider.canAccessStudio()'),
    'Correction 2: openAdminStudio retains strict BetaIdentityProvider.canAccessStudio() guard');

  // ============================================================
  // GROUP 10: DOCUMENTATION ACCURACY & PHRASING AUDIT (CORRECTION 3)
  // ============================================================
  console.log('\n[GROUP 10] Documentation Accuracy & Phrasing Audit (Correction 3)');

  // 1. Check accurate toast wording in game.js
  const accurateToastPhrase = 'Action not saved. Shared progress was not changed because Shared Core is running in Read-Only development mode.';
  check(gameJsContent.includes(accurateToastPhrase),
    'Correction 3: game.js uses accurate toast phrase: "Action not saved. Shared progress was not changed because Shared Core is running in Read-Only development mode."');

  // 2. Stale phrase must NOT exist in game.js
  const stalePhrase = 'Gameplay action completed locally for demonstration, but remote canonical state was not altered.';
  check(!gameJsContent.includes(stalePhrase),
    'Correction 3: game.js does NOT contain stale misleading phrase');

  // 3. Check documentation file
  const docPath = '/home/raspi4/koinonia-quest/docs/koinonia-quest/KOINONIA_PHASE23D_BROWSER_RUNTIME_RESULTS.md';
  const docContent = fs.readFileSync(docPath, 'utf8');
  check(docContent.includes('sharedCoreMode'),
    'Correction 3: Results doc uses accurate runtime-config property "sharedCoreMode"');

  console.log('\n================================================================');
  console.log(`TOTAL PHASE 0.23D TESTS: ${passed} | PASSED: ${passed} | FAILED: 0`);
  console.log('================================================================\n');
}

runPhase23DTests().catch(err => {
  console.error('\n❌ PHASE 0.23D TEST FAILED:', err);
  process.exit(1);
});
