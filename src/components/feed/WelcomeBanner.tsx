"use client";

import { useState } from "react";
import { X, Sparkles, Headphones, Bookmark } from "lucide-react";
import { useIsHydrated } from "@/lib/use-is-hydrated";

const DISMISSED_KEY = "focus_feed_welcome_dismissed";

export default function WelcomeBanner() {
  const isHydrated = useIsHydrated();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DISMISSED_KEY) === "1";
  });

  if (!isHydrated || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  return (
    <section className="relative mb-3 overflow-hidden rounded-2xl border border-(--notion-border) bg-gradient-to-br from-purple-50/80 via-(--notion-bg) to-emerald-50/60 px-4 py-4 dark:from-purple-950/30 dark:via-(--notion-bg) dark:to-emerald-950/20 sm:px-5">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-(--notion-fg)/40 touch-manipulation hover:bg-(--notion-hover) hover:text-(--notion-fg) sm:right-2 sm:top-2 sm:h-8 sm:w-8"
        aria-label="배너 닫기"
      >
        <X size={16} />
      </button>

      <p className="text-sm font-bold text-(--notion-fg)">
        Focus Feed에 오신 것을 환영합니다!
      </p>
      <p className="mt-1 text-xs text-(--notion-fg)/65">
        YouTube와 RSS를 한 곳에서 모아보고, AI가 핵심만 정리해 드립니다.
      </p>

      <div className="mt-3 hidden grid-cols-1 gap-2 sm:grid sm:grid-cols-3">
        <div className="flex items-start gap-2 rounded-xl bg-(--notion-bg)/80 px-3 py-2.5">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-purple-500" />
          <div>
            <p className="text-xs font-semibold text-(--notion-fg)">AI 3줄 요약</p>
            <p className="mt-0.5 text-[11px] text-(--notion-fg)/60">
              영상 카드의 <span className="font-semibold text-purple-600 dark:text-purple-400">AI 요약</span> 버튼을 눌러보세요
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-(--notion-bg)/80 px-3 py-2.5">
          <Headphones size={16} className="mt-0.5 shrink-0 text-emerald-500" />
          <div>
            <p className="text-xs font-semibold text-(--notion-fg)">라디오 모드</p>
            <p className="mt-0.5 text-[11px] text-(--notion-fg)/60">
              영상을 라디오처럼 배경 재생할 수 있어요
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-(--notion-bg)/80 px-3 py-2.5">
          <Bookmark size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="text-xs font-semibold text-(--notion-fg)">북마크</p>
            <p className="mt-0.5 text-[11px] text-(--notion-fg)/60">
              관심 영상을 저장하고 나중에 모아보세요
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
