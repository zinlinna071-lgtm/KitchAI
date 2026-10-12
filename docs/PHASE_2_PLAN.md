# Phase 2 Plan — Menu & Recipes

**Status:** Planning proposal; implementation is not authorized by this document alone.  
**Phase goal:** Deliver a dependable offline-first menu and recipe workflow on the existing Phase 1 local persistence, ownership, and sync foundation.  
**Phase boundary:** No Phase 3 purchasing/inventory integration, hosted provisioning, paid services, production deployment, or AI features.

## 1. Entry conditions and Phase 1 boundary

Phase 1 local-only WP1.7 closure is recorded in the registry and STATUS after PR #23. Owner-approved manual-only checks remain deferred, not passed. Phase 1 CI evidence is local/emulated; it does not prove hosted authentication or remote sync. Phase 2 work must not silently expand that claim.

Before implementation, the Coding AI must inspect the actual `main` branch, package scripts, app architecture, existing data stores, sync contracts, migration conventions, tests, and documentation. Reuse established patterns where safe; do not replace the sync engine or make broad architecture changes without a documented reason.

## 2. Proposed scope

Phase 2 creates a menu item and its recipe structure, persists and validates them locally, and integrates with the existing sync abstraction only where the existing foundation supports it. The initial release should support one owner and one business, with ownership boundaries carried through every read/write and queued operation.

In scope:
- Menu item lifecycle: create, view/list, edit, archive or deactivate (not destructive delete by default).
- Recipe associated with a menu item; recipe ingredients refer to ingredient records.
- Ingredient catalog with a canonical display name and a deliberately small initial unit model.
- Ingredient quantities and recipe yield/portion count with explicit validation.
- Local-first persistence, schema/version migration, offline states, durable outbox, retries, idempotency, and conflict preservation through existing Phase 1 mechanisms.
- Clear validation/error/empty/loading/offline/conflict states and accessible form controls.
- Unit tests and browser/integration tests for critical business rules and persistence.
- Documented data model, unit policy, assumptions, and deferred work.

Not in scope:
- Purchasing, suppliers, receiving, stock balances, inventory consumption, stock movement history, or automatic ingredient deduction (Phase 3).
- Sales/order workflows, pricing strategy, cost/margin accounting, finance reports.
- Nutrition/health claims, recipe recommendations, generative AI, image recognition.
- Multi-business/team roles, invitations, subscription/billing, hosted production provisioning.
- Full recipe import/export, barcode scanning, advanced unit conversion, yield scaling beyond simple deterministic arithmetic unless explicitly approved in a later WP.
- Destructive permanent deletion of synced records without a separately reviewed deletion/tombstone policy.

## 3. Work packages

### WP2.1 — Domain rules and data contract

**Priority:** Blocking  
**Dependencies:** Phase 1 local-only foundation; inspect current repository first.  
**Deliverables:** A focused domain contract covering menu items, ingredients, recipes, recipe-ingredient lines, identifiers, ownership/business partitioning, lifecycle, validation, unit policy, and sync metadata. Include migration and compatibility expectations.

Acceptance:
- Every entity has stable identifiers and explicit owner/business partitioning consistent with the current app.
- Required/optional fields, normalization, validation limits, and lifecycle states are documented.
- Recipe-to-menu-item and recipe-to-ingredient relationships are unambiguous.
- Unit behavior is explicit; unsupported conversions are rejected rather than guessed.
- Schema changes have versioned migration and recovery/rollback expectations appropriate to the existing architecture.
- Decisions that materially affect accounting, inventory, or future compatibility are recorded as open decisions, not silently assumed.

Tests/evidence:
- Contract examples and invalid-input cases are documented.
- Existing Phase 1 tests still pass; no implementation until the contract and any material owner decisions are recorded.

Non-goals: inventory deduction, costing, accounting semantics, hosted schema changes.

### WP2.2 — Ingredient catalog and validation

**Priority:** High  
**Dependencies:** WP2.1  
**Deliverables:** Local-first ingredient create/list/edit workflow, validation, ownership isolation, empty/loading/error states.

Acceptance:
- Create, read, and update ingredient records without duplicate accidental submissions.
- Normalize whitespace and validate required names using existing project conventions.
- Prevent one owner/business partition from reading or mutating another partition's records.
- Persist through reload and remain usable offline according to existing app capabilities.
- Invalid and failed storage writes are visible and do not discard existing data.
- Do not imply remote sync completed when an operation is only queued locally.

