import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin analytics page includes admin guard and empty state copy", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "analytics", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("/auth/required?redirect=/admin/analytics&reason=auth"),
    "expected auth redirect guard"
  );
  assert.ok(
    contents.includes("/forbidden?reason=role"),
    "expected role guard redirect"
  );
  assert.ok(
    contents.includes("No activity yet"),
    "expected empty state copy for no activity"
  );
  assert.ok(
    contents.includes("Not available"),
    "expected Not available fallback"
  );
});
