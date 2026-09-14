/**
 * KOINONIA — PHASE 0.23B
 * SHARED CORE PROVIDER FACTORY & REGISTRY
 *
 * Architecture:
 *   KOINONIA Gameplay Systems
 *              ↓
 *   SharedCore Provider Abstraction (Local vs Remote)
 *              ↓
 *   [Local: In-Memory / LocalStorage (Default)]
 *   [Remote: Future Authenticated /api/v1/shared/* (Fail-Closed)]
 *
 * CANONICAL SAFETY INVARIANTS:
 * - LocalSharedCoreProvider remains the DEFAULT and active provider.
 * - RemoteSharedCoreProvider NEVER activates merely because files exist.
 * - Remote mode requires explicit configuration (providerMode: 'remote').
 * - Remote mutations have a second explicit gate and remain disabled by default.
 * - Zero direct database access (staging/production database is never accessed).
 * - Zero raw mutation route access (rejects /api/checkin, /api/games/universal-submit, etc.).
 * - No silent fallback from failed remote mutations to local rewards.
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
    FORBIDDEN: 'SHARED_CORE_FORBIDDEN',
    NOT_FOUND: 'SHARED_CORE_NOT_FOUND',
    CONFLICT: 'SHARED_CORE_CONFLICT',
    VALIDATION_ERROR: 'SHARED_CORE_VALIDATION_ERROR',
    RATE_LIMITED: 'SHARED_CORE_RATE_LIMITED',
    SERVER_ERROR: 'SHARED_CORE_SERVER_ERROR',
    MALFORMED_RESPONSE: 'SHARED_CORE_MALFORMED_RESPONSE',
    TIMEOUT: 'SHARED_CORE_TIMEOUT',
    OPERATION_UNSUPPORTED: 'SHARED_CORE_OPERATION_UNSUPPORTED',
    REMOTE_NOT_CONFIGURED: 'SHARED_CORE_REMOTE_NOT_CONFIGURED',
    INVALID_OPTIONS: 'SHARED_CORE_INVALID_OPTIONS'
  };

  // Canonical Default Provider Configuration
  const DEFAULT_PROVIDER_CONFIG = {
    providerMode: 'local',           // 'local' | 'remote' — DEFAULT MUST BE LOCAL
    remoteReadsEnabled: false,       // Default disabled
    remoteMutationsEnabled: false,   // Default disabled
    baseUrl: '',                     // No hardcoded IP or remote domain
    timeoutMs: 8000,
    credentials: 'same-origin'
  };

  // Safe resolver for LocalSharedCoreProvider
  function resolveLocalProviderClass() {
    if (typeof root !== 'undefined' && root.LocalSharedCoreProvider) {
      return root.LocalSharedCoreProvider;
    }
    if (typeof require !== 'undefined') {
      try {
        const mod = require('./shared_core.js');
        return mod.LocalSharedCoreProvider || mod;
      } catch (_) {}
    }
    return null;
  }

  // Safe resolver for RemoteSharedCoreProvider
  function resolveRemoteProviderClass() {
    if (typeof root !== 'undefined' && root.RemoteSharedCoreProvider) {
      return root.RemoteSharedCoreProvider;
    }
    if (typeof require !== 'undefined') {
      try {
        const mod = require('./remote_shared_core.js');
        return mod.RemoteSharedCoreProvider || mod;
      } catch (_) {}
    }
    return null;
  }

  // Safe resolver for runtime configuration
  function resolveRuntimeConfig(customRc) {
    let rc = customRc;
    const isBrowser = typeof window !== 'undefined';
    if (rc === undefined) {
      if (isBrowser && window.__KOINONIA_RUNTIME_CONFIG__ !== undefined) {
        rc = window.__KOINONIA_RUNTIME_CONFIG__;
      } else if (typeof root !== 'undefined' && root.__KOINONIA_RUNTIME_CONFIG__ !== undefined) {
        rc = root.__KOINONIA_RUNTIME_CONFIG__;
      }
    }

    if (rc && rc.sharedCoreMode === 'mock') {
      return {
        providerMode: 'remote',
        sharedCoreMode: 'mock',
        remoteReadsEnabled: Boolean(rc.remoteReadsEnabled),
        remoteMutationsEnabled: false, // strictly false in Phase 0.23D browser harness
        baseUrl: rc.baseUrl || ''
      };
    }

    if (rc && rc.sharedCoreMode === 'local') {
      return {
        providerMode: 'local',
        sharedCoreMode: 'local',
        remoteReadsEnabled: false,
        remoteMutationsEnabled: false
      };
    }

    // In browser environment or when config is explicitly provided or set:
    // sharedCoreMode === "unavailable" OR invalid/missing config -> FAIL CLOSED
    if (isBrowser || rc !== undefined) {
      return {
        providerMode: 'remote',
        sharedCoreMode: 'unavailable',
        remoteReadsEnabled: false,
        remoteMutationsEnabled: false,
        baseUrl: (rc && rc.baseUrl) || '',
        configLoadFailed: true
      };
    }

    // Pure Node.js environment without runtime config (preserves Phase 0.23B baseline tests)
    return {
      providerMode: 'local',
      sharedCoreMode: 'local',
      remoteReadsEnabled: false,
      remoteMutationsEnabled: false
    };
  }

  /**
   * Factory function to instantiate a Shared Core provider.
   *
   * @param {Object} options Configuration overrides
   * @returns {Object} LocalSharedCoreProvider or RemoteSharedCoreProvider instance
   */
  function createSharedCoreProvider(options = {}) {
    const config = Object.assign({}, DEFAULT_PROVIDER_CONFIG, options);

    // REMOTE MODE: Requires explicit 'remote' providerMode
    if (config.providerMode === 'remote') {
      const RemoteClass = resolveRemoteProviderClass();
      if (!RemoteClass) {
        throw new Error('[SharedCoreProvider] RemoteSharedCoreProvider is not available in environment.');
      }
      return new RemoteClass(config);
    }

    // DEFAULT MODE: LocalSharedCoreProvider
    const LocalClass = resolveLocalProviderClass();
    if (!LocalClass) {
      throw new Error('[SharedCoreProvider] LocalSharedCoreProvider is not available in environment.');
    }
    return new LocalClass(config);
  }

  // Active singleton instance (default: Local provider unless configured)
  let activeProviderInstance = null;

  /**
   * Get the active Shared Core provider instance.
   * Initializes to configured runtime provider or LocalSharedCoreProvider.
   *
   * @param {Object} [options] Optional configuration overrides for initialization
   * @returns {Object} Active provider instance
   */
  function getSharedCoreProvider(options = {}) {
    if (!activeProviderInstance) {
      const runtimeOpts = resolveRuntimeConfig();
      activeProviderInstance = createSharedCoreProvider(Object.assign({}, runtimeOpts, options));
      if (typeof root !== 'undefined') {
        root.SharedCore = activeProviderInstance;
      }
    }
    return activeProviderInstance;
  }

  /**
   * Set or override the active Shared Core provider.
   * Used for testing or explicit configuration changes.
   *
   * @param {Object} provider A valid SharedCore provider instance
   */
  function setSharedCoreProvider(provider) {
    if (!provider || typeof provider.getCurrentMember !== 'function') {
      throw new Error('[SharedCoreProvider] Invalid provider: must implement SharedCore contract.');
    }
    activeProviderInstance = provider;
    if (typeof root !== 'undefined') {
      root.SharedCore = provider;
    }
  }

  /**
   * Reset the active provider back to default LocalSharedCoreProvider.
   */
  function resetSharedCoreProvider() {
    activeProviderInstance = null;
    return getSharedCoreProvider();
  }

  /**
   * Reusable Async Normalization Controller for Shared Core Provider Integration.
   * Handles non-blocking reads, error isolation, metrics tracking, and no-split-brain enforcement.
   */
  class SharedCoreAsyncController {
    constructor(options = {}) {
      this.provider = options.provider || getSharedCoreProvider();
      this.status = 'idle'; // 'idle' | 'loading' | 'connected' | 'unavailable' | 'error'
      this.lastRequestTime = null;
      this.lastSuccessTime = null;
      this.lastErrorCode = null;
      this.lastErrorMessage = null;
      this.metrics = {
        requestsTotal: 0,
        readsTotal: 0,
        mutationsAttempted: 0,
        mutationsBlocked: 0,
        failuresTotal: 0
      };
      this.cachedData = {
        member: null,
        lifePoints: null,
        quests: null,
        events: null,
        campfires: null,
        ministries: null,
        milestones: null,
        growthProgress: null
      };
      this.listeners = new Set();
    }

    subscribe(listener) {
      if (typeof listener === 'function') {
        this.listeners.add(listener);
      }
      return () => this.listeners.delete(listener);
    }

    _notify() {
      for (const listener of this.listeners) {
        try { listener(this.getState()); } catch (_) {}
      }
    }

    getState() {
      const isRemote = Boolean(this.provider && this.provider.capabilities && this.provider.capabilities.remote);
      return {
        status: this.status,
        providerName: isRemote ? 'RemoteSharedCoreProvider' : 'LocalSharedCoreProvider',
        providerMode: this.provider && this.provider.capabilities ? this.provider.capabilities.providerMode : 'unknown',
        isRemote,
        lastRequestTime: this.lastRequestTime,
        lastSuccessTime: this.lastSuccessTime,
        lastErrorCode: this.lastErrorCode,
        lastErrorMessage: this.lastErrorMessage,
        metrics: { ...this.metrics },
        cachedData: { ...this.cachedData }
      };
    }

    /**
     * Executes a provider read operation safely, normalizing synchronous and asynchronous responses.
     */
    async executeRead(methodName, ...args) {
      this.metrics.requestsTotal++;
      this.metrics.readsTotal++;
      this.lastRequestTime = new Date().toISOString();

      if (!this.provider || typeof this.provider[methodName] !== 'function') {
        this.status = 'error';
        this.lastErrorCode = 'METHOD_NOT_FOUND';
        this.lastErrorMessage = `Provider method ${methodName} not found.`;
        this.metrics.failuresTotal++;
        this._notify();
        return { success: false, ok: false, error: this.lastErrorCode, message: this.lastErrorMessage };
      }

      try {
        const rawResult = await this.provider[methodName](...args);
        // Fail-closed detection
        if (rawResult && (rawResult.success === false || rawResult.error)) {
          this.status = 'unavailable';
          this.lastErrorCode = rawResult.error || rawResult.code || 'UNKNOWN_ERROR';
          this.lastErrorMessage = rawResult.message || 'Shared Core read operation failed.';
          this.metrics.failuresTotal++;
          this._notify();
          return { success: false, ok: false, error: this.lastErrorCode, message: this.lastErrorMessage, raw: rawResult };
        }

        // Success
        this.status = 'connected';
        this.lastSuccessTime = this.lastRequestTime;
        this.lastErrorCode = null;
        this.lastErrorMessage = null;
        this._notify();
        return { success: true, ok: true, data: rawResult };
      } catch (err) {
        this.status = 'unavailable';
        this.lastErrorCode = err.code || err.name || 'SHARED_CORE_NETWORK_ERROR';
        this.lastErrorMessage = err.message || 'Shared Core network communication error.';
        this.metrics.failuresTotal++;
        this._notify();
        return { success: false, ok: false, error: this.lastErrorCode, message: this.lastErrorMessage };
      }
    }

    /**
     * Executes a mutation through the provider with strict fail-closed guards.
     * In read-only development mode, blocks mutation immediately with clear error.
     */
    async executeMutation(methodName, params = {}, ...args) {
      this.metrics.requestsTotal++;
      this.metrics.mutationsAttempted++;
      this.lastRequestTime = new Date().toISOString();

      const caps = (this.provider && this.provider.capabilities) ? this.provider.capabilities : {};
      if (!caps.mutationsEnabled) {
        this.metrics.mutationsBlocked++;
        this.lastErrorCode = SHARED_CORE_ERRORS.MUTATIONS_DISABLED;
        this.lastErrorMessage = 'Shared Core is in Read-Only mode. Mutations are disabled.';
        this._notify();
        return {
          success: false,
          ok: false,
          blocked: true,
          error: this.lastErrorCode,
          code: this.lastErrorCode,
          message: this.lastErrorMessage
        };
      }

      if (!this.provider || typeof this.provider[methodName] !== 'function') {
        this.status = 'error';
        this.lastErrorCode = 'METHOD_NOT_FOUND';
        this.lastErrorMessage = `Provider method ${methodName} not found.`;
        this.metrics.failuresTotal++;
        this._notify();
        return { success: false, ok: false, error: this.lastErrorCode, message: this.lastErrorMessage };
      }

      try {
        const rawResult = await this.provider[methodName](params, ...args);
        if (rawResult && (rawResult.success === false || rawResult.error)) {
          this.lastErrorCode = rawResult.error || rawResult.code || 'MUTATION_FAILED';
          this.lastErrorMessage = rawResult.message || 'Shared Core mutation failed.';
          this.metrics.failuresTotal++;
          this._notify();
          return { success: false, ok: false, error: this.lastErrorCode, message: this.lastErrorMessage, raw: rawResult };
        }

        this.lastSuccessTime = this.lastRequestTime;
        this.lastErrorCode = null;
        this.lastErrorMessage = null;
        this._notify();
        return { success: true, ok: true, data: rawResult };
      } catch (err) {
        this.lastErrorCode = err.code || err.name || 'SHARED_CORE_NETWORK_ERROR';
        this.lastErrorMessage = err.message || 'Shared Core mutation network error.';
        this.metrics.failuresTotal++;
        this._notify();
        return { success: false, ok: false, error: this.lastErrorCode, message: this.lastErrorMessage };
      }
    }

    /**
     * Exercises all 8 canonical representative remote reads via the provider abstraction.
     * Updates internal cachedData mirror for diagnostics and UI.
     */
    async syncAllRepresentativeReads() {
      this.status = 'loading';
      this._notify();

      const results = await Promise.allSettled([
        this.executeRead('getCurrentMember'),
        this.executeRead('getLifePoints'),
        this.executeRead('getQuests'),
        this.executeRead('getEvents'),
        this.executeRead('getMyCampfires'),
        this.executeRead('getMinistries'),
        this.executeRead('getMilestones'),
        this.executeRead('getGrowthProgress')
      ]);

      const [mRes, lpRes, qRes, eRes, cfRes, minRes, mlsRes, gRes] = results.map(r => (r.status === 'fulfilled' ? r.value : { ok: false, error: 'PROMISE_REJECTED' }));

      if (mRes.ok) this.cachedData.member = mRes.data.member || mRes.data;
      if (lpRes.ok) this.cachedData.lifePoints = lpRes.data;
      if (qRes.ok) this.cachedData.quests = qRes.data.quests || qRes.data;
      if (eRes.ok) this.cachedData.events = eRes.data.events || eRes.data;
      if (cfRes.ok) this.cachedData.campfires = cfRes.data.campfires || cfRes.data;
      if (minRes.ok) this.cachedData.ministries = minRes.data.ministries || minRes.data;
      if (mlsRes.ok) this.cachedData.milestones = mlsRes.data.milestones || mlsRes.data;
      if (gRes.ok) this.cachedData.growthProgress = gRes.data.progress || gRes.data.growthProgress || gRes.data;

      const anySuccess = results.some(r => r.status === 'fulfilled' && r.value.ok);
      const allSuccess = results.every(r => r.status === 'fulfilled' && r.value.ok);

      if (allSuccess) {
        this.status = 'connected';
      } else if (anySuccess) {
        this.status = 'connected';
      } else {
        this.status = 'unavailable';
      }
      this._notify();

      return {
        status: this.status,
        allSuccess,
        results: {
          member: mRes,
          lifePoints: lpRes,
          quests: qRes,
          events: eRes,
          campfires: cfRes,
          ministries: minRes,
          milestones: mlsRes,
          growthProgress: gRes
        }
      };
    }
  }

  // Export structure
  const exportsObj = {
    SHARED_CORE_ERRORS,
    DEFAULT_PROVIDER_CONFIG,
    createSharedCoreProvider,
    getSharedCoreProvider,
    setSharedCoreProvider,
    resetSharedCoreProvider,
    SharedCoreAsyncController,
    resolveRuntimeConfig
  };

  // Node.js CommonJS export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportsObj;
  }

  // Browser global registration
  if (typeof root !== 'undefined') {
    root.SharedCoreProviderFactory = exportsObj;
    root.createSharedCoreProvider = createSharedCoreProvider;
    root.getSharedCoreProvider = getSharedCoreProvider;
    root.setSharedCoreProvider = setSharedCoreProvider;
    root.resetSharedCoreProvider = resetSharedCoreProvider;
    root.SharedCoreAsyncController = SharedCoreAsyncController;
    root.SHARED_CORE_ERRORS = SHARED_CORE_ERRORS;
    root.resolveRuntimeConfig = resolveRuntimeConfig;

    // Initialize singleton on load
    getSharedCoreProvider();
  }

})(typeof window !== 'undefined' ? window : global);
