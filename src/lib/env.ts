/** 브라우저(클라이언트) 환경 여부를 반환합니다. SSR 시에는 false를 반환합니다. */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * 서버 시작 시 필수 환경변수가 설정되어 있는지 검증합니다.
 * 누락된 변수가 있으면 경고를 출력합니다 (프로세스를 종료하지는 않음).
 */
export function validateEnv() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ] as const;

  const recommended = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "YOUTUBE_API_KEY",
    "GEMINI_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "OWNER_EMAIL",
  ] as const;

  const missing = required.filter((k) => !process.env[k]);
  const missingRec = recommended.filter((k) => !process.env[k]);

  if (missing.length > 0) {
    console.error(
      `[env] ❌ 필수 환경변수 누락: ${missing.join(", ")}  — 앱이 정상 작동하지 않을 수 있습니다.`
    );
  }
  if (missingRec.length > 0) {
    console.warn(
      `[env] ⚠️  권장 환경변수 누락: ${missingRec.join(", ")}  — 일부 기능이 비활성화됩니다.`
    );
  }
}
