import { generateGeminiText } from "./gemini";
import { extractJsonObject } from "./llm-json";
import type { StructuredVideoContext, TranscriptLine } from "./video-transcript";
import { formatTimestamp } from "./video-transcript";

export const RESOURCE_CATEGORIES = [
  "직무",
  "커리어",
  "AI/자동화",
  "창업",
  "재무",
  "카페운영",
  "개발",
  "마케팅",
  "일반",
  "철학",
  "자기이해",
] as const;

export const SUMMARY_TAGS = [
  "AI/LLM",
  "자동화 (AIOps/IBN)",
  "네트워크",
  "탐구",
  "분석",
  "직무",
  "가치관",
  "강점",
  "커리어",
  "강의",
  "철학",
  "자기이해",
  "창업",
  "학습",
  "재무",
  "카페운영",
  "개발",
  "마케팅",
  "일반",
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];
export type SummaryTag = (typeof SUMMARY_TAGS)[number];

/** 트리플맵 표준 관계 팔레트 (yohan-brain knowledge-hub/triple-map.md 와 동일) */
export const TRIPLE_RELATIONS = [
  "is_a", "part_of", "related_to", "complementary_to", "implements",
  "created_by", "applies_to", "depends_on", "evolved_from", "comprises",
  "solves", "addresses", "exposes", "signals", "enables", "blocks",
  "triggers", "transforms_into", "precondition_of", "opposite_of",
] as const;

/** 트리플 도메인 (triple-map.md 와 동일) */
export const TRIPLE_DOMAINS = [
  "AI/자동화",
  "비즈니스",
  "개발",
  "자기이해",
  "학습",
] as const;

export type TripleRelation = (typeof TRIPLE_RELATIONS)[number];
export type TripleDomain = (typeof TRIPLE_DOMAINS)[number];

/** [주어] --관계--> [목적어] 의미 관계 1건 (요한 브레인 승급 후보) */
export interface Triple {
  subject: string;
  relation: TripleRelation;
  object: string;
  domain: TripleDomain;
  /** 신뢰도 1~5 (자막 기반=3, 추론=2) */
  confidence: number;
}

/** 영상에 등장한 인물 (인물 DB 승급 후보) */
export interface PersonMention {
  name: string;
  role?: string;
}

export interface SectionAnalysis {
  timestamp: string | null;
  title: string;
  points: string[];
  excerpt: string;
}

export interface VideoAnalysis {
  headline: string;
  category: ResourceCategory;
  tags: SummaryTag[];
  summary: string;
  sections: SectionAnalysis[];
  openQuestions: string[];
  /** 트리플맵 후보 (R3: 후보만 — 등록·확정은 검토 후) */
  triples: Triple[];
  /** 인물 DB 후보 */
  people: PersonMention[];
  /** AI 사전 개념 후보 */
  concepts: string[];
}

export interface BriefingHint {
  why?: string;
  action?: string;
  priority?: number;
  score?: number;
}

function buildTranscriptBlock(lines: TranscriptLine[]): string {
  const sampleLines = lines.length > 600 ? sampleEvenly(lines, 600) : lines;
  return sampleLines
    .map((line) => `[${formatTimestamp(line.offset)}] ${line.text}`)
    .join("\n");
}

function sampleEvenly<T>(arr: T[], target: number): T[] {
  if (arr.length <= target) return arr;
  const step = arr.length / target;
  const out: T[] = [];
  for (let i = 0; i < target; i++) {
    out.push(arr[Math.floor(i * step)]);
  }
  return out;
}

