# KOINONIA — MEMBER IDENTITY CONTRACT & AUTHORIZATION SPECIFICATION
**Phase 0.23I Architecture Document**  
**Status**: DRAFT / SPECIFICATION  
**Scope**: KOINONIA Staging & Prototype Identity Architecture  
**Isolation Boundary**: KOINONIA ONLY — Zero mutation of Main App (`fog_community.db`, PM2 processes, routes, or auth).

---

## 1. Executive Summary & Purpose

The purpose of this specification is to define the canonical client-side and service-side **Member Identity Contract**, **Capability-Based Authorization Model**, and **Provider Abstraction Layer** for KOINONIA.

Prior to Phase 0.23I, identity in KOINONIA was handled via lightweight, hardcoded beta test personas (`youth_demo_01`, `admin_sarah`, `father_alex`) directly hardcoded in `beta_identity.js` with ad-hoc capability flags (`canPlay`, `canDoQuests`, `canAccessStudio`, `canPublish`).

Phase 0.23I establishes a rigorous, fail-closed normalization contract that:
1. Standardizes member identity representation across all KOINONIA game subsystems, Studio dashboards, real-time presence, and audit logging.
2. Formulates an extensible provider interface (`BaseIdentityProvider`, `PrototypeIdentityProvider`, and future `SharedCoreIdentityProvider`).
3. Enforces least-privilege capability resolution without permitting client-side privilege escalation.
4. Implements strict privacy controls (zero storage or transmission of passwords, tokens, session cookies, or raw dates of birth) and safeguards minor members.
5. Preserves 100% backward compatibility with existing Phase 0.23E, Phase 0.23F, and Phase 0.23H features and test suites.

---

## 2. Canonical Normalized Member Identity Schema

The canonical schema represents a validated, immutable identity object returned by `KoinoniaIdentity.normalizeMemberIdentity(raw)`.

```typescript
interface MemberIdentity {
  /** Canonical persistent member identifier (e.g. 'youth_demo_01' or UUID from FOG) */
  memberId: string;

  /** Legacy identifier alias for backward compatibility */
  id: string;

  /** Community domain namespace, fixed to 'fog' (Fire of God Ministries) */
  communityId: 'fog';

  /** Primary user-facing full display name */
  displayName: string;

  /** Legacy display name alias */
  name: string;

  /** Shortened or familiar name for compact UI chips */
  shortName: string;

  /** First name (if available) */
  firstName: string;

  /** Last name or initial (if available) */
  lastName: string;

  /** Authorized community role: 'MEMBER' | 'ADMIN' | 'SUPERADMIN' */
  role: 'MEMBER' | 'ADMIN' | 'SUPERADMIN';

  /** Derived capabilities strictly computed by normalization engine */
  capabilities: {
    canAccessStudio: boolean;
    canAuthorContent: boolean;
    canReviewContent: boolean;
    canPublishContent: boolean;
    canManageCampfire: boolean;
  };

  /** Presentation and growth profile attributes */
  profile: {
    avatarUrl: string | null;
    avatarEmoji: string;
    growthLevel: number;
    title: string;
    badge: string;
  };

  /** Backward-compatible profile aliases */
  avatar: string;
  title: string;
  badge: string;

  /** Community memberships */
  memberships: {
    ministries: string[];
    campfires: string[];
  };

  /** Privacy and safety protections */
  safeguards: {
    /** Whether the member is verified as a minor (true, false, or null if unknown) */
    isMinor: boolean | null;
  };

  /** Identity origin: 'prototype' | 'shared-core' */
  source: 'prototype' | 'shared-core';

  /** Authentication state verification */
  authenticated: boolean;
}
```

---

## 3. Future Shared Core Member Entity Comparison

When KOINONIA transitions in Shared Core Stage 3 to authenticate real Fire of God members, the identity contract aligns with the existing Main App (`fog_community.db`) user records as follows:

