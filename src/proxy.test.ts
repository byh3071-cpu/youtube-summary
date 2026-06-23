import { describe, expect, it } from "vitest";
import { base64UrlDecode, parseSessionExpiryFromCookies } from "@/proxy";

/**
 * Supabase 청크 인증 쿠키 1개를 표현하는 헬퍼.
 * 코드는 expires_at(unix sec) 또는 access_token(JWT) 둘 중 하나에서 만료 시각을 읽는다.
 */
function makeAuthCookie(value: object): { name: string; value: string } {
  return {
    name: "sb-xyz-auth-token",
    value: "base64-" + base64UrlEncode(JSON.stringify(value)),
  };
}

/** 테스트용 base64url 인코더 (코드의 base64UrlDecode 역연산). */
function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** access_token(JWT)의 payload(exp 포함)를 가진 가짜 토큰을 만든다. 서명은 검증하지 않으므로 임의값. */
function makeJwt(payload: object): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe("base64UrlDecode", () => {
  it("base64url(패딩 없음)을 원문으로 디코딩한다", () => {
    const original = '{"expires_at":1700000000}';
    const encoded = base64UrlEncode(original);
    expect(base64UrlDecode(encoded)).toBe(original);
  });

  it("-와 _ (base64url 전용 문자)를 +와 /로 되돌려 디코딩한다", () => {
    // atob은 latin1을 반환하므로 ASCII 범위 입력으로 검증한다.
    // ">>>" → base64 "Pj4+" (+ 포함) → url-safe "Pj4-"
    expect(base64UrlDecode("Pj4-")).toBe(">>>");
    // "<<?" → base64 "PDw/" (/ 포함) → url-safe "PDw_"
    expect(base64UrlDecode("PDw_")).toBe("<<?");
  });
});

describe("parseSessionExpiryFromCookies", () => {
  const NOW_SEC = Math.floor(Date.now() / 1000);

  it("유효한 expires_at(충분히 미래)을 그대로 반환한다", () => {
    const exp = NOW_SEC + 3600;
    const cookies = [makeAuthCookie({ expires_at: exp })];
    expect(parseSessionExpiryFromCookies(cookies)).toBe(exp);
  });

  it("만료 임박(60초 이내) 세션의 expires_at도 정확히 읽는다", () => {
    const exp = NOW_SEC + 30; // 60초 이내 → 호출부가 갱신을 트리거할 케이스
    const cookies = [makeAuthCookie({ expires_at: exp })];
    expect(parseSessionExpiryFromCookies(cookies)).toBe(exp);
  });

  it("이미 만료된 세션의 expires_at(과거 시각)을 읽는다", () => {
    const exp = NOW_SEC - 100;
    const cookies = [makeAuthCookie({ expires_at: exp })];
    expect(parseSessionExpiryFromCookies(cookies)).toBe(exp);
  });

  it("expires_at이 없으면 access_token(JWT)의 exp로 폴백한다", () => {
    const exp = NOW_SEC + 1800;
    const cookies = [makeAuthCookie({ access_token: makeJwt({ exp }) })];
    expect(parseSessionExpiryFromCookies(cookies)).toBe(exp);
  });

  it("청크(.0/.1)로 분할된 쿠키를 순서대로 병합해 읽는다", () => {
    const exp = NOW_SEC + 7200;
    const full = "base64-" + base64UrlEncode(JSON.stringify({ expires_at: exp }));
    const mid = Math.ceil(full.length / 2);
    // 일부러 역순으로 넣어 정렬(.0 먼저)이 실제로 동작하는지 확인
    const cookies = [
      { name: "sb-xyz-auth-token.1", value: full.slice(mid) },
      { name: "sb-xyz-auth-token.0", value: full.slice(0, mid) },
    ];
    expect(parseSessionExpiryFromCookies(cookies)).toBe(exp);
  });

  it("인증 쿠키가 하나도 없으면 null", () => {
    expect(parseSessionExpiryFromCookies([])).toBeNull();
    expect(
      parseSessionExpiryFromCookies([{ name: "other-cookie", value: "x" }]),
    ).toBeNull();
  });

  it("잘못된(파싱 불가) 쿠키 값이면 throw 없이 null로 graceful 폴백한다", () => {
    const cookies = [{ name: "sb-xyz-auth-token", value: "base64-!!!not-json!!!" }];
    expect(parseSessionExpiryFromCookies(cookies)).toBeNull();
  });

  it("JSON은 맞지만 expires_at/access_token 둘 다 없으면 null", () => {
    const cookies = [makeAuthCookie({ user: "nobody" })];
    expect(parseSessionExpiryFromCookies(cookies)).toBeNull();
  });

  it("access_token이 점(.)으로 분할되지 않은 비정상 JWT면 null로 폴백한다", () => {
    const cookies = [makeAuthCookie({ access_token: "no-dots-token" })];
    expect(parseSessionExpiryFromCookies(cookies)).toBeNull();
  });
});
