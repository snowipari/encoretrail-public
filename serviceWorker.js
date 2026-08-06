// serviceWorker.js
// アプリシェルをキャッシュし、オフラインでも起動できるようにする最小構成。
// データそのものはlocalStorageにあるため、ここでは静的ファイルのみを扱う。

const CACHE_NAME = "encoreTrail-v10";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/appStyles.css",
  "./js/presentation/main.js",
  "./js/presentation/liveRecords/recordList.js",
  "./js/presentation/liveRecords/recordForm.js",
  "./js/presentation/liveRecords/statsView.js",
  "./js/presentation/liveRecords/setlistView.js",
  "./js/presentation/lottery/lotteryList.js",
  "./js/presentation/lottery/lotteryForm.js",
  "./js/presentation/oshi/oshiList.js",
  "./js/presentation/oshi/oshiForm.js",
  "./js/presentation/fanClub/fanClubList.js",
  "./js/presentation/fanClub/fanClubForm.js",
  "./js/presentation/calendar/calendarView.js",
  "./js/integration/liveRecords/recordStore.js",
  "./js/integration/liveRecords/musicSearchAdapter.js",
  "./js/integration/lottery/lotteryStore.js",
  "./js/integration/oshi/oshiProfileStore.js",
  "./js/integration/oshi/wikidataAdapter.js",
  "./js/integration/fanClub/fanClubStore.js",
  "./js/integration/calendar/calendarEventStore.js",
  "./js/integration/calendar/calendarAdapters/gmailNewsletterAdapter.js",
  "./js/integration/calendar/calendarAdapters/officialSiteAdapter.js",
  "./js/integration/calendar/calendarAdapters/calendarAdapter.js",
  "./js/integration/backup/backupUtils.js",
  "./js/integration/backupRegistry.js",
  "./js/integration/oshiCleanupRegistry.js",
  "./js/integration/appearanceStore.js",
  "./js/presentation/appearance/appearanceView.js",
  "./js/businessLogic/colorContrast.js",
  "./js/businessLogic/domUtils.js",
  "./js/businessLogic/liveRecords/statsUtils.js",
  "./js/businessLogic/liveRecords/setlistUtils.js",
  "./js/businessLogic/lottery/lotteryUtils.js",
  "./js/businessLogic/oshi/oshiUtils.js",
  "./js/businessLogic/calendar/notificationRules.js",
  "./js/businessLogic/calendar/calendarEventMerger.js",
  "./js/types.js",
  "./manifest.json",
  "./icons/icon192.png",
  "./icons/icon512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
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

// キャッシュ優先、なければネットワーク取得し次回用にキャッシュへ保存
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
    })
  );
});
