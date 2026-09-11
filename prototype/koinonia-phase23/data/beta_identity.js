/**
 * KOINONIA BETA IDENTITY PROVIDER (PHASE 0.22.1)
 *
 * ============================================================
 * CANONICAL SAFETY & DEMO BOUNDARY NOTICE
 * ============================================================
 * This module provides a CLIENT-SIDE TEST / PROTOTYPE IDENTITY SCAFFOLD
 * specifically for physical Internet beta product evaluation.
 *
 * These personas (Member Alex, Admin Sarah, Superadmin Pastor David)
 * are DEMO IDENTITIES ONLY.
 *
 * They grant ZERO real Main App / production database authority.
 * Real FOG account authentication belongs to Shared Core Stage 3.
 *
 * ============================================================
 * FUTURE SHARED AUTH PROVIDER INTEGRATION POINT
 * ============================================================
 * In Shared Core Stage 3 (post Phase 0.22.1 physical acceptance),
 * this BetaIdentityProvider boundary will be replaced with SharedAuthProvider:
 *
 *   LANDING / BRANDING
 *         ↓
 *   FOG / Koinonia Sign In (OAuth / Session)
 *         ↓
 *   Authenticated canonical member identity + verified role from server
 *         ↓
 *   BEGIN YOUR JOURNEY
 *         ↓
 *   PLAYABLE WORLD
 *
 * The current interface methods (getCurrentIdentity, setIdentity, hasRole, etc.)
 * mirror the contract expected by SharedAuthProvider so gameplay/UI does not
 * require rewriting when real authentication is integrated.
 */

(function(global) {
  'use strict';

  const STORAGE_KEY = 'koinonia_beta_identity';

  const PERSONAS = {
    MEMBER: {
      id: 'youth_demo_01',
      personaKey: 'MEMBER',
      name: 'Alex Rivera',
      shortName: 'Alex',
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
        canRequestReview: false
      }
    },
    ADMIN: {
      id: 'admin_sarah',
      personaKey: 'ADMIN',
      name: 'Sarah Jenkins',
      shortName: 'Sarah',
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
        canRequestReview: true
      }
    },
    SUPERADMIN: {
      id: 'pastor_david',
      personaKey: 'SUPERADMIN',
      name: 'Pastor David',
      shortName: 'Pastor David',
      username: 'pastor_d',
      role: 'SUPERADMIN',
      badge: 'Superadmin',
      title: 'Pastor & Overseer',
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
        canRequestReview: true
      }
    }
  };

  function hasSavedIdentity() {
    if (typeof localStorage === 'undefined') return false;
    const saved = localStorage.getItem(STORAGE_KEY);
    return Boolean(saved && PERSONAS[saved]);
  }

  function getSavedIdentityKey() {
    if (typeof localStorage === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
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
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, key);
      } catch (err) {
        console.warn('[BetaIdentityProvider] Unable to save identity to localStorage:', err);
      }
    }
    return PERSONAS[key];
  }

  function clearIdentity() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
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
    return Boolean(id && id.capabilities && id.capabilities.canAccessStudio);
  }

  function canPublish(identity) {
    const id = identity || getCurrentIdentity();
    return Boolean(id && id.capabilities && id.capabilities.canPublish);
  }

  function getNamespacedSaveKey(identity) {
    const id = identity || getCurrentIdentity();
    return 'koinonia.phase22_1.save.' + id.id;
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
    getNamespacedSaveKey
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BetaIdentityProvider;
  }
  if (typeof global !== 'undefined') {
    global.BetaIdentityProvider = BetaIdentityProvider;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
