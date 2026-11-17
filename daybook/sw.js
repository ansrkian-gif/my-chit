const CACHE = "daybook-v8";
const BOOK_CACHE = "daybook-book-v1";
const BOOK_KEY_URL = "./daybook-last-book.json";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(["./icon.svg"])));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE && k !== BOOK_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "daybook-set-book" && data.bookId) {
    event.waitUntil(
      caches.open(BOOK_CACHE).then((cache) =>
        cache.put(
          BOOK_KEY_URL,
          new Response(JSON.stringify({ bookId: data.bookId }), {
            headers: { "Content-Type": "application/json" },
          })
        )
      )
    );
  }
});

async function rememberedBookId() {
  try {
    const cached = await caches.open(BOOK_CACHE).then((c) => c.match(BOOK_KEY_URL));
    if (!cached) return "";
    const body = await cached.json();
    return body.bookId || "";
  } catch {
    return "";
  }
}

function isAppNavigation(url) {
  const path = url.pathname;
  return (
    path.endsWith("/daybook/") ||
    path.endsWith("/daybook") ||
    path.endsWith("/daybook/index.html")
  );
}

// Network-first for app shell so updates never trap users on a stale build.
// Bare Home Screen launches (no ?book=) redirect to the last known book id.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && isAppNavigation(url) && !url.searchParams.get("book")) {
    event.respondWith(
      (async () => {
        const bookId = await rememberedBookId();
        if (bookId) {
          const next = new URL(request.url);
          next.searchParams.set("book", bookId);
          return Response.redirect(next.toString(), 302);
        }
        return fetch(request);
      })()
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response.ok &&
          (url.pathname.endsWith(".svg") || url.pathname.endsWith(".webmanifest"))
        ) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          return caches.match("./index.html");
        }
        throw new Error("offline");
      })
  );
});
