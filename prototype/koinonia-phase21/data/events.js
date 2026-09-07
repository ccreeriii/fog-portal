/**
 * KOINONIA — PHASE 0.17 DATA STORE: EVENTS & REAL FOG GATHERINGS ENGINE
 * Architecture: Event Templates, Recurrence Rules, Event Instances, and World Themes
 * Deterministic Time Engine supporting `now` reference parameter
 * Forward-compatible ownership: `communityId: 'fog'`
 */

(function () {
  'use strict';

  // ============================================================
  // 1. EVENT CONSTANTS & STATUSES
  // ============================================================
  const FOG_TIMEZONE = 'Asia/Manila';
  const MANILA_OFFSET_HOURS = 8;
  const MANILA_OFFSET_MS = MANILA_OFFSET_HOURS * 60 * 60 * 1000;
  const FOG_TIMEZONE_OFFSET = '+08:00';
  const EVENT_STATUS = {
    UPCOMING: 'UPCOMING',
    LIVE: 'LIVE',
    ENDED: 'ENDED',
    PAST: 'ENDED'
  };

  const RECURRENCE_TYPE = {
    NONE: 'NONE',
    WEEKLY: 'WEEKLY',
    MONTHLY: 'MONTHLY',
    CUSTOM_DATES: 'CUSTOM_DATES',
    CONFIG_REQUIRED: 'CONFIG_REQUIRED',
    UNSCHEDULED: 'CONFIG_REQUIRED'
  };
  const RECURRENCE_TYPES = RECURRENCE_TYPE;

  const EVENT_CATEGORIES = {
    FORMATION: 'FORMATION',
    WORSHIP_PRAYER: 'WORSHIP_PRAYER',
    FELLOWSHIP: 'FELLOWSHIP',
    RETREAT: 'RETREAT',
    SPORTS: 'SPORTS & FELLOWSHIP'
  };

  // ============================================================
  // 2. CANONICAL EVENT TEMPLATES
  // ============================================================
  const EVENT_TEMPLATE_MAP = {
    // ------------------------------------------------------------
    // 1. GET INTO THE GLORY (PRAYER & WORSHIP GATHERING)
    // ------------------------------------------------------------
    get_into_the_glory: {
      id: 'get_into_the_glory',
      communityId: 'fog',
      title: 'Get Into the Glory',
      shortTitle: 'GiG',
      abbreviation: 'GiG',
      subtitle: 'Worship, Intercession & Fellowship Gathering',
      description: 'Vibrant worship, deep prayer, acoustic praise, and shared testimonies in the FOG Center Main Hall.',
      category: EVENT_CATEGORIES.WORSHIP_PRAYER,
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      location: { placeId: 'fog_center', placeName: 'FOG Community Center' },
      timeZone: 'Asia/Manila',
      scheduleStatus: 'CONFIG_REQUIRED',
      scheduleNote: 'Official gathering schedule to be announced by Fire of God Ministries.',
      recurrence: { type: 'CONFIG_REQUIRED' },
      dayOfWeek: null,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      time: { startTime: null, endTime: null, durationMinutes: null },
      audience: 'Youth & Young Adults',
      icon: '🕯️',
      accentColor: '#D97706',
      questHooks: ['E-Q001', 'E-Q002', 'E-Q003'],
      rewardsSummary: {
        lifePoints: 5,
        xp: 5,
        badge: 'Flame of Praise'
      },
      worldEffects: {
        theme: 'worship',
        banner: 'Get Into the Glory • Worship & Prayer',
        accentColor: '#D97706',
        temporaryObjects: [
          {
            id: 'obj_worship_candles',
            name: 'Prayer & Candle Altar',
            icon: '🕯️',
            x: 260,
            y: 160,
            description: 'Soft glowing candles and written prayer petitions.'
          },
          {
            id: 'obj_acoustic_stage',
            name: 'Acoustic Worship Stage',
            icon: '🎸',
            x: 340,
            y: 140,
            description: 'Acoustic guitars, cajon, and hymnals set up for fellowship praise.'
          },
          {
            id: 'obj_fellowship_tea',
            name: 'Hot Tea & Fellowship Table',
            icon: '🍵',
            x: 180,
            y: 220,
            description: 'Warm herbal tea and biscuits for visitors after prayer.'
          }
        ],
        temporaryInteractables: [
          {
            id: 'interact_quiet_prayer',
            name: 'Quiet Prayer Corner',
            icon: '🕯️',
            action: 'PRAY',
            prompt: 'Pause for a private prayer or pray quietly for someone in need.'
          },
          {
            id: 'interact_worship_seat',
            name: 'Quiet Worship Circle',
            icon: '🪑',
            action: 'REFLECT',
            prompt: 'Sit quietly and listen to acoustic praise.'
          }
        ],
        dialogueOverrides: {
          sister_grace: "The prayer altar is open if you need someone to pray with you or simply want quiet reflection."
        }
      }
    },

    // ------------------------------------------------------------
    // 2. YOUTH HANGOUTS (1ST SATURDAY FELLOWSHIP & GAMES)
    // ------------------------------------------------------------
    youth_hangouts: {
      id: 'youth_hangouts',
      communityId: 'fog',
      title: 'Youth Hangouts',
      subtitle: 'Monthly 1st Saturday Fellowship, Games & Food',
      description: 'Relaxed Saturday fellowship with board games, pizza, casual conversations, and welcoming atmosphere.',
      category: EVENT_CATEGORIES.FELLOWSHIP,
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      location: { placeId: 'fog_center', placeName: 'FOG Community Center' },
      timeZone: 'Asia/Manila',
      recurrence: { type: RECURRENCE_TYPE.MONTHLY, monthlyRule: 'FIRST_SATURDAY', weekOfMonth: 1, dayOfWeek: 6 },
      monthlyRule: 'FIRST_SATURDAY',
      weekOfMonth: 1,
      dayOfWeek: 6,
      startTime: '15:00',
      endTime: null,
      durationMinutes: null,
      time: { startTime: '15:00', endTime: null, durationMinutes: null },
      audience: 'Youth (Ages 11–21)',
      icon: '🍕',
      accentColor: '#2563EB',
      questHooks: ['E-Q001', 'E-Q002'],
      rewardsSummary: {
        lifePoints: 5,
        xp: 5,
        badge: 'Warm Companion'
      },
      worldEffects: {
        theme: 'hangout',
        banner: 'Youth Hangout • Games, Food & Friends',
        accentColor: '#2563EB',
        temporaryObjects: [
          {
            id: 'obj_board_games',
            name: 'Board Games & Activity Corner',
            icon: '🎲',
            x: 240,
            y: 180,
            description: 'Card games, Settlers of Catan, and multiplayer games set up.'
          },
          {
            id: 'obj_pizza_station',
            name: 'Pizza & Refreshment Counter',
            icon: '🍕',
            x: 380,
            y: 200,
            description: 'Fresh pizza boxes, juice, and fruit platters.'
          },
          {
            id: 'obj_beanbags',
            name: 'Cozy Lounge Beanbags',
            icon: '🛋️',
            x: 160,
            y: 160,
            description: 'Relaxed seating area for chatting with friends.'
          }
        ],
        temporaryInteractables: [
          {
            id: 'interact_game_table',
            name: 'Join a Board Game',
            icon: '🎯',
            action: 'PLAY',
            prompt: 'Sit in on a friendly game of Uno or Catan.'
          },
          {
            id: 'interact_snack_bar',
            name: 'Grab a Slice of Pizza',
            icon: '🍕',
            action: 'EAT',
            prompt: 'Share a slice and catch up with someone new.'
          }
        ],
        dialogueOverrides: {
          sister_grace: "Welcome to Youth Hangouts! Grab a slice of pizza, join in on the board games, and make yourself at home."
        }
      }
    },

    // ------------------------------------------------------------
    // 3. ALPHA YOUTH SERIES SESSION (BATCH-BASED FORMATION)
    // ------------------------------------------------------------
    alpha_session_event: {
      id: 'alpha_session_event',
      campaignId: 'alpha_youth_series',
      communityId: 'fog',
      title: 'Alpha Youth Series Session',
      subtitle: 'Interactive Faith & Discussion Gathering',
      description: 'A welcoming space for youth to watch short films and discuss life\'s big questions in honest small groups around food.',
      category: EVENT_CATEGORIES.FORMATION,
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      location: { placeId: 'fog_center', placeName: 'FOG Community Center' },
      timeZone: 'Asia/Manila',
      scheduleMode: 'BATCH_INSTANCES',
      recurrence: { type: RECURRENCE_TYPE.CUSTOM_DATES, pattern: 'SATURDAY_BATCH', defaultStartTime: '15:00' },
      dayOfWeek: 6,
      startTime: '15:00',
      endTime: null,
      durationMinutes: null,
      time: { startTime: '15:00', endTime: null, durationMinutes: null },
      audience: 'Youth (Ages 11–21)',
      icon: '❓',
      accentColor: '#EA580C',
      questHooks: ['E-Q001', 'E-Q002', 'E-Q003'],
      rewardsSummary: {
        lifePoints: 5,
        xp: 5,
        badge: 'Question Seeker'
      },
      worldEffects: {
        theme: 'alpha',
        banner: 'Alpha Youth Series • Honest Questions Welcome',
        accentColor: '#EA580C',
        temporaryObjects: [
          {
            id: 'obj_alpha_screen',
            name: 'Alpha Discussion Screen',
            icon: '🎬',
            x: 300,
            y: 130,
            description: 'Projector showing today\'s Alpha Youth episode.'
          },
          {
            id: 'obj_alpha_circle',
            name: 'Discussion Circle',
            icon: '⭕',
            x: 260,
            y: 200,
            description: 'Chairs arranged in a circle for open conversation.'
          },
          {
            id: 'obj_alpha_welcome',
            name: 'Welcome & Name Tags',
            icon: '🏷️',
            x: 180,
            y: 240,
            description: 'Name tags and welcoming notes for every participant.'
          }
        ],
        temporaryInteractables: [
          {
            id: 'interact_alpha_host',
            name: 'Alpha Host Table',
            icon: '👋',
            action: 'TALK',
            prompt: 'Check in with the host and get today\'s discussion prompt.'
          },
          {
            id: 'interact_alpha_question',
            name: 'Anonymous Question Box',
            icon: '📬',
            action: 'SUBMIT',
            prompt: 'Drop an honest question into the box.'
          }
        ],
        dialogueOverrides: {
          sister_grace: "Welcome to Alpha Youth! Remember, there are no silly questions here—feel free to join the discussion circle and share honestly."
        }
      }
    },

    // ------------------------------------------------------------
    // 4. ALPHA YOUTH DAY (FULL-DAY RETREAT EXPERIENCE — CHAPTER 12)
    // ------------------------------------------------------------
    alpha_youth_day_event: {
      id: 'alpha_youth_day_event',
      campaignId: 'alpha_youth_series',
      chapterId: 'alpha_ch12',
      communityId: 'fog',
      title: 'Alpha Youth Day',
      subtitle: 'Full-Day Community Gathering',
      description: 'A full-day Alpha Youth Series community experience.',
      category: EVENT_CATEGORIES.RETREAT,
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      location: { placeId: 'fog_center', placeName: 'FOG Community Center' },
      timeZone: 'Asia/Manila',
      recurrence: { type: RECURRENCE_TYPE.CUSTOM_DATES },
      startTime: '08:30',
      endTime: null,
      durationMinutes: null,
      time: { startTime: '08:30', endTime: null, durationMinutes: null },
      audience: 'Youth (Ages 11–21)',
      icon: '☀️',
      accentColor: '#7C3AED',
      questHooks: ['E-Q001', 'E-Q002', 'E-Q003'],
      rewardsSummary: {
        lifePoints: 10,
        xp: 10,
        badge: 'Spirit & Truth'
      },
      worldEffects: {
        theme: 'retreat',
        banner: 'Alpha Youth Day • Community Experience',
        accentColor: '#7C3AED',
        temporaryObjects: [
          {
            id: 'obj_retreat_gazebo',
            name: 'Outdoor Fellowship Pavilion',
            icon: '🎪',
            x: 250,
            y: 150,
            description: 'Shaded pavilion with picnic benches and acoustic instruments.'
          },
          {
            id: 'obj_prayer_labyrinth',
            name: 'Quiet Reflection Path',
            icon: '🌿',
            x: 380,
            y: 180,
            description: 'Prayer stations with scripture prompts along the garden walk.'
          },
          {
            id: 'obj_retreat_bbq',
            name: 'Retreat Lunch Grill',
            icon: '🍢',
            x: 160,
            y: 220,
            description: 'Community lunch grilled together with fresh salads.'
          }
        ],
        temporaryInteractables: [
          {
            id: 'interact_retreat_guide',
            name: 'Retreat Prayer Guide',
            icon: '📖',
            action: 'READ',
            prompt: "Read the day's devotional guide and scripture map."
          }
        ],
        dialogueOverrides: {
          sister_grace: "Welcome to Alpha Youth Day! Take your time at the reflection stations and enjoy fellowship together."
        }
      }
    },

    // ------------------------------------------------------------
    // 5. FOG SPORTS FELLOWSHIP DAY (DEMO / PROTOTYPE HOOK)
    // ------------------------------------------------------------
    fog_sports_fellowship: {
      id: 'fog_sports_fellowship',
      communityId: 'fog',
      isDemo: true,
      demoLabel: 'DEMO / PROTOTYPE ONLY',
      title: '[DEMO] FOG Sports Fellowship Day',
      subtitle: 'Active Play, Physical Stewardship & Friendly Competition',
      description: 'An open sports fellowship afternoon at the Sports Hub featuring free throw challenges, sprint relays, and racket rallies.',
      category: EVENT_CATEGORIES.SPORTS,
      placeId: 'sports_hub',
      placeName: 'Sports Hub',
      location: { placeId: 'sports_hub', placeName: 'Sports Hub' },
      timeZone: 'Asia/Manila',
      scheduleStatus: 'CONFIG_REQUIRED',
      scheduleNote: 'Demo sports event template for Faith Quest architecture hooks.',
      recurrence: { type: RECURRENCE_TYPE.CONFIG_REQUIRED },
      dayOfWeek: null,
      startTime: null,
      endTime: null,
      durationMinutes: null,
      time: { startTime: null, endTime: null, durationMinutes: null },
      audience: 'Youth & Young Adults',
      icon: '🏀',
      accentColor: '#D97706',
      questHooks: ['E-Q001', 'E-Q002'],
      fitQuestChallengeIds: ['FQ-V001', 'FQ-V002', 'FQ-V003', 'FQ-R001', 'FQ-R003'],
      rewardsSummary: {
        lifePoints: 5,
        xp: 5,
        badge: 'Sports Fellowship'
      }
    }
  };

  const EVENT_TEMPLATES = Object.values(EVENT_TEMPLATE_MAP);
  Object.assign(EVENT_TEMPLATES, EVENT_TEMPLATE_MAP);

  // ============================================================
  // 3. CONCRETE EVENT INSTANCES (SEPTEMBER - OCTOBER 2026)
  // ============================================================
  const EVENT_INSTANCES = {
    // DEMO / QA ONLY: Get Into the Glory Simulated Session (+08:00 Asia/Manila)
    inst_gitg_20260911: {
      id: 'inst_gitg_20260911',
      templateId: 'get_into_the_glory',
      isDemo: true,
      demoLabel: 'DEMO / QA ONLY',
      title: '[DEMO] Get Into the Glory — Worship Gathering',
      shortTitle: 'GiG',
      subtitle: 'Worship & Prayer Gathering • Live Experience',
      description: 'A shared gathering of worship, scripture reflection, and extended prayer.',
      timeZone: 'Asia/Manila',
      date: '2026-09-11',
      startTime: '2026-09-11T20:00:00+08:00',
      endTime: '2026-09-11T21:30:00+08:00',
      startIso: '2026-09-11T20:00:00+08:00',
      endIso: '2026-09-11T21:30:00+08:00',
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      category: EVENT_CATEGORIES.WORSHIP_PRAYER,
      icon: '🕯️',
      accentColor: '#D97706',
      questHooks: ['E-Q001', 'E-Q002', 'E-Q003']
    },

    // DEMO / QA ONLY: Alpha Youth Series Session 1 (Sat 15:00 start, +08:00 Asia/Manila)
    inst_alpha_20260912: {
      id: 'inst_alpha_20260912',
      templateId: 'alpha_session_event',
      campaignId: 'alpha_youth_series',
      chapterId: 'alpha_ch01',
      isDemo: true,
      demoLabel: 'DEMO / QA ONLY',
      title: '[DEMO] Alpha Youth Series — Session 1',
      subtitle: 'Session 1 • Faith Formation Series',
      description: 'An open, welcoming space where youth explore big life questions together.',
      timeZone: 'Asia/Manila',
      date: '2026-09-12',
      startTime: '2026-09-12T15:00:00+08:00',
      endTime: '2026-09-12T16:30:00+08:00',
      startIso: '2026-09-12T15:00:00+08:00',
      endIso: '2026-09-12T16:30:00+08:00',
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      category: EVENT_CATEGORIES.FORMATION,
      icon: '❓',
      accentColor: '#EA580C',
      questHooks: ['E-Q001', 'E-Q002', 'E-Q003']
    },

    // DEMO / QA ONLY: Youth Hangouts First Saturday (Sat 15:00 start, +08:00 Asia/Manila)
    inst_hangout_20261003: {
      id: 'inst_hangout_20261003',
      templateId: 'youth_hangouts',
      isDemo: true,
      demoLabel: 'DEMO / QA ONLY',
      title: '[DEMO] Youth Hangouts — Pizza & Board Games',
      subtitle: 'First Saturday Youth Fellowship',
      description: 'Casual community hangout with games, food, and fellowship.',
      timeZone: 'Asia/Manila',
      date: '2026-10-03',
      startTime: '2026-10-03T15:00:00+08:00',
      endTime: '2026-10-03T17:30:00+08:00',
      startIso: '2026-10-03T15:00:00+08:00',
      endIso: '2026-10-03T17:30:00+08:00',
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      category: EVENT_CATEGORIES.FELLOWSHIP,
      icon: '🍕',
      accentColor: '#2563EB',
      questHooks: ['E-Q001', 'E-Q002']
    },

    // DEMO / QA ONLY: Alpha Youth Day Retreat (08:30 start, Chapter 12, +08:00 Asia/Manila)
    inst_alpha_day_20261024: {
      id: 'inst_alpha_day_20261024',
      templateId: 'alpha_youth_day_event',
      campaignId: 'alpha_youth_series',
      chapterId: 'alpha_ch12',
      isDemo: true,
      demoLabel: 'DEMO / QA ONLY',
      title: '[DEMO] Alpha Youth Day',
      subtitle: 'Chapter 12 • Community Day Away',
      description: 'A dedicated retreat day away of fellowship, reflection, and community bonding.',
      timeZone: 'Asia/Manila',
      date: '2026-10-24',
      startTime: '2026-10-24T08:30:00+08:00',
      endTime: '2026-10-24T17:00:00+08:00',
      startIso: '2026-10-24T08:30:00+08:00',
      endIso: '2026-10-24T17:00:00+08:00',
      placeId: 'fog_center',
      placeName: 'FOG Community Center',
      category: EVENT_CATEGORIES.RETREAT,
      icon: '☀️',
      accentColor: '#7C3AED',
      questHooks: ['E-Q001', 'E-Q002', 'E-Q003']
    }
  };

  // Legacy event records for Phase 0.8 / Phase 0.16 backward compatibility
  const LEGACY_EVENTS = {
    bball_day_2026: {
      id: 'bball_day_2026',
      communityId: 'fog',
      name: 'FOG Youth Basketball Day',
      title: 'FOG Youth Basketball Day',
      category: 'Sports & Fellowship',
      date: 'September 2026',
      placeId: 'sports_hub',
      status: 'completed',
      participantsCount: 18,
      questsCompleted: 42,
      communityXpAwarded: 380,
      teams: [
        { name: 'Team Fire', score: 68, color: '#C86A4B', isWinner: true },
        { name: 'Team Grace', score: 62, color: '#4B6B44', isWinner: false }
      ],
      recognitions: [
        { role: 'Top Scorer', recipient: 'Alex', detail: '24 Points (3 Three-Pointers)', icon: '🔥' },
        { role: 'Teamwork Recognition', recipient: 'Jordan', detail: '11 Assists & Unselfish Passing', icon: '🤝' },
        { role: 'Sportsmanship Recognition', recipient: 'Sam', detail: 'Helped Opponents Up & High-Fived Referees', icon: '⭐' }
      ],
      rewardsSummary: {
        disciplineXp: 25,
        teamworkXp: 35,
        lifePoints: 15
      },
      description: 'A vibrant Saturday afternoon of energetic basketball, court-side cheering, half-time devotion, and shared refreshments.'
    }
  };

  // Personal Best System ("Compete with Yourself") - preserved for Phase 0.8+
  const PERSONAL_BESTS = {
    basketball_freethrows: {
      id: 'basketball_freethrows',
      communityId: 'fog',
      placeId: 'sports_hub',
      sport: 'Basketball',
      metricName: 'Free Throws (Out of 20)',
      previousScore: 12,
      currentScore: 15,
      delta: 3,
      unit: '/ 20 Makes',
      lastPracticed: 'September 2026',
      message: 'PERSONAL BEST +3! Steady routine and follow-through paid off.'
    },
    badminton_rally: {
      id: 'badminton_rally',
      communityId: 'fog',
      placeId: 'sports_hub',
      sport: 'Badminton',
      metricName: 'Unbroken Doubles Rally',
      previousScore: 18,
      currentScore: 24,
      delta: 6,
      unit: 'Consecutive Hits',
      lastPracticed: 'August 2026',
      message: 'PERSONAL BEST +6! Great communication with your court partner.'
    },
    pickleball_serves: {
      id: 'pickleball_serves',
      communityId: 'fog',
      placeId: 'sports_hub',
      sport: 'Pickleball',
      metricName: 'Accurate Deep Serves',
      previousScore: 14,
      currentScore: 17,
      delta: 3,
      unit: '/ 20 In Bounds',
      lastPracticed: 'August 2026',
      message: 'PERSONAL BEST +3! Consistent paddle angle and depth.'
    },
    running_mile: {
      id: 'running_mile',
      communityId: 'fog',
      placeId: 'sports_hub',
      sport: 'Fitness & Running',
      metricName: 'Campus Perimeter Mile',
      previousScore: 525, // 8:45 in seconds
      currentScore: 500,  // 8:20 in seconds
      delta: -25,         // -25 seconds improvement
      unit: 'Time: 8m 20s',
      lastPracticed: 'September 2026',
      message: 'PERSONAL BEST -25s! Controlled breathing over 4 continuous laps.'
    }
  };

  // Merged EVENTS object for backward compatibility
  const EVENTS = Object.assign({}, LEGACY_EVENTS, EVENT_INSTANCES);

  // ============================================================
  // 4. DETERMINISTIC TIME ENGINE & RECURRENCE HELPERS
  // ============================================================
  function getEventTemplateById(id) {
    if (!id) return null;
    if (EVENT_TEMPLATE_MAP[id]) return EVENT_TEMPLATE_MAP[id];
    return EVENT_TEMPLATES.find(t => t.id === id) || null;
  }

  function parseDate(d) {
    if (!d) return new Date();
    if (d instanceof Date) return new Date(d.getTime());
    if (typeof d === 'string') {
      // If no timezone offset is specified, default to Asia/Manila (+08:00)
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(d)) {
        d = d.length === 16 ? d + ':00+08:00' : d + '+08:00';
      }
    }
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }

  function getManilaComponents(dateOrMs) {
    const ref = parseDate(dateOrMs);
    // Shift UTC ms by +8 hours so UTC get methods return exact Asia/Manila wall-clock values
    const shifted = new Date(ref.getTime() + MANILA_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth(),     // 0..11
      date: shifted.getUTCDate(),       // 1..31
      dayOfWeek: shifted.getUTCDay(),   // 0=Sun..6=Sat
      hours: shifted.getUTCHours(),
      minutes: shifted.getUTCMinutes(),
      seconds: shifted.getUTCSeconds(),
      timeMs: ref.getTime()
    };
  }

  function createManilaDateMs(year, month, date, hours = 0, minutes = 0, seconds = 0) {
    return Date.UTC(year, month, date, hours, minutes, seconds, 0) - MANILA_OFFSET_MS;
  }

  function getEventStatus(eventOrInstance, now) {
    if (!eventOrInstance) return EVENT_STATUS.ENDED;
    const refDate = parseDate(now);
    const refMs = refDate.getTime();

    const startStr = eventOrInstance.startIso || eventOrInstance.startTime;
    const endStr = eventOrInstance.endIso || eventOrInstance.endTime;

    if (startStr && (String(startStr).includes('T') || String(startStr).includes('-'))) {
      const startMs = parseDate(startStr).getTime();
      if (refMs < startMs) {
        return EVENT_STATUS.UPCOMING;
      }
      // If explicit end time is defined
      if (endStr && (String(endStr).includes('T') || String(endStr).includes('-'))) {
        const endMs = parseDate(endStr).getTime();
        if (refMs >= startMs && refMs <= endMs) {
          return EVENT_STATUS.LIVE;
        }
        return EVENT_STATUS.ENDED;
      }
      // If canonical end time is unknown (null or empty):
      // Do not fabricate an official duration just to calculate LIVE state.
      // Show the event as scheduled/upcoming using its approved start time.
      // LIVE state comes from explicit event instances with a defined end.
      return EVENT_STATUS.UPCOMING;
    }

    // If template without concrete start, evaluate next occurrence
    if (eventOrInstance.recurrence) {
      const nextOcc = getNextOccurrence(eventOrInstance, refDate);
      if (nextOcc) {
        return getEventStatus(nextOcc, refDate);
      }
    }

    if (eventOrInstance.status === 'completed') return EVENT_STATUS.ENDED;
    return EVENT_STATUS.UPCOMING;
  }

  function getNextOccurrence(template, now) {
    if (!template) return null;
    const refDate = parseDate(now);
    const rec = typeof template.recurrence === 'object' ? template.recurrence : { type: template.recurrence };
    const recType = rec ? rec.type || template.recurrence : null;

    if (!recType || recType === 'CONFIG_REQUIRED' || recType === 'UNSCHEDULED') {
      return null;
    }

    if (recType === RECURRENCE_TYPE.NONE) {
      if (template.startIso || template.startTime) {
        const start = template.startIso || template.startTime;
        const end = template.endIso || template.endTime || null;
        return Object.assign({}, template, {
          timeZone: template.timeZone || FOG_TIMEZONE,
          startTime: start,
          endTime: end,
          startIso: start,
          endIso: end,
          durationMinutes: template.durationMinutes || null
        });
      }
      return null;
    }

    const tTime = template.time || template;
    const startTimeStr = tTime.startTime || template.startTime || '15:00';
    // Preserve null if canonical endTime is not set; DO NOT default to '17:00'
    const endTimeStr = (tTime.endTime !== undefined ? tTime.endTime : template.endTime) || null;
    const [startHour, startMin] = startTimeStr.split(':').map(Number);
    const [endHour, endMin] = endTimeStr ? endTimeStr.split(':').map(Number) : [null, null];

    const nowManila = getManilaComponents(refDate);

    if (recType === RECURRENCE_TYPE.WEEKLY) {
      const targetDow = rec.dayOfWeek !== undefined ? rec.dayOfWeek : (template.dayOfWeek !== undefined ? template.dayOfWeek : 6);
      let daysAhead = targetDow - nowManila.dayOfWeek;

      if (daysAhead < 0) {
        daysAhead += 7;
      } else if (daysAhead === 0) {
        // Check if today's start/end has passed in Manila time
        const cutoffMs = endTimeStr !== null
          ? createManilaDateMs(nowManila.year, nowManila.month, nowManila.date, endHour, endMin)
          : createManilaDateMs(nowManila.year, nowManila.month, nowManila.date, startHour, startMin);
        if (nowManila.timeMs > cutoffMs) {
          daysAhead = 7;
        }
      }

      const occStartMs = createManilaDateMs(nowManila.year, nowManila.month, nowManila.date + daysAhead, startHour, startMin);
      const occManila = getManilaComponents(occStartMs);
      const y = occManila.year;
      const m = String(occManila.month + 1).padStart(2, '0');
      const d = String(occManila.date).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const startIso = `${dateStr}T${startTimeStr}:00+08:00`;
      const endIso = endTimeStr ? `${dateStr}T${endTimeStr}:00+08:00` : null;

      return {
        id: `inst_${template.id}_${y}${m}${d}`,
        templateId: template.id,
        title: template.title,
        subtitle: template.subtitle,
        description: template.description,
        category: template.category,
        placeId: template.placeId,
        placeName: template.placeName,
        timeZone: template.timeZone || FOG_TIMEZONE,
        date: dateStr,
        startTime: startIso,
        endTime: endIso,
        startIso: startIso,
        endIso: endIso,
        durationMinutes: template.durationMinutes || null,
        icon: template.icon,
        accentColor: template.accentColor,
        questHooks: template.questHooks || [],
        worldEffects: template.worldEffects || null
      };
    }

    if (recType === RECURRENCE_TYPE.MONTHLY) {
      let y = nowManila.year;
      let m = nowManila.month;

      function getFirstSatDate(targetYear, targetMonth) {
        // Determine day of week for 1st of month in Manila
        const firstMs = createManilaDateMs(targetYear, targetMonth, 1, 0, 0);
        const firstDow = getManilaComponents(firstMs).dayOfWeek;
        const daysUntilSat = (6 - firstDow + 7) % 7;
        return 1 + daysUntilSat;
      }

      let satDate = getFirstSatDate(y, m);
      const cutoffMs = endTimeStr !== null
        ? createManilaDateMs(y, m, satDate, endHour, endMin)
        : createManilaDateMs(y, m, satDate, startHour, startMin);

      if (nowManila.timeMs > cutoffMs) {
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
        satDate = getFirstSatDate(y, m);
      }

      const yStr = String(y);
      const mStr = String(m + 1).padStart(2, '0');
      const dStr = String(satDate).padStart(2, '0');
      const dateStr = `${yStr}-${mStr}-${dStr}`;
      const startIso = `${dateStr}T${startTimeStr}:00+08:00`;
      const endIso = endTimeStr ? `${dateStr}T${endTimeStr}:00+08:00` : null;

      return {
        id: `inst_${template.id}_${yStr}${mStr}${dStr}`,
        templateId: template.id,
        title: template.title,
        subtitle: template.subtitle,
        description: template.description,
        category: template.category,
        placeId: template.placeId,
        placeName: template.placeName,
        timeZone: template.timeZone || FOG_TIMEZONE,
        date: dateStr,
        startTime: startIso,
        endTime: endIso,
        startIso: startIso,
        endIso: endIso,
        durationMinutes: template.durationMinutes || null,
        icon: template.icon,
        accentColor: template.accentColor,
        questHooks: template.questHooks || [],
        worldEffects: template.worldEffects || null
      };
    }

    return null;
  }

  function expandRecurrence(template, startDate, endDate) {
    if (!template) return [];
    const start = parseDate(startDate);
    const end = parseDate(endDate);
    const instances = [];

    let cur = new Date(start.getTime());
    let safety = 0;
    while (cur.getTime() <= end.getTime() && safety < 100) {
      safety++;
      const nextOcc = getNextOccurrence(template, cur);
      if (!nextOcc) break;

      const occStart = parseDate(nextOcc.startIso);
      if (occStart.getTime() > end.getTime()) break;

      if (!instances.find(i => i.id === nextOcc.id)) {
        instances.push(nextOcc);
      }

      // Advance by 1 day past current occurrence
      cur = new Date(occStart.getTime() + 86400000);
    }
    return instances;
  }

  function getUpcomingEvents(arg1, arg2, arg3) {
    let list;
    let refDate;
    let max;

    if (Array.isArray(arg1)) {
      list = arg1;
      refDate = parseDate(arg2);
      max = arg3 || 10;
    } else {
      list = Object.values(EVENT_INSTANCES);
      refDate = parseDate(arg1);
      max = arg2 || 10;
    }

    const upcoming = list
      .filter(e => {
        const status = getEventStatus(e, refDate);
        return status === EVENT_STATUS.UPCOMING || status === EVENT_STATUS.LIVE;
      })
      .sort((a, b) => {
        const aMs = parseDate(a.startIso || a.startTime || a.date).getTime();
        const bMs = parseDate(b.startIso || b.startTime || b.date).getTime();
        return aMs - bMs;
      });

    return upcoming.slice(0, max);
  }

  function getCurrentEvents(arg1, arg2) {
    let list;
    let refDate;

    if (Array.isArray(arg1)) {
      list = arg1;
      refDate = parseDate(arg2);
    } else {
      list = Object.values(EVENT_INSTANCES);
      refDate = parseDate(arg1);
    }

    const liveList = list.filter(e => getEventStatus(e, refDate) === EVENT_STATUS.LIVE);
    
    // Also include template match if template is currently live and not represented in liveList
    EVENT_TEMPLATES.forEach(tpl => {
      if (getEventStatus(tpl, refDate) === EVENT_STATUS.LIVE) {
        if (!liveList.some(e => e.templateId === tpl.id || e.id === tpl.id)) {
          const occ = getNextOccurrence(tpl, refDate);
          if (occ) liveList.push(occ);
        }
      }
    });

    return liveList;
  }

  function getLiveEvents(arg1, arg2) {
    return getCurrentEvents(arg1, arg2);
  }

  function getPastEvents(eventsList, now, limit) {
    const list = eventsList || Object.values(EVENT_INSTANCES);
    const refDate = parseDate(now);
    const max = limit || 10;

    const past = list
      .filter(e => getEventStatus(e, refDate) === EVENT_STATUS.PAST)
      .sort((a, b) => {
        const aMs = parseDate(a.endIso || a.date).getTime();
        const bMs = parseDate(b.endIso || b.date).getTime();
        return bMs - aMs;
      });

    return past.slice(0, max);
  }

  function getEventById(id) {
    if (!id) return null;
    return EVENT_INSTANCES[id] || EVENT_TEMPLATES[id] || EVENTS[id] || null;
  }

  function getEventsByPlace(placeId, now) {
    if (!placeId) return [];
    const list = Object.values(EVENT_INSTANCES).filter(e => e.placeId === placeId);
    return list;
  }

  function getLiveEventForPlace(placeId, now) {
    const live = getCurrentEvents(null, now);
    return live.find(e => e.placeId === placeId) || null;
  }

  // ============================================================
  // 4B. CANONICAL QA SEED STATE BUILDER (PHASE 0.17)
  // Baseline: LP 135, Char XP 15, Level 2 'Active Explorer',
  // Q-001, Q-002, Q-003 Completed, all 5 places unlocked.
  // ============================================================
  function createEventReadyQaState(overrides = {}) {
    const base = {
      saveStorageKey: 'koinonia.phase17.save',
      version: 1,
      communityId: 'fog',
      timestamp: new Date().toISOString(),
      saveReason: 'qa_seed_event_ready',
      activePlaceId: 'fog_center',
      spawnId: 'default',
      isPlayingGame: false,
      avatar: {
        x: 12.0,
        y: 14.8,
        dir: 'up'
      },
      lp: 135,
      charLevel: 2,
      charXp: 15,
      highestLevelReached: 2,
      levelUpHistory: [
        {
          level: 2,
          timestamp: '2026-09-06T10:30:00+08:00',
          title: 'Active Explorer',
          unlockedPerk: 'Journey Explorer Badge'
        }
      ],
      growthAreas: {
        stewardship: 15,
        responsibility: 15,
        service: 10,
        reflection: 10,
        discipline: 0,
        teamwork: 0
      },
      skills: {
        stewardship: 15,
        responsibility: 15,
        discipline: 0,
        teamwork: 0,
        service: 10,
        compassion: 0,
        reflection: 10
      },
      growthAreaRanks: {
        stewardship: 'Growing',
        responsibility: 'Growing',
        service: 'Growing',
        reflection: 'Growing',
        discipline: 'Beginning',
        teamwork: 'Beginning'
      },
      milestones: {},
      unlockedMilestones: [
        'm_first_steps',
        'm_novice_pilgrim',
        'm_gatherer',
        'm_visit_school',
        'm_visit_sports',
        'm_visit_outreach',
        'm_five_places'
      ],
      unlockedPerks: [
        'Journey Journal Started',
        'Journey Explorer Badge'
      ],
      gardenState: 'lush',
      gardenLush: true,
      gateOpen: true,
      fogCenterUnlocked: true,
      visitedFogCenter: true,
      visitedPlaces: ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'],
      firstVisitedAt: {
        home: '2026-09-06T09:00:00+08:00',
        fog_center: '2026-09-06T10:00:00+08:00',
        school: '2026-09-06T10:15:00+08:00',
        sports_hub: '2026-09-06T10:30:00+08:00',
        outreach_site: '2026-09-06T10:45:00+08:00'
      },
      visitCount: {
        home: 3,
        fog_center: 2,
        school: 1,
        sports_hub: 1,
        outreach_site: 1
      },
      unlockedPlaces: ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'],
      spokenToNpc: {
        barnaby: true,
        sister_grace: true,
        teacher_mia: true,
        coach_daniel: true,
        ate_maria: true
      },
      questStatus: 'completed',
      rewardClaimed: true,
      currentObjective: 'Explore gatherings at FOG Community Center',
      reflectionText: 'Grateful for peace, stewardship, and family.',
      audioMuted: true,
      trackedQuestId: 'Q-004',
      questProgress: {
        'Q-001': {
          status: 'COMPLETED',
          currentStepIndex: 2,
          rewardClaimed: true,
          reflectionText: 'Watered veranda plants quietly.',
          completedAt: '2026-09-06T09:30:00+08:00'
        },
        'Q-002': {
          status: 'COMPLETED',
          currentStepIndex: 2,
          rewardClaimed: true,
          reflectionText: 'Helped clean table after meal.',
          completedAt: '2026-09-06T10:00:00+08:00'
        },
        'Q-003': {
          status: 'COMPLETED',
          currentStepIndex: 2,
          rewardClaimed: true,
          reflectionText: 'Spent two quiet minutes in gratitude.',
          completedAt: '2026-09-06T10:30:00+08:00'
        },
        'Q-004': {
          status: 'AVAILABLE',
          currentStepIndex: 0,
          rewardClaimed: false,
          reflectionText: '',
          completedAt: null
        },
        'Q-005': {
          status: 'LOCKED',
          currentStepIndex: 0,
          rewardClaimed: false,
          reflectionText: '',
          completedAt: null
        }
      },
      campaignProgress: {},
      activeCampaignIds: [],
      completedCampaignIds: [],
      eventParticipation: [],
      completedEventInstances: [],
      eventsAttendedCount: 0,
      eventQuestProgress: {},
      demoNow: '2026-09-06T10:00:00+08:00'
    };

    if (overrides && typeof overrides === 'object') {
      for (const [k, v] of Object.entries(overrides)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
          base[k] = Object.assign({}, base[k], v);
        } else {
          base[k] = v;
        }
      }
    }
    return base;
  }

  // ============================================================
  // 5. GLOBAL & MODULE EXPORTS
  // ============================================================
  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.FOG_TIMEZONE = FOG_TIMEZONE;
  root.KOINONIA_DATA.FOG_TIMEZONE_OFFSET = FOG_TIMEZONE_OFFSET;
  root.KOINONIA_DATA.EVENT_STATUS = EVENT_STATUS;
  root.KOINONIA_DATA.RECURRENCE_TYPE = RECURRENCE_TYPE;
  root.KOINONIA_DATA.EVENT_CATEGORIES = EVENT_CATEGORIES;
  root.KOINONIA_DATA.eventTemplates = EVENT_TEMPLATES;
  root.KOINONIA_DATA.eventInstances = EVENT_INSTANCES;
  root.KOINONIA_DATA.events = EVENTS;
  root.KOINONIA_DATA.personalBests = PERSONAL_BESTS;

  root.KOINONIA_DATA.parseDate = parseDate;
  root.KOINONIA_DATA.getEventStatus = getEventStatus;
  root.KOINONIA_DATA.getNextOccurrence = getNextOccurrence;
  root.KOINONIA_DATA.expandRecurrence = expandRecurrence;
  root.KOINONIA_DATA.getUpcomingEvents = getUpcomingEvents;
  root.KOINONIA_DATA.getCurrentEvents = getCurrentEvents;
  root.KOINONIA_DATA.getLiveEvents = getLiveEvents;
  root.KOINONIA_DATA.getPastEvents = getPastEvents;
  root.KOINONIA_DATA.getEventById = getEventById;
  root.KOINONIA_DATA.getEventsByPlace = getEventsByPlace;
  root.KOINONIA_DATA.getLiveEventForPlace = getLiveEventForPlace;
  root.KOINONIA_DATA.createEventReadyQaState = createEventReadyQaState;

  root.KOINONIA_DATA.RECURRENCE_TYPES = RECURRENCE_TYPES;
  root.KOINONIA_DATA.getEventTemplateById = getEventTemplateById;
  root.KOINONIA_EVENTS = root.KOINONIA_DATA;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      FOG_TIMEZONE,
      FOG_TIMEZONE_OFFSET,
      EVENT_STATUS,
      RECURRENCE_TYPE,
      RECURRENCE_TYPES,
      EVENT_CATEGORIES,
      EVENT_TEMPLATES,
      EVENT_INSTANCES,
      EVENTS,
      PERSONAL_BESTS,
      getEventTemplateById,
      parseDate,
      getEventStatus,
      getNextOccurrence,
      expandRecurrence,
      getUpcomingEvents,
      getCurrentEvents,
      getLiveEvents,
      getPastEvents,
      getEventById,
      getEventsByPlace,
      getLiveEventForPlace,
      createEventReadyQaState
    };
  }
})();
