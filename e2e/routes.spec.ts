import { test, expect } from "@playwright/test";

// 익명 사용자 기준 주요 라우트 응답·핵심 heading·수평 오버플로 회귀.
// 외부 API 성공에 의존하지 않는 정적 요소만 검증한다.
const ROUTES: { path: string; assert: (page: import("@playwright/test").Page) => Promise<void> }[] = [
  {
    path: "/trends",
    assert: async (page) => {
      await expect(page.getByRole("heading", { name: "트렌드 대시보드" })).toBeVisible();
    },
  },
  {
    path: "/landing",
    assert: async (page) => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
  },
  {
    path: "/login",
    assert: async (page) => {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    },
  },
  {
    path: "/pricing",
    assert: async (page) => {
      await expect(page.getByRole("heading", { name: "요금제" })).toBeVisible();
    },
  },
  {
    path: "/bookmarks",
    assert: async (page) => {
      await expect(page.getByRole("heading", { name: "북마크" })).toBeVisible();
    },
  },
  {
    path: "/playlists",
    assert: async (page) => {
      await expect(page.getByRole("heading", { name: "내 플레이리스트" })).toBeVisible();
    },
  },
  {
    path: "/teams",
    assert: async (page) => {
      await expect(page.getByText("로그인이 필요합니다.")).toBeVisible();
    },
  },
  {
    path: "/privacy",
    assert: async (page) => {
      await expect(page.getByRole("heading", { name: "개인정보처리방침" })).toBeVisible();
    },
  },
  {
    path: "/terms",
    assert: async (page) => {
      await expect(page.getByRole("heading", { name: "이용약관" })).toBeVisible();
    },
  },
];

test.describe("routes", () => {
  for (const route of ROUTES) {
    test(`${route.path} renders without overflow`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response, "navigation should return a response").not.toBeNull();
      expect(response!.status(), `${route.path} status`).toBeLessThan(400);

      await route.assert(page);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${route.path} horizontal overflow`).toBeLessThanOrEqual(0);
    });
  }
});
