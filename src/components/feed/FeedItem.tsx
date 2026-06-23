import { FeedItem as FeedItemType } from "@/types/feed";
import Image from "next/image";
import SummarizeButton from "./SummarizeButton";
import AddToRadioButton from "./AddToRadioButton";
import BookmarkButton from "./BookmarkButton";
import type { BookmarkEntry } from "./FeedClientContainer";

interface Props {
    item: FeedItemType;
    bookmark?: BookmarkEntry | null;
    onBookmarkChange?: () => void;
}

const RSS_BOOKMARK_PREFIX = "rss:";

export default function FeedItem({ item, bookmark, onBookmarkChange }: Props) {
    const publishedAt = new Date(item.pubDate);
    const hasValidDate = Number.isFinite(publishedAt.getTime());
    const cleanSummary = item.summary?.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
    const sourceToneClass = item.source === "YouTube"
        ? "bg-red-500/10 text-red-600 dark:text-red-300"
        : "bg-blue-500/10 text-blue-600 dark:text-blue-300";

    // 날짜 포맷팅 (예: 2026-03-11)
    const formattedDate = hasValidDate
        ? new Intl.DateTimeFormat('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric'
        }).format(publishedAt)
        : "날짜 미상";

    return (
        <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${item.sourceName}의 ${item.title} 열기`}
            className="group mb-3 block rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-transform transition-shadow hover:-translate-y-[1px] hover:shadow-[0_8px_18px_rgba(15,23,42,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--notion-fg)/20 last:mb-0 sm:px-5 dark:bg-[rgba(15,23,42,0.85)] dark:border-[rgba(148,163,184,0.28)] dark:hover:border-(--focus-accent)/60"
        >
            <div className="flex items-start gap-3 sm:gap-4">
                {/* Source Icon Indicator (Minimal) */}
                <div className="mt-1 shrink-0">
                    {item.source === 'YouTube' ? (
                        <div className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${sourceToneClass}`}>
                            YT
                        </div>
                    ) : (
                        <div className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${sourceToneClass}`}>
                            RSS
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-(--notion-fg)/50">
                        <span className={`rounded-full px-2 py-0.5 ${sourceToneClass}`}>
                            {item.source}
                        </span>
                        <span className="truncate">{item.sourceName}</span>
                        {item.source === "RSS" && onBookmarkChange && (
                            <span
                                className="ml-auto shrink-0"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <BookmarkButton
                                    videoId={`${RSS_BOOKMARK_PREFIX}${item.link}`}
                                    videoTitle={item.title}
                                    highlight={item.summary ?? item.title}
                                    isBookmarked={!!bookmark}
                                    bookmarkId={bookmark?.id ?? null}
                                    onBookmarkChange={onBookmarkChange}
                                />
                            </span>
                        )}
                    </div>

                    <h3 className="mb-1 wrap-break-word text-base font-medium leading-tight text-(--notion-fg) decoration-(--notion-border) underline-offset-2 group-hover:underline">
                        {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--notion-fg)/60">
                        <span>{formattedDate}</span>
                        <span>·</span>
                        <span className="underline-offset-2 group-hover:underline text-(--notion-fg)/70 font-medium">원문 보기</span>
                    </div>

                    {/* RSS인 경우 요약 텍스트 한 줄 추가 (Notion Description Style) */}
                    {item.source === 'RSS' && cleanSummary && (
                        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-(--notion-fg)/70">
                            {cleanSummary}
                        </p>
                    )}

                    {/* YouTube인 경우 라디오 추가 + AI 요약 버튼 */}
                    {item.source === 'YouTube' && item.id && (
                        <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full bg-(--notion-gray)/70 px-2 py-1">
                            <AddToRadioButton videoId={item.id} title={item.title} />
                            <SummarizeButton videoId={item.id} />
                        </div>
                    )}
                </div>

                {/* 썸네일 노출 (최소화 - 유튜브만, 원할 경우만) */}
                {item.source === 'YouTube' && item.thumbnail && (
                    <div className="relative hidden h-14 w-24 shrink-0 overflow-hidden rounded border border-(--notion-border) bg-(--notion-gray) sm:block">
                        <Image
                            src={item.thumbnail}
                            alt={`${item.sourceName} 썸네일`}
                            fill
                            sizes="96px"
                            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                    </div>
                )}
            </div>
        </a>
    );
}
