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

  // Active singleton instance (default: Local provider)
  let activeProviderInstance = null;

  /**
   * Get the active Shared Core provider instance.
   * Initializes to LocalSharedCoreProvider on first call if not set.
   *
   * @param {Object} [options] Optional configuration for initialization
   * @returns {Object} Active provider instance
   */
  function getSharedCoreProvider(options = {}) {
    if (!activeProviderInstance) {
      activeProviderInstance = createSharedCoreProvider(options);
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

  // Export structure
  const exportsObj = {
    SHARED_CORE_ERRORS,
    DEFAULT_PROVIDER_CONFIG,
    createSharedCoreProvider,
    getSharedCoreProvider,
    setSharedCoreProvider,
    resetSharedCoreProvider
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
    root.SHARED_CORE_ERRORS = SHARED_CORE_ERRORS;
  }

})(typeof window !== 'undefined' ? window : global);
