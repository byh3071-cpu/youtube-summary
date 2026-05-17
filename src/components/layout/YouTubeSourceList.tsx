"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  getCustomSourcesFromCookie,
  buildCustomSourcesCookie,
} from "@/lib/custom-sources-cookie";
import type { FeedSource } from "@/lib/sources";

const LAST_SEEN_SOURCE_KEY = "focus_feed_last_seen_source";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
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

  const handleRemove = (e: React.MouseEvent, sourceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = getCookie(CUSTOM_SOURCES_COOKIE_NAME);
    const list = getCustomSourcesFromCookie(raw);
    const next = list.filter((s) => s.id !== sourceId);
    document.cookie = buildCustomSourcesCookie(next);
    fetch(`/api/custom-sources?sourceId=${encodeURIComponent(sourceId)}`, { method: "DELETE" }).catch(
      () => {}
    );
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
