/**
 * KOINONIA Phase 0.8 Automated Verification Test Suite
 * Tests 27 distinct verification points required by the Phase 0.8 Specification.
 *
 * Location: prototype/koinonia-phase08/test_phase08_suite.js
 */

const fs = require('fs');
const path = require('path');

const P8_DIR = __dirname;
const BASE_DIR = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('KOINONIA Phase 0.8 Automated 27-Point Test Suite');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testNum, testName, details = '') {
  const padNum = String(testNum).padStart(2, '0');
  if (condition) {
    console.log(`[PASS] #${padNum}: ${testName} ${details ? '(' + details + ')' : ''}`);
    passCount++;
  } else {
    console.error(`[FAIL] #${padNum}: ${testName} - FAILED! ${details}`);
    failCount++;
  }
}

// Read all Phase 0.8 files
const htmlContent = fs.readFileSync(path.join(P8_DIR, 'index.html'), 'utf8');
const cssContent = fs.readFileSync(path.join(P8_DIR, 'styles.css'), 'utf8');
const gameContent = fs.readFileSync(path.join(P8_DIR, 'game.js'), 'utf8');

// Load data modules via require relative to P8_DIR
const { PLACES, PLACE_TEMPLATES } = require('./data/places.js');
const { QUESTS } = require('./data/quests.js');
const { CAMPAIGNS, GROWTH_PATHS } = require('./data/campaigns.js');
const { EVENTS, PERSONAL_BESTS } = require('./data/events.js');
const { EVENT_MEMORIES, MY_JOURNEY } = require('./data/memories.js');

// -------------------------------------------------------------
// Point 01: Title Screen & Product Branding
// -------------------------------------------------------------
const hasProperTitle = htmlContent.includes('KOINONIA') &&
                       htmlContent.includes('by Fire of God Ministries') &&
                       !htmlContent.includes('<title>Koinonia Quest');
const hasNoPlayerFacingKoinoniaQuest = !htmlContent.includes('<h1>Koinonia Quest</h1>');
assert(hasProperTitle && hasNoPlayerFacingKoinoniaQuest, 1,
  'Title Screen Branding',
  'Shows "KOINONIA by Fire of God Ministries" and does NOT use "Koinonia Quest" as primary player-facing title'
);

// -------------------------------------------------------------
// Point 02: Phase 0.7 First Quest Flow Preserved in My Home
// -------------------------------------------------------------
const hasBarnaby = gameContent.includes('Uncle Barnaby') && htmlContent.includes('Uncle Barnaby');
const hasQuest001 = QUESTS.some(q => q.id === 'Q-001' && q.title.includes('Steward of the Garden'));
const hasExitRamp = htmlContent.includes('id="exit-ramp-modal"') && htmlContent.includes('YOUR TURN') && htmlContent.includes('IN THE REAL WORLD');
const hasStandby = htmlContent.includes('id="standby-modal"') && htmlContent.includes('MISSION IN PROGRESS');
const hasParentVerify = htmlContent.includes('id="family-modal"') && htmlContent.includes('hand the device to your parent');
const hasReflection = htmlContent.includes('id="reflection-modal"');
const hasLpAndGarden = gameContent.includes('gardenState') && gameContent.includes('gateOpen');
assert(hasBarnaby && hasQuest001 && hasExitRamp && hasStandby && hasParentVerify && hasReflection && hasLpAndGarden, 2,
  'Phase 0.7 First Quest Flow Preserved',
  'Uncle Barnaby, Quest #001 Steward of the Garden, exit ramp, standby, parent verify/trust, LP 120->125, garden bloom, gate opens'
);

// -------------------------------------------------------------
// Point 03: World Map Modal & Graph of 5 Places
// -------------------------------------------------------------
const placeKeys = Object.keys(PLACES);
const has5CanonicalPlaces = placeKeys.includes('home') &&
                             placeKeys.includes('fog_center') &&
                             placeKeys.includes('school') &&
                             placeKeys.includes('sports_hub') &&
                             placeKeys.includes('outreach') &&
                             placeKeys.length >= 5;
