/**
 * KOINONIA — PHASE 0.19 MEMORIES & MY JOURNEY DATA STORE
 * Architecture: Dedicated Memory Engine, Deduplication, Place History,
 * Event Memory Pages, Private Reflection, and Journey QA Baseline.
 *
 * Core Principle: "A virtual world that grows when you grow in real life."
 * My Journey connects: real-world action -> virtual achievement -> remembered experience -> personal reflection.
 *
 * Privacy: All personal journey memories & reflections are PRIVATE BY DEFAULT.
 * Indicator: "🔒 Private to you"
 * Economy: Memory creation awards 0 LP, 0 Character XP, 0 Growth XP.
 */

(function () {
  'use strict';

  // ============================================================
  // 1. CANONICAL MEMORY & SOURCE TYPES
  // ============================================================
  const MEMORY_TYPES = {
    QUEST_COMPLETED: 'QUEST_COMPLETED',
    EVENT_ATTENDED: 'EVENT_ATTENDED',
    PERSONAL_BEST: 'PERSONAL_BEST',
    PLACE_DISCOVERED: 'PLACE_DISCOVERED',
    MILESTONE_UNLOCKED: 'MILESTONE_UNLOCKED',
    REFLECTION: 'REFLECTION'
  };

  const SOURCE_TYPES = {
    QUEST: 'QUEST',
    EVENT: 'EVENT',
    FIT_QUEST: 'FIT_QUEST',
    PLACE: 'PLACE',
    MILESTONE: 'MILESTONE',
    MANUAL_REFLECTION: 'MANUAL_REFLECTION'
  };

  const PRIVACY_LEVELS = {
    PRIVATE: 'PRIVATE'
  };

  const PRIVACY_LABEL = '🔒 Private to you';

  const CANONICAL_PLACES = {
    my_home: { id: 'my_home', name: 'My Home', icon: '🌱', zone: 'Garden Veranda & Hearth' },
    school: { id: 'school', name: 'School', icon: '📚', zone: 'Courtyard & Library' },
    fog_center: { id: 'fog_center', name: 'FOG Community Center', icon: '🏛️', zone: 'Youth Hall & Sanctuary' },
    sports_hub: { id: 'sports_hub', name: 'Sports Hub', icon: '🏀', zone: 'Courts & Track' },
    outreach_site: { id: 'outreach_site', name: 'Outreach Site', icon: '🤝', zone: 'Barangay Hope Care Center' }
  };

  // ============================================================
  // 2. TIMESTAMPS & FORMATTING (Asia/Manila UTC+08:00)
  // ============================================================
  function getManilaIsoTimestamp(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    // Offset +08:00 in milliseconds = 8 * 60 * 60 * 1000 = 28800000 ms
    const utcTime = d.getTime() + (d.getTimezoneOffset() * 60000);
    const manilaTime = new Date(utcTime + 28800000);

    const year = manilaTime.getFullYear();
    const month = pad(manilaTime.getMonth() + 1);
    const day = pad(manilaTime.getDate());
    const hours = pad(manilaTime.getHours());
    const mins = pad(manilaTime.getMinutes());
    const secs = pad(manilaTime.getSeconds());

    return `${year}-${month}-${day}T${hours}:${mins}:${secs}+08:00`;
  }

  function formatMemoryDate(isoStr) {
    if (!isoStr) return '--';
    try {
      const parts = isoStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthNum = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[monthNum] || ''} ${day}, ${year}`;
      }
      return isoStr;
    } catch (e) {
      return isoStr;
    }
  }

  // ============================================================
  // 3. CANONICAL MEMORY FACTORY
  // ============================================================
  let memoryIdCounter = 1;

  function createMemory(params = {}) {
    const now = getManilaIsoTimestamp();
    const id = params.id || `mem_${Date.now()}_${memoryIdCounter++}`;

    return {
      id: String(id),
      communityId: 'fog',
      memoryType: params.memoryType || MEMORY_TYPES.QUEST_COMPLETED,
      sourceType: params.sourceType || SOURCE_TYPES.QUEST,
      sourceId: params.sourceId ? String(params.sourceId) : '',
      title: params.title || 'New Journey Memory',
      subtitle: params.subtitle || '',
      description: params.description || '',
      placeId: params.placeId || (params.sourceType === SOURCE_TYPES.PLACE ? params.sourceId : 'fog_center'),
      occurredAt: params.occurredAt || now,
      createdAt: params.createdAt || now,
      icon: params.icon || '📖',
      tags: Array.isArray(params.tags) ? [...params.tags] : [],
      privacy: PRIVACY_LEVELS.PRIVATE,
      reflectionText: typeof params.reflectionText === 'string' ? params.reflectionText.trim() : null,
      metadata: params.metadata && typeof params.metadata === 'object' ? Object.assign({}, params.metadata) : {},
      isDemo: Boolean(params.isDemo)
    };
  }

  // ============================================================
  // 4. MEMORY DEDUPLICATION & ADDITION API
  // ============================================================
  /**
   * Deterministic Deduplication Rule:
   * - QUEST_COMPLETED: 1 per questId (sourceId)
   * - EVENT_ATTENDED: 1 per eventInstanceId (sourceId)
   * - PLACE_DISCOVERED: 1 per placeId (sourceId)
   * - MILESTONE_UNLOCKED: 1 per milestoneId (sourceId)
   * - PERSONAL_BEST: Only created if this attempt was an improvement over previous PB!
   *   If exact same score or worse, no duplicate.
   */
  function shouldCreateMemory(state, params = {}) {
    if (!state) return { allow: false, reason: 'NO_STATE' };
    const memories = state.memories || [];
    const mType = params.memoryType;
    const sType = params.sourceType;
    const sId = params.sourceId ? String(params.sourceId) : '';

    if (mType === MEMORY_TYPES.QUEST_COMPLETED || sType === SOURCE_TYPES.QUEST) {
      const exists = memories.some(m =>
        (m.memoryType === MEMORY_TYPES.QUEST_COMPLETED || m.sourceType === SOURCE_TYPES.QUEST) &&
        String(m.sourceId) === sId
      );
      if (exists) return { allow: false, reason: 'QUEST_ALREADY_REMEMBERED' };
      return { allow: true };
    }

    if (mType === MEMORY_TYPES.EVENT_ATTENDED || sType === SOURCE_TYPES.EVENT) {
      const exists = memories.some(m =>
        (m.memoryType === MEMORY_TYPES.EVENT_ATTENDED || m.sourceType === SOURCE_TYPES.EVENT) &&
        String(m.sourceId) === sId
      );
      if (exists) return { allow: false, reason: 'EVENT_ALREADY_REMEMBERED' };
      return { allow: true };
    }

    if (mType === MEMORY_TYPES.PLACE_DISCOVERED || sType === SOURCE_TYPES.PLACE) {
      const exists = memories.some(m =>
        (m.memoryType === MEMORY_TYPES.PLACE_DISCOVERED || m.sourceType === SOURCE_TYPES.PLACE) &&
        String(m.sourceId) === sId
      );
      if (exists) return { allow: false, reason: 'PLACE_ALREADY_DISCOVERED' };
      return { allow: true };
    }

    if (mType === MEMORY_TYPES.MILESTONE_UNLOCKED || sType === SOURCE_TYPES.MILESTONE) {
      const exists = memories.some(m =>
        (m.memoryType === MEMORY_TYPES.MILESTONE_UNLOCKED || m.sourceType === SOURCE_TYPES.MILESTONE) &&
        String(m.sourceId) === sId
      );
      if (exists) return { allow: false, reason: 'MILESTONE_ALREADY_REMEMBERED' };
      return { allow: true };
    }

    if (mType === MEMORY_TYPES.PERSONAL_BEST || sType === SOURCE_TYPES.FIT_QUEST) {
      // Must have isPersonalBest true in metadata
      if (params.metadata && params.metadata.isPersonalBest === false) {
        return { allow: false, reason: 'NOT_A_PERSONAL_BEST' };
      }
      // Check if duplicate for exact challenge and score
      const newScore = params.metadata ? params.metadata.newScore : undefined;
      const exactDuplicate = memories.some(m =>
        (m.memoryType === MEMORY_TYPES.PERSONAL_BEST || m.sourceType === SOURCE_TYPES.FIT_QUEST) &&
        String(m.sourceId) === sId &&
        m.metadata && m.metadata.newScore === newScore
      );
      if (exactDuplicate) return { allow: false, reason: 'PB_SCORE_ALREADY_RECORDED' };
      return { allow: true };
    }

    // Default allow for other custom memories
    return { allow: true };
  }

  function addMemoryIfNew(state, memoryParams = {}) {
    if (!state) return { added: false, memory: null, reason: 'INVALID_STATE' };
    state.memories = state.memories || [];

    const check = shouldCreateMemory(state, memoryParams);
    if (!check.allow) {
      const existing = (state.memories || []).find(m =>
        m.sourceType === memoryParams.sourceType && String(m.sourceId) === String(memoryParams.sourceId)
      );
      return { added: false, memory: existing || null, reason: check.reason };
    }

    const memory = createMemory(memoryParams);
    // Prepend so newest is first in state
    state.memories.unshift(memory);

    // Update memory metrics in state
    updateMemoryMetrics(state);

    return { added: true, memory, reason: 'CREATED' };
  }

  function updateMemoryMetrics(state) {
    if (!state) return;
    const mems = state.memories || [];
    state.memoryMetrics = {
      totalCount: mems.length,
      questCount: mems.filter(m => m.memoryType === MEMORY_TYPES.QUEST_COMPLETED).length,
      eventCount: mems.filter(m => m.memoryType === MEMORY_TYPES.EVENT_ATTENDED).length,
      personalBestCount: mems.filter(m => m.memoryType === MEMORY_TYPES.PERSONAL_BEST).length,
      placeCount: mems.filter(m => m.memoryType === MEMORY_TYPES.PLACE_DISCOVERED).length,
      milestoneCount: mems.filter(m => m.memoryType === MEMORY_TYPES.MILESTONE_UNLOCKED).length,
      reflectionCount: mems.filter(m => Boolean(m.reflectionText)).length
    };
  }

  // ============================================================
  // 5. MEMORY QUERY & LOOKUP API
  // ============================================================
  function getMemories(state, filter = 'ALL') {
    if (!state || !Array.isArray(state.memories)) return [];
    const list = [...state.memories];

    // Sort newest first by occurredAt
    list.sort((a, b) => {
      const tA = new Date(a.occurredAt || a.createdAt || 0).getTime();
      const tB = new Date(b.occurredAt || b.createdAt || 0).getTime();
      return tB - tA;
    });

    const normFilter = (filter || 'ALL').toUpperCase();
    if (normFilter === 'ALL') return list;
    if (normFilter === 'QUESTS' || normFilter === 'QUEST') {
      return list.filter(m => m.memoryType === MEMORY_TYPES.QUEST_COMPLETED || m.sourceType === SOURCE_TYPES.QUEST);
    }
    if (normFilter === 'EVENTS' || normFilter === 'EVENT') {
      return list.filter(m => m.memoryType === MEMORY_TYPES.EVENT_ATTENDED || m.sourceType === SOURCE_TYPES.EVENT);
    }
    if (normFilter === 'SPORTS' || normFilter === 'FIT_QUEST') {
      return list.filter(m => m.memoryType === MEMORY_TYPES.PERSONAL_BEST || m.sourceType === SOURCE_TYPES.FIT_QUEST);
    }
    if (normFilter === 'MILESTONES' || normFilter === 'MILESTONE') {
      return list.filter(m => m.memoryType === MEMORY_TYPES.MILESTONE_UNLOCKED || m.sourceType === SOURCE_TYPES.MILESTONE);
    }
    if (normFilter === 'REFLECTIONS' || normFilter === 'REFLECTION') {
      return list.filter(m => Boolean(m.reflectionText));
    }
    if (normFilter === 'PLACES' || normFilter === 'PLACE') {
      return list.filter(m => m.memoryType === MEMORY_TYPES.PLACE_DISCOVERED || m.sourceType === SOURCE_TYPES.PLACE);
    }
    return list;
  }

  function getMemoryById(state, memoryId) {
    if (!state || !Array.isArray(state.memories)) return null;
    return state.memories.find(m => String(m.id) === String(memoryId)) || null;
  }

  function getMemoriesByType(state, memoryType) {
    if (!state || !Array.isArray(state.memories)) return [];
    return state.memories.filter(m => m.memoryType === memoryType);
  }

  function getMemoriesByPlace(state, placeId) {
    if (!state || !Array.isArray(state.memories)) return [];
    return state.memories.filter(m => m.placeId === placeId);
  }

  function getMemoriesBySource(state, sourceType, sourceId) {
    if (!state || !Array.isArray(state.memories)) return [];
    return state.memories.filter(m =>
      m.sourceType === sourceType && (sourceId === undefined || String(m.sourceId) === String(sourceId))
    );
  }

  // ============================================================
  // 6. PRIVATE REFLECTION API (DOES NOT ALTER GAME PROGRESSION)
  // ============================================================
  function addPrivateReflection(state, memoryId, reflectionText) {
    const mem = getMemoryById(state, memoryId);
    if (!mem) return { success: false, reason: 'MEMORY_NOT_FOUND' };

    mem.reflectionText = typeof reflectionText === 'string' ? reflectionText.trim() : '';
    mem.updatedAt = getManilaIsoTimestamp();
    updateMemoryMetrics(state);

    return { success: true, memory: mem };
  }

  function updatePrivateReflection(state, memoryId, reflectionText) {
    return addPrivateReflection(state, memoryId, reflectionText);
  }

  function deletePrivateReflection(state, memoryId) {
    const mem = getMemoryById(state, memoryId);
    if (!mem) return { success: false, reason: 'MEMORY_NOT_FOUND' };

    mem.reflectionText = null;
    mem.updatedAt = getManilaIsoTimestamp();
    updateMemoryMetrics(state);

    return { success: true, memory: mem };
  }

  // ============================================================
  // 7. PLACE HISTORY ENGINE
  // ============================================================
  function recordPlaceVisit(state, placeId, timestamp = null, isDemo = false) {
    if (!state || !placeId) return null;
    const ts = timestamp || getManilaIsoTimestamp();
    state.placeHistory = state.placeHistory || {};

    const placeInfo = CANONICAL_PLACES[placeId] || { id: placeId, name: placeId, icon: '📍' };

    if (!state.placeHistory[placeId]) {
      state.placeHistory[placeId] = {
        placeId,
        placeName: placeInfo.name,
        icon: placeInfo.icon,
        firstVisit: ts,
        recentVisit: ts,
        visitCount: 1
      };

      // Create first-discovery memory
      addMemoryIfNew(state, {
        memoryType: MEMORY_TYPES.PLACE_DISCOVERED,
        sourceType: SOURCE_TYPES.PLACE,
        sourceId: placeId,
        title: `Discovered ${placeInfo.name}`,
        subtitle: 'A new place in your adventure',
        description: `You set foot in ${placeInfo.name} for the first time.`,
        placeId: placeId,
        occurredAt: ts,
        icon: placeInfo.icon,
        tags: ['place', placeId],
        isDemo: Boolean(isDemo)
      });

    } else {
      state.placeHistory[placeId].recentVisit = ts;
      state.placeHistory[placeId].visitCount = (state.placeHistory[placeId].visitCount || 0) + 1;
    }

    return state.placeHistory[placeId];
  }

  function getPlaceHistory(state, placeId) {
    if (!state) return null;
    state.placeHistory = state.placeHistory || {};
    const info = CANONICAL_PLACES[placeId] || { id: placeId, name: placeId, icon: '📍' };
    const hist = state.placeHistory[placeId] || {
      placeId,
      placeName: info.name,
      icon: info.icon,
      firstVisit: null,
      recentVisit: null,
      visitCount: 0
    };

    // Attach related memories
    const relatedMemories = getMemoriesByPlace(state, placeId);
    return Object.assign({}, hist, { memories: relatedMemories });
  }

  function getAllPlacesHistory(state) {
    return Object.keys(CANONICAL_PLACES).map(pId => getPlaceHistory(state, pId));
  }

  // ============================================================
  // 8. QA DEMO HISTORY SEEDER (IS_DEMO: TRUE)
  // ============================================================
  function seedJourneyDemoHistory(state) {
    if (!state) return;
    state.memories = state.memories || [];
    state.placeHistory = state.placeHistory || {};

    const ts1 = '2026-09-02T09:30:00+08:00';
    const ts2 = '2026-09-04T16:15:00+08:00';
    const ts3 = '2026-09-05T10:00:00+08:00';
    const ts4 = '2026-09-06T15:00:00+08:00';
    const ts5 = '2026-09-06T16:20:00+08:00';

    // Place discoveries (explicitly marked as demo)
    recordPlaceVisit(state, 'my_home', ts1, true);
    recordPlaceVisit(state, 'fog_center', ts2, true);
    recordPlaceVisit(state, 'sports_hub', ts3, true);
    recordPlaceVisit(state, 'school', ts4, true);
    recordPlaceVisit(state, 'outreach_site', ts5, true);

    // Bump visits
    if (state.placeHistory.my_home) state.placeHistory.my_home.visitCount = 5;
    if (state.placeHistory.sports_hub) state.placeHistory.sports_hub.visitCount = 3;
    if (state.placeHistory.fog_center) state.placeHistory.fog_center.visitCount = 2;

    // 1. Quest Completed Memory
    addMemoryIfNew(state, {
      id: 'demo_mem_quest_001',
      memoryType: MEMORY_TYPES.QUEST_COMPLETED,
      sourceType: SOURCE_TYPES.QUEST,
      sourceId: 'Q-001',
      title: 'Steward of the Garden',
      subtitle: 'Watered plants at home with joyful patience',
      description: 'You cared for something entrusted to you on the garden veranda.',
      placeId: 'my_home',
      occurredAt: '2026-09-02T10:15:00+08:00',
      icon: '🌱',
      tags: ['calling', 'stewardship'],
      reflectionText: 'Remember to check the soil moisture daily before the morning sun gets too hot.',
      isDemo: true
    });

    // 2. Event Attended Memory
    addMemoryIfNew(state, {
      id: 'demo_mem_event_alpha1',
      memoryType: MEMORY_TYPES.EVENT_ATTENDED,
      sourceType: SOURCE_TYPES.EVENT,
      sourceId: 'alpha_s01_20260912',
      title: 'Alpha Youth Series — Session 1',
      subtitle: 'Life: Is This It? • FOG Community Center',
      description: 'Gathered with youth fellowship for discussion, hospitality, and honest questions.',
      placeId: 'fog_center',
      occurredAt: '2026-09-05T15:00:00+08:00',
      icon: '❓',
      tags: ['event', 'alpha', 'fellowship'],
      metadata: {
        eventName: 'Alpha Youth Series',
        sessionTitle: 'Life: Is This It?',
        chapterNumber: 1,
        participated: true,
        badgeText: 'YOU WERE THERE'
      },
      reflectionText: 'It felt comforting to realize others have the same deep questions about purpose.',
      isDemo: true
    });

    // 3. Personal Best Memory
    addMemoryIfNew(state, {
      id: 'demo_mem_pb_bball',
      memoryType: MEMORY_TYPES.PERSONAL_BEST,
      sourceType: SOURCE_TYPES.FIT_QUEST,
      sourceId: 'FQ-V001',
      title: 'New Personal Best: Free Throw Focus',
      subtitle: '7 / 10 shots made (Previous: 4 / 10)',
      description: 'Maintained steady rhythm and eye focus at the Sports Hub basketball court.',
      placeId: 'sports_hub',
      occurredAt: '2026-09-06T11:45:00+08:00',
      icon: '🏀',
      tags: ['sports', 'fitquest', 'basketball'],
      metadata: {
        challengeId: 'FQ-V001',
        challengeName: 'Free Throw Focus',
        sportId: 'basketball',
        previousScore: 4,
        newScore: 7,
        scoreDisplay: '7/10 makes',
        isPersonalBest: true
      },
      reflectionText: 'Deep breath before release made all the difference.',
      isDemo: true
    });

    // 4. Milestone Unlocked Memory
    addMemoryIfNew(state, {
      id: 'demo_mem_milestone_fit',
      memoryType: MEMORY_TYPES.MILESTONE_UNLOCKED,
      sourceType: SOURCE_TYPES.MILESTONE,
      sourceId: 'm_first_fitquest',
      title: 'Milestone: First Step in Movement',
      subtitle: 'Completed your first Faith Quest activity',
      description: 'Honoring God through healthy physical activity, discipline, and movement.',
      placeId: 'sports_hub',
      occurredAt: '2026-09-06T11:46:00+08:00',
      icon: '🏃',
      tags: ['milestone', 'progression'],
      isDemo: true
    });

    updateMemoryMetrics(state);
  }

  // ============================================================
  // 9. PHASE 0.19 CANONICAL QA BASELINE BUILDER
  // ============================================================
  function createJourneyReadyQaState(overrides = {}) {
    // Compose directly from Phase 0.18 canonical state builder if available
    let base = {};
    const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
    const sportsData = (root.KOINONIA_DATA && root.KOINONIA_DATA.createFitQuestReadyQaState)
      ? root.KOINONIA_DATA
      : (typeof require !== 'undefined' ? require('./sports.js') : null);

    if (sportsData && typeof sportsData.createFitQuestReadyQaState === 'function') {
      base = sportsData.createFitQuestReadyQaState();
    } else {
      // Fallback clean base matching Phase 0.18
      base = {
        version: 1,
        lp: 135,
        charXp: 15,
        charLevel: 2,
        activePlaceId: 'sports_hub',
        visitedPlaces: ['home', 'fog_center', 'school', 'sports_hub', 'outreach_site'],
        activeQuests: ['Q-004'],
        completedQuests: ['Q-001', 'Q-002', 'Q-003'],
        growthAreas: { stewardship: 15, responsibility: 15, service: 10, reflection: 10, discipline: 0, teamwork: 0 },
        activeCampaignIds: [],
        sportsExplored: [],
        fitQuestHistory: [],
        personalBests: {}
      };
    }

    // Explicit Phase 0.19 Storage Key
    base.storageKey = 'koinonia.phase19.save';

    // Baseline unlocked milestones matching clean progression state
    base.unlockedMilestones = [
      'm_first_steps', 'm_novice_pilgrim', 'm_gatherer',
      'm_visit_school', 'm_visit_sports', 'm_visit_outreach', 'm_five_places',
      'm_stewardship_10', 'm_responsibility_10', 'm_service_10', 'm_reflection_10'
    ];

    // Strict clean baseline: NO fake memories, NO fake reflections, NO fake history
    base.memories = [];
    base.placeHistory = {};
    base.memoryMetrics = {
      totalCount: 0,
      questCount: 0,
      eventCount: 0,
      personalBestCount: 0,
      placeCount: 0,
      milestoneCount: 0,
      reflectionCount: 0
    };

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

  // ============================================================
  // 10. UPGRADE HELPER (PHASE 0.18 -> PHASE 0.19)
  // ============================================================
  function upgradePhase18StateToPhase19(state) {
    if (!state) return createJourneyReadyQaState();
    const upgraded = Object.assign({}, state);

    upgraded.storageKey = 'koinonia.phase19.save';
    upgraded.memories = Array.isArray(state.memories) ? [...state.memories] : [];
    upgraded.placeHistory = (state.placeHistory && typeof state.placeHistory === 'object')
      ? Object.assign({}, state.placeHistory)
      : {};

    updateMemoryMetrics(upgraded);
    return upgraded;
  }

  // ============================================================
  // 11. EXPORTS
  // ============================================================
  const api = {
    MEMORY_TYPES,
    SOURCE_TYPES,
    PRIVACY_LEVELS,
    PRIVACY_LABEL,
    CANONICAL_PLACES,
    getManilaIsoTimestamp,
    formatMemoryDate,
    createMemory,
    shouldCreateMemory,
    addMemoryIfNew,
    getMemories,
    getMemoryById,
    getMemoriesByType,
    getMemoriesByPlace,
    getMemoriesBySource,
    addPrivateReflection,
    updatePrivateReflection,
    deletePrivateReflection,
    recordPlaceVisit,
    getPlaceHistory,
    getAllPlacesHistory,
    seedJourneyDemoHistory,
    createJourneyReadyQaState,
    upgradePhase18StateToPhase19
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this);
  if (!root.KOINONIA_DATA) root.KOINONIA_DATA = {};
  Object.assign(root.KOINONIA_DATA, api);

})();