| Field | Prototype Phase 0.23I Source | Future Shared Core (Stage 3) Source | Privacy & Security Boundary |
| :--- | :--- | :--- | :--- |
| `memberId` | Persona ID (`youth_demo_01`, etc.) | Main App `users.id` / `members.id` (UUID / Integer) | Public within community; stored in local save key. |
| `communityId` | `'fog'` | `'fog'` (tenant partition) | Constant. |
| `displayName` | Persona Name (`Alex Rivera`, etc.) | Main App `users.display_name` | Public in fellowship places. |
| `role` | Declared prototype role | Main App verified role (`member`, `admin`, `superadmin`) | Verified server-side via session/token. |
| `capabilities` | Derived from `ROLE_CAPABILITIES` | Server-calculated based on verified permissions | Never accepted from client input. |
| `isMinor` | Prototype boolean (`safeguards.isMinor`) | Computed on server from DOB (`age < 18`) | **Raw birthdate NEVER sent to client.** |
| `password / hash` | **EXCLUDED / FORBIDDEN** | Main App `users.password_hash` | **NEVER exposed to KOINONIA client.** |
| `session / token` | **EXCLUDED / FORBIDDEN** | HttpOnly secure cookie or transient memory token | **NEVER persisted to localStorage.** |
| `ministries` | Mock array (`[]`, `['youth']`) | Main App ministry affiliations | Read-only. |

---

## 4. Capability Matrix & Permissions

Capabilities are derived strictly from the verified role and authentication status. Client-side code cannot elevate capabilities by supplying modified capability flags in identity payloads.

| Capability | MEMBER | ADMIN | SUPERADMIN | Unauthenticated / Guest | Subsystem Consumers |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `canAccessStudio` | ❌ `false` | ✅ `true` | ✅ `true` | ❌ `false` | Studio UI modal, drawer buttons, navigation |
| `canAuthorContent` | ❌ `false` | ✅ `true` | ✅ `true` | ❌ `false` | Create Draft, Edit Draft, Duplicate, Archive, Delete |
| `canReviewContent` | ❌ `false` | ❌ `false` | ✅ `true` | ❌ `false` | Review Queue view, Return for Changes, Approve |
| `canPublishContent` | ❌ `false` | ❌ `false` | ✅ `true` | ❌ `false` | Publish to KOINONIA prototype place catalog |
| `canManageCampfire`| ❌ `false` | ✅ `true` | ✅ `true` | ❌ `false` | Moderation of campfire discussions and circles |

---

## 5. Role Resolution & Hierarchy Rules

1. **Fail-Closed Default**:
   - If an identity payload is `null`, `undefined`, or malformed, `normalizeMemberIdentity` returns an unauthenticated Guest identity (`memberId: 'guest_anonymous'`, `authenticated: false`, all capabilities `false`).
   - If an unrecognized role string is encountered (e.g. `'MODERATOR'`, `'GUEST'`, `'HACKER'`), it immediately normalizes to `'MEMBER'`.
2. **Superadmin Verification**:
   - `'SUPERADMIN'` is never assigned unless `raw.authenticated === true` and the role was explicitly declared.
3. **Capability Immutability**:
   - Client-supplied `capabilities` objects in raw inputs are completely discarded. Capabilities are regenerated from the canonical `ROLE_CAPABILITIES` table.
4. **Least Privilege Enforcement**:
   - Unauthenticated identities receive zero privileged capabilities regardless of what role was claimed in the input payload.

---

## 6. Privacy & Sensitive Field Handling

### 6.1 Prohibited Fields
The following fields are strictly prohibited from appearing in `MemberIdentity` objects, localStorage, network presence broadcasts, or audit logs:
- `password`, `password_hash`, `salt`
- `token`, `access_token`, `refresh_token`, `bearer`, `authorization`
- `session`, `cookie`, `session_id`
- `birthdate`, `dob`, `dateOfBirth`
- `credit_card`, `ssn`, `tax_id`

### 6.2 Minor Safety Handling
- For child and youth safety, KOINONIA never receives, stores, or processes raw birthdates.
- Minor status is represented purely as a boolean flag in `safeguards.isMinor` (`true` if under 18, `false` if adult, `null` if unverified).
- When `safeguards.isMinor === true`:
  - Real-time presence restricts social interaction to curated preset emotes and canned phrases (already enforced by the presence protocol).
  - Profile visibility restricts sensitive personal information.
  - Future direct messaging or unmoderated chat is disabled by default.

