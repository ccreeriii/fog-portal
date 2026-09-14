/**
 * KOINONIA — PHASE 0.20.1
 * CAMPFIRE UNIFICATION & GAMEPLAY MODULE
 *
 * Canonical Architecture:
 * - A Campfire owns: identity, name, leaderIds, memberIds, maxParticipants, status.
 * - CampfireGameState references campfireId (assignedQuestIds, completedQuestIds, reactions, activityLog).
 * - There is ONE membership roster, maintained in the Campfire entity.
 * - Quest gameplay does NOT create a separate independent group roster.
 *
 * Safety & Limits:
 * - Minimum activation: 5 members
 * - Default maximum: 12 members
 * - Community maximum: configurable by Admin (default 12)
 * - Leader can configure max between 5 and community maximum
 * - Member cannot modify capacity
 * - Active campfire max cannot be lowered below current member count
 * - Progress denominator = current member count (not max capacity)
 * - Predefined structured reactions only (👏, 🙏, 🔥, 🌱, ❤️)
 * - No free-text minor chat
 */

(function(root) {
  'use strict';

  // Canonical Statuses
  const CAMPFIRE_STATUSES = {
    DRAFT: 'DRAFT',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED'
  };

  const CAMPFIRE_ROLES = {
    LEADER: 'LEADER',
    MEMBER: 'MEMBER'
  };

  const MIN_PARTICIPANTS = 5;
  const DEFAULT_MAX_PARTICIPANTS = 12;
  const DEFAULT_COMMUNITY_MAX_PARTICIPANTS = 12;

  const CANONICAL_REACTIONS = {
    '👏': { id: 'ENCOURAGE', emoji: '👏', label: 'Encourage' },
    '🙏': { id: 'PRAYING', emoji: '🙏', label: 'Praying' },
    '🔥': { id: 'KEEP_GOING', emoji: '🔥', label: 'Keep Going' },
    '🌱': { id: 'GROWING_TOGETHER', emoji: '🌱', label: 'Growing Together' },
    '❤️': { id: 'GREAT_JOB', emoji: '❤️', label: 'Great Job' }
  };

  /**
   * Canonical Campfire Entity Factory
   * Owns identity and authoritative membership.
   */
  function createCampfire(data = {}) {
    const leaderIds = Array.isArray(data.leaderIds) ? [...data.leaderIds] : (data.leaderId ? [data.leaderId] : []);
    const memberIds = Array.isArray(data.memberIds) ? [...data.memberIds] : [...leaderIds];
    const maxParticipants = typeof data.maxParticipants === 'number' ? data.maxParticipants : DEFAULT_MAX_PARTICIPANTS;
    const status = memberIds.length >= MIN_PARTICIPANTS ? CAMPFIRE_STATUSES.ACTIVE : CAMPFIRE_STATUSES.DRAFT;

    return {
      id: data.id || ('cf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
      communityId: data.communityId || 'fog',
      name: data.name || 'New Youth Campfire',
      description: data.description || 'A fellowship circle walking together in faith.',
      leaderIds,
      memberIds,
      maxParticipants,
      status: data.status || status,
      createdAt: data.createdAt || new Date().toISOString(),
      meetingSchedule: data.meetingSchedule || 'Saturday 4:00 PM',
      venue: data.venue || 'Youth Hall / Campfire Grounds'
    };
  }

  /**
   * Canonical Campfire Game State Factory
   * References campfireId without duplicating membership.
   */
  function createCampfireGameState(data = {}) {
    if (!data.campfireId) {
      throw new Error('CampfireGameState requires a valid campfireId reference.');
    }

    return {
      campfireId: data.campfireId,
      assignedQuestIds: Array.isArray(data.assignedQuestIds) ? [...data.assignedQuestIds] : [],
      completedQuestIds: Array.isArray(data.completedQuestIds) ? [...data.completedQuestIds] : [],
      reactions: data.reactions ? { ...data.reactions } : { '👏': 0, '🙏': 0, '🔥': 0, '🌱': 0, '❤️': 0 },
      activityLog: Array.isArray(data.activityLog) ? [...data.activityLog] : []
    };
  }

  /**
   * Validate Capacity Setting against Community Maximum and Active Membership
   */
  function validateCampfireCapacity(newMax, campfire, communityMax = DEFAULT_COMMUNITY_MAX_PARTICIPANTS) {
    const max = parseInt(newMax, 10);
    if (isNaN(max) || max < MIN_PARTICIPANTS) {
      return {
        valid: false,
        error: `Capacity cannot be set below minimum activation limit (${MIN_PARTICIPANTS}).`
      };
    }

    if (max > communityMax) {
      return {
        valid: false,
        error: `Requested capacity (${max}) exceeds community maximum (${communityMax}).`
      };
    }

    if (campfire && campfire.status === CAMPFIRE_STATUSES.ACTIVE && max < campfire.memberIds.length) {
      return {
        valid: false,
        error: `Cannot reduce capacity (${max}) below current active member count (${campfire.memberIds.length}).`
      };
    }

    return { valid: true, max };
  }

  /**
   * Calculate Campfire Progress Denominator
   * Progress uses actual member count, never max capacity.
   */
  function getProgressDenominator(campfire) {
    if (!campfire || !Array.isArray(campfire.memberIds)) {
      return MIN_PARTICIPANTS;
    }
    return Math.max(campfire.memberIds.length, MIN_PARTICIPANTS);
  }


  /**
   * Clean QA Baseline Factory for Phase 0.20.1: Level 2 Explorer, 135 LP, 15 XP
   */
  function createCampfireReadyQaState(options = {}) {
    const role = options.role || 'MEMBER';
    return {
      saveVersion: 1,
      saveKey: 'koinonia.phase20_1.save',
      lastSaveTime: new Date().toISOString(),
      activePlaceId: 'home',
      spawnId: 'default',
      lp: 135,
      charLevel: 2,
      charXp: 15,
      charXpMax: 20,
      highestLevelReached: 2,
      levelUpHistory: [],
      growthAreas: { stewardship: 1, responsibility: 1, service: 0, reflection: 0, discipline: 0, teamwork: 0 },
      skills: { stewardship: 1, responsibility: 1, discipline: 0, teamwork: 0, service: 0, compassion: 0, reflection: 0 },
      growthAreaRanks: {},
      milestones: {},
      unlockedMilestones: [],
      unlockedPerks: [],
      gardenState: 'dry',
      gateOpen: false,
      fogCenterUnlocked: true,
      visitedFogCenter: true,
      unlockedPlaces: ['home', 'fog_center', 'sanctuary', 'courtyard', 'outreach'],
      visitedPlaces: ['home', 'fog_center'],
      firstVisitedAt: { home: new Date().toISOString(), fog_center: new Date().toISOString() },
      visitCount: { home: 1, fog_center: 1 },
      spokenToNpc: {},
      questStatus: 'completed',
      rewardClaimed: true,
      currentObjective: 'Active in Community',
      reflectionText: '',
      audioMuted: true,
      trackedQuestId: 'Q-001',
      questProgress: {},
      campaignProgress: {},
      activeCampaignIds: [],
      completedCampaignIds: [],
      eventParticipation: [],
      completedEventInstances: [],
      eventsAttendedCount: 0,
      eventQuestProgress: {},
      demoNow: null,
      fitQuestResults: {},
      fitQuestHistory: [],
      personalBests: {},
      fitQuestRewardClaims: {},
      sportsExplored: [],
      fitQuestMetrics: { completedCount: 0, personalBestsCount: 0, totalAttemptsCount: 0, sportsTriedCount: 0 },
      selectedChallengeId: 'FQ-V001',
      activeFitQuestTab: 'play',
      memories: [],
      placeHistory: {},
      memoryMetrics: { totalCount: 0, questCount: 0, eventCount: 0, personalBestCount: 0, placeCount: 0, milestoneCount: 0, reflectionCount: 0 },
      circleRole: role,
      questCircleSettings: { minParticipants: MIN_PARTICIPANTS, defaultMaxParticipants: DEFAULT_MAX_PARTICIPANTS, communityMaxParticipants: DEFAULT_COMMUNITY_MAX_PARTICIPANTS },
      questCircles: [],
      circleAssignments: [],
      selectedCircleId: null,
      circleMetrics: { circlesJoinedCount: 0, questsCompletedInCircleCount: 0, reactionsGivenCount: 0 },
      storageMeta: { initialized: true, schemaVersion: 1 }
    };
  }

  // Export
  const campfiresModule = {
    createCampfireReadyQaState,
    CAMPFIRE_STATUSES,
    CAMPFIRE_ROLES,
    MIN_PARTICIPANTS,
    DEFAULT_MAX_PARTICIPANTS,
    DEFAULT_COMMUNITY_MAX_PARTICIPANTS,
    CANONICAL_REACTIONS,
    createCampfire,
    createCampfireGameState,
    validateCampfireCapacity,
    getProgressDenominator
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = campfiresModule;
  }

  if (typeof root !== 'undefined') {
    root.KOINONIA_CAMPFIRES = campfiresModule;
  }

})(typeof window !== 'undefined' ? window : global);
