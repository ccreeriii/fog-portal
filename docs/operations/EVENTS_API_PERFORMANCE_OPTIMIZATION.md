# Main FOG App / Koinonia Events API Performance Optimization

## Purpose and status

This document records the P9 Phase A read-only audit of `GET /api/events`, the measured causes of its latency and payload size, and a staging-first optimization design. The audit was completed on September 7, 2026 against canonical source `4a1c35bf951e5c1fb408b92ad6dc1919b6c10a19`.

This phase does not authorize an application or frontend change, database/schema change, index, PM2 action, deployment, or data mutation. Production V3 remains authoritative. Staging and V1 were not changed or restarted.

Use this plan with:

- [Post-Launch Monitoring Baseline](./POST_LAUNCH_MONITORING.md)
- [Staging-to-Production Release Workflow](./STAGING_TO_PRODUCTION_RELEASE_WORKFLOW.md)
- [Production Backup and Recovery Policy](./PRODUCTION_BACKUP_AND_RECOVERY.md)

## Current baseline and measurement method

Known operational baselines before this audit were approximately 478 ms local median, 1.29 s public median, and 10.07 MB per response. The post-P8 production smoke observed approximately 429 ms locally and 1.98 s publicly.

P9 made one public production request without a session or personal data and then analyzed the captured JSON locally. It also ran bounded, sequential, read-only queries against the production database to separate SQLite row materialization from JavaScript transformation and serialization. It did not run concurrent traffic or a load test.

| Measurement | Result |
|---|---:|
| HTTP status | 200 |
| Events returned | 14 |
| Response bytes | 10,071,001 |
| Mean bytes per event | 719,357 |
| Median bytes per event | 485,346 |
| Public time to first byte | 1.102 s |
| Public full-body time | 1.994 s |
| `Content-Encoding` | Absent |
| Gzip size in an offline calculation | 7,463,166 bytes |
| JSON parse time for the captured response | 105.0 ms |
| JSON stringify mean for the parsed response | 102.0 ms |

The response has `Cache-Control: no-store, no-cache, must-revalidate, private` and a weak ETag. Compression alone would reduce the sample by only about 25.9%, because its image formats are already compressed before base64 encoding. Compression and caching are therefore not the primary remedy.

## Endpoint trace

The route is defined in `server.js` as `app.get('/api/events', ...)` near line 2427.

Its execution path is:

1. `loadOptionalAuthorizationContext(req)` checks for a valid canonical session.
2. `authorizationHasPermission(auth, 'edit_entries')` determines whether restricted role notes may be returned.
3. One of two explicit `SELECT` projections reads the `events` table ordered by descending `event_date`.
4. `sanitizeEventForPublic` or `sanitizeEventForStaff` projects each row through `projectResponseFields`.
5. Express serializes the array through `res.json`.

The public query selects:

`id`, `name`, `event_date`, `time_start`, `venue`, `poster`, `photos_url`, `materials_url`, `gallery`, `prereg_banner`, `prereg_info`, `additional_info`, `prereg_title`, `prereg_bottom_banner`, and `event_points`.

The staff query additionally selects `roles_restricted_notes`. The live aggregate size of that restricted field is only 1,217 characters across one non-empty event, so it is not a material performance contributor. Its authorization boundary must nevertheless remain unchanged.

### SQL statement count

- Anonymous request: one `events` query.
- Authenticated strong-admin-style session without a linked member: one canonical `users` lookup plus the `events` query.
- Authenticated linked member: one canonical `users` lookup, one canonical `youth` lookup, and the `events` query.

The event-list query contains no join, subquery, per-event loop, or related-table lookup. There is no N+1 behavior. Attendance, preregistration, participant, role, QR, ministry, and analytics data are not nested in this response; those use separate endpoints.

## Response composition

The table below assigns each field its serialized key/value bytes across all 14 event objects. Percentages are approximate shares of the complete JSON response.

| Field | Bytes | Share | Current list requirement |
|---|---:|---:|---|
| `poster` | 8,533,154 | 84.730% | Grid cards display it, but it does not need to be embedded in list JSON |
| `prereg_banner` | 887,488 | 8.812% | Needed only when a specific preregistration view opens |
| `prereg_bottom_banner` | 643,874 | 6.393% | Needed only when a specific preregistration view opens |
| `prereg_info` | 2,184 | 0.022% | Specific preregistration/detail view |
| `photos_url` | 866 | 0.009% | List/grid links and edit form |
| All remaining fields combined | 3,435 | 0.034% | Mostly legitimate scalar list/detail metadata |

The three embedded media fields total 10,064,516 bytes, or approximately **99.936%** of the response. Twelve events contain a data-URI poster, four contain a preregistration banner, and four contain a bottom banner. `gallery` and `additional_info` are empty in current production data.

