# KitchAI UI localization guide

KitchAI supports English (`en`), Myanmar (`my`), and Thai (`th`). New UI must use the shared localization module instead of embedding user-facing text directly in component logic.

## Add text for a new screen

1. Add a stable, namespaced key to `src/i18n/locales/en.js`, for example `production.start`.
2. Add the matching translation to `src/i18n/locales/my.js` and `src/i18n/locales/th.js`.
3. Import `translate` from `src/i18n/index.js` and use `translate("production.start")` when rendering the label.
4. For changing values, use interpolation such as `translate("common.items", { count })`; do not concatenate translated sentence fragments.
5. Use `formatNumber`, `formatDate`, and `formatCurrency` from the same module for locale-sensitive values.
6. Add the new key to relevant locale coverage tests and verify all three languages.

## Re-render when the language changes

A UI that stays mounted while the user switches languages must subscribe to locale changes and render its translated text again:

```js
import { onLocaleChange, translate } from "./i18n/index.js";

function render() {
  heading.textContent = translate("production.title");
  startButton.textContent = translate("production.start");
}

render();
const unsubscribe = onLocaleChange(render);

// When the screen/component is disposed:
// unsubscribe();
```

`setLocale()` updates the document language and dispatches the `kitchai:localechange` event. `onLocaleChange()` returns an unsubscribe function; call it when the UI is removed.

## Rules

- Do not hardcode user-facing labels, placeholders, validation messages, confirmation text, or accessibility labels in screen modules.
- Translate accessible names and dynamically created DOM elements too.
- Keep IDs, stored enum values, API fields, and business logic values language-neutral; translate only their presentation.
- Do not treat the English fallback as proof that a translation is complete. Coverage tests must catch missing keys in Myanmar and Thai.
- Keep product names and accepted abbreviations such as AI unchanged when appropriate.
