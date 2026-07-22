const CACHE_NAME = "baloot-game-v1";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/ai-scheduler.js",
  "./js/ai.js",
  "./js/app.js",
  "./js/bidding.js",
  "./js/cards.js",
  "./js/deal.js",
  "./js/doubling.js",
  "./js/engine.js",
  "./js/models.js",
  "./js/projects.js",
  "./js/scoring.js",
  "./js/seats.js",
  "./js/sounds.js",
  "./js/speech.js",
  "./js/state.js",
  "./js/trick.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "../shared/assets/faces/heart_7.svg",
  "../shared/assets/faces/heart_8.svg",
  "../shared/assets/faces/heart_9.svg",
  "../shared/assets/faces/heart_10.svg",
  "../shared/assets/faces/heart_jack.svg",
  "../shared/assets/faces/heart_queen.svg",
  "../shared/assets/faces/heart_king.svg",
  "../shared/assets/faces/heart_1.svg",
  "../shared/assets/faces/diamond_7.svg",
  "../shared/assets/faces/diamond_8.svg",
  "../shared/assets/faces/diamond_9.svg",
  "../shared/assets/faces/diamond_10.svg",
  "../shared/assets/faces/diamond_jack.svg",
  "../shared/assets/faces/diamond_queen.svg",
  "../shared/assets/faces/diamond_king.svg",
  "../shared/assets/faces/diamond_1.svg",
  "../shared/assets/faces/club_7.svg",
  "../shared/assets/faces/club_8.svg",
  "../shared/assets/faces/club_9.svg",
  "../shared/assets/faces/club_10.svg",
  "../shared/assets/faces/club_jack.svg",
  "../shared/assets/faces/club_queen.svg",
  "../shared/assets/faces/club_king.svg",
  "../shared/assets/faces/club_1.svg",
  "../shared/assets/faces/spade_7.svg",
  "../shared/assets/faces/spade_8.svg",
  "../shared/assets/faces/spade_9.svg",
  "../shared/assets/faces/spade_10.svg",
  "../shared/assets/faces/spade_jack.svg",
  "../shared/assets/faces/spade_queen.svg",
  "../shared/assets/faces/spade_king.svg",
  "../shared/assets/faces/spade_1.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // طلبات التنقل (فتح الصفحة الرئيسية) تروح للشبكة مباشرة دايماً بدون أي كاش -
  // يمنع مشكلة "Response served by service worker has redirections" نهائياً
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});
