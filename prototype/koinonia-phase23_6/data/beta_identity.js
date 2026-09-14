/**
 * KOINONIA BETA IDENTITY PROVIDER (PHASE 0.23I HARMONIZED)
 *
 * ============================================================
 * CANONICAL SAFETY & DEMO BOUNDARY NOTICE
 * ============================================================
 * This module provides a CLIENT-SIDE TEST / PROTOTYPE IDENTITY SCAFFOLD
 * specifically for physical Internet beta product evaluation.
 *
 * These personas (Member Alex, Admin Sarah, Superadmin Father Alex)
 * are DEMO IDENTITIES ONLY.
 *
 * They grant ZERO real Main App / production database authority.
 * Real FOG account authentication belongs to Shared Core Stage 3.
 *
 * ============================================================
 * PHASE 0.23I MEMBER IDENTITY CONTRACT HARMONIZATION
 * ============================================================
 * In Phase 0.23I, BetaIdentityProvider is harmonized with the canonical
 * KoinoniaIdentity contract (data/member_identity.js).
 * All personas provide both legacy fields and normalized canonical fields:
 * - memberId (canonical) & id (legacy alias)
 * - displayName (canonical) & name (legacy alias)
 * - capabilities (with both legacy flags and canonical capabilities)
 * - safeguards: { isMinor }
 * - source: 'prototype'
 * - authenticated: true
 *
 * Methods preserve exact backward compatibility for existing game and test suites.
 */

