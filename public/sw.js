const SHELL_CACHE = "training-tracker-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(["/", "/manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("training-tracker-shell-") && key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isLoggerShell = url.pathname === "/" || url.pathname === "/log" || url.pathname === "/log/";
  const isAsset = url.pathname.startsWith("/assets/") || url.pathname === "/manifest.webmanifest";
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    (event.request.mode === "navigate" && !isLoggerShell) ||
    (event.request.mode !== "navigate" && !isAsset)
  ) {
    return;
  }

  const isNavigation = event.request.mode === "navigate";
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          return isNavigation ? caches.match("/") : Response.error();
        }),
      ),
  );
});
