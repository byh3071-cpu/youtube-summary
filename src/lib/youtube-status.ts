import type { YouTubeFetchStatus } from "./youtube";

/** YouTube 연결 상태 → 사용자 표시 라벨 */
export const YOUTUBE_STATUS_LABEL: Record<YouTubeFetchStatus, string> = {
  ready: "정상 연결",
  missing_api_key: "키 필요",
  invalid_api_key: "연동 설정 오류",
  request_failed: "일시 장애",
} as const;

/** YouTube 연결 상태 → Tailwind 스타일 클래스 */
export const YOUTUBE_STATUS_TONE: Record<YouTubeFetchStatus, string> = {
  ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  missing_api_key: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  invalid_api_key: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  request_failed: "border-orange-500/20 bg-orange-500/10 text-orange-700 dark:text-orange-300",
} as const;
