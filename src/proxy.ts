import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase 세션 갱신 프록시 (필수).
 *
 * 액세스 토큰(기본 1시간) 만료 후 서버에서 `auth.getUser()`가 리프레시 토큰으로
 * 세션을 갱신하면 Supabase는 리프레시 토큰을 회전(rotate)시킨다. 갱신된 토큰을
 * 쿠키에 다시 써 주지 않으면 쿠키에는 이미 소각된 토큰만 남아 다음 요청부터
 * 서버가 비로그인으로 오판한다 → DB 기반 데이터(커스텀 소스 등)가 사라져 보임.
 * 서버 컴포넌트는 쿠키를 쓸 수 없으므로 이 프록시가 매 요청 갱신을 담당한다.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  // Supabase 인증 쿠키가 없으면(비로그인) 갱신할 것도 없으므로 건너뜀
  const hasAuthCookie = request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (!hasAuthCookie) return response;

  // 액세스 토큰이 아직 충분히 유효하면 갱신이 필요 없으므로
  // Supabase 인증 서버 왕복(getUser)을 생략한다 — 매 요청 100~300ms 절약.
  const expiresAt = getSessionExpiry(request);
  if (expiresAt !== null && expiresAt * 1000 - Date.now() > 60_000) {
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // 만료된 세션이면 여기서 갱신되고, 회전된 토큰이 setAll로 응답 쿠키에 실린다.
  await supabase.auth.getUser();

  return response;
}

export function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return atob(input.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

/**
 * Supabase 인증 쿠키 목록(이름·값)에서 세션 만료 시각(unix sec)을 네트워크 호출 없이 읽는
 * 순수 함수. NextRequest 의존이 없어 단위 테스트가 가능하다(런타임 경로는 getSessionExpiry 경유).
 * 청크(.0/.1) 병합 → base64-/URL 디코딩 → expires_at, 없으면 access_token(JWT) exp 순으로 본다.
 * 어떤 단계든 실패하면 null → 호출부가 getUser로 폴백한다.
 */
export function parseSessionExpiryFromCookies(
  cookies: ReadonlyArray<{ name: string; value: string }>,
): number | null {
  try {
    const chunks = cookies
      .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => {
        const na = Number(a.name.match(/\.(\d+)$/)?.[1] ?? "0");
        const nb = Number(b.name.match(/\.(\d+)$/)?.[1] ?? "0");
        return na - nb;
      });
    if (chunks.length === 0) return null;

    const joined = chunks.map((c) => c.value).join("");
    let jsonStr: string;
    if (joined.startsWith("base64-")) {
      jsonStr = base64UrlDecode(joined.slice("base64-".length));
    } else {
      try {
        jsonStr = decodeURIComponent(joined);
      } catch {
        jsonStr = joined;
      }
    }
    const session = JSON.parse(jsonStr) as { expires_at?: number; access_token?: string };
    if (typeof session.expires_at === "number") return session.expires_at;
    if (typeof session.access_token === "string") {
      const payloadPart = session.access_token.split(".")[1];
      if (!payloadPart) return null;
      const payload = JSON.parse(base64UrlDecode(payloadPart)) as { exp?: number };
      if (typeof payload.exp === "number") return payload.exp;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Supabase 인증 쿠키(sb-*-auth-token, 청크 .0/.1 포함)에서 세션 만료 시각(unix sec)을
 * 네트워크 호출 없이 읽는다. 어떤 단계든 실패하면 null → 호출부가 getUser로 폴백.
 * (만료 판단에만 쓰고 신뢰가 필요한 인증은 여전히 getUser/RLS가 담당)
 */
function getSessionExpiry(request: NextRequest): number | null {
  return parseSessionExpiryFromCookies(request.cookies.getAll());
}

export const config = {
  // 정적 자산·이미지·아이콘은 제외하고 페이지·API 요청에만 적용
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|webmanifest)$).*)",
  ],
};
