import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("saved searches page is available to all roles copy-wise", () => {
  const pagePath = path.join(process.cwd(), "app", "dashboard", "saved-searches", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    !contents.includes("Saved searches are available to tenants"),
    "expected no tenant-only gating copy"
  );
  assert.ok(
    contents.includes("Saved searches"),
    "expected saved searches heading to remain"
  );
});
