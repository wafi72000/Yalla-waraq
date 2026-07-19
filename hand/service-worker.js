const CACHE_NAME = "hand-game-v87";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/models.js",
  "./js/meld.js",
  "./js/scoring.js",
  "./js/escalation.js",
  "./js/declaration.js",
  "./js/engine.js",
  "./js/declareEngine.js",
  "./js/endingEngine.js",
  "./js/ai.js",
  "./js/sounds.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./assets/faces/heart_1.svg",
  "./assets/faces/heart_2.svg",
  "./assets/faces/heart_3.svg",
  "./assets/faces/heart_4.svg",
  "./assets/faces/heart_5.svg",
  "./assets/faces/heart_6.svg",
  "./assets/faces/heart_7.svg",
  "./assets/faces/heart_8.svg",
  "./assets/faces/heart_9.svg",
  "./assets/faces/heart_10.svg",
  "./assets/faces/heart_jack.svg",
  "./assets/faces/heart_queen.svg",
  "./assets/faces/heart_king.svg",
  "./assets/faces/diamond_1.svg",
  "./assets/faces/diamond_2.svg",
  "./assets/faces/diamond_3.svg",
  "./assets/faces/diamond_4.svg",
  "./assets/faces/diamond_5.svg",
  "./assets/faces/diamond_6.svg",
  "./assets/faces/diamond_7.svg",
  "./assets/faces/diamond_8.svg",
  "./assets/faces/diamond_9.svg",
  "./assets/faces/diamond_10.svg",
  "./assets/faces/diamond_jack.svg",
  "./assets/faces/diamond_queen.svg",
  "./assets/faces/diamond_king.svg",
  "./assets/faces/club_1.svg",
  "./assets/faces/club_2.svg",
  "./assets/faces/club_3.svg",
  "./assets/faces/club_4.svg",
  "./assets/faces/club_5.svg",
  "./assets/faces/club_6.svg",
  "./assets/faces/club_7.svg",
  "./assets/faces/club_8.svg",
  "./assets/faces/club_9.svg",
  "./assets/faces/club_10.svg",
  "./assets/faces/club_jack.svg",
  "./assets/faces/club_queen.svg",
  "./assets/faces/club_king.svg",
  "./assets/faces/spade_1.svg",
  "./assets/faces/spade_2.svg",
  "./assets/faces/spade_3.svg",
  "./assets/faces/spade_4.svg",
  "./assets/faces/spade_5.svg",
  "./assets/faces/spade_6.svg",
  "./assets/faces/spade_7.svg",
  "./assets/faces/spade_8.svg",
  "./assets/faces/spade_9.svg",
  "./assets/faces/spade_10.svg",
  "./assets/faces/spade_jack.svg",
  "./assets/faces/spade_queen.svg",
  "./assets/faces/spade_king.svg",
  "./assets/faces/joker.svg",
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
