/**
 * KOINONIA — PHASE 0.23K REWARD AUTHORITY FOUNDATION
 * KOINONIA-Local Prototype Reward Authority & Progression Boundary
 *
 * Core Principles:
 * 1. Authority-Managed Prototype Reward Boundary:
 *    All member-facing gameplay rewards (Quests, Events, Arcade, Challenges)
 *    flow strictly through KoinoniaRewardAuthority. Normal UI code never directly mints LP/XP.
 * 2. Scope & Terminology Notice:
 *    In Phase 0.23K, this is a KOINONIA-local prototype reward authority with member-namespaced
 *    prototype storage persistence. It is NOT server-authoritative yet. Real server-side authority
 *    will connect to Shared Core after explicit Main App integration.
 * 3. Categorized Reward Paths:
 *    A. QUEST (completeQuest)
 *    B. EVENT / GATHERING (recordEventAttendance)
 *    C. ARCADE / GAME / CHALLENGE (recordArcadeReward, recordChallengeReward)
 *    D. DEVELOPMENT-ONLY (resetPrototypeState isolated)
 *    E. NON-REWARD DISPLAY / HYDRATION (profile and state sync; never mints)
 * 4. Idempotency & Duplicate Protection:
 *    - Quests: fog:{memberId}:{questId}:v1
 *    - Events: fog:{memberId}:event:{eventId}:{date/v1}
 *    - Arcade: fog:{memberId}:arcade:{gameId}:{YYYY-MM-DD} (daily replay protection)
 *    - Challenges: fog:{memberId}:challenge:{challengeId}:v1
 * 5. Atomic Reward Transactions: Snapshot + Rollback on failure (zero partial state).
 * 6. Trusted Reward Policies: Hard bounds (LP: 0-50, XP: 0-100); negative amounts rejected.
 * 7. Studio Governance Safety: Author requested rewards validated and clamped.
 * 8. Member-Scoped Audit Ledger: Read-only reward history trail keyed strictly by canonical memberId.
 * 9. Minor Safety: Preserves isMinor flags, zero personal contact or free-text exposure.
 * 10. Fail-Closed Shared Core Boundary: Zero network calls, zero DB writes, disabled in prototype.
 */

