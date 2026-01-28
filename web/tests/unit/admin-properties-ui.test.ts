import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin properties UI uses single bulk bar and checkbox column", () => {
  const adminPath = path.join(process.cwd(), "app", "admin", "page.tsx");
  const adminContents = fs.readFileSync(adminPath, "utf8");
  assert.ok(
    adminContents.includes("<PropertyBulkActions"),
    "expected bulk actions component on admin page"
  );
  const listPath = path.join(process.cwd(), "components", "admin", "AdminReviewListCards.tsx");
  const listContents = fs.readFileSync(listPath, "utf8");
  assert.ok(
    adminContents.includes("name=\"ids\"") || listContents.includes("name=\"ids\""),
    "expected checkbox ids in rows"
  );

  const bulkPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "PropertyBulkActions.tsx"
  );
  const bulkContents = fs.readFileSync(bulkPath, "utf8");

  const bulkFormMatches = bulkContents.match(/id=\"bulk-approvals\"/g) ?? [];
  assert.equal(bulkFormMatches.length, 1);

  const bulkReasonMatches = bulkContents.match(/placeholder=\"Rejection reason\"/g) ?? [];
  assert.equal(bulkReasonMatches.length, 1);
});
