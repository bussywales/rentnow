import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin support includes affected listings section", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "support", "page.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("Affected listings"));
  assert.ok(contents.includes("Missing fields"));
  assert.ok(contents.includes('/forbidden?reason=role'));
});