function buildPrompt(args: {
  title: string;
  channel?: string | null;
  context: StructuredVideoContext;
  hint?: BriefingHint;
}): string {
  const { title, channel, context, hint } = args;
  const hintBlock = hint
    ? [
        hint.why ? `- 추천 이유: ${hint.why}` : "",
        hint.action ? `- 이번 주 액션: ${hint.action}` : "",
        hint.priority != null ? `- 우선순위: ${hint.priority}순위` : "",
        hint.score != null ? `- 적합도: ${Math.round(hint.score)}점` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  let contextBlock: string;
  let sectionGuide: string;

  if ("error" in context) {
    contextBlock = "(내용 없음)";
    sectionGuide = "1개 섹션만 만드세요. timestamp는 null로 둡니다.";
  } else if (context.mode === "transcript") {
    contextBlock = buildTranscriptBlock(context.lines);
    sectionGuide =
      "5~8개 섹션으로 분할합니다. timestamp는 자막 라인의 [MM:SS] 표기에서 가까운 시각을 그대로 사용하세요.";
  } else {
    contextBlock = context.text;
    sectionGuide =
      "자막이 없으므로 1~3개 섹션으로 짧게 분할합니다. timestamp는 모두 null로 둡니다.";
  }

  const allowedCategories = JSON.stringify(RESOURCE_CATEGORIES);
  const allowedTags = JSON.stringify(SUMMARY_TAGS);
  const allowedRelations = JSON.stringify(TRIPLE_RELATIONS);
  const allowedDomains = JSON.stringify(TRIPLE_DOMAINS);

  return [
    "당신은 한국어로 학습 노트를 작성하는 분석가입니다.",
    "다음 영상에 대한 구조화된 분석을 **순수 JSON**으로만 출력하세요. 마크다운 코드 블록, 설명 문장 모두 금지.",
    "",
    `영상 제목: ${title}`,
    channel ? `채널: ${channel}` : "",
    hintBlock ? `\n사용자 맥락:\n${hintBlock}` : "",
    "",
    "영상 내용:",
    contextBlock,
    "",
    "출력 JSON 스키마:",
    "{",
    '  "headline": "한 줄 핵심 인사이트 (60자 이내)",',
    `  "category": "${allowedCategories} 중 하나",`,
    `  "tags": ["${allowedTags} 에서 1~4개"],`,
    '  "summary": "객관적 1차 요약 3~5문장",',
    '  "sections": [',
    "    {",
    '      "timestamp": "MM:SS 또는 H:MM:SS 또는 null",',
    '      "title": "섹션 제목 (40자 이내)",',
    '      "points": ["요점 1", "요점 2", "요점 3"],',
    '      "excerpt": "이 섹션에서 가장 핵심적인 자막 1~2문장 발췌"',
    "    }",
    "  ],",
    '  "openQuestions": ["추가로 알아보면 좋을 후속 질문 1", "질문 2"],',
    '  "triples": [',
    "    {",
    '      "subject": "주어(개념/인물/도구/조직)",',
    `      "relation": "관계 코드 (반드시 ${allowedRelations} 중 하나)",`,
    '      "object": "목적어",',
    `      "domain": "${allowedDomains} 중 하나",`,
    '      "confidence": 3',
    "    }",
    "  ],",
    '  "people": [{ "name": "인물명", "role": "역할/직함 (선택)" }],',
    '  "concepts": ["핵심 개념/용어 1", "개념 2"]',
    "}",
    "",
    `섹션 분할 가이드: ${sectionGuide}`,
    "category/tags는 반드시 위 허용 목록에서만 선택합니다. 목록에 없는 단어를 만들지 마세요.",
    "openQuestions는 1~3개. 영상에서 다루지 않았지만 사용자 맥락(추천 이유/액션)을 고려할 때 다음에 탐구하면 좋을 질문.",
    `triples는 3~7개. relation은 반드시 ${allowedRelations} 에서만 고르고, 불확실하면 related_to. 특히 solves/addresses/exposes(문제 지도)를 우선 활용. confidence는 자막 기반이면 3, 추론이면 2.`,
    "people는 영상의 저자·발화자·핵심 등장인물 0~5명 (1회성 인용 제외). concepts는 재사용 가치가 있는 핵심 용어 3~8개.",
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}

function safeParseAnalysis(raw: string): VideoAnalysis | null {
  try {
    const parsed = JSON.parse(extractJsonObject(raw)) as Partial<VideoAnalysis>;
    if (
      typeof parsed.headline !== "string" ||
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.sections)
    ) {
      return null;
    }
    const category =
      typeof parsed.category === "string" &&
      (RESOURCE_CATEGORIES as readonly string[]).includes(parsed.category)
        ? (parsed.category as ResourceCategory)
        : "일반";
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags
          .filter((t): t is SummaryTag =>
            typeof t === "string" &&
            (SUMMARY_TAGS as readonly string[]).includes(t),
          )
          .slice(0, 4)
      : [];
    const sections: SectionAnalysis[] = parsed.sections
      .map((s) => {
        if (!s || typeof s !== "object") return null;
        const obj = s as Partial<SectionAnalysis>;
        return {
          timestamp: typeof obj.timestamp === "string" ? obj.timestamp : null,
          title: typeof obj.title === "string" ? obj.title : "(제목 없음)",
          points: Array.isArray(obj.points)
            ? obj.points.filter((p): p is string => typeof p === "string").slice(0, 6)
            : [],
          excerpt: typeof obj.excerpt === "string" ? obj.excerpt : "",
        };
      })
      .filter((s): s is SectionAnalysis => s !== null);

    const openQuestions = Array.isArray(parsed.openQuestions)
      ? parsed.openQuestions
          .filter((q): q is string => typeof q === "string")
          .slice(0, 3)
      : [];

    const triples: Triple[] = Array.isArray(parsed.triples)
      ? parsed.triples
          .map((t): Triple | null => {
            if (!t || typeof t !== "object") return null;
            const obj = t as Partial<Triple>;
            if (
              typeof obj.subject !== "string" ||
              typeof obj.object !== "string" ||
              typeof obj.relation !== "string" ||
              !(TRIPLE_RELATIONS as readonly string[]).includes(obj.relation)
            ) {
              return null;
            }
            const domain =
              typeof obj.domain === "string" &&
              (TRIPLE_DOMAINS as readonly string[]).includes(obj.domain)
                ? (obj.domain as TripleDomain)
                : "AI/자동화";
            const confidence =
              typeof obj.confidence === "number" &&
              obj.confidence >= 1 &&
              obj.confidence <= 5
                ? Math.round(obj.confidence)
                : 3;
            return {
              subject: obj.subject,
              relation: obj.relation as TripleRelation,
              object: obj.object,
              domain,
              confidence,
            };
          })
          .filter((t): t is Triple => t !== null)
          .slice(0, 7)
      : [];

    const people: PersonMention[] = Array.isArray(parsed.people)
      ? parsed.people
          .map((p): PersonMention | null => {
            if (!p || typeof p !== "object") return null;
            const obj = p as Partial<PersonMention>;
            if (typeof obj.name !== "string" || obj.name.trim() === "") {
              return null;
            }
            return typeof obj.role === "string" && obj.role.trim() !== ""
              ? { name: obj.name.trim(), role: obj.role.trim() }
              : { name: obj.name.trim() };
          })
          .filter((p): p is PersonMention => p !== null)
          .slice(0, 5)
      : [];

    const concepts: string[] = Array.isArray(parsed.concepts)
      ? parsed.concepts
          .filter((c): c is string => typeof c === "string" && c.trim() !== "")
          .map((c) => c.trim())
          .slice(0, 8)
      : [];

    return {
      headline: parsed.headline,
      category,
      tags,
      summary: parsed.summary,
      sections: sections.length > 0 ? sections : [
        { timestamp: null, title: "전체", points: [], excerpt: "" },
      ],
      openQuestions,
      triples,
      people,
      concepts,
    };
  } catch {
    return null;
  }
}

export async function analyzeVideoForNotion(args: {
  title: string;
  channel?: string | null;
  context: StructuredVideoContext;
  hint?: BriefingHint;
}): Promise<VideoAnalysis | null> {
  const prompt = buildPrompt(args);
  const raw = await generateGeminiText(prompt, "NotionSectionAnalyzer");
  if (!raw) return null;
  return safeParseAnalysis(raw);
}
