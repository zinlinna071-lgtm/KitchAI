import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readLocalProfile, saveLocalProfile, validateBusinessName } from "../src/local-store.js";
import { validateIngredient } from "../src/ingredient-store.js";
import { validateMenuItem } from "../src/menu-item-store.js";
import { validateRecipe, validateRecipeLine } from "../src/recipe-store.js";
import { scopeForBusinessProfile } from "../src/business-data-store.js";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");
test("document has accessible landmarks, viewport metadata, and clear scope",async()=>{
 const html=await read("../index.html");
 assert.match(html,/<html lang="en">/);assert.match(html,/name="viewport"/);assert.match(html,/class="skip-link" href="#main"/);assert.match(html,/<main id="main" class="page-shell" tabindex="-1">/);
 assert.match(html,/id="connection-status" class="connection-status" role="status"/);assert.match(html,/LOCAL BUSINESS PROFILE/);assert.match(html,/Implemented for local testing/);assert.match(html,/Hosted sync is not configured/);assert.match(html,/offline-first kitchen workspace for business records, recipe-based production batches/i);
 assert.match(html,/id="profile-form"/);assert.match(html,/id="ingredient-form"/);assert.match(html,/id="menu-item-form"/);assert.match(html,/id="recipe-form"/);assert.match(html,/id="recipe-line-form"/);assert.match(html,/id="entity-sync-panel"/);assert.match(html,/id="phase2-sync-now"/);assert.match(html,/id="phase2-conflict-list"/);
});
test("manifest declares standalone app and local icon",async()=>{
 const manifest=JSON.parse(await read("../public/manifest.webmanifest"));
 assert.equal(manifest.name,"KitchAI Kitchen Workspace");assert.equal(manifest.display,"standalone");assert.equal(manifest.start_url,"__KITCHAI_BASE_PATH__");assert.equal(manifest.scope,"__KITCHAI_BASE_PATH__");assert.equal(manifest.icons[0].src,"__KITCHAI_BASE_PATH__favicon.svg");
});
test("service worker caches shell assets and falls back for offline navigation",async()=>{
 const worker=await read("../public/sw.js");
 const assetsMatch=worker.match(/const APP_SHELL = \[([\s\S]*?)\]\.map/);
 assert.ok(assetsMatch,"service worker declares a shell asset list");
 const assets=JSON.parse(`[${assetsMatch[1].replace(/,\s*$/,"")}]`);
 for(const asset of ["","index.html","src/app.js","src/stock-count-ui.js","src/stock-count-store.js","src/stock-count-domain.js","src/local-store.js","src/ingredient-store.js","src/menu-item-store.js","src/recipe-store.js","src/phase2-sync-engine.js","src/sync-store.js","src/sync-engine.js","src/supabase-api.js","runtime-config.js","src/styles.css","manifest.webmanifest","favicon.svg"])assert.ok(assets.includes(asset),"missing app-shell asset: "+asset);
 assert.match(worker,/new URL\(asset, self\.registration\.scope\)/);assert.match(worker,/new URL\("index\.html", self\.registration\.scope\)/);
 assert.match(worker,/request\.mode === "navigate"/);assert.match(worker,/caches\.match\(INDEX_URL\)/);assert.match(worker,/request\.method !== "GET"/);
});
test("client shell handles connection changes and install prompt",async()=>{
 const app=await read("../src/app.js");
 assert.match(app,/addEventListener\("online", updateConnectionStatus\)/);assert.match(app,/addEventListener\("offline", updateConnectionStatus\)/);assert.match(app,/navigator\.serviceWorker\.register\(`\$\{appBasePath\}sw\.js`, \{ scope: appBasePath \}\)/);assert.match(app,/beforeinstallprompt/);
});
test("Phase 2 entity sync is integrated with authenticated lifecycle and owner-scoped conflict resolution", async () => {
 const app=await read("../src/app.js");
 const engine=await read("../src/phase2-sync-engine.js");
 assert.match(app,/runPhase2EntitySync/);
 assert.match(app,/phase2SyncStore\.recoverInterrupted/);
 assert.match(app,/phase2SyncStore\.resolveKeepLocal/);
 assert.match(app,/phase2SyncStore\.resolveUseRemote/);
 assert.match(app,/phase2ConflictList/);
 assert.match(engine,/resolvesConflictId/);
 assert.match(engine,/resolutionChoice: "use_remote"/);
 assert.match(engine,/state: "resolution_pending"/);
 assert.match(engine,/lastResolutionError/);
});

