import { describe, it, expect } from "vitest";
import {
  isItemVisibleUnderStateFilter,
  type ContentState,
  type StateFilter,
} from "./content-state";
import type { FeedItem } from "./feed";

/**
 * 상태필터 가시성 헬퍼 회귀 테스트.
 * 핵심 버그(HANDOFF §2-3): RSS 등 상태 없는 항목이 "처리 대기(queued)" 필터에서
 * 전멸하던 문제. 상태 미존재 = 아직 처리 안 됨 = 대기로 간주해 노출돼야 한다.
 */

function ytItem(id: string): Pick<FeedItem, "source" | "id" | "link"> {
  return { source: "YouTube", id, link: `https://youtu.be/${id}` };
}

function rssItem(link: string): Pick<FeedItem, "source" | "id" | "link"> {
  return { source: "RSS", id: "", link };
}

function states(
  entries: Record<string, ContentState>,
): Record<string, { state: ContentState } | undefined> {
  const out: Record<string, { state: ContentState } | undefined> = {};
  for (const k in entries) out[k] = { state: entries[k] };
  return out;
}

const filters: StateFilter[] = ["all", "queued", "dismissed"];

describe("isItemVisibleUnderStateFilter", () => {
  describe("상태 없는 항목(RSS/미선별)", () => {
    it("RSS 항목(상태 없음)은 queued 필터에서 보인다 (핵심 버그)", () => {
      const item = rssItem("https://blog.example.com/post-1");
      expect(isItemVisibleUnderStateFilter(item, {}, "queued")).toBe(true);
    });

    it("RSS 항목은 all 필터에서 보인다", () => {
      const item = rssItem("https://blog.example.com/post-1");
      expect(isItemVisibleUnderStateFilter(item, {}, "all")).toBe(true);
    });

    it("RSS 항목은 dismissed 필터에서는 숨긴다", () => {
      const item = rssItem("https://blog.example.com/post-1");
      expect(isItemVisibleUnderStateFilter(item, {}, "dismissed")).toBe(false);
    });

    it("상태 없는 YouTube 항목도 queued 필터에서 보인다", () => {
      const item = ytItem("vid-none");
      expect(isItemVisibleUnderStateFilter(item, {}, "queued")).toBe(true);
    });
  });

  describe("queued 상태 항목", () => {
    const item = ytItem("vid-q");
    const cs = states({ "vid-q": "queued" });
    it("queued 필터에서 보인다", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "queued")).toBe(true);
    });
    it("all 필터에서 보인다", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "all")).toBe(true);
    });
    it("dismissed 필터에서는 숨긴다", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "dismissed")).toBe(false);
    });
  });

  describe("dismissed 상태 항목", () => {
    const item = ytItem("vid-d");
    const cs = states({ "vid-d": "dismissed" });
    it("dismissed 필터에서만 보인다", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "dismissed")).toBe(true);
    });
    it("all 필터에서는 숨긴다 (제외 항목은 기본 숨김)", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "all")).toBe(false);
    });
    it("queued 필터에서는 숨긴다", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "queued")).toBe(false);
    });
  });

  describe("다른 상태 항목(reviewed 등)", () => {
    const item = ytItem("vid-r");
    const cs = states({ "vid-r": "reviewed" });
    it("all 필터에서 보인다 (dismissed만 숨김)", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "all")).toBe(true);
    });
    it("queued 필터에서는 숨긴다 (명시적 다른 상태)", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "queued")).toBe(false);
    });
    it("dismissed 필터에서는 숨긴다", () => {
      expect(isItemVisibleUnderStateFilter(item, cs, "dismissed")).toBe(false);
    });
  });

  describe("content_id를 만들 수 없는 항목", () => {
    it("link 없는 RSS 항목은 상태 없음으로 취급돼 queued 필터에서 보인다", () => {
      const item = { source: "RSS", id: "", link: "" } as Pick<
        FeedItem,
        "source" | "id" | "link"
      >;
      expect(isItemVisibleUnderStateFilter(item, {}, "queued")).toBe(true);
    });
  });

  it("모든 필터 값에 대해 boolean을 반환한다", () => {
    const item = ytItem("vid-x");
    for (const f of filters) {
      expect(typeof isItemVisibleUnderStateFilter(item, {}, f)).toBe("boolean");
    }
  });
});
