"use server";

import { cookies } from "next/headers";
import { getVideoContext } from "@/lib/video-context";
import { getSupabaseForSummaries, type Database } from "@/lib/supabase-server";
import { getMergedFeed } from "@/lib/feed";
import { getSessionMergedSources } from "@/lib/merged-session-sources";
import { generateGeminiText, generateGeminiTextResult, geminiFailureMessage, type GeminiTextResult } from "@/lib/gemini";
import { extractJsonObject } from "@/lib/llm-json";
import type { FeedItem } from "@/types/feed";
import {
  SUMMARY_PROMPT_CAPTION,
  SUMMARY_PROMPT_SNIPPET,
  SUMMARY_RETRY_HINT,
  getSummaryQualityEvalPrompt,
  INSIGHT_PROMPT,
  INSIGHT_RETRY_HINT,
  getInsightQualityEvalPrompt,
  getSystemGoalPrompt,
  getRankingPrompt,
} from "@/lib/prompts";
import { checkUsageLimit, incrementUsage } from "@/lib/plan";
import { guardGeminiActionRateLimit } from "@/lib/gemini-rate-limit";

/** 품질 기준 점수 이상이면 통과 (요약·인사이트 공통, 강화된 기준) */
const QUALITY_THRESHOLD = 78;
/** 미달 시 재생성 최대 횟수 (1회 생성 + 최대 2회 재생성 = 총 3회 시도) */
const MAX_REGENERATION_ATTEMPTS = 3;

function summarizeWithGemini(prompt: string): Promise<GeminiTextResult> {
  return generateGeminiTextResult(prompt, "Summarize");
}

type QualityEvalResult = { score: number; passed: boolean; reason?: string };

async function evaluateQuality(prompt: string): Promise<QualityEvalResult | null> {
  const raw = await generateGeminiText(prompt, "QualityEval");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as { score?: number; passed?: boolean; reason?: string };
    const score = typeof parsed.score === "number" ? parsed.score : 0;
    const passed = parsed.passed === true || score >= QUALITY_THRESHOLD;
    return { score, passed, reason: parsed.reason };
  } catch {
    return null;
  }
}

function evaluateSummaryQuality(
  contextSnippet: string,
  summary: string,
): Promise<QualityEvalResult | null> {
  return evaluateQuality(getSummaryQualityEvalPrompt(contextSnippet, summary));
}

function evaluateInsightQuality(
  contextSnippet: string,
  insight: string,
): Promise<QualityEvalResult | null> {
  return evaluateQuality(getInsightQualityEvalPrompt(contextSnippet, insight));
}

type RankedItemPayload = {
  id: string;
  priority: number;
  score: number;
  why: string;
  action: string;
};

type RankingResult = {
  items: RankedItemPayload[];
};


