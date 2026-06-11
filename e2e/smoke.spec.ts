import { test, expect } from "@playwright/test";

test.describe("smoke", () => {
  test("home loads main landmark", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#main")).toBeVisible();
  });

  test("trends dashboard heading", async ({ page }) => {
    await page.goto("/trends");
    await expect(page.getByRole("heading", { name: "트렌드 대시보드" })).toBeVisible();
  });

  test("anonymous visit does not trigger expected 401 noise", async ({ page }) => {
    const unauthorized: string[] = [];
    page.on("response", (res) => {
      if (res.url().includes("/api/custom-sources") && res.status() === 401) {
        unauthorized.push(res.url());
      }
    });
    await page.goto("/");
    await page.waitForTimeout(1500);
    expect(unauthorized).toHaveLength(0);
  });
});
