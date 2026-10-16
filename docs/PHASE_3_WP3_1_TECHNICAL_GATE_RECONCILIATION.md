# Phase 3 WP3.1 — Technical Gate Reconciliation

**Review date:** 2026-10-13  
**Mode:** Documentation-only, source-grounded planning  
**Status:** T3-01–T3-08 owner-selected on 2026-10-13; WP3.1 implementation is bounded by the linked prompt and acceptance gates  
**Branch:** `docs/phase-3-production-inventory-plan`

Related documents: [Phase 3 plan](./phases/PHASE_3_PLAN.md), [Domain Contract](./phases/PHASE_3_DOMAIN_CONTRACT.md), [Repository Review](./PHASE_3_WP3_1_REPOSITORY_REVIEW.md), [Decision Gate Matrix](./PHASE_3_DECISION_GATE_MATRIX.md), [Technical Decision Brief](./PHASE_3_TECHNICAL_DECISION_BRIEF.md), [Decision Log](./DECISIONS.md).

## 1. Purpose and result

This document turns the WP3.1 repository review into a concrete source-to-contract and test plan. It does not change application behavior. It does not authorize schema design to be treated as final, SQL migrations, application implementation, hosted resources, billing, production secrets, or deployment.

**Result:** the existing repository has a suitable local-first foundation to extend, but it does not yet provide stock movement semantics, inventory tables, production aggregate commands, or a remote stock-event API. WP3.1 can define these contracts, and WP3.2–WP3.6 can implement them in bounded work packages only after the owner reviews the material technical recommendations and the quantity/time rules are testable.

## 2. Source-grounded repository map

| Area | Verified current source | Existing behavior | Phase 3 consequence |
|---|---|---|---|
| Shared local business DB | `src/business-data-store.js` | Opens `kitchai-business-data` at IndexedDB version 2; creates entity stores, `operations`, `syncMetadata`, `metadata`, `migrationLedger`, and `conflicts`. | Additive Phase 3 stores belong in this same database unless an explicit architecture review chooses otherwise. Do not create a parallel inventory database. |
| Schema upgrade | `src/business-data-store.js:createSchema` and `openBusinessDatabase` | Current version constant is 2; schema creation guards each store with `objectStoreNames.contains`. Opening the DB reconciles legacy Phase 2 data. | Any future version bump must preserve every existing v2 store/index and must not skip legacy reconciliation. A versioned v2→v3 upgrade needs populated-v2 tests. |
| Legacy migration | `src/business-data-store.js:migrateLegacyPhase2Data` and migration queue helpers | Reads legacy ingredient/menu/recipe stores, maps scopes to stable profile IDs, records ledger snapshots, queues operations, and preserves legacy source records. | New inventory migration must not alter, reset, rename, or repurpose existing migration ledger keys or legacy source databases. Migration failures must remain visible and recoverable. |
| Local domain writes | `src/ingredient-store.js`, `src/menu-item-store.js`, `src/recipe-store.js` | Domain record and its outbox/sync metadata are committed together in IndexedDB transactions. | Production completion should follow the same durable-local-write principle, but include all batch/movement/lot/outbox records in one transaction. |
| Existing units | `src/recipe-store.js` | Exact allowlist `g`, `kg`, `ml`, `l`, `each`; recipe quantities are finite and positive; no conversion layer. | Keep this allowlist. Stock movement precision and quantity representation need a separate contract; do not reuse JavaScript floating-point equality for business arithmetic. |
| Entity sync engine | `src/phase2-sync-engine.js` | Explicit type/table/store mappings for ingredient, menu item, recipe, and recipe line; durable retry, dependency ordering, acknowledgements, and conflict snapshots. | Inventory entities and movement events are unsupported until explicitly mapped. Dependency ordering is not a transaction across production effects. |
| Remote API and DB | `src/supabase-api.js`, existing `supabase/migrations/*`, database tests | Current remote entity contract supports Phase 2 entities and owner-scoped Business Profile behavior; no Phase 3 stock ledger or production aggregate is established. | A Phase 3 remote write needs a trusted server-side transaction/RPC and local-Supabase tests. Client-side sequences of independent upserts are insufficient for production posting. |
| Existing automated checks | `package.json`, `tests/*`, `.spikes/wp1-1-local-sync/tests/local-supabase.integration.spec.js` | `npm test`, typecheck, build, browser smoke, local Supabase/pgTAP and Playwright coverage exist. | Extend current test conventions; include Phase 3 modules in syntax/type/build checks and keep local/emulated versus hosted evidence distinct. |

