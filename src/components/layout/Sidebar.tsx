 "use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams, usePathname } from "next/navigation";
import { Rss, Youtube, Tag, Bookmark, ListMusic, Film, Clapperboard, Radio, Users, TrendingUp } from "lucide-react";
import { defaultSources, FEED_CATEGORIES } from "@/lib/sources";
import { LoginButton } from "@/components/auth/LoginButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import AddChannelButton from "@/components/feed/AddChannelButton";
import SourceExportImport from "@/components/feed/SourceExportImport";
import YouTubeSourceList from "@/components/layout/YouTubeSourceList";
import type { MergedFeedResult } from "@/lib/feed";
import type { FeedSource } from "@/lib/sources";

// rssSources moved inside Sidebar or taken from sources.ts directly

function SidebarViewModeLinks({ currentViewMode }: { currentViewMode: string | null }) {
    return (
        <div className="flex w-full gap-1">
            <Link
                href="/?viewMode=longform"
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${currentViewMode === "longform" ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
            >
                <Film size={14} className="shrink-0" />
                롱폼
            </Link>
            <Link
                href="/?viewMode=shortform"
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${currentViewMode === "shortform" ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
            >
                <Clapperboard size={14} className="shrink-0" />
                숏폼
            </Link>
        </div>
    );
}

export default function Sidebar({
    selectedSourceId,
    selectedCategory,
    youtubeSources: youtubeSourcesProp,
    customYouTubeSourceIds = [],
    latestVideoBySource,
}: {
    sourceStatus: MergedFeedResult["sourceStatus"];
    selectedSourceId?: string;
    selectedCategory?: string;
    youtubeSources?: FeedSource[];
    customYouTubeSourceIds?: string[];
    latestVideoBySource?: Record<string, string>;
}) {
    const youtubeSources = youtubeSourcesProp ?? defaultSources.filter((s) => s.type === "YouTube");
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const viewMode = searchParams?.get("viewMode") ?? null;
    return (
        <aside className="hidden w-72 shrink-0 bg-white dark:bg-(--notion-gray) md:flex md:flex-col">
            <div className="mt-0 mb-2 mx-2 rounded-xl bg-white dark:bg-(--notion-bg) pt-1 px-4 pb-3">
                <div className="mb-1.5 flex flex-col items-center gap-1.5">
                    <Link href="/" className="relative block h-28 w-[300px] shrink-0 overflow-hidden rounded-lg">
                        <Image
                            src="/rogo.png"
                            alt="Focus Feed"
                            fill
                            sizes="300px"
                            className="object-contain"
                        />
                    </Link>
                    <div className="flex w-full items-center justify-center gap-2">
                        <LoginButton />
                    </div>
                    <div className="flex w-full justify-center">
                        <Link
                            href="/trends"
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === "/trends" ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                        >
                            <span className="inline-flex items-center gap-1.5">
                                <TrendingUp size={14} className="shrink-0" />
                                트렌드
                            </span>
                        </Link>
                    </div>
                    <div className="flex w-full justify-center">
                        <Link
                            href="/"
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${!selectedSourceId && !selectedCategory && !viewMode && pathname === "/" ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                        >
                            전체 피드
                        </Link>
                    </div>
                    <SidebarViewModeLinks currentViewMode={viewMode} />
                    <div className="flex w-full justify-center">
                        <Link
                            href="/?viewMode=live"
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${viewMode === "live" ? "bg-(--notion-hover) text-(--notion-fg)" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                        >
                            <Radio size={14} className="shrink-0" />
                            라이브
                        </Link>
                    </div>
                </div>
            </div>

            <nav className="flex-1 space-y-3 bg-white dark:bg-transparent px-3 pt-0.5 pb-2">
                <SidebarSection
                    title="카테고리"
                    items={[{ id: "", name: "전체" }, ...FEED_CATEGORIES.map((id) => ({ id, name: id }))]}
                    icon={<Tag size={15} className="text-(--notion-fg)/60" />}
                    statusLabel=""
                    statusTone=""
                    helperText="AI·자기계발·개발·뉴스 등으로 필터합니다."
                    selectedSourceId={selectedCategory ?? ""}
                    linkParam="category"
                />

                <section>
                    <div className="mb-2 flex items-center gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                        <Youtube size={15} className="text-red-500" />
                        <span>YouTube ({youtubeSources.length})</span>
                    </div>
                    <YouTubeSourceList
                        items={youtubeSources}
                        selectedSourceId={selectedSourceId}
                        customSourceIds={customYouTubeSourceIds}
                        latestVideoBySource={latestVideoBySource}
                    />
                    <AddChannelButton />
                    <SourceExportImport />
                </section>

                <SidebarSection
                    title={`RSS (${defaultSources.filter((s) => s.type === "RSS").length})`}
                    items={defaultSources.filter((s) => s.type === "RSS")}
                    icon={<Rss size={15} className="text-blue-500" />}
                    statusLabel=""
                    statusTone=""
                    helperText=""
                    selectedSourceId={selectedSourceId}
                />

                <section className="pt-2">
                    <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                        내 콘텐츠
                    </div>
                    <div className="space-y-0.5">
                        <Link
                            href="/playlists"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--notion-fg)/80 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            <ListMusic size={15} className="text-(--notion-fg)/60" />
                            내 플레이리스트
                        </Link>
                        <Link
                            href="/bookmarks"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--notion-fg)/80 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            <Bookmark size={15} className="text-(--notion-fg)/60" />
                            북마크
                        </Link>
                        <Link
                            href="/teams"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--notion-fg)/80 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            <Users size={15} className="text-(--notion-fg)/60" />
                            팀
                        </Link>
                    </div>
                </section>

                <section className="pt-2">
                    <div className="space-y-0.5">
                        <Link
                            href="/pricing"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--notion-fg)/80 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            요금제
                        </Link>
                        <Link
                            href="/landing"
                            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--notion-fg)/80 hover:bg-(--notion-hover) hover:text-(--notion-fg)"
                        >
                            소개
                        </Link>
                    </div>
                </section>
            </nav>

            <div className="flex flex-col gap-2 border-t border-(--notion-border) bg-white dark:bg-transparent p-4 pb-28 md:pb-24">
                <ThemeToggle />
                <div className="text-xs leading-relaxed text-(--notion-fg)/55">
                    새 기능은 검증이 끝난 뒤 순차적으로 추가합니다. 현재는 읽기와 필터링 경험에 집중합니다.
                </div>
            </div>
        </aside>
    );
}

