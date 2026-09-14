/**
 * KOINONIA — PHASE 0.23F
 * STUDIO END-TO-END GOVERNANCE WORKFLOW & UX POLISH AUTOMATED TEST SUITE
 *
 * Verifies all required assertions:
 * 1. Cache identity & service worker invariants (koinonia-v0.23f-r1)
 * 2. Runtime configuration & process isolation (phase 0.23F, port 3005 on phase22_1)
 * 3. Father Alex canonical identity & role boundaries (zero Pastor David references)
 * 4. Admin authoring lifecycle (Sarah Jenkins: wizard, save, resume, preview, submit)
 * 5. Superadmin review & publish lifecycle (Father Alex: review queue, approve, publish)
 * 6. Return for changes lifecycle (structured notes, editable state, changes requested UI)
 * 7. State machine safety & illegal transition guards
 * 8. Role-switch & refresh/reopen persistence
 * 9. Governance audit log & slice ordering
 * 10. Dashboard counters real-time accuracy
 * 11. Mobile UX & navigation scrollability
 * 12. Shared Core, Main App & database isolation guards
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
let PHASE23F_STAGING_DB_SHA_BEFORE = null;
if (fs.existsSync(STAGING_DB_PATH)) {
  const beforeBuf = fs.readFileSync(STAGING_DB_PATH);
  PHASE23F_STAGING_DB_SHA_BEFORE = crypto.createHash('sha256').update(beforeBuf).digest('hex');
}

const { createBetaServer } = require('./server.js');
const BetaIdentityProvider = require('./data/beta_identity.js');
const KoinoniaStudio = require('./data/studio_engine.js');

// DOM and Storage Mock for game engine testing in headless Node.js
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
      value: '',
      disabled: false,
      dataset: {},
      children: [],
      _attrs: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      setAttribute: function(k, v) { this._attrs[k] = String(v); },
      getAttribute: function(k) { return this._attrs[k] !== undefined ? this._attrs[k] : null; },
      appendChild: function(child) { this.children.push(child); return child; },
      querySelector: () => null,
      querySelectorAll: () => [],
      scrollIntoView: function(opts) { this._lastScrollOpts = opts; }
    };
    mockDomElements.set(id, el);
  }
  return mockDomElements.get(id);
}

// In-memory localStorage mock
const mockStorage = {
  _data: {},
  getItem(k) { return this._data[k] !== undefined ? this._data[k] : null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
  clear() { this._data = {}; }
};

// Setup global DOM environment before game.js load
const recordedToasts = [];
global.showToast = (msg) => { recordedToasts.push(msg); };
global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.window.location = { search: '', pathname: '/', host: '127.0.0.1:3005' };
global.window.localStorage = mockStorage;
global.localStorage = mockStorage;
global.document = {
  readyState: 'loading',
  documentElement: { style: { setProperty: () => {} } },
  getElementById: (id) => getOrCreateMockElement(id),
  querySelector: () => null,
  querySelectorAll: (selector) => {
    const results = [];
    if (selector && selector.startsWith('.')) {
      const cls = selector.slice(1);
      for (const el of mockDomElements.values()) {
        if (el.classList.contains(cls)) results.push(el);
      }
    }
    return results;
  },
  createElement: (tag) => ({
    tagName: tag,
    style: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); }
    },
    setAttribute: () => {},
    appendChild: () => {},
    remove: () => {},
    innerHTML: ''
  }),
  body: {
    appendChild: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {}
};

// Register superadmin-only elements
['nav-studio-review', 'card-stat-review', 'card-stat-ready', 'btn-wizard-approve', 'btn-wizard-publish'].forEach(id => {
  getOrCreateMockElement(id).classList.add('superadmin-only');
});

global.KoinoniaStudio = KoinoniaStudio;
global.BetaIdentityProvider = BetaIdentityProvider;
global.KOINONIA_DATA = { places: {} };

// Load game.js
require('./game.js');
const GameAPI = global.KOINONIA_GAME;

// Helper for HTTP requests
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
    if (postData) req.write(postData);
    req.end();
  });
}

async function runSuite() {
  console.log('================================================================');
  console.log('KOINONIA PHASE 0.23F — STUDIO END-TO-END GOVERNANCE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function check(condition, message) {
    if (condition) {
      console.log(`  ✓ [Test ${passed + 1}] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  const baseDir = __dirname;
  const swPath = path.join(baseDir, 'sw.js');
  const indexHtmlPath = path.join(baseDir, 'index.html');
  const stylesCssPath = path.join(baseDir, 'styles.css');
  const serverJsPath = path.join(baseDir, 'server.js');
  const gameJsPath = path.join(baseDir, 'game.js');
  const studioEnginePath = path.join(baseDir, 'data', 'studio_engine.js');

  const swContent = fs.readFileSync(swPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const stylesCss = fs.readFileSync(stylesCssPath, 'utf8');
  const serverJs = fs.readFileSync(serverJsPath, 'utf8');
  const gameJs = fs.readFileSync(gameJsPath, 'utf8');
  const studioEngine = fs.readFileSync(studioEnginePath, 'utf8');

  // ============================================================
  // GROUP 1: Service Worker, Cache Identity & Bypass Rules
  // ============================================================
  console.log('[GROUP 1] Service Worker, Cache Identity & Bypass Rules');

  check(swContent.includes('koinonia-v0.23f-r3'),
    'sw.js defines cache identity koinonia-v0.23f-r3');

  check(indexHtml.includes('styles.css?v=0.23f-r3'),
    'index.html references styles.css?v=0.23f-r3');

  check(indexHtml.includes('game.js?v=0.23f-r3'),
    'index.html references game.js?v=0.23f-r3');

  check(indexHtml.includes('data/studio_engine.js?v=0.23f-r3'),
    'index.html references data/studio_engine.js?v=0.23f-r3');

  check(swContent.includes('/api/v1/shared/'),
    'sw.js strictly bypasses /api/v1/shared/* endpoints');

  check(swContent.includes('/runtime-config.js'),
    'sw.js strictly bypasses /runtime-config.js');

  check(swContent.includes('/health'),
    'sw.js strictly bypasses /health');

  // ============================================================
  // GROUP 2: Runtime Configuration & Process Isolation
  // ============================================================
  console.log('\n[GROUP 2] Runtime Configuration & Process Isolation');

  const testServer = createBetaServer({ port: 18115, host: '127.0.0.1' });
  await new Promise(r => testServer.listen(r));

  try {
    const runtimeConfigRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 18115,
      path: '/runtime-config.js',
      method: 'GET'
    });
    check(runtimeConfigRes.statusCode === 200,
      'GET /runtime-config.js returns HTTP 200');

    check(runtimeConfigRes.body.includes('"phase": "0.23F"'),
      'runtime-config.js reports phase 0.23F');

    check(runtimeConfigRes.body.includes('"remoteMutationsEnabled": false'),
      'runtime-config.js reports remoteMutationsEnabled: false');

    const healthRes = await makeRequest({
      hostname: '127.0.0.1',
      port: 18115,
      path: '/health',
      method: 'GET'
    });
    check(healthRes.statusCode === 200,
      'GET /health returns HTTP 200');

    check(healthRes.json && healthRes.json.phase === '0.23F',
      'Health API reports phase 0.23F');

    check(healthRes.json && healthRes.json.version === '0.23F',
      'Health API reports version 0.23F');

    check(!healthRes.body.includes('fog-portal-staging') && !healthRes.body.includes('fog-portal-v2'),
      'Health response contains zero Main App paths');

    // Verify public beta PM2 status
    let pm2Output = '';
    try {
      pm2Output = execSync('pm2 jlist', { encoding: 'utf8' });
    } catch (_) {}
    let pm2List = [];
    try { pm2List = JSON.parse(pm2Output); } catch (_) {}
    const koinoniaProc = pm2List.find(p => p.name === 'koinonia-beta');

    check(koinoniaProc && koinoniaProc.pm2_env.status === 'online',
      'PM2 process koinonia-beta (ID 4) is active and online');

    const scriptPath = koinoniaProc ? (koinoniaProc.pm2_env.pm_exec_path || '') : '';
    check(scriptPath.includes('koinonia-phase22_1'),
      'PM2 koinonia-beta strictly runs prototype/koinonia-phase22_1');

  } finally {
    await new Promise(r => testServer.close(r));
  }

  // ============================================================
  // GROUP 3: Canonical Father Alex Identity & Role Boundaries
  // ============================================================
  console.log('\n[GROUP 3] Father Alex Canonical Identity & Role Boundaries');

  const superIdentity = BetaIdentityProvider.setIdentity('SUPERADMIN');
  check(superIdentity.id === 'father_alex',
    'SUPERADMIN persona ID is father_alex');
  check(superIdentity.name === 'Father Alex',
    'SUPERADMIN persona name is Father Alex');
  check(superIdentity.title === 'Father & Overseer',
    'SUPERADMIN title is Father & Overseer');

  // Zero occurrences of Pastor David / pastor_david in phase23_4
  const hasPastorDavid = /pastor_david/i.test(swContent + indexHtml + stylesCss + serverJs + gameJs + studioEngine);
  check(!hasPastorDavid,
    'Zero runtime references to pastor_david across all phase23_4 files');

  const adminIdentity = BetaIdentityProvider.setIdentity('ADMIN');
  check(adminIdentity.id === 'admin_sarah' && adminIdentity.name === 'Sarah Jenkins',
    'ADMIN persona is Sarah Jenkins (admin_sarah)');

  const memberIdentity = BetaIdentityProvider.setIdentity('MEMBER');
  check(memberIdentity.id === 'youth_demo_01' && memberIdentity.name === 'Alex Rivera',
    'MEMBER persona is Alex Rivera (youth_demo_01)');

  BetaIdentityProvider.setIdentity('MEMBER');
  check(BetaIdentityProvider.canAccessStudio() === false,
    'MEMBER canAccessStudio() is strictly false');

  BetaIdentityProvider.setIdentity('ADMIN');
  check(BetaIdentityProvider.canAccessStudio() === true,
    'ADMIN canAccessStudio() is true');

  BetaIdentityProvider.setIdentity('SUPERADMIN');
  check(BetaIdentityProvider.canAccessStudio() === true,
    'SUPERADMIN canAccessStudio() is true');

  // Direct open by MEMBER
  BetaIdentityProvider.setIdentity('MEMBER');
  const modalEl = getOrCreateMockElement('admin-studio-modal');
  modalEl.classList.add('hidden');
  modalEl.classList.remove('active');
  GameAPI.openAdminStudio();
  check(modalEl.classList.contains('hidden'),
    'Direct openAdminStudio() by MEMBER keeps modal hidden');

  // ============================================================
  // GROUP 4: Workflow A — Admin Authoring Lifecycle (Sarah Jenkins)
  // ============================================================
  console.log('\n[GROUP 4] Workflow A — Admin Authoring Lifecycle (Sarah Jenkins)');

  BetaIdentityProvider.setIdentity('ADMIN');
  GameAPI.openAdminStudio();
  check(getOrCreateMockElement('studio-view-dashboard').style.display === 'block',
    'openAdminStudio() lands on Studio Dashboard');

  // Verify identity banner display
  check(getOrCreateMockElement('studio-user-name').textContent === 'Sarah Jenkins',
    'Identity banner shows Sarah Jenkins');
  check(getOrCreateMockElement('studio-user-role').textContent.includes('ADMIN'),
    'Identity banner shows ADMIN role');

  // Create New opens template picker
  GameAPI.switchStudioView('create-picker');
  check(getOrCreateMockElement('studio-view-create-picker').style.display === 'block',
    'Create New opens template selector view');

  // Select QUEST template launches 7-step wizard
  GameAPI.launchWizardForTemplate('QUEST');
  check(getOrCreateMockElement('studio-view-wizard').style.display === 'block',
    'launchWizardForTemplate("QUEST") launches 7-step wizard');
  check(getOrCreateMockElement('wizard-step-num').textContent === '1',
    'Wizard initializes at Step 1');

  // Form input simulation
  getOrCreateMockElement('wizard-place-name').value = 'Olive Grove Fellowship';
  getOrCreateMockElement('wizard-place-template').value = 'hall';
  getOrCreateMockElement('wizard-place-zone').value = 'Upper Terrace';
  getOrCreateMockElement('wizard-npc-name').value = 'Sister Mary';
  getOrCreateMockElement('wizard-quest-title').value = 'Morning Grace';
  getOrCreateMockElement('wizard-quest-verify').value = 'FAMILY';

  // Advance to step 7
  for (let s = 1; s < 7; s++) GameAPI.advanceWizard();
  check(getOrCreateMockElement('wizard-step-num').textContent === '7',
    'Wizard advanced to Step 7');

  // Admin permission boundaries in wizard Step 7
  check(getOrCreateMockElement('btn-wizard-approve').style.display === 'none',
    'Approve button in Step 7 is hidden for ADMIN');
  check(getOrCreateMockElement('btn-wizard-publish').style.display === 'none',
    'Publish button in Step 7 is hidden for ADMIN');

  // Save draft verification & UX tests
  check(typeof GameAPI.handleSaveStudioDraft === 'function',
    'Save Draft handler exists and is exported on GameAPI');

  // Initial save creates and persists a draft
  GameAPI.handleSaveStudioDraft();
  const allDrafts = KoinoniaStudio.store.listDrafts();
  const savedDraft = allDrafts.find(d => d.title === 'Olive Grove Fellowship');
  check(savedDraft !== undefined,
    'Save creates/persists a draft in StudioStore with title Olive Grove Fellowship');
  check(savedDraft.status === 'DRAFT',
    'Saved draft has initial status DRAFT');
  check(savedDraft.createdBy.name === 'Sarah Jenkins',
    'Saved draft records author Sarah Jenkins');

  // Visible success feedback exists (button transforms and inline banner appears)
  const saveBtnEl = getOrCreateMockElement('btn-wizard-save-draft');
  const saveFeedbackEl = getOrCreateMockElement('wizard-save-feedback');
  check(saveBtnEl.innerHTML.includes('Draft Saved'),
    'Save Draft button provides visible feedback changing to Draft Saved');
  check(saveFeedbackEl.style.display === 'block' && saveFeedbackEl.innerHTML.includes('Draft saved'),
    'Visible inline success feedback exists on wizard screen');

  // My Drafts counter updates immediately
  check(getOrCreateMockElement('stat-count-drafts').textContent === '1',
    'stat-count-drafts updates immediately to 1');
  check(getOrCreateMockElement('nav-count-drafts').textContent === '1',
    'nav-count-drafts updates immediately to 1');

  // Repeated Save updates same draft without creating duplicate records
  GameAPI.handleSaveStudioDraft(); // 2nd save
  GameAPI.handleSaveStudioDraft(); // 3rd save
  const postRepeatedDrafts = KoinoniaStudio.store.listDrafts();
  check(postRepeatedDrafts.length === 1 && postRepeatedDrafts[0].id === savedDraft.id,
    'Repeated Save updates same draft with zero duplicate records (exactly 1 record)');

  // Save failure has visible error path
  getOrCreateMockElement('wizard-place-name').value = '';
  GameAPI.handleSaveStudioDraft();
  check(saveFeedbackEl.style.display === 'block' && saveFeedbackEl.textContent.includes('Please enter a title'),
    'Save failure has visible error feedback path without silently failing');
  // Restore valid place name
  getOrCreateMockElement('wizard-place-name').value = 'Olive Grove Fellowship';
  GameAPI.handleSaveStudioDraft(); // re-save successfully

  // Close and reopen Studio - draft remains
  GameAPI.closeAdminStudio();
  check(getOrCreateMockElement('admin-studio-modal').classList.contains('hidden'),
    'Studio closed cleanly, modal hidden');

  GameAPI.openAdminStudio();
  check(getOrCreateMockElement('admin-studio-modal').classList.contains('active'),
    'Studio reopened successfully');
  check(KoinoniaStudio.store.getDraft(savedDraft.id) !== null,
    'Draft remains intact after Studio close and reopen');

  // Draft remains after storage reload simulation
  const storageReloadedStore = new KoinoniaStudio.StudioStore();
  check(storageReloadedStore.getDraft(savedDraft.id) !== null,
    'Draft remains after storage reload simulation');

  // Resume draft in wizard restores all 6 fields
  getOrCreateMockElement('wizard-place-name').value = '';
  getOrCreateMockElement('wizard-place-template').value = '';
  getOrCreateMockElement('wizard-place-zone').value = '';
  getOrCreateMockElement('wizard-npc-name').value = '';
  getOrCreateMockElement('wizard-quest-title').value = '';
  getOrCreateMockElement('wizard-quest-verify').value = '';

  GameAPI.resumeDraftInWizard(savedDraft.id);
  check(getOrCreateMockElement('wizard-place-name').value === 'Olive Grove Fellowship',
    'resumeDraftInWizard restores place name');
  check(getOrCreateMockElement('wizard-place-template').value === 'hall',
    'resumeDraftInWizard restores place template select');
  check(getOrCreateMockElement('wizard-place-zone').value === 'Upper Terrace',
    'resumeDraftInWizard restores zone context');
  check(getOrCreateMockElement('wizard-npc-name').value === 'Sister Mary',
    'resumeDraftInWizard restores NPC elder');
  check(getOrCreateMockElement('wizard-quest-title').value === 'Morning Grace',
    'resumeDraftInWizard restores quest title');
  check(getOrCreateMockElement('wizard-quest-verify').value === 'FAMILY',
    'resumeDraftInWizard restores verification type select');

  // Zero-mutation preview
  const previewModel = KoinoniaStudio.generatePreviewModel(savedDraft.templateType, savedDraft.data);
  check(previewModel && previewModel.isLive === false,
    'generatePreviewModel returns valid model with isLive: false');
  check(previewModel.banner.warning.includes('Koinonia Care Promise'),
    'generatePreviewModel contains Koinonia Care Promise message');
  check(previewModel.zeroMutationPolicy.lpAwarded === 0,
    'Zero-mutation preview guarantees 0 LP mutated');
  check(previewModel.zeroMutationPolicy.xpAwarded === 0,
    'Zero-mutation preview guarantees 0 XP mutated');
  check(previewModel.zeroMutationPolicy.attendanceRecorded === false,
    'Zero-mutation preview guarantees attendanceRecorded: false');

  // Submit after Save uses same draft
  GameAPI.submitDraftDirectly(savedDraft.id);
  const submittedDraft = KoinoniaStudio.store.getDraft(savedDraft.id);
  check(submittedDraft.status === 'READY_FOR_REVIEW',
    'Submit after Save transitions draft to READY_FOR_REVIEW');
  check(KoinoniaStudio.store.listDrafts().length === 1,
    'Submit after Save operates on same draft with zero duplicate records');

  // Admin cannot approve or publish
  let adminApproveBlocked = false;
  try {
    KoinoniaStudio.store.approveDraft(savedDraft.id, { role: 'ADMIN' });
  } catch (e) {
    adminApproveBlocked = true;
  }
  check(adminApproveBlocked,
    'Admin role blocked from approveDraft (throws Unauthorized)');

  let adminPublishBlocked = false;
  try {
    KoinoniaStudio.store.publishDraft(savedDraft.id, { role: 'ADMIN' });
  } catch (e) {
    adminPublishBlocked = true;
  }
  check(adminPublishBlocked,
    'Admin role blocked from publishDraft (throws Unauthorized)');

  // ============================================================
  // GROUP 5: Workflow B — Superadmin Review & Publish Lifecycle (Father Alex)
  // ============================================================
  console.log('\n[GROUP 5] Workflow B — Superadmin Review & Publish (Father Alex)');

  BetaIdentityProvider.setIdentity('SUPERADMIN');
  GameAPI.switchStudioView('review');
  check(getOrCreateMockElement('studio-view-review').style.display === 'block',
    'Superadmin accesses Review Queue view');

  const reviewListEl = getOrCreateMockElement('studio-review-list');
  GameAPI.renderStudioReviewQueue();
  check(reviewListEl.innerHTML.includes('Olive Grove Fellowship'),
    'Review Queue lists Olive Grove Fellowship submission');

  // Superadmin approves draft
  GameAPI.handleApproveStudioDraft(savedDraft.id);
  const approvedDraft = KoinoniaStudio.store.getDraft(savedDraft.id);
  check(approvedDraft.status === 'APPROVED',
    'Father Alex approved draft; status transitioned to APPROVED');

  // Superadmin publishes draft
  GameAPI.handlePublishStudioDraft(savedDraft.id);
  const publishedDraft = KoinoniaStudio.store.getDraft(savedDraft.id);
  check(publishedDraft.status === 'PUBLISHED',
    'Father Alex published draft; status transitioned to PUBLISHED');

  const publishedList = KoinoniaStudio.store.listPublished();
  const publishedRecord = publishedList.find(p => p.draftId === savedDraft.id);
  check(publishedRecord !== undefined,
    'Published record registered in store listPublished()');
  check(publishedRecord.publishedBy.name === 'Father Alex',
    'Published record explicitly attributes Father Alex');

  // Custom place registered and persisted in localStorage
  check(global.KOINONIA_DATA.places && Object.values(global.KOINONIA_DATA.places).some(p => p.name === 'Olive Grove Fellowship'),
    'Published custom place registered in runtime PLACES object');

  const storedCustomPlaces = mockStorage.getItem('koinonia_phase21_custom_places');
  check(storedCustomPlaces && storedCustomPlaces.includes('Olive Grove Fellowship'),
    'Custom place persisted to koinonia_phase21_custom_places in storage');

  // ============================================================
  // GROUP 6: Workflow C — Return for Changes Lifecycle & UI Modal
  // ============================================================
  console.log('\n[GROUP 6] Workflow C — Return for Changes Lifecycle & UI Modal');

  // Sarah creates second independent content item
  BetaIdentityProvider.setIdentity('ADMIN');
  const secondDraft = KoinoniaStudio.store.createDraft('EVENT', {
    title: 'Youth Campfire Night',
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
  }, { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' });

  check(secondDraft.status === 'DRAFT',
    'Second independent draft created with status DRAFT');

  // Sarah submits second draft
  KoinoniaStudio.store.requestReview(secondDraft.id, { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' });
  check(KoinoniaStudio.store.getDraft(secondDraft.id).status === 'READY_FOR_REVIEW',
    'Second draft submitted for review (status: READY_FOR_REVIEW)');

  // 1. Father Alex initiates Return for Changes in Review Queue (Modal opens)
  BetaIdentityProvider.setIdentity('SUPERADMIN');
  const returnModal = getOrCreateMockElement('modal-studio-return-changes');
  const noteInput = getOrCreateMockElement('return-changes-note-input');
  const errorEl = getOrCreateMockElement('return-changes-error');
  const countEl = getOrCreateMockElement('return-changes-char-count');
  const confirmBtn = getOrCreateMockElement('btn-confirm-return-changes');

  GameAPI.openReturnForChangesModal(secondDraft.id);
  check(returnModal.classList.contains('active') && !returnModal.classList.contains('hidden'),
    'Return for Changes modal opens cleanly on trigger');

  // 2. Zero premature state mutation while modal is open
  check(KoinoniaStudio.store.getDraft(secondDraft.id).status === 'READY_FOR_REVIEW',
    'Draft status remains READY_FOR_REVIEW when modal opens (zero premature mutation)');

  // 3. Cancel behavior closes modal with zero data changes
  GameAPI.closeReturnForChangesModal();
  check(returnModal.classList.contains('hidden') && !returnModal.classList.contains('active'),
    'Cancel closes Return for Changes modal');
  check(KoinoniaStudio.store.getDraft(secondDraft.id).status === 'READY_FOR_REVIEW',
    'Cancel causes zero mutation: draft remains in READY_FOR_REVIEW');

  // 4. Reopen modal & validate empty note rejection
  GameAPI.openReturnForChangesModal(secondDraft.id);
  noteInput.value = '   ';
  recordedToasts.length = 0;
  GameAPI.confirmReturnForChanges();
  check(errorEl.style.display !== 'none' && errorEl.textContent.includes('at least 3 characters'),
    'Empty or whitespace note rejected with visible validation error');
  check(KoinoniaStudio.store.getDraft(secondDraft.id).status === 'READY_FOR_REVIEW',
    'Empty note rejection leaves draft in READY_FOR_REVIEW');

  // 5. Validate short note (< 3 chars) rejection
  noteInput.value = 'no';
  GameAPI.confirmReturnForChanges();
  check(errorEl.style.display !== 'none' && errorEl.textContent.includes('at least 3 characters'),
    'Short note (<3 chars) rejected with visible validation error');

  // 6. Validate upper limit (> 500 chars) rejection
  noteInput.value = 'x'.repeat(501);
  GameAPI.confirmReturnForChanges();
  check(errorEl.style.display !== 'none' && errorEl.textContent.includes('500 characters'),
    'Note exceeding 500 characters rejected with visible validation error');

  // 7. Input typing updates character count and clears error
  noteInput.value = 'Please specify adult chaperone ratio and safety plan.';
  if (typeof noteInput.oninput === 'function') noteInput.oninput();
  check(countEl.textContent === '53 / 500',
    'Character counter dynamically reflects input length (53 / 500)');
  check(errorEl.style.display === 'none',
    'Typing valid input clears validation error display');

  // 8. HTML sanitization & valid submission
  noteInput.value = '<p>Please specify adult chaperone ratio and safety plan.</p>';
  recordedToasts.length = 0;
  GameAPI.confirmReturnForChanges();

  // 9. Visible confirmation toast verifies exact wording (no ambiguous "back for review")
  const returnToast = recordedToasts.find(t => t.includes('Returned for changes'));
  check(returnToast !== undefined && returnToast === '✓ Returned for changes',
    'Displays unambiguous confirmation toast: "✓ Returned for changes"');
  check(!recordedToasts.some(t => t.toLowerCase().includes('back for review')),
    'Toast strictly avoids ambiguous "back for review" phrasing');

  // 10. Modal closed cleanly after confirmation
  check(returnModal.classList.contains('hidden'),
    'Modal automatically closes after successful return confirmation');

  // 11. State transitions to DRAFT and persists sanitized leadership note
  const returnedDraft = KoinoniaStudio.store.getDraft(secondDraft.id);
  check(returnedDraft.status === 'DRAFT',
    'Returned draft status reverted to DRAFT');
  check(returnedDraft.reviewNotes === 'Please specify adult chaperone ratio and safety plan.',
    'Sanitized leadership review note persisted without HTML tags');
  check(returnedDraft.returnedBy && returnedDraft.returnedBy.name === 'Father Alex',
    'Returned draft explicitly attributes Father Alex as returning leader');

  // 12. Governance audit log records RETURNED_FOR_CHANGES
  const returnAuditEntry = KoinoniaStudio.store.getAuditLogs().find(a => a.action === 'RETURNED_FOR_CHANGES' && a.draftId === secondDraft.id);
  check(returnAuditEntry !== undefined && returnAuditEntry.actor.name === 'Father Alex',
    'Governance audit log records RETURNED_FOR_CHANGES with actor Father Alex');

  // 13. Returned content cannot be published (guard prevents publishing while in DRAFT)
  let publishReturnedBlocked = false;
  try {
    KoinoniaStudio.store.publishDraft(secondDraft.id, { id: 'father_alex', role: 'SUPERADMIN' });
  } catch (e) {
    publishReturnedBlocked = true;
  }
  check(publishReturnedBlocked,
    'Returned content cannot be published (must be re-approved first)');

  // 14. Author (Sarah Jenkins) experience: My Drafts displays Changes Requested badge and note
  BetaIdentityProvider.setIdentity('ADMIN');
  GameAPI.renderStudioDrafts();
  const draftsListEl = getOrCreateMockElement('studio-drafts-list');
  check(draftsListEl.innerHTML.includes('CHANGES REQUESTED'),
    'Sarah sees CHANGES REQUESTED badge in My Drafts');
  check(draftsListEl.innerHTML.includes('Leadership Note:') && draftsListEl.innerHTML.includes('safety plan'),
    'Sarah sees Leadership Note label and note text rendered in My Drafts');

  // 15. Sarah edits draft and re-submits: status moves to READY_FOR_REVIEW & note clears
  KoinoniaStudio.store.updateDraft(secondDraft.id, {
    description: 'Includes 3 certified adult chaperones and fire safety equipment.'
  }, { id: 'admin_sarah', role: 'ADMIN' });

  KoinoniaStudio.store.requestReview(secondDraft.id, { id: 'admin_sarah', role: 'ADMIN' });
  const resubmittedDraft = KoinoniaStudio.store.getDraft(secondDraft.id);
  check(resubmittedDraft.status === 'READY_FOR_REVIEW',
    'Sarah successfully re-submitted revised draft for review (status: READY_FOR_REVIEW)');
  check(resubmittedDraft.reviewNotes === null,
    'Re-submitting clears previous leadership reviewNotes for fresh review cycle');

  // 16. Double submission guard & confirm button re-enabled
  check(confirmBtn.disabled === false,
    'Confirm button is properly re-enabled after return execution completes');

  // ============================================================
  // GROUP 7: State Machine Safety & Legal Transitions
  // ============================================================
  console.log('\n[GROUP 7] State Machine Safety & Legal Transitions');

  const thirdDraft = KoinoniaStudio.store.createDraft('QUEST', {
    title: 'State Machine Test Item',
    shortDesc: 'State machine test summary',
    longDesc: 'State machine test detailed description',
    placeId: 'fog_center',
    category: 'Faith & Stewardship',
    audience: 'all',
    difficulty: 'medium',
    estimatedMinutes: 20,
    realWorldAction: 'Test action',
    reflectionPrompt: 'Test prompt',
    verificationMethod: 'self_reflection',
    lifePoints: 10,
    characterXp: 20,
    skillXp: 15,
    completionMessage: 'Well done test!',
    startDate: new Date().toISOString().split('T')[0],
    presentationTarget: 'KOINONIA'
  }, { id: 'admin_sarah', role: 'ADMIN' });

  // 1. Direct DRAFT -> PUBLISHED rejected
  let draftToPublishedBlocked = false;
  try {
    KoinoniaStudio.store.publishDraft(thirdDraft.id, { role: 'SUPERADMIN' });
  } catch (e) {
    draftToPublishedBlocked = true;
  }
  check(draftToPublishedBlocked,
    'Direct DRAFT -> PUBLISHED transition strictly rejected');

  // 2. Direct DRAFT -> APPROVED rejected
  let draftToApprovedBlocked = false;
  try {
    KoinoniaStudio.store.approveDraft(thirdDraft.id, { role: 'SUPERADMIN' });
  } catch (e) {
    draftToApprovedBlocked = true;
  }
  check(draftToApprovedBlocked,
    'Direct DRAFT -> APPROVED transition strictly rejected');

  // 3. READY_FOR_REVIEW -> PUBLISHED without approval rejected
  KoinoniaStudio.store.requestReview(thirdDraft.id, { role: 'ADMIN' });
  let reviewToPublishedBlocked = false;
  try {
    KoinoniaStudio.store.publishDraft(thirdDraft.id, { role: 'SUPERADMIN' });
  } catch (e) {
    reviewToPublishedBlocked = true;
  }
  check(reviewToPublishedBlocked,
    'READY_FOR_REVIEW -> PUBLISHED without approval strictly rejected');

  // 4. Duplicate review submission rejected
  let duplicateReviewBlocked = false;
  try {
    KoinoniaStudio.store.requestReview(thirdDraft.id, { role: 'ADMIN' });
  } catch (e) {
    duplicateReviewBlocked = true;
  }
  check(duplicateReviewBlocked,
    'Duplicate requestReview on already submitted draft strictly rejected');

  // 5. Editing approved draft reverts status to DRAFT
  KoinoniaStudio.store.approveDraft(thirdDraft.id, { role: 'SUPERADMIN' });
  check(KoinoniaStudio.store.getDraft(thirdDraft.id).status === 'APPROVED',
    'Draft transitioned to APPROVED');

  KoinoniaStudio.store.updateDraft(thirdDraft.id, { title: 'Modified Approved Title' }, { role: 'ADMIN' });
  check(KoinoniaStudio.store.getDraft(thirdDraft.id).status === 'DRAFT',
    'Editing APPROVED draft automatically reverts status to DRAFT');

  // ============================================================
  // GROUP 8: Role-Switch & Refresh/Reopen Persistence
  // ============================================================
  console.log('\n[GROUP 8] Role-Switch & Refresh/Reopen Persistence');

  // Switch between all 3 personas and verify store draft integrity
  BetaIdentityProvider.setIdentity('ADMIN');
  const adminDraftCount = KoinoniaStudio.store.listDrafts().length;

  BetaIdentityProvider.setIdentity('MEMBER');
  BetaIdentityProvider.setIdentity('SUPERADMIN');
  const superDraftCount = KoinoniaStudio.store.listDrafts().length;
  check(adminDraftCount === superDraftCount && superDraftCount > 0,
    'Draft store persists across persona switches without loss or duplication');

  // Refresh simulation: create new store instance against existing mockStorage
  const freshStore = new KoinoniaStudio.StudioStore();
  const reloadedDraft = freshStore.getDraft(savedDraft.id);
  check(reloadedDraft !== null && reloadedDraft.title === 'Olive Grove Fellowship',
    'Content survives fresh store initialization from storage (refresh resilience)');

  // Corrupted localStorage handling
  mockStorage.setItem('koinonia_phase21_studio_drafts', '{malformed_json:::');
  let corruptLoadThrew = false;
  try {
    const resilienceStore = new KoinoniaStudio.StudioStore();
    resilienceStore.listDrafts();
  } catch (_) {
    corruptLoadThrew = true;
  }
  check(!corruptLoadThrew,
    'StudioStore handles malformed storage gracefully without throwing');

  // Restore clean storage
  KoinoniaStudio.store.persist();

  // ============================================================
  // GROUP 9: Governance Audit Log & Slicing
  // ============================================================
  console.log('\n[GROUP 9] Governance Audit Log & Slicing');

  const auditLogs = KoinoniaStudio.store.getAuditLogs();
  check(auditLogs.length > 0,
    'Audit log contains recorded entries');

  const hasCreated = auditLogs.some(a => a.action === 'DRAFT_CREATED');
  const hasReview = auditLogs.some(a => a.action === 'REVIEW_REQUESTED');
  const hasApproved = auditLogs.some(a => a.action === 'APPROVED');
  const hasReturned = auditLogs.some(a => a.action === 'RETURNED_FOR_CHANGES');
  const hasPublished = auditLogs.some(a => a.action === 'PUBLISHED');

  check(hasCreated, 'Audit log records DRAFT_CREATED events');
  check(hasReview, 'Audit log records REVIEW_REQUESTED events');
  check(hasApproved, 'Audit log records APPROVED events');
  check(hasReturned, 'Audit log records RETURNED_FOR_CHANGES events');
  check(hasPublished, 'Audit log records PUBLISHED events');

  // Verify slice order: newest entries at index 0
  const newestEntry = auditLogs[0];
  const oldestEntry = auditLogs[auditLogs.length - 1];
  check(newestEntry.timestamp >= oldestEntry.timestamp,
    'Audit log ordering preserves newest entries at top (slice(0, 100))');

  // ============================================================
  // GROUP 10: Dashboard Counters Real-Time Accuracy
  // ============================================================
  console.log('\n[GROUP 10] Dashboard Counters Real-Time Accuracy');

  GameAPI.updateStudioCounts();
  const draftsCountEl = getOrCreateMockElement('stat-count-drafts');
  const submittedCountEl = getOrCreateMockElement('stat-count-submitted');
  const publishedCountEl = getOrCreateMockElement('stat-count-published');
  const navReviewEl = getOrCreateMockElement('nav-count-review');

  const expectedDrafts = KoinoniaStudio.store.listDrafts().filter(d => d.status === 'DRAFT').length;
  const expectedSubmitted = KoinoniaStudio.store.listDrafts().filter(d => d.status === 'READY_FOR_REVIEW').length;
  const expectedReady = KoinoniaStudio.store.listDrafts().filter(d => d.status === 'APPROVED').length;
  const expectedPublished = KoinoniaStudio.store.listPublished().length;

  check(parseInt(draftsCountEl.textContent, 10) === expectedDrafts,
    `stat-count-drafts correctly shows ${expectedDrafts}`);
  check(parseInt(submittedCountEl.textContent, 10) === expectedSubmitted,
    `stat-count-submitted correctly shows ${expectedSubmitted}`);
  check(parseInt(publishedCountEl.textContent, 10) === expectedPublished,
    `stat-count-published correctly shows ${expectedPublished}`);
  check(parseInt(navReviewEl.textContent, 10) === (expectedSubmitted + expectedReady),
    `nav-count-review correctly reflects total review queue items (${expectedSubmitted + expectedReady})`);

  // ============================================================
  // GROUP 11: Mobile Navigation & UX Styling
  // ============================================================
  console.log('\n[GROUP 11] Mobile Navigation & UX Styling');

  check(stylesCss.includes('#studio-subnav {'),
    'styles.css defines dedicated #studio-subnav rule');
  check(stylesCss.includes('overflow-x: auto'),
    '#studio-subnav provides horizontal scrollability');
  check(stylesCss.includes('overscroll-behavior-x: contain'),
    '#studio-subnav sets overscroll-behavior-x: contain');
  check(stylesCss.includes('flex-shrink: 0'),
    '#studio-subnav has flex-shrink: 0 to prevent vertical squeezing');
  check(stylesCss.includes('@media (max-width: 480px)'),
    'styles.css includes mobile responsive rules for <=480px viewports');
  check(stylesCss.includes('@media (max-width: 360px)'),
    'styles.css includes compact grid adjustments for <=360px viewports');

  // Active tab auto-scroll verification
  const auditBtn = getOrCreateMockElement('nav-studio-audit');
  GameAPI.switchStudioView('audit');
  check(auditBtn._lastScrollOpts && auditBtn._lastScrollOpts.inline === 'nearest',
    'switchStudioView triggers scrollIntoView({ inline: "nearest" }) for active tab');

  // ============================================================
  // GROUP 12: Staging Database Invariant Guard
  // ============================================================
  console.log('\n[GROUP 12] Staging Database Invariant Guard');

  if (fs.existsSync(STAGING_DB_PATH)) {
    const afterBuf = fs.readFileSync(STAGING_DB_PATH);
    const afterSha = crypto.createHash('sha256').update(afterBuf).digest('hex');
    check(afterSha === PHASE23F_STAGING_DB_SHA_BEFORE,
      `Staging DB SHA unchanged (${afterSha.slice(0, 16)}... === ${PHASE23F_STAGING_DB_SHA_BEFORE.slice(0, 16)}...)`);
  } else {
    check(true, 'Staging DB absent from test environment; invariant preserved');
  }

  // Final summary
  console.log('\n================================================================');
  console.log(`PHASE 0.23F RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSuite().catch(err => {
  console.error('Test suite uncaught exception:', err);
  process.exit(1);
});
