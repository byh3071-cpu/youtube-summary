import type { FeedSource } from "./sources";

export const CUSTOM_SOURCES_COOKIE_NAME = "focus_feed_sources";
export const CUSTOM_SOURCES_MAX_AGE = 60 * 60 * 24 * 365; // 1년

export function filterValidSources(parsed: unknown): FeedSource[] {
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
}

/**
 * 쿠키 값에서 커스텀 소스 목록을 파싱한다.
 * 과거 클라이언트가 직접 쓴 encodeURIComponent 형식과
 * 서버(Set-Cookie)가 쓴 plain JSON 형식을 모두 허용한다.
 */
export function getCustomSourcesFromCookie(cookieValue: string | undefined): FeedSource[] {
  if (!cookieValue) return [];
  const raw = cookieValue.trim();
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // %가 들어간 plain JSON이면 decode가 실패할 수 있음 — raw로 시도
  }
  for (const candidate of candidates) {
    try {
      const list = filterValidSources(JSON.parse(candidate));
      if (list.length > 0) return list;
    } catch {
      // 다음 후보로
    }
  }
  return [];
}

/** 쿠키에 저장할 최소 형태 (아바타 URL 등 부피 큰 필드는 제외) */
export function compactCustomSources(
  sources: FeedSource[],
): Pick<FeedSource, "id" | "name" | "type" | "category">[] {
  return sources.map(({ id, name, type, category }) => ({ id, name, type, category }));
}

/** 가져오기 시 기존 목록과 합칠 때, id 기준 중복 제거 (기존 유지 + 새 항목만 추가) */
export function mergeCustomSources(existing: FeedSource[], incoming: FeedSource[]): FeedSource[] {
  const idSet = new Set(existing.map((s) => s.id));
  const added = incoming.filter((s) => typeof s?.id === "string" && !idSet.has(s.id));
  return [...existing, ...added];
}

/**
 * 쿠키의 커스텀 소스와 DB 목록을 비교해 병합 결과를 계산한다 (읽기 전용).
 * 실제 저장(쿠키 Set-Cookie + DB upsert)은 호출부가 PUT /api/custom-sources 한 번으로 수행한다.
 */
export async function syncCustomSourcesWithDb(
  cookieSources: FeedSource[],
): Promise<{ merged: FeedSource[]; changed: boolean }> {
  try {
    const res = await fetch("/api/custom-sources");
    // 401(비로그인) 포함 실패 시 동기화 건너뜀
    if (!res.ok) return { merged: cookieSources, changed: false };
    const dbSources = (await res.json()) as FeedSource[];
    if (!Array.isArray(dbSources)) return { merged: cookieSources, changed: false };

    const dbIds = new Set(dbSources.map((s) => s.id));
    const cookieIds = new Set(cookieSources.map((s) => s.id));
    const onlyCookie = cookieSources.filter((s) => !dbIds.has(s.id));
    const onlyDb = dbSources.filter((s) => !cookieIds.has(s.id));

    const merged = mergeCustomSources(cookieSources, onlyDb);
    return { merged, changed: onlyCookie.length > 0 || onlyDb.length > 0 };
  } catch {
    return { merged: cookieSources, changed: false };
  }
}