export async function summarizeVideoAction(videoId: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: geminiFailureMessage("missing_key") };
  }

  const burst = await guardGeminiActionRateLimit("summary");
  if (!burst.ok) {
    return { error: burst.error };
  }

  const cookieStore = await cookies();
  const limitResult = await checkUsageLimit(cookieStore, "summary");
  if (!limitResult.allowed) {
    return { error: limitResult.error };
  }

  // 0. Supabase 캐시 조회
  const summariesTable = getSupabaseForSummaries();
  if (summariesTable) {
    const { data, error } = (await summariesTable
      .select("summary")
      .eq("video_id", videoId)
      .maybeSingle()) as { data: { summary: string } | null; error: unknown };

    if (!error && data?.summary) {
      return { summary: data.summary };
    }
  }

  try {
    const ctx = await getVideoContext(videoId);
    if ("error" in ctx) {
      return { error: ctx.error };
    }

    const { text, source } = ctx;

    const basePrompt =
      source === "자막"
        ? SUMMARY_PROMPT_CAPTION(text)
        : SUMMARY_PROMPT_SNIPPET(text);
    const contextSnippet = text.slice(0, 5000);

    let lastSummary: string | null = null;
    let attempt = 0;
    let retryReason: string | undefined;

    while (attempt < MAX_REGENERATION_ATTEMPTS) {
      attempt += 1;
      const prompt = retryReason
        ? basePrompt + SUMMARY_RETRY_HINT(retryReason)
        : basePrompt;
      const summaryRes = await summarizeWithGemini(prompt);
      if (!summaryRes.ok) {
        if (lastSummary) break;
        return { error: geminiFailureMessage(summaryRes.kind) };
      }
      lastSummary = summaryRes.text;

      const evalResult = await evaluateSummaryQuality(contextSnippet, summaryRes.text);
      if (!evalResult) {
        break;
      }
      if (evalResult.passed) {
        break;
      }
      retryReason = evalResult.reason;
    }

    if (lastSummary) {
      const final = source === "제목·설명" ? `(제목·설명 기반)\n\n${lastSummary}` : lastSummary;

      if (summariesTable) {
        const row: Database["public"]["Tables"]["summaries"]["Insert"] = {
          video_id: videoId,
          summary: final,
          source,
        };
        await (summariesTable as unknown as { upsert: (v: typeof row, o: { onConflict: string }) => Promise<unknown> }).upsert(row, { onConflict: "video_id" });
      }
      await incrementUsage(cookieStore, "summary");
      return { summary: final };
    }
    return { error: "요약 생성에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  } catch (error: unknown) {
    console.error("Summarize Error:", error);
    return { error: "요약 생성을 실패했습니다. 잠시 후 시도해주세요." };
  }
}

