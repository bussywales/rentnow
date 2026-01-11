import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin support renders ops shortcuts and anchors", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "admin",
    "support",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(contents.includes("Ops shortcuts"), "expected ops shortcuts heading");
  assert.ok(
    contents.includes("href=\"/admin/alerts\""),
    "expected alerts shortcut link"
  );
  assert.ok(
    contents.includes("href=\"/admin/analytics\""),
    "expected analytics shortcut link"
  );
  assert.ok(
    contents.includes("href=\"/admin/support#data-quality\""),
    "expected data quality anchor link"
  );
  assert.ok(
    contents.includes("href=\"/admin/support#beta-readiness\""),
    "expected beta readiness anchor link"
  );
  assert.ok(
    contents.includes("AdminPushTestButton"),
    "expected admin push test button to render"
  );
  assert.ok(contents.includes("id=\"data-quality\""), "expected data quality anchor id");
  assert.ok(contents.includes("id=\"beta-readiness\""), "expected beta readiness anchor id");
});
