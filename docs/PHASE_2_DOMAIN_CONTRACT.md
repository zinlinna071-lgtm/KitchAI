# Phase 2 Domain Contract — WP2.1

**Status:** Proposed MVP contract; not application implementation or a hosted schema migration.
**Compatibility:** Preserve Phase 1 Business Profile, owner-scoped storage, outbox, retry/idempotency, conflict, and sign-out isolation behavior.

## 1. Repository constraints

The current app is a browser-first JavaScript PWA using IndexedDB and a transport-injected sync engine. Phase 1 has a local Business Profile model and owner-partitioned sync stores; client-supplied owner IDs are not authorization evidence. No menu, ingredient, or recipe implementation is assumed to exist until verified on the implementation branch.

This is a logical contract, not a mandate to copy these exact objects into IndexedDB or a remote database. WP2.1 must not add runtime behavior or alter Phase 1 schemas. Implementation WPs must inspect current DB versions, migration patterns, test fixtures, and sync payloads first.

## 2. Verified current implementation baseline

Repository review on `main` (2026-10-12) confirms:

- `src/local-store.js` uses IndexedDB database `kitchai-local`, schema version 1, with `profiles` and `metadata` stores. Its Business Profile name limit is 80 JavaScript string code units; it persists a local profile and revision metadata in one read-write transaction.
- `src/sync-store.js` uses a separate IndexedDB database `kitchai-sync`, schema version 2, with `profiles` keyed by `[ownerId, id]`, `operations` keyed by `operationId`, and `conflicts` keyed by `conflictId`. Owner and owner/record indexes support queue partitioning. Profile/outbox writes are atomic in this store.
- `src/sync-engine.js` is transport-injected and supports retry scheduling, auth pause, permanent failure, conflict preservation, and explicit keep-local/use-remote resolution. Keep its behavior and tests intact.
- `src/supabase-api.js` currently maps only the Business Profile contract to Supabase Auth/PostgREST/RPC.
- The current SQL migrations are `20261012000000_create_business_profiles.sql` and `20261012001000_business_profile_operation_idempotency.sql`. They establish one remote Business Profile per authenticated owner, RLS, server-controlled ownership/revision fields, and an idempotency ledger/RPC. There are no menu-item, ingredient, recipe, or recipe-line SQL tables yet.
- At the time of this baseline review, tracked production modules and tests contained no Phase 2 entity implementation; this was a historical pre-implementation observation. Current implementation status and test evidence are maintained in `docs/WP_REGISTRY.md` and `docs/STATUS.md`. The contract remains the logical source of truth for field, relationship, validation, and lifecycle rules.
- The existing Business Profile name limit and JavaScript string-length behavior are specific to Phase 1 and must not be silently copied to Phase 2 text fields. Where this contract specifies Unicode code points, implementations must count code points explicitly (for example, `[...value].length`) and test astral characters.
- The two IndexedDB databases have independent schema versions. Future migrations must target the database that owns each store, increment that database's version only, and include upgrade tests proving both Phase 1 stores and sync state survive.

This inspection verifies the current baseline; it does not validate hosted Supabase behavior or authorize a remote schema rollout.

## 3. Shared rules

- **Identity:** Each entity has an immutable, opaque, stable ID generated using the established app mechanism. Display names are not primary keys.
- **Ownership:** Every entity belongs to one business and authenticated owner. Client owner IDs are local partition keys only; trusted server code derives owner identity from the authenticated session.
- **Business scope:** Carry explicit business scope through entity relationships so records cannot cross partitions.
- **Timestamps:** Use ISO 8601 UTC strings consistent with current conventions. createdAt is immutable; updatedAt changes only after a valid persisted change.
- **Validation:** Validate at the domain boundary and trusted server boundary. Reject malformed data; do not silently coerce quantities, IDs, units, status, or ownership.
- **Persistence:** Report success only after the local transaction commits. A queued operation is not remote success.
- **Sync:** Reuse established operation IDs, base revisions, durable outbox, retry/idempotency, and conflict snapshots. Do not invent semantics that contradict Phase 1.
- **Deletion:** Archive/deactivate by default. Permanent deletion and synced tombstones are out of scope.
- **Conflicts:** Preserve base/local/remote snapshots for explicit resolution; no silent last-write-wins overwrite.
- **Migration:** Additive, versioned migrations only after current versions and upgrade patterns are inspected. Preserve Business Profile, outbox, and conflict records. Never silently erase user data on migration failure.
- **Privacy:** No customer, employee, health, or financial data is required. Do not log full payloads or secrets.

## 4. Logical entities

### 3.1 Menu item

Required: id, businessId, name, status, createdAt, updatedAt. Optional: description, recipeId.

- name is trimmed, non-empty, maximum 120 Unicode code points.
- status is active or archived.
- description is plain text, maximum 2,000 Unicode code points; an empty value normalizes to absent.
- Names are not unique identifiers. Duplicate warnings may be offered but records must not be auto-merged.
- No price, tax, modifier, sales availability, or inventory-consumption fields in the MVP.
- Archiving a menu item must not cascade-delete its recipe or ingredients.