Tests/evidence:
- Unit tests for normalization, required fields, identifiers, and invalid input.
- Browser tests for create/edit/reload/offline states and owner partitioning.
- Storage failure and duplicate-submit regression tests where supported by existing test harness.

Non-goals: suppliers, stock quantities, purchase prices, nutrition data.

### WP2.3 — Menu item workflow

**Priority:** High  
**Dependencies:** WP2.1, WP2.2  
**Deliverables:** Local-first menu item create/list/detail/edit/archive workflow, validation, ownership isolation, empty/loading/error states. Recipe association is intentionally deferred to WP2.4 so menu items exist before recipes reference them.

Acceptance:
- Users can create, inspect, and edit menu items with validated names and documented status/lifecycle.
- Menu items are scoped to the active owner/business partition and persist through reload while offline.
- Duplicate submissions do not create duplicate logical records; invalid and failed storage writes do not report success.
- Archiving/deactivation preserves all records and does not perform destructive deletion.
- Price, tax, modifiers, sales availability, inventory consumption, and recipe association are not introduced in this WP.
- Keyboard interaction, labels, focus, status messages, narrow viewport, and zoom behavior receive automated coverage consistent with current tests.
- Existing Phase 1 Business Profile and sync flows continue to pass.

Tests/evidence:
- Unit tests for normalization, required fields, IDs, and invalid input.
- Browser tests for create/edit/reload/archive/reactivate, validation, partition isolation, and narrow viewport.
- Regression suite for Phase 1.
- No claim of manually tested screen-reader/device acceptance unless performed and recorded.

Non-goals: sales availability, prices, modifiers, categories/tags, recipe association, order entry.

### WP2.4 — Recipe and recipe-ingredient domain

**Priority:** High  
**Dependencies:** WP2.1, WP2.2, WP2.3  
**Deliverables:** Recipe data and ingredient lines associated with an existing menu item; deterministic quantity/yield calculations and validation.

Acceptance:
- A recipe can contain zero or more ingredient lines during draft editing, but a recipe cannot be marked complete/usable if required fields are invalid.
- Each recipe references an existing menu item and each ingredient line references an existing ingredient in the same owner/business partition.
- Quantity must be finite and greater than zero when a line is saved as valid; units must be supported by WP2.1.
- Yield/portion count must be finite and greater than zero where required.
- Editing recipe lines preserves unrelated lines and records changes through the existing local-first operation model.
- No hidden unit conversion or rounding that changes quantities without an explicit rule.
- Invalid references, cross-owner IDs, and malformed quantities are rejected.

Tests/evidence:
- Unit tests for quantity/yield validation, relationship integrity, and any approved arithmetic.
- Persistence/reload and malformed/cross-partition input tests.
- Migration tests for newly introduced recipe entities.

Non-goals: deducting inventory, calculating food cost, nutrition estimates, or scaling across incompatible units.

### WP2.5 — Local-first sync and conflict integration

**Priority:** Blocking for synced data; depends on WP2.2–WP2.4 and verified Phase 1 mechanisms.  
**Deliverables:** Integrate new entities into existing outbox/transport contracts without weakening the Phase 1 guarantees.

Acceptance:
- All operations are partitioned by the active owner/business; sign-out or identity change cannot process another owner's queue.
- Stable operation IDs and idempotent retry behavior prevent duplicate logical writes.
- Remote revision conflicts preserve base/local/remote snapshots and require explicit resolution using the existing contract.
- Pending operations and conflict details survive reload.
- Offline edits are clearly marked pending; failures are visible and recoverable.
- Schema/migration failures do not silently erase existing Phase 1 data.
- If current transport cannot safely sync new entity types, keep the affected workflow local-only and explicitly label it; do not fake success or broaden Phase 1 claims.
- Automated tests exercise create/update/retry/lost acknowledgement/conflict/reload/owner isolation for at least the supported synced entity paths.

Non-goals: hosted provider project setup, billing, production credentials, deployment, or claiming cross-device sync from local/emulated tests.

### WP2.6 — Integration, regression, and Phase 2 exit evidence

**Priority:** Blocking for Phase exit  
**Dependencies:** WP2.1–WP2.5  
**Deliverables:** End-to-end tests, known-limitations record, updated status/registry, and release/phase-exit recommendation.

