import { useState } from "react";
import { FeedItem as FeedItemType } from "@/types/feed";
import FeedItemComponent from "./FeedItem";
import YouTubeCard from "./YouTubeCard";
import { AutoAnimateList } from "@/components/ui/AutoAnimateList";
import { Coffee, Rss, Youtube } from "lucide-react";
import type { BookmarkEntry } from "./FeedClientContainer";
import type { ContentStateInfo } from "@/app/actions/content-state";
import { contentIdForItem } from "@/types/content-state";
import Image from "next/image";

const YOUTUBE_PAGE_SIZE = 60;
const RSS_PAGE_SIZE = 30;
const FLAT_LIST_PAGE_SIZE = 48;

type ViewMode = "all" | "youtube" | "rss";

interface Props {
    items: FeedItemType[];
    hasActiveFilters?: boolean;
    selectedSourceName?: string;
    useTickerLayout?: boolean;
    viewMode?: ViewMode;
    bookmarks?: BookmarkEntry[];
    onBookmarkChange?: () => void;
    contentStates?: Record<string, ContentStateInfo>;
    onContentStateChange?: () => void;
    /** 소스 선택 시 해당 소스 총 개수 (유튜브/RSS 섹션 헤더에 표시) */
    totalCount?: number;
}

function EmptyBlock({ message }: { message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-(--notion-border) bg-(--notion-gray)/30 py-6 text-center text-sm text-(--notion-fg)/45">
            {message}
        </div>
    );
}

function FeedListFlat({ items }: { items: FeedItemType[] }) {
    const [flatLimit, setFlatLimit] = useState(FLAT_LIST_PAGE_SIZE);
    const flatVisible = items.slice(0, flatLimit);
    const flatRemaining = items.length - flatVisible.length;
    return (
        <section className="overflow-hidden rounded-2xl border border-(--notion-border) bg-(--notion-bg)">
            <div className="border-b border-(--notion-border) bg-(--notion-gray) px-4 py-3 text-sm text-(--notion-fg)/60 sm:px-5">
                최신순으로 정렬된 피드입니다. 항목을 클릭하면 원문으로 이동합니다.
            </div>
            <div className="flex flex-col">
                {flatVisible.map((item) => (
                    <div
                        key={`${item.source}:${item.sourceId}:${item.id}`}
                        className="[content-visibility:auto] [contain-intrinsic-size:auto_80px]"
                    >
                        <FeedItemComponent item={item} />
                    </div>
                ))}
            </div>
            {flatRemaining > 0 && (
                <div className="flex justify-center border-t border-(--notion-border) py-3">
                    <button
                        type="button"
                        onClick={() => setFlatLimit((p) => p + FLAT_LIST_PAGE_SIZE)}
                        className="min-h-[44px] rounded-full border border-(--notion-border) px-4 py-2 text-xs font-semibold text-(--notion-fg)/60 touch-manipulation hover:bg-(--notion-hover) sm:min-h-0"
                    >
                        더 보기 ({flatRemaining}개 남음)
                    </button>
                </div>
            )}
        </section>
    );
}

