import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin review decision desk renders split panes", () => {
  const deskPath = path.join(process.cwd(), "components", "admin", "AdminReviewDesk.tsx");
  const contents = fs.readFileSync(deskPath, "utf8");
  assert.ok(
    contents.includes("data-admin-review-pane=\"left\""),
    "expected left review pane marker"
  );
  assert.ok(
    contents.includes("data-admin-review-pane=\"right\""),
    "expected right review pane marker"
  );
  const drawerPath = path.join(process.cwd(), "components", "admin", "AdminReviewDrawer.tsx");
  const drawerContents = fs.readFileSync(drawerPath, "utf8");
  assert.ok(
    drawerContents.includes("Select a listing to review"),
    "expected empty state copy for right pane"
  );
  assert.ok(
    drawerContents.includes("admin-review-media-hero"),
    "expected media hero marker in inspector"
  );
  assert.ok(
    drawerContents.includes('import { SafeImage } from "@/components/ui/SafeImage"'),
    "expected inspector media to use SafeImage for optimizer bypass safety"
  );
  assert.ok(
    !drawerContents.includes('from "next/image"'),
    "expected no direct next/image import in admin inspector media"
  );
  assert.ok(
    drawerContents.includes("Open raw image"),
    "expected fallback link for failed admin inspector images"
  );
  assert.ok(drawerContents.includes("Key facts"), "expected key facts marker in inspector");
  assert.ok(
    contents.includes("scroll: false"),
    "expected scroll-safe navigation in review desk"
  );
  const listPath = path.join(process.cwd(), "components", "admin", "AdminReviewList.tsx");
  const listContents = fs.readFileSync(listPath, "utf8");
  assert.ok(
    listContents.includes("resolveAdminOwnerIdentityDisplay"),
    "expected review list rows to use the owner identity fallback helper"
  );
  assert.ok(
    listContents.includes("Owner: {ownerIdentity.primaryLabel}"),
    "expected review list rows to emphasize owner identity"
  );
  assert.ok(
    listContents.includes("Listing ID: {item.id}"),
    "expected review list rows to keep listing id as secondary metadata"
  );
  const cardPath = path.join(process.cwd(), "components", "admin", "AdminReviewListCards.tsx");
  const cardContents = fs.readFileSync(cardPath, "utf8");
  assert.ok(
    cardContents.includes("Owner: {ownerIdentity.primaryLabel}"),
    "expected mobile review cards to emphasize owner identity"
  );
});
