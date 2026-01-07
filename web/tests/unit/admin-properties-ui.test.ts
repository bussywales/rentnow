import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin properties UI uses single bulk bar and checkbox column", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "page.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  const bulkFormMatches = contents.match(/id=\"bulk-approvals\"/g) ?? [];
  assert.equal(bulkFormMatches.length, 1);

  const bulkReasonMatches = contents.match(/placeholder=\"Rejection reason\"/g) ?? [];
  assert.equal(bulkReasonMatches.length, 1);

  assert.ok(contents.includes("name=\"ids\""), "expected checkbox ids in rows");
});
