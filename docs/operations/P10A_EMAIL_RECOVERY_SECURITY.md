# P10A Email Recovery Security

## Scope

P10A Phase B1 establishes reusable email, identity, token, queue, transport, and session-invalidation primitives. Phase B2 adds secure local-password recovery using those primitives. Phase B3 remains responsible for member email verification and its operational rollout.

## Identity and email rules

- Security lookups use one canonical normalization rule: trim, lowercase, validate an ASCII email address, and reject values longer than 254 characters.
- Gmail-specific dot removal and plus-address rewriting are intentionally not performed.
- Stored profile email presentation is not rewritten merely because a lookup is normalized.
- Google ID-token email may be used only when it is syntactically valid and `email_verified === true`.
- An exact existing `google_id` match takes priority over email matching.
- A normalized email matching more than one `youth` row fails closed. P10A does not add `UNIQUE(email)` to `youth`.
- An existing non-empty `google_id` is never replaced from an email-only match.

## Forgot-password privacy and eligibility

`POST /api/auth/forgot-password` always returns the same neutral HTTP 200 response for eligible, unknown, malformed, ambiguous, Google-only, and rate-limited requests. Responses use `Cache-Control: no-store` and do not reflect the submitted address. A modest bounded minimum response time reduces obvious identity-resolution timing differences without introducing a long request delay.

Recovery request abuse protection is separate from password-login protection. It applies a 15-minute fixed window with a maximum of 10 requests per canonical client address and 3 requests per normalized email. The email key is SHA-256-derived in memory; forwarding headers are not trusted because Express proxy trust remains disabled.

A reset is issued only when `LOWER(TRIM(youth.email))` resolves to exactly one youth row and that identity has a non-empty local credential in `youth.password` or at least one linked `users.password`. Unknown and ambiguous identities receive no token or email. A Google-linked identity without a local password receives no local reset email and continues to use Google sign-in and Google's recovery process. Phase B2 neither merges duplicate identities nor marks an address verified.

## One-time token lifecycle

The `auth_one_time_tokens` table stores:

- SHA-256 token hash and explicit purpose (`password_reset` or `email_verification`)
- optional `youth_id` and normalized target email
- integer UTC creation and expiry timestamps
- one-time `used_at` state and optional `revoked_at` state

Tokens contain 256 bits of randomness. The raw URL-safe token exists only transiently in application memory. Hashing is domain- and purpose-separated, and the raw token is never stored. Issuing a replacement revokes older active tokens for the same member and purpose (or the same normalized email and purpose when no member exists). Consumption is transactional and rejects missing, wrong-purpose, expired, used, or revoked tokens.

Password-reset completion must use `consumeWithMutation`. The token store owns one `BEGIN IMMEDIATE` transaction, validates the token, runs the supplied database-only callback, marks the token used, and then commits. The callback receives immutable token metadata without the raw token plus transaction-bound `run`, `get`, and `all` helpers. It must perform database work only; external calls and other side effects are forbidden. A callback or token-consumption failure rolls back both the callback's changes and token state. The simpler `consume` API retains one-time token-only behavior.

Password-reset tokens expire after 60 minutes and bind both the youth ID and the normalized recovery email. Issuing a replacement revokes earlier active password-reset tokens for that youth. At redemption, the current normalized youth email must still equal the bound target and a local credential must still exist. Invalid, expired, wrong-purpose, revoked, and already-used tokens share one generic rejection.

`POST /api/auth/reset-password` applies an independent 15-minute limiter (20 requests per client and 6 per token-derived subject), enforces the current 8–128 character password policy, and performs the password hash and all database writes inside `consumeWithMutation`. One transaction updates `youth.password`, updates every `users.password` linked to that youth with the same versioned scrypt value, consumes the token, and commits. Any failure rolls back both credentials and token consumption.

After commit, all in-memory sessions belonging to that youth are invalidated; unrelated sessions are preserved and no reset session is created. Because sessions are held in memory while credentials and token state are stored in SQLite, a process crash in the narrow interval after database commit but before session invalidation can leave an old session alive until process restart or normal session expiry. B2 intentionally documents this boundary rather than redesigning session storage.

## Durable encrypted email outbox

The `email_outbox` table stores normalized recipient, message type, AES-256-GCM ciphertext, IV, authentication tag, encryption version, delivery status, retry metadata, lock timestamps, safe provider identifiers/error codes, and an optional hashed deduplication key.

Lifecycle states are `pending`, `sending`, `retry`, `sent`, and `failed`. A worker atomically claims one due row, prevents concurrent execution in-process, recovers stale `sending` jobs, applies bounded exponential backoff, enforces a maximum attempt count, and distinguishes retryable from permanent transport failures. Active deduplication prevents repeated enqueue storms for one logical message.

Sensitive payloads, including future reset links or tokens, must be encrypted before persistence and decrypted only immediately before delivery. Plaintext recovery tokens must never appear in outbox columns, audit logs, provider-error text, or application logs.

The B2 reset email contains the reset URL only inside the AES-256-GCM encrypted payload. A deterministic per-youth deduplication key prevents an active reset request from creating an email storm while allowing a later request after the prior job is sent or failed. Reset messages include a delivery deadline matching token expiry and require at least 15 minutes of remaining token validity. The worker permanently fails a stale message without calling the provider, allowing the member to request a fresh link.

After a successful reset, a separate encrypted password-changed notice is queued with no password or token. Failure to queue or deliver this notice is logged only by safe code and never reverses an already committed password change.

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

The application constructs reset links only from `KOINONIA_PUBLIC_ORIGIN`. It must be an exact credential-free HTTPS origin with no path, query, or fragment. Missing or invalid origin, transport configuration, or outbox encryption configuration disables recovery email safely without stopping the portal. There is no staging-to-production origin fallback.

At startup the application recovers stale `sending` jobs and starts a non-overlapping 30-second worker interval. Each tick processes at most five due messages. Provider or configuration failures do not crash the portal, and retry delays remain bounded by the outbox policy.

## Reset browser surface

Reset links use `/reset-password#<token>`, keeping the fragment out of HTTP request paths and intermediary access logs. The server serves the reset page only at `/reset-password` with `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. The page contains no third-party resources, captures the exact URL-safe fragment token into a closure, and immediately replaces the visible URL with `/reset-password`. It does not place the token in local storage, session storage, IndexedDB, application logs, activity logs, DOM text, or another URL. The service worker bypasses the reset page and every `/api/` request, and mutation requests are never cached.

## Migration and rollback

The existing deterministic runtime migration will create `auth_one_time_tokens`, `email_outbox`, and their lookup, due-work, stale-lock, and active-deduplication indexes. It does not alter existing member rows, add an email uniqueness constraint, or migrate credentials. Phase B1 validation uses isolated temporary databases only.

Before deployment, take and verify a WAL-safe production backup. Application rollback must preserve the authoritative database and tolerate the additive B1 tables and any queued or consumed B2 recovery records. An older application build may leave pending recovery mail unprocessed and may not expose the reset routes, so deployment rollback should pause recovery communications and assess the outbox before resuming. Never restore an older database merely to roll back application code.

## Later phases

- Phase B3: email-verification issue/consume flows, safe address-change handling, operational monitoring, and staged provider rollout.
