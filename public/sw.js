const CACHE_NAME = "kitchai-shell-v15";
const APP_SHELL = [
	"",
	"index.html",
	"src/app.js",
	"src/approved-ui-adapter.js",
	"src/stock-count-ui.js",
	"src/stock-count-store.js",
	"src/stock-count-domain.js",
	"src/finished-stock-domain.js",
	"src/finished-stock-store.js",
	"src/finished-stock-workflow-store.js",
	"src/inventory-domain.js",
	"src/production-batch-store.js",
	"src/purchase-domain.js",
	"src/purchase-store.js",
	"src/purchase-ui.js",
	"src/recipe-quantity-adapter.js",
	"src/local-store.js",
	"src/business-data-store.js",
	"src/ingredient-store.js",
	"src/menu-item-store.js",
	"src/recipe-store.js",
	"src/phase2-sync-engine.js",
	"src/sync-store.js",
	"src/sync-engine.js",
	"src/supabase-api.js",
	"runtime-config.js",
	"src/styles.css",
	"src/ui-preview.css",
	"src/ui-preview-chat-composer.css",
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
