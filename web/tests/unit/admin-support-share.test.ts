import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin support includes share link telemetry block", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "support", "page.tsx");
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("Share links"));
  assert.ok(contents.includes("Top failure reasons"));
  assert.ok(contents.includes("Not tracked"));
});
