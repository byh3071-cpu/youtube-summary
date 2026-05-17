"use client";

/** 하단 고정 라디오 플레이어. YouTube IFrame API, 플레이리스트 서랍·AI 요약 뷰·미니 영상 토글 */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { qaLog } from "@/lib/qa-log";
import { X } from "lucide-react";
import { RadioFooterControls } from "./RadioFooterControls";
import { RadioPlaylistDrawer } from "./RadioPlaylistDrawer";
import { RadioLyricsView } from "./RadioLyricsView";
import { getWatchProgress, saveWatchProgress } from "@/lib/watch-history";

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace YT {
  class Player {
    constructor(elementId: string, options: {
      height?: string;
      width?: string;
      videoId?: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: (event: { target: Player }) => void; onStateChange?: (event: { data: number }) => void };
    });
    loadVideoById(videoId: string): void;
    playVideo(): void;
    pauseVideo(): void;
    getPlayerState(): number;
    getCurrentTime(): number;
    getDuration(): number;
  }
  enum PlayerState {
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }
}

const PLAYER_DIV_ID = "yt-radio-player-host";
const PLAYER_WRAPPER_ID = "yt-radio-player-wrapper";

type RadioOptional = ReturnType<typeof useRadioQueueOptional>;
type RadioRefValue = NonNullable<RadioOptional>;

