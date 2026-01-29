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
    drawerContents.includes("data-admin-review-media-hero"),
    "expected media hero marker in inspector"
  );
  assert.ok(drawerContents.includes("Key facts"), "expected key facts marker in inspector");
});