### Scope note

The source inspection above is a static repository review. No test command was executed for this reconciliation, and no application files were edited. Prior Phase 2 test results are historical evidence for Phase 2 behavior only; they are not Phase 3 test evidence.

## 3. Owner-selected technical baseline — implementation must verify compatibility

These recommendations are a coherent candidate for the owner to accept or amend. They are not silently approved by the business-policy selections D3-01–D3-11.

### TG-1. Canonical stock history

**Recommendation:** an append-only stock-movement ledger is the canonical explanation of stock changes. Current on-hand quantities are derived/rebuildable projections, not a second independent source of truth.

- Every posted stock effect has a stable immutable event ID, owner/business scope, stock item identity, stock class (ingredient or finished lot), movement kind, positive quantity, exact unit, source reference, effective timestamp, recorded timestamp, and actor/context metadata where available.
- Prefer **explicit direction plus positive quantity** over a signed quantity field so a movement cannot be ambiguously both “out” and negative. The exact enum and event schema must be reviewed before schema work.
- Posted zero-quantity events are rejected. Draft records may be incomplete but have no stock effect.
- Reversals and corrections are new linked events; never edit or delete a posted movement to rewrite history.
- Opening stock must be represented as a clearly typed opening-balance event or documented migration event, not silently seeded into a mutable balance.
- Any cached balance can be rebuilt and compared to the ledger. If a projection disagrees, surface a reconciliation error; do not silently repair historical events.

**Owner review gate:** accept or replace the ledger-as-canonical proposal and explicit-direction representation before implementation.

### TG-2. Atomic local and remote posting

**Recommendation:** model production completion as one aggregate business command, not a sequence of independently saved records.

- **Local IndexedDB boundary:** one read-write transaction commits the production batch state, ingredient-out movements, finished-lot/output-in movement, lot allocations, and durable outbox operation(s) together—or commits none. The user must never see a batch as completed if any associated movement/outbox write failed.
- **Remote boundary:** one trusted server-side PostgreSQL transaction/RPC (or equivalent single atomic endpoint) validates the entire aggregate, checks stock and owner/business scope, applies every movement exactly once, and stores the idempotency outcome. Independent row upserts with dependency ordering do not satisfy this gate.
- The stable aggregate operation ID is created once and reused for retries. Replaying it returns the original outcome or an equivalent idempotent result; it must not duplicate ingredient consumption or finished output.
- Validate the complete request before applying effects. Any invalid line, insufficient stock, wrong scope, stale state, or duplicate conflicting identity rejects the aggregate without partial posting.
- The server is authoritative for cross-device concurrency. Local on-hand checks improve UX but do not replace server-side checks.

**Required failure tests:** abort each local write stage; force a remote rejection after validation; lose the remote response after commit and retry the same ID; submit a distinct competing ID against stale stock; verify no partial movement set and no duplicate effects.

### TG-3. Lot allocation and carry-over

**Recommendation:** every finished-stock reduction explicitly identifies the lot(s) reduced.

- A disposition quantity must equal the sum of its positive lot allocations exactly under the approved quantity representation and compatible unit.
- If a disposition spans multiple lots, each allocation is separately recorded and auditable.
- Do not silently select FIFO, oldest lot, or a “safe” lot. If a future lot-selection policy is desired, it needs a separate reviewed rule and tests.
- Carry-over references the existing lot and changes its status/location/date metadata only if the selected domain contract requires it. It does not create another production event or add duplicate stock.
- Carry-over requires operator confirmation of suitability. Elapsed time alone never proves that food is safe.
- Discounted sale capture is deferred to Phase 4 under selected D3-07. Phase 3 must not create revenue or a parallel sales ledger.

