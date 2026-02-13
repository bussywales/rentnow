import test from "node:test";
import assert from "node:assert/strict";
import {
  buildHostChecklist,
  buildTenantChecklist,
  isVerificationChecklistDone,
} from "@/lib/checklists/role-checklists";

void test("tenant checklist marks completed steps as done", () => {
  const items = buildTenantChecklist({
    verificationDone: true,
    hasSavedSearch: false,
    alertsEnabled: false,
    hasCollection: true,
    hasContactedHost: false,
  });

  const verification = items.find((item) => item.id === "tenant-verification");
  const collection = items.find((item) => item.id === "tenant-collection");
  const alerts = items.find((item) => item.id === "tenant-alerts");

  assert.equal(verification?.status, "done");
  assert.equal(collection?.status, "done");
  assert.equal(alerts?.status, "todo");
});

void test("host checklist reflects featured toggle state", () => {
  const items = buildHostChecklist({
    role: "landlord",
    verificationDone: false,
    profileComplete: false,
    hasListing: true,
    hasMinPhotos: true,
    hasSubmittedForApproval: true,
    hasRespondedToEnquiries: false,
    featuredRequestsEnabled: false,
    hasFeaturedRequest: false,
    minPhotosRequired: 3,
  });

  const featured = items.find((item) => item.id === "host-featured");
  assert.equal(featured?.status, "coming_soon");
});

void test("verification checklist done logic follows enabled requirements", () => {
  const done = isVerificationChecklistDone({
    status: {
      email: { verified: true },
      phone: { verified: false },
      bank: { verified: false },
    },
    requirements: {
      requireEmail: true,
      requirePhone: false,
      requireBank: false,
    },
  });
  assert.equal(done, true);
});
