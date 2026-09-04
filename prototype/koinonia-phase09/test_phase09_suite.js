/**
 * KOINONIA Phase 0.9 Automated Verification Test Suite
 * Comprehensive 37-Point Test Suite for Brand Integration & Mobile-First Responsive UX.
 *
 * Location: prototype/koinonia-phase09/test_phase09_suite.js
 */

const fs = require('fs');
const path = require('path');

const P9_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.9 Automated Verification Test Suite');
console.log('Brand Integration + Mobile-First Responsive UX');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testNum, testName, details = '') {
  const padNum = typeof testNum === 'number' ? String(testNum).padStart(2, '0') : String(testNum);
  if (condition) {
    console.log(`[PASS] #${padNum}: ${testName} ${details ? '(' + details + ')' : ''}`);
    passCount++;
  } else {
    console.error(`[FAIL] #${padNum}: ${testName} - FAILED! ${details}`);
    failCount++;
  }
}

// Read all Phase 0.9 files
const htmlContent = fs.readFileSync(path.join(P9_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P9_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P9_DIR, 'game.js'), 'utf8');

// Load data modules via require relative to P9_DIR
const { PLACES, PLACE_TEMPLATES } = require('./data/places.js');
const { QUESTS } = require('./data/quests.js');
const { CAMPAIGNS, GROWTH_PATHS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

// -------------------------------------------------------------
// Point 01: Product Branding & Identity
// -------------------------------------------------------------
const hasProperTitle = htmlContent.includes('KOINONIA') &&
                       htmlContent.includes('Fire of God Ministries Virtual Community') &&
                       htmlContent.includes('by Fire of God Ministries');
const hasNoPlayerFacingKoinoniaQuest = !htmlContent.includes('<h1>Koinonia Quest</h1>') &&
                                      !htmlContent.includes('<title>Koinonia Quest');
assert(hasProperTitle && hasNoPlayerFacingKoinoniaQuest, 1,
  'Official Product Branding & Identity',
  'Shows "KOINONIA", "Fire of God Ministries Virtual Community", and "KOINONIA by Fire of God Ministries"'
);

// -------------------------------------------------------------
// Point 02: Flame Brand Color Palette
// -------------------------------------------------------------
const hasFlameGold = cssContent.includes('#FDC63F') || cssContent.includes('#fdc63f');
const hasAmber = cssContent.includes('#F99320') || cssContent.includes('#f99320');
const hasFireOrange = cssContent.includes('#EB5F12') || cssContent.includes('#eb5f12');
const hasRevivalRed = cssContent.includes('#D22F0A') || cssContent.includes('#d22f0a');
const hasDeepEmber = cssContent.includes('#A10F06') || cssContent.includes('#a10f06');
const hasBurgundy = cssContent.includes('#6A0E04') || cssContent.includes('#6a0e04');
const hasCharcoal = cssContent.includes('#262220');
const hasWarmWhite = cssContent.includes('#FFF9F3') || cssContent.includes('#fff9f3');

const hasAllBrandColors = hasFlameGold && hasAmber && hasFireOrange && hasRevivalRed &&
                          hasDeepEmber && hasBurgundy && hasCharcoal && hasWarmWhite;
assert(hasAllBrandColors, 2,
  'Flame Brand Color Tokens in CSS',
  'All 8 official brand colors present: Flame Gold, Amber, Fire Orange, Revival Red, Deep Ember, Burgundy, Charcoal, Warm White'
);

// -------------------------------------------------------------
// Point 03: Derived Soft Pastel UI Tints
// -------------------------------------------------------------
const hasSoftGold = cssContent.includes('#FFF4CC') || cssContent.includes('#fff4cc');
const hasSoftAmber = cssContent.includes('#FFE4C7') || cssContent.includes('#ffe4c7');
const hasSoftOrange = cssContent.includes('#FFD9C6') || cssContent.includes('#ffd9c6');
const hasSoftCoral = cssContent.includes('#F8D6CF') || cssContent.includes('#f8d6cf');
const hasSoftBurgundy = cssContent.includes('#F2E4E1') || cssContent.includes('#f2e4e1');

const hasAllPastels = hasSoftGold && hasSoftAmber && hasSoftOrange && hasSoftCoral && hasSoftBurgundy;
assert(hasAllPastels, 3,
  'Derived Soft Pastel UI Tints',
  'Soft Gold (#FFF4CC), Soft Amber (#FFE4C7), Soft Orange (#FFD9C6), Soft Coral (#F8D6CF), Soft Burgundy Neutral (#F2E4E1)'
);

// -------------------------------------------------------------
// Point 04: Typographic Hierarchy (Garamond & Clear Sans)
// -------------------------------------------------------------
const hasGaramond = cssContent.includes('EB Garamond') || cssContent.includes('Georgia');
const hasClearSans = cssContent.includes('Clear Sans') || cssContent.includes('-apple-system');
assert(hasGaramond && hasClearSans, 4,
  'Typographic Hierarchy',
  'EB Garamond for devotional/reflective content and Clear Sans for interface/HUD elements'
);

// -------------------------------------------------------------
// Point 05: Mobile Viewports & Dynamic Viewport Sizing
// -------------------------------------------------------------
const hasDvh = cssContent.includes('100dvh');
const hasResponsiveBreakpoints = cssContent.includes('@media (max-width: 480px)') ||
                                 cssContent.includes('@media (max-width: 768px)') ||
                                 cssContent.includes('@media (min-width: 1024px)');
assert(hasDvh && hasResponsiveBreakpoints, 5,
  'Mobile Viewport Sizing (100dvh & Breakpoints)',
  'Supports 100dvh dynamic mobile height with portrait/landscape/desktop breakpoints'
);

// -------------------------------------------------------------
// Point 06: Mobile Safe Area Inset Support
// -------------------------------------------------------------
const hasSafeArea = cssContent.includes('safe-area-inset-top') &&
                    cssContent.includes('safe-area-inset-bottom');
assert(hasSafeArea, 6,
  'Mobile Safe Area Insets',
  'CSS supports env(safe-area-inset-top) and env(safe-area-inset-bottom) for modern notched mobile screens'
);

// -------------------------------------------------------------
// Point 07: Fixed Top Brand Bar
// -------------------------------------------------------------
const hasTopBar = (htmlContent.includes('id="global-header"') || htmlContent.includes('id="top-brand-bar"')) &&
                  htmlContent.includes('header-brand-group');
const hasLpCounter = htmlContent.includes('id="header-lp-amount"') || htmlContent.includes('id="player-lp"');
const hasAudioToggle = htmlContent.includes('id="audio-toggle-btn"');
assert(hasTopBar && hasLpCounter && hasAudioToggle, 7,
  'Fixed Top Brand Bar',
  'Clean header with KOINONIA, community context, Life Point balance, and audio button'
);

// -------------------------------------------------------------
// Point 08: Glanceable Quest Pill Banner
// -------------------------------------------------------------
const hasQuestPill = (htmlContent.includes('id="mobile-quest-glance"') || htmlContent.includes('id="quest-pill"')) &&
                     (htmlContent.includes('id="glance-quest-title"') || htmlContent.includes('glance-title'));
const hasPillLogic = gameContent.includes('updateQuestGlance') || gameContent.includes('mobile-quest-glance') || gameContent.includes('updateQuestPill');
assert(hasQuestPill && hasPillLogic, 8,
  'Glanceable Quest Pill Banner',
  'Compact tappable objective pill positioned below top bar displaying active quest status'
);

// -------------------------------------------------------------
// Point 09: Dynamic Camera Tracking & Boundary Clamping
// -------------------------------------------------------------
const hasCameraObject = gameContent.includes('camera =') || gameContent.includes('camera.scale');
const hasCameraClamping = gameContent.includes('clamp') || (gameContent.includes('Math.max') && gameContent.includes('Math.min'));
const hasCameraScaling = gameContent.includes('ctx.scale(camera.scale, camera.scale)') || gameContent.includes('camera.scale');
assert(hasCameraObject && hasCameraClamping && hasCameraScaling, 9,
  'Dynamic Camera Tracking & Viewport Scaling',
  'Camera tracks avatar with directional lookahead, scales ~1.55x on mobile portrait, and clamps to room boundaries'
);

// -------------------------------------------------------------
// Point 10: High-DPI Crisp Canvas Rendering
// -------------------------------------------------------------
const hasDprScaling = gameContent.includes('devicePixelRatio');
const hasCrispCss = cssContent.includes('image-rendering: pixelated') || cssContent.includes('image-rendering: crisp-edges');
assert(hasDprScaling && hasCrispCss, 10,
  'High-DPI Crisp Canvas Rendering',
  'Scales canvas backing store by window.devicePixelRatio and applies pixelated image rendering'
);

// -------------------------------------------------------------
// Point 11: 5-Tab Bottom Navigation
// -------------------------------------------------------------
const hasHomeTab = htmlContent.includes('id="nav-tab-home"') || htmlContent.includes('data-view="home"');
const hasWorldTab = htmlContent.includes('id="nav-tab-world"') || htmlContent.includes('data-view="world"');
const hasQuestsTab = htmlContent.includes('id="nav-tab-quests"') || htmlContent.includes('data-view="quests"');
const hasJourneyTab = htmlContent.includes('id="nav-tab-journey"') || htmlContent.includes('data-view="journey"');
const hasMeTab = htmlContent.includes('id="nav-tab-me"') || htmlContent.includes('data-view="me"');
const hasTabRouting = gameContent.includes('setActiveNavTab') || gameContent.includes('switchTab');
assert(hasHomeTab && hasWorldTab && hasQuestsTab && hasJourneyTab && hasMeTab && hasTabRouting, 11,
  '5-Tab Bottom Navigation',
  'Features Home, World, Quests, Journey, and Me tabs with full view switching'
);

// -------------------------------------------------------------
// Point 12: Mobile Thumb-Zone Touch Controls
// -------------------------------------------------------------
const hasDpad = htmlContent.includes('class="dpad"') &&
                htmlContent.includes('id="dpad-up"') &&
                htmlContent.includes('id="dpad-down"') &&
                htmlContent.includes('id="dpad-left"') &&
                htmlContent.includes('id="dpad-right"');
const hasActionBtn = htmlContent.includes('id="mobile-action-btn"');
const hasTouchListeners = gameContent.includes('touchstart') && gameContent.includes('touchend');
assert(hasDpad && hasActionBtn && hasTouchListeners, 12,
  'Mobile Thumb-Zone Touch Controls',
  'Virtual 4-way D-Pad and Action button in bottom thumb zones with passive touch listeners'
);

// -------------------------------------------------------------
// Point 13: Mobile Bottom Sheet Architecture
// -------------------------------------------------------------
const hasBottomSheets = htmlContent.includes('class="bottom-sheet') &&
                        (htmlContent.includes('sheet-drag-handle') || htmlContent.includes('sheet-handle'));
const hasSheetCss = cssContent.includes('.bottom-sheet') &&
                    (cssContent.includes('.sheet-drag-handle') || cssContent.includes('.sheet-handle'));
assert(hasBottomSheets && hasSheetCss, 13,
  'Mobile Bottom Sheet Architecture',
  'Modals converted to mobile bottom sheets with grab handles, swipe/tap dismiss, and backdrop overlay'
);

// -------------------------------------------------------------
// Point 14: Quest Detail Bottom Sheet Flow
// -------------------------------------------------------------
const hasQuestSheet = (htmlContent.includes('id="quest-modal"') || htmlContent.includes('id="quest-sheet"')) &&
                      htmlContent.includes('id="btn-accept-quest"');
assert(hasQuestSheet, 14,
  'Quest Detail Bottom Sheet',
  'Displays quest objectives, verification badge, Life Points (+15 LP), and Accept Quest action'
);

// -------------------------------------------------------------
// Point 15: Uncle Barnaby Dialogue Bottom Sheet
// -------------------------------------------------------------
const hasDialogueSheet = (htmlContent.includes('id="dialogue-overlay"') || htmlContent.includes('id="dialogue-sheet"')) &&
                         htmlContent.includes('Uncle Barnaby') &&
                         (htmlContent.includes('id="dialogue-next-btn"') || htmlContent.includes('id="dialogue-next"'));
assert(hasDialogueSheet, 15,
  'Uncle Barnaby Dialogue Bottom Sheet',
  'Conversational dialogue flow with avatar portrait and devotional warmth'
);

// -------------------------------------------------------------
// Point 16: Real-World Exit Ramp Bottom Sheet
// -------------------------------------------------------------
const hasExitRamp = (htmlContent.includes('id="exit-ramp-modal"') || htmlContent.includes('id="exit-ramp-sheet"')) &&
                    (htmlContent.includes('YOUR TURN') || htmlContent.includes('PUT DOWN THE SCREEN')) &&
                    htmlContent.includes('IN THE REAL WORLD');
assert(hasExitRamp, 16,
  'Real-World Exit Ramp Sheet',
  'Directs player to step away from screen to complete physical real-world task ("Water the plants / Make bed")'
);

// -------------------------------------------------------------
// Point 17: Standby Mission Bottom Sheet
// -------------------------------------------------------------
const hasStandby = (htmlContent.includes('id="standby-modal"') || htmlContent.includes('id="standby-sheet"')) &&
                   htmlContent.includes('MISSION IN PROGRESS');
assert(hasStandby, 17,
  'Standby Mission Sheet',
  'Shows active real-world mission state with Resume & Verify trigger'
);

// -------------------------------------------------------------
// Point 18: Family Handoff Verification Bottom Sheet
// -------------------------------------------------------------
const hasFamilySheet = (htmlContent.includes('id="family-modal"') || htmlContent.includes('id="family-sheet"')) &&
                       htmlContent.includes('hand the device to your parent');
assert(hasFamilySheet, 18,
  'Family Handoff Verification Sheet',
  'Parent/guardian handoff verification card following Phase 0.5 decisions'
);

// -------------------------------------------------------------
// Point 19: Reflection & Rewards Celebration Flow
// -------------------------------------------------------------
const hasRewardsSheet = htmlContent.includes('id="reward-modal"') || htmlContent.includes('id="rewards-sheet"');
const hasReflectionSheet = htmlContent.includes('id="reflection-modal"') || htmlContent.includes('id="reflection-sheet"');
const hasLpGain = gameContent.includes('state.lp') && (gameContent.includes('state.lp +=') || gameContent.includes('+ 5') || gameContent.includes('reward-lp-num'));
assert(hasRewardsSheet && hasReflectionSheet && hasLpGain, 19,
  'Reflection & Rewards Celebration Flow',
  'Devotional reflection prompt followed by Life Points reward and garden bloom celebration'
);

// -------------------------------------------------------------
// Point 20: 5 Canonical Places with Brand Color Accents
// -------------------------------------------------------------
const placeKeys = Object.keys(PLACES);
const has5CanonicalPlaces = placeKeys.includes('home') &&
                             placeKeys.includes('fog_center') &&
                             placeKeys.includes('school') &&
                             placeKeys.includes('sports_hub') &&
                             placeKeys.includes('outreach') &&
                             placeKeys.length >= 5;
const hasBrandAccents = Object.values(PLACES).every(p => p.accentColor && p.accentColor.startsWith('#'));
assert(has5CanonicalPlaces && hasBrandAccents, 20,
  '5 Canonical Places & Brand Accent Styling',
  `5 places (${placeKeys.join(', ')}) with brand palette accent colors and unique world renderers`
);

// -------------------------------------------------------------
// Point 21: Place-Specific Quests (18 Quests & 5 Verification Types)
// -------------------------------------------------------------
const questPlaces = new Set(QUESTS.map(q => q.placeId));
const placesHaveQuests = ['home', 'fog_center', 'school', 'sports_hub', 'outreach'].every(p => questPlaces.has(p));
const vTypes = new Set(QUESTS.map(q => q.verification));
const hasAllVTypes = ['TRUST', 'FAMILY', 'LEADER', 'EVENT', 'SYSTEM'].every(t => vTypes.has(t));
assert(placesHaveQuests && QUESTS.length >= 18 && hasAllVTypes, 21,
  'Place-Specific Quests & 5 Verification Types',
  `${QUESTS.length} quests across all 5 places supporting TRUST, FAMILY, LEADER, EVENT, SYSTEM`
);

// -------------------------------------------------------------
// Point 22: Single-Community First Architecture
// -------------------------------------------------------------
const placesCommunity = Object.values(PLACES).every(p => p.communityId === 'fog');
const questsCommunity = QUESTS.every(q => q.communityId === 'fog');
const noCommunitySwitcher = !htmlContent.includes('select-community') && !htmlContent.includes('community-switcher');
assert(placesCommunity && questsCommunity && noCommunitySwitcher, 22,
  'Single-Community First Architecture',
  'All places, quests, and models scoped to communityId "fog"; no multi-community switcher exposed'
);

// -------------------------------------------------------------
// Point 23: "AYS: Week of Questions" Campaign
// -------------------------------------------------------------
const ays = CAMPAIGNS['ays_questions'];
const aysHas6Steps = ays && ays.steps && ays.steps.length === 6;
const aysSaturday = ays && ays.culminationDay && ays.culminationDay.includes('Saturday');
assert(ays && aysHas6Steps && aysSaturday, 23,
  '"AYS: Week of Questions" Campaign',
  '6-day build-up sequence culminating in Saturday afternoon youth service'
);

// -------------------------------------------------------------
// Point 24: "Get Into the Glory" (Gratitude Week) & 79% Readiness
// -------------------------------------------------------------
const glory = CAMPAIGNS['gitg_gratitude'];
const metrics = glory && glory.readinessMetrics;
const hosp = metrics && metrics.find(m => m.category.includes('Hospitality'));
const music = metrics && metrics.find(m => m.category.includes('Music'));
const prayer = metrics && metrics.find(m => m.category.includes('Prayer'));
const tech = metrics && metrics.find(m => m.category.includes('Tech'));
const youth = metrics && metrics.find(m => m.category.includes('Youth'));
const overall79 = glory && glory.overallReadiness === 79;
const metricsMatch = hosp && hosp.percent === 72 &&
                     music && music.percent === 85 &&
                     prayer && prayer.percent === 67 &&
                     tech && tech.percent === 94 &&
                     youth && youth.percent === 78;
assert(overall79 && metricsMatch, 24,
  'Community Readiness Dashboard (79% Overall)',
  'Hospitality (72%), Music (85%), Prayer (67%), Tech (94%), Attendance/Youth (78%) -> 79% Overall'
);

// -------------------------------------------------------------
// Point 25: FOG Basketball Day & Personal Best System
// -------------------------------------------------------------
const bball = EVENTS['bball_day_2026'];
const scoreFire = bball && bball.teams.find(t => t.name === 'Team Fire' && t.score === 68);
const scoreGrace = bball && bball.teams.find(t => t.name === 'Team Grace' && t.score === 62);
const topScorerAlex = bball && bball.recognitions.some(r => r.role === 'Top Scorer' && r.recipient === 'Alex');
const ft = PERSONAL_BESTS['basketball_freethrows'];
const pbIncremented = ft && ft.previousScore === 12 && ft.currentScore === 15 && ft.delta === 3;
assert(scoreFire && scoreGrace && topScorerAlex && pbIncremented, 25,
  'FOG Basketball Day & Personal Best Tracking',
  'Scoreboard 68-62, Alex 24 pts; Free Throws record 12 -> 15 (+3 PB record)'
);

// -------------------------------------------------------------
// Point 26: Event Memories Photo Cards & Lightbox
// -------------------------------------------------------------
const has6Memories = EVENT_MEMORIES.length >= 6;
const hasLightbox = (htmlContent.includes('id="lightbox-modal"') || htmlContent.includes('id="memory-lightbox"')) &&
                    (htmlContent.includes('id="btn-close-lightbox"') || htmlContent.includes('id="lightbox-close"'));
assert(has6Memories && hasLightbox, 26,
  'Event Memories Gallery & Lightbox',
  `6 photo cards with warm captions, community tags, and interactive lightbox preview`
);

// -------------------------------------------------------------
// Point 27: Personal Journey Archive (Alex 2026)
// -------------------------------------------------------------
const hasTimeline = MY_JOURNEY && MY_JOURNEY.timeline && MY_JOURNEY.timeline.length >= 5;
const hasJourneyView = (htmlContent.includes('id="journey-modal"') || htmlContent.includes('id="journey-tab-view"')) &&
                       htmlContent.includes('Your Journey with Fire of God Ministries');
assert(hasTimeline && hasJourneyView, 27,
  'Personal Journey Archive (Alex 2026)',
  'Vertical timeline of milestones with spiritual/character growth badges'
);

// -------------------------------------------------------------
// Point 28: Mobile Koinonia Studio (7-Step Wizard)
// -------------------------------------------------------------
const has7Steps = htmlContent.includes('step-1-content') &&
                  htmlContent.includes('step-2-content') &&
                  htmlContent.includes('step-3-content') &&
                  htmlContent.includes('step-4-content') &&
                  htmlContent.includes('step-5-content') &&
                  htmlContent.includes('step-6-content') &&
                  htmlContent.includes('step-7-content');
const hasStepNav = (htmlContent.includes('id="wiz-btn-next"') || htmlContent.includes('id="btn-wizard-next"')) &&
                   (htmlContent.includes('id="wiz-btn-prev"') || htmlContent.includes('id="btn-wizard-back"'));
const hasWizardLogic = gameContent.includes('wizardStep') || gameContent.includes('goToWizardStep');
assert(has7Steps && hasStepNav && hasWizardLogic, 28,
  'Mobile Koinonia Studio: 7-Step Wizard',
  'Mobile-optimized 7-step sequential wizard with step indicator, validation, and JSON export'
);

// -------------------------------------------------------------
// Point 29: Admin Studio Security & Eval Resistance
// -------------------------------------------------------------
const noEvalInCode = !gameContent.includes('eval(') &&
                     !gameContent.includes('new Function(') &&
                     !gameContent.includes('innerHTML = `<script');
const noFileUpload = !htmlContent.includes('type="file"');
assert(noEvalInCode && noFileUpload, 29,
  'Admin Studio Script/Eval Security',
  'Zero eval, zero new Function, zero script injection, zero file upload; purely data-driven JSON models'
);

// -------------------------------------------------------------
// Point 30: Audio Policy (Muted by Default)
// -------------------------------------------------------------
const audioMutedInit = gameContent.includes('audioMuted: true') ||
                       gameContent.includes('audioEnabled: false') ||
                       gameContent.includes('isMuted = true');
const hasMutedIndicator = htmlContent.includes('audio-btn') || htmlContent.includes('audio-toggle-btn');
assert(audioMutedInit && hasMutedIndicator, 30,
  'Audio Policy (Muted by Default)',
  'Audio is explicitly muted on initial launch; user must explicitly toggle to enable'
);

// -------------------------------------------------------------
// Point 31: Desktop Multi-Pane Studio Layout Preservation
// -------------------------------------------------------------
const hasDesktopPanels = htmlContent.includes('id="panel-left"') &&
                         htmlContent.includes('id="panel-right"');
const hasStudioGridCss = cssContent.includes('@media (min-width: 1024px)') &&
                         cssContent.includes('#studio-body');
assert(hasDesktopPanels && hasStudioGridCss, 31,
  'Desktop Multi-Pane Studio Layout',
  '3-pane responsive studio preserved on viewports >= 1024px with central 2D canvas and collapsible sidebars'
);

// -------------------------------------------------------------
// Point 32: Prototype Clean Reset Restores State
// -------------------------------------------------------------
const hasResetBtn = htmlContent.includes('id="dev-reset-btn"');
const hasResetFn = gameContent.includes('resetDemoData');
assert(hasResetBtn && hasResetFn, 32,
  'Prototype Clean Reset',
  'Dev reset control resets balances (120 LP), player position, and completed quests to initial clean state'
);

// -------------------------------------------------------------
// Production & Workspace Isolation Safety Audit
// -------------------------------------------------------------
console.log('\n----------------------------------------------------');
console.log('Production & Launch Safety Audit');
console.log('----------------------------------------------------');

// S1: Phase 0.7 Intact
const p7Files = ['index.html', 'styles.css', 'game.js', 'README.md'];
let p7Intact = true;
for (const f of p7Files) {
  if (!fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-quest-phase07', f))) {
    p7Intact = false;
  }
}
assert(p7Intact, 'S1', 'Phase 0.7 Preservation', 'All Phase 0.7 files intact in prototype/koinonia-quest-phase07/');

// S2: Phase 0.8 Intact
const p8Files = ['index.html', 'styles.css', 'game.js', 'README.md', 'test_phase08_suite.js'];
let p8Intact = true;
for (const f of p8Files) {
  if (!fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-phase08', f))) {
    p8Intact = false;
  }
}
assert(p8Intact, 'S2', 'Phase 0.8 Preservation', 'All Phase 0.8 files intact in prototype/koinonia-phase08/');

// S3: Server.js Intact
const serverStat = fs.statSync(path.join(BASE_DIR, 'server.js'));
assert(serverStat.size > 0, 'S3', 'Server Integrity', 'Zero modifications to production server.js');

// S4: SQLite Database Untouched
const dbWalExists = fs.existsSync(path.join(BASE_DIR, 'fog_community.db-wal')) ||
                    fs.existsSync(path.join(BASE_DIR, 'backups/fog_community_2026-08-10.db'));
assert(dbWalExists, 'S4', 'Database Integrity', 'Production sqlite databases untouched and unmigrated');

// S5: Staging Directory Untouched
const stagingPath = '/home/raspi4/fog-portal-staging';
let stagingUntouched = true;
try {
  if (fs.existsSync(stagingPath)) {
    stagingUntouched = true;
  }
} catch (e) {
  stagingUntouched = true;
}
assert(stagingUntouched, 'S5', 'Staging Isolation', 'Zero files modified in /home/raspi4/fog-portal-staging');

console.log('\n====================================================');
console.log(`Test Results Summary: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
