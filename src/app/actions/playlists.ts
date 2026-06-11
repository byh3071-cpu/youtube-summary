"use server";

import { cookies } from "next/headers";
import { getMutationTable, type Database } from "@/lib/supabase-server";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";

const LOGIN_REQUIRED_ERROR = "로그인이 필요합니다. 플레이리스트는 로그인한 계정에만 저장됩니다.";
const SUPABASE_CONFIG_ERROR = "Supabase 설정(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)이 필요합니다.";

// 서버 액션은 클라이언트에서 직접 호출될 수 있으므로, 호출자가 넘긴 userId를
// 신뢰하지 않고 항상 쿠키 세션에서 현재 사용자를 직접 확인한다.
async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  return user?.id ?? null;
}

// 라디오 큐를 Supabase playlists 테이블에 저장. 로그인 사용자 전용.
export async function savePlaylistAction(items: RadioQueueItem[], title?: string) {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: LOGIN_REQUIRED_ERROR };
  }

  if (!items.length) {
    return { error: "저장할 항목이 없습니다." };
  }

  const mutTable = getMutationTable("playlists");
  if (!mutTable) {
    return { error: SUPABASE_CONFIG_ERROR };
  }

  const row: Database["public"]["Tables"]["playlists"]["Insert"] = {
    user_id: userId,
    title: title ?? null,
    items: items as unknown as Database["public"]["Tables"]["playlists"]["Row"]["items"],
  };

  const { data, error } = await mutTable.insert(row).select("id").single();

  if (error || !data) {
    console.error("savePlaylistAction error:", error);
    return { error: "플레이리스트 저장에 실패했습니다." };
  }

  return { id: (data as { id: string }).id };
}

// 플레이리스트 이름 변경. 본인 소유 행만 변경 가능.
export async function renamePlaylistAction(playlistId: string, newTitle: string) {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: LOGIN_REQUIRED_ERROR };
  }

  if (!playlistId || !newTitle.trim()) {
    return { error: "플레이리스트 ID와 새 제목이 필요합니다." };
  }

  const mutTable = getMutationTable("playlists");
  if (!mutTable) {
    return { error: SUPABASE_CONFIG_ERROR };
  }

  // service role은 RLS를 우회하므로 user_id 조건을 절대 생략하지 않는다.
  const { data, error } = await mutTable
    .update({ title: newTitle.trim() })
    .eq("id", playlistId)
    .eq("user_id", userId)
    .select("id");

  if (error || !data || (data as unknown[]).length === 0) {
    if (error) console.error("renamePlaylistAction error:", error);
    return { error: "플레이리스트 이름 변경에 실패했습니다." };
  }

  return { ok: true };
}

// 플레이리스트 삭제. 본인 소유 행만 삭제 가능.
export async function deletePlaylistAction(playlistId: string) {
  const userId = await getSessionUserId();
  if (!userId) {
    return { error: LOGIN_REQUIRED_ERROR };
  }

  if (!playlistId) {
    return { error: "플레이리스트 ID가 필요합니다." };
  }

  const mutTable = getMutationTable("playlists");
  if (!mutTable) {
    return { error: SUPABASE_CONFIG_ERROR };
  }

  // service role은 RLS를 우회하므로 user_id 조건을 절대 생략하지 않는다.
  const { data, error } = await mutTable
    .delete()
    .eq("id", playlistId)
    .eq("user_id", userId)
    .select("id");

  if (error || !data || (data as unknown[]).length === 0) {
    if (error) console.error("deletePlaylistAction error:", error);
    return { error: "플레이리스트 삭제에 실패했습니다." };
  }

  return { ok: true };
}
