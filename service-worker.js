const CACHE_NAME = "copa-center-v8";
const INDEX_URL = new URL("./index.html", self.registration.scope).toString();
const APP_SHELL = [
  INDEX_URL,
  new URL("./style.css", self.registration.scope).toString(),
  new URL("./app.js", self.registration.scope).toString(),
  new URL("./manifest.json", self.registration.scope).toString(),
  new URL("./icons/icon.svg", self.registration.scope).toString()
];

async function putIfSafe(cache, request, response) {
  if (response && response.ok && !response.redirected) {
    await cache.put(request, response.clone());
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload", redirect: "follow" });
        await putIfSafe(cache, url, response);
      } catch {
        // Evita quebrar a instalação se algum ativo falhar momentaneamente.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => key !== CACHE_NAME ? caches.delete(key) : null));
    await self.clients.claim();
  })());
});

async function navigationResponse(request) {
  try {
    const response = await fetch(request, { cache: "no-store", redirect: "follow" });
    if (response.ok && !response.redirected) return response;
  } catch {
    // Usa fallback abaixo.
  }

  try {
    const indexResponse = await fetch(INDEX_URL, { cache: "no-store", redirect: "follow" });
    if (indexResponse.ok && !indexResponse.redirected) {
      const cache = await caches.open(CACHE_NAME);
      await putIfSafe(cache, INDEX_URL, indexResponse);
      return indexResponse;
    }
  } catch {
    // Usa cache abaixo.
  }

  const cached = await caches.match(INDEX_URL);
  if (cached && !cached.redirected) return cached;

  return new Response("<!doctype html><title>Copa Center</title><p>Não foi possível abrir o app. Verifique a conexão e tente novamente.</p>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store", redirect: "follow" });
    await putIfSafe(cache, request, response);
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached && !cached.redirected) return cached;
    throw new Error("Recurso indisponível");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (url.pathname.endsWith("/data/copa2026.json") || url.pathname.endsWith("/data/api-football-status.json")) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached && !cached.redirected) return cached;

    const response = await fetch(request, { redirect: "follow" });
    const cache = await caches.open(CACHE_NAME);
    await putIfSafe(cache, request, response);
    return response;
  })());
});
