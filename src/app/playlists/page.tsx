import Link from "next/link";
import { cookies } from "next/headers";
import { getPlaylistsForCurrentUser } from "@/lib/playlists-server";
import PlaylistsClient from "./PlaylistsClient";
import FloatingRadioPlayer from "@/components/player/FloatingRadioPlayer";

function BackLink() {
  return (
    <Link
      href="/"
      className="mb-4 inline-flex items-center gap-1 rounded-full border border-(--notion-border) bg-(--notion-bg) px-3 py-1 text-xs font-medium text-(--notion-fg)/70 hover:bg-(--notion-hover)"
    >
      <span>← 피드로 돌아가기</span>
    </Link>
  );
}

export default async function MyPlaylistsPage() {
  const cookieStore = await cookies();
  const result = await getPlaylistsForCurrentUser(cookieStore);

  if (result.kind === "unconfigured") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackLink />
        <h1 className="mb-4 text-2xl font-bold text-(--notion-fg)">내 플레이리스트</h1>
        <p className="text-sm text-(--notion-fg)/65">
          Supabase 연결이 설정되지 않았습니다. .env.local에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정해 주세요.
        </p>
      </main>
    );
  }

  if (result.kind === "anonymous") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackLink />
        <h1 className="mb-4 text-2xl font-bold text-(--notion-fg)">내 플레이리스트</h1>
        <p className="mb-4 text-sm text-(--notion-fg)/65">
          플레이리스트는 로그인한 계정에만 저장되고 표시됩니다. 로그인 후 재생 대기열을
          플레이리스트로 저장하고 어디서든 다시 들어보세요.
        </p>
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center rounded-full bg-(--notion-fg) px-5 py-2 text-sm font-semibold text-(--notion-bg) hover:bg-(--notion-fg)/90"
        >
          로그인하러 가기
        </Link>
      </main>
    );
  }

  if (result.kind === "error") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <BackLink />
        <h1 className="mb-4 text-2xl font-bold text-(--notion-fg)">내 플레이리스트</h1>
        <p className="text-sm text-(--notion-fg)/65">플레이리스트를 불러오는 중 오류가 발생했습니다.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
      <BackLink />
      <h1 className="mb-2 text-2xl font-bold text-(--notion-fg)">내 플레이리스트</h1>
      <p className="mb-6 text-sm text-(--notion-fg)/65">
        재생 대기열에서 저장한 여러 영상을 한 세트로 묶어 둔 목록입니다. 집중해서 듣고 싶은 테마나 연달아 듣고 싶은 강의 묶음을 만들어 두세요.
      </p>
      <PlaylistsClient playlists={result.playlists} />
      <div className="fixed inset-x-0 bottom-0 z-40">
        <FloatingRadioPlayer />
      </div>
    </main>
  );
}
