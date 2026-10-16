# KitchAI Production DOM and Workflow Inventory

Status: read-only inventory completed against `main` after UI preview PR #67 merged. This document does not change production runtime behavior.

## Inventory rules

- `index.html` remains the production DOM contract for `src/app.js` and its imported workflow modules.
- Keep all existing form/control IDs and their containing elements present while moving the visual navigation around them.
- A section can be visually inactive without deleting its DOM. Do not clone forms or create a second copy of an existing ID.
- A destination listed as “not present” must remain an honest placeholder until real workflows and tests are added.

## Existing production sections mapped to Manage Mode

| Manage Mode destination | Existing DOM/workflow | Current implementation evidence | Integration treatment |
|---|---|---|---|
| Overview | Existing welcome/readiness status cards | Welcome section, `.status-grid`, local profile/sync readiness messages | Replace dashboard presentation only when real record-backed summaries exist; otherwise show neutral readiness and no invented totals. |
| Settings → Business Profile | Local business profile editor | `#profile-form`, `#business-name`, `#profile-state`; handlers in `src/app.js` | Preserve form and IDs; expose as the profile settings/workspace screen. |
| Settings → Security / Data & Sync | Authentication and account-scoped sync/conflict UI | `#auth-panel`, `#auth-form`, `#sign-in-button`, `#sign-up-button`, `#sign-out-button`, `#conflict-panel`, `#entity-sync-panel`, `#phase2-sync-now`, `#phase2-conflict-list` | Keep hosted configuration caveats visible. Do not imply hosted auth/sync is configured when runtime endpoints are absent. |
| Business → Ingredients & Stock | Ingredient catalog | `#ingredient-panel`, `#ingredient-form`, `#ingredient-list`; add/edit/cancel and status controls | Existing ingredient workflow. Preserve IDs and behavior. Stock counts are a separate workflow below. |
| Business → Purchases | Purchase draft and receipt workflow | `#purchase-panel`, `#purchase-create-form`, `#purchase-line-entry-list`, `#purchase-add-line`, `#purchase-list`, `#purchase-refresh`; `initializePurchaseUI()` from `src/purchase-ui.js` | Existing workflow. Do not describe a saved draft as posted stock; receipt posting has its own acceptance constraints. |
| Business → Menu & Recipes | Menu items, recipes, recipe lines | `#menu-panel` / `#menu-item-form`; `#recipe-panel` / `#recipe-form` / `#recipe-line-form` and associated lists/state controls | Existing catalog/recipe workflows. Preserve all IDs and active-business scoping. |
| Business → Production | Start, record actual usage, prepare, cancel, post production batches | `#production-panel`, `#production-start-form`, production status/list controls; production store/domain imports in `src/app.js` | Existing production lifecycle. Do not replace with a mock production form or imply planning quantities are actual usage. |
| Business → Finished Food | Finished lots, dispositions, carry-forward decisions, history | `#finished-stock-panel`, `#finished-disposition-form`, `#carry-forward-form`, finished-stock list/history controls | Existing workflow. Preserve distinct sale/discount, personal consumption, waste, giveaway, and safe carry-forward outcomes. Personal use/giveaway must not become sales revenue. |
| Business → Ingredients & Stock (subscreen: Stock Count) | Physical count and count lines | `#stock-count-panel`, `#stock-count-create-form`, `#stock-count-add-line-form`; `initializeStockCountUI()` from `src/stock-count-ui.js` | Existing workflow. Keep it separate from purchase receiving and production posting. |
| Business → Sales | No dedicated sales-entry section identified in current `index.html` inventory | No standalone sales form/workflow mounted in the current production DOM inventory | Coming Soon until an implemented, tested sales workflow exists. Do not use a mock form that writes fake revenue. |
| Business → Business Expenses | No dedicated business-expense form identified | No standalone business-expense workflow in the current production DOM inventory | Coming Soon. Keep expense entries distinct from ingredient purchases and asset purchases. |
| Business → Day Closing | No dedicated day-closing workflow identified | Finished-stock history exists, but that is not equivalent to a complete day-close reconciliation | Coming Soon until sales, expenses, cash reconciliation, and unsold-food dispositions can be reconciled from real records. |
| Personal → Overview / Income / Expenses / Accounts / Assets & Debts | No personal-finance workflow identified | No personal finance forms/stores mounted in the current production DOM inventory | Coming Soon. Keep Personal data separate from Business records when implemented. |
| Reports | No report workspace identified | No report-specific production section/workflow identified | Coming Soon; future figures must be computed from actual records and documented definitions. |
| Settings → General / Appearance / Language / AI Preferences / About KitchAI | No corresponding production settings workspace identified | Existing production stylesheet/app does not expose the new settings pages as a dedicated UI in this inventory | Introduce only as a separate UI layer with working controls or clearly labeled placeholders. Do not assume preview-only settings are production functionality. |
| AI Mode / chat | No production AI chat workflow identified | Standalone `ui-preview.html` and `src/ui-preview.js` are separate and explicitly label chat as preview-only | Initial production AI screen may show a disconnected state, but must not send prompts or claim AI responses until a real service is deliberately integrated. |

## Initialization and event-binding facts

- `src/app.js` is loaded as an ES module by production `index.html`.
- The main module queries current IDs and attaches handlers to existing profile, ingredient, menu, recipe, production, and finished-disposition forms.
- Purchasing and stock-count behavior are initialized through `initializePurchaseUI(...)` and `initializeStockCountUI(...)` from separate modules.
- The current app imports existing local profile, business-data, sync, ingredient, menu, recipe, production-batch, and finished-stock stores/workflows. UI migration must call into those existing workflows rather than create duplicate controllers.
- The production shell also contains account/auth, sync-state, conflict-review, install-button, and online/offline connection-status controls. They must not disappear merely because they are not primary navigation items.

## Smallest safe UI-I2 patch

1. Add a production-only shell/navigation layer that starts in AI Mode and offers AI Mode / Manage Mode switching, drawer navigation, responsive layout, and light/dark theme behavior.
2. Keep every existing workflow element in the DOM exactly once, with its IDs intact; move/reparent only when needed and verify the selectors still resolve.
3. Prefer adding a thin UI controller that toggles visibility and active navigation state over rewriting the business workflows.
4. Initially expose only implemented workflows under Manage Mode. Use honest Coming Soon pages for Sales, Business Expenses, Day Closing, Personal finance, Reports, and any settings not yet backed by real controls.
5. Do not load `src/ui-preview.js` in production. It has a separate navigation/render lifecycle and is not a production adapter.
6. Add checks proving critical selectors exist exactly once and that the production app still builds/tests. Then deploy to a separate preview URL for review before any production release.

## UI-I1 exit status

- [x] Inventory existing production sections and workflow form IDs.
- [x] Identify workflows initialized from separate modules.
- [x] Map implemented vs missing destinations.
- [x] Define the smallest safe UI-I2 patch.
- [ ] User review of the standalone UI preview remains a gate before production integration/release.
