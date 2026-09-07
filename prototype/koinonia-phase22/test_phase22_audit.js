/**
 * Phase 0.22 Stage 2 Automated Audit Verification Suite
 *
 * Verifies all findings of the Main App staging audit without writing a single byte.
 * Strictly read-only against /home/raspi4/fog-portal-staging/fog_community.db.
 * Verifies SHA256 before and after, confirms clean staging working tree,
 * checks schema and route findings, and verifies the 30-method contract mapping.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const http = require('http');

const STAGING_DIR = '/home/raspi4/fog-portal-staging';
const STAGING_DB = path.join(STAGING_DIR, 'fog_community.db');
const EXPECTED_DB_SHA256 = 'f545bd91fce9ff1fab4a3de9b7109ac162036d74d29c14c11207491e33a34a12';
const SHARED_CORE_FILE = path.join(__dirname, '../koinonia-phase21/data/shared_core.js');
const AUDIT_DOC = path.join(__dirname, '../../docs/koinonia-quest/KOINONIA_PHASE22_STAGING_AUDIT.md');
const GAP_MATRIX_DOC = path.join(__dirname, '../../docs/koinonia-quest/KOINONIA_PHASE22_SHARED_CORE_GAP_MATRIX.md');
const BLUEPRINT_DOC = path.join(__dirname, '../../docs/koinonia-quest/KOINONIA_SHARED_CORE_BLUEPRINT.md');

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

function getDbSha256() {
  const buf = fs.readFileSync(STAGING_DB);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function runSql(query) {
  const escaped = query.replace(/"/g, '\"');
  const cmd = `sqlite3 -readonly "${STAGING_DB}" "${escaped}"`;
  return execSync(cmd, { encoding: 'utf8', timeout: 5000 }).trim();
}

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: urlPath,
      method: 'GET',
      timeout: 3000
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body: data });
      });
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

async function runAuditVerification() {
  console.log('================================================================');
  console.log('  KOINONIA PHASE 0.22 — READ-ONLY AUDIT VERIFICATION SUITE');
  console.log('================================================================\n');

  // --- GROUP 1: PRE-AUDIT SAFETY & BASELINE CHECKS ---
  console.log('Group 1: Pre-Audit Safety & Baseline Checks');
  const initialHash = getDbSha256();
  assert(initialHash === EXPECTED_DB_SHA256, `Baseline DB SHA256 matches expected: ${initialHash}`);

  let gitStatus = '';
  try {
    gitStatus = execSync(`git -C "${STAGING_DIR}" status --porcelain`, { encoding: 'utf8' }).trim();
  } catch (e) {
    gitStatus = 'ERROR';
  }
  assert(gitStatus === '', 'Staging working tree is completely clean (zero modifications)');

  // --- GROUP 2: SQLITE SCHEMA & INTEGRITY AUDIT ---
  console.log('\nGroup 2: SQLite Schema & Integrity Audit');
  const tableCount = parseInt(runSql("SELECT count(*) FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence';"), 10);
  assert(tableCount === 53, `Active table count is exactly 53 (got: ${tableCount})`);

  const pragmas = runSql("PRAGMA foreign_keys;");
  assert(pragmas === '0', 'PRAGMA foreign_keys is 0 (OFF at runtime by default)');

  const orphanedAttendance = parseInt(runSql("SELECT COUNT(*) FROM attendance WHERE youth_id NOT IN (SELECT id FROM youth);"), 10);
  assert(orphanedAttendance === 4, `Identified exactly 4 orphaned records in attendance (got: ${orphanedAttendance})`);

  const userCount = parseInt(runSql("SELECT count(*) FROM users;"), 10);
  assert(userCount === 141, `Table users has 141 rows (got: ${userCount})`);

  const youthCount = parseInt(runSql("SELECT count(*) FROM youth;"), 10);
  assert(youthCount === 147, `Table youth has 147 rows (got: ${youthCount})`);

  const txCount = parseInt(runSql("SELECT count(*) FROM point_transactions;"), 10);
  assert(txCount === 90, `Table point_transactions has 90 rows (got: ${txCount})`);

  const cachedPointsCount = parseInt(runSql("SELECT count(*) FROM gamification_points;"), 10);
  assert(cachedPointsCount === 8, `Table gamification_points has 8 rows (got: ${cachedPointsCount})`);

  // Verify discrepancy in points
  const discrepancyCount = parseInt(runSql(`
    SELECT COUNT(*) FROM (
      SELECT gp.youth_id
      FROM gamification_points gp
      JOIN (SELECT youth_id, SUM(amount) as s FROM point_transactions GROUP BY youth_id) pt ON gp.youth_id = pt.youth_id
      WHERE gp.points != pt.s
    );
  `), 10);
  assert(discrepancyCount === 4, `Identified exactly 4 point balance discrepancies between cached and ledger (got: ${discrepancyCount})`);

  // Verify sports & fitness absence
  const sportsTables = parseInt(runSql("SELECT count(*) FROM sqlite_master WHERE type='table' AND (name LIKE '%sport%' OR name LIKE '%fit%');"), 10);
  assert(sportsTables === 0, 'Zero sports or fitness tables exist in Main App SQLite schema');

  // Verify Faith Quest leaderboard table
  const fqScoresCount = parseInt(runSql("SELECT count(*) FROM fq_daily_scores;"), 10);
  assert(fqScoresCount === 12, `Table fq_daily_scores exists with 12 rows (got: ${fqScoresCount})`);

  // --- GROUP 3: LIVE STAGING HTTP API READ-ONLY VERIFICATION ---
  console.log('\nGroup 3: Live Staging HTTP API Read-Only Verification (Port 3001 - fog-staging)');
  try {
    const eventsRes = await httpGet('/api/events');
    assert(eventsRes.statusCode === 200, `GET /api/events returned HTTP ${eventsRes.statusCode}`);
    const events = JSON.parse(eventsRes.body);
    assert(Array.isArray(events) && events.length > 0, `GET /api/events returned ${events.length} events`);

    const groupsRes = await httpGet('/api/small-groups');
    assert(groupsRes.statusCode === 200, `GET /api/small-groups returned HTTP ${groupsRes.statusCode}`);
    const groups = JSON.parse(groupsRes.body);
    assert(Array.isArray(groups) && groups.length === 4, `GET /api/small-groups returned 4 groups (got: ${groups.length})`);

    const minRes = await httpGet('/api/ministries');
    assert(minRes.statusCode === 200, `GET /api/ministries returned HTTP ${minRes.statusCode}`);
    const ministries = JSON.parse(minRes.body);
    assert(Array.isArray(ministries) && ministries.length === 6, `GET /api/ministries returned 6 ministries (got: ${ministries.length})`);

    const pathRes = await httpGet('/api/discipleship/pathways');
    assert(pathRes.statusCode === 200, `GET /api/discipleship/pathways returned HTTP ${pathRes.statusCode}`);
    const pathways = JSON.parse(pathRes.body);
    assert(Array.isArray(pathways) && pathways.length === 5, `GET /api/discipleship/pathways returned 5 steps (got: ${pathways.length})`);

    const leaderRes = await httpGet('/api/public/arcade-leaderboards');
    assert(leaderRes.statusCode === 200, `GET /api/public/arcade-leaderboards returned HTTP ${leaderRes.statusCode}`);
  } catch (err) {
    assert(false, `Live HTTP API request failed: ${err.message}`);
  }

  // --- GROUP 4: LOCAL SHARED CORE PROVIDER CONTRACT VERIFICATION ---
  console.log('\nGroup 4: LocalSharedCoreProvider Method Contract Verification');
  assert(fs.existsSync(SHARED_CORE_FILE), `Shared core file exists at ${SHARED_CORE_FILE}`);
  
  const sharedCoreModule = require(SHARED_CORE_FILE);
  assert(typeof sharedCoreModule.LocalSharedCoreProvider === 'function', 'LocalSharedCoreProvider class is exported');
  const provider = new sharedCoreModule.LocalSharedCoreProvider();

  const expectedMethods = [
    'getCurrentMember', 'getLifePoints', 'awardLifePoints', 'getQuests', 'getQuest',
    'getQuestCompletion', 'completeQuest', 'getEvents', 'getEvent', 'getAttendance',
    'getAllAttendanceRecords', 'checkIn', 'getMyCampfires', 'getCampfire', 'getCampfireMembers',
    'getCampfireLeaders', 'getCampfireGameState', 'getCampfireSettings', 'setCommunityMaxParticipants',
    'setCampfireCapacity', 'addReactionToCampfire', 'getMinistries', 'getMyMinistries',
    'getMinistryMissions', 'getMyMinistryMissions', 'getMilestones', 'getGrowthProgress',
    'emitActivityEvent', 'getActivityEvents', 'resetToBaseline'
  ];

  assert(expectedMethods.length === 30, 'Contract specifies exactly 30 provider methods');
  let missingMethods = [];
  expectedMethods.forEach(m => {
    if (typeof provider[m] !== 'function') missingMethods.push(m);
  });
  assert(missingMethods.length === 0, `All 30 methods implemented on provider instance (missing: ${missingMethods.join(', ') || 'none'})`);

  // --- GROUP 5: DOCUMENTATION & CANONICAL ARCHITECTURE DIRECTIVES CHECKS ---
  console.log('\nGroup 5: Documentation & Canonical Architecture Directives Checks');
  assert(fs.existsSync(AUDIT_DOC), 'KOINONIA_PHASE22_STAGING_AUDIT.md exists');
  const auditContent = fs.readFileSync(AUDIT_DOC, 'utf8');
  const auditSections = [
    '1. Executive Summary', '2. Target Database Overview', '3. Core Audit Area 1: Member Identity',
    '4. Core Audit Area 2: Life Points', '5. Core Audit Area 3: XP & Growth',
    '6. Core Audit Area 4: Events & Attendance', '7. Core Audit Area 5: Campfires',
    '8. Core Audit Area 6: Ministries', '9. Core Audit Area 7: Milestones',
    '10. Core Audit Area 8: 📖 FAITH QUEST CHALLENGE vs 📜 QUEST',
    '11. Core Audit Area 9: Sports & Fit Quest Absence',
    '12. Core Audit Area 10: API Route Inventory & Security Audit',
    '13. Core Audit Area 11: Database Constraints'
  ];
  auditSections.forEach(s => {
    assert(auditContent.includes(s), `Audit doc contains section: ${s}`);
  });

  // Canonical Terminology Assertions across Audit doc
  assert(auditContent.includes('FAITH QUEST CHALLENGE'), 'Audit doc references FAITH QUEST CHALLENGE');
  assert(!auditContent.includes('Faith Quest Trivia'), 'Audit doc rejects prohibited "Faith Quest Trivia"');
  assert(!auditContent.includes('Faith Trivia Challenge'), 'Audit doc rejects prohibited "Faith Trivia Challenge"');
  assert(!auditContent.includes('Koinonia Life Quest'), 'Audit doc rejects prohibited "Koinonia Life Quest"');
  assert(auditContent.includes('NO UNRESTRICTED FREE-TEXT MESSAGING FOR MINORS'), 'Audit doc specifies canonical minor communication safety rule');
  assert(auditContent.includes('Koinonia / Fire of God youth-safety policy'), 'Audit doc cites Koinonia / Fire of God youth-safety policy');
  assert(auditContent.includes('SPORTS HUB / Fit Quest'), 'Audit doc distinguishes SPORTS HUB / Fit Quest from FAITH QUEST CHALLENGE');
  assert(!auditContent.includes('min 3'), 'Audit doc contains zero instances of "min 3"');
  assert(auditContent.includes('Minimum participants required to ACTIVATE = 5'), 'Audit doc specifies Campfire minimum activation = 5');
  assert(!auditContent.includes('max 50 LP') && !auditContent.includes('50 LP per quest'), 'Audit doc contains zero unapproved "50 LP" caps');

  // Gap Matrix Assertions
  assert(fs.existsSync(GAP_MATRIX_DOC), 'KOINONIA_PHASE22_SHARED_CORE_GAP_MATRIX.md exists');
  const gapContent = fs.readFileSync(GAP_MATRIX_DOC, 'utf8');
  assert(gapContent.includes('Data Ownership Matrix'), 'Gap Matrix doc contains Data Ownership Matrix');
  assert(gapContent.includes('Current Main App Write Path') && gapContent.includes('Target Koinonia Shared Core Write Path'), 'Gap Matrix Data Ownership Matrix distinguishes Main App vs Koinonia write paths');
  assert(gapContent.includes('FAITH QUEST CHALLENGE'), 'Gap Matrix doc uses canonical FAITH QUEST CHALLENGE');
  assert(!gapContent.includes('Faith Quest Trivia'), 'Gap Matrix doc rejects prohibited "Faith Quest Trivia"');
  assert(!gapContent.includes('Koinonia Life Quest'), 'Gap Matrix doc rejects prohibited "Koinonia Life Quest"');
  assert(gapContent.includes('NO UNRESTRICTED FREE-TEXT MESSAGING FOR MINORS'), 'Gap Matrix doc enforces minor communication safety');
  assert(gapContent.includes('Shared Core API Security Architecture Requirement'), 'Gap Matrix doc specifies Shared Core API Security requirements');
  assert(gapContent.includes('Stewardship, Responsibility, Discipline, Teamwork, Service, Reflection'), 'Gap Matrix doc establishes server-side storage for all 6 Virtue XP dimensions');
  assert(gapContent.includes('NOT the permanent storage for Quest completions'), 'Gap Matrix doc confirms member_milestones is NOT permanent quest completion storage');
  assert(gapContent.includes('CONTENT REGISTRY / API'), 'Gap Matrix doc mandates validated Content Registry / API for Studio publishing');
  assert(!gapContent.includes('min 3'), 'Gap Matrix doc contains zero instances of "min 3"');
  assert(gapContent.includes('Minimum participants required to ACTIVATE = 5'), 'Gap Matrix doc specifies Campfire minimum activation = 5');
  assert(!gapContent.includes('max 50 LP') && !gapContent.includes('50 LP per quest'), 'Gap Matrix doc contains zero unapproved "50 LP" caps');
  assert(gapContent.includes('/api/v1/shared/attendance/check-in'), 'Gap Matrix specifies secured check-in endpoint boundary');

  // Taxonomy & Recalculated Gap Classification Totals
  assert(gapContent.includes('following six gap classifications:'), 'Gap Matrix specifies exactly six gap classifications taxonomy');
  assert(gapContent.includes('6. **`PROTOTYPE ONLY`**'), 'Gap Matrix lists PROTOTYPE ONLY as 6th classification');
  assert(gapContent.includes('| **`DIRECTLY MAPPABLE`** | 9 | 30.0% |'), 'Gap Matrix table records exactly 9 Directly Mappable methods');
  assert(gapContent.includes('| **`MAPPABLE WITH ADAPTER`** | 10 | 33.3% |'), 'Gap Matrix table records exactly 10 Mappable with Adapter methods');
  assert(gapContent.includes('| **`POLICY DECISION GOVERNED`** | 6 | 20.0% |'), 'Gap Matrix table records exactly 6 Policy Governed methods');
  assert(gapContent.includes('| **`REQUIRES SCHEMA CHANGE`** | 2 | 6.7% |'), 'Gap Matrix table records exactly 2 Requires Schema Change methods');
  assert(gapContent.includes('| **`REQUIRES NEW BACKEND API`** | 2 | 6.7% |'), 'Gap Matrix table records exactly 2 Requires New Backend API methods');
  assert(gapContent.includes('| **`PROTOTYPE ONLY`** | 1 | 3.3% |'), 'Gap Matrix table records exactly 1 Prototype Only method');

  // Role-Aware Target-Member / Target-Resource Authorization Assertions
  assert(gapContent.includes('authenticated ordinary MEMBER may mutate only their own authorized member state'), 'Gap Matrix specifies ordinary member self-only mutation');
  assert(gapContent.includes('mutation targeting another member or protected resource is permitted ONLY when the authenticated session possesses an explicit server-side role/permission'), 'Gap Matrix specifies explicitly authorized staff cross-member action');
  assert(gapContent.includes('Unauthorized cross-member access must return an appropriate authorization error (HTTP 403 Forbidden)'), 'Gap Matrix specifies unauthorized cross-member mutation rejected with 403');
  assert(gapContent.includes('Campfire settings*: Only authorized Campfire Leader/Admin/Superadmin') || gapContent.includes('Campfire settings: Only authorized Campfire Leader/Admin/Superadmin'), 'Gap Matrix specifies Campfire leader/admin resource authorization');
  assert(gapContent.includes('Studio publication*: Only authorized SUPERADMIN after approved workflow') || gapContent.includes('Studio publication: Only authorized SUPERADMIN after approved workflow'), 'Gap Matrix specifies Superadmin publication authorization');

  // Audit Doc Role-Aware Assertions
  assert(auditContent.includes('authenticated ordinary MEMBER may mutate only their own authorized member state'), 'Audit doc specifies ordinary member self-only mutation');
  assert(auditContent.includes('mutation targeting another member or protected resource is permitted ONLY when the authenticated session possesses an explicit server-side role/permission'), 'Audit doc specifies explicitly authorized staff cross-member action');
  assert(auditContent.includes('Unauthorized cross-member access must return an appropriate authorization error (HTTP 403 Forbidden)'), 'Audit doc specifies unauthorized cross-member mutation rejected with 403');

  // Blueprint Doc Assertions
  assert(fs.existsSync(BLUEPRINT_DOC), 'KOINONIA_SHARED_CORE_BLUEPRINT.md exists');
  const blueprintContent = fs.readFileSync(BLUEPRINT_DOC, 'utf8');
  assert(blueprintContent.includes('22.3 Phase 0.22 Specification: Stage 2 Deep Read-Only Audit'), 'Blueprint doc contains Section 22.3');
  assert(blueprintContent.includes('Directive 1: Life Points & Virtue XP Architecture'), 'Blueprint doc contains Directive 1');
  assert(blueprintContent.includes('Directive 2: Campfire Capacity & Quest Circles'), 'Blueprint doc contains Directive 2');
  assert(blueprintContent.includes('Directive 3: Youth Communication Safety Policy'), 'Blueprint doc contains Directive 3');
  assert(blueprintContent.includes('Directive 4: Canonical Quest Storage Architecture'), 'Blueprint doc contains Directive 4');
  assert(blueprintContent.includes('Directive 5: Mandatory Canonical Terminology'), 'Blueprint doc contains Directive 5');
  assert(blueprintContent.includes('Directive 6: Studio Publication Governance Contract'), 'Blueprint doc contains Directive 6');
  assert(blueprintContent.includes('Directive 7: Shared Core API Security Architecture'), 'Blueprint doc contains Directive 7');
  assert(!blueprintContent.includes('Faith Quest Trivia'), 'Blueprint doc rejects prohibited "Faith Quest Trivia"');
  assert(!blueprintContent.includes('Koinonia Life Quest'), 'Blueprint doc rejects prohibited "Koinonia Life Quest"');
  const bpSec22 = blueprintContent.substring(blueprintContent.indexOf('#### 22.3 Phase 0.22 Specification'));
  assert(!bpSec22.includes('min 3'), 'Blueprint doc Section 22.3+ contains zero instances of "min 3"');
  assert(bpSec22.includes('Minimum participants required to ACTIVATE: **5**'), 'Blueprint doc Directive 2 specifies minimum activation: 5');
  assert(!bpSec22.includes('max 50 LP') && !bpSec22.includes('50 LP per quest'), 'Blueprint doc Section 22.3+ contains zero unapproved "50 LP" caps');
  assert(bpSec22.includes('/api/v1/shared/attendance/check-in'), 'Blueprint doc specifies secured check-in endpoint boundary');
  assert(bpSec22.includes('authenticated ordinary MEMBER may mutate only their own authorized member state'), 'Blueprint doc specifies ordinary member self-only mutation');
  assert(bpSec22.includes('mutation targeting another member or protected resource is permitted ONLY when the authenticated session possesses an explicit server-side role/permission'), 'Blueprint doc specifies explicitly authorized staff cross-member action');
  assert(bpSec22.includes('Unauthorized cross-member access must return an appropriate authorization error (HTTP 403 Forbidden)'), 'Blueprint doc specifies unauthorized cross-member mutation rejected with 403');
  assert(bpSec22.includes('Campfire settings: only authorized Campfire Leader/Admin/Superadmin'), 'Blueprint doc specifies Campfire leader/admin resource authorization');
  assert(bpSec22.includes('Studio publication: only authorized SUPERADMIN after approved workflow'), 'Blueprint doc specifies Superadmin publication authorization');

  // --- GROUP 6: POST-AUDIT SAFETY & HASH VERIFICATION ---
  console.log('\nGroup 6: Post-Audit Safety & Hash Verification');
  const postHash = getDbSha256();
  assert(postHash === initialHash, `Database SHA256 unchanged post-audit: ${postHash}`);
  assert(postHash === EXPECTED_DB_SHA256, 'Database SHA256 strictly equals baseline');

  let postGitStatus = '';
  try {
    postGitStatus = execSync(`git -C "${STAGING_DIR}" status --porcelain`, { encoding: 'utf8' }).trim();
  } catch (e) {
    postGitStatus = 'ERROR';
  }
  assert(postGitStatus === '', 'Staging working tree remains 100% untouched post-audit');

  console.log('\n================================================================');
  console.log(`  AUDIT VERIFICATION SUMMARY: ${passedTests} / ${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAuditVerification().catch(err => {
  console.error('Fatal error during audit verification:', err);
  process.exit(1);
});
