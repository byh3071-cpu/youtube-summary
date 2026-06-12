"use client";

import { useEffect } from "react";

// 중첩 모달을 고려한 카운터 방식: 첫 잠금에서 스타일 저장, 마지막 해제에서 복구.
let lockCount = 0;
let savedScrollY = 0;
// 잠금 시점의 경로. 모달이 열린 채 라우트가 바뀌면(뒤로가기 등) 복구 시 scrollTo로
// 새 페이지를 옛 오프셋으로 끌어내리지 않도록, 같은 경로일 때만 스크롤을 복원한다.
let savedPathname = "";
let savedStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  lockCount += 1;
  if (lockCount > 1) return;

  const body = document.body;
  savedScrollY = window.scrollY;
  savedPathname = window.location.pathname;
  savedStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  // position: fixed — iOS 사파리에서도 배경 스크롤·러버밴드를 차단하고 위치를 보존.
  body.style.position = "fixed";
  body.style.top = `-${savedScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;

  const body = document.body;
  if (savedStyles) {
    body.style.position = savedStyles.position;
    body.style.top = savedStyles.top;
    body.style.left = savedStyles.left;
    body.style.right = savedStyles.right;
    body.style.width = savedStyles.width;
    body.style.overflow = savedStyles.overflow;
    savedStyles = null;
  }
  // 잠금 이후 경로가 바뀌었다면(라우트 전환 중 언마운트) 새 페이지의 스크롤은 건드리지 않는다.
  if (window.location.pathname === savedPathname) {
    window.scrollTo(0, savedScrollY);
  }
}

/** active 동안 body 스크롤을 잠그고, 비활성/언마운트 시 원래 위치로 복구한다. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [active]);
}
