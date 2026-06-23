"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FeedItem } from "@/types/feed";
import type { FeedCategory } from "@/types/feed";
import { filterFeedByKeywords, filterFeedByCategory, filterFeedByTrendKeyword, filterFeedBySearch } from "@/lib/filter";
import FeedList from "./FeedList";
import FeedReelView from "./FeedReelView";
import FeedSearch from "./FeedSearch";
import KeywordFilter, { useKeywordFilter } from "./KeywordFilter";
import ViewSwitcher, { type ViewMode } from "./ViewSwitcher";
import MyFocusSection from "./MyFocusSection";
import WelcomeBanner from "./WelcomeBanner";
import UsageBadge from "./UsageBadge";
import FeedQADrawer from "./FeedQADrawer";
import { TrendFilterProvider, useTrendFilter } from "@/contexts/TrendFilterContext";
import { FEED_CATEGORIES } from "@/lib/sources";
import { getContentStatesAction, type ContentStateInfo } from "@/app/actions/content-state";
import { isItemVisibleUnderStateFilter } from "@/types/content-state";

export type BookmarkEntry = {
  id: string;
  video_id: string;
  video_title: string;
  highlight: string;
  created_at: string;
};

function filterByView(items: FeedItem[], view: ViewMode): FeedItem[] {
  if (view === "youtube") return items.filter((i) => i.source === "YouTube");
  if (view === "rss") return items.filter((i) => i.source === "RSS");
  return items;
}


type FeedClientContainerProps = {
    initialItems: FeedItem[];
    selectedSourceName?: string;
    /** 단일 소스 보기일 때 피드 Q&A 컨텍스트 제한용 */
    selectedSourceId?: string;
    initialCategory?: FeedCategory | null;
    initialView?: ViewMode;
    showViewSwitcher?: boolean;
    viewMode?: "longform" | "shortform" | "live" | null;
    children?: ReactNode;
};

export default function FeedClientContainer(props: FeedClientContainerProps) {
  return (
    <TrendFilterProvider>
      <FeedClientContainerContent {...props} />
    </TrendFilterProvider>
  );
}

