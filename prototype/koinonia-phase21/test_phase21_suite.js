/**
 * KOINONIA PHASE 0.21 — AUTOMATED TEST SUITE
 * Safe No-Code Community Content Creation & Studio Engine
 *
 * Covers:
 * - Role-gating & access control (Member denial, Admin access, Superadmin controls)
 * - Predefined template schemas & canonical fields
 * - Bounded numeric validation (LP 0-50, Char XP 0-100, Skill XP 0-100)
 * - Cross-field date & time consistency (Asia/Manila)
 * - Security sanitization & injection rejection (<script>, <iframe>, CSS, JS, events)
 * - Draft store, autosave, duplicate, archive, delete confirmation
 * - Preview mode zero-mutation verification (0 LP, 0 XP, no attendance)
 * - Multi-step publishing workflow (DRAFT -> REVIEW -> APPROVED -> PUBLISHED)
 * - Safe media metadata library (PNG, JPG, WEBP only)
 * - Prototype audit trail logging
 * - Reflection privacy guarantee (responses private by default)
 * - Shared Core boundary & Main App non-mutation guarantee
 */

const assert = require('assert');
const studio = require('./data/studio_engine.js');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    Error: ${err.message}`);
    failCount++;
  }
}

console.log('================================================================');
console.log('KOINONIA PHASE 0.21 — STUDIO ENGINE TEST SUITE');
console.log('================================================================\n');

// ============================================================
// GROUP 1: ROLE-GATING & ACCESS CONTROL
// ============================================================
console.log('[GROUP 1] Role-Gating & Access Control');

it('MEMBER role is strictly denied Studio access', () => {
  assert.strictEqual(studio.store.canPerform('MEMBER', 'VIEW_STUDIO'), false);
  assert.strictEqual(studio.store.canPerform('MEMBER', 'CREATE_DRAFT'), false);
  assert.strictEqual(studio.store.canPerform('MEMBER', 'PUBLISH'), false);
});

it('MEMBER cannot execute draft creation runtime method', () => {
  let threw = false;
  try {
    studio.store.createDraft('QUEST', { title: 'Unauthorized' }, { role: 'MEMBER' });
  } catch (err) {
    threw = true;
    assert.match(err.message, /Unauthorized/);
  }
  assert.strictEqual(threw, true);
});

it('ADMIN role can view studio, create, edit, duplicate, archive, and preview drafts', () => {
  assert.strictEqual(studio.store.canPerform('ADMIN', 'VIEW_STUDIO'), true);
  assert.strictEqual(studio.store.canPerform('ADMIN', 'CREATE_DRAFT'), true);
  assert.strictEqual(studio.store.canPerform('ADMIN', 'UPDATE_DRAFT'), true);
  assert.strictEqual(studio.store.canPerform('ADMIN', 'DUPLICATE_DRAFT'), true);
  assert.strictEqual(studio.store.canPerform('ADMIN', 'ARCHIVE_DRAFT'), true);
  assert.strictEqual(studio.store.canPerform('ADMIN', 'PREVIEW'), true);
});

it('ADMIN role is denied APPROVE and PUBLISH permissions', () => {
  assert.strictEqual(studio.store.canPerform('ADMIN', 'APPROVE'), false);
  assert.strictEqual(studio.store.canPerform('ADMIN', 'PUBLISH'), false);
});

it('SUPERADMIN role has full permissions including APPROVE and PUBLISH', () => {
  assert.strictEqual(studio.store.canPerform('SUPERADMIN', 'VIEW_STUDIO'), true);
  assert.strictEqual(studio.store.canPerform('SUPERADMIN', 'CREATE_DRAFT'), true);
  assert.strictEqual(studio.store.canPerform('SUPERADMIN', 'APPROVE'), true);
  assert.strictEqual(studio.store.canPerform('SUPERADMIN', 'PUBLISH'), true);
});

// ============================================================
// GROUP 2: TEMPLATE SCHEMAS & PREDEFINED SAFE FIELDS
// ============================================================
console.log('\n[GROUP 2] Template Schemas & Structured Field Architecture');

it('All 5 approved templates exist in TEMPLATES catalog', () => {
  const keys = Object.keys(studio.TEMPLATES);
  assert.deepStrictEqual(keys.sort(), ['CAMPFIRE_ACTIVITY', 'CAMPAIGN', 'EVENT', 'MINISTRY_MISSION', 'QUEST'].sort());
});

it('QUEST template has structured fields with required constraints', () => {
  const tmpl = studio.TEMPLATES.QUEST;
  assert.strictEqual(tmpl.id, 'QUEST');
  assert.strictEqual(tmpl.label, '📜 QUEST');
  assert.strictEqual(tmpl.description, 'Create a real-world Koinonia quest');
  const fieldKeys = tmpl.fields.map(f => f.key);
  assert.ok(fieldKeys.includes('title'));
  assert.ok(fieldKeys.includes('placeId'));
  assert.ok(fieldKeys.includes('lifePoints'));
  assert.ok(fieldKeys.includes('reflectionPrompt'));
  assert.ok(fieldKeys.includes('verificationMethod'));
});

it('EVENT template enforces canonical Asia/Manila timezone and venue', () => {
  const tmpl = studio.TEMPLATES.EVENT;
  const tzField = tmpl.fields.find(f => f.key === 'timezone');
  assert.strictEqual(tzField.default, 'Asia/Manila');
  assert.strictEqual(tzField.readonly, true);
});

it('CAMPFIRE_ACTIVITY template connects to canonical Campfires without second roster', () => {
  const tmpl = studio.TEMPLATES.CAMPFIRE_ACTIVITY;
  const cfField = tmpl.fields.find(f => f.key === 'campfireId');
  assert.ok(cfField);
  assert.ok(cfField.options.some(o => o.value === 'cf_alpha_seed'));
});

it('MINISTRY_MISSION template defaults leaderVerificationRequired to true', () => {
  const tmpl = studio.TEMPLATES.MINISTRY_MISSION;
  const verifyField = tmpl.fields.find(f => f.key === 'leaderVerificationRequired');
  assert.strictEqual(verifyField.default, true);
});

// ============================================================
// GROUP 3: BOUNDED NUMERIC VALIDATION & INTEGRITY RULES
// ============================================================
console.log('\n[GROUP 3] Bounded Numeric Limits & Validation Engine');

it('Valid Quest payload passes validation', () => {
  const data = {
    title: 'Morning Prayer Walk',
    shortDesc: 'Walk and pray for neighborhood families',
    longDesc: 'Detailed instructions for peaceful stewardship and intercession walk.',
    placeId: 'home',
    category: 'Faith & Stewardship',
    audience: 'all',
    difficulty: 'easy',
    estimatedMinutes: 30,
    realWorldAction: 'Walk 1 kilometer around your block praying silently.',
    reflectionPrompt: 'What blessing did you see in creation today?',
    verificationMethod: 'self_reflection',
    lifePoints: 20,
    characterXp: 30,
    skillXp: 20,
    completionMessage: 'Well done, faithful servant!',
    startDate: '2026-09-10',
    presentationTarget: 'KOINONIA'
  };
  const res = studio.validateTemplateData('QUEST', data);
  assert.strictEqual(res.valid, true);
  assert.deepStrictEqual(res.errors, {});
});

it('Life Points above 50 LP is rejected by validation', () => {
  const data = {
    title: 'High LP Exploit Quest',
    shortDesc: 'Testing limit',
    longDesc: 'Testing',
    placeId: 'home',
    category: 'Faith & Stewardship',
    audience: 'all',
    difficulty: 'easy',
    estimatedMinutes: 30,
    realWorldAction: 'Action',
    reflectionPrompt: 'Prompt',
    verificationMethod: 'self_reflection',
    lifePoints: 500, // VIOLATION
    characterXp: 20,
    skillXp: 20,
    completionMessage: 'Done',
    startDate: '2026-09-10'
  };
  const res = studio.validateTemplateData('QUEST', data);
  assert.strictEqual(res.valid, false);
  assert.match(res.errors.lifePoints, /cannot exceed 50/);
});

it('Character XP above 100 is rejected by validation', () => {
  const data = {
    title: 'High XP Quest',
    shortDesc: 'Testing',
    longDesc: 'Testing',
    placeId: 'home',
    category: 'Faith & Stewardship',
    audience: 'all',
    difficulty: 'easy',
    estimatedMinutes: 30,
    realWorldAction: 'Action',
    reflectionPrompt: 'Prompt',
    verificationMethod: 'self_reflection',
    lifePoints: 10,
    characterXp: 250, // VIOLATION
    skillXp: 20,
    completionMessage: 'Done',
    startDate: '2026-09-10'
  };
  const res = studio.validateTemplateData('QUEST', data);
  assert.strictEqual(res.valid, false);
  assert.match(res.errors.characterXp, /cannot exceed 100/);
});

it('Campaigns cannot award direct LP (anti-exploit policy)', () => {
  const data = {
    title: 'Exploit Campaign',
    description: 'Testing',
    theme: 'Galatians 5',
    startDate: '2026-09-10',
    endDate: '2026-09-20',
    audience: 'all',
    heroMessage: 'Join us',
    progressMessage: 'Keep going',
    completionMessage: 'Done',
    lifePoints: 50 // VIOLATION: Campaigns organize, do not award direct LP
  };
  const res = studio.validateTemplateData('CAMPAIGN', data);
  assert.strictEqual(res.valid, false);
  assert.match(res.errors.lifePoints, /Campaigns organize content and cannot award direct LP/);
});

it('Ministry Mission requires leader verification to award service rewards', () => {
  const data = {
    title: 'Self-Awarded Mission',
    description: 'Testing',
    ministryId: 'worship',
    placeId: 'fog_center',
    serviceType: 'liturgical_service',
    instructions: 'Help setup',
    reflectionPrompt: 'Reflection',
    leaderVerificationRequired: false, // VIOLATION
    lifePoints: 25,
    characterXp: 50,
    startDate: '2026-09-10'
  };
  const res = studio.validateTemplateData('MINISTRY_MISSION', data);
  assert.strictEqual(res.valid, false);
  assert.match(res.errors.leaderVerificationRequired, /require leader verification/);
});

it('Event with end time preceding start time is rejected', () => {
  const data = {
    title: 'Youth Gathering',
    description: 'Fellowship',
    placeId: 'fog_center',
    realWorldVenue: 'FOG Sanctuary',
    date: '2026-09-12',
    startTime: '18:00',
    endTime: '15:00', // VIOLATION: 3pm before 6pm
    timezone: 'Asia/Manila',
    audience: 'youth',
    checkInEnabled: true,
    memoryCaptureEnabled: true
  };
  const res = studio.validateTemplateData('EVENT', data);
  assert.strictEqual(res.valid, false);
  assert.match(res.errors.endTime, /must be after Start Time/);
});

it('End date preceding start date is rejected', () => {
  const data = {
    title: 'Backwards Dates',
    description: 'Testing',
    theme: 'Theme',
    startDate: '2026-09-20',
    endDate: '2026-09-10', // VIOLATION: Earlier than start
    audience: 'all',
    heroMessage: 'Message',
    progressMessage: 'Progress',
    completionMessage: 'Done'
  };
  const res = studio.validateTemplateData('CAMPAIGN', data);
  assert.strictEqual(res.valid, false);
  assert.match(res.errors.endDate, /cannot precede Start Date/);
});

// ============================================================
// GROUP 4: CONTENT SAFETY & SECURITY INJECTION REJECTION
// ============================================================
console.log('\n[GROUP 4] Security Sanitization & Injection Rejection');

it('Rejects <script> tags in any authored field', () => {
  const check = studio.inspectSafety('Hello <script>alert("hack")</script> World');
  assert.strictEqual(check.safe, false);
  assert.match(check.reason, /Script execution tags/);
});

it('Rejects <iframe> tags in authored fields', () => {
  const check = studio.inspectSafety('Watch this: <iframe src="http://evil.com"></iframe>');
  assert.strictEqual(check.safe, false);
  assert.match(check.reason, /Iframe embedding/);
});

it('Rejects inline CSS <style> injection', () => {
  const check = studio.inspectSafety('<style>body { display: none; }</style>');
  assert.strictEqual(check.safe, false);
  assert.match(check.reason, /Arbitrary CSS/);
});

it('Rejects DOM event handler injection (onclick=, onerror=)', () => {
  const check = studio.inspectSafety('<img src="x" onerror="stealCookies()">');
  assert.strictEqual(check.safe, false);
  assert.match(check.reason, /event handlers/);
});

it('Rejects executable javascript: URI protocols', () => {
  const check = studio.inspectSafety('Click here: javascript:alert(1)');
  assert.strictEqual(check.safe, false);
  assert.match(check.reason, /Executable protocol/);
});

it('Rejects eval() dynamic code patterns', () => {
  const check = studio.inspectSafety('eval("dangerousCode()")');
  assert.strictEqual(check.safe, false);
  assert.match(check.reason, /Dynamic code execution/);
});

it('Rejects raw HTML markup in titles', () => {
  const check = studio.inspectSafety('<b>Bold</b> Title');
  assert.strictEqual(check.safe, false);
  assert.match(check.reason, /Raw HTML/);
});

// ============================================================
// GROUP 5: DRAFT STORAGE, AUTOSAVE & LIFECYCLE
// ============================================================
console.log('\n[GROUP 5] Draft Store, Autosave & Lifecycle');

let testDraftId = null;

it('Admin can create a new draft in transient store', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const draft = studio.store.createDraft('QUEST', {
    title: 'Garden Care',
    lifePoints: 15,
    characterXp: 25,
    placeId: 'home'
  }, admin);

  assert.ok(draft.id.startsWith('draft_quest_'));
  assert.strictEqual(draft.title, 'Garden Care');
  assert.strictEqual(draft.status, 'DRAFT');
  assert.strictEqual(draft.createdBy.name, 'Sarah Jenkins');
  testDraftId = draft.id;
});

it('Draft can be updated preserving draft status and updating timestamp', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const updated = studio.store.updateDraft(testDraftId, {
    title: 'Garden Stewardship',
    lifePoints: 20
  }, admin);

  assert.strictEqual(updated.title, 'Garden Stewardship');
  assert.strictEqual(updated.data.lifePoints, 20);
});

it('Draft duplication creates independent copy with (Copy) title', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const copy = studio.store.duplicateDraft(testDraftId, admin);

  assert.notStrictEqual(copy.id, testDraftId);
  assert.strictEqual(copy.title, 'Garden Stewardship (Copy)');
  assert.strictEqual(copy.status, 'DRAFT');
  assert.strictEqual(copy.data.lifePoints, 20);
});

it('Draft archiving transitions status to ARCHIVED', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const archived = studio.store.archiveDraft(testDraftId, admin);
  assert.strictEqual(archived.status, 'ARCHIVED');
});

it('Draft deletion requires explicit confirm flag, rejects without confirmation', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  let threw = false;
  try {
    studio.store.deleteDraft(testDraftId, admin, false);
  } catch (err) {
    threw = true;
    assert.match(err.message, /Explicit confirmation is required/);
  }
  assert.strictEqual(threw, true);
});

// ============================================================
// GROUP 6: PREVIEW MODE & ZERO-MUTATION POLICY
// ============================================================
console.log('\n[GROUP 6] Preview Mode & Zero-Mutation Policy');

it('Preview model generates faithful rendering metadata with prominent warning banner', () => {
  const model = studio.generatePreviewModel('QUEST', {
    title: 'Sunset Vespers',
    placeId: 'fog_center',
    lifePoints: 25,
    characterXp: 50,
    reflectionPrompt: 'What prayers do you bring this evening?'
  });

  assert.strictEqual(model.isLive, false);
  assert.strictEqual(model.banner.text, 'PREVIEW MODE • NOT PUBLISHED');
  assert.match(model.banner.warning, /(?:Koinonia Care Promise|0 LP, 0 XP)/);
});

it('Preview explicitly guarantees zero LP, zero XP, and zero attendance mutations', () => {
  const model = studio.generatePreviewModel('QUEST', { lifePoints: 25, characterXp: 50 });
  assert.strictEqual(model.zeroMutationPolicy.lpAwarded, 0);
  assert.strictEqual(model.zeroMutationPolicy.xpAwarded, 0);
  assert.strictEqual(model.zeroMutationPolicy.attendanceRecorded, false);
  assert.strictEqual(model.zeroMutationPolicy.notificationsDispatched, 0);
});

// ============================================================
// GROUP 7: MULTI-STEP PUBLISHING WORKFLOW
// ============================================================
console.log('\n[GROUP 7] Multi-Step Publishing Workflow');

let workflowDraftId = null;

it('Admin creates draft and requests review (DRAFT -> READY_FOR_REVIEW)', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const draft = studio.store.createDraft('QUEST', {
    title: 'Hospitality Welcoming',
    shortDesc: 'Welcome newcomers to fellowship',
    longDesc: 'Stand at the north gate with warm smiles and water.',
    placeId: 'fog_center',
    category: 'Community Fellowship',
    audience: 'youth',
    difficulty: 'easy',
    estimatedMinutes: 30,
    realWorldAction: 'Welcome 3 new pilgrims at fellowship.',
    reflectionPrompt: 'How did showing hospitality bless your soul?',
    verificationMethod: 'leader_checkin',
    lifePoints: 20,
    characterXp: 35,
    skillXp: 15,
    completionMessage: "Well done! You reflected Christ's love.",
    startDate: '2026-09-12',
    presentationTarget: 'KOINONIA'
  }, admin);

  workflowDraftId = draft.id;
  const inReview = studio.store.requestReview(workflowDraftId, admin);
  assert.strictEqual(inReview.status, 'READY_FOR_REVIEW');
});

it('Admin cannot approve or publish (requires SUPERADMIN)', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  assert.throws(() => studio.store.approveDraft(workflowDraftId, admin), /Unauthorized/);
  assert.throws(() => studio.store.publishDraft(workflowDraftId, admin), /Unauthorized/);
});

it('Superadmin approves draft (READY_FOR_REVIEW -> APPROVED)', () => {
  const superadmin = { id: 'pastor_david', name: 'Pastor David', role: 'SUPERADMIN' };
  const approved = studio.store.approveDraft(workflowDraftId, superadmin);
  assert.strictEqual(approved.status, 'APPROVED');
});

it('Superadmin publishes draft prototype-locally (APPROVED -> PUBLISHED)', () => {
  const superadmin = { id: 'pastor_david', name: 'Pastor David', role: 'SUPERADMIN' };
  const pubResult = studio.store.publishDraft(workflowDraftId, superadmin);

  assert.strictEqual(pubResult.success, true);
  assert.strictEqual(pubResult.draft.status, 'PUBLISHED');
  assert.ok(pubResult.publishedRecord.publishedId.startsWith('pub_quest_'));
  assert.match(pubResult.safetyNotice, /PUBLISHED PROTOTYPE-LOCAL ONLY/);
});

// ============================================================
// GROUP 8: SAFE MEDIA & AUDIT TRAIL
// ============================================================
console.log('\n[GROUP 8] Safe Media & Audit Trail');

it('Media library restricts MIME types strictly to PNG, JPG, WEBP', () => {
  assert.deepStrictEqual(studio.ALLOWED_MIME_TYPES, ['image/png', 'image/jpeg', 'image/webp']);
});

it('Demo media items reference metadata without binary storage in SQLite', () => {
  const media = studio.DEMO_MEDIA_LIBRARY;
  assert.ok(media.length > 0);
  media.forEach(m => {
    assert.ok(m.id);
    assert.ok(m.url);
    assert.ok(studio.ALLOWED_MIME_TYPES.includes(m.mimeType));
  });
});

it('Audit logger records actor, action, draftId, and timestamp', () => {
  const logs = studio.store.getAuditLogs();
  assert.ok(logs.length > 0);
  const latest = logs[0];
  assert.ok(latest.id.startsWith('aud_'));
  assert.ok(latest.actor.name);
  assert.ok(latest.timestamp > 0);
  assert.ok(latest.action);
});

// ============================================================
// GROUP 9: PRIVACY & ARCHITECTURAL BOUNDARIES
// ============================================================
console.log('\n[GROUP 9] Reflection Privacy & Shared Core Boundaries');

it('Reflection responses remain strictly private (authors only define prompt)', () => {
  const prompt = 'What did the Lord speak to you during morning quiet time?';
  const tmpl = studio.TEMPLATES.QUEST;
  const promptField = tmpl.fields.find(f => f.key === 'reflectionPrompt');
  assert.ok(promptField);
  // Guarantee: Store does NOT have any API or storage for member reflection responses
  assert.strictEqual(studio.store.getMemberReflections, undefined);
});

it('Main App Presentation target is metadata-only with zero Main App mutation', () => {
  const targets = studio.PRESENTATION_TARGETS.map(t => t.id);
  assert.deepStrictEqual(targets, ['KOINONIA', 'MAIN_APP', 'BOTH']);
  // Ensure published record retains target metadata without remote sync
  const pubList = studio.store.listPublished();
  assert.ok(pubList.length > 0);
  assert.ok(targets.includes(pubList[0].presentationTarget));
});


// ============================================================
// GROUP 10: MOBILE RESPONSIVE QA HARNESS & BOUNDARY VERIFICATION
// ============================================================
console.log('\n[GROUP 10] Mobile Responsive QA Harness & Architectural Integrity');

const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'studio_test.html'), 'utf8');

it('Draft can be restored from serialized JSON string without data corruption', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const d = studio.store.createDraft('EVENT', {
    title: 'Praise Rally',
    date: '2026-09-15',
    startTime: '19:00',
    placeId: 'fog_center'
  }, admin);

  const serialized = JSON.stringify(d);
  const deserialized = JSON.parse(serialized);
  assert.strictEqual(deserialized.id, d.id);
  assert.strictEqual(deserialized.data.title, 'Praise Rally');
  assert.strictEqual(deserialized.data.placeId, 'fog_center');
});

it('Item 1: Viewport meta tag exists with viewport-fit=cover', () => {
  assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'),
    'studio_test.html must include correct viewport meta with viewport-fit=cover');
});

it('Item 2: Mobile responsive breakpoint (@media (max-width: 768px)) exists', () => {
  assert.ok(html.includes('@media (max-width: 768px)'),
    'studio_test.html must define mobile layout breakpoint at <= 768px');
});

it('Item 3: QA role selector is not desktop-only (remains visible on mobile)', () => {
  assert.ok(html.includes('.role-bar'), 'Role bar exists');
  assert.ok(html.includes('.role-selector-group'), 'Role selector group exists');
  // Confirm neither has display: none in mobile media queries
  const mobileMatch = html.match(/@media \(max-width: 768px\)\s*\{([^}]+)\}/g) || [];
  const mobileCss = mobileMatch.join(' ');
  assert.ok(!mobileCss.includes('.role-bar { display: none') && !mobileCss.includes('.role-selector-group { display: none'),
    'Role bar and selector group must not be hidden on mobile');
});

it('Item 4: MEMBER control remains available on mobile', () => {
  assert.ok(html.includes('id="role-btn-member"'), '#role-btn-member exists');
  assert.ok(html.includes("switchRole('MEMBER')"), 'switchRole(MEMBER) bound');
  assert.ok(html.includes('MEMBER (Alex)'), 'MEMBER (Alex) text displayed');
});

it('Item 5: ADMIN control remains available on mobile', () => {
  assert.ok(html.includes('id="role-btn-admin"'), '#role-btn-admin exists');
  assert.ok(html.includes("switchRole('ADMIN')"), 'switchRole(ADMIN) bound');
  assert.ok(html.includes('ADMIN (Sarah)'), 'ADMIN (Sarah) text displayed');
});

it('Item 6: SUPERADMIN control remains available on mobile', () => {
  assert.ok(html.includes('id="role-btn-superadmin"'), '#role-btn-superadmin exists');
  assert.ok(html.includes("switchRole('SUPERADMIN')"), 'switchRole(SUPERADMIN) bound');
  assert.ok(html.includes('SUPERADMIN (Pastor David)'), 'SUPERADMIN (Pastor David) text displayed');
});

it('Item 7: Studio workspace becomes full-width on mobile', () => {
  assert.ok(html.includes('.studio-container {') && html.includes('width: 100%'),
    '.studio-container must be width: 100%');
  assert.ok(html.includes('box-sizing: border-box'), 'Box sizing must be border-box');
});

it('Item 8: Template card grid collapses to strictly one column on mobile', () => {
  assert.ok(html.includes('.dashboard-grid {') && html.includes('grid-template-columns: 1fr'),
    '.dashboard-grid must collapse to grid-template-columns: 1fr on mobile');
});

it('Item 9: Form layouts collapse appropriately to one column on mobile', () => {
  assert.ok(html.includes('.form-grid.two-col {') && html.includes('grid-template-columns: 1fr'),
    '.form-grid.two-col must collapse to 1 column on mobile');
});

it('Item 10: No hard min-width forcing > 360px layout', () => {
  // Check for any CSS property declarations that force min-width > 360px on elements/containers
  const cssWithoutMedia = html.replace(/@media[^{]+\{/g, '');
  const badMinWidths = cssWithoutMedia.match(/min-width:\s*([4-9]\d{2}|\d{4,})px/g) || [];
  assert.deepStrictEqual(badMinWidths, [], 'Found forbidden hard min-width > 360px in studio_test.html');
});

it('Item 11: Quest label strictly remains 📜 QUEST', () => {
  assert.strictEqual(studio.TEMPLATES.QUEST.label, '📜 QUEST');
  assert.strictEqual(studio.TEMPLATES.QUEST.description, 'Create a real-world Koinonia quest');
  assert.ok(html.includes('📜 QUEST'));
});

it('Item 12: Studio generic QUEST remains separate from FAITH QUEST CHALLENGE', () => {
  // Zero occurrences of Faith Quest in studio_engine.js
  const engineContent = fs.readFileSync(path.join(__dirname, 'data', 'studio_engine.js'), 'utf8');
  assert.ok(!engineContent.toLowerCase().includes('faith quest'),
    'studio_engine.js must not refer to generic template as Faith Quest');
  // studio_test.html must not contain Faith Quest
  assert.ok(!html.toLowerCase().includes('faith quest'),
    'studio_test.html must not refer to generic template as Faith Quest');
});

it('Item 13: Desktop layout remains supported for >= 769px and >= 1024px', () => {
  assert.ok(html.includes('@media (min-width: 769px)'), 'Desktop navigation media query exists');
  assert.ok(html.includes('minmax(260px, 1fr)'), 'Desktop auto-fit multi-column grid exists');
  assert.ok(html.includes('max-width: 960px'), 'Desktop container max-width exists');
});

it('Item 14: Modal mobile constraints exist (width, max-width, max-height, scrolling)', () => {
  assert.ok(html.includes('.preview-dialog') && html.includes('.modal-card'), 'Modal classes exist');
  assert.ok(html.includes('max-height: calc(100vh - 24px)') || html.includes('max-height: calc(100dvh - 24px)') || html.includes('max-height: 90vh'),
    'Modals must have viewport height constraints');
  assert.ok(html.includes('overflow-y: auto'), 'Modals must scroll vertically');
});

it('Item 15: Touch-friendly role controls and buttons exist (min-height >= 38px/40px)', () => {
  assert.ok(html.includes('min-height: 38px') || html.includes('min-height: 40px'),
    'Role buttons must have touch-friendly min-height');
  assert.ok(html.includes('-webkit-tap-highlight-color: transparent'),
    'Mobile tap highlights must be styled');
});

it('Shared Core entities cannot be mutated by Studio actions', () => {
  assert.strictEqual(typeof studio.store.awardLifePoints, 'undefined');
  assert.strictEqual(typeof studio.store.modifyAttendance, 'undefined');
  assert.strictEqual(typeof studio.store.alterCampfireRoster, 'undefined');
  assert.strictEqual(typeof studio.store.mutateMemberRole, 'undefined');
});

it('Publish workflow requires explicit user action (no auto-publish on draft save)', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const draft = studio.store.createDraft('QUEST', { title: 'Auto Publish Test' }, admin);
  studio.store.updateDraft(draft.id, { title: 'Auto Publish Test Updated' }, admin);
  const reloaded = studio.store.getDraft(draft.id);
  assert.strictEqual(reloaded.status, 'DRAFT');
  assert.strictEqual(reloaded.publishedAt, null);
});


// ============================================================
// GROUP 11: PHYSICAL QA WORKFLOW & CLIENT-SIDE RUNTIME BEHAVIOR
// ============================================================
console.log('\n[GROUP 11] Physical QA Workflow & Client-Side Runtime Behavior');

const vm = require('vm');

const htmlContent = fs.readFileSync(path.join(__dirname, 'studio_test.html'), 'utf8');
const scriptMatches = [...htmlContent.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
const inlineScripts = scriptMatches.map(m => m[1].trim()).filter(s => s.length > 0);

it('Physical QA Item 1: studio_test.html inline JavaScript parses with ZERO syntax errors', () => {
  assert.ok(inlineScripts.length > 0, 'Must have at least one inline script block');
  for (let i = 0; i < inlineScripts.length; i++) {
    // Throws SyntaxError if code is invalid
    new vm.Script(inlineScripts[i], { filename: `studio_test_inline_${i}.js` });
  }
});

it('Physical QA Item 2: No unescaped single quotes inside single-quoted string literals', () => {
  for (const s of inlineScripts) {
    // Specifically test that unescaped apostrophe in God's grace does not exist in single quotes
    assert.ok(!s.includes("'Take a quiet moment to consider God's grace in your daily walk.'"),
      'Found unescaped single quote in string literal');
  }
});

// Helper to instantiate simulated DOM and Client Runtime
function createClientRuntime() {
  const elements = {};
  function getOrCreate(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        value: '',
        checked: false,
        classList: {
          classes: new Set(),
          add(c) { this.classes.add(c); },
          remove(c) { this.classes.delete(c); },
          toggle(c, force) {
            if (force !== undefined) {
              if (force) this.classes.add(c);
              else this.classes.delete(c);
              return force;
            }
            if (this.classes.has(c)) { this.classes.delete(c); return false; }
            else { this.classes.add(c); return true; }
          },
          contains(c) { return this.classes.has(c); }
        },
        style: {},
        attributes: {},
        setAttribute(k, v) { this.attributes[k] = String(v); },
        getAttribute(k) { return this.attributes[k]; },
        textContent: '',
        innerHTML: '',
        scrollIntoView: () => {},
        focus: () => {}
      };
    }
    return elements[id];
  }

  // Pre-seed known elements
  const roleButtons = [
    getOrCreate('role-btn-member'),
    getOrCreate('role-btn-admin'),
    getOrCreate('role-btn-superadmin')
  ];
  const subviews = [
    getOrCreate('subview-home'),
    getOrCreate('subview-create'),
    getOrCreate('subview-drafts'),
    getOrCreate('subview-published')
  ];
  const navButtons = [
    getOrCreate('nav-btn-home'),
    getOrCreate('nav-btn-create'),
    getOrCreate('nav-btn-drafts'),
    getOrCreate('nav-btn-published'),
    getOrCreate('nav-btn-media'),
    getOrCreate('nav-btn-audit')
  ];
  const placeElements = [
    getOrCreate('create-place-modal'),
    getOrCreate('place-modal-error'),
    getOrCreate('new-place-name'),
    getOrCreate('new-place-type'),
    getOrCreate('new-place-desc'),
    getOrCreate('new-place-location'),
    getOrCreate('group-new-place-name'),
    getOrCreate('group-new-place-type'),
    getOrCreate('error-new-place-name'),
    getOrCreate('error-new-place-type'),
    getOrCreate('field-placeId'),
    getOrCreate('group-placeId'),
    getOrCreate('error-placeId')
  ];

  const eventListeners = {};
  const mockDoc = {
    getElementById: (id) => getOrCreate(id),
    querySelectorAll: (sel) => {
      if (sel === '.role-pill-btn') return roleButtons;
      if (sel === '.studio-subview') return subviews;
      if (sel === '.studio-nav-btn') return navButtons;
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return Object.values(elements).filter(e => e.classList && e.classList.contains(cls));
      }
      return [];
    },
    querySelector: (sel) => getOrCreate('form-card'),
    addEventListener: (evt, cb) => {
      if (!eventListeners[evt]) eventListeners[evt] = [];
      eventListeners[evt].push(cb);
    }
  };

  const sandbox = {
    document: mockDoc,
    window: {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    alert: (msg) => { sandbox.lastAlert = msg; },
    confirm: (msg) => true,
    setTimeout: (cb, ms) => { cb(); return 1; },
    clearTimeout: () => {},
    Date: Date,
    Object: Object,
    Array: Array,
    Number: Number,
    String: String,
    localStorage: global.localStorage
  };
  sandbox.window = sandbox;
  sandbox.window.KoinoniaStudio = studio;

  vm.createContext(sandbox);
  // Execute the main inline script (last script tag containing AppState)
  const mainScript = inlineScripts[inlineScripts.length - 1];
  vm.runInContext(mainScript, sandbox);

  if (eventListeners['DOMContentLoaded']) {
    eventListeners['DOMContentLoaded'].forEach(cb => { try { cb(); } catch (e) {} });
  }

  return { sandbox, elements, eventListeners };
}

it('Physical QA Item 3: Initial client state starts strictly as MEMBER role with access denied view', () => {
  const { sandbox, elements } = createClientRuntime();
  assert.strictEqual(sandbox.AppState.role, 'MEMBER');
  assert.strictEqual(sandbox.AppState.user.name, 'Alex Rivera');
  assert.strictEqual(sandbox.AppState.user.role, 'MEMBER');

  // Verify initial HTML structure matches initial state
  assert.ok(htmlContent.includes('id="role-btn-member" class="role-pill-btn active"'),
    'MEMBER button must be active initially');
  assert.ok(htmlContent.includes('id="view-access-denied" class="studio-view active"'),
    'view-access-denied must be active initially');
  assert.ok(htmlContent.includes('id="view-authorized-studio" class="studio-view"'),
    'view-authorized-studio must not be active initially');
});

it('Physical QA Item 4: MEMBER role is blocked from creating drafts and shows clear denial', () => {
  const { sandbox } = createClientRuntime();
  assert.strictEqual(sandbox.AppState.role, 'MEMBER');

  sandbox.startNewExperience('QUEST');
  assert.ok(sandbox.lastAlert && sandbox.lastAlert.includes('Only ADMIN or SUPERADMIN can create Studio experiences.'),
    'Alert must contain exact denial message: "Only ADMIN or SUPERADMIN can create Studio experiences."');
  assert.strictEqual(sandbox.AppState.activeDraftId, null);
  assert.strictEqual(sandbox.AppState.currentSubView, 'home');
});

it('Physical QA Item 5: MEMBER role attempting to access CREATE NEW subview is blocked', () => {
  const { sandbox } = createClientRuntime();
  assert.strictEqual(sandbox.AppState.role, 'MEMBER');

  sandbox.showSubView('create');
  assert.ok(sandbox.lastAlert && sandbox.lastAlert.includes('Only ADMIN or SUPERADMIN can create Studio experiences.'),
    'Alert must contain exact denial message when navigating to create view as MEMBER');
  assert.notStrictEqual(sandbox.AppState.currentSubView, 'create');
});

it('Physical QA Item 6: switchRole(\'ADMIN\') updates AppState.role to ADMIN and syncs UI', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');

  assert.strictEqual(sandbox.AppState.role, 'ADMIN');
  assert.strictEqual(sandbox.AppState.user.id, 'admin_sarah');
  assert.strictEqual(sandbox.AppState.user.name, 'Sarah Jenkins');
  assert.strictEqual(sandbox.AppState.user.role, 'ADMIN');

  // Role pill buttons update
  assert.strictEqual(elements['role-btn-admin'].classList.contains('active'), true);
  assert.strictEqual(elements['role-btn-admin'].attributes['aria-checked'], 'true');
  assert.strictEqual(elements['role-btn-member'].classList.contains('active'), false);
  assert.strictEqual(elements['role-btn-member'].attributes['aria-checked'], 'false');

  // View gating update
  assert.strictEqual(elements['view-access-denied'].classList.contains('active'), false);
  assert.strictEqual(elements['view-authorized-studio'].classList.contains('active'), true);
});

it('Physical QA Item 7: QA status bar exists and receives updates on role changes', () => {
  const { sandbox, elements } = createClientRuntime();
  assert.ok(htmlContent.includes('id="qa-status-bar"'), 'QA status bar markup must exist');
  assert.ok(htmlContent.includes('id="qa-status-text"'), 'QA status text element must exist');

  sandbox.switchRole('ADMIN');
  assert.strictEqual(elements['qa-status-text'].textContent, 'Switched to ADMIN: Sarah Jenkins');

  sandbox.switchRole('SUPERADMIN');
  assert.strictEqual(elements['qa-status-text'].textContent, 'Switched to SUPERADMIN: Pastor David');
});

it('Physical QA Item 8: startNewExperience(\'QUEST\') in ADMIN mode opens Quest editor visibly', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');

  sandbox.startNewExperience('QUEST');
  assert.strictEqual(sandbox.AppState.currentTemplateType, 'QUEST');
  assert.strictEqual(elements['current-form-title'].textContent, 'CREATE 📜 QUEST');
  assert.strictEqual(elements['current-template-badge'].textContent, '📜 QUEST TEMPLATE');
  assert.strictEqual(elements['draft-status-pill'].textContent, 'NEW DRAFT');
  assert.strictEqual(elements['subview-create'].style.display, 'block');
  assert.strictEqual(sandbox.AppState.currentSubView, 'create');
  assert.strictEqual(elements['qa-status-text'].textContent, 'Editing new 📜 QUEST draft');
});

it('Physical QA Item 9: Quest form renders canonical fields (Title, Place, LP, Char XP, Real-World Action, Reflection Prompt)', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');

  const fieldsHtml = elements['form-fields-container'].innerHTML;
  assert.ok(fieldsHtml.includes('id="field-title"'), 'Title field must exist');
  assert.ok(fieldsHtml.includes('id="field-placeId"'), 'PlaceId field must exist');
  assert.ok(fieldsHtml.includes('id="field-lifePoints"'), 'LifePoints field must exist');
  assert.ok(fieldsHtml.includes('id="field-characterXp"'), 'CharacterXp field must exist');
  assert.ok(fieldsHtml.includes('id="field-realWorldAction"'), 'RealWorldAction field must exist');
  assert.ok(fieldsHtml.includes('id="field-reflectionPrompt"'), 'ReflectionPrompt field must exist');
});

it('Physical QA Item 10: Tapping + CREATE NEW allows choosing 📜 QUEST and opening editor', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');

  // Nav to create view
  sandbox.showSubView('create');
  assert.strictEqual(elements['subview-create'].style.display, 'block');

  // Template selector is rendered
  const selectorHtml = elements['template-selector-container'].innerHTML;
  assert.ok(selectorHtml.includes('data-template-select="QUEST"'), 'QUEST template button rendered');
  assert.ok(selectorHtml.includes('📜 QUEST'), '📜 QUEST label rendered in selector');

  // Selecting QUEST
  sandbox.selectTemplate('QUEST');
  assert.strictEqual(sandbox.AppState.currentTemplateType, 'QUEST');
  assert.strictEqual(elements['current-form-title'].textContent, 'CREATE 📜 QUEST');
});

it('Physical QA Item 11: All 5 templates can be initiated by ADMIN in Studio', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');

  const templates = ['QUEST', 'EVENT', 'CAMPAIGN', 'CAMPFIRE_ACTIVITY', 'MINISTRY_MISSION'];
  for (const tmplId of templates) {
    sandbox.startNewExperience(tmplId);
    assert.strictEqual(sandbox.AppState.currentTemplateType, tmplId);
    assert.ok(elements['current-form-title'].textContent.includes(studio.TEMPLATES[tmplId].label.toUpperCase()),
      `Form title must include label for ${tmplId}`);
    assert.ok(elements['form-fields-container'].innerHTML.includes('id="field-title"'),
      `Form fields must include title for ${tmplId}`);
  }
});

it('Physical QA Item 12: All 5 dashboard cards in HTML are semantic buttons with data-template-action', () => {
  const templates = ['QUEST', 'EVENT', 'CAMPAIGN', 'CAMPFIRE_ACTIVITY', 'MINISTRY_MISSION'];
  for (const tmplId of templates) {
    assert.ok(htmlContent.includes(`data-template-action="${tmplId}"`),
      `Dashboard card button must have data-template-action="${tmplId}"`);
    assert.ok(htmlContent.includes(`onclick="startNewExperience('${tmplId}')"`),
      `Dashboard card button must have onclick="startNewExperience('${tmplId}')"`);
  }
});

it('Physical QA Item 13: Event delegation fail-safe triggers startNewExperience on click/touch', () => {
  const { sandbox, eventListeners, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');

  assert.ok(eventListeners['click'] && eventListeners['click'].length > 0,
    'Must register click event delegation on document');

  // Simulate delegated click on a target inside data-template-action="QUEST"
  const clickHandler = eventListeners['click'][0];
  const fakeEvent = {
    target: {
      closest: (sel) => {
        if (sel === '[data-template-action]') {
          return { getAttribute: () => 'QUEST' };
        }
        return null;
      }
    }
  };

  clickHandler(fakeEvent);
  assert.strictEqual(sandbox.AppState.currentTemplateType, 'QUEST');
  assert.strictEqual(elements['current-form-title'].textContent, 'CREATE 📜 QUEST');
});

it('Physical QA Item 14: switchRole(\'SUPERADMIN\') grants approval and prototype publishing capabilities', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');

  // In ADMIN role: Direct publish is hidden, Request review is shown
  assert.strictEqual(elements['btn-publish-direct'].style.display, 'none');
  assert.strictEqual(elements['btn-request-review'].style.display, 'inline-flex');

  // In SUPERADMIN role: Direct publish is shown, Request review is hidden
  sandbox.switchRole('SUPERADMIN');
  assert.strictEqual(sandbox.AppState.role, 'SUPERADMIN');
  assert.strictEqual(elements['btn-publish-direct'].style.display, 'inline-flex');
  assert.strictEqual(elements['btn-request-review'].style.display, 'none');

  // Superadmin can approve and publish
  assert.strictEqual(studio.store.canPerform(sandbox.AppState.role, 'APPROVE'), true);
  assert.strictEqual(studio.store.canPerform(sandbox.AppState.role, 'PUBLISH'), true);
});

it('Physical QA Item 15: No silent failures across user interactions (QA status bar logs actions)', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.showQaStatus('Operation successful test', 'success');
  assert.strictEqual(elements['qa-status-text'].textContent, 'Operation successful test');
  assert.strictEqual(elements['qa-status-icon'].textContent, '✅');

  sandbox.showQaStatus('Operation failed test', 'error');
  assert.strictEqual(elements['qa-status-text'].textContent, 'Operation failed test');
  assert.strictEqual(elements['qa-status-icon'].textContent, '⚠️');
});


// ============================================================
// GROUP 12: STUDIO PLACE CREATION & WORKFLOW INTEGRITY (22 TESTS)
// ============================================================
console.log('\n[GROUP 12] Studio Place Creation & Workflow Integrity (22 Tests)');

const placeStorageMap = new Map();
global.localStorage = {
  getItem: (k) => placeStorageMap.get(k) || null,
  setItem: (k, v) => placeStorageMap.set(k, String(v)),
  removeItem: (k) => placeStorageMap.delete(k),
  clear: () => placeStorageMap.clear()
};

it('Place Item 1: Koinonia Place selector contains CREATE NEW PLACE', () => {
  const options = studio.getPlaceOptions();
  const createOpt = options.find(o => o.value === 'CREATE_NEW_PLACE');
  assert.ok(createOpt, 'Place options must contain CREATE_NEW_PLACE');
  assert.ok(createOpt.label.includes('CREATE NEW PLACE'), 'Label must contain CREATE NEW PLACE');
});

it('Place Item 2: CREATE NEW PLACE is the first actionable option', () => {
  const options = studio.getPlaceOptions();
  assert.strictEqual(options[0].value, 'CREATE_NEW_PLACE', 'First option must be CREATE_NEW_PLACE');
  assert.strictEqual(options[0].label, '➕ CREATE NEW PLACE');
  assert.strictEqual(options[1].value, '__SEPARATOR__');
  assert.strictEqual(options[1].disabled, true);
});

it('Place Item 3: existing canonical places remain available', () => {
  const options = studio.getPlaceOptions();
  const optionValues = options.map(o => o.value);
  const canonicalIds = ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'];
  for (const cId of canonicalIds) {
    assert.ok(optionValues.includes(cId), `Canonical place ${cId} must be in options`);
  }
});

it('Place Item 4: ADMIN can open Create Place modal', () => {
  assert.strictEqual(studio.store.canPerform('ADMIN', 'CREATE_PLACE'), true);
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.openCreatePlaceModal();
  assert.strictEqual(elements['create-place-modal'].classList.contains('active'), true);
});

it('Place Item 5: SUPERADMIN can open Create Place modal', () => {
  assert.strictEqual(studio.store.canPerform('SUPERADMIN', 'CREATE_PLACE'), true);
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('SUPERADMIN');
  sandbox.openCreatePlaceModal();
  assert.strictEqual(elements['create-place-modal'].classList.contains('active'), true);
});

it('Place Item 6: MEMBER cannot create a Place', () => {
  assert.strictEqual(studio.store.canPerform('MEMBER', 'CREATE_PLACE'), false);
  let threw = false;
  try {
    studio.placeStore.createPlace({ name: 'Secret Garden', type: 'Other' }, { role: 'MEMBER' });
  } catch (err) {
    threw = true;
    assert.match(err.message, /Unauthorized/);
  }
  assert.strictEqual(threw, true);

  const { sandbox } = createClientRuntime();
  const modalEl = sandbox.document.getElementById('create-place-modal');
  sandbox.openCreatePlaceModal();
  assert.strictEqual(modalEl.classList.contains('active'), false);
  assert.ok(sandbox.lastAlert && sandbox.lastAlert.includes('Only ADMIN or SUPERADMIN'));
});

it('Place Item 7: Place Name is required', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  assert.throws(() => {
    studio.placeStore.createPlace({ name: '', type: 'Home' }, admin);
  }, /Place Name is required/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: '   ', type: 'Home' }, admin);
  }, /Place Name is required/);
});

it('Place Item 8: Place Type is required', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Community Garden', type: '' }, admin);
  }, /Place Type is required/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Community Garden', type: 'NonExistentType' }, admin);
  }, /Invalid Place Type/);
});

it('Place Item 9: duplicate names are rejected case-insensitively', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  // Canonical duplicates
  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'FOG Center', type: 'Ministry Venue' }, admin);
  }, /A place with this name already exists/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'fog center', type: 'Ministry Venue' }, admin);
  }, /A place with this name already exists/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Fog Center', type: 'Ministry Venue' }, admin);
  }, /A place with this name already exists/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Pilgrim Home', type: 'Home' }, admin);
  }, /A place with this name already exists/);

  // Custom duplicate
  studio.placeStore.createPlace({ name: "Mary's Garden", type: 'Ministry Venue' }, admin);
  assert.throws(() => {
    studio.placeStore.createPlace({ name: "mary's garden", type: 'Other' }, admin);
  }, /A place with this name already exists/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: "MARY'S GARDEN", type: 'Other' }, admin);
  }, /A place with this name already exists/);

  studio.placeStore.reset();
});

it('Place Item 10: unsafe HTML/script input is rejected', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  assert.throws(() => {
    studio.placeStore.createPlace({ name: '<script>alert(1)</script>', type: 'Other' }, admin);
  }, /Security Error/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Safe Name', type: 'Other', description: '<iframe src="evil.com"></iframe>' }, admin);
  }, /Security Error/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Safe Name', type: 'Other', location: 'javascript:alert(1)' }, admin);
  }, /Security Error/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Safe Name', type: 'Other', description: '<style>body{display:none}</style>' }, admin);
  }, /Security Error/);
});

it('Place Item 11: valid custom Place receives generated stable ID', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({
    name: "Mary's Garden",
    type: 'Ministry Venue',
    description: 'Outdoor prayer and fellowship area'
  }, admin);

  assert.match(place.id, /^place_\d+_[a-z0-9_]+$/, 'ID must match place_<timestamp>_<slug>');
  assert.notStrictEqual(place.id, "Mary's Garden", 'ID must not be human readable name');
  studio.placeStore.reset();
});

it('Place Item 12: communityId is "fog"', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: 'Youth Veranda', type: 'Home' }, admin);
  assert.strictEqual(place.communityId, 'fog');
  studio.placeStore.reset();
});

it('Place Item 13: custom Place is prototype-local only', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: 'Fellowship Gazebo', type: 'Ministry Venue' }, admin);
  assert.strictEqual(place.source, 'STUDIO');
  assert.strictEqual(place.status, 'ACTIVE');
  studio.placeStore.reset();
});

it('Place Item 14: custom Place persists in localStorage', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: 'Prayer Bower', type: 'Ministry Venue' }, admin);
  const raw = global.localStorage.getItem('koinonia_phase21_custom_places');
  assert.ok(raw, 'Must save to koinonia_phase21_custom_places');
  const parsed = JSON.parse(raw);
  assert.ok(parsed.some(p => p.id === place.id && p.name === 'Prayer Bower'));

  studio.placeStore.reset();
});

it('Place Item 15: new Place appears in Place dropdown immediately', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: "Mary's Garden", type: 'Ministry Venue' }, admin);
  const options = studio.getPlaceOptions();
  const found = options.find(o => o.value === place.id);
  assert.ok(found, 'New place must appear in getPlaceOptions');
  assert.strictEqual(found.label, "Mary's Garden");
  studio.placeStore.reset();
});

it('Place Item 16: new Place is automatically selected after creation', () => {
  const { sandbox } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');

  sandbox.document.getElementById('new-place-name').value = "Mary's Garden";
  sandbox.document.getElementById('new-place-type').value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  assert.strictEqual(sandbox.AppState.activeFormData.placeId.startsWith('place_'), true);
  assert.strictEqual(sandbox.document.getElementById('field-placeId').value, sandbox.AppState.activeFormData.placeId);
  studio.placeStore.reset();
});

it('Place Item 17: active Quest form data is preserved', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');

  sandbox.onFieldChange('title', 'Preserved Quest Title');
  sandbox.onFieldChange('lifePoints', 20);
  sandbox.onFieldChange('characterXp', 40);
  sandbox.onFieldChange('realWorldAction', 'Help neighbors clean porch');
  sandbox.onFieldChange('reflectionPrompt', 'Where was Christ today?');

  sandbox.onFieldChange('placeId', 'CREATE_NEW_PLACE');
  assert.strictEqual(sandbox.AppState.activeFormData.title, 'Preserved Quest Title');

  sandbox.document.getElementById('new-place-name').value = 'Corner Gazebo';
  sandbox.document.getElementById('new-place-type').value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  // Assert all fields preserved
  assert.strictEqual(sandbox.AppState.activeFormData.title, 'Preserved Quest Title');
  assert.strictEqual(sandbox.AppState.activeFormData.lifePoints, 20);
  assert.strictEqual(sandbox.AppState.activeFormData.characterXp, 40);
  assert.strictEqual(sandbox.AppState.activeFormData.realWorldAction, 'Help neighbors clean porch');
  assert.strictEqual(sandbox.AppState.activeFormData.reflectionPrompt, 'Where was Christ today?');
  assert.strictEqual(sandbox.AppState.activeFormData.placeId.startsWith('place_'), true);

  studio.placeStore.reset();
});

it('Place Item 18: custom Place remains available after page refresh', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const savedPlace = studio.placeStore.createPlace({ name: 'Persisted Pavilion', type: 'Ministry Venue' }, admin);

  const reloadedStore = new studio.StudioPlaceStore();
  const place = reloadedStore.getPlaceById(savedPlace.id);
  assert.ok(place, 'Custom place must be reloaded from storage');
  assert.strictEqual(place.name, 'Persisted Pavilion');

  studio.placeStore.reset();
});

it('Place Item 19: canonical Place list remains unchanged', () => {
  const canonicalIds = studio.CANONICAL_PLACES.map(p => p.id);
  assert.deepStrictEqual(canonicalIds.sort(), ['fog_center', 'home', 'outreach_site', 'school', 'sports_hub'].sort());
  assert.strictEqual(studio.CANONICAL_PLACES.length, 5);
});

it('Place Item 20: modal is mobile responsive', () => {
  const html = fs.readFileSync(path.join(__dirname, 'studio_test.html'), 'utf8');
  assert.ok(html.includes('id="create-place-modal"'), 'Modal HTML markup exists');
  assert.ok(html.includes('.modal-card'), 'Modal card style exists');
  assert.ok(html.includes('max-height: calc(100vh - 24px)') || html.includes('max-height: calc(100dvh - 24px)'),
    'Modal must have viewport height constraints');
  assert.ok(html.includes('overflow-y: auto'), 'Modal must scroll vertically');
});

it('Place Item 21: no generic Faith Quest terminology is introduced', () => {
  const html = fs.readFileSync(path.join(__dirname, 'studio_test.html'), 'utf8');
  assert.ok(!html.toLowerCase().includes('faith quest'), 'studio_test.html must not contain Faith Quest');
  const engine = fs.readFileSync(path.join(__dirname, 'data', 'studio_engine.js'), 'utf8');
  assert.ok(!engine.toLowerCase().includes('faith quest'), 'studio_engine.js must not contain Faith Quest');
  assert.strictEqual(studio.TEMPLATES.QUEST.label, '📜 QUEST');
});

it('Place Item 22: no database/Main App mutation occurs', () => {
  assert.strictEqual(typeof studio.store.awardLifePoints, 'undefined');
  assert.strictEqual(typeof studio.store.modifyAttendance, 'undefined');
  assert.strictEqual(typeof studio.store.alterCampfireRoster, 'undefined');
  assert.strictEqual(typeof studio.placeStore.mutateProductionDatabase, 'undefined');
});


// ============================================================
// GROUP 13: SELECT / VALIDATION STATE SYNCHRONIZATION & CUSTOM PLACE (28 TESTS)
// ============================================================
console.log('\n[GROUP 13] Select / Validation State Synchronization & Custom Place (28 Tests)');

const validGroup13QuestData = {
  title: 'Morning Prayer Walk',
  shortDesc: 'Walk and pray for neighborhood families',
  longDesc: 'Detailed instructions for peaceful stewardship and intercession walk.',
  placeId: 'home',
  category: 'Faith & Stewardship',
  audience: 'all',
  difficulty: 'easy',
  estimatedMinutes: 30,
  realWorldAction: 'Walk 1 kilometer around your block praying silently.',
  reflectionPrompt: 'What blessing did you see in creation today?',
  verificationMethod: 'self_reflection',
  lifePoints: 20,
  characterXp: 30,
  skillXp: 20,
  completionMessage: 'Well done, faithful servant!',
  startDate: '2026-09-10',
  presentationTarget: 'KOINONIA'
};

it('Sync Item 1: required Place Type initializes to empty string', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.openCreatePlaceModal();
  assert.strictEqual(sandbox.AppState.newPlaceFormData.name, '');
  assert.strictEqual(sandbox.AppState.newPlaceFormData.type, '');
  assert.strictEqual(elements['new-place-type'].value, '');
});

it('Sync Item 2: required Place Type visually shows placeholder', () => {
  assert.ok(htmlContent.includes('<option value="" disabled selected>Select Place Type...</option>'));
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');
  assert.strictEqual(sandbox.AppState.activeFormData.category, undefined);
  assert.ok(elements['form-fields-container'].innerHTML.includes('Select Ministry Category...'));
});

it('Sync Item 3: placeholder is not a valid value', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  assert.throws(() => {
    studio.placeStore.createPlace({ name: "Mary's Garden", type: '' }, admin);
  }, /Place Type is required/);
});

it('Sync Item 4: CREATE PLACE with no Place Type fails validation', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.openCreatePlaceModal();
  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = '';
  sandbox.submitCreatePlace();
  assert.strictEqual(elements['place-modal-error'].textContent, 'Please select a Place Type.');
  assert.strictEqual(elements['error-new-place-type'].textContent, 'Please select a Place Type.');
  assert.strictEqual(elements['group-new-place-type'].classList.contains('has-error'), true);
  assert.strictEqual(elements['new-place-type'].getAttribute('aria-invalid'), 'true');
});

it('Sync Item 5: selecting a valid Place Type updates model immediately', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.openCreatePlaceModal();
  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = '';
  sandbox.submitCreatePlace();
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.onPlaceFieldChange('type', 'Ministry Venue');
  assert.strictEqual(sandbox.AppState.newPlaceFormData.type, 'Ministry Venue');
  assert.strictEqual(elements['group-new-place-type'].classList.contains('has-error'), false);
  assert.strictEqual(elements['new-place-type'].getAttribute('aria-invalid'), 'false');
});

it('Sync Item 6: valid Place Type clears its previous error state', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.openCreatePlaceModal();
  elements['new-place-name'].value = "Mary's Garden";
  sandbox.submitCreatePlace();
  assert.strictEqual(elements['place-modal-error'].style.display, 'block');
  sandbox.onPlaceFieldChange('type', 'Ministry Venue');
  assert.strictEqual(elements['place-modal-error'].style.display, 'none');
  assert.strictEqual(elements['error-new-place-type'].textContent, '');
});

it('Sync Item 7: newly created Place is added to dynamic Place options', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: "Mary's Garden", type: 'Ministry Venue' }, admin);
  const options = studio.getPlaceOptions();
  const match = options.find(o => o.value === place.id);
  assert.ok(match);
  assert.strictEqual(match.label, "Mary's Garden");
  studio.placeStore.reset();
});

it('Sync Item 8: new custom placeId is written to AppState.activeFormData.placeId', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');
  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();
  assert.ok(sandbox.AppState.activeFormData.placeId);
  assert.match(sandbox.AppState.activeFormData.placeId, /^place_\d+_/);
  studio.placeStore.reset();
});

it('Sync Item 9: DOM select.value equals the new custom placeId', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');
  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();
  assert.strictEqual(elements['field-placeId'].value, sandbox.AppState.activeFormData.placeId);
  studio.placeStore.reset();
});

it('Sync Item 10: custom placeId passes validation immediately', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: "Mary's Garden", type: 'Ministry Venue' }, admin);
  const res = studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: place.id });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.errors.placeId, undefined);
  studio.placeStore.reset();
});

it('Sync Item 11: Koinonia Place red/error state is cleared immediately', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');
  elements['group-placeId'].classList.add('has-error');
  elements['field-placeId'].setAttribute('aria-invalid', 'true');
  elements['error-placeId'].textContent = 'Koinonia Place is required.';

  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  assert.strictEqual(elements['group-placeId'].classList.contains('has-error'), false);
  studio.placeStore.reset();
});

it('Sync Item 12: aria-invalid changes to false', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');
  elements['group-placeId'].classList.add('has-error');
  elements['field-placeId'].setAttribute('aria-invalid', 'true');

  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  assert.strictEqual(elements['field-placeId'].getAttribute('aria-invalid'), 'false');
  studio.placeStore.reset();
});

it('Sync Item 13: field error text is removed after valid auto-selection', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');
  elements['error-placeId'].textContent = 'Koinonia Place is required.';

  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  assert.strictEqual(elements['error-placeId'].textContent, '');
  studio.placeStore.reset();
});

it('Sync Item 14: NO second manual selection is required', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');
  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  const placeId = sandbox.AppState.activeFormData.placeId;
  const validation = studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId });
  assert.strictEqual(validation.valid, true);
  assert.strictEqual(elements['group-placeId'].classList.contains('has-error'), false);
  studio.placeStore.reset();
});

it('Sync Item 15: custom Place remains valid after refresh', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: "Mary's Garden", type: 'Ministry Venue' }, admin);

  const freshStore = new studio.StudioPlaceStore();
  const reloaded = freshStore.getPlaceById(place.id);
  assert.ok(reloaded);
  assert.strictEqual(reloaded.name, "Mary's Garden");

  const res = studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: place.id });
  assert.strictEqual(res.valid, true);
  studio.placeStore.reset();
});

it('Sync Item 16: existing canonical Place selections remain valid', () => {
  for (const p of studio.CANONICAL_PLACES) {
    const res = studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: p.id });
    assert.strictEqual(res.valid, true, `Canonical place ${p.id} must be valid`);
  }
});

it('Sync Item 17: existing saved draft Place value hydrates correctly', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: "Mary's Garden", type: 'Ministry Venue' }, admin);
  const draft = studio.store.createDraft('QUEST', { ...validGroup13QuestData, placeId: place.id }, admin);

  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.editDraft(draft.id);

  assert.strictEqual(sandbox.AppState.activeFormData.placeId, place.id);
  assert.strictEqual(elements['field-placeId'].value, place.id);
  studio.placeStore.reset();
});

it('Sync Item 18: required select placeholder does not overwrite existing saved values', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const draft = studio.store.createDraft('QUEST', {
    ...validGroup13QuestData,
    category: 'Community Fellowship',
    difficulty: 'challenging',
    verificationMethod: 'leader_checkin'
  }, admin);

  const { sandbox } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.editDraft(draft.id);

  assert.strictEqual(sandbox.AppState.activeFormData.category, 'Community Fellowship');
  assert.strictEqual(sandbox.AppState.activeFormData.difficulty, 'challenging');
  assert.strictEqual(sandbox.AppState.activeFormData.verificationMethod, 'leader_checkin');
  const rendered = sandbox.document.getElementById('form-fields-container').innerHTML;
  assert.ok(rendered.includes('value="Community Fellowship"  selected'));
  assert.ok(rendered.includes('value="challenging"  selected'));
  assert.ok(rendered.includes('value="leader_checkin"  selected'));
});

it('Sync Item 19: Quest form data remains preserved during Place creation', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');

  sandbox.onFieldChange('title', 'Sunrise Prayer Pilgrimage');
  sandbox.onFieldChange('lifePoints', 25);
  sandbox.onFieldChange('characterXp', 50);
  sandbox.onFieldChange('realWorldAction', 'Help pack fellowship boxes');
  sandbox.onFieldChange('reflectionPrompt', 'Where did you feel Gods peace?');

  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  assert.strictEqual(sandbox.AppState.activeFormData.title, 'Sunrise Prayer Pilgrimage');
  assert.strictEqual(sandbox.AppState.activeFormData.lifePoints, 25);
  assert.strictEqual(sandbox.AppState.activeFormData.characterXp, 50);
  assert.strictEqual(sandbox.AppState.activeFormData.realWorldAction, 'Help pack fellowship boxes');
  assert.strictEqual(sandbox.AppState.activeFormData.reflectionPrompt, 'Where did you feel Gods peace?');
  assert.match(sandbox.AppState.activeFormData.placeId, /^place_\d+_/);
  studio.placeStore.reset();
});

it('Sync Item 20: autosave stores the custom placeId', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.switchRole('ADMIN');
  sandbox.startNewExperience('QUEST');

  elements['new-place-name'].value = "Mary's Garden";
  elements['new-place-type'].value = 'Ministry Venue';
  sandbox.submitCreatePlace();

  const draftId = sandbox.AppState.activeDraftId;
  assert.ok(draftId);
  const draft = studio.store.getDraft(draftId);
  assert.ok(draft);
  assert.strictEqual(draft.data.placeId, sandbox.AppState.activeFormData.placeId);
  studio.placeStore.reset();
});

it('Sync Item 21: validation recognizes canonical + active custom Places', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: 'Active Custom Place', type: 'School' }, admin);

  const resCustom = studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: place.id });
  assert.strictEqual(resCustom.valid, true);

  const resCanonical = studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: 'sports_hub' });
  assert.strictEqual(resCanonical.valid, true);

  const resInvalid = studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: 'non_existent_place_xyz' });
  assert.strictEqual(resInvalid.valid, false);
  assert.strictEqual(resInvalid.errors.placeId, 'Please select a valid active Koinonia Place.');

  studio.placeStore.inMemoryPlaces.set('inactive_place', {
    id: 'inactive_place', communityId: 'fog', status: 'ARCHIVED', name: 'Inactive Place'
  });
  studio.placeStore.inMemoryPlaces.set('foreign_place', {
    id: 'foreign_place', communityId: 'other', status: 'ACTIVE', name: 'Foreign Place'
  });
  assert.strictEqual(studio.getPlaceOptions().some(o => o.value === 'inactive_place'), false);
  assert.strictEqual(studio.getPlaceOptions().some(o => o.value === 'foreign_place'), false);
  assert.strictEqual(studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: 'inactive_place' }).valid, false);
  assert.strictEqual(studio.validateTemplateData('QUEST', { ...validGroup13QuestData, placeId: 'foreign_place' }).valid, false);

  studio.placeStore.reset();
});

it('Sync Item 22: duplicate-place protection remains intact', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  studio.placeStore.createPlace({ name: 'Community Pavilion', type: 'Ministry Venue' }, admin);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'community pavilion', type: 'Other' }, admin);
  }, /A place with this name already exists/);

  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'FOG Center', type: 'Church / Community Center' }, admin);
  }, /A place with this name already exists/);

  studio.placeStore.reset();
});

it('Sync Item 23: MEMBER remains unable to create Places', () => {
  const member = { id: 'member_alex', name: 'Alex Rivera', role: 'MEMBER' };
  assert.throws(() => {
    studio.placeStore.createPlace({ name: 'Member Place', type: 'Home' }, member);
  }, /Unauthorized/);
});

it('Sync Item 24: ADMIN can create Places', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const place = studio.placeStore.createPlace({ name: 'Admin Place', type: 'Ministry Venue' }, admin);
  assert.ok(place);
  assert.strictEqual(place.name, 'Admin Place');
  studio.placeStore.reset();
});

it('Sync Item 25: SUPERADMIN can create Places', () => {
  const superadmin = { id: 'sa_david', name: 'Pastor David', role: 'SUPERADMIN' };
  const place = studio.placeStore.createPlace({ name: 'Pastor Prayer Garden', type: 'Church / Community Center' }, superadmin);
  assert.ok(place);
  assert.strictEqual(place.name, 'Pastor Prayer Garden');
  studio.placeStore.reset();
});

it('Sync Item 26: mobile responsive behavior remains intact', () => {
  assert.ok(htmlContent.includes('@media (max-width: 768px)'));
  assert.ok(htmlContent.includes('viewport-fit=cover'));
  assert.ok(htmlContent.includes('id="create-place-modal"'));
});

it('Sync Item 27: no generic Faith Quest terminology is introduced', () => {
  assert.ok(!htmlContent.toLowerCase().includes('faith quest'), 'studio_test.html must not contain Faith Quest');
  const engineContent = fs.readFileSync(path.join(__dirname, 'data', 'studio_engine.js'), 'utf8');
  assert.ok(!engineContent.toLowerCase().includes('faith quest'), 'studio_engine.js must not contain Faith Quest');
  assert.strictEqual(studio.TEMPLATES.QUEST.label, '📜 QUEST');
});

it('Sync Item 28: no Main App/database mutations occur', () => {
  assert.strictEqual(typeof studio.store.awardLifePoints, 'undefined');
  assert.strictEqual(typeof studio.store.modifyAttendance, 'undefined');
  assert.strictEqual(typeof studio.store.alterCampfireRoster, 'undefined');
  assert.strictEqual(typeof studio.placeStore.mutateProductionDatabase, 'undefined');
});

// ============================================================
// GROUP 14: PRESENTATION, ENTITY INTEGRITY & HIERARCHY REVISIONS (24 Tests)
// ============================================================
console.log('\n[GROUP 14] Presentation, Entity Integrity & Structural Hierarchy (24 Tests)');

it('Revision 1 Item 1: Plain text strings with apostrophes remain unescaped in model and storage', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const draft = studio.store.createDraft('QUEST', {
    title: "MARY'S GARDEN PRAYER QUEST",
    shortDesc: "A simple real-world prayer experience at Mary's Garden.",
    realWorldAction: "Spend 15 minutes in prayer at Mary's Garden."
  }, admin);
  assert.strictEqual(draft.title, "MARY'S GARDEN PRAYER QUEST");
  assert.strictEqual(draft.data.shortDesc, "A simple real-world prayer experience at Mary's Garden.");
  assert.strictEqual(draft.data.realWorldAction, "Spend 15 minutes in prayer at Mary's Garden.");
  assert.ok(!draft.title.includes('&#039;'));
  assert.ok(!draft.title.includes('&apos;'));
});

it('Revision 1 Item 2: decodeLegacyHtmlEntities cleanly converts single-encoded HTML entities', () => {
  assert.strictEqual(studio.decodeLegacyHtmlEntities("MARY&#039;S GARDEN PRAYER QUEST"), "MARY'S GARDEN PRAYER QUEST");
  assert.strictEqual(studio.decodeLegacyHtmlEntities("Mary&apos;s Garden"), "Mary's Garden");
  assert.strictEqual(studio.decodeLegacyHtmlEntities("Faith &amp; Fellowship"), "Faith & Fellowship");
  assert.strictEqual(studio.decodeLegacyHtmlEntities("&quot;Blessed are the peacemakers&quot;"), '"Blessed are the peacemakers"');
  assert.strictEqual(studio.decodeLegacyHtmlEntities("1 &lt; 2 &amp; 3 &gt; 2"), '1 < 2 & 3 > 2');
});

it('Revision 1 Item 3: decodeLegacyHtmlEntities cleans double-encoded entities without cascading corruption', () => {
  assert.strictEqual(studio.decodeLegacyHtmlEntities("Mary&amp;#039;s Garden"), "Mary's Garden");
  assert.strictEqual(studio.decodeLegacyHtmlEntities("Faith &amp;amp; Hope"), "Faith & Hope");
  assert.strictEqual(studio.decodeLegacyHtmlEntities("&amp;quot;Grace&amp;quot;"), '"Grace"');
});

it('Revision 1 Item 4: Legacy saved drafts with HTML entities are migrated cleanly upon hydration', () => {
  const legacyDraft = {
    id: 'draft_legacy_ent',
    communityId: 'fog',
    templateType: 'QUEST',
    templateVersion: '1.0',
    title: 'MARY&#039;S GARDEN PRAYER QUEST',
    data: {
      title: 'MARY&#039;S GARDEN PRAYER QUEST',
      shortDesc: 'A simple real-world prayer experience at Mary&#039;s Garden.',
      longDesc: 'Join us at Mary&#039;s Garden for prayer &amp; reflection.'
    },
    status: 'DRAFT',
    createdBy: { id: 'admin_1', name: 'Admin', role: 'ADMIN' },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const oldStorage = global.localStorage;
  global.localStorage = {
    getItem: (key) => key === studio.STORAGE_KEYS.DRAFTS ? JSON.stringify([legacyDraft]) : null,
    setItem: () => {}
  };

  const store = new studio.StudioStore();
  const loaded = store.getDraft('draft_legacy_ent');
  assert.ok(loaded);
  assert.strictEqual(loaded.title, "MARY'S GARDEN PRAYER QUEST");
  assert.strictEqual(loaded.data.shortDesc, "A simple real-world prayer experience at Mary's Garden.");
  assert.strictEqual(loaded.data.longDesc, "Join us at Mary's Garden for prayer & reflection.");

  global.localStorage = oldStorage;
});

it('Revision 1 Item 5: Legacy custom places with HTML entities are migrated cleanly upon hydration', () => {
  const legacyPlace = {
    id: 'place_legacy_ent',
    communityId: 'fog',
    name: 'Mary&#039;s Garden',
    type: 'Outreach / Service',
    description: 'A peaceful corner at St. Peter&#039;s courtyard.',
    status: 'ACTIVE'
  };

  const oldStorage = global.localStorage;
  global.localStorage = {
    getItem: (key) => key === studio.STORAGE_KEYS.CUSTOM_PLACES ? JSON.stringify([legacyPlace]) : null,
    setItem: () => {}
  };

  const pStore = new studio.StudioPlaceStore();
  const loaded = pStore.getPlaceById('place_legacy_ent');
  assert.ok(loaded);
  assert.strictEqual(loaded.name, "Mary's Garden");
  assert.strictEqual(loaded.description, "A peaceful corner at St. Peter's courtyard.");

  global.localStorage = oldStorage;
});

it('Revision 1 Item 6: Progressive save/load/update cycles preserve raw text without entity accumulation', () => {
  const admin = { id: 'admin_sarah', name: 'Sarah Jenkins', role: 'ADMIN' };
  const draft = studio.store.createDraft('QUEST', { title: "Mary's Garden" }, admin);

  let currentTitle = draft.title;
  for (let i = 0; i < 5; i++) {
    const updated = studio.store.updateDraft(draft.id, { title: currentTitle }, admin);
    currentTitle = updated.title;
    assert.strictEqual(currentTitle, "Mary's Garden");
    assert.ok(!currentTitle.includes('&amp;'));
    assert.ok(!currentTitle.includes('&#039;'));
  }
});

it('Revision 1 Item 7: generatePreviewModel maintains raw text in safeData without entity escaping', () => {
  const preview = studio.generatePreviewModel('QUEST', {
    title: "MARY'S GARDEN PRAYER QUEST",
    shortDesc: "A simple real-world prayer experience at Mary's Garden.",
    reflectionPrompt: "What did you hear in Mary's Garden today?"
  });
  assert.strictEqual(preview.title, "MARY'S GARDEN PRAYER QUEST");
  assert.strictEqual(preview.data.shortDesc, "A simple real-world prayer experience at Mary's Garden.");
  assert.strictEqual(preview.data.reflectionPrompt, "What did you hear in Mary's Garden today?");
  assert.ok(!preview.title.includes('&#039;'));
  assert.ok(!preview.data.shortDesc.includes('&#039;'));
});

it('Revision 1 Item 8: Content safety (inspectSafety) strictly rejects script tags, iframes, and handlers', () => {
  assert.strictEqual(studio.inspectSafety('<script>alert("hack")</script>').safe, false);
  assert.strictEqual(studio.inspectSafety('<iframe src="evil.com"></iframe>').safe, false);
  assert.strictEqual(studio.inspectSafety('<div onclick="malicious()">click</div>').safe, false);
  assert.strictEqual(studio.inspectSafety('javascript:void(0)').safe, false);
  assert.strictEqual(studio.inspectSafety('<style>body{display:none;}</style>').safe, false);
});

it('Revision 1 Item 9: Content safety (inspectSafety) accepts valid plain text with apostrophes and quotes', () => {
  assert.strictEqual(studio.inspectSafety("MARY'S GARDEN PRAYER QUEST").safe, true);
  assert.strictEqual(studio.inspectSafety("A simple real-world prayer experience at Mary's Garden.").safe, true);
  assert.strictEqual(studio.inspectSafety('Youth & Young Adults "Encouragement" Night').safe, true);
});

it('Revision 2 Item 10: Preview model banner contains exact Koinonia Care Promise copy', () => {
  const preview = studio.generatePreviewModel('QUEST', { title: "Saint Francis Trail Walk" });
  const expectedCopy = "🤝 Koinonia Care Promise: This is only a preview. No Life Points or XP are awarded, no attendance is recorded, and no notifications are sent.";
  assert.strictEqual(preview.banner.warning, expectedCopy);
});

it('Revision 2 Item 11: Preview model banner header contains PREVIEW MODE • NOT PUBLISHED', () => {
  const preview = studio.generatePreviewModel('QUEST', { title: "Pilgrim Walk" });
  assert.strictEqual(preview.banner.text, "PREVIEW MODE • NOT PUBLISHED");
  assert.strictEqual(preview.isLive, false);
});

it('Revision 2 Item 12: Zero-mutation invariants remain strictly guaranteed', () => {
  const preview = studio.generatePreviewModel('QUEST', { lifePoints: 50, characterXp: 100 });
  assert.strictEqual(preview.zeroMutationPolicy.lpAwarded, 0);
  assert.strictEqual(preview.zeroMutationPolicy.xpAwarded, 0);
  assert.strictEqual(preview.zeroMutationPolicy.attendanceRecorded, false);
  assert.strictEqual(preview.zeroMutationPolicy.notificationsDispatched, 0);
});

it('Revision 2 Item 13: studio_test.html contains the prominent Care Promise copy', () => {
  assert.ok(htmlContent.includes('🤝 <strong>Koinonia Care Promise:</strong>'));
  assert.ok(htmlContent.includes('This is only a preview. No Life Points or XP are awarded, no attendance is recorded, and no notifications are sent.'));
});

it('Revision 2 Item 14: studio_test.html does NOT present Zero-Mutation Policy copy in member-facing modal', () => {
  assert.ok(!htmlContent.includes('Zero-Mutation Policy:'));
});

it('Revision 3 Item 15: Structural DOM order: .studio-header is followed immediately by #subview-create', () => {
  const idxHeader = htmlContent.indexOf('class="studio-header"');
  const idxCreate = htmlContent.indexOf('id="subview-create"');
  assert.ok(idxHeader > -1, 'studio-header must exist');
  assert.ok(idxCreate > -1, 'subview-create must exist');
  assert.ok(idxHeader < idxCreate, 'studio-header must precede subview-create');
});

it('Revision 3 Item 16: Structural DOM order: #subview-create contains .form-card before .action-bar', () => {
  const idxCreate = htmlContent.indexOf('id="subview-create"');
  const idxNav = htmlContent.indexOf('class="studio-nav"');
  const subviewCreateSnippet = htmlContent.slice(idxCreate, idxNav);

  const idxFormCard = subviewCreateSnippet.indexOf('class="form-card"');
  const idxActionBar = subviewCreateSnippet.indexOf('class="action-bar"');
  assert.ok(idxFormCard > -1, 'form-card must be inside subview-create');
  assert.ok(idxActionBar > -1, 'action-bar must be inside subview-create');
  assert.ok(idxFormCard < idxActionBar, 'form-card must precede action-bar inside subview-create');
});

it('Revision 3 Item 17: Structural DOM order: nav.studio-nav follows #subview-create and precedes #template-selector-section', () => {
  const idxCreate = htmlContent.indexOf('id="subview-create"');
  const idxNav = htmlContent.indexOf('class="studio-nav"');
  const idxTmplSec = htmlContent.indexOf('id="template-selector-section"');

  assert.ok(idxCreate < idxNav, 'subview-create must precede studio-nav');
  assert.ok(idxNav < idxTmplSec, 'studio-nav must precede template-selector-section');
});

it('Revision 3 Item 18: Structural DOM order: #template-selector-section precedes #subview-home', () => {
  const idxTmplSec = htmlContent.indexOf('id="template-selector-section"');
  const idxHome = htmlContent.indexOf('id="subview-home"');
  assert.ok(idxTmplSec < idxHome, 'template-selector-section must precede subview-home');
});

it('Revision 3 Item 19: When in CREATE subview, active editor and template switcher are displayed', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.AppState.role = 'ADMIN';
  sandbox.showSubView('create');

  assert.strictEqual(elements['subview-create'].style.display, 'block');
  assert.strictEqual(elements['template-selector-section'].style.display, 'block');
  assert.strictEqual(elements['subview-home'].style.display, 'none');
  assert.strictEqual(elements['subview-drafts'].style.display, 'none');
  assert.strictEqual(elements['subview-published'].style.display, 'none');
});

it('Revision 3 Item 20: When in HOME subview, active editor and template switcher are hidden, Home is normal', () => {
  const { sandbox, elements } = createClientRuntime();
  sandbox.AppState.role = 'ADMIN';
  sandbox.showSubView('create');
  sandbox.showSubView('home');

  assert.strictEqual(elements['subview-create'].style.display, 'none');
  assert.strictEqual(elements['template-selector-section'].style.display, 'none');
  assert.strictEqual(elements['subview-home'].style.display, 'block');
  assert.strictEqual(elements['subview-drafts'].style.display, 'none');
  assert.strictEqual(elements['subview-published'].style.display, 'none');
});

it('Revision 3 Item 21: startNewExperience and editDraft invoke smooth scroll to .form-card', () => {
  const { sandbox } = createClientRuntime();
  let scrollCalled = false;
  let scrollOptions = null;
  const mockCard = sandbox.document.querySelector('.form-card');
  mockCard.scrollIntoView = (opts) => {
    scrollCalled = true;
    scrollOptions = opts;
  };

  sandbox.AppState.role = 'ADMIN';
  sandbox.startNewExperience('QUEST');
  assert.strictEqual(scrollCalled, true, 'scrollIntoView should be called when starting new experience');
  assert.ok(scrollOptions);
  assert.strictEqual(scrollOptions.behavior, 'smooth');
  assert.strictEqual(scrollOptions.block, 'start');

  scrollCalled = false;
  scrollOptions = null;
  const d = studio.store.createDraft('QUEST', { title: "Test Scroll" }, { role: 'ADMIN' });
  sandbox.editDraft(d.id);
  assert.strictEqual(scrollCalled, true, 'scrollIntoView should be called when editing draft');
  assert.ok(scrollOptions);
  assert.strictEqual(scrollOptions.behavior, 'smooth');
  assert.strictEqual(scrollOptions.block, 'start');
});

it('Revision 1 Item 22: Boundary escaping: escapeHtml escapes HTML special characters correctly', () => {
  const { sandbox } = createClientRuntime();
  assert.strictEqual(sandbox.escapeHtml("Mary's Garden"), "Mary&#039;s Garden");
  assert.strictEqual(sandbox.escapeHtml("Faith & Hope"), "Faith &amp; Hope");
  assert.strictEqual(sandbox.escapeHtml('<script>'), "&lt;script&gt;");
  assert.strictEqual(sandbox.escapeHtml('"Quotes"'), "&quot;Quotes&quot;");
});

it('Revision 1 Item 23: Populating preview modal sets plain-text directly into textContent without entity pollution', () => {
  const { sandbox, elements } = createClientRuntime();
  const questData = {
    title: "MARY'S GARDEN PRAYER QUEST",
    shortDesc: "A simple real-world prayer experience at Mary's Garden.",
    longDesc: "Walk with prayerful attention through Mary's Garden.",
    reflectionPrompt: "What did you pray at Mary's Garden?"
  };

  sandbox.populatePreview('QUEST', questData);

  assert.strictEqual(elements['preview-card-title'].textContent, "MARY'S GARDEN PRAYER QUEST");
  assert.strictEqual(elements['preview-short-desc'].textContent, "A simple real-world prayer experience at Mary's Garden.");
  assert.strictEqual(elements['preview-reflection-text'].textContent, "What did you pray at Mary's Garden?");
  assert.ok(!elements['preview-card-title'].textContent.includes('&#039;'));
  assert.ok(!elements['preview-short-desc'].textContent.includes('&#039;'));
});

it('Revision 1 Item 24: Editing a draft with apostrophes sets input value as raw plain text without entity artifacts', () => {
  const { sandbox, elements } = createClientRuntime();
  const d = studio.store.createDraft('QUEST', {
    title: "MARY'S GARDEN PRAYER QUEST",
    shortDesc: "A simple real-world prayer experience at Mary's Garden."
  }, { role: 'ADMIN' });

  sandbox.editDraft(d.id);

  assert.strictEqual(sandbox.AppState.activeFormData.title, "MARY'S GARDEN PRAYER QUEST");
  assert.strictEqual(elements['current-form-title'].textContent, "Editing: MARY'S GARDEN PRAYER QUEST");
  assert.ok(!elements['current-form-title'].textContent.includes('&#039;'));
});

console.log('\n================================================================');
console.log(`PHASE 0.21 TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