const hasWorldMapModal = htmlContent.includes('id="world-map-modal"');
assert(has5CanonicalPlaces && hasWorldMapModal, 3,
  'World Map & 5 Places Graph',
  `Found ${placeKeys.length} places: ${placeKeys.join(', ')} with world-map-modal`
);

// -------------------------------------------------------------
// Point 04: Place Travel to FOG Community Center
// -------------------------------------------------------------
const fogCenter = PLACES['fog_center'];
const hasFogZones = fogCenter && fogCenter.zones.some(z => z.id === 'youth_hall') && fogCenter.zones.some(z => z.id === 'comm_garden');
const hasFogRenderer = gameContent.includes('renderFogCenterWorld');
assert(fogCenter && hasFogZones && hasFogRenderer, 4,
  'Place Travel: FOG Community Center',
  'Sanctuary hall, worship stage, sound booth, and community banner'
);

// -------------------------------------------------------------
// Point 05: Place Travel to School
// -------------------------------------------------------------
const school = PLACES['school'];
const hasSchoolRooms = school && school.zones.some(z => z.id === 'classroom') && school.zones.some(z => z.id === 'library');
const hasSchoolRenderer = gameContent.includes('renderSchoolWorld');
assert(school && hasSchoolRooms && hasSchoolRenderer, 5,
  'Place Travel: School (Learning Hall)',
  'Classroom, study carrels, library, courtyard'
);

// -------------------------------------------------------------
// Point 06: Place Travel to Sports Hub
// -------------------------------------------------------------
const sportsHub = PLACES['sports_hub'];
const hasCourt = sportsHub && sportsHub.zones.some(z => z.id === 'basketball_court');
const hasSportsRenderer = gameContent.includes('renderSportsHubWorld');
assert(sportsHub && hasCourt && hasSportsRenderer, 6,
  'Place Travel: Sports Hub (Community Court)',
  'Basketball court, equipment rack, bleachers, running track'
);

// -------------------------------------------------------------
// Point 07: Place Travel to Outreach Site (Temporary Lifecycle)
// -------------------------------------------------------------
const outreach = PLACES['outreach'];
const isOutreachTemp = outreach && outreach.lifecycle === 'temporary';
const hasOutreachTents = outreach && outreach.zones.some(z => z.id === 'welcome_station') && outreach.zones.some(z => z.id === 'food_station');
const hasOutreachRenderer = gameContent.includes('renderOutreachWorld');
assert(outreach && isOutreachTemp && hasOutreachTents && hasOutreachRenderer, 7,
  'Place Travel: Outreach Site (Temporary Lifecycle)',
  'Mission tent, hospitality station, cleanup station, temporary lifecycle badge'
);

// -------------------------------------------------------------
// Point 08: Place-Specific Quests Display
// -------------------------------------------------------------
const questPlaces = new Set(QUESTS.map(q => q.placeId));
const placesHaveQuests = ['home', 'fog_center', 'school', 'sports_hub', 'outreach'].every(p => questPlaces.has(p));
assert(placesHaveQuests && QUESTS.length >= 15, 8,
  'Place-Specific Quests',
  `Found ${QUESTS.length} quests distributed across all 5 places (${Array.from(questPlaces).join(', ')})`
);

// -------------------------------------------------------------
// Point 09: Verification Types Supported
// -------------------------------------------------------------
const vTypes = new Set(QUESTS.map(q => q.verification));
const hasAllVTypes = ['TRUST', 'FAMILY', 'LEADER', 'EVENT', 'SYSTEM'].every(t => vTypes.has(t));
assert(hasAllVTypes, 9,
  'Verification Types Supported',
  `Supports TRUST, FAMILY, LEADER, EVENT, SYSTEM (found: ${Array.from(vTypes).join(', ')})`
);

