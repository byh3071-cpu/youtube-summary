"use client";

/**
 * 딥다이브 드로어 — NotebookLM식 디제스트(엑기스) + 자막 전문.
 * 디자인 리서치(2026-06-11) 결론 반영:
 * - 오버레이 없는 우측 플로팅 패널: 라디오 플레이어·피드와 공존 (YouTube 트랜스크립트 패널 패턴)
 * - 타임스탬프/자막 줄 클릭 → 라디오 시킹 (focus-feed:radio-seek 이벤트)
 * - 재생 위치 ↔ 섹션·자막 하이라이트 + 오토스크롤 (Readwise Reader 패턴)
 * - 키워드 칩 → 피드 키워드 필터 추가
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Loader2, RefreshCcw, X } from "lucide-react";
import {
  generateVideoDigestAction,
  getVideoTranscriptAction,
  type DigestActionResult,
  type TranscriptActionResult,
} from "@/app/actions/digest";
import type { VideoDigest } from "@/lib/digest/types";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { storage } from "@/lib/storage";

type LoadedDigest = Extract<DigestActionResult, { ok: true }>;

function TimestampChip({
  timestamp,
  onSeek,
}: {
  timestamp: string | null;
  onSeek?: () => void;
}) {
  if (!timestamp) return null;
  return (
    <button
      type="button"
      onClick={onSeek}
      className="inline-flex shrink-0 items-center rounded-md bg-(--notion-gray) px-1.5 py-px text-[10px] font-bold tabular-nums text-(--focus-accent) hover:bg-(--focus-accent)/15"
      title="이 구간부터 라디오로 듣기"
    >
      {timestamp}
    </button>
  );
}

export default function VideoDigestDrawer({
  videoId,
  title,
  channel,
  durationSeconds,
  open,
  onClose,
}: {
  videoId: string;
  title: string;
  channel?: string | null;
  durationSeconds?: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const radio = useRadioQueueOptional();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LoadedDigest | null>(null);
  const [transcript, setTranscript] = useState<TranscriptActionResult | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [addedKeywords, setAddedKeywords] = useState<Set<string>>(new Set());
  const requestedRef = useRef(false);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);

  const fetchDigest = useCallback(
    async (force: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const result = await generateVideoDigestAction({
          videoId,
          title,
          channel,
          durationSeconds,
          force,
        });
        if (result.ok) {
          setData(result);
        } else {
          setError(result.error);
        }
      } catch {
        setError("디제스트 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        setLoading(false);
      }
    },
    [videoId, title, channel, durationSeconds],
  );

  useEffect(() => {
    if (!open || requestedRef.current) return;
    requestedRef.current = true;
    void fetchDigest(false);
  }, [open, fetchDigest]);

  // ESC로 닫기 (오버레이가 없는 패널이므로 직접 처리)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /** 라디오에서 이 영상을 (필요 시 큐에 추가해) 재생하고, 지정 초로 시킹 */
  const playAt = useCallback(
    (seconds?: number) => {
      if (!radio) {
        const t = typeof seconds === "number" ? `&t=${Math.floor(seconds)}s` : "";
        window.open(`https://www.youtube.com/watch?v=${videoId}${t}`, "_blank", "noopener");
        return;
      }
      const existsIndex = radio.queue.findIndex((q) => q.videoId === videoId);
      if (existsIndex >= 0) {
        radio.setCurrentIndex(existsIndex);
      } else {
        radio.addToQueue({ videoId, title });
        radio.setCurrentIndex(radio.queue.length);
      }
      radio.play();
      if (typeof seconds === "number") {
        window.dispatchEvent(
          new CustomEvent("focus-feed:radio-seek", { detail: { videoId, seconds } }),
        );
      }
    },
    [radio, videoId, title],
  );

  const handleKeywordClick = useCallback((keyword: string) => {
    storage.addKeyword(keyword);
    setAddedKeywords((prev) => new Set(prev).add(keyword));
  }, []);

  const handleTranscriptToggle = useCallback(async () => {
    const next = !transcriptOpen;
    setTranscriptOpen(next);
    if (next && !transcript && !transcriptLoading) {
      setTranscriptLoading(true);
      try {
        setTranscript(await getVideoTranscriptAction(videoId));
      } catch {
        setTranscript({ ok: false, error: "자막을 불러오지 못했습니다." });
      } finally {
        setTranscriptLoading(false);
      }
    }
  }, [transcriptOpen, transcript, transcriptLoading, videoId]);

  // 재생 위치 (이 영상이 라디오에서 재생 중일 때만)
  const positionSeconds =
    radio?.playback?.videoId === videoId ? radio.playback.positionSeconds : null;

  const digest: VideoDigest | null = data?.digest ?? null;

  /** 현재 재생 구간에 해당하는 섹션 인덱스 */
  const activeSectionIndex = useMemo(() => {
    if (positionSeconds == null || !digest) return -1;
    let active = -1;
    digest.sections.forEach((s, i) => {
      if (s.seconds !== undefined && s.seconds <= positionSeconds) active = i;
    });
    return active;
  }, [positionSeconds, digest]);

  /** 현재 재생 구간의 자막 줄 인덱스 */
  const activeLineIndex = useMemo(() => {
    if (positionSeconds == null || !transcript?.ok || transcript.mode !== "transcript") return -1;
    let active = -1;
    for (let i = 0; i < transcript.lines.length; i++) {
      if (transcript.lines[i].offset <= positionSeconds) active = i;
      else break;
    }
    return active;
  }, [positionSeconds, transcript]);

  // 오토스크롤: 현재 자막 줄을 패널 가운데로 (Readwise 텔레프롬프터 패턴)
  useEffect(() => {
    if (!autoScroll || !transcriptOpen || activeLineIndex < 0) return;
    activeLineRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [autoScroll, transcriptOpen, activeLineIndex]);

  if (!open) return null;

  return (
    <aside
      role="complementary"
      aria-label="영상 딥다이브"
      // z-60: 라디오 푸터(z-50) 위, 모달 다이얼로그(Q&A z-70 등) 아래 — 모달이 열리면
      // 오버레이가 이 패널을 덮어 aria-modal 의미론을 깨지 않는다.
      className="fixed inset-x-2 bottom-24 top-14 z-60 flex flex-col overflow-hidden rounded-2xl border border-(--notion-border) bg-(--notion-bg) shadow-2xl sm:inset-x-auto sm:right-3 sm:w-[440px]"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2 border-b border-(--notion-border) px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/55">
            <BookOpen size={12} /> 딥다이브
          </p>
          <h2 className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-(--notion-fg)">
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => playAt(0)}
            className="rounded-full bg-(--notion-fg) px-2.5 py-1 text-[11px] font-semibold text-(--notion-bg) hover:bg-(--notion-fg)/90"
          >
            🎧 듣기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-(--notion-fg)/55 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
            aria-label="딥다이브 닫기"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[12px] leading-relaxed">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12 text-center text-(--notion-fg)/65">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-[12px] font-medium">전체 자막을 분석하고 있어요…</p>
            <p className="text-[11px] text-(--notion-fg)/50">
              긴 영상은 1~2분 걸릴 수 있어요. 완료되면 캐시되어 다음엔 즉시 열립니다.
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="space-y-3 py-6 text-center">
            <p className="text-[12px] text-(--notion-fg)/70">{error}</p>
            <button
              type="button"
              onClick={() => void fetchDigest(false)}
              className="rounded-full border border-(--notion-border) px-3 py-1 text-[11px] font-semibold hover:bg-(--notion-hover)"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && digest && (
          <div className="space-y-4">
            {data?.degraded && (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                <span>일부 구간 분석이 실패해 부분 결과예요.</span>
                <button
                  type="button"
                  onClick={() => void fetchDigest(true)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-current px-2 py-0.5 font-semibold"
                >
                  <RefreshCcw size={10} /> 다시 생성
                </button>
              </div>
            )}

            {/* 헤드라인 + 핵심 가치 */}
            <div className="rounded-xl bg-(--focus-accent)/10 px-3.5 py-3">
              <p className="text-[13.5px] font-bold leading-snug text-(--notion-fg)">
                💡 {digest.headline}
              </p>
              {digest.coreValue && (
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-(--notion-fg)/70">
                  {digest.coreValue}
                </p>
              )}
            </div>

            {/* 요약 */}
            {digest.summary && (
              <p className="text-[12px] leading-relaxed text-(--notion-fg)/80">{digest.summary}</p>
            )}

            {/* 키워드 */}
            {digest.keywords.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-(--notion-fg)/50">
                  🏷 키워드 <span className="font-normal normal-case">— 클릭하면 피드 필터에 추가</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {digest.keywords.map((kw) => {
                    const added = addedKeywords.has(kw);
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => handleKeywordClick(kw)}
                        disabled={added}
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                          added
                            ? "border-(--focus-accent)/40 bg-(--focus-accent)/15 text-(--focus-accent)"
                            : "border-(--notion-border) text-(--notion-fg)/75 hover:bg-(--notion-hover)"
                        }`}
                      >
                        {added ? `✓ ${kw}` : kw}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 핵심 인사이트 */}
            {digest.keyInsights.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-(--notion-fg)/50">
                  🔑 핵심 인사이트
                </p>
                <ul className="space-y-2">
                  {digest.keyInsights.map((ins, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-(--notion-border) px-3 py-2"
                    >
                      <p className="font-medium text-(--notion-fg)">{ins.insight}</p>
                      {(ins.evidence || ins.timestamp) && (
                        <p className="mt-1 flex items-start gap-1.5 text-[11px] text-(--notion-fg)/60">
                          <TimestampChip
                            timestamp={ins.timestamp}
                            onSeek={ins.seconds !== undefined ? () => playAt(ins.seconds) : undefined}
                          />
                          <span>{ins.evidence}</span>
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 엑기스 (인용) */}
            {digest.quotes.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-(--notion-fg)/50">
                  💬 엑기스
                </p>
                <div className="space-y-2">
                  {digest.quotes.map((q, i) => (
                    <blockquote
                      key={i}
                      className="border-l-2 border-(--focus-accent) pl-3 text-[11.5px] italic leading-relaxed text-(--notion-fg)/70"
                    >
                      “{q.text}”{" "}
                      <TimestampChip
                        timestamp={q.timestamp}
                        onSeek={q.seconds !== undefined ? () => playAt(q.seconds) : undefined}
                      />
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* 섹션 타임라인 */}
            {digest.sections.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-(--notion-fg)/50">
                  📑 섹션
                </p>
                <ul className="space-y-1.5">
                  {digest.sections.map((s, i) => (
                    <li
                      key={i}
                      className={`rounded-lg px-2 py-1 transition-colors ${
                        i === activeSectionIndex ? "bg-(--focus-accent)/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TimestampChip
                          timestamp={s.timestamp}
                          onSeek={s.seconds !== undefined ? () => playAt(s.seconds) : undefined}
                        />
                        <span className="font-semibold text-(--notion-fg)">
                          {i === activeSectionIndex ? "▶ " : ""}
                          {s.title}
                        </span>
                      </div>
                      {s.points.length > 0 && (
                        <p className="mt-0.5 pl-1 text-[11px] text-(--notion-fg)/60">
                          {s.points.join(" · ")}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 액션 · 열린 질문 */}
            {(digest.actions.length > 0 || digest.openQuestions.length > 0) && (
              <div className="space-y-1">
                {digest.actions.map((a, i) => (
                  <p key={`a${i}`} className="text-[11.5px] text-(--notion-fg)/80">
                    ✅ {a}
                  </p>
                ))}
                {digest.openQuestions.map((q, i) => (
                  <p key={`q${i}`} className="text-[11.5px] text-(--notion-fg)/60">
                    ❓ {q}
                  </p>
                ))}
              </div>
            )}

            {/* 자막 전문 */}
            <div className="border-t border-(--notion-border) pt-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => void handleTranscriptToggle()}
                  className="py-1 text-[11.5px] font-semibold text-(--notion-fg)/75 hover:text-(--notion-fg)"
                >
                  {transcriptOpen ? "▾" : "▸"} 자막 전문
                </button>
                {transcriptOpen && transcript?.ok && transcript.mode === "transcript" && (
                  <button
                    type="button"
                    onClick={() => setAutoScroll((prev) => !prev)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      autoScroll
                        ? "border-(--focus-accent)/40 text-(--focus-accent)"
                        : "border-(--notion-border) text-(--notion-fg)/55"
                    }`}
                    title="재생 위치를 따라 자막 자동 스크롤"
                  >
                    오토스크롤 {autoScroll ? "ON" : "OFF"}
                  </button>
                )}
              </div>
              {transcriptOpen && (
                <div className="mt-1.5 max-h-72 overflow-y-auto rounded-lg bg-(--notion-gray)/50 px-2 py-2">
                  {transcriptLoading && (
                    <p className="py-3 text-center text-[11px] text-(--notion-fg)/55">
                      자막 불러오는 중…
                    </p>
                  )}
                  {transcript && !transcript.ok && (
                    <p className="py-2 text-[11px] text-(--notion-fg)/55">{transcript.error}</p>
                  )}
                  {transcript?.ok && transcript.mode === "snippet" && (
                    <p className="whitespace-pre-wrap text-[11px] text-(--notion-fg)/65">
                      (자막 없음 — 제목·설명){"\n"}
                      {transcript.text}
                    </p>
                  )}
                  {transcript?.ok && transcript.mode === "transcript" &&
                    transcript.lines.map((line, i) => (
                      <button
                        key={i}
                        ref={i === activeLineIndex ? activeLineRef : undefined}
                        type="button"
                        onClick={() => playAt(line.offset)}
                        className={`block w-full rounded px-1.5 py-0.5 text-left text-[11px] leading-relaxed transition-colors ${
                          i === activeLineIndex
                            ? "bg-(--focus-accent)/15 font-medium text-(--notion-fg)"
                            : "text-(--notion-fg)/65 hover:bg-(--notion-hover)"
                        }`}
                        title="이 구간부터 듣기"
                      >
                        <span className="mr-1.5 tabular-nums text-[10px] font-bold text-(--focus-accent)/80">
                          {formatOffset(line.offset)}
                        </span>
                        {line.text}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function formatOffset(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 카드에 붙는 딥다이브 진입 버튼 + 드로어 (병행 유지 — 기존 AI 요약 옆에 추가) */
export function DeepDiveButton({
  videoId,
  title,
  channel,
  durationSeconds,
}: {
  videoId: string;
  title: string;
  channel?: string | null;
  durationSeconds?: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-(--notion-border) px-2.5 py-1 text-[11px] font-semibold text-(--notion-fg)/75 transition-colors hover:bg-(--notion-hover) hover:text-(--notion-fg)"
        title="영상 전체 분석 — 인사이트·인용·키워드 추출"
      >
        <BookOpen size={12} /> 딥다이브
      </button>
      {open && (
        <VideoDigestDrawer
          videoId={videoId}
          title={title}
          channel={channel}
          durationSeconds={durationSeconds}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
