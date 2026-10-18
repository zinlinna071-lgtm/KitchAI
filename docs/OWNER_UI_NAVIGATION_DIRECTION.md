# KitchAI Owner UI Navigation Direction

Status: owner-confirmed high-level direction. This document records only the agreed top-level UI structure. Subpages, detail pages, and their exact workflows are **not finalized**.

## Product UI principle

KitchAI is intended for users who may not understand bookkeeping or complex business software. Keep the UI they see as simple and easy to understand as possible. The user should see only a small number of clear main destinations. Detailed workflows and operational complexity should be accessible contextually within the relevant page and/or handled with help from AI, rather than exposing many separate main-navigation items.

Do not add extra main pages or finalize a large subpage structure without a later owner decision.

## Two distinct modes

KitchAI has two separate modes:

- **AI Mode:** the user interacts with the AI to ask for help and have supported tasks assisted through natural-language interaction.
- **Manage Mode:** the user directly browses and manages the business through a small set of clear main pages.

Keep both modes. Do not remove, merge, or replace either mode while designing navigation. Preserve the existing mode-switching UI and current app shell unless a separately reviewed owner-approved change says otherwise.

## Manage Mode: the 7 agreed main pages

The Manage Mode main navigation contains exactly these seven destinations:

1. **Dashboard** — a simple overview of the business.
2. **Menu** — food/menu items offered for sale.
3. **Ingredients** — ingredients and their manually managed stock information.
4. **Equipment & Supplies** — reusable shop/kitchen equipment and supplies.
5. **Expenses** — business expense records.
6. **Business Reports** — sales, purchases, expenses, cash summaries, charts, and relevant business reporting.
7. **Settings** — app and business settings.

These are the only currently agreed Manage Mode main pages. Do not promote Shopping List, Purchases, Stock Adjustment, Categories, Usage Periods, or other detailed workflows into additional main-navigation destinations at this stage.

## Subpages and detail pages are not finalized

The owner explicitly considers previous subpage proposals too numerous and containing unnecessary items. No subpage/detail-page list is approved yet.

- Treat subpage and detail-page ideas as open planning items, not requirements.
- Do not infer approval from earlier AI-generated UI/UX specifications.
- Do not implement or document a definitive subpage tree until the owner reviews and decides it.
- Detailed actions may later be placed inside the most relevant main page or assisted through AI; exact placement remains undecided.

## Guidance for other AI assistants and contributors

When planning, coding, reviewing, or generating prompts for KitchAI:

1. Follow the seven Manage Mode main pages listed above.
2. Preserve the distinction between AI Mode and Manage Mode.
3. Optimize for a non-technical user: simple labels, minimal visible choices, and clear flows.
4. Do not add new main pages or finalize subpages on your own.
5. Treat this document as the current owner-confirmed high-level navigation direction. If older planning documents propose a different main navigation or a detailed subpage tree, do not treat those proposals as more recently approved than this document.
6. This is a documentation-only direction; it does not authorize changing the current UI or business logic by itself.