export default function FeedList({ items, hasActiveFilters = false, selectedSourceName, useTickerLayout = true, viewMode = "all", bookmarks = [], onBookmarkChange, contentStates = {}, onContentStateChange, totalCount }: Props) {
    const [ytLimit, setYtLimit] = useState(YOUTUBE_PAGE_SIZE);
    const [rssLimit, setRssLimit] = useState(RSS_PAGE_SIZE);

    const youtubeItems = (items ?? []).filter((i) => i.source === "YouTube");
    const rssItems = (items ?? []).filter((i) => i.source === "RSS");
    const visibleYoutubeItems = youtubeItems.slice(0, ytLimit);
    const visibleRssItems = rssItems.slice(0, rssLimit);
    const hasAny = items && items.length > 0;

    if (!hasAny) {
        if (hasActiveFilters) {
            return (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) py-12 text-center text-(--notion-fg)/50">
                    <div className="relative mb-4 h-28 w-28 sm:h-32 sm:w-32">
                        <Image
                            src="/images/empty/Empty-filter.png"
                            alt="현재 필터에 해당하는 피드가 없음을 나타내는 일러스트"
                            fill
                            sizes="128px"
                            className="object-contain"
                            priority
                        />
                    </div>
                    <p className="mb-1 font-medium">
                        현재 필터에 맞는 피드가 없습니다.
                    </p>
                    <p className="text-sm text-(--notion-fg)/45">
                        필터를 줄이거나 다른 키워드를 추가해 보세요.
                    </p>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-(--notion-border) py-12 text-center text-(--notion-fg)/50">
                <Coffee className="mb-4 opacity-50" size={32} />
                <p className="mb-1 font-medium">
                    {selectedSourceName ? `${selectedSourceName}에서 표시할 피드가 없습니다.` : "표시할 피드가 아직 없습니다."}
                </p>
                <p className="text-sm text-(--notion-fg)/45">
                    {selectedSourceName ? "선택한 소스에 새 항목이 올라오면 여기에서 바로 확인할 수 있습니다." : "잠시 후 새로고침해서 최신 소스를 다시 불러와 보세요."}
                </p>
            </div>
        );
    }

    if (!useTickerLayout) {
        return <FeedListFlat key={items.length} items={items} />;
    }

    // '전체' 보기 모드일 때 해당 소스가 아예 없으면 섹션 자체를 숨김 (사용자 요청: RSS 선택 시 유튜브 칸 삭제)
    const showYoutube = (viewMode === "all" ? youtubeItems.length > 0 : viewMode === "youtube");
    const showRss = (viewMode === "all" ? rssItems.length > 0 : viewMode === "rss");

    return (
        <section className="space-y-6">
            {showYoutube && (
                <div className="overflow-hidden rounded-2xl border border-(--notion-border) bg-(--notion-bg)">
                    <div className="flex items-center justify-between gap-2 border-b border-(--notion-border) bg-(--notion-gray) px-4 py-3 text-[13px] text-(--notion-fg)/70 sm:px-5">
                        <div className="flex items-center gap-2">
                            <Youtube className="h-4 w-4 text-red-500" />
                            <span className="font-semibold">유튜브</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-(--notion-fg)/55">
                            {typeof totalCount === "number" && <span>총 {totalCount}개</span>}
                            <span>최신순 정렬</span>
                        </div>
                    </div>
                    <div className="px-3 py-3 sm:px-4 sm:py-4">
                        {youtubeItems.length === 0 ? (
                            <EmptyBlock message="이번 필터에 해당하는 유튜브 영상이 없습니다." />
                        ) : (
                            <>
                                <AutoAnimateList as="ul" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
                                    {visibleYoutubeItems.map((item) => {
                                        const b = item.id ? bookmarks.find((x) => x.video_id === item.id) : null;
                                        return (
                                            <li key={`${item.source}:${item.sourceId}:${item.id}`}>
                                                <YouTubeCard
                                                    item={item}
                                                    bookmark={b}
                                                    onBookmarkChange={onBookmarkChange}
                                                    contentState={item.id ? contentStates[item.id] : undefined}
                                                    onContentStateChange={onContentStateChange}
                                                />
                                            </li>
                                        );
                                    })}
                                </AutoAnimateList>
                                {youtubeItems.length > ytLimit && (
                                    <div className="mt-3 flex justify-center">
                                        <button
                                            type="button"
                                            onClick={() => setYtLimit(prev => prev + YOUTUBE_PAGE_SIZE)}
                                            className="min-h-[44px] rounded-full border border-(--notion-border) px-4 py-2 text-xs font-semibold text-(--notion-fg)/60 touch-manipulation hover:bg-(--notion-hover) sm:min-h-0"
                                        >
                                            더 보기 ({youtubeItems.length - ytLimit}개 남음)
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {showRss && (
                <div className="overflow-hidden rounded-2xl border border-(--notion-border) bg-(--notion-bg)">
                    <div className="flex items-center justify-between gap-2 border-b border-(--notion-border) bg-(--notion-gray) px-4 py-3 text-[13px] text-(--notion-fg)/70 sm:px-5">
                        <div className="flex items-center gap-2">
                            <Rss className="h-4 w-4 text-blue-500" />
                            <span className="font-semibold">RSS·뉴스</span>
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-(--notion-fg)/55">
                            {typeof totalCount === "number" && <span>총 {totalCount}개</span>}
                            <span>최신순 정렬</span>
                        </div>
                    </div>
                    <AutoAnimateList as="div" className="flex flex-col">
                        {rssItems.length === 0 ? (
                            <EmptyBlock message="이번 필터에 해당하는 RSS·뉴스가 없습니다." />
                        ) : (
                            <>
                                {visibleRssItems.map((item) => {
                                    const rssBookmarkId = "rss:" + item.link;
                                    const b = bookmarks.find((x) => x.video_id === rssBookmarkId) ?? null;
                                    const rssContentId = contentIdForItem(item);
                                    return (
                                        <FeedItemComponent
                                            key={`${item.source}:${item.sourceId}:${item.id}`}
                                            item={item}
                                            bookmark={b}
                                            onBookmarkChange={onBookmarkChange}
                                            contentState={rssContentId ? contentStates[rssContentId] : undefined}
                                            onContentStateChange={onContentStateChange}
                                        />
                                    );
                                })}
                                {rssItems.length > rssLimit && (
                                    <div className="flex justify-center py-3">
                                        <button
                                            type="button"
                                            onClick={() => setRssLimit(prev => prev + RSS_PAGE_SIZE)}
                                            className="min-h-[44px] rounded-full border border-(--notion-border) px-4 py-2 text-xs font-semibold text-(--notion-fg)/60 touch-manipulation hover:bg-(--notion-hover) sm:min-h-0"
                                        >
                                            더 보기 ({rssItems.length - rssLimit}개 남음)
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </AutoAnimateList>
                </div>
            )}
        </section>
    );
}
