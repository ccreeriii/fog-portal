/**
 * KOINONIA — PHASE 0.16 DATA STORE: GENERIC PLACE ENGINE & NPCS
 * 
 * Architecture: Reusable, declarative Place schema with zones, environment objects,
 * collision, interactables, NPCs, named spawns, exits, and discovery metadata.
 *
 * Core Principle: Adding a future place should primarily require data and assets,
 * not rewriting the core game engine.
 *
 * Strategy: Single-community first, multi-community ready (`communityId: 'fog'`).
 */

(function () {
  'use strict';

  // ============================================================
  // 1. REUSABLE NPC REGISTRY
  // ============================================================
  const NPCS = {
    barnaby: {
      id: 'barnaby',
      name: 'Uncle Barnaby',
      role: 'Garden Mentor & Elder',
      homePlaceId: 'home',
      emoji: '🧔',
      tagColor: '#10B981',
      defaultPosition: { x: 10.0, y: 6.0 },
      interactionRadius: 2.3,
      dialogue: {
        first_meeting: '"Peace be with you, Alex! The garden needs quiet, faithful hands today. Stewardship begins right here at home."',
        normal: '"Faithfulness in small things is the seed of great fruit. Water the thirsty plants and honor your family in small ways."',
        quest_available: '"Alex, look at our veranda garden! The plants are thirsty. Step out, water them faithfully, and return when you are done."',
        quest_active: "\"Real stewardship isn't finished on this screen. Step outside in the physical world, care for creation, and record what you noticed.\"",
        quest_completed: '"Glory to God! The garden is lush and vibrant. Because you proved faithful, the South Gate is now open to the FOG Center."'
      }
    },

    sister_grace: {
      id: 'sister_grace',
      name: 'Sister Grace',
      role: 'Welcome Coordinator',
      homePlaceId: 'fog_center',
      emoji: '👩‍💼',
      tagColor: '#D22F0A',
      defaultPosition: { x: 12.0, y: 5.0 },
      interactionRadius: 2.4,
      dialogue: {
        first_meeting: '"Welcome to the Fire of God Community Center! We are so blessed you found your way through the South Gate. Here we grow together in fellowship and service."',
        normal: '"Grace and peace to you! Take time to pause in the Prayer Corner, or read the Notice Board for community opportunities."',
        quest_available: '"Alex, the fellowship hall is peaceful today. Take a quiet moment in prayer or reflection before God."',
        quest_active: '"Step into stillness for a few minutes. When you have paused and reflected, return to share your blessing."',
        quest_completed: '"A grateful heart brings peace to everyone around you. You are always welcome in our fellowship circle!"'
      }
    },

    teacher_mia: {
      id: 'teacher_mia',
      name: 'Teacher Mia',
      role: 'Educator & Academic Guide',
      homePlaceId: 'school',
      emoji: '👩‍🏫',
      tagColor: '#2563EB',
      defaultPosition: { x: 12.0, y: 4.5 },
      interactionRadius: 2.3,
      dialogue: {
        first_meeting: '"Welcome to the campus, Alex! True scholarship isn\'t just about high grades—it\'s about diligence, honesty, and using your mind to bless others."',
        normal: '"Keep up your study habits! A focused desk and an orderly mind help you serve your family and community with clarity."',
        quest_available: '"Ready for focused study today? Take time to organize your desk and complete your homework without screen distractions."',
        quest_active: '"Focus on your assignment one step at a time. Diligent study honors God and blesses your future."',
        quest_completed: '"Well done! Orderly habits in school build reliable hands for real life."'
      }
    },

    coach_daniel: {
      id: 'coach_daniel',
      name: 'Coach Daniel',
      role: 'Athletics & Fitness Coach',
      homePlaceId: 'sports_hub',
      emoji: '🏃',
      tagColor: '#D97706',
      defaultPosition: { x: 12.0, y: 5.0 },
      interactionRadius: 2.4,
      dialogue: {
        first_meeting: '"Hey there, Alex! Welcome to the Sports Hub! Your body is a temple—let\'s build strength, discipline, and teamwork through active play."',
        normal: '"Sports challenges are coming in the next season! Remember: true sportsmanship means encouraging your teammates, win or lose."',
        quest_available: '"Get ready to move! Physical health and outdoor walks refresh the mind and spirit."',
        quest_active: '"Get out and stretch, run, or shoot some hoops! Hydrate well when you are done."',
        quest_completed: '"Great energy! Keep moving, stay humble, and build up your teammates."'
      }
    },

    ate_maria: {
      id: 'ate_maria',
      name: 'Ate Maria',
      role: 'Outreach Coordinator',
      homePlaceId: 'outreach_site',
      emoji: '👩‍🌾',
      tagColor: '#059669',
      defaultPosition: { x: 12.0, y: 4.5 },
      interactionRadius: 2.4,
      dialogue: {
        first_meeting: '"Peace and blessings, Alex! Welcome to our community outreach station. Here we put our faith into action by serving families and neighbors in need."',
        normal: '"Love is not just words—it is packing food boxes, offering a kind listening ear, and sharing what we have with cheerful hearts."',
        quest_available: '"We have community service missions preparing! Look around the packing tables and see how small acts of service change lives."',
        quest_active: '"Every small box packed brings comfort to a household. Serve quietly and joyfully."',
        quest_completed: '"Thank you for having a heart ready to serve. You are truly a blessing to this community."'
      }
    }
  };

  // ============================================================
  // 2. FIVE PLAYABLE LOCATIONS REGISTRY
  // ============================================================
  const PLACES = {
    // ------------------------------------------------------------
    // PLACE 1: MY HOME
    // ------------------------------------------------------------
    home: {
      id: 'home',
      communityId: 'fog',
      name: 'My Home',
      subtitle: 'Domestic Stewardship',
      icon: '🏡',
      accentColor: '#EB5F12',
      tagline: 'Personal stewardship, family honor, and quiet daily habits.',
      description: 'The personal starting haven where Christian character begins in small, quiet chores and family honoring.',
      unlockedByDefault: true,
      requirements: [],
      mapCoords: { x: 120, y: 300, labelPos: 'bottom' },
      mapBounds: { width: 25, height: 18 },

      spawnPoints: {
        default: { x: 4.5, y: 14.5, dir: 'down' },
        entrance: { x: 4.5, y: 14.5, dir: 'down' },
        veranda: { x: 10.0, y: 8.0, dir: 'down' },
        from_fog_center: { x: 12.0, y: 15.5, dir: 'up' }
      },

      atmosphere: {
        groundColor: '#263124',
        floorColor: '#E6D7C3',
        wallColor: '#5C4033',
        accentColor: '#EB5F12',
        ambientLabel: 'Warm domestic veranda & living garden'
      },

      zones: [
        { id: 'bedroom', name: 'The Bedroom', icon: '🛏️', description: 'Personal order, study desk, and platform bed.' },
        { id: 'living', name: 'Living Area', icon: '🛋️', description: 'Rattan sofa and family chores notice board.' },
        { id: 'kitchen', name: 'The Kitchen', icon: '🍳', description: 'Shared dining table and dishwashing sink.' },
        { id: 'veranda', name: 'Veranda & Batalan', icon: '🪵', description: 'Timber porch overlooking the garden plot.' },
        { id: 'garden', name: 'Garden Plot', icon: '🌱', description: 'Living garden beds and perimeter timber gate.' }
      ],

      worldObjects: [
        // Indoor room walls & boundary
        { id: 'home_n_wall', type: 'wall', x: 1, y: 1, w: 23, h: 1, color: '#4A3525', solid: true },
        { id: 'home_w_wall', type: 'wall', x: 1, y: 1, w: 1, h: 16, color: '#4A3525', solid: true },
        { id: 'home_e_wall', type: 'wall', x: 23, y: 1, w: 1, h: 16, color: '#4A3525', solid: true },
        { id: 'home_divider', type: 'wall', x: 1, y: 11, w: 10, h: 1, color: '#5C4033', solid: true },
        { id: 'home_divider_r', type: 'wall', x: 14, y: 11, w: 10, h: 1, color: '#5C4033', solid: true },

        // Furniture
        { id: 'bed', type: 'bed', x: 2, y: 2, w: 3, h: 4, color: '#C88A58', label: '🛏️ Bed', solid: true },
        { id: 'study_desk', type: 'desk', x: 6, y: 2, w: 3, h: 2, color: '#8D5B4C', label: '📖 Desk', solid: true },
        { id: 'sofa', type: 'sofa', x: 11, y: 3, w: 4, h: 2, color: '#D4A373', label: '🛋️ Sofa', solid: true },
        { id: 'dining_table', type: 'table', x: 17, y: 3, w: 4, h: 3, color: '#7F4F24', label: '🍽️ Table', solid: true },

        // Veranda & Garden
        { id: 'veranda_deck', type: 'floor_zone', x: 2, y: 12, w: 21, h: 4, color: '#8D6E63', solid: false },
        { id: 'garden_fence_l', type: 'wall', x: 1, y: 16, w: 9, h: 1, color: '#3E2723', solid: true },
        { id: 'garden_fence_r', type: 'wall', x: 15, y: 16, w: 9, h: 1, color: '#3E2723', solid: true }
      ],

      npcs: [NPCS.barnaby],

      interactables: [
        {
          id: 'barnaby',
          name: 'Uncle Barnaby',
          type: 'NPC',
          x: 10.0,
          y: 6.0,
          radius: 2.3,
          label: 'Talk to Uncle Barnaby',
          icon: '🧔',
          dialogueNpcId: 'barnaby'
        },
        {
          id: 'garden_plants',
          name: 'Veranda Garden Beds',
          type: 'OBJECT',
          x: 4.0,
          y: 14.0,
          radius: 2.3,
          label: 'Inspect Garden Plot',
          icon: '🌱',
          action: 'inspect_garden'
        },
        {
          id: 'home_chore_board',
          name: 'Family Chore Board',
          type: 'NOTICE_BOARD',
          x: 10.0,
          y: 2.0,
          radius: 2.0,
          label: 'Read Family Chore Board',
          icon: '📋',
          action: 'open_quests'
        },
        {
          id: 'home_gate',
          name: 'Perimeter Garden Gate',
          type: 'TRAVEL_POINT',
          x: 12.0,
          y: 16.8,
          radius: 2.2,
          label: 'Walk to FOG Center',
          icon: '🚪',
          action: 'travel_south_gate'
        }
      ],

      exits: [
        {
          id: 'home_south_gate_exit',
          destination: 'fog_center',
          spawnId: 'from_home',
          x: 11.0,
          y: 16.2,
          w: 3.0,
          h: 1.5,
          requiresGateOpen: true,
          label: 'Walk to FOG Community Center'
        }
      ],

      discoveryMetadata: {
        title: 'My Home',
        tagline: 'Personal stewardship, family honor, and quiet daily habits.',
        icon: '🏡'
      }
    },

    // ------------------------------------------------------------
    // PLACE 2: FOG COMMUNITY CENTER
    // ------------------------------------------------------------
    fog_center: {
      id: 'fog_center',
      communityId: 'fog',
      name: 'FOG Community Center',
      subtitle: 'Fellowship & Ministry Hub',
      icon: '⛪',
      accentColor: '#D22F0A',
      tagline: 'The living fellowship and worship heart of the Fire of God community.',
      description: 'An expansive open-air church campus featuring contemporary tropical timber architecture, youth halls, and fellowship spaces.',
      unlockedByDefault: false,
      requirements: [
        { type: 'FLAG', flag: 'fogCenterUnlocked', value: true }
      ],
      lockMessage: "Complete Quest Q-001 'Steward of the Garden' to open the South Gate to the FOG Center.",
      mapCoords: { x: 500, y: 300, labelPos: 'top' },
      mapBounds: { width: 25, height: 18 },

      spawnPoints: {
        default: { x: 12.0, y: 14.5, dir: 'up' },
        entrance: { x: 12.0, y: 14.5, dir: 'up' },
        from_home: { x: 12.0, y: 15.0, dir: 'up' },
        fellowship_hall: { x: 12.0, y: 8.0, dir: 'down' }
      },

      atmosphere: {
        groundColor: '#1F1B18',
        floorColor: '#FDF6EE',
        wallColor: '#6A0E04',
        accentColor: '#D22F0A',
        ambientLabel: 'Open-air fellowship campus & worship hall'
      },

      zones: [
        { id: 'entrance', name: 'Welcome Plaza', icon: '🚪', description: 'Welcoming portico draped with fellowship banners.' },
        { id: 'youth_hall', name: 'Youth Gathering Area', icon: '🏛️', description: 'Modular couches and community mission board.' },
        { id: 'prayer_corner', name: 'Prayer & Reflection Corner', icon: '🕊️', description: 'Quiet jasmine arbor and timber cross landmark.' },
        { id: 'ministry_board', name: 'Ministry Board', icon: '📜', description: 'Ministry callings and fellowship schedules.' },
        { id: 'hospitality', name: 'Hospitality Counter', icon: '☕', description: 'Fresh tea and friendly welcome refreshments.' }
      ],

      worldObjects: [
        // Boundary walls
        { id: 'fog_n_wall', type: 'wall', x: 1, y: 1, w: 23, h: 1, color: '#541208', solid: true },
        { id: 'fog_w_wall', type: 'wall', x: 1, y: 1, w: 1, h: 16, color: '#541208', solid: true },
        { id: 'fog_e_wall', type: 'wall', x: 23, y: 1, w: 1, h: 16, color: '#541208', solid: true },
        { id: 'fog_s_wall_l', type: 'wall', x: 1, y: 16, w: 9, h: 1, color: '#541208', solid: true },
        { id: 'fog_s_wall_r', type: 'wall', x: 15, y: 16, w: 9, h: 1, color: '#541208', solid: true },

        // Zones & Rugs
        { id: 'worship_rug', type: 'rug', x: 9, y: 3, w: 7, h: 6, color: '#F8D7DA', solid: false },
        { id: 'prayer_garden', type: 'floor_zone', x: 17, y: 3, w: 5, h: 5, color: '#D4EDDA', solid: false },

        // Furniture & Landmarks
        { id: 'welcome_desk', type: 'counter', x: 10, y: 6, w: 4, h: 1.5, color: '#851D14', label: 'Welcome Station', solid: true },
        { id: 'timber_cross', type: 'landmark', x: 19, y: 4, w: 2, h: 3, color: '#795548', label: '✝️ Cross', solid: true },
        { id: 'notice_board_obj', type: 'board', x: 5, y: 3, w: 3, h: 1, color: '#A15C2F', label: '📜 Board', solid: true },
        { id: 'fellowship_circle', type: 'table', x: 4, y: 8, w: 4, h: 3, color: '#BCAAA4', label: '👥 Youth Circle', solid: true }
      ],

      npcs: [NPCS.sister_grace],

      interactables: [
        {
          id: 'sister_grace',
          name: 'Sister Grace',
          type: 'NPC',
          x: 12.0,
          y: 5.0,
          radius: 2.4,
          label: 'Talk to Sister Grace',
          icon: '👩‍💼',
          dialogueNpcId: 'sister_grace'
        },
        {
          id: 'fog_notice_board',
          name: 'Community Notice Board',
          type: 'NOTICE_BOARD',
          x: 6.0,
          y: 4.0,
          radius: 2.2,
          label: 'Read Community Notice Board',
          icon: '📜',
          action: 'open_quests'
        },
        {
          id: 'fog_prayer_corner',
          name: 'Prayer & Reflection Corner',
          type: 'REFLECTION_POINT',
          x: 19.0,
          y: 5.0,
          radius: 2.2,
          label: 'Spend Quiet Time in Prayer',
          icon: '🕊️',
          action: 'prayer_moment'
        },
        {
          id: 'fog_ministry_board',
          name: 'Ministry Opportunities Board',
          type: 'NOTICE_BOARD',
          x: 15.0,
          y: 2.5,
          radius: 2.0,
          label: 'View Ministry Opportunities',
          icon: '✨',
          action: 'ministry_info'
        },
        {
          id: 'fog_youth_area',
          name: 'Youth Gathering Area',
          type: 'ACTIVITY_POINT',
          x: 6.0,
          y: 9.0,
          radius: 2.2,
          label: 'Join Youth Fellowship Circle',
          icon: '👥',
          action: 'youth_hangout'
        },
        {
          id: 'fog_exit_gate',
          name: 'Gate to My Home',
          type: 'TRAVEL_POINT',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          label: 'Return to My Home',
          icon: '🚪',
          action: 'travel_to_home'
        }
      ],

      exits: [
        {
          id: 'fog_to_home_exit',
          destination: 'home',
          spawnId: 'from_fog_center',
          x: 11.0,
          y: 16.2,
          w: 3.0,
          h: 1.5,
          label: 'Return to My Home'
        }
      ],

      discoveryMetadata: {
        title: 'FOG Community Center',
        tagline: 'The living fellowship and worship heart of the Fire of God community.',
        icon: '⛪'
      }
    },

    // ------------------------------------------------------------
    // PLACE 3: SCHOOL
    // ------------------------------------------------------------
    school: {
      id: 'school',
      communityId: 'fog',
      name: 'School',
      subtitle: 'Formation & Academic Diligence',
      icon: '🏫',
      accentColor: '#2563EB',
      tagline: 'Diligence, honest scholarship, peer kindness, and honoring teachers.',
      description: 'The campus environment where academic discipline, peer support, and respectful living are forged in real life.',
      unlockedByDefault: false,
      requirements: [
        { type: 'QUEST_COMPLETED', questId: 'Q-002' }
      ],
      lockMessage: "Complete Quest Q-002 'Light at Home' to unlock and travel to the School.",
      mapCoords: { x: 300, y: 150, labelPos: 'top' },
      mapBounds: { width: 25, height: 18 },

      spawnPoints: {
        default: { x: 12.0, y: 14.5, dir: 'up' },
        entrance: { x: 12.0, y: 14.5, dir: 'up' },
        classroom: { x: 12.0, y: 8.0, dir: 'up' },
        library: { x: 5.0, y: 6.0, dir: 'right' }
      },

      atmosphere: {
        groundColor: '#1A2332',
        floorColor: '#EBF2FA',
        wallColor: '#1E3A8A',
        accentColor: '#2563EB',
        ambientLabel: 'Soft academic blue classroom & study hall'
      },

      zones: [
        { id: 'entrance', name: 'School Foyer', icon: '🚪', description: 'Wide tiled corridor with campus notices.' },
        { id: 'classroom', name: 'Main Classroom', icon: '📝', description: 'Student desks, teacher table, and chalkboard.' },
        { id: 'library', name: 'Campus Library', icon: '📚', description: 'Quiet reference bookshelves and study carrels.' },
        { id: 'common', name: 'Courtyard Bench', icon: '🌳', description: 'Shaded bench for peer encouragement and rest.' }
      ],

      worldObjects: [
        // Perimeter walls
        { id: 'sch_n_wall', type: 'wall', x: 1, y: 1, w: 23, h: 1, color: '#1E3A8A', solid: true },
        { id: 'sch_w_wall', type: 'wall', x: 1, y: 1, w: 1, h: 16, color: '#1E3A8A', solid: true },
        { id: 'sch_e_wall', type: 'wall', x: 23, y: 1, w: 1, h: 16, color: '#1E3A8A', solid: true },
        { id: 'sch_s_wall_l', type: 'wall', x: 1, y: 16, w: 9, h: 1, color: '#1E3A8A', solid: true },
        { id: 'sch_s_wall_r', type: 'wall', x: 15, y: 16, w: 9, h: 1, color: '#1E3A8A', solid: true },

        // Blackboard & Teacher area
        { id: 'blackboard', type: 'board', x: 8, y: 2, w: 8, h: 1, color: '#1E4620', label: '📗 Blackboard: Diligence & Honor', solid: true },
        { id: 'teacher_desk', type: 'table', x: 11, y: 4, w: 3, h: 2, color: '#8D5B4C', label: '👩‍🏫 Teacher Desk', solid: true },

        // Student desks (2 rows)
        { id: 'desk_1', type: 'desk', x: 5, y: 8, w: 2.5, h: 1.8, color: '#C89B7B', label: 'Desk 1', solid: true },
        { id: 'desk_2', type: 'desk', x: 11, y: 8, w: 2.5, h: 1.8, color: '#C89B7B', label: 'Desk 2', solid: true },
        { id: 'desk_3', type: 'desk', x: 17, y: 8, w: 2.5, h: 1.8, color: '#C89B7B', label: 'Desk 3', solid: true },
        { id: 'desk_4', type: 'desk', x: 8, y: 11, w: 2.5, h: 1.8, color: '#C89B7B', label: 'Desk 4', solid: true },
        { id: 'desk_5', type: 'desk', x: 14, y: 11, w: 2.5, h: 1.8, color: '#C89B7B', label: 'Desk 5', solid: true },

        // Library Shelves on west side
        { id: 'bookshelf_1', type: 'shelf', x: 2, y: 3, w: 2, h: 5, color: '#5C3D2E', label: '📚 Library', solid: true },
        { id: 'bookshelf_2', type: 'shelf', x: 2, y: 9, w: 2, h: 4, color: '#5C3D2E', label: '📖 Archive', solid: true },

        // Bulletin board on east side
        { id: 'school_board_obj', type: 'board', x: 20, y: 4, w: 2, h: 3, color: '#935116', label: '📋 Notice', solid: true }
      ],

      npcs: [NPCS.teacher_mia],

      interactables: [
        {
          id: 'teacher_mia',
          name: 'Teacher Mia',
          type: 'NPC',
          x: 12.0,
          y: 4.5,
          radius: 2.3,
          label: 'Talk to Teacher Mia',
          icon: '👩‍🏫',
          dialogueNpcId: 'teacher_mia'
        },
        {
          id: 'school_notice_board',
          name: 'School Notice Board',
          type: 'NOTICE_BOARD',
          x: 20.0,
          y: 5.5,
          radius: 2.2,
          label: 'Read School Notice Board',
          icon: '📋',
          action: 'school_board'
        },
        {
          id: 'school_study_shelf',
          name: 'Library & Reference Shelf',
          type: 'OBJECT',
          x: 3.0,
          y: 6.0,
          radius: 2.2,
          label: 'Browse Library Books',
          icon: '📚',
          action: 'browse_books'
        },
        {
          id: 'school_study_desk',
          name: 'Student Study Desk',
          type: 'OBJECT',
          x: 12.0,
          y: 8.5,
          radius: 2.0,
          label: 'Review Study Notes',
          icon: '📝',
          action: 'review_study'
        },
        {
          id: 'school_exit',
          name: 'School Entrance Exit',
          type: 'TRAVEL_POINT',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          label: 'Leave School (Open World Map)',
          icon: '🚪',
          action: 'open_world_map'
        }
      ],

      exits: [
        {
          id: 'school_to_map_exit',
          destination: 'world_map',
          spawnId: 'default',
          x: 11.0,
          y: 16.2,
          w: 3.0,
          h: 1.5,
          label: 'Return to World Map'
        }
      ],

      discoveryMetadata: {
        title: 'School',
        tagline: 'Diligence, honest scholarship, peer kindness, and honoring teachers.',
        icon: '🏫'
      },

      questHooks: ['Q-005', 'school_study_quest']
    },

    // ------------------------------------------------------------
    // PLACE 4: SPORTS HUB
    // ------------------------------------------------------------
    sports_hub: {
      id: 'sports_hub',
      communityId: 'fog',
      name: 'Sports Hub',
      subtitle: 'Fitness & Teamwork',
      icon: '🏀',
      accentColor: '#D97706',
      tagline: 'Physical stewardship, bodily health, teamwork, and sportsmanship.',
      description: 'The outdoor athletic grounds with basketball courts, running tracks, and shaded benches for active fellowship.',
      unlockedByDefault: false,
      requirements: [
        {
          type: 'OR',
          conditions: [
            { type: 'PLACE_VISITED', placeId: 'fog_center' },
            { type: 'QUEST_COMPLETED', questId: 'Q-003' }
          ]
        }
      ],
      lockMessage: "Visit the FOG Community Center or complete Quest Q-003 to unlock the Sports Hub.",
      mapCoords: { x: 680, y: 440, labelPos: 'top' },
      mapBounds: { width: 25, height: 18 },

      spawnPoints: {
        default: { x: 12.0, y: 14.5, dir: 'up' },
        entrance: { x: 12.0, y: 14.5, dir: 'up' },
        court: { x: 12.0, y: 8.0, dir: 'down' },
        bleachers: { x: 20.0, y: 6.0, dir: 'left' }
      },

      atmosphere: {
        groundColor: '#27221A',
        floorColor: '#F5E6CC',
        wallColor: '#78350F',
        accentColor: '#D97706',
        ambientLabel: 'Energetic outdoor basketball half-court & track'
      },

      zones: [
        { id: 'entrance', name: 'Sports Hub Gate', icon: '🚪', description: 'Perimeter walkway leading to courts.' },
        { id: 'court', name: 'Basketball Half-Court', icon: '🏀', description: 'Regulation court lines and backboard.' },
        { id: 'track', name: 'Running Lane', icon: '🏃', description: 'Perimeter running track circling the court.' },
        { id: 'bleachers', name: 'Shaded Team Bleachers', icon: '🪵', description: 'Covered seating and hydration station.' }
      ],

      worldObjects: [
        // Court fencing & boundary
        { id: 'sp_n_fence', type: 'wall', x: 1, y: 1, w: 23, h: 1, color: '#78350F', solid: true },
        { id: 'sp_w_fence', type: 'wall', x: 1, y: 1, w: 1, h: 16, color: '#78350F', solid: true },
        { id: 'sp_e_fence', type: 'wall', x: 23, y: 1, w: 1, h: 16, color: '#78350F', solid: true },
        { id: 'sp_s_fence_l', type: 'wall', x: 1, y: 16, w: 9, h: 1, color: '#78350F', solid: true },
        { id: 'sp_s_fence_r', type: 'wall', x: 15, y: 16, w: 9, h: 1, color: '#78350F', solid: true },

        // Half-court lines & surface
        { id: 'court_surface', type: 'court_lines', x: 5, y: 3, w: 14, h: 10, color: '#E87A1E', solid: false },
        { id: 'bball_hoop', type: 'hoop', x: 11, y: 2, w: 2, h: 1.5, color: '#B71C1C', label: '🏀 Hoop', solid: true },

        // Running track perimeter lane
        { id: 'track_lane', type: 'floor_zone', x: 2, y: 2, w: 21, h: 14, color: '#B08968', solid: false },

        // Bleachers & Hydration on East side
        { id: 'bleachers_obj', type: 'bench', x: 20, y: 4, w: 2, h: 6, color: '#8D6E63', label: '🪵 Bleachers', solid: true },
        { id: 'hydration_obj', type: 'water_cooler', x: 20, y: 11, w: 1.5, h: 1.5, color: '#0288D1', label: '💧 Water', solid: true },

        // Sports Board on West side
        { id: 'sports_board_obj', type: 'board', x: 2, y: 5, w: 2, h: 3, color: '#D97706', label: '📋 Activity Board', solid: true }
      ],

      npcs: [NPCS.coach_daniel],

      interactables: [
        {
          id: 'coach_daniel',
          name: 'Coach Daniel',
          type: 'NPC',
          x: 12.0,
          y: 5.0,
          radius: 2.4,
          label: 'Talk to Coach Daniel',
          icon: '🏃',
          dialogueNpcId: 'coach_daniel'
        },
        {
          id: 'sports_activity_board',
          name: 'Sports Activity Board',
          type: 'ACTIVITY_POINT',
          x: 3.0,
          y: 6.5,
          radius: 2.2,
          label: 'Check Sports Activities',
          icon: '📋',
          action: 'sports_board'
        },
        {
          id: 'sports_hoop',
          name: 'Basketball Hoop',
          type: 'OBJECT',
          x: 12.0,
          y: 3.0,
          radius: 2.0,
          label: 'Shoot Free Throw',
          icon: '🏀',
          action: 'sports_hoop_shot'
        },
        {
          id: 'sports_hydration_station',
          name: 'Hydration Station',
          type: 'OBJECT',
          x: 20.0,
          y: 11.5,
          radius: 2.0,
          label: 'Drink Cool Water',
          icon: '💧',
          action: 'drink_water'
        },
        {
          id: 'sports_exit',
          name: 'Sports Hub Gate Exit',
          type: 'TRAVEL_POINT',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          label: 'Leave Sports Hub (Open World Map)',
          icon: '🚪',
          action: 'open_world_map'
        }
      ],

      exits: [
        {
          id: 'sports_to_map_exit',
          destination: 'world_map',
          spawnId: 'default',
          x: 11.0,
          y: 16.2,
          w: 3.0,
          h: 1.5,
          label: 'Return to World Map'
        }
      ],

      futureHooks: {
        sportActivity: true,
        personalBest: true,
        teamChallenge: true
      },

      discoveryMetadata: {
        title: 'Sports Hub',
        tagline: 'Move. Play. Grow together.',
        icon: '🏀'
      }
    },

    // ------------------------------------------------------------
    // PLACE 5: OUTREACH SITE
    // ------------------------------------------------------------
    outreach_site: {
      id: 'outreach_site',
      communityId: 'fog',
      name: 'Outreach Site',
      subtitle: 'Community Blessing & Mission',
      icon: '⛺',
      accentColor: '#059669',
      tagline: 'Hands ready to bless, serve, and share with neighbors.',
      description: 'A dedicated service staging area deployed for food packaging, relief preparation, and loving neighborly assistance.',
      unlockedByDefault: false,
      requirements: [
        { type: 'QUEST_COMPLETED', questId: 'Q-003' }
      ],
      lockMessage: "Complete Quest Q-003 'A Quiet Moment' to unlock the Outreach Site.",
      mapCoords: { x: 500, y: 150, labelPos: 'right' },
      mapBounds: { width: 25, height: 18 },

      spawnPoints: {
        default: { x: 12.0, y: 14.5, dir: 'up' },
        entrance: { x: 12.0, y: 14.5, dir: 'up' },
        packing_tables: { x: 12.0, y: 7.0, dir: 'down' },
        donation_shelf: { x: 6.0, y: 5.0, dir: 'right' }
      },

      atmosphere: {
        groundColor: '#1A241F',
        floorColor: '#E8F5E9',
        wallColor: '#065F46',
        accentColor: '#059669',
        ambientLabel: 'Earthy community canopy & service staging area'
      },

      zones: [
        { id: 'entrance', name: 'Welcome Canopy', icon: '⛺', description: 'Open shaded tent welcoming volunteers.' },
        { id: 'packing', name: 'Packing & Staging Tables', icon: '📦', description: 'Assembly tables for relief packages.' },
        { id: 'donation', name: 'Donation Storage Shelves', icon: '🥫', description: 'Organized food, supplies, and hygiene goods.' },
        { id: 'needs_board', name: 'Community Needs Board', icon: '📋', description: 'Direct updates on neighborhood blessing needs.' }
      ],

      worldObjects: [
        // Canopy & Perimeter Boundary
        { id: 'out_n_wall', type: 'wall', x: 1, y: 1, w: 23, h: 1, color: '#065F46', solid: true },
        { id: 'out_w_wall', type: 'wall', x: 1, y: 1, w: 1, h: 16, color: '#065F46', solid: true },
        { id: 'out_e_wall', type: 'wall', x: 23, y: 1, w: 1, h: 16, color: '#065F46', solid: true },
        { id: 'out_s_wall_l', type: 'wall', x: 1, y: 16, w: 9, h: 1, color: '#065F46', solid: true },
        { id: 'out_s_wall_r', type: 'wall', x: 15, y: 16, w: 9, h: 1, color: '#065F46', solid: true },

        // Large Shaded Canopy Tent
        { id: 'canopy_roof', type: 'tent', x: 7, y: 2, w: 11, h: 8, color: '#A7F3D0', label: '⛺ Mission Canopy', solid: false },

        // Staging Packing Tables
        { id: 'packing_table_1', type: 'table', x: 9, y: 5, w: 6, h: 2, color: '#795548', label: '📦 Packing Table', solid: true },
        { id: 'supply_crates', type: 'box', x: 16, y: 5, w: 2, h: 2, color: '#D97706', label: 'Care Boxes', solid: true },

        // Donation Shelves on West side
        { id: 'donation_shelves', type: 'shelf', x: 3, y: 4, w: 2.5, h: 6, color: '#4E342E', label: '🥫 Food Pantry', solid: true },

        // Needs Board on East side
        { id: 'needs_board_obj', type: 'board', x: 19, y: 4, w: 3, h: 2, color: '#047857', label: '📋 Community Needs', solid: true },

        // Care package stack
        { id: 'box_stack', type: 'box', x: 5, y: 11, w: 3, h: 2, color: '#B45309', label: '📦 Ready Boxes', solid: true }
      ],

      npcs: [NPCS.ate_maria],

      interactables: [
        {
          id: 'ate_maria',
          name: 'Ate Maria',
          type: 'NPC',
          x: 12.0,
          y: 4.5,
          radius: 2.4,
          label: 'Talk to Ate Maria',
          icon: '👩‍🌾',
          dialogueNpcId: 'ate_maria'
        },
        {
          id: 'outreach_needs_board',
          name: 'Community Needs Board',
          type: 'NOTICE_BOARD',
          x: 20.0,
          y: 5.0,
          radius: 2.2,
          label: 'View Community Needs',
          icon: '📋',
          action: 'outreach_needs'
        },
        {
          id: 'outreach_packing_table',
          name: 'Relief Packing Table',
          type: 'ACTIVITY_POINT',
          x: 12.0,
          y: 6.5,
          radius: 2.2,
          label: 'Help Pack Care Packages',
          icon: '📦',
          action: 'pack_care_box'
        },
        {
          id: 'outreach_donation_shelf',
          name: 'Donation Pantry Shelf',
          type: 'OBJECT',
          x: 4.0,
          y: 7.0,
          radius: 2.0,
          label: 'Organize Pantry Supplies',
          icon: '🥫',
          action: 'organize_pantry'
        },
        {
          id: 'outreach_exit',
          name: 'Outreach Canopy Exit',
          type: 'TRAVEL_POINT',
          x: 12.0,
          y: 16.5,
          radius: 2.0,
          label: 'Leave Outreach Site (Open World Map)',
          icon: '🚪',
          action: 'open_world_map'
        }
      ],

      exits: [
        {
          id: 'outreach_to_map_exit',
          destination: 'world_map',
          spawnId: 'default',
          x: 11.0,
          y: 16.2,
          w: 3.0,
          h: 1.5,
          label: 'Return to World Map'
        }
      ],

      futureHooks: {
        serviceCampaigns: true,
        packingMissions: true,
        donationPrep: true
      },

      discoveryMetadata: {
        title: 'Outreach Site',
        tagline: 'Hands ready to bless, serve, and share with neighbors.',
        icon: '⛺'
      }
    }
  };

  // Alias outreach -> outreach_site for backward compatibility
  PLACES.outreach = PLACES.outreach_site;

  // ============================================================
  // 3. GENERIC PLACE AVAILABILITY EVALUATOR
  // ============================================================
  function evaluatePlaceAvailability(placeId, state) {
    const place = PLACES[placeId];
    if (!place) return { available: false, reason: 'Unknown place' };
    if (place.unlockedByDefault) return { available: true, reason: 'Unlocked by default' };
    if (!state) return { available: false, reason: 'No game state' };

    // Check if explicitly unlocked in state
    if (Array.isArray(state.unlockedPlaces) && state.unlockedPlaces.includes(placeId)) {
      return { available: true, reason: 'Already unlocked in state' };
    }

    // Special backward-compat check for fog_center
    if (placeId === 'fog_center' && state.fogCenterUnlocked === true) {
      return { available: true, reason: 'Unlocked by garden quest world effects' };
    }

    const reqs = place.requirements || [];
    if (reqs.length === 0) return { available: true, reason: 'No requirements' };

    for (const req of reqs) {
      if (req.type === 'QUEST_COMPLETED') {
        const isCompleted = state.questProgress && state.questProgress[req.questId]?.status === 'COMPLETED';
        if (!isCompleted) {
          return {
            available: false,
            reason: place.lockMessage || `Requires Quest ${req.questId} completed`
          };
        }
      } else if (req.type === 'PLACE_VISITED') {
        const isVisited = (Array.isArray(state.visitedPlaces) ? state.visitedPlaces.includes(req.placeId) : (state.visitedPlaces && state.visitedPlaces[req.placeId])) ||
                          (req.placeId === 'fog_center' && state.visitedFogCenter);
        if (!isVisited) {
          return {
            available: false,
            reason: place.lockMessage || `Must visit ${PLACES[req.placeId]?.name || req.placeId} first`
          };
        }
      } else if (req.type === 'PLACE_UNLOCKED') {
        const isUnlocked = Array.isArray(state.unlockedPlaces) && state.unlockedPlaces.includes(req.placeId);
        if (!isUnlocked) {
          return {
            available: false,
            reason: place.lockMessage || `Requires ${PLACES[req.placeId]?.name || req.placeId} unlocked`
          };
        }
      } else if (req.type === 'FLAG') {
        if (state[req.flag] !== req.value) {
          return {
            available: false,
            reason: place.lockMessage || `Requires flag ${req.flag}`
          };
        }
      } else if (req.type === 'OR') {
        const anyPass = (req.conditions || []).some(cond => {
          if (cond.type === 'PLACE_VISITED') {
            return (Array.isArray(state.visitedPlaces) ? state.visitedPlaces.includes(cond.placeId) : (state.visitedPlaces && state.visitedPlaces[cond.placeId])) ||
                   (cond.placeId === 'fog_center' && state.visitedFogCenter);
          } else if (cond.type === 'QUEST_COMPLETED') {
            return state.questProgress && state.questProgress[cond.questId]?.status === 'COMPLETED';
          }
          return false;
        });
        if (!anyPass) {
          return {
            available: false,
            reason: place.lockMessage || 'Unlock condition not yet satisfied'
          };
        }
      }
    }

    return { available: true, reason: 'All prerequisites satisfied' };
  }

  // Node module exports
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PLACES,
      NPCS,
      evaluatePlaceAvailability
    };
  }

  // Browser global exports
  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.places = PLACES;
  root.KOINONIA_DATA.npcs = NPCS;
  root.KOINONIA_DATA.evaluatePlaceAvailability = evaluatePlaceAvailability;

})();
