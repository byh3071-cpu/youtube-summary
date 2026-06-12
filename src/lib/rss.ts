import Parser from 'rss-parser';
import { FeedItem } from '../types/feed';
import { htmlToPlainText } from './html-entities';

type CustomFeed = { title: string };
type CustomItem = {
    title?: string;
    link?: string;
    pubDate?: string;
    contentSnippet?: string;
    content?: string;
};

const parser = new Parser<CustomFeed, CustomItem>();
const REVALIDATE_SECONDS = 7200;
/** 피드당 가져올 최대 항목 수 (유튜브 채널 50개와 비슷하게) */
const RSS_ITEMS_LIMIT = 50;

function getStableRssId(item: CustomItem, sourceName: string): string {
    return item.link || `${sourceName}:${item.title || 'untitled'}`;
}

function toIsoDate(pubDate?: string): string {
    const timestamp = pubDate ? new Date(pubDate).getTime() : Number.NaN;
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : new Date(0).toISOString();
}

export async function fetchRssFeed(url: string, sourceName: string): Promise<FeedItem[]> {
    try {
        // Next.js 캐싱을 위한 fetch API 우회 사용
        // rss-parser는 기본적으로 내부에서 http 모듈을 사용하므로 Next.js의 fetch 캐싱이 
        // 기본적으로 적용되지 않을 수 있습니다. 
        // 이를 해결하기 위해 fetch로 먼저 가져온 뒤 파싱합니다.
        const response = await fetch(url, {
            next: { revalidate: REVALIDATE_SECONDS }, // 2시간 캐시
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
            }
        });

        if (!response.ok) {
            console.error(`Error fetching RSS feed from ${url}: ${response.statusText}`);
            return [];
        }

        const xml = await response.text();
        const feed = await parser.parseString(xml);

        const items = feed.items.slice(0, RSS_ITEMS_LIMIT);

        return items.map((item) => {
            return {
                id: getStableRssId(item, sourceName),
                // 제목은 플레인 텍스트가 원칙 — 엔티티만 디코딩하고 태그 제거는 하지 않아
                // `Vec<T>`·`x < 10` 같은 리터럴 꺾쇠를 보존한다. (`&quot;`/`&#039;`/`&amp;` 디코딩)
                title: htmlToPlainText(item.title || "", { stripTags: false }) || "No title",
                link: item.link || url,
                pubDate: toIsoDate(item.pubDate),
                source: "RSS",
                sourceId: url,
                sourceName: sourceName,
                summary: htmlToPlainText(item.contentSnippet || item.content || ""),
            } as FeedItem;
        });
    } catch (error) {
        console.error(`Failed to parse RSS feed from ${url}:`, error);
        return [];
    }
}
