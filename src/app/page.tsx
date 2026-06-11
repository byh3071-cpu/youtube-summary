import { Suspense } from "react";
import AppLayout from "@/components/layout/AppLayout";
import FeedClientContainer from "@/components/feed/FeedClientContainer";
import FeedHeader from "@/components/feed/FeedHeader";
import TrendRadarBar from "@/components/trend/TrendRadarBar";
import { getMergedFeed } from "@/lib/feed";
import { FEED_CATEGORIES } from "@/lib/sources";
import { getSessionSourcesBundle } from "@/lib/merged-session-sources";
import { resolveYouTubeChannel } from "@/lib/youtube";
import type { FeedCategory, FeedItem } from "@/types/feed";
import type { FeedSource } from "@/lib/sources";

// 페이지는 항상 동적 렌더링 (cookies, searchParams 사용).
// YouTube/RSS API 응답은 개별 fetch()의 { next: { revalidate: 7200 } }로 캐싱.
export const dynamic = "force-dynamic";
// YouTube 채널 수가 많지 않으므로, 프로필 이미지는 여유 있게 최대 64개까지 조회
const MAX_YOUTUBE_AVATAR_RESOLVE = 64;

/** 숏폼: 60초 이하, 롱폼: 61초 초과 또는 길이 미상 */
const SHORTS_MAX_SECONDS = 60;

interface HomeProps {
  searchParams?: Promise<{
    source?: string;
    category?: string;
    view?: string;
    viewMode?: string;
    auth_error?: string;
    auth_success?: string;
    auth_error_hint?: string;
    error?: string;
    error_description?: string;
  }>;
}

function parseView(value: string | undefined): "all" | "youtube" | "rss" {
  if (value === "youtube" || value === "rss") return value;
  return "all";
}

function parseViewMode(value: string | undefined): "longform" | "shortform" | "live" | null {
  if (value === "longform" || value === "shortform" || value === "live") return value;
  return null;
}

function filterByViewMode(items: FeedItem[], viewMode: "longform" | "shortform" | "live" | null) {
  if (!viewMode) return items;
  const youtubeOnly = items.filter((i) => i.source === "YouTube");
  if (viewMode === "shortform") {
    return youtubeOnly.filter((i) => typeof i.durationSeconds === "number" && i.durationSeconds <= SHORTS_MAX_SECONDS);
  }
  if (viewMode === "live") {
    return youtubeOnly.filter((i) => i.isLive === true);
  }
  return youtubeOnly.filter((i) => typeof i.durationSeconds !== "number" || i.durationSeconds > SHORTS_MAX_SECONDS);
}

function parseCategory(value: string | undefined): FeedCategory | null {
  if (!value) return null;
  return FEED_CATEGORIES.includes(value as FeedCategory) ? (value as FeedCategory) : null;
}

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = await searchParams;
  const selectedSourceId = resolvedSearchParams?.source;
  const initialView = parseView(resolvedSearchParams?.view);
  const viewMode = parseViewMode(resolvedSearchParams?.viewMode);
  const { mergedSources, customSourceIds: customYouTubeSourceIds } = await getSessionSourcesBundle();

  // YouTube 채널 프로필 이미지(avatarUrl) 하이드레이션
  const hydratedSources: FeedSource[] = await Promise.all(
    mergedSources.map(async (source, index) => {
      if (source.type !== "YouTube" || source.avatarUrl) return source;
      // 너무 많은 채널에 대해 한 번에 아바타 요청하지 않도록 상한선을 둠
      if (index >= MAX_YOUTUBE_AVATAR_RESOLVE) return source;
      // 채널 ID 형식(UC...)만 프로필 조회
      if (!source.id.startsWith("UC")) return source;
      const resolved = await resolveYouTubeChannel({ type: "channelId", channelId: source.id });
      if (resolved?.avatarUrl) {
        return { ...source, avatarUrl: resolved.avatarUrl };
      }
      return source;
    }),
  );

  const selectedSource = selectedSourceId ? hydratedSources.find((s) => s.id === selectedSourceId) : undefined;
  const initialCategory = parseCategory(resolvedSearchParams?.category);
  const showViewSwitcher = !selectedSource;

  const { items, sourceStatus } = await getMergedFeed(hydratedSources);
  let visibleItems = selectedSource
    ? items.filter((item) => item.sourceId === selectedSource.id)
    : items;
  if (viewMode) visibleItems = filterByViewMode(visibleItems, viewMode);
  const youtubeSources = hydratedSources.filter((s) => s.type === "YouTube");

  // 채널별 최신 영상 시간 (최근 표시용)
  const latestMap = new Map<string, string>();
  items.forEach((item) => {
    if (item.source !== "YouTube") return;
    const t = new Date(item.pubDate).getTime();
    if (Number.isFinite(t)) {
      const prev = latestMap.get(item.sourceId);
      if (!prev || new Date(prev).getTime() < t) {
        latestMap.set(item.sourceId, item.pubDate);
      }
    }
  });
  const latestVideoBySource = Object.fromEntries(latestMap);

  const isReelMode = viewMode === "longform" || viewMode === "shortform" || viewMode === "live";

  return (
    <AppLayout
      sourceStatus={sourceStatus}
      selectedSourceId={selectedSource?.id}
      selectedCategory={resolvedSearchParams?.category ?? undefined}
      youtubeSources={youtubeSources}
      customYouTubeSourceIds={customYouTubeSourceIds}
      latestVideoBySource={latestVideoBySource}
      authError={
        resolvedSearchParams?.auth_error ??
        (resolvedSearchParams?.error_description ? "no_code" : undefined)
      }
      authErrorHint={resolvedSearchParams?.auth_error_hint ?? resolvedSearchParams?.error_description}
      authSuccess={resolvedSearchParams?.auth_success === "1"}
      reelMode={isReelMode}
    >
      {!viewMode && (
        <FeedHeader
          selectedSource={selectedSource}
          visibleItemsCount={visibleItems.length}
          sourceStatus={sourceStatus}
        />
      )}

      <Suspense fallback={<div className="py-8 text-center text-sm text-(--notion-fg)/60">피드 불러오는 중…</div>}>
        <FeedClientContainer
          initialItems={visibleItems}
          selectedSourceName={selectedSource?.name}
          selectedSourceId={selectedSource?.id}
          initialCategory={initialCategory}
          initialView={initialView}
          showViewSwitcher={showViewSwitcher}
          viewMode={viewMode}
        >
          {!viewMode && (
            <Suspense fallback={null}>
              <TrendRadarBar attachToHeader={!!selectedSource} />
            </Suspense>
          )}
        </FeedClientContainer>
      </Suspense>
    </AppLayout>
  );
}
