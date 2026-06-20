"use server";

import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  createServerSupabaseFromCookies,
} from "@/lib/supabase-server-cookies";
import {
  canTransition,
  isContentState,
  type ContentState,
  type ContentSourceType,
} from "@/types/content-state";

export type ContentStateInfo = {
  state: ContentState;
  playPositionSeconds: number;
  completed: boolean;
  notionPageId: string | null;
  stateChangedAt: string;
};

/**
 * 로그인 사용자의 콘텐츠 상태 맵(content_id → 상태). 비로그인/미설정이면 빈 객체.
 * contentIds를 주면 해당 항목만 조회, 없으면 전체.
 */
export async function getContentStatesAction(
  contentIds?: string[],
): Promise<Record<string, ContentStateInfo>> {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return {};
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) return {};

  let query = supabase
    .from("content_states")
    .select(
      "content_id, state, play_position_seconds, completed, notion_page_id, state_changed_at",
    )
    .eq("user_id", user.id);

  if (contentIds && contentIds.length > 0) {
    // 과도하게 긴 IN 목록을 막는다.
    query = query.in("content_id", contentIds.slice(0, 500));
  }

  const { data, error } = await query;
  if (error || !data) {
    if (error) console.error("[getContentStatesAction]", error.message);
    return {};
  }

  const out: Record<string, ContentStateInfo> = {};
  for (const row of data as {
    content_id: string;
    state: string;
    play_position_seconds: number | null;
    completed: boolean | null;
    notion_page_id: string | null;
    state_changed_at: string;
  }[]) {
    if (!isContentState(row.state)) continue;
    out[row.content_id] = {
      state: row.state,
      playPositionSeconds: row.play_position_seconds ?? 0,
      completed: row.completed ?? false,
      notionPageId: row.notion_page_id,
      stateChangedAt: row.state_changed_at,
    };
  }
  return out;
}

export type SetContentStateResult =
  | { ok: true; state: ContentState }
  | { error: string };

/**
 * 콘텐츠 상태 변경. 허용된 전이만 수행한다(스펙 §5, canTransition).
 * 행이 없으면 기본 상태(inbox)에서 시작한 것으로 보고 전이를 검증한다.
 */
export async function setContentStateAction(input: {
  contentId: string;
  nextState: ContentState;
  sourceId?: string | null;
  sourceType?: ContentSourceType | null;
  notionPageId?: string | null;
}): Promise<SetContentStateResult> {
  const contentId = input.contentId?.trim();
  if (!contentId || contentId.length > 512) {
    return { error: "콘텐츠 식별자가 올바르지 않습니다." };
  }
  if (!isContentState(input.nextState)) {
    return { error: "알 수 없는 상태입니다." };
  }

  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return { error: "로그인이 필요합니다." };
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) return { error: "서버 설정이 필요합니다." };

  // 현재 상태 조회(없으면 inbox로 간주) → 전이 검증
  const { data: existing } = await supabase
    .from("content_states")
    .select("state")
    .eq("user_id", user.id)
    .eq("content_id", contentId)
    .maybeSingle();

  const current: ContentState =
    existing && isContentState((existing as { state: string }).state)
      ? ((existing as { state: string }).state as ContentState)
      : "inbox";

  if (!canTransition(current, input.nextState)) {
    return {
      error: `'${current}' 상태에서 '${input.nextState}'로 바꿀 수 없습니다.`,
    };
  }

  const now = new Date().toISOString();
  const row = {
    user_id: user.id,
    content_id: contentId,
    state: input.nextState,
    state_changed_at: now,
    updated_at: now,
    ...(input.sourceId !== undefined ? { source_id: input.sourceId } : {}),
    ...(input.sourceType !== undefined ? { source_type: input.sourceType } : {}),
    ...(input.notionPageId !== undefined
      ? { notion_page_id: input.notionPageId }
      : {}),
  };

  const table = supabase.from("content_states");
  const { error } = await (
    table as unknown as {
      upsert: (
        r: typeof row,
        o: { onConflict: string },
      ) => Promise<{ error: unknown }>;
    }
  ).upsert(row, { onConflict: "user_id,content_id" });

  if (error) {
    console.error("[setContentStateAction]", error);
    return { error: "상태 저장에 실패했습니다." };
  }
  return { ok: true, state: input.nextState };
}
