"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Trash2, ExternalLink, Headphones, Rss } from "lucide-react";
import type { BookmarkRow } from "@/lib/supabase-server-cookies";
import { useRadioQueueOptional } from "@/contexts/RadioQueueContext";
import { useIsHydrated } from "@/lib/use-is-hydrated";

const RSS_BOOKMARK_PREFIX = "rss:";

function isRssBookmark(b: BookmarkRow) {
  return b.video_id.startsWith(RSS_BOOKMARK_PREFIX);
}

function rssArticleUrl(videoId: string) {
  return videoId.startsWith(RSS_BOOKMARK_PREFIX) ? videoId.slice(RSS_BOOKMARK_PREFIX.length) : "";
}

type FilterMode = "all" | "youtube" | "rss";

function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 이미 videoId만 들어온 경우 (11자 ID)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "");
      return id || null;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v");
      return id || null;
    }
    return null;
  } catch {
    return null;
  }
}

export default function BookmarksClient({ bookmarks }: { bookmarks: BookmarkRow[] }) {
  const [list, setList] = useState(bookmarks);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [newLink, setNewLink] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const radio = useRadioQueueOptional();
  const isHydrated = useIsHydrated();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const emptyBookmarksSrc = !isHydrated
    ? "/images/empty/Empty-bookmarks.png"
    : isDark
      ? "/images/empty/Empty-bookmarks_dark.png"
      : "/images/empty/Empty-bookmarks.png";

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setList((prev) => prev.filter((b) => b.id !== id));
  };

  const handlePlayInRadio = (b: BookmarkRow) => {
    if (!radio || isRssBookmark(b)) return;
    radio.replaceQueue([
      {
        videoId: b.video_id,
        title: b.video_title,
        summary: b.highlight || undefined,
      },
    ]);
  };

  const handleAddByLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adding) return;

    const videoId = extractYouTubeVideoId(newLink);
    if (!videoId) {
      setAddError("유효한 유튜브 영상 링크 또는 영상 ID를 입력해 주세요.");
      return;
    }

    const title = newTitle.trim() || "제목 없는 유튜브 영상";

    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          video_title: title,
          highlight: title,
        }),
      });

      if (res.status === 401) {
        setAddError("로그인이 필요합니다.");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setAddError(data.error ?? "북마크 추가에 실패했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const refreshed = await fetch("/api/bookmarks").then((r) => r.json());
      if (Array.isArray(refreshed)) {
        setList(refreshed as BookmarkRow[]);
      }
      setNewLink("");
      setNewTitle("");
      setAddError(null);
    } finally {
      setAdding(false);
    }
  };

  const filtered = list.filter((b) => {
    if (filter === "youtube") return !isRssBookmark(b);
    if (filter === "rss") return isRssBookmark(b);
    return true;
  });

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-(--notion-border) bg-(--notion-gray)/30 px-6 py-10 text-center">
        <div className="mx-auto mb-4 h-28 w-28">
          <Image
            src={emptyBookmarksSrc}
            alt="저장된 북마크가 없음을 나타내는 일러스트"
            width={112}
            height={112}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <p className="text-sm font-medium text-(--notion-fg)/70">저장한 북마크가 없습니다.</p>
        <p className="mt-1 text-xs text-(--notion-fg)/50">피드에서 북마크 아이콘을 눌러 저장해 보세요.</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-(--notion-fg)/80 underline hover:text-(--notion-fg)"
        >
          피드로 가기
        </Link>
      </div>
    );
  }

  const youtubeWatchUrl = (videoId: string) =>
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

  const youtubeThumbUrl = (videoId: string) =>
    `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;

  return (
    <>
      <form
        onSubmit={handleAddByLink}
        className="mb-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 sm:px-5 sm:py-4"
      >
        <p className="mb-2 text-xs font-semibold text-(--notion-fg)/70">
          유튜브 링크로 북마크 추가
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1">
            <label htmlFor="bookmark-link" className="sr-only">
              유튜브 링크 또는 영상 ID
            </label>
            <input
              id="bookmark-link"
              type="text"
              autoComplete="off"
              placeholder="https://www.youtube.com/watch?v=... 또는 영상 ID"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              className="w-full rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-xs text-(--notion-fg) placeholder:text-(--notion-fg)/40 focus:border-(--focus-accent) focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="bookmark-title" className="sr-only">
              제목 (선택)
            </label>
            <input
              id="bookmark-title"
              type="text"
              autoComplete="off"
              placeholder="북마크에 표시할 제목 (선택)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-xs text-(--notion-fg) placeholder:text-(--notion-fg)/40 focus:border-(--focus-accent) focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="shrink-0 rounded-full bg-(--focus-accent) px-4 py-2 text-xs font-semibold text-black shadow-sm transition-colors hover:bg-(--focus-accent)/90 disabled:opacity-60"
          >
            {adding ? "추가 중..." : "북마크 추가"}
          </button>
        </div>
        {addError && (
          <p className="mt-2 text-[11px] text-red-500">
            {addError}
          </p>
        )}
      </form>

      <div className="mb-4 inline-flex rounded-full border border-(--notion-border) bg-(--notion-bg) p-1 text-xs">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${
            filter === "all" ? "bg-(--notion-fg) text-(--notion-bg)" : "text-(--notion-fg)/65 hover:bg-(--notion-hover)"
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => setFilter("youtube")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${
            filter === "youtube"
              ? "bg-(--notion-fg) text-(--notion-bg)"
              : "text-(--notion-fg)/65 hover:bg-(--notion-hover)"
          }`}
        >
          YouTube
        </button>
        <button
          type="button"
          onClick={() => setFilter("rss")}
          className={`rounded-full px-3 py-1 font-semibold transition-colors ${
            filter === "rss"
              ? "bg-(--notion-fg) text-(--notion-bg)"
              : "text-(--notion-fg)/65 hover:bg-(--notion-hover)"
          }`}
        >
          RSS·뉴스
        </button>
      </div>

      <ul className="space-y-3">
        {filtered.map((b) => {
        const rss = isRssBookmark(b);
        const articleUrl = rss ? rssArticleUrl(b.video_id) : "";
        return (
          <li
            key={b.id}
            className="flex items-stretch gap-3 rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4"
          >
            {rss ? (
              <div className="flex h-20 w-32 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <Rss size={28} />
              </div>
            ) : (
              <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-(--notion-gray)">
                <Image
                  src={youtubeThumbUrl(b.video_id)}
                  alt={b.video_title}
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-(--notion-fg) line-clamp-2">{b.video_title}</p>
              {b.highlight && b.highlight !== b.video_title && (
                <p className="mt-1 text-xs text-(--notion-fg)/65 line-clamp-3">
                  <span className="mr-1 rounded-full bg-(--notion-gray)/40 px-1.5 py-0.5 text-[10px] font-semibold text-(--notion-fg)/70">
                    {rss ? "요약" : "AI 메모"}
                  </span>
                  {b.highlight}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <a
                  href={rss ? articleUrl : youtubeWatchUrl(b.video_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-2 py-1 font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
                >
                  <ExternalLink size={12} />
                  {rss ? "원문 보기" : "영상 원문 보기"}
                </a>
                {!rss && (
                  <button
                    type="button"
                    onClick={() => handlePlayInRadio(b)}
                    className="inline-flex items-center gap-1 rounded-full bg-(--notion-fg) px-2 py-1 font-semibold text-(--notion-bg) hover:bg-(--notion-fg)/90"
                  >
                    <Headphones size={12} />
                    라디오로 듣기
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(b.id)}
              className="self-start shrink-0 rounded p-2 text-(--notion-fg)/40 hover:bg-(--notion-hover) hover:text-red-600"
              aria-label="북마크 삭제"
            >
              <Trash2 size={18} />
            </button>
          </li>
        );
      })}
      </ul>
    </>
  );
}
