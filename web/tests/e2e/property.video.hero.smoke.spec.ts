import { expect, test, type Page } from "@playwright/test";

const KNOWN_BENIGN_CONSOLE_PATTERNS: RegExp[] = [
  /Download the React DevTools/i,
  /Failed to load resource: the server responded with a status of 401 \(Unauthorized\)/i,
];

function attachRuntimeErrorGuards(page: Page) {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (KNOWN_BENIGN_CONSOLE_PATTERNS.some((pattern) => pattern.test(text))) return;
    if (message.type() === "error" || /Unhandled|TypeError|ReferenceError/i.test(text)) {
      runtimeErrors.push(`[console:${message.type()}] ${text}`);
    }
  });
  page.on("pageerror", (error) => {
    const stack = error.stack ? `\n${error.stack}` : "";
    runtimeErrors.push(`[pageerror:${page.url()}] ${error.message}${stack}`);
  });
  return runtimeErrors;
}

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("property detail renders video hero for featured-video listings when public video URL is available", async ({
  page,
}) => {
  const runtimeErrors = attachRuntimeErrorGuards(page);

  const listResponse = await page.request.get("/api/properties?page=1&pageSize=40");
  test.skip(!listResponse.ok(), "Public properties API unavailable for video smoke.");

  const payload = (await listResponse.json()) as {
    properties?: Array<{ id?: string; featured_media?: string | null }>;
  };
  const candidate = (payload.properties ?? []).find(
    (entry) => typeof entry.id === "string" && entry.id.length > 0 && entry.featured_media === "video"
  );
  test.skip(!candidate?.id, "No featured-video public listing found for video smoke.");

  const detailResponse = await page.request.get(`/api/properties/${candidate!.id}`);
  test.skip(!detailResponse.ok(), "Property detail API unavailable for selected featured-video listing.");
  const detailPayload = (await detailResponse.json()) as {
    property?: { property_videos?: Array<{ id?: string }> | null } | null;
  };
  const hasVideo = (detailPayload.property?.property_videos?.length ?? 0) > 0;
  test.skip(!hasVideo, "Selected featured-video listing has no attached video.");

  const signedUrlProbe = await page.request.get(`/api/properties/${candidate!.id}/video/public`);
  test.skip(
    !signedUrlProbe.ok(),
    "Public video signing endpoint unavailable in this environment."
  );

  await page.goto(`/properties/${candidate!.id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("property-video-hero")).toBeVisible();
  await expect(page.getByTestId("property-video-hero-play")).toBeVisible();
  await expect(page.locator('[data-testid="property-video-hero"] video')).toBeVisible();
  await expect(page.getByTestId("property-detail-gallery-carousel")).toBeVisible();

  expect(
    runtimeErrors,
    `property video hero smoke emitted runtime errors:\n${runtimeErrors.join("\n")}`
  ).toEqual([]);
});