export async function summarizeInsightAction(videoId: string) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: geminiFailureMessage("missing_key") };
  }

  const burst = await guardGeminiActionRateLimit("insight");
  if (!burst.ok) {
    return { error: burst.error };
  }

  const cookieStore = await cookies();
  const limitResult = await checkUsageLimit(cookieStore, "insight");
  if (!limitResult.allowed) {
    return { error: limitResult.error };
  }

  try {
    const ctx = await getVideoContext(videoId);
    if ("error" in ctx) {
      return { error: ctx.error };
    }

    const { text } = ctx;
    const basePrompt = INSIGHT_PROMPT(text);
    const contextSnippet = text.slice(0, 5000);

    let lastInsight: string | null = null;
    let attempt = 0;
    let retryReason: string | undefined;

    while (attempt < MAX_REGENERATION_ATTEMPTS) {
      attempt += 1;
      const prompt = retryReason
        ? basePrompt + INSIGHT_RETRY_HINT(retryReason)
        : basePrompt;
      const insightRes = await summarizeWithGemini(prompt);
      if (!insightRes.ok) {
        if (lastInsight) break;
        return { error: geminiFailureMessage(insightRes.kind) };
      }
      lastInsight = insightRes.text.trim();

      const evalResult = await evaluateInsightQuality(contextSnippet, lastInsight);
      if (!evalResult) break;
      if (evalResult.passed) break;
      retryReason = evalResult.reason;
    }

    if (lastInsight) {
      await incrementUsage(cookieStore, "insight");
      return { insight: lastInsight };
    }
    return { error: "인사이트 정리에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  } catch (error) {
    console.error("Summarize Insight Error:", error);
    return { error: "인사이트 정리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

function buildItemPayload(item: FeedItem, summaryText?: string | null): string {
  const base = {
    id: item.id || item.link,
    title: item.title,
    sourceName: item.sourceName,
    type: item.source,
    category: item.category ?? null,
    summary: summaryText || item.summary || null,
    link: item.link,
  };
  return JSON.stringify(base);
}

function safeParseRanking(text: string): RankingResult | null {
  try {
    const parsed = JSON.parse(extractJsonObject(text)) as RankingResult;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      items: parsed.items
        .filter(
          (it) =>
            typeof it.id === "string" &&
            typeof it.priority === "number" &&
            typeof it.score === "number" &&
            typeof it.why === "string" &&
            typeof it.action === "string",
        )
        .sort((a, b) => a.priority - b.priority),
    };
  } catch (e) {
    console.error("Failed to parse ranking JSON", e, text);
    return null;
  }
}

/** 브리핑 랭킹 후보 수 기본값이자 상한 (PRD: 최신순 상위 50개) */
const BRIEFING_CANDIDATES_CAP = 50;

export async function rankFeedByGoalsAction(goals: string, limit?: number) {
  if (!process.env.GEMINI_API_KEY) {
    return { error: geminiFailureMessage("missing_key") };
  }

  const goalText = goals.trim();
  if (!goalText) {
    return { error: "먼저 상단의 My Focus 영역에 목표/관심사를 입력해 주세요." };
  }

  // server action은 외부에서 임의 인자로 호출될 수 있으므로 후보 수를 강제 클램프
  const candidateCount =
    typeof limit === "number" && Number.isFinite(limit) && limit >= 1
      ? Math.min(Math.trunc(limit), BRIEFING_CANDIDATES_CAP)
      : BRIEFING_CANDIDATES_CAP;

  const burst = await guardGeminiActionRateLimit("briefing");
  if (!burst.ok) {
    return { error: burst.error };
  }

  const cookieStore = await cookies();
  const limitResult = await checkUsageLimit(cookieStore, "briefing");
  if (!limitResult.allowed) {
    return { error: limitResult.error };
  }

  const summariesTable = getSupabaseForSummaries();

  // 사용자 커스텀 소스(쿠키·DB)를 반영해 홈 피드와 동일한 후보군 사용
  const mergedSources = await getSessionMergedSources();
  const { items } = await getMergedFeed(mergedSources);
  if (!items || items.length === 0) {
    return { error: "추천할 피드 아이템이 없습니다. 잠시 후 다시 시도해 주세요." };
  }

  const candidates = items.slice(0, candidateCount);

  let summariesMap = new Map<string, string>();
  if (summariesTable) {
    const videoIds = candidates
      .filter((it) => it.source === "YouTube" && it.id)
      .map((it) => it.id as string);
    if (videoIds.length > 0) {
      const { data } = (await summariesTable
        .select("video_id, summary")
        .in("video_id", videoIds)) as { data: { video_id: string; summary: string }[] | null };
      if (data) {
        summariesMap = new Map(data.map((row) => [row.video_id, row.summary]));
      }
    }
  }

  const itemsPayload = candidates.map((item) =>
    buildItemPayload(item, item.id ? summariesMap.get(item.id) ?? null : null),
  );

  const systemGoal = getSystemGoalPrompt(goalText);
  const prompt = getRankingPrompt(systemGoal, itemsPayload, candidateCount);

  try {
    const rawRes = await summarizeWithGemini(prompt);
    if (!rawRes.ok) {
      return { error: geminiFailureMessage(rawRes.kind) };
    }
    const parsed = safeParseRanking(rawRes.text);
    if (!parsed) {
      return { error: "AI 응답을 해석하는 데 실패했습니다. 잠시 후 다시 시도해 주세요." };
    }

    const byId = new Map<string, FeedItem>();
    for (const item of candidates) {
      const key = item.id || item.link;
      byId.set(key, item);
    }

    const ranked = parsed.items
      .map((r) => {
        const original = byId.get(r.id);
        if (!original) return null;
        return {
          item: original,
          priority: r.priority,
          score: r.score,
          why: r.why,
          action: r.action,
        };
      })
      .filter(Boolean) as {
      item: FeedItem;
      priority: number;
      score: number;
      why: string;
      action: string;
    }[];

    if (ranked.length === 0) {
      return { error: "사용자 목표/관심사와 잘 맞는 추천을 찾지 못했습니다." };
    }

    await incrementUsage(cookieStore, "briefing");
    return { ranked };
  } catch (error) {
    console.error("rankFeedByGoalsAction Error:", error);
    return { error: "AI 기반 추천 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
