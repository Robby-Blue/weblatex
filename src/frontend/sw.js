const CACHE_NAME = "weblatex_cache";
const urlsToCache = [
    "/styles.css",
    "/menu.css",
    "/projects/explorer",
    "/projects/explorer.css",
    "/projects/explorer.js",
    "/projects/editor",
    "/projects/editor.css",
    "/projects/editor/script.js",
    "/projects/editor/code-editor.js",
    "/projects/editor/file-system.js",
    "/projects/editor/latex-tokenizer.js",
    "/projects/editor/shortcuts.js",
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("fetch", event => {
    event.respondWith((async () => {
        const url = new URL(event.request.url);
        if (url.pathname == "/projects/explorer/" || url.pathname.startsWith("/projects/explorer/")) {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(new Request("/projects/explorer"));
            if (cachedResponse) {
                return cachedResponse;
            }
        }

        const cached = await caches.match(event.request);
        if (cached && !isAPICall(url.pathname)) {
            return cached;
        }
        try {
            const response = await fetch(event.request);
            if (isAPICall(url.pathname)) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, response.clone());
            }
            return response;
        } catch (err) {
            // offline trying to open
            if (url.pathname == "/") {
                return Response.redirect("/projects/explorer", 302)
            }
            return cached;
        }
    })());
});

function isAPICall(path) {
    if (path == "/api/projects") {
        return true
    }
    if (path == "/api/projects/files") {
        return true
    }
    if (path == "/api/account") {
        return true
    }
    return false
}