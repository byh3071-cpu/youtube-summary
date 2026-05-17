import { isBrowser } from "./env";

const SUMMARY_PREFIX = "summary_";
const BRIEFING_PREFIX = "focus_briefing_v1:";
const NOTION_PUSHED_PREFIX = "focus_notion_pushed_v1:";

export function loadVideoSummary(videoId: string): string | undefined {
  if (!isBrowser()) return undefined;
  try {
    return localStorage.getItem(`${SUMMARY_PREFIX}${videoId}`) ?? undefined;
  } catch {
    return undefined;
  }
}

function briefingKey(goals: string): string {
  return `${BRIEFING_PREFIX}${goals.trim()}`;
}

export function loadBriefingCache<T>(goals: string): T | null {
  if (!isBrowser()) return null;
  const trimmed = goals.trim();
  if (!trimmed) return null;
  try {
    const raw = sessionStorage.getItem(briefingKey(trimmed));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveBriefingCache<T>(goals: string, data: T): void {
  if (!isBrowser()) return;
  const trimmed = goals.trim();
  if (!trimmed) return;
  try {
    sessionStorage.setItem(briefingKey(trimmed), JSON.stringify(data));
  } catch {
    // ignore
  }
}

export function clearBriefingCache(goals: string): void {
  if (!isBrowser()) return;
  const trimmed = goals.trim();
  if (!trimmed) return;
  try {
    sessionStorage.removeItem(briefingKey(trimmed));
  } catch {
    // ignore
  }
}

export function wasVideoNotionPushed(videoId: string): boolean {
  if (!isBrowser() || !videoId) return false;
  try {
    return localStorage.getItem(`${NOTION_PUSHED_PREFIX}${videoId}`) !== null;
  } catch {
    return false;
  }
}

export function markVideoNotionPushed(videoId: string, summaryUrl: string): void {
  if (!isBrowser() || !videoId) return;
  try {
    localStorage.setItem(
      `${NOTION_PUSHED_PREFIX}${videoId}`,
      JSON.stringify({ summaryUrl, at: new Date().toISOString() }),
    );
  } catch {
    // ignore
  }
}

export function loadVideoNotionInfo(
  videoId: string,
): { summaryUrl: string; at: string } | null {
  if (!isBrowser() || !videoId) return null;
  try {
    const raw = localStorage.getItem(`${NOTION_PUSHED_PREFIX}${videoId}`);
    if (!raw) return null;
    return JSON.parse(raw) as { summaryUrl: string; at: string };
  } catch {
    return null;
  }
}
