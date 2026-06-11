import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  savePlaylistAction: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
}));
vi.mock("@/app/actions/playlists", () => ({
  savePlaylistAction: mocks.savePlaylistAction,
}));

import { POST } from "./route";

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const ITEMS = [{ videoId: "v1", title: "영상 1" }];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
});

describe("POST /api/playlists/save", () => {
  it("비로그인 요청은 401을 반환하고 저장하지 않는다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);

    const res = await POST(makeRequest({ items: ITEMS, title: "제목" }));

    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("로그인");
    expect(mocks.savePlaylistAction).not.toHaveBeenCalled();
  });

  it("로그인 + 빈 items 요청은 400을 반환한다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });

    const res = await POST(makeRequest({ items: [], title: "제목" }));

    expect(res.status).toBe(400);
    expect(mocks.savePlaylistAction).not.toHaveBeenCalled();
  });

  it("로그인 사용자 저장은 200과 id를 반환한다 (userId는 전달하지 않음)", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    mocks.savePlaylistAction.mockResolvedValue({ id: "pl-1" });

    const res = await POST(makeRequest({ items: ITEMS, title: "제목" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { id?: string };
    expect(body.id).toBe("pl-1");
    // 클라이언트/라우트가 임의 userId를 액션에 넘기지 않는다 — 액션이 세션에서 직접 확인.
    expect(mocks.savePlaylistAction).toHaveBeenCalledWith(ITEMS, "제목");
  });
});
