# WP3.5a — Stock Count Consistency and Test Contract

**Status:** Design/test contract; no application code or database migration in this WP.  
**Owner decision:** D3.5-01 through D3.5-04 accepted on 2026-10-14.  
**Parent plan:** [WP3.5 Physical Stock Counts and Adjustments](./PHASE_3_WP3_5_STOCK_COUNTS_PLAN.md).  
**Existing implementation references:** `supabase/migrations/20261013000000_phase3_inventory_foundation.sql` and `supabase/migrations/20261014000000_phase3_inventory_atomic_commands.sql`.

## 1. Accepted behavior

1. **Stale counts:** use optimistic concurrency. If any stock movement occurs after a line's count snapshot, reject that line at the trusted database boundary and require review/recount against current stock.
2. **Partial sessions:** allow completed/reviewed lines to post while uncounted lines remain open. Each posted subset is an independent, all-or-nothing command; posted lines cannot be posted again.
3. **Zero variance:** save an auditable count line, but create no zero-quantity stock movement. A later movement must not rewrite the saved audit record.
4. **Cancellation:** a session can be cancelled only before any adjustment has been accepted. Preserve the cancelled session and entered values. After posting, corrections use a new linked correction/reversal workflow; do not reopen or edit the posted adjustment.

## 2. Existing ledger constraints and implementation implications

- `stock_movements` is the canonical append-only ledger; current balance is derived from signed movement quantities.
- Movement quantities are positive decimal strings (up to six fractional digits); direction determines sign. A zero-variance result must not be passed to the movement RPC because the ledger requires quantity > 0.
- `count_adjustment` accepts either direction and requires a reason.
- The existing inventory RPC checks that outgoing movement does not make projected stock negative and writes all movement/lot/allocation rows in one transaction.
- Current movement rows have timestamps and event IDs, but a timestamp alone is not a safe concurrency token: timestamp precision, concurrent transactions, and client clocks can make it stale or ambiguous.
- The current RPC calculates an outgoing balance from the ledger but does not yet serialize all concurrent commands for the same stock item. WP3.5 implementation must close this gap for count posting; it must not claim atomic stale-count protection until database tests prove it.

## 3. Required concurrency invariant

Every inventory command that changes an item must participate in the same database-owned per-item serialization/version protocol. A count line captures a server-issued version at the time the count is anchored. During posting, the trusted database must acquire the affected item lock, compare the captured version with the current version, validate the adjustment, append the ledger movement, and advance the version in the same transaction.

Design requirements:
- The token is server-generated and monotonically advances for every accepted movement of that owner/business/stock-class/item tuple.
- Lock acquisition for commands affecting multiple items uses a deterministic sort order to avoid deadlocks.
- A concurrent receipt/production/waste/adjustment must either commit before the count check (causing a stale rejection) or commit after the count transaction; it must never slip between comparison and adjustment.
- Snapshot capture and version reads are server-authoritative. Offline clients may preserve a draft but cannot invent or validate the version.
- Existing ledger history is preserved. An additive migration may initialize version rows from existing items/ledger before new count sessions are enabled.
- If a stock movement changes while a count is open, a rejected stale line remains in reviewable history and must be refreshed/recounted. Do not silently recompute a variance from an old physical observation.
- For a multi-line command, lock/check all included lines and validate all movement payloads before accepting any part. Any stale/invalid line rolls back the whole command. Partial sessions mean the user chooses a smaller complete subset and submits it as another command; they do not mean partial mutation within one command.
- A stable command ID plus identical payload is idempotent. Same ID with different payload is rejected. A lost acknowledgement is retried with the exact persisted ID/payload.

**Important:** the version/lock protocol is a design prerequisite, not a claim that the existing RPC already provides it. Implementation must review every existing writer path, including purchasing receipts, production consumption/output, finished-stock dispositions, and corrections, and route them through the same protocol before count posting is enabled.

## 4. Quantity and variance contract

- System quantity, counted quantity, variance, and adjustment quantity use exact decimal arithmetic with at most six fractional digits and the existing numeric range.
- Missing/unentered count is `null`, not zero.
- Counted quantity must be non-negative. Quantity zero is valid and distinct from missing.
- The item uses its existing stock unit; no implicit g↔kg, ml↔l, or other conversion is allowed in this WP.
- `each` must be an integer count. Do not accept fractional pieces.
- Variance = counted quantity − system quantity. If positive, post an inbound `count_adjustment`; if negative, post an outbound `count_adjustment` for the absolute value; if zero, save the audit line only.
- Every non-zero variance requires a non-blank reason. A count line may include an optional note, but a note does not substitute for the adjustment reason.
- A physical count records the observed quantity, system snapshot/version, variance, reviewer decision, reason, actor and timestamps. These audit facts must not be rewritten after posting.

## 5. Proposed session/line state transitions

