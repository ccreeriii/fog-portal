/**
 * KOINONIA — PHASE 0.23B
 * REMOTE SHARED CORE PROVIDER & SAFE HTTP CLIENT
 *
 * Architecture:
 *   KOINONIA
 *      ↓
 *   RemoteSharedCoreProvider (Contract Mirror)
 *      ↓
 *   SharedCoreHttpClient (Safe Edge Client)
 *      ↓
 *   Future Authenticated /api/v1/shared/* (Fail-Closed Scaffolding)
 *
 * CANONICAL SAFETY INVARIANTS:
 * - Remote provider NEVER activates merely because this file exists.
 * - Remote reads are disabled by default (remoteReadsEnabled: false).
 * - Remote mutations are disabled by default (remoteMutationsEnabled: false).
 * - Only /api/v1/shared/* endpoints are allowed. Raw portal mutations
 *   (/api/checkin, /api/games/universal-submit, /api/growth-games/*) are rejected.
 * - Consequential mutations require an explicit idempotencyKey.
 * - Consequential mutations NEVER automatically retry on failure.
 * - NO silent fallback from failed remote mutations to local rewards (no split-brain).
 * - Zero direct database access (staging/production database is never referenced).
 * - Zero imports of sqlite3 or better-sqlite3.
 * - Zero hardcoded staging LAN IPs or production URLs.
 */

