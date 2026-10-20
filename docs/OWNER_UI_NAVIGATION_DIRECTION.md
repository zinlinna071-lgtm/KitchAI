# KitchAI Owner UI Navigation Direction

Status: Owner-confirmed high-level direction. This document records only the agreed mode structure, mode-switching UX, and seven Manage Mode main pages. Subpages and detail pages are **not finalized**.

## 1. Core UI principle

KitchAI is for small food-business owners, including people who are not familiar with bookkeeping or complex business software. Keep the experience simple, clear, mobile-first, and easy to operate while busy.

Show a small set of understandable main destinations. Let users reach detailed actions in context or ask AI for help. Do not expose a large navigation tree or invent extra features.

## 2. Two modes must remain distinct

KitchAI has two primary modes:

- **AI Mode** — the AI-first experience where the user can ask questions and request help using natural language.
- **Manage Mode** — the direct, visual interface for viewing and managing business information through the seven agreed main pages.

Keep both modes. Neither mode replaces the other. Preserve the existing app shell and business workflows when implementing UI changes.

## 3. Mode-switching UX/UI logic — global gesture rule

The owner has specifically chosen horizontal swiping as a way to switch between AI Mode and Manage Mode. **Horizontal swipe gestures are reserved exclusively for switching between these two modes across the app.** This is a global interaction rule, not just a rule for the home screen.

### Required interaction direction

- A horizontal swipe in either direction (left or right) switches between AI Mode and Manage Mode. The user should not need to remember which direction means which mode.
- **Do not add any other left/right swipe interactions anywhere inside KitchAI pages or components.** In particular, no horizontal swipe to change tabs, pages, cards, carousel items, records, images, or lists. Do not add nested or competing horizontal swipe gestures.
- If users need to change tabs, pages, cards, records, or other content within a page, provide a visible tap-based control or another non-horizontal-swipe interaction instead.
- Make the two modes feel like neighboring views in one app, so the user can move between them with minimal effort.
- Provide a clear, visible mode indicator or switch control as an alternative to swiping. Users must not be forced to discover or use gestures.
- The visible control must clearly identify which mode is active and make the other mode easy to reach.
- Keep mode switching consistent in both directions: AI Mode → Manage Mode and Manage Mode → AI Mode.
- Make the interaction comfortable on mobile and avoid accidental switches while the user is scrolling, typing, selecting text, or interacting with forms.
- Distinguish deliberate horizontal gestures from vertical page scrolling. Do not hijack ordinary vertical scrolling.
- Respect accessibility and different input methods: provide a tappable alternative, visible focus behavior for keyboard users where applicable, and accessible labels for mode controls.
- Switching modes is navigation only. It must not silently clear, reset, submit, duplicate, or modify business data or an unfinished form.
- Keep the active mode visually obvious. Avoid making users guess where they are.
- Keep the interaction responsive and lightweight; do not introduce a separate loading step just to change modes unless genuinely required by the underlying system.

### Implementation guardrails

- Before changing mode navigation, inspect and preserve the current mode-switching behavior and app shell.
- Use one coherent mode state as the source of truth for swipe gestures and the visible switch control, so the two cannot disagree.
- Ensure no child component registers a competing left/right swipe handler. Avoid horizontal swipe libraries or carousel behavior in page content.
- Prevent gesture handlers from conflicting with form inputs, text selection, scrolling, and other touch interactions. Do not switch modes merely because the user is typing or interacting with a control.
- Do not load a separate preview controller into production as a shortcut, and do not replace existing production DOM or workflows without a reviewed migration.
- Verify on a phone-sized viewport that swiping left and right switches modes, the tap control works, vertical scrolling still works, no in-page horizontal swipe changes content, and changing modes does not lose entered data.
- This document describes the owner’s UX direction; implementation details may be chosen by developers as long as they meet these behaviors and preserve existing functionality.

## 4. Manage Mode — exactly seven agreed main pages

The Manage Mode main navigation contains these seven destinations:

1. **Dashboard** — a simple business overview.
2. **Menu** — menu items offered for sale.
3. **Ingredients** — ingredients and manually managed ingredient stock information.
4. **Sales** — record sales and review sales history.
5. **Expenses** — business expense records.
6. **Business Reports** — business reporting such as sales, purchases, expenses, cash summaries, and charts as supported by the app.
7. **Settings** — app and business settings.

These are the only currently agreed Manage Mode main pages. Do not add more main pages without an explicit owner decision.

## 5. Subpages and detail pages are undecided

The owner has said that previous subpage proposals were too numerous and included unnecessary items. No subpage or detail-page list is approved yet.

- Do not treat earlier AI-generated subpage lists as requirements.
- Do not finalize, implement, or add a detailed subpage tree based on assumptions.
- Do not promote Shopping List, Purchases, Stock Adjustment, Categories, Usage Periods, or any other detailed workflow into extra main pages at this stage.
- The eventual placement of detailed actions is open: they may belong contextually within an agreed main page or be accessible through AI, subject to future owner decisions.

## 6. Instructions for other AI assistants and contributors

When planning, coding, reviewing, or generating implementation prompts for KitchAI:

1. Follow the two-mode structure: AI Mode and Manage Mode.
2. Reserve all horizontal left/right swipe gestures exclusively for switching between AI Mode and Manage Mode. Never add competing horizontal swipe interactions inside pages or components.
3. Keep exactly the seven agreed Manage Mode main pages.
4. Prioritize simplicity for non-technical users and mobile use.
5. Do not invent extra main pages, features, or finalized subpages.
6. Treat this document as the current owner-confirmed high-level UI direction when older proposals conflict with it.
7. This is a documentation decision, not permission to change production UI or business logic by itself.
