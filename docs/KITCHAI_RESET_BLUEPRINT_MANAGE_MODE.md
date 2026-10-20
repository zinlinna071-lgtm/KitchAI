# KitchAI Reset Blueprint — Manage Mode Requirements (Working Notes)

## Status and scope

- This document records only requirements the product owner has explicitly described so far.
- This is a requirements note for future AI/coding agents; it is not permission to implement anything yet.
- The current discussion is rebuilding the understanding of **Manage Mode** from the user's real usage flow. Do not treat older Manage Mode plans, navigation lists, or assumptions as authoritative where they conflict with this document or later owner clarification.
- Do not change AI Mode or any other area based on this document. The owner said the current explanation and redesign scope is Manage Mode only; other areas remain unchanged unless the owner explicitly says otherwise.
- Do not add unrequested features, fields, workflows, calculations, or subpages. If a behavior is not described, leave it undecided and ask the owner later if it becomes necessary.

## Global interaction rule — horizontal swipe

This is a foundational app-wide interaction rule and applies to all pages and UI:

1. **Horizontal swipe is reserved exclusively for switching between AI Mode and Manage Mode.**
2. Do not add horizontal-swipe interactions anywhere else in the app, on any page or UI element, for any other purpose. This is a strict rule with no other exceptions except the Drawer behavior below.
3. **Drawer exception:** while a Drawer is open, mode-switching horizontal swipe must be disabled. A horizontal swipe in that state should only close the Drawer; it must not switch modes.
4. Other UI interactions must not introduce additional horizontal-swipe behaviors. Do not assume or invent exceptions.

## Global navigation rule — preserve each mode's place

- When the user switches away from a mode and later returns to it, restore that mode to the place the user was working in before switching away.
- Preserve each mode's own current context independently. For example, returning to Manage Mode should return to its previous page/working location, and returning to AI Mode should return to its previous working location; do not reset either mode to its starting screen merely because the user switched modes.
- This is a navigation/continuity requirement, not permission to invent extra pages or other features. Details of what context must be retained within a page can be clarified as the owner explains the flows.

## App launch and mode switching

1. **Whenever the app is opened/launched, show AI Mode first.** This describes app startup; it does **not** mean the user is a new user.
2. When the user first swipes from AI Mode into Manage Mode and there is no existing Manage Mode position to restore for the current session, show the **Manage Mode Dashboard page first**.
3. After the user has entered Manage Mode and then switches away, preserve its current working place. Switching back to Manage Mode must restore that place rather than reset to Dashboard. Apply the same independent position-preservation rule to AI Mode.
4. The user can swipe left or right to move between AI Mode and Manage Mode, subject to the global horizontal-swipe rule above.
5. A **new user** starts with no business data entered yet. This is separate from the app-launch behavior above.
6. The seven confirmed Manage Mode main pages are listed in the section **Manage Mode — confirmed main-page list** below. The owner will explain each page and its behavior separately. Do not infer unconfirmed behavior from older plans.

## Manage Mode — confirmed main-page list

The owner confirmed these seven main pages for Manage Mode:

1. **Dashboard**
2. **Menu** — detailed behavior has been described and recorded below.
3. **Ingredients** — initial view and Create Ingredient form behavior are recorded in the section **Ingredients Page — confirmed behavior** below. Other behavior remains unspecified.
4. **Equipment & Supplies** — behavior not yet described; wait for the owner's explanation.
5. **Expenses** — behavior not yet described; wait for the owner's explanation.
6. **Business Reports** — behavior not yet described; wait for the owner's explanation.
7. **Settings** — behavior not yet described; wait for the owner's explanation.

This list records page names only where detailed behavior has not yet been explained. Do not invent their content, controls, or subpages.

## Ingredients Page — confirmed behavior

### Ingredients Page initial view

- When there are no ingredient records yet, show a message that no data exists and prompt the user to add data using a **Create** button.
- Show the **Default** category.
- The page has two buttons:
  - **Create Category**
  - **Create Ingredient**

No other page actions are confirmed yet.

### Create Ingredient form

When the user opens the Create Ingredient form:

1. **Ingredient name** — ask for the ingredient's name.
2. **Category** — set the category by choosing **Default**, selecting an existing category, or typing a new category.
3. **Ingredient type** — the user can choose either **Reusable** or **One time**.
   - **Reusable:** do not ask for purchase quantity or price in this form. The owner will enter those details later.
   - **One time:** enter the quantity, unit, and price immediately as part of creating the ingredient.

Do not add further fields, calculations, inventory behavior, or workflows unless the owner specifies them.

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
