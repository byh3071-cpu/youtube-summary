"use client";

import Link from "next/link";
import type { TrendRadarItem, TrendRadarResult } from "@/app/actions/trend";

function scoreFontPx(score: number, minS: number, maxS: number): number {
  if (maxS <= minS) return 15;
  const t = (score - minS) / (maxS - minS);
  const clamped = Math.min(1, Math.max(0, t));
  return Math.round(12 + clamped * 20);
}

export default function TrendDashboard({ initial }: { initial: TrendRadarResult | null }) {
  const trends = initial?.trends ?? [];
  const scores = trends.map((t) => t.score);
  const minS = scores.length ? Math.min(...scores) : 0;
  const maxS = scores.length ? Math.max(...scores) : 100;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-(--notion-fg)/50">
          최근 24시간 · Gemini 요약
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-(--notion-fg)">트렌드 대시보드</h1>
        {initial?.generatedAt ? (
          <p className="text-xs text-(--notion-fg)/50">
            생성 시각 {new Date(initial.generatedAt).toLocaleString("ko-KR")}
          </p>
        ) : null}
      </header>

      {!initial || trends.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-(--notion-border) bg-(--notion-gray)/20 px-4 py-10 text-center text-sm text-(--notion-fg)/55">
          표시할 트렌드가 없습니다. 피드에 최근 항목이 있는지 확인하거나, 잠시 후 다시 불러오세요.
        </div>
      ) : (
        <>
          <section
            className="flex min-h-[140px] flex-wrap items-center justify-center gap-x-3 gap-y-4 rounded-2xl border border-(--notion-border) bg-(--notion-bg) px-4 py-8"
            aria-label="키워드 워드클라우드"
          >
            {[...trends]
              .sort((a, b) => b.score - a.score)
              .map((t) => (
                <span
                  key={t.keyword}
                  className="cursor-default select-none font-semibold text-(--notion-fg)/90 transition hover:text-(--focus-accent)"
                  style={{ fontSize: `${scoreFontPx(t.score, minS, maxS)}px` }}
                  title={t.summary}
                >
                  {t.keyword}
                </span>
              ))}
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-(--notion-fg)">상세</h2>
            <ul className="space-y-4">
              {[...trends]
                .sort((a, b) => b.score - a.score)
                .map((t) => (
                  <li
                    key={`detail-${t.keyword}`}
                    className="rounded-2xl border border-(--notion-border) bg-(--notion-gray)/15 px-4 py-4"
                  >
                    <TrendDetailCard item={t} />
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-(--notion-fg)/55">
        <Link
          href="/trends?refresh=1"
          className="rounded-full border border-(--notion-border) px-3 py-1.5 font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
        >
          트렌드 다시 계산
        </Link>
        <Link href="/" className="rounded-full border border-(--notion-border) px-3 py-1.5 font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)">
          피드로 돌아가기
        </Link>
        <span className="self-center">홈 상단의 트렌드 칩으로 피드를 필터할 수 있습니다.</span>
      </div>
    </div>
  );
}

function TrendDetailCard({ item }: { item: TrendRadarItem }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-(--notion-fg)">{item.keyword}</h3>
        <span className="text-[11px] font-medium text-(--notion-fg)/45">점수 {item.score}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-(--notion-fg)/75">{item.summary}</p>
      {item.sampleTitles?.length ? (
        <ul className="mt-3 space-y-1 border-t border-(--notion-border)/60 pt-3 text-[12px] text-(--notion-fg)/60">
          {item.sampleTitles.map((title) => (
            <li key={title} className="truncate">
              · {title}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
