"use client";

import { useEffect } from "react";

export default function PwaInstaller() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // 로컬 개발 환경에서도 등록 (localhost / 로컬 IP)
    const register = async () => {
      try {
        // updateViaCache: "none" — sw.js 자체가 HTTP 캐시에 묶여 새 배포가 늦게 반영되는 것을 방지.
        await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      } catch (e) {
        console.error("[PWA] service worker register failed", e);
      }
    };

    register();
  }, []);

  return null;
}

