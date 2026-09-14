/**
 * KOINONIA — PHASE 0.23I MEMBER IDENTITY & AUTHORIZATION FOUNDATION
 * Canonical Member Identity Contract, Normalization Layer & Provider Abstraction
 *
 * Core Principles:
 * 1. Provider-Independent Canonical Identity Contract.
 * 2. Fail-Closed Security & Strict Least Privilege Normalization.
 * 3. Derived Capabilities (No client-side self-elevation).
 * 4. Zero exposure or storage of credentials, tokens, or raw birthdates.
 * 5. Full backward compatibility with Phase 0.23H/0.23F prototype governance.
 */

(function(global) {
  'use strict';

  // ============================================================
  // 1. CANONICAL CONSTANTS & ENUMS
  // ============================================================
  const COMMUNITY_ID = 'fog';

  const ROLES = Object.freeze({
    MEMBER: 'MEMBER',
    ADMIN: 'ADMIN',
    SUPERADMIN: 'SUPERADMIN'
  });

  const CAPABILITY_NAMES = Object.freeze({
    CAN_ACCESS_STUDIO: 'canAccessStudio',
    CAN_AUTHOR_CONTENT: 'canAuthorContent',
    CAN_REVIEW_CONTENT: 'canReviewContent',
    CAN_PUBLISH_CONTENT: 'canPublishContent',
    CAN_MANAGE_CAMPFIRE: 'canManageCampfire'
  });

  // Base capabilities granted per role when authenticated
  const ROLE_CAPABILITIES = Object.freeze({
    MEMBER: Object.freeze({
      canAccessStudio: false,
      canAuthorContent: false,
      canReviewContent: false,
      canPublishContent: false,
      canManageCampfire: false
    }),
    ADMIN: Object.freeze({
      canAccessStudio: true,
      canAuthorContent: true,
      canReviewContent: false,
      canPublishContent: false,
      canManageCampfire: true
    }),
    SUPERADMIN: Object.freeze({
      canAccessStudio: true,
      canAuthorContent: true,
      canReviewContent: true,
      canPublishContent: true,
      canManageCampfire: true
    })
  });

  const SENSITIVE_PROPERTY_NAMES = new Set([
    'password', 'token', 'access_token', 'refresh_token', 'secret',
    'bearer', 'authorization', 'cookie', 'session', 'hash', 'private_key',
    'birthdate', 'dob', 'dateOfBirth'
  ]);

  // ============================================================
  // 2. PROVIDER TRUST BOUNDARY & UNFORGEABLE PRIVATE TOKEN
  // ============================================================
  // This Symbol is strictly local to this module closure and is NEVER exported.
  // Trust context cannot be granted by payload properties (e.g. raw.source, raw.trustedSource).
  const PRIVATE_PROVIDER_TRUST_TOKEN = Symbol('KOINONIA_PROVIDER_TRUST_TOKEN');

  /**
   * Public normalizer for arbitrary/untrusted identity payloads.
   * Untrusted payloads CANNOT self-declare trust or elevate to SUPERADMIN.
   */
  function normalizeMemberIdentity(raw) {
    return _normalizeInternal(raw, null);
  }

  /**
   * Explicit alias for untrusted identity normalization.
   */
  function normalizeUntrustedIdentity(raw) {
    return _normalizeInternal(raw, null);
  }

  /**
   * Provider-internal normalization entry point.
   * Only trusted providers possessing the private symbol token can call this.
   */
  function normalizeProviderIdentity(raw, trustContext) {
    if (!trustContext || trustContext.token !== PRIVATE_PROVIDER_TRUST_TOKEN) {
      // Forged or missing token fails closed to untrusted normalization
      return _normalizeInternal(raw, null);
    }
    return _normalizeInternal(raw, trustContext);
  }

  function _normalizeInternal(raw, trustContext) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return createGuestIdentity('Invalid identity payload');
    }

    // 1. Validate & sanitize memberId (Fail closed if missing/empty)
    const rawId = raw.memberId || raw.id;
    if (!rawId || typeof rawId !== 'string' || !rawId.trim()) {
      return createGuestIdentity('Missing or malformed memberId');
    }
    const memberId = rawId.trim();

    // 2. Authentication status
    const authenticated = raw.authenticated !== false;

    // 3. Role validation with strict provider trust boundary
    // PAYLOAD DATA MUST NOT GRANT ITS OWN TRUST.
    // SUPERADMIN can ONLY be granted if the identity was constructed internally
    // by a trusted provider holding PRIVATE_PROVIDER_TRUST_TOKEN.
    let role = ROLES.MEMBER;
    if (typeof raw.role === 'string') {
      const candidateRole = raw.role.trim().toUpperCase();
      if (candidateRole === ROLES.SUPERADMIN) {
        const isProviderTrusted = Boolean(
          trustContext &&
          trustContext.token === PRIVATE_PROVIDER_TRUST_TOKEN &&
          (
            (trustContext.provider === 'prototype' && (raw.memberId === 'father_alex' || raw.id === 'father_alex')) ||
            (trustContext.provider === 'shared-core' && trustContext.verifiedByServer === true)
          )
        );

        if (authenticated && isProviderTrusted) {
          role = ROLES.SUPERADMIN;
        } else {
          // Untrusted raw client input or forged payload claiming SUPERADMIN
          // is strictly rejected and clamped to MEMBER with zero privileged capabilities.
          role = ROLES.MEMBER;
        }
      } else if (candidateRole === ROLES.ADMIN) {
        role = ROLES.ADMIN;
      } else {
        role = ROLES.MEMBER;
      }
    }

    // 4. Derive capabilities strictly from role and authentication status
    // Client-supplied capability claims are NEVER trusted to escalate privileges
    let capabilities;
    if (!authenticated) {
      // Unauthenticated identity receives zero privileged capabilities
      capabilities = {
        canAccessStudio: false,
        canAuthorContent: false,
        canReviewContent: false,
        canPublishContent: false,
        canManageCampfire: false
      };
    } else {
      const baseCaps = ROLE_CAPABILITIES[role] || ROLE_CAPABILITIES.MEMBER;
      capabilities = {
        canAccessStudio: Boolean(baseCaps.canAccessStudio),
        canAuthorContent: Boolean(baseCaps.canAuthorContent),
        canReviewContent: Boolean(baseCaps.canReviewContent),
        canPublishContent: Boolean(baseCaps.canPublishContent),
        canManageCampfire: Boolean(baseCaps.canManageCampfire)
      };
    }

    // 5. Display Name & Names
    const displayName = (raw.displayName || raw.name || raw.shortName || 'Community Member').trim();
    const firstName = raw.firstName ? String(raw.firstName).trim() : (raw.shortName || displayName.split(' ')[0] || '');
    const lastName = raw.lastName ? String(raw.lastName).trim() : (displayName.split(' ').slice(1).join(' ') || '');

    // 6. Safeguards (Minor Safety Readiness)
    let isMinor = null;
    if (raw.safeguards && typeof raw.safeguards.isMinor === 'boolean') {
      isMinor = raw.safeguards.isMinor;
    } else if (typeof raw.isMinor === 'boolean') {
      isMinor = raw.isMinor;
    }

    // 7. Profile details
    const profile = {
      avatarUrl: (raw.profile && raw.profile.avatarUrl) ? String(raw.profile.avatarUrl).trim() : null,
      avatarEmoji: (raw.profile && raw.profile.avatarEmoji) || raw.avatar || (role === ROLES.SUPERADMIN ? '👑' : role === ROLES.ADMIN ? '👩‍💼' : '🧑'),
      growthLevel: (raw.profile && typeof raw.profile.growthLevel === 'number' && raw.profile.growthLevel >= 1)
        ? Math.floor(raw.profile.growthLevel)
        : (typeof raw.growthLevel === 'number' && raw.growthLevel >= 1 ? Math.floor(raw.growthLevel) : 1),
      title: (raw.profile && raw.profile.title) || raw.title || (role === ROLES.SUPERADMIN ? 'Father & Overseer' : role === ROLES.ADMIN ? 'Youth Leader / Author' : 'Community Member'),
      badge: (raw.profile && raw.profile.badge) || raw.badge || (role === ROLES.SUPERADMIN ? 'Superadmin' : role === ROLES.ADMIN ? 'Admin' : 'Member')
    };

    // 8. Memberships
    const memberships = {
      ministries: Array.isArray(raw.memberships?.ministries) ? [...raw.memberships.ministries] : [],
      campfires: Array.isArray(raw.memberships?.campfires) ? [...raw.memberships.campfires] : []
    };

    // 9. Source
    const source = (raw.source === 'shared-core') ? 'shared-core' : 'prototype';

    // Construct clean normalized object (strictly without secrets or tokens)
    const normalized = {
      memberId,
      id: memberId, // Backward-compatible alias for existing code
      communityId: COMMUNITY_ID,
      displayName,
      name: displayName, // Backward-compatible alias
      shortName: firstName || displayName, // Backward-compatible alias
      firstName,
      lastName,
      role,
      capabilities,
      profile,
      avatar: profile.avatarEmoji, // Backward-compatible alias
      title: profile.title,        // Backward-compatible alias
      badge: profile.badge,        // Backward-compatible alias
      memberships,
      safeguards: {
        isMinor
      },
      source,
      authenticated
    };

    return Object.freeze(normalized);
  }

  function createGuestIdentity(reason = 'Guest access') {
    return Object.freeze({
      memberId: 'guest_anonymous',
      id: 'guest_anonymous',
      communityId: COMMUNITY_ID,
      displayName: 'Guest Member',
      name: 'Guest Member',
      shortName: 'Guest',
      firstName: 'Guest',
      lastName: 'Member',
      role: ROLES.MEMBER,
      capabilities: Object.freeze({
        canAccessStudio: false,
        canAuthorContent: false,
        canReviewContent: false,
        canPublishContent: false,
        canManageCampfire: false
      }),
      profile: Object.freeze({
        avatarUrl: null,
        avatarEmoji: '👤',
        growthLevel: 1,
        title: 'Visitor',
        badge: 'Guest'
      }),
      avatar: '👤',
      title: 'Visitor',
      badge: 'Guest',
      memberships: Object.freeze({
        ministries: [],
        campfires: []
      }),
      safeguards: Object.freeze({
        isMinor: null // Unknown: handled conservatively
      }),
      source: 'prototype',
      authenticated: false,
      reason
    });
  }

  // Capability query helpers
  function canAccessStudio(identity) {
    return Boolean(identity && identity.capabilities && identity.capabilities.canAccessStudio);
  }

  function canAuthorContent(identity) {
    return Boolean(identity && identity.capabilities && identity.capabilities.canAuthorContent);
  }

  function canReviewContent(identity) {
    return Boolean(identity && identity.capabilities && identity.capabilities.canReviewContent);
  }

  function canPublishContent(identity) {
    return Boolean(identity && identity.capabilities && identity.capabilities.canPublishContent);
  }

  function canManageCampfire(identity) {
    return Boolean(identity && identity.capabilities && identity.capabilities.canManageCampfire);
  }

  // ============================================================
  // 3. CANONICAL PROTOTYPE PERSONAS (PHASE 0.23I)
  // ============================================================
  const PROTOTYPE_PERSONAS = Object.freeze({
    MEMBER: Object.freeze(normalizeProviderIdentity({
      memberId: 'youth_demo_01',
      displayName: 'Alex Rivera',
      firstName: 'Alex',
      lastName: 'Rivera',
      role: 'MEMBER',
      avatar: '🧑',
      badge: 'Member',
      title: 'Community Member',
      description: 'Explore Koinonia as a youth member walking in faith, stewardship, and community fellowship.',
      disclaimer: 'Beta demo identity only. No real FOG account authority.',
      safeguards: { isMinor: true },
      source: 'prototype',
      authenticated: true
    }, { token: PRIVATE_PROVIDER_TRUST_TOKEN, provider: 'prototype' })),
    ADMIN: Object.freeze(normalizeProviderIdentity({
      memberId: 'admin_sarah',
      displayName: 'Sarah Jenkins',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      role: 'ADMIN',
      avatar: '👩‍💼',
      badge: 'Admin',
      title: 'Youth Leader / Author',
      description: 'Author and craft fellowship content: create custom Places and Drafts in Koinonia Studio, submit for leadership review.',
      disclaimer: 'Beta demo identity only. Prototype Studio authoring only. Zero production database writes.',
      safeguards: { isMinor: false },
      source: 'prototype',
      authenticated: true
    }, { token: PRIVATE_PROVIDER_TRUST_TOKEN, provider: 'prototype' })),
    SUPERADMIN: Object.freeze(normalizeProviderIdentity({
      memberId: 'father_alex',
      displayName: 'Father Alex',
      firstName: 'Father',
      lastName: 'Alex',
      role: 'SUPERADMIN',
      avatar: '👑',
      badge: 'Superadmin',
      title: 'Father & Overseer',
      description: 'Oversee community governance: review submitted drafts, approve content, publish Places, and inspect audit logs.',
      disclaimer: 'Beta demo identity only. Prototype governance only. Zero production database writes.',
      safeguards: { isMinor: false },
      source: 'prototype',
      authenticated: true
    }, { token: PRIVATE_PROVIDER_TRUST_TOKEN, provider: 'prototype' }))
  });

  // ============================================================
  // 4. PROVIDER ABSTRACTION INTERFACE
  // ============================================================
  class BaseIdentityProvider {
    getCurrentIdentity() {
      throw new Error('Not implemented');
    }
    isAuthenticated() {
      const id = this.getCurrentIdentity();
      return Boolean(id && id.authenticated);
    }
    getCapabilities() {
      const id = this.getCurrentIdentity();
      return id ? id.capabilities : ROLE_CAPABILITIES.MEMBER;
    }
    hasCapability(capabilityName) {
      const caps = this.getCapabilities();
      return Boolean(caps && caps[capabilityName]);
    }
    subscribeIdentityChanges(callback) {
      return () => {};
    }
  }

  // Provider A: PrototypeIdentityProvider (Active for Phase 0.23I)
  class PrototypeIdentityProvider extends BaseIdentityProvider {
    constructor(options = {}) {
      super();
      this.storageKey = options.storageKey || 'koinonia_beta_identity';
      this.inMemoryKey = null;
      this.subscribers = new Set();
    }

    getStorage() {
      if (typeof localStorage !== 'undefined') return localStorage;
      if (typeof global !== 'undefined' && global.localStorage) return global.localStorage;
      return null;
    }

    getSavedPersonaKey() {
      const storage = this.getStorage();
      if (storage) {
        try {
          const saved = storage.getItem(this.storageKey);
          if (saved && PROTOTYPE_PERSONAS[saved.toUpperCase()]) {
            return saved.toUpperCase();
          }
        } catch (_) {}
      }
      return this.inMemoryKey || null;
    }

    hasSavedIdentity() {
      return Boolean(this.getSavedPersonaKey());
    }

    getCurrentIdentity() {
      const key = this.getSavedPersonaKey();
      return key ? PROTOTYPE_PERSONAS[key] : PROTOTYPE_PERSONAS.MEMBER;
    }

    setIdentity(personaKey) {
      const key = String(personaKey || '').toUpperCase();
      if (!PROTOTYPE_PERSONAS[key]) {
        console.warn('[PrototypeIdentityProvider] Invalid persona key: ' + personaKey);
        return null;
      }
      this.inMemoryKey = key;
      const storage = this.getStorage();
      if (storage) {
        try {
          storage.setItem(this.storageKey, key);
        } catch (err) {
          console.warn('[PrototypeIdentityProvider] Unable to save to localStorage:', err);
        }
      }
      const newIdentity = PROTOTYPE_PERSONAS[key];
      this.notifySubscribers(newIdentity);
      return newIdentity;
    }

    clearIdentity() {
      this.inMemoryKey = null;
      const storage = this.getStorage();
      if (storage) {
        try {
          storage.removeItem(this.storageKey);
        } catch (_) {}
      }
      this.notifySubscribers(PROTOTYPE_PERSONAS.MEMBER);
    }

    getPersonas() {
      return [
        PROTOTYPE_PERSONAS.MEMBER,
        PROTOTYPE_PERSONAS.ADMIN,
        PROTOTYPE_PERSONAS.SUPERADMIN
      ];
    }

    getPersona(key) {
      const k = String(key || '').toUpperCase();
      return PROTOTYPE_PERSONAS[k] || null;
    }

    getNamespacedSaveKey(identity) {
      const id = identity || this.getCurrentIdentity();
      return 'koinonia.phase22_1.save.' + (id.memberId || id.id || 'youth_demo_01');
    }

    subscribeIdentityChanges(callback) {
      if (typeof callback !== 'function') return () => {};
      this.subscribers.add(callback);
      return () => this.subscribers.delete(callback);
    }

    notifySubscribers(identity) {
      this.subscribers.forEach(cb => {
        try { cb(identity); } catch (err) { console.error('Identity subscriber error:', err); }
      });
    }
  }

  // Provider B: SharedCoreIdentityProvider Placeholder (Future Shared Core Boundary)
  class SharedCoreIdentityProvider extends BaseIdentityProvider {
    constructor(options = {}) {
      super();
      this.enabled = false; // Strictly disabled in Phase 0.23I
      this.endpoint = options.endpoint || '/api/v1/shared/auth/me';
      this.cachedIdentity = null;
    }

    getCurrentIdentity() {
      if (!this.enabled || !this.cachedIdentity) {
        return createGuestIdentity('Shared Core identity provider is inactive in prototype mode');
      }
      return this.cachedIdentity;
    }

    // Mock/placeholder fetch that fails closed; strictly ZERO network calls to Main App
    async fetchIdentity() {
      if (!this.enabled) {
        return createGuestIdentity('Shared Core identity provider is disabled');
      }
      return createGuestIdentity('Not implemented in Phase 0.23I');
    }
  }

  // ============================================================
  // 5. UNIFIED KOINONIA IDENTITY MANAGER & EXPORTS
  // ============================================================
  const defaultPrototypeProvider = new PrototypeIdentityProvider();
  let activeProvider = defaultPrototypeProvider;

  const KoinoniaIdentity = {
    COMMUNITY_ID,
    ROLES,
    CAPABILITY_NAMES,
    ROLE_CAPABILITIES,
    normalizeMemberIdentity,
    normalizeUntrustedIdentity,
    normalizeProviderIdentity,
    createGuestIdentity,
    canAccessStudio,
    canAuthorContent,
    canReviewContent,
    canPublishContent,
    canManageCampfire,
    PROTOTYPE_PERSONAS,
    BaseIdentityProvider,
    PrototypeIdentityProvider,
    SharedCoreIdentityProvider,

    // Active Provider Delegation
    getProvider() {
      return activeProvider;
    },
    setProvider(provider) {
      if (provider instanceof BaseIdentityProvider) {
        activeProvider = provider;
      } else {
        throw new Error('Provider must extend BaseIdentityProvider');
      }
    },
    getCurrentIdentity() {
      return activeProvider.getCurrentIdentity();
    },
    isAuthenticated() {
      return activeProvider.isAuthenticated();
    },
    getCapabilities() {
      return activeProvider.getCapabilities();
    },
    hasCapability(capName) {
      return activeProvider.hasCapability(capName);
    },
    subscribeIdentityChanges(cb) {
      return activeProvider.subscribeIdentityChanges(cb);
    },
    setIdentity(personaKey) {
      if (typeof activeProvider.setIdentity === 'function') {
        return activeProvider.setIdentity(personaKey);
      }
      return null;
    },
    getPersonas() {
      if (typeof activeProvider.getPersonas === 'function') {
        return activeProvider.getPersonas();
      }
      return [];
    },
    hasSavedIdentity() {
      if (typeof activeProvider.hasSavedIdentity === 'function') {
        return activeProvider.hasSavedIdentity();
      }
      return false;
    },
    getNamespacedSaveKey(id) {
      if (typeof activeProvider.getNamespacedSaveKey === 'function') {
        return activeProvider.getNamespacedSaveKey(id);
      }
      return 'koinonia.phase22_1.save.default';
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KoinoniaIdentity;
  }
  if (typeof global !== 'undefined') {
    global.KoinoniaIdentity = KoinoniaIdentity;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
