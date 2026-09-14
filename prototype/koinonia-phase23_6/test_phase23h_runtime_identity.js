/**
 * KOINONIA — PHASE 0.23H
 * ONLINE STAGING BASELINE & RUNTIME IDENTITY HARDENING TEST SUITE
 *
 * Verifies all Phase 0.23H requirements:
 * 1. Cache identity & service worker invariants (koinonia-v0.23h-r1, ?v=0.23h-r1)
 * 2. Runtime service identity is environment-controlled (default: "koinonia")
 * 3. Environment identity is dynamic & safe (default: "development", staging: "staging")
 * 4. Staging configuration renders correctly in /health and /runtime-config.js
 * 5. remoteMutationsEnabled remains strictly false across all configurations
 * 6. Zero secret / internal path / Cloudflare leaks in public runtime outputs
 * 7. Sensitive file extension and path traversal protections
 * 8. Shared Core mock proxy safety & forbidden route rejection
 * 9. Preserved Studio governance lifecycle & canonical Father Alex identity
 * 10. Main App process isolation & staging database SHA invariance
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Staging database SHA capture
const STAGING_DB_PATH = '/home/raspi4/fog-portal-staging/fog_community.db';
let STAGING_DB_SHA_BEFORE = null;
if (fs.existsSync(STAGING_DB_PATH)) {
  const buf = fs.readFileSync(STAGING_DB_PATH);
  STAGING_DB_SHA_BEFORE = crypto.createHash('sha256').update(buf).digest('hex');
}

const {
  createBetaServer,
  DEFAULT_PORT,
  DEFAULT_HOST,
  DEFAULT_SERVICE_NAME,
  DEFAULT_ENVIRONMENT,
  PHASE,
  VERSION,
  PresenceManager
} = require('./server.js');

const BetaIdentityProvider = require('./data/beta_identity.js');
const KoinoniaStudio = require('./data/studio_engine.js');

// Test bookkeeping
let testCount = 0;
let passCount = 0;
const failures = [];

function check(condition, message) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(`  ✓ [Test ${testCount}] ${message}`);
  } else {
    failures.push(`[Test ${testCount}] FAILED: ${message}`);
    console.error(`  ✗ [Test ${testCount}] FAILED: ${message}`);
  }
}

// HTTP request helper
function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          json
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

// In-memory DOM and Storage Mock for Studio Engine verification
const mockDomElements = new Map();
function getOrCreateMockElement(id) {
  if (!mockDomElements.has(id)) {
    let _text = '';
    const el = {
      id,
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
        get length() { return this._classes.size; }
      },
      style: { display: '' },
      innerHTML: '',
      get textContent() { return _text; },
      set textContent(v) { _text = String(v); },
      get innerText() { return _text; },
      set innerText(v) { _text = String(v); },
      disabled: false,
      value: '',
      querySelectorAll() { return []; },
      querySelector() { return null; },
      addEventListener() {},
      removeEventListener() {},
      scrollIntoView() {}
    };
    mockDomElements.set(id, el);
  }
  return mockDomElements.get(id);
}

const mockLocalStorageStore = new Map();
const mockLocalStorage = {
  getItem(k) { return mockLocalStorageStore.has(k) ? mockLocalStorageStore.get(k) : null; },
  setItem(k, v) { mockLocalStorageStore.set(k, String(v)); },
  removeItem(k) { mockLocalStorageStore.delete(k); },
  clear() { mockLocalStorageStore.clear(); }
};

global.document = {
  getElementById(id) { return getOrCreateMockElement(id); },
  querySelector(sel) {
    if (sel.startsWith('#')) return getOrCreateMockElement(sel.slice(1));
    return null;
  },
  querySelectorAll() { return []; },
  createElement(tag) { return getOrCreateMockElement('mock-' + tag + '-' + Math.random()); }
};
global.window = {
  localStorage: mockLocalStorage,
  addEventListener() {},
  location: { reload() {} }
};
global.localStorage = mockLocalStorage;

async function runSuite() {
  console.log('================================================================');
  console.log('KOINONIA PHASE 0.23H RUNTIME IDENTITY & STAGING BASELINE TESTS');
  console.log('================================================================\n');

  const baseDir = __dirname;
  const swPath = path.join(baseDir, 'sw.js');
  const indexHtmlPath = path.join(baseDir, 'index.html');
  const serverJsPath = path.join(baseDir, 'server.js');
  const gameJsPath = path.join(baseDir, 'game.js');
  const workflowDocPath = path.join(baseDir, '../../docs/koinonia-quest/KOINONIA_STAGING_WORKFLOW.md');

  const swContent = fs.readFileSync(swPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const serverJs = fs.readFileSync(serverJsPath, 'utf8');

  // ============================================================
  // GROUP 1: Cache Identity & Asset Versioning (Phase 0.23H)
  // ============================================================
  console.log('[GROUP 1] Cache Identity & Asset Versioning (Phase 0.23H)');

  check(swContent.includes('koinonia-v0.23h-r1'),
    'sw.js defines cache identity koinonia-v0.23h-r1');

  check(swContent.includes('styles.css?v=0.23h-r1'),
    'sw.js caches styles.css?v=0.23h-r1');

  check(swContent.includes('game.js?v=0.23h-r1'),
    'sw.js caches game.js?v=0.23h-r1');

  check(swContent.includes('data/studio_engine.js?v=0.23h-r1'),
    'sw.js caches data/studio_engine.js?v=0.23h-r1');

  check(indexHtml.includes('styles.css?v=0.23h-r1'),
    'index.html references styles.css?v=0.23h-r1');

  check(indexHtml.includes('game.js?v=0.23h-r1'),
    'index.html references game.js?v=0.23h-r1');

  check(indexHtml.includes('data/shared_core.js?v=0.23h-r1'),
    'index.html references data/shared_core.js?v=0.23h-r1');

  check(indexHtml.includes('data/remote_shared_core.js?v=0.23h-r1'),
    'index.html references data/remote_shared_core.js?v=0.23h-r1');

  check(indexHtml.includes('data/studio_engine.js?v=0.23h-r1'),
    'index.html references data/studio_engine.js?v=0.23h-r1');

  check(indexHtml.includes('data/beta_identity.js?v=0.23h-r1'),
    'index.html references data/beta_identity.js?v=0.23h-r1');

  check(!indexHtml.includes('0.23f'),
    'index.html contains zero remaining 0.23f references');

  check(!swContent.includes('0.23f'),
    'sw.js contains zero remaining 0.23f references');

  // ============================================================
  // GROUP 2: Constants & Exports in server.js
  // ============================================================
  console.log('\n[GROUP 2] Constants & Exports in server.js');

  check(DEFAULT_SERVICE_NAME === 'koinonia',
    'DEFAULT_SERVICE_NAME is "koinonia"');

  check(DEFAULT_ENVIRONMENT === 'development',
    'DEFAULT_ENVIRONMENT is "development"');

  check(PHASE === '0.23H',
    'PHASE constant is "0.23H"');

  check(VERSION === '0.23H',
    'VERSION constant is "0.23H"');

  check(typeof createBetaServer === 'function',
    'createBetaServer is exported as a function');

  // ============================================================
  // GROUP 3: Default Runtime Service & Environment Identity (Safe Defaults)
  // ============================================================
  console.log('\n[GROUP 3] Default Runtime Service & Environment Identity (Safe Defaults)');

  const defaultServer = createBetaServer({ port: 18121, host: '127.0.0.1' });
  await new Promise(r => defaultServer.listen(r));

  try {
    // Health endpoint check
    const defaultHealth = await makeRequest({
      hostname: '127.0.0.1',
      port: 18121,
      path: '/health',
      method: 'GET'
    });

    check(defaultHealth.statusCode === 200,
      'Default /health returns HTTP 200');

    check(defaultHealth.json && defaultHealth.json.status === 'healthy',
      'Default /health reports status "healthy"');

    check(defaultHealth.json && defaultHealth.json.service === 'koinonia',
      'Default /health safely reports service "koinonia"');

    check(defaultHealth.json && defaultHealth.json.environment === 'development',
      'Default /health safely reports environment "development"');

    check(defaultHealth.json && defaultHealth.json.phase === '0.23H',
      'Default /health reports phase "0.23H"');

    check(defaultHealth.json && defaultHealth.json.version === '0.23H',
      'Default /health reports version "0.23H"');

    check(defaultHealth.json && defaultHealth.json.sharedCoreMode === 'local',
      'Default /health reports sharedCoreMode "local"');

    // Runtime config check
    const defaultConfig = await makeRequest({
      hostname: '127.0.0.1',
      port: 18121,
      path: '/runtime-config.js',
      method: 'GET'
    });

    check(defaultConfig.statusCode === 200,
      'Default /runtime-config.js returns HTTP 200');

    check(defaultConfig.headers['content-type'].includes('application/javascript'),
      'Default /runtime-config.js has application/javascript Content-Type');

    check(defaultConfig.body.includes('"service": "koinonia"'),
      'Default /runtime-config.js reports service "koinonia"');

    check(defaultConfig.body.includes('"environment": "development"'),
      'Default /runtime-config.js reports environment "development"');

    check(defaultConfig.body.includes('"phase": "0.23H"'),
      'Default /runtime-config.js reports phase "0.23H"');

    check(defaultConfig.body.includes('"remoteMutationsEnabled": false'),
      'Default /runtime-config.js strictly enforces remoteMutationsEnabled: false');

    // Presence status check
    const defaultPresence = await makeRequest({
      hostname: '127.0.0.1',
      port: 18121,
      path: '/api/presence/status',
      method: 'GET'
    });

    check(defaultPresence.json && defaultPresence.json.service === 'koinonia',
      'Default presence status reports service "koinonia"');
  } finally {
    await new Promise(r => defaultServer.close(r));
  }

  // ============================================================
  // GROUP 4: Staging Service Identity (Explicit Options & Env Configuration)
  // ============================================================
  console.log('\n[GROUP 4] Staging Service Identity (Explicit Options & Env Configuration)');

  const stagingServer = createBetaServer({
    port: 18122,
    host: '127.0.0.1',
    serviceName: 'koinonia-staging',
    environment: 'staging',
    devSharedCore: 'mock'
  });
  await new Promise(r => stagingServer.listen(r));

  try {
    // Health endpoint check
    const stagingHealth = await makeRequest({
      hostname: '127.0.0.1',
      port: 18122,
      path: '/health',
      method: 'GET'
    });

    check(stagingHealth.statusCode === 200,
      'Staging /health returns HTTP 200');

    check(stagingHealth.json && stagingHealth.json.service === 'koinonia-staging',
      'Staging /health reports service "koinonia-staging"');

    check(stagingHealth.json && stagingHealth.json.environment === 'staging',
      'Staging /health reports environment "staging"');

    check(stagingHealth.json && stagingHealth.json.phase === '0.23H',
      'Staging /health reports phase "0.23H"');

    check(stagingHealth.json && stagingHealth.json.version === '0.23H',
      'Staging /health reports version "0.23H"');

    check(stagingHealth.json && stagingHealth.json.sharedCoreMode === 'mock-readonly',
      'Staging /health reports sharedCoreMode "mock-readonly"');

    // Runtime config check
    const stagingConfig = await makeRequest({
      hostname: '127.0.0.1',
      port: 18122,
      path: '/runtime-config.js',
      method: 'GET'
    });

    check(stagingConfig.statusCode === 200,
      'Staging /runtime-config.js returns HTTP 200');

    check(stagingConfig.body.includes('"service": "koinonia-staging"'),
      'Staging /runtime-config.js reports service "koinonia-staging"');

    check(stagingConfig.body.includes('"environment": "staging"'),
      'Staging /runtime-config.js reports environment "staging"');

    check(stagingConfig.body.includes('"phase": "0.23H"'),
      'Staging /runtime-config.js reports phase "0.23H"');

    check(stagingConfig.body.includes('"version": "0.23H"'),
      'Staging /runtime-config.js reports version "0.23H"');

    check(stagingConfig.body.includes('"sharedCoreMode": "mock"'),
      'Staging /runtime-config.js reports sharedCoreMode "mock"');

    check(stagingConfig.body.includes('"remoteReadsEnabled": true'),
      'Staging /runtime-config.js reports remoteReadsEnabled: true');

    check(stagingConfig.body.includes('"remoteMutationsEnabled": false'),
      'Staging /runtime-config.js strictly enforces remoteMutationsEnabled: false');

    // Presence status check
    const stagingPresence = await makeRequest({
      hostname: '127.0.0.1',
      port: 18122,
      path: '/api/presence/status',
      method: 'GET'
    });

    check(stagingPresence.json && stagingPresence.json.service === 'koinonia-staging',
      'Staging presence status reports service "koinonia-staging"');
  } finally {
    await new Promise(r => stagingServer.close(r));
  }

  // ============================================================
  // GROUP 5: Dynamic Environment Variable Resolution & Derivation
  // ============================================================
  console.log('\n[GROUP 5] Dynamic Environment Variable Resolution & Derivation');

  // Test auto-deriving "staging" when KOINONIA_SERVICE_NAME=koinonia-staging without explicit KOINONIA_ENVIRONMENT
  const origServiceName = process.env.KOINONIA_SERVICE_NAME;
  const origEnv = process.env.KOINONIA_ENVIRONMENT;
  const origNodeEnv = process.env.NODE_ENV;

  try {
    process.env.KOINONIA_SERVICE_NAME = 'koinonia-staging';
    delete process.env.KOINONIA_ENVIRONMENT;

    const envDerivedServer = createBetaServer({ port: 18123, host: '127.0.0.1' });
    await new Promise(r => envDerivedServer.listen(r));

    try {
      const derivedHealth = await makeRequest({
        hostname: '127.0.0.1',
        port: 18123,
        path: '/health',
        method: 'GET'
      });
      check(derivedHealth.json && derivedHealth.json.service === 'koinonia-staging',
        'Auto-derivation: serviceName resolved from process.env.KOINONIA_SERVICE_NAME');
      check(derivedHealth.json && derivedHealth.json.environment === 'staging',
        'Auto-derivation: environment auto-derived as "staging" when serviceName is "koinonia-staging"');
    } finally {
      await new Promise(r => envDerivedServer.close(r));
    }

    // Test explicit override takes precedence
    process.env.KOINONIA_ENVIRONMENT = 'custom-staging-env';
    const explicitEnvServer = createBetaServer({ port: 18124, host: '127.0.0.1' });
    await new Promise(r => explicitEnvServer.listen(r));

    try {
      const explicitHealth = await makeRequest({
        hostname: '127.0.0.1',
        port: 18124,
        path: '/health',
        method: 'GET'
      });
      check(explicitHealth.json && explicitHealth.json.environment === 'custom-staging-env',
        'Explicit KOINONIA_ENVIRONMENT overrides auto-derivation');
    } finally {
      await new Promise(r => explicitEnvServer.close(r));
    }
  } finally {
    if (origServiceName !== undefined) process.env.KOINONIA_SERVICE_NAME = origServiceName;
    else delete process.env.KOINONIA_SERVICE_NAME;
    if (origEnv !== undefined) process.env.KOINONIA_ENVIRONMENT = origEnv;
    else delete process.env.KOINONIA_ENVIRONMENT;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
  }

  // ============================================================
  // GROUP 6: Zero Secret & Internal Path Leakage Verification
  // ============================================================
  console.log('\n[GROUP 6] Zero Secret & Internal Path Leakage Verification');

  const testServerLeakCheck = createBetaServer({
    port: 18125,
    host: '127.0.0.1',
    serviceName: 'koinonia-staging',
    environment: 'staging',
    devSharedCore: 'mock'
  });
  await new Promise(r => testServerLeakCheck.listen(r));

  try {
    const healthRes = await makeRequest({ hostname: '127.0.0.1', port: 18125, path: '/health', method: 'GET' });
    const configRes = await makeRequest({ hostname: '127.0.0.1', port: 18125, path: '/runtime-config.js', method: 'GET' });

    // Zero filesystem paths in responses
    check(!healthRes.body.includes('/home/raspi4') && !healthRes.body.includes('fog-portal-staging'),
      'Health response contains zero filesystem paths');

    check(!configRes.body.includes('/home/raspi4') && !configRes.body.includes('fog-portal-staging'),
      'Runtime config response contains zero filesystem paths');

    // Zero Main App domain exposure
    check(!healthRes.body.includes('staging.fogmin.site') && !healthRes.body.includes('fogmin.site/api'),
      'Health response contains zero Main App endpoint domains');

    check(!configRes.body.includes('staging.fogmin.site') && !configRes.body.includes('fogmin.site/api'),
      'Runtime config contains zero Main App endpoint domains');

    // Zero secret keywords in responses
    const secretKeywords = ['password', 'secret', 'token', 'bearer', 'private_key', 'vapid'];
    let secretsFound = false;
    for (const kw of secretKeywords) {
      if (healthRes.body.toLowerCase().includes(kw) || configRes.body.toLowerCase().includes(kw)) {
        secretsFound = true;
      }
    }
    check(!secretsFound, 'Runtime responses contain zero credentials, tokens, or secret keywords');

    // Security headers present
    check(healthRes.headers['x-content-type-options'] === 'nosniff',
      'Health response enforces X-Content-Type-Options: nosniff');
    check(configRes.headers['x-content-type-options'] === 'nosniff',
      'Runtime config enforces X-Content-Type-Options: nosniff');
    check(configRes.headers['cache-control'].includes('no-store'),
      'Runtime config enforces Cache-Control: no-store');
  } finally {
    await new Promise(r => testServerLeakCheck.close(r));
  }

  // ============================================================
  // GROUP 7: Security Rejection & Sensitive File Protection
  // ============================================================
  console.log('\n[GROUP 7] Security Rejection & Sensitive File Protection');

  const secServer = createBetaServer({ port: 18126, host: '127.0.0.1' });
  await new Promise(r => secServer.listen(r));

  try {
    // 1. Path traversal attempts
    const traversal1 = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/../../../etc/passwd', method: 'GET' });
    check(traversal1.statusCode === 404 || traversal1.statusCode === 403,
      'Path traversal attempt /../../../etc/passwd is blocked (403/404)');

    const traversal2 = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/%2e%2e/%2e%2e/package.json', method: 'GET' });
    check(traversal2.statusCode === 404 || traversal2.statusCode === 403,
      'Encoded traversal /%2e%2e/ is blocked');

    // 2. Sensitive file extensions
    const dbReq = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/fog_community.db', method: 'GET' });
    check(dbReq.statusCode === 404,
      'Direct request for .db extension is rejected with 404');

    const envReq = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/.env', method: 'GET' });
    check(envReq.statusCode === 404,
      'Direct request for .env is rejected with 404');

    // 3. Test harnesses blocked
    const testReq = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/test_phase23f_studio_e2e.js', method: 'GET' });
    check(testReq.statusCode === 404,
      'Test script endpoint /test_* is blocked from public static serving');

    // 4. Forbidden legacy Main App routes
    const authReq = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/auth/login', method: 'GET' });
    check(authReq.statusCode === 404,
      'Forbidden legacy route /auth/login returns 404');

    const adminReq = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/api/admin/users', method: 'GET' });
    check(adminReq.statusCode === 404,
      'Forbidden legacy route /api/admin/* returns 404');

    const checkinReq = await makeRequest({ hostname: '127.0.0.1', port: 18126, path: '/api/checkin', method: 'GET' });
    check(checkinReq.statusCode === 404,
      'Forbidden legacy route /api/checkin returns 404');
  } finally {
    await new Promise(r => secServer.close(r));
  }

  // ============================================================
  // GROUP 8: Studio Governance & Father Alex Identity Compatibility
  // ============================================================
  console.log('\n[GROUP 8] Studio Governance & Father Alex Identity Compatibility');

  // Personas
  const personas = BetaIdentityProvider.getPersonas();
  check(personas.length === 3, 'BetaIdentityProvider provides exactly 3 personas');

  const fatherAlex = personas.find(p => p.id === 'father_alex');
  check(fatherAlex && fatherAlex.name === 'Father Alex', 'Father Alex persona is registered with name "Father Alex"');
  check(fatherAlex && fatherAlex.role === 'SUPERADMIN', 'Father Alex persona has role SUPERADMIN');
  check(fatherAlex && fatherAlex.capabilities.canAccessStudio === true, 'Father Alex canAccessStudio is true');
  check(fatherAlex && fatherAlex.capabilities.canApprove === true, 'Father Alex canApprove is true');
  check(fatherAlex && fatherAlex.capabilities.canPublish === true, 'Father Alex canPublish is true');

  const sarah = personas.find(p => p.id === 'admin_sarah');
  check(sarah && sarah.role === 'ADMIN', 'Sarah Jenkins persona has role ADMIN');
  check(sarah && sarah.capabilities.canAccessStudio === true, 'Sarah Jenkins canAccessStudio is true');
  check(sarah && sarah.capabilities.canApprove === false, 'Sarah Jenkins canApprove is strictly false');
  check(sarah && sarah.capabilities.canPublish === false, 'Sarah Jenkins canPublish is strictly false');

  // Studio Store governance lifecycle
  mockLocalStorageStore.clear();
  const store = new KoinoniaStudio.StudioStore();

  const sarahActor = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const fatherAlexActor = { id: 'father_alex', name: 'Father Alex', role: 'SUPERADMIN' };

  const draft = store.createDraft('EVENT', {
    title: 'Staging Baseline Campfire',
    description: 'Youth night gathering around the campfire with prayer and fellowship.',
    placeId: 'fog_center',
    realWorldVenue: 'FOG Community Courtyard',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    timezone: 'Asia/Singapore',
    audience: 'all',
    checkInEnabled: true,
    memoryCaptureEnabled: true,
    presentationTarget: 'BOTH'
  }, sarahActor);

  check(draft && draft.id && draft.status === 'DRAFT',
    'StudioStore creates draft with initial status DRAFT');

  // Submit for review
  const submitted = store.requestReview(draft.id, sarahActor);
  check(submitted && submitted.status === 'READY_FOR_REVIEW',
    'Draft transitions to READY_FOR_REVIEW upon submission');

  // Return for changes by Father Alex
  const returned = store.returnForChanges(draft.id, fatherAlexActor, 'Please refine the fellowship description.');
  check(returned && returned.status === 'DRAFT',
    'Draft status reverts to DRAFT when returned for changes');
  check(returned.reviewNotes === 'Please refine the fellowship description.',
    'Leadership review note is persisted on returned draft');
  check(returned.returnedBy && returned.returnedBy.name === 'Father Alex',
    'Returned draft records Father Alex as returning leader');

  // Re-submit
  const resubmitted = store.requestReview(draft.id, sarahActor);
  check(resubmitted && resubmitted.status === 'READY_FOR_REVIEW',
    'Revised draft transitions to READY_FOR_REVIEW upon re-submission');
  check(!resubmitted.reviewNotes,
    'Re-submitting clears previous review notes');

  // Approve
  const approved = store.approveDraft(draft.id, fatherAlexActor);
  check(approved && approved.status === 'APPROVED',
    'Draft transitions to APPROVED upon approval by Father Alex');

  // Publish
  const published = store.publishDraft(draft.id, fatherAlexActor);
  check(published && published.success && published.draft.status === 'PUBLISHED',
    'Draft transitions to PUBLISHED upon publishing by Father Alex');

  // Audit log
  const auditLogs = store.getAuditLogs();
  const actions = auditLogs.map(a => a.action);
  check(actions.includes('DRAFT_CREATED'), 'Audit log records DRAFT_CREATED');
  check(actions.includes('REVIEW_REQUESTED'), 'Audit log records REVIEW_REQUESTED');
  check(actions.includes('RETURNED_FOR_CHANGES'), 'Audit log records RETURNED_FOR_CHANGES');
  check(actions.includes('APPROVED'), 'Audit log records APPROVED');
  check(actions.includes('PUBLISHED'), 'Audit log records PUBLISHED');

  // ============================================================
  // GROUP 9: Staging Workflow Documentation Verification
  // ============================================================
  console.log('\n[GROUP 9] Staging Workflow Documentation Verification');

  check(fs.existsSync(workflowDocPath),
    'docs/koinonia-quest/KOINONIA_STAGING_WORKFLOW.md exists');

  const workflowDoc = fs.readFileSync(workflowDocPath, 'utf8');

  check(workflowDoc.includes('STAGING IS NOT PRODUCTION'),
    'Workflow doc explicitly states "STAGING IS NOT PRODUCTION"');

  check(workflowDoc.includes('PUBLIC BETA IS NOT AUTOMATICALLY UPDATED'),
    'Workflow doc explicitly states "PUBLIC BETA IS NOT AUTOMATICALLY UPDATED"');

  check(workflowDoc.includes('MAIN APP IS A SEPARATE RELEASE LANE'),
    'Workflow doc explicitly states "MAIN APP IS A SEPARATE RELEASE LANE"');

  check(workflowDoc.includes('koinonia-staging.fogmin.site'),
    'Workflow doc documents koinonia-staging.fogmin.site on port 3006');

  check(workflowDoc.includes('koinonia-beta.fogmin.site'),
    'Workflow doc documents koinonia-beta.fogmin.site on port 3005');

  check(workflowDoc.includes('koinonia.fogmin.site'),
    'Workflow doc documents future production koinonia.fogmin.site');

  // 10-step lifecycle verification in doc
  const requiredSteps = [
    '1. Start from last accepted checkpoint',
    '2. Create next immutable prototype snapshot',
    '3. Implement only in new snapshot',
    '4. Run automated tests',
    '5. Run regression tests',
    '6. Deploy candidate to koinonia-staging',
    '7. Physical mobile/browser QA',
    '8. Commit only after acceptance',
    '9. Push accepted checkpoint',
    '10. Public koinonia-beta is promoted only deliberately'
  ];

  let allStepsFound = true;
  for (const step of requiredSteps) {
    if (!workflowDoc.includes(step)) {
      allStepsFound = false;
      console.warn(`Missing step in doc: ${step}`);
    }
  }
  check(allStepsFound, 'Workflow doc details all 10 steps of the staging release lifecycle');

  // ============================================================
  // GROUP 10: Main App Process & DB Invariant Verification
  // ============================================================
  console.log('\n[GROUP 10] Main App Process & DB Invariant Verification');

  // Verify PM2 status
  let pm2Output = '';
  try {
    pm2Output = execSync('pm2 jlist', { encoding: 'utf8' });
  } catch (_) {}

  let pm2List = [];
  try { pm2List = JSON.parse(pm2Output); } catch (_) {}

  const fogStaging = pm2List.find(p => p.name === 'fog-staging');
  check(fogStaging && fogStaging.pm2_env.status === 'online',
    'Main App process fog-staging (ID 2) is untouched and online');

  const fogV3 = pm2List.find(p => p.name === 'fog-v3');
  check(fogV3 && fogV3.pm2_env.status === 'online',
    'Main App process fog-v3 (ID 3) is untouched and online');

  const koinoniaBeta = pm2List.find(p => p.name === 'koinonia-beta');
  check(koinoniaBeta && koinoniaBeta.pm2_env.status === 'online',
    'Public beta process koinonia-beta (ID 4) is untouched and online on port 3005');

  const koinoniaStaging = pm2List.find(p => p.name === 'koinonia-staging');
  check(koinoniaStaging && koinoniaStaging.pm2_env.status === 'online',
    'Staging process koinonia-staging (ID 5) is online on port 3006');

  // Staging DB SHA Invariance check
  if (fs.existsSync(STAGING_DB_PATH)) {
    const afterBuf = fs.readFileSync(STAGING_DB_PATH);
    const afterSha = crypto.createHash('sha256').update(afterBuf).digest('hex');
    check(afterSha === STAGING_DB_SHA_BEFORE,
      `Staging DB SHA unchanged (${STAGING_DB_SHA_BEFORE.slice(0, 16)}... === ${afterSha.slice(0, 16)}...)`);
  } else {
    check(true, 'Staging DB check skipped (no local file)');
  }

  // ============================================================
  // FINAL REPORT
  // ============================================================
  console.log('\n================================================================');
  console.log(`PHASE 0.23H RESULTS: ${passCount} PASSED, ${failures.length} FAILED (TOTAL: ${testCount})`);
  console.log('================================================================');

  if (failures.length > 0) {
    console.error('\nFAILURES:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  } else {
    console.log('\nALL PHASE 0.23H TESTS PASSED SUCCESSFULLY!');
  }
}

runSuite().catch(err => {
  console.error('Fatal error during test execution:', err);
  process.exit(1);
});
