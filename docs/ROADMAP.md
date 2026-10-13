# KitchAI Product Roadmap

**Status:** Proposed roadmap — planning baseline, not a blanket approval of every technical or commercial decision.  
**Repository:** `zinlinna071-lgtm/KitchAI`  
**Product direction:** Offline-first web application / PWA for kitchen and food-business operations, with a path toward a multi-business SaaS product.

## Product vision

KitchAI should help a food business manage its operational data reliably, work when connectivity is poor or unavailable, and introduce useful AI assistance only after the underlying workflows and data are dependable.

## Planning principles

- **Offline-first:** core data entry and access should remain useful without a network connection.
- **Local–cloud sync:** synchronize local changes with a cloud backend while protecting data from silent loss.
- **Security from the beginning:** authentication, business ownership, and server-side authorization are foundational to sync, even while the first release targets one owner and one business.
- **Conflict preservation:** detect conflicting edits and preserve enough information for review; do not silently overwrite one side.
- **Incremental delivery:** build and verify a small end-to-end vertical slice before expanding across all business data.
- **Architecture before commitment:** compare cloud, identity, database, and sync options against requirements, cost, security, offline support, and operational complexity before choosing.
- **Testable work:** each work package (WP) needs a clear purpose, dependencies, acceptance criteria, and appropriate tests.
- **No premature commercial commitments:** do not enable paid infrastructure or incur material costs without an explicit owner decision.

## Proposed eight phases

### Phase 1 — Application Foundation & Local–Cloud Sync

**Goal:** establish a usable offline-first PWA and prove a secure local-to-cloud round trip with one simple business record.

Proposed scope:
- document architecture, data ownership, threat assumptions, and key decisions;
- create the application shell and PWA foundation;
- establish local persistence, validation, and schema/version migration strategy;
- implement cloud identity/authentication and server-side business ownership/authorization foundations;
- implement sync state, retry/backoff, idempotency, and observable failure handling;
- detect and preserve conflicts for review rather than silently discarding data;
- deliver one end-to-end business-record vertical slice;
- test offline/online transitions, recovery, authorization boundaries, and data integrity.

Not in Phase 1:
- full account-management UI, team invitations, or elaborate profile management;
- syncing every future business entity;
- full menu, purchasing, sales, finance, or AI workflows;
- committing to a cloud vendor before an options comparison and owner decision.

**Exit criteria:** a documented and tested PWA can create/read/update the selected simple business record locally, remain usable offline, sync when connectivity returns, enforce authenticated ownership on the server, retry safely, and preserve conflicts for review. Automated checks and recovery/authorization tests pass. The selected backend and its costs are explicitly recorded.

### Phase 2 — Menu & Recipes

**Goal:** build menu items, recipes, ingredients, units, and recipe relationships on the Phase 1 data and sync foundation.

Potential scope includes recipe versioning, yield/portion calculations, ingredient quantities, and validation. Inventory consumption integration must be coordinated with Phase 3.

### Phase 3 — Purchasing, Inventory & Production

**Goal:** manage ingredient purchasing and stock, production batches (make-to-order and make-ahead), finished-product stock, auditable stock movements, and end-of-day leftover disposition.

The proposed plan is [docs/phases/PHASE_3_PLAN.md](./phases/PHASE_3_PLAN.md), with logical data and movement rules in [docs/phases/PHASE_3_DOMAIN_CONTRACT.md](./phases/PHASE_3_DOMAIN_CONTRACT.md). It covers suppliers and receiving, actual ingredient consumption and production yield, finished-product stock, carry-over where food is confirmed safe to keep, discounted-sale capture at a minimal inventory-disposition boundary, owner consumption, giveaways, waste/spoilage, physical-count reconciliation, and offline/sync conflict safety. Full order/payment lifecycle and sales-triggered automatic stock deduction remain Phase 4. Costing rules must be decided before inventory values are used in financial reports. This plan is proposed and does not authorize implementation until material decisions and scope are reviewed.

### Phase 4 — Sales & Orders

**Goal:** support the agreed sales/order workflow and connect completed transactions to relevant menu and inventory data.

Potential scope includes order lifecycle, line items, totals, cancellations/voids, and reliable operation under the agreed deployment conditions. Payment-provider integration is a separate decision if it becomes necessary.

### Phase 5 — Finance & Analytics

**Goal:** provide trustworthy operational and financial summaries from validated business data.

Potential scope includes sales summaries, expense records, margins/cost reports, date filters, and export. Reports must state their assumptions and avoid presenting estimates as audited accounting.

### Phase 6 — Basic AI MVP

**Goal:** deliver the first useful AI assistance on top of sufficiently reliable product data.

Define specific AI tasks, user controls, privacy boundaries, error handling, evaluation criteria, and cost limits before implementation. AI must not silently modify critical business records or claim certainty where the data is incomplete.

### Phase 7 — Advanced AI

**Goal:** expand AI capabilities after the basic AI workflows have been measured and validated.

Potential scope may include richer forecasting, recommendations, natural-language analytics, or assisted workflows. Each capability requires separate evaluation, permissions, privacy review, and owner approval.

### Phase 8 — SaaS Expansion & Hardening

**Goal:** prepare the product for multiple businesses and broader deployment.

Potential scope includes stronger tenant isolation, business onboarding and account-management UX, roles/permissions, operational monitoring, backups/restore procedures, performance, accessibility, localization, deployment automation, support processes, and production-readiness review.

## Cross-phase quality requirements

- Data validation and explicit ownership boundaries.
- No secrets or privileged credentials in client-side code.
- Automated tests for critical business rules, sync, authorization, and recovery.
- Accessible and understandable loading, offline, conflict, and error states.
- Migration and backup/restore strategy appropriate to the maturity of the product.
- Documented assumptions, limitations, and owner decisions.
- No claim that a phase is complete without evidence from tests or a recorded manual verification.

## Key risks to manage

| Risk | Planning response |
|---|---|
| Silent data loss during sync | Preserve local data, use idempotent operations, detect conflicts, test recovery. |
| Unauthorized cross-business access | Enforce authorization server-side and test negative cases. |
| Premature backend lock-in | Compare options before selecting and record the rationale. |
| Cloud cost surprises | Estimate usage, identify free-tier limits, and obtain owner approval before paid commitments. |
| Too much scope in the first release | Keep Phase 1 to the sync foundation and one end-to-end vertical slice. |
| AI built on unreliable data | Deliver AI only after the underlying data and workflows meet agreed quality thresholds. |

## Governance and working method

- This roadmap is a planning baseline; unresolved decisions remain open until explicitly recorded.
- Work is broken into WPs that are small enough to implement and verify independently.
- Before implementation, inspect the repository and document the relevant architecture/acceptance criteria.
- Implement one WP at a time; run the relevant tests and checks; review the diff; then commit.
- Keep status, decisions, and handoff notes in the repository so a different AI session can resume from evidence rather than assumptions.
- Avoid destructive operations and never expose secrets in commits, logs, or documentation.

## Immediate next step

Review the proposed Phase 3 plan and its open owner decisions in [docs/phases/PHASE_3_PLAN.md](./phases/PHASE_3_PLAN.md). Keep the work documentation-only until the owner has reviewed the scope and material decisions; then approve one bounded implementation WP at a time. Preserve all Phase 2 known limitations and do not authorize hosted provisioning, billing, secrets, or production deployment by implication.
