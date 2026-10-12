import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
const basePath = process.env.KITCHAI_BASE_PATH ?? "/";
if (!basePath.startsWith("/") || !basePath.endsWith("/") || basePath.includes("..")) {
  throw new Error("KITCHAI_BASE_PATH must be an absolute path ending in /.");
}
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};
createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const baseWithoutTrailingSlash = basePath === "/" ? "" : basePath.slice(0, -1);
  if (basePath !== "/" && pathname === baseWithoutTrailingSlash) {
    response.writeHead(308, { Location: basePath }).end();
    return;
  }
  if (!pathname.startsWith(basePath)) {
    response.writeHead(404).end("Not found");
    return;
  }
  const relativePath = pathname.slice(basePath.length);
  if (relativePath === "runtime-config.js") {
    const config = {
      supabaseUrl: process.env.KITCHAI_SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.KITCHAI_SUPABASE_ANON_KEY ?? "",
    };
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    response.end("window.KITCHAI_CONFIG = Object.freeze(" + JSON.stringify(config) + ");");
    return;
  }
  const file = path.resolve(root, relativePath || "index.html");
  if (!file.startsWith(root + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[path.extname(file)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    try {
      const notFound = await readFile(path.join(root, "404.html"));
      response.writeHead(404, { "Content-Type": types[".html"] }).end(notFound);
    } catch {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    }
  }
}).listen(4179, "127.0.0.1", () => console.log("KitchAI smoke server listening on http://127.0.0.1:4179"));
