import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin support includes beta readiness section", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "support", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(contents.includes("Beta readiness"));
  assert.ok(contents.includes("Blocks beta"));
  assert.ok(contents.includes("Does not block beta"));
});
