"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CheckCircle2, RotateCcw, MoreHorizontal } from "lucide-react";
import { FeedItem as FeedItemType } from "@/types/feed";
import AddToRadioButton from "./AddToRadioButton";
import BookmarkButton from "./BookmarkButton";
import ContentStateControl from "./ContentStateControl";
import SummarizeButton from "./SummarizeButton";
import InsightButton from "./InsightButton";
import { DeepDiveButton } from "./VideoDigestDrawer";
import type { BookmarkEntry } from "./FeedClientContainer";
import type { ContentStateInfo } from "@/app/actions/content-state";
import { getWatchProgress } from "@/lib/watch-history";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { useIsHydrated } from "@/lib/use-is-hydrated";

function formatTimeAgo(pubDate: string): string {
  const date = new Date(pubDate);
  if (!Number.isFinite(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const min = 60 * 1000;
  const hour = 60 * min;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  if (diff < min) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / min)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < week) return `${Math.floor(diff / day)}일 전`;
  if (diff < month) return `${Math.floor(diff / week)}주 전`;
  return `${Math.floor(diff / month)}개월 전`;
}

interface Props {
  item: FeedItemType;
  bookmark?: BookmarkEntry | null;
  onBookmarkChange?: () => void;
  contentState?: ContentStateInfo;
  onContentStateChange?: () => void;
}

