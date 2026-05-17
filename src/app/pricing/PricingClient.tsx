"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export default function PricingClient({
  isLoggedIn,
  currentPlan,
}: {
  isLoggedIn: boolean;
  currentPlan: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async () => {
    if (!isLoggedIn) {
      window.location.href = "/login?next=/pricing";
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "결제 세션 생성에 실패했습니다.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("결제 URL을 받지 못했습니다.");
    } catch {
      setError("요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const isPro = currentPlan === "pro" || currentPlan === "owner";

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="rounded-2xl border border-(--notion-border) bg-(--notion-bg) p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold">Free</h2>
        <p className="mb-4 text-2xl font-bold">₩0<span className="text-sm font-normal text-(--notion-fg)/60">/월</span></p>
        <ul className="mb-6 space-y-2 text-sm text-(--notion-fg)/80">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-500" />
            피드·북마크·라디오
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-500" />
            요약 일 5회, 인사이트 일 3회
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-500" />
            브리핑 주 1회
          </li>
        </ul>
        {currentPlan === "free" && (
          <div className="rounded-lg bg-(--notion-gray)/50 px-3 py-2 text-xs text-(--notion-fg)/60">
            현재 플랜
          </div>
        )}
      </div>

      <div className="rounded-2xl border-2 border-(--notion-fg)/20 bg-(--notion-bg) p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-semibold">Pro</h2>
        <p className="mb-4 text-2xl font-bold">₩9,900<span className="text-sm font-normal text-(--notion-fg)/60">/월</span></p>
        <ul className="mb-6 space-y-2 text-sm text-(--notion-fg)/80">
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-500" />
            요약·인사이트·브리핑 무제한
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-500" />
            목표 기반 추천 무제한
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-green-500" />
            (추후) 챕터·고급 기능
          </li>
        </ul>
        {isPro && (
          <div className="rounded-lg bg-green-500/15 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-300">
            {currentPlan === "owner" ? "운영자 계정" : "Pro 구독 중"}
          </div>
        )}
        {!isPro && (
          <>
            {error && <p className="mb-2 text-sm text-red-500">{error}</p>}
            <button
              type="button"
              onClick={handleSubscribe}
              disabled={loading}
              className="cta-primary w-full rounded-full bg-(--notion-fg) py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-70"
            >
              {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "Pro 구독하기"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