function FeedClientContainerContent({
    initialItems,
    selectedSourceName,
    selectedSourceId,
    initialCategory = null,
    initialView = "all",
    showViewSwitcher = false,
    viewMode = null,
    children,
}: FeedClientContainerProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const viewParam = searchParams?.get("view");
    const view: ViewMode = viewParam === "youtube" || viewParam === "rss" ? viewParam : initialView;

    const { keywords, addKeyword, removeKeyword, clearKeywords } = useKeywordFilter();
    const [selectedCategory, setSelectedCategory] = useState<FeedCategory | null>(initialCategory);
    const [searchQuery, setSearchQuery] = useState("");
    const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
    const [contentStates, setContentStates] = useState<Record<string, ContentStateInfo>>({});
    const [stateFilter, setStateFilter] = useState<"all" | "queued" | "dismissed">("all");

    const fetchBookmarks = useCallback(async () => {
        try {
            const res = await fetch("/api/bookmarks");
            if (res.ok) {
                const data = await res.json();
                setBookmarks(Array.isArray(data) ? data : []);
            }
        } catch {
            // 북마크 로드 실패 시 조용히 무시 (비필수 기능)
        }
    }, []);

    const fetchContentStates = useCallback(async () => {
        try {
            const map = await getContentStatesAction();
            setContentStates(map);
        } catch {
            // 상태 로드 실패 시 조용히 무시 (비로그인·미설정 등)
        }
    }, []);

    useEffect(() => {
        setSelectedCategory(initialCategory);
    }, [initialCategory]);

    useEffect(() => {
        fetchBookmarks();
    }, [fetchBookmarks]);

    useEffect(() => {
        fetchContentStates();
    }, [fetchContentStates]);

    const handleCategoryChange = (category: FeedCategory | null) => {
        setSelectedCategory(category);
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        if (category) params.set("category", category);
        else params.delete("category");
        const q = params.toString();
        router.push(q ? `${pathname}?${q}` : pathname);
    };

    const trendFilter = useTrendFilter();
    const selectedTrendKeyword = trendFilter?.selectedTrendKeyword ?? null;

    const byView = filterByView(initialItems, view);
    const bySearch = filterFeedBySearch(byView, searchQuery);
    const byKeywords = filterFeedByKeywords(bySearch, keywords);
    const byCategory = filterFeedByCategory(byKeywords, selectedCategory);
    const filteredItems = filterFeedByTrendKeyword(byCategory, selectedTrendKeyword);
    const hasActiveFilters = keywords.length > 0 || stateFilter !== "all";

    // 선별 반영: 제외(dismissed)는 기본으로 숨기고, 상태 필터에 따라 좁힌다.
    const stateCounts = useMemo(() => {
        let queued = 0;
        let dismissed = 0;
        for (const id in contentStates) {
            const s = contentStates[id].state;
            if (s === "queued") queued += 1;
            else if (s === "dismissed") dismissed += 1;
        }
        return { queued, dismissed };
    }, [contentStates]);

    const visibleItems = useMemo(() => {
        return filteredItems.filter((item) =>
            isItemVisibleUnderStateFilter(item, contentStates, stateFilter)
        );
    }, [filteredItems, contentStates, stateFilter]);

    const availableCategories = FEED_CATEGORIES.filter(cat =>
        byKeywords.some(item => item.category === cat)
    );

    const isGlobalFeed = !selectedSourceName;
    const isReelMode = viewMode === "longform" || viewMode === "shortform" || viewMode === "live";

    if (isReelMode && viewMode) {
        return (
            <FeedReelView
                items={visibleItems}
                viewMode={viewMode}
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
            />
        );
    }

    return (
        <>
            {isGlobalFeed && <WelcomeBanner />}
            {isGlobalFeed && <MyFocusSection />}
            {isGlobalFeed && <UsageBadge />}

            {isGlobalFeed && (
                <div style={{ marginBottom: 12, padding: "0 4px" }}>
                    <FeedSearch value={searchQuery} onChange={setSearchQuery} />
                </div>
            )}

            <KeywordFilter
                keywords={keywords}
                onAddKeyword={addKeyword}
                onRemoveKeyword={removeKeyword}
                onClearKeywords={clearKeywords}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                availableCategories={availableCategories}
                compact={showViewSwitcher}
                headerRight={
                    showViewSwitcher ? <ViewSwitcher currentView={view} /> : undefined
                }
            />
            {isGlobalFeed &&
                (stateCounts.queued > 0 || stateCounts.dismissed > 0 || stateFilter !== "all") && (
                    <div className="mb-2 flex items-center gap-1.5 px-1">
                        {([
                            ["all", "전체"],
                            ["queued", `처리 대기${stateCounts.queued ? ` ${stateCounts.queued}` : ""}`],
                            ["dismissed", `제외함${stateCounts.dismissed ? ` ${stateCounts.dismissed}` : ""}`],
                        ] as const).map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setStateFilter(key)}
                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                    stateFilter === key
                                        ? "border-(--notion-fg) bg-(--notion-fg) text-(--notion-bg)"
                                        : "border-(--notion-border) text-(--notion-fg)/65 hover:bg-(--notion-hover)"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            {children}
            <FeedList
                items={visibleItems}
                hasActiveFilters={hasActiveFilters}
                selectedSourceName={selectedSourceName}
                viewMode={view}
                bookmarks={bookmarks}
                onBookmarkChange={fetchBookmarks}
                contentStates={contentStates}
                onContentStateChange={fetchContentStates}
                totalCount={selectedSourceName ? filteredItems.length : undefined}
            />
            <FeedQADrawer selectedSourceId={selectedSourceId} />
        </>
    );
}
