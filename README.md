# KitchAI

KitchAI is an offline-first web/PWA foundation for kitchen and food-business operations, with a planned path toward reliable local–cloud sync and later AI-assisted workflows.

## Run the application shell

Requirements: Node.js 22 or newer. No third-party npm packages are required for the current shell.

```sh
npm test
npm run build
```

The production build is written to `dist/`. Serve that directory from an HTTPS origin (or localhost during development) to test service-worker/offline behavior. Opening `index.html` directly with a `file://` URL does not enable PWA service workers.

This WP1.2 shell provides responsive layout, online/offline status, a web app manifest, install-prompt handling where supported, and service-worker caching for the app shell. It does **not** yet implement business-record persistence, authentication, cloud sync, or production data handling.

## Project documents

- [Product roadmap](docs/ROADMAP.md)
- [Phase 1 plan](docs/PHASE_1_PLAN.md)
- [Work package registry](docs/WP_REGISTRY.md)
- [Decision log](docs/DECISIONS.md)
- [Architecture options](docs/ARCHITECTURE_OPTIONS.md)
- [Project status](docs/STATUS.md)
- [Local–cloud sync contract](docs/LOCAL_SYNC_CONTRACT.md)

## Current status

WP1.1 local requirements/architecture spike gate is complete. WP1.2 application shell implementation is in progress and must pass CI before completion. Supabase/PostgreSQL is the selected target architecture, but no cloud project, billing, secrets, or deployment is authorized.
