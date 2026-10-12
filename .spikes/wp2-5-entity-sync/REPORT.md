# WP2.5a — Entity Storage and Outbox Architecture Spike

**Status:** Prototype and browser regression passed on PR head. Baseline [run 38238622571](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38238622571) and app-shell/browser [run 38238622636](https://github.com/zinlinna071-lgtm/KitchAI/actions/runs/38238622636) passed. This report is not a production migration and does not change application runtime behavior.

## Verified baseline

- `kitchai-ingredients` v1 contains `ingredients`.
- `kitchai-menu` v1 contains `menuItems`.
- `kitchai-recipes` v1 contains `recipes` and `recipeLines`.
- Each entity record is keyed by `[ownerId, businessId, id]`; recipes and lines use references by stable IDs.
- Phase 1's `kitchai-sync` v2 database separately stores profiles, operations, and conflicts. Its current acknowledgement/conflict paths update the Business Profile store, and `src/supabase-api.js` currently sends only Business Profile operations.
- IndexedDB transactions cannot span independent databases. A Phase 2 entity write and an operation stored in `kitchai-sync` therefore cannot be committed atomically.

## Options

| Option | Benefits | Risks / assessment |
|---|---|---|
| Per-entity database with its own outbox | Entity and outbox can commit atomically in that database; minimal initial moves | Three separate queues, repeated migration/lifecycle logic, and harder ordering between menu items, recipes, and ingredient lines |
| Shared versioned Phase 2 business-data database with entity stores and an entity outbox | Atomic entity/outbox transaction, relationship-aware validation, one queue lifecycle, and simpler dependency ordering | Requires safe migration from the three current databases; source writers must be paused during migration and source data retained until verification |
| Best-effort write to entity DB and existing `kitchai-sync` outbox | Superficially reuses current queue | **Reject as default:** a crash between independent transactions can leave an entity without a durable operation or an orphan operation; Phase 1 acknowledgements/conflicts are profile-specific |

## Recommendation

Prefer a dedicated, versioned `kitchai-business-data` database containing `ingredients`, `menuItems`, `recipes`, `recipeLines`, `operations`, and `metadata`. Keep the Phase 1 `kitchai-sync` database and profile transport unchanged. The Phase 2 entity outbox can reuse Phase 1's *behavioral invariants*—stable operation IDs, server-authoritative ownership, idempotent retry, revision checks, conflict snapshots, auth pause, and sign-out isolation—without coupling entity acknowledgement to the profile store.

This is a recommendation for implementation review, not an already-applied migration. Do not silently replace or clear any existing database. The production migration must be additive and idempotent, map old local partitions to stable Business Profile IDs, preserve stable entity IDs/timestamps/relationships, and record a durable completion marker and per-record source/target snapshots in the target transaction. On subsequent loads, legacy-only changes are reconciled if the target is unchanged; divergent concurrent changes abort and preserve both copies. Source databases are never deleted.

## Disposable prototype

`.spikes/wp2-5-entity-sync/migration-prototype.js` is deliberately outside the production app. It copies source records into a disposable target database named `kitchai-business-data-spike`, using the current source store names and compound keys. It never deletes source records.

The browser regression test seeds disposable source databases, injects an interruption after two writes, asserts that the target transaction rolls back without a partial copy or checkpoint, reruns migration, checks all four entity stores and relationships, verifies source data remains, and calls migration a second time to confirm the completion marker makes it idempotent. These assertions passed in the linked PR-head CI runs.

## Limitations / exit gate

- The prototype uses disposable test data and does not migrate a user's real browser data.
- The prototype does not implement the production outbox, dispatch, remote schema, RLS, retry, or conflict resolution.
- No SQL migration, hosted project, credentials, billing, or deployment was changed.
- WP2.5a's disposable migration proof is complete. The recommended architecture should be carried into WP2.5b with a versioned additive migration and no source deletion; this spike does not authorize a production data migration or any hosted work. WP2.5b must then implement the selected migration and atomic outbox in bounded steps with explicit rollback evidence.
