# KitchAI Approved UI Design and Versioning

## Current approved baseline

- **UI version:** `1.0.0`
- **Status:** Approved design baseline
- **Reference preview:** https://kitchai-ui-preview.vercel.app/ui-preview.html#ai
- **Rule:** This approved design is the source of truth for all future UI integration and incremental improvements.

The version identifies the UI design baseline, not the completeness of every app feature. Existing or future business features may be connected behind this UI without inventing a separate competing design.

## Non-negotiable design rule

Do not create a different UI shell, visual concept, or alternative production design unless the user explicitly asks for a redesign. Preserve the approved layout, visual language, spacing, colors, drawer/navigation patterns, AI chat composer, and mode-switching behavior. Change these only when the user requests a change or explicitly approves a proposed improvement.

When adding a feature such as Business/Personal separation, records, persistence, reporting, or new workflows, integrate it into this approved UI. Do not build a disconnected second interface. Reuse the existing application logic and data layer wherever possible.

## Versioning rule

Every approved change to the UI design or user-facing UI behavior must increment the UI version and update this document's change log. Never silently change a version that has already been recorded.

- **PATCH** (for example, `1.0.0 → 1.0.1`): small visual correction, spacing adjustment, or UI bug fix that does not add a distinct capability.
- **MINOR** (for example, `1.0.1 → 1.1.0`): backward-compatible UI capability or workflow addition.
- **MAJOR** (for example, `1.1.0 → 2.0.0`): a user-approved redesign or a substantial breaking change to the established UI experience.

A backend-only change that does not alter the UI does not need a UI version bump. If a backend change adds a visible screen, control, state, or workflow, increment the UI version.

Each change must record: version, date, summary, affected UI areas, and validation status. Draft previews must be labeled as drafts and must not replace the approved baseline until validated.

## Integration and release safeguards

1. Start from the approved preview and compare it with the current production app.
2. Map approved UI elements to existing app workflows and data handlers before changing code.
3. Preserve business logic, existing records, IndexedDB/local storage, sync behavior, offline support, PWA behavior, and existing event handlers unless a change is required and tested.
4. Mark unavailable features as **Coming Soon** or **Not Yet Implemented**. Never present demo data or placeholder behavior as real functionality.
5. Test the integrated preview for visual consistency, responsive behavior, navigation, and regressions.
6. Do not merge or release if the integrated UI materially differs from the approved baseline or required checks fail.
7. Keep the approved reference available for side-by-side comparison.

## Change log

| UI version | Status | Summary |
|---|---|---|
| `1.0.0` | Approved baseline | Approved AI-first KitchAI UI Preview at the reference URL above. Future integration must preserve this design and add functionality incrementally. |
| `1.1.0` | Draft — pending validation | First production adapter attempt reuses the approved preview styles and shell patterns while mounting existing production workflows. Must pass visual and regression validation before being marked approved. |
