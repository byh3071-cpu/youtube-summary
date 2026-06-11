import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSupabaseClient: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  getServerSupabaseClient: mocks.getServerSupabaseClient,
}));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
}));

import { getPlaylistsForCurrentUser } from "@/lib/playlists-server";

type QueryResult = { data: unknown; error: unknown };

function createSupabase(result: QueryResult) {
  const order = vi.fn(async () => result);
  const eq = vi.fn(() => ({ order }));
  const is = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq, is }));
  const from = vi.fn(() => ({ select }));
  return { client: { from }, from, eq, is };
}

const cookieStore = { getAll: () => [] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getPlaylistsForCurrentUser", () => {
  it("Supabase 미설정이면 unconfigured를 반환한다", async () => {
    mocks.getServerSupabaseClient.mockReturnValue(null);
    const result = await getPlaylistsForCurrentUser(cookieStore);
    expect(result.kind).toBe("unconfigured");
  });

  it("비로그인이면 DB를 조회하지 않는다 (익명 행 비노출 회귀)", async () => {
    const { client, from } = createSupabase({ data: [], error: null });
    mocks.getServerSupabaseClient.mockReturnValue(client);
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);

    const result = await getPlaylistsForCurrentUser(cookieStore);

    expect(result.kind).toBe("anonymous");
    expect(from).not.toHaveBeenCalled();
  });

  it("로그인 사용자는 본인 user_id 조건으로만 조회한다", async () => {
    const rows = [
      { id: "pl-1", title: "내 목록", items: [{ videoId: "v1" }], created_at: "2026-06-11" },
      { id: "pl-2", title: null, items: null, created_at: "2026-06-10" },
    ];
    const { client, eq, is } = createSupabase({ data: rows, error: null });
    mocks.getServerSupabaseClient.mockReturnValue(client);
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });

    const result = await getPlaylistsForCurrentUser(cookieStore);

    expect(eq).toHaveBeenCalledWith("user_id", "user-a");
    // user_id IS NULL 조회 경로가 다시 생기면 안 된다.
    expect(is).not.toHaveBeenCalled();
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.playlists).toHaveLength(2);
      expect(result.playlists[1].items).toEqual([]);
    }
  });

  it("조회 오류면 error를 반환한다", async () => {
    const { client } = createSupabase({ data: null, error: { message: "boom" } });
    mocks.getServerSupabaseClient.mockReturnValue(client);
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });

    const result = await getPlaylistsForCurrentUser(cookieStore);

    expect(result.kind).toBe("error");
  });
});
