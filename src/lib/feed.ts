/** 유튜브 채널 + RSS 소스를 병합·최신순 정렬·중복 제거 후 반환. 각 아이템에 소스 기준 category 부여 */
import { FeedItem } from "../types/feed";
import { defaultSources, FeedSource } from "./sources";
import { fetchYouTubeFeed, getYouTubeConfigurationStatus, YouTubeFetchStatus } from "./youtube";
import { fetchRssFeed } from "./rss";
import type { FeedCategory } from "../types/feed";

export interface MergedFeedResult {
    items: FeedItem[];
    sourceStatus: {
        youtube: YouTubeFetchStatus;
        rss: "ready";
    };
}

function getSortTimestamp(pubDate: string): number {
    const timestamp = new Date(pubDate).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

/** 병합 후 최대 노출 개수(메모리·응답 크기). `MAX_MERGED_FEED_ITEMS`로 50~2000 조정 가능. */
function getMergedFeedItemCap(): number {
    const raw = process.env.MAX_MERGED_FEED_ITEMS;
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return 500;
    return Math.min(2000, Math.max(50, n));
}

function dedupeItems(items: FeedItem[]): FeedItem[] {
    const seen = new Set<string>();

    return items.filter((item) => {
        const key = `${item.source}:${item.id || item.link}`;

        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

export async function getMergedFeed(sources: FeedSource[] = defaultSources): Promise<MergedFeedResult> {
    const youtubeSources = sources.filter((source) => source.type === "YouTube");
    const rssSources = sources.filter((source) => source.type === "RSS");

    const youtubePromises = youtubeSources.map((source) => fetchYouTubeFeed(source.id, source.name));
    const rssPromises = rssSources.map((source) => fetchRssFeed(source.id, source.name));

    try {
        const [youtubeResults, rssResults] = await Promise.all([
            Promise.allSettled(youtubePromises),
            Promise.allSettled(rssPromises),
        ]);

        const youtubeItems: FeedItem[] = youtubeResults.flatMap((result) => {
            if (result.status === "fulfilled") {
                return result.value.items;
            }

            console.error("Failed to fetch one of the YouTube sources:", result.reason);
            return [];
        });

        const rssItems: FeedItem[] = rssResults.flatMap((result) => {
            if (result.status === "fulfilled") {
                return result.value;
            }

            console.error("Failed to fetch one of the RSS sources:", result.reason);
            return [];
        });

        const uniqueItems = dedupeItems([...youtubeItems, ...rssItems]);

        // 소스별 카테고리 맵으로 각 아이템에 category 부여
        const sourceIdToCategory = new Map<string, FeedCategory>(
            sources.map((s) => [s.id, s.category])
        );
        uniqueItems.forEach((item) => {
            const cat = sourceIdToCategory.get(item.sourceId);
            if (cat) (item as FeedItem).category = cat;
        });

        const youtubeStatus = youtubeResults.reduce<YouTubeFetchStatus>(
            (currentStatus, result) => {
                if (currentStatus === "invalid_api_key") {
                    return currentStatus;
                }

                if (result.status === "rejected") {
                    return currentStatus === "missing_api_key" ? currentStatus : "request_failed";
                }

                const nextStatus = result.value.status;

                if (nextStatus === "invalid_api_key") {
                    return nextStatus;
                }

                if (nextStatus === "missing_api_key") {
                    return currentStatus === "request_failed" ? currentStatus : nextStatus;
                }

                if (nextStatus === "request_failed") {
                    return currentStatus === "missing_api_key" ? currentStatus : nextStatus;
                }

                return currentStatus;
            },
            getYouTubeConfigurationStatus()
        );

        // 시간순 (최신순) 정렬
        uniqueItems.sort((a, b) => {
            return getSortTimestamp(b.pubDate) - getSortTimestamp(a.pubDate);
        });

        const cap = getMergedFeedItemCap();
        const capped = uniqueItems.length > cap ? uniqueItems.slice(0, cap) : uniqueItems;

        return {
            items: capped,
            sourceStatus: {
                youtube: youtubeStatus,
                rss: "ready",
            },
        };
    } catch (error) {
        console.error("Error merging feeds:", error);
        return {
            items: [],
            sourceStatus: {
                youtube: getYouTubeConfigurationStatus(),
                rss: "ready",
            },
        };
    }
}
