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
});