test("Phase 2 entity lists do not claim cloud sync is unimplemented after sync integration", async () => {
 const app = await read("../src/app.js");
 assert.doesNotMatch(app, /cloud sync is not implemented yet/);
 assert.doesNotMatch(app, /Local-only recipe storage · cloud sync is not implemented yet/);
 assert.match(app, /Ingredients loaded\. Account sync status is shown above\./);
 assert.match(app, /Menu items loaded\. Account sync status is shown above\./);
 assert.match(app, /Recipes loaded\. Account sync status is shown above\./);
});

test("responsive stylesheet includes small viewport, focus, and reduced-motion support",async()=>{
 const css=await read("../src/styles.css");assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);
});
test("production build emits every shell asset without modifying source files",async()=>{
 const sourceHtml=await read("../index.html");
 const result=spawnSync(process.execPath,["scripts/build.mjs"],{encoding:"utf8"});assert.equal(result.status,0,result.stderr);
 await Promise.all(["index.html","src/app.js","src/stock-count-ui.js","src/stock-count-store.js","src/stock-count-domain.js","src/local-store.js","src/phase2-sync-engine.js","src/sync-store.js","src/sync-engine.js","src/supabase-api.js","runtime-config.js","src/styles.css","sw.js","manifest.webmanifest","favicon.svg"].map(path=>access(new URL("../dist/"+path,import.meta.url))));
 assert.equal(await read("../index.html"),sourceHtml);
});

test("GitHub Pages preview uses the project base path and never embeds backend config", async () => {
 const result=spawnSync(process.execPath,["scripts/build.mjs","--base-path=/KitchAI/","--preview"],{encoding:"utf8"});
 assert.equal(result.status,0,result.stderr);
 const html=await read("../dist/index.html");
 assert.ok(html.includes('content="/KitchAI/"'));
 assert.ok(html.includes("NON-PRODUCTION STATIC PREVIEW"));
 assert.ok(!html.includes("data-preview-only hidden"));
 assert.ok(!html.includes("__KITCHAI_BASE_PATH__"));
 const localReferences=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match=>match[1]).filter(value=>value.startsWith("/"));
 assert.ok(localReferences.length>0);
 for(const reference of localReferences){
  assert.ok(reference.startsWith("/KitchAI/"),`asset is outside the project base path: ${reference}`);
  const relative=reference.slice("/KitchAI/".length);
  await access(new URL("../dist/"+relative,import.meta.url));
 }
 const manifest=JSON.parse(await read("../dist/manifest.webmanifest"));
 assert.equal(manifest.start_url,"/KitchAI/");assert.equal(manifest.scope,"/KitchAI/");
 assert.equal(manifest.icons[0].src,"/KitchAI/favicon.svg");
 assert.equal(await read("../dist/runtime-config.js"),'window.KITCHAI_CONFIG = Object.freeze({ supabaseUrl: "", supabaseAnonKey: "" });\n');
 const worker=await read("../dist/sw.js");
 assert.match(worker,/new URL\(asset, self\.registration\.scope\)/);
 assert.match(worker,/new URL\("index\.html", self\.registration\.scope\)/);
 assert.equal(await read("../dist/404.html"),html);
});

test("business name validation trims input and enforces 1 to 80 characters", () => {
  assert.equal(validateBusinessName("  Harbor Kitchen  "), "Harbor Kitchen");
  assert.equal(validateBusinessName("x".repeat(80)), "x".repeat(80));
  assert.throws(() => validateBusinessName("   "), /Enter a business name/);
  assert.throws(() => validateBusinessName("x".repeat(81)), /80 characters or fewer/);
  assert.throws(() => validateBusinessName(null), /Enter a business name/);
});

test("local profile persistence API exposes read and save operations", () => {
  assert.equal(typeof readLocalProfile, "function");
  assert.equal(typeof saveLocalProfile, "function");
});

test("ingredient validation trims fields and counts Unicode code points", () => {
  assert.deepEqual(validateIngredient({ name: "  Fresh basil  ", description: "  Leaves for garnish  " }), {
    name: "Fresh basil",
    description: "Leaves for garnish",
  });
  assert.deepEqual(validateIngredient({ name: "  Lemons  ", description: "   " }), { name: "Lemons" });
  assert.equal(validateIngredient({ name: "🍋".repeat(120) }).name, "🍋".repeat(120));
  assert.throws(() => validateIngredient({ name: "🍋".repeat(121) }), /120 characters or fewer/);
  assert.throws(() => validateIngredient({ name: "   " }), /Enter an ingredient name/);
  assert.throws(() => validateIngredient({ name: null }), /Enter an ingredient name/);
  assert.throws(() => validateIngredient({ name: "Salt", description: "x".repeat(2001) }), /2,000 characters or fewer/);
});

