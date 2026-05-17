"use client";

import Image from "next/image";
import type { FeedItem } from "@/types/feed";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { loadVideoSummary } from "@/lib/focus-feed-storage";

export interface TodayFocusEntry {
  item: FeedItem;
  priority: number;
  score: number;
  why: string;
  action: string;
}

interface Props {
  entry: TodayFocusEntry;
}

export default function TodayFocusCard({ entry }: Props) {
  const radio = useRadioQueueOptional();
  const { item, score, why, action } = entry;

  const handlePlay = () => {
    if (!radio) return;
    if (item.source !== "YouTube" || !item.id) return;

    const videoId = item.id;
    const title = item.title;

    const existsIndex = radio.queue.findIndex((q) => q.videoId === videoId);

    if (existsIndex >= 0) {
      radio.setCurrentIndex(existsIndex);
      radio.play();
      return;
    }

    const summary = loadVideoSummary(videoId);

    radio.addToQueue({
      videoId,
      title,
      ...(summary ? { summary } : {}),
    });

    const newIndex = radio.queue.length;
    radio.setCurrentIndex(newIndex);
    radio.play();
  };

  const hasThumbnail = !!item.thumbnail;

  return (
    <section className="mb-3 rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-4 sm:p-5">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 rounded-full bg-(--notion-gray)/60 px-2.5 py-1 font-semibold text-(--notion-fg)/80">
          오늘 집중 영상
        </span>
        <span className="text-(--notion-fg)/55">적합도 {Math.round(score)}점</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handlePlay}
          className={`group relative overflow-hidden rounded-xl bg-(--notion-gray) text-left sm:w-[220px] ${
            hasThumbnail ? "aspect-video" : "h-32"
          }`}
        >
          {hasThumbnail ? (
            <Image
              src={item.thumbnail as string}
              alt={item.title}
              fill
              sizes="220px"
              className="object-cover transition-transform group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-(--notion-fg)/40">
              썸네일 없음
            </div>
          )}
          <div className="absolute inset-x-2 bottom-2 text-[11px] font-semibold text-white drop-shadow">
            라디오 재생
          </div>
        </button>

        <div className="flex-1 space-y-1.5">
          <button
            type="button"
            onClick={handlePlay}
            className="block text-left text-sm font-semibold leading-snug text-(--notion-fg) underline-offset-2 hover:underline"
          >
            {item.title}
          </button>
          <p className="text-[12px] leading-relaxed text-(--notion-fg)/75 line-clamp-2">
            {why}
          </p>
          <p className="text-[12px] leading-relaxed text-(--notion-fg)/70 line-clamp-2">
            <span className="font-semibold">이번 주 액션:</span> {action}
          </p>
        </div>
      </div>
    </section>
  );
}

