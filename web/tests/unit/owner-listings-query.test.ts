import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("owner listings query includes all statuses", () => {
  const filePath = path.join(process.cwd(), "lib", "properties", "owner-listings.ts");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes('.eq("owner_id"'), "expected owner filter in listings query");
  assert.ok(!contents.includes('.eq("status", "live")'), "should not filter listings to live only");
});
