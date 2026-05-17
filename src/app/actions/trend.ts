"use server";

import { GoogleGenAI } from "@google/genai";
import { getMergedFeed } from "@/lib/feed";
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

/** 트렌드 레이더에서도 비용을 최소화하기 위해 동일한 Flash 계열 모델 사용 */
const GEMINI_TREND_MODEL_ID = "models/gemini-1.5-flash";

async function callGeminiForTrends(items: FeedItem[]): Promise<TrendRadarItem[] | null> {
  if (!process.env.GEMINI_API_KEY) return null;

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

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  async function generateWithModel(model: string) {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return res.text || "";
  }

  let raw = "";
  try {
    // 1. 비용이 저렴한 Flash 계열 기본 모델 사용
    raw = await generateWithModel(GEMINI_TREND_MODEL_ID);
  } catch (e: unknown) {
    const err = e as { error?: { code?: number | string }; code?: number | string; status?: number | string };
    const code = err.error?.code ?? err.code ?? err.status;
    // 404 등으로 모델을 못 쓰는 경우, 보다 보편적인 모델로 폴백 시도
    if (code === 404 || code === "NOT_FOUND") {
      try {
        raw = await generateWithModel("models/gemini-flash-latest");
      } catch (e2: unknown) {
        const err2 = e2 as { error?: { code?: number | string }; code?: number | string; status?: number | string };
        const code2 = err2.error?.code ?? err2.code ?? err2.status;
        // 두 번째 모델도 NOT_FOUND면, 현재 프로젝트에서 Gemini가 비활성화된 것으로 보고 조용히 기능을 끔
        if (code2 !== 404 && code2 !== "NOT_FOUND") {
          console.error("[TrendRadar] Gemini fallback failed", e2);
        }
        return null;
      }
    } else {
      console.error("[TrendRadar] Gemini generateContent failed", e);
      return null;
    }
  }

  const trimmed = raw.trim();
  const jsonLike = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "");

  try {
    const parsed = JSON.parse(jsonLike) as { trends?: TrendRadarItem[] };
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

