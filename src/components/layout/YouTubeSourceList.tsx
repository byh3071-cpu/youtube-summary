"use client";

import { useState } from "react";
import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import type { FeedSource } from "@/lib/sources";

const LAST_SEEN_SOURCE_KEY = "focus_feed_last_seen_source";

/** 같은 경로에서 searchParams만 바뀌는 네비게이션은 loading.tsx가 뜨지 않으므로
 *  클릭 즉시 항목 옆에 스피너를 보여 반응성을 확보한다. (Link 내부에서만 동작) */
function LinkPendingSpinner() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 size={13} className="ml-1 shrink-0 animate-spin text-(--notion-fg)/50" />;
}

interface Props {
  items: FeedSource[];
  selectedSourceId?: string;
  customSourceIds: string[];
  latestVideoBySource?: Record<string, string>;
}

function getInitials(name: string): string {
  if (!name) return "";
  const trimmed = name.trim();
  if (trimmed.length <= 2) return trimmed;
  return trimmed.slice(0, 2);
}

export default function YouTubeSourceList({
  items,
  selectedSourceId,
  customSourceIds,
  latestVideoBySource,
}: Props) {
  const router = useRouter();
  const customSet = new Set(customSourceIds);
  const [now] = useState(() => Date.now());
  const [lastSeen, setLastSeen] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem(LAST_SEEN_SOURCE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // ignore localStorage parse errors
    }
    return {};
  });

  const markSourceSeen = (sourceId: string, latest?: string) => {
    if (!latest) return;
    setLastSeen((prev) => {
      const next = { ...prev, [sourceId]: latest };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(LAST_SEEN_SOURCE_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore write errors
      }
      return next;
    });
  };

  const handleRemove = async (e: React.MouseEvent, sourceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // 쿠키 갱신(Set-Cookie)은 서버가 담당하므로 응답을 기다린 뒤 새로고침해야 반영된다
    try {
      await fetch(`/api/custom-sources?sourceId=${encodeURIComponent(sourceId)}`, {
        method: "DELETE",
      });
    } catch {
      // 네트워크 오류 시에도 refresh로 현재 상태 재동기화
    }
    router.refresh();
  };

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = selectedSourceId === item.id;
        const isCustom = customSet.has(item.id);
        const latest = latestVideoBySource?.[item.id];
        const isRecent =
          latest && Number.isFinite(new Date(latest).getTime())
            ? now - new Date(latest).getTime() < 24 * 60 * 60 * 1000
            : false;
        const lastSeenForSource = lastSeen[item.id];
        const hasNew =
          isRecent &&
          latest &&
          (!lastSeenForSource ||
            new Date(latest).getTime() > new Date(lastSeenForSource).getTime());
        return (
          <div
            key={item.id}
            className={`flex items-center gap-1 rounded-md px-2 py-1.5 group ${isActive ? "bg-(--notion-hover)" : "hover:bg-(--notion-hover)/60"}`}
          >
            <Link
              href={{ pathname: "/", query: { source: item.id } }}
              onClick={() => {
                if (latest) markSourceSeen(item.id, latest);
              }}
              className={`min-w-0 flex-1 flex items-center justify-between gap-2 py-0.5 text-sm transition-colors ${isActive ? "font-medium text-(--notion-fg)" : "text-(--notion-fg)/80 hover:text-(--notion-fg)"}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--notion-hover) text-[11px] font-semibold text-(--notion-fg)">
                  {item.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.avatarUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{getInitials(item.name)}</span>
                  )}
                </div>
                <span className="truncate">{item.name}</span>
                <LinkPendingSpinner />
              </div>
              {hasNew && !isActive && (
                <span className="ml-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-r from-emerald-400 to-sky-400 shadow-[0_0_0_3px_rgba(16,185,129,0.25)]" />
              )}
            </Link>
            {isCustom && (
              <button
                type="button"
                onClick={(e) => handleRemove(e, item.id)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-(--notion-fg)/40 hover:bg-(--notion-gray) hover:text-red-600 min-h-[44px] min-w-[44px] touch-manipulation"
                aria-label={`${item.name} 채널 목록에서 제거`}
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