The five largest event objects account for approximately 75.2% of the response:

| Sanitized event identifier | Serialized bytes | Response share | Dominant field(s) |
|---:|---:|---:|---|
| 1 | 4,350,079 | 43.194% | `poster` |
| 15 | 1,066,394 | 10.589% | Three embedded media fields |
| 16 | 772,334 | 7.669% | Three embedded media fields |
| 6 | 727,330 | 7.222% | Three embedded media fields |
| 12 | 659,941 | 6.553% | Three embedded media fields |

There are two repeated long values, contributing about 319 KB of avoidable duplicate bytes. Repetition is secondary to the broader problem of putting every full media asset in every list response.

No row multiplication occurs: 14 database rows become 14 JSON objects. The payload is large because full base64 media is stored in the event row and selected for every list request, not because joins duplicate rows.

## Database and runtime profile

The bounded direct profile used the same public projection for 12 sequential read-only iterations.

| Stage | Measured result |
|---|---:|
| Full query and SQLite-to-JavaScript row materialization, median | 113.1 ms |
| Full query p95 within 12 samples | 117.4 ms |
| JavaScript projection/copy median | 0.027 ms |
| JSON serialization median | 109.8 ms |
| Lightweight scalar query median | 8.8 ms |
| Lightweight scalar query p95 within 12 samples | 9.4 ms |
| Lightweight scalar JSON bytes | 3,302 |

`EXPLAIN QUERY PLAN` reports `SCAN events` and `USE TEMP B-TREE FOR ORDER BY`. There is no index on `events`. At only 14 rows, this is not the meaningful bottleneck: the measured lightweight full scan and sort is already under 10 ms. An `event_date` index is not justified for P9 unless later measurements at materially larger row counts prove otherwise.

The dominant costs are moving roughly 10 MB of stored strings from SQLite into Node, serializing them, parsing them again in the browser, and transferring them over the public network. The JavaScript projection loop itself is negligible. Public delivery from first byte to completion consumed about 892 ms in the audit sample, while direct query materialization plus serialization consumed about 223 ms. Query planning and row count are not the root cause.

All 14 current events have dates before September 7, 2026; their date range is February 22, 2025 through September 5, 2026. The schema has no archive/completed flag, so the endpoint returns the complete history. This is not the source of the present 10 MB problem: the same scalar history is only about 3.3 KB. Historical filtering or pagination should not be introduced in the first optimization because Event Planner and administrative workflows may legitimately require the full history.

## Current frontend consumers and required fields

The repository has two direct consumer areas.

### Main portal (`public/js/app.js`)

The final effective `window.loadEvents` implementation fetches `/api/events`, populates the global `eventsData`, updates the check-in dropdown, renders Event Planner when active, updates the check-in banner, and writes an eight-event offline summary.

| Consumer | Required event-list fields | Data already loaded elsewhere or appropriate for detail loading |
|---|---|---|
| Check-in event dropdown | `id`, `name`, `event_date` | Attendance/roster totals come from `/api/events/:id/analytics` |
| Event Planner list | `id`, `name`, `event_date`, `time_start`, `venue`, `photos_url`, `materials_url` | No embedded image required |
| Event Planner calendar | `id`, `name`, `event_date` | Analytics is fetched after selection |
| Event Planner grid | List scalars plus a poster reference | Full poster bytes should be a separate browser asset, not list JSON |
| Event edit form | `id`, `name`, `event_date`, `time_start`, `venue`, `event_points`, `photos_url`, `materials_url` | A new poster is uploaded only when intentionally replaced; old bytes need not be loaded into the form |
| Preregistration settings | `id`, `name`, `prereg_title`, `prereg_info` | Banners are relevant only for the selected event |
| Public preregistration view | `id`, `name`, `event_date`, `venue`, `prereg_title`, `prereg_info` plus selected-event media references | Preregistration IDs are fetched from `/api/events/:id/preregs` |
| Share preregistration | Selected event title/link and optionally selected poster | Only the selected poster should be fetched if a file attachment is supported |
| Offline summary | `id`, `name`, `event_date`, time, venue | Current code asks for `event_time` and `location`, while the API exposes `time_start` and `venue`; implementation review should correct that mapping without broadening scope |
| Event analytics/roles | Event identifier | Analytics, attendance/pre-registration rosters, and roles already use dedicated guarded endpoints |

The file contains several historical overrides of `window.loadEvents`; the last definition is effective. Its earlier in-flight guard and localStorage implementation have been overwritten. The effective tab-routing chain invokes the final loader when Event Planner opens; no server-side N+1 behavior results. Implementation must change the final effective definition and verify all direct fallback fetches, rather than editing an overridden function that never runs.

