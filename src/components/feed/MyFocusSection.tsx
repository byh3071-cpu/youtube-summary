"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { loadGoals, saveGoals } from "@/lib/goals";
import {
  loadVideoSummary,
  loadBriefingCache,
  saveBriefingCache,
  clearBriefingCache,
  wasVideoNotionPushed,
  markVideoNotionPushed,
  loadVideoNotionInfo,
} from "@/lib/focus-feed-storage";
import { rankFeedByGoalsAction } from "@/app/actions/summarize";
import { syncVideoToNotionAction } from "@/app/actions/notion-sync";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import type { TodayFocusEntry } from "./TodayFocusCard";

type NotionSyncState =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "done"; summaryUrl?: string }
  | { state: "error"; message: string };

type AiRankedRecommendation = TodayFocusEntry;
type BriefingResult =
  | { ranked: AiRankedRecommendation[] }
  | { error: string }
  | undefined;

const BRIEFING_TOP_N = 3;
const GOALS_PREVIEW_LIMIT = 140;
const SAVED_FLASH_MS = 1500;

function isRankedResult(
  result: BriefingResult,
): result is { ranked: AiRankedRecommendation[] } {
  return !!result && "ranked" in result && Array.isArray(result.ranked);
}

function isErrorResult(result: BriefingResult): result is { error: string } {
  return (
    !!result &&
    "error" in result &&
    typeof result.error === "string" &&
    result.error.length > 0
  );
}

