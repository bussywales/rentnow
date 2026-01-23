import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("shows bucket-not-configured message when video bucket missing (skip-safe)", async ({ page, context }) => {
  test.skip(!email || !password, "E2E creds missing; skipping video bucket smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/dashboard/properties/new");
  await page.getByLabel(/listing title/i).fill("Video bucket missing smoke");
  await page.getByLabel(/city/i).fill("Test City");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");

  // Wait for auto-save (property creation) to complete.
  await page.waitForResponse((resp) => resp.url().endsWith("/api/properties") && resp.request().method() === "POST");

  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/details/);
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/photos/);

  await context.route("**/api/properties/**/video", async (route) => {
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        error:
          "Video storage isn't configured yet. Ask an admin to create the 'property-videos' bucket in Supabase Storage.",
        code: "STORAGE_BUCKET_NOT_FOUND",
      }),
    });
  });

  const videoInput = page.locator('input[type="file"][accept*="video"]');
  await videoInput.setInputFiles({
    name: "sample.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("00"),
  });

  await expect(
    page.getByText("Video storage isn't configured yet. Ask an admin to create the 'property-videos' bucket in Supabase Storage.")
  ).toBeVisible();
});
