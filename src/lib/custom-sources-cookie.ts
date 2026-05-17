import type { FeedSource } from "./sources";

export const CUSTOM_SOURCES_COOKIE_NAME = "focus_feed_sources";
export const CUSTOM_SOURCES_MAX_AGE = 60 * 60 * 24 * 365; // 1년

export function getCustomSourcesFromCookie(cookieValue: string | undefined): FeedSource[] {
  if (!cookieValue) return [];
  try {
    const decoded = decodeURIComponent(cookieValue.trim());
    const parsed = JSON.parse(decoded) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is FeedSource =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as FeedSource).id === "string" &&
        typeof (item as FeedSource).name === "string" &&
        (item as FeedSource).type === "YouTube" &&
        typeof (item as FeedSource).category === "string"
    );
  } catch {
    return [];
  }
}

export function buildCustomSourcesCookie(sources: FeedSource[]): string {
  const compactSources = sources.map(({ id, name, type, category }) => ({
    id,
    name,
    type,
    category,
  }));
  const value = encodeURIComponent(JSON.stringify(compactSources));
  return `${CUSTOM_SOURCES_COOKIE_NAME}=${value}; path=/; max-age=${CUSTOM_SOURCES_MAX_AGE}; SameSite=Lax`;
}

/** 가져오기 시 기존 목록과 합칠 때, id 기준 중복 제거 (기존 유지 + 새 항목만 추가) */
export function mergeCustomSources(existing: FeedSource[], incoming: FeedSource[]): FeedSource[] {
  const idSet = new Set(existing.map((s) => s.id));
  const added = incoming.filter((s) => typeof s?.id === "string" && !idSet.has(s.id));
  return [...existing, ...added];
}

/**
 * 쿠키에 저장된 커스텀 소스를 DB와 동기화합니다.
 * - 쿠키에만 있는 소스 → DB에 추가
 * - DB에만 있는 소스 → 쿠키 목록에 추가
 * 로그인 시 호출하면 기기 간 소스 동기화 가능.
 */
export async function syncCustomSourcesWithDb(
  cookieSources: FeedSource[],
): Promise<{ merged: FeedSource[]; changed: boolean }> {
  try {
    const res = await fetch("/api/custom-sources");
    if (!res.ok) return { merged: cookieSources, changed: false };
    const dbSources = (await res.json()) as FeedSource[];

    const dbIds = new Set(dbSources.map((s) => s.id));
    const cookieIds = new Set(cookieSources.map((s) => s.id));

    // 쿠키에만 있는 → DB에 추가
    const onlyCookie = cookieSources.filter((s) => !dbIds.has(s.id));
    for (const src of onlyCookie) {
      await fetch("/api/custom-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: src.id,
          name: src.name,
          category: src.category,
          avatarUrl: src.avatarUrl,
        }),
      });
    }

    // DB에만 있는 → 쿠키 목록에 추가
    const onlyDb = dbSources.filter((s) => !cookieIds.has(s.id));
    const merged = mergeCustomSources(cookieSources, onlyDb);
    const changed = onlyCookie.length > 0 || onlyDb.length > 0;

    return { merged, changed };
  } catch {
    return { merged: cookieSources, changed: false };
  }
}
