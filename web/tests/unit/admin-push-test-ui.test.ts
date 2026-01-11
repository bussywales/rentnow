import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin push test button copy renders", () => {
  const componentPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "AdminPushTestButton.tsx"
  );
  const contents = fs.readFileSync(componentPath, "utf8");

  assert.ok(
    contents.includes("Send test push"),
    "expected send test push label"
  );
  assert.ok(
    contents.includes("Test push sent. Check your device."),
    "expected success copy"
  );
});
