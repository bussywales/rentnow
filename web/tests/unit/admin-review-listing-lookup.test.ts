import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("review listing lookup queries by listing id", () => {
  const root = process.cwd();
  const filePath = path.join(root, "lib", "admin", "admin-review-loader.ts");
  const contents = fs.readFileSync(filePath, "utf8");
  assert.ok(
    contents.includes('.eq("id", listingId)'),
    "expected lookup to filter by listing id"
  );
});
