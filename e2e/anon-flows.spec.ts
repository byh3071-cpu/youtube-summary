import { test, expect, type Page } from "@playwright/test";

// 홈 피드는 항목이 많아 hydration이 늦다 — 그 전 클릭은 유실되므로
// hydration 이후에만 렌더되는 My Focus 편집/닫기 버튼을 마커로 기다린다.
async function gotoHydratedHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^(편집|닫기|접기)$/ })).toBeVisible({ timeout: 30000 });
}

test.describe("anonymous flows", () => {
  test("playlist save API rejects anonymous requests with 401", async ({ request }) => {
    const res = await request.post("/api/playlists/save", {
      data: { items: [{ videoId: "v1", title: "테스트" }], title: "익명 시도" },
    });
    expect(res.status()).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("로그인");
  });

  test("anonymous /playlists shows login CTA and no playlist rows", async ({ page }) => {
    await page.goto("/playlists");
    await expect(page.getByRole("heading", { name: "내 플레이리스트" })).toBeVisible();
    // Supabase 미설정 환경(CI 등)은 설정 안내, 설정 환경은 로그인 CTA — 어느 쪽이든 익명에게 목록은 비노출.
    const loginCta = page.getByRole("link", { name: "로그인하러 가기" });
    const unconfigured = page.getByText("Supabase 연결이 설정되지 않았습니다", { exact: false });
    await expect(loginCta.or(unconfigured)).toBeVisible();
    // 익명(user_id IS NULL) 행 노출 회귀 방지: 목록 로드 버튼이 존재하지 않아야 한다.
    await expect(page.getByRole("button", { name: "이 플레이리스트로 듣기" })).toHaveCount(0);
  });

  test("keyword filter add/remove persists across reload via localStorage", async ({ page }) => {
    const keyword = `e2e키워드${Date.now() % 10000}`;
    await gotoHydratedHome(page);

    await page.getByRole("button", { name: "필터 패널 열기" }).click();
    await page.getByRole("button", { name: "키워드 추가" }).click();
    await page.getByLabel("관심 키워드 입력").fill(keyword);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText(`# ${keyword}`)).toBeVisible();

    // 새로고침 후에도 localStorage로 유지
    await page.reload();
    await expect(page.getByRole("button", { name: /^(편집|닫기|접기)$/ })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "필터 패널 열기" }).click();
    await expect(page.getByText(`# ${keyword}`)).toBeVisible();

    // 제거
    await page.getByRole("button", { name: `${keyword} 필터 제거` }).click();
    await expect(page.getByText(`# ${keyword}`)).toBeHidden();
  });

  test("view switcher updates URL query", async ({ page }) => {
    await gotoHydratedHome(page);

    // App Router는 서버 렌더 완료 후 URL을 커밋한다 — dev 서버에서 느릴 수 있어 타임아웃 여유.
    await page.getByRole("button", { name: "유튜브", exact: true }).click();
    await expect(page).toHaveURL(/view=youtube/, { timeout: 30000 });

    await page.getByRole("button", { name: "RSS", exact: true }).click();
    await expect(page).toHaveURL(/view=rss/, { timeout: 30000 });

    await page.getByRole("button", { name: "전체(최신순)" }).click();
    await expect(page).not.toHaveURL(/view=/, { timeout: 30000 });
  });

  test("Q&A dialog has accessible name and closes with Escape", async ({ page }) => {
    await gotoHydratedHome(page);
    await page.getByRole("button", { name: "피드 Q&A 열기" }).click();

    const dialog = page.getByRole("dialog", { name: "피드 Q&A" });
    await expect(dialog).toBeVisible();
    await expect(page.locator("#feed-qa-input")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("sidebar theme toggle switches dark mode on desktop", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("aside").getByRole("button", { name: "테마 전환" });
    await expect(toggle).toBeVisible();

    const wasDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(!wasDark);

    await toggle.click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(wasDark);
  });
});
