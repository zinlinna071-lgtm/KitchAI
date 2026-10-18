# KitchAI

KitchAI is an offline-first web/PWA foundation for kitchen and food-business operations, with a planned path toward reliable local–cloud sync and later AI-assisted workflows.

## Run the application

Requirements: Node.js 22 or newer.

```sh
npm test
npm run build
npm run dev
```

The production build is written to `dist/`. Serve that directory from HTTPS (or localhost during development) to test service-worker/offline behavior. Opening `index.html` directly with a `file://` URL does not enable PWA service workers.

## Frontend preview status

The `ui-preview` branch provides a responsive frontend prototype with AI Mode and Manage Mode. The AI interface does not call an AI service. Menu and Ingredients prototype data is held in memory for the current preview and is not saved to a database.

Use StackBlitz for an interactive development preview or GitHub Pages for the static preview. Vercel deployment is not required for these preview paths.

## Important implementation boundary

The frontend prototype is not yet a complete business app. Do not assume that every navigation item has a finished workflow, that preview form data persists, or that cloud sync has been validated by looking at the UI.

Preserve existing local data stores, domain modules, sync engine, migrations, PWA assets, and service-worker behavior during UI cleanup. Browser tests for retired legacy record-entry screens are temporarily deferred while the corresponding workflows are rebuilt; passing CI only confirms the checks that actually ran.

## Project documents

- [Product roadmap](docs/ROADMAP.md)
- [Phase 1 plan](docs/PHASE_1_PLAN.md)
- [Work package registry](docs/WP_REGISTRY.md)
- [Decision log](docs/DECISIONS.md)
- [Architecture options](docs/ARCHITECTURE_OPTIONS.md)
- [Project status](docs/STATUS.md)
- [Local–cloud sync contract](docs/LOCAL_SYNC_CONTRACT.md)
- [UI/UX design system](docs/UI_DESIGN_SYSTEM.md)
