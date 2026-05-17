import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import { getMergedFeed } from "@/lib/feed";
import { getSessionMergedSources, getSessionCustomSourceIds } from "@/lib/merged-session-sources";
import { getTrendRadar } from "@/app/actions/trend";
import type { FeedItem } from "@/types/feed";
import TrendDashboard from "./TrendDashboard";

export const dynamic = "force-dynamic";

interface TrendsPageProps {
  searchParams?: Promise<{ refresh?: string }>;
}

function buildLatestVideoMap(items: FeedItem[]) {
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
  return Object.fromEntries(latestMap);
}

export default async function TrendsPage({ searchParams }: TrendsPageProps) {
  const sp = await searchParams;
  const forceRefresh = sp?.refresh === "1";

  const mergedSources = await getSessionMergedSources();
  const { items, sourceStatus } = await getMergedFeed(mergedSources);
  const youtubeSources = mergedSources.filter((s) => s.type === "YouTube");
  const customYouTubeSourceIds = await getSessionCustomSourceIds();
  const latestVideoBySource = buildLatestVideoMap(items);

  const radar = await getTrendRadar(forceRefresh);

  return (
    <AppLayout
      sourceStatus={sourceStatus}
      youtubeSources={youtubeSources}
      customYouTubeSourceIds={customYouTubeSourceIds}
      latestVideoBySource={latestVideoBySource}
    >
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
        >
          ← 피드
        </Link>
      </div>
      <TrendDashboard initial={radar} />
    </AppLayout>
  );
}
