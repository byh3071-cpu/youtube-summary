"use client";

import { useEffect } from "react";

export default function PwaInstaller() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 개발 환경에서는 서비스워커를 등록하지 않는다.
    // sw.js 가 /_next/static 청크를 cache-first 로 캐싱하는데, dev 빌드는 URL 이 비교적 고정이라
    // 새로 추가한 Tailwind 유틸(예: bg-purple-600)이 옛 CSS 청크에 없어 "스타일 없는 흰 버튼"으로 보이는 등
    // 변경이 반영되지 않는 stale 문제가 생긴다. 그래서 dev 에서는 등록을 막고,
    // 이미 등록돼 있던 SW 와 캐시를 정리해 다음 로드부터 항상 최신 자산을 받게 한다.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (typeof caches !== "undefined") {
        caches
          .keys()
          .then((keys) => keys.forEach((k) => caches.delete(k)))
          .catch(() => {});
      }
      return;
    }

    // 프로덕션: 정상 등록. updateViaCache:"none" — sw.js 자체가 HTTP 캐시에 묶여 새 배포가 늦게 반영되는 것 방지.
    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      } catch (e) {
        console.error("[PWA] service worker register failed", e);
      }
    };

    register();
  }, []);

  return null;
}
