export const FREE_DAILY_SUMMARY = 5;
export const FREE_DAILY_INSIGHT = 3;
export const FREE_DAILY_FEED_QA = 5;
export const FREE_WEEKLY_BRIEFING = 1;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function getKstDateString(date = new Date()): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 해당 KST 날짜가 속한 주의 월요일(YYYY-MM-DD) */
export function getKstWeekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
