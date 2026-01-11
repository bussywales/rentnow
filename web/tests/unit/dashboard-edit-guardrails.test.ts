import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("dashboard edit listing hides raw error details in prod", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "dashboard",
    "properties",
    "[id]",
    "page.tsx"
  );
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("Diagnostics:"),
    "expected diagnostics label for dev-only details"
  );
  assert.ok(
    contents.includes("NODE_ENV === \"development\""),
    "expected diagnostics to be gated to development"
  );
  assert.ok(
    !contents.includes(">Error:"),
    "did not expect raw Error: prefix in user-facing copy"
  );
});
