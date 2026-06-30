import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Keyboard Navigation & Accessibility", () => {
  test("skip-to-content link exists and is first focusable element", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveClass(/sr-only/);
    await skipLink.focus();
    await expect(skipLink).not.toHaveClass(/sr-only/);
  });

  test("login form fields are reachable in logical tab order", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.focus();
    await expect(emailInput).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(passwordInput).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(submitButton).toBeFocused();
  });

  test("all interactive elements have visible focus indicators", async ({ page }) => {
    await page.goto("/login");
    const buttons = page.locator("button, a, input, select, textarea");
    const count = await buttons.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      const el = buttons.nth(i);
      await el.focus();
      const outline = await el.evaluate((node) => {
        const style = window.getComputedStyle(node);
        return style.outlineColor !== "rgba(0, 0, 0, 0)" && style.outlineWidth !== "0px";
      });
      expect(outline).toBe(true);
    }
  });

  test("assessment search bar supports arrow key navigation", async ({ page }) => {
    await page.goto("/");
    const searchInput = page.locator("#assessment-search");
    await searchInput.fill("Jo");
    await page.waitForTimeout(500);
    const options = page.locator('[role="listbox"] [role="option"]');
    await expect(options.first()).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("ArrowDown");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowUp");
    await expect(options.first()).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Escape");
    await expect(options.first()).not.toBeVisible();
  });

  test("passes axe-core WCAG audit on landing page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("passes axe-core WCAG audit on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
