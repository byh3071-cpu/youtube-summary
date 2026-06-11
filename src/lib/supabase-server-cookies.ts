import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase-server";
import type { FeedSource } from "@/lib/sources";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type CookieStore = {
  getAll(): { name: string; value: string }[];
  /** 라우트 핸들러·서버 액션의 cookies()는 쓰기 가능. 서버 컴포넌트는 없거나 throw. */
  set?: (name: string, value: string, options?: Record<string, unknown>) => void;
};

/**
 * 쿠키 기반 Supabase 서버 클라이언트 (Anon Key, 세션으로 user 식별).
 * API 라우트·서버 컴포넌트에서 유저별 데이터 접근 시 사용.
 */
export function createServerSupabaseFromCookies(
  cookieStore: CookieStore
): SupabaseClient<Database> | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // 세션 갱신 시 회전된 토큰을 영속화. 서버 컴포넌트에서는 쿠키 쓰기가
        // 불가(throw)하므로 무시 — 그 경우 src/middleware.ts가 갱신을 담당한다.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set?.(name, value, options as Record<string, unknown>),
          );
        } catch {
          // noop
        }
      },
    },
  });
}

type AuthUser = NonNullable<
  Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>["data"]["user"]
>;

/** 같은 요청(cookieStore 인스턴스)에서 getUser 네트워크 호출을 1회로 줄이는 메모 */
const userPromiseCache = new WeakMap<CookieStore, Promise<AuthUser | null>>();

/**
 * 쿠키에서 현재 로그인 유저 반환. 비로그인이면 null.
 * 같은 요청 내 반복 호출은 메모이제이션된다 (cookies()는 요청당 동일 인스턴스).
 */
export function getCurrentUserFromCookies(cookieStore: CookieStore): Promise<AuthUser | null> {
  const cached = userPromiseCache.get(cookieStore);
  if (cached) return cached;
  const promise = (async () => {
    const supabase = createServerSupabaseFromCookies(cookieStore);
    if (!supabase) return null;
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  })();
  userPromiseCache.set(cookieStore, promise);
  return promise;
}

/**
 * 로그인 유저의 custom_sources를 FeedSource[]로 반환. 비로그인이면 [].
 */
export async function getCustomSourcesFromDb(cookieStore: CookieStore): Promise<FeedSource[]> {
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return [];
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("custom_sources")
    .select("source_id, name, category, avatar_url")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[getCustomSourcesFromDb]", error.message);
    return [];
  }
  const rows = (data ?? []) as {
    source_id: string;
    name: string;
    category: string;
    avatar_url: string | null;
  }[];
  return rows.map((row) => ({
    id: row.source_id,
    name: row.name,
    type: "YouTube" as const,
    category: (row.category || "기타") as FeedSource["category"],
    avatarUrl: row.avatar_url ?? undefined,
  }));
}

export type BookmarkRow = {
  id: string;
  video_id: string;
  video_title: string;
  highlight: string;
  created_at: string;
};

/**
 * 로그인 유저의 북마크 목록 반환. 비로그인이면 [].
 */
export async function getBookmarksFromDb(cookieStore: CookieStore): Promise<BookmarkRow[]> {
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return [];
  const supabase = createServerSupabaseFromCookies(cookieStore);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("bookmarks")
    .select("id, video_id, video_title, highlight, created_at")
    .eq("user_id", user.id)
    .is("team_id", null)
    .order("created_at", { ascending: false });
  if (error) {
    // team_id 컬럼이 DB에 아직 없을 경우 폴백: user_id 필터만으로 재시도
    if (error.message.includes("team_id") || error.code === "42703") {
      const { data: fallback, error: fallbackError } = await supabase
        .from("bookmarks")
        .select("id, video_id, video_title, highlight, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (fallbackError) {
        console.error("[getBookmarksFromDb fallback]", fallbackError.message);
        return [];
      }
      return (fallback ?? []) as BookmarkRow[];
    }
    console.error("[getBookmarksFromDb]", error.message);
    return [];
  }
  const rows = (data ?? []) as BookmarkRow[];
  return rows;
}
