// 앱 셸 캐싱 — 통신이 불안정한 현장에서도 화면이 뜨도록.
// 캐시 이름을 바꾸면 기존 캐시가 폐기되고 새 화면으로 교체된다.
const CACHE = "ansim-shell-v2";
const SHELL = ["/", "/index.html", "/apple-touch-icon.png", "/favicon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API 응답과 개발 서버 모듈은 캐시하지 않는다(항상 최신 코드·데이터를 받도록).
  if (
    e.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/@") ||
    url.pathname.startsWith("/node_modules/")
  ) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // 같은 출처 정적 자원만 캐시 갱신
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match("/index.html")))
  );
});
