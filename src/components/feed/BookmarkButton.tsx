"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Loader2 } from "lucide-react";

interface Props {
  videoId: string;
  videoTitle: string;
  highlight?: string;
  isBookmarked: boolean;
  bookmarkId: string | null;
  onBookmarkChange: () => void;
  /** 로그인 안 했을 때 true */
  disabled?: boolean;
  /** 리얼 뷰 등에서 큰 버튼용 (예: h-9 w-9) */
  className?: string;
  /** 리얼 뷰 등에서 아이콘 크기 (기본 16, 20~30 권장) */
  iconSize?: number;
}

const DEFAULT_ICON_SIZE = 16;

export default function BookmarkButton({
  videoId,
  videoTitle,
  highlight,
  isBookmarked,
  bookmarkId,
  onBookmarkChange,
  disabled,
  className,
  iconSize = DEFAULT_ICON_SIZE,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [optimisticBookmarked, setOptimisticBookmarked] = useState(isBookmarked);
  // 연타(이중탭) 시 setState 비동기 지연 사이로 중복 요청이 나가는 것을 동기 ref로 막는다.
  const inFlight = useRef(false);

  useEffect(() => {
    setOptimisticBookmarked(isBookmarked);
  }, [isBookmarked]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || loading || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    const prev = optimisticBookmarked;
    setOptimisticBookmarked(!prev);
    try {
      if (isBookmarked && bookmarkId) {
        const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(bookmarkId)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          onBookmarkChange();
        } else if (res.status === 401) {
          setOptimisticBookmarked(prev);
          alert("로그인이 필요합니다.");
        } else {
          setOptimisticBookmarked(prev);
        }
      } else {
        const res = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            video_id: videoId,
            video_title: videoTitle,
            highlight: highlight ?? videoTitle,
          }),
        });
        if (res.ok) {
          onBookmarkChange();
        } else if (res.status === 401) {
          setOptimisticBookmarked(prev);
          alert("로그인이 필요합니다.");
        } else if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setOptimisticBookmarked(prev);
          alert(data?.error ?? "북마크 저장에 실패했습니다.");
        }
      }
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  if (disabled) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center justify-center rounded-full transition-colors touch-manipulation ${className ?? "h-11 w-11 min-h-[44px] min-w-[44px]"} ${
        optimisticBookmarked
          ? "text-amber-500 hover:bg-amber-500/10 hover:text-amber-600"
          : "text-(--notion-fg)/50 hover:bg-(--notion-hover) hover:text-(--notion-fg)/70"
      }`}
      aria-label={isBookmarked ? "북마크 해제" : "북마크 추가"}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin text-(--notion-fg)/60" />
      ) : (
        <Bookmark
          size={iconSize}
          className={isBookmarked ? "fill-current" : ""}
        />
      )}
    </button>
  );
}
