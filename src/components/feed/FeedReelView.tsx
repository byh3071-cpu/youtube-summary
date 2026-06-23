"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { ExternalLink, ChevronDown } from "lucide-react";
import type { FeedItem } from "@/types/feed";
import AddToRadioButton from "./AddToRadioButton";
import BookmarkButton from "./BookmarkButton";
import ReelContextBar from "./ReelContextBar";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import type { BookmarkEntry } from "./FeedClientContainer";

const RSS_BOOKMARK_PREFIX = "rss:";

/** iframe용 (YT API 미사용 시). mute=0으로 소리 시도 */
const EMBED_PARAMS = "autoplay=1&mute=0&rel=0&modestbranding=1";

/** Window.YT 타입은 FloatingRadioPlayer의 전역 선언 사용 */

interface Props {
  items: FeedItem[];
  viewMode: "longform" | "shortform" | "live";
  bookmarks?: BookmarkEntry[];
  onBookmarkChange?: () => void;
}

function ReelSlide({
  item,
  index,
  total,
  bookmark,
  onBookmarkChange,
  onVideoEnd,
  scrollRoot,
  ytReady,
}: {
  item: FeedItem;
  index: number;
  total: number;
  bookmark?: BookmarkEntry | null;
  onBookmarkChange?: () => void;
  onVideoEnd?: () => void;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  ytReady: boolean;
}) {
  const radio = useRadioQueueOptional();
  // 라디오 플레이어(모바일 fixed bottom bar)가 떠 있으면 마지막 슬라이드 버튼바를 가린다 →
  // 하단 spacer를 키워 액션바를 플레이어 위로 밀어올린다.
  const radioActive = !!radio && radio.queue.length > 0;
  const isYoutube = item.source === "YouTube";
  const videoId = isYoutube && item.id ? item.id : null;
  // 폴백은 16:9 무레터박스 소스(maxresdefault). hqdefault(4:3)는 검은띠가 구워져 있어 contain 시 이중 레터박스가 생김.
  const thumbUrl = item.thumbnail ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "");
  const sectionRef = useRef<HTMLElement>(null);
  const playerRef = useRef<{ destroy: () => void; pauseVideo?: () => void } | null>(null);
  const [inView, setInView] = useState(false);
  const playerId = `reel-yt-${index}`;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || !scrollRoot.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setInView(e.isIntersecting && e.intersectionRatio >= 0.4);
      },
      { threshold: [0.2, 0.4, 0.6], root: scrollRoot.current, rootMargin: "0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (!inView || !videoId || !ytReady || typeof window === "undefined") return;
    const YT = window.YT;
    if (!YT?.Player) return;
    const el = document.getElementById(playerId);
    if (!el) return;
    try {
      const player = new YT.Player(playerId, {
        height: "100%",
        width: "100%",
        videoId,
        playerVars: { autoplay: 1, mute: 0, rel: 0, modestbranding: 1 },
        events: {
          onStateChange(ev: { data: number }) {
            if (ev.data === YT.PlayerState?.ENDED) onVideoEnd?.();
          },
        },
      });
      playerRef.current = player as unknown as { destroy: () => void };
    } catch {
      playerRef.current = null;
    }
    return () => {
      try {
        playerRef.current?.pauseVideo?.();
      } catch {}
      playerRef.current = null;
      // YouTube player.destroy() mutates DOM and can trigger React "removeChild" errors;
      // skip destroy and let React unmount the container normally.
    };
  }, [inView, videoId, playerId, onVideoEnd, ytReady]);

  const showPlayer = inView && videoId;
  const useApiPlayer = showPlayer && ytReady;

  return (
    <section
      ref={sectionRef}
      className="relative flex h-full min-h-0 w-full shrink-0 snap-start snap-always flex-col items-center justify-start bg-black px-0 py-0"
      aria-label={`${index + 1} / ${total}`}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="relative flex min-h-0 w-full flex-1 items-stretch justify-center bg-black">
          <div className="relative h-full w-full max-w-6xl">
            {videoId && ytReady ? (
              <div
                id={playerId}
                className="h-full w-full"
                style={{ display: useApiPlayer ? "block" : "none" }}
                aria-hidden={!useApiPlayer}
              />
            ) : null}
            {!useApiPlayer ? (
              showPlayer ? (
                <iframe
                  title={item.title}
                  className="absolute inset-0 h-full w-full border-0"
                  src={`https://www.youtube.com/embed/${videoId}?${EMBED_PARAMS}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block h-full w-full bg-black"
                >
                  {thumbUrl ? (
                    <Image
                      src={thumbUrl}
                      alt={item.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 896px"
                      className="object-contain"
                      priority={index < 3}
                    />
                  ) : (
                    <div className="flex h-full min-h-[50vh] w-full items-center justify-center text-white/40 text-sm">
                      썸네일 없음
                    </div>
                  )}
                </a>
              )
            ) : null}
          </div>
          <span className="absolute bottom-3 right-3 rounded bg-black/70 px-2 py-1 text-xs font-medium text-white">
            {item.sourceName}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-(--notion-bg) px-4 py-3.5 min-h-[3.5rem] sm:grid sm:grid-cols-3 sm:gap-4">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-(--notion-border) bg-(--notion-bg) px-4 py-2.5 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover)"
          >
            <ExternalLink size={18} />
            원문 보기
          </a>
          <div className="flex justify-center items-center">
            {isYoutube && item.id && (
              <AddToRadioButton videoId={item.id} title={item.title} className="px-4 py-2.5 text-sm rounded-full border border-(--notion-border) bg-(--notion-gray)/50 font-medium gap-2 [&_svg]:size-5" />
            )}
          </div>
          <div className="flex justify-end items-center">
            {item.source === "RSS" && onBookmarkChange && (
              <BookmarkButton
                videoId={`${RSS_BOOKMARK_PREFIX}${item.link}`}
                videoTitle={item.title}
                highlight={item.summary ?? item.title}
                isBookmarked={!!bookmark}
                bookmarkId={bookmark?.id ?? null}
                onBookmarkChange={onBookmarkChange}
                className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0"
                iconSize={24}
              />
            )}
            {isYoutube && item.id && onBookmarkChange && (
              <BookmarkButton
                videoId={item.id}
                videoTitle={item.title}
                highlight={item.title}
                isBookmarked={!!bookmark}
                bookmarkId={bookmark?.id ?? null}
                onBookmarkChange={onBookmarkChange}
                className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0"
                iconSize={24}
              />
            )}
          </div>
        </div>
        {/* 버튼 바 아래 여백. 라디오 플레이어 떠 있으면 그 높이만큼 더 확보해 버튼바가 안 가리게 */}
        <div className={`shrink-0 bg-(--notion-bg) ${radioActive ? "min-h-[9rem]" : "min-h-[5rem]"}`} aria-hidden />
      </div>
      {index < total - 1 && (
        <div className={`absolute left-1/2 -translate-x-1/2 text-white/60 ${radioActive ? "bottom-32" : "bottom-20"}`}>
          <ChevronDown size={28} className="animate-bounce" aria-hidden />
        </div>
      )}
    </section>
  );
}

export default function FeedReelView({ items, viewMode, bookmarks = [], onBookmarkChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ytReady, setYtReady] = useState(() =>
    typeof window !== "undefined" ? !!window.YT?.Player : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (ytReady) return;
    if (window.YT?.Player) {
      queueMicrotask(() => setYtReady(true));
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(tag, first);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      setYtReady(true);
    };
    return () => {
      window.onYouTubeIframeAPIReady = prev;
    };
  }, [ytReady]);

  const scrollToNext = useCallback((currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= items.length || !containerRef.current) return;
    const nextSlide = containerRef.current.children[nextIndex] as HTMLElement | undefined;
    if (nextSlide) {
      nextSlide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [items.length]);

  if (items.length === 0) {
    const emptyLabel =
      viewMode === "live"
        ? "라이브"
        : viewMode === "shortform"
          ? "60초 이하 숏폼"
          : "61초 이상 롱폼";
    return (
      <div className="flex h-[100dvh] min-h-0 w-full flex-col">
        <ReelContextBar viewMode={viewMode} />
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) px-4 py-16 text-center">
          <p className="text-(--notion-fg)/70">{emptyLabel} 영상이 없습니다.</p>
          <p className="mt-1 text-sm text-(--notion-fg)/50">
            {viewMode === "live"
              ? "연결된 채널 중 현재 라이브 중인 영상이 없습니다."
              : "유튜브 피드에 재생 시간 정보가 있으면 여기에서 구분해 표시합니다."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-0 w-full flex-col">
      <ReelContextBar viewMode={viewMode} />
      <div
        ref={containerRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain snap-y snap-mandatory"
        style={{ scrollBehavior: "smooth" }}
      >
      {items.map((item, index) => {
        const bookmark = item.source === "RSS"
          ? bookmarks.find((b) => b.video_id === RSS_BOOKMARK_PREFIX + item.link)
          : item.id
            ? bookmarks.find((b) => b.video_id === item.id)
            : null;
        return (
          <ReelSlide
            key={`${item.source}:${item.sourceId}:${item.id ?? item.link}`}
            item={item}
            index={index}
            total={items.length}
            bookmark={bookmark ?? null}
            onBookmarkChange={onBookmarkChange}
            onVideoEnd={() => scrollToNext(index)}
            scrollRoot={containerRef}
            ytReady={ytReady}
          />
        );
      })}
      </div>
    </div>
  );
}
