import { RESOURCE_CATEGORIES, SUMMARY_TAGS } from "../notion-section-analyzer";
import { formatTimestamp } from "../video-transcript";
import { OVERLAP_MARKER, type TranscriptChunk } from "./chunking";

/**
 * 디제스트 전용 프롬프트 3종 (맵 / 리듀스 / 단일 패스).
 * 공유 prompts.ts와 분리 — 병렬 작업 충돌 방지 + 디제스트 스키마와 함께 진화.
 */

const FINAL_SCHEMA_BLOCK = `{
  "headline": "한 줄 핵심 (60자 이내)",
  "coreValue": "이 영상을 봐야 하는 이유 1~2문장",
  "summary": "객관적 요약 4~6문장",
  "keyInsights": [
    { "insight": "핵심 인사이트", "evidence": "근거가 된 발언 요지", "timestamp": "MM:SS 또는 H:MM:SS 또는 null" }
  ],
  "keywords": ["핵심 키워드 6~10개"],
  "quotes": [
    { "text": "자막 원문 그대로의 인상적인 발언 1~2문장", "timestamp": "MM:SS 또는 null" }
  ],
  "sections": [
    { "timestamp": "MM:SS 또는 null", "title": "섹션 제목 (40자 이내)", "points": ["요점 1", "요점 2"] }
  ],
  "actions": ["시청자가 바로 실행할 수 있는 액션 0~4개"],
  "openQuestions": ["영상이 다루지 않은 후속 질문 1~3개"],
  "category": "${JSON.stringify(RESOURCE_CATEGORIES)} 중 하나",
  "tags": ["${JSON.stringify(SUMMARY_TAGS)} 에서 1~4개"]
}`;

const COMMON_RULES = [
  "출력은 순수 JSON 객체 하나만. 마크다운 코드 블록, 설명 문장 모두 금지.",
  "timestamp은 입력 자막의 [MM:SS]/[H:MM:SS] 표기에서 그대로 복사한다. 절대 발명하지 않는다.",
  "quotes의 text는 자막 원문을 그대로 옮긴다(의역 금지).",
  "keyInsights는 일반론이 아니라 이 영상 고유의 구체적 주장·수치·방법이어야 한다.",
].join("\n- ");

export function buildDigestMapPrompt(args: {
  title?: string;
  channel?: string | null;
  chunk: TranscriptChunk;
  chunkTotal: number;
}): string {
  const { title, channel, chunk, chunkTotal } = args;
  const range = `${formatTimestamp(chunk.startSec)} ~ ${formatTimestamp(chunk.endSec)}`;
  return [
    "당신은 한국어 영상 분석가입니다. 아래는 한 영상의 일부 구간 자막입니다.",
    title ? `영상 제목: ${title}` : "",
    channel ? `채널: ${channel}` : "",
    `구간: ${chunk.index + 1}/${chunkTotal} (${range})`,
    "",
    "이 구간에서만 다음 JSON 스키마로 추출하세요:",
    `{
  "partSummary": "이 구간 핵심 요약 2~4문장",
  "insights": [ { "insight": "...", "evidence": "근거 발언 요지", "timestamp": "MM:SS" } ],
  "keywords": ["3~6개"],
  "quotes": [ { "text": "자막 원문 그대로 1~2문장", "timestamp": "MM:SS" } ],
  "sections": [ { "timestamp": "MM:SS", "title": "40자 이내", "points": ["요점"] } ]
}`,
    "",
    "규칙:",
    `- insights 0~3개, quotes 0~2개, sections 1~3개.`,
    `- "${OVERLAP_MARKER}" 표시와 그 직후 "(여기부터 이 구간의 본문)" 이전 내용은 문맥 참고만 하고 추출 대상에서 제외한다.`,
    `- ${COMMON_RULES}`,
    "",
    "자막:",
    chunk.text,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDigestReducePrompt(args: {
  title?: string;
  channel?: string | null;
  parts: string[]; // 청크별 ChunkDigest JSON 문자열 (시간순)
}): string {
  const { title, channel, parts } = args;
  return [
    "당신은 한국어 영상 분석가입니다. 한 영상을 구간별로 분석한 중간 결과(시간순 JSON 배열)가 주어집니다.",
    "이를 통합해 영상 전체의 최종 디제스트를 만드세요.",
    title ? `영상 제목: ${title}` : "",
    channel ? `채널: ${channel}` : "",
    "",
    "최종 출력 JSON 스키마:",
    FINAL_SCHEMA_BLOCK,
    "",
    "통합 규칙:",
    "- sections는 입력 sections의 timestamp를 그대로 사용해 시간순으로 5~10개로 병합한다.",
    "- keywords는 중복·유사어를 정리해 6~10개로 만든다.",
    "- quotes는 입력 quotes 중 가장 인상적인 3~5개를 고른다 (text·timestamp 수정 금지).",
    "- keyInsights는 구간 insights를 3~7개로 통합하되 evidence와 timestamp를 유지한다.",
    `- ${COMMON_RULES}`,
    "",
    "구간별 중간 결과:",
    `[${parts.join(",\n")}]`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDigestSinglePassPrompt(args: {
  title?: string;
  channel?: string | null;
  mode: "transcript" | "snippet";
  text: string; // transcript: "[MM:SS] 내용" 줄들 / snippet: 제목·설명
}): string {
  const { title, channel, mode, text } = args;
  const snippetRules =
    mode === "snippet"
      ? [
          "- 자막이 없으므로 timestamp는 모두 null, quotes는 빈 배열, sections는 1~3개로 짧게 만든다.",
        ]
      : [];
  return [
    "당신은 한국어 영상 분석가입니다. 아래 영상 내용을 분석해 디제스트를 만드세요.",
    title ? `영상 제목: ${title}` : "",
    channel ? `채널: ${channel}` : "",
    "",
    "출력 JSON 스키마:",
    FINAL_SCHEMA_BLOCK,
    "",
    "규칙:",
    `- ${COMMON_RULES}`,
    ...snippetRules,
    "",
    mode === "transcript" ? "자막:" : "영상 제목·설명:",
    text,
  ]
    .filter(Boolean)
    .join("\n");
}

/** 리듀스/단일 패스 재시도 시 덧붙이는 힌트 */
export const PURE_JSON_RETRY_HINT =
  "\n\n주의: 직전 출력이 JSON으로 해석되지 않았습니다. 어떤 설명도 없이 순수 JSON 객체 하나만 다시 출력하세요.";
