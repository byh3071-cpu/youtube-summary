import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  getBookmarksFromDb,
  getCustomSourcesFromDb,
} from "@/lib/supabase-server-cookies";
import { getPlaylistsForCurrentUser } from "@/lib/playlists-server";

/**
 * GET /api/account/export — 로그인 사용자의 서버 보관 데이터를 JSON으로 반환한다.
 * 브라우저(localStorage/sessionStorage) 데이터는 클라이언트에서 합쳐 내려받는다.
 * 팀 데이터는 포함하지 않는다(본인 user_id 범위만).
 */
export async function GET() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const [bookmarks, customSources, playlistsResult] = await Promise.all([
    getBookmarksFromDb(cookieStore),
    getCustomSourcesFromDb(cookieStore),
    getPlaylistsForCurrentUser(cookieStore),
  ]);

  const playlists =
    playlistsResult.kind === "ok" ? playlistsResult.playlists : [];

  return NextResponse.json({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    serverData: { bookmarks, customSources, playlists },
  });
}
