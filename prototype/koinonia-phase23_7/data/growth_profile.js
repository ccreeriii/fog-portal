/**
 * KOINONIA — PHASE 0.23J MEMBER PROFILE & GROWTH JOURNEY FOUNDATION
 * Canonical Growth Profile Contract, Normalization Layer & Provider Abstraction
 *
 * Core Principles:
 * 1. Provider-Independent Growth Profile Contract.
 * 2. Strict Separation: Life Points (LP) currency vs. Character XP (Progression).
 * 3. Deterministic Level System (Explorer -> Builder; NO spiritual-worth scoring).
 * 4. Identity Scoping: Data strictly keyed by memberId; zero leakage between personas.
 * 5. Safe Milestones & Fellowship Readiness (Ministries & Campfires).
 * 6. Minor Safety: boolean isMinor, zero sensitive personal data.
 * 7. Read-Oriented Foundation: Zero client-side arbitrary rewards; fail-closed Shared Core.
 */

(function(global) {
  'use strict';

  // ============================================================
  // 1. CANONICAL CONSTANTS & LEVEL DEFINITIONS
  // ============================================================
  const COMMUNITY_ID = 'fog';

  /**
   * Deterministic Character Levels.
   * Uses community/journey growth terminology (NEVER religious rank or spiritual worth).
   */
  const GROWTH_LEVELS = Object.freeze([
    Object.freeze({
      level: 1,
      minXp: 0,
      title: 'New Explorer',
      description: 'Beginning your journey of fellowship, stewardship, and community.',
      unlockedPerk: 'Journey Journal Started'
    }),
    Object.freeze({
      level: 2,
      minXp: 10,
      title: 'Active Explorer',
      description: 'Taking faithful, consistent steps in daily duties and learning.',
      unlockedPerk: 'Journey Explorer Badge'
    }),
    Object.freeze({
      level: 3,
      minXp: 25,
      title: 'Community Adventurer',
      description: 'Deepening fellowship and service across community spaces.',
      unlockedPerk: 'Community Adventure Accent'
    }),
    Object.freeze({
      level: 4,
      minXp: 45,
      title: 'Seasoned Adventurer',
      description: 'A reliable helper and faithful contributor in youth and family life.',
      unlockedPerk: 'Seasoned Contributor Badge'
    }),
    Object.freeze({
      level: 5,
      minXp: 70,
      title: 'Journey Builder',
      description: 'Inspiring peers through quiet, sustained diligence and mentorship.',
      unlockedPerk: 'Journey Builder Profile Accent'
    })
  ]);

  /**
   * Canonical Milestone Catalog.
   * Milestones represent concrete participation, attendance, service, and diligence.
   */
  const MILESTONE_CATALOG = Object.freeze({
    first_quest: Object.freeze({
      id: 'first_quest',
      category: 'QUEST',
      title: 'First Quest Completed',
      description: 'Completed your first community or devotional quest.',
      icon: '✨'
    }),
    joined_campfire: Object.freeze({
      id: 'joined_campfire',
      category: 'FELLOWSHIP',
      title: 'Joined a Campfire',
      description: 'Connected with brothers and sisters in a campfire circle.',
      icon: '🔥'
    }),
    attended_gathering: Object.freeze({
      id: 'attended_gathering',
      category: 'COMMUNITY',
      title: 'Participated in a Gathering',
      description: 'Joined church gathering or community fellowship.',
      icon: '⛪'
    }),
    growth_series_completed: Object.freeze({
      id: 'growth_series_completed',
      category: 'DISCIPLESHIP',
      title: 'Completed a Growth Series',
      description: 'Steadfastly walked through an entire growth journey.',
      icon: '📜'
    }),
    ministry_service: Object.freeze({
      id: 'ministry_service',
      category: 'SERVICE',
      title: 'Served in a Ministry Activity',
      description: 'Offered time and hands to serve the body of Christ.',
      icon: '🤝'
    }),
    quest_streak_3: Object.freeze({
      id: 'quest_streak_3',
      category: 'DILIGENCE',
      title: '3-Day Quest Streak',
      description: 'Maintained quiet daily consistency in your walk.',
      icon: '⚡'
    })
  });

  const SENSITIVE_PROFILE_KEYS = new Set([
    'password', 'token', 'access_token', 'refresh_token', 'secret',
    'bearer', 'authorization', 'cookie', 'session', 'hash', 'private_key',
    'birthdate', 'dob', 'dateOfBirth', 'ssn', 'phone', 'address'
  ]);

  // ============================================================
  // 2. DETERMINISTIC LEVEL & PROGRESS CALCULATOR
  // ============================================================
  function calculateLevel(xp) {
    const numXp = Math.max(0, Math.floor(Number(xp) || 0));
    for (let i = GROWTH_LEVELS.length - 1; i >= 0; i--) {
      if (numXp >= GROWTH_LEVELS[i].minXp) {
        return GROWTH_LEVELS[i].level;
      }
    }
    return 1;
  }

  function getLevelDefinition(level) {
    const lvl = Math.max(1, Math.min(GROWTH_LEVELS.length, Math.floor(Number(level) || 1)));
    return GROWTH_LEVELS.find(l => l.level === lvl) || GROWTH_LEVELS[0];
  }

  function getLevelProgress(xp) {
    const numXp = Math.max(0, Math.floor(Number(xp) || 0));
    const currentLevel = calculateLevel(numXp);
    const currentDef = getLevelDefinition(currentLevel);
    const maxLevel = GROWTH_LEVELS[GROWTH_LEVELS.length - 1].level;
    const isMaxLevel = currentLevel >= maxLevel;

    const nextDef = isMaxLevel ? null : getLevelDefinition(currentLevel + 1);
    const currentLevelMinXp = currentDef.minXp;
    const nextLevelThreshold = nextDef ? nextDef.minXp : currentLevelMinXp;

    const xpInLevel = numXp - currentLevelMinXp;
    const xpNeededForLevel = nextDef ? (nextLevelThreshold - currentLevelMinXp) : 0;
    const xpRemaining = nextDef ? Math.max(0, nextLevelThreshold - numXp) : 0;

    let progressPercent = 100;
    if (!isMaxLevel && xpNeededForLevel > 0) {
      progressPercent = Math.min(100, Math.max(0, Math.round((xpInLevel / xpNeededForLevel) * 100)));
    }

    return {
      level: currentLevel,
      levelTitle: currentDef.title,
      description: currentDef.description,
      totalXp: numXp,
      currentLevelXp: currentLevelMinXp,
      nextLevelXp: nextLevelThreshold,
      xpInLevel: xpInLevel,
      xpNeededForLevel: xpNeededForLevel,
      xpRemaining: xpRemaining,
      progressPercent: progressPercent,
      isMaxLevel: isMaxLevel,
      unlockedPerk: currentDef.unlockedPerk,
      nextPerk: nextDef ? nextDef.unlockedPerk : null
    };
  }

  // ============================================================
  // 3. CANONICAL GROWTH PROFILE NORMALIZATION
  // ============================================================
  function createGuestGrowthProfile(reason = 'Unauthenticated guest') {
    const progress = getLevelProgress(0);
    return Object.freeze({
      memberId: 'guest_anonymous',
      communityId: COMMUNITY_ID,
      identity: Object.freeze({
        displayName: 'Guest Pilgrim',
        avatarUrl: null,
        avatarEmoji: '👤'
      }),
      progression: Object.freeze({
        lifePoints: 0,
        xp: 0,
        level: progress.level,
        levelTitle: progress.levelTitle,
        currentLevelXp: progress.currentLevelXp,
        nextLevelXp: progress.nextLevelXp,
        progressPercent: progress.progressPercent
      }),
      activity: Object.freeze({
        questsCompleted: 0,
        currentQuestStreak: 0,
        eventsAttended: 0,
        serviceActivities: 0
      }),
      memberships: Object.freeze({
        ministries: Object.freeze([]),
        campfires: Object.freeze([])
      }),
      milestones: Object.freeze([]),
      safeguards: Object.freeze({
        isMinor: null
      }),
      source: 'prototype',
      readOnly: true,
      guestReason: reason
    });
  }

  function normalizeGrowthProfile(raw, identityContext) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      if (identityContext && (identityContext.memberId || identityContext.id)) {
        raw = { memberId: identityContext.memberId || identityContext.id };
      } else {
        return createGuestGrowthProfile('Missing or malformed profile payload');
      }
    }

    // 1. Resolve memberId
    const rawId = raw.memberId || raw.id || (identityContext && (identityContext.memberId || identityContext.id));
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      return createGuestGrowthProfile('Missing memberId');
    }
    const memberId = rawId.trim();

    // 2. Identity
    const displayName = (
      raw.identity?.displayName ||
      raw.displayName ||
      identityContext?.displayName ||
      identityContext?.name ||
      'Community Member'
    ).trim();

    const avatarUrl = (raw.identity?.avatarUrl || raw.avatarUrl || identityContext?.profile?.avatarUrl || null);
    const avatarEmoji = (raw.identity?.avatarEmoji || raw.avatarEmoji || raw.avatar || identityContext?.profile?.avatarEmoji || '🧑');

    // 3. Progression (LP and XP)
    const rawLp = raw.progression?.lifePoints ?? raw.lifePoints ?? raw.lp ?? 0;
    const lifePoints = Math.max(0, Math.floor(Number(rawLp) || 0));

    const rawXp = raw.progression?.xp ?? raw.xp ?? raw.charXp ?? 0;
    const xp = Math.max(0, Math.floor(Number(rawXp) || 0));

    const progress = getLevelProgress(xp);

    // 4. Activity
    const questsCompleted = Math.max(0, Math.floor(Number(raw.activity?.questsCompleted ?? raw.questsCompleted ?? 0)));
    const currentQuestStreak = Math.max(0, Math.floor(Number(raw.activity?.currentQuestStreak ?? raw.currentQuestStreak ?? 0)));
    const eventsAttended = Math.max(0, Math.floor(Number(raw.activity?.eventsAttended ?? raw.eventsAttended ?? 0)));
    const serviceActivities = Math.max(0, Math.floor(Number(raw.activity?.serviceActivities ?? raw.serviceActivities ?? 0)));

    // 5. Memberships (Ministries & Campfires)
    const rawMinistries = raw.memberships?.ministries || raw.ministries || identityContext?.memberships?.ministries || [];
    const ministries = Array.isArray(rawMinistries) ? rawMinistries.map(m => {
      if (typeof m === 'string') return { id: m, name: m, role: 'MEMBER' };
      return {
        id: String(m.id || m.ministryId || 'ministry_general').trim(),
        name: String(m.name || m.title || 'Ministry').trim(),
        role: String(m.role || 'MEMBER').trim().toUpperCase()
      };
    }) : [];

    const rawCampfires = raw.memberships?.campfires || raw.campfires || identityContext?.memberships?.campfires || [];
    const campfires = Array.isArray(rawCampfires) ? rawCampfires.map(c => {
      if (typeof c === 'string') return { id: c, name: c, role: 'MEMBER' };
      return {
        id: String(c.id || c.campfireId || 'campfire_general').trim(),
        name: String(c.name || c.title || 'Campfire').trim(),
        role: String(c.role || 'MEMBER').trim().toUpperCase()
      };
    }) : [];

    // 6. Milestones
    const rawMilestones = raw.milestones || [];
    const milestones = Array.isArray(rawMilestones) ? rawMilestones.map(m => {
      const catalogEntry = MILESTONE_CATALOG[m.id] || null;
      return {
        id: String(m.id || 'milestone_unknown').trim(),
        title: String(m.title || (catalogEntry ? catalogEntry.title : 'Milestone')).trim(),
        description: String(m.description || (catalogEntry ? catalogEntry.description : '')).trim(),
        category: String(m.category || (catalogEntry ? catalogEntry.category : 'GENERAL')).trim().toUpperCase(),
        icon: String(m.icon || (catalogEntry ? catalogEntry.icon : '🏆')).trim(),
        achievedAt: (typeof m.achievedAt === 'string' && m.achievedAt) ? m.achievedAt : null
      };
    }) : [];

    // 7. Safeguards & Minor Safety
    let isMinor = null;
    if (raw.safeguards && typeof raw.safeguards.isMinor === 'boolean') {
      isMinor = raw.safeguards.isMinor;
    } else if (identityContext?.safeguards && typeof identityContext.safeguards.isMinor === 'boolean') {
      isMinor = identityContext.safeguards.isMinor;
    } else if (typeof raw.isMinor === 'boolean') {
      isMinor = raw.isMinor;
    }

    // 8. Source & Mutability
    const source = (raw.source === 'shared-core') ? 'shared-core' : 'prototype';

    // Verify zero sensitive properties leaked
    const sanitizedObj = {
      memberId: memberId,
      communityId: COMMUNITY_ID,
      identity: Object.freeze({
        displayName: displayName,
        avatarUrl: avatarUrl ? String(avatarUrl).trim() : null,
        avatarEmoji: avatarEmoji
      }),
      progression: Object.freeze({
        lifePoints: lifePoints,
        xp: xp,
        level: progress.level,
        levelTitle: progress.levelTitle,
        currentLevelXp: progress.currentLevelXp,
        nextLevelXp: progress.nextLevelXp,
        progressPercent: progress.progressPercent
      }),
      activity: Object.freeze({
        questsCompleted: questsCompleted,
        currentQuestStreak: currentQuestStreak,
        eventsAttended: eventsAttended,
        serviceActivities: serviceActivities
      }),
      memberships: Object.freeze({
        ministries: Object.freeze(ministries.map(m => Object.freeze(m))),
        campfires: Object.freeze(campfires.map(c => Object.freeze(c)))
      }),
      milestones: Object.freeze(milestones.map(m => Object.freeze(m))),
      safeguards: Object.freeze({
        isMinor: isMinor
      }),
      source: source,
      readOnly: true
    };

    return Object.freeze(sanitizedObj);
  }

  // ============================================================
  // 4. DETERMINISTIC CANONICAL PROTOTYPE PROFILES
  // ============================================================
  const PROTOTYPE_GROWTH_PROFILES = Object.freeze({
    youth_demo_01: Object.freeze(normalizeGrowthProfile({
      memberId: 'youth_demo_01',
      identity: {
        displayName: 'Alex Rivera',
        avatarEmoji: '🧑',
        avatarUrl: null
      },
      progression: {
        lifePoints: 135,
        xp: 15
      },
      activity: {
        questsCompleted: 3,
        currentQuestStreak: 2,
        eventsAttended: 1,
        serviceActivities: 1
      },
      memberships: {
        ministries: [
          { id: 'ministry_seraphs', name: 'Seraphs Music Ministry', role: 'MEMBER' }
        ],
        campfires: [
          { id: 'cf_alpha_seed', name: 'Fire of God Alpha Seed', role: 'MEMBER' }
        ]
      },
      milestones: [
        {
          id: 'first_quest',
          title: 'First Quest Completed',
          description: 'Completed your first community or devotional quest.',
          category: 'QUEST',
          icon: '✨',
          achievedAt: '2026-09-01T10:00:00.000Z'
        },
        {
          id: 'joined_campfire',
          title: 'Joined a Campfire',
          description: 'Connected with brothers and sisters in a campfire circle.',
          category: 'FELLOWSHIP',
          icon: '🔥',
          achievedAt: '2026-09-02T14:30:00.000Z'
        }
      ],
      safeguards: { isMinor: true },
      source: 'prototype'
    })),

    admin_sarah: Object.freeze(normalizeGrowthProfile({
      memberId: 'admin_sarah',
      identity: {
        displayName: 'Sarah Jenkins',
        avatarEmoji: '👩‍💼',
        avatarUrl: null
      },
      progression: {
        lifePoints: 320,
        xp: 50
      },
      activity: {
        questsCompleted: 12,
        currentQuestStreak: 5,
        eventsAttended: 4,
        serviceActivities: 6
      },
      memberships: {
        ministries: [
          { id: 'ministry_shepherd', name: 'Youth Shepherding', role: 'LEADER' }
        ],
        campfires: [
          { id: 'cf_beacon', name: 'Beacon Youth Fellowship', role: 'MENTOR' }
        ]
      },
      milestones: [
        {
          id: 'first_quest',
          title: 'First Quest Completed',
          description: 'Completed your first community or devotional quest.',
          category: 'QUEST',
          icon: '✨',
          achievedAt: '2026-08-15T09:00:00.000Z'
        },
        {
          id: 'joined_campfire',
          title: 'Joined a Campfire',
          description: 'Connected with brothers and sisters in a campfire circle.',
          category: 'FELLOWSHIP',
          icon: '🔥',
          achievedAt: '2026-08-16T11:00:00.000Z'
        },
        {
          id: 'ministry_service',
          title: 'Served in a Ministry Activity',
          description: 'Offered time and hands to serve the body of Christ.',
          category: 'SERVICE',
          icon: '🤝',
          achievedAt: '2026-08-20T16:00:00.000Z'
        }
      ],
      safeguards: { isMinor: false },
      source: 'prototype'
    })),

    father_alex: Object.freeze(normalizeGrowthProfile({
      memberId: 'father_alex',
      identity: {
        displayName: 'Father Alex',
        avatarEmoji: '👑',
        avatarUrl: null
      },
      progression: {
        lifePoints: 500,
        xp: 85
      },
      activity: {
        questsCompleted: 25,
        currentQuestStreak: 14,
        eventsAttended: 10,
        serviceActivities: 15
      },
      memberships: {
        ministries: [
          { id: 'ministry_pastoral', name: 'Pastoral Care', role: 'OVERSEER' },
          { id: 'ministry_leadership', name: 'Elders Council', role: 'FATHER' }
        ],
        campfires: [
          { id: 'cf_council', name: 'Council Fire', role: 'OVERSEER' }
        ]
      },
      milestones: [
        {
          id: 'first_quest',
          title: 'First Quest Completed',
          description: 'Completed your first community or devotional quest.',
          category: 'QUEST',
          icon: '✨',
          achievedAt: '2026-07-01T08:00:00.000Z'
        },
        {
          id: 'joined_campfire',
          title: 'Joined a Campfire',
          description: 'Connected with brothers and sisters in a campfire circle.',
          category: 'FELLOWSHIP',
          icon: '🔥',
          achievedAt: '2026-07-02T12:00:00.000Z'
        },
        {
          id: 'attended_gathering',
          title: 'Participated in a Gathering',
          description: 'Joined church gathering or community fellowship.',
          category: 'COMMUNITY',
          icon: '⛪',
          achievedAt: '2026-07-07T09:00:00.000Z'
        },
        {
          id: 'growth_series_completed',
          title: 'Completed a Growth Series',
          description: 'Steadfastly walked through an entire growth journey.',
          category: 'DISCIPLESHIP',
          icon: '📜',
          achievedAt: '2026-07-15T18:00:00.000Z'
        }
      ],
      safeguards: { isMinor: false },
      source: 'prototype'
    }))
  });

  // ============================================================
  // 5. GROWTH PROVIDER ABSTRACTION INTERFACE
  // ============================================================
  class BaseGrowthProvider {
    getGrowthProfile(identity) {
      throw new Error('Not implemented');
    }
    getLifePoints(identity) {
      const p = this.getGrowthProfile(identity);
      return p ? p.progression.lifePoints : 0;
    }
    getXp(identity) {
      const p = this.getGrowthProfile(identity);
      return p ? p.progression.xp : 0;
    }
    getLevelProgress(identity) {
      const p = this.getGrowthProfile(identity);
      return p ? p.progression : getLevelProgress(0);
    }
    getMilestones(identity) {
      const p = this.getGrowthProfile(identity);
      return p ? p.milestones : [];
    }
    getMemberships(identity) {
      const p = this.getGrowthProfile(identity);
      return p ? p.memberships : { ministries: [], campfires: [] };
    }
    subscribeGrowthChanges(callback) {
      return () => {};
    }
  }

  // Provider A: PrototypeGrowthProvider (Active for Phase 0.23J)
  class PrototypeGrowthProvider extends BaseGrowthProvider {
    constructor() {
      super();
      this.subscribers = new Set();
    }

    _resolveMemberId(identity) {
      if (!identity) return null;
      if (typeof identity === 'string') return identity.trim();
      return identity.memberId || identity.id || null;
    }

    getGrowthProfile(identity) {
      const memberId = this._resolveMemberId(identity);
      if (!memberId) {
        return createGuestGrowthProfile('No identity supplied');
      }

      if (PROTOTYPE_GROWTH_PROFILES[memberId]) {
        return PROTOTYPE_GROWTH_PROFILES[memberId];
      }

      // Safe fallback guest profile for unrecognized memberId
      return createGuestGrowthProfile('Unrecognized prototype member: ' + memberId);
    }

    subscribeGrowthChanges(callback) {
      if (typeof callback !== 'function') return () => {};
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }

    notifySubscribers(profile) {
      this.subscribers.forEach(cb => {
        try { cb(profile); } catch (err) { console.error('Growth subscriber error:', err); }
      });
    }
  }

  // Provider B: SharedCoreGrowthProvider (Future Stage 3 Boundary)
  class SharedCoreGrowthProvider extends BaseGrowthProvider {
    constructor() {
      super();
      this.enabled = false; // Strictly disabled in Phase 0.23J
    }

    getGrowthProfile(identity) {
      // Fails closed to unauthenticated guest profile; ZERO network calls to Main App
      return createGuestGrowthProfile('SharedCore growth provider is disabled in prototype mode');
    }

    async fetchGrowthProfile(identity) {
      // Fails closed; ZERO network calls
      return createGuestGrowthProfile('SharedCore growth provider is disabled in prototype mode');
    }
  }

  // ============================================================
  // 6. UNIFIED KOINONIA GROWTH MANAGER
  // ============================================================
  const defaultPrototypeProvider = new PrototypeGrowthProvider();
  let activeProvider = defaultPrototypeProvider;

  const KoinoniaGrowth = {
    COMMUNITY_ID,
    GROWTH_LEVELS,
    MILESTONE_CATALOG,
    PROTOTYPE_GROWTH_PROFILES,
    BaseGrowthProvider,
    PrototypeGrowthProvider,
    SharedCoreGrowthProvider,

    // Core calculators & normalizers
    calculateLevel,
    getLevelDefinition,
    calculateLevelProgress: getLevelProgress,
    getLevelProgress(xpOrIdentity) {
      if (typeof xpOrIdentity === 'number') {
        return getLevelProgress(xpOrIdentity);
      }
      return activeProvider.getLevelProgress(xpOrIdentity);
    },
    normalizeGrowthProfile,
    createGuestGrowthProfile,

    // Provider delegation
    getProvider() {
      return activeProvider;
    },
    setProvider(provider) {
      if (provider instanceof BaseGrowthProvider) {
        activeProvider = provider;
      } else {
        throw new Error('Provider must extend BaseGrowthProvider');
      }
    },
    getGrowthProfile(identity) {
      return activeProvider.getGrowthProfile(identity);
    },
    getLifePoints(identity) {
      return activeProvider.getLifePoints(identity);
    },
    getXp(identity) {
      return activeProvider.getXp(identity);
    },
    getMilestones(identity) {
      return activeProvider.getMilestones(identity);
    },
    getMemberships(identity) {
      return activeProvider.getMemberships(identity);
    },
    subscribeGrowthChanges(cb) {
      return activeProvider.subscribeGrowthChanges(cb);
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KoinoniaGrowth;
  }
  if (typeof global !== 'undefined') {
    global.KoinoniaGrowth = KoinoniaGrowth;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
