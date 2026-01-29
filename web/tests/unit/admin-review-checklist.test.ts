import test from "node:test";
import assert from "node:assert/strict";
import { canApproveChecklist, deriveChecklistDefaults } from "@/lib/admin/admin-review-checklist";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";

const baseListing: AdminReviewListItem = {
  id: "dad2bb26-fe36-4096-b81a-f86d230f9b3d",
  title: "Short",
  hostName: "Host",
  ownerId: "host-1",
  updatedAt: null,
  city: null,
  state_region: null,
  country_code: null,
  readiness: { score: 40, tier: "Needs work", issues: [] },
  locationQuality: "weak",
  photoCount: 0,
  hasVideo: false,
  hasCover: false,
  status: "pending",
};

test("deriveChecklistDefaults flags missing media/location/pricing/content", () => {
  const checklist = deriveChecklistDefaults(baseListing);
  assert.equal(checklist.sections.media, "needs_fix");
  assert.equal(checklist.sections.location, "needs_fix");
  assert.equal(checklist.sections.pricing, "needs_fix");
  assert.equal(checklist.sections.content, "needs_fix");
  assert.ok(checklist.warnings.length >= 2);
});

test("canApproveChecklist requires all sections pass", () => {
  const blocked = canApproveChecklist({
    sections: {
      media: "pass",
      location: "blocker",
      pricing: "pass",
      content: "pass",
      policy: "pass",
    },
    internalNotes: "",
    warnings: [],
  });
  assert.equal(blocked.ok, false);

  const ok = canApproveChecklist({
    sections: {
      media: "pass",
      location: "pass",
      pricing: "pass",
      content: "pass",
      policy: "pass",
    },
    internalNotes: "",
    warnings: [],
  });
  assert.equal(ok.ok, true);
});
