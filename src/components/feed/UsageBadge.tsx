"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Zap, Brain, MessageCircle } from "lucide-react";
import { FREE_DAILY_FEED_QA } from "@/lib/usage-limits";

type UsageData = {
  plan: string | null;
  unlimited?: boolean;
  summary?: { used: number; limit: number };
  insight?: { used: number; limit: number };
  feedQa?: { used: number; limit: number };
  briefing?: { used: number; limit: number };
};

export default function UsageBadge() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    const loadUsage = () => {
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d) => setData(d as UsageData))
        .catch(() => {});
    };

    loadUsage();
    window.addEventListener("focus-feed:usage-updated", loadUsage);
    return () => window.removeEventListener("focus-feed:usage-updated", loadUsage);
  }, []);

  // 비로그인 또는 로딩 중
  if (!data || data.plan === null) return null;
  // Pro/Owner: 무제한
  if (data.unlimited) return null;

  const { summary, insight, briefing } = data;
  if (!summary || !insight || !briefing) return null;

  const feedQa = data.feedQa ?? { used: 0, limit: FREE_DAILY_FEED_QA };

  const summaryLeft = Math.max(0, summary.limit - summary.used);
  const insightLeft = Math.max(0, insight.limit - insight.used);
  const feedQaLeft = Math.max(0, feedQa.limit - feedQa.used);
  const briefingLeft = Math.max(0, briefing.limit - briefing.used);
  const anyExhausted =
    summaryLeft === 0 || insightLeft === 0 || feedQaLeft === 0 || briefingLeft === 0;
  const anyNear =
    !anyExhausted &&
    (summaryLeft === 1 ||
      insightLeft === 1 ||
      feedQaLeft === 1 ||
      (briefing.limit > 0 && briefingLeft === 1));

  return (
    <section className="mb-3 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/55">
          오늘의 사용량
        </p>
        {anyExhausted && (
          <Link
            href="/pricing"
            className="rounded-full bg-gradient-to-r from-purple-500 to-emerald-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            Pro 업그레이드
          </Link>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[12px]">
        <UsageItem
          icon={<Sparkles size={14} className="text-purple-500" />}
          label="AI 요약"
          used={summary.used}
          limit={summary.limit}
        />
        <UsageItem
          icon={<Brain size={14} className="text-amber-500" />}
          label="인사이트"
          used={insight.used}
          limit={insight.limit}
        />
        <UsageItem
          icon={<MessageCircle size={14} className="text-sky-500" />}
          label="피드 Q&A"
          used={feedQa.used}
          limit={feedQa.limit}
        />
        <UsageItem
          icon={<Zap size={14} className="text-emerald-500" />}
          label="브리핑"
          used={briefing.used}
          limit={briefing.limit}
          suffix="/주"
        />
      </div>
      {anyNear && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-100/90">
          일일·주간 한도가 곧 찹니다. 필요하면{" "}
          <Link href="/pricing" className="font-semibold underline underline-offset-2">
            Pro
          </Link>
          로 무제한을 검토해 보세요.
        </p>
      )}
      {anyExhausted && (
        <p className="mt-2 text-[11px] text-(--notion-fg)/55">
          한도를 모두 사용했습니다.{" "}
          <Link href="/pricing" className="font-semibold text-purple-600 underline underline-offset-2 dark:text-purple-400">
            Pro로 업그레이드
          </Link>
          하면 무제한으로 이용할 수 있어요.
        </p>
      )}
    </section>
  );
}

function UsageItem({
  icon,
  label,
  used,
  limit,
  suffix = "/일",
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
  suffix?: string;
}) {
  const left = Math.max(0, limit - used);
  const exhausted = left === 0;
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;

  return (
    <div className="flex items-center gap-2 rounded-xl bg-(--notion-gray)/40 px-3 py-2">
      {icon}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-(--notion-fg)/80">{label}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-(--notion-gray)">
            <div
              className={`h-full rounded-full transition-all ${exhausted ? "bg-red-400" : "bg-(--focus-accent)"}`}
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <span className={`text-[10px] font-medium ${exhausted ? "text-red-500" : "text-(--notion-fg)/60"}`}>
            {left}/{limit}{suffix}
          </span>
        </div>
      </div>
    </div>
  );
}
