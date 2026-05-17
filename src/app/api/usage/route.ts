import { cookies } from "next/headers";
import {
  getCurrentUserFromCookies,
} from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getPlanForUser } from "@/lib/plan";
import {
  FREE_DAILY_INSIGHT,
  FREE_DAILY_SUMMARY,
  FREE_DAILY_FEED_QA,
  FREE_WEEKLY_BRIEFING,
  getKstDateString,
  getKstWeekStart,
} from "@/lib/usage-limits";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return Response.json({ plan: null });
  }

  const plan = await getPlanForUser(cookieStore);
  if (plan === "owner" || plan === "pro") {
    return Response.json({ plan, unlimited: true });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return Response.json({ plan: "free", unlimited: false, summary: { used: 0, limit: FREE_DAILY_SUMMARY }, insight: { used: 0, limit: FREE_DAILY_INSIGHT }, feedQa: { used: 0, limit: FREE_DAILY_FEED_QA }, briefing: { used: 0, limit: FREE_WEEKLY_BRIEFING } });
  }

  const today = getKstDateString();
  const weekStart = getKstWeekStart(today);

  const { data: todayRow } = await supabase
    .from("usage_daily")
    .select("summary_count, insight_count, feed_qa_count")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle() as { data: { summary_count: number; insight_count: number; feed_qa_count: number } | null };

  const { data: weekRows } = await supabase
    .from("usage_daily")
    .select("briefing_count")
    .eq("user_id", user.id)
    .gte("date", weekStart)
    .lte("date", today) as { data: { briefing_count: number }[] | null };

  const briefingUsed = (weekRows ?? []).reduce((s, r) => s + r.briefing_count, 0);

  return Response.json({
    plan: "free",
    unlimited: false,
    summary: { used: todayRow?.summary_count ?? 0, limit: FREE_DAILY_SUMMARY },
    insight: { used: todayRow?.insight_count ?? 0, limit: FREE_DAILY_INSIGHT },
    feedQa: { used: todayRow?.feed_qa_count ?? 0, limit: FREE_DAILY_FEED_QA },
    briefing: { used: briefingUsed, limit: FREE_WEEKLY_BRIEFING },
  });
}
