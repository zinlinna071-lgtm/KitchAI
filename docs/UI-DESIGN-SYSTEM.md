# KitchAI Global Responsive UI & Design System Rules

**Status: Mandatory for every UI change.** These rules apply to new features, fixes, refactors, and existing UI cleanup. They are the single source of truth for responsive layout, typography, spacing, themes, and localization. Read together with the repository-root `AGENTS.md`.

## 1. Non-negotiable policy

- Every new or modified screen/component MUST follow this document and reuse existing shared design tokens/components.
- Do not add page-specific visual values or one-off patterns when an existing token/component can serve the need.
- If the current implementation cannot comply, improve the shared foundation in a focused change before building more UI on top of it.
- Do not perform a risky app-wide visual rewrite as a side effect of a feature. Migrate incrementally, preserve behavior, and use reviewable PRs.
- A UI change is not complete until its responsive, theme, language, and accessibility acceptance checks are documented and passed where applicable.
- These rules are mandatory contributor instructions; CI checks should progressively automate what can be tested. Documentation alone cannot technically enforce every external tool.

## 2. Responsive layout rules

- Design mobile-first. Support narrow phones (320 CSS px and up), common phones, tablets, laptops, and wide desktops.
- Use fluid containers, CSS Grid/Flexbox, wrapping, and content-driven sizing. Prefer `minmax(0, 1fr)`, `min-width: 0`, `max-width: 100%`, and sensible max-widths where appropriate.
- Use project-standard breakpoints/tokens; do not introduce arbitrary breakpoints without a demonstrated layout need.
- Use `clamp()` for fluid typography/spacing only where it improves scaling. Never shrink text indiscriminately just to fit a screen.
- Avoid fixed pixel widths/heights for content, cards, dialogs, forms, navigation, and text containers. Fixed dimensions are acceptable only for inherently fixed controls/icons or when clearly justified.
- Prevent accidental horizontal page scrolling, clipped content, overlapping controls, broken grids, and truncated labels. Tables or other wide data may use a clearly intentional, accessible local horizontal scroll region.
- Reflow multi-column content to fewer columns on narrow screens; keep important actions visible and in a predictable location.
- Respect device safe areas and the on-screen keyboard. Forms must remain usable when the keyboard is open and on short screens.
- Do not rely on hover as the only way to access information or actions.

## 3. Typography and spacing tokens

- Use a shared, documented scale for font sizes, line heights, font weights, spacing, radii, icon sizes, and elevation. Prefer existing CSS variables/design tokens; add new tokens centrally only when necessary.
- No arbitrary one-off margin, padding, gap, font-size, line-height, radius, or color values in feature-level CSS unless there is a documented, component-specific reason.
- Preserve hierarchy: page title, section heading, field label, body, helper text, metadata. Small text must remain readable on a phone.
- Use content-driven height and allow labels and translated text to wrap. Do not force fixed heights that clip multi-line text.
- Maintain comfortable separation between related groups and clear separation between distinct sections; repeated components must use the same spacing rhythm.
- Keep touch targets comfortably usable (aim for at least 44 × 44 CSS px for primary interactive targets where practical) with visible focus indicators.
- Browser zoom and user text scaling must not make controls unusable or hide content.

## 4. Theme consistency

- All foreground/background/border/focus/status colors MUST come from the shared theme system or semantic tokens.
- Support every existing theme (including light and dark) across pages, cards, dialogs, popovers, date pickers, inputs, charts, empty states, errors, and disabled states.
- Never hard-code a color in a component when a semantic token exists. Do not assume a light background or dark text.
- Ensure readable contrast, visible keyboard focus, and meaningful hover/pressed/selected/disabled states in each theme.
- Theme changes must not reset form data, navigation state, or business data.

## 5. Language and content consistency

- All user-facing strings MUST use the existing localization/translation mechanism; do not add hard-coded UI text to new features if translation infrastructure exists.
- Check every supported language, including Burmese and English where available. Do not assume translations have the same length or line count.
- Use fonts with suitable glyph coverage for supported scripts. Burmese text must render correctly without clipping, broken line-height, or cramped line spacing.
- Allow text wrapping and content-driven control sizing. Buttons, navigation, labels, errors, and dialogs must tolerate long translations.
- Format dates, numbers, currency, and quantities through the existing locale-aware utilities and business conventions; do not construct display strings inconsistently.

## 6. Shared component rules

- Reuse established components for buttons, form fields, cards, page headers, navigation, dialogs, date pickers, badges, alerts, and empty/loading/error states.
- When a repeated UI pattern needs a correction, fix the shared component/token first when safe instead of patching many pages independently.
- Preserve the repository's existing internal-screen create/edit form pattern from `AGENTS.md`; do not introduce a new modal/route pattern casually.
- Keep responsive behavior, keyboard interaction, focus handling, labels, and disabled/error states inside shared components where practical.
- Do not add a new UI library or styling framework without a clear need and explicit architecture review.

## 7. Required UI change checklist

For every PR that creates or changes UI, check and report:

- [ ] Uses shared design tokens and reusable components; any exception is justified.
- [ ] Narrow mobile layout: no accidental page-level horizontal overflow, clipped text, overlap, or inaccessible action.
- [ ] Phone/tablet/desktop layouts reflow correctly; content is not merely scaled down.
- [ ] Light and dark themes are readable and visually consistent.
- [ ] Supported languages render correctly; long strings and Burmese line-height/wrapping are checked where applicable.
- [ ] Keyboard focus, labels, touch target usability, and browser zoom/text scaling are considered.
- [ ] Forms, date pickers, dialogs, navigation, and existing behavior remain functional.
- [ ] Relevant automated tests/checks were run; manual/device checks not actually performed are explicitly listed as pending.

## 8. Responsive verification baseline

Where browser tests are available, test representative viewport widths: **320, 360, 390, 430, 768, 1024, and 1440 CSS px**. Also test the supported language(s) and light/dark themes. Add targeted regression tests for reported layout failures, such as overflow, clipped labels, overlapping cards, or hidden actions.

Do not claim a real phone/device check from a desktop viewport test. If a width, theme, language, or device cannot be tested, report the limitation honestly.

## 9. Change strategy

- For feature work, apply these rules to the new/changed area from the start.
- For existing UI, first inventory shared tokens/components and identify the highest-impact inconsistencies; migrate in small, testable batches.
- Avoid blanket CSS overrides, duplicated breakpoint rules, `!important` patches, and broad selectors that create hidden regressions.
- Do not make the app visually uniform by sacrificing information hierarchy, accessibility, or task efficiency.
- If a requirement conflicts with existing architecture, document the conflict and propose a small safe migration instead of silently bypassing this policy.
