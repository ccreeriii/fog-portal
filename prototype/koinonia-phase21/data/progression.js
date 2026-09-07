/**
 * KOINONIA — PHASE 0.15 CHARACTER GROWTH & RPG PROGRESSION DATA
 * 
 * Defines Character Levels, Growth Areas (Skills), Gameplay Ranks,
 * and Achievement Milestones.
 *
 * Separation of Concerns:
 * - Life Points: Reward / participation currency
 * - Character XP: Overall game progression
 * - Character Level: RPG journey progression
 * - Skill XP: Development in specific real-life growth areas
 *
 * Core Rule: Gameplay and character progression metrics only; strictly separated from Life Points.
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CHARACTER LEVEL DEFINITIONS & THRESHOLDS
  // ============================================================
  const CHARACTER_LEVELS = [
    {
      level: 1,
      xpRequired: 0,
      title: 'New Explorer',
      description: 'Beginning your journey in home and community.',
      unlockedPerk: 'Journey Journal Started'
    },
    {
      level: 2,
      xpRequired: 10,
      title: 'Active Explorer',
      description: 'Taking faithful, consistent steps in daily duties.',
      unlockedPerk: 'Journey Explorer Badge'
    },
    {
      level: 3,
      xpRequired: 25,
      title: 'Community Adventurer',
      description: 'Deepening fellowship and service across spaces.',
      unlockedPerk: 'Community Adventure Profile Frame'
    },
    {
      level: 4,
      xpRequired: 45,
      title: 'Seasoned Adventurer',
      description: 'A reliable helper and faithful contributor.',
      unlockedPerk: 'Seasoned Explorer Badge'
    },
    {
      level: 5,
      xpRequired: 70,
      title: 'Journey Builder',
      description: 'Inspiring peers through quiet, sustained diligence.',
      unlockedPerk: 'Journey Builder Emote / Profile Accent'
    }
  ];

  function calculateLevelFromXp(xp) {
    const numXp = Math.max(0, Number(xp) || 0);
    for (let i = CHARACTER_LEVELS.length - 1; i >= 0; i--) {
      if (numXp >= CHARACTER_LEVELS[i].xpRequired) {
        return CHARACTER_LEVELS[i].level;
      }
    }
    return 1;
  }

  function getLevelDef(level) {
    const lvl = Math.max(1, Math.min(CHARACTER_LEVELS.length, Number(level) || 1));
    return CHARACTER_LEVELS.find(l => l.level === lvl) || CHARACTER_LEVELS[0];
  }

  function getCurrentLevelProgress(xp) {
    const numXp = Math.max(0, Number(xp) || 0);
    const currentLevel = calculateLevelFromXp(numXp);
    const currentDef = getLevelDef(currentLevel);
    const maxLevel = CHARACTER_LEVELS[CHARACTER_LEVELS.length - 1].level;
    const isMaxLevel = currentLevel >= maxLevel;

    const nextDef = isMaxLevel ? null : getLevelDef(currentLevel + 1);
    const currentLevelMinXp = currentDef.xpRequired;
    const nextLevelThreshold = nextDef ? nextDef.xpRequired : currentLevelMinXp;

    const xpInLevel = numXp - currentLevelMinXp;
    const xpNeededForLevel = nextDef ? (nextLevelThreshold - currentLevelMinXp) : 0;
    const xpRemaining = nextDef ? Math.max(0, nextLevelThreshold - numXp) : 0;

    let percentInLevel = 100;
    if (!isMaxLevel && xpNeededForLevel > 0) {
      percentInLevel = Math.min(100, Math.max(0, Math.round((xpInLevel / xpNeededForLevel) * 100)));
    }

    return {
      level: currentLevel,
      title: currentDef.title,
      description: currentDef.description,
      totalXp: numXp,
      currentLevelXp: currentLevelMinXp,
      nextLevelXp: nextLevelThreshold,
      xpInLevel: xpInLevel,
      xpNeededForLevel: xpNeededForLevel,
      xpRemaining: xpRemaining,
      percentInLevel: percentInLevel,
      isMaxLevel: isMaxLevel,
      unlockedPerk: currentDef.unlockedPerk,
      nextPerk: nextDef ? nextDef.unlockedPerk : null
    };
  }

  function getXpToNextLevel(xp) {
    const progress = getCurrentLevelProgress(xp);
    return progress.xpRemaining;
  }

  // ============================================================
  // 2. GROWTH AREAS (SKILLS) REGISTRY
  // ============================================================
  const GROWTH_AREAS = {
    stewardship: {
      id: 'stewardship',
      name: 'Stewardship',
      icon: '🌱',
      color: '#10B981',
      description: 'Care for home, garden, living creation, and shared physical spaces.'
    },
    responsibility: {
      id: 'responsibility',
      name: 'Responsibility',
      icon: '🏡',
      color: '#EB5F12',
      description: 'Reliability in daily duties, family honor, and trustworthy diligence.'
    },
    service: {
      id: 'service',
      name: 'Service',
      icon: '🤝',
      color: '#D97706',
      description: 'Loving unprompted assistance to household members and neighbors.'
    },
    reflection: {
      id: 'reflection',
      name: 'Reflection',
      icon: '🙏',
      color: '#881337',
      description: 'Quiet contemplation, gratitude, prayer, and peaceful stillness.'
    },
    discipline: {
      id: 'discipline',
      name: 'Discipline',
      icon: '📚',
      color: '#7C3AED',
      description: 'Orderly focus, self-control, and diligent school study.'
    },
    teamwork: {
      id: 'teamwork',
      name: 'Teamwork',
      icon: '⛪',
      color: '#2563EB',
      description: 'Community fellowship, peer encouragement, and humble cooperation.'
    }
  };

  // ============================================================
  // 3. GROWTH AREA GAMEPLAY RANKS
  // ============================================================
  const GROWTH_RANKS = [
    { minXp: 0, maxXp: 9, name: 'Beginning' },
    { minXp: 10, maxXp: 24, name: 'Growing' },
    { minXp: 25, maxXp: 49, name: 'Practicing' },
    { minXp: 50, maxXp: 99, name: 'Established' },
    { minXp: 100, maxXp: Infinity, name: 'Experienced' }
  ];

  function getGrowthRank(xp) {
    const numXp = Math.max(0, Number(xp) || 0);
    let rankIndex = 0;
    for (let i = GROWTH_RANKS.length - 1; i >= 0; i--) {
      if (numXp >= GROWTH_RANKS[i].minXp) {
        rankIndex = i;
        break;
      }
    }

    const currentRank = GROWTH_RANKS[rankIndex];
    const isMaxRank = rankIndex === GROWTH_RANKS.length - 1;
    const nextRank = isMaxRank ? null : GROWTH_RANKS[rankIndex + 1];

    const nextRankXp = nextRank ? nextRank.minXp : currentRank.minXp;
    const xpRemaining = nextRank ? Math.max(0, nextRankXp - numXp) : 0;
    const span = nextRank ? (nextRankXp - currentRank.minXp) : 1;
    const progressInRank = numXp - currentRank.minXp;
    const percent = isMaxRank ? 100 : Math.min(100, Math.max(0, Math.round((progressInRank / span) * 100)));

    return {
      rankName: currentRank.name,
      currentXp: numXp,
      minXp: currentRank.minXp,
      maxXp: currentRank.maxXp,
      nextRankName: nextRank ? nextRank.name : 'Max',
      nextRankXp: nextRankXp,
      xpRemaining: xpRemaining,
      percent: percent,
      isMaxRank: isMaxRank
    };
  }

  // ============================================================
  // 4. ACHIEVEMENT MILESTONES
  // ============================================================
  const MILESTONES = [
    // Growth Area Milestones
    {
      id: 'm_stewardship_10',
      category: 'GROWTH',
      skillId: 'stewardship',
      title: 'First Acts of Stewardship',
      description: 'Cared for living creation and domestic spaces in the physical world.',
      icon: '🌱',
      condition: { type: 'SKILL_XP', skill: 'stewardship', threshold: 10 }
    },
    {
      id: 'm_responsibility_10',
      category: 'GROWTH',
      skillId: 'responsibility',
      title: 'Dependable Helper',
      description: 'Faithfully performed household duties with diligence and honor.',
      icon: '🏡',
      condition: { type: 'SKILL_XP', skill: 'responsibility', threshold: 10 }
    },
    {
      id: 'm_service_10',
      category: 'GROWTH',
      skillId: 'service',
      title: 'Hands Ready to Help',
      description: 'Served household members and neighbors with quiet, unprompted love.',
      icon: '🤝',
      condition: { type: 'SKILL_XP', skill: 'service', threshold: 10 }
    },
    {
      id: 'm_reflection_10',
      category: 'GROWTH',
      skillId: 'reflection',
      title: 'Quiet Observer',
      description: 'Paused for intentional prayer, gratitude, and peaceful reflection.',
      icon: '🙏',
      condition: { type: 'SKILL_XP', skill: 'reflection', threshold: 10 }
    },
    {
      id: 'm_discipline_10',
      category: 'GROWTH',
      skillId: 'discipline',
      title: 'Focused Start',
      description: 'Demonstrated focused attention and diligent study without distraction.',
      icon: '📚',
      condition: { type: 'SKILL_XP', skill: 'discipline', threshold: 10 }
    },
    {
      id: 'm_teamwork_10',
      category: 'GROWTH',
      skillId: 'teamwork',
      title: 'Team Contributor',
      description: 'Encouraged peers and contributed to community fellowship.',
      icon: '⛪',
      condition: { type: 'SKILL_XP', skill: 'teamwork', threshold: 10 }
    },

    // Journey & Character Milestones
    {
      id: 'm_first_calling',
      category: 'JOURNEY',
      title: 'First Calling',
      description: 'Completed your first real-world calling in Koinonia.',
      icon: '🌟',
      condition: { type: 'QUEST_COMPLETED', questId: 'Q-001' }
    },
    {
      id: 'm_world_opens',
      category: 'JOURNEY',
      title: 'World Opens',
      description: 'Unlocked access through the South Gate to the FOG Community Center.',
      icon: '🗝️',
      condition: { type: 'PLACE_UNLOCKED', placeId: 'fog_center' }
    },
    {
      id: 'm_level_2',
      category: 'JOURNEY',
      title: 'Growing Journey',
      description: 'Reached Character Level 2 through faithful real-world diligence.',
      icon: '🚀',
      condition: { type: 'CHARACTER_LEVEL', level: 2 }
    },
    {
      id: 'm_three_callings',
      category: 'JOURNEY',
      title: 'Three Callings',
      description: 'Completed three real-world community callings.',
      icon: '📜',
      condition: { type: 'QUEST_COUNT', count: 3 }
    },
    {
      id: 'm_community_visitor',
      category: 'JOURNEY',
      title: 'Community Visitor',
      description: 'Stepped into the Fire of God Community Center for the first time.',
      icon: '⛪',
      condition: { type: 'PLACE_VISITED', placeId: 'fog_center' }
    },
    {
      id: 'm_visit_school',
      category: 'JOURNEY',
      title: 'Campus Steps',
      description: 'Stepped into the School campus for academic diligence and peer encouragement.',
      icon: '🏫',
      condition: { type: 'PLACE_VISITED', placeId: 'school' }
    },
    {
      id: 'm_visit_sports',
      category: 'JOURNEY',
      title: 'On the Field',
      description: 'Arrived at the Sports Hub ready for healthy activity, endurance, and teamwork.',
      icon: '🏀',
      condition: { type: 'PLACE_VISITED', placeId: 'sports_hub' }
    },
    {
      id: 'm_visit_outreach',
      category: 'JOURNEY',
      title: 'Hands of Compassion',
      description: 'Joined the Outreach Site to pack supplies and serve the community.',
      icon: '⛺',
      condition: { type: 'PLACE_VISITED', placeId: 'outreach_site' }
    },
    {
      id: 'm_five_places',
      category: 'JOURNEY',
      title: 'Full Community',
      description: 'Discovered and explored all five locations across Koinonia.',
      icon: '🗺️',
      condition: { type: 'PLACES_COUNT', count: 5 }
    },

    // Campaign & Event Milestones (Phase 0.17: Recognition only, 0 XP, 0 LP)
    {
      id: 'm_campaign_start',
      category: 'CAMPAIGN',
      title: 'Journey Initiated',
      description: 'Enrolled in an intentional faith formation series or community campaign.',
      icon: '🧭',
      trigger: 'CAMPAIGN_STARTED',
      condition: { type: 'CAMPAIGN_STARTED' }
    },
    {
      id: 'm_campaign_3_chapters',
      category: 'CAMPAIGN',
      title: 'Faithful Steps',
      description: 'Completed three chapters in an intentional series or campaign.',
      icon: '✨',
      trigger: 'CAMPAIGN_CHAPTERS_COUNT',
      threshold: 3,
      condition: { type: 'CAMPAIGN_CHAPTERS_COUNT', count: 3, threshold: 3 }
    },
    {
      id: 'm_campaign_complete',
      category: 'CAMPAIGN',
      title: 'Journey Completed',
      description: 'Fully finished all chapters of a community formation series.',
      icon: '🏆',
      trigger: 'CAMPAIGN_COMPLETED',
      condition: { type: 'CAMPAIGN_COMPLETED' }
    },
    {
      id: 'm_first_event_attended',
      category: 'EVENT',
      title: 'Fellowship Gathered',
      description: 'Participated in your first real-world community gathering or event.',
      icon: '🎉',
      trigger: 'EVENT_ATTENDED_COUNT',
      threshold: 1,
      condition: { type: 'EVENT_ATTENDED_COUNT', count: 1, threshold: 1 }
    },

    // Sports & Faith Quest Milestones (Phase 0.18 & 0.20.1: Recognition only, 0 XP, 0 LP)
    {
      id: 'm_first_fitquest',
      category: 'SPORTS',
      title: 'First Faith Quest',
      description: 'Completed your first sports or physical fitness challenge.',
      icon: '⚡',
      condition: { type: 'FIT_QUEST_COUNT', count: 1 }
    },
    {
      id: 'm_first_personal_best',
      category: 'SPORTS',
      title: 'First Personal Best',
      description: 'Achieved a new personal best record in a Faith Quest challenge.',
      icon: '🌟',
      condition: { type: 'PERSONAL_BEST_COUNT', count: 1 }
    },
    {
      id: 'm_three_sports_tried',
      category: 'SPORTS',
      title: 'Three Sports Tried',
      description: 'Explored three distinct sports disciplines at the Sports Hub.',
      icon: '🏅',
      condition: { type: 'SPORTS_TRIED_COUNT', count: 3 }
    },
    {
      id: 'm_team_encourager',
      category: 'SPORTS',
      title: 'Team Encourager',
      description: 'Demonstrated sportsmanship and encouraged peers during active play.',
      icon: '🤝',
      condition: { type: 'FIT_QUEST_COMPLETED', challengeId: 'FQ-R003' }
    },
    {
      id: 'm_ten_challenge_attempts',
      category: 'SPORTS',
      title: 'Ten Challenge Attempts',
      description: 'Dedicated effort across ten Faith Quest challenge attempts.',
      icon: '🔥',
      condition: { type: 'CHALLENGE_ATTEMPTS_COUNT', count: 10 }
    }
  ];

  function evaluateGrowthMilestones(state) {
    if (!state) return [];
    if (!Array.isArray(state.unlockedMilestones)) {
      state.unlockedMilestones = [];
    }
    if (!state.milestones || typeof state.milestones !== 'object') {
      state.milestones = {};
    }

    const newlyUnlocked = [];

    // Count completed quests
    let completedQuestsCount = 0;
    if (state.questProgress && typeof state.questProgress === 'object') {
      for (const qId in state.questProgress) {
        if (state.questProgress[qId]?.status === 'COMPLETED') {
          completedQuestsCount++;
        }
      }
    }

    // Count completed campaign chapters
    let completedChaptersCount = 0;
    if (state.campaignProgress && typeof state.campaignProgress === 'object') {
      for (const cId in state.campaignProgress) {
        const cp = state.campaignProgress[cId];
        if (cp && Array.isArray(cp.completedChapterIds)) {
          completedChaptersCount += cp.completedChapterIds.length;
        } else if (cp && cp.completedChapters && typeof cp.completedChapters === 'object') {
          completedChaptersCount += Object.keys(cp.completedChapters).length;
        }
      }
    }

    // Count attended events
    let eventsAttendedCount = 0;
    if (typeof state.eventsAttendedCount === 'number') {
      eventsAttendedCount = state.eventsAttendedCount;
    } else if (Array.isArray(state.completedEventInstances)) {
      eventsAttendedCount = state.completedEventInstances.length;
    } else if (Array.isArray(state.eventParticipation)) {
      eventsAttendedCount = state.eventParticipation.length;
    }

    // Count visited places
    const visitedSet = new Set(['home']);
    if (state.visitedFogCenter) visitedSet.add('fog_center');
    if (Array.isArray(state.visitedPlaces)) {
      state.visitedPlaces.forEach(pId => {
        if (typeof pId === 'string' && pId) {
          const normId = (pId === 'outreach') ? 'outreach_site' : pId;
          visitedSet.add(normId);
        }
      });
    } else if (state.visitedPlaces && typeof state.visitedPlaces === 'object') {
      for (const pId in state.visitedPlaces) {
        if (state.visitedPlaces[pId]) {
          const normId = (pId === 'outreach') ? 'outreach_site' : pId;
          visitedSet.add(normId);
        }
      }
    }

    for (const m of MILESTONES) {
      if (state.unlockedMilestones.includes(m.id)) {
        continue; // Already unlocked
      }

      const cond = m.condition;
      let satisfied = false;

      if (cond.type === 'SKILL_XP') {
        const val = (state.skills && typeof state.skills[cond.skill] === 'number') ? state.skills[cond.skill] : 0;
        satisfied = val >= cond.threshold;
      } else if (cond.type === 'CHARACTER_LEVEL') {
        const lvl = state.charLevel || calculateLevelFromXp(state.charXp || 0);
        satisfied = lvl >= cond.level;
      } else if (cond.type === 'QUEST_COMPLETED') {
        satisfied = state.questProgress && state.questProgress[cond.questId]?.status === 'COMPLETED';
      } else if (cond.type === 'QUEST_COUNT') {
        satisfied = completedQuestsCount >= cond.count;
      } else if (cond.type === 'PLACE_UNLOCKED') {
        satisfied = state.fogCenterUnlocked === true ||
                    (Array.isArray(state.unlockedPlaces) && (state.unlockedPlaces.includes(cond.placeId) || (cond.placeId === 'outreach_site' && state.unlockedPlaces.includes('outreach'))));
      } else if (cond.type === 'PLACE_VISITED') {
        satisfied = visitedSet.has(cond.placeId) ||
                    (cond.placeId === 'outreach_site' && visitedSet.has('outreach')) ||
                    (cond.placeId === 'fog_center' && state.visitedFogCenter === true);
      } else if (cond.type === 'PLACES_COUNT') {
        satisfied = visitedSet.size >= cond.count;
      } else if (cond.type === 'FLAG') {
        satisfied = state[cond.flag] === cond.value;
      } else if (cond.type === 'CAMPAIGN_STARTED') {
        const hasActive = Array.isArray(state.activeCampaignIds) && state.activeCampaignIds.length > 0;
        const hasProgress = state.campaignProgress && Object.keys(state.campaignProgress).length > 0;
        satisfied = hasActive || hasProgress;
      } else if (cond.type === 'CAMPAIGN_CHAPTERS_COUNT') {
        satisfied = completedChaptersCount >= cond.count;
      } else if (cond.type === 'CAMPAIGN_COMPLETED') {
        const completedList = Array.isArray(state.completedCampaignIds) ? state.completedCampaignIds : [];
        satisfied = cond.campaignId ? completedList.includes(cond.campaignId) : completedList.length > 0;
      } else if (cond.type === 'EVENT_ATTENDED_COUNT') {
        satisfied = eventsAttendedCount >= cond.count;
      } else if (cond.type === 'FIT_QUEST_COUNT') {
        const fqCount = state.fitQuestMetrics?.completedCount || Object.keys(state.fitQuestRewardClaims || {}).length || Object.keys(state.fitQuestResults || {}).length;
        satisfied = fqCount >= cond.count;
      } else if (cond.type === 'PERSONAL_BEST_COUNT') {
        const pbCount = state.fitQuestMetrics?.personalBestsCount || Object.keys(state.personalBests || {}).length;
        satisfied = pbCount >= cond.count;
      } else if (cond.type === 'SPORTS_TRIED_COUNT') {
        const spCount = state.fitQuestMetrics?.sportsTriedCount || (Array.isArray(state.sportsExplored) ? state.sportsExplored.length : 0);
        satisfied = spCount >= cond.count;
      } else if (cond.type === 'FIT_QUEST_COMPLETED') {
        satisfied = Boolean(state.fitQuestRewardClaims?.[cond.challengeId] || state.fitQuestResults?.[cond.challengeId]);
      } else if (cond.type === 'CHALLENGE_ATTEMPTS_COUNT') {
        const attCount = state.fitQuestMetrics?.totalAttemptsCount || (Array.isArray(state.fitQuestHistory) ? state.fitQuestHistory.length : 0);
        satisfied = attCount >= cond.count;
      }

      if (satisfied) {
        state.unlockedMilestones.push(m.id);
        state.milestones[m.id] = {
          id: m.id,
          title: m.title,
          icon: m.icon,
          unlockedAt: new Date().toISOString()
        };
        newlyUnlocked.push(m);
      }
    }

    return newlyUnlocked;
  }

  // Node module exports
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CHARACTER_LEVELS,
      characterLevels: CHARACTER_LEVELS,
      calculateLevelFromXp,
      getLevelDef,
      getCurrentLevelProgress,
      getXpToNextLevel,
      GROWTH_AREAS,
      growthAreas: GROWTH_AREAS,
      GROWTH_RANKS,
      growthRanks: GROWTH_RANKS,
      getGrowthRank,
      MILESTONES,
      milestones: MILESTONES,
      evaluateGrowthMilestones
    };
  }

  // Browser global exports
  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  if (!root.KOINONIA_DATA) root.KOINONIA_DATA = {};
  root.KOINONIA_DATA.CHARACTER_LEVELS = CHARACTER_LEVELS;
  root.KOINONIA_DATA.characterLevels = CHARACTER_LEVELS;
  root.KOINONIA_DATA.calculateLevelFromXp = calculateLevelFromXp;
  root.KOINONIA_DATA.getLevelDef = getLevelDef;
  root.KOINONIA_DATA.getCurrentLevelProgress = getCurrentLevelProgress;
  root.KOINONIA_DATA.getXpToNextLevel = getXpToNextLevel;
  root.KOINONIA_DATA.GROWTH_AREAS = GROWTH_AREAS;
  root.KOINONIA_DATA.growthAreas = GROWTH_AREAS;
  root.KOINONIA_DATA.GROWTH_RANKS = GROWTH_RANKS;
  root.KOINONIA_DATA.growthRanks = GROWTH_RANKS;
  root.KOINONIA_DATA.getGrowthRank = getGrowthRank;
  root.KOINONIA_DATA.MILESTONES = MILESTONES;
  root.KOINONIA_DATA.milestones = MILESTONES;
  root.KOINONIA_DATA.evaluateGrowthMilestones = evaluateGrowthMilestones;

})();
