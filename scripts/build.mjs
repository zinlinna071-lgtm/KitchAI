import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const output = path.join(root, "dist");
const argumentsList = process.argv.slice(2);
const basePathArgument = argumentsList.find((argument) => argument.startsWith("--base-path="));
const basePath = basePathArgument?.slice("--base-path=".length) ?? "/";
const isPreview = argumentsList.includes("--preview");
const unknownArguments = argumentsList.filter((argument) => argument !== "--preview" && argument !== basePathArgument);

if (unknownArguments.length) {
	throw new Error(`Unknown build argument: ${unknownArguments[0]}`);
}

const pathSegments = basePath.split("/").filter(Boolean);
if (!basePath.startsWith("/") || !basePath.endsWith("/") || basePath.includes("\\") ||
		basePath.includes("?") || basePath.includes("#") || pathSegments.some((segment) => segment === "." || segment === "..")) {
	throw new Error("--base-path must be an absolute URL path ending in / without query, fragment, or traversal segments.");
}

if (output === root || !output.startsWith(root + path.sep)) {
	throw new Error("Build output must remain in the generated dist/ directory.");
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(path.join(root, "index.html"), path.join(output, "index.html"));\nawait cp(path.join(root, "ui-preview.html"), path.join(output, "ui-preview.html"));
await cp(path.join(root, "src"), path.join(output, "src"), { recursive: true });
await cp(path.join(root, "public"), output, { recursive: true });

const indexPath = path.join(output, "index.html");
let html = await readFile(indexPath, "utf8");
if (!html.includes("__KITCHAI_BASE_PATH__") || !html.includes("data-preview-only hidden")) {
	throw new Error("The app shell is missing a required static-build placeholder.");
}
html = html.replaceAll("__KITCHAI_BASE_PATH__", basePath);
if (isPreview) html = html.replace("data-preview-only hidden", "data-preview-only");
await writeFile(indexPath, html);\n\nconst uiPreviewPath = path.join(output, "ui-preview.html");\nconst uiPreviewHtml = (await readFile(uiPreviewPath, "utf8")).replaceAll("__KITCHAI_BASE_PATH__", basePath);\nawait writeFile(uiPreviewPath, uiPreviewHtml);

const manifestPath = path.join(output, "manifest.webmanifest");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.id = basePath;
manifest.start_url = basePath;
manifest.scope = basePath;
for (const icon of manifest.icons ?? []) icon.src = `${basePath}favicon.svg`;
await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);

if (isPreview) {
	await cp(indexPath, path.join(output, "404.html"));
	await writeFile(path.join(output, "runtime-config.js"), 'window.KITCHAI_CONFIG = Object.freeze({ supabaseUrl: "", supabaseAnonKey: "" });\n');
}

console.log(`KitchAI ${isPreview ? "static preview" : "app shell"} built to dist/ at ${basePath}`);
