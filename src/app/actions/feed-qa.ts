"use server";

import { cookies } from "next/headers";
import { getMergedFeed } from "@/lib/feed";
import { getSessionMergedSources } from "@/lib/merged-session-sources";
import type { CookieStore } from "@/lib/supabase-server-cookies";
import { checkUsageLimit, incrementUsage } from "@/lib/plan";
import { guardGeminiActionRateLimit } from "@/lib/gemini-rate-limit";
import { generateGeminiText } from "@/lib/gemini";
import { getFeedQAPrompt } from "@/lib/prompts";
import type { FeedItem } from "@/types/feed";

const CONTEXT_ITEM_CAP = 50;
const QUESTION_MAX = 500;
const HISTORY_TURNS_MAX = 6;
const HISTORY_MSG_MAX = 420;

export type FeedQAHistoryTurn = { role: "user" | "assistant"; content: string };

function getSortTimestamp(pubDate: string): number {
  const t = new Date(pubDate).getTime();
  return Number.isFinite(t) ? t : 0;
}

function buildContextLines(items: FeedItem[]): string[] {
  const sorted = [...items].sort((a, b) => getSortTimestamp(b.pubDate) - getSortTimestamp(a.pubDate));
  const slice = sorted.slice(0, CONTEXT_ITEM_CAP);
  return slice.map((item) => {
    const id = item.id || item.link;
    const date = item.pubDate.slice(0, 19);
    const title = (item.title || "").replace(/\s+/g, " ").trim().slice(0, 220);
    const sum = (item.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    return `${date}\t${item.sourceName}\t${title}\t${sum}\t${id}`;
  });
}

async function generateAnswer(prompt: string): Promise<string | null> {
  const raw = await generateGeminiText(prompt, "FeedQA");
  return raw?.trim() || null;
}

function formatHistoryForPrompt(history: FeedQAHistoryTurn[] | undefined): string {
  if (!history?.length) return "";
  const slice = history.slice(-HISTORY_TURNS_MAX * 2);
  const lines: string[] = [];
  for (const m of slice) {
    const role = m.role === "user" ? "사용자" : "어시스턴트";
    const text = m.content.replace(/\s+/g, " ").trim().slice(0, HISTORY_MSG_MAX);
    if (text) lines.push(`${role}: ${text}`);
  }
  return lines.join("\n");
}

export async function feedQAAction(
  question: string,
  selectedSourceId?: string | null,
  history?: FeedQAHistoryTurn[] | null,
): Promise<{ answer: string } | { error: string }> {
  const q = question.trim().slice(0, QUESTION_MAX);
  if (q.length < 2) {
    return { error: "질문을 2자 이상 입력해 주세요." };
  }

  if (!process.env.GEMINI_API_KEY) {
    return { error: ".env.local 파일에 GEMINI_API_KEY 설정이 필요합니다." };
  }

  const burst = await guardGeminiActionRateLimit("feed_qa");
  if (!burst.ok) {
    return { error: burst.error };
  }

  const cookieStore = await cookies();
  const limitResult = await checkUsageLimit(cookieStore as CookieStore, "feed_qa");
  if (!limitResult.allowed) {
    return { error: limitResult.error };
  }

  const mergedSources = await getSessionMergedSources();

  const { items } = await getMergedFeed(mergedSources);
  if (!items.length) {
    return { error: "피드 항목이 없어 질문에 답할 수 없습니다." };
  }

  let pool = items;
  if (selectedSourceId) {
    pool = items.filter((i) => i.sourceId === selectedSourceId);
  }
  if (!pool.length) {
    return { error: "선택한 소스에 해당하는 피드가 없습니다." };
  }

  const lines = buildContextLines(pool);
  if (lines.length === 0) {
    return { error: "컨텍스트를 구성할 수 없습니다." };
  }

  const prior = formatHistoryForPrompt(history ?? undefined);
  const prompt = getFeedQAPrompt(lines, q, prior);
  const answer = await generateAnswer(prompt);
  if (!answer) {
    return { error: "답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  await incrementUsage(cookieStore as CookieStore, "feed_qa");
  return { answer };
}