### Legacy preregistration script (`public/preregister.js`)

This script requests `GET /api/events/:id` and expects `name`, `additional_info`, and `poster`. No matching GET detail route currently exists in `server.js`; the current API has method-specific analytics, poster, mutation, preregistration, and roles routes instead. P9 should not silently assume this legacy path is unused. A reviewed event-detail endpoint would make this contract explicit, but staging acceptance must determine whether the page is reachable in current navigation and preserve its intended behavior.

The server-rendered Open Graph path queries one selected event directly and uses the existing `GET /api/events/:id/poster.jpg` asset route. It does not consume the list endpoint.

## Root causes

1. The list query selects three full base64 media columns for every event. They account for 99.936% of the response.
2. Every request materializes those strings in SQLite/Node and serializes them into one 10 MB JSON document, even when the active UI needs only scalar metadata.
3. The browser must download and parse the entire response before the event array is usable.
4. Detail-only preregistration media is mixed into the list contract.
5. The response is not compressed, but simulated gzip remains 7.46 MB and does not address unnecessary selection or client parsing.
6. The final effective client loader no longer has the in-flight guard or localStorage behavior found in an earlier overridden definition. This can amplify cost if separate UI actions call it close together, although it is not the cause of a single response's size.

The root cause is not joins, nested participant data, N+1 queries, JavaScript mapping, a missing index, or the 14-row event count.

## Optimization options

| Option | Expected benefit | Compatibility/API risk | Frontend work | DB/schema impact | Rollback complexity |
|---|---|---|---|---|---|
| Lightweight list projection | Removes over 99.9% of list bytes and most query/serialization work | Existing callers expecting data URIs must be updated | Moderate and targeted | None | Low; code-only revert |
| Selected-event detail endpoint | Keeps preregistration/admin detail complete without polluting list | New explicit API contract; route ordering must be tested | Moderate | None | Low |
| Separate media asset URLs | Lets the browser fetch only needed media and use normal asset caching | Share-as-file behavior needs an explicit blob fetch | Moderate | None; reuse stored columns | Low |
| Lazy-load grid media | Improves first render and avoids unseen poster downloads | Must test all supported browsers/PWA | Small | None | Low |
| Restore one in-flight request guard | Prevents overlapping duplicate fetches | Low if final effective loader is changed | Small | None | Low |
| Limit history or paginate | Helps only when event count grows; little present benefit | High risk to planner/history workflows | Moderate | None initially | Medium |
| Add `event_date` index | Avoids a tiny 14-row sort | Unnecessary schema change now | None | Schema/index change | Medium |
| Compression | At best reduces current sample to about 7.46 MB | CPU/config and cache interactions | None | None | Low |
| Response caching | Can reduce repeat server work | Permission-sensitive staff/public variants and stale updates require careful keys/invalidation | Small to moderate | None | Medium |

## Recommended optimization architecture

Implement the smallest staging-only vertical slice that separates event-list metadata from selected-event media:

1. Make the normal list contract return scalar metadata only: `id`, `name`, `event_date`, `time_start`, `venue`, `photos_url`, `materials_url`, and `event_points`, plus stable media-presence flags or URLs if useful. Do not return base64 media in list JSON.
2. Add an explicit public-safe `GET /api/events/:id` detail projection for the selected event. Preserve the same public/staff restricted-note rules used now; restricted notes must never become public through the new route.
3. Reuse `GET /api/events/:id/poster.jpg` and add narrowly allowlisted binary routes for preregistration banner assets as needed. Never accept a database column or filesystem path from the client.
4. Update the final effective `window.loadEvents` and its direct fallback fetch to consume the lightweight list. Preserve list, grid, calendar, dropdown, and offline behavior.
5. Fetch selected-event detail only when preregistration settings/public detail or another legitimate detail screen opens. Analytics and roles should continue using their existing authorization-controlled endpoints.
6. For grid cards, use a media URL and native lazy loading. Do not convert all poster assets back into one JSON response.
7. If poster file sharing must remain, fetch the selected poster as a blob only when the user invokes sharing and the platform supports file sharing.
8. Restore a single in-flight promise/guard in the final effective loader so simultaneous callers share one request. Do not reintroduce a 10 MB localStorage cache.
9. Correct the offline summary mapping to the existing `time_start` and `venue` names, or define documented list aliases and use them consistently.
10. Keep all historical events in the first phase. Reassess pagination only after payload separation and with explicit history UX requirements.

This design requires coordinated server API and frontend changes. It requires no dependency, database migration, schema change, or index. A compatibility flag or temporary legacy projection may be used during staging if an undocumented external caller is discovered, but the main application must not continue requesting the media-heavy representation.

## Expected result

