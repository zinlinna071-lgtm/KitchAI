# KitchAI UI Integration Safety Plan

Status: proposed implementation sequence; the standalone UI preview remains separate.

## Purpose

Bring the approved AI-first / Manage Mode experience into the existing KitchAI app without replacing its working local-first data, production, inventory, purchase, finished-stock, and sync workflows.

## Verified repository facts

- `index.html` is the production app shell and loads `src/app.js` as an ES module.
- `src/app.js` wires many existing workflows by querying specific DOM IDs and attaching handlers to those elements. Examples include business profile/auth, ingredient and menu catalogs, purchases, production batches, finished-stock disposition, and stock counts.
- `ui-preview.html` loads the separate `src/ui-preview.js` and `src/ui-preview.css`. The preview has its own hash navigation and explicitly says that AI and business data are not live.
- `scripts/build.mjs` currently builds both the production shell and the standalone preview. The preview is an additional route, not the production UI.
- Therefore, copying the preview HTML into `index.html` or loading both JavaScript entry points together is unsafe: existing selectors and event handlers depend on the current production DOM, while the preview has its own navigation/render lifecycle.

## Guardrails

1. Keep the existing production `index.html`, `src/app.js`, stores, domain modules, IndexedDB/local storage, service worker, and sync behavior intact until a reviewed migration step explicitly updates them.
2. Do not load `src/ui-preview.js` alongside `src/app.js` in production. It is a separate preview controller, not an adapter for existing business workflows.
3. Never display sample metrics as real business data. Empty states must remain honest; unsupported workflows must be marked as coming soon or unavailable.
4. Do not claim hosted authentication, hosted cross-device sync, backup/restore, or production readiness based only on local tests.
5. Each UI migration change must preserve existing element IDs or deliberately update and test every corresponding JavaScript binding.
6. Keep changes reviewable in small PRs and preserve a rollback path.

## Recommended implementation sequence

### UI-I1 — DOM and workflow inventory (read-only) — complete
- Completed in [UI_INTEGRATION_DOM_INVENTORY.md](./UI_INTEGRATION_DOM_INVENTORY.md): production sections, important IDs, initialization functions, and existing workflows are mapped to Manage Mode destinations.
- Identified current workflows versus destinations with no production workflow yet; missing Sales, Business Expenses, Day Closing, Personal finance, and Reports remain honest Coming Soon placeholders.
- No production behavior changes were made.

### UI-I2 — Shell foundation
- Add the minimal AI Mode / Manage Mode shell to the production app through a dedicated module or small isolated changes.
- Keep all existing workflow DOM elements present and addressable by their current IDs.
- Do not add the preview controller to production.
- Make mode switching and responsive drawer navigation work without changing business records.

### UI-I3 — Manage Mode workflow mounting
- Expose existing working profile, ingredient, menu/recipe, purchase, production, finished-food, and stock-count workflows through their new navigation destinations.
- Ensure only the intended workflow is visually active; hidden forms must remain initialized and their existing event handlers must continue to work.
- Mark sales, reports, personal finance, and any other not-yet-implemented workflows as coming soon until real behavior and tests exist.

### UI-I4 — AI Mode
- Initially deliver the AI-first landing/chat interface as a clearly labeled disconnected state.
- Only connect an actual AI service in a separate scoped change with secure configuration, explicit action-confirmation rules, cost controls, and tests. Never imply a prompt was sent if it was not.

### UI-I5 — Verification and release gate
- Run repository checks, unit/integration/browser tests, static production build, and Pages preview build.
- Test create/edit/refresh, offline/refresh, and existing purchase/production/stock/disposition flows.
- Check 360px mobile layout, keyboard focus, theme/language controls, and browser console errors.
- Deploy to a separate preview first. Production integration is complete only after review and successful checks.

## Acceptance criteria

- Existing records remain readable and editable after UI navigation changes.
- No duplicate workflow controller or conflicting hash/navigation handler is introduced.
- Offline behavior and current data persistence tests remain passing.
- All displayed totals are computed from real saved records or shown as unavailable.
- Unimplemented screens are clearly labeled.
- The preview and production app remain separate until the migration passes its review gate.

## Immediate next task

UI-I1 is complete. Next is to prepare the smallest UI-I2 shell patch on a separate branch: preserve the existing production DOM and all IDs, add mode/drawer navigation without loading the preview controller, and verify selectors/build/tests. The standalone UI preview review gate still applies before production integration or release. Do not replace the production shell as a one-shot rewrite.