function formatSeconds(sec: number): string {
  const total = Math.max(0, Math.floor(sec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function YouTubeCard({ item, bookmark, onBookmarkChange, contentState, onContentStateChange }: Props) {
  const radio = useRadioQueueOptional();
  const [menuOpen, setMenuOpen] = useState(false);
  const isHydrated = useIsHydrated();
  // Date.now() 기반 timeAgo는 서버/클라이언트 시간이 달라 hydration 에러(#418)를 유발.
  // hydration 이후에만 계산하여 서버·클라이언트 초기 렌더를 일치시킴.
  const timeAgo = isHydrated ? formatTimeAgo(item.pubDate) : "";

  const storedProgress = isHydrated && item.id ? getWatchProgress(item.id) : null;
  const playback = radio?.playback;

  let baseDuration: number | null = null;
  if (playback && playback.videoId === item.id && playback.durationSeconds > 0) {
    baseDuration = playback.durationSeconds;
  } else if (storedProgress?.durationSeconds && storedProgress.durationSeconds > 0) {
    baseDuration = storedProgress.durationSeconds;
  } else if (typeof item.durationSeconds === "number" && item.durationSeconds > 0) {
    baseDuration = item.durationSeconds;
  }

  let progressSeconds: number | null = null;
  if (playback && playback.videoId === item.id && playback.positionSeconds > 0) {
    progressSeconds = playback.positionSeconds;
  } else if (storedProgress?.lastPositionSeconds && storedProgress.lastPositionSeconds > 0) {
    progressSeconds = storedProgress.lastPositionSeconds;
  }

  const completed =
    storedProgress?.completed === true ||
    (playback?.videoId === item.id && playback?.completed === true);

  const progressRatio = useMemo(() => {
    if (!progressSeconds || !baseDuration || baseDuration <= 0) return 0;
    return Math.min(1, Math.max(0, progressSeconds / baseDuration));
  }, [progressSeconds, baseDuration]);

  const resumeHref = useMemo(() => {
    const fallback = item.id
      ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`
      : null;
    const base = item.link || fallback;
    if (!base) return null;
    if (!progressSeconds || completed) return base;
    const sep = base.includes("?") ? "&" : "?";
    const t = Math.max(0, Math.floor(progressSeconds));
    return `${base}${sep}t=${t}s`;
  }, [item.id, item.link, progressSeconds, completed]);

  const durationLabel = useMemo(() => {
    if (!baseDuration || baseDuration <= 0) return null;
    return formatSeconds(baseDuration);
  }, [baseDuration]);

  const formLabel = useMemo(() => {
    if (!baseDuration || baseDuration <= 0) return null;
    const total = baseDuration;
    const isShort = total <= 90; // 1분 30초 이하면 숏폼 느낌으로 표시
    return isShort ? "숏폼" : "롱폼";
  }, [baseDuration]);

  return (
    <article className="group flex flex-col bg-transparent px-2 sm:px-3">
      <a
        href={resumeHref ?? undefined}
        target={resumeHref ? "_blank" : undefined}
        rel={resumeHref ? "noopener noreferrer" : undefined}
        className={`flex flex-1 flex-col${!resumeHref ? " pointer-events-none" : ""}`}
        aria-label={`${item.sourceName} - ${item.title}`}
        tabIndex={resumeHref ? undefined : -1}
      >
        <div className="relative w-full shrink-0 overflow-hidden rounded-lg bg-(--notion-gray)" style={{ aspectRatio: "16 / 9" }}>
          {item.thumbnail ? (
            <Image
              src={item.thumbnail}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-(--notion-fg)/30">
              <span className="text-sm">No thumbnail</span>
            </div>
          )}

          {(completed || (progressRatio >= 0.05 && progressSeconds != null)) && (
            <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-[1px]">
              {completed ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  <span>시청 완료</span>
                </>
              ) : (
                <>
                  <RotateCcw className="h-3 w-3" />
                  <span>이어보기</span>
                </>
              )}
            </span>
          )}

          {durationLabel && (
            <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {durationLabel}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-0.5 px-0 pb-1.5 pt-0.5">
          <div className="min-h-[2.75rem] sm:min-h-[3.25rem]">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug tracking-tight text-(--notion-fg) group-hover:text-(--notion-fg)/90 sm:text-base">
              {item.title}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 shrink items-center gap-2">
              {item.sourceAvatarUrl ? (
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-(--notion-gray)">
                  <Image
                    src={item.sourceAvatarUrl}
                    alt={item.sourceName}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--notion-gray)">
                  <span className="text-xs font-semibold text-(--notion-fg)/80 sm:text-[13px]">
                    {item.sourceName.charAt(0)}
                  </span>
                </div>
              )}
              <p className="min-w-0 truncate text-xs font-medium text-(--notion-fg)/75 sm:text-[13px]">
                {item.sourceName}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-(--notion-fg)/55 sm:text-xs" suppressHydrationWarning>
            {formLabel ? `${formLabel} · ${timeAgo}` : timeAgo}
          </p>
        </div>
      </a>
      {item.id && (
        // 액션행: 같은 36px 원형 아이콘 4개를 좌우 균등 배치(라벨은 tooltip). 모바일 2열에서도 안 잘림
        <div className="flex shrink-0 items-center justify-between gap-1 px-0 pb-1 pt-0.5">
          <DeepDiveButton
            videoId={item.id}
            title={item.title}
            channel={item.sourceName}
            durationSeconds={item.durationSeconds ?? null}
            compact
          />
          {onBookmarkChange && (
            <BookmarkButton
              videoId={item.id}
              videoTitle={item.title}
              isBookmarked={!!bookmark}
              bookmarkId={bookmark?.id ?? null}
              onBookmarkChange={onBookmarkChange}
              className="h-9 w-9 relative before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
            />
          )}
          <AddToRadioButton videoId={item.id} title={item.title} iconOnly />
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg) touch-manipulation before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
            aria-label="더보기"
            aria-expanded={menuOpen}
            aria-controls={`card-more-${item.id}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>
      )}
      {item.id && (
        <div className="px-0 pb-1.5">
          <SummarizeButton videoId={item.id} fullWidth />
          {menuOpen && (
            <div id={`card-more-${item.id}`} className="mt-1.5 space-y-2.5 rounded-xl border border-(--notion-border) bg-(--notion-bg) px-2.5 py-2 text-xs text-(--notion-fg) shadow-sm">
              {onContentStateChange && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/55 sm:text-xs">
                    처리 상태
                  </p>
                  <ContentStateControl
                    contentId={item.id}
                    sourceId={item.sourceId}
                    sourceType="YouTube"
                    state={contentState?.state}
                    onChange={onContentStateChange}
                  />
                </div>
              )}
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/55 sm:text-xs">
                  AI 도구
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <InsightButton videoId={item.id} completed={completed} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
