# P10B Account Claim Security

## Scope and phase boundary

P10B-B1 adds the security foundation for a future member account-claim flow. It does not link an account to a member, mark an account claimed, change login behavior, or change anonymous Google email linking. P10B-B2 will implement claim consumption and linking. Later user experience and operational rollout work belongs to P10B-B3.

## Canonical data responsibilities

- `youth` is the permanent ministry member record.
- `users` is the online authentication and authorization account.
- `users.youth_id` is a legacy-compatible association. Its presence alone is not proof that a person securely claimed the member record.
- `users.account_claimed_at`, `users.account_claim_method`, and `users.account_claim_token_id` are the explicit claim attestation. B1 adds these nullable fields and leaves every existing account unclaimed.

The current staging data has no duplicate non-null `users.youth_id` values. A partial unique index was nevertheless deferred: startup, Google compatibility, and administrative account-association paths do not yet share a transaction-safe single-link contract. Enforcing the index before those paths are hardened could break existing behavior.

## Claim token lifecycle

An authorized account administrator issues a claim for a specific `youth.id`. The server creates 32 cryptographically random bytes and encodes them as a canonical, unpadded 43-character Base64URL token. Only a domain-separated SHA-256 digest is stored in `account_claim_tokens`; the raw token is returned once in a URL fragment:

`https://<KOINONIA_PUBLIC_ORIGIN>/claim#<TOKEN>`

The default lifetime is seven days. Issuance runs in `BEGIN IMMEDIATE` and atomically revokes any earlier unused, unrevoked claim for that member before inserting the replacement. A partial unique index provides a database-level backstop against more than one pending claim per member. Expired, revoked, and used claims are never usable.

The raw token must never appear in a database row, activity/security log, query string, URL path, analytics event, or server log. Administrative status output also excludes `token_hash`.

## Administration and authorization

Issuance, status inspection, and revocation require the canonical server-side `access_permissions` permission. The actor is always derived from the authenticated session's canonical `users.id`; request-body actor, permission, or admin claims have no authority.

The B1 endpoints are:

- `POST /api/admin/account-claims` with `youth_id`
- `GET /api/admin/account-claims/:youth_id`
- `DELETE /api/admin/account-claims/:youth_id`
- `POST /api/account-claim/preview` with the token in the JSON body

Issuance and revocation activity records contain only canonical actor/member identifiers and safe action descriptions.

## Public preview and privacy

The preview endpoint accepts only a strictly canonical token in the JSON body. There is intentionally no token-bearing path or query API. Preview requests are rate limited by the directly observed client address, and rejected-preview logging is separately bounded to avoid log amplification.

A usable token returns only the same public member projection already exposed by the application: member `id` and display `name`. It never returns email, mobile, address, birthday, parent information, permissions, Google identity, password data, private ministry data, token digest, or lifecycle metadata. Responses use `Cache-Control: no-store` and `Pragma: no-cache`. Invalid, expired, revoked, used, or unknown claims receive the same inactive-claim response.

## Identity-proof boundaries

Email possession is not proof that a person is the ministry member represented by a `youth` row. Email is therefore not used to select or validate a claim target. The existing check-in `youth.qr_code` is an identifier used in legacy workflows, not an authentication secret, and is never accepted as a claim token.

## B2 transaction requirement

The claim store exposes a transaction-aware `consumeWithMutation` primitive for B2. It owns the complete `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` boundary. It first validates that the token is present, unexpired, unused, and unrevoked; only then does it call a database-only mutation callback. B2 must perform all identity validation, account/member association, and claim-attestation writes through that callback. The claim is marked used inside the same transaction.

If the callback or token-consumption update fails, all linking and token changes roll back. The callback never runs for an invalid claim. Concurrent redemption allows only one successful consumer. B1 deliberately exposes no HTTP consumption or linking route.

## Threat model and controls

The foundation addresses token guessing, database disclosure, replay, concurrent redemption, replacement races, forged administrator identity, preview enumeration, sensitive profile disclosure, log leakage, and misuse of email or check-in QR identifiers as proof. It does not protect a raw claim token after a holder voluntarily discloses it; claim cards and claim URLs must be handled as bearer credentials until consumed or revoked.

## Migration and rollback

The migration is additive: one new table, supporting indexes, and three nullable `users` columns. It does not backfill claim state, rewrite associations, modify credentials, or merge member records. Application rollback can ignore the additive objects; database rollback should normally leave them in place until a separately approved cleanup because destructive schema rollback is unnecessary and risks data loss.

No schema or data operation should be run against a live environment without the normal verified SQLite-safe backup and deployment gate.
