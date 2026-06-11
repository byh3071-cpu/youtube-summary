import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RadioQueueItem } from "@/contexts/RadioQueueContext";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  getCurrentUserFromCookies: vi.fn(),
  getMutationTable: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/supabase-server", () => ({
  getMutationTable: mocks.getMutationTable,
}));
vi.mock("@/lib/supabase-server-cookies", () => ({
  getCurrentUserFromCookies: mocks.getCurrentUserFromCookies,
}));

import {
  savePlaylistAction,
  renamePlaylistAction,
  deletePlaylistAction,
} from "@/app/actions/playlists";

type QueryResult = { data: unknown; error: unknown };

function createInsertTable(result: QueryResult) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn((row: unknown) => {
    void row;
    return { select };
  });
  return { table: { insert }, insert };
}

function createMutationTable(result: QueryResult) {
  const eqCalls: [string, unknown][] = [];
  const chain: Record<string, unknown> = {};
  const select = vi.fn(async () => result);
  const eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return chain;
  });
  Object.assign(chain, { eq, select });
  const update = vi.fn(() => chain);
  const del = vi.fn(() => chain);
  return { table: { update, delete: del }, update, delete: del, eqCalls };
}

const ITEMS = [{ videoId: "v1", title: "영상 1" }] as unknown as RadioQueueItem[];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cookies.mockResolvedValue({ getAll: () => [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("savePlaylistAction", () => {
  it("비로그인 사용자는 저장할 수 없다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);
    const result = await savePlaylistAction(ITEMS, "제목");
    expect("error" in result && result.error).toContain("로그인");
    expect(mocks.getMutationTable).not.toHaveBeenCalled();
  });

  it("로그인 사용자의 user_id로만 저장된다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    const { table, insert } = createInsertTable({ data: { id: "pl-1" }, error: null });
    mocks.getMutationTable.mockReturnValue(table);

    const result = await savePlaylistAction(ITEMS, "제목");

    expect(result).toEqual({ id: "pl-1" });
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0] as { user_id: string | null };
    expect(row.user_id).toBe("user-a");
  });

  it("빈 items면 저장하지 않는다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    const result = await savePlaylistAction([] as RadioQueueItem[], "제목");
    expect("error" in result && result.error).toContain("저장할 항목");
    expect(mocks.getMutationTable).not.toHaveBeenCalled();
  });
});

describe("renamePlaylistAction", () => {
  it("비로그인 사용자는 이름을 변경할 수 없다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);
    const result = await renamePlaylistAction("pl-1", "새 제목");
    expect("error" in result && result.error).toContain("로그인");
    expect(mocks.getMutationTable).not.toHaveBeenCalled();
  });

  it("update에 항상 현재 사용자 user_id 조건이 포함된다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    const { table, eqCalls } = createMutationTable({ data: [{ id: "pl-1" }], error: null });
    mocks.getMutationTable.mockReturnValue(table);

    const result = await renamePlaylistAction("pl-1", "새 제목");

    expect(result).toEqual({ ok: true });
    expect(eqCalls).toContainEqual(["id", "pl-1"]);
    expect(eqCalls).toContainEqual(["user_id", "user-a"]);
  });

  it("타 사용자 소유(매칭 0건)면 일반 실패 메시지를 반환한다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    const { table } = createMutationTable({ data: [], error: null });
    mocks.getMutationTable.mockReturnValue(table);

    const result = await renamePlaylistAction("someone-elses-id", "새 제목");

    expect("error" in result && result.error).toBe("플레이리스트 이름 변경에 실패했습니다.");
  });
});

describe("deletePlaylistAction", () => {
  it("비로그인 사용자는 삭제할 수 없다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue(null);
    const result = await deletePlaylistAction("pl-1");
    expect("error" in result && result.error).toContain("로그인");
    expect(mocks.getMutationTable).not.toHaveBeenCalled();
  });

  it("delete에 항상 현재 사용자 user_id 조건이 포함된다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    const { table, eqCalls } = createMutationTable({ data: [{ id: "pl-1" }], error: null });
    mocks.getMutationTable.mockReturnValue(table);

    const result = await deletePlaylistAction("pl-1");

    expect(result).toEqual({ ok: true });
    expect(eqCalls).toContainEqual(["id", "pl-1"]);
    expect(eqCalls).toContainEqual(["user_id", "user-a"]);
  });

  it("타 사용자 소유(매칭 0건)면 일반 실패 메시지를 반환한다", async () => {
    mocks.getCurrentUserFromCookies.mockResolvedValue({ id: "user-a" });
    const { table } = createMutationTable({ data: [], error: null });
    mocks.getMutationTable.mockReturnValue(table);

    const result = await deletePlaylistAction("someone-elses-id");

    expect("error" in result && result.error).toBe("플레이리스트 삭제에 실패했습니다.");
  });
});
