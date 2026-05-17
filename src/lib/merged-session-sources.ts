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

/** 쿠키·DB 커스텀 소스를 반영한 병합 소스 목록(홈·피드 Q&A·트렌드 등 공통) */
export async function getSessionMergedSources(): Promise<FeedSource[]> {
  const cookieStore = await cookies();
  const customFromCookie = getCustomSourcesFromCookie(cookieStore.get(CUSTOM_SOURCES_COOKIE_NAME)?.value);
  const customFromDb = await getCustomSourcesFromDb(cookieStore as CookieStore);
  const customSources = mergeCustomSources(customFromCookie, customFromDb);
  return mergeSources(defaultSources, customSources);
}

export async function getSessionCustomSourceIds(): Promise<string[]> {
  const cookieStore = await cookies();
  const customFromCookie = getCustomSourcesFromCookie(cookieStore.get(CUSTOM_SOURCES_COOKIE_NAME)?.value);
  const customFromDb = await getCustomSourcesFromDb(cookieStore as CookieStore);
  return mergeCustomSources(customFromCookie, customFromDb).map((s) => s.id);
}
