"use client";

import { RefreshCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const LAST_REFRESH_KEY = "focus_feed_last_refresh";

function formatLastRefresh(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "방금 전";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}시간 전`;
  return `${Math.floor(diff / 86400_000)}일 전`;
}

export default function RefreshButton() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(LAST_REFRESH_KEY);
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n)) setLastRefreshAt(n);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/revalidate", { method: "POST" });

      if (!response.ok) {
        throw new Error("Revalidation request failed");
      }

      router.refresh();
      const now = Date.now();
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_REFRESH_KEY, String(now));
      }
      setLastRefreshAt(now);
      setStatusMessage("최신 피드를 다시 불러왔습니다.");
    } catch (error) {
      console.error("Failed to revalidate UI", error);
      setStatusMessage("새로고침에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const shortHint = lastRefreshAt != null ? `마지막 갱신: ${formatLastRefresh(lastRefreshAt)}` : "";
  const tooltipText = "최신 피드를 다시 가져올 수 있습니다.";

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing}
        title={shortHint || tooltipText}
        className="flex min-h-[44px] items-center gap-2 rounded-full border border-(--notion-border) bg-(--notion-bg)/75 px-3 py-2 text-sm text-(--notion-fg)/70 shadow-sm transition-colors touch-manipulation hover:bg-(--notion-hover) hover:text-(--notion-fg) disabled:opacity-50 sm:min-h-0"
      >
        <RefreshCcw size={14} className={isRefreshing ? "animate-spin" : ""} />
        <span>{isRefreshing ? "새로고침 중…" : "새로고침"}</span>
      </button>
      {(statusMessage || shortHint) && (
        <span aria-live="polite" className="max-w-48 text-xs text-(--notion-fg)/50 sm:text-right">
          {statusMessage || shortHint}
        </span>
      )}
    </div>
  );
}
