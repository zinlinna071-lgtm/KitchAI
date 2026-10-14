# WP3.5 — Physical Stock Counts and Adjustments Plan

**Status:** Proposed design; owner decision required before implementation.  
**Phase:** 3 — Purchasing & Inventory  
**Parent:** `docs/ROADMAP.md`, Phase 3; see current WP status in `docs/WP_REGISTRY.md`.  
**Implementation boundary:** local/offline-first PWA and isolated local Supabase only. No hosted provisioning, billing, secrets, or deployment is authorized.

## 1. Goal

Allow the owner to count physical ingredient stock, compare counted quantity with a trustworthy system quantity, review the variance, and post an auditable adjustment without editing or deleting the original stock ledger.

The workflow must use the existing exact-quantity contract and atomic inventory command RPC. A count draft is not a stock change. Stock changes only after the server accepts the adjustment command.

## 2. Proposed smallest vertical slice

1. Create an owner/business-scoped count session with a stable ID and status: `open`, `ready_for_review`, `posted`, or `cancelled`.
2. Select one or more existing inventory ingredients and capture a count-line snapshot: ingredient ID, supported base unit, system quantity, count-time movement watermark/version, counted quantity (nullable until entered), and optional note.
3. Accept only exact supported decimal quantities; reject negative counts, unsupported precision, unsafe ranges, unknown units, and fractional quantities for an `each` stock item.
4. Calculate variance as counted quantity minus the applicable system quantity, preserving exact decimal arithmetic. Show zero variance distinctly from missing/unentered count.
5. Require the operator to review each variance and provide a reason for every non-zero adjustment.
6. Persist the reviewed adjustment command and stable command ID locally before network delivery. Retry must reuse the same command ID and payload.
7. Post through the trusted server-side atomic inventory command. Add a new ledger event for each adjustment; never rewrite historical movement rows or directly overwrite a balance.
8. Display `posted` only after server acceptance. Preserve offline drafts and show a clear pending/retry state while the server result is unknown.

## 3. Critical consistency question: stock moves while a count is open

A count can become stale if purchasing, production, sale, waste, or another adjustment changes stock after the quantity was observed. A stale count must never silently overwrite newer movements.

### Option A — Optimistic concurrency (recommended for the first slice)

Capture a server-authoritative movement watermark/version for each ingredient when its physical quantity is entered. At posting, the database atomically checks that the ingredient has not had a later stock movement. If it has, reject that line as stale and require the operator to review/recount it against the latest system quantity. The owner can continue normal operations; a stale line cannot post until reconciled.

**Advantages:** no global stock freeze; stale counts cannot silently clobber receipts or production; straightforward auditable behavior.  
**Trade-off:** busy ingredients may need recounting; offline counts may remain drafts until reconnect and revalidation.

### Option B — Freeze the counted stock scope

When a count starts, prevent receipts, production, sales, waste, and adjustments for the selected ingredients until the count is posted or cancelled.

**Advantages:** simple conceptual model.  
**Trade-offs:** disruptive to kitchen operations; enforcing a reliable lock across all existing inventory command types is a broader change; offline clients cannot enforce a global lock by themselves.

### Option C — Reconcile movements during the count

Record a reliable event order and each item's actual count time, then adjust the observed count for all movements between count time and posting.

**Advantages:** operations can continue without requiring a recount for every intervening movement.  
**Trade-offs:** requires an authoritative, complete movement sequence and correct treatment of every movement type, clock/ordering edge cases, and offline-delayed events; higher risk and scope.

**Recommendation:** Option A for the first release. The database must own the final concurrency check; a client-only timestamp check is insufficient. If the current ledger lacks a safe per-ingredient version/watermark, add the smallest additive server-side mechanism and test it under concurrent posting.

## 4. Owner decisions needed

- **D3.5-01 — Movement during count:** A) optimistic concurrency and require review/recount on stale lines (recommended); B) freeze affected stock; C) reconcile movements during count.
- **D3.5-02 — Partial count sessions:** A) allow posting only completed lines while keeping remaining lines open (recommended); B) require every selected line to be counted before any line can post.
- **D3.5-03 — Zero variance:** A) save the count audit record but create no stock adjustment movement for zero variance (recommended); B) create a zero-quantity ledger event (usually unnecessary).
- **D3.5-04 — Count cancellation:** A) allow cancellation only before any adjustment is accepted; preserve the cancelled session and its entered values in history (recommended); B) permit reopening after posting (not recommended; use a new count/correction instead).

These are proposals, not accepted decisions. No implementation should assume the owner has approved them until they are recorded in `docs/DECISIONS.md` or a dedicated owner-decision record.

## 5. Data and security constraints

- Every session, line, and command must be scoped to the authenticated owner and server-issued business ID. Do not trust a client-supplied owner ID.
- Keep local IndexedDB partition IDs separate from server business IDs.
- Never allow cross-business line references, unknown inventory items, unsupported units, or negative counted quantities.
- Use exact decimal strings/BigInt or the existing guarded adapter; do not silently round.
- Treat count records as auditable history. Corrections after posting use a new linked reversal/correction event, not editing/deleting the posted adjustment.
- Preserve local count drafts across reload and offline periods. Do not call a command posted until the server confirms acceptance.
- A network-uncertain command is retryable with its original ID/payload; it cannot be abandoned as if definitely rejected.

## 6. Acceptance criteria

- [ ] Create, list, reload, and cancel a local count draft without losing existing Phase 2/3 IndexedDB records.
- [ ] Count quantity validation covers exact decimals, zero, negative values, unsupported precision, range overflow, base-unit mismatch, and `each` fractions.
- [ ] Variance uses exact arithmetic and distinguishes missing count from zero.
- [ ] A non-zero variance cannot be reviewed without a reason.
- [ ] A stale count line is rejected atomically at the trusted server boundary and returns enough detail for safe review/recount.
- [ ] A successful adjustment creates exactly one append-only movement; the original ledger remains unchanged.
- [ ] Duplicate delivery and lost acknowledgement reuse the same command ID and do not double-adjust stock.
- [ ] Multi-line posting is all-or-nothing, including a stale or invalid line; no partial server mutation.
- [ ] Authorization tests reject anonymous and cross-owner/business access.
- [ ] Offline draft/reload, reconnect, retry, concurrent receipt/production movement, and server-rejection scenarios are covered.
- [ ] Baseline, application-shell/browser, static preview, local Supabase database, and local integration gates pass on the final head.
- [ ] Scope and remaining limitations are documented; hosted provider behavior is not claimed as tested.

## 7. Explicit non-goals

Barcode scanning, multi-user count assignments, supplier catalog synchronization, sales/revenue accounting, official inventory valuation/COGS, AI-generated count suggestions, hosted provisioning, billing, production deployment, and cross-device guarantees are out of scope unless separately approved.

## 8. Implementation sequence after owner decisions

- WP3.5a: finalize decision record, count consistency contract, server-side concurrency invariant, and database test matrix.
- WP3.5b: local count-session/line domain and additive IndexedDB migration with reload/offline tests.
- WP3.5c: atomic server posting and idempotent command integration, including stale-count rejection.
- WP3.5d: accessible count/review UI and retry/conflict handling.
- WP3.5e: final regression, migration, authorization, and local-Supabase integration review.

Do not start database or UI implementation before the owner resolves D3.5-01 through D3.5-04.
