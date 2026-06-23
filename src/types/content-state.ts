/**
 * 콘텐츠 처리 상태 모델 (개인 연구 시스템 스펙 §5).
 * DB: docs/supabase-migrations/008_content_states.sql 와 1:1 대응.
 *
 * 핵심 흐름:
 *   inbox → queued → consuming → consumed → processing → reviewed → exported → archived
 * 별도 종료 상태: dismissed(볼 가치 없음), failed(수집·분석·내보내기 실패)
 */

import type { FeedItem } from "./feed";

export const CONTENT_STATES = [
  "inbox",
  "queued",
  "consuming",
  "consumed",
  "processing",
  "reviewed",
  "exported",
  "archived",
  "dismissed",
  "failed",
] as const;

export type ContentState = (typeof CONTENT_STATES)[number];

export function isContentState(value: unknown): value is ContentState {
  return (
    typeof value === "string" &&
    (CONTENT_STATES as readonly string[]).includes(value)
  );
}

/** UI 표기용 한국어 라벨. */
export const CONTENT_STATE_LABEL: Record<ContentState, string> = {
  inbox: "새 항목",
  queued: "처리 대기",
  consuming: "소비 중",
  consumed: "소비 완료",
  processing: "분석 중",
  reviewed: "검토 완료",
  exported: "노션 반영됨",
  archived: "보관",
  dismissed: "제외",
  failed: "실패",
};

/**
 * 허용 상태 전이(스펙 §5). 상태는 자동 추론보다 사용자의 명시적 선택을 우선하되,
 * 서버/클라이언트 양쪽에서 잘못된 전이를 막기 위한 화이트리스트로 사용한다.
 */
export const CONTENT_STATE_TRANSITIONS: Record<ContentState, ContentState[]> = {
  inbox: ["queued", "dismissed", "archived"],
  queued: ["consuming", "inbox", "dismissed", "archived"],
  consuming: ["consumed", "queued", "archived"],
  consumed: ["processing", "reviewed", "archived"],
  processing: ["reviewed", "failed", "consumed"],
  reviewed: ["exported", "archived"],
  exported: ["reviewed", "archived"],
  archived: ["inbox", "queued"],
  dismissed: ["inbox"],
  failed: ["inbox", "processing"],
};

export function canTransition(from: ContentState, to: ContentState): boolean {
  if (from === to) return true;
  return CONTENT_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/** "승격 게이트"(스펙 §14.1): reviewed 이상만 요한 브레인으로 단방향 upsert 한다. */
export const PROMOTABLE_STATES: readonly ContentState[] = ["reviewed", "exported"];

export function isPromotable(state: ContentState): boolean {
  return PROMOTABLE_STATES.includes(state);
}

export type ContentSourceType = "YouTube" | "RSS";

/** content_states 테이블 행과 1:1 대응. */
export type ContentStateRow = {
  user_id: string;
  content_id: string;
  source_id: string | null;
  source_type: ContentSourceType | null;
  state: ContentState;
  play_position_seconds: number;
  completed: boolean;
  notion_page_id: string | null;
  last_synced_at: string | null;
  state_changed_at: string;
  created_at: string;
  updated_at: string;
};

/**
 * 피드 항목의 안정적인 content_id를 만든다.
 * YouTube=videoId, RSS=`rss:<link>`. content_states 의 키로 사용한다.
 */
export function contentIdForItem(
  item: Pick<FeedItem, "source" | "id" | "link">,
): string | undefined {
  if (item.source === "YouTube") return item.id || undefined;
  if (item.source === "RSS") return item.link ? `rss:${item.link}` : undefined;
  return undefined;
}

/** 피드 상태필터 칩 값. all=전체, queued=처리 대기, dismissed=제외함. */
export type StateFilter = "all" | "queued" | "dismissed";

/**
 * 상태필터(처리 대기/제외함/전체) 아래에서 피드 항목을 노출할지 판단한다.
 *
 * 핵심 규칙: 상태가 없는 항목(RSS·미선별 YouTube 등 content_states 행 미존재)은
 * "아직 처리 안 됨 = 처리 대기"로 간주한다. 따라서:
 *   - queued 필터: state === "queued" 이거나 상태가 아예 없는 항목을 노출.
 *   - dismissed 필터: state === "dismissed" 인 항목만 노출.
 *   - all 필터: dismissed 만 숨기고 나머지(상태 없음 포함) 모두 노출.
 *
 * (이전 구현은 상태 없는 항목을 queued 필터에서 전부 떨궈 RSS가 전멸했음 — HANDOFF §2-3.)
 */
export function isItemVisibleUnderStateFilter(
  item: Pick<FeedItem, "source" | "id" | "link">,
  contentStates: Record<string, { state: ContentState } | undefined>,
  stateFilter: StateFilter,
): boolean {
  const cid = contentIdForItem(item);
  const state = cid ? contentStates[cid]?.state : undefined;

  if (stateFilter === "queued") return state === "queued" || state === undefined;
  if (stateFilter === "dismissed") return state === "dismissed";
  // all: 제외(dismissed)만 기본 숨김.
  return state !== "dismissed";
}