export default function FloatingRadioPlayer() {
  const radio = useRadioQueueOptional();
  const radioRef = useRef<RadioRefValue | null>(null);
  radioRef.current = radio ?? null;

  const playerRef = useRef<YT.Player | null>(null);
  const [apiReady, setApiReady] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [videoExpanded, setVideoExpanded] = useState(false);
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resumeSeconds, setResumeSeconds] = useState<number | null>(null);
  /** 시크 직후 rAF가 이전 재생 위치로 덮어쓰지 않도록 목표 % 유지 */
  const seekTargetRef = useRef<number | null>(null);
  const seekTargetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (seekTargetTimeoutRef.current) {
        clearTimeout(seekTargetTimeoutRef.current);
        seekTargetTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.YT?.Player) {
      queueMicrotask(() => setApiReady(true));
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScript = document.getElementsByTagName("script")[0];
    firstScript?.parentNode?.insertBefore(tag, firstScript);
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      try { prevReady?.(); } catch { /* 이전 콜백 오류 무시 */ }
      setApiReady(true);
    };
    return () => {
      window.onYouTubeIframeAPIReady = prevReady;
    };
  }, []);

  useEffect(() => {
    if (!apiReady || !radio?.currentItem || !window.YT) return;
    const videoId = radio.currentItem.videoId;
    const isPlaying = radio.isPlaying;
    if (!playerRef.current) {
      playerRef.current = new window.YT.Player(PLAYER_DIV_ID, {
        height: "1",
        width: "1",
        videoId,
        playerVars: {
          autoplay: isPlaying ? 1 : 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady(ev: { target: YT.Player }) {
            setPlayerReady(true);
            if (radioRef.current?.isPlaying) ev.target.playVideo();
          },
          onStateChange(ev: { data: number }) {
            if (window.YT && ev.data === window.YT.PlayerState.ENDED) {
              radioRef.current?.next();
            }
          },
        },
      });
    } else if (playerReady) {
      if (typeof playerRef.current.loadVideoById === "function") {
        playerRef.current.loadVideoById(videoId);
        if (isPlaying && typeof playerRef.current.playVideo === "function") {
          playerRef.current.playVideo();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- player 인스턴스 재생성 비용 때문에 videoId·ready·재생 상태만 동기화
  }, [apiReady, radio?.currentItem?.videoId, playerReady, radio?.isPlaying]);

  useEffect(() => {
    if (!playerRef.current || !radioRef.current || !playerReady) return;
    const r = radioRef.current;
    if (r.isPlaying && typeof playerRef.current.playVideo === "function") {
      playerRef.current.playVideo();
    } else if (!r.isPlaying && typeof playerRef.current.pauseVideo === "function") {
      playerRef.current.pauseVideo();
    }
  }, [radio?.isPlaying, playerReady]);

  useEffect(() => {
    const r = radioRef.current;
    if (r && r.queue.length === 0) {
      playerRef.current = null;
      setPlayerReady(false);
      setProgress(0);
      setResumeSeconds(null);
    }
  }, [radio?.queue.length]);

  // 재생 중인 영상이 바뀌면 진행 바를 즉시 0으로 리셋 (이전 영상 진행도가 남아 점점 사라지는 현상 방지)
  useEffect(() => {
    if (!radio?.currentItem) return;
    setProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- videoId 변경만 진행 바 초기화 트리거로 사용
  }, [radio?.currentItem?.videoId]);

  // 현재 큐 아이템 기준으로 저장된 마지막 시청 위치 불러오기 (완료한 영상은 제외)
  useEffect(() => {
    if (!radio?.currentItem) {
      setResumeSeconds(null);
      return;
    }
    const stored = getWatchProgress(radio.currentItem.videoId);
    if (!stored || stored.completed || !Number.isFinite(stored.lastPositionSeconds) || stored.lastPositionSeconds <= 0) {
      setResumeSeconds(null);
      return;
    }
    setResumeSeconds(stored.lastPositionSeconds);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- videoId만 추적해 재실행, currentItem 객체 참조는 제외
  }, [radio?.currentItem?.videoId]);

  // 진행 바 상태 업데이트 (재생 중일 때만 활성화해 불필요한 rAF 최소화)
  useEffect(() => {
    if (!playerRef.current || !playerReady || !radio?.currentItem || !radio.isPlaying) return;
    let frameId: number | null = null;
    let lastSavedAt = 0;
    let lastBroadcastAt = 0;
    /** seekTarget 유지 프레임 수; 너무 오래 유지되면 강제 해제해 바가 멈추는 버그 방지 */
    let seekHoldFrames = 0;
    const SEEK_HOLD_MAX_FRAMES = 90; // ~1.5초

    /** 탭 포커스 복귀 시 재생바를 즉시 플레이어 시간과 동기화 (백그라운드에서 rAF가 멈춰 지연되는 현상 방지) */
    const syncProgressFromPlayer = () => {
      try {
        const p = playerRef.current as { getCurrentTime?: () => number; getDuration?: () => number } | null;
        if (!p?.getCurrentTime || !p?.getDuration) return;
        const current = p.getCurrentTime();
        const duration = p.getDuration();
        if (duration > 0 && Number.isFinite(current)) {
          const percent = Math.max(0, Math.min(100, (current / duration) * 100));
          seekTargetRef.current = null;
          setProgress(percent);
        }
      } catch {
        // ignore
      }
    };

    const onVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      syncProgressFromPlayer();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    const update = () => {
      try {
        const r = radioRef.current;
        const item = r?.currentItem;
        if (!item) return;
        let current = 0;
        let duration = 0;
        try {
          current = typeof playerRef.current?.getCurrentTime === "function" ? playerRef.current.getCurrentTime() : 0;
          duration = typeof playerRef.current?.getDuration === "function" ? playerRef.current.getDuration() : 0;
        } catch {
          seekTargetRef.current = null;
          frameId = requestAnimationFrame(update);
          return;
        }
        if (duration > 0 && Number.isFinite(current)) {
          const ratio = Math.max(0, Math.min(1, current / duration));
          const percent = ratio * 100;
          const target = seekTargetRef.current;
          if (target != null) {
            seekHoldFrames += 1;
            if (percent >= target - 1 || seekHoldFrames >= SEEK_HOLD_MAX_FRAMES) {
              seekTargetRef.current = null;
              seekHoldFrames = 0;
            } else {
              setProgress(target);
              frameId = requestAnimationFrame(update);
              return;
            }
          } else {
            seekHoldFrames = 0;
          }
          setProgress(percent);

          const now = Date.now();
          if (now - lastSavedAt > 5000) {
            saveWatchProgress(item.videoId, current, duration);
            lastSavedAt = now;
          }
          if (now - lastBroadcastAt > 1000 && typeof r?.updatePlayback === "function") {
            r.updatePlayback({
              videoId: item.videoId,
              positionSeconds: current,
              durationSeconds: duration,
              completed: ratio >= 0.9,
            });
            lastBroadcastAt = now;
          }
        }
      } catch {
        seekTargetRef.current = null;
      }
      frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [playerReady, radio?.currentItem?.videoId, radio?.currentItem, radio?.isPlaying]);

  // 미니/전체 영상: YT가 1x1로 만든 iframe을 모드에 맞게 리사이즈
  const MINI_VIDEO_W = 320;
  const MINI_VIDEO_H = 180;
  const videoVisible = videoExpanded || fullPlayerOpen;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const run = () => {
      const wrapper = document.getElementById(PLAYER_WRAPPER_ID);
      const iframe = wrapper?.querySelector?.("iframe") as HTMLIFrameElement | null;
      if (!iframe) return;
      if (fullPlayerOpen) {
        iframe.removeAttribute("width");
        iframe.removeAttribute("height");
        iframe.style.width = "100%";
        iframe.style.height = "100%";
      } else if (videoExpanded) {
        iframe.setAttribute("width", String(MINI_VIDEO_W));
        iframe.setAttribute("height", String(MINI_VIDEO_H));
        iframe.style.width = `${MINI_VIDEO_W}px`;
        iframe.style.height = `${MINI_VIDEO_H}px`;
      } else {
        iframe.setAttribute("width", "1");
        iframe.setAttribute("height", "1");
        iframe.style.width = "1px";
        iframe.style.height = "1px";
      }
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    const t = window.setTimeout(run, 150);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(t);
    };
  }, [videoExpanded, fullPlayerOpen]);

  useEffect(() => {
    if (!fullPlayerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFullPlayerOpen(false);
        qaLog.radio.fullPlayerClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullPlayerOpen]);

  const togglePlay = useCallback(() => {
    radioRef.current?.togglePlay();
  }, []);

  const handleSeek = useCallback((percent: number) => {
    const p = playerRef.current as { getDuration?: () => number; seekTo?: (sec: number, allow: boolean) => void } | null;
    if (!p || typeof p.getDuration !== "function" || typeof p.seekTo !== "function") return;
    const duration = p.getDuration();
    if (!(duration > 0)) return;
    if (seekTargetTimeoutRef.current) {
      clearTimeout(seekTargetTimeoutRef.current);
      seekTargetTimeoutRef.current = null;
    }
    const sec = Math.max(0, Math.min(duration, (percent / 100) * duration));
    seekTargetRef.current = percent;
    setProgress(percent);
    p.seekTo(sec, true);
    seekTargetTimeoutRef.current = setTimeout(() => {
      seekTargetRef.current = null;
      seekTargetTimeoutRef.current = null;
    }, 1500);
  }, []);

  if (!radio) return null;

  if (radio.queue.length === 0) {
    return (
      <footer
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-(--notion-border) bg-(--notion-bg)/95 py-2 backdrop-blur supports-backdrop-filter:bg-(--notion-bg)/80"
        role="region"
        aria-label="라디오 안내"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-2.5 px-4 md:px-6">
          <div className="relative h-14 w-14 shrink-0 md:h-16 md:w-16">
            <Image
              src="/focus-feed-logo-v2.png"
              alt="Focus Feed 로고"
              fill
              sizes="(max-width: 768px) 56px, 64px"
              className="object-contain object-center"
            />
          </div>
          <div className="text-sm">
            <p className="font-medium text-(--notion-fg)">아직 라디오에 담긴 영상이 없어요.</p>
                <p className="text-(--notion-fg)/65">
              피드에서 <span className="font-semibold text-(--focus-accent)">라디오에 추가</span>를 눌러 플레이리스트를 채워보세요.
            </p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <>
      {/* 미니: 우하단 320x180 / 전체: 모달 중앙 큰 영상 / 숨김: 1px */}
      <div
        id={PLAYER_WRAPPER_ID}
        className={
          fullPlayerOpen
            ? "fixed inset-0 z-60 flex items-center justify-center bg-black/80 transition-all duration-300 pointer-events-auto"
            : videoExpanded
              ? "fixed bottom-20 right-4 z-60 overflow-hidden rounded-xl border border-(--notion-border) bg-black shadow-lg transition-all duration-300 pointer-events-auto"
              : "pointer-events-none fixed bottom-0 left-0 h-px w-px overflow-hidden opacity-0"
        }
        style={
          fullPlayerOpen
            ? undefined
            : videoExpanded
              ? { width: MINI_VIDEO_W, height: MINI_VIDEO_H }
              : undefined
        }
        aria-hidden={!videoVisible}
        onClick={
          fullPlayerOpen
            ? () => {
                setFullPlayerOpen(false);
                qaLog.radio.fullPlayerClose();
              }
            : undefined
        }
      >
        <div
          id={PLAYER_DIV_ID}
          className={fullPlayerOpen ? "w-[90vw] max-w-4xl aspect-video overflow-hidden rounded-lg bg-black shadow-2xl" : ""}
          style={
            fullPlayerOpen
              ? { width: "90vw", maxWidth: "896px", aspectRatio: "16/9" }
              : { width: "100%", height: "100%", minWidth: 0, minHeight: 0 }
          }
          aria-hidden={!videoVisible}
          onClick={fullPlayerOpen ? (e) => e.stopPropagation() : undefined}
        />

        {fullPlayerOpen && radio.currentItem && resumeSeconds != null && (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-70 flex justify-center px-4">
            <div className="flex max-w-4xl flex-1 items-center justify-between gap-3 rounded-full bg-black/60 px-4 py-2 text-[11px] text-white">
              <span className="line-clamp-1 font-semibold">
                {radio.currentItem.title}
              </span>
              <button
                type="button"
                className="pointer-events-auto rounded-full bg-(--focus-accent) px-3 py-1 text-[10px] font-semibold text-black hover:bg-(--focus-accent)/90"
                onClick={(e) => {
                  e.stopPropagation();
                  try {
                    const player = playerRef.current as { seekTo?: (sec: number, allow: boolean) => void } | null;
                    if (player && typeof player.seekTo === "function") {
                      player.seekTo(resumeSeconds, true);
                    }
                  } catch {
                    // ignore
                  } finally {
                    // 한 번 이동 후에는 안내를 숨겨서 화면을 더 깔끔하게 유지
                    setResumeSeconds(null);
                  }
                }}
              >
                마지막 시청{" "}
                {(() => {
                  const total = Math.max(0, Math.floor(resumeSeconds));
                  const h = Math.floor(total / 3600);
                  const m = Math.floor((total % 3600) / 60);
                  const s = total % 60;
                  if (h > 0) {
                    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                  }
                  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                })()}로 이동
              </button>
            </div>
          </div>
        )}
      </div>
      {fullPlayerOpen && (
        <button
          type="button"
          onClick={() => {
            setFullPlayerOpen(false);
            qaLog.radio.fullPlayerClose();
          }}
          className="fixed top-4 right-4 z-70 flex h-10 w-10 items-center justify-center rounded-full bg-(--notion-fg)/20 text-(--notion-fg) transition-colors hover:bg-(--notion-fg)/30"
          aria-label="전체 화면 닫기"
        >
          <X size={24} />
        </button>
      )}

      <RadioFooterControls
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
        lyricsOpen={lyricsOpen}
        setLyricsOpen={setLyricsOpen}
        videoExpanded={videoExpanded}
        setVideoExpanded={setVideoExpanded}
        setFullPlayerOpen={setFullPlayerOpen}
        togglePlay={togglePlay}
        progress={progress}
        onSeek={handleSeek}
      />
      
      <RadioPlaylistDrawer
        drawerOpen={drawerOpen}
        setDrawerOpen={setDrawerOpen}
      />

      <RadioLyricsView 
        lyricsOpen={lyricsOpen} 
        setLyricsOpen={setLyricsOpen} 
      />
    </>
  );
}
