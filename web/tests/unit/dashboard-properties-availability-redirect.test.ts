import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("legacy dashboard availability route delegates to canonical host availability redirect logic", () => {
  const pagePath = path.join(
    process.cwd(),
    "app",
    "dashboard",
    "properties",
    "[id]",
    "availability",
    "page.tsx"
  );
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /resolveLegacyDashboardPropertyRedirect/);
  assert.match(source, /logAuthRedirect\("\/dashboard\/properties\/\[id\]\/availability"\)/);
});
