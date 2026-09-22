# Game Economy Foundation

## Canonical separation

`game_score_logs` stores gameplay performance. Scores are never reduced by a
Life Point cap and remain eligible to improve personal-best and leaderboard
results after the member has reached the daily reward cap.

`point_transactions` remains the Life Point ledger. A game submission inserts
an LP transaction only for the amount still available under the applicable
daily cap.

`game_reward_claims` records the normalized result of a submission and supplies
idempotency when a client repeats the same `submission_id`.

## Source classification

Game rewards are classified by the explicit registry in
`lib/game-economy.js`. The registry fixes each game's canonical identifier,
display name, category, and maximum reward request. Daily Growth Game totals
sum only registry-listed Growth Game names. Consequently, Daily Prayer
Covenant, Weekly Challenge, Daily Journal, events, ministries, groups, and
other formation transactions do not consume the 25 LP Growth Game allowance.

The Arcade allowance similarly aggregates all registered Arcade games to one
5 LP allowance per member per Asia/Manila calendar day.

## Concurrency and retry behavior

Game awards are serialized in-process and performed inside `BEGIN IMMEDIATE`
SQLite transactions on a dedicated database connection. Completion markers,
the current classified daily total, the bounded LP transaction, aggregate
point totals, the raw score, and the idempotency claim share that transaction.
A repeated `(youth_id, submission_id)` returns its original result without
inserting another completion, score, or reward.

## Compatibility

The response field `pointsAwarded` is retained temporarily as an alias for
`lifePointsAwarded`; it no longer reports raw score. Existing client-side
attempt counters remain presentation-only and are not trusted for rewards.

Public Faith Quest scores remain anonymous/public and cannot mint member Life
Points. The public leaderboard is separate from authenticated member score and
LP records.

## Known boundary

The current browser games still report their own performance score. Phase 1
validates game identity, type, numeric bounds, member identity, and LP limits,
but it does not make every raw high score server-authoritative. A modified
client can therefore attempt to fabricate an in-range competitive score; it
still cannot exceed the server-enforced daily LP cap. Server-verifiable game
sessions/proofs are a future anti-cheat enhancement.

## Rollback

The migration is additive. Rolling application code back can leave the two new
tables and indexes in place safely. Do not drop them after accepting Phase 1
traffic because doing so would destroy new raw scores and idempotency records.
