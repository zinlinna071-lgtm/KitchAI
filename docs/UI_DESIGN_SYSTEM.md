# KitchAI UI/UX Design System

## Purpose

This document defines the shared visual foundation for KitchAI's frontend. Pages should reuse these tokens and components rather than inventing independent spacing, colors, typography, or form styles.

## Design principles

- Mobile-first, responsive layouts.
- Clear hierarchy and readable text, including Burmese and English.
- Consistent spacing, component dimensions, and interaction states.
- Accessible focus indicators and touch-friendly controls.
- Frontend-first: use presentation-only placeholder states until a page's confirmed requirements are implemented.
- Do not invent page workflows from placeholders or navigation labels.
- Preserve PWA, service-worker, local persistence, sync, migrations, and domain/business logic while rebuilding the presentation layer.

## Color tokens

The current starting palette is implemented in `src/design-tokens.css`:

| Token | Initial value | Use |
|---|---|---|
| `--color-primary` | `#0D9488` | Main actions and active navigation |
| `--color-primary-hover` | `#0F766E` | Hover state |
| `--color-primary-soft` | `#CCFBF1` | Subtle active backgrounds |
| `--color-bg` | `#F8FAFC` | App background |
| `--color-surface` | `#FFFFFF` | Cards and controls |
| `--color-surface-muted` | `#F1F5F9` | Muted surfaces |
| `--color-text` | `#0F172A` | Primary text |
| `--color-text-muted` | `#64748B` | Supporting text |
| `--color-border` | `#E2E8F0` | Borders and dividers |
| `--color-success` | `#15803D` | Success states |
| `--color-warning` | `#B45309` | Warning states |
| `--color-danger` | `#DC2626` | Error/destructive actions |

These are initial implementation values and can be reviewed after seeing the UI. Components must reference tokens rather than hard-code unrelated colors.

## Spacing scale

Use a 4px-based scale: `4, 8, 12, 16, 20, 24, 32, 40, 48px`. Use the existing CSS custom properties for page gutter, page width, control padding, and card padding. Avoid arbitrary one-off values unless a documented layout constraint requires them.

- **Padding:** internal space inside a component.
- **Margin:** external separation around an element or section.
- **Gap:** separation between children in flex/grid layouts.

## Typography

- Font stack prioritizes Inter and includes Burmese-capable system fallbacks such as Noto Sans Myanmar and Myanmar Text.
- Use the shared `--font-size-*` tokens and shared line-height values.
- Initial sizes: 12px supporting text, 14px secondary/body controls, 16px primary body text, 20px section headings, and 24px page headings.
- Page headings may scale responsively.
- Verify Burmese glyph coverage and readability on actual mobile devices before finalizing the font choice.

## Shape and dimensions

- Shared radii: 8px small, 12px medium, 16px large, and pill radius for fully rounded controls.
- Shared control minimum height: 44px.
- Inputs, selects, and textareas share border, background, padding, typography, and focus treatment.
- Cards use shared padding, border, radius, and subtle shadow tokens.

## Shared components

Reusable baseline classes are implemented in `src/ui-components.css`:

- `ui-button`, `ui-button--primary`, `ui-button--secondary`, `ui-button--danger`
- `ui-field`, `ui-label`, `ui-hint`
- `ui-input`, `ui-select`, `ui-textarea`
- `ui-card`, `ui-stack`, `ui-row`
- `ui-empty-state`, `ui-divider`

When page-specific components are introduced, they should compose these shared styles instead of redefining their visual foundations.

## Theme and responsive behavior

- Light theme is the initial default.
- Dark theme uses the same semantic tokens, overridden at the theme root.
- Layout uses mobile breakpoints and a 16px page gutter on narrow screens.
- The app shell starts in AI Mode on launch. During the session, AI Mode and Manage Mode retain their own current page when switching modes.
- Horizontal swipe is reserved for switching between modes. While the Drawer is open, horizontal swipe only closes the Drawer.

## Implementation boundaries

- This is a visual foundation, not permission to invent page workflows.
- The seven Manage Mode page names are confirmed separately in the Manage Mode requirements document.
- Only the Menu and Ingredients requirements described by the owner may guide those pages; build page-specific forms and workflows after their requirements are fully explained.
- Keep business/data logic separate from the UI refactor. Do not delete domain logic, stores, migrations, sync, PWA assets, or service-worker behavior as part of visual cleanup.