(function(global) {
  'use strict';

  const STORAGE_KEY = 'koinonia_beta_identity';

  // Load or reference KoinoniaIdentity if available
  let KoinoniaIdentity = (typeof global !== 'undefined' && global.KoinoniaIdentity) ||
                         (typeof window !== 'undefined' && window.KoinoniaIdentity);
  if (!KoinoniaIdentity && typeof require !== 'undefined') {
    try {
      KoinoniaIdentity = require('./member_identity.js');
    } catch (_) {}
  }

  const PERSONAS = {
    MEMBER: {
      id: 'youth_demo_01',
      memberId: 'youth_demo_01',
      communityId: 'fog',
      personaKey: 'MEMBER',
      name: 'Alex Rivera',
      displayName: 'Alex Rivera',
      shortName: 'Alex',
      firstName: 'Alex',
      lastName: 'Rivera',
      username: 'alex_r',
      role: 'MEMBER',
      badge: 'Member',
      title: 'Community Member',
      avatar: '🧑',
      description: 'Explore Koinonia as a youth member walking in faith, stewardship, and community fellowship.',
      disclaimer: 'Beta demo identity only. No real FOG account authority.',
      capabilities: {
        canPlay: true,
        canDoQuests: true,
        canDoFellowship: true,
        canAccessStudio: false,
        canPublish: false,
        canApprove: false,
        canRequestReview: false,
        canAuthorContent: false,
        canReviewContent: false,
        canPublishContent: false,
        canManageCampfire: false
      },
      profile: {
        avatarUrl: null,
        avatarEmoji: '🧑',
        growthLevel: 1,
        title: 'Community Member',
        badge: 'Member'
      },
      memberships: {
        ministries: [],
        campfires: []
      },
      safeguards: {
        isMinor: true
      },
      source: 'prototype',
      authenticated: true
    },
    ADMIN: {
      id: 'admin_sarah',
      memberId: 'admin_sarah',
      communityId: 'fog',
      personaKey: 'ADMIN',
      name: 'Sarah Jenkins',
      displayName: 'Sarah Jenkins',
      shortName: 'Sarah',
      firstName: 'Sarah',
      lastName: 'Jenkins',
      username: 'sarah_j',
      role: 'ADMIN',
      badge: 'Admin',
      title: 'Youth Leader / Author',
      avatar: '👩‍💼',
      description: 'Author and craft fellowship content: create custom Places and Drafts in Koinonia Studio, submit for leadership review.',
      disclaimer: 'Beta demo identity only. Prototype Studio authoring only. Zero production database writes.',
      capabilities: {
        canPlay: true,
        canDoQuests: true,
        canDoFellowship: true,
        canAccessStudio: true,
        canPublish: false,
        canApprove: false,
        canRequestReview: true,
        canAuthorContent: true,
        canReviewContent: false,
        canPublishContent: false,
        canManageCampfire: true
      },
      profile: {
        avatarUrl: null,
        avatarEmoji: '👩‍💼',
        growthLevel: 1,
        title: 'Youth Leader / Author',
        badge: 'Admin'
      },
      memberships: {
        ministries: ['youth'],
        campfires: []
      },
      safeguards: {
        isMinor: false
      },
      source: 'prototype',
      authenticated: true
    },
    SUPERADMIN: {
      id: 'father_alex',
      memberId: 'father_alex',
      communityId: 'fog',
      personaKey: 'SUPERADMIN',
      name: 'Father Alex',
      displayName: 'Father Alex',
      shortName: 'Father Alex',
      firstName: 'Father',
      lastName: 'Alex',
      username: 'father_a',
      role: 'SUPERADMIN',
      badge: 'Superadmin',
      title: 'Father & Overseer',
      avatar: '👑',
      description: 'Oversee community governance: review submitted drafts, approve content, publish Places, and inspect audit logs.',
      disclaimer: 'Beta demo identity only. Prototype governance only. Zero production database writes.',
      capabilities: {
        canPlay: true,
        canDoQuests: true,
        canDoFellowship: true,
        canAccessStudio: true,
        canPublish: true,
        canApprove: true,
        canRequestReview: true,
        canAuthorContent: true,
        canReviewContent: true,
        canPublishContent: true,
        canManageCampfire: true
      },
      profile: {
        avatarUrl: null,
        avatarEmoji: '👑',
        growthLevel: 1,
        title: 'Father & Overseer',
        badge: 'Superadmin'
      },
      memberships: {
        ministries: ['leadership', 'pastoral'],
        campfires: []
      },
      safeguards: {
        isMinor: false
      },
      source: 'prototype',
      authenticated: true
    }
  };

  let inMemoryCurrentKey = null;

  function hasSavedIdentity() {
    return Boolean(getSavedIdentityKey());
  }

  function getSavedIdentityKey() {
    let saved = null;
    if (typeof localStorage !== 'undefined') {
      try {
        saved = localStorage.getItem(STORAGE_KEY);
      } catch (_) {}
    }
    if (!saved && inMemoryCurrentKey) {
      saved = inMemoryCurrentKey;
    }
    return (saved && PERSONAS[saved]) ? saved : null;
  }

  function getCurrentIdentity() {
    const key = getSavedIdentityKey();
    return key ? PERSONAS[key] : PERSONAS.MEMBER;
  }

  function setIdentity(personaKey) {
    const key = String(personaKey).toUpperCase();
    if (!PERSONAS[key]) {
      console.warn('[BetaIdentityProvider] Invalid persona key: ' + personaKey);
      return null;
    }
    inMemoryCurrentKey = key;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, key);
      } catch (err) {
        console.warn('[BetaIdentityProvider] Unable to save identity to localStorage:', err);
      }
    }
    // Also sync with KoinoniaIdentity default provider if loaded
    if (KoinoniaIdentity && typeof KoinoniaIdentity.setIdentity === 'function') {
      try {
        KoinoniaIdentity.setIdentity(key);
      } catch (_) {}
    }
    return PERSONAS[key];
  }

  function clearIdentity() {
    inMemoryCurrentKey = null;
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
    if (KoinoniaIdentity && typeof KoinoniaIdentity.getProvider === 'function') {
      try {
        const provider = KoinoniaIdentity.getProvider();
        if (provider && typeof provider.clearIdentity === 'function') {
          provider.clearIdentity();
        }
      } catch (_) {}
    }
  }

  function getPersonas() {
    return [PERSONAS.MEMBER, PERSONAS.ADMIN, PERSONAS.SUPERADMIN];
  }

  function getPersona(personaKey) {
    const key = String(personaKey).toUpperCase();
    return PERSONAS[key] || null;
  }

  function isAuthorizedAdmin(identity) {
    const id = identity || getCurrentIdentity();
    return Boolean(id && (id.role === 'ADMIN' || id.role === 'SUPERADMIN'));
  }

  function isSuperadmin(identity) {
    const id = identity || getCurrentIdentity();
    return Boolean(id && id.role === 'SUPERADMIN');
  }

  function canAccessStudio(identity) {
    const id = identity || getCurrentIdentity();
    return Boolean(id && id.capabilities && (id.capabilities.canAccessStudio || false));
  }

  function canPublish(identity) {
    const id = identity || getCurrentIdentity();
    return Boolean(id && id.capabilities && (id.capabilities.canPublishContent || id.capabilities.canPublish || false));
  }

  function getNamespacedSaveKey(identity) {
    const id = identity || getCurrentIdentity();
    const mid = id.memberId || id.id || 'youth_demo_01';
    return 'koinonia.phase22_1.save.' + mid;
  }

  function getNormalizedIdentity(identity) {
    const id = identity || getCurrentIdentity();
    if (KoinoniaIdentity) {
      // If id is one of the authentic canonical BetaIdentityProvider personas, return trusted normalized persona
      if (id && id.personaKey && PERSONAS[id.personaKey] && id === PERSONAS[id.personaKey] && KoinoniaIdentity.PROTOTYPE_PERSONAS && KoinoniaIdentity.PROTOTYPE_PERSONAS[id.personaKey]) {
        return KoinoniaIdentity.PROTOTYPE_PERSONAS[id.personaKey];
      }
      if (typeof KoinoniaIdentity.normalizeUntrustedIdentity === 'function') {
        return KoinoniaIdentity.normalizeUntrustedIdentity(id);
      }
      if (typeof KoinoniaIdentity.normalizeMemberIdentity === 'function') {
        return KoinoniaIdentity.normalizeMemberIdentity(id);
      }
    }
    return id;
  }

  const BetaIdentityProvider = {
    STORAGE_KEY,
    PERSONAS,
    hasSavedIdentity,
    getSavedIdentityKey,
    getCurrentIdentity,
    setIdentity,
    clearIdentity,
    getPersonas,
    getPersona,
    isAuthorizedAdmin,
    isSuperadmin,
    canAccessStudio,
    canPublish,
    getNamespacedSaveKey,
    getNormalizedIdentity
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BetaIdentityProvider;
  }
  if (typeof global !== 'undefined') {
    global.BetaIdentityProvider = BetaIdentityProvider;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