---

## 7. Identity Provider Abstraction

KOINONIA defines a clear provider interface to decouple gameplay from authentication mechanisms:

```
                  +--------------------------------+
                  |      BaseIdentityProvider      |
                  +--------------------------------+
                                  ^
                                  |
            +---------------------+---------------------+
            |                                           |
+--------------------------+               +--------------------------+
| PrototypeIdentityProvider|               |SharedCoreIdentityProvider|
| (Current Phase 0.23I)    |               | (Future Stage 3 Gate)    |
| - Local storage backed   |               | - Disabled in prototype  |
| - Demo personas          |               | - Mock / Fails closed    |
| - Offline compatible     |               | - Zero Main App calls    |
+--------------------------+               +--------------------------+
```

### 7.1 Provider Methods
- `getCurrentIdentity()`: Returns current canonical `MemberIdentity`.
- `isAuthenticated()`: Returns boolean indicating whether current user is authenticated.
- `getCapabilities()`: Returns capabilities dictionary.
- `hasCapability(capName)`: Returns boolean check for a specific capability.
- `subscribeIdentityChanges(callback)`: Subscribes UI components to profile or role changes.

---

## 8. Audit Log Integration

Studio governance audit logs (`data/studio_engine.js`) must preserve complete attribution across transitions.
Each audit entry records:
- `actorMemberId`: Stable member ID (`youth_demo_01`, `admin_sarah`, `father_alex`, or future FOG UUID).
- `actorDisplayName`: Human-readable display name.
- `actorRole`: Authorized role at time of action (`ADMIN`, `SUPERADMIN`).
- `actor`: Legacy object `{ id, name, role }` for complete backward compatibility.

Audit actions logged:
- `DRAFT_CREATED`
- `DRAFT_UPDATED`
- `REVIEW_REQUESTED`
- `APPROVED`
- `RETURNED_FOR_CHANGES`
- `PUBLISHED`
- `ARCHIVED`
- `DRAFT_DELETED`

---

## 9. Integration Boundary & Main App Protection

```
+-------------------------------------------------------------+
|                      KOINONIA ISOLATION                     |
|  [Browser Client] <==> [Koinonia Server :3006 / :3005]       |
|  - MemberIdentity Contract & Normalizer                     |
|  - PrototypeIdentityProvider                                |
|  - Local Storage saves: 'koinonia.phase22_1.save.*'        |
|  - Studio Engine: local storage drafts & audit logs        |
+-------------------------------------------------------------+
                                ||
                      STRICT SAFETY BOUNDARY
          NO DB ACCESS • NO ROUTE CALLS • NO PM2 RESTART
                                ||
+-------------------------------------------------------------+
|                     COMMUNITY PORTAL / MAIN APP             |
|  [PM2: fog-v3 :3003]  [PM2: fog-staging :3001]              |
|  Database: fog_community.db                                 |
|  Auth: /api/auth/login, sessions, OAuth                     |
+-------------------------------------------------------------+
```

---

## 10. Future Cutover Strategy (Stage 3 Preview)

When authorization is granted to connect KOINONIA to the real Main App:
1. `SharedCoreIdentityProvider` will be enabled and injected as active provider via `KoinoniaIdentity.setProvider(sharedCoreProvider)`.
2. On initial page load, `sharedCoreProvider.fetchIdentity()` calls the read-only `/api/v1/shared/auth/me` endpoint.
3. If an active session exists on the parent domain, the endpoint returns the member's profile and verified roles.
4. `normalizeMemberIdentity()` transforms the payload into a standard `MemberIdentity` object.
5. If unauthenticated, the user is offered "Sign in with Fire of God" or "Explore as Guest".
6. All gameplay subsystems (`game.js`, `places.js`, `studio_engine.js`) consume the canonical interface without requiring code changes.
