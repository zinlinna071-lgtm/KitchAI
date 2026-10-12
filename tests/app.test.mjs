import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readLocalProfile, saveLocalProfile, validateBusinessName } from "../src/local-store.js";
import { validateIngredient } from "../src/ingredient-store.js";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");
test("document has accessible landmarks, viewport metadata, and clear scope",async()=>{
 const html=await read("../index.html");
 assert.match(html,/<html lang="en">/);assert.match(html,/name="viewport"/);assert.match(html,/class="skip-link" href="#main"/);assert.match(html,/<main id="main" class="page-shell" tabindex="-1">/);
 assert.match(html,/id="connection-status" class="connection-status" role="status"/);assert.match(html,/LOCAL BUSINESS PROFILE/);assert.match(html,/Implemented for local testing/);assert.match(html,/Hosted sync is not configured/);assert.match(html,/full operational pages arrive in later phases/i);
 assert.match(html,/id="profile-form"/);assert.match(html,/id="ingredient-form"/);assert.match(html,/ingredient cloud sync is not implemented yet/i);
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
 for(const asset of ["","index.html","src/app.js","src/local-store.js","src/ingredient-store.js","src/sync-store.js","src/sync-engine.js","src/supabase-api.js","runtime-config.js","src/styles.css","manifest.webmanifest","favicon.svg"])assert.ok(assets.includes(asset),"missing app-shell asset: "+asset);
 assert.match(worker,/new URL\(asset, self\.registration\.scope\)/);assert.match(worker,/new URL\("index\.html", self\.registration\.scope\)/);
 assert.match(worker,/request\.mode === "navigate"/);assert.match(worker,/caches\.match\(INDEX_URL\)/);assert.match(worker,/request\.method !== "GET"/);
});
test("client shell handles connection changes and install prompt",async()=>{
 const app=await read("../src/app.js");
 assert.match(app,/addEventListener\("online", updateConnectionStatus\)/);assert.match(app,/addEventListener\("offline", updateConnectionStatus\)/);assert.match(app,/navigator\.serviceWorker\.register\(`\$\{appBasePath\}sw\.js`, \{ scope: appBasePath \}\)/);assert.match(app,/beforeinstallprompt/);
});
test("responsive stylesheet includes small viewport, focus, and reduced-motion support",async()=>{
 const css=await read("../src/styles.css");assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);
});
test("production build emits every shell asset without modifying source files",async()=>{
 const sourceHtml=await read("../index.html");
 const result=spawnSync(process.execPath,["scripts/build.mjs"],{encoding:"utf8"});assert.equal(result.status,0,result.stderr);
 await Promise.all(["index.html","src/app.js","src/local-store.js","src/sync-store.js","src/sync-engine.js","src/supabase-api.js","runtime-config.js","src/styles.css","sw.js","manifest.webmanifest","favicon.svg"].map(path=>access(new URL("../dist/"+path,import.meta.url))));
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

test("ingredient catalog implementation is local-only and partitioned by owner and business", async () => {
  const store = await read("../src/ingredient-store.js");
  assert.match(store, /const DATABASE_NAME = "kitchai-ingredients"/);
  assert.match(store, /keyPath: \["ownerId", "businessId", "id"\]/);
  assert.match(store, /createIndex\("byScope", \["ownerId", "businessId"\]/);
  assert.match(store, /status: existing\?\.status \?\? "active"/);
  assert.match(store, /status !== "active" && status !== "archived"/);
  assert.match(store, /no remote sync is claimed or queued in WP2\.2/i);
});
