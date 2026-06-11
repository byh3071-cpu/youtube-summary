import { cookies } from "next/headers";
import { defaultSources, type FeedSource } from "@/lib/sources";
import {
  getCustomSourcesFromCookie,
  mergeCustomSources,
  CUSTOM_SOURCES_COOKIE_NAME,
} from "@/lib/custom-sources-cookie";
import { getCustomSourcesFromDb } from "@/lib/supabase-server-cookies";
import type { CookieStore } from "@/lib/supabase-server-cookies";

function mergeSources(defaultList: FeedSource[], custom: FeedSource[]): FeedSource[] {
  const existingIds = new Set(defaultList.map((s) => s.id));
  const extra = custom.filter((c) => !existingIds.has(c.id));
  return [...defaultList, ...extra];
}

async function getSessionCustomSources(): Promise<FeedSource[]> {
  const cookieStore = await cookies();
  const customFromCookie = getCustomSourcesFromCookie(cookieStore.get(CUSTOM_SOURCES_COOKIE_NAME)?.value);
  const customFromDb = await getCustomSourcesFromDb(cookieStore as CookieStore);
  return mergeCustomSources(customFromCookie, customFromDb);
}

/**
 * 병합 소스 목록과 커스텀 소스 ID를 한 번의 조회로 함께 반환.
 * 페이지에서 getSessionMergedSources/getSessionCustomSourceIds를 따로 부르면
 * Supabase 왕복(getUser + select)이 2배로 발생하므로 이 함수를 사용한다.
 */
export async function getSessionSourcesBundle(): Promise<{
  mergedSources: FeedSource[];
  customSourceIds: string[];
}> {
  const custom = await getSessionCustomSources();
  return {
    mergedSources: mergeSources(defaultSources, custom),
    customSourceIds: custom.map((s) => s.id),
  };
}

/** 쿠키·DB 커스텀 소스를 반영한 병합 소스 목록(홈·피드 Q&A·트렌드 등 공통) */
export async function getSessionMergedSources(): Promise<FeedSource[]> {
  return (await getSessionSourcesBundle()).mergedSources;
}

export async function getSessionCustomSourceIds(): Promise<string[]> {
  return (await getSessionSourcesBundle()).customSourceIds;
}
