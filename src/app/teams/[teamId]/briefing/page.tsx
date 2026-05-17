import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUserFromCookies } from "@/lib/supabase-server-cookies";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { rankFeedByGoalsAction } from "@/app/actions/summarize";
import Image from "next/image";

export default async function TeamBriefingPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const cookieStore = await cookies();
  const user = await getCurrentUserFromCookies(cookieStore);
  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">로그인이 필요합니다.</p>
        <Link href={`/login?next=/teams/${teamId}/briefing`} className="mt-4 inline-block text-sm underline">
          로그인
        </Link>
      </main>
    );
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return <main className="mx-auto max-w-2xl px-4 py-12"><p className="text-(--notion-fg)/70">서버 설정 오류</p></main>;
  }

  const { data: member } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("team_id", teamId)
    .eq("user_id", user.id)
    .single();

  if (!member) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">팀 접근 권한이 없습니다.</p>
        <Link href="/teams" className="mt-4 inline-block text-sm underline">팀 목록</Link>
      </main>
    );
  }

  const { data: team } = await supabase.from("teams").select("name, goal_text").eq("id", teamId).single();
  const goalText = (team as { goal_text?: string | null } | null)?.goal_text?.trim();
  if (!goalText) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-(--notion-fg)/70">팀 목표가 설정되지 않았습니다. 팀 설정에서 목표를 입력해 주세요.</p>
        <Link href="/teams" className="mt-4 inline-block text-sm underline">팀 목록</Link>
      </main>
    );
  }

  const result = await rankFeedByGoalsAction(goalText, 10);
  const ranked = "ranked" in result && Array.isArray(result.ranked) ? result.ranked : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/teams" className="mb-6 inline-block text-sm font-medium text-(--notion-fg)/80 hover:text-(--notion-fg)">
        ← 팀 목록
      </Link>
      <h1 className="mb-2 text-2xl font-bold">{(team as { name?: string } | null)?.name ?? "팀"} 브리핑</h1>
      <p className="mb-6 text-sm text-(--notion-fg)/60">팀 목표에 맞춘 오늘의 추천 영상</p>

      {ranked.length === 0 ? (
        <p className="text-(--notion-fg)/70">추천할 영상을 찾지 못했습니다.</p>
      ) : (
        <ul className="space-y-4">
          {ranked.map((r) => (
            <li key={r.item.id ?? r.item.link} className="flex gap-3 rounded-lg border border-(--notion-border) bg-(--notion-bg) p-3">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-md bg-(--notion-gray)">
                {r.item.thumbnail && (
                  <Image src={r.item.thumbnail} alt="" width={128} height={80} className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug line-clamp-2">{r.item.title}</p>
                <p className="mt-1 text-xs text-(--notion-fg)/60">{r.why}</p>
                <a
                  href={r.item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-(--notion-fg)/80 hover:underline"
                >
                  보기 →
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