(function(global) {
  'use strict';

  // ============================================================
  // 1. CANONICAL CONSTANTS & POLICIES
  // ============================================================
  const COMMUNITY_ID = 'fog';
  const COMPLETION_VERSION = 'v1';
  const CANONICAL_TIMEZONE = 'Asia/Manila';

  const LIMITS = Object.freeze({
    MIN_LP: 0,
    MAX_LP: 50,
    MIN_XP: 0,
    MAX_XP: 100
  });

  const QUEST_STATUSES = Object.freeze({
    NOT_STARTED: 'NOT_STARTED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED'
  });

  const REWARD_TYPES = Object.freeze({
    QUEST_COMPLETION: 'QUEST_COMPLETION',
    EVENT_ATTENDANCE: 'EVENT_ATTENDANCE',
    ARCADE_COMPLETION: 'ARCADE_COMPLETION',
    CHALLENGE_COMPLETION: 'CHALLENGE_COMPLETION',
    MILESTONE_UNLOCK: 'MILESTONE_UNLOCK'
  });

  // Dependencies (Safe resolution in Node or Browser)
  let KoinoniaGrowth = (typeof global !== 'undefined' && global.KoinoniaGrowth) ||
                       (typeof window !== 'undefined' && window.KoinoniaGrowth);
  if (!KoinoniaGrowth && typeof require !== 'undefined') {
    try {
      KoinoniaGrowth = require('./growth_profile.js');
    } catch (_) {}
  }

  let KoinoniaIdentity = (typeof global !== 'undefined' && global.KoinoniaIdentity) ||
                         (typeof window !== 'undefined' && window.KoinoniaIdentity);
  if (!KoinoniaIdentity && typeof require !== 'undefined') {
    try {
      KoinoniaIdentity = require('./member_identity.js');
    } catch (_) {}
  }

  // ============================================================
  // 2. TRUSTED REWARD CATALOGS
  // ============================================================

  // A. Trusted Quests
  const TRUSTED_QUEST_REWARDS = Object.freeze({
    'Q-001': Object.freeze({
      questId: 'Q-001',
      communityId: COMMUNITY_ID,
      title: 'Steward of the Garden',
      category: 'STEWARDSHIP',
      questType: 'STANDARD',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze(['first_quest'])
      })
    }),
    'Q-002': Object.freeze({
      questId: 'Q-002',
      communityId: COMMUNITY_ID,
      title: 'Light at Home',
      category: 'FAMILY',
      questType: 'STANDARD',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze([])
      })
    }),
    'Q-003': Object.freeze({
      questId: 'Q-003',
      communityId: COMMUNITY_ID,
      title: 'Morning Blessing',
      category: 'PRAYER',
      questType: 'STANDARD',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze([])
      })
    }),
    'Q-004': Object.freeze({
      questId: 'Q-004',
      communityId: COMMUNITY_ID,
      title: 'Encouraging Words',
      category: 'COMMUNITY',
      questType: 'STANDARD',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze([])
      })
    }),
    'Q-005': Object.freeze({
      questId: 'Q-005',
      communityId: COMMUNITY_ID,
      title: 'Orderly Homework Haven',
      category: 'SCHOOL',
      questType: 'STANDARD',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze(['growth_series_completed'])
      })
    }),
    'E-Q001': Object.freeze({
      questId: 'E-Q001',
      communityId: COMMUNITY_ID,
      title: 'Glory Gate Gathering: Prepare the Space',
      category: 'EVENT',
      questType: 'EVENT',
      milestoneTriggers: Object.freeze(['attended_gathering', 'ministry_service']),
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze(['attended_gathering', 'ministry_service'])
      })
    }),
    'E-Q002': Object.freeze({
      questId: 'E-Q002',
      communityId: COMMUNITY_ID,
      title: 'Agape Welcome & Hospitality',
      category: 'EVENT',
      questType: 'EVENT',
      milestoneTriggers: Object.freeze(['attended_gathering', 'ministry_service']),
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze(['attended_gathering', 'ministry_service'])
      })
    }),
    'E-Q003': Object.freeze({
      questId: 'E-Q003',
      communityId: COMMUNITY_ID,
      title: 'Gathering Reflection & Blessing',
      category: 'EVENT',
      questType: 'EVENT',
      milestoneTriggers: Object.freeze(['attended_gathering']),
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze(['attended_gathering'])
      })
    })
  });

  // B. Trusted Event Attendance Rewards
  const TRUSTED_EVENT_REWARDS = Object.freeze({
    'default': Object.freeze({
      title: 'Community Gathering Attendance',
      category: 'EVENT',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze(['attended_gathering'])
      })
    }),
    'get_into_the_glory': Object.freeze({
      title: 'Get Into the Glory Gathering',
      category: 'EVENT',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze(['attended_gathering', 'ministry_service'])
      })
    })
  });

  // C. Trusted Arcade & Minigame Rewards
  const TRUSTED_ARCADE_REWARDS = Object.freeze({
    'default': Object.freeze({
      title: 'Arcade Participation',
      category: 'ARCADE',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze([])
      })
    }),
    'arcade_slingshot': Object.freeze({
      title: "David's Slingshot Challenge",
      category: 'ARCADE',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze([])
      })
    }),
    'faithquest_catechism': Object.freeze({
      title: 'Faith Quest Catechism Practice',
      category: 'ARCADE',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze([])
      })
    })
  });

  // D. Trusted Sports & Fit Quest Challenges
  const TRUSTED_CHALLENGE_REWARDS = Object.freeze({
    'default': Object.freeze({
      title: 'Sports Challenge',
      category: 'CHALLENGE',
      rewards: Object.freeze({
        lifePoints: 5,
        xp: 5,
        milestoneIds: Object.freeze([])
      })
    })
  });

  // Dynamic Studio Quest Registry (Validated & Clamped)
  const dynamicStudioQuests = {};

  // ============================================================
  // 3. REWARD POLICY VALIDATION & CLAMPING
  // ============================================================
  function validateRewardPolicy(reward) {
    if (!reward || typeof reward !== 'object') {
      return {
        valid: false,
        error: 'Reward payload must be a non-null object',
        requested: null,
        validated: null,
        effective: null
      };
    }

    const rawLp = reward.lifePoints ?? reward.lp;
    const rawXp = reward.xp ?? reward.characterXp ?? reward.charXp;

    const numLp = Number(rawLp);
    const numXp = Number(rawXp);

    if (rawLp !== undefined && (isNaN(numLp) || !isFinite(numLp))) {
      return { valid: false, error: 'Life Points must be a finite number' };
    }
    if (rawXp !== undefined && (isNaN(numXp) || !isFinite(numXp))) {
      return { valid: false, error: 'XP must be a finite number' };
    }

    // Policy check: Negative rewards rejected
    if (numLp < 0 || numXp < 0) {
      return {
        valid: false,
        error: 'Reward amounts cannot be negative',
        requested: { lifePoints: numLp, xp: numXp },
        validated: null,
        effective: null
      };
    }

    const requested = {
      lifePoints: Math.floor(numLp || 0),
      xp: Math.floor(numXp || 0)
    };

    // Policy check: Clamp to trusted policy bounds [0, 50 LP] and [0, 100 XP]
    const clampedLp = Math.min(LIMITS.MAX_LP, Math.max(LIMITS.MIN_LP, requested.lifePoints));
    const clampedXp = Math.min(LIMITS.MAX_XP, Math.max(LIMITS.MIN_XP, requested.xp));

    const validated = {
      lifePoints: clampedLp,
      xp: clampedXp
    };

    // Effective reward is determined solely by authority
    const effective = {
      lifePoints: clampedLp,
      xp: clampedXp
    };

    return {
      valid: true,
      requested,
      validated,
      effective
    };
  }

  // ============================================================
  // 4. IDEMPOTENCY KEY GENERATORS
  // ============================================================
  function generateCompletionId(communityId, memberId, questId, version = COMPLETION_VERSION) {
    const comm = String(communityId || COMMUNITY_ID).trim().toLowerCase();
    const mem = String(memberId || '').trim();
    const qid = String(questId || '').trim();
    const ver = String(version || COMPLETION_VERSION).trim();
    return `${comm}:${mem}:${qid}:${ver}`;
  }

  function generateEventCompletionId(communityId, memberId, eventId, dateStr = null) {
    const comm = String(communityId || COMMUNITY_ID).trim().toLowerCase();
    const mem = String(memberId || '').trim();
    const eid = String(eventId || '').trim();
    const d = dateStr ? `:${dateStr}` : '';
    return `${comm}:${mem}:event:${eid}${d}`;
  }

  function generateArcadeCompletionId(communityId, memberId, gameId, dateStr = null) {
    const comm = String(communityId || COMMUNITY_ID).trim().toLowerCase();
    const mem = String(memberId || '').trim();
    const gid = String(gameId || '').trim();
    const d = dateStr || getCanonicalDateString();
    return `${comm}:${mem}:arcade:${gid}:${d}`;
  }

  function generateChallengeCompletionId(communityId, memberId, challengeId) {
    const comm = String(communityId || COMMUNITY_ID).trim().toLowerCase();
    const mem = String(memberId || '').trim();
    const cid = String(challengeId || '').trim();
    return `${comm}:${mem}:challenge:${cid}:v1`;
  }

  // ============================================================
  // 5. CANONICAL QUEST PROGRESS CONTRACT & NORMALIZER
  // ============================================================
  function normalizeQuestProgress(raw, context = {}) {
    const memberId = String(raw?.memberId || context.memberId || 'guest_anonymous').trim();
    const questId = String(raw?.questId || context.questId || 'unknown_quest').trim();
    const questType = String(raw?.questType || context.questType || 'STANDARD').toUpperCase();

    // Status normalization
    let status = QUEST_STATUSES.NOT_STARTED;
    const rawStatus = String(raw?.status || context.status || '').toUpperCase();
    if (rawStatus === 'COMPLETED') {
      status = QUEST_STATUSES.COMPLETED;
    } else if (['IN_PROGRESS', 'ACCEPTED', 'REAL_WORLD', 'VERIFYING', 'RETURNED'].includes(rawStatus)) {
      status = QUEST_STATUSES.IN_PROGRESS;
    } else {
      status = QUEST_STATUSES.NOT_STARTED;
    }

    // Progress target & current
    const target = Math.max(1, Math.floor(Number(raw?.progress?.target ?? context.target ?? 1)));
    let current = Math.max(0, Math.floor(Number(raw?.progress?.current ?? context.current ?? (status === QUEST_STATUSES.COMPLETED ? target : 0))));
    if (current > target) current = target;
    const percent = Math.min(100, Math.max(0, Math.round((current / target) * 100)));

    // Completion metadata
    const completedAt = (status === QUEST_STATUSES.COMPLETED)
      ? (raw?.completion?.completedAt || raw?.completedAt || context.completedAt || new Date().toISOString())
      : null;
    const completionId = (status === QUEST_STATUSES.COMPLETED)
      ? (raw?.completion?.completionId || raw?.completionId || context.completionId || generateCompletionId(COMMUNITY_ID, memberId, questId))
      : null;

    // Rewards metadata
    const lifePoints = Math.max(0, Math.floor(Number(raw?.rewards?.lifePoints ?? raw?.lifePoints ?? context.lifePoints ?? 0)));
    const xp = Math.max(0, Math.floor(Number(raw?.rewards?.xp ?? raw?.xp ?? context.xp ?? 0)));
    const rawMilestones = raw?.rewards?.milestoneIds || raw?.milestoneIds || context.milestoneIds || [];
    const milestoneIds = Array.isArray(rawMilestones) ? rawMilestones.map(String) : [];

    return Object.freeze({
      memberId,
      communityId: COMMUNITY_ID,
      questId,
      questType,
      status,
      progress: Object.freeze({
        current,
        target,
        percent
      }),
      completion: Object.freeze({
        completedAt,
        completionId
      }),
      rewards: Object.freeze({
        lifePoints,
        xp,
        milestoneIds: Object.freeze(milestoneIds)
      }),
      source: (raw?.source === 'shared-core' || context.source === 'shared-core') ? 'shared-core' : 'prototype',
      readOnly: true
    });
  }

  // ============================================================
  // 6. DETERMINISTIC STREAK MODEL
  // ============================================================
  function getCanonicalDateString(dateObj = new Date()) {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: CANONICAL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(dateObj); // Returns "YYYY-MM-DD"
    } catch (_) {
      return dateObj.toISOString().slice(0, 10);
    }
  }

  function getDayDifference(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return 0;
    const [y1, m1, d1] = dateStr1.split('-').map(Number);
    const [y2, m2, d2] = dateStr2.split('-').map(Number);
    const utc1 = Date.UTC(y1, m1 - 1, d1);
    const utc2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
  }

  function calculateUpdatedStreak(currentStreak, lastCompletedDateStr, todayDateStr) {
    const today = todayDateStr || getCanonicalDateString();
    const streak = Math.max(0, Math.floor(Number(currentStreak) || 0));

    if (!lastCompletedDateStr) {
      return { streak: 1, lastCompletedDate: today, incremented: true, sameDay: false };
    }

    if (lastCompletedDateStr === today) {
      // Same day completion: no double counting
      return { streak: Math.max(1, streak), lastCompletedDate: today, incremented: false, sameDay: true };
    }

    const diffDays = getDayDifference(lastCompletedDateStr, today);
    if (diffDays === 1) {
      // Consecutive day: increment streak
      return { streak: streak + 1, lastCompletedDate: today, incremented: true, sameDay: false };
    } else if (diffDays > 1) {
      // Streak broken: reset to 1
      return { streak: 1, lastCompletedDate: today, incremented: true, sameDay: false };
    } else {
      // Older date / clock anomaly: preserve streak without increment
      return { streak: Math.max(1, streak), lastCompletedDate: today, incremented: false, sameDay: true };
    }
  }

  // ============================================================
  // 7. MILESTONE EVALUATION LOGIC
  // ============================================================
  function evaluateMilestones(memberId, questId, currentProfile, context = {}) {
    const newMilestoneIds = [];
    const existingMilestoneIds = new Set(
      Array.isArray(currentProfile?.milestones)
        ? currentProfile.milestones.map(m => (typeof m === 'string' ? m : m.id))
        : []
    );

    const totalQuestsCompleted = (currentProfile?.activity?.questsCompleted || 0) + 1;
    const currentStreak = context.updatedStreak || currentProfile?.activity?.currentQuestStreak || 1;

    // 1. First Quest Completed
    if (!existingMilestoneIds.has('first_quest') && totalQuestsCompleted >= 1) {
      newMilestoneIds.push('first_quest');
      existingMilestoneIds.add('first_quest');
    }

    // 2. 3-Day Quest Streak
    if (!existingMilestoneIds.has('quest_streak_3') && currentStreak >= 3) {
      newMilestoneIds.push('quest_streak_3');
      existingMilestoneIds.add('quest_streak_3');
    }

    // 3. Growth Series Completed (all foundational quests Q-001 through Q-005)
    const completedQuestIds = new Set(context.completedQuestIds || []);
    completedQuestIds.add(questId);
    const foundationalQuests = ['Q-001', 'Q-002', 'Q-003', 'Q-004', 'Q-005'];
    const allFoundationalDone = foundationalQuests.every(q => completedQuestIds.has(q));
    if (!existingMilestoneIds.has('growth_series_completed') && allFoundationalDone) {
      newMilestoneIds.push('growth_series_completed');
      existingMilestoneIds.add('growth_series_completed');
    }

    // 4. Ministry Service & Community Gathering
    const trustedDef = TRUSTED_QUEST_REWARDS[questId] || dynamicStudioQuests[questId];
    if (trustedDef) {
      if (trustedDef.category === 'SERVICE' || (trustedDef.milestoneTriggers && trustedDef.milestoneTriggers.includes('ministry_service'))) {
        if (!existingMilestoneIds.has('ministry_service')) {
          newMilestoneIds.push('ministry_service');
          existingMilestoneIds.add('ministry_service');
        }
      }
      if (trustedDef.category === 'EVENT' || (trustedDef.milestoneTriggers && trustedDef.milestoneTriggers.includes('attended_gathering'))) {
        if (!existingMilestoneIds.has('attended_gathering')) {
          newMilestoneIds.push('attended_gathering');
          existingMilestoneIds.add('attended_gathering');
        }
      }
    }

    return newMilestoneIds;
  }

  // ============================================================
  // 8. REWARD HISTORY LEDGER ENTRY
  // ============================================================
  function createRewardHistoryEntry({ memberId, questId, type, completionId, lifePointsDelta, xpDelta, milestoneIds, createdAt }) {
    const ts = createdAt || new Date().toISOString();
    const id = `rew_${COMMUNITY_ID}_${memberId}_${questId}_${Date.now()}`;
    return Object.freeze({
      id,
      memberId: String(memberId).trim(),
      questId: String(questId).trim(),
      type: type || REWARD_TYPES.QUEST_COMPLETION,
      lifePointsDelta: Math.max(0, Math.floor(Number(lifePointsDelta) || 0)),
      xpDelta: Math.max(0, Math.floor(Number(xpDelta) || 0)),
      milestoneIds: Object.freeze(Array.isArray(milestoneIds) ? milestoneIds.map(String) : []),
      createdAt: ts,
      completionId: String(completionId).trim()
    });
  }

  // ============================================================
  // 9. BASE REWARD AUTHORITY INTERFACE
  // ============================================================
  class BaseRewardAuthority {
    getQuestProgress(memberId, questId) {
      throw new Error('Not implemented');
    }
    completeQuest(memberId, questId, completionContext) {
      throw new Error('Not implemented');
    }
    recordEventAttendance(memberId, eventId, context) {
      throw new Error('Not implemented');
    }
    recordArcadeReward(memberId, gameId, context) {
      throw new Error('Not implemented');
    }
    recordChallengeReward(memberId, challengeId, context) {
      throw new Error('Not implemented');
    }
    grantTrustedReward(params) {
      throw new Error('Not implemented');
    }
    getRewardHistory(memberId) {
      throw new Error('Not implemented');
    }
    getRewardSummary(memberId) {
      throw new Error('Not implemented');
    }
    hasRewardBeenGranted(memberId, rewardKeyOrCompletionId) {
      throw new Error('Not implemented');
    }
    previewQuestReward(questId) {
      throw new Error('Not implemented');
    }
  }

  // ============================================================
  // 10. PROTOTYPE REWARD AUTHORITY (Active Provider for Phase 0.23K)
  // ============================================================
  class PrototypeRewardAuthority extends BaseRewardAuthority {
    constructor() {
      super();
      this.active = true;
      this.name = 'PrototypeRewardAuthority';
      this.subscribers = new Set();
      this._initDefaultState();
    }

    _loadMemberFromStorage(memberId) {
      if (typeof localStorage === 'undefined') return null;
      try {
        const raw = localStorage.getItem('koinonia.reward_authority.' + memberId);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.memberId === memberId) {
          return parsed;
        }
      } catch (_) {}
      return null;
    }

    _saveMemberToStorage(memberId) {
      if (typeof localStorage === 'undefined') return;
      try {
        const mState = this.memberState[memberId];
        if (mState) {
          localStorage.setItem('koinonia.reward_authority.' + memberId, JSON.stringify(mState));
        }
      } catch (_) {}
    }

    _removeMemberFromStorage(memberId) {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.removeItem('koinonia.reward_authority.' + memberId);
      } catch (_) {}
    }

    _initDefaultState() {
      // Prototype state keyed strictly by canonical memberId
      this.memberState = {
        youth_demo_01: {
          memberId: 'youth_demo_01',
          lifePoints: 135,
          xp: 15,
          questsCompleted: 3,
          currentQuestStreak: 2,
          lastCompletedDate: '2026-09-02',
          milestones: ['first_quest', 'joined_campfire'],
          questProgress: {
            'Q-001': { status: 'COMPLETED', completedAt: '2026-09-01T10:00:00.000Z', completionId: 'fog:youth_demo_01:Q-001:v1', lifePoints: 5, xp: 5 },
            'Q-002': { status: 'COMPLETED', completedAt: '2026-09-01T14:00:00.000Z', completionId: 'fog:youth_demo_01:Q-002:v1', lifePoints: 5, xp: 5 },
            'Q-003': { status: 'COMPLETED', completedAt: '2026-09-02T10:00:00.000Z', completionId: 'fog:youth_demo_01:Q-003:v1', lifePoints: 5, xp: 5 }
          },
          rewardHistory: [
            createRewardHistoryEntry({
              memberId: 'youth_demo_01',
              questId: 'Q-001',
              type: REWARD_TYPES.QUEST_COMPLETION,
              completionId: 'fog:youth_demo_01:Q-001:v1',
              lifePointsDelta: 5,
              xpDelta: 5,
              milestoneIds: ['first_quest'],
              createdAt: '2026-09-01T10:00:00.000Z'
            }),
            createRewardHistoryEntry({
              memberId: 'youth_demo_01',
              questId: 'Q-002',
              type: REWARD_TYPES.QUEST_COMPLETION,
              completionId: 'fog:youth_demo_01:Q-002:v1',
              lifePointsDelta: 5,
              xpDelta: 5,
              milestoneIds: [],
              createdAt: '2026-09-01T14:00:00.000Z'
            }),
            createRewardHistoryEntry({
              memberId: 'youth_demo_01',
              questId: 'Q-003',
              type: REWARD_TYPES.QUEST_COMPLETION,
              completionId: 'fog:youth_demo_01:Q-003:v1',
              lifePointsDelta: 5,
              xpDelta: 5,
              milestoneIds: [],
              createdAt: '2026-09-02T10:00:00.000Z'
            })
          ]
        },
        admin_sarah: {
          memberId: 'admin_sarah',
          lifePoints: 320,
          xp: 50,
          questsCompleted: 12,
          currentQuestStreak: 5,
          lastCompletedDate: '2026-09-02',
          milestones: ['first_quest', 'joined_campfire', 'ministry_service'],
          questProgress: {},
          rewardHistory: []
        },
        father_alex: {
          memberId: 'father_alex',
          lifePoints: 500,
          xp: 85,
          questsCompleted: 25,
          currentQuestStreak: 14,
          lastCompletedDate: '2026-09-02',
          milestones: ['first_quest', 'joined_campfire', 'attended_gathering', 'growth_series_completed'],
          questProgress: {},
          rewardHistory: []
        }
      };

      // Hydrate from localStorage if persistent prototype record exists
      ['youth_demo_01', 'admin_sarah', 'father_alex'].forEach(mid => {
        const saved = this._loadMemberFromStorage(mid);
        if (saved) {
          this.memberState[mid] = saved;
        }
      });
    }

    _resolveMemberId(identity) {
      if (!identity) return null;
      if (typeof identity === 'string') return identity.trim();
      return identity.memberId || identity.id || null;
    }

    _isValidPrototypeMember(memberId) {
      if (!memberId) return false;
      const valid = ['youth_demo_01', 'admin_sarah', 'father_alex'];
      return valid.includes(memberId) || Boolean(this.memberState[memberId]);
    }

    resetMemberState(memberId, customState = null) {
      const mid = this._resolveMemberId(memberId);
      if (!mid) return;
      this._removeMemberFromStorage(mid);
      if (customState) {
        this.memberState[mid] = {
          memberId: mid,
          lifePoints: Math.max(0, customState.lifePoints || 0),
          xp: Math.max(0, customState.xp || 0),
          questsCompleted: Math.max(0, customState.questsCompleted || 0),
          currentQuestStreak: Math.max(0, customState.currentQuestStreak || 0),
          lastCompletedDate: customState.lastCompletedDate || null,
          milestones: Array.isArray(customState.milestones) ? [...customState.milestones] : [],
          questProgress: customState.questProgress ? JSON.parse(JSON.stringify(customState.questProgress)) : {},
          rewardHistory: Array.isArray(customState.rewardHistory) ? [...customState.rewardHistory] : []
        };
      } else {
        this._initDefaultState();
      }
      this._syncWithGrowthProfile(mid);
    }

    resetAll() {
      ['youth_demo_01', 'admin_sarah', 'father_alex'].forEach(mid => {
        this._removeMemberFromStorage(mid);
      });
      this._initDefaultState();
      if (KoinoniaGrowth && typeof KoinoniaGrowth.clearRuntimeProfile === 'function') {
        KoinoniaGrowth.clearRuntimeProfile();
      }
    }

    previewQuestReward(questId) {
      const qid = String(questId || '').trim();
      const trusted = TRUSTED_QUEST_REWARDS[qid] || dynamicStudioQuests[qid];
      if (!trusted) return null;
      return {
        questId: qid,
        title: trusted.title || qid,
        category: trusted.category || 'GENERAL',
        rewards: {
          lifePoints: trusted.rewards.lifePoints,
          xp: trusted.rewards.xp,
          milestoneIds: [...(trusted.rewards.milestoneIds || [])]
        }
      };
    }

    getQuestProgress(identity, questId) {
      const memberId = this._resolveMemberId(identity);
      const qid = String(questId || '').trim();

      if (!memberId || !this._isValidPrototypeMember(memberId)) {
        return normalizeQuestProgress(null, { memberId: memberId || 'guest_anonymous', questId: qid, status: 'NOT_STARTED' });
      }

      const mState = this.memberState[memberId] || { questProgress: {} };
      const rawProg = mState.questProgress ? mState.questProgress[qid] : null;

      if (!rawProg) {
        return normalizeQuestProgress(null, { memberId, questId: qid, status: 'NOT_STARTED' });
      }

      return normalizeQuestProgress(rawProg, { memberId, questId: qid });
    }

    hasRewardBeenGranted(identity, rewardKeyOrCompletionId) {
      const memberId = this._resolveMemberId(identity);
      if (!memberId || !this._isValidPrototypeMember(memberId)) return false;

      const mState = this.memberState[memberId];
      if (!mState || !Array.isArray(mState.rewardHistory)) return false;

      const key = String(rewardKeyOrCompletionId || '').trim();
      return mState.rewardHistory.some(entry => entry.completionId === key || entry.id === key);
    }

    getRewardHistory(identity) {
      const memberId = this._resolveMemberId(identity);
      if (!memberId || !this._isValidPrototypeMember(memberId)) return Object.freeze([]);

      const mState = this.memberState[memberId];
      if (!mState || !Array.isArray(mState.rewardHistory)) return Object.freeze([]);

      return Object.freeze([...mState.rewardHistory]);
    }

    getRewardHistoryEntry(identity, completionId) {
      const memberId = this._resolveMemberId(identity);
      if (!memberId || !this._isValidPrototypeMember(memberId)) return null;

      const mState = this.memberState[memberId];
      if (!mState || !Array.isArray(mState.rewardHistory)) return null;

      return mState.rewardHistory.find(entry => entry.completionId === completionId) || null;
    }

    getRewardSummary(identity) {
      const mid = this._resolveMemberId(identity);
      if (!mid || !this._isValidPrototypeMember(mid)) return null;
      const mState = this.memberState[mid];
      if (!mState) return null;
      return Object.freeze({
        memberId: mid,
        lifePoints: mState.lifePoints,
        xp: mState.xp,
        questsCompleted: mState.questsCompleted,
        currentQuestStreak: mState.currentQuestStreak,
        lastCompletedDate: mState.lastCompletedDate,
        milestones: Object.freeze([...mState.milestones])
      });
    }

    // ============================================================
    // GENERIC TRUSTED REWARD TRANSACTION CORE
    // ============================================================
    grantTrustedReward({ memberId, rewardType, sourceId, rewardDefinitionKey, idempotencyKey, context = {} }) {
      const mid = this._resolveMemberId(memberId);

      // 1. Validate member (Fail-closed)
      if (!mid || !this._isValidPrototypeMember(mid)) {
        return {
          success: false,
          error: `Member not found or unauthorized: ${mid}`,
          alreadyCompleted: false,
          completionId: null,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
        };
      }

      // 2. Determine authoritative reward definition based on rewardType
      let baseReward = null;
      let defaultTitle = sourceId;
      let defaultCategory = 'GENERAL';

      if (rewardType === REWARD_TYPES.QUEST_COMPLETION) {
        const trusted = TRUSTED_QUEST_REWARDS[sourceId] || dynamicStudioQuests[sourceId];
        baseReward = trusted ? trusted.rewards : null;
        defaultTitle = trusted?.title || sourceId;
        defaultCategory = trusted?.category || 'QUEST';
      } else if (rewardType === REWARD_TYPES.EVENT_ATTENDANCE) {
        const ev = TRUSTED_EVENT_REWARDS[sourceId] || TRUSTED_EVENT_REWARDS['default'];
        baseReward = ev.rewards;
        defaultTitle = ev.title;
        defaultCategory = 'EVENT';
      } else if (rewardType === REWARD_TYPES.ARCADE_COMPLETION) {
        const arc = TRUSTED_ARCADE_REWARDS[sourceId] || TRUSTED_ARCADE_REWARDS['default'];
        baseReward = arc.rewards;
        defaultTitle = arc.title;
        defaultCategory = 'ARCADE';
      } else if (rewardType === REWARD_TYPES.CHALLENGE_COMPLETION) {
        const chal = TRUSTED_CHALLENGE_REWARDS[sourceId] || TRUSTED_CHALLENGE_REWARDS['default'];
        baseReward = chal.rewards;
        defaultTitle = chal.title;
        defaultCategory = 'CHALLENGE';
      }

      if (!baseReward) {
        return {
          success: false,
          error: `Unknown reward source: ${sourceId} (${rewardType})`,
          alreadyCompleted: false,
          completionId: null,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
        };
      }

      // 3. Validate & clamp policy (ignores any client-provided amounts in context)
      const policyCheck = validateRewardPolicy(baseReward);
      if (!policyCheck.valid) {
        return {
          success: false,
          error: `Reward violates policy: ${policyCheck.error}`,
          alreadyCompleted: false,
          completionId: null,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
        };
      }

      const compId = idempotencyKey;

      // 4. Check Idempotency / duplicate completion
      if (this.hasRewardBeenGranted(mid, compId)) {
        return {
          success: true,
          alreadyCompleted: true,
          completionId: compId,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] },
          rewardHistoryEntry: this.getRewardHistoryEntry(mid, compId)
        };
      }

      const effectiveLp = policyCheck.effective.lifePoints;
      const effectiveXp = policyCheck.effective.xp;
      const mState = this.memberState[mid];

      // 5. Atomic Transaction Boundary — Snapshot for rollback
      const snapshot = {
        lifePoints: mState.lifePoints,
        xp: mState.xp,
        questsCompleted: mState.questsCompleted,
        currentQuestStreak: mState.currentQuestStreak,
        lastCompletedDate: mState.lastCompletedDate,
        questProgress: JSON.parse(JSON.stringify(mState.questProgress || {})),
        milestones: [...mState.milestones],
        rewardHistory: [...mState.rewardHistory]
      };

      try {
        // Milestone evaluations
        const newMilestoneIds = [];
        const existingMilestones = new Set(mState.milestones);
        if (Array.isArray(baseReward.milestoneIds)) {
          baseReward.milestoneIds.forEach(mId => {
            if (!existingMilestones.has(mId)) {
              newMilestoneIds.push(mId);
              mState.milestones.push(mId);
            }
          });
        }

        // Apply mutations
        mState.lifePoints = Math.max(0, mState.lifePoints + effectiveLp);
        mState.xp = Math.max(0, mState.xp + effectiveXp);

        // Append to reward history ledger
        const historyEntry = createRewardHistoryEntry({
          memberId: mid,
          questId: sourceId,
          type: rewardType,
          completionId: compId,
          lifePointsDelta: effectiveLp,
          xpDelta: effectiveXp,
          milestoneIds: newMilestoneIds,
          createdAt: context.timestamp || new Date().toISOString()
        });
        mState.rewardHistory.push(historyEntry);

        // Sync with Growth Profile & persist
        this._syncWithGrowthProfile(mid);
        this._saveMemberToStorage(mid);

        return {
          success: true,
          alreadyCompleted: false,
          completionId: compId,
          rewardsGranted: {
            lifePoints: effectiveLp,
            xp: effectiveXp,
            milestoneIds: newMilestoneIds
          },
          rewardHistoryEntry: historyEntry
        };
      } catch (err) {
        // Rollback
        mState.lifePoints = snapshot.lifePoints;
        mState.xp = snapshot.xp;
        mState.questsCompleted = snapshot.questsCompleted;
        mState.currentQuestStreak = snapshot.currentQuestStreak;
        mState.lastCompletedDate = snapshot.lastCompletedDate;
        mState.questProgress = snapshot.questProgress;
        mState.milestones = snapshot.milestones;
        mState.rewardHistory = snapshot.rewardHistory;

        try { this._syncWithGrowthProfile(mid); } catch (_) {}

        return {
          success: false,
          error: `Reward transaction failed and rolled back: ${err.message}`,
          alreadyCompleted: false,
          completionId: null,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
        };
      }
    }

    // Specialized Wrapper A: completeQuest
    completeQuest(identity, questId, completionContext = {}) {
      const memberId = this._resolveMemberId(identity);
      const qid = String(questId || '').trim();

      if (!memberId || !this._isValidPrototypeMember(memberId)) {
        return {
          success: false,
          error: `Member not found or unauthorized: ${memberId}`,
          alreadyCompleted: false,
          completionId: null,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
        };
      }

      const trustedDef = TRUSTED_QUEST_REWARDS[qid] || dynamicStudioQuests[qid];
      if (!trustedDef) {
        return {
          success: false,
          error: `Unknown quest: ${qid}`,
          alreadyCompleted: false,
          completionId: null,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
        };
      }

      const completionId = generateCompletionId(COMMUNITY_ID, memberId, qid);
      const mState = this.memberState[memberId];

      // Check Idempotency / duplicate completion
      const isAlreadyCompleted = (mState.questProgress[qid] && mState.questProgress[qid].status === 'COMPLETED') ||
                                 this.hasRewardBeenGranted(memberId, completionId);

      if (isAlreadyCompleted) {
        return {
          success: true,
          alreadyCompleted: true,
          completionId,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] },
          questProgress: this.getQuestProgress(memberId, qid),
          rewardHistoryEntry: this.getRewardHistoryEntry(memberId, completionId)
        };
      }

      // Snapshot for atomic rollback
      const snapshot = {
        lifePoints: mState.lifePoints,
        xp: mState.xp,
        questsCompleted: mState.questsCompleted,
        currentQuestStreak: mState.currentQuestStreak,
        lastCompletedDate: mState.lastCompletedDate,
        questProgress: JSON.parse(JSON.stringify(mState.questProgress || {})),
        milestones: [...mState.milestones],
        rewardHistory: [...mState.rewardHistory]
      };

      try {
        // Update streak
        const todayStr = completionContext.simulatedDate || getCanonicalDateString();
        const streakResult = calculateUpdatedStreak(mState.currentQuestStreak, mState.lastCompletedDate, todayStr);
        mState.currentQuestStreak = streakResult.streak;
        mState.lastCompletedDate = streakResult.lastCompletedDate;

        // Authoritative reward amounts
        const policyCheck = validateRewardPolicy(trustedDef.rewards);
        if (!policyCheck.valid) {
          throw new Error(policyCheck.error);
        }
        const effectiveLp = policyCheck.effective.lifePoints;
        const effectiveXp = policyCheck.effective.xp;

        mState.lifePoints = Math.max(0, mState.lifePoints + effectiveLp);
        mState.xp = Math.max(0, mState.xp + effectiveXp);
        mState.questsCompleted = Math.max(0, mState.questsCompleted + 1);

        // Milestone unlocks
        const completedQuestIds = Object.keys(mState.questProgress).filter(
          k => mState.questProgress[k].status === 'COMPLETED'
        );
        completedQuestIds.push(qid);

        const currentProfileMock = {
          activity: {
            questsCompleted: mState.questsCompleted - 1,
            currentQuestStreak: mState.currentQuestStreak
          },
          milestones: mState.milestones.map(id => ({ id }))
        };

        const newMilestoneIds = evaluateMilestones(memberId, qid, currentProfileMock, {
          updatedStreak: streakResult.streak,
          completedQuestIds
        });

        newMilestoneIds.forEach(mId => {
          if (!mState.milestones.includes(mId)) {
            mState.milestones.push(mId);
          }
        });

        // Record quest completion
        const completionTime = completionContext.completedAt || new Date().toISOString();
        mState.questProgress[qid] = {
          memberId,
          questId: qid,
          questType: trustedDef.questType || 'STANDARD',
          status: 'COMPLETED',
          completedAt: completionTime,
          completionId,
          rewards: {
            lifePoints: effectiveLp,
            xp: effectiveXp,
            milestoneIds: newMilestoneIds
          },
          progress: {
            current: 1,
            target: 1,
            percent: 100
          }
        };

        // Write to reward history
        const historyEntry = createRewardHistoryEntry({
          memberId,
          questId: qid,
          type: REWARD_TYPES.QUEST_COMPLETION,
          completionId,
          lifePointsDelta: effectiveLp,
          xpDelta: effectiveXp,
          milestoneIds: newMilestoneIds,
          createdAt: completionTime
        });
        mState.rewardHistory.push(historyEntry);

        this._syncWithGrowthProfile(memberId);
        this._saveMemberToStorage(memberId);

        return {
          success: true,
          alreadyCompleted: false,
          completionId,
          rewardsGranted: {
            lifePoints: effectiveLp,
            xp: effectiveXp,
            milestoneIds: newMilestoneIds
          },
          questProgress: this.getQuestProgress(memberId, qid),
          rewardHistoryEntry: historyEntry
        };
      } catch (err) {
        mState.lifePoints = snapshot.lifePoints;
        mState.xp = snapshot.xp;
        mState.questsCompleted = snapshot.questsCompleted;
        mState.currentQuestStreak = snapshot.currentQuestStreak;
        mState.lastCompletedDate = snapshot.lastCompletedDate;
        mState.questProgress = snapshot.questProgress;
        mState.milestones = snapshot.milestones;
        mState.rewardHistory = snapshot.rewardHistory;

        try { this._syncWithGrowthProfile(memberId); } catch (_) {}

        return {
          success: false,
          error: `Reward transaction failed and rolled back: ${err.message}`,
          alreadyCompleted: false,
          completionId: null,
          rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
        };
      }
    }

    // Specialized Wrapper B: recordEventAttendance
    recordEventAttendance(identity, eventId, context = {}) {
      const mid = this._resolveMemberId(identity);
      const eid = String(eventId || '').trim();
      const idempotencyKey = generateEventCompletionId(COMMUNITY_ID, mid, eid, context.dateStr);

      return this.grantTrustedReward({
        memberId: mid,
        rewardType: REWARD_TYPES.EVENT_ATTENDANCE,
        sourceId: eid,
        idempotencyKey,
        context
      });
    }

    // Specialized Wrapper C: recordArcadeReward
    recordArcadeReward(identity, gameId, context = {}) {
      const mid = this._resolveMemberId(identity);
      const gid = String(gameId || '').trim();
      const idempotencyKey = generateArcadeCompletionId(COMMUNITY_ID, mid, gid, context.dateStr);

      return this.grantTrustedReward({
        memberId: mid,
        rewardType: REWARD_TYPES.ARCADE_COMPLETION,
        sourceId: gid,
        idempotencyKey,
        context
      });
    }

    // Specialized Wrapper D: recordChallengeReward
    recordChallengeReward(identity, challengeId, context = {}) {
      const mid = this._resolveMemberId(identity);
      const cid = String(challengeId || '').trim();
      const idempotencyKey = generateChallengeCompletionId(COMMUNITY_ID, mid, cid);

      return this.grantTrustedReward({
        memberId: mid,
        rewardType: REWARD_TYPES.CHALLENGE_COMPLETION,
        sourceId: cid,
        idempotencyKey,
        context
      });
    }

    _syncWithGrowthProfile(memberId) {
      if (!KoinoniaGrowth || typeof KoinoniaGrowth.setRuntimeProfile !== 'function') return;

      const mState = this.memberState[memberId];
      if (!mState) return;

      const baseProfile = KoinoniaGrowth.PROTOTYPE_GROWTH_PROFILES[memberId] || {};
      const milestoneObjects = mState.milestones.map(mId => {
        const cat = KoinoniaGrowth.MILESTONE_CATALOG[mId];
        return {
          id: mId,
          title: cat ? cat.title : mId,
          description: cat ? cat.description : '',
          category: cat ? cat.category : 'GENERAL',
          icon: cat ? cat.icon : '🏆',
          achievedAt: new Date().toISOString()
        };
      });

      const updatedRaw = {
        memberId,
        identity: baseProfile.identity || { displayName: memberId },
        progression: {
          lifePoints: mState.lifePoints,
          xp: mState.xp
        },
        activity: {
          questsCompleted: mState.questsCompleted,
          currentQuestStreak: mState.currentQuestStreak,
          eventsAttended: baseProfile.activity?.eventsAttended || 0,
          serviceActivities: baseProfile.activity?.serviceActivities || 0
        },
        memberships: baseProfile.memberships || { ministries: [], campfires: [] },
        milestones: milestoneObjects,
        safeguards: baseProfile.safeguards || { isMinor: memberId === 'youth_demo_01' },
        source: 'prototype'
      };

      const normalized = KoinoniaGrowth.normalizeGrowthProfile(updatedRaw);
      KoinoniaGrowth.setRuntimeProfile(memberId, normalized);
    }
  }

  // ============================================================
  // 11. SHARED CORE REWARD AUTHORITY (Future Boundary — Fail Closed)
  // ============================================================
  class SharedCoreRewardAuthority extends BaseRewardAuthority {
    constructor() {
      super();
      this.enabled = false; // Strictly disabled in Phase 0.23K
      this.name = 'SharedCoreRewardAuthority';
    }

    getQuestProgress(identity, questId) {
      return normalizeQuestProgress(null, {
        memberId: identity?.memberId || identity?.id || 'guest_anonymous',
        questId,
        status: 'NOT_STARTED',
        source: 'shared-core'
      });
    }

    completeQuest(identity, questId, completionContext) {
      return {
        success: false,
        error: 'SharedCoreRewardAuthority is disabled in prototype mode',
        alreadyCompleted: false,
        completionId: null,
        rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
      };
    }

    recordEventAttendance(identity, eventId, context) {
      return {
        success: false,
        error: 'SharedCoreRewardAuthority is disabled in prototype mode',
        alreadyCompleted: false,
        completionId: null,
        rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
      };
    }

    recordArcadeReward(identity, gameId, context) {
      return {
        success: false,
        error: 'SharedCoreRewardAuthority is disabled in prototype mode',
        alreadyCompleted: false,
        completionId: null,
        rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
      };
    }

    recordChallengeReward(identity, challengeId, context) {
      return {
        success: false,
        error: 'SharedCoreRewardAuthority is disabled in prototype mode',
        alreadyCompleted: false,
        completionId: null,
        rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
      };
    }

    grantTrustedReward(params) {
      return {
        success: false,
        error: 'SharedCoreRewardAuthority is disabled in prototype mode',
        alreadyCompleted: false,
        completionId: null,
        rewardsGranted: { lifePoints: 0, xp: 0, milestoneIds: [] }
      };
    }

    getRewardHistory(identity) {
      return Object.freeze([]);
    }

    hasRewardBeenGranted(identity, rewardKeyOrCompletionId) {
      return false;
    }

    previewQuestReward(questId) {
      return null;
    }

    getRewardSummary(identity) {
      return null;
    }
  }

  // ============================================================
  // 12. UNIFIED KOINONIA REWARD AUTHORITY FACADE
  // ============================================================
  const defaultPrototypeAuthority = new PrototypeRewardAuthority();
  let activeAuthority = defaultPrototypeAuthority;

  const KoinoniaRewardAuthority = {
    COMMUNITY_ID,
    COMPLETION_VERSION,
    LIMITS,
    QUEST_STATUSES,
    REWARD_TYPES,
    TRUSTED_QUEST_REWARDS,
    TRUSTED_EVENT_REWARDS,
    TRUSTED_ARCADE_REWARDS,
    TRUSTED_CHALLENGE_REWARDS,

    // Core calculators & contracts
    validateRewardPolicy,
    generateCompletionId,
    generateEventCompletionId,
    generateArcadeCompletionId,
    generateChallengeCompletionId,
    normalizeQuestProgress,
    calculateUpdatedStreak,
    evaluateMilestones,
    createRewardHistoryEntry,

    // Provider abstractions
    BaseRewardAuthority,
    PrototypeRewardAuthority,
    SharedCoreRewardAuthority,

    // Authority management
    getAuthority() {
      return activeAuthority;
    },
    setAuthority(authority) {
      if (authority instanceof BaseRewardAuthority) {
        activeAuthority = authority;
      } else {
        throw new Error('Authority must extend BaseRewardAuthority');
      }
    },
    resetAuthority() {
      activeAuthority = defaultPrototypeAuthority;
      defaultPrototypeAuthority.resetAll();
    },
    resetMemberState(memberId, customState) {
      return activeAuthority.resetMemberState(memberId, customState);
    },

    // Delegation to active authority
    getQuestProgress(identity, questId) {
      return activeAuthority.getQuestProgress(identity, questId);
    },
    completeQuest(identity, questId, completionContext = {}) {
      return activeAuthority.completeQuest(identity, questId, completionContext);
    },
    recordEventAttendance(identity, eventId, context = {}) {
      return activeAuthority.recordEventAttendance(identity, eventId, context);
    },
    recordArcadeReward(identity, gameId, context = {}) {
      return activeAuthority.recordArcadeReward(identity, gameId, context);
    },
    recordChallengeReward(identity, challengeId, context = {}) {
      return activeAuthority.recordChallengeReward(identity, challengeId, context);
    },
    grantTrustedReward(params) {
      return activeAuthority.grantTrustedReward(params);
    },
    getRewardHistory(identity) {
      return activeAuthority.getRewardHistory(identity);
    },
    hasRewardBeenGranted(identity, rewardKeyOrCompletionId) {
      return activeAuthority.hasRewardBeenGranted(identity, rewardKeyOrCompletionId);
    },
    previewQuestReward(questId) {
      return activeAuthority.previewQuestReward(questId);
    },
    getRewardSummary(identity) {
      return activeAuthority.getRewardSummary(identity);
    },

    // Studio QUEST registration helper
    registerStudioQuest(questId, questDef) {
      if (!questId || !questDef) return { success: false, error: 'Invalid quest definition' };
      const qid = String(questId).trim();
      const policyCheck = validateRewardPolicy(questDef.rewards || { lifePoints: questDef.lifePoints, xp: questDef.characterXp });
      if (!policyCheck.valid) {
        return { success: false, error: policyCheck.error };
      }
      dynamicStudioQuests[qid] = Object.freeze({
        questId: qid,
        communityId: COMMUNITY_ID,
        title: questDef.title || qid,
        category: questDef.category || 'COMMUNITY',
        questType: 'STUDIO_QUEST',
        rewards: Object.freeze({
          lifePoints: policyCheck.effective.lifePoints,
          xp: policyCheck.effective.xp,
          milestoneIds: Object.freeze(questDef.milestoneIds || [])
        })
      });
      return {
        success: true,
        questId: qid,
        effectiveRewards: policyCheck.effective
      };
    },
    clearDynamicStudioQuests() {
      Object.keys(dynamicStudioQuests).forEach(k => delete dynamicStudioQuests[k]);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KoinoniaRewardAuthority;
  }
  if (typeof global !== 'undefined') {
    global.KoinoniaRewardAuthority = KoinoniaRewardAuthority;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
