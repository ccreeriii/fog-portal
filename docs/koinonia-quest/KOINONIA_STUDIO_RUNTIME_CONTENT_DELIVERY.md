# KOINONIA — PHASE 0.23L STUDIO RUNTIME CONTENT DELIVERY & REGISTRY SPECIFICATION

## 1. Studio Lifecycle Boundary
The Studio system provides an authoring and governance pipeline for church content creators and pastoral leaders. Content progresses through discrete lifecycle stages:
- **`DRAFT`**: Authoring in progress by an authorized author (`ADMIN` or `SUPERADMIN`). Private to the author.
- **`READY_FOR_REVIEW`**: Submitted by author for pastoral review. Appears in the Superadmin review queue.
- **`CHANGES_REQUESTED`**: Returned by Superadmin with actionable feedback. Re-opens for author editing.
- **`APPROVED`**: Approved by pastoral leadership (`SUPERADMIN`), but **NOT YET PUBLISHED**.
- **`PUBLISHED`**: Formally published by `SUPERADMIN`. Only items with this exact status can cross the governance boundary into member-facing gameplay.
- **`INACTIVE` / `ARCHIVED`**: Deactivated or archived content. Hidden from available member discovery while preserving historical completion records.

**Fail-Closed Rule**: Content in `DRAFT`, `READY_FOR_REVIEW`, `CHANGES_REQUESTED`, or `APPROVED` status is strictly quarantined from member-facing gameplay and will never appear in the runtime registry.

---

## 2. Published Quest Contract
A canonical normalized contract represents published quests crossing into member-facing runtime:

```typescript
interface PublishedQuestContract {
  id: string;                          // Stable content ID: "studio:<draftId>" or "Q-001"
  canonicalId: string;                 // Fully namespaced ID: "studio:<draftId>" or "builtin:Q-001"
  communityId: "fog";                  // Canonical tenant namespace
  contentType: "QUEST";                // Disjoint content type

  title: string;                       // Clean, sanitized quest title
  summary: string;                     // Short summary for lists, toasts, notifications
  description: string;                 // Detailed devotional background and mission context

  status: "PUBLISHED";                 // Explicit lifecycle state

  publication: {
    publishedAt: string;               // ISO-8601 publication timestamp
    publishedByMemberId: string;       // Authoritative publisher identity
    version: number;                   // Publication increment version
  };

  availability: {
    active: boolean;                   // Flag indicating if calling is currently active
    startsAt: string | null;           // Optional start availability date
    endsAt: string | null;             // Optional expiration date
  };

  presentation: {
    icon: string;                      // UI glyph (e.g. "🌱", "📜")
    category: string;                  // Ministry category (e.g. "Faith & Stewardship")
    categoryTitle: string;             // Display label for category
    locationId: string | null;         // In-world place ID or null for global quests
    npcId: string | null;              // In-world NPC giver or null for global quests
  };

  rewardDefinition: {
    requested: { lifePoints: number; xp: number };  // Non-authoritative author request
    validated: { lifePoints: number; xp: number };  // Clamped by trusted reward authority
    effectivePolicyKey: "STUDIO_STANDARD" | "BUILTIN_CANONICAL";
  };

  safeguards: {
    minorSafe: boolean;                // Guard verifying absence of PII requests
    violations?: string[];             // Specific validation findings if rejected
  };

  source: "studio" | "builtin";        // Content origin provenance

  // Gameplay Projection Compatibility Fields
  realWorldAction: string;             // Tangible physical stewardship task
  realWorldFallbacks?: string[];       // Fallback variations for accessibility
  reflectionPrompt: string;            // Private reflection prompt
  verificationMethod: string;          // Self-reflection, leader checkin, family affirmation
  difficulty: "easy" | "medium" | "challenging";
  estimatedMinutes: number;
  rewards: {
    lp: number;
    lifePoints: number;
    charXp: number;
    characterXp: number;
    xp: number;
  };
  dialogue: {
    inProgress: string;
    returnPrompt: string;
    completionMessage: string;
  };
}
```

---

## 3. Runtime Content Registry (`KoinoniaContentRegistry`)
`KoinoniaContentRegistry` is an in-memory client runtime service that decouples member gameplay from Studio storage structures:
- **`init(options)`**: Initializes built-in quests and projects current published content.
- **`getPublishedContent()`**: Returns all normalized published items across content types.
- **`getPublishedQuests(options)`**: Returns active, non-expired, minor-safe published quests. Filters out inactive quests unless `includeInactive: true`.
- **`getQuestById(id)`**: Resolves a quest by bare ID (`Q-001`), prefixed built-in (`builtin:Q-001`), or Studio ID (`studio:<draftId>`).
- **`refresh()`**: Re-scans published storage, updates projections, registers rewards with `KoinoniaRewardAuthority`, and notifies UI subscribers.
- **`subscribe(callback)`**: Allows UI modules (e.g. `openQuestsTabModal`) to reactively update when content is published or revised.

**Isolation Guarantee**: Gameplay code never parses or inspects raw Studio `localStorage` keys (`koinonia_phase21_studio_drafts` or `koinonia_phase21_studio_published`). All interactions go through `KoinoniaContentRegistry`.

---

## 4. Publication Projection Layer
The projection layer translates governance records into clean member runtime representations:
1. Filters out records whose status is not `PUBLISHED`.
2. Verifies `templateType === 'QUEST'`. Non-quest content is excluded from quest delivery.
3. Strips all author-internal notes, reviewer comments, and moderation logs.
4. Sanitizes all user-facing strings against HTML and script injection.
5. Runs minor safety pattern analysis to prevent personal data collection.
6. Maps requested rewards to validated, policy-clamped values.

