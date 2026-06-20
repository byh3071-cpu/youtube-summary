"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { ThemeIcon } from "@/components/ui/ThemeIcon";
import { summarizeVideoAction } from "@/app/actions/summarize";

interface Props {
  videoId: string;
}

export default function SummarizeButton({ videoId }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

  useEffect(() => {
    const cached = localStorage.getItem(`summary_${videoId}`);
    if (cached) {
      queueMicrotask(() => setSummary(cached));
    }
  }, [videoId]);

  const handleToggle = async (e: React.MouseEvent) => {
    // 상위 FeedItem의 a 태그 링크 이동 방지
    e.preventDefault(); 
    e.stopPropagation();

    if (isOpen) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);

    if (summary) {
      return; 
    }

    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await summarizeVideoAction(videoId);

      if (result.error) {
        setError(result.error);
      } else if (result.summary) {
        setSummary(result.summary);
        localStorage.setItem(`summary_${videoId}`, result.summary);
        window.dispatchEvent(new Event("focus-feed:usage-updated"));
      }
    } catch {
      setError("요약 요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
      requestInFlight.current = false;
    }
  };

  return (
    <div className="mt-2.5 text-sm">
      <button
        onClick={handleToggle}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-(--notion-border) bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-500/20 focus-visible:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-purple-400/50 dark:bg-purple-500/15 dark:text-purple-100 hover:dark:bg-purple-500/25"
      >
        <ThemeIcon name="AI_summary" alt="AI 요약" size={24} className={loading && !isOpen ? "animate-pulse opacity-90" : ""} />
        {summary ? "AI 핵심 3줄 요약 보기" : "AI 3줄 요약 요청하기"}
        {isOpen ? <ChevronUp size={12} opacity={0.6} /> : <ChevronDown size={12} opacity={0.6} />}
      </button>

      {isOpen && (
        <div 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }} 
          className="mt-3 cursor-text rounded-xl border border-purple-500/25 bg-purple-50/60 p-4 text-sm leading-relaxed text-purple-900 shadow-xs dark:border-purple-500/40 dark:bg-[rgba(15,23,42,0.92)] dark:text-slate-50"
        >
          {loading && (
            <div className="flex flex-col items-center justify-center py-5 opacity-70 gap-3">
              <Loader2 className="animate-spin text-purple-600 dark:text-purple-400" size={20} />
              <span className="text-[13px] font-medium tracking-tight">AI가 자막을 읽고 핵심 내용만 3줄로 정리하고 있습니다...</span>
            </div>
          )}
          
          {error && !loading && (
            <div className="flex items-start gap-2.5 text-red-600 dark:text-red-400 px-1">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p className="text-[13px] font-medium leading-relaxed">{error}</p>
            </div>
          )}

          {summary && !loading && (
            <div className="space-y-2 whitespace-pre-wrap text-[13.5px] leading-relaxed break-keep">
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
