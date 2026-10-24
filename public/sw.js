const CACHE = "card-tally-offline-v1";
const OFFLINE = "/offline.html";
// Cache only public installation assets. Never store credentials or ledger API data.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          OFFLINE,
          "/icons/apple-touch-icon.png",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith("card-tally-offline-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin)
    return;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  if (
    [
      "/icons/apple-touch-icon.png",
      "/icons/icon-192.png",
      "/icons/icon-512.png",
    ].includes(url.pathname)
  ) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    );
    return;
  }
  // Fetch the current HTML every time; updates never reuse an old application shell.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(event.request, {
          signal: controller.signal,
        });
        if (response.status >= 500) throw new Error("Server unavailable");
        return response;
      } catch {
        return (await caches.match(OFFLINE)) || Response.error();
      } finally {
        clearTimeout(timer);
      }
    })(),
  );
});
