# Coding AI Implementation Prompt — Phase 3 WP3.1
## Inventory Domain Rules & Data Model

**Prompt status:** Owner-authorized bounded implementation task after acceptance of D3-01–D3-11 and T3-01–T3-08 on 2026-10-13.  
**Target repository:** `zinlinna071-lgtm/KitchAI`  
**Expected working branch:** create a new feature branch from the latest `main`, named `feat/wp3-1-inventory-domain-model` (or a collision-safe equivalent). Do not work directly on `main` or the documentation planning branch.  
**Primary references:** [Phase 3 plan](./phases/PHASE_3_PLAN.md), [Domain Contract](./phases/PHASE_3_DOMAIN_CONTRACT.md), [Decision Log](./DECISIONS.md), [Technical Decision Brief](./PHASE_3_TECHNICAL_DECISION_BRIEF.md), [Technical Gate Reconciliation](./PHASE_3_WP3_1_TECHNICAL_GATE_RECONCILIATION.md), [Repository Review](./PHASE_3_WP3_1_REPOSITORY_REVIEW.md).

---

## 1. Your role and required workflow

Act as a senior engineer implementing **WP3.1 only**. Read the current repository, tests, migrations, and the referenced documents before editing. Treat the live repository as the source of truth for current implementation details. The planning documents define the selected business and technical direction, but do not assume their proposed filenames, tables, APIs, or migration code already exist.

Work in this order:
1. Inspect current `main`, package scripts, existing stores, IndexedDB schema and migration paths, sync/outbox/conflict behavior, SQL migrations, RLS policies, and test conventions.
2. Write a short implementation plan and a source-to-change map in the branch before substantial code changes.
3. Implement the smallest coherent WP3.1 domain/data-model slice.
4. Run all relevant tests and the full repository checks available for the changes.
5. Review the complete diff for data loss, unintended scope expansion, stale documentation, unsafe defaults, and security gaps.
6. Update the WP3.1 report, decision/contract references, WP registry, and status with factual evidence.
7. Open a **Draft pull request** against `main`, with test results and known limitations. Do not merge it. Stop after reporting the PR and evidence.

Do not assume that approval of the selected directions permits changing a selected rule. If the current code or existing Phase 2 data cannot safely satisfy a selected rule, stop before making a breaking change and report the exact incompatibility, affected records/paths, options, and recommendation for owner review.

## 2. WP3.1 goal

Establish the reusable inventory domain foundation: exact quantity rules, canonical stock-movement model, append-only audit semantics, owner/business scoping, finished-lot allocation invariants, and a safe versioned local data-model migration. Define the minimum remote data-model/security foundation needed to support the selected contract, grounded in existing Supabase patterns.

This WP does **not** implement the complete purchasing, receiving, production, finished-goods disposition, physical-count UI, or end-to-end inventory-sync experience. Those remain separate WPs:
- WP3.2: suppliers, purchasing, receiving
- WP3.3: production batches and ingredient consumption
- WP3.4: finished goods, carry-over and non-sale disposition
- WP3.5: stock history, counts and corrections
- WP3.6: offline/sync/conflict/recovery integration
- WP3.7: cross-work-package integration and phase exit

Where a contract interface is necessary for later WPs, implement and test only the stable domain/data-model boundary. Do not build placeholder workflows that appear complete but have no correct atomicity or authorization behavior.

## 3. Owner-selected requirements — mandatory

### 3.1 Canonical ledger and append-only history (T3-01, T3-02)
- The append-only stock-movement ledger is canonical. On-hand balances are derived/rebuildable projections, not an independent source of truth.
- A posted movement has an explicit kind/direction and a strictly positive exact quantity with an allowed unit.
- Reject zero, negative, malformed, excessive-precision, overflow, and incompatible-unit values.
- Corrections/reversals are new stable-ID events linked to the original event. Never edit/delete posted movements to conceal history.
- Define how opening balances are represented as auditable events. A projection/ledger mismatch must be detectable and must not silently repair or discard history.
- Keep the existing unit allowlist exactly: `g`, `kg`, `ml`, `l`, `each`. No implicit conversions.

### 3.2 Exact quantity arithmetic (T3-05)
- Domain/API quantity values use exact decimal strings. Internal arithmetic uses exact scaled-integer representation with six fractional decimal places. Never use binary floating-point equality for stock invariants.
- Reject values with more than six fractional decimal places; never silently round.
- Ingredient quantities may use fractional `each`; finished-product stock in `each` must be an integer.
- The selected remote numeric proposal is PostgreSQL `numeric(24,6)`; verify it fits actual SQL/API usage and database constraints.
- Before changing recipe-line validation or converting existing data, inspect the current Phase 2 storage/API shapes and real test fixtures. Preserve valid existing values without rounding or semantic reinterpretation. If compatibility cannot be proven, stop and report rather than silently migrating/rounding.
- Add boundary tests for zero/negative/malformed/too-precise/overflow quantities, all allowed units, fractional ingredient `each`, integral finished-item `each`, exact addition/subtraction, exact allocation totals, and serialization round trips.

