Automated checks do not publish the site and do not prove hosted backend behavior.

# KitchAI Mobile Static Test Preview

**Status:** Preparation only. No Pages setting has been enabled and no preview has been published. Android manual acceptance is pending.

## Purpose and limits

This is a temporary, non-production static copy of the current app shell for the owner to inspect on an Android phone. It is built under the GitHub Pages project path and always embeds empty Supabase runtime configuration.

- No hosted authentication, account creation, database, cloud sync, backup, or production API is configured. The sign-in/account panel stays hidden.
- The warning banner identifies the build as a non-production static preview. Local IndexedDB draft behavior is device/browser-local only; use a disposable business name and do not enter personal, employee, customer, supplier, financial, or other real data.
- A successful page load, PWA install, or offline shell test does not establish hosted authentication or sync. No production deployment is part of this procedure.
- The preview is public to anyone with its URL while published. Do not place private information in the page or URL.

## Owner-controlled deployment

The PR workflow verifies the build and browser behavior but does not publish on a pull request or push. After reviewing and merging the PR, the owner must:

1. Confirm the repository is public so the test page can be opened without repository authentication.
2. Open **Repository Settings → Pages → Build and deployment** and set **Source** to **GitHub Actions**. Do not select a production branch or add a custom domain.
3. Open **Actions → Static test preview → Run workflow**, select `main`, and run it manually. The deploy job is guarded to run only for `workflow_dispatch` on `main` and only after the test job succeeds.
4. Wait for the Pages deployment job to succeed. Use the deployment URL shown on that job. Expected project URL format: `https://zinlinna071-lgtm.github.io/KitchAI/`.
5. Confirm the page shows **NON-PRODUCTION STATIC PREVIEW** before testing. If the URL does not load or the warning is absent, stop and report it; do not infer a successful deployment from the CI artifact.

Do not enable billing, create a Supabase project, add credentials, secrets, a custom domain, or any backend service for this preview. The workflow uses only the static `dist/` artifact. GitHub Pages settings remain owner-controlled and are not changed by this repository.

## Android manual acceptance

Use Android Chrome (or another supported browser) and synthetic data only. Record results in [WP1.7 manual acceptance checklist](./WP1_7_MANUAL_ACCEPTANCE_CHECKLIST.md); keep unchecked items pending until actually observed.

1. Open the deployment URL on the phone and confirm the non-production warning, no sign-in/create-account controls, no horizontal overflow, and the app shell loads.
2. Open the business-profile area, enter a disposable sample name, save, and confirm the UI says it is saved on this device and not synced.
3. Enable airplane mode or otherwise disconnect the phone, reload the URL, and confirm the app shell and sample draft remain available. Confirm the connection state reports offline; do not interpret this as remote sync.
4. Restore connectivity. The preview must continue to state hosted sync is not configured; no account action or cloud write should appear.
5. If Android offers **Add to Home screen** or installation, record what is offered and test opening it. If it is not offered, record that outcome rather than marking installation passed.
6. Record Android version, browser/version, date/time, exact URL, observed statuses, results, and any screenshot with no personal/business data.
7. After testing, remove the home-screen shortcut if added and clear site storage for `zinlinna071-lgtm.github.io` in the browser. This removes the test draft and unregisters/clears site data for that origin.

Manual phone acceptance remains pending until the owner completes and records these steps on the deployed URL. Desktop/CI screenshots do not substitute for this evidence.

## Disable and clean up

When the temporary test is finished:

1. In **Repository Settings → Pages**, use **Unpublish site** (or disable Pages publication if that control is shown) and verify the URL no longer serves the preview.
2. Disable or remove the `deploy-preview` job / this workflow in a follow-up reviewed change so the site cannot be republished accidentally.
3. Remove any Android home-screen shortcut and clear site data/service-worker storage in the test browser.
4. Do not delete production or user data; this preview is static and should contain only generated app-shell files and local synthetic browser data.

## Build and verification commands

From the repository root:

```sh
npm run check
npm run check:pages-preview
npm ci --prefix .spikes/wp1-1-local-sync
cd .spikes/wp1-1-local-sync
npx playwright test --config pages-preview.playwright.config.js
```

The Pages build uses `/KitchAI/`, writes only to ignored `dist/`, emits a matching `404.html`, checks the base path and local asset references, scans generated artifacts for recognizable secrets, and verifies the runtime Supabase URL/key are empty. Browser tests cover the scoped manifest/worker, hidden auth controls, Pages fallback, and offline navigation. Automated checks do not publish the site and do not prove hosted backend behavior.
