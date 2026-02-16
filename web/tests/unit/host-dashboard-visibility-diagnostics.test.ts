import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("host dashboard listing cards surface visibility diagnostics copy", () => {
  const filePath = path.join(process.cwd(), "components", "host", "HostDashboardContent.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /getPublicVisibilityDiagnostics/);
  assert.match(source, /Why this listing is not visible/);
});