---

## 5. ID Namespace & Collision Safety
To prevent accidental or malicious collision between built-in quests and user-authored Studio quests:
- **Builtin Quests**: Assigned canonical namespace `builtin:<id>` (e.g. `builtin:Q-001`) with legacy aliases (`Q-001`) preserved for backward compatibility.
- **Studio Quests**: Always prefixed with `studio:` followed by the draft's unique identifier (e.g. `studio:draft_quest_1710000000000_123`).
- Even if a Studio author titles a quest "Q-001", its registry ID will be `studio:Q-001`, completely distinct from built-in `Q-001`.

---

## 6. Publication Versioning Behavior
- Every Studio draft tracks an incremental `version` number.
- When Superadmin publishes an update to an existing draft, the published record records the new version and timestamp.
- The projection layer indexes published quests by their stable content ID (`studio:<draftId>`). If multiple versions exist in the store, the projection deterministically selects the latest version.
- Updating a published quest updates its existing entry in the registry; it does **not** create a duplicate listing in the member's Quest Journal.
- Studio audit log entries are strictly append-only and are never overwritten or mutated.

---

## 7. Reward Authority Integration
Studio-authored quests integrate seamlessly with `KoinoniaRewardAuthority` (Phase 0.23K):
1. **Non-Authoritative Author Inputs**: Authors specify desired LP and XP during creation. These values are strictly advisory.
2. **Policy Clamping**: Clamped to trusted platform bounds:
   - Life Points: `0 <= LP <= 50`
   - Character XP: `0 <= XP <= 100`
3. **Registration with Authority**: When the Content Registry loads or refreshes, it calls `KoinoniaRewardAuthority.registerStudioQuest(quest.id, quest)`.
4. **Authoritative Completion**: When a member claims rewards, `KoinoniaRewardAuthority.completeQuest(memberId, quest.id)` determines the exact reward, checks idempotency, applies the atomic transaction, and updates the Growth Profile.
5. **Zero UI Delta Arithmetic**: UI progression is updated exclusively via absolute hydration from `KoinoniaGrowth.getGrowthProfile(memberId)`. No `state.lp +=` or arithmetic mutation is ever performed.

---

## 8. Member Completion Semantics
- **Completion Identity**: Bounded to the stable content ID via `generateCompletionId(communityId, memberId, questId)`.
- **Version Update Behavior**: If an author publishes version 2 of a quest (e.g. correcting a spelling error or improving instructions), a member who already completed version 1 retains their completion record.
- `KoinoniaRewardAuthority` recognizes that `completionId` was already satisfied and awards **0 additional rewards** for repeat completions, completely preventing reward farming.

---

## 9. Inactive & Archive Readiness
- Content can be marked `active: false` or have an `endDate` in the past.
- Inactive and expired quests are filtered out by `KoinoniaContentRegistry.getPublishedQuests()`, hiding them from available quest lists.
- Completed records in `state.questProgress` and `KoinoniaRewardAuthority` reward history remain completely intact. Unpublishing an activity never destroys member historical accomplishments.

---

## 10. Minor Safety Safeguards
In accordance with platform minor protection standards, the projection layer executes automated regex validation against PII harvesting:
- **Forbidden Requests**:
  - Telephone, mobile, and cell numbers.
  - Home and physical street addresses.
  - School names and educational locations.
  - Social media handles (Instagram, TikTok, Discord, Snapchat, WhatsApp).
  - Private email addresses and personal contact data.
  - Unrestricted public free-text messaging prompts.
- **Fail-Closed Enforcement**: Any quest containing detected PII requests has `safeguards.minorSafe: false` and is excluded from member runtime delivery.
- **Reflection Privacy**: Personal reflections remain private by default and are never posted to public walls.

---

## 11. Content Sanitization & XSS Safeguards
All text fields crossing into the runtime registry pass through `sanitizeText()`:
- Strips `<script>`, `<iframe>`, `<style>`, and all raw HTML markup.
- Removes event handlers (`onload=`, `onerror=`, `onclick=`) and `javascript:` URIs.
- UI rendering uses safe text assignment (`element.textContent`) or escaped attributes to ensure content cannot execute as code.

---

## 12. Local Prototype Persistence Notice
- **Storage Scope**: In Phase 0.23L, Studio publications and content registry state are stored in browser/device-scoped `localStorage`.
- **Prototype Boundary**: This is a local prototype content registry, **NOT** server-authoritative and **NOT** tamper-proof. A user with developer console access could modify their local browser storage.
- **Clean Architecture**: Despite client storage scoping, the internal software boundaries accurately model production microservice separation: Governance -> Delivery Registry -> Game Engine -> Reward Authority.

---

## 13. Future Shared Core Migration Boundary
When cloud-backed Shared Core content delivery is introduced in subsequent phases:
1. `KoinoniaContentRegistry` will swap its local storage reader for a remote API client (`GET /api/v1/content/quests`).
2. Future production server authority signature verification will replace local projection.
3. Member gameplay code and `KoinoniaRewardAuthority` will require zero architectural changes, as they already interact solely with `KoinoniaContentRegistry`.

---

## 14. What Phase 0.23L Intentionally Does Not Implement
- Does not implement runtime delivery for non-quest Studio templates (`EVENT`, `CAMPAIGN`, `CAMPFIRE_ACTIVITY`). Quests are established first.
- Does not implement remote server storage or Main App database synchronization.
- Does not modify existing built-in quests or remove canonical progression paths.
- Does not alter Main App code, production PM2 processes, or Cloudflare DNS routes.
