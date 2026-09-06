/**
 * KOINONIA — PHASE 0.8 DATA STORE: EVENTS & SPORTS PERSONAL BESTS
 * Architecture: Event records, friendly non-violent sports competition, and Personal Best tracking
 * Forward-compatible ownership: `communityId: 'fog'`
 */

(function () {
  'use strict';

  const EVENTS = {
    bball_day_2026: {
      id: 'bball_day_2026',
      communityId: 'fog',
      name: 'FOG Youth Basketball Day',
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

  // Personal Best System ("Compete with Yourself")
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

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  root.KOINONIA_DATA = root.KOINONIA_DATA || {};
  root.KOINONIA_DATA.events = EVENTS;
  root.KOINONIA_DATA.personalBests = PERSONAL_BESTS;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EVENTS, PERSONAL_BESTS };
  }
})();
