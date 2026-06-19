import Link from "next/link";
import { cookies } from "next/headers";
import AppLayout from "@/components/layout/AppLayout";
import { getMergedFeed } from "@/lib/feed";
import { getSessionSourcesBundle } from "@/lib/merged-session-sources";
import { getTrendRadar } from "@/app/actions/trend";
import { getPlanForUser } from "@/lib/plan";
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
  // 강제 새로고침은 Gemini 재계산 비용이 크므로 운영자(owner)만 트리거할 수 있다.
  // 비운영자의 ?refresh=1은 무시하고 캐시를 사용한다.
  const cookieStore = await cookies();
  const plan = await getPlanForUser(cookieStore);
  const forceRefresh = sp?.refresh === "1" && plan === "owner";

  const { mergedSources, customSourceIds: customYouTubeSourceIds } = await getSessionSourcesBundle();
  const { items, sourceStatus } = await getMergedFeed(mergedSources);
  const youtubeSources = mergedSources.filter((s) => s.type === "YouTube");
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
