import { test, expect } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

if (!email || !password) {
  test.skip(true, "Admin config status e2e disabled (missing E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)");
}

test.describe("Admin config status", () => {
  test("shows location configuration card", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel("Email address").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL(/dashboard|admin/);

    await page.goto("/admin/settings");
    await expect(page.getByText("Location configuration")).toBeVisible();
    await expect(page.getByText("MAPBOX_TOKEN")).toBeVisible();
  });
});
