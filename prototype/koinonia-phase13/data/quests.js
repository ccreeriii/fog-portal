/**
 * KOINONIA — PHASE 0.8 DATA STORE: QUESTS
 * Architecture: Modular quest library categorized by Place and Zone
 * Verification Types: TRUST, FAMILY, LEADER, EVENT, SYSTEM
 * Forward-compatible ownership: `communityId: 'fog'`
 */

(function () {
  'use strict';

  const QUESTS = [
    // ============================================================
    // 1. MY HOME QUESTS
    // ============================================================
    {
      id: 'Q-001',
      communityId: 'fog',
      placeId: 'home',
      zoneId: 'garden',
      title: 'Steward of the Garden',
      category: 'Domestic Stewardship',
      icon: '🌱',
      description: 'Water the potted plants at home to care for living creation right outside your window.',
      fallback: 'No plants? Refill a pet\'s water bowl, wipe down a shared dining table, or tidy a kitchen counter.',
      realWorldAction: 'Water home plants or refill pet water.',
      verification: 'TRUST', // TRUST | FAMILY | LEADER | EVENT | SYSTEM
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { stewardship: 15, responsibility: 5 },
        communityContribution: 15
      },
      repeatability: 'daily',
      reflectionPrompt: 'One small thing I noticed while doing this was...',
      status: 'ready' // 'ready' | 'active' | 'in_progress_real_world' | 'completed'
    },
    {
      id: 'Q-002',
      communityId: 'fog',
      placeId: 'home',
      zoneId: 'kitchen',
      title: 'Evening Dishwashing Ministry',
      category: 'Family Service',
      icon: '🍳',
      description: 'Wash and dry dinner dishes for your whole family without waiting to be asked.',
      fallback: 'Clear and wipe down the family table, dry clean utensils, or take out the kitchen compost.',
      realWorldAction: 'Wash the household dinner dishes.',
      verification: 'FAMILY',
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { responsibility: 10, service: 10 },
        communityContribution: 10
      },
      repeatability: 'daily',
      reflectionPrompt: 'How did helping with family chores change the atmosphere at home?',
      status: 'ready'
    },
    {
      id: 'Q-003',
      communityId: 'fog',
      placeId: 'home',
      zoneId: 'bedroom',
      title: 'Personal Haven Order',
      category: 'Discipline',
      icon: '🛏️',
      description: 'Make your bed neatly and clear books and clothes off the study desk.',
      fallback: 'Organize your study shelf or hang up school uniforms neatly.',
      realWorldAction: 'Make your bed and tidy study desk.',
      verification: 'TRUST',
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { discipline: 10, responsibility: 5 },
        communityContribution: 5
      },
      repeatability: 'daily',
      reflectionPrompt: 'What was the clearest feeling after looking at an orderly room?',
      status: 'ready'
    },
    {
      id: 'Q-004',
      communityId: 'fog',
      placeId: 'home',
      zoneId: 'living',
      title: 'Device-Free Family Hour',
      category: 'Family Connection',
      icon: '🛋️',
      description: 'Spend 60 minutes with your family with all phones and screens put away in another room.',
      fallback: 'Eat a meal together without any screens at the table.',
      realWorldAction: 'Spend 1 hour device-free with household members.',
      verification: 'FAMILY',
      rewards: {
        lp: 8,
        charXp: 10,
        skillXp: { communication: 15, compassion: 10 },
        communityContribution: 15
      },
      repeatability: 'weekly',
      reflectionPrompt: 'What was something surprising or funny someone shared when screens were away?',
      status: 'ready'
    },

    // ============================================================
    // 2. SCHOOL QUESTS
    // ============================================================
    {
      id: 'Q-010',
      communityId: 'fog',
      placeId: 'school',
      zoneId: 'study_area',
      title: 'Prepare for Tomorrow Today',
      category: 'Academic Diligence',
      icon: '📝',
      description: 'Check tomorrow\'s class schedule, pack your backpack completely, and set out needed pens/notebooks.',
      fallback: 'Clean out unnecessary scrap papers from your binder.',
      realWorldAction: 'Pack backpack and prep all tomorrow materials.',
      verification: 'TRUST',
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { responsibility: 15, discipline: 5 },
        communityContribution: 10
      },
      repeatability: 'daily',
      reflectionPrompt: 'How did getting ready tonight help reduce morning rush anxiety?',
      status: 'ready'
    },
    {
      id: 'Q-011',
      communityId: 'fog',
      placeId: 'school',
      zoneId: 'classroom',
      title: 'Classmate Encouragement',
      category: 'Peer Fellowship',
      icon: '🤝',
      description: 'Help a classmate who is struggling with a topic, or write an encouraging note to a peer.',
      fallback: 'Sit with someone who is sitting alone at lunch or study hall.',
      realWorldAction: 'Offer academic help or genuine kindness to a classmate.',
      verification: 'TRUST',
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { service: 10, teamwork: 10 },
        communityContribution: 15
      },
      repeatability: 'daily',
      reflectionPrompt: 'How did your classmate respond to quiet, unforced kindness?',
      status: 'ready'
    },
    {
      id: 'Q-012',
      communityId: 'fog',
      placeId: 'school',
      zoneId: 'library',
      title: 'Focused 45-Minute Study Block',
      category: 'Diligence',
      icon: '📚',
      description: 'Complete 45 minutes of undistracted study or reading without checking social media.',
      fallback: 'Read 15 pages of an assigned book in a quiet spot.',
      realWorldAction: 'Study 45 minutes with zero digital distractions.',
      verification: 'SYSTEM', // SYSTEM focus timer verification
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { discipline: 15, wisdom: 5 },
        communityContribution: 10
      },
      repeatability: 'daily',
      reflectionPrompt: 'What was the hardest urge to resist during the quiet study block?',
      status: 'ready'
    },
    {
      id: 'Q-013',
      communityId: 'fog',
      placeId: 'school',
      zoneId: 'classroom',
      title: 'Teacher Gratitude Note',
      category: 'Respect & Honor',
      icon: '🍎',
      description: 'Personally thank a teacher, professor, or school staff member for their patient work.',
      fallback: 'Leave a short written thank-you note on their desk.',
      realWorldAction: 'Verbally or in writing thank an educator or school cleaner.',
      verification: 'LEADER',
      rewards: {
        lp: 8,
        charXp: 10,
        skillXp: { wisdom: 10, communication: 10 },
        communityContribution: 15
      },
      repeatability: 'weekly',
      reflectionPrompt: 'What made you choose this specific mentor or teacher to thank?',
      status: 'ready'
    },

    // ============================================================
    // 3. FOG COMMUNITY CENTER QUESTS
    // ============================================================
    {
      id: 'Q-020',
      communityId: 'fog',
      placeId: 'fog_center',
      zoneId: 'hospitality',
      title: 'Hospitality Bread & Water Service',
      category: 'Ministry Service',
      icon: '☕',
      description: 'Assist the hospitality team with filling water pitchers, slicing bread, and greeting attendees.',
      fallback: 'Wipe down tables in the youth hall after fellowship time.',
      realWorldAction: 'Serve snacks, water, or clean tables at church gathering.',
      verification: 'LEADER',
      rewards: {
        lp: 8,
        charXp: 10,
        skillXp: { service: 15, communication: 5 },
        communityContribution: 20
      },
      repeatability: 'weekly',
      reflectionPrompt: 'What did you notice about welcoming someone with a simple cup of water?',
      status: 'ready'
    },
    {
      id: 'Q-021',
      communityId: 'fog',
      placeId: 'fog_center',
      zoneId: 'music_room',
      title: 'Worship Gear & Cable Wrap',
      category: 'Tech Stewardship',
      icon: '🎵',
      description: 'Help the praise team wrap microphone cables neatly and stack music stands.',
      fallback: 'Help arrange chairs in straight rows for Friday gathering.',
      realWorldAction: 'Assist music/tech team with equipment teardown.',
      verification: 'LEADER',
      rewards: {
        lp: 8,
        charXp: 10,
        skillXp: { teamwork: 10, responsibility: 10 },
        communityContribution: 20
      },
      repeatability: 'weekly',
      reflectionPrompt: 'Why is quiet backstage faithfulness just as valuable as singing on stage?',
      status: 'ready'
    },
    {
      id: 'Q-022',
      communityId: 'fog',
      placeId: 'fog_center',
      zoneId: 'reflection_corner',
      title: 'Prayer Corner Intercession',
      category: 'Spiritual Formation',
      icon: '🕯️',
      description: 'Spend 10 minutes in the reflection arbor praying specifically for 3 friends and church leaders.',
      fallback: 'Pray for a family facing health or financial strain.',
      realWorldAction: '10 minutes of quiet intercessory prayer.',
      verification: 'TRUST',
      rewards: {
        lp: 8,
        charXp: 10,
        skillXp: { wisdom: 15, compassion: 10 },
        communityContribution: 25
      },
      repeatability: 'daily',
      reflectionPrompt: 'What name or situation weighed most on your heart as you prayed?',
      status: 'ready'
    },
    {
      id: 'Q-023',
      communityId: 'fog',
      placeId: 'fog_center',
      zoneId: 'comm_garden',
      title: 'Community Garden Weeding & Loam',
      category: 'Collective Stewardship',
      icon: '🌻',
      description: 'Clear weeds and compost soil in the collective youth garden plot (contributes to 500 XP goal).',
      fallback: 'Sweep fallen leaves around the courtyard entryway.',
      realWorldAction: '15 minutes of outdoor gardening or campus grounds care.',
      verification: 'LEADER',
      rewards: {
        lp: 10,
        charXp: 10,
        skillXp: { stewardship: 20, responsibility: 10 },
        communityContribution: 30
      },
      repeatability: 'weekly',
      reflectionPrompt: 'How does caring for a shared garden make you feel part of the community body?',
      status: 'ready'
    },

    // ============================================================
    // 4. SPORTS HUB QUESTS
    // ============================================================
    {
      id: 'Q-030',
      communityId: 'fog',
      placeId: 'sports_hub',
      zoneId: 'basketball_court',
      title: '20 Free Throws Personal Best Drill',
      category: 'Fitness & Discipline',
      icon: '🏀',
      description: 'Shoot 20 consecutive free throws; record your makes and strive to beat your personal best.',
      fallback: 'Do 20 jump shots or 15 minutes of dribbling drills.',
      realWorldAction: 'Execute 20 free throw shots and log score.',
      verification: 'TRUST',
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { discipline: 15, responsibility: 5 },
        communityContribution: 10
      },
      repeatability: 'daily',
      reflectionPrompt: 'Did you focus more on the result or on your routine and form?',
      status: 'ready'
    },
    {
      id: 'Q-031',
      communityId: 'fog',
      placeId: 'sports_hub',
      zoneId: 'bleachers',
      title: 'Sportsmanship & Teammate Lift',
      category: 'Character in Sports',
      icon: '🤝',
      description: 'High-five both teammates and opponents, encourage someone who missed a shot, and thank the referee.',
      fallback: 'Encourage a teammate when your squad is trailing in points.',
      realWorldAction: 'Practice vocal encouragement and gracious sportsmanship during games.',
      verification: 'EVENT',
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { teamwork: 10, compassion: 10 },
        communityContribution: 15
      },
      repeatability: 'daily',
      reflectionPrompt: 'How does true sportsmanship reflect Christian character under pressure?',
      status: 'ready'
    },
    {
      id: 'Q-032',
      communityId: 'fog',
      placeId: 'sports_hub',
      zoneId: 'running_track',
      title: 'Stamina & Endurance Mile',
      category: 'Endurance',
      icon: '🏃',
      description: 'Walk or jog 4 laps around the track without quitting, pacing your breathing consistently.',
      fallback: 'Complete a brisk 15-minute brisk neighborhood walk.',
      realWorldAction: 'Complete 1 mile or 4 laps of walking/jogging.',
      verification: 'TRUST',
      rewards: {
        lp: 5,
        charXp: 5,
        skillXp: { discipline: 15, responsibility: 5 },
        communityContribution: 10
      },
      repeatability: 'daily',
      reflectionPrompt: 'When your body wanted to stop, what thought kept you moving forward?',
      status: 'ready'
    },

    // ============================================================
    // 5. OUTREACH SITE QUESTS (TEMPORARY / EVENT VENUE)
    // ============================================================
    {
      id: 'Q-040',
      communityId: 'fog',
      placeId: 'outreach',
      zoneId: 'welcome_station',
      title: 'Warm Welcome & Host Blessing',
      category: 'Outreach Service',
      icon: '👋',
      description: 'Stand at the welcome canopy to hand out water bottles and greet neighborhood neighbors by name.',
      fallback: 'Guide guests toward the food or activity stations.',
      realWorldAction: 'Serve 30 minutes at community outreach welcome desk.',
      verification: 'LEADER',
      rewards: {
        lp: 10,
        charXp: 10,
        skillXp: { service: 15, communication: 15 },
        communityContribution: 30
      },
      repeatability: 'weekly',
      reflectionPrompt: 'What did a warm smile communicate to someone arriving for the first time?',
      status: 'ready'
    },
    {
      id: 'Q-041',
      communityId: 'fog',
      placeId: 'outreach',
      zoneId: 'food_station',
      title: 'Care Meal Box Packaging',
      category: 'Mercy & Compassion',
      icon: '🍲',
      description: 'Pack warm food boxes with rice, soup, and fresh oranges, ensuring each package is handled cleanly.',
      fallback: 'Help restock cutlery and napkin dispensers.',
      realWorldAction: 'Pack and distribute 15 family meal packages.',
      verification: 'LEADER',
      rewards: {
        lp: 10,
        charXp: 10,
        skillXp: { compassion: 20, service: 10 },
        communityContribution: 35
      },
      repeatability: 'weekly',
      reflectionPrompt: 'What went through your mind as you handed food to a parent or elder?',
      status: 'ready'
    },
    {
      id: 'Q-042',
      communityId: 'fog',
      placeId: 'outreach',
      zoneId: 'cleanup_station',
      title: 'Leave It Cleaner Than Found',
      category: 'Community Stewardship',
      icon: '🧹',
      description: 'Sweep the surrounding streets, pick up plastic wrappers, and sort recyclables after the event.',
      fallback: 'Fold canopy chairs and pack folding tables into the van.',
      realWorldAction: 'Participate fully in venue teardown and litter cleanup.',
      verification: 'LEADER',
      rewards: {
        lp: 10,
        charXp: 10,
        skillXp: { stewardship: 15, responsibility: 15 },
        communityContribution: 35
      },
      repeatability: 'weekly',
      reflectionPrompt: 'Why does thorough cleanup honor the neighborhood long after we pack up?',
      status: 'ready'
    }
  ];

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.quests = QUESTS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QUESTS };
  }
})();
