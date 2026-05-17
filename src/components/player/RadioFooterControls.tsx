"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { qaLog } from "@/lib/qa-log";
import { ChevronLeft, ChevronRight, Pause } from "lucide-react";
import { ThemeIcon } from "@/components/ui/ThemeIcon";

interface RadioFooterControlsProps {
  drawerOpen: boolean;
  setDrawerOpen: (v: boolean) => void;
  lyricsOpen: boolean;
  setLyricsOpen: (v: boolean) => void;
  videoExpanded: boolean;
  setVideoExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  setFullPlayerOpen: (v: boolean) => void;
  togglePlay: () => void;
  progress: number;
  /** 진행 바 클릭·동그라미 드래그로 구간 이동(시킹). 없으면 비활성 */
  onSeek?: (percent: number) => void;
}

export function RadioFooterControls({
  drawerOpen,
  setDrawerOpen,
  lyricsOpen,
  setLyricsOpen,
  videoExpanded,
  setVideoExpanded,
  setFullPlayerOpen,
  togglePlay,
  progress = 0,
  onSeek,
}: RadioFooterControlsProps) {
  const radio = useRadioQueueOptional();
  const barRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const clampedProgress = Math.max(0, Math.min(100, progress));

  const percentFromEvent = useCallback(
    (e: { clientX: number }) => {
      const el = barRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      return Math.max(0, Math.min(100, (x / rect.width) * 100));
    },
    []
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onSeek) return;
      if ((e.target as HTMLElement).closest?.("[data-seek-thumb]")) return;
      e.preventDefault();
      e.stopPropagation();
      onSeek(percentFromEvent(e));
    },
    [onSeek, percentFromEvent]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onSeek) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      setIsDragging(true);
      onSeek(percentFromEvent(e));
    },
    [onSeek, percentFromEvent]
  );

  useEffect(() => {
    if (!isDragging || !onSeek) return;
    const onMove = (e: PointerEvent) => onSeek(percentFromEvent(e));
    const onUp = () => setIsDragging(false);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
  }, [isDragging, onSeek, percentFromEvent]);

  if (!radio) return null;

  const btnBase = "flex shrink-0 items-center justify-center rounded-full bg-white/80 text-(--notion-fg)/70 ring-1 ring-black/15 shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg) touch-manipulation dark:bg-black/40 dark:ring-white/20 dark:shadow-[0_1px_4px_rgba(0,0,0,0.3)] dark:hover:bg-black/60";
  const btnMobile = "h-11 w-11 min-h-[44px] min-w-[44px] sm:h-12 sm:w-12 sm:min-h-[48px] sm:min-w-[48px] md:h-16 md:w-16 md:min-h-[64px] md:min-w-[64px]";
  const btnNav = "h-11 w-11 min-h-[44px] min-w-[44px] sm:h-12 sm:w-12 md:h-12 md:w-12";

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--notion-border) bg-(--notion-bg)/95 backdrop-blur supports-backdrop-filter:bg-(--notion-bg)/80 pb-[env(safe-area-inset-bottom)]"
      role="region"
      aria-label="라디오 플레이어"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-2 py-2 sm:gap-3 sm:px-3 md:gap-4 md:px-6">
        <button
          type="button"
          onClick={togglePlay}
          className={`${btnBase} ${btnMobile}`}
          aria-label={radio.isPlaying ? "일시정지" : "재생"}
          title={radio.isPlaying ? "일시정지" : "재생"}
        >
          {radio.isPlaying ? <Pause size={28} /> : <ThemeIcon name="Play_the_radio" alt="재생" size={56} />}
        </button>
        <button
          type="button"
          onClick={() => radio.prev()}
          className={`${btnBase} ${btnNav}`}
          aria-label="이전 곡"
          title="이전 곡"
        >
          <ChevronLeft size={20} className="shrink-0" />
        </button>
        <button
          type="button"
          onClick={() => radio.next()}
          className={`${btnBase} ${btnNav}`}
          aria-label="다음 곡"
          title="다음 곡"
        >
          <ChevronRight size={20} className="shrink-0" />
        </button>
        <div className="min-w-0 flex-1 basis-0">
          <p className="line-clamp-1 text-sm font-semibold text-(--notion-fg)">
            {radio.currentItem?.title ?? "재생 중"}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <div
              ref={barRef}
              role={onSeek ? "slider" : undefined}
              aria-label={onSeek ? "재생 위치" : undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(clampedProgress)}
              tabIndex={onSeek ? 0 : undefined}
              onClick={onSeek ? handleBarClick : undefined}
              className={`relative flex-1 overflow-visible py-1 ${onSeek ? "cursor-pointer touch-none" : ""}`}
            >
              {/* 트랙: 초록 바와 동그라미가 같은 progress로 즉시 갱신되도록 transition 없음 (재생 중 렉 방지) */}
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-(--notion-gray)">
                <div
                  className={`h-full min-w-0 rounded-full bg-(--focus-accent) transition-none ${radio.isPlaying ? "shadow-[0_0_8px_rgba(16,185,129,0.7)]" : ""}`}
                  style={{
                    width: `calc(${clampedProgress}% + ${clampedProgress > 0 && clampedProgress < 100 ? 8 : 0}px)`,
                  }}
                />
              </div>
              {/* 포인터: 클릭·드래그로 시킹 가능 (onSeek 있을 때) */}
              {clampedProgress > 0 && clampedProgress < 100 && (
                <div
                  data-seek-thumb
                  className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(15,23,42,0.4)] ring-2 ring-(--notion-bg) ${onSeek ? "cursor-grab touch-none active:cursor-grabbing pointer-events-auto" : "pointer-events-none"}`}
                  style={{ left: `${clampedProgress}%` }}
                  onPointerDown={onSeek ? handlePointerDown : undefined}
                  aria-hidden
                />
              )}
            </div>
            <p className="-mt-0.5 shrink-0 text-[11px] leading-none text-(--notion-fg)/55">
              {radio.currentIndex + 1}/{radio.queue.length}
            </p>
          </div>
        </div>
        {/* 재생 대기열·AI·미니영상·전체화면·닫기: 모바일에서 작은 크기로 전부 노출 */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !drawerOpen;
              setDrawerOpen(next);
              if (next) qaLog.radio.playlistDrawerOpen(radio.queue.length);
              else qaLog.radio.playlistDrawerClose();
            }}
            className={`${btnBase} ${btnMobile}`}
            aria-label="재생 목록"
            title="재생 목록"
          >
            <span className="flex h-full w-full items-center justify-center [&>span]:scale-[0.65] sm:[&>span]:scale-75 md:[&>span]:scale-100">
              <ThemeIcon name="feed_list1" alt="재생 목록" size={65} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !lyricsOpen;
              setLyricsOpen(next);
              if (next) qaLog.radio.lyricsViewOpen(!!radio.currentItem?.summary);
              else qaLog.radio.lyricsViewClose();
            }}
            className={`${btnBase} ${btnMobile}`}
            aria-label="AI 요약(가사) 보기"
            title="AI 요약(가사) 보기"
          >
            <span className="flex h-full w-full items-center justify-center [&>span]:scale-[0.6] sm:[&>span]:scale-[0.7] md:[&>span]:scale-100">
              <ThemeIcon name="ai_summary1" alt="AI 요약" size={70} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setVideoExpanded((e) => {
                const next = !e;
                if (next) qaLog.radio.videoExpandOn();
                else qaLog.radio.videoExpandOff();
                return next;
              });
            }}
            className={`${btnBase} ${btnMobile} ${videoExpanded ? "bg-(--notion-hover) text-(--notion-fg) dark:bg-(--notion-hover)" : ""}`}
            aria-label={videoExpanded ? "미니 영상 끄기" : "미니 영상 켜기"}
            title={videoExpanded ? "미니 영상 끄기" : "미니 영상 켜기"}
          >
            <span className="flex h-full w-full items-center justify-center [&>span]:scale-[0.65] sm:[&>span]:scale-75 md:[&>span]:scale-100">
              <ThemeIcon name="watch_mini_video" alt="미니 영상" size={56} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setFullPlayerOpen(true);
              qaLog.radio.fullPlayerOpen();
            }}
            className={`${btnBase} ${btnMobile}`}
            aria-label="전체 화면 영상"
            title="전체 화면 영상"
          >
            <span className="flex h-full w-full items-center justify-center [&>span]:scale-[0.65] sm:[&>span]:scale-75 md:[&>span]:scale-100">
              <ThemeIcon name="view_fullscreen" alt="전체 화면" size={56} />
            </span>
          </button>
          <button
            type="button"
            onClick={() => radio.close()}
            className={`${btnBase} ${btnMobile} text-(--notion-fg)/50`}
            aria-label="플레이어 닫기"
            title="플레이어 닫기"
          >
            <span className="flex h-full w-full items-center justify-center [&>span]:scale-[0.65] sm:[&>span]:scale-75 md:[&>span]:scale-100">
              <ThemeIcon name="close_player" alt="플레이어 닫기" size={56} />
            </span>
          </button>
        </div>
      </div>
    </footer>
  );
}
