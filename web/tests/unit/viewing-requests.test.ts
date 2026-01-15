import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseRequestPayload, validatePreferredTimes } from "@/app/api/viewings/request/route";

void test("viewing_requests RLS is tenant-only", () => {
  const rlsPath = path.join(process.cwd(), "supabase", "rls_policies.sql");
  const contents = fs.readFileSync(rlsPath, "utf8");

  assert.ok(
    contents.includes('CREATE POLICY "viewings tenant select"'),
    "expected tenant select policy"
  );
  assert.ok(
    contents.includes('CREATE POLICY "viewings tenant insert"'),
    "expected tenant insert policy"
  );
  assert.ok(
    !contents.includes("tenant/owner update"),
    "should not include owner/admin viewing updates"
  );
});

void test("viewing request validation rejects more than 3 preferred times", () => {
  assert.throws(
    () =>
      validatePreferredTimes([
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
        new Date().toISOString(),
      ]),
    /1 to 3/,
    "expected validation to reject more than three times"
  );
});

void test("viewing request payload maps note to message", () => {
  const body = {
    propertyId: "11111111-1111-4111-8111-111111111111",
    preferredTimes: [new Date().toISOString()],
    note: "please evening",
  };

  const parsed = parseRequestPayload(body);
  assert.equal(parsed.message, "please evening");
});
