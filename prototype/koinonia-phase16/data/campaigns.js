/**
 * KOINONIA — PHASE 0.8 DATA STORE: CAMPAIGNS & GROWTH PATHS
 * Architecture: Thematic journeys, collective readiness, and habit formation paths
 * Principle: Shared readiness without shaming or ranking; no streak-punishment mechanics
 * Forward-compatible ownership: `communityId: 'fog'`
 */

(function () {
  'use strict';

  const CAMPAIGNS = {
    // ============================================================
    // 1. GET INTO THE GLORY (RECURRING COMMUNITY PRAYER & WORSHIP)
    // ============================================================
    gitg_gratitude: {
      id: 'gitg_gratitude',
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

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.campaigns = CAMPAIGNS;
  root.KOINONIA_DATA.growthPaths = GROWTH_PATHS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CAMPAIGNS, GROWTH_PATHS };
  }
})();
