import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getCurrentUserFromCookies, type CookieStore } from "@/lib/supabase-server-cookies";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";

export type PlaylistListItem = {
  id: string;
  title: string | null;
  items: RadioQueueItem[];
  created_at: string;
};

export type PlaylistsForUserResult =
  | { kind: "unconfigured" }
  | { kind: "anonymous" }
  | { kind: "error" }
  | { kind: "ok"; playlists: PlaylistListItem[] };

/**
 * 현재 로그인 사용자의 플레이리스트 목록 조회.
 * 비로그인이면 DB를 조회하지 않는다 — 익명(user_id IS NULL) 행은 어떤 경우에도 노출 금지.
 */
export async function getPlaylistsForCurrentUser(
  cookieStore: CookieStore,
): Promise<PlaylistsForUserResult> {
  const supabase = getServerSupabaseClient();
  if (!supabase) return { kind: "unconfigured" };

  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return { kind: "anonymous" };

  const { data, error } = (await supabase
    .from("playlists")
    .select("id, title, items, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })) as {
    data:
      | { id: string; title: string | null; items: unknown; created_at: string }[]
      | null;
    error: unknown;
  };

  if (error || !data) {
    if (error) console.error("[getPlaylistsForCurrentUser]", error);
    return { kind: "error" };
  }

  return {
    kind: "ok",
    playlists: data.map((row) => ({
      id: row.id,
      title: row.title,
      items: (row.items as RadioQueueItem[]) ?? [],
      created_at: row.created_at,
    })),
  };
}
