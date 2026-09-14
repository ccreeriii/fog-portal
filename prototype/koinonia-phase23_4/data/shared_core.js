/**
 * KOINONIA — PHASE 0.20.1
 * SHARED CORE DOMAIN PROVIDER (LOCAL / MOCK PROVIDER)
 *
 * Official Architecture:
 * - One Community: Fire of God
 * - One Member Identity: Alex Rivera (youth_demo_01)
 * - One Shared Core Data: Life Points, Milestones, Attendance, Events, Campfires, Ministries
 * - Two Experiences: Main FOG App (Growth-focused) & Koinonia (Experience-focused)
 *
 * NOTE: This is Stage 1 of the migration strategy.
 * It provides a clean provider abstraction backed by local deterministic memory / localStorage,
 * completely isolated from staging / production backends.
 */

(function(root) {
  'use strict';

  const STORAGE_KEY = 'koinonia.phase20_1.shared_core';

  // Canonical Baseline Constants
  const BASELINE_MEMBER = {
    id: 'youth_demo_01',
    name: 'Alex Rivera',
    username: 'alex_r',
    role: 'MEMBER',
    ageGroup: 'YOUTH',
    avatar: 'seedling',
    bio: 'Young Pilgrim walking in faith and stewardship.'
  };

  const BASELINE_LP = 135;
  const BASELINE_XP = 15;
  const BASELINE_LEVEL = 2;
  const BASELINE_XP_MAX = 20;

  // Capacity Constants
  const MIN_CAMPFIRE_CAPACITY = 5;
  const DEFAULT_CAMPFIRE_MAX = 12;
  const DEFAULT_COMMUNITY_MAX = 12;

  // Canonical Reactions
  const CANONICAL_REACTIONS = {
    '👏': { id: 'ENCOURAGE', emoji: '👏', label: 'Encourage' },
    '🙏': { id: 'PRAYING', emoji: '🙏', label: 'Praying' },
    '🔥': { id: 'KEEP_GOING', emoji: '🔥', label: 'Keep Going' },
    '🌱': { id: 'GROWING_TOGETHER', emoji: '🌱', label: 'Growing Together' },
    '❤️': { id: 'GREAT_JOB', emoji: '❤️', label: 'Great Job' }
  };

  // Activity Event Types
  const ACTIVITY_EVENT_TYPES = {
    QUEST_COMPLETED: 'QUEST_COMPLETED',
    EVENT_CHECKED_IN: 'EVENT_CHECKED_IN',
    MINISTRY_SERVICE_COMPLETED: 'MINISTRY_SERVICE_COMPLETED',
    FIT_QUEST_PB_SET: 'FIT_QUEST_PB_SET',
    CAMPFIRE_QUEST_COMPLETED: 'CAMPFIRE_QUEST_COMPLETED',
    MILESTONE_UNLOCKED: 'MILESTONE_UNLOCKED'
  };

  // Canonical Quests Catalog
  const CANONICAL_QUESTS = [
    {
      id: 'Q-001',
      title: 'Steward of the Garden',
      subtitle: 'Home Living Water Calling',
      description: 'Water the potted plants at home to care for living creation right outside your window.',
      category: 'STEWARDSHIP',
      rewards: {
        lp: 5,
        charXp: 5,
        stewardshipXp: 15,
        responsibilityXp: 5
      }
    },
    {
      id: 'Q-002',
      title: 'The Living Word',
      subtitle: 'Scripture Devotional Reflection',
      description: 'Spend 5 quiet minutes with today’s Gospel reading and write a prayer of thanks.',
      category: 'PRAYER',
      rewards: {
        lp: 5,
        charXp: 5,
        reflectionXp: 15,
        disciplineXp: 5
      }
    },
    {
      id: 'Q-003',
      title: 'Campfire Fellowship Gathering',
      subtitle: 'Small Group Encouragement',
      description: 'Join your weekly Campfire, listen attentively, and share one encouragement.',
      category: 'FELLOWSHIP',
      rewards: {
        lp: 5,
        charXp: 5,
        teamworkXp: 15,
        serviceXp: 5
      }
    },
    {
      id: 'Q-004',
      title: 'Altar Linen & Sanctuary Care',
      subtitle: 'Sacred Reverence Calling',
      description: 'Assist in straightening hymnals and wiping down church benches after Mass.',
      category: 'SERVICE',
      rewards: {
        lp: 5,
        charXp: 5,
        serviceXp: 15,
        responsibilityXp: 5
      }
    },
    {
      id: 'Q-005',
      title: 'Daily Examen Reflection',
      subtitle: 'Evening Heart Review',
      description: 'Review where God was present in your day and let go of resentment before rest.',
      category: 'REFLECTION',
      rewards: {
        lp: 5,
        charXp: 5,
        reflectionXp: 15,
        disciplineXp: 5
      }
    }
  ];

  // Canonical Events Catalog
  const CANONICAL_EVENTS = [
    {
      id: 'alpha_session_event',
      name: 'Alpha Youth Series — Session 1',
      subtitle: 'Faith, Life, and God: Open Discussion',
      description: 'Interactive discussion with snacks, videos, and small group fireside chat.',
      scheduleMode: 'BATCH_INSTANCES',
      startTime: '15:00',
      timeZone: 'Asia/Manila',
      venue: 'Youth Hall',
      eventPoints: 10
    },
    {
      id: 'youth_hangouts',
      name: 'Youth Hangouts & Fellowship',
      subtitle: 'Monthly Community Gathering',
      description: 'Fun games, acoustic worship, and fireside fellowship on the first Saturday.',
      scheduleMode: 'RECURRING',
      recurrence: '1st Saturday of Month',
      startTime: '15:00',
      timeZone: 'Asia/Manila',
      venue: 'Community Amphitheater',
      eventPoints: 10
    },
    {
      id: 'get_into_the_glory',
      name: 'Get Into the Glory',
      shortName: 'GiG',
      subtitle: 'Worship, Intercession & Fellowship Gathering',
      description: 'Youth praise & worship, adoration, and sacrament of reconciliation.',
      scheduleMode: 'CONFIG_REQUIRED',
      startTime: null,
      timeZone: 'Asia/Manila',
      venue: 'Main Sanctuary',
      eventPoints: 15
    },
    {
      id: 'alpha_youth_day',
      name: 'Alpha Youth Day',
      subtitle: 'Holy Spirit Retreat Day',
      description: 'A dedicated Saturday retreat reflecting on the Holy Spirit.',
      scheduleMode: 'BATCH_INSTANCES',
      startTime: '08:30',
      timeZone: 'Asia/Manila',
      venue: 'Retreat Center Grounds',
      eventPoints: 25
    },
    {
      id: 'demo_fellowship_night',
      name: 'Demo Youth Fellowship Night',
      subtitle: 'Local QA Test Event',
      description: 'QA test event instance for testing shared attendance check-in.',
      scheduleMode: 'SINGLE',
      startTime: '18:00',
      timeZone: 'Asia/Manila',
      venue: 'Demo Fellowship Grounds',
      eventPoints: 5
    }
  ];

  // Canonical Demo Ministries
  const CANONICAL_MINISTRIES = [
    {
      id: 'ministry_seraphs',
      name: 'Seraphs Music Ministry',
      description: 'Youth choir, musicians, and praise leaders serving liturgical celebrations.',
      leader: 'Brother Julian',
      missions: [
        {
          id: 'MM-001',
          title: 'Sacred Harmonies Rehearsal',
          description: 'Practice hymns and psalm responses with reverence before Sunday liturgy.',
          rewards: { lp: 5, charXp: 5, serviceXp: 15 }
        }
      ]
    },
    {
      id: 'ministry_lighthouse',
      name: 'Lighthouse Creative & Media',
      description: 'Youth creatives, photographers, and documenters capturing community testimonies.',
      leader: 'Sister Claire',
      missions: [
        {
          id: 'MM-002',
          title: 'Gospel Light Documentation',
          description: 'Take thoughtful photos and archive memorable testimonies of community grace.',
          rewards: { lp: 5, charXp: 5, serviceXp: 15 }
        }
      ]
    },
    {
      id: 'ministry_genesis',
      name: 'Genesis Events & Liturgy',
      description: 'Sacristans, ushers, and logistics coordinators supporting sacred gatherings.',
      leader: 'Deacon Mark',
      missions: [
        {
          id: 'MM-003',
          title: 'Altar & Sanctuary Preparation',
          description: 'Ensure candles, bulletins, and vessels are set with quiet attentiveness.',
          rewards: { lp: 5, charXp: 5, serviceXp: 15 }
        }
      ]
    },
    {
      id: 'ministry_hospitality',
      name: 'Food & Hospitality Ministry',
      description: 'Agape table hospitality, fellowship snacks, and welcoming newcomer youth.',
      leader: 'Auntie Maria',
      missions: [
        {
          id: 'MM-004',
          title: 'Agape Table Hospitality',
          description: 'Set out bread and clean water to warmly welcome everyone after fellowship.',
          rewards: { lp: 5, charXp: 5, serviceXp: 15 }
        }
      ]
    }
  ];

  // Canonical 19 Milestones Catalog
  const CANONICAL_MILESTONES = [
    { id: 'm_welcome_pilgrim', name: 'Welcome, Pilgrim', trigger: 'GAME_STARTED', xp: 5 },
    { id: 'm_first_step', name: 'First Steps in Koinonia', trigger: 'PLACE_VISITED', count: 1, xp: 5 },
    { id: 'm_all_places_visited', name: 'Fellowship Explorer', trigger: 'PLACE_VISITED', count: 5, xp: 15 },
    { id: 'm_quest_first_complete', name: 'First Calling Answered', trigger: 'QUEST_COMPLETED', count: 1, xp: 10 },
    { id: 'm_quest_three_complete', name: 'Faithful in Small Things', trigger: 'QUEST_COMPLETED', count: 3, xp: 15 },
    { id: 'm_quest_all_complete', name: 'Fullness of Calling', trigger: 'QUEST_COMPLETED', count: 5, xp: 25 },
    { id: 'm_level_2_reached', name: 'Growing Disciple', trigger: 'LEVEL_REACHED', level: 2, xp: 10 },
    { id: 'm_level_3_reached', name: 'Mature Steward', trigger: 'LEVEL_REACHED', level: 3, xp: 15 },
    { id: 'm_campaign_start', name: 'Pilgrimage Begun', trigger: 'CAMPAIGN_STARTED', xp: 5 },
    { id: 'm_campaign_3_chapters', name: 'Rooted in the Journey', trigger: 'CAMPAIGN_CHAPTERS', count: 3, xp: 10 },
    { id: 'm_campaign_complete', name: 'Alpha Youth Finisher', trigger: 'CAMPAIGN_COMPLETED', xp: 20 },
    { id: 'm_first_event_attended', name: 'Gathered in His Name', trigger: 'EVENT_ATTENDED', count: 1, xp: 10 },
    { id: 'm_three_events_attended', name: 'Faithful in Community', trigger: 'EVENT_ATTENDED', count: 3, xp: 15 },
    { id: 'm_circle_joined', name: 'Gathered at the Hearth', trigger: 'CIRCLE_JOINED', count: 1, xp: 10 },
    { id: 'm_circle_quest_complete', name: 'Walking Together', trigger: 'CIRCLE_QUEST_COMPLETED', count: 1, xp: 15 },
    { id: 'm_first_fitquest_virtual', name: 'Strong in the Lord', trigger: 'FITQUEST_VIRTUAL', count: 1, xp: 5 },
    { id: 'm_first_fitquest_realworld', name: 'Temple of the Holy Spirit', trigger: 'FITQUEST_REALWORLD', count: 1, xp: 10 },
    { id: 'm_first_arcade_played', name: 'Joyful in Fellowship', trigger: 'ARCADE_PLAYED', count: 1, xp: 5 },
    { id: 'm_first_journey_reflection', name: 'Treasured in the Heart', trigger: 'REFLECTION_LOGGED', count: 1, xp: 10 }
  ];

  /**
   * Local Shared Core Provider Class
   */
  class LocalSharedCoreProvider {
    constructor() {
      this._state = this._loadInitialState();
    }

    _loadInitialState() {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            return JSON.parse(raw);
          }
        } catch (e) {
          console.warn('[SharedCore] Failed to load from localStorage:', e);
        }
      }
      return this._createDefaultState();
    }

    _createDefaultState() {
      return {
        schemaVersion: 1,
        member: { ...BASELINE_MEMBER },
        lifePoints: {
          balance: BASELINE_LP,
          charLevel: BASELINE_LEVEL,
          charXp: BASELINE_XP,
          charXpMax: BASELINE_XP_MAX,
          stewardshipXp: 15,
          responsibilityXp: 15,
          disciplineXp: 0,
          teamworkXp: 0,
          serviceXp: 0,
          reflectionXp: 0,
          ledger: [
            {
              id: 'tx_baseline_01',
              idempotencyKey: 'init:baseline',
              amount: BASELINE_LP,
              charXp: BASELINE_XP,
              stewardshipXp: 15,
              responsibilityXp: 15,
              reason: 'Baseline Pilgrim Initial Balance (Level 2)',
              source: 'SYSTEM',
              timestamp: '2026-09-06T00:00:00.000Z'
            }
          ]
        },
        questCompletions: {}, // questId:memberId -> CompletionRecord
        attendanceRecords: {}, // eventInstanceId:memberId -> AttendanceRecord
        campfireSettings: {
          minCapacity: MIN_CAMPFIRE_CAPACITY,
          defaultMaxCapacity: DEFAULT_CAMPFIRE_MAX,
          communityMaxCapacity: DEFAULT_COMMUNITY_MAX
        },
        campfires: [
          {
            id: 'cf_alpha_seed',
            communityId: 'fog',
            name: 'St. Ignatius Youth Campfire',
            description: 'A welcoming circle of young stewards walking together in faith.',
            leaderIds: ['youth_leader_01'],
            memberIds: ['youth_leader_01', 'youth_02', 'youth_03', 'youth_04', 'youth_demo_01'], // 5 members (Active)
            maxParticipants: DEFAULT_CAMPFIRE_MAX,
            status: 'ACTIVE',
            createdAt: '2026-09-01T10:00:00.000Z',
            meetingSchedule: 'Saturday 4:00 PM',
            venue: 'Youth Hall / Campfire Grounds'
          }
        ],
        campfireGameStates: {
          cf_alpha_seed: {
            campfireId: 'cf_alpha_seed',
            assignedQuestIds: ['Q-001', 'Q-002'],
            completedQuestIds: [],
            reactions: { '👏': 3, '🙏': 5, '🔥': 8, '🌱': 2, '❤️': 4 },
            activityLog: [
              {
                id: 'log_seed_01',
                type: 'CAMPFIRE_ACTIVATED',
                timestamp: '2026-09-01T10:00:00.000Z',
                message: 'St. Ignatius Youth Campfire reached 5 members and activated!'
              },
              {
                id: 'log_seed_02',
                type: 'QUEST_ASSIGNED',
                questId: 'Q-001',
                timestamp: '2026-09-01T10:15:00.000Z',
                message: 'Quest #001 Steward of the Garden assigned to Campfire.'
              }
            ]
          }
        },
        ministryMemberships: [
          {
            ministryId: 'ministry_seraphs',
            memberId: 'youth_demo_01',
            role: 'MEMBER',
            joinedAt: '2026-09-01T10:00:00.000Z'
          }
        ],
        activityEvents: []
      };
    }

    _save() {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this._state));
        } catch (e) {
          console.warn('[SharedCore] Failed to save to localStorage:', e);
        }
      }
    }

    /**
     * Reset to clean QA Baseline
     */
    resetToBaseline() {
      this._state = this._createDefaultState();
      this._save();
      return {
        success: true,
        message: 'Shared Core successfully reset to clean QA baseline (Level 2, 135 LP, 15 XP).'
      };
    }

    // ==========================================
    // 1. MEMBER IDENTITY
    // ==========================================
    getCurrentMember() {
      return JSON.parse(JSON.stringify(this._state.member));
    }

    // ==========================================
    // 2. LIFE POINTS & XP LEDGER (IDEMPOTENT)
    // ==========================================
    getLifePoints() {
      return {
        balance: this._state.lifePoints.balance,
        charLevel: this._state.lifePoints.charLevel,
        charXp: this._state.lifePoints.charXp,
        charXpMax: this._state.lifePoints.charXpMax,
        stewardshipXp: this._state.lifePoints.stewardshipXp || 0,
        responsibilityXp: this._state.lifePoints.responsibilityXp || 0,
        disciplineXp: this._state.lifePoints.disciplineXp || 0,
        teamworkXp: this._state.lifePoints.teamworkXp || 0,
        serviceXp: this._state.lifePoints.serviceXp || 0,
        reflectionXp: this._state.lifePoints.reflectionXp || 0,
        ledger: JSON.parse(JSON.stringify(this._state.lifePoints.ledger))
      };
    }

    /**
     * Award Life Points with idempotent transaction checking
     */
    awardLifePoints(params = {}) {
      const {
        amount = 0,
        charXp = 0,
        stewardshipXp = 0,
        responsibilityXp = 0,
        disciplineXp = 0,
        teamworkXp = 0,
        serviceXp = 0,
        reflectionXp = 0,
        reason = 'Activity Reward',
        source = 'KOINONIA',
        idempotencyKey = null,
        metadata = {}
      } = params;

      // Idempotency check
      if (idempotencyKey) {
        const existingTx = this._state.lifePoints.ledger.find(tx => tx.idempotencyKey === idempotencyKey);
        if (existingTx) {
          return {
            success: true,
            duplicate: true,
            balance: this._state.lifePoints.balance,
            awarded: 0,
            charXpAwarded: 0,
            transaction: existingTx,
            message: 'Transaction already processed with idempotencyKey: ' + idempotencyKey + '. No duplicate LP awarded.'
          };
        }
      }

      // Apply LP balance change
      this._state.lifePoints.balance += amount;

      // Apply Character XP and level progression
      this._state.lifePoints.charXp += charXp;
      while (this._state.lifePoints.charXp >= this._state.lifePoints.charXpMax) {
        this._state.lifePoints.charXp -= this._state.lifePoints.charXpMax;
        this._state.lifePoints.charLevel += 1;
        this._state.lifePoints.charXpMax = Math.round(this._state.lifePoints.charXpMax * 1.5);
      }

      // Apply domain skill XP
      this._state.lifePoints.stewardshipXp = (this._state.lifePoints.stewardshipXp || 0) + stewardshipXp;
      this._state.lifePoints.responsibilityXp = (this._state.lifePoints.responsibilityXp || 0) + responsibilityXp;
      this._state.lifePoints.disciplineXp = (this._state.lifePoints.disciplineXp || 0) + disciplineXp;
      this._state.lifePoints.teamworkXp = (this._state.lifePoints.teamworkXp || 0) + teamworkXp;
      this._state.lifePoints.serviceXp = (this._state.lifePoints.serviceXp || 0) + serviceXp;
      this._state.lifePoints.reflectionXp = (this._state.lifePoints.reflectionXp || 0) + reflectionXp;

      const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        idempotencyKey: idempotencyKey || ('tx_auto_' + Date.now()),
        amount,
        charXp,
        stewardshipXp,
        responsibilityXp,
        disciplineXp,
        teamworkXp,
        serviceXp,
        reflectionXp,
        reason,
        source,
        metadata,
        timestamp: new Date().toISOString()
      };

      this._state.lifePoints.ledger.push(newTx);
      this._save();

      return {
        success: true,
        duplicate: false,
        balance: this._state.lifePoints.balance,
        charLevel: this._state.lifePoints.charLevel,
        charXp: this._state.lifePoints.charXp,
        awarded: amount,
        charXpAwarded: charXp,
        transaction: newTx,
        message: 'Awarded +' + amount + ' LP and +' + charXp + ' XP (' + reason + ').'
      };
    }

    // ==========================================
    // 3. QUESTS & COMPLETIONS (IDEMPOTENT)
    // ==========================================
    getQuests() {
      return JSON.parse(JSON.stringify(CANONICAL_QUESTS));
    }

    getQuest(questId) {
      const q = CANONICAL_QUESTS.find(item => item.id === questId);
      return q ? JSON.parse(JSON.stringify(q)) : null;
    }

    getQuestCompletion(questId, memberId = null) {
      const targetMemberId = memberId || this._state.member.id;
      const key = `${questId}:${targetMemberId}`;
      const record = this._state.questCompletions[key];
      return record ? JSON.parse(JSON.stringify(record)) : null;
    }

    completeQuest(params = {}) {
      const {
        questId,
        memberId = this._state.member.id,
        source = 'KOINONIA',
        verificationMethod = 'IN_PERSON_MANUAL',
        idempotencyKey = null
      } = params;

      const effectiveKey = idempotencyKey || ('quest_completion:' + questId + ':' + memberId);
      const storageKey = questId + ':' + memberId;

      // Check if already completed
      const existing = this._state.questCompletions[storageKey];
      if (existing) {
        return {
          success: true,
          alreadyCompleted: true,
          completion: JSON.parse(JSON.stringify(existing)),
          lpResult: {
            balance: this._state.lifePoints.balance,
            awarded: 0,
            duplicate: true,
            message: 'Quest already completed. No duplicate rewards awarded.'
          }
        };
      }

      const quest = this.getQuest(questId);
      if (!quest) {
        return { success: false, error: 'Quest not found: ' + questId };
      }

      // Award canonical rewards
      const lpResult = this.awardLifePoints({
        amount: quest.rewards.lp || 0,
        charXp: quest.rewards.charXp || 0,
        stewardshipXp: quest.rewards.stewardshipXp || 0,
        responsibilityXp: quest.rewards.responsibilityXp || 0,
        disciplineXp: quest.rewards.disciplineXp || 0,
        teamworkXp: quest.rewards.teamworkXp || 0,
        serviceXp: quest.rewards.serviceXp || 0,
        reflectionXp: quest.rewards.reflectionXp || 0,
        reason: 'Completed Quest: ' + quest.title,
        source,
        idempotencyKey: 'lp_reward:' + effectiveKey,
        metadata: { questId, memberId }
      });

      const completionRecord = {
        id: 'qc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        questId,
        memberId,
        completedAt: new Date().toISOString(),
        source,
        verificationMethod,
        idempotencyKey: effectiveKey,
        rewards: { ...quest.rewards }
      };

      this._state.questCompletions[storageKey] = completionRecord;

      // Also record an activity event
      this.emitActivityEvent({
        eventType: ACTIVITY_EVENT_TYPES.QUEST_COMPLETED,
        payload: { questId, memberId, rewards: quest.rewards },
        idempotencyKey: 'act:' + effectiveKey
      });

      this._save();

      return {
        success: true,
        alreadyCompleted: false,
        completion: completionRecord,
        lpResult
      };
    }

    // ==========================================
    // 4. EVENTS & ATTENDANCE / CHECK-IN (IDEMPOTENT)
    // ==========================================
    getEvents() {
      return JSON.parse(JSON.stringify(CANONICAL_EVENTS));
    }

    getEvent(eventId) {
      const evt = CANONICAL_EVENTS.find(e => e.id === eventId);
      return evt ? JSON.parse(JSON.stringify(evt)) : null;
    }

    getAttendance(eventInstanceId, memberId = null) {
      const targetMemberId = memberId || this._state.member.id;
      const key = eventInstanceId + ':' + targetMemberId;
      const record = this._state.attendanceRecords[key];
      return record ? JSON.parse(JSON.stringify(record)) : null;
    }

    getAllAttendanceRecords() {
      return Object.values(this._state.attendanceRecords).map(r => JSON.parse(JSON.stringify(r)));
    }

    checkIn(params = {}) {
      const {
        eventInstanceId,
        memberId = this._state.member.id,
        source = 'KOINONIA',
        verificationMethod = 'IN_PERSON_SELF',
        idempotencyKey = null
      } = params;

      const effectiveKey = idempotencyKey || ('checkin:' + eventInstanceId + ':' + memberId);
      const storageKey = eventInstanceId + ':' + memberId;

      // Check if already checked in
      const existing = this._state.attendanceRecords[storageKey];
      if (existing) {
        return {
          success: true,
          alreadyCheckedIn: true,
          record: JSON.parse(JSON.stringify(existing)),
          message: 'Already checked in to ' + eventInstanceId + '. No duplicate attendance recorded.'
        };
      }

      const attendanceRecord = {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        eventInstanceId,
        memberId,
        checkedInAt: new Date().toISOString(),
        source,
        verificationMethod,
        idempotencyKey: effectiveKey
      };

      this._state.attendanceRecords[storageKey] = attendanceRecord;

      // Emit activity event
      this.emitActivityEvent({
        eventType: ACTIVITY_EVENT_TYPES.EVENT_CHECKED_IN,
        payload: { eventInstanceId, memberId },
        idempotencyKey: 'act:' + effectiveKey
      });

      this._save();

      return {
        success: true,
        alreadyCheckedIn: false,
        record: attendanceRecord,
        message: 'Successfully checked in to ' + eventInstanceId + '.'
      };
    }

    // ==========================================
    // 5. CAMPFIRE UNIFICATION & GAMEPLAY
    // ==========================================
    getMyCampfires(memberId = null) {
      const targetMemberId = memberId || this._state.member.id;
      return this._state.campfires
        .filter(c => c.memberIds.includes(targetMemberId) || c.leaderIds.includes(targetMemberId))
        .map(c => JSON.parse(JSON.stringify(c)));
    }

    getCampfire(campfireId) {
      const c = this._state.campfires.find(item => item.id === campfireId);
      return c ? JSON.parse(JSON.stringify(c)) : null;
    }

    getCampfireMembers(campfireId) {
      const campfire = this.getCampfire(campfireId);
      return campfire ? campfire.memberIds : [];
    }

    getCampfireLeaders(campfireId) {
      const campfire = this.getCampfire(campfireId);
      return campfire ? campfire.leaderIds : [];
    }

    getCampfireGameState(campfireId) {
      const gs = this._state.campfireGameStates[campfireId];
      return gs ? JSON.parse(JSON.stringify(gs)) : null;
    }

    getCampfireSettings() {
      return JSON.parse(JSON.stringify(this._state.campfireSettings));
    }

    setCommunityMaxParticipants(adminMax) {
      const max = parseInt(adminMax, 10);
      if (isNaN(max) || max < MIN_CAMPFIRE_CAPACITY) {
        return {
          success: false,
          error: 'Community max participants must be at least ' + MIN_CAMPFIRE_CAPACITY + '.'
        };
      }

      this._state.campfireSettings.communityMaxCapacity = max;
      this._save();

      return {
        success: true,
        communityMaxCapacity: max,
        message: 'Community max capacity updated to ' + max + '.'
      };
    }

    setCampfireCapacity(campfireId, requestedMax, actorRole = 'LEADER') {
      const campfire = this._state.campfires.find(c => c.id === campfireId);
      if (!campfire) {
        return { success: false, error: 'Campfire not found: ' + campfireId };
      }

      // Member cannot modify capacity
      if (actorRole !== 'LEADER' && actorRole !== 'ADMIN') {
        return {
          success: false,
          error: 'Only a Campfire Leader or Administrator can modify circle capacity.'
        };
      }

      const newMax = parseInt(requestedMax, 10);
      const communityMax = this._state.campfireSettings.communityMaxCapacity || DEFAULT_COMMUNITY_MAX;

      if (isNaN(newMax) || newMax < MIN_CAMPFIRE_CAPACITY) {
        return {
          success: false,
          error: 'Capacity cannot be set below minimum activation limit (' + MIN_CAMPFIRE_CAPACITY + ').'
        };
      }

      // Over-community rejection
      if (newMax > communityMax) {
        return {
          success: false,
          error: 'Requested capacity (' + newMax + ') exceeds community maximum (' + communityMax + ').'
        };
      }

      // Active campfire lowering protection
      const currentMemberCount = campfire.memberIds.length;
      if (campfire.status === 'ACTIVE' && newMax < currentMemberCount) {
        return {
          success: false,
          error: 'Cannot reduce capacity (' + newMax + ') below current active member count (' + currentMemberCount + ').'
        };
      }

      campfire.maxParticipants = newMax;
      this._save();

      return {
        success: true,
        maxParticipants: newMax,
        message: 'Campfire capacity successfully set to ' + newMax + '.'
      };
    }

    addReactionToCampfire(campfireId, emoji) {
      if (!CANONICAL_REACTIONS[emoji]) {
        return {
          success: false,
          error: 'Emoji ' + emoji + ' is not an authorized structured reaction. Only predefined encouraging reactions are permitted.'
        };
      }

      const gs = this._state.campfireGameStates[campfireId];
      if (!gs) {
        return { success: false, error: 'Campfire game state not found for: ' + campfireId };
      }

      gs.reactions[emoji] = (gs.reactions[emoji] || 0) + 1;
      gs.activityLog.unshift({
        id: 'react_' + Date.now(),
        type: 'REACTION_SENT',
        emoji,
        timestamp: new Date().toISOString(),
        message: 'Encouragement sent: ' + emoji + ' (' + CANONICAL_REACTIONS[emoji].label + ')'
      });

      this._save();

      return {
        success: true,
        reactions: { ...gs.reactions },
        message: 'Sent ' + emoji + ' encouragement to Campfire!'
      };
    }

    // ==========================================
    // 6. MINISTRIES & MINISTERIAL MISSIONS
    // ==========================================
    getMinistries() {
      return JSON.parse(JSON.stringify(CANONICAL_MINISTRIES));
    }

    getMyMinistries(memberId = null) {
      const targetMemberId = memberId || this._state.member.id;
      const myMemberships = this._state.ministryMemberships.filter(m => m.memberId === targetMemberId);
      const ministryIds = myMemberships.map(m => m.ministryId);

      return CANONICAL_MINISTRIES
        .filter(min => ministryIds.includes(min.id))
        .map(min => JSON.parse(JSON.stringify(min)));
    }

    getMinistryMissions(ministryId) {
      const min = CANONICAL_MINISTRIES.find(m => m.id === ministryId);
      return min ? JSON.parse(JSON.stringify(min.missions || [])) : [];
    }

    getMyMinistryMissions(memberId = null) {
      const myMinistries = this.getMyMinistries(memberId);
      const allMissions = [];
      myMinistries.forEach(min => {
        (min.missions || []).forEach(m => {
          allMissions.push({
            ...m,
            ministryId: min.id,
            ministryName: min.name
          });
        });
      });
      return allMissions;
    }

    // ==========================================
    // 7. MILESTONES & GROWTH
    // ==========================================
    getMilestones() {
      return JSON.parse(JSON.stringify(CANONICAL_MILESTONES));
    }

    getGrowthProgress() {
      return {
        completedQuestsCount: Object.keys(this._state.questCompletions).length,
        eventsAttendedCount: Object.keys(this._state.attendanceRecords).length,
        campfiresJoinedCount: this.getMyCampfires().length,
        charLevel: this._state.lifePoints.charLevel,
        charXp: this._state.lifePoints.charXp
      };
    }

    // ==========================================
    // 8. ACTIVITY EVENT BUS (CONCEPTUAL INTEGRATION)
    // ==========================================
    emitActivityEvent(params = {}) {
      const { eventType, payload = {}, idempotencyKey = null } = params;

      if (idempotencyKey) {
        const existing = this._state.activityEvents.find(e => e.idempotencyKey === idempotencyKey);
        if (existing) {
          return { success: true, duplicate: true, event: existing };
        }
      }

      const event = {
        id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        eventType,
        payload,
        idempotencyKey,
        timestamp: new Date().toISOString()
      };

      this._state.activityEvents.push(event);
      this._save();

      return { success: true, duplicate: false, event };
    }

    getActivityEvents() {
      return JSON.parse(JSON.stringify(this._state.activityEvents));
    }

    /**
     * Capability Metadata (Phase 0.23B)
     */
    getCapabilities() {
      return {
        providerMode: 'local',
        remote: false,
        authenticated: false,
        readsEnabled: true,
        mutations: true,
        mutationsEnabled: true,
        lifePointsWrite: true,
        attendanceWrite: true,
        questCompletionWrite: true,
        campfireCapacityWrite: true,
        reactionsWrite: true,
        activityEventsWrite: true
      };
    }

    get capabilities() {
      return this.getCapabilities();
    }
  }

  // Safe factory resolver
  function createSharedCoreProvider(options) {
    if (typeof require !== 'undefined') {
      try {
        const factory = require('./shared_core_provider.js');
        return factory.createSharedCoreProvider(options);
      } catch (_) {}
    }
    if (typeof root !== 'undefined' && root.createSharedCoreProvider) {
      return root.createSharedCoreProvider(options);
    }
    return new LocalSharedCoreProvider(options);
  }

  // Singleton instance creation
  const sharedCoreInstance = new LocalSharedCoreProvider();

  // Export for Browser and Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      LocalSharedCoreProvider,
      sharedCore: sharedCoreInstance,
      SharedCore: sharedCoreInstance,
      createSharedCoreProvider,
      BASELINE_MEMBER,
      BASELINE_LP,
      BASELINE_XP,
      BASELINE_LEVEL,
      BASELINE_XP_MAX,
      MIN_CAMPFIRE_CAPACITY,
      DEFAULT_CAMPFIRE_MAX,
      DEFAULT_COMMUNITY_MAX,
      CANONICAL_REACTIONS,
      ACTIVITY_EVENT_TYPES,
      CANONICAL_QUESTS,
      CANONICAL_EVENTS,
      CANONICAL_MINISTRIES,
      CANONICAL_MILESTONES
    };
  }

  if (typeof root !== 'undefined') {
    root.LocalSharedCoreProvider = LocalSharedCoreProvider;
    root.SharedCore = sharedCoreInstance;
    root.createSharedCoreProvider = createSharedCoreProvider;
  }

})(typeof window !== 'undefined' ? window : global);
