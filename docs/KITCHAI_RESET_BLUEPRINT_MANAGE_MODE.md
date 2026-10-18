# KitchAI Reset Blueprint — Manage Mode Requirements (Working Notes)

## Status and scope

- This document records only requirements the product owner has explicitly described so far.
- This is a requirements note for future AI/coding agents; it is not permission to implement anything yet.
- The current discussion is rebuilding the understanding of **Manage Mode** from the user's real usage flow. Do not treat older Manage Mode plans, navigation lists, or assumptions as authoritative where they conflict with this document or later owner clarification.
- Do not change AI Mode or any other area based on this document. The owner said the current explanation and redesign scope is Manage Mode only; other areas remain unchanged unless the owner explicitly says otherwise.
- Do not add unrequested features, fields, workflows, calculations, or subpages. If a behavior is not described, leave it undecided and ask the owner later if it becomes necessary.

## App entry and switching modes

1. When a user opens the app, **AI Mode** is the first view shown.
2. The user can swipe left or right to move easily between AI Mode and Manage Mode.
3. A new user starts with no business data entered yet.
4. Manage Mode currently has seven pages in the user's described experience. The owner will explain each page and its behavior separately. Do not infer the functions of the other six pages from older plans.

## Menu Page — confirmed behavior

### Menu Page initial view

- Show menus under a **Default** category.
- Provide two actions on the Menu Page:
  - **Create Category**
  - **Create Menu**

No other Menu Page actions are confirmed yet.

### Create Menu form

When the user taps **Create Menu**, show a Menu Create Form with these fields/behaviors:

1. **Name** — the user enters the menu name.
2. **Category** — optional:
   - If the user selects an existing category, assign the menu to that category.
   - If the user types a new category, create/use that category for the menu.
   - If the user neither selects an existing category nor enters a new one, assign the menu to **Default** automatically.
3. **Ingredients** — the user chooses whether to add ingredients now:
   - If this is a new app with no ingredients entered yet, the user can choose a “not adding ingredients yet” option.
   - If ingredient records already exist, the user can select ingredients one by one.
   - The owner has not specified ingredient quantities, recipe calculations, stock deduction, or other ingredient-linked behavior here. Do not invent these behaviors.
4. **Note** — optional; the user may enter a note or leave it blank.
5. **Selling price** — the user enters the price at which the menu will be sold.
6. Tapping **Create** creates the menu.

Do not add ingredient prices to the Menu form; only the menu's selling price is specified.

### Menu Detail Page

When the user taps a created menu, open that menu's Detail Page. For the current scope, it contains only:

- A **Back arrow** to return to the previous page.
- The menu's information.
- **CRUD buttons** for the menu record (Create, Read, Update, Delete actions as applicable to the interface).

Do not add other detail-page sections or workflows unless the owner specifies them.

## Explicit implementation boundary

The owner asked to record the requirements for other AI agents first and then continue explaining the remaining Manage Mode pages. Therefore:

- This document is not approval to start coding.
- Do not implement the Menu Page yet.
- Do not finalize the full seven-page navigation or subpages; only the Menu Page behavior above is currently detailed.
- Keep later owner clarifications authoritative and update this document as the owner explains more.
