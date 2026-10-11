import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
const read=path=>readFile(new URL(path,import.meta.url),"utf8");
test("document has accessible landmarks, viewport metadata, and clear scope",async()=>{
 const html=await read("../index.html");
 assert.match(html,/<html lang="en">/);assert.match(html,/name="viewport"/);assert.match(html,/class="skip-link" href="#main"/);assert.match(html,/<main id="main">/);
 assert.match(html,/id="connection-status" class="connection-status" role="status"/);assert.match(html,/business details will be added in a later work package/i);assert.match(html,/cloud identity and sync will be introduced only after their security checks/i);
});
test("manifest declares standalone app and local icon",async()=>{
 const manifest=JSON.parse(await read("../public/manifest.webmanifest"));
 assert.equal(manifest.name,"KitchAI Kitchen Workspace");assert.equal(manifest.display,"standalone");assert.equal(manifest.start_url,"/");assert.equal(manifest.icons[0].src,"/favicon.svg");
});
test("service worker caches shell assets and falls back for offline navigation",async()=>{
 const worker=await read("../public/sw.js");
 for(const asset of ["/","/index.html","/src/app.js","/src/styles.css","/manifest.webmanifest","/favicon.svg"])assert.ok(worker.includes(JSON.stringify(asset)),"missing app-shell asset: "+asset);
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
 return Promise.all(["index.html","src/app.js","src/styles.css","sw.js","manifest.webmanifest","favicon.svg"].map(path=>access(new URL("../dist/"+path,import.meta.url))));
});
