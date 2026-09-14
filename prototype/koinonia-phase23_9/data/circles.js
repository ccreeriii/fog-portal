/**
 * KOINONIA — PHASE 0.20
 * QUEST CIRCLES DATA MODULE
 * Small-group questing, teamwork & leader-guided growth.
 *
 * Core Principles:
 * - Small groups: 5–8 youth participants + leader facilitator.
 * - Belonging, encouragement, service, shared adventure.
 * - NOT competitive pressure, NOT public popularity, NO unrestricted chat.
 * - Individual responsibility: Circle progress NEVER auto-completes quests.
 * - 0 LP, 0 Character XP, 0 Growth XP for Circle creation, joining, or completion.
 * - Minor safety: Predefined structured reactions only. No free-text messaging.
 */

(function(root) {
  'use strict';

  // Canonical Status Enums
  const CIRCLE_STATUSES = {
    DRAFT: 'DRAFT',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED'
  };

  const CIRCLE_ROLES = {
    LEADER: 'LEADER',
    MEMBER: 'MEMBER'
  };

  const ASSIGNMENT_STATUSES = {
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    ARCHIVED: 'ARCHIVED'
  };

  // Capacity Limits & Configurable Settings
  const DEFAULT_MIN_PARTICIPANTS = 5;
  const DEFAULT_MAX_PARTICIPANTS = 12;
  const DEFAULT_COMMUNITY_MAX_PARTICIPANTS = 12;

  const DEFAULT_QUEST_CIRCLE_SETTINGS = {
    minParticipants: DEFAULT_MIN_PARTICIPANTS,
    defaultMaxParticipants: DEFAULT_MAX_PARTICIPANTS,
    communityMaxParticipants: DEFAULT_COMMUNITY_MAX_PARTICIPANTS
  };

  // Backwards compatibility aliases
  const MIN_YOUTH_PARTICIPANTS = DEFAULT_MIN_PARTICIPANTS;
  const MAX_YOUTH_PARTICIPANTS = DEFAULT_MAX_PARTICIPANTS;

  // Canonical Predefined Encouragement Reactions (NO free-text comments or messages)
  const CANONICAL_REACTIONS = {
    ENCOURAGE: { id: 'ENCOURAGE', emoji: '👏', label: 'Encourage' },
    PRAYING: { id: 'PRAYING', emoji: '🙏', label: 'Praying' },
    KEEP_GOING: { id: 'KEEP_GOING', emoji: '🔥', label: 'Keep Going' },
    GROWING_TOGETHER: { id: 'GROWING_TOGETHER', emoji: '🌱', label: 'Growing Together' },
    GREAT_JOB: { id: 'GREAT_JOB', emoji: '❤️', label: 'Great Job' }
  };

  // Structured Activity Event Types (Deterministic templates, NO member-authored text)
  const ACTIVITY_TYPES = {
    CIRCLE_CREATED: 'CIRCLE_CREATED',
    CIRCLE_ACTIVATED: 'CIRCLE_ACTIVATED',
    MEMBER_JOINED: 'MEMBER_JOINED',
    MEMBER_REMOVED: 'MEMBER_REMOVED',
    QUEST_ASSIGNED: 'QUEST_ASSIGNED',
    MEMBER_COMPLETED_QUEST: 'MEMBER_COMPLETED_QUEST',
    CIRCLE_QUEST_COMPLETED: 'CIRCLE_QUEST_COMPLETED',
    REACTION_ADDED: 'REACTION_ADDED'
  };

  // Canonical Demo Participants Pool (Fictional, clearly marked DEMO, NO real youth names)
  const DEMO_PARTICIPANTS_POOL = [
    { id: 'user_alex', displayName: 'Alex — Local Player', avatarKey: 'alex', role: 'MEMBER', isDemo: false },
    { id: 'demo_member_a', displayName: 'Demo Member A', avatarKey: 'member_a', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_b', displayName: 'Demo Member B', avatarKey: 'member_b', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_c', displayName: 'Demo Member C', avatarKey: 'member_c', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_d', displayName: 'Demo Member D', avatarKey: 'member_d', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_e', displayName: 'Demo Member E', avatarKey: 'member_e', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_f', displayName: 'Demo Member F', avatarKey: 'member_f', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_g', displayName: 'Demo Member G', avatarKey: 'member_g', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_h', displayName: 'Demo Member H', avatarKey: 'member_h', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_i', displayName: 'Demo Member I', avatarKey: 'member_a', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_j', displayName: 'Demo Member J', avatarKey: 'member_b', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_k', displayName: 'Demo Member K', avatarKey: 'member_c', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_l', displayName: 'Demo Member L', avatarKey: 'member_d', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_m', displayName: 'Demo Member M', avatarKey: 'member_e', role: 'MEMBER', isDemo: true },
    { id: 'demo_member_n', displayName: 'Demo Member N', avatarKey: 'member_f', role: 'MEMBER', isDemo: true }
  ];

  const DEMO_LEADER_FACILITATOR = {
    id: 'leader_facilitator',
    displayName: 'Leader — Demo Facilitator',
    avatarKey: 'leader',
    role: 'LEADER',
    isDemo: true
  };

  /**
   * Capacity & Community Settings Accessors
   */
  function getCommunitySettings(state) {
    const defaults = { ...DEFAULT_QUEST_CIRCLE_SETTINGS };
    if (!state || !state.questCircleSettings) return defaults;
    return {
      minParticipants: typeof state.questCircleSettings.minParticipants === 'number' ? state.questCircleSettings.minParticipants : DEFAULT_MIN_PARTICIPANTS,
      defaultMaxParticipants: typeof state.questCircleSettings.defaultMaxParticipants === 'number' ? state.questCircleSettings.defaultMaxParticipants : DEFAULT_MAX_PARTICIPANTS,
      communityMaxParticipants: typeof state.questCircleSettings.communityMaxParticipants === 'number' ? state.questCircleSettings.communityMaxParticipants : DEFAULT_COMMUNITY_MAX_PARTICIPANTS
    };
  }

  function setCommunityMaxParticipants(state, newMax) {
    if (!state) return { success: false, error: 'Invalid state.' };
    const role = state.circleRole || (state.character && state.character.role) || 'MEMBER';
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      return { success: false, error: 'Only administrators can configure community Circle settings.' };
    }
    const min = (state.questCircleSettings && state.questCircleSettings.minParticipants) || DEFAULT_MIN_PARTICIPANTS;
    if (typeof newMax !== 'number' || newMax < min) {
      return { success: false, error: `Community maximum cannot be less than minimum participants (${min}).` };
    }
    state.questCircleSettings = state.questCircleSettings || { ...DEFAULT_QUEST_CIRCLE_SETTINGS };
    state.questCircleSettings.communityMaxParticipants = newMax;
    if (state.questCircleSettings.defaultMaxParticipants > newMax) {
      state.questCircleSettings.defaultMaxParticipants = newMax;
    } else if (newMax >= DEFAULT_MAX_PARTICIPANTS && state.questCircleSettings.defaultMaxParticipants < DEFAULT_MAX_PARTICIPANTS) {
      state.questCircleSettings.defaultMaxParticipants = DEFAULT_MAX_PARTICIPANTS;
    }
    return { success: true, settings: state.questCircleSettings };
  }

  function setCircleMaxParticipants(circle, newMax, state) {
    if (!circle) return { success: false, error: 'Invalid Circle.' };
    if (!state || !canCreateCircle(state)) {
      return { success: false, error: 'Quest Circles are managed by your youth leaders.' };
    }
    const settings = getCommunitySettings(state);
    if (typeof newMax !== 'number') {
      return { success: false, error: 'Invalid capacity value.' };
    }
    if (newMax > settings.communityMaxParticipants) {
      return { success: false, error: `Maximum allowed for this community is ${settings.communityMaxParticipants}.` };
    }
    if (newMax < settings.minParticipants) {
      return { success: false, error: `Circle capacity cannot be lower than ${settings.minParticipants} participants.` };
    }
    const currentCount = Array.isArray(circle.memberIds) ? circle.memberIds.length : 0;
    if (newMax < currentCount) {
      return { success: false, error: `This Circle already has ${currentCount} participants. Choose ${currentCount} or more.` };
    }
    circle.maxParticipants = newMax;
    return { success: true, circle };
  }

  /**
   * Factory: Create a Canonical Quest Circle
   */
  function createCircle(params = {}, state = null) {
    const id = params.id || `circle_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const createdAt = params.createdAt || new Date().toISOString();
    const settings = getCommunitySettings(state);

    let maxParticipants = settings.defaultMaxParticipants || DEFAULT_MAX_PARTICIPANTS;
    if (typeof params.maxParticipants === 'number') {
      maxParticipants = params.maxParticipants;
    }

    const circle = {
      id,
      communityId: 'fog',
      name: (params.name || 'New Quest Circle').trim(),
      subtitle: (params.subtitle || 'Youth Adventure Group').trim(),
      description: (params.description || 'Growing together through real-world adventures.').trim(),
      status: params.status || CIRCLE_STATUSES.DRAFT,
      maxParticipants,
      leaderId: params.leaderId || (Array.isArray(params.leaderIds) && params.leaderIds[0]) || 'leader_facilitator',
      leaderIds: Array.isArray(params.leaderIds) && params.leaderIds.length > 0 ? [...params.leaderIds] : [params.leaderId || 'leader_facilitator'],
      memberIds: Array.isArray(params.memberIds) ? [...params.memberIds] : [],
      createdAt,
      activatedAt: params.activatedAt || null,
      assignedQuestIds: Array.isArray(params.assignedQuestIds) ? [...params.assignedQuestIds] : [],
      completedQuestIds: Array.isArray(params.completedQuestIds) ? [...params.completedQuestIds] : [],
      activityLog: Array.isArray(params.activityLog) ? [...params.activityLog] : [],
      tags: Array.isArray(params.tags) ? [...params.tags] : ['youth', 'fellowship'],
      isDemo: Boolean(params.isDemo)
    };

    // Initial activity entry if log is empty
    if (circle.activityLog.length === 0) {
      circle.activityLog.push(createActivityLogEntry({
        circleId: circle.id,
        type: ACTIVITY_TYPES.CIRCLE_CREATED,
        text: `🌱 Quest Circle "${circle.name}" was created.`,
        timestamp: createdAt
      }));
    }

    return circle;
  }

  /**
   * Factory: Create a Circle Quest Assignment
   */
  function createCircleAssignment(params = {}) {
    const circleId = params.circleId;
    const questId = params.questId;
    const id = params.id || `cassign_${circleId}_${questId}`;
    const assignedAt = params.assignedAt || new Date().toISOString();

    const memberProgress = {};
    if (Array.isArray(params.memberIds)) {
      params.memberIds.forEach(mId => {
        memberProgress[mId] = { completed: false, completedAt: null };
      });
    }

    return {
      id,
      circleId,
      questId,
      assignedBy: params.assignedBy || 'leader_facilitator',
      assignedAt,
      dueAt: params.dueAt || null,
      status: params.status || ASSIGNMENT_STATUSES.ASSIGNED,
      memberProgress: params.memberProgress ? { ...params.memberProgress } : memberProgress,
      completedAt: params.completedAt || null
    };
  }

  /**
   * Factory: Create a Structured Activity Log Entry (No arbitrary text allowed)
   */
  function createActivityLogEntry(params = {}) {
    const circleId = params.circleId;
    const type = params.type || ACTIVITY_TYPES.CIRCLE_CREATED;
    const timestamp = params.timestamp || new Date().toISOString();
    const id = params.id || `act_${circleId}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    return {
      id,
      circleId,
      type,
      memberId: params.memberId || null,
      questId: params.questId || null,
      reactionId: params.reactionId || null,
      text: params.text || '',
      timestamp,
      reactions: params.reactions ? { ...params.reactions } : {}
    };
  }

  /**
   * Permissions Check: Can player create/manage a Circle?
   */
  function canCreateCircle(state) {
    if (!state) return false;
    const role = state.circleRole || (state.character && state.character.role) || 'MEMBER';
    return role === 'LEADER' || role === 'ADMIN';
  }

  /**
   * Get safe participant object by ID
   */
  function getParticipantById(memberId) {
    if (memberId === DEMO_LEADER_FACILITATOR.id) return { ...DEMO_LEADER_FACILITATOR };
    const found = DEMO_PARTICIPANTS_POOL.find(p => p.id === memberId);
    if (found) return { ...found };
    return {
      id: memberId,
      displayName: memberId.replace('demo_', 'Demo ').replace('_', ' '),
      avatarKey: 'member_a',
      role: 'MEMBER',
      isDemo: true
    };
  }

  /**
   * Capacity & Member Management: Add Member
   */
  function addMemberToCircle(circle, memberId, state) {
    if (!circle) return { success: false, error: 'Invalid Circle.' };
    if (state && !canCreateCircle(state)) {
      return { success: false, error: 'Quest Circles are created by your youth leaders.' };
    }

    if (circle.memberIds.includes(memberId)) {
      return { success: false, error: 'Member is already in this Circle.' };
    }

    const maxCapacity = (typeof circle.maxParticipants === 'number')
      ? circle.maxParticipants
      : (state && state.questCircleSettings && state.questCircleSettings.defaultMaxParticipants) || DEFAULT_MAX_PARTICIPANTS;
    if (circle.memberIds.length >= maxCapacity) {
      return { success: false, error: `This Quest Circle is full (${maxCapacity} of ${maxCapacity}).` };
    }

    circle.memberIds.push(memberId);
    const participant = getParticipantById(memberId);

    // Record activity
    circle.activityLog.unshift(createActivityLogEntry({
      circleId: circle.id,
      type: ACTIVITY_TYPES.MEMBER_JOINED,
      memberId,
      text: `👋 ${participant.displayName} joined the Circle.`
    }));

    return { success: true, circle };
  }

  /**
   * Capacity & Member Management: Remove Member
   */
  function removeMemberFromCircle(circle, memberId, state) {
    if (!circle) return { success: false, error: 'Invalid Circle.' };
    if (state && !canCreateCircle(state)) {
      return { success: false, error: 'Quest Circles are created by your youth leaders.' };
    }

    const idx = circle.memberIds.indexOf(memberId);
    if (idx === -1) {
      return { success: false, error: 'Member is not in this Circle.' };
    }

    circle.memberIds.splice(idx, 1);
    const participant = getParticipantById(memberId);

    let statusChangedToDraft = false;
    // Capacity Safety Rule: If an active Circle drops below minimum participants, safely return to DRAFT
    const minRequired = (state && state.questCircleSettings && state.questCircleSettings.minParticipants) || DEFAULT_MIN_PARTICIPANTS;
    if (circle.status === CIRCLE_STATUSES.ACTIVE && circle.memberIds.length < minRequired) {
      circle.status = CIRCLE_STATUSES.DRAFT;
      statusChangedToDraft = true;
      circle.activityLog.unshift(createActivityLogEntry({
        circleId: circle.id,
        type: ACTIVITY_TYPES.MEMBER_REMOVED,
        memberId,
        text: `⚠️ Circle returned to Draft: Needs at least ${MIN_YOUTH_PARTICIPANTS} participants to remain Active.`
      }));
    } else {
      circle.activityLog.unshift(createActivityLogEntry({
        circleId: circle.id,
        type: ACTIVITY_TYPES.MEMBER_REMOVED,
        memberId,
        text: `👋 ${participant.displayName} left the Circle.`
      }));
    }

    return { success: true, circle, statusChangedToDraft };
  }

  /**
   * Activation Validation: Minimum 5, Maximum 8, Leader Required
   */
  function activateCircle(circle, state) {
    if (!circle) return { success: false, error: 'Invalid Circle.' };
    if (state && !canCreateCircle(state)) {
      return { success: false, error: 'Quest Circles are created by your youth leaders.' };
    }

    const minRequired = (state && state.questCircleSettings && state.questCircleSettings.minParticipants) || DEFAULT_MIN_PARTICIPANTS;
    if (circle.memberIds.length < minRequired) {
      return { success: false, error: `Add at least ${minRequired} participants before activating this Circle.` };
    }

    if (circle.memberIds.length > MAX_YOUTH_PARTICIPANTS) {
      return { success: false, error: `This Quest Circle is full (${MAX_YOUTH_PARTICIPANTS} of ${MAX_YOUTH_PARTICIPANTS}).` };
    }

    if (!circle.leaderIds || circle.leaderIds.length === 0) {
      return { success: false, error: 'A Circle must have at least one authorized leader.' };
    }

    circle.status = CIRCLE_STATUSES.ACTIVE;
    circle.activatedAt = new Date().toISOString();

    circle.activityLog.unshift(createActivityLogEntry({
      circleId: circle.id,
      type: ACTIVITY_TYPES.CIRCLE_ACTIVATED,
      text: `🎉 Quest Circle "${circle.name}" is now Active! Let's do this adventure together.`
    }));

    return { success: true, circle };
  }

  /**
   * Archive Circle
   */
  function archiveCircle(circle, state) {
    if (!circle) return { success: false, error: 'Invalid Circle.' };
    if (state && !canCreateCircle(state)) {
      return { success: false, error: 'Quest Circles are created by your youth leaders.' };
    }
    circle.status = CIRCLE_STATUSES.ARCHIVED;
    return { success: true, circle };
  }

  /**
   * Quest Assignment with Deduplication
   */
  function assignQuestToCircle(circle, questId, state, assignedBy = 'leader_facilitator') {
    if (!circle) return { success: false, error: 'Invalid Circle.' };
    if (state && !canCreateCircle(state)) {
      return { success: false, error: 'Quest Circles are created by your youth leaders.' };
    }

    if (circle.status !== CIRCLE_STATUSES.ACTIVE) {
      return { success: false, error: 'Quests can only be assigned to Active Circles.' };
    }

    // Deduplication: cannot reassign if already assigned
    if (circle.assignedQuestIds.includes(questId)) {
      return { success: false, error: 'This quest is already assigned to this Circle.' };
    }

    const assignment = createCircleAssignment({
      circleId: circle.id,
      questId,
      assignedBy,
      memberIds: circle.memberIds
    });

    circle.assignedQuestIds.push(questId);

    // Human-readable quest title mapping
    const questNames = {
      'Q-001': 'Steward of the Garden',
      'Q-002': 'Light at Home',
      'Q-003': 'A Quiet Moment',
      'Q-004': 'Community Fellowship',
      'Q-005': 'Faithful Service'
    };
    const questTitle = questNames[questId] || questId;

    circle.activityLog.unshift(createActivityLogEntry({
      circleId: circle.id,
      type: ACTIVITY_TYPES.QUEST_ASSIGNED,
      questId,
      text: `📜 New Adventure Assigned: ${questTitle}`
    }));

    return { success: true, assignment };
  }

  /**
   * Record Individual Member Completion (Anti-Farming & Deduplication)
   */
  function recordMemberQuestCompletion(circle, assignment, memberId, questId, state) {
    if (!circle || !assignment) return { success: false, error: 'Invalid Circle or Assignment.' };

    if (assignment.questId !== questId) {
      return { success: false, error: 'Quest ID does not match assignment.' };
    }

    // Initialize member record if missing
    if (!assignment.memberProgress[memberId]) {
      assignment.memberProgress[memberId] = { completed: false, completedAt: null };
    }

    // Deduplication: do not re-complete
    if (assignment.memberProgress[memberId].completed) {
      return { success: false, alreadyCompleted: true, error: 'Member already completed this quest.' };
    }

    // Mark member completed
    assignment.memberProgress[memberId].completed = true;
    assignment.memberProgress[memberId].completedAt = new Date().toISOString();

    const participant = getParticipantById(memberId);
    const questNames = {
      'Q-001': 'Steward of the Garden',
      'Q-002': 'Light at Home',
      'Q-003': 'A Quiet Moment',
      'Q-004': 'Community Fellowship',
      'Q-005': 'Faithful Service'
    };
    const questTitle = questNames[questId] || questId;

    // Structured Activity Log entry
    circle.activityLog.unshift(createActivityLogEntry({
      circleId: circle.id,
      type: ACTIVITY_TYPES.MEMBER_COMPLETED_QUEST,
      memberId,
      questId,
      text: `🌱 ${participant.displayName} completed ${questTitle}.`
    }));

    // Check if ALL participants have completed
    const activeMemberIds = circle.memberIds;
    const allCompleted = activeMemberIds.length > 0 && activeMemberIds.every(mId => {
      return assignment.memberProgress[mId] && assignment.memberProgress[mId].completed;
    });

    let circleCompleted = false;
    if (allCompleted) {
      assignment.status = ASSIGNMENT_STATUSES.COMPLETED;
      assignment.completedAt = new Date().toISOString();
      if (!circle.completedQuestIds.includes(questId)) {
        circle.completedQuestIds.push(questId);
      }
      circleCompleted = true;

      // Celebrate shared accomplishment (Recognition ONLY, 0 LP, 0 XP)
      circle.activityLog.unshift(createActivityLogEntry({
        circleId: circle.id,
        type: ACTIVITY_TYPES.CIRCLE_QUEST_COMPLETED,
        questId,
        text: `🎉 CIRCLE QUEST COMPLETE! Your Circle completed "${questTitle}" together.`
      }));
    } else {
      assignment.status = ASSIGNMENT_STATUSES.IN_PROGRESS;
    }

    return {
      success: true,
      circleCompleted,
      assignmentProgress: getCircleQuestProgress(circle, assignment)
    };
  }

  /**
   * Get Circle Progress: Encouraging language, no shaming
   */
  function getCircleQuestProgress(circle, assignment) {
    if (!circle || !assignment) {
      return { completedCount: 0, totalCount: 0, percent: 0, isComplete: false, message: 'No active quest assignment.' };
    }

    const totalCount = circle.memberIds.length;
    let completedCount = 0;

    circle.memberIds.forEach(mId => {
      if (assignment.memberProgress && assignment.memberProgress[mId] && assignment.memberProgress[mId].completed) {
        completedCount++;
      }
    });

    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const isComplete = totalCount > 0 && completedCount === totalCount;

    let encouragingMessage = 'Small steps become meaningful when we take them together.';
    if (isComplete) {
      encouragingMessage = 'Your Circle completed this adventure together!';
    } else if (completedCount > 0) {
      encouragingMessage = 'Keep encouraging one another as you complete this adventure.';
    }

    return {
      completedCount,
      totalCount,
      percent,
      isComplete,
      encouragingMessage
    };
  }

  /**
   * Predefined Encouragement Reactions (Minor Safety & Anti-Popularity)
   */
  function addPredefinedReaction(circle, activityId, reactionId) {
    if (!circle) return { success: false, error: 'Invalid Circle.' };

    const reaction = CANONICAL_REACTIONS[reactionId];
    if (!reaction) {
      return { success: false, error: 'Invalid reaction. Only predefined encouragements are permitted.' };
    }

    const activity = circle.activityLog.find(a => a.id === activityId);
    if (!activity) {
      return { success: false, error: 'Activity entry not found.' };
    }

    if (!activity.reactions) activity.reactions = {};
    activity.reactions[reactionId] = (activity.reactions[reactionId] || 0) + 1;

    return { success: true, activity };
  }

  /**
   * Upgrade Phase 0.19 State to Phase 0.20
   */
  function upgradePhase19StateToPhase20(p19State) {
    const base = p19State ? JSON.parse(JSON.stringify(p19State)) : {};

    base.saveVersion = 1;
    base.saveKey = 'koinonia.phase20_1.save';

    // Phase 0.20 Specific Fields
    if (typeof base.circleRole !== 'string') {
      base.circleRole = 'MEMBER';
    }
    if (!base.questCircleSettings) {
      base.questCircleSettings = { ...DEFAULT_QUEST_CIRCLE_SETTINGS };
    }
    if (!Array.isArray(base.questCircles)) {
      base.questCircles = [];
    } else {
      // Migrate existing circles if maxParticipants is missing
      base.questCircles.forEach(c => {
        if (c && typeof c.maxParticipants !== 'number') {
          c.maxParticipants = base.questCircleSettings.defaultMaxParticipants || DEFAULT_MAX_PARTICIPANTS;
        }
      });
    }
    if (!Array.isArray(base.circleAssignments)) {
      base.circleAssignments = [];
    }
    if (typeof base.selectedCircleId === 'undefined') {
      base.selectedCircleId = null;
    }
    if (!base.circleMetrics) {
      base.circleMetrics = {
        circlesJoinedCount: 0,
        questsCompletedInCircleCount: 0,
        reactionsGivenCount: 0
      };
    }

    return base;
  }

  /**
   * Clean QA Baseline Factory: Level 2 Explorer, 135 LP, 15 XP, 0 Circles
   */
  function createCircleReadyQaState(options = {}) {
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
      gateOpen: true,
      fogCenterUnlocked: true,
      visitedFogCenter: true,
      unlockedPlaces: ['home', 'fog_center', 'sports_hub', 'school', 'outreach_site'],
      visitedPlaces: ['home', 'fog_center'],
      firstVisitedAt: { home: new Date().toISOString(), fog_center: new Date().toISOString() },
      visitCount: { home: 1, fog_center: 1 },
      spokenToNpc: {},
      questStatus: 'ready',
      rewardClaimed: false,
      currentObjective: 'Explore Koinonia or check your Quest Circle',
      reflectionText: '',
      audioMuted: true,
      audioContext: null,

      // Modular Quests Phase 0.14
      trackedQuestId: 'Q-001',
      questProgress: {
        'Q-001': { status: 'completed', completedAt: new Date().toISOString(), reflection: 'Faithful chores start at home.' },
        'Q-002': { status: 'completed', completedAt: new Date().toISOString(), reflection: 'Order brings peace.' },
        'Q-003': { status: 'completed', completedAt: new Date().toISOString(), reflection: 'Stillness in prayer.' }
      },

      // Campaigns & Events Phase 0.17
      campaignProgress: {},
      activeCampaignIds: [],
      completedCampaignIds: [],
      eventParticipation: [],
      completedEventInstances: [],
      eventsAttendedCount: 0,
      eventQuestProgress: {},

      // Sports & Faith Quest (Phase 0.18 & 0.20.1)
      fitQuestResults: {},
      fitQuestHistory: [],
      personalBests: {},
      fitQuestRewardClaims: {},
      sportsExplored: [],
      fitQuestMetrics: { completedCount: 0, personalBestsCount: 0, totalAttemptsCount: 0, sportsTriedCount: 0 },
      selectedChallengeId: 'FQ-V001',
      activeFitQuestTab: 'play',

      // Memories Phase 0.19
      memories: [],
      placeHistory: {},
      memoryMetrics: { totalCount: 0, questCount: 0, eventCount: 0, personalBestCount: 0, placeCount: 0, milestoneCount: 0, reflectionCount: 0 },

      // Quest Circles Phase 0.20
      circleRole: role,
      questCircleSettings: { ...DEFAULT_QUEST_CIRCLE_SETTINGS },
      questCircles: [],
      circleAssignments: [],
      selectedCircleId: null,
      circleMetrics: {
        circlesJoinedCount: 0,
        questsCompletedInCircleCount: 0,
        reactionsGivenCount: 0
      }
    };
  }

  // Export module definition
  const ModuleExports = {
    CIRCLE_STATUSES,
    CIRCLE_ROLES,
    ASSIGNMENT_STATUSES,
    DEFAULT_MIN_PARTICIPANTS,
    DEFAULT_MAX_PARTICIPANTS,
    DEFAULT_COMMUNITY_MAX_PARTICIPANTS,
    DEFAULT_QUEST_CIRCLE_SETTINGS,
    MIN_YOUTH_PARTICIPANTS,
    MAX_YOUTH_PARTICIPANTS,
    CANONICAL_REACTIONS,
    getCommunitySettings,
    setCommunityMaxParticipants,
    setCircleMaxParticipants,
    ACTIVITY_TYPES,
    DEMO_PARTICIPANTS_POOL,
    DEMO_LEADER_FACILITATOR,
    createCircle,
    createCircleAssignment,
    createActivityLogEntry,
    canCreateCircle,
    getParticipantById,
    addMemberToCircle,
    removeMemberFromCircle,
    activateCircle,
    archiveCircle,
    assignQuestToCircle,
    recordMemberQuestCompletion,
    getCircleQuestProgress,
    addPredefinedReaction,
    upgradePhase19StateToPhase20,
    createCircleReadyQaState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModuleExports;
  }
  if (typeof root !== 'undefined') {
    root.KOINONIA_CIRCLES = ModuleExports;
  }
})(typeof window !== 'undefined' ? window : global);
