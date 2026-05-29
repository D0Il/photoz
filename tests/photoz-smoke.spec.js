import { test, expect } from "@playwright/test";

test("PHOTOZ shell renders without duplicate chrome", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".bottomDock, nav.bottomDock")).toBeVisible();
  await expect(page.locator("text=PHOTO ALBUMS")).toHaveCount(0);
  await expect(page.locator("text=YEARS")).toHaveCount(0);
  await expect(page.locator("text=MONTHS")).toHaveCount(0);
  await expect(page.locator("text=ERAS")).toHaveCount(0);
  expect(errors).toEqual([]);
});