test("ingredient catalog uses shared owner/business storage and atomically queues mutations", async () => {
  const store = await read("../src/ingredient-store.js");
  const database = await read("../src/business-data-store.js");
  assert.match(database, /const DATABASE_NAME = "kitchai-business-data"/);
  assert.match(database, /kitchai-ingredients/);
  assert.match(database, /\["ingredients", \["ownerId", "businessId", "id"\]/);
  assert.match(database, /\["byScope", \["ownerId", "businessId"\]\]/);
  assert.match(database, /store\.createIndex\(indexName, path, \{ unique: false \}\)/);
  assert.match(database, /const MIGRATION_LEDGER = "migrationLedger"/);
  assert.match(store, /enqueueEntityOperation/);
  assert.match(store, /tx\.objectStore\("operations"\)/);
  assert.match(store, /status: existing\?\.status \?\? "active"/);
  assert.match(store, /status !== "active" && status !== "archived"/);
});

test("menu item validation trims fields and counts Unicode code points", () => {
  assert.deepEqual(validateMenuItem({ name: "  Noodle Soup  ", description: "  Rice noodles in broth  " }), {
    name: "Noodle Soup",
    description: "Rice noodles in broth",
  });
  assert.deepEqual(validateMenuItem({ name: "  Tea  ", description: "   " }), { name: "Tea" });
  assert.equal(validateMenuItem({ name: "🍜".repeat(120) }).name, "🍜".repeat(120));
  assert.throws(() => validateMenuItem({ name: "🍜".repeat(121) }), /120 characters or fewer/);
  assert.throws(() => validateMenuItem({ name: " " }), /Enter a menu item name/);
  assert.throws(() => validateMenuItem({ name: "Soup", description: "x".repeat(2001) }), /2,000 characters or fewer/);
});

test("menu item store uses shared owner/business storage and atomically queues mutations", async () => {
  const store = await read("../src/menu-item-store.js");
  const database = await read("../src/business-data-store.js");
  assert.match(database, /const DATABASE_NAME = "kitchai-business-data"/);
  assert.match(database, /kitchai-menu/);
  assert.match(store, /enqueueEntityOperation/);
  assert.match(store, /tx\.objectStore\("operations"\)/);
  assert.match(store, /status !== "active" && status !== "archived"/);
});

test("recipe validation normalizes text and requires a positive yield for active recipes", () => {
  assert.deepEqual(validateRecipe({ menuItemId: "menu-1", name: "  Noodle Soup ", description: " House broth ", instructions: " Simmer gently ", yieldPortions: 4, status: "active" }), {
    menuItemId: "menu-1",
    name: "Noodle Soup",
    description: "House broth",
    instructions: "Simmer gently",
    yieldPortions: 4,
    status: "active",
  });
  assert.equal(validateRecipe({ menuItemId: "menu-1", name: "🍜".repeat(120) }).name, "🍜".repeat(120));
  assert.throws(() => validateRecipe({ menuItemId: "menu-1", name: "🍜".repeat(121) }), /120 characters or fewer/);
  assert.throws(() => validateRecipe({ menuItemId: "menu-1", name: " " }), /Enter a recipe name/);
  assert.throws(() => validateRecipe({ menuItemId: "menu-1", name: "Soup", yieldPortions: 0 }), /greater than zero/);
  assert.throws(() => validateRecipe({ menuItemId: "menu-1", name: "Soup", status: "active" }), /positive yield/);
  assert.throws(() => validateRecipe({ menuItemId: "menu-1", name: "Soup", instructions: "x".repeat(10001) }), /10000 characters or fewer/);
});

test("recipe ingredient lines enforce finite positive quantities, exact units, position, and note length", () => {
  assert.deepEqual(validateRecipeLine({ recipeId: "recipe-1", ingredientId: "ingredient-1", quantity: 0.25, unit: "kg", position: 0, note: " sifted " }), {
    recipeId: "recipe-1", ingredientId: "ingredient-1", quantity: 0.25, unit: "kg", position: 0, note: "sifted",
  });
  for (const quantity of [0, -1, Infinity, NaN, "2"]) {
    assert.throws(() => validateRecipeLine({ recipeId: "r", ingredientId: "i", quantity, unit: "g", position: 0 }), /finite number greater than zero/);
  }
  for (const unit of ["G", "grams", "cup", "ml "]) {
    assert.throws(() => validateRecipeLine({ recipeId: "r", ingredientId: "i", quantity: 1, unit, position: 0 }), /supported unit/);
  }
  assert.throws(() => validateRecipeLine({ recipeId: "r", ingredientId: "i", quantity: 1, unit: "g", position: -1 }), /whole number zero or greater/);
  assert.throws(() => validateRecipeLine({ recipeId: "r", ingredientId: "i", quantity: 1, unit: "g", position: 1.5 }), /whole number zero or greater/);
  assert.throws(() => validateRecipeLine({ recipeId: "r", ingredientId: "i", quantity: 1, unit: "g", position: 0, note: "x".repeat(501) }), /500 characters or fewer/);
});

test("recipe store uses shared partitioned storage and atomically queues recipe and line changes", async () => {
  const store = await read("../src/recipe-store.js");
  const database = await read("../src/business-data-store.js");
  assert.match(database, /const DATABASE_NAME = "kitchai-business-data"/);
  assert.match(database, /kitchai-recipes/);
  assert.match(database, /byScopeMenuItem/);
  assert.match(database, /byRecipePosition/);
  assert.match(store, /enqueueEntityOperation/);
  assert.match(store, /entityType: "recipe"/);
  assert.match(store, /entityType: "recipeLine"/);
  assert.match(store, /new Set\(\["g", "kg", "ml", "l", "each"\]\)/);
  assert.match(store, /status === "archived"/);
  assert.match(store, /createdAt: existing\?\.createdAt \?\? now/);
});

test("entity scope stays stable when the server assigns a different remote business ID", () => {
  assert.deepEqual(scopeForBusinessProfile({ profileId: "profile-1", local: true }), {
    ownerId: "local:profile-1", businessId: "profile-1",
  });
  assert.deepEqual(scopeForBusinessProfile({ ownerId: "owner-1", profileId: "profile-1" }), {
    ownerId: "owner-1", businessId: "profile-1",
  });
  assert.throws(() => scopeForBusinessProfile({ ownerId: "owner-1", profileId: "" }), /Business Profile ID is required/);
});


test("stock-count review UI exposes accessible session, line, and explicit posting controls", async () => {
 const html = await read("../index.html");
 const app = await read("../src/app.js");
 const ui = await read("../src/stock-count-ui.js");
 const css = await read("../src/styles.css");
 assert.match(html, /id="stock-count-panel"/);
 assert.match(html, /id="stock-count-session"/);
 assert.match(html, /id="stock-count-lines"[^>]*aria-label="Stock-count lines"/);
 assert.match(html, /id="stock-count-state" class="profile-state" role="status" aria-live="polite"/);
 assert.match(html, /id="stock-count-post-selected"[^>]*disabled/);
 assert.match(html, /id="stock-count-create-form"/);
 assert.match(html, /id="stock-count-add-line-form"/);
 assert.match(html, /id="stock-count-item-unit"/);
 assert.match(app, /getRemoteBusinessId: \(\) => activeSession\?\.user\?\.id/);
 assert.match(ui, /createStockCountSession/);
 assert.match(ui, /addStockCountLine/);
 assert.match(ui, /listIngredients/);
 assert.match(ui, /listMenuItems/);
 assert.match(ui, /capture their current server quantities/);
 assert.match(app, /initializeStockCountUI/);
 assert.match(ui, /postReviewedStockCountSubset/);
 assert.match(ui, /reviewedBy: context\.getSession\(\)\?\.user\?\.id/);
 assert.match(ui, /A posting outcome is uncertain/);
 assert.match(ui, /server-confirmed stock change/);
 assert.match(ui, /noteInput\.maxLength = 500/);
 assert.match(ui, /checkbox\.checked = false/);
 assert.match(ui, /`Select \$\{line\.stockItemName\} for posting`/);
 assert.match(ui, /!\["open", "ready_for_review"\]\.includes\(session\.status\)/);
 assert.ok(ui.includes("pendingPost") && ui.includes("!navigator.onLine"));
 assert.match(css, /WP3\.5e accessible stock-count review/);
});

test("stock-count UI allows retrying pending posting and refreshes state after rejection", async () => {
  const ui = await read("../src/stock-count-ui.js");
  assert.ok(ui.includes('postButton.textContent = pendingPost ? "Retry pending posting"'));
  assert.ok(ui.includes("if (session?.pendingPost)"));
  assert.ok(ui.includes("session.pendingPost.lineIds ?? session.pendingPost.command?.lines?.map(line => line.lineId)"));
  assert.ok(ui.includes("Always reload local state: a stale rejection clears the pending command and marks lines stale."));
});

test("approved UI ingredient catalogue is connected to the business-scoped local ingredient store", async () => {
  const ui = await read("../src/ui-preview.js");
  assert.match(ui, /function renderIngredientCatalogPanel\(/);
  assert.match(ui, /import\("\.\/ingredient-store\.js"\)/);
  assert.match(ui, /saveIngredient\(scope,/);
  assert.match(ui, /listIngredients\(scope\)/);
  assert.match(ui, /setIngredientStatus\(/);
  assert.match(ui, /scopeForBusinessProfile\(\{profileId:business\.id,local:true\}\)/);
  assert.match(ui, /id="ingredient-record-form"/);
  assert.match(ui, /data-ingredient-edit/);
  assert.match(ui, /data-ingredient-status/);
});
