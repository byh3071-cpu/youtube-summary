import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { savePlaylistAction } from "@/app/actions/playlists";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const user = await getCurrentUserFromCookies(cookieStore);
    if (!user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다. 플레이리스트는 로그인한 계정에만 저장됩니다." },
        { status: 401 },
      );
    }

    const { items, title } = (await req.json()) as {
      items?: RadioQueueItem[];
      title?: string;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "저장할 항목이 없습니다." },
        { status: 400 },
      );
    }

    // savePlaylistAction은 쿠키 세션에서 사용자를 직접 확인한다(클라이언트 userId 불신뢰).
    const result = await savePlaylistAction(items, title);

    if ("error" in result && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/playlists/save error:", error);
    return NextResponse.json(
      { error: "플레이리스트 저장 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
