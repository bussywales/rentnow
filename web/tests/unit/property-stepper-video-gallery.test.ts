import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property stepper hydrates existing video state and renders unified media gallery", () => {
  const stepperPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "PropertyStepper.tsx"
  );
  const contents = fs.readFileSync(stepperPath, "utf8");

  assert.ok(
    contents.includes("(imageUrls.length > 0 || Boolean(videoPath))"),
    "expected media gallery to render when either photos or video exists"
  );
  assert.ok(
    contents.includes('data-testid="property-stepper-video-gallery-tile"'),
    "expected media gallery to include a dedicated video tile"
  );
  assert.ok(
    contents.includes("silentNotFound: !videoPath"),
    "expected signed video URL probe to avoid noisy errors during hydration"
  );
  assert.ok(
    contents.includes("hydratePathIfMissing: !videoPath"),
    "expected signed video URL probe to hydrate missing video state"
  );
  assert.ok(
    contents.includes("const { accessToken } = await resolveAuthUser(supabase);"),
    "expected signed video URL probe to request signed URLs even before user hydration settles"
  );
  assert.ok(
    !contents.includes('setError("Please log in to load video.");'),
    "expected signed video URL probe to avoid hard-failing when browser auth hydration lags"
  );
  assert.ok(
    contents.includes('featured_media: payload.featured_media === "video" ? "video" : "image"'),
    "expected preview state to fall back to image hero when video is unavailable"
  );
});
