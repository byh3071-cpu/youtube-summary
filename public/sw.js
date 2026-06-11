// Focus Feed Service Worker
// 정책 (2026-06-11 QA 후속):
// - navigation(HTML): network 우선, 캐시에 저장하지 않음(오래된 HTML + 새 청크 조합으로 인한
//   ChunkLoadError 방지). 네트워크 실패 시에만 정적 /offline.html 사용.
// - /_next/static/ 해시 자산: cache-first (내용 불변).
// - 이미지 등 일반 정적 자산: stale-while-revalidate.
// - API·인증·RSC·서버 액션은 어떤 경우에도 캐시하지 않음.
const VERSION = "v2";
const STATIC_CACHE = `focus-feed-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/app.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

const STATIC_ASSET_RE = /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest)$/;

function shouldBypass(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  // API·인증 경로는 SW가 절대 다루지 않는다.
  if (url.pathname.startsWith("/api/")) return true;
  if (url.pathname.startsWith("/auth/")) return true;
  // RSC 페이로드·라우터 프리페치는 캐시 금지.
  if (url.searchParams.has("_rsc")) return true;
  if (request.headers.get("RSC")) return true;
  if (request.headers.get("next-router-prefetch")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (shouldBypass(request, url)) return;

  // 1) HTML navigation: network 우선, HTML은 캐시하지 않음. 실패 시 정적 오프라인 페이지.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  // 2) 해시가 포함된 빌드 자산: cache-first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  // 3) 이미지 등 일반 정적 자산: stale-while-revalidate. 정상 응답만 저장.
  if (STATIC_ASSET_RE.test(url.pathname) || url.pathname.startsWith("/_next/image")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => undefined);
        if (cached) return cached;
        return network.then((response) => response || Response.error());
      }),
    );
    return;
  }

  // 4) 그 외 요청은 네트워크에 그대로 맡긴다.
});
