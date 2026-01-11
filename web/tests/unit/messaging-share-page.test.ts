import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("share page renders read-only messaging copy", () => {
  const filePath = path.join(
    process.cwd(),
    "app",
    "share",
    "messages",
    "[token]",
    "page.tsx"
  );
  const contents = fs.readFileSync(filePath, "utf8");

  assert.ok(contents.includes("Read-only link"));
  assert.ok(contents.includes("canSend={false}"));
  assert.ok(contents.includes("/auth/login?reason=auth&next="));
});