function SidebarSection({
    title,
    items,
    icon,
    statusLabel,
    statusTone,
    helperText,
    muted = false,
    selectedSourceId,
    linkParam = "source",
    showAddChannel = false,
}: {
    title: string;
    items: Array<{ id: string; name: string }>;
    icon: React.ReactNode;
    statusLabel: string;
    statusTone: string;
    helperText: string;
    muted?: boolean;
    selectedSourceId?: string;
    linkParam?: "source" | "category";
    showAddChannel?: boolean;
}) {
    const query = linkParam === "category"
        ? (id: string) => (id ? { category: id } : {})
        : (id: string) => ({ source: id });
    return (
        <section>
            <div className="mb-2 flex items-center justify-between gap-2 px-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--notion-fg)/45">
                    {icon}
                    <span>{title}</span>
                </div>
                {statusLabel ? (
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>
                        {statusLabel}
                    </span>
                ) : null}
            </div>

            {helperText ? (
                <div className="mb-2 px-2 text-xs leading-relaxed text-(--notion-fg)/45">
                    {helperText}
                </div>
            ) : null}

            <div className="space-y-1">
                {items.map((item) => {
                    const isActive = selectedSourceId === item.id;
                    return (
                        <Link
                            key={item.id}
                            href={{ pathname: "/", query: query(item.id) }}
                            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${isActive ? "bg-(--notion-hover) font-medium text-(--notion-fg)" : muted ? "text-(--notion-fg)/45 hover:bg-(--notion-hover)/60" : "text-(--notion-fg)/80 hover:bg-(--notion-hover)"}`}
                        >
                            <div className="flex w-4 justify-center">
                                <div className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-(--notion-fg)/60" : muted ? "bg-(--notion-fg)/20" : "bg-(--notion-fg)/30"}`} />
                            </div>
                            <span className="truncate">{item.name}</span>
                        </Link>
                    );
                })}
                {showAddChannel ? <AddChannelButton /> : null}
            </div>
        </section>
    );
}
