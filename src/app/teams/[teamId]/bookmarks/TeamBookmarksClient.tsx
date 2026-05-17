"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Bookmark, ExternalLink, Trash2 } from "lucide-react";

type BookmarkRow = {
  id: string;
  video_id: string;
  video_title: string;
  highlight: string;
  created_at: string;
};

function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") return url.pathname.replace("/", "") || null;
    if (url.hostname.includes("youtube.com")) return url.searchParams.get("v");
    return null;
  } catch {
    return null;
  }
}

export default function TeamBookmarksClient({ teamId }: { teamId: string }) {
  const [list, setList] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLink, setNewLink] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const res = await fetch(`/api/bookmarks?team_id=${encodeURIComponent(teamId)}`);
    if (res.ok) {
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adding) return;
    const videoId = extractYouTubeVideoId(newLink);
    if (!videoId) {
      setAddError("유효한 유튜브 링크 또는 영상 ID를 입력해 주세요.");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: videoId,
          video_title: newTitle.trim() || "제목 없는 영상",
          team_id: teamId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "추가 실패");
        return;
      }
      setNewLink("");
      setNewTitle("");
      fetchList();
    } catch {
      setAddError("요청 실패");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) setList((prev) => prev.filter((b) => b.id !== id));
  };

  const youtubeUrl = (videoId: string) =>
    `https://www.youtube.com/watch?v=${videoId}`;

  if (loading) {
    return <p className="text-sm text-(--notion-fg)/60">불러오는 중…</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-4">
        <h2 className="mb-3 text-sm font-semibold text-(--notion-fg)/80">링크 추가</h2>
        <form onSubmit={handleAdd} className="space-y-2">
          <input
            type="text"
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            placeholder="유튜브 URL 또는 영상 ID"
            className="w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm text-(--notion-fg) placeholder:text-(--notion-fg)/40"
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="제목 (선택)"
            className="w-full rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2 text-sm text-(--notion-fg) placeholder:text-(--notion-fg)/40"
          />
          <button
            type="submit"
            disabled={adding || !newLink.trim()}
            className="cta-primary flex items-center gap-1 rounded-lg bg-(--notion-fg) px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            <Bookmark size={14} /> 추가
          </button>
          {addError && <p className="text-sm text-red-500">{addError}</p>}
        </form>
      </section>

      {list.length === 0 ? (
        <p className="text-sm text-(--notion-fg)/60">아직 팀 북마크가 없습니다. 위에서 링크를 추가해 보세요.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((b) => (
            <li
              key={b.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-(--notion-border) bg-(--notion-bg) px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={youtubeUrl(b.video_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-sm font-medium text-(--notion-fg) hover:underline"
                >
                  {b.video_title}
                  <ExternalLink size={12} className="shrink-0" />
                </a>
                {b.highlight && b.highlight !== b.video_title && (
                  <p className="mt-0.5 truncate text-xs text-(--notion-fg)/60">{b.highlight}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDelete(b.id)}
                className="shrink-0 rounded p-1 text-(--notion-fg)/60 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                aria-label="삭제"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-(--notion-fg)/50">
        <Link href={`/teams/${teamId}/briefing`} className="underline hover:text-(--notion-fg)">
          팀 브리핑 보기
        </Link>
        {" · "}
        <Link href={`/teams/${teamId}/settings`} className="underline hover:text-(--notion-fg)">
          팀 설정
        </Link>
      </p>
    </div>
  );
}
