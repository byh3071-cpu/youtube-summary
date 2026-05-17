"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { ThemeIcon } from "@/components/ui/ThemeIcon";
import { summarizeInsightAction } from "@/app/actions/summarize";

interface Props {
  videoId: string;
  completed: boolean;
}

export default function InsightButton({ videoId, completed }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem(`insight_${videoId}`);
    if (cached) {
      queueMicrotask(() => setInsight(cached));
    }
  }, [videoId]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    if (!completed && !insight) {
      setError("이 인사이트 정리는 영상을 거의 끝까지 본 뒤에 사용하는 것이 더 좋아요.");
      setIsOpen(true);
      return;
    }

    setIsOpen(true);

    if (insight) return;

    setLoading(true);
    setError(null);

    try {
      const result = await summarizeInsightAction(videoId);

      if (result.error) {
        setError(result.error);
      } else if (result.insight) {
        setInsight(result.insight);
        localStorage.setItem(`insight_${videoId}`, result.insight);
        window.dispatchEvent(new Event("focus-feed:usage-updated"));
      }
    } catch {
      setError("인사이트 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1.5 text-sm">
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 rounded-full border border-(--notion-border) bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/20 focus-visible:outline-none focus:ring-2 focus:ring-amber-500/40 dark:border-amber-400/50 dark:bg-amber-500/15 dark:text-amber-50 hover:dark:bg-amber-500/25"
      >
        <ThemeIcon name="AI_summary" alt="AI 인사이트" size={24} className={loading && !isOpen ? "animate-pulse opacity-90" : ""} />
        {insight ? "내 인사이트 정리 보기" : "AI 인사이트 정리 받기"}
        {isOpen ? <ChevronUp size={12} opacity={0.6} /> : <ChevronDown size={12} opacity={0.6} />}
      </button>

      {isOpen && (
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="mt-3 cursor-text rounded-xl border border-amber-500/25 bg-amber-50/70 p-4 text-sm leading-relaxed text-amber-950 shadow-xs dark:border-amber-400/40 dark:bg-[rgba(15,23,42,0.92)] dark:text-amber-50/95"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-5 opacity-80">
              <Loader2 className="animate-spin text-amber-600 dark:text-amber-300" size={20} />
              <span className="text-[13px] font-medium tracking-tight">
                영상을 바탕으로, 지금 나에게 필요한 인사이트와 액션을 정리하고 있어요...
              </span>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-start gap-2.5 px-1 text-amber-700 dark:text-amber-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[13px] font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {insight && !loading && (
            <div className="space-y-2 whitespace-pre-wrap break-keep text-[13.5px] leading-relaxed">
              {insight}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