export default function MyFocusSection() {
  const radio = useRadioQueueOptional();
  const [hydrated, setHydrated] = useState(false);
  const [goals, setGoals] = useState("");
  const [goalsTouched, setGoalsTouched] = useState(false);
  const [showSavedFlash, setShowSavedFlash] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiBriefing, setAiBriefing] = useState<AiRankedRecommendation[] | null>(null);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [goalsPreviewExpanded, setGoalsPreviewExpanded] = useState(false);
  const [notionSync, setNotionSync] = useState<Record<string, NotionSyncState>>({});
  const briefingRequestId = useRef(0);
  const mountedRef = useRef(true);
  const savedFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSyncedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    const stored = loadGoals();
    setGoals(stored);
    setFocusExpanded(!stored.trim());
    const cached = loadBriefingCache<AiRankedRecommendation[]>(stored);
    if (cached && cached.length > 0) {
      setAiBriefing(cached);
      const hydratedStatus: Record<string, NotionSyncState> = {};
      for (const entry of cached) {
        const vid = entry.item.id;
        if (!vid) continue;
        const info = loadVideoNotionInfo(vid);
        if (info) {
          hydratedStatus[vid] = { state: "done", summaryUrl: info.summaryUrl };
          autoSyncedRef.current.add(vid);
        }
      }
      if (Object.keys(hydratedStatus).length > 0) {
        setNotionSync(hydratedStatus);
      }
    }
    setHydrated(true);
    return () => {
      mountedRef.current = false;
      if (savedFlashTimerRef.current) {
        clearTimeout(savedFlashTimerRef.current);
      }
    };
  }, []);

  const handlePlayFromBriefing = useCallback(
    (entry: AiRankedRecommendation) => {
      if (!radio) return;
      const item = entry.item;
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
    },
    [radio],
  );

  const handlePushToNotion = useCallback(
    async (entry: AiRankedRecommendation, opts: { auto?: boolean } = {}) => {
      const videoId = entry.item.id;
      if (!videoId || entry.item.source !== "YouTube") return;
      const current = notionSync[videoId];
      if (current?.state === "syncing") return;
      if (opts.auto && (current?.state === "done" || wasVideoNotionPushed(videoId))) {
        return;
      }

      setNotionSync((prev) => ({ ...prev, [videoId]: { state: "syncing" } }));

      try {
        const result = await syncVideoToNotionAction({
          videoId,
          title: entry.item.title,
          channel: entry.item.sourceName ?? null,
          durationMinutes:
            entry.item.durationSeconds != null
              ? entry.item.durationSeconds / 60
              : null,
          hint: {
            priority: entry.priority,
            score: entry.score,
            why: entry.why,
            action: entry.action,
          },
        });

        if (!mountedRef.current) return;

        if ("error" in result) {
          setNotionSync((prev) => ({
            ...prev,
            [videoId]: { state: "error", message: result.error },
          }));
          return;
        }
        const summaryUrl = "summaryUrl" in result ? result.summaryUrl : undefined;
        setNotionSync((prev) => ({
          ...prev,
          [videoId]: { state: "done", summaryUrl },
        }));
        if (summaryUrl) markVideoNotionPushed(videoId, summaryUrl);
      } catch (error) {
        if (!mountedRef.current) return;
        console.error("syncVideoToNotion error:", error);
        setNotionSync((prev) => ({
          ...prev,
          [videoId]: {
            state: "error",
            message: "노션 동기화 중 오류가 발생했습니다.",
          },
        }));
      }
    },
    [notionSync],
  );

  const radioPlayback = radio?.playback;
  useEffect(() => {
    if (!radioPlayback?.completed) return;
    const completedId = radioPlayback.videoId;
    if (!completedId || autoSyncedRef.current.has(completedId)) return;
    if (!aiBriefing) return;
    const entry = aiBriefing.find((e) => e.item.id === completedId);
    if (!entry) return;
    if (wasVideoNotionPushed(completedId)) {
      autoSyncedRef.current.add(completedId);
      return;
    }
    autoSyncedRef.current.add(completedId);
    void handlePushToNotion(entry, { auto: true });
  }, [radioPlayback?.completed, radioPlayback?.videoId, aiBriefing, handlePushToNotion]);

  const runBriefing = useCallback(
    async ({ forceFresh }: { forceFresh: boolean }) => {
      const trimmed = goals.trim();
      if (!trimmed) return;

      if (!forceFresh) {
        const cached = loadBriefingCache<AiRankedRecommendation[]>(trimmed);
        if (cached && cached.length > 0) {
          setAiBriefing(cached);
          setAiError(null);
          return;
        }
      } else {
        clearBriefingCache(trimmed);
      }

      const currentId = ++briefingRequestId.current;
      setAiError(null);
      setAiLoading(true);

      try {
        const result = (await rankFeedByGoalsAction(trimmed)) as BriefingResult;

        if (!mountedRef.current || currentId !== briefingRequestId.current) return;

        if (!result) {
          setAiError("AI 브리핑 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.");
          setAiBriefing(null);
          return;
        }
        if (isErrorResult(result)) {
          setAiError(result.error);
          setAiBriefing(null);
          return;
        }
        if (isRankedResult(result) && result.ranked.length > 0) {
          const topN = result.ranked.slice(0, BRIEFING_TOP_N);
          setAiBriefing(topN);
          saveBriefingCache(trimmed, topN);
          window.dispatchEvent(new Event("focus-feed:usage-updated"));
        } else {
          setAiError("사용자 목표/관심사와 잘 맞는 추천을 찾지 못했습니다.");
          setAiBriefing(null);
        }
      } catch (error) {
        if (!mountedRef.current || currentId !== briefingRequestId.current) return;
        console.error("AI Morning Briefing 호출 오류:", error);
        setAiError("AI 브리핑 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        setAiBriefing(null);
      } finally {
        if (mountedRef.current && currentId === briefingRequestId.current) {
          setAiLoading(false);
        }
      }
    },
    [goals],
  );

  const handleRunAiBriefing = useCallback(() => {
    void runBriefing({ forceFresh: false });
  }, [runBriefing]);

  const handleRegenerate = useCallback(() => {
    void runBriefing({ forceFresh: true });
  }, [runBriefing]);

  const handleSaveGoals = useCallback(() => {
    saveGoals(goals);
    setGoalsTouched(false);
    setShowSavedFlash(true);
    if (savedFlashTimerRef.current) {
      clearTimeout(savedFlashTimerRef.current);
    }
    savedFlashTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setShowSavedFlash(false);
    }, SAVED_FLASH_MS);
  }, [goals]);

  const trimmedGoals = goals.trim();
  const hasGoals = trimmedGoals.length > 0;
  const goalsTooLong = trimmedGoals.length > GOALS_PREVIEW_LIMIT;
  const goalsToShow =
    !goalsTooLong || goalsPreviewExpanded
      ? trimmedGoals
      : `${trimmedGoals.slice(0, GOALS_PREVIEW_LIMIT)}…`;

  return (
    <section className="mb-3 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 text-sm sm:px-5 sm:py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/60">
            My Focus
          </p>
          <p className="mt-1 whitespace-pre-wrap text-[11px] leading-snug text-(--notion-fg)/70 sm:text-[12px]">
            {hasGoals
              ? goalsToShow
              : "지금 가장 중요한 목표나 관심사를 한두 줄로 적어보세요."}
          </p>
          {goalsTooLong && (
            <button
              type="button"
              onClick={() => setGoalsPreviewExpanded((prev) => !prev)}
              className="mt-0.5 text-[10px] font-semibold text-(--notion-fg)/55 hover:text-(--notion-fg)/80"
            >
              {goalsPreviewExpanded ? "접기" : "더 보기"}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-(--notion-fg)/65">
          {hydrated && (
            <button
              type="button"
              onClick={() => setFocusExpanded((prev) => !prev)}
              className="rounded-full border border-(--notion-border) px-2.5 py-1 font-semibold hover:bg-(--notion-hover)"
            >
              {focusExpanded ? (hasGoals ? "접기" : "닫기") : "편집"}
            </button>
          )}
          <button
            type="button"
            onClick={handleRunAiBriefing}
            disabled={!hasGoals || aiLoading}
            aria-busy={aiLoading}
            className="rounded-full bg-(--notion-fg) px-3 py-1 text-[11px] font-semibold text-(--notion-bg) transition-colors hover:bg-(--notion-fg)/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {aiLoading ? "브리핑 중..." : "AI 브리핑"}
          </button>
        </div>
      </div>

      {hydrated && focusExpanded && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <label htmlFor="my-focus-goals" className="sr-only">
            MY FOCUS 관심사 입력
          </label>
          <textarea
            id="my-focus-goals"
            name="goals"
            value={goals}
            onChange={(e) => {
              setGoals(e.target.value);
              setGoalsTouched(true);
            }}
            placeholder="예: 3개월 안에 1인 SaaS를 런칭하고 싶어요. 프론트엔드는 할 줄 알고, 마케팅/세일즈가 약합니다."
            rows={3}
            className="min-h-[68px] flex-1 resize-none rounded-xl border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-[12px] leading-relaxed text-(--notion-fg) outline-none focus:border-(--notion-fg)/30"
          />
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              onClick={handleSaveGoals}
              className="rounded-full bg-(--notion-fg) px-3 py-1.5 text-[11px] font-semibold text-(--notion-bg) transition-colors hover:bg-(--notion-fg)/90"
            >
              {showSavedFlash ? "✓ 저장됨" : goalsTouched ? "관심사 저장" : "저장됨"}
            </button>
          </div>
        </div>
      )}

      {((aiBriefing && aiBriefing.length > 0) || aiError) && (
        <div
          className={`relative mt-3 space-y-1.5 rounded-xl border border-(--notion-border) bg-(--notion-bg)/80 px-3 py-2.5 text-[12px] transition-opacity ${
            aiLoading ? "opacity-50" : "opacity-100"
          }`}
          aria-busy={aiLoading}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-(--notion-fg)/75">
              오늘의 추천 콘텐츠
            </p>
            <div className="flex items-center gap-2">
              {aiBriefing && (
                <span className="text-[10px] text-(--notion-fg)/50">
                  상위 {aiBriefing.length}개 콘텐츠 기준
                </span>
              )}
              {aiBriefing && aiBriefing.length > 0 && hasGoals && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={aiLoading}
                  className="rounded-full border border-(--notion-border) px-2 py-0.5 text-[10px] font-semibold text-(--notion-fg)/70 hover:bg-(--notion-hover) disabled:cursor-not-allowed disabled:opacity-50"
                >
                  다시 추천
                </button>
              )}
            </div>
          </div>

          {aiError && (
            <p className="text-[11px] leading-relaxed text-(--notion-fg)/65">
              {aiError}
            </p>
          )}

          {aiBriefing && aiBriefing.length > 0 && (
            <ul className="space-y-2.5">
              {aiBriefing.map((entry, index) => {
                const entryKey =
                  entry.item.id ?? entry.item.link ?? `${entry.item.source}-${index}`;
                const vid = entry.item.id;
                const syncState: NotionSyncState =
                  (vid && notionSync[vid]) || { state: "idle" };
                const isYoutubeEntry =
                  entry.item.source === "YouTube" && !!vid;
                return (
                  <li
                    key={`${entry.item.source}:${entryKey}:${entry.priority}:${index}`}
                    className="flex gap-3 rounded-lg bg-(--notion-gray)/40 px-3 py-2"
                  >
                    <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-md bg-(--notion-gray)">
                      {entry.item.thumbnail ? (
                        <button
                          type="button"
                          onClick={() => handlePlayFromBriefing(entry)}
                          className="group relative block h-full w-full text-left"
                        >
                          <Image
                            src={entry.item.thumbnail}
                            alt={entry.item.title}
                            fill
                            sizes="120px"
                            className="object-cover transition-transform group-hover:scale-[1.03]"
                          />
                          {entry.item.source === "YouTube" && radio && (
                            <span className="absolute inset-x-1 bottom-1 rounded-full bg-black/55 px-2 py-[2px] text-[10px] font-semibold text-white">
                              라디오 재생
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-(--notion-fg)/50">
                          썸네일 없음
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-(--notion-fg)/60">
                        <span className="inline-flex items-center gap-1 rounded-full bg-(--notion-fg)/10 px-2 py-[1px] text-[10px] font-semibold text-(--notion-fg)/80">
                          {entry.priority}순위
                        </span>
                        <span className="text-[10px]">
                          적합도 {Math.round(entry.score)}점
                        </span>
                      </div>
                      {entry.item.source === "YouTube" &&
                      entry.item.id &&
                      radio ? (
                        <button
                          type="button"
                          onClick={() => handlePlayFromBriefing(entry)}
                          className="block text-left text-[12px] font-semibold text-(--notion-fg) underline-offset-2 hover:underline"
                        >
                          {entry.item.title}
                        </button>
                      ) : (
                        <a
                          href={entry.item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-[12px] font-semibold text-(--notion-fg) underline-offset-2 hover:underline"
                        >
                          {entry.item.title}
                        </a>
                      )}
                      <p className="text-[11px] leading-relaxed text-(--notion-fg)/75">
                        {entry.why}
                      </p>
                      <p className="text-[11px] leading-relaxed text-(--notion-fg)/70">
                        <span className="font-semibold">이번 주 액션:</span>{" "}
                        {entry.action}
                      </p>
                      {isYoutubeEntry && (
                        <div className="flex items-center gap-2 pt-0.5 text-[10px]">
                          {syncState.state === "done" ? (
                            syncState.summaryUrl ? (
                              <a
                                href={syncState.summaryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-full border border-(--notion-border) px-2 py-0.5 font-semibold text-(--notion-fg)/75 hover:bg-(--notion-hover)"
                              >
                                ✓ 노션에서 열기
                              </a>
                            ) : (
                              <span className="rounded-full border border-(--notion-border) px-2 py-0.5 font-semibold text-(--notion-fg)/55">
                                ✓ 노션 정리됨
                              </span>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handlePushToNotion(entry)}
                              disabled={syncState.state === "syncing"}
                              aria-busy={syncState.state === "syncing"}
                              className="rounded-full border border-(--notion-border) px-2 py-0.5 font-semibold text-(--notion-fg)/70 hover:bg-(--notion-hover) disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {syncState.state === "syncing"
                                ? "노션 정리 중..."
                                : "📝 노션에 정리"}
                            </button>
                          )}
                          {syncState.state === "error" && (
                            <span className="text-[10px] text-red-600">
                              {syncState.message}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
