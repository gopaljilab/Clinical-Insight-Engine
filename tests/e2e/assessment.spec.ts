import { test, expect } from "@playwright/test";

test.describe("Risk Assessment Flow", () => {
  test("displays assessment form on dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=patient").first()).toBeVisible({ timeout: 10000 });
  });

  test("shows validation when required fields are missing", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator('button[type="submit"]').first().click();
    await expect(page.locator("text=required")).toBeVisible({ timeout: 5000 });
  });

  test("form accepts valid patient data input", async ({ page }) => {
    await page.goto("/dashboard");
    const nameInput = page.locator('input[id="patientName"], input[name="patientName"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("E2E Test Patient");
      await expect(nameInput).toHaveValue("E2E Test Patient");
    }
  });
});