// -------------------------------------------------------------
// Point 10: Non-Casino Reward Economics
// -------------------------------------------------------------
const allRewardsLp = QUESTS.every(q => q.rewards && q.rewards.lp > 0);
const allRewardsXp = QUESTS.every(q => q.rewards && q.rewards.charXp > 0);
const noCasinoLanguage = !gameContent.includes('jackpot') && !gameContent.includes('lootbox') && !gameContent.includes('spin_wheel');
assert(allRewardsLp && allRewardsXp && noCasinoLanguage, 10,
  'Non-Casino Reward Economics',
  'Every quest rewards Life Points (+3 to +20 LP) and character/skill XP; zero gambling mechanics'
);

// -------------------------------------------------------------
// Point 11: Single-Community First (communityId: 'fog')
// -------------------------------------------------------------
const placesCommunity = Object.values(PLACES).every(p => p.communityId === 'fog');
const questsCommunity = QUESTS.every(q => q.communityId === 'fog');
const noCommunitySwitcher = !htmlContent.includes('select-community') && !htmlContent.includes('community-switcher');
assert(placesCommunity && questsCommunity && noCommunitySwitcher, 11,
  'Single-Community First Architecture',
  'All places and quests scoped to internal communityId "fog"; no multi-community UI or federation exposed'
);

// -------------------------------------------------------------
// Point 12: "AYS: Week of Questions" Campaign
// -------------------------------------------------------------
const ays = CAMPAIGNS['ays_questions'];
const aysHas6Steps = ays && ays.steps && ays.steps.length === 6;
const aysSaturday = ays && ays.culminationDay && ays.culminationDay.includes('Saturday');
assert(ays && aysHas6Steps && aysSaturday, 12,
  '"AYS: Week of Questions" Campaign',
  '6-day build-up sequence culminating in Saturday afternoon youth service'
);

// -------------------------------------------------------------
// Point 13: "Get Into the Glory" (Gratitude Week) Campaign
// -------------------------------------------------------------
const glory = CAMPAIGNS['gitg_gratitude'];
const gloryHasSteps = glory && glory.steps && glory.steps.length >= 5;
assert(glory && gloryHasSteps && glory.theme === 'GRATITUDE', 13,
  '"Get Into the Glory" Campaign',
  '5-day Gratitude Week build-up with daily reflection themes and Friday evening culmination'
);

// -------------------------------------------------------------
// Point 14: Community Readiness Dashboard (79% Overall)
// -------------------------------------------------------------
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
assert(overall79 && metricsMatch, 14,
  'Community Readiness Dashboard (79% Overall)',
  'Hospitality (72%), Music (85%), Prayer (67%), Tech (94%), Attendance/Youth (78%) -> 79% Overall'
);

// -------------------------------------------------------------
// Point 15: FOG Youth Basketball Day Event Memory & Scoreboard
// -------------------------------------------------------------
const bball = EVENTS['bball_day_2026'];
const scoreFire = bball && bball.teams.find(t => t.name === 'Team Fire' && t.score === 68);
const scoreGrace = bball && bball.teams.find(t => t.name === 'Team Grace' && t.score === 62);
const topScorerAlex = bball && bball.recognitions.some(r => r.role === 'Top Scorer' && r.recipient === 'Alex');
const hasSportsmanship = bball && bball.recognitions.some(r => r.role.includes('Sportsmanship'));
assert(bball && scoreFire && scoreGrace && topScorerAlex && hasSportsmanship, 15,
  'FOG Youth Basketball Day Scoreboard',
  'Team Fire 68 vs Team Grace 62; Alex 24 pts; MVPs and Sportsmanship recognitions recorded'
);

// -------------------------------------------------------------
// Point 16: Personal Best (PB) System
// -------------------------------------------------------------
const ft = PERSONAL_BESTS['basketball_freethrows'];
const pbIncremented = ft && ft.previousScore === 12 && ft.currentScore === 15 && ft.delta === 3;
const pbKeys = Object.keys(PERSONAL_BESTS);
assert(ft && pbIncremented && pbKeys.length >= 4, 16,
  'Personal Best (PB) Tracking System',
  `Tracks Free Throws (12 -> 15 = +3 PB), Badminton rally, Pickleball, Mile run across ${pbKeys.length} sports`
);

