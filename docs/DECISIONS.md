# Decision Log

This log distinguishes accepted planning constraints from proposals and unresolved owner decisions. Update it when a material decision is made; do not treat a draft recommendation as approval. The consolidated Phase 1 review is in [OWNER_REVIEW_BRIEF.md](./OWNER_REVIEW_BRIEF.md).

## Accepted planning constraints

| ID | Decision / constraint | Status |
|---|---|---|
| D-001 | Target an offline-first web application/PWA. | Accepted planning direction |
| D-002 | Phase 1 must establish local–cloud sync and deliver one working end-to-end vertical slice. | Accepted planning direction |
| D-003 | Initial business model is one owner and one business, while avoiding architecture that blocks later SaaS expansion. | Accepted planning direction |
| D-004 | Phase 1 includes the minimum identity, authentication, ownership, and authorization foundation required for secure sync. | Accepted planning direction |
| D-005 | Full user-facing account-management features are deferred beyond Phase 1. | Accepted planning direction |
| D-006 | Detect and preserve conflicting edits for review; do not silently discard a competing version. | Accepted planning direction |
| D-007 | Compare cloud/backend architecture options before choosing a provider. | Required process; comparison completed before the provisional selection below |
| D-008 | Do not incur material paid-service costs without explicit owner approval. | Required constraint |
| D-009 | The MVP direction is Core + Basic AI; AI implementation follows dependable core data/workflows. | Accepted planning direction |

## Owner-approved Phase 1 planning defaults

The owner instructed the team to proceed with the recommended defaults on 2026-10-12. These approvals select planning/implementation direction only; they do not authorize cloud provisioning, paid plans, billing activation, domain purchase, or production deployment.

| ID | Approved direction | Boundary / follow-up |
|---|---|---|
| O-001 | Select Supabase + PostgreSQL as the target provider architecture, with a KitchAI-owned explicit local-first sync layer. | No project provisioning, billing activation, secrets, or hosted provider tests are authorized by this selection alone. Use local/emulator-only work until the environment and cost boundary are separately approved. |
| O-002 | First vertical slice is a minimal Business Profile: stable UUID `id`, server-authoritative `ownerId`, stable `businessId`, required trimmed `name` (1–80 characters), immutable UTC `createdAt`, UTC `updatedAt`, and server-controlled monotonic `revision`. | Validate schema and ownership constraints in implementation review; do not let clients set authoritative owner or revision fields. |
| O-003 | Preserve base/local/remote snapshots for conflicts; require an explicit user choice between “Keep local” and “Use remote”. | Record the resolution; if the remote revision changes before resolution, reopen/re-evaluate the conflict rather than silently applying a stale choice. |
| O-004 | Partition local data and pending sync work by owner. On sign-out, stop sync and lock the local workspace; preserve unsynced data rather than silently deleting it. Never submit a prior owner's queue under a different session. | Browser storage is not guaranteed encrypted. Implement safe account switching and disclose the local-data limitation; do not claim encryption unless actually implemented and tested. |
| O-005 | Start with local/emulator testing, separate environments, HTTPS for any deployed environment, and synthetic non-production data. Define spend cap, region, domain, backup/export and deployment details before any hosted deployment. | No cloud provisioning, billing, domain purchase, or production deployment is approved yet. Local storage is not a backup. |

## Deferred decision

| ID | Decision needed | Status |
|---|---|---|
| O-006 | First AI feature/provider and cost limits | Deferred until Phase 6 planning. |

## Provider and authorization test gate

Before provider-specific authorization/security tests against a hosted project, the owner must explicitly approve the test environment and any cost/billing boundary. Until then, use local/emulator-only tests and do not provision hosted infrastructure. Required evidence: (1) provider/plan/region and cost approval or a no-billing local emulator boundary; (2) isolated non-production environment with synthetic data and secret handling; (3) reviewed schema and server-side ownership policies, including privileged server SDK paths; (4) separate test owners/business scopes and documented unauthenticated, allowed-owner, cross-owner read/write, and delete-denial cases; (5) reproducible test instructions and reviewable results. The fake-owner spike test is simulation only, not provider authorization evidence.

## Phase 3 owner selections — 2026-10-13

The owner explicitly instructed us to use the recommended/default choices presented in the decision checklist. The following directions are therefore recorded as **Selected**. This resolves the business-policy direction only; it does not authorize implementation by itself. Cross-cutting technical gates in the repository review remain mandatory.

| ID | Owner-selected direction | Rationale / boundary | Status |
|---|---|---|---|
| D3-01 | Defer official inventory valuation, COGS, and profit to Phase 5; retain traceable purchase-cost inputs in Phase 3. | Avoid presenting incomplete costing as authoritative financial reporting. | Selected |
| D3-02 | Preserve quantity precision in a documented safe representation; reject invalid quantities; never silently round or convert. | Exact numeric type/ranges, per-unit precision, and fractional `each` behavior still require a tested technical proposal before implementation. | Selected — technical limits gated |
| D3-03 | Block production completion when ingredient stock is insufficient; do not permit negative stock or override in the first release. | Correct stock or record a receipt/count correction before completing production. | Selected |
| D3-04 | Allow partial receiving; only actually received quantities affect stock; keep the unreceived remainder explicit until received or cancelled. | A cancellation of the remainder must not reverse quantities already received. | Selected |
| D3-05 | Record actual ingredient use and actual output, and compare them with the recipe baseline. | Unknown quantities must be labeled estimated/theoretical; never represent them as measured actuals. | Selected |
| D3-06 | Require operator confirmation that a finished lot is suitable for carry-over; do not infer food safety from age alone. | Configurable expiry warnings/rules remain a separately reviewed enhancement. | Selected |
| D3-07 | Defer all sale capture, including discounted sales, to Phase 4. | Phase 3 tracks non-sale stock dispositions only; it must not create a temporary sales ledger or infer revenue. | Selected |
| D3-08 | Keep owner consumption, giveaway, waste/spoilage, and corrections as distinct categories; require reasons for waste and stock corrections. | Owner consumption and giveaway are not sales revenue. | Selected |
| D3-09 | Physical counts show expected/count/variance, require reason and explicit confirmation, and post an append-only linked correction event. | Never overwrite posted stock balances or rewrite historical movements. | Selected |
| D3-10 | Keep supplier optional; capture actual received quantity/unit, unit price/currency, and receipt timestamp; defer tax/shipping allocation. | Do not claim landed cost or official valuation when those inputs are absent. | Selected |
| D3-11 | Use stable event IDs; retries of the same ID are idempotent; preserve distinct conflicting events for explicit review and never auto-merge stock changes. | Exact conflict-resolution UI and remote atomic command remain technical gates. | Selected |

**Still blocked independently of these selections:** canonical stock source-of-truth, movement direction/sign and reversal semantics, atomic local and remote production posting, explicit lot allocation, populated-v2 migration safety, owner/business-scope enforcement, timestamp/timezone semantics, and repository-to-code/test mapping must be reconciled before a WP3.1 implementation prompt. No hosted provisioning, billing, secrets, deployment, or application code is authorized by these selections alone.

Full scope and acceptance criteria: [PHASE_3_PLAN.md](./phases/PHASE_3_PLAN.md).

## Decision process

1. Record constraints and compare realistic options using explicit criteria.
2. Distinguish reversible implementation choices from material product/security/cost choices.
3. Make recommendations with trade-offs and record the owner's selected direction.
4. Implement one work package at a time, verify tests and diffs, and update status/registry with evidence.