### 3.3 Atomic local data model and migration (T3-03, T3-07)
- Extend the existing `kitchai-business-data` IndexedDB database from version 2 to version 3 through an additive migration. Do not create a separate inventory database and do not bump unrelated Phase 1 databases.
- Preserve all existing v2 stores, records, indexes, operations/outbox entries, sync metadata, metadata, conflicts, migration-ledger entries, and legacy source records.
- Seed a populated-v2 migration fixture including Phase 2 ingredients/menu items/recipes/recipe lines, pending operations, sync metadata, conflict snapshots, migration-ledger entries, and representative legacy source data.
- Test successful upgrade, upgrade failure/reopen, interrupted/retried open where testable, idempotent restart, and preservation of existing data and indexes. Failure must not silently delete or overwrite source records.
- Define the future production aggregate boundary so that batch state, ingredient-out movements, finished-lot/output-in movement, explicit allocation, and durable outbox are designed to commit in one local transaction or not at all. Do not represent a sequence of separate transactions as atomic.

### 3.4 Finished-lot allocation and disposition prerequisites (T3-04)
- Every finished-stock reduction must explicitly name one or more lot allocations; each allocation is positive, unit-compatible, and allocations sum exactly to the requested disposition quantity.
- Do not implement implicit FIFO/oldest-lot selection.
- Carry-over references the same lot and must not create stock, a new production event, or duplicate cost.
- The app must not infer food safety from lot age or timestamps. Operator suitability confirmation and any separately reviewed rule are required.

### 3.5 Time semantics (T3-06)
- `createdAt`/`recordedAt` and `effectiveAt` are ISO 8601 UTC timestamps.
- Do not implement authoritative business-day summaries, assumed device-timezone boundaries, or automatic expiry decisions in this WP.
- Store instants consistently; display formatting must not mutate the stored timestamp.

### 3.6 Ownership, idempotency, and remote trust (T3-08)
- Every inventory record/event and every referenced Phase 2 entity must be scoped to the same owner and business.
- Server authorization derives owner identity from the authenticated session, never from a client-supplied owner field. Apply and test the repository's established RLS/privileged-path patterns.
- A stable event/operation ID replay must apply once. A different event ID is not a retry and must not be silently merged with another stock change.
- Preserve distinct conflicting events/snapshots for explicit review. Do not add a path that silently overwrites or auto-merges stock movements.
- Remote stock-changing aggregate operations, when introduced, must use one trusted server transaction/RPC with stock preconditions and idempotency. Client-side ordered upserts are not sufficient.
- Use local/emulated Supabase and pgTAP/Playwright according to existing conventions. Clearly label these as local/emulated evidence, not hosted-provider authorization or real cross-device proof.

### 3.7 Business policy boundaries (D3-01–D3-11)
- No official inventory valuation, COGS, or profit reporting; preserve only traceable purchase-cost inputs.
- Production must block on insufficient ingredient stock; no negative stock or override in the first release.
- Actual measured ingredient use/output must remain distinct from estimated/theoretical values.
- Carry-over requires operator confirmation; no food-safety inference from age alone.
- **Do not capture regular or discounted sales in Phase 3.** No temporary sale ledger/UI and no inferred revenue.
- Owner consumption, giveaway, waste/spoilage, and corrections are distinct categories; owner consumption and giveaways are not revenue.
- Physical-count corrections must be append-only, reasoned, and auditable.
- Suppliers remain optional; only actual received quantities may eventually affect stock. WP3.2 owns receipt workflow.
- No hard delete of posted stock events or historical records; archive/reverse/correct as appropriate.

## 4. Required inspection targets

At minimum inspect:
- `src/business-data-store.js` and all schema/version/upgrade helpers;
- `src/phase2-sync-engine.js`, `src/sync-store.js`, `src/local-store.js`, and `src/supabase-api.js`;
- Phase 2 ingredient/menu/recipe/recipe-line stores and quantity validation;
- all existing SQL migrations, RLS policies, RPC functions, pgTAP tests and Playwright tests;
- `package.json`, CI workflows, current branch/working tree and current `main` head.

Names may have changed since this prompt was written. Find the actual code and report the exact files reviewed. Do not assume prior docs are current without checking.

## 5. Implementation boundaries

Allowed within WP3.1:
- inventory domain types/value objects and deterministic quantity validation/arithmetic;
- canonical movement/lot/allocation data contract and append-only semantics;
- additive local IndexedDB v2→v3 schema migration;
- the minimum remote schema constraints and owner-scoped authorization foundation required by the selected data model, using local-only test resources and current repository patterns;
- tests and documentation directly required to prove WP3.1 acceptance.

