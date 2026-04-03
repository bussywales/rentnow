import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

void test("admin billing page normalizes lookup params and surfaces explicit lookup failures", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "billing", "page.tsx");
  const source = readFileSync(filePath, "utf8");

  assert.match(source, /const resolvedSearchParams = searchParams \? await searchParams : \{\}/);
  assert.match(source, /normalizeAdminBillingLookupParams/);
  assert.match(source, /const lookupError =/);
  assert.match(source, /No billing snapshot was loaded for the supplied lookup\./);
  assert.match(source, /title="Lookup failed"/);
});

void test("admin billing page includes operator guidance for launch posture and replay safety", () => {
  const filePath = path.join(process.cwd(), "app", "admin", "billing", "page.tsx");
  const source = readFileSync(filePath, "utf8");

  assert.match(source, /Launch posture/);
  assert.match(source, /Certified UK lanes can use the normal Stripe-owned recovery path\./);
  assert.match(source, /Healthy final state/);
  assert.match(source, /Fix the root cause before replay\./);
});