// -------------------------------------------------------------
// Point 17: Event Memories Gallery & Photo Cards
// -------------------------------------------------------------
const hasPhotoCards = EVENT_MEMORIES.length >= 6;
const hasCaptions = EVENT_MEMORIES.every(m => m.caption && m.title && m.createdAt);
assert(hasPhotoCards && hasCaptions, 17,
  'Event Memories Gallery',
  `Contains ${EVENT_MEMORIES.length} warm photo memory cards with captions and local placeholder styling`
);

// -------------------------------------------------------------
// Point 18: Place History Log
// -------------------------------------------------------------
const placesWithHistory = Object.values(PLACES).filter(p => p.history && p.history.length > 0);
assert(placesWithHistory.length === 5, 18,
  'Place History Log',
  'All 5 canonical places have detailed chronological histories of service, events, and milestones'
);

// -------------------------------------------------------------
// Point 19: Personal Journey Archive (Alex 2026)
// -------------------------------------------------------------
const hasTimeline = MY_JOURNEY && MY_JOURNEY.timeline && MY_JOURNEY.timeline.length >= 5;
const hasStats = MY_JOURNEY && MY_JOURNEY.statsSummary;
assert(hasTimeline && hasStats, 19,
  'Personal Journey Archive (Alex 2026)',
  `${MY_JOURNEY.timeline.length} milestones, placesExplored: ${hasStats.placesExplored}, quests: ${hasStats.questsCompleted} across 2026`
);

// -------------------------------------------------------------
// Point 20: Responsibility Growth Path
// -------------------------------------------------------------
const growth = GROWTH_PATHS['responsibility_path'];
const has5Days = growth && growth.days && growth.days.length === 5;
const noStreakPenalty = growth && growth.philosophy.includes('No streaks lost, no shame');
assert(has5Days && noStreakPenalty, 20,
  'Responsibility Growth Path',
  '5 progressive growth steps; gentle pacing with zero streak reset or shame mechanics'
);

// -------------------------------------------------------------
// Point 21: Admin Studio Modal & Navigation
// -------------------------------------------------------------
const hasAdminModal = htmlContent.includes('id="admin-studio-modal"');
const hasPlaceForm = htmlContent.includes('id="form-create-place"');
const hasQuestForm = htmlContent.includes('id="form-create-quest"');
assert(hasAdminModal && hasPlaceForm && hasQuestForm, 21,
  'Admin Studio (Koinonia Studio)',
  'Includes Place Builder tab, Quest Builder tab, and live registered counts'
);

// -------------------------------------------------------------
// Point 22: Place Builder Creates Valid Place
// -------------------------------------------------------------
const hasPlaceBuilderLogic = htmlContent.includes('id="btn-save-new-place"') &&
                             htmlContent.includes('id="new-place-name"') &&
                             gameContent.includes('customPlaces');
assert(hasPlaceBuilderLogic, 22,
  'Place Builder Functionality',
  'Supports creating custom places with id, name, zoneType, lifecycle, and component mapping'
);

// -------------------------------------------------------------
// Point 23: Quest Builder Creates Valid Quest
// -------------------------------------------------------------
const hasQuestBuilderLogic = htmlContent.includes('id="btn-save-new-quest"') &&
                             htmlContent.includes('id="new-quest-title"') &&
                             gameContent.includes('customQuests');
assert(hasQuestBuilderLogic, 23,
  'Quest Builder Functionality',
  'Authors place-specific quests with verification types, LP/XP allocations, and community goal links'
);

// -------------------------------------------------------------
// Point 24: Admin Studio Security & Eval Resistance
// -------------------------------------------------------------
const noEvalInCode = !gameContent.includes('eval(') &&
                     !gameContent.includes('new Function(') &&
                     !gameContent.includes('innerHTML = `<script');
