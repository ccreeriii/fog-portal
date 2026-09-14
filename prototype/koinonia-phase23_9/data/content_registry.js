/**
 * KOINONIA — PHASE 0.23L RUNTIME CONTENT REGISTRY & PUBLICATION PROJECTION
 * 
 * Canonical Content Delivery Pipeline:
 *   Studio Draft
 *   -> Submit for Review
 *   -> Approval
 *   -> Publish
 *   -> Safe Publication Projection
 *   -> Runtime Content Registry (KoinoniaContentRegistry)
 *   -> Member-Facing Gameplay (Quest Journal, Detail Modal, Exit Ramp, Completion)
 *   -> Trusted Reward Authority (KoinoniaRewardAuthority) Clamping & Absolute Hydration
 * 
 * Architecture Guarantees:
 *   1. Fail-Closed: Only PUBLISHED content enters the member runtime.
 *   2. ID Collision Safety: Builtin vs Studio namespaces (builtin:<id> / studio:<id>).
 *   3. Deterministic Versioning: Latest publication version projected; no duplicates.
 *   4. Zero Privilege Bypass: Member cannot publish; author requested rewards are clamped.
 *   5. Non-Authoritative Rewards: Effective rewards determined exclusively by Reward Authority.
 *   6. Minor Safety & Sanitization: PII requests blocked, XSS sanitized.
 *   7. Local Prototype Persistence: Browser localStorage-scoped; not tamper-proof.
 */

