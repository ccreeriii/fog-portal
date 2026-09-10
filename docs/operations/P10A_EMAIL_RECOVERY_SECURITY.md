# P10A Email Recovery Security Foundation

## Scope

P10A Phase B1 establishes reusable email, identity, token, queue, transport, and session-invalidation primitives. It does not expose forgot-password or email-verification routes or UI. Phase B2 will add password recovery flows; Phase B3 will add member email verification and operational rollout.

## Identity and email rules

- Security lookups use one canonical normalization rule: trim, lowercase, validate an ASCII email address, and reject values longer than 254 characters.
- Gmail-specific dot removal and plus-address rewriting are intentionally not performed.
- Stored profile email presentation is not rewritten merely because a lookup is normalized.
- Google ID-token email may be used only when it is syntactically valid and `email_verified === true`.
- An exact existing `google_id` match takes priority over email matching.
- A normalized email matching more than one `youth` row fails closed. P10A does not add `UNIQUE(email)` to `youth`.
- An existing non-empty `google_id` is never replaced from an email-only match.

## One-time token lifecycle

The `auth_one_time_tokens` table stores:

- SHA-256 token hash and explicit purpose (`password_reset` or `email_verification`)
- optional `youth_id` and normalized target email
- integer UTC creation and expiry timestamps
- one-time `used_at` state and optional `revoked_at` state

Tokens contain 256 bits of randomness. The raw URL-safe token exists only transiently in application memory. Hashing is domain- and purpose-separated, and the raw token is never stored. Issuing a replacement revokes older active tokens for the same member and purpose (or the same normalized email and purpose when no member exists). Consumption is transactional and rejects missing, wrong-purpose, expired, used, or revoked tokens.

Password-reset completion must use `consumeWithMutation`. The token store owns one `BEGIN IMMEDIATE` transaction, validates the token, runs the supplied database-only callback, marks the token used, and then commits. The callback receives immutable token metadata without the raw token plus transaction-bound `run`, `get`, and `all` helpers. It must perform database work only; external calls and other side effects are forbidden. A callback or token-consumption failure rolls back both the callback's changes and token state. The simpler `consume` API retains one-time token-only behavior.

## Durable encrypted email outbox

The `email_outbox` table stores normalized recipient, message type, AES-256-GCM ciphertext, IV, authentication tag, encryption version, delivery status, retry metadata, lock timestamps, safe provider identifiers/error codes, and an optional hashed deduplication key.

Lifecycle states are `pending`, `sending`, `retry`, `sent`, and `failed`. A worker atomically claims one due row, prevents concurrent execution in-process, recovers stale `sending` jobs, applies bounded exponential backoff, enforces a maximum attempt count, and distinguishes retryable from permanent transport failures. Active deduplication prevents repeated enqueue storms for one logical message.

Sensitive payloads, including future reset links or tokens, must be encrypted before persistence and decrypted only immediately before delivery. Plaintext recovery tokens must never appear in outbox columns, audit logs, provider-error text, or application logs.

## Encryption key requirement

`EMAIL_OUTBOX_ENCRYPTION_KEY` is required before sensitive enqueueing is enabled. Its value must be exactly 32 random bytes encoded as canonical unpadded Base64URL (43 characters). Generate and install it through the protected environment-management process; never store it in Git or logs. Missing, malformed, or incorrect keys fail closed. AES-256-GCM uses a fresh 96-bit IV and a 128-bit authentication tag for every payload; authentication failure permanently blocks that queued payload.

## Email transport

The provider-independent transport currently supports Resend through Node's built-in HTTPS `fetch` implementation. Configuration variable names are:

- `EMAIL_PROVIDER`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `RESEND_API_KEY`
- `EMAIL_OUTBOX_ENCRYPTION_KEY`

No values belong in source control. The Resend transport uses only `https://api.resend.com/emails`, validates sender/recipient configuration, applies an `AbortController` timeout, returns only the provider message ID, and exposes sanitized error codes. DNS/network failures, timeouts, HTTP 429, and server failures are retryable; provider authentication and validation failures are permanent. Tests inject mock transports and never contact Resend.

## Session invalidation

The foundation includes a helper that removes every active in-memory session associated with a specified `youth_id` while leaving unrelated member and administrator sessions untouched. Phase B2 must call it only after a password-reset transaction succeeds.

## Migration and rollback

The existing deterministic runtime migration will create `auth_one_time_tokens`, `email_outbox`, and their lookup, due-work, stale-lock, and active-deduplication indexes. It does not alter existing member rows, add an email uniqueness constraint, or migrate credentials. Phase B1 validation uses isolated temporary databases only.

Before deployment, take and verify a WAL-safe production backup. Application rollback is safe while the new tables are unused; after B2/B3 begin writing recovery state, rollback must preserve the authoritative database and tolerate the additive tables. Never restore an older database merely to roll back application code.

## Later phases

- Phase B2: rate-limited forgot-password request/consume routes, neutral anti-enumeration responses, outbox worker scheduling, reset completion, password synchronization, and session invalidation.
- Phase B3: email-verification issue/consume flows, safe address-change handling, operational monitoring, and staged provider rollout.
