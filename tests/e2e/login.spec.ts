import { test, expect } from "@playwright/test";

test.describe("Clinician Login Flow", () => {
  test("displays login page with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows validation error on empty form submission", async ({ page }) => {
    await page.goto("/login");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("text=required")).toBeVisible({ timeout: 5000 });
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("nonexistent@test.com");
    await page.locator('input[type="password"]').fill("wrongpassword123");
    await page.locator('button[type="submit"]').click();
    await expect(page.locator("text=Invalid")).toBeVisible({ timeout: 10000 });
  });

  test("navigates to forgot password page", async ({ page }) => {
    await page.goto("/login");
    await page.locator("text=Forgot").click();
    await expect(page).toHaveURL(/forgot-password/);
  });
});
