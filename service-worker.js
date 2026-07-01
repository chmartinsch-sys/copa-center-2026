const CACHE_PREFIX = "copa-center";

async function cleanup() {
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => key.startsWith(CACHE_PREFIX) ? caches.delete(key) : null));

  const registrations = await self.registration.unregister();
  const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

  for (const client of clientsList) {
    if (client.url && new URL(client.url).origin === self.location.origin) {
      client.navigate(new URL("/", self.location.origin).toString());
    }
  }

  return registrations;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cleanup());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(cleanup());
});

self.addEventListener("fetch", () => {
  // Service worker desativado de propósito.
  // Não intercepta navegação nem arquivos do app.
});
