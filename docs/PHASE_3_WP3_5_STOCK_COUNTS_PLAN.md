# WP3.5 — Physical Stock Counts and Adjustments Plan

**Status:** Owner decisions accepted 2026-10-14. WP3.5a contract merged via [PR #52](https://github.com/zinlinna071-lgtm/KitchAI/pull/52); WP3.5b server-authoritative item versions merged via [PR #53](https://github.com/zinlinna071-lgtm/KitchAI/pull/53); WP3.5c offline count drafts/review merged via [PR #54](https://github.com/zinlinna071-lgtm/KitchAI/pull/54); WP3.5d atomic count posting merged via [PR #55](https://github.com/zinlinna071-lgtm/KitchAI/pull/55) as commit `8cae7f31a828fe03f2819e8c159d1d4190b06f95`. The WP3.5e branch now includes the accessible review UI, explicit posting selection, pending-post guards, session creation, stock-item selection and server-snapshot capture, explicit fallback unit selection when the server item has no unit, responsive setup forms, and regression assertions. Head `fa0338d0e81a5506e1cb8a69119523b0dfce3ed7` passed [Static test preview](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38640373054), [WP1.2 Application Shell](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38640373137), and [WP1.6 Local Supabase Vertical Slice](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38640373084). The source-level UI assertions are not a browser end-to-end test; browser interaction coverage remains to be added before treating UI acceptance as fully verified. No hosted resources, billing, secrets, or deployment are authorized.
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

## 4. Accepted owner decisions (2026-10-14)

- **D3.5-01 — Movement during count:** accepted Option A, optimistic concurrency. A stale line is rejected and must be reviewed/recounted.
- **D3.5-02 — Partial count sessions:** accepted Option A. Submit only completed/reviewed lines; unsubmitted lines remain open. Each submitted subset is all-or-nothing.
- **D3.5-03 — Zero variance:** accepted Option A. Save an audit record; do not create a zero-quantity ledger movement.
- **D3.5-04 — Count cancellation:** accepted Option A. Cancel only before any accepted adjustment; after posting, preserve history and use a new linked correction/reversal.

The detailed state, concurrency, quantity and test contract is in [PHASE_3_WP3_5A_COUNT_CONSISTENCY_TEST_CONTRACT.md](./PHASE_3_WP3_5A_COUNT_CONSISTENCY_TEST_CONTRACT.md).

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
- [ ] Playwright browser smoke checks verify accessible session/line controls, posting remains disabled without a valid review state, the page has no uncaught runtime errors, and the stock-count panel fits a narrow mobile viewport. Workflow: `.github/workflows/wp3-5e-browser.yml`; test: `tests/stock-count-ui.browser.spec.js`.
- [ ] Scope and remaining limitations are documented; hosted provider behavior is not claimed as tested.

## 7. Explicit non-goals

Barcode scanning, multi-user count assignments, supplier catalog synchronization, sales/revenue accounting, official inventory valuation/COGS, AI-generated count suggestions, hosted provisioning, billing, production deployment, and cross-device guarantees are out of scope unless separately approved.

## 8. Implementation sequence after owner decisions

- WP3.5a: accepted decisions, consistency invariant, session/line state contract, and DB/browser test matrix. Documentation-only contract: [PHASE_3_WP3_5A_COUNT_CONSISTENCY_TEST_CONTRACT.md](./PHASE_3_WP3_5A_COUNT_CONSISTENCY_TEST_CONTRACT.md).
- WP3.5b: design and implement additive schema/version protocol, with migration tests; audit all inventory writers and serialize same-item commands.
- WP3.5c: local count-session/line domain/store and offline persistence.
- WP3.5d: atomic count posting, idempotency, stale conflicts and retry handling.
- WP3.5e: accessible review UI and final regression/local-Supabase gates.

Do not enable count posting until database review and concurrency tests prove every stock-changing RPC uses the shared lock/version protocol.


## WP3.5d implementation note — 2026-10-14

WP3.5c is merged in [PR #54](https://github.com/zinlinna071-lgtm/KitchAI/pull/54). WP3.5d is merged to `main` via [PR #55](https://github.com/zinlinna071-lgtm/KitchAI/pull/55), merge commit `8cae7f31a828fe03f2819e8c159d1d4190b06f95`.

The additive migration `20261014003000_phase3_atomic_stock_count_posting.sql` introduces:
- `post_stock_count_subset`, which takes a stable command ID, server business/session IDs, and 1–200 reviewed lines.
- The same owner-scoped advisory transaction lock used by `apply_inventory_command`, followed by deterministic item-version locks.
- Expected-version comparison before any line audit or stock movement is inserted. A stale line raises SQLSTATE `40001` and the entire submitted subset rolls back.
- Server-derived system quantity and variance; the client cannot supply the authoritative system balance.
- Append-only accepted-line audit, including zero-variance lines with no zero-quantity stock movement.
- Per-command idempotency checked before stale-version validation; a retry after accepted posting returns the original result.
- Optional completion of the server-side session. Partial subsets remain open; each request is atomic.

The local store persists the exact command ID and payload before network delivery. An acknowledged result finalizes local line states; a stale rejection preserves the rejected attempt, marks affected lines stale, and requires a fresh server snapshot and recount.

**Verification status — 2026-10-15:** all five PR-triggered workflows passed on PR head `1938cdad903aa707d166cc09ab4c3f374b77ffd8` (Baseline, Static Preview, WP1.2 Application Shell, WP1.4 Local Supabase Authorization, and WP1.6 Local Supabase Vertical Slice). The separate-session concurrency regression confirmed the count waited on the shared owner advisory lock, the concurrent receipt committed, the stale count rejected with SQLSTATE `40001`, and no accepted count audit row was written. A browser regression also verifies that local count mutations are blocked while a posting result is uncertain. PR #55 is merged. WP3.5e remains local/offline-first and does not authorize hosted resources, billing, secrets, or deployment.


## WP3.5e browser smoke test — 2026-10-15

Added a separate Playwright/Chromium browser test suite and PR-triggered workflow. The tests exercise the built application served by the repository's own smoke server, rather than relying only on source-text assertions. They check accessible session and line controls, ensure session creation/add-line/post actions are disabled when no authenticated synced workspace is configured, detect uncaught page errors, and check for horizontal overflow at a 360px viewport. These tests still require a successful CI run on the latest PR head; they do not replace the existing Local Supabase database and authorization scenarios or prove hosted-provider behavior.