**Owner review gate:** accept explicit lot allocation and no implicit FIFO/safety inference before implementation.

### TG-4. Quantity precision and unit compatibility

**Selected policy boundary:** preserve quantity precision; reject invalid quantities; no silent rounding or conversion (D3-02). The technical representation is still open.

- Keep units `g`, `kg`, `ml`, `l`, `each`; no implicit conversion.
- Reject non-finite, non-positive posted quantities; reject zero-effect movements and incompatible units. Do not assume density or convert mass to volume.
- Do not use binary floating-point equality to reconcile stock totals.
- Before coding, propose and test the storage/wire representation, per-unit precision/range, overflow behavior, comparison strategy, and whether fractional `each` is permitted. This cannot be left as an unspecified “later” detail because stock balance and lot-allocation equality depend on it.
- A candidate worth evaluating is decimal strings at domain boundaries plus exact decimal arithmetic and PostgreSQL `numeric`; compare it against the current JavaScript-number recipe-line representation for migration and API compatibility. Do not select it without a concrete test-backed proposal.
- Display rounding, if any, must be presentation-only and must not mutate stored quantities.

**Blocking gate:** no production implementation until precision, range, fractional `each`, and equality semantics have a testable proposal.

### TG-5. IndexedDB v2 → v3 migration safety

**Recommendation:** make a versioned additive upgrade of `kitchai-business-data` only after mapping all current stores and indexes. Do not bump the separate `kitchai-local` or `kitchai-sync` database versions for Phase 3 inventory changes.

- Preserve `ingredients`, `menuItems`, `recipes`, `recipeLines`, `operations`, `syncMetadata`, `metadata`, `migrationLedger`, and `conflicts`, including all existing rows and indexes.
- Add only the approved Phase 3 stores/indexes. Upgrade logic must tolerate already-present objects without replacing them.
- Seed a populated v2 database in tests with records in every current store, pending and acknowledged operations, sync metadata, conflict snapshots, migration ledger entries, and representative legacy-source data.
- Verify all records and compound keys survive, indexes remain queryable, new stores exist, the legacy migration still runs, and repeated app opens do not duplicate records or outbox operations.
- Test blocked/failed upgrade behavior where supported and verify the app does not report a successful inventory save after migration failure.
- Do not delete legacy stores or source rows as part of this upgrade.

### TG-6. Stable event identity, conflict preservation, and resolution

- Same event/operation ID means retry and must be idempotent.
- Different IDs are different business actions, even if payloads happen to match. Never deduplicate stock movements based only on equal fields.
- Preserve distinct conflicting stock events and their base/local/remote or equivalent snapshots for explicit review.
- Resolving a conflict must be an explicit, auditable new action; never “pick latest” silently. A stock-event conflict cannot be resolved by overwriting the event or editing a cached balance.
- A production aggregate that was remotely accepted but not locally acknowledged must be safely replayable by stable ID.
- Dependency ordering may schedule prerequisite records first, but cannot be treated as atomicity or conflict resolution.

### TG-7. Owner/business scope and time

- Validate every referenced ingredient, menu item, recipe, supplier, purchase, batch, lot, movement, disposition, and count against one local owner/business scope before commit and again at the trusted server boundary.
- Client-supplied owner IDs are local partition keys, never proof of authorization. Server identity derives from the authenticated session.
- Use the established ISO 8601 UTC convention for recorded timestamps. Keep immutable creation/recorded time separate from the event's effective time if backdating is allowed.
- Before daily summaries, expiry logic, or lot-selection rules depend on calendar dates, explicitly define the business timezone and business-day boundary. Device timezone alone must not silently decide business dates.
- Until that rule is approved, do not derive a business date from the device's current timezone or claim daily totals are authoritative.

### TG-8. Cost inputs are not valuation

Under selected D3-01, retain traceable purchase-price/currency/source inputs where available, but do not present official inventory valuation, COGS, or profit in Phase 3. Costing method, waste/yield variance treatment, and allocation of packaging, energy, and labor belong to a separate Phase 5 contract.