Not allowed in this WP:
- hosted project provisioning, billing activation, new paid services, production secrets, production deployment, or live production data;
- merging or pushing implementation directly to `main`;
- WP3.2 purchasing/receiving UI or workflows;
- WP3.3 complete production batch UI/workflow or sale-triggered deduction;
- WP3.4 finished-stock disposition UI/workflow;
- WP3.5 physical-count UI/workflow beyond the domain contract needed for append-only corrections;
- WP3.6 broad sync rollout across all new entities unless a minimal migration/domain test requires a narrowly scoped seam; document and defer remaining sync work;
- WP3.7 claiming Phase 3 completion;
- Phase 4 sales/orders/payments, Phase 5 official costing/accounting, automatic food-safety conclusions, implicit unit conversion, silent rounding, or hard deletion of posted events.

If the scope cannot be completed without crossing these boundaries, stop and report the blocker rather than expanding scope.

## 6. Minimum WP3.1 acceptance evidence

The Draft PR must include a checklist and concrete results for:
1. Current repository/source map and explicit list of files changed.
2. Domain contract/data dictionary for stock movement kinds, quantity/unit rules, identifiers, timestamps, references, append-only corrections, and lot allocation.
3. Exact arithmetic tests: malformed, zero, negative, too-precise, overflow, valid boundaries, unit rules, fractional ingredient `each`, whole-number finished `each`, allocation sum exactness, and serialization round-trip.
4. IndexedDB populated-v2→v3 migration tests preserving all listed stores/data/indexes/outbox/sync/conflicts/migration ledger/legacy records, plus failure/reopen/restart safety.
5. Ownership/business-scope validation and local database authorization tests; unauthenticated and cross-owner paths rejected.
6. Idempotency tests that distinguish same-ID retry from distinct-ID competing event; no silent stock-event merge.
7. A contract/test seam showing that a later production aggregate must be all-or-nothing locally and use a trusted atomic remote command. If a runnable aggregate is added in this WP, test rollback on insufficient stock/validation failure and duplicate retry; do not substitute sequential upserts.
8. Full relevant repository checks: existing `npm test`, `npm run check`, `npm run build`, `npm run check:pages-preview` as applicable, SQL/pgTAP suites, and browser tests for changed behavior. If any script cannot run, report exact command/output and reason.
9. Diff review confirms Phase 2 behavior and existing records are preserved; no unsupported claims about hosted sync, backup, encryption at rest, or production readiness.
10. Updated WP registry/status and a concise WP3.1 implementation report with passed/failed/not-run items, known limitations, and follow-up items for WP3.2–WP3.7.

Do not claim a test passed unless you actually ran it and captured its result. A documentation-only review, static inspection, mocked server, or local Supabase test is not evidence of hosted authorization, cross-device sync, backup/restore, or production readiness.

## 7. Stop conditions

Stop before further code changes and report to the owner if:
- Phase 2 recipe quantities cannot be represented exactly under the selected six-decimal rule without loss/rounding;
- a safe populated-v2 migration cannot be demonstrated;
- ownership cannot be derived/enforced using the current authenticated server context;
- the chosen local or remote transaction boundary cannot ensure all-or-nothing stock changes;
- a material change to T3-01–T3-08 or D3-01–D3-11 appears necessary;
- implementation would require paid/hosted resources, production secrets, or a production-data test;
- an unexpected repository state makes the planned branch/base unsafe.

## 8. Completion report format

Report:
- branch name, base SHA, implementation commit SHA, Draft PR URL;
- summary of domain/data model changes;
- migration behavior and preservation results;
- exact quantity and unit test results;
- owner-isolation, idempotency, conflict, and transaction evidence;
- every check run with pass/fail/not-run;
- changed files and diff review findings;
- known limitations and deferred WP3.x tasks;
- explicit statement that PR is **not merged** and hosted provisioning/billing/deployment were not performed.

**Finish by opening a Draft PR and reporting evidence. Do not merge, deploy, provision hosted resources, or continue into WP3.2–WP3.7.**


## Current-state reconciliation — 2026-10-16

This document was written during the initial Phase 3 planning/repository-review period. Treat its initial recommendations, pending gates, and baseline commit references as historical unless they are confirmed by current code and tests. Inventory foundation, guarded recipe quantity adapter, atomic inventory commands, purchasing/receiving, production lifecycle/posting, finished-stock disposition, and stock counts have since been implemented in merged slices. See [`PHASE_3_CURRENT_STATUS.md`](../PHASE_3_CURRENT_STATUS.md) for current status and [`WP_REGISTRY.md`](../WP_REGISTRY.md) for implementation evidence. The current code, database migrations, current decisions, and latest test contracts take precedence over any outdated proposal here. Phase 3 is not declared complete; manual device/offline/accessibility/recovery acceptance remains deferred, and hosted provisioning/billing/secrets/production deployment are not authorized.
