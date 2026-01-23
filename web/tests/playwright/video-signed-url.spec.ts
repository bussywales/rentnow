import { test, expect } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test("video uses signed URL and refreshes on error (skip-safe)", async ({ page, context }) => {
  test.skip(!email || !password, "E2E creds missing; skipping signed video smoke.");

  await page.goto("/auth/login");
  await page.getByLabel(/email/i).fill(email!);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL(/dashboard/);

  // Start a new listing and reach Photos step.
  await page.goto("/dashboard/properties/new");
  await page.getByLabel(/listing title/i).fill("Signed video smoke");
  await page.getByLabel(/city/i).fill("Test City");
  await page.getByLabel(/price/i).fill("1000");
  await page.getByLabel(/bedrooms/i).fill("1");
  await page.getByLabel(/bathrooms/i).fill("1");
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/details/);
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page).toHaveURL(/photos/);

  // Mock the signed upload + commit + signed read endpoints.
  await context.route("**/api/properties/**/video/init", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        bucket: "property-videos",
        path: "mock-prop/video.mp4",
        signedUrl: "https://upload.example.com/video.mp4",
        token: "token",
      }),
    });
  });

  await context.route("https://upload.example.com/**", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });

  await context.route("**/api/properties/**/video/commit", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ storage_path: "mock-prop/video.mp4" }),
    });
  });

  let signedUrlCalls = 0;
  await context.route("**/api/properties/**/video/url", async (route) => {
    signedUrlCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        url: `https://signed.example.com/video-${signedUrlCalls}.mp4`,
        expiresIn: 600,
      }),
    });
  });

  const videoInput = page.locator('input[type="file"][accept*="mp4"]');
  await videoInput.setInputFiles({
    name: "sample.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("00"),
  });

  const video = page.locator("video").first();
  await expect(video).toHaveAttribute("src", /https:\/\/signed\.example\.com\/video-1\.mp4/);
  await expect(video).not.toHaveAttribute("src", /\/storage\/v1\/object\/public/);

  // Trigger a playback error to force refresh.
  await video.evaluate((el) => el.dispatchEvent(new Event("error")));
  await expect(video).toHaveAttribute("src", /https:\/\/signed\.example\.com\/video-2\.mp4/);
});