Session:
- `open` → `ready_for_review` when at least one line is counted and the user asks to review.
- `ready_for_review` → `open` when unposted lines need more work or a stale line needs recounting.
- `open` or `ready_for_review` → `cancelled` only if no adjustment command has been accepted.
- Any session with accepted lines is not cancellable/reopenable as a whole; remaining lines can continue, and posted lines remain immutable.
- `posted` is a derived/terminal state only when all intended lines are resolved and no unposted lines remain. A partially posted session stays open/reviewable.

Line:
- `needs_count` → `counted` → `reviewed`.
- A reviewed non-zero line needs a reason and a captured snapshot version.
- A stale posting result transitions the line back to `needs_review` (or equivalent explicit stale state) and retains the old observation as history; recounting creates a new observation/revision rather than overwriting the prior audit event.
- Zero variance can be accepted as `recorded_no_adjustment` without a movement event.
- A posted line is immutable; any subsequent correction is a new linked ledger event.

The exact persisted enum names can be chosen during implementation, but equivalent states and invariants are required.

## 6. Database test matrix

Tests should be implemented as pgTAP or the repository's existing database test style, plus local Supabase integration coverage.

| ID | Scenario | Required result |
|---|---|---|
| DB-01 | Unauthenticated caller posts a count | Rejected; no rows change |
| DB-02 | Owner A uses Owner B's business or stock item | Rejected; no cross-scope disclosure/write |
| DB-03 | Counted quantity is missing, malformed, negative, non-finite, over range, or over six decimal places | Rejected before any ledger write |
| DB-04 | `each` item has fractional count | Rejected |
| DB-05 | Stock unit differs from existing item unit | Rejected; no conversion |
| DB-06 | Positive variance | Exactly one inbound count-adjustment movement; derived balance equals physical count |
| DB-07 | Negative variance | Exactly one outbound count-adjustment movement; derived balance equals physical count and never becomes negative |
| DB-08 | Zero variance | Count audit persisted; no zero-quantity movement; balance unchanged |
| DB-09 | Non-zero variance reason is blank | Rejected |
| DB-10 | Snapshot version is older than current item version | Stale conflict returned; no movement or version advance |
| DB-11 | Receipt/production/waste commits between count snapshot and count post | Count is rejected as stale |
| DB-12 | Count obtains lock first, concurrent receipt/production waits | Count commits against its valid snapshot; later movement applies afterward |
| DB-13 | Two concurrent count posts use same snapshot | At most one succeeds; second sees stale version |
| DB-14 | Multi-line command contains one stale or invalid line | Entire command rolls back; no line movement/version changes |
| DB-15 | Same command ID and same payload retried | Same result returned; no duplicate movement |
| DB-16 | Same command ID with different payload | Rejected; ledger unchanged |
| DB-17 | Server commits but client loses acknowledgement | Retry returns accepted result without double adjustment |
| DB-18 | Partial session posts completed subset | Submitted subset is atomic; unsubmitted lines remain reviewable and untouched |
| DB-19 | Cancel before any accepted adjustment | Session preserved as cancelled; no stock change |
| DB-20 | Cancel after one accepted adjustment | Rejected; posted line and audit history preserved |
| DB-21 | Movement history before count remains byte-for-byte/logically unchanged | No update/delete of original ledger entries |
| DB-22 | Existing inventory commands race for the same item | All use shared serialization/version protocol; no stale count acceptance or negative-stock race |
| DB-23 | Migration upgrades existing database with ledger rows | Version initialization is deterministic; prior ledger and lot allocations preserved |
| DB-24 | Invalid/cross-business lot references accidentally supplied | Count command rejects unsupported lot/allocation payload and rolls back |

Use explicit concurrent transactions/barriers for DB-11 through DB-13 and DB-22; sequential tests alone do not prove concurrency correctness.

## 7. Browser/offline integration matrix

- Draft and line values survive reload and offline restart in owner/business-scoped IndexedDB.
- Local partition/business IDs are not confused with server-issued business IDs.
- Offline-created draft cannot post until it has a valid server snapshot/version and an authenticated session.
- Review screen shows system quantity, counted quantity, signed variance, unit, snapshot freshness, reason, and posting/retry status.
- A stale server response clearly marks the affected line and offers refresh/recount; it does not silently alter the count.
- Pending command is persisted before network call. Retry reuses the exact command ID and payload.
- Network timeout/unknown result remains pending/retryable; UI does not claim posted or allow unsafe cancellation.
- A rejected command does not mutate local projected stock as though it were accepted.
- Existing purchase, production, finished stock, offline sync, auth, conflict, and import browser tests continue passing.

## 8. WP3.5 implementation gates

- **WP3.5a (this document):** decision record, invariant, state contract, DB/browser test matrix; documentation-only.
- **WP3.5b:** implement additive schema/version protocol and tests; first audit and migrate every stock writer to the shared per-item serialization protocol.
- **WP3.5c:** count-session domain/store and offline persistence.
- **WP3.5d:** atomic count posting, idempotency, stale conflicts and retry handling.
- **WP3.5e:** accessible review UI and full regression/local Supabase gates.

Do not mark WP3.5a implementation-ready until the database design review confirms that all stock-changing RPC paths can use the same lock/version protocol and the test harness can exercise concurrent transactions.
