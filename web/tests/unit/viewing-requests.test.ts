import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildViewingInsertPayload,
  parseRequestPayload,
  validatePreferredTimesWithAvailability,
} from "@/app/api/viewings/request/route";
import { parseLegacyPayload } from "@/app/api/viewings/route";

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
      validatePreferredTimesWithAvailability([
        "2026-01-01T08:00:00Z",
        "2026-01-02T09:00:00Z",
        "2026-01-03T10:00:00Z",
        "2026-01-04T11:00:00Z",
      ], "Africa/Lagos", [], []),
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
  assert.ok(!("note" in (parsed as Record<string, unknown>)));
});

void test("legacy viewing payload bridges preferred_date/time window", () => {
  const body = {
    property_id: "22222222-2222-4222-8222-222222222222",
    preferred_date: "2026-01-16",
    preferred_time_window: "2-4pm",
    note: "",
  };

  const parsed = parseRequestPayload(body);
  assert.equal(parsed.propertyId, body.property_id);
  assert.equal(parsed.preferredTimes.length, 1);
  assert.ok(parsed.preferredTimes[0].startsWith("2026-01-16"));
  assert.equal(parsed.message, "Preferred window: 2-4pm");
  assert.ok(!("note" in (parsed as Record<string, unknown>)));
});

void test("legacy viewings API parser drops note from insert payload", () => {
  const body = {
    propertyId: "33333333-3333-4333-8333-333333333333",
    preferredTimes: ["2026-01-02T10:00:00Z"],
    note: "legacy note",
  };
  const parsed = parseLegacyPayload(body);
  assert.equal(parsed.message, "legacy note");
  assert.deepEqual(Object.keys(parsed).sort(), ["message", "preferredTimes", "propertyId"]);
});

void test("insert payload is strictly whitelisted without legacy keys", () => {
  const parsed = parseRequestPayload({
    propertyId: "44444444-4444-4444-8444-444444444444",
    preferredTimes: ["2026-01-01T10:00:00Z"],
    note: "old",
  });
  const insertPayload = buildViewingInsertPayload(
    parsed,
    "55555555-5555-4555-8555-555555555555",
    "Africa/Lagos"
  );
  const keys = Object.keys(insertPayload).sort();
  assert.deepEqual(keys, ["message", "preferred_times", "property_id", "tenant_id"]);
  assert.ok(!("note" in (insertPayload as Record<string, unknown>)));
});

void test("validatePreferredTimes enforces time window by timezone", () => {
  const valid = validatePreferredTimesWithAvailability(
    ["2026-01-01T08:00:00Z"],
    "Africa/Lagos",
    [],
    []
  );
  assert.equal(valid.length, 1);
  assert.throws(
    () =>
      validatePreferredTimesWithAvailability(
        ["2026-01-01T01:00:00Z"],
        "Africa/Lagos",
        [],
        []
      ),
    /not available/,
    "times before 06:00 should be rejected as unavailable"
  );
});

void test("validatePreferredTimes rejects slots outside availability windows", () => {
  assert.throws(
    () =>
      validatePreferredTimesWithAvailability(
        ["2026-03-10T08:00:00Z"],
        "Europe/London",
        [{ day_of_week: 2, start_minute: 9 * 60, end_minute: 10 * 60 }],
        []
      ),
    /not available/,
    "times not matching generated slots should be rejected"
  );
});
