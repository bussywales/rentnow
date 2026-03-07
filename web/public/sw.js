const CACHE_NAME = "propatyhub-shell-v1";
const OFFLINE_URL = "/offline";
const OFFLINE_QUERY_PARAM = "from";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
];

const SKIP_CACHE_PATHS = [
  "/api",
  "/auth",
  "/admin",
  "/dashboard",
  "/proxy/auth",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

function isSkippableRequest(url) {
  return SKIP_CACHE_PATHS.some((path) => url.pathname.startsWith(path));
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/icon.svg"
  );
}

function buildOfflinePathWithFrom(url) {
  const fromValue = `${url.pathname}${url.search}`.slice(0, 500);
  const params = new URLSearchParams();
  params.set(OFFLINE_QUERY_PARAM, fromValue);
  return `${OFFLINE_URL}?${params.toString()}`;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isSkippableRequest(url)) return;

  if (request.mode === "navigate") {
    if (url.pathname.startsWith(OFFLINE_URL)) {
      event.respondWith(
        fetch(request).catch(async () => {
          const cachedOffline = await caches.match(request, { ignoreSearch: true });
          if (cachedOffline) return cachedOffline;
          return caches.match(OFFLINE_URL);
        })
      );
      return;
    }

    event.respondWith(
      fetch(request).catch(() => Response.redirect(buildOfflinePathWithFrom(url), 302))
    );
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        try {
          const cached = await cache.match(request);
          if (cached) return cached;
          const response = await fetch(request);
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const fallback = await cache.match(request);
          if (fallback) return fallback;
          return fetch(request);
        }
      })()
    );
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title || "PropatyHub";
  const options = {
    body: payload.body || "You have a new alert.",
    icon: "/icon-192.png",
    badge: "/icon.svg",
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/";
  const normalizedUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === normalizedUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(normalizedUrl);
      }
      return null;
    })
  );
});