## 4. Proposed domain record boundaries (logical, not final schema)

These are logical concepts for contract review only; they are not a final table design.

- **Purchase / receipt:** purchase state, optional supplier reference, item and ordered quantity, unit, currency and unit price where available, actual receipt quantity, receipt timestamp, and explicit remaining quantity. Draft/cancelled purchases have no stock effect. Each receipt is an idempotent stock event; cancelling an unreceived remainder cannot reverse already received quantities.
- **Production batch:** stable batch ID, make-to-order/make-ahead mode, recipe/menu references where applicable, planned quantities, actual ingredient consumption, actual finished output, status, timestamps, and completion operation ID.
- **Stock movement:** immutable event ID, scope, stock item/lot identity, movement kind/direction, positive quantity and unit, source event reference, recorded/effective time, and reversal/correction linkage.
- **Finished lot:** stable lot ID tied to exactly one production output event, produced quantity, remaining quantity as a projection, and operator-reviewed suitability/disposition metadata. Lot status changes do not silently create quantity.
- **Disposition:** non-sale reduction categories (owner consumption, giveaway, waste/spoilage, correction) with quantity and explicit lot allocations; require reason for waste and stock corrections. Sale/discount is Phase 4.
- **Physical count:** expected projection, counted quantity, variance, reason, explicit confirmation, and linked correction event; never direct balance overwrite.

Exact required/optional fields, enumerations, ID relationships, and validation limits are not approved until this logical model is reconciled with the owner's selected policy and the precision/time gates.

## 5. WP3.1 acceptance and test plan

| Gate | Minimum test evidence | Pass condition |
|---|---|---|
| Contract consistency | Domain contract review against D3-01–D3-11 | Every selected policy has explicit data/validation/lifecycle semantics; no contradictory “open” status text remains. |
| Schema mapping | Versioned upgrade tests from populated `kitchai-business-data` v2 | All current records, keys, indexes, sync state, conflicts, and migration ledger preserved; new schema added without destructive replacement. |
| Local atomic production command | IndexedDB integration tests with transaction failures injected | Batch, movements, lots, allocations, and outbox all commit together or none commit. |
| Remote atomic production command | Local Supabase integration + pgTAP | Owner scope and stock preconditions enforced server-side; whole aggregate succeeds or fails atomically. |
| Idempotency | Same operation ID replayed before/after lost acknowledgement | One stock effect set only; response recoverable. |
| Competing writes | Distinct operation IDs from stale stock snapshots | No silent merge or negative stock; conflict/rejection preserved for explicit review. |
| Quantity arithmetic | Boundary/property tests for each allowed unit and chosen representation | No NaN/infinity/zero/negative posted movement, overflow, implicit conversion, silent rounding, or equality drift. |
| Lot allocation | Single- and multi-lot dispositions, mismatched sum, wrong lot scope, repeated carry-over | Allocation sum is exact; invalid allocation rejected; carry-over creates no duplicate stock. |
| Purchase receipt | Draft/cancel, partial receipt, duplicate receipt, cancel remainder | Only received quantities affect stock once; previously received quantities remain. |
| Physical count | Expected/count/variance, missing reason, cancellation/retry | Explicit confirmation and append-only correction; no direct balance mutation. |
| Scope and auth | Same-owner valid, cross-business references, other-owner IDs, expired session | Local and remote scope enforced; no operation dispatched under another owner. |
| Time | UTC persistence, backdated event, timezone boundary tests once rule chosen | Recorded/effective times remain distinct and summaries use only approved business-time rules. |
| Regression | Existing `npm test`, typecheck, build, local Supabase suites, baseline/app-shell/static preview | Existing Phase 1/2 behavior remains green; new Phase 3 tests are reported separately. |

## 6. Repository file touch map for future WPs

This is a planning map, not authorization to edit these files.

