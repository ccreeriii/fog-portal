/**
 * KOINONIA — PHASE 0.8 DATA STORE: EVENT MEMORIES & PERSONAL JOURNEY ARCHIVE
 * Architecture: Photo cards with metadata, captions, and Alex's personal community journey
 * Media Model: SQLite metadata/path abstraction with local placeholder art (no fake binary in DB)
 * Forward-compatible ownership: `communityId: 'fog'`
 */

(function () {
  'use strict';

  // Event Photo Memory Cards (Local SVG / CSS placeholders)
  const EVENT_MEMORIES = [
    {
      id: 'mem_bball_01',
      eventId: 'bball_day_2026',
      communityId: 'fog',
      title: 'Tip-Off Circle',
      caption: 'Team photo before tip-off under the morning sun.',
      uploadedBy: 'Coach Marcus',
      createdAt: '2026-09-02T10:15:00Z',
      visibility: 'community',
      bgGradient: 'linear-gradient(135deg, #C86A4B 0%, #F2B84B 100%)',
      icon: '🏀'
    },
    {
      id: 'mem_bball_02',
      eventId: 'bball_day_2026',
      communityId: 'fog',
      title: 'Fast Break Pass',
      caption: 'Jordan finding Alex for a transition three-pointer.',
      uploadedBy: 'Ate Joy',
      createdAt: '2026-09-02T10:45:00Z',
      visibility: 'community',
      bgGradient: 'linear-gradient(135deg, #2C3E55 0%, #6AA6B8 100%)',
      icon: '⚡'
    },
    {
      id: 'mem_bball_03',
      eventId: 'bball_day_2026',
      communityId: 'fog',
      title: 'Team Grace Defense',
      caption: 'Disciplined zone defense and active communication.',
      uploadedBy: 'Coach Marcus',
      createdAt: '2026-09-02T11:05:00Z',
      visibility: 'community',
      bgGradient: 'linear-gradient(135deg, #4B6B44 0%, #3E8E58 100%)',
      icon: '🛡️'
    },
    {
      id: 'mem_bball_04',
      eventId: 'bball_day_2026',
      communityId: 'fog',
      title: 'Halftime Hydration',
      caption: 'Cold water pitchers and orange slices at the bleachers.',
      uploadedBy: 'Sam',
      createdAt: '2026-09-02T11:30:00Z',
      visibility: 'community',
      bgGradient: 'linear-gradient(135deg, #FAF7F0 0%, #D49B35 100%)',
      icon: '🍊'
    },
    {
      id: 'mem_bball_05',
      eventId: 'bball_day_2026',
      communityId: 'fog',
      title: 'United Prayer Circle',
      caption: 'Both teams kneeling together at center court after the final buzzer.',
      uploadedBy: 'Pastor David',
      createdAt: '2026-09-02T12:15:00Z',
      visibility: 'community',
      bgGradient: 'linear-gradient(135deg, #4A3323 0%, #C86A4B 100%)',
      icon: '🙏'
    },
    {
      id: 'mem_bball_06',
      eventId: 'bball_day_2026',
      communityId: 'fog',
      title: 'Post-Game Fellowship Meal',
      caption: 'Hot arroz caldo and laughter shared in the Youth Hall.',
      uploadedBy: 'Ate Joy',
      createdAt: '2026-09-02T12:45:00Z',
      visibility: 'community',
      bgGradient: 'linear-gradient(135deg, #6AA6B8 0%, #4B6B44 100%)',
      icon: '🍲'
    }
  ];

  // Personal Journey Archive for Alex (2026 Pilgrimage)
  const MY_JOURNEY = {
    pilgrimName: 'Alex',
    communityId: 'fog',
    year: '2026',
    title: 'Your Journey with Fire of God Ministries',
    tagline: '"A virtual world that grows when you grow in real life."',
    statsSummary: {
      placesExplored: 5,
      questsCompleted: 8,
      campaignsParticipated: 2,
      eventsAttended: 1,
      personalBests: 4
    },
    timeline: [
      {
        month: 'September 2026',
        category: 'Domestic Stewardship',
        placeName: 'My Home',
        title: 'Awakening & The Garden Calling',
        description: 'Met Uncle Barnaby on the veranda. Completed Quest #001: Steward of the Garden by watering home plants. Unlocked the perimeter gate toward FOG Center.',
        icon: '🌱',
        badge: 'Stewardship Level 1'
      },
      {
        month: 'September 2026',
        category: 'Sports & Fitness',
        placeName: 'Sports Hub',
        title: 'FOG Youth Basketball Day & Personal Best',
        description: 'Played with Team Fire (68–62). Recognized as Top Scorer (24 pts). Set new Personal Best in Free Throws (15/20 makes). Joined center-court prayer circle.',
        icon: '🏀',
        badge: 'Team Player'
      },
      {
        month: 'September 2026',
        category: 'Spiritual Formation',
        placeName: 'FOG Community Center',
        title: 'Get Into the Glory — Gratitude Week',
        description: 'Participated in Monday & Tuesday daily build-up callings. Noticed 3 blessings and thanked a mentor. Contributed to 79% overall community readiness.',
        icon: '☀️',
        badge: 'Grateful Heart'
      },
      {
        month: 'August 2026',
        category: 'Academic Diligence',
        placeName: 'School',
        title: 'Study Area & Peer Tutoring',
        description: 'Prepared backpack the night before and completed 45-minute focused library study block without phone distractions.',
        icon: '📚',
        badge: 'Order & Diligence'
      },
      {
        month: 'August 2026',
        category: 'Community Outreach',
        placeName: 'Outreach Site',
        title: 'Barangay Hope Care Meal Packing',
        description: 'Packed hot meals and helped clean sorting stations after service.',
        icon: '🤝',
        badge: 'Quiet Service'
      }
    ],
    achievements: [
      { id: 'ach_first_step', name: 'First Step', desc: 'Completed your first real-world calling in Koinonia.', icon: '👣', unlocked: true },
      { id: 'ach_steward', name: 'True Steward', desc: 'Nurtured dry soil into fertile loam and revived a wilted plant.', icon: '🌱', unlocked: true },
      { id: 'ach_team_player', name: 'Gracious Competitor', desc: 'Competed with full effort and honored both teammates and opponents.', icon: '🏆', unlocked: true },
      { id: 'ach_pillar', name: 'Community Pillar', desc: 'Contributed XP toward the collective FOG Community Garden.', icon: '🏛️', unlocked: true },
      { id: 'ach_listener', name: 'Gentle Listener', desc: 'Engaged in meaningful questions during Alpha Youth Series.', icon: '👂', unlocked: false }
    ]
  };

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.eventMemories = EVENT_MEMORIES;
  root.KOINONIA_DATA.myJourney = MY_JOURNEY;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EVENT_MEMORIES, MY_JOURNEY };
  }
})();
