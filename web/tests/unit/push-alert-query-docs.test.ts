import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("push alert verification query uses user_id", () => {
  const docPath = path.join(process.cwd(), "docs", "ops", "pwa.md");
  const contents = fs.readFileSync(docPath, "utf8");

  assert.ok(
    contents.includes("select id, user_id, saved_search_id, property_id"),
    "expected push alert verification query to include user_id"
  );
});
