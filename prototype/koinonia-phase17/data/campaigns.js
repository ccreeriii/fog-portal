/**
 * KOINONIA — PHASE 0.17 DATA STORE: CAMPAIGNS & SERIES ENGINE
 * Architecture: Multi-chapter journeys, discipleship series, and community formation paths
 * Principle: Shared journey without shaming or ranking; no streak-punishment mechanics
 * Forward-compatible ownership: `communityId: 'fog'`
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CAMPAIGN STATUSES & CHAPTER TYPES
  // ============================================================
  const CAMPAIGN_STATUS = {
    LOCKED: 'LOCKED',
    AVAILABLE: 'AVAILABLE',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED'
  };

  const CHAPTER_TYPES = {
    SESSION: 'SESSION',
    DAY_AWAY: 'DAY_AWAY',
    DAY_EVENT: 'DAY_AWAY',
    RETREAT: 'DAY_AWAY',
    SERVICE_ACTIVITY: 'SERVICE_ACTIVITY',
    FINALE: 'FINALE'
  };

  const COMPLETION_MODES = {
    DISCUSSION_PROMPT: 'DISCUSSION_PROMPT',
    EVENT_ATTENDED: 'EVENT_ATTENDED',
    RETREAT_CHECKIN: 'RETREAT_CHECKIN',
    RETREAT_ATTENDED: 'RETREAT_CHECKIN',
    REFLECTION_JOURNAL: 'REFLECTION_JOURNAL'
  };

  const CAMPAIGN_MAP = {
    // ============================================================
    // 0. ALPHA YOUTH SERIES (CANONICAL 12-CHAPTER CAMPAIGN)
    // ============================================================
    alpha_youth_series: {
      id: 'alpha_youth_series',
      communityId: 'fog',
      title: 'Alpha Youth Series',
      subtitle: '12-Part Alpha Youth Series Journey',
      description: 'An open, welcoming series where youth explore the big questions of life, faith, and purpose together around food, film, and honest group discussion without judgment or pressure.',
      category: 'FORMATION',
      status: CAMPAIGN_STATUS.AVAILABLE,
      placeId: 'fog_center',
      audience: 'Youth (Ages 11–21)',
      icon: '❓',
      accentColor: '#EA580C',
      totalChapters: 12,
      requirements: [
        { type: 'PLACE_UNLOCKED', placeId: 'fog_center' }
      ],
      completionRules: [
        { type: 'ALL_CHAPTERS_COMPLETED' }
      ],
      questHooks: ['E-Q001', 'E-Q002', 'E-Q003'],
      eventTemplateIds: ['alpha_session_event', 'alpha_youth_day_event'],
      memoryHooks: {
        badge: 'Alpha Youth Series Graduate',
        icon: '🌟',
        verse: 'John 10:10 — "I came that they may have life and have it abundantly."'
      },
      tags: ['alpha', 'youth', 'formation', 'fellowship', 'questions'],

      chapters: [
        {
          id: 'alpha_ch01',
          campaignId: 'alpha_youth_series',
          sequence: 1,
          sequenceNumber: 1,
          aliasId: 'ays_ch_01',
          title: 'Session 1',
          shortTitle: 'Session 1',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 1',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch02',
          campaignId: 'alpha_youth_series',
          sequence: 2,
          sequenceNumber: 2,
          aliasId: 'ays_ch_02',
          title: 'Session 2',
          shortTitle: 'Session 2',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch01' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 2',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch03',
          campaignId: 'alpha_youth_series',
          sequence: 3,
          sequenceNumber: 3,
          aliasId: 'ays_ch_03',
          title: 'Session 3',
          shortTitle: 'Session 3',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch02' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 3',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch04',
          campaignId: 'alpha_youth_series',
          sequence: 4,
          sequenceNumber: 4,
          aliasId: 'ays_ch_04',
          title: 'Session 4',
          shortTitle: 'Session 4',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch03' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 4',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch05',
          campaignId: 'alpha_youth_series',
          sequence: 5,
          sequenceNumber: 5,
          aliasId: 'ays_ch_05',
          title: 'Session 5',
          shortTitle: 'Session 5',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch04' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 5',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch06',
          campaignId: 'alpha_youth_series',
          sequence: 6,
          sequenceNumber: 6,
          aliasId: 'ays_ch_06',
          title: 'Session 6',
          shortTitle: 'Session 6',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch05' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 6',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch07',
          campaignId: 'alpha_youth_series',
          sequence: 7,
          sequenceNumber: 7,
          aliasId: 'ays_ch_07',
          title: 'Session 7',
          shortTitle: 'Session 7',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch06' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 7',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch08',
          campaignId: 'alpha_youth_series',
          sequence: 8,
          sequenceNumber: 8,
          aliasId: 'ays_ch_08',
          title: 'Session 8',
          shortTitle: 'Session 8',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch07' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 8',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch09',
          campaignId: 'alpha_youth_series',
          sequence: 9,
          sequenceNumber: 9,
          aliasId: 'ays_ch_09',
          title: 'Session 9',
          shortTitle: 'Session 9',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch08' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 9',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch10',
          campaignId: 'alpha_youth_series',
          sequence: 10,
          sequenceNumber: 10,
          aliasId: 'ays_ch_10',
          title: 'Session 10',
          shortTitle: 'Session 10',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch09' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 10',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch11',
          campaignId: 'alpha_youth_series',
          sequence: 11,
          sequenceNumber: 11,
          aliasId: 'ays_ch_11',
          title: 'Session 11',
          shortTitle: 'Session 11',
          description: 'Alpha Youth Series session. Approved session details can be added later through campaign data.',
          type: CHAPTER_TYPES.SESSION,
          eventTemplateId: 'alpha_session_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch10' }],
          completionMode: COMPLETION_MODES.DISCUSSION_PROMPT,
          questHooks: ['E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Series • Session 11',
            accentColor: '#EA580C'
          }
        },
        {
          id: 'alpha_ch12',
          campaignId: 'alpha_youth_series',
          sequence: 12,
          sequenceNumber: 12,
          aliasId: 'ays_ch_12',
          title: 'Alpha Youth Day',
          shortTitle: 'Alpha Youth Day',
          description: 'A full-day Alpha Youth Series community experience.',
          type: CHAPTER_TYPES.DAY_AWAY,
          eventTemplateId: 'alpha_youth_day_event',
          requirements: [{ type: 'CHAPTER_COMPLETED', chapterId: 'alpha_ch11' }],
          completionMode: COMPLETION_MODES.RETREAT_CHECKIN,
          questHooks: ['E-Q001', 'E-Q002', 'E-Q003'],
          worldEffects: {
            banner: 'Alpha Youth Day • Community Experience',
            accentColor: '#7C3AED'
          }
        }
      ]
    },
    // ============================================================
    // 1. GET INTO THE GLORY (RECURRING COMMUNITY PRAYER & WORSHIP)
    // ============================================================
    gitg_gratitude: {
      id: 'gitg_gratitude',
      isDemo: true,
      hiddenFromPrimaryUi: true,
      communityId: 'fog',
      name: 'Get Into the Glory — Gratitude Week',
      subtitle: 'Fire of God Weekly Prayer & Fellowship Gathering',
      theme: 'GRATITUDE',
      placeId: 'fog_center',
      startDate: '2026-09-01',
      endDate: '2026-09-05',
      culminationDay: 'Friday Evening (7:00 PM)',
      description: 'A 5-day spiritual preparation journey building hearts of gratitude before our Friday night gathering.',
      overallReadiness: 79,
      readinessMetrics: [
        { category: 'Hospitality', percent: 72, icon: '☕', note: 'Snacks, welcome signs, and seating mapped' },
        { category: 'Music & Worship', percent: 85, icon: '🎵', note: 'Setlist rehearsed, charts distributed' },
        { category: 'Prayer & Intercession', percent: 67, icon: '🕯️', note: 'Pre-gathering prayer team assembled' },
        { category: 'Tech & Media', percent: 94, icon: '💻', note: 'Soundcheck complete, slides formatted' },
        { category: 'Youth Participation', percent: 78, icon: '🤝', note: 'Personal invitations and ride shares coordinated' }
      ],
      steps: [
        {
          day: 1,
          dayLabel: 'MONDAY',
          title: 'Three Quiet Blessings',
          type: 'reflection',
          prompt: 'Pause for 5 minutes and write down 3 ordinary things you are grateful for today.',
          completed: true,
          badge: 'Eyes of Faith'
        },
        {
          day: 2,
          dayLabel: 'TUESDAY',
          title: 'Say It Out Loud',
          type: 'action',
          prompt: 'Thank a family member or teacher personally—say it with your own voice or send a thoughtful text.',
          completed: true,
          badge: 'Spoken Honor'
        },
        {
          day: 3,
          dayLabel: 'WEDNESDAY',
          title: 'Quiet Unseen Service',
          type: 'service',
          prompt: 'Help someone at home, school, or church without announcing it or waiting for praise.',
          completed: false,
          badge: 'Humble Heart'
        },
        {
          day: 4,
          dayLabel: 'THURSDAY',
          title: 'Heart Preparation',
          type: 'preparation',
          prompt: 'Read Psalm 100:4 and prepare your heart to enter the gates with thanksgiving tomorrow night.',
          completed: false,
          badge: 'Open Gate'
        },
        {
          day: 5,
          dayLabel: 'FRIDAY (MAIN EVENT)',
          title: 'Get Into the Glory Gathering',
          type: 'event',
          prompt: 'Gather together in the Youth Hall for praise, prayer, testimonies, and fellowship.',
          completed: false,
          badge: 'United in Praise'
        }
      ]
    },

    // ============================================================
    // 2. ALPHA YOUTH SERIES (AYS) — PRE-EVENT CAMPAIGN
    // ============================================================
    ays_questions: {
      id: 'ays_questions',
      isDemo: true,
      hiddenFromPrimaryUi: true,
      communityId: 'fog',
      name: 'AYS — Week of Questions',
      subtitle: 'Alpha Youth Series Pre-Event Adventure',
      theme: 'CURIOSITY & HONEST DIALOGUE',
      placeId: 'fog_center',
      startDate: '2026-09-08',
      endDate: '2026-09-13',
      culminationDay: 'Saturday Afternoon (3:00 PM)',
      description: 'A 6-day relational journey helping youth reflect on deep questions about life, faith, and meaning before Alpha kicks off.',
      overallReadiness: 68,
      readinessMetrics: [
        { category: 'Host Preparation', percent: 80, icon: '🗣️', note: 'Small group facilitators confirmed' },
        { category: 'Hospitality & Snacks', percent: 65, icon: '🍕', note: 'Meal sponsorships secured' },
        { category: 'Tech & Video Screening', percent: 75, icon: '🎬', note: 'Projector and sound tested' },
        { category: 'Peer Invitations', percent: 52, icon: '💌', note: 'Personal invitations circulating' }
      ],
      steps: [
        {
          day: 1,
          dayLabel: 'MONDAY',
          title: 'The Big Question',
          type: 'reflection',
          prompt: 'What is one honest question about God, suffering, or life that you have wondered about?',
          completed: true,
          badge: 'Searcher'
        },
        {
          day: 2,
          dayLabel: 'TUESDAY',
          title: 'Ask Someone You Trust',
          type: 'conversation',
          prompt: 'Ask a parent, mentor, or friend what gives them genuine peace in hard times.',
          completed: false,
          badge: 'Courageous Ear'
        },
        {
          day: 3,
          dayLabel: 'WEDNESDAY',
          title: 'The Art of Listening',
          type: 'action',
          prompt: 'Listen to a friend for 10 minutes without interrupting, giving advice, or checking your phone.',
          completed: false,
          badge: 'Gentle Listener'
        },
        {
          day: 4,
          dayLabel: 'THURSDAY',
          title: 'Private Journaling Examen',
          type: 'reflection',
          prompt: 'Write down what you hope God might reveal to you through this Alpha journey.',
          completed: false,
          badge: 'Quiet Anchor'
        },
        {
          day: 5,
          dayLabel: 'FRIDAY',
          title: 'Reach Out & Encourage',
          type: 'invitation',
          prompt: 'Invite a classmate or friend to come sit with you at tomorrow\'s kickoff—no pressure, just friendly warmth.',
          completed: false,
          badge: 'Open Table'
        },
        {
          day: 6,
          dayLabel: 'SATURDAY (MAIN EVENT)',
          title: 'AYS Launch Gathering',
          type: 'event',
          prompt: 'Join us at the Youth Hall for games, great food, video screening, and honest small-group talks.',
          completed: false,
          badge: 'Pilgrim Companion'
        }
      ]
    }
  };

  const CAMPAIGNS = Object.values(CAMPAIGN_MAP);
  Object.assign(CAMPAIGNS, CAMPAIGN_MAP);

  // ============================================================
  // 3. HABIT / GROWTH PATHS (ZERO STREAK PUNISHMENT)
  // ============================================================
  const GROWTH_PATHS = {
    responsibility_path: {
      id: 'responsibility_path',
      communityId: 'fog',
      name: 'Responsibility Growth Path',
      tagline: 'Reliability and quiet faithfulness at home and school.',
      icon: '🪵',
      accentColor: '#C86A4B',
      currentDay: 2, // Demonstrates Day 2 active in prototype
      totalDays: 5,
      days: [
        {
          day: 1,
          title: 'Prepare Your Personal Space',
          desc: 'Make bed and clear clutter off study surfaces.',
          status: 'completed',
          dateCompleted: 'Yesterday'
        },
        {
          day: 2,
          title: 'Organize What You Need Tomorrow',
          desc: 'Pack bag, verify school schedule, and set out needed items tonight.',
          status: 'active',
          dateCompleted: null
        },
        {
          day: 3,
          title: 'Finish an Assigned Responsibility',
          desc: 'Complete an assignment or family chore without cutting corners.',
          status: 'upcoming',
          dateCompleted: null
        },
        {
          day: 4,
          title: 'Help Without Being Reminded',
          desc: 'Notice a household or classmate need and step in quietly.',
          status: 'upcoming',
          dateCompleted: null
        },
        {
          day: 5,
          title: 'Take On a Shared Task',
          desc: 'Take full responsibility for a shared space (e.g. kitchen or common room).',
          status: 'upcoming',
          dateCompleted: null
        }
      ],
      philosophy: 'Christian growth is organic like rings on a cedar tree. If a day is missed, pick up gently where you left off. No streaks lost, no shame.'
    }
  };

  // ============================================================
  // 4. HELPER FUNCTIONS
  // ============================================================
  function getCampaignById(id) {
    if (!id) return null;
    if (CAMPAIGN_MAP[id]) return CAMPAIGN_MAP[id];
    return CAMPAIGNS.find(c => c.id === id) || null;
  }

  function getCampaignsByCommunity(communityId, includeHidden = false) {
    const list = includeHidden ? CAMPAIGNS : CAMPAIGNS.filter(c => !c.hiddenFromPrimaryUi);
    if (!communityId) return list.slice();
    return list.filter(c => c.communityId === communityId);
  }

  function getCampaignsByCategory(category, includeHidden = false) {
    const list = includeHidden ? CAMPAIGNS : CAMPAIGNS.filter(c => !c.hiddenFromPrimaryUi);
    if (!category) return list.slice();
    return list.filter(c => c.category === category);
  }

  function getCampaignChapters(campaignId) {
    const campaign = getCampaignById(campaignId);
    if (!campaign || !campaign.chapters) return [];
    return campaign.chapters;
  }

  function getCampaignChapterByIndex(campaignId, index) {
    const chapters = getCampaignChapters(campaignId);
    if (!chapters || index < 0 || index >= chapters.length) return null;
    return chapters[index] || null;
  }

  function getCampaignChapterById(campaignId, chapterId) {
    const chapters = getCampaignChapters(campaignId);
    return chapters.find(ch => ch.id === chapterId || ch.aliasId === chapterId || (chapterId && ch.id.endsWith(chapterId.slice(-2)))) || null;
  }

  function getChapterById(campaignId, chapterId) {
    return getCampaignChapterById(campaignId, chapterId);
  }

  function isCampaignComplete(campaignId, completedChapterIds) {
    const chapters = getCampaignChapters(campaignId);
    if (!chapters || chapters.length === 0) return false;
    if (!Array.isArray(completedChapterIds)) return false;
    return chapters.every(ch => completedChapterIds.includes(ch.id) || (ch.aliasId && completedChapterIds.includes(ch.aliasId)));
  }

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.CAMPAIGN_STATUS = CAMPAIGN_STATUS;
  root.KOINONIA_DATA.CHAPTER_TYPES = CHAPTER_TYPES;
  root.KOINONIA_DATA.COMPLETION_MODES = COMPLETION_MODES;
  root.KOINONIA_DATA.CAMPAIGNS = CAMPAIGNS;
  root.KOINONIA_DATA.campaigns = CAMPAIGNS;
  root.KOINONIA_DATA.growthPaths = GROWTH_PATHS;
  root.KOINONIA_DATA.getCampaignById = getCampaignById;
  root.KOINONIA_DATA.getCampaignsByCommunity = getCampaignsByCommunity;
  root.KOINONIA_DATA.getCampaignsByCategory = getCampaignsByCategory;
  root.KOINONIA_DATA.getCampaignChapters = getCampaignChapters;
  root.KOINONIA_DATA.getCampaignChapterByIndex = getCampaignChapterByIndex;
  root.KOINONIA_DATA.getCampaignChapterById = getCampaignChapterById;
  root.KOINONIA_DATA.getChapterById = getChapterById;
  root.KOINONIA_DATA.isCampaignComplete = isCampaignComplete;

  root.KOINONIA_CAMPAIGNS = root.KOINONIA_DATA;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CAMPAIGN_STATUS,
      CHAPTER_TYPES,
      COMPLETION_MODES,
      CAMPAIGNS,
      GROWTH_PATHS,
      getCampaignById,
      getCampaignsByCommunity,
      getCampaignsByCategory,
      getCampaignChapters,
      getCampaignChapterByIndex,
      getCampaignChapterById,
      getChapterById,
      isCampaignComplete
    };
  }
})();
