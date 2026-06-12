// Focus Feed Service Worker
// 정책 (2026-06-11 QA 후속):
// - navigation(HTML): network 우선, 캐시에 저장하지 않음(오래된 HTML + 새 청크 조합으로 인한
//   ChunkLoadError 방지). 네트워크 실패 시에만 정적 /offline.html 사용.
// - /_next/static/ 해시 자산: cache-first (내용 불변).
// - 이미지 등 일반 정적 자산: stale-while-revalidate.
// - API·인증·RSC·서버 액션은 어떤 경우에도 캐시하지 않음.
//
// 캐시는 3개로 분리한다 (FIX-6, 무한 누적 방지):
// - PRECACHE: 오프라인 fallback·아이콘. 절대 트림하지 않음(offline.html이 evict되면 안 됨).
// - STATIC : /_next/static 해시 청크. 배포가 쌓일수록 누적되므로 항목 수 상한으로 트림.
// - IMG    : 이미지·/_next/image 변형. 상한으로 트림.
const VERSION = "v3";
const PRECACHE = `focus-feed-precache-${VERSION}`;
const STATIC_CACHE = `focus-feed-static-${VERSION}`;
const IMG_CACHE = `focus-feed-img-${VERSION}`;
const KEEP_CACHES = new Set([PRECACHE, STATIC_CACHE, IMG_CACHE]);

const MAX_STATIC_ENTRIES = 100; // 해시 청크 (여러 배포분 일부 보존)
const MAX_IMG_ENTRIES = 150; // 채널 아바타·썸네일 등

const OFFLINE_URL = "/offline.html";
const PRECACHE_URLS = [OFFLINE_URL, "/app.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !KEEP_CACHES.has(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

// Cache Storage는 삽입 순서를 보존하므로, 상한 초과 시 가장 오래된 항목부터 제거한다(LRU 근사).
async function putAndTrim(cacheName, request, response, maxEntries) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  for (let i = 0; i < overflow; i++) {
    await cache.delete(keys[i]);
  }
}

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

  // 2) 해시가 포함된 빌드 자산: cache-first + 상한 트림.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            event.waitUntil(putAndTrim(STATIC_CACHE, request, response.clone(), MAX_STATIC_ENTRIES));
          }
          return response;
        });
      }),
    );
    return;
  }

  // 3) 이미지 등 일반 정적 자산: stale-while-revalidate + 상한 트림. 정상 응답만 저장.
  if (STATIC_ASSET_RE.test(url.pathname) || url.pathname.startsWith("/_next/image")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              event.waitUntil(
                putAndTrim(IMG_CACHE, request, response.clone(), MAX_IMG_ENTRIES),
              );
            }
            return response;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })(),
    );
    return;
  }

  // 4) 그 외 요청은 네트워크에 그대로 맡긴다.
});
