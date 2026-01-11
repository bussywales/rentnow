import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin alerts page enforces admin guard", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "alerts", "page.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("/forbidden?reason=role"));
  assert.ok(contents.includes("/auth/required?redirect=/admin/alerts&reason=auth"));
});