### 3.2 Ingredient

Required: id, businessId, name, status, createdAt, updatedAt. Optional: description.

- Name is trimmed, non-empty, maximum 120 Unicode code points; description maximum 2,000.
- status is active or archived.
- Ingredient names are not globally unique; duplicate detection is advisory only.
- No supplier, stock quantity, purchase price, allergen, nutrition, or cost fields in this phase.
- Ingredients referenced by recipes should be archived, not hard-deleted.

### 3.3 Recipe

Required: id, businessId, menuItemId, name, status, createdAt, updatedAt. Optional: instructions, description, yieldPortions.

- status is draft, active, or archived.
- name is trimmed, non-empty, maximum 120 Unicode code points; description maximum 2,000; instructions maximum 10,000.
- yieldPortions must be finite and positive for an active recipe; a draft may omit it until completion.
- MVP supports at most one current recipe per menu item. Recipe version history must be designed explicitly if later needed.
- Draft recipes may be incomplete. An active recipe needs a positive yield and at least one valid ingredient line.
- Recipe and menu item must belong to the same business.
- Archiving a menu item does not automatically delete or archive its recipe.

### 3.4 Recipe ingredient line

Required: id, businessId, recipeId, ingredientId, quantity, unit, position, createdAt, updatedAt. Optional: note.

- quantity is a finite number greater than zero for a valid line.
- unit is an exact identifier from the initial allowlist below.
- position is an integer greater than or equal to zero; note is plain text up to 500 Unicode code points.
- Recipe and ingredient references must exist in the same business scope.
- Renaming an ingredient changes its displayed name, not the relationship.
- Reordering changes position only and must not replace or duplicate other lines.
- No automatic stock deduction, costing, nutrition calculation, or unit conversion.

## 5. Initial unit policy

Initial allowlist: mass = g, kg; volume = ml, l; count = each.

Preserve entered quantity and unit. This allowlist does not authorize conversions: do not convert kg to g, ml to l, or count to mass/volume until conversion rules, precision, rounding, and display behavior are separately specified and tested. Never assume ingredient density.

Quantities must be finite numbers. Do not use binary-float equality for business comparisons or round stored quantities merely for display. Display formatting must not alter stored values. Fractional count behavior remains an open decision if it becomes relevant.

## 6. Relationships and lifecycle

| Relationship/action | Contract |
|---|---|
| Menu item → recipe | Zero or one current recipe in MVP; recipeId and menuItemId must agree. |
| Recipe → ingredient lines | Zero or more while draft; at least one valid line for an active recipe. |
| Ingredient line → ingredient | Required; same business scope. |
| Archive menu item | Preserve recipe and ingredient records. |
| Archive ingredient | Preserve existing recipe lines; prevent new active recipes from using archived ingredients unless reactivated. |
| Archive recipe | Preserve lines for review; do not delete ingredients. |
| Permanent delete | Out of scope pending a deletion/tombstone policy. |

## 7. Validation baseline

- Text fields must be strings, trimmed as documented, and within length limits.
- IDs and business references must be present and validated against the active business partition.
- Quantities and yields must be finite and positive when required by status.
- Unit IDs must match the allowlist exactly; never infer a unit from a localized label.
- Reject unknown status values, invalid references, and cross-business references.
- Validation failures must be understandable and must not partially persist a multi-record edit.
- Duplicate submissions must not create duplicate logical writes when using the established operation/idempotency path.

## 8. Persistence, sync, and migration

- Persist a record and its local operation atomically where supported by the existing store architecture.
- Retry the same logical operation with the same stable operation/idempotency ID.
- Keep queues owner-partitioned; sign-out or identity changes must not process another owner's operations.
- Preserve base/local/remote snapshots for conflicts until explicit resolution.
- Label local-only paths accurately. Never display synced for an IndexedDB-only operation.
- Add new stores/indexes only after inspecting current DB versions and writing upgrade tests.
- Migration tests must prove existing Business Profile data, pending operations, and conflict snapshots survive upgrades.
- No hosted Supabase project, remote schema rollout, billing, production credentials, or deployment is authorized by WP2.1.

## 9. Decisions intentionally not made

- Advanced unit conversion, fractional count behavior, precision and rounding.
- Recipe revision history and concurrent recipe editing beyond current conflict preservation.
- Permanent deletion and synced tombstones.
- Costing, purchasing, stock movements, inventory consumption, taxes, and accounting.
- Multiple recipes per menu item, menu variants, and modifiers.
- Hosted test environment, costs, and production rollout.

## 10. WP2.1 acceptance evidence

WP2.1 may be marked complete when:
1. Current repository/schema/sync conventions have been inspected and this contract reconciled with them.
2. Fields, relationships, lifecycle, unit allowlist, validation limits, ownership, sync, and migration constraints are documented.
3. Material data-integrity, accounting, security, or compatibility decisions remain explicitly listed as open where unresolved.
4. No runtime implementation or schema migration has been smuggled into this planning WP.
5. Phase 1 tests remain the required regression gate for implementation WPs.

**This is a proposed MVP contract, not evidence that Phase 2 entities exist in the application.**
