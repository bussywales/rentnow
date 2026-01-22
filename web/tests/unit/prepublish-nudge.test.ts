import test from "node:test";
import assert from "node:assert/strict";
import { buildPrePublishNudges } from "@/lib/properties/prepublish-nudge";

const strongLocation = { quality: "strong", missing: [] as string[] };
const mediumLocation = { quality: "medium", missing: ["postal_code"] };
const weakLocation = { quality: "weak", missing: ["pin"] };

void test("returns location nudge when quality is weak", () => {
  const nudges = buildPrePublishNudges({
    locationQuality: weakLocation,
    photoCount: 6,
    coverImageUrl: "cover.jpg",
  });
  assert.equal(nudges.some((item) => item.id === "location"), true);
});

void test("returns photo nudge when recommended cover available", () => {
  const nudges = buildPrePublishNudges({
    locationQuality: strongLocation,
    photoCount: 6,
    coverImageUrl: "cover.jpg",
    recommendedCoverUrl: "recommended.jpg",
  });
  assert.equal(nudges.some((item) => item.id === "photos"), true);
});

void test("returns photo nudge when photo count is low", () => {
  const nudges = buildPrePublishNudges({
    locationQuality: mediumLocation,
    photoCount: 2,
    coverImageUrl: null,
  });
  const photo = nudges.find((item) => item.id === "photos");
  assert.ok(photo);
  assert.match(photo?.description || "", /5\+/);
});

void test("returns none when everything is good", () => {
  const nudges = buildPrePublishNudges({
    locationQuality: strongLocation,
    photoCount: 6,
    coverImageUrl: "cover.jpg",
    recommendedCoverUrl: "cover.jpg",
  });
  assert.equal(nudges.length, 0);
});
