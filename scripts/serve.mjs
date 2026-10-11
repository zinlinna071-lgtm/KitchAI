import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../dist/", import.meta.url)));
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
  if (pathname === "/runtime-config.js") {
    const config = {
      supabaseUrl: process.env.KITCHAI_SUPABASE_URL ?? "",
      supabaseAnonKey: process.env.KITCHAI_SUPABASE_ANON_KEY ?? "",
    };
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
    response.end("window.KITCHAI_CONFIG = Object.freeze(" + JSON.stringify(config) + ");");
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, "index.html")) {
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
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(4179, "127.0.0.1", () => console.log("KitchAI smoke server listening on http://127.0.0.1:4179"));
