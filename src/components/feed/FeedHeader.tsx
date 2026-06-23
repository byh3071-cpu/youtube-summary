"use client";

import React from "react";
import RefreshButton from "@/components/ui/RefreshButton";
import ConnectionStatusPopup from "@/components/feed/ConnectionStatusPopup";
import type { YouTubeFetchStatus } from "@/lib/youtube";

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

  return (
    <section
      className={
        selectedSource
          ? "mb-0 border-0 rounded-none bg-white dark:bg-(--notion-bg) px-4 py-4 sm:px-6 sm:py-5"
          : "mb-3 px-1"
      }
    >
      <div className="flex flex-row items-center justify-between gap-3">
        <div className="min-w-0">
          {selectedSource ? (
            <h1 className="mb-0 text-xl font-bold tracking-tight sm:text-2xl">
              <span className="truncate">{selectedSource.name}</span>
            </h1>
          ) : (
            // 글로벌 피드: 히어로 일러스트·워드마크 제거(상단 정리). 카운트만 슬림하게 노출.
            <span className="rounded-full border border-(--notion-border) bg-(--notion-bg)/80 px-3 py-1 text-[11px] text-(--notion-fg)/60">
              총 {visibleItemsCount}개
            </span>
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