(function(root) {
  'use strict';

  // Structured Error Codes
  const SHARED_CORE_ERRORS = {
    MUTATIONS_DISABLED: 'SHARED_CORE_MUTATIONS_DISABLED',
    READS_DISABLED: 'SHARED_CORE_READS_DISABLED',
    INVALID_ROUTE: 'SHARED_CORE_INVALID_ROUTE',
    MISSING_IDEMPOTENCY_KEY: 'SHARED_CORE_MISSING_IDEMPOTENCY_KEY',
    NETWORK_ERROR: 'SHARED_CORE_NETWORK_ERROR',
    UNAUTHORIZED: 'SHARED_CORE_UNAUTHORIZED',
    REMOTE_NOT_CONFIGURED: 'SHARED_CORE_REMOTE_NOT_CONFIGURED',
    INVALID_OPTIONS: 'SHARED_CORE_INVALID_OPTIONS'
  };

  /**
   * Helper to generate a dual synchronous/asynchronous fail-closed result.
   * Enables both synchronous property inspection (res.error) and async/await usage.
   */
  function createFailClosedResult(code, message, extra = {}) {
    const result = Object.assign({
      success: false,
      error: code,
      code: code,
      message: message
    }, extra);

    const promise = Promise.resolve(result);
    Object.assign(promise, result);
    return promise;
  }

  // Strictly validated route prefix
  const ALLOWED_ROUTE_PREFIX = '/api/v1/shared/';

  // Explicitly forbidden legacy / raw mutation routes
  const FORBIDDEN_ROUTE_PATTERNS = [
    /^\/api\/checkin(\/.*)?$/i,
    /^\/api\/games\/universal-submit(\/.*)?$/i,
    /^\/api\/growth-games(\/.*)?$/i,
    /^\/api\/members(\/.*)?$/i,
    /^\/api\/admin(\/.*)?$/i
  ];

  /**
   * Shared Core HTTP Client Abstraction
   */
  class SharedCoreHttpClient {
    constructor(options = {}) {
      this.baseUrl = (options.baseUrl || '').replace(/\/+$/, '');
      this.timeoutMs = Number(options.timeoutMs) || 8000;
      this.credentials = options.credentials || 'same-origin';
      this.remoteReadsEnabled = Boolean(options.remoteReadsEnabled);
      this.remoteMutationsEnabled = Boolean(options.remoteMutationsEnabled);
    }

    /**
     * Strictly validate that an endpoint conforms to /api/v1/shared/*
     *
     * @param {string} endpoint
     * @returns {boolean}
     */
    isValidSharedCoreEndpoint(endpoint) {
      if (typeof endpoint !== 'string') return false;
      const cleanPath = endpoint.split('?')[0].trim();

      // Must start with canonical prefix
      if (!cleanPath.startsWith(ALLOWED_ROUTE_PREFIX)) {
        return false;
      }

      // Must not match any forbidden raw route patterns
      for (const pattern of FORBIDDEN_ROUTE_PATTERNS) {
        if (pattern.test(cleanPath)) {
          return false;
        }
      }

      return true;
    }

    /**
     * Dispatch an HTTP request with strict fail-closed safety guards.
     */
    async request(method, endpoint, body = null, options = {}) {
      const upperMethod = String(method || 'GET').toUpperCase();
      const isMutation = upperMethod !== 'GET' && upperMethod !== 'HEAD';

      // 1. Strict route validation
      if (!this.isValidSharedCoreEndpoint(endpoint)) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.INVALID_ROUTE,
          `Rejected route: ${endpoint}. Only ${ALLOWED_ROUTE_PREFIX}* endpoints are permitted.`
        );
      }

      // 2. Read guard
      if (!isMutation && !this.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }

      // 3. Mutation guard
      if (isMutation && !this.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B (scaffolding only).'
        );
      }

      // 4. Idempotency key requirement for mutations
      let idempotencyKey = options.idempotencyKey || (body && body.idempotencyKey) || null;
      if (isMutation && options.requiresIdempotency !== false) {
        if (!idempotencyKey) {
          return createFailClosedResult(
            SHARED_CORE_ERRORS.MISSING_IDEMPOTENCY_KEY,
            'Idempotency key is required for consequential mutations.'
          );
        }
      }

      // 5. Network call execution (only when enabled)
      const url = `${this.baseUrl}${endpoint}`;
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Koinonia-Phase': '0.23B'
      };

      if (idempotencyKey) {
        headers['Idempotency-Key'] = String(idempotencyKey);
      }

      const fetchOptions = {
        method: upperMethod,
        headers,
        credentials: this.credentials
      };

      if (body && isMutation) {
        fetchOptions.body = JSON.stringify(body);
      }

      try {
        let fetchFn = null;
        if (typeof fetch === 'function') {
          fetchFn = fetch;
        } else if (typeof global !== 'undefined' && typeof global.fetch === 'function') {
          fetchFn = global.fetch;
        }

        if (!fetchFn) {
          return createFailClosedResult(
            SHARED_CORE_ERRORS.NETWORK_ERROR,
            'Global fetch implementation not found in execution environment.'
          );
        }

        // AbortController timeout
        let controller = null;
        let timer = null;
        if (typeof AbortController !== 'undefined') {
          controller = new AbortController();
          fetchOptions.signal = controller.signal;
          timer = setTimeout(() => controller.abort(), this.timeoutMs);
        }

        const response = await fetchFn(url, fetchOptions);
        if (timer) clearTimeout(timer);

        const contentType = response.headers && typeof response.headers.get === 'function'
          ? response.headers.get('content-type') || ''
          : '';

        if (!contentType.includes('application/json')) {
          return createFailClosedResult(
            SHARED_CORE_ERRORS.NETWORK_ERROR,
            `Expected application/json response, received: ${contentType}`
          );
        }

        const data = await response.json();
        return data;
      } catch (err) {
        const isTimeout = err && (err.name === 'AbortError' || String(err.message).includes('timeout'));
        return createFailClosedResult(
          SHARED_CORE_ERRORS.NETWORK_ERROR,
          isTimeout
            ? `Request timed out after ${this.timeoutMs}ms.`
            : `Network error reaching Shared Core: ${err.message}`
        );
      }
    }
  }

  /**
   * Remote Shared Core Provider Class
   * Implements the exact 30-method public contract of LocalSharedCoreProvider.
   */
  class RemoteSharedCoreProvider {
    constructor(options = {}) {
      this.options = {
        providerMode: 'remote',
        remoteReadsEnabled: Boolean(options.remoteReadsEnabled),
        remoteMutationsEnabled: Boolean(options.remoteMutationsEnabled),
        baseUrl: options.baseUrl || '',
        timeoutMs: Number(options.timeoutMs) || 8000,
        credentials: options.credentials || 'same-origin'
      };

      this.httpClient = new SharedCoreHttpClient(this.options);
    }

    /**
     * Capability Metadata
     */
    getCapabilities() {
      return {
        providerMode: 'remote',
        remote: true,
        authenticated: false, // Scaffolding phase; real auth is Stage 3
        readsEnabled: this.options.remoteReadsEnabled,
        mutations: this.options.remoteMutationsEnabled,
        mutationsEnabled: this.options.remoteMutationsEnabled,
        lifePointsWrite: this.options.remoteMutationsEnabled,
        attendanceWrite: this.options.remoteMutationsEnabled,
        questCompletionWrite: this.options.remoteMutationsEnabled,
        campfireCapacityWrite: this.options.remoteMutationsEnabled,
        reactionsWrite: this.options.remoteMutationsEnabled,
        activityEventsWrite: this.options.remoteMutationsEnabled
      };
    }

    get capabilities() {
      return this.getCapabilities();
    }

    // ==========================================
    // 1. BASELINE / SYSTEM
    // ==========================================
    resetToBaseline() {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('POST', '/api/v1/shared/member/reset', {}, {
        idempotencyKey: 'reset:' + Date.now()
      });
    }

    // ==========================================
    // 2. MEMBER IDENTITY
    // ==========================================
    getCurrentMember() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/me');
    }

    // ==========================================
    // 3. LIFE POINTS & XP LEDGER
    // ==========================================
    getLifePoints() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/points');
    }

    awardLifePoints(params = {}) {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      const idempotencyKey = params.idempotencyKey;
      if (!idempotencyKey) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MISSING_IDEMPOTENCY_KEY,
          'Idempotency key is required for consequential Life Points mutations.'
        );
      }
      return this.httpClient.request('POST', '/api/v1/shared/points/award', params, {
        idempotencyKey
      });
    }

    // ==========================================
    // 4. QUESTS & COMPLETIONS
    // ==========================================
    getQuests() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/content/quests');
    }

    getQuest(questId) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', `/api/v1/shared/content/quests/${encodeURIComponent(questId)}`);
    }

    getQuestCompletion(questId, memberId = null) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
      return this.httpClient.request('GET', `/api/v1/shared/quests/${encodeURIComponent(questId)}/completion${query}`);
    }

    completeQuest(params = {}) {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      const idempotencyKey = params.idempotencyKey;
      if (!idempotencyKey) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MISSING_IDEMPOTENCY_KEY,
          'Idempotency key is required for consequential Quest completion mutations.'
        );
      }
      const questId = params.questId;
      return this.httpClient.request('POST', `/api/v1/shared/quests/${encodeURIComponent(questId)}/complete`, params, {
        idempotencyKey
      });
    }

    // ==========================================
    // 5. EVENTS & ATTENDANCE / CHECK-IN
    // ==========================================
    getEvents() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/events');
    }

    getEvent(eventId) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', `/api/v1/shared/events/${encodeURIComponent(eventId)}`);
    }

    getAttendance(eventInstanceId, memberId = null) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
      return this.httpClient.request('GET', `/api/v1/shared/attendance/${encodeURIComponent(eventInstanceId)}${query}`);
    }

    getAllAttendanceRecords() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/attendance');
    }

    checkIn(params = {}) {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      const idempotencyKey = params.idempotencyKey;
      if (!idempotencyKey) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MISSING_IDEMPOTENCY_KEY,
          'Idempotency key is required for Event check-in mutations.'
        );
      }
      return this.httpClient.request('POST', '/api/v1/shared/attendance/check-in', params, {
        idempotencyKey
      });
    }

    // ==========================================
    // 6. CAMPFIRES & GAMEPLAY
    // ==========================================
    getMyCampfires(memberId = null) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
      return this.httpClient.request('GET', `/api/v1/shared/campfires${query}`);
    }

    getCampfire(campfireId) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', `/api/v1/shared/campfires/${encodeURIComponent(campfireId)}`);
    }

    getCampfireMembers(campfireId) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', `/api/v1/shared/campfires/${encodeURIComponent(campfireId)}/members`);
    }

    getCampfireLeaders(campfireId) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', `/api/v1/shared/campfires/${encodeURIComponent(campfireId)}/leaders`);
    }

    getCampfireGameState(campfireId) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', `/api/v1/shared/campfires/${encodeURIComponent(campfireId)}/gamestate`);
    }

    getCampfireSettings() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/campfires/settings');
    }

    setCommunityMaxParticipants(adminMax) {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      const idempotencyKey = 'comm_max:' + Date.now();
      return this.httpClient.request('POST', '/api/v1/shared/campfires/settings/community-max', { adminMax }, {
        idempotencyKey
      });
    }

    setCampfireCapacity(campfireId, requestedMax, actorRole = 'LEADER') {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      const idempotencyKey = `cf_cap:${campfireId}:${Date.now()}`;
      return this.httpClient.request('POST', `/api/v1/shared/campfires/${encodeURIComponent(campfireId)}/capacity`, {
        requestedMax,
        actorRole
      }, {
        idempotencyKey
      });
    }

    addReactionToCampfire(campfireId, emoji) {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      const idempotencyKey = `cf_react:${campfireId}:${Date.now()}:${Math.random().toString(36).substr(2, 4)}`;
      return this.httpClient.request('POST', `/api/v1/shared/campfires/${encodeURIComponent(campfireId)}/reactions`, {
        emoji
      }, {
        idempotencyKey
      });
    }

    // ==========================================
    // 7. MINISTRIES & MINISTERIAL MISSIONS
    // ==========================================
    getMinistries() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/ministries');
    }

    getMyMinistries(memberId = null) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
      return this.httpClient.request('GET', `/api/v1/shared/ministries/mine${query}`);
    }

    getMinistryMissions(ministryId) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', `/api/v1/shared/ministries/${encodeURIComponent(ministryId)}/missions`);
    }

    getMyMinistryMissions(memberId = null) {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : '';
      return this.httpClient.request('GET', `/api/v1/shared/ministries/missions/mine${query}`);
    }

    // ==========================================
    // 8. MILESTONES & GROWTH
    // ==========================================
    getMilestones() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/milestones');
    }

    getGrowthProgress() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/growth/progress');
    }

    // ==========================================
    // 9. ACTIVITY EVENT BUS
    // ==========================================
    emitActivityEvent(params = {}) {
      if (!this.options.remoteMutationsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MUTATIONS_DISABLED,
          'Remote Shared Core mutations are disabled by default in Phase 0.23B.'
        );
      }
      const idempotencyKey = params.idempotencyKey;
      if (!idempotencyKey) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.MISSING_IDEMPOTENCY_KEY,
          'Idempotency key is required for consequential Activity Event mutations.'
        );
      }
      return this.httpClient.request('POST', '/api/v1/shared/activity/events', params, {
        idempotencyKey
      });
    }

    getActivityEvents() {
      if (!this.options.remoteReadsEnabled) {
        return createFailClosedResult(
          SHARED_CORE_ERRORS.READS_DISABLED,
          'Remote Shared Core reads are disabled by default in Phase 0.23B.'
        );
      }
      return this.httpClient.request('GET', '/api/v1/shared/activity/events');
    }
  }

  // Export structure
  const exportsObj = {
    SHARED_CORE_ERRORS,
    SharedCoreHttpClient,
    RemoteSharedCoreProvider
  };

  // Node.js CommonJS export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }

  // Browser global registration
  if (typeof root !== 'undefined') {
    root.RemoteSharedCoreProvider = RemoteSharedCoreProvider;
    root.SharedCoreHttpClient = SharedCoreHttpClient;
    root.SHARED_CORE_ERRORS = SHARED_CORE_ERRORS;
  }

})(typeof window !== 'undefined' ? window : global);
