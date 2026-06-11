"use server";

import { getMergedFeed } from "@/lib/feed";
import { generateGeminiText } from "@/lib/gemini";
import { extractJsonObject } from "@/lib/llm-json";
import type { FeedItem } from "@/types/feed";
import { getTrendRadarPrompt } from "@/lib/prompts";
import { getTypedTable } from "@/lib/supabase-server";
import { guardTrendGeminiRateLimit } from "@/lib/gemini-rate-limit";

export type TrendRadarItem = {
  keyword: string;
  score: number;
  summary: string;
  sampleTitles: string[];
};

export type TrendRadarResult = {
  generatedAt: string;
  trends: TrendRadarItem[];
};

const TREND_BUCKET_LATEST_24H = "latest_24h_all";
const TREND_TTL_MS = 60 * 60 * 1000; // 1 hour

async function callGeminiForTrends(items: FeedItem[]): Promise<TrendRadarItem[] | null> {
  const payload = items.map((item) =>
    JSON.stringify({
      id: item.id || item.link,
      title: item.title,
      sourceName: item.sourceName,
      category: item.category ?? null,
      summary: item.summary ?? null,
      link: item.link,
    }),
  );

  const prompt = getTrendRadarPrompt(payload);
  const raw = await generateGeminiText(prompt, "TrendRadar");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as { trends?: TrendRadarItem[] };
    if (!parsed || !Array.isArray(parsed.trends)) return null;
    return parsed.trends
      .filter(
        (t) =>
          t &&
          typeof t.keyword === "string" &&
          typeof t.summary === "string" &&
          Array.isArray(t.sampleTitles),
      )
      .slice(0, 10);
  } catch (e) {
    console.error("[TrendRadar] Failed to parse Gemini response", e, raw);
    return null;
  }
}

export async function getTrendRadar(forceRefresh = false): Promise<TrendRadarResult | null> {
  const table = getTypedTable("trend_cache");

  // 1) 캐시 조회
  if (table && !forceRefresh) {
    try {
      const { data } = (await table
        .select("trends, generated_at")
        .eq("bucket", TREND_BUCKET_LATEST_24H)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle()) as {
        data: { trends: unknown; generated_at: string } | null;
        error: unknown;
      };

      if (data?.trends && data.generated_at) {
        const age = Date.now() - new Date(data.generated_at).getTime();
        if (age < TREND_TTL_MS) {
          return {
            generatedAt: data.generated_at,
            trends: data.trends as TrendRadarItem[],
          };
        }
      }
    } catch (e) {
      console.error("[TrendRadar] Failed to read cache", e);
    }
  }

  // 2) 최신 피드 수집 (24시간 이내)
  // 트렌드 캐시는 전역 버킷으로 모든 사용자가 공유하므로, 특정 사용자의
  // 커스텀 소스가 섞이지 않도록 의도적으로 기본 소스만 사용한다.
  const { items } = await getMergedFeed();
  if (!items || items.length === 0) return null;

  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const recent = items.filter((item) => {
    const ts = new Date(item.pubDate).getTime();
    return Number.isFinite(ts) && ts >= cutoff;
  });

  if (recent.length === 0) return null;

  // 너무 많으면 상위 N개만 전달 (예: 80개)
  const limited = recent.slice(0, 80);

  const trendRl = await guardTrendGeminiRateLimit();
  if (!trendRl.ok) {
    return null;
  }

  const trends = await callGeminiForTrends(limited);
  if (!trends || trends.length === 0) return null;

  const generatedAt = new Date().toISOString();

  // 3) 캐시 저장 (best-effort)
  if (table) {
    try {
      const row = {
        bucket: TREND_BUCKET_LATEST_24H,
        trends,
        generated_at: generatedAt,
      };
      // upsert 지원 여부에 관계없이 insert 사용 — bucket 기준 최신 한 건만 사용
      await table.insert(row as never);
    } catch (e) {
      console.error("[TrendRadar] Failed to write cache", e);
    }
  }

  return { generatedAt, trends };
}

