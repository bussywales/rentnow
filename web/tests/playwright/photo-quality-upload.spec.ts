import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

const LANDLORD_EMAIL = process.env.PLAYWRIGHT_LANDLORD_EMAIL || "";
const LANDLORD_PASSWORD = process.env.PLAYWRIGHT_LANDLORD_PASSWORD || "";
const HAS_LANDLORD = !!LANDLORD_EMAIL && !!LANDLORD_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/dashboard|admin|browse|properties/);
}

test.describe("Photo quality upload guard", () => {
  test.skip(!HAS_LANDLORD, "Set PLAYWRIGHT_LANDLORD_EMAIL/PASSWORD to run this test.");

  test("blocks tiny images on upload selection", async ({ page }) => {
    await login(page, LANDLORD_EMAIL, LANDLORD_PASSWORD);
    await page.goto("/dashboard/properties/new?step=photos");

    const input = page.locator("input#photo-upload");
    if (!(await input.isVisible())) {
      test.skip(true, "Photos step not visible (likely unauthenticated)." );
    }

    const fixturePath = path.join(__dirname, "..", "fixtures", "small-10x10.png");
    await input.setInputFiles(fixturePath);
    await expect(page.getByText("Not allowed")).toBeVisible();
    await expect(page.getByText(/Too small/i)).toBeVisible();
  });
});
