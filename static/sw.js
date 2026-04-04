const CACHE_NAME = 'simplex-directory-v1';

// On install: cache the app shell (the root HTML) and activate immediately.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.add('/'))
            .then(() => self.skipWaiting())
    );
});

// On activate: remove stale caches from previous versions.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

// Fetch: network-first with cache fallback for same-origin requests.
// External requests (Supabase, Sentry, …) are passed through unchanged.
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                const response = await fetch(event.request);
                if (response && response.ok) {
                    cache.put(event.request, response.clone());
                }
                return response;
            } catch {
                const cached = await cache.match(event.request);
                if (cached) return cached;

                // For SPA navigation fall back to the cached root HTML.
                if (event.request.mode === 'navigate') {
                    const root = await cache.match('/');
                    if (root) return root;
                }

                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            }
        })()
    );
});
