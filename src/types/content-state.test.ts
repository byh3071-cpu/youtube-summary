import { describe, it, expect } from "vitest";
import {
  contentIdForItem,
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

/**
 * content_id 키 계약 회귀 테스트(#6).
 * RSS 카드의 ContentStateControl(저장)·FeedList(조회)·isItemVisibleUnderStateFilter(필터)는
 * 모두 contentIdForItem 이 만드는 동일 키를 써야 한다. 이 스킴이 바뀌면 RSS 상태 저장이
 * 필터/조회와 어긋나 다시 "처리 대기에서 RSS 전멸" 류 버그가 생긴다.
 */
describe("contentIdForItem (키 계약)", () => {
  it("YouTube는 videoId를 그대로 키로 쓴다", () => {
    expect(contentIdForItem(ytItem("abc123"))).toBe("abc123");
  });

  it("RSS는 rss:<link> 접두 키를 만든다", () => {
    expect(contentIdForItem(rssItem("https://blog.example.com/p1"))).toBe(
      "rss:https://blog.example.com/p1",
    );
  });

  it("link 없는 RSS·id 없는 항목은 undefined(상태 저장 불가)", () => {
    expect(contentIdForItem({ source: "RSS", id: "", link: "" })).toBeUndefined();
    expect(contentIdForItem({ source: "YouTube", id: "", link: "" })).toBeUndefined();
  });

  it("RSS link 앞뒤 공백·개행을 정규화해 저장(trim)·조회 키를 일치시킨다", () => {
    // 일부 RSS 피드가 <link>에 개행/공백을 섞어 보낸다. 정규화 없으면 저장키(action이 trim)와
    // 조회/필터 키(contentIdForItem 원본)가 어긋나 상태가 반영 안 됨.
    expect(contentIdForItem(rssItem("\n https://blog.example.com/p1 \n"))).toBe(
      "rss:https://blog.example.com/p1",
    );
  });

  it("공백뿐인 RSS link·공백뿐인 YouTube id는 undefined", () => {
    expect(contentIdForItem(rssItem("   "))).toBeUndefined();
    expect(contentIdForItem(ytItem("   "))).toBeUndefined();
  });
});
