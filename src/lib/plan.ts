"use server";

import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import type { CookieStore } from "@/lib/supabase-server-cookies";
import {
  FREE_DAILY_INSIGHT,
  FREE_DAILY_SUMMARY,
  FREE_DAILY_FEED_QA,
  FREE_WEEKLY_BRIEFING,
  getKstDateString,
  getKstWeekStart,
} from "@/lib/usage-limits";

export type UserPlan = "owner" | "free" | "pro";

/**
 * 로그인한 사용자의 플랜 반환. 비로그인 시 null.
 * OWNER_EMAIL과 일치하면 'owner'(제한 없음), DB에 Pro가 있으면 'pro', 아니면 'free'.
 */
export async function getPlanForUser(cookieStore: CookieStore): Promise<UserPlan | null> {
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return null;

  const ownerEmail = process.env.OWNER_EMAIL?.trim();
  if (ownerEmail && user.email === ownerEmail) {
    return "owner";
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) return "free";

  const table = supabase.from("user_plan");
  const { data } = (await table
    .select("plan, expires_at")
    .eq("user_id", user.id)
    .maybeSingle()) as { data: { plan: string; expires_at: string | null } | null };

  if (data?.plan === "pro") {
    if (!data.expires_at) return "pro";
    if (new Date(data.expires_at) > new Date()) return "pro";
  }
  return "free";
}

/**
 * 사용 제한 확인. allowed가 false면 error 메시지 반환.
 */
export async function checkUsageLimit(
  cookieStore: CookieStore,
  kind: "summary" | "insight" | "briefing" | "feed_qa",
): Promise<{ allowed: true } | { allowed: false; error: string }> {
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return { allowed: false, error: "로그인이 필요합니다." };
  }

  const plan = await getPlanForUser(cookieStore);
  if (plan === null) return { allowed: false, error: "로그인이 필요합니다." };
  if (plan === "owner" || plan === "pro") return { allowed: true };

  const supabase = getServerSupabaseClient();
  if (!supabase) return { allowed: true };

  const today = getKstDateString();

  if (kind === "summary") {
    const { data } = (await supabase
      .from("usage_daily")
      .select("summary_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()) as { data: { summary_count: number } | null };
    const count = data?.summary_count ?? 0;
    if (count >= FREE_DAILY_SUMMARY) {
      return {
        allowed: false,
        error: `오늘 요약 한도(${FREE_DAILY_SUMMARY}회)를 모두 사용했습니다. Pro로 업그레이드하면 무제한 이용할 수 있습니다.`,
      };
    }
  }

  if (kind === "insight") {
    const { data } = (await supabase
      .from("usage_daily")
      .select("insight_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()) as { data: { insight_count: number } | null };
    const count = data?.insight_count ?? 0;
    if (count >= FREE_DAILY_INSIGHT) {
      return {
        allowed: false,
        error: `오늘 인사이트 한도(${FREE_DAILY_INSIGHT}회)를 모두 사용했습니다. Pro로 업그레이드하면 무제한 이용할 수 있습니다.`,
      };
    }
  }

  if (kind === "briefing") {
    const weekStart = getKstWeekStart(today);
    const { data: rows } = (await supabase
      .from("usage_daily")
      .select("briefing_count")
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", today)) as { data: { briefing_count: number }[] | null };
    const total = (rows ?? []).reduce((s, r) => s + r.briefing_count, 0);
    if (total >= FREE_WEEKLY_BRIEFING) {
      return {
        allowed: false,
        error: `이번 주 브리핑 한도(${FREE_WEEKLY_BRIEFING}회)를 모두 사용했습니다. Pro로 업그레이드하면 무제한 이용할 수 있습니다.`,
      };
    }
  }

  if (kind === "feed_qa") {
    const { data } = (await supabase
      .from("usage_daily")
      .select("feed_qa_count")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle()) as { data: { feed_qa_count: number } | null };
    const count = data?.feed_qa_count ?? 0;
    if (count >= FREE_DAILY_FEED_QA) {
      return {
        allowed: false,
        error: `오늘 피드 Q&A 한도(${FREE_DAILY_FEED_QA}회)를 모두 사용했습니다. Pro로 업그레이드하면 무제한 이용할 수 있습니다.`,
      };
    }
  }

  return { allowed: true };
}

/**
 * 사용량 1 증가. owner는 카운트하지 않음.
 */
export async function incrementUsage(
  cookieStore: CookieStore,
  kind: "summary" | "insight" | "briefing" | "feed_qa",
): Promise<void> {
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) return;

  const plan = await getPlanForUser(cookieStore);
  if (plan === "owner") return;

  const supabase = getServerSupabaseClient();
  if (!supabase) return;

  const today = getKstDateString();
  const table = supabase.from("usage_daily");

  const { data: row } = (await table
    .select("summary_count, insight_count, briefing_count, feed_qa_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle()) as {
    data: {
      summary_count: number;
      insight_count: number;
      briefing_count: number;
      feed_qa_count: number;
    } | null;
  };

  const next = {
    user_id: user.id,
    date: today,
    summary_count: row ? row.summary_count + (kind === "summary" ? 1 : 0) : kind === "summary" ? 1 : 0,
    insight_count: row ? row.insight_count + (kind === "insight" ? 1 : 0) : kind === "insight" ? 1 : 0,
    briefing_count: row ? row.briefing_count + (kind === "briefing" ? 1 : 0) : kind === "briefing" ? 1 : 0,
    feed_qa_count: row ? (row.feed_qa_count ?? 0) + (kind === "feed_qa" ? 1 : 0) : kind === "feed_qa" ? 1 : 0,
    updated_at: new Date().toISOString(),
  };

  await (
    table as unknown as {
      upsert: (row: typeof next, opts: { onConflict: string }) => Promise<unknown>;
    }
  ).upsert(next, { onConflict: "user_id,date" });
}
