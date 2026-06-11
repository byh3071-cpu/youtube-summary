/**
 * 비디오 디제스트(NotebookLM식 구조화 분석) 타입.
 * LLM이 생성한 JSON을 parse.ts에서 검증·후처리한 최종 형태.
 */

/** 이 값을 올리면 모든 캐시가 무효화되어 다음 조회 시 재생성된다. */
export const DIGEST_SCHEMA_VERSION = 1;

export interface DigestInsight {
  insight: string;
  /** 인사이트의 근거가 된 발언 요지 */
  evidence: string;
  timestamp: string | null;
  /** 코드에서 파생 — 라디오 seekTo(sec) 입력값. LLM에 요구하지 않는다. */
  seconds?: number;
}

export interface DigestQuote {
  /** 자막 원문 그대로의 인용("엑기스") */
  text: string;
  timestamp: string | null;
  seconds?: number;
}

export interface DigestSection {
  timestamp: string | null;
  seconds?: number;
  title: string;
  points: string[];
}

export interface VideoDigest {
  /** 한 줄 핵심 (≤60자 목표) */
  headline: string;
  /** "이 영상을 봐야 하는 이유" 1~2문장 */
  coreValue: string;
  /** 객관 요약 4~6문장 */
  summary: string;
  keyInsights: DigestInsight[];
  /** 6~10개 — 피드 키워드 필터와 연동 */
  keywords: string[];
  quotes: DigestQuote[];
  sections: DigestSection[];
  actions: string[];
  openQuestions: string[];
  /** 노션 어댑터용 — RESOURCE_CATEGORIES 중 하나 */
  category?: string;
  /** 노션 어댑터용 — SUMMARY_TAGS 중 1~4개 */
  tags?: string[];
}

/** 청크별 맵 단계 출력 (reduce 입력) */
export interface ChunkDigest {
  partSummary: string;
  insights: DigestInsight[];
  keywords: string[];
  quotes: DigestQuote[];
  sections: DigestSection[];
}

/** "MM:SS" 또는 "H:MM:SS" → 초. 형식이 어긋나면 undefined. */
export function parseTimestampToSeconds(ts: string | null | undefined): number | undefined {
  if (!ts) return undefined;
  const m = ts.trim().match(/^(\d{1,3}):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!m) return undefined;
  if (m[3] !== undefined) {
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}
