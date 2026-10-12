import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readLocalProfile, saveLocalProfile, validateBusinessName } from "../src/local-store.js";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");
test("document has accessible landmarks, viewport metadata, and clear scope",async()=>{
 const html=await read("../index.html");
 assert.match(html,/<html lang="en">/);assert.match(html,/name="viewport"/);assert.match(html,/class="skip-link" href="#main"/);assert.match(html,/<main id="main" class="page-shell">/);
 assert.match(html,/id="connection-status" class="connection-status" role="status"/);assert.match(html,/LOCAL BUSINESS PROFILE/);assert.match(html,/Implemented for local testing/);assert.match(html,/Hosted sync is not configured/);assert.match(html,/full operational pages arrive in later phases/i);
 assert.match(html,/id="profile-form"/);
});
test("manifest declares standalone app and local icon",async()=>{
 const manifest=JSON.parse(await read("../public/manifest.webmanifest"));
 assert.equal(manifest.name,"KitchAI Kitchen Workspace");assert.equal(manifest.display,"standalone");assert.equal(manifest.start_url,"/");assert.equal(manifest.icons[0].src,"/favicon.svg");
});
test("service worker caches shell assets and falls back for offline navigation",async()=>{
 const worker=await read("../public/sw.js");
 for(const asset of ["/","/index.html","/src/app.js","/src/local-store.js","/src/sync-store.js","/src/sync-engine.js","/src/supabase-api.js","/runtime-config.js","/src/styles.css","/manifest.webmanifest","/favicon.svg"])assert.ok(worker.includes(JSON.stringify(asset)),"missing app-shell asset: "+asset);
 assert.match(worker,/request\.mode==="navigate"/);assert.match(worker,/caches\.match\("\/index\.html"\)/);assert.match(worker,/request\.method!=="GET"/);
});
test("client shell handles connection changes and install prompt",async()=>{
 const app=await read("../src/app.js");
 assert.match(app,/addEventListener\("online", updateConnectionStatus\)/);assert.match(app,/addEventListener\("offline", updateConnectionStatus\)/);assert.match(app,/navigator\.serviceWorker\.register\("\/sw\.js"\)/);assert.match(app,/beforeinstallprompt/);
});
test("responsive stylesheet includes small viewport, focus, and reduced-motion support",async()=>{
 const css=await read("../src/styles.css");assert.match(css,/@media\(max-width:560px\)/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);
});
test("production build emits every shell asset",()=>{
 const result=spawnSync(process.execPath,["scripts/build.mjs"],{encoding:"utf8"});assert.equal(result.status,0,result.stderr);
 return Promise.all(["index.html","src/app.js","src/local-store.js","src/sync-store.js","src/sync-engine.js","src/supabase-api.js","runtime-config.js","src/styles.css","sw.js","manifest.webmanifest","favicon.svg"].map(path=>access(new URL("../dist/"+path,import.meta.url))));
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
