import { extractJsonObject } from "../llm-json";
import { RESOURCE_CATEGORIES, SUMMARY_TAGS } from "../notion-section-analyzer";
import {
  parseTimestampToSeconds,
  type ChunkDigest,
  type DigestInsight,
  type DigestQuote,
  type DigestSection,
  type VideoDigest,
} from "./types";

/** 스키마 상한 (LLM이 초과 생성해도 코드에서 잘라낸다) */
const MAX_KEY_INSIGHTS = 7;
const MAX_KEYWORDS = 10;
const MAX_QUOTES = 5;
const MAX_SECTIONS = 12;
const MAX_ACTIONS = 4;
const MAX_OPEN_QUESTIONS = 3;
const MAX_POINTS_PER_SECTION = 6;

function asString(v: unknown, maxLen: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function asStringArray(v: unknown, maxItems: number, maxLen = 200): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item, maxLen);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * timestamp 문자열 검증 + seconds 파생. 자막 없는 모드면 강제 null.
 * maxSeconds가 주어지면 영상 길이를 넘는 타임스탬프(LLM 환각)를 무효화한다.
 */
function normalizeTimestamp(
  v: unknown,
  hasTimestamps: boolean,
  maxSeconds?: number,
): { timestamp: string | null; seconds?: number } {
  if (!hasTimestamps) return { timestamp: null };
  const ts = typeof v === "string" ? v.trim() : null;
  const seconds = parseTimestampToSeconds(ts);
  if (ts && seconds !== undefined) {
    if (maxSeconds !== undefined && seconds > maxSeconds + 60) {
      return { timestamp: null };
    }
    return { timestamp: ts, seconds };
  }
  return { timestamp: null };
}

function dedupeKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const kw of keywords) {
    const key = kw.normalize("NFC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out;
}

function parseInsights(
  v: unknown,
  hasTimestamps: boolean,
  max: number,
  maxSeconds?: number,
): DigestInsight[] {
  if (!Array.isArray(v)) return [];
  const out: DigestInsight[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const insight = asString(obj.insight, 300);
    if (!insight) continue;
    const ts = normalizeTimestamp(obj.timestamp, hasTimestamps, maxSeconds);
    out.push({
      insight,
      evidence: asString(obj.evidence, 300) ?? "",
      ...ts,
    });
    if (out.length >= max) break;
  }
  return out;
}

function parseQuotes(
  v: unknown,
  hasTimestamps: boolean,
  max: number,
  maxSeconds?: number,
): DigestQuote[] {
  if (!Array.isArray(v)) return [];
  const out: DigestQuote[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const text = asString(obj.text, 400);
    if (!text) continue;
    const ts = normalizeTimestamp(obj.timestamp, hasTimestamps, maxSeconds);
    // 자막 기반인데 타임스탬프가 유효하지 않은 인용은 신뢰도가 낮아 제외
    if (hasTimestamps && ts.timestamp === null) continue;
    out.push({ text, ...ts });
    if (out.length >= max) break;
  }
  return out;
}

function parseSections(
  v: unknown,
  hasTimestamps: boolean,
  maxSeconds?: number,
): DigestSection[] {
  if (!Array.isArray(v)) return [];
  const out: DigestSection[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const title = asString(obj.title, 80);
    if (!title) continue;
    const ts = normalizeTimestamp(obj.timestamp, hasTimestamps, maxSeconds);
    out.push({
      title,
      points: asStringArray(obj.points, MAX_POINTS_PER_SECTION),
      ...ts,
    });
    if (out.length >= MAX_SECTIONS) break;
  }
  // 시간순 정렬 (timestamp 없는 항목은 뒤로)
  return out.sort((a, b) => (a.seconds ?? Number.MAX_SAFE_INTEGER) - (b.seconds ?? Number.MAX_SAFE_INTEGER));
}

/** 맵 단계(청크) 출력 파싱. 실패 시 null — 호출부가 실패 청크로 집계. */
export function safeParseChunkDigest(raw: string): ChunkDigest | null {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
    const partSummary = asString(parsed.partSummary, 800);
    if (!partSummary) return null;
    return {
      partSummary,
      insights: parseInsights(parsed.insights, true, 3),
      keywords: dedupeKeywords(asStringArray(parsed.keywords, 6, 60)),
      quotes: parseQuotes(parsed.quotes, true, 2),
      sections: parseSections(parsed.sections, true),
    };
  } catch {
    return null;
  }
}

/** 최종 디제스트 파싱·검증. headline/summary가 없으면 실패(null). */
export function safeParseVideoDigest(
  raw: string,
  opts: { hasTimestamps: boolean; maxSeconds?: number },
): VideoDigest | null {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>;
    const headline = asString(parsed.headline, 120);
    const summary = asString(parsed.summary, 2000);
    if (!headline || !summary) return null;

    const category =
      typeof parsed.category === "string" &&
      (RESOURCE_CATEGORIES as readonly string[]).includes(parsed.category)
        ? parsed.category
        : undefined;
    const tags = asStringArray(parsed.tags, 4, 40).filter((t) =>
      (SUMMARY_TAGS as readonly string[]).includes(t),
    );

    return {
      headline,
      coreValue: asString(parsed.coreValue, 400) ?? "",
      summary,
      keyInsights: parseInsights(
        parsed.keyInsights,
        opts.hasTimestamps,
        MAX_KEY_INSIGHTS,
        opts.maxSeconds,
      ),
      keywords: dedupeKeywords(asStringArray(parsed.keywords, MAX_KEYWORDS, 60)),
      quotes: parseQuotes(parsed.quotes, opts.hasTimestamps, MAX_QUOTES, opts.maxSeconds),
      sections: parseSections(parsed.sections, opts.hasTimestamps, opts.maxSeconds),
      actions: asStringArray(parsed.actions, MAX_ACTIONS, 200),
      openQuestions: asStringArray(parsed.openQuestions, MAX_OPEN_QUESTIONS, 200),
      ...(category ? { category } : {}),
      ...(tags.length > 0 ? { tags } : {}),
    };
  } catch {
    return null;
  }
}
