import { test, expect } from "@playwright/test";

test.describe("Assessment History Flow", () => {
  test("navigates to history page", async ({ page }) => {
    await page.goto("/history");
    await expect(page).toHaveURL(/history/);
  });

  test("displays filter controls on history page", async ({ page }) => {
    await page.goto("/history");
    await expect(page.locator("text=search").first()).toBeVisible({ timeout: 10000 });
  });
});
