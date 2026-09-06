/**
 * KOINONIA — PHASE 0.18 SPORTS & FIT QUEST DATA STORE
 * Architecture: Sports Registry, Fit Quest Challenge Catalog, Scoring Engine,
 * Personal Best Engine, Youth Fitness Safety, and QA Baseline.
 *
 * Separation of Concerns:
 * - Game Score: Mini-game reflex / timing / stamina metric (Shots, ms, Rallies)
 * - Life Points: Controlled real-world community participation currency (+5 LP on first completion only)
 * - Character XP: Overall RPG progression (+5 XP on first completion only)
 * - Growth XP: Real-life character habits (Discipline, Teamwork, Stewardship, Service)
 * - Personal Best: Recognition and achievement status ONLY (no repeat LP/XP farming)
 *
 * Target Demographic: Ages 11–21.
 * Strict Safety: NO BMI, NO calorie counting, NO body weight, NO extreme endurance.
 */

(function () {
  'use strict';

  // ============================================================
  // 1. SCORING MODES & UTILITIES
  // ============================================================
  const SCORING_MODES = {
    HIGH_SCORE: 'HIGH_SCORE',     // Higher score is better (e.g. Free Throws Made)
    LOW_TIME: 'LOW_TIME',         // Lower time is better (e.g. Reaction sprint ms)
    DISTANCE: 'DISTANCE',         // Greater distance is better
    REPETITIONS: 'REPETITIONS',   // More repetitions is better
    ACCURACY: 'ACCURACY',         // Higher percentage is better
    STREAK: 'STREAK',             // Longer continuous streak is better
    COMPLETION: 'COMPLETION'      // Done / completed (boolean or count)
  };

  const CHALLENGE_TYPES = {
    VIRTUAL_GAME: 'VIRTUAL_GAME', // Interactive canvas/reflex mini-game
    REAL_WORLD: 'REAL_WORLD',     // Real-life physical habit / movement
    HYBRID: 'HYBRID'              // Combination of virtual log + physical action
  };

  const VERIFICATION_TYPES = {
    VIRTUAL: 'VIRTUAL',           // Verified automatically by game engine
    TRUST: 'TRUST',               // Honor / trust system for youth stewardship
    PHOTO: 'PHOTO',               // Optional future photo record
    MENTOR: 'MENTOR'              // Verified by parent or leader
  };

  const MINI_GAME_TYPES = {
    BASKETBALL_FREE_THROW: 'BASKETBALL_FREE_THROW',
    REACTION_SPRINT: 'REACTION_SPRINT',
    RALLY_FOCUS: 'RALLY_FOCUS'
  };

  /**
   * Deterministic comparison: is newScore strictly better than oldScore?
   */
  function isBetterResult(arg1, arg2, arg3) {
    let mode = SCORING_MODES.HIGH_SCORE;
    let nScore = arg1;
    let oScore = arg2;

    if (typeof arg1 === 'string' && SCORING_MODES[arg1]) {
      mode = arg1;
      nScore = arg2;
      oScore = arg3;
    } else if (arg3 !== undefined) {
      mode = arg3;
    }

    if (oScore === null || oScore === undefined) return true;
    const n = Number(nScore);
    const o = Number(oScore);
    if (Number.isNaN(n) || Number.isNaN(o)) return false;

    if (mode === SCORING_MODES.LOW_TIME) {
      return n < o;
    }
    return n > o;
  }

  // ============================================================
  // 2. SPORTS REGISTRY (Belongs primarily to sports_hub)
  // ============================================================
  const SPORTS = {
    basketball: {
      id: 'basketball',
      name: 'Basketball',
      title: 'Basketball',
      icon: '🏀',
      category: 'court_sport',
      placeId: 'sports_hub',
      primaryZone: 'basketball_court',
      description: 'Dynamic half-court shooting, dribbling rhythm, and team fellowship.',
      challengeIds: ['FQ-V001', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      availableChallenges: ['FQ-V001', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      growthAreas: ['discipline', 'teamwork'],
      tags: ['court', 'ball', 'shooting', 'team']
    },
    badminton: {
      id: 'badminton',
      name: 'Badminton',
      title: 'Badminton',
      icon: '🏸',
      category: 'racket_sport',
      placeId: 'sports_hub',
      primaryZone: 'badminton_court',
      description: 'Fast reflexes, agility, and friendly rally exchanges across the net.',
      challengeIds: ['FQ-V003', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      availableChallenges: ['FQ-V003', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      growthAreas: ['discipline', 'reflection'],
      tags: ['racket', 'shuttlecock', 'reflex', 'court']
    },
    pickleball: {
      id: 'pickleball',
      name: 'Pickleball',
      title: 'Pickleball',
      icon: '🏓',
      category: 'racket_sport',
      placeId: 'sports_hub',
      primaryZone: 'pickleball_court',
      description: 'Accessible paddle sport emphasizing steady placement, control, and fun.',
      challengeIds: ['FQ-V003', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      availableChallenges: ['FQ-V003', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      growthAreas: ['discipline', 'teamwork'],
      tags: ['paddle', 'court', 'rally', 'inclusive']
    },
    running: {
      id: 'running',
      name: 'Running',
      title: 'Running',
      icon: '🏃',
      category: 'track_sport',
      placeId: 'sports_hub',
      primaryZone: 'track',
      description: 'Perimeter track sprints, endurance strides, and reaction quickness.',
      challengeIds: ['FQ-V002', 'FQ-R001', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      availableChallenges: ['FQ-V002', 'FQ-R001', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      growthAreas: ['discipline', 'responsibility'],
      tags: ['track', 'speed', 'sprint', 'endurance']
    },
    fitness: {
      id: 'fitness',
      name: 'Fitness',
      title: 'Fitness & Movement',
      icon: '🧘',
      category: 'movement_sport',
      placeId: 'sports_hub',
      primaryZone: 'fitness_zone',
      description: 'Whole-body stretching, functional strength, stamina, and active care for your body.',
      challengeIds: ['FQ-R001', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      availableChallenges: ['FQ-R001', 'FQ-R002', 'FQ-R003', 'FQ-R004'],
      growthAreas: ['stewardship', 'discipline', 'service'],
      tags: ['fitness', 'movement', 'stretching', 'health']
    }
  };

  // ============================================================
  // 3. FIT QUEST CHALLENGE CATALOG
  // ============================================================
  const CHALLENGES = {
    // ------------------------------------------------------------
    // VIRTUAL MINI-GAMES (Playable in prototype)
    // ------------------------------------------------------------
    'FQ-V001': {
      id: 'FQ-V001',
      sportId: 'basketball',
      eligibleSportIds: ['basketball'],
      title: 'Free Throw Focus',
      subtitle: 'Precision Timing & Shooting Rhythm',
      description: 'Practice focused shooting rhythm from the free throw line. Tap when the shooting meter aligns with the sweet spot.',
      challengeType: CHALLENGE_TYPES.VIRTUAL_GAME,
      miniGameType: MINI_GAME_TYPES.BASKETBALL_FREE_THROW,
      scoringMode: SCORING_MODES.HIGH_SCORE,
      verificationType: VERIFICATION_TYPES.VIRTUAL,
      difficulty: 'EASY',
      duration: '1-2 min',
      instructions: 'Tap or press SPACE when the moving timing meter is within the green target zone. You get 10 shot attempts!',
      personalBestMetric: 'Shots Made',
      metric: 'shots',
      unit: 'shots',
      maxScore: 10,
      leaderboardEligible: true,
      shareEligible: true,
      rewards: {
        lifePoints: 5,
        charXp: 5
      },
      growthRewards: {
        discipline: 5,
        teamwork: 5
      },
      tags: ['basketball', 'accuracy', 'timing', 'virtual']
    },

    'FQ-V002': {
      id: 'FQ-V002',
      sportId: 'running',
      eligibleSportIds: ['running'],
      title: 'Reaction Sprint',
      subtitle: 'Reflex Quickness & Start Reaction',
      description: 'Test your sprint start reactions. Wait patiently for the green GO signal, then tap as fast as humanly possible! False starts incur a reset.',
      challengeType: CHALLENGE_TYPES.VIRTUAL_GAME,
      miniGameType: MINI_GAME_TYPES.REACTION_SPRINT,
      scoringMode: SCORING_MODES.LOW_TIME,
      verificationType: VERIFICATION_TYPES.VIRTUAL,
      difficulty: 'MEDIUM',
      duration: '30 sec',
      instructions: 'Get ready... Wait for the screen to turn GREEN with "GO!" then tap immediately. Do not tap too early!',
      personalBestMetric: 'Reaction Time',
      metric: 'time',
      unit: 'ms',
      leaderboardEligible: true,
      shareEligible: true,
      rewards: {
        lifePoints: 5,
        charXp: 5
      },
      growthRewards: {
        discipline: 5,
        responsibility: 5
      },
      tags: ['running', 'reflex', 'speed', 'virtual']
    },

    'FQ-V003': {
      id: 'FQ-V003',
      sportId: 'badminton',
      eligibleSportIds: ['badminton', 'pickleball'],
      title: 'Rally Focus',
      subtitle: 'Racket Reflex & Rhythm Streak',
      description: 'Keep the shuttlecock/ball in play! Tap when the incoming shot enters the strike target zone to maintain the longest rally streak.',
      challengeType: CHALLENGE_TYPES.VIRTUAL_GAME,
      miniGameType: MINI_GAME_TYPES.RALLY_FOCUS,
      scoringMode: SCORING_MODES.STREAK,
      verificationType: VERIFICATION_TYPES.VIRTUAL,
      difficulty: 'MEDIUM',
      duration: '1-2 min',
      instructions: 'Tap or press SPACE right as the ball/shuttle enters the strike zone. Keep the rally alive!',
      personalBestMetric: 'Rally Streak',
      metric: 'rallies',
      unit: 'rallies',
      leaderboardEligible: true,
      shareEligible: true,
      rewards: {
        lifePoints: 5,
        charXp: 5
      },
      growthRewards: {
        discipline: 5,
        teamwork: 5
      },
      tags: ['badminton', 'pickleball', 'reflex', 'streak', 'virtual']
    },

    // ------------------------------------------------------------
    // REAL-WORLD FIT QUESTS (Honor / Trust Verification)
    // ------------------------------------------------------------
    'FQ-R001': {
      id: 'FQ-R001',
      sportId: 'fitness',
      eligibleSportIds: ['fitness', 'running'],
      title: '10-Minute Movement',
      subtitle: 'Daily Physical Stewardship',
      description: 'Do ten minutes of age-appropriate physical activity: brisk walking, light stretching, jump rope, or active outdoor play.',
      challengeType: CHALLENGE_TYPES.REAL_WORLD,
      scoringMode: SCORING_MODES.COMPLETION,
      verificationType: VERIFICATION_TYPES.TRUST,
      difficulty: 'EASY',
      duration: '10 min',
      instructions: 'Step outside or find open space. Move intentionally for 10 minutes. Choose an activity appropriate for you.',
      safetyNotice: 'Choose an activity appropriate for you. Rest, skip, or try another activity anytime without penalty.',
      personalBestMetric: 'Sessions Completed',
      metric: 'completion',
      unit: 'session',
      leaderboardEligible: false,
      shareEligible: true,
      rewards: {
        lifePoints: 5,
        charXp: 5
      },
      growthRewards: {
        discipline: 5,
        stewardship: 5
      },
      tags: ['movement', 'health', 'real-world', 'stewardship']
    },

    'FQ-R002': {
      id: 'FQ-R002',
      sportId: 'basketball',
      eligibleSportIds: ['basketball', 'badminton', 'pickleball', 'running', 'fitness'],
      title: 'Practice With Purpose',
      subtitle: 'Skill Drills & Diligent Effort',
      description: 'Complete a short skill drill in basketball, badminton, pickleball, running, or fitness practice.',
      challengeType: CHALLENGE_TYPES.REAL_WORLD,
      scoringMode: SCORING_MODES.COMPLETION,
      verificationType: VERIFICATION_TYPES.TRUST,
      difficulty: 'EASY',
      duration: '15 min',
      instructions: 'Pick one specific skill (free throws, footwork, racket swings, sprint strides, or core movement) and practice with focus.',
      safetyNotice: 'Listen to your body. Moderate effort. Rest as needed.',
      personalBestMetric: 'Practices Logged',
      metric: 'completion',
      unit: 'session',
      leaderboardEligible: false,
      shareEligible: true,
      rewards: {
        lifePoints: 5,
        charXp: 5
      },
      growthRewards: {
        discipline: 5,
        responsibility: 5
      },
      tags: ['practice', 'skills', 'real-world', 'discipline']
    },

    'FQ-R003': {
      id: 'FQ-R003',
      sportId: 'fitness',
      eligibleSportIds: ['basketball', 'badminton', 'pickleball', 'running', 'fitness'],
      title: 'Team Encourager',
      subtitle: 'Sportsmanship & Fellowship',
      description: 'During a sport, game, or physical activity, actively encourage or assist another participant with uplifting words.',
      challengeType: CHALLENGE_TYPES.REAL_WORLD,
      scoringMode: SCORING_MODES.COMPLETION,
      verificationType: VERIFICATION_TYPES.TRUST,
      difficulty: 'EASY',
      duration: 'Flexible',
      instructions: 'Offer sincere encouragement: "Great hustle!", "Good pass!", or help a friend carry or pack sports gear.',
      safetyNotice: 'Focus on kindness, peer encouragement, and humble sportsmanship.',
      personalBestMetric: 'Encouragements Shared',
      metric: 'completion',
      unit: 'act',
      leaderboardEligible: false,
      shareEligible: true,
      rewards: {
        lifePoints: 5,
        charXp: 5
      },
      growthRewards: {
        teamwork: 10,
        service: 5
      },
      tags: ['sportsmanship', 'teamwork', 'encouragement', 'real-world']
    },

    'FQ-R004': {
      id: 'FQ-R004',
      sportId: 'running',
      eligibleSportIds: ['basketball', 'badminton', 'pickleball', 'running', 'fitness'],
      title: 'Personal Best Attempt',
      subtitle: 'Self-Improvement & Diligence',
      description: 'Attempt to improve your personal best in an activity you choose: distance, speed, shots made, or rally count.',
      challengeType: CHALLENGE_TYPES.REAL_WORLD,
      scoringMode: SCORING_MODES.COMPLETION,
      verificationType: VERIFICATION_TYPES.TRUST,
      difficulty: 'MEDIUM',
      duration: '10-20 min',
      instructions: 'Track your attempt honestly. Even if you do not beat your previous record, diligent effort is what matters.',
      safetyNotice: 'Never push past pain or exhaustion. Physical growth is built on gradual, faithful consistency.',
      personalBestMetric: 'Attempts Logged',
      metric: 'completion',
      unit: 'attempt',
      leaderboardEligible: false,
      shareEligible: true,
      rewards: {
        lifePoints: 5,
        charXp: 5
      },
      growthRewards: {
        discipline: 5,
        stewardship: 5
      },
      tags: ['personal-best', 'discipline', 'real-world']
    }
  };

  const MAX_HISTORY_LENGTH = 100;

  // ============================================================
  // 4. PERSONAL BEST ENGINE & RESULT RECORDING
  // ============================================================

  function getPersonalBest(state, challengeId) {
    if (!state || !state.personalBests || typeof state.personalBests !== 'object') return null;
    return state.personalBests[challengeId] || null;
  }

  function getChallengeHistory(state, challengeId = null) {
    if (!state || !Array.isArray(state.fitQuestHistory)) return [];
    if (!challengeId) return [...state.fitQuestHistory];
    return state.fitQuestHistory.filter(r => r.challengeId === challengeId);
  }

  /**
   * Main Result Recorder:
   * Records challenge attempt, evaluates PB, applies controlled RPG rewards (first-time only),
   * updates history and metrics, and returns structured result.
   */
  function recordChallengeResult(state, challengeId, score, arg4, arg5) {
    if (!state) throw new Error('State object required');
    const challenge = CHALLENGES[challengeId];
    if (!challenge) throw new Error(`Unknown challengeId: ${challengeId}`);

    // Parse flexible arguments
    let scoreDisplayOverride = null;
    let options = {};

    if (typeof arg4 === 'object' && arg4 !== null) {
      options = arg4;
      if (options.scoreDisplay) scoreDisplayOverride = options.scoreDisplay;
    } else if (typeof arg4 === 'string' || typeof arg4 === 'number') {
      scoreDisplayOverride = String(arg4);
      if (typeof arg5 === 'object' && arg5 !== null) {
        options = arg5;
      }
    }

    // Ensure state collections exist
    if (!state.fitQuestResults || typeof state.fitQuestResults !== 'object') state.fitQuestResults = {};
    if (!Array.isArray(state.fitQuestHistory)) state.fitQuestHistory = [];
    if (!state.personalBests || typeof state.personalBests !== 'object') state.personalBests = {};
    if (!state.fitQuestRewardClaims || typeof state.fitQuestRewardClaims !== 'object') state.fitQuestRewardClaims = {};
    if (!Array.isArray(state.sportsExplored)) state.sportsExplored = [];
    if (!state.fitQuestMetrics || typeof state.fitQuestMetrics !== 'object') {
      state.fitQuestMetrics = {
        completedCount: 0,
        personalBestsCount: 0,
        totalAttemptsCount: 0,
        sportsTriedCount: 0
      };
    }

    // Determine actual sport attribution
    let actualSportId = challenge.sportId; // Default fallback
    const candidateSportId = options.sportId || (options.context && options.context.sportId);
    if (candidateSportId && Array.isArray(challenge.eligibleSportIds)) {
      if (challenge.eligibleSportIds.includes(candidateSportId)) {
        actualSportId = candidateSportId;
      }
    }

    const currentPB = state.personalBests[challengeId] || null;
    const previousScore = currentPB ? currentPB.score : null;
    const isPB = isBetterResult(score, previousScore, challenge.scoringMode);

    const completedAt = options.timestamp || new Date().toISOString();
    const resultId = `fq_res_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Build scoreDisplay
    let scoreDisplay = scoreDisplayOverride;
    if (!scoreDisplay) {
      scoreDisplay = `${score} ${challenge.unit}`;
      if (challenge.scoringMode === SCORING_MODES.HIGH_SCORE && challenge.maxScore) {
        scoreDisplay = `${score}/${challenge.maxScore} ${challenge.unit}`;
      } else if (challenge.scoringMode === SCORING_MODES.LOW_TIME) {
        scoreDisplay = `${score} ms`;
      }
    }

    const sharePayload = {
      title: `KOINONIA Fit Quest — ${challenge.title}`,
      text: `KOINONIA Fit Quest — ${challenge.title}\nScore: ${scoreDisplay}${isPB ? '\n🌟 New Personal Best!' : ''}\n"A virtual world that grows when you grow in real life."`,
      challengeName: challenge.title,
      scoreText: scoreDisplay,
      isPersonalBest: isPB
    };

    // Reward Safety: Controlled first-time RPG rewards ONLY
    let rewardClaimed = false;
    let rewardDetails = null;

    if (!state.fitQuestRewardClaims[challengeId]) {
      // First completion reward
      const lpReward = challenge.rewards?.lifePoints || 5;
      const xpReward = challenge.rewards?.charXp || 5;

      state.lp = (state.lp || 0) + lpReward;
      state.charXp = (state.charXp || 0) + xpReward;

      // Apply Growth Areas rewards
      if (challenge.growthRewards && typeof challenge.growthRewards === 'object') {
        state.growthAreas = state.growthAreas || {};
        state.skills = state.skills || {};
        for (const [area, amt] of Object.entries(challenge.growthRewards)) {
          state.growthAreas[area] = (state.growthAreas[area] || 0) + amt;
          state.skills[area] = (state.skills[area] || 0) + amt;
        }
      }

      state.fitQuestRewardClaims[challengeId] = true;
      state.fitQuestMetrics.completedCount = (state.fitQuestMetrics.completedCount || 0) + 1;
      rewardClaimed = true;
      rewardDetails = {
        lifePoints: lpReward,
        charXp: xpReward,
        growthRewards: challenge.growthRewards || {}
      };
    }

    // Update Sports Explored using the ACTUAL sport performed
    if (!state.sportsExplored.includes(actualSportId)) {
      state.sportsExplored.push(actualSportId);
    }
    state.fitQuestMetrics.sportsTriedCount = state.sportsExplored.length;

    // Calculate total attempts for this challenge
    const pastAttemptsForChallenge = state.fitQuestHistory.filter(h => h.challengeId === challengeId).length;
    const attemptNumber = pastAttemptsForChallenge + 1;

    const resultRecord = {
      resultId,
      challengeId,
      sportId: actualSportId,
      actualSportId: actualSportId,
      eligibleSportIds: challenge.eligibleSportIds || [challenge.sportId],
      challengeTitle: challenge.title,
      score: Number(score),
      scoreDisplay,
      metric: challenge.metric,
      unit: challenge.unit,
      scoringMode: challenge.scoringMode,
      completedAt,
      attemptNumber,
      isPersonalBest: isPB,
      previousPersonalBest: previousScore,
      verificationType: challenge.verificationType,
      rewardClaimed,
      rewardsAwarded: rewardClaimed,
      rewardDetails,
      sharePayload
    };

    // Update Personal Best if strictly better
    if (isPB) {
      state.personalBests[challengeId] = resultRecord;
      state.fitQuestMetrics.personalBestsCount = Object.keys(state.personalBests).length;
    }

    // Save latest result in results map
    state.fitQuestResults[challengeId] = resultRecord;

    // Add to history (capped at MAX_HISTORY_LENGTH)
    state.fitQuestHistory.unshift(resultRecord);
    if (state.fitQuestHistory.length > MAX_HISTORY_LENGTH) {
      state.fitQuestHistory = state.fitQuestHistory.slice(0, MAX_HISTORY_LENGTH);
    }

    state.fitQuestMetrics.totalAttemptsCount = (state.fitQuestMetrics.totalAttemptsCount || 0) + 1;

    // Trigger milestone evaluation if progression engine available
    const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null);
    const progressionModule = (root && root.KOINONIA_DATA && root.KOINONIA_DATA.evaluateGrowthMilestones)
      ? root.KOINONIA_DATA
      : (typeof require !== 'undefined' ? require('./progression.js') : null);

    if (progressionModule && typeof progressionModule.evaluateGrowthMilestones === 'function') {
      progressionModule.evaluateGrowthMilestones(state);
    }

    return resultRecord;
  }

  // ============================================================
  // 5. PROTOTYPE LOCAL LEADERBOARD (SAMPLE / DEMO ONLY)
  // ============================================================
  const PROTOTYPE_LEADERBOARDS = {
    'FQ-V001': [
      { rank: 1, name: 'Team Spark', label: 'DEMO', score: 9, scoreDisplay: '9/10 shots' },
      { rank: 2, name: 'Court Pioneer', label: 'DEMO', score: 8, scoreDisplay: '8/10 shots' },
      { rank: 3, name: 'Fellowship Shooter', label: 'DEMO', score: 7, scoreDisplay: '7/10 shots' },
      { rank: 4, name: 'Steady Rhythm', label: 'DEMO', score: 6, scoreDisplay: '6/10 shots' }
    ],
    'FQ-V002': [
      { rank: 1, name: 'Fast Track', label: 'DEMO', score: 220, scoreDisplay: '220 ms' },
      { rank: 2, name: 'Quick Step', label: 'DEMO', score: 245, scoreDisplay: '245 ms' },
      { rank: 3, name: 'Sprint Cadet', label: 'DEMO', score: 268, scoreDisplay: '268 ms' },
      { rank: 4, name: 'Morning Runner', label: 'DEMO', score: 290, scoreDisplay: '290 ms' }
    ],
    'FQ-V003': [
      { rank: 1, name: 'Shuttle Master', label: 'DEMO', score: 24, scoreDisplay: '24 rallies' },
      { rank: 2, name: 'Racket Rhythm', label: 'DEMO', score: 19, scoreDisplay: '19 rallies' },
      { rank: 3, name: 'Net Guardian', label: 'DEMO', score: 15, scoreDisplay: '15 rallies' },
      { rank: 4, name: 'Court Partner', label: 'DEMO', score: 12, scoreDisplay: '12 rallies' }
    ]
  };

  /**
   * Generates a blended prototype leaderboard with demo data + local player's PB.
   */
  function getPrototypeLeaderboard(state, challengeId) {
    const challenge = CHALLENGES[challengeId];
    if (!challenge) return [];
    const baseList = (PROTOTYPE_LEADERBOARDS[challengeId] || []).map(entry => ({ ...entry }));

    const localPB = getPersonalBest(state, challengeId);
    if (localPB) {
      baseList.push({
        rank: 0,
        name: 'You (Local Player)',
        label: 'LOCAL',
        isLocalPlayer: true,
        score: localPB.score,
        scoreDisplay: localPB.scoreDisplay
      });
    }

    // Sort according to scoring mode
    if (challenge.scoringMode === SCORING_MODES.LOW_TIME) {
      baseList.sort((a, b) => a.score - b.score);
    } else {
      baseList.sort((a, b) => b.score - a.score);
    }

    // Reassign ranks 1..N
    baseList.forEach((item, idx) => {
      item.rank = idx + 1;
    });

    return baseList;
  }

  // ============================================================
  // 6. CANONICAL FIT-QUEST-READY QA STATE BUILDER (PHASE 0.18)
  // ============================================================
  /**
   * Builds the canonical QA state for Phase 0.18:
   * 135 LP, 15 XP, Level 2 'Active Explorer',
   * Q-001, Q-002, Q-003 Completed, all 5 places unlocked,
   * Sports Hub immediately accessible and visited.
   */
  function createFitQuestReadyQaState(overrides = {}) {
    // Prefer composition from Phase 0.17 canonical state builder
    let base = null;
    const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null);

    if (root && root.KOINONIA_DATA && typeof root.KOINONIA_DATA.createEventReadyQaState === 'function') {
      base = root.KOINONIA_DATA.createEventReadyQaState();
    } else if (typeof require !== 'undefined') {
      try {
        const eventsMod = require('./events.js');
        if (eventsMod && typeof eventsMod.createEventReadyQaState === 'function') {
          base = eventsMod.createEventReadyQaState();
        }
      } catch (e) {}
    }

    if (!base) {
      // Fallback matching accepted Phase 0.17 baseline exactly
      base = {
        saveStorageKey: 'koinonia.phase17.save',
        version: 1,
        communityId: 'fog',
        timestamp: new Date().toISOString(),
        activePlaceId: 'fog_center',
        spawnId: 'default',
        isPlayingGame: false,
        avatar: { x: 12.0, y: 14.8, dir: 'up' },
        lp: 135,
        charLevel: 2,
        charXp: 15,
        highestLevelReached: 2,
        levelUpHistory: [{ level: 2, timestamp: '2026-09-06T10:30:00+08:00', title: 'Active Explorer', unlockedPerk: 'Journey Explorer Badge' }],
        growthAreas: { stewardship: 15, responsibility: 15, service: 10, reflection: 10, discipline: 0, teamwork: 0 },
        skills: { stewardship: 15, responsibility: 15, discipline: 0, teamwork: 0, service: 10, compassion: 0, reflection: 10 },
        growthAreaRanks: { stewardship: 'Growing', responsibility: 'Growing', service: 'Growing', reflection: 'Growing', discipline: 'Beginning', teamwork: 'Beginning' },
        milestones: {},
        unlockedMilestones: ['m_first_steps', 'm_novice_pilgrim', 'm_gatherer', 'm_visit_school', 'm_visit_sports', 'm_visit_outreach', 'm_five_places'],
        unlockedPerks: ['Journey Journal Started', 'Journey Explorer Badge'],
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
        visitCount: { home: 3, fog_center: 2, school: 1, sports_hub: 1, outreach_site: 1 },
        unlockedPlaces: ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'],
        spokenToNpc: { barnaby: true, sister_grace: true, teacher_mia: true, coach_daniel: true, ate_maria: true },
        questStatus: 'completed',
        rewardClaimed: true,
        currentObjective: 'Practice fitness, sportsmanship, and teamwork at Sports Hub',
        reflectionText: 'Grateful for health, fellowship, and intentional physical stewardship.',
        audioMuted: true,
        trackedQuestId: 'Q-004',
        questProgress: {
          'Q-001': { status: 'COMPLETED', currentStepIndex: 2, rewardClaimed: true, reflectionText: 'Watered veranda plants quietly.', completedAt: '2026-09-06T09:30:00+08:00' },
          'Q-002': { status: 'COMPLETED', currentStepIndex: 2, rewardClaimed: true, reflectionText: 'Helped clean table after meal.', completedAt: '2026-09-06T10:00:00+08:00' },
          'Q-003': { status: 'COMPLETED', currentStepIndex: 2, rewardClaimed: true, reflectionText: 'Spent two quiet minutes in gratitude.', completedAt: '2026-09-06T10:30:00+08:00' },
          'Q-004': { status: 'AVAILABLE', currentStepIndex: 0, rewardClaimed: false, reflectionText: '', completedAt: null },
          'Q-005': { status: 'LOCKED', currentStepIndex: 0, rewardClaimed: false, reflectionText: '', completedAt: null }
        },
        campaignProgress: {},
        activeCampaignIds: [],
        completedCampaignIds: [],
        eventParticipation: [],
        completedEventInstances: [],
        eventsAttendedCount: 0,
        eventQuestProgress: {},
        demoNow: null
      };
    }

    // Deep-clone base to isolate mutations
    base = JSON.parse(JSON.stringify(base));

    // Phase 0.18 overrides and additions
    base.saveStorageKey = 'koinonia.phase18.save';
    base.version = 1;
    base.saveReason = 'qa_seed_fitquest_ready';
    base.activePlaceId = 'sports_hub';
    base.spawnId = 'default';
    base.avatar = { x: 12.0, y: 14.5, dir: 'up' };
    base.currentObjective = 'Practice fitness, sportsmanship, and teamwork at Sports Hub';

    // Ensure sports_hub is in visitedPlaces and unlockedPlaces
    if (!base.visitedPlaces.includes('sports_hub')) {
      base.visitedPlaces.push('sports_hub');
    }
    if (!base.unlockedPlaces.includes('sports_hub')) {
      base.unlockedPlaces.push('sports_hub');
    }

    // Explicit accepted Growth Area Baseline: Discipline: 0, Teamwork: 0
    base.growthAreas = base.growthAreas || {};
    base.growthAreas.discipline = 0;
    base.growthAreas.teamwork = 0;
    base.growthAreas.stewardship = 15;
    base.growthAreas.responsibility = 15;
    base.growthAreas.service = 10;
    base.growthAreas.reflection = 10;

    base.skills = base.skills || {};
    base.skills.discipline = 0;
    base.skills.teamwork = 0;
    base.skills.stewardship = 15;
    base.skills.responsibility = 15;
    base.skills.service = 10;
    base.skills.reflection = 10;
    base.skills.compassion = 0;

    base.growthAreaRanks = base.growthAreaRanks || {};
    base.growthAreaRanks.stewardship = 'Growing';
    base.growthAreaRanks.responsibility = 'Growing';
    base.growthAreaRanks.service = 'Growing';
    base.growthAreaRanks.reflection = 'Growing';
    base.growthAreaRanks.discipline = 'Beginning';
    base.growthAreaRanks.teamwork = 'Beginning';

    // Explicit Phase 0.17 Campaign baseline: No automatically active campaign
    base.campaignProgress = {};
    base.activeCampaignIds = [];
    base.completedCampaignIds = [];

    // Phase 0.18 Fit Quest & Sports State: STRICTLY EMPTY at QA baseline
    base.fitQuestResults = {};
    base.fitQuestHistory = [];
    base.personalBests = {};
    base.fitQuestRewardClaims = {};
    base.sportsExplored = [];
    base.fitQuestMetrics = {
      completedCount: 0,
      personalBestsCount: 0,
      totalAttemptsCount: 0,
      sportsTriedCount: 0
    };
    base.selectedChallengeId = 'FQ-V001';

    // Apply custom overrides
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

  // Exports for Node & Browser
  const api = {
    SCORING_MODES,
    CHALLENGE_TYPES,
    VERIFICATION_TYPES,
    MINI_GAME_TYPES,
    isBetterResult,
    SPORTS,
    CHALLENGES,
    getPersonalBest,
    getChallengeHistory,
    recordChallengeResult,
    PROTOTYPE_LEADERBOARDS,
    getPrototypeLeaderboard,
    createFitQuestReadyQaState,
    MAX_HISTORY_LENGTH
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  if (!root.KOINONIA_DATA) root.KOINONIA_DATA = {};
  Object.assign(root.KOINONIA_DATA, api);

})();
