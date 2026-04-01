import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

void test("admin billing page normalizes lookup params and surfaces explicit lookup failures", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "billing", "page.tsx");
  const source = readFileSync(filePath, "utf8");

  assert.match(source, /normalizeAdminBillingLookupParams/);
  assert.match(source, /const lookupError =/);
  assert.match(source, /No billing snapshot was loaded for the supplied lookup\./);
  assert.match(source, /title="Lookup failed"/);
});