- `src/business-data-store.js`: versioned additive schema upgrade and transaction-compatible store access; preserve legacy migration behavior.
- New Phase 3 domain/store modules (names to be agreed in WP3.1): validate purchase/receipt, production batch, movement, lot, disposition, and count commands at domain boundaries.
- `src/phase2-sync-engine.js` and/or a deliberately shared transport abstraction: extend only after deciding whether aggregate inventory events can be supported without breaking Phase 2 retry/conflict invariants. Do not bolt inventory aggregate posting onto the four-entity mapping as if it were a normal single-row upsert.
- `src/supabase-api.js` or a separate inventory API module: call a trusted aggregate RPC/endpoint with stable idempotency ID; do not perform a series of client upserts for production completion.
- New versioned SQL migration(s) under the repository's existing Supabase migrations directory: inventory tables, constraints, RLS/privileges, owner-derived scope checks, idempotency records, and atomic RPC only after contract approval.
- New SQL/pgTAP tests and Playwright/local-Supabase integration scenarios: atomic posting, idempotency, scope rejection, conflict/recovery, and populated-v2 upgrade.
- `package.json`: ensure new modules are included in syntax/type/build checks where the current scripts enumerate modules explicitly.

The implementation AI must first discover the exact current paths and conventions; this map must not be treated as permission to invent files or bypass a review gate.

## 7. Readiness checklist

- [x] D3-01–D3-11 owner policy directions recorded in `docs/DECISIONS.md`.
- [x] Current local DB version, stores, migration behavior, existing entity stores, unit allowlist, sync mappings, and test commands inspected in source.
- [x] Recommended technical candidate and minimum evidence matrix documented.
- [ ] Owner accepts or amends TG-1 canonical ledger and movement representation.
- [ ] Owner accepts or amends TG-2 atomic aggregate command boundary.
- [ ] Owner accepts or amends TG-3 explicit lot allocation/no implicit FIFO.
- [ ] Quantity representation, ranges, precision, fractional `each`, and comparison semantics proposed with tests.
- [ ] Business timezone/effective-time policy defined where required by first-release behavior.
- [ ] Domain contract, WP3.1 acceptance criteria, repository map, and implementation prompt reconciled after the above gates.
- [ ] WP3.1 implementation prompt authorized; no implementation starts before this checklist is reconciled.

## 8. Change and evidence boundary

This document adds no application code, UI, IndexedDB schema, SQL, test files, hosted configuration, or production resources. No tests were executed as part of this review. Historical Phase 2 CI evidence remains Phase 2 evidence only.


## 7. Owner acceptance and execution boundary

The owner accepted T3-01–T3-08 on 2026-10-13. The selected contract is recorded in [DECISIONS.md](./DECISIONS.md) and [PHASE_3_DOMAIN_CONTRACT.md](./phases/PHASE_3_DOMAIN_CONTRACT.md). The next bounded step is [CODING_AI_PHASE3_WP3_1_IMPLEMENTATION_PROMPT.md](./CODING_AI_PHASE3_WP3_1_IMPLEMENTATION_PROMPT.md). If the current repository or existing Phase 2 values cannot satisfy a selected direction without data loss or a material behavior change, the Coding AI must stop, document the incompatibility and options, and request owner review. No hosted provisioning, billing, production secrets, or deployment is authorized.


## Current-state reconciliation — 2026-10-16

This document was written during the initial Phase 3 planning/repository-review period. Treat its initial recommendations, pending gates, and baseline commit references as historical unless they are confirmed by current code and tests. Inventory foundation, guarded recipe quantity adapter, atomic inventory commands, purchasing/receiving, production lifecycle/posting, finished-stock disposition, and stock counts have since been implemented in merged slices. See [`PHASE_3_CURRENT_STATUS.md`](../PHASE_3_CURRENT_STATUS.md) for current status and [`WP_REGISTRY.md`](../WP_REGISTRY.md) for implementation evidence. The current code, database migrations, current decisions, and latest test contracts take precedence over any outdated proposal here. Phase 3 is not declared complete; manual device/offline/accessibility/recovery acceptance remains deferred, and hosted provisioning/billing/secrets/production deployment are not authorized.
