/**
 * KOINONIA — PHASE 0.8 DATA STORE: PLACES
 * Architecture: Data-driven Place definitions with lifecycle, zones, and components
 * Foundation: Single-community first, multi-community ready (`communityId: 'fog'`)
 */

(function () {
  'use strict';

  const PLACES = {
    home: {
      id: 'home',
      communityId: 'fog',
      name: 'My Home',
      lifecycle: 'permanent',
      category: 'Domestic Stewardship',
      icon: '🏡',
      accentColor: '#EB5F12', // Fire Orange
      tagline: 'Personal stewardship, family honor, and quiet daily habits.',
      description: 'The personal haven where Christian character begins in small, quiet chores and family honoring.',
      mapCoords: { x: 120, y: 300, labelPos: 'bottom' },
      unlocked: true,
      zones: [
        { id: 'bedroom', name: 'The Bedroom', icon: '🛏️', description: 'Platform bed, study desk with Bible, and wardrobe. Focus on personal order.' },
        { id: 'living', name: 'Living Area', icon: '🛋️', description: 'Shared rattan sofa, woven circular rug, and family notice board. Family connection.' },
        { id: 'kitchen', name: 'The Kitchen', icon: '🍳', description: 'Porcelain dish sink, cooking counter, and shared dining table. Hospitality.' },
        { id: 'veranda', name: 'Veranda & Batalan', icon: '🪵', description: 'Open-air slatted timber porch overlooking the garden. Elder fellowship.' },
        { id: 'garden', name: 'The Garden Plot', icon: '🌱', description: 'Living soil bed, clay potted ferns, and the perimeter timber gate.' }
      ],
      components: [
        { id: 'c_bed', type: 'furniture', name: 'Platform Bed', zoneId: 'bedroom' },
        { id: 'c_desk', type: 'furniture', name: 'Study Desk with Bible', zoneId: 'bedroom' },
        { id: 'c_sofa', type: 'furniture', name: 'Rattan Sofa', zoneId: 'living' },
        { id: 'c_board', type: 'quest_board', name: 'Family Chores Notice Board', zoneId: 'living' },
        { id: 'c_sink', type: 'utility', name: 'Porcelain Dish Sink', zoneId: 'kitchen' },
        { id: 'c_table', type: 'furniture', name: 'Shared Dining Table', zoneId: 'kitchen' },
        { id: 'c_barnaby', type: 'npc', name: 'Uncle Barnaby (Garden Mentor)', zoneId: 'veranda' },
        { id: 'c_plants', type: 'plant', name: 'Potted Ferns', zoneId: 'garden' },
        { id: 'c_gate', type: 'gate', name: 'Perimeter Garden Gate (To FOG Center)', zoneId: 'garden' }
      ],
      history: [
        {
          id: 'hist_home_01',
          date: 'September 2026',
          title: 'First Seedling Sprouted',
          description: 'Alex completed Quest #001: Steward of the Garden by watering home plants.',
          badge: 'Stewardship Level 1'
        }
      ]
    },

    fog_center: {
      id: 'fog_center',
      communityId: 'fog',
      name: 'FOG Community Center',
      lifecycle: 'permanent',
      category: 'Fellowship & Ministry Hub',
      icon: '⛪',
      accentColor: '#D22F0A', // Revival Red
      tagline: 'The living fellowship and worship heart of the Fire of God community.',
      description: 'An expansive open-air church campus featuring contemporary tropical timber architecture, youth halls, and community gardens.',
      mapCoords: { x: 500, y: 300, labelPos: 'top' },
      unlocked: false,
      zones: [
        { id: 'entrance', name: 'Entrance Plaza', icon: '🚪', description: 'Open arched gateway and welcome desk draped with fellowship banners.' },
        { id: 'youth_hall', name: 'Youth Hall', icon: '🏛️', description: 'Modular couches, fellowship tables, and main Community Quest Board.' },
        { id: 'quest_board', name: 'Grand Quest Board', icon: '📜', description: 'Notice board for collective ministry callings and service projects.' },
        { id: 'activity_area', name: 'Activity Area', icon: '🎯', description: 'Recreation tables, ping-pong, and fellowship circle seating.' },
        { id: 'comm_garden', name: 'Community Garden', icon: '🌻', description: 'Collective youth farming beds (Stewardship Goal: 500 XP).' },
        { id: 'reflection_corner', name: 'Reflection Corner', icon: '🕯️', description: 'Quiet jasmine arbor, bamboo privacy screens, and prayer stone cross.' },
        { id: 'music_room', name: 'Music & Worship Room', icon: '🎵', description: 'Acoustic guitars, keyboard, and praise team practice space.' },
        { id: 'tech_corner', name: 'Tech & Livestream Corner', icon: '💻', description: 'Audio mixing board, camera stands, and media broadcast setup.' },
        { id: 'hospitality', name: 'Hospitality Counter', icon: '☕', description: 'Hot tea, fresh bread, and friendly food preparation station.' }
      ],
      components: [
        { id: 'c_ate_joy', type: 'npc', name: 'Ate Joy (Welcome Coordinator)', zoneId: 'entrance' },
        { id: 'c_main_board', type: 'quest_board', name: 'Main Community Quest Board', zoneId: 'youth_hall' },
        { id: 'c_prayer_cross', type: 'landmark', name: 'Timber Cross Landmark', zoneId: 'reflection_corner' },
        { id: 'c_garden_well', type: 'utility', name: 'Living Spring Water Fountain', zoneId: 'comm_garden' },
        { id: 'c_tea_station', type: 'utility', name: 'Fellowship Coffee & Tea Bar', zoneId: 'hospitality' }
      ],
      history: [
        {
          id: 'hist_center_01',
          date: 'August 2026',
          title: 'Youth Welcome Assembly',
          description: '45 youth gathered for the semester kickoff and worship night.',
          badge: 'Fellowship'
        },
        {
          id: 'hist_center_02',
          date: 'July 2026',
          title: 'Community Garden Groundbreaking',
          description: 'Tilled the first row of shared herbs and seedlings together.',
          badge: 'Stewardship'
        }
      ]
    },

    school: {
      id: 'school',
      communityId: 'fog',
      name: 'School',
      lifecycle: 'permanent',
      category: 'Formation & Diligence',
      icon: '🏫',
      accentColor: '#F99320', // Amber
      tagline: 'Diligence, honest scholarship, peer kindness, and honoring teachers.',
      description: 'The everyday campus environment where academic discipline, peer support, and respectful living are forged in real life.',
      mapCoords: { x: 300, y: 150, labelPos: 'top' },
      unlocked: false,
      zones: [
        { id: 'classroom', name: 'Classroom', icon: '📝', description: 'Desks, blackboard, and study materials. Active focused listening.' },
        { id: 'study_area', name: 'Quiet Study Area', icon: '📖', description: 'Group tables for collaborative homework and peer encouragement.' },
        { id: 'library', name: 'Campus Library', icon: '📚', description: 'Bookshelves, quiet study carrels, and research archives.' },
        { id: 'campus_common', name: 'Campus Common Area', icon: '🌳', description: 'Shaded benches under acacia trees. Informal conversations.' }
      ],
      components: [
        { id: 'c_school_desk', type: 'furniture', name: 'Student Desk & Notebook', zoneId: 'classroom' },
        { id: 'c_library_books', type: 'resource', name: 'Reference Bookshelf', zoneId: 'library' },
        { id: 'c_teacher_desk', type: 'landmark', name: 'Teacher\'s Table', zoneId: 'classroom' },
        { id: 'c_bench', type: 'furniture', name: 'Tree Bench (Kindness Spot)', zoneId: 'campus_common' }
      ],
      history: [
        {
          id: 'hist_school_01',
          date: 'August 2026',
          title: 'Peer Tutoring Circle',
          description: 'Senior youth assisted freshmen with algebra assignments.',
          badge: 'Responsibility'
        }
      ]
    },

    sports_hub: {
      id: 'sports_hub',
      communityId: 'fog',
      name: 'Sports Hub',
      lifecycle: 'permanent',
      category: 'Fitness & Teamwork',
      icon: '🏀',
      accentColor: '#D49B35', // Sun Brass
      tagline: 'Sportsmanship, endurance, discipline, and joyful healthy competition.',
      description: 'A vibrant outdoor recreation center with full basketball court, badminton, pickleball, and running track.',
      accentColor: '#FDC63F', // Flame Gold
      tagline: 'Physical stewardship, bodily health, teamwork, and sportsmanship.',
      description: 'The outdoor athletic grounds with basketball courts, running tracks, and shaded benches for active fellowship.',
      mapCoords: { x: 680, y: 440, labelPos: 'top' },
      unlocked: false,
      zones: [
        { id: 'basketball_court', name: 'Basketball Half-Court', icon: '🏀', description: 'Hardwood-marked half court, backboard, and free throw line.' },
        { id: 'running_track', name: 'Campus Perimeter Track', icon: '🏃', description: 'Red clay path circling the sports field for mile run challenges.' },
        { id: 'bleachers', name: 'Shaded Bleachers', icon: '🪵', description: 'Covered wooden benches for cheering, resting, and post-game water sharing.' },
        { id: 'equipment_locker', name: 'Sports Gear Rack', icon: '🏐', description: 'Basketballs, jump ropes, pinnies, and first aid kit.' }
      ],
      components: [
        { id: 'c_coach_marcus', type: 'npc', name: 'Coach Marcus', zoneId: 'basketball_court' },
        { id: 'c_bball_hoop', type: 'landmark', name: 'Regulation Basketball Hoop', zoneId: 'basketball_court' },
        { id: 'c_scoreboard', type: 'utility', name: 'Fellowship Scoreboard', zoneId: 'bleachers' },
        { id: 'c_water_cooler', type: 'utility', name: 'Ice Water Refreshment Station', zoneId: 'bleachers' }
      ],
      history: [
        {
          id: 'hist_sports_01',
          date: 'September 2026',
          title: 'FOG Youth Basketball Day',
          description: 'Team Fire and Team Grace played a spirited game (68–62). Alex recognized as Top Scorer (24 pts).',
          badge: 'Sports & Fellowship'
        },
        {
          id: 'hist_sports_02',
          date: 'August 2026',
          title: 'Perimeter Mile Fitness Challenge',
          description: '14 youth ran 4 laps together, cheering on every runner through the final stretch.',
          badge: 'Fitness & Encouragement'
        }
      ]
    },

    outreach: {
      id: 'outreach',
      communityId: 'fog',
      name: 'Outreach Site',
      lifecycle: 'temporary', // Temporary place lifecycle
      category: 'Community Blessing & Mission',
      icon: '⛺',
      accentColor: '#A10F06', // Deep Ember
      tagline: 'Temporary service venue for neighborhood blessing and outreach.',
      description: 'A pop-up community engagement site deployed for weekend food distribution, medical assistance, and children\'s games.',
      mapCoords: { x: 500, y: 150, labelPos: 'right' },
      unlocked: false,
      zones: [
        { id: 'welcome_station', name: 'Welcome Station', icon: '👋', description: 'Canopy tent where guests are greeted warmly with bottled water.' },
        { id: 'food_station', name: 'Food & Hospitality', icon: '🍲', description: 'Folding tables with prepared hot meal boxes and fruit bags.' },
        { id: 'children_area', name: 'Children\'s Activity Area', icon: '🎨', description: 'Coloring books, story circles, and building block games.' },
        { id: 'service_area', name: 'Community Care & Prayer', icon: '🙏', description: 'Quiet table offering pastoral encouragement and prayer for families.' },
        { id: 'cleanup_station', name: 'Cleanup & Recycling Station', icon: '🧹', description: 'Sorting bins and brooms to leave the neighborhood cleaner than we found it.' }
      ],
      components: [
        { id: 'c_tent', type: 'shelter', name: 'Shaded Canopy Tent', zoneId: 'welcome_station' },
        { id: 'c_meal_table', type: 'utility', name: 'Hot Meal Distribution Table', zoneId: 'food_station' },
        { id: 'c_story_mat', type: 'resource', name: 'Woven Children\'s Story Mat', zoneId: 'children_area' },
        { id: 'c_sorting_bins', type: 'utility', name: 'Eco Cleanup Sorting Bins', zoneId: 'cleanup_station' }
      ],
      history: [
        {
          id: 'hist_outreach_01',
          date: 'September 2026',
          title: 'Barangay Hope Meal Blessing',
          description: 'Youth served 120 hot meals and organized story hours for 35 children.',
          badge: 'Compassion & Service'
        }
      ]
    }
  };

  // Place Templates for the Admin Place Builder
  const PLACE_TEMPLATES = [
    { id: 'tmpl_home', name: 'Domestic / Home', defaultZones: ['Bedroom', 'Living Area', 'Kitchen', 'Veranda', 'Garden'] },
    { id: 'tmpl_center', name: 'Community Center', defaultZones: ['Entrance', 'Youth Hall', 'Activity Area', 'Prayer Corner', 'Hospitality'] },
    { id: 'tmpl_school', name: 'School / Academic', defaultZones: ['Classroom', 'Study Carrels', 'Library', 'Courtyard'] },
    { id: 'tmpl_sports', name: 'Sports & Fitness', defaultZones: ['Court', 'Field / Track', 'Bleachers', 'Equipment Locker'] },
    { id: 'tmpl_outreach', name: 'Outreach / Service Site', defaultZones: ['Welcome Tent', 'Distribution Table', 'Children Area', 'Cleanup'] },
    { id: 'tmpl_formation', name: 'Formation & Retreat', defaultZones: ['Sanctuary', 'Firepit', 'Bunkhouse', 'Trail Path'] },
    { id: 'tmpl_blank', name: 'Custom Blank Canvas', defaultZones: ['Main Zone'] }
  ];

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.places = PLACES;
  root.KOINONIA_DATA.placeTemplates = PLACE_TEMPLATES;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PLACES, PLACE_TEMPLATES };
  }
})();