Acceptance:
- CI baseline, app-shell, and applicable local integration workflows pass on the candidate commit.
- Critical business rules, owner isolation, persistence, migration, retry/idempotency, conflict preservation, sign-out queue isolation, and storage failure paths have automated evidence.
- No unresolved critical security or data-loss issue is known.
- Deferred manual-only checks remain explicitly deferred rather than marked passed; revisit device/accessibility/recovery acceptance before broader release readiness.
- Documentation distinguishes local/emulated verification from hosted-provider and production verification.
- Phase 3 remains blocked until Phase 2 exit evidence and unresolved cross-phase decisions are recorded.

## 4. Cross-WP engineering rules

1. Inspect the actual repository and relevant existing code before changing files; do not assume this plan describes current implementation details.
2. Make one bounded WP change at a time. Update tests and docs in the same change where practical.
3. Preserve Phase 1 behavior and run the relevant regression suite after each WP.
4. No secrets, service-role keys, privileged credentials, or personal/customer data in the client, repository, test fixtures, or logs.
5. Do not provision hosted infrastructure, enable billing, deploy production, or run destructive experiments without explicit owner authorization.
6. Never report a test as passed unless it ran and its result is available. Label skipped/deferred tests precisely.
7. Do not silently decide consequential unit conversions, deletion semantics, costing/accounting behavior, or inventory interactions. Record these as decisions for review.
8. Keep PRs reviewable; the owner merges PRs manually. Coding AI must not merge PRs or close unrelated work items.

## 5. Risks and open decisions

- **Unit policy:** Which units are supported initially, and which conversions (if any) are permitted? Default proposal: store quantity plus explicit unit; allow only exact same-unit operations until a conversion table is approved.
- **Recipe yield:** Define yield as a positive numeric portion count for MVP; defer mass/volume yield and advanced scaling unless approved.
- **Lifecycle/deletion:** Default to archive/deactivate. Permanent deletion and synced tombstones need separate policy.
- **Menu fields:** Start with name, optional description, lifecycle/status, and recipe link; price, modifiers, categories, and tax semantics remain out of scope pending a later decision.
- **Ingredient identity:** Avoid assuming names are globally unique; duplicate detection may warn but should not merge records automatically.
- **Sync expansion:** New entities must follow existing proven ownership/idempotency/conflict rules. Do not claim remote sync unless the actual transport path is exercised.
- **Migration compatibility:** Entity changes must not break existing Business Profile data or its tests.

These are planning defaults, not approval to add unrelated features. The Coding AI should stop and report if a decision materially changes data integrity, security, cost, or scope.

## 6. Suggested implementation order

WP2.1 → WP2.2 → WP2.3 → WP2.4 → WP2.5 → WP2.6.

WP2.5 may be split into smaller implementation WPs if the existing sync contract requires a substantial adapter or entity-specific migration; document the split before implementation rather than hiding a large change inside a feature WP.

## 7. Coding AI handoff prompt

You are implementing KitchAI Phase 2 — Menu & Recipes. First read `docs/ROADMAP.md`, `docs/STATUS.md`, `docs/WP_REGISTRY.md`, `docs/PHASE_1_PLAN.md`, `docs/LOCAL_SYNC_CONTRACT.md`, `docs/DECISIONS.md`, this plan, and the actual source/config/tests on the current base branch. Treat repository evidence as authoritative over assumptions in a prompt.

Implement only the single WP explicitly assigned by the owner. Before coding, summarize the relevant existing architecture, the bounded change, dependencies, and acceptance tests. Do not start a dependent WP before its prerequisite evidence exists. Keep the change small, run relevant tests and regression checks, inspect the final diff, update evidence/status documentation, and open a PR for owner review. Do not merge the PR.

Do not provision hosted services, enable billing, add production secrets, deploy production, or claim production/cross-device sync. Preserve owner isolation, durable local data, retry/idempotency, conflict snapshots, sign-out queue isolation, and accurate sync status. Do not mark deferred manual tests as passed. Stop and report before making a consequential choice about units/conversions, deletion/tombstones, costing/accounting, inventory deduction, security boundaries, or paid infrastructure.

## 8. Phase 2 exit summary

Phase 2 is complete only when WP2.1–WP2.6 have explicit evidence, required CI is green, critical data-integrity and authorization tests pass, known limitations and deferred checks are recorded, and no unresolved critical security/data-loss issue is known. Planning completion alone does not mean implementation completion.