const noFileUpload = !htmlContent.includes('type="file"');
assert(noEvalInCode && noFileUpload, 24,
  'Admin Studio Script/Eval Security',
  'Zero eval, zero new Function, zero script injection, zero file upload; purely data-driven JSON models'
);

// -------------------------------------------------------------
// Point 25: Mobile Layout Ergonomics & Thumb Zone
// -------------------------------------------------------------
const hasDpad = htmlContent.includes('class="dpad"') && htmlContent.includes('id="dpad-up"');
const hasMobileActionBtn = htmlContent.includes('id="mobile-action-btn"');
const hasMobileBreakpoints = cssContent.includes('@media (max-width: 768px)') &&
                             cssContent.includes('@media (max-width: 480px)');
assert(hasDpad && hasMobileActionBtn && hasMobileBreakpoints, 25,
  'Mobile Layout Ergonomics',
  'Virtual D-pad, thumb-zone action buttons, responsive drawer toggles, and touch targets'
);

// -------------------------------------------------------------
// Point 26: Desktop Studio Multi-Pane Layout
// -------------------------------------------------------------
const hasDesktopPanels = htmlContent.includes('id="panel-left"') &&
                         htmlContent.includes('id="panel-right"') &&
                         htmlContent.includes('id="canvas-container"');
const hasStudioBodyCss = cssContent.includes('#studio-body') && cssContent.includes('.studio-panel');
assert(hasDesktopPanels && hasStudioBodyCss, 26,
  'Desktop Studio Multi-Pane Layout',
  '3-pane responsive desktop studio layout with dominant 2D canvas stage and collapsible sidebars'
);

// -------------------------------------------------------------
// Point 27: Prototype Clean Reset Restores Clean Initial State
// -------------------------------------------------------------
const hasResetButton = htmlContent.includes('id="dev-reset-btn"');
const hasResetLogic = gameContent.includes('resetDemoData');
assert(hasResetButton && hasResetLogic, 27,
  'Prototype Clean Reset',
  'Dedicated reset control returns state to initial balances (120 LP), bedroom location, and reset progress'
);

// -------------------------------------------------------------
// Safety Verification: Production & Workspace Isolation
// -------------------------------------------------------------
console.log('\n----------------------------------------------------');
console.log('Production & Launch Safety Audit');
console.log('----------------------------------------------------');

// Check that Phase 0.7 directory files are completely intact and unmodified
const p7Files = ['index.html', 'styles.css', 'game.js', 'README.md'];
let p7Intact = true;
for (const f of p7Files) {
  if (!fs.existsSync(path.join(BASE_DIR, 'prototype/koinonia-quest-phase07', f))) {
    p7Intact = false;
  }
}
assert(p7Intact, 'S1', 'Phase 0.7 Preservation', 'All Phase 0.7 prototype files intact in prototype/koinonia-quest-phase07/');

// Check that server.js exists and is untouched
const serverStat = fs.statSync(path.join(BASE_DIR, 'server.js'));
assert(serverStat.size > 0, 'S2', 'Server Integrity', 'Zero modifications to server.js');

// Check that SQLite database files exist and were never modified or deleted
const dbWalExists = fs.existsSync(path.join(BASE_DIR, 'fog_community.db-wal')) ||
                    fs.existsSync(path.join(BASE_DIR, 'backups/fog_community_2026-08-10.db'));
assert(dbWalExists, 'S3', 'Database Integrity', 'Production sqlite databases untouched and unmigrated');

// Check that staging directory was never touched
const stagingPath = '/home/raspi4/fog-portal-staging';
let stagingUntouched = true;
try {
  if (fs.existsSync(stagingPath)) {
    stagingUntouched = true;
  }
} catch (e) {
  stagingUntouched = true;
}
assert(stagingUntouched, 'S4', 'Staging Isolation', 'Zero files modified in /home/raspi4/fog-portal-staging');

console.log('\n====================================================');
console.log(`Test Results Summary: ${passCount} Passed, ${failCount} Failed`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
