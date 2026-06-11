import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
  createServerSupabaseFromCookies,
} from "@/lib/supabase-server-cookies";
import type { Database } from "@/lib/supabase-server";
import {
  CUSTOM_SOURCES_COOKIE_NAME,
  CUSTOM_SOURCES_MAX_AGE,
  getCustomSourcesFromCookie,
  compactCustomSources,
  mergeCustomSources,
  filterValidSources,
} from "@/lib/custom-sources-cookie";
import type { FeedSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

/** 쿠키 1개 한도(~4KB)를 넘기지 않기 위한 직렬화 길이 예산 */
const COOKIE_BYTE_BUDGET = 3800;

type MutableCookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * 커스텀 소스 쿠키를 서버에서 직접 굽는다 (단일 쓰기 경로).
 * - JS(document.cookie)로 쓴 쿠키는 iOS Safari ITP가 만료를 7일로 강제 단축하지만
 *   서버 Set-Cookie는 제한을 받지 않아 1년 만료가 유지된다.
 * @returns 쿠키 저장 성공 여부 (용량 초과 시 false)
 */
function setCustomSourcesCookie(cookieStore: MutableCookieStore, sources: FeedSource[]): boolean {
  const value = JSON.stringify(compactCustomSources(sources));
  if (value.length > COOKIE_BYTE_BUDGET) return false;
  cookieStore.set(CUSTOM_SOURCES_COOKIE_NAME, value, {
    path: "/",
    maxAge: CUSTOM_SOURCES_MAX_AGE,
    sameSite: "lax",
  });
  return true;
}

function readCookieSources(cookieStore: MutableCookieStore): FeedSource[] {
  return getCustomSourcesFromCookie(cookieStore.get(CUSTOM_SOURCES_COOKIE_NAME)?.value);
}

type AuthedClient = {
  supabase: NonNullable<ReturnType<typeof createServerSupabaseFromCookies>>;
  userId: string;
};

/** 로그인 사용자면 supabase 클라이언트와 userId를, 아니면 null (getUser 1회만 호출) */
async function getAuthedSupabase(cookieStore: MutableCookieStore): Promise<AuthedClient | null> {
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return null;
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) return null;
  return { supabase, userId: user.id };
}

async function insertSourceToDb(
  auth: AuthedClient,
  source: { id: string; name: string; category: string; avatarUrl?: string },
): Promise<boolean> {
  const row: Database["public"]["Tables"]["custom_sources"]["Insert"] = {
    user_id: auth.userId,
    source_id: source.id,
    name: source.name,
    category: source.category || "기타",
    avatar_url: source.avatarUrl ?? null,
  };
  const { error } = await auth.supabase.from("custom_sources").insert(row as never);
  if (error && error.code !== "23505") {
    console.error("[custom-sources] DB insert failed", error.message);
    return false;
  }
  return true;
}

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) {
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    // 비로그인은 "빈 목록"이 아니라 "동기화 불가"로 구분해야
    // 클라이언트가 쿠키 소스를 DB에 무의미하게 push하지 않는다.
    return Response.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("custom_sources")
    .select("source_id, name, category, avatar_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[GET /api/custom-sources]", error.message);
    return Response.json([]);
  }
  const rows = (data ?? []) as { source_id: string; name: string; category: string; avatar_url: string | null }[];
  const list = rows.map((row) => ({
    id: row.source_id,
    name: row.name,
    type: "YouTube" as const,
    category: row.category || "기타",
    avatarUrl: row.avatar_url ?? undefined,
  }));
  return Response.json(list);
}

/** 채널 1개 추가: 쿠키는 항상(용량 내) 갱신, DB는 로그인 시에만 저장 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  let body: { sourceId?: string; name?: string; category?: string; avatarUrl?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { sourceId, name, category, avatarUrl } = body;
  if (!sourceId || !name) {
    return Response.json({ error: "sourceId and name required" }, { status: 400 });
  }

  const existing = readCookieSources(cookieStore);
  const newSource: FeedSource = {
    id: sourceId,
    name,
    type: "YouTube",
    category: (category || "기타") as FeedSource["category"],
    avatarUrl,
  };
  const merged = mergeCustomSources(existing, [newSource]);

  const cookieStored = setCustomSourcesCookie(cookieStore, merged);
  const auth = await getAuthedSupabase(cookieStore);
  const saved = auth
    ? await insertSourceToDb(auth, { id: sourceId, name, category: category ?? "기타", avatarUrl })
    : false;

  if (!cookieStored && !saved) {
    return Response.json(
      { ok: false, error: "기기 저장 한도를 초과했습니다. 로그인하면 채널을 제한 없이 보관할 수 있어요." },
      { status: 413 },
    );
  }
  return Response.json({ ok: true, saved, cookieStored });
}

/** 채널 목록 일괄 병합 (가져오기·백업 복원·동기화용) */
export async function PUT(request: Request) {
  const cookieStore = await cookies();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const incoming = filterValidSources(body);
  if (incoming.length === 0) {
    return Response.json({ error: "올바른 채널 목록 형식이 아닙니다." }, { status: 400 });
  }

  const existing = readCookieSources(cookieStore);
  const merged = mergeCustomSources(existing, incoming);
  const cookieStored = setCustomSourcesCookie(cookieStore, merged);

  // 로그인 상태면 DB에 없는 항목을 채워 넣는다 (중복은 23505로 무시됨)
  let saved = 0;
  const auth = await getAuthedSupabase(cookieStore);
  if (auth) {
    for (const src of merged) {
      const ok = await insertSourceToDb(auth, {
        id: src.id,
        name: src.name,
        category: src.category,
        avatarUrl: src.avatarUrl,
      });
      if (ok) saved += 1;
    }
  }

  // 쿠키도 못 쓰고 DB에도 못 넣었다면 아무 데도 저장되지 않은 것 — 거짓 성공 금지
  if (!cookieStored && !auth) {
    return Response.json(
      { ok: false, error: "기기 저장 한도를 초과했습니다. 로그인하면 채널을 제한 없이 보관할 수 있어요." },
      { status: 413 },
    );
  }

  return Response.json({ ok: true, count: merged.length, cookieStored, saved });
}

/** 채널 제거: 쿠키에서 항상 제거, DB는 로그인 시에만 */
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");
  if (!sourceId) {
    return Response.json({ error: "sourceId required" }, { status: 400 });
  }

  const existing = readCookieSources(cookieStore);
  setCustomSourcesCookie(cookieStore, existing.filter((s) => s.id !== sourceId));

  const user = await getCurrentUserFromCookies(cookieStore);
  if (user) {
    const supabase = createServerSupabaseFromCookies(cookieStore);
    if (supabase) {
      const { error } = await supabase
        .from("custom_sources")
        .delete()
        .eq("user_id", user.id)
        .eq("source_id", sourceId);
      if (error) {
        console.error("[DELETE /api/custom-sources]", error.message);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }
  }
  return Response.json({ ok: true });
}
