"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { summarizeVideoAction } from "@/app/actions/summarize";

interface Props {
  videoId: string;
  /** 그리드 카드처럼 셀 폭이 좁은 곳에서 버튼을 셀 가득 채우고 라벨을 truncate (오버플로 방지) */
  fullWidth?: boolean;
}

export default function SummarizeButton({ videoId, fullWidth }: Props) {
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
    <div className={`mt-2.5 text-sm ${fullWidth ? "w-full" : ""}`}>
      <button
        onClick={handleToggle}
        className={`${fullWidth ? "flex w-full min-w-0 justify-center" : "inline-flex whitespace-nowrap"} min-h-[44px] items-center gap-1.5 rounded-full bg-purple-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/60 dark:bg-purple-500 dark:hover:bg-purple-600`}
      >
        <Sparkles size={14} className={`shrink-0 text-white ${loading && !isOpen ? "animate-pulse" : ""}`} />
        <span className={fullWidth ? "truncate" : ""}>
          {summary ? "AI 핵심 3줄 요약 보기" : "AI 3줄 요약 요청하기"}
        </span>
        {isOpen ? <ChevronUp size={12} className="shrink-0 opacity-80" /> : <ChevronDown size={12} className="shrink-0 opacity-80" />}
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
