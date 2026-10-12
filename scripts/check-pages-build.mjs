import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const outputDirectory = path.join(repositoryRoot, "dist");
const basePath = "/KitchAI/";
const indexPath = path.join(outputDirectory, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
const manifest = JSON.parse(await readFile(path.join(outputDirectory, "manifest.webmanifest"), "utf8"));
const runtimeConfig = await readFile(path.join(outputDirectory, "runtime-config.js"), "utf8");
const serviceWorker = await readFile(path.join(outputDirectory, "sw.js"), "utf8");

assert.ok(indexHtml.includes(`<meta name="kitchai-base-path" content="${basePath}">`));
assert.ok(indexHtml.includes("NON-PRODUCTION STATIC PREVIEW"));
assert.ok(!indexHtml.includes("data-preview-only hidden"));
assert.ok(!indexHtml.includes("__KITCHAI_BASE_PATH__"));
assert.equal(manifest.start_url, basePath);
assert.equal(manifest.scope, basePath);
assert.equal(manifest.id, basePath);
assert.ok(manifest.icons.every((icon) => icon.src.startsWith(basePath)));
assert.equal(runtimeConfig, 'window.KITCHAI_CONFIG = Object.freeze({ supabaseUrl: "", supabaseAnonKey: "" });\n');
assert.ok(!serviceWorker.includes('"/src/'));
assert.match(serviceWorker, /new URL\(asset, self\.registration\.scope\)/);
assert.match(serviceWorker, /new URL\("index\.html", self\.registration\.scope\)/);
assert.equal(await readFile(path.join(outputDirectory, "404.html"), "utf8"), indexHtml);

async function assertAssetExists(urlPath) {
  assert.ok(urlPath.startsWith(basePath), `Local asset is outside ${basePath}: ${urlPath}`);
  const relativePath = decodeURIComponent(urlPath.slice(basePath.length));
  const assetPath = path.resolve(outputDirectory, relativePath || "index.html");
  assert.ok(assetPath.startsWith(outputDirectory + path.sep), `Asset escapes dist/: ${urlPath}`);
  await stat(assetPath);
}

for (const [, reference] of indexHtml.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if (reference.startsWith("#")) continue;
  const resolved = new URL(reference, "https://pages.invalid");
  if (resolved.origin !== "https://pages.invalid") continue;
  await assertAssetExists(resolved.pathname);
}

const shellAssetsMatch = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\]\.map/);
assert.ok(shellAssetsMatch, "Service worker must declare its precache list.");
const shellAssetsSource = shellAssetsMatch[1].replace(/,\s*$/, "");
const shellAssets = JSON.parse(`[${shellAssetsSource}]`);
for (const asset of shellAssets) {
  const assetUrl = new URL(asset, `https://pages.invalid${basePath}`);
  await assertAssetExists(assetUrl.pathname);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return nested.flat();
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
];

const generatedFiles = await listFiles(outputDirectory);
for (const filePath of generatedFiles) {
  const contents = await readFile(filePath);
  const text = contents.toString("utf8");
  if (filePath.endsWith(".js")) {
    const imports = /\bfrom\s+["']([^"']+)["']|\bimport\(["']([^"']+)["']\)/g;
    for (const match of text.matchAll(imports)) {
      const reference = match[1] ?? match[2];
      if (!reference.startsWith(".")) continue;
      const importedPath = path.resolve(path.dirname(filePath), reference);
      assert.ok(importedPath.startsWith(outputDirectory + path.sep), `Module escapes dist/: ${reference}`);
      await stat(importedPath);
    }
  }
  if (filePath.endsWith(".css")) {
    const urls = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
    for (const match of text.matchAll(urls)) {
      const reference = match[1];
      if (/^(?:data:|https?:|#)/i.test(reference)) continue;
      const assetPath = path.resolve(path.dirname(filePath), reference);
      assert.ok(assetPath.startsWith(outputDirectory + path.sep), `CSS asset escapes dist/: ${reference}`);
      await stat(assetPath);
    }
  }
  for (const pattern of secretPatterns) {
    assert.ok(!pattern.test(text), `Potential secret found in ${path.relative(outputDirectory, filePath)}.`);
  }
}

console.log(`Pages preview artifact checks passed for ${basePath}; runtime backend config is empty.`);