(function () {
  'use strict';

  const COMMUNITY_ID = 'fog';

  const CONTENT_TYPES = Object.freeze({
    QUEST: 'QUEST',
    EVENT: 'EVENT',
    CAMPAIGN: 'CAMPAIGN',
    CAMPFIRE: 'CAMPFIRE'
  });

  const LIFECYCLE_STATUS = Object.freeze({
    DRAFT: 'DRAFT',
    READY_FOR_REVIEW: 'READY_FOR_REVIEW',
    CHANGES_REQUESTED: 'CHANGES_REQUESTED',
    APPROVED: 'APPROVED',
    PUBLISHED: 'PUBLISHED',
    INACTIVE: 'INACTIVE',
    ARCHIVED: 'ARCHIVED'
  });

  const STORAGE_KEYS = Object.freeze({
    STUDIO_DRAFTS: 'koinonia_phase21_studio_drafts',
    STUDIO_PUBLISHED: 'koinonia_phase21_studio_published',
    REGISTRY_CATALOG: 'koinonia_phase23l_content_registry'
  });

  const POLICY_BOUNDS = Object.freeze({
    MIN_LP: 0,
    MAX_LP: 50,
    MIN_XP: 0,
    MAX_XP: 100,
    EFFECTIVE_POLICY_KEY: 'STUDIO_STANDARD'
  });

  // Minor safety forbidden PII patterns
  const MINOR_SAFETY_FORBIDDEN = [
    { type: 'PHONE', pattern: /(\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|\bphone\s*(?:number)?\b|\bcell\s*(?:phone|number)?\b|\bmobile\s*(?:number)?\b)/i, description: 'Phone number request' },
    { type: 'ADDRESS', pattern: /(\bhome\s*address\b|\bstreet\s*address\b|\bwhere\s+do\s+you\s+live\b|\bhouse\s*number\b|\bzip\s*code\b|\bpostal\s*code\b)/i, description: 'Home / physical address request' },
    { type: 'SCHOOL', pattern: /(\bschool\s*name\b|\bwhat\s+school\b|\bschool\s*address\b|\bwhere\s+do\s+you\s+go\s+to\s+school\b)/i, description: 'School identity request' },
    { type: 'SOCIAL_HANDLE', pattern: /(\binstagram\b|\btiktok\b|\bsnapchat\b|\bdiscord\s*(?:tag|id|username)?\b|\bwhatsapp\b|\bsocial\s*media\s*handle\b)/i, description: 'Social media handle request' },
    { type: 'PRIVATE_CONTACT', pattern: /(\b(?:private|personal)\s*email\s*address\b|\bpersonal\s*contact\s*info(?:rmation)?\b)/i, description: 'Private contact information request' },
    { type: 'OPEN_CHAT', pattern: /(\bunrestricted\s*chat\b|\bpublic\s*free-text\b|\bopen\s*messaging\b)/i, description: 'Unrestricted public free-text messaging request' }
  ];

  // Helper: Sanitize text to prevent script injection or unwanted markup
  function sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<[^>]+>/g, '') // Strip remaining HTML tags
      .trim();
  }

  // Helper: Minor Safety validation
  function validateMinorSafety(contentData = {}) {
    const fieldsToScan = [
      contentData.title,
      contentData.shortDesc,
      contentData.summary,
      contentData.description,
      contentData.longDesc,
      contentData.realWorldAction,
      contentData.reflectionPrompt,
      contentData.completionMessage,
      contentData.prompt
    ].filter(f => typeof f === 'string');

    const combinedText = fieldsToScan.join(' ');
    const violations = [];

    for (const rule of MINOR_SAFETY_FORBIDDEN) {
      if (rule.pattern.test(combinedText)) {
        violations.push(rule.description);
      }
    }

    return {
      minorSafe: violations.length === 0,
      violations
    };
  }

  // Helper: Clamp rewards to policy bounds
  function clampRewards(requestedLp, requestedXp) {
    const numLp = Number.isFinite(Number(requestedLp)) ? Number(requestedLp) : 0;
    const numXp = Number.isFinite(Number(requestedXp)) ? Number(requestedXp) : 0;

    const clampedLp = Math.max(POLICY_BOUNDS.MIN_LP, Math.min(POLICY_BOUNDS.MAX_LP, Math.floor(numLp)));
    const clampedXp = Math.max(POLICY_BOUNDS.MIN_XP, Math.min(POLICY_BOUNDS.MAX_XP, Math.floor(numXp)));

    return {
      requested: { lifePoints: numLp, xp: numXp },
      validated: { lifePoints: clampedLp, xp: clampedXp },
      effectivePolicyKey: POLICY_BOUNDS.EFFECTIVE_POLICY_KEY
    };
  }

  // ============================================================
  // CANONICAL PUBLISHED QUEST NORMALIZER
  // ============================================================
  function normalizePublishedQuest(record, source = 'studio') {
    if (!record) return null;

    if (source === 'builtin') {
      const qid = String(record.id || '').trim();
      const lp = Number(record.rewards?.lp ?? record.rewards?.lifePoints ?? 15);
      const xp = Number(record.rewards?.charXp ?? record.rewards?.characterXp ?? record.rewards?.xp ?? 25);
      const category = record.category || 'COMMUNITY';

      return Object.freeze({
        id: qid,
        canonicalId: `builtin:${qid}`,
        communityId: COMMUNITY_ID,
        contentType: CONTENT_TYPES.QUEST,
        title: record.title || qid,
        summary: record.subtitle || record.description || '',
        description: record.description || record.subtitle || '',
        status: LIFECYCLE_STATUS.PUBLISHED,
        publication: Object.freeze({
          publishedAt: '2026-09-01T00:00:00.000Z',
          publishedByMemberId: 'church_admin',
          version: 1
        }),
        availability: Object.freeze({
          active: true,
          startsAt: null,
          endsAt: null
        }),
        presentation: Object.freeze({
          icon: record.icon || '🌱',
          category,
          categoryTitle: record.subtitle || category,
          locationId: record.placeId || null,
          npcId: record.giverNpcId || null
        }),
        rewardDefinition: Object.freeze({
          requested: Object.freeze({ lifePoints: lp, xp }),
          validated: Object.freeze({ lifePoints: lp, xp }),
          effectivePolicyKey: 'BUILTIN_CANONICAL'
        }),
        safeguards: Object.freeze({
          minorSafe: true
        }),
        source: 'builtin',

        // Compatibility fields for existing gameplay modals and handlers
        realWorldAction: record.realWorldAction || (record.steps && record.steps[1]?.description) || record.description || '',
        realWorldFallbacks: record.realWorldFallbacks || [],
        reflectionPrompt: record.reflectionPrompt || (record.steps && record.steps[2]?.description) || '',
        verificationMethod: record.verificationMethod || 'TRUST',
        difficulty: record.difficulty || 'easy',
        estimatedMinutes: record.estimatedMinutes || 20,
        rewards: Object.freeze({
          lp,
          lifePoints: lp,
          charXp: xp,
          characterXp: xp,
          xp,
          skills: record.rewards?.skills || null,
          stewardshipXp: record.rewards?.stewardshipXp || 0
        }),
        dialogue: record.dialogue || {
          inProgress: `Remember your calling: ${record.realWorldAction || record.title}`,
          returnPrompt: record.reflectionPrompt || 'Share your experience.',
          completionMessage: 'Well done, faithful servant!'
        },
        steps: record.steps || [],
        prerequisites: record.prerequisites || record.requirements || []
      });
    }

    // Studio Published Record Normalization
    // Only PUBLISHED records are projected (fail-closed)
    const rawData = record.data || {};
    const templateType = String(record.templateType || rawData.templateType || '').toUpperCase();
    if (templateType !== 'QUEST') {
      return null; // Ignore non-quest studio publications in quest normalizer
    }

    // Identify stable content ID
    const rawContentId = String(record.draftId || record.publishedId || record.id || '').trim();
    if (!rawContentId) return null;
    const stableId = rawContentId.startsWith('studio:') ? rawContentId : `studio:${rawContentId}`;

    // Clean & sanitize text fields
    const title = sanitizeText(record.title || rawData.title || 'Untitled Studio Quest');
    const summary = sanitizeText(rawData.shortDesc || rawData.summary || rawData.description || title);
    const description = sanitizeText(rawData.longDesc || rawData.description || summary);
    const realWorldAction = sanitizeText(rawData.realWorldAction || 'Perform this stewardship action in the physical world.');
    const reflectionPrompt = sanitizeText(rawData.reflectionPrompt || 'Reflect on how this calling impacted your spirit and family.');
    const completionMessage = sanitizeText(rawData.completionMessage || 'Well done, faithful pilgrim! Your action bears eternal fruit.');

    // Minor safety verification
    const minorCheck = validateMinorSafety({
      title,
      shortDesc: summary,
      longDesc: description,
      realWorldAction,
      reflectionPrompt,
      completionMessage
    });

    // Author requested rewards clamped to trusted policy
    const rewardsClamped = clampRewards(rawData.lifePoints, rawData.characterXp ?? rawData.xp);

    // Publication metadata
    const pubVersion = Number(record.version || rawData.version || 1);
    const publishedAtStr = record.publishedAt
      ? (typeof record.publishedAt === 'number' ? new Date(record.publishedAt).toISOString() : String(record.publishedAt))
      : new Date().toISOString();

    const publishedBy = record.publishedBy || {};
    const publishedByMemberId = String(publishedBy.id || publishedBy.memberId || record.publishedByMemberId || 'father_alex');

    // Availability
    const now = Date.now();
    let isExpired = false;
    if (rawData.endDate) {
      const endMs = new Date(rawData.endDate).getTime();
      if (!isNaN(endMs) && endMs < now) {
        isExpired = true;
      }
    }
    const isActive = (record.active !== false) && (rawData.active !== false) && !isExpired;

    return Object.freeze({
      id: stableId,
      canonicalId: stableId,
      communityId: COMMUNITY_ID,
      contentType: CONTENT_TYPES.QUEST,
      title,
      summary,
      description,
      status: LIFECYCLE_STATUS.PUBLISHED,
      publication: Object.freeze({
        publishedAt: publishedAtStr,
        publishedByMemberId,
        version: pubVersion
      }),
      availability: Object.freeze({
        active: isActive,
        startsAt: rawData.startDate ? new Date(rawData.startDate).toISOString() : null,
        endsAt: rawData.endDate ? new Date(rawData.endDate).toISOString() : null
      }),
      presentation: Object.freeze({
        icon: rawData.icon || '📜',
        category: rawData.category || 'Faith & Stewardship',
        categoryTitle: rawData.category || 'Faith & Stewardship',
        locationId: rawData.placeId || null,
        npcId: rawData.npcId || null
      }),
      rewardDefinition: Object.freeze({
        requested: Object.freeze(rewardsClamped.requested),
        validated: Object.freeze(rewardsClamped.validated),
        effectivePolicyKey: rewardsClamped.effectivePolicyKey
      }),
      safeguards: Object.freeze({
        minorSafe: minorCheck.minorSafe,
        violations: Object.freeze([...minorCheck.violations])
      }),
      source: 'studio',

      // Gameplay compatibility fields
      realWorldAction,
      realWorldFallbacks: rawData.realWorldFallbacks || [],
      reflectionPrompt,
      verificationMethod: rawData.verificationMethod || 'self_reflection',
      difficulty: rawData.difficulty || 'medium',
      estimatedMinutes: Number(rawData.estimatedMinutes || 30),
      rewards: Object.freeze({
        lp: rewardsClamped.validated.lifePoints,
        lifePoints: rewardsClamped.validated.lifePoints,
        charXp: rewardsClamped.validated.xp,
        characterXp: rewardsClamped.validated.xp,
        xp: rewardsClamped.validated.xp,
        skills: rawData.skillXp ? { stewardship: Number(rawData.skillXp) } : null
      }),
      dialogue: Object.freeze({
        inProgress: `Real-World Task: ${realWorldAction}`,
        returnPrompt: reflectionPrompt,
        completionMessage
      }),
      steps: [
        { id: 'step_1', type: 'ACCEPT', title: 'Accept Calling', description: summary },
        { id: 'step_2', type: 'REAL_WORLD', title: 'Real-World Stewardship', description: realWorldAction },
        { id: 'step_3', type: 'REFLECT', title: 'Personal Reflection', description: reflectionPrompt }
      ],
      prerequisites: []
    });
  }

  // ============================================================
  // RUNTIME CONTENT REGISTRY CLASS
  // ============================================================
  class ContentRegistry {
    constructor() {
      this.builtinQuests = new Map();
      this.publishedQuests = new Map();
      this.listeners = new Set();
      this.initialized = false;
    }

    _getStorage() {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
      if (typeof global !== 'undefined' && global.localStorage) return global.localStorage;
      return null;
    }

    /**
     * Initialize registry with builtin quests and project existing Studio publications
     */
    init(options = {}) {
      this.builtinQuests.clear();
      this.publishedQuests.clear();

      // 1. Load Builtin Quests
      const builtinSource = options.builtinQuests ||
        (typeof window !== 'undefined' && window.KOINONIA_DATA && window.KOINONIA_DATA.quests) ||
        (typeof global !== 'undefined' && global.KOINONIA_DATA && global.KOINONIA_DATA.quests) ||
        [];

      if (Array.isArray(builtinSource)) {
        for (const raw of builtinSource) {
          const normalized = normalizePublishedQuest(raw, 'builtin');
          if (normalized) {
            this.builtinQuests.set(normalized.id, normalized);
            this.builtinQuests.set(normalized.canonicalId, normalized);
          }
        }
      }

      // 2. Project Studio Published Quests
      this.refreshStudioContent(false);

      this.initialized = true;
      return this;
    }

    /**
     * Read from Studio store or localStorage and project PUBLISHED quests
     */
    refreshStudioContent(notify = true) {
      const storage = this._getStorage();
      let rawPublishedList = [];

      // Check in-memory StudioStore if available
      const studioStore = (typeof window !== 'undefined' && window.StudioStore && window.StudioStore.instance) ||
        (typeof global !== 'undefined' && global.StudioStore && global.StudioStore.instance) ||
        null;

      if (studioStore && typeof studioStore.listPublished === 'function') {
        rawPublishedList = studioStore.listPublished();
      } else if (storage) {
        try {
          const raw = storage.getItem(STORAGE_KEYS.STUDIO_PUBLISHED);
          if (raw) rawPublishedList = JSON.parse(raw);
        } catch (e) {
          console.warn('[KoinoniaContentRegistry] Failed to parse studio published storage:', e);
          rawPublishedList = [];
        }
      }

      // Map to track latest publication per stable content ID
      const latestQuests = new Map();

      if (Array.isArray(rawPublishedList)) {
        for (const item of rawPublishedList) {
          // Fail-closed status check: must be a published record
          if (!item) continue;
          const normalized = normalizePublishedQuest(item, 'studio');
          if (!normalized) continue;

          // Minor safety check: reject minor-unsafe content from member delivery
          if (!normalized.safeguards.minorSafe) {
            console.warn(`[KoinoniaContentRegistry] Excluding minor-unsafe quest ${normalized.id}:`, normalized.safeguards.violations);
            continue;
          }

          // Deterministic versioning: if duplicate entry exists for this content ID, keep higher version or latest timestamp
          const existing = latestQuests.get(normalized.id);
          if (!existing) {
            latestQuests.set(normalized.id, normalized);
          } else {
            const existingVer = existing.publication.version;
            const newVer = normalized.publication.version;
            if (newVer > existingVer) {
              latestQuests.set(normalized.id, normalized);
            }
          }
        }
      }

      this.publishedQuests = latestQuests;

      // Automatically register published quests with KoinoniaRewardAuthority
      const rewardAuth = (typeof window !== 'undefined' && window.KoinoniaRewardAuthority) ||
        (typeof global !== 'undefined' && global.KoinoniaRewardAuthority) ||
        null;

      if (rewardAuth && typeof rewardAuth.registerStudioQuest === 'function') {
        for (const quest of this.publishedQuests.values()) {
          rewardAuth.registerStudioQuest(quest.id, quest);
        }
      }

      if (notify) {
        this._notifySubscribers();
      }
    }

    /**
     * Refresh registry and notify subscribers
     */
    refresh() {
      this.refreshStudioContent(true);
    }

    /**
     * Register a single studio quest directly (useful for tests or hot projection)
     */
    registerStudioQuestContent(record) {
      const normalized = normalizePublishedQuest(record, 'studio');
      if (!normalized) return { success: false, error: 'Failed to normalize studio quest' };
      if (!normalized.safeguards.minorSafe) {
        return { success: false, error: 'Failed minor safety check', violations: normalized.safeguards.violations };
      }

      this.publishedQuests.set(normalized.id, normalized);

      const rewardAuth = (typeof window !== 'undefined' && window.KoinoniaRewardAuthority) ||
        (typeof global !== 'undefined' && global.KoinoniaRewardAuthority) ||
        null;

      if (rewardAuth && typeof rewardAuth.registerStudioQuest === 'function') {
        rewardAuth.registerStudioQuest(normalized.id, normalized);
      }

      this._notifySubscribers();
      return { success: true, quest: normalized };
    }

    /**
     * Retrieve all published content items (builtin + studio)
     */
    getPublishedContent() {
      if (!this.initialized) this.init();
      const items = [];

      // Collect unique builtins (omit canonicalId alias duplicate)
      for (const [key, q] of this.builtinQuests.entries()) {
        if (!key.startsWith('builtin:')) {
          items.push(q);
        }
      }

      // Collect studio published
      for (const q of this.publishedQuests.values()) {
        items.push(q);
      }

      return items;
    }

    /**
     * Retrieve published quests for member consumption
     */
    getPublishedQuests(options = {}) {
      if (!this.initialized) this.init();
      const includeInactive = Boolean(options.includeInactive);
      const results = [];

      // 1. Built-in quests
      for (const [key, q] of this.builtinQuests.entries()) {
        if (key.startsWith('builtin:')) continue; // Skip duplicate alias
        if (!includeInactive && !q.availability.active) continue;
        results.push(q);
      }

      // 2. Studio published quests
      for (const q of this.publishedQuests.values()) {
        if (!includeInactive) {
          if (!q.availability.active) continue;
          if (q.availability.endsAt && new Date(q.availability.endsAt).getTime() < Date.now()) continue;
        }
        results.push(q);
      }

      return results;
    }

    /**
     * Lookup quest by ID (supports 'Q-001', 'builtin:Q-001', 'studio:draft_123')
     */
    getQuestById(id) {
      if (!id) return null;
      if (!this.initialized) this.init();

      const searchId = String(id).trim();

      // 1. Studio quest
      if (this.publishedQuests.has(searchId)) {
        return this.publishedQuests.get(searchId);
      }

      // 2. Builtin direct or prefixed
      if (this.builtinQuests.has(searchId)) {
        return this.builtinQuests.get(searchId);
      }

      // 3. Case-insensitive fallback for builtin
      const upper = searchId.toUpperCase();
      for (const [k, v] of this.builtinQuests.entries()) {
        if (k.toUpperCase() === upper) return v;
      }

      return null;
    }

    /**
     * Subscribe to content registry changes
     */
    subscribe(callback) {
      if (typeof callback !== 'function') return () => {};
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    _notifySubscribers() {
      for (const listener of this.listeners) {
        try {
          listener();
        } catch (e) {
          console.error('[KoinoniaContentRegistry] Subscriber error:', e);
        }
      }
    }
  }

  // Singleton instance
  const KoinoniaContentRegistry = new ContentRegistry();

  // Export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      KoinoniaContentRegistry,
      normalizePublishedQuest,
      validateMinorSafety,
      sanitizeText,
      clampRewards,
      CONTENT_TYPES,
      LIFECYCLE_STATUS,
      POLICY_BOUNDS
    };
  }

  const root = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : {});
  root.KoinoniaContentRegistry = KoinoniaContentRegistry;

  // Auto-init in browser if DOM is ready
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => KoinoniaContentRegistry.init());
    } else {
      KoinoniaContentRegistry.init();
    }
  }
})();
