---
id: PAT-001
패턴명: 개발 환경 서비스워커가 옛 정적 자산(CSS/JS)을 cache-first로 서빙해 변경이 반영되지 않음
카테고리: browser-api
증상: |
  코드를 고쳐도 브라우저에 반영 안 됨. 특히 새로 추가한 클래스/스타일이 "무시"되어
  버튼이 스타일 없이(흰 배경·투명) 보이거나, 일부만 갱신되고 일부는 옛 모습. HTML(구조)은
  최신인데 CSS/JS만 옛 것 → "클래스는 붙었는데 규칙이 없는" 상태. 일반 새로고침으로도 지속.
원인: |
  PWA 서비스워커가 개발 환경에서도 등록되어 있고, `/_next/static/`(또는 빌드 청크) 같은 정적
  자산을 cache-first 전략으로 캐싱한다. dev 빌드는 청크 URL이 비교적 고정이라, 한 번 캐시되면
  새 빌드의 CSS/JS를 다시 가져오지 않고 옛 캐시를 그대로 응답한다. HTML이 network-first면
  구조는 최신이지만 스타일/스크립트만 stale → 부분 반영처럼 보여 디버깅이 꼬인다.
  (헤드리스 스크린샷은 SW가 없어 정상으로 보이고, 실제 사용자 브라우저만 깨져 재현이 어렵다.)
해결: |
  1) 서비스워커를 프로덕션에서만 등록. 개발(`process.env.NODE_ENV !== "production"`)에서는
     등록하지 말고, 이미 등록된 SW를 `navigator.serviceWorker.getRegistrations()` →
     `unregister()`, `caches.keys()` → `caches.delete()`로 정리한다(다음 로드부터 최신).
  2) 이미 stuck된 클라이언트는 1회 강제 정리 필요: 시크릿 창으로 열거나,
     DevTools → Application → "Clear site data"/Service Workers Unregister 후 새로고침.
  3) 디버깅 팁: 같은 화면이 헤드리스(크롬 --headless, SW 없음)에서는 정상인데 실제 브라우저에서만
     깨지면 SW 캐시를 1순위로 의심. computed style을 실측해 "클래스는 있는데 규칙이 없는지" 확인.
적용조건: PWA(서비스워커) + 해시 URL이 고정적인 dev 번들러(Next dev 등)를 쓰는 모든 웹앱.
출처프로젝트: youtube-summary (Focus Feed)
태그: [pwa, service-worker, cache, next-dev, stale-assets, css, debugging]
발견일: 2026-06-24
출처DevLog: docs/devlog/2026-06-24-mobile-ux-overhaul.md
---

# PAT-001 — 개발 환경 서비스워커 stale 자산

## 한 줄
**dev에서 PWA 서비스워커가 옛 CSS/JS를 cache-first로 서빙 → 코드 변경이 사용자 브라우저에만 반영 안 됨.** SW는 프로덕션에서만 등록하고, dev에서는 등록 차단 + 기존 SW/캐시 정리.

## 재현
1. PWA 앱을 dev로 띄워 한 번 방문(SW 등록·정적 자산 캐시).
2. 새 Tailwind 유틸(예: `bg-purple-600`)을 코드에 추가.
3. 새로고침 → HTML엔 클래스가 있으나 CSS 청크는 옛 캐시라 해당 규칙이 없음 → 버튼이 스타일 없이 흰색/투명.

## 안티패턴 → 패턴
```tsx
// ❌ dev에서도 SW 등록 → stale 자산
navigator.serviceWorker.register("/sw.js");

// ✅ prod만 등록, dev는 정리
if (process.env.NODE_ENV !== "production") {
  navigator.serviceWorker.getRegistrations()
    .then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  caches?.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
  return;
}
navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
```

## 핵심 교훈
- **"부분만 반영"(구조 최신 + 스타일 옛것)은 SW 캐시의 전형.** HTML network-first + 정적 cache-first 조합이 만든다.
- **헤드리스 정상 / 실브라우저 깨짐 = 클라이언트 캐시(SW) 1순위 의심.** computed style 실측이 빠른 판별법.
