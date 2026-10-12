const CACHE_NAME = "kitchai-shell-v9";
const APP_SHELL = [
	"",
	"index.html",
	"src/app.js",
	"src/local-store.js",
	"src/business-data-store.js",
	"src/ingredient-store.js",
	"src/menu-item-store.js",
	"src/recipe-store.js",
	"src/sync-store.js",
	"src/sync-engine.js",
	"src/supabase-api.js",
	"runtime-config.js",
	"src/styles.css",
	"manifest.webmanifest",
	"favicon.svg",
].map((asset) => new URL(asset, self.registration.scope).toString());
const INDEX_URL = new URL("index.html", self.registration.scope).toString();

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then((cache) => cache.addAll(APP_SHELL))
			.then(() => self.skipWaiting()),
	);
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys()
			.then((names) => Promise.all(
				names.filter((name) => name.startsWith("kitchai-shell-") && name !== CACHE_NAME)
					.map((name) => caches.delete(name)),
			))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;
	if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					if (response.ok) {
						const copy = response.clone();
						void caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, copy));
					}
					return response;
				})
				.catch(async () => (await caches.match(request)) || (await caches.match(INDEX_URL)) || Response.error()),
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cached) => {
			if (cached) return cached;
			return fetch(request).then((response) => {
				if (response.ok && response.type === "basic") {
					const copy = response.clone();
					void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
				}
				return response;
			});
		}),
	);
});
