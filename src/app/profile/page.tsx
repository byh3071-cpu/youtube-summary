import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getPlanForUser } from "@/lib/plan";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import LogoutButton from "./LogoutButton";
import AccountDataExport from "./AccountDataExport";

export const metadata: Metadata = {
  title: "내 계정 | Focus Feed",
};

const planLabel: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  owner: "Owner",
};

const planBadgeColor: Record<string, string> = {
  free: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
  pro: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  owner: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
};

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) redirect("/");

  const plan = (await getPlanForUser(cookieStore)) ?? "free";

  return (
    <main className="min-h-screen bg-(--notion-bg) text-(--notion-fg)">
      <div className="mx-auto max-w-xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="rounded-full border border-(--notion-border) bg-(--notion-bg) px-4 py-2 text-sm font-medium text-(--notion-fg)/80 hover:bg-(--notion-hover)"
          >
            &larr; 피드로
          </Link>
        </div>

        <h1 className="mb-6 text-2xl font-bold">내 계정</h1>

        {/* Account Card */}
        <div className="rounded-xl border border-(--notion-border) bg-(--notion-bg) p-6 shadow-sm">
          {/* Email */}
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-(--notion-fg)/50">
              이메일
            </p>
            <p className="text-sm">{user.email}</p>
          </div>

          {/* Plan */}
          <div className="mb-6">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-(--notion-fg)/50">
              현재 플랜
            </p>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${planBadgeColor[plan] ?? planBadgeColor.free}`}
            >
              {planLabel[plan] ?? "Free"}
            </span>
          </div>

          {/* Upgrade CTA for free users */}
          {plan === "free" && (
            <Link
              href="/pricing"
              className="mb-6 block rounded-lg bg-(--notion-fg) px-4 py-2.5 text-center text-sm font-medium text-(--notion-bg) hover:opacity-90"
            >
              Pro로 업그레이드
            </Link>
          )}

          {/* Divider */}
          <hr className="my-4 border-(--notion-border)" />

          {/* Links */}
          <div className="flex gap-4 text-sm text-(--notion-fg)/60">
            <Link href="/privacy" className="hover:text-(--notion-fg) hover:underline">
              개인정보처리방침
            </Link>
            <Link href="/terms" className="hover:text-(--notion-fg) hover:underline">
              이용약관
            </Link>
          </div>

          {/* Divider */}
          <hr className="my-4 border-(--notion-border)" />

          {/* 데이터 내보내기 */}
          <div className="mb-4">
            <AccountDataExport />
          </div>

          {/* Logout */}
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
