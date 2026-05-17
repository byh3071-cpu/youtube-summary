"use client";

import React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import RefreshButton from "@/components/ui/RefreshButton";
import ConnectionStatusPopup from "@/components/feed/ConnectionStatusPopup";
import type { YouTubeFetchStatus } from "@/lib/youtube";
import { useIsHydrated } from "@/lib/use-is-hydrated";

interface FeedHeaderProps {
  selectedSource?: { id: string; name: string; type: "YouTube" | "RSS" };
  visibleItemsCount: number;
  sourceStatus: { youtube: YouTubeFetchStatus; rss: "ready" | "request_failed" };
}

const youtubeNoticeMessage: Record<YouTubeFetchStatus, (selected: FeedHeaderProps["selectedSource"]) => string> = {
  missing_api_key: (selected) => selected
    ? `현재 ${selected.name} 채널을 불러오려면 YouTube 연동이 필요합니다.`
    : "YouTube 연동이 설정되지 않아 RSS 소스만 표시하고 있습니다.",
  invalid_api_key: (selected) => selected
    ? `현재 ${selected.name} 채널을 불러올 수 없습니다. 연동 설정을 확인해 주세요.`
    : "YouTube 연동에 문제가 있어 RSS 소스만 표시하고 있습니다. 잠시 후 다시 시도해 주세요.",
  request_failed: (selected) => selected
    ? `현재 ${selected.name} 채널을 불러오지 못하고 있습니다. 잠시 후 다시 시도해 주세요.`
    : "YouTube 소스를 잠시 불러오지 못해 RSS만 표시하고 있습니다. 잠시 후 다시 시도해 주세요.",
  ready: () => "",
};

export default function FeedHeader({
  selectedSource,
  visibleItemsCount,
  sourceStatus,
}: FeedHeaderProps) {
  const showYoutubeNotice = sourceStatus.youtube !== "ready" && (!selectedSource || selectedSource.type === "YouTube");
  const isHydrated = useIsHydrated();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const heroSrc = !isHydrated
    ? "/images/hero/hero-illustration3.png"
    : isDark
      ? "/images/hero/hero-illustration_dark4.png"
      : "/images/hero/hero-illustration3.png";

  return (
    <section
      className={
        selectedSource
          ? "mb-0 border-0 rounded-none bg-white dark:bg-(--notion-bg) px-4 py-4 sm:px-6 sm:py-5"
          : "mb-4 rounded-3xl border border-(--notion-border) bg-linear-to-b from-(--notion-bg) to-(--notion-gray) p-5 sm:mb-5 sm:p-7"
      }
    >
      <div className={`flex ${selectedSource ? "flex-row items-center justify-between gap-4" : "flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"}`}>
        <div className="min-w-0">
          {selectedSource ? (
            <h1 className="mb-0 text-xl font-bold tracking-tight sm:text-2xl">
              <span className="truncate">{selectedSource.name}</span>
            </h1>
          ) : (
            <>
              <div className="mb-3 mt-3 -ml-4">
                <div className="relative h-9 w-[180px] sm:h-11 sm:w-[220px]">
                  <Image
                    src="/focus-feed-wordmark-v5.png"
                    alt="Focus Feed 로고"
                    fill
                    sizes="220px"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
              <div className="mt-2 hidden sm:block">
                <div className="relative h-32 w-full max-w-[420px]">
                  <Image
                    src={heroSrc}
                    alt="텍스트 중심 피드와 라디오 플레이어를 함께 보여주는 Focus Feed 히어로 일러스트"
                    fill
                    sizes="(min-width: 768px) 420px, 100vw"
                    className="object-contain"
                    priority
                  />
                </div>
              </div>
            </>
          )}

          {!selectedSource && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-(--notion-fg)/60">
              <span className="rounded-2xl border border-(--notion-border) bg-(--notion-bg)/80 px-3 py-1.5">
                총 {visibleItemsCount}개
              </span>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <ConnectionStatusPopup selectedSource={selectedSource} sourceStatus={sourceStatus} />
          <RefreshButton />
        </div>
      </div>

      {showYoutubeNotice && (
        <div className="mt-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg)/70 px-4 py-3 text-sm leading-relaxed text-(--notion-fg)/65">
          {youtubeNoticeMessage[sourceStatus.youtube](selectedSource)}
        </div>
      )}
    </section>
  );
}