The measured scalar projection is 3,302 bytes for all 14 events, a 99.967% reduction from the current response. Allowing for explicit media URLs, flags, and preregistration scalar metadata, the normal list should remain below 10 KB at the current row count and comfortably below the 25 KB acceptance ceiling.

The direct query median should fall from approximately 113 ms to around the measured 9 ms range, and JSON serialization should fall from approximately 110 ms to effectively negligible for a few kilobytes. Public response improvement will vary with Cloudflare and client network conditions, but removing roughly 10 MB should materially reduce completion time, memory pressure, and browser parsing.

Selected detail/media requests may still be large for events with large source images. They will be paid only when that event or view is requested, rather than on every list/check-in/calendar load.

## Acceptance criteria

### Performance

- Normal event-list response is no more than 25 KB uncompressed for the current 14-event dataset and no more than approximately 2 KB of JSON metadata per event, excluding independently requested media.
- Payload reduction from the 10,071,001-byte baseline is at least 99.7%.
- Local list median is at most 100 ms and lightweight p95 is at most 250 ms over a small sequential staging sample.
- Public list median is at most 750 ms and lightweight p95 is at most 1.5 s over a small sequential post-deployment sample. Public measurements are operational targets, not load-test guarantees.
- No list request reads or serializes `poster`, `prereg_banner`, or `prereg_bottom_banner` content.
- No duplicate in-flight list requests occur from one UI action.

### Functional and security parity

- Event list, grid, calendar, check-in dropdown, selected-event analytics, create/edit/delete flows, preregistration settings, public preregistration, link/file sharing, and offline summary all pass on staging.
- Full media remains available only where legitimately needed; no supported screen loses a required field.
- Public and normal-member responses cannot expose `roles_restricted_notes`; authorized staff retains the existing view.
- Analytics, roles, attendance, preregistration, mutations, and destructive-route authorization remain unchanged.
- Historical events remain available in Event Planner.
- No schema/index change and no persistent data mutation are caused by P9.
- Google authentication, password authentication, canonical sessions, Offline Engine A1, push, service-worker API bypass, and established launch-security controls remain intact.

## Staging implementation and test plan

1. Begin from exact canonical SHA `4a1c35bf951e5c1fb408b92ad6dc1919b6c10a19` with a clean worktree.
2. Create a fresh verified WAL-safe staging backup before any runtime test.
3. Implement only the list/detail/media separation and final effective consumer changes described above.
4. Run Node syntax checks, inline-script parsing where applicable, `npm test`, and `git diff --check`.
5. Compare lightweight list event IDs and scalar values with the pre-change response without printing event content.
6. Confirm list size, SQL count, query time, serialization time, HTTP time, and absence of embedded data URIs.
7. Test anonymous, normal-member, event staff, and strong-admin projections without changing stored permissions.
8. Manually test list/grid/calendar, check-in selection, edit without poster replacement, edit with a disposable poster only if separately authorized, preregistration settings/public page, sharing, analytics, roles, and offline/reconnect behavior.
9. Use browser network inspection to prove media is requested only for selected/visible contexts and that one UI action creates one list request.
10. Verify staging database integrity and logical data invariance; remove any explicitly authorized disposable fixture.
11. Stop for Product Owner acceptance before commit, push, or production promotion.

## Production rollout plan

1. Promote only an approved, committed, remotely verified P9 release candidate through the staging-to-production workflow.
2. Preserve a fresh verified production SQLite backup and the current production application release before handoff.
3. Deploy source only; do not replace the authoritative production database or environment configuration.
4. Restart only `fog-v3` if separately authorized by the deployment gate.
5. Verify local port 3003 before public traffic.
6. Run the same functional/security smoke, then take a small sequential local/public event-list sample.
7. Confirm database integrity, schema hash, key counts, push subscription, PM2 stability, and logs remain healthy.
8. Do not add an Events API index, cache layer, compression middleware, or pagination during rollout unless it was independently reviewed and accepted on staging.

## Rollback approach

P9 is designed as a code-only API/frontend change with no schema or data migration. If a blocking regression occurs:

1. stop only `fog-v3` if required;
2. preserve the then-current authoritative production database with a SQLite-safe recovery point;
3. restore the prior approved application source `4a1c35bf951e5c1fb408b92ad6dc1919b6c10a19`;
4. hand the current authoritative database to that compatible source;
5. restart only `fog-v3`; and
6. verify integrity, local/public health, event workflows, authentication, authorization, push, and offline behavior.

Do not restore an older database merely to roll back this application contract. Do not modify staging or reactivate V1 as part of routine P9 rollback.

## Phase A decision

P9 is ready for implementation review. The recommended change is a targeted server/frontend contract split with no database or infrastructure work. Implementation must remain separately authorized and staging-first.
