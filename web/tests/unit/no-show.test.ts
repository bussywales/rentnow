import test from "node:test";
import assert from "node:assert/strict";
import { canMarkNoShow } from "@/app/api/viewings/[id]/no-show/route";
import { deriveReliability } from "@/lib/viewings/reliability";

const baseRow = {
  id: "req",
  property_id: "prop",
  status: "approved",
  no_show_reported_at: null,
  properties: { owner_id: "owner" },
};

void test("cannot mark no-show unless approved", () => {
  assert.throws(
    () =>
      canMarkNoShow(
        { ...baseRow, status: "proposed" },
        "owner",
        false
      ),
    /not_approved/
  );
});

void test("cannot mark no-show twice", () => {
  assert.throws(
    () =>
      canMarkNoShow(
        { ...baseRow, no_show_reported_at: new Date().toISOString() },
        "owner",
        false
      ),
    /already_marked/
  );
});

void test("non-owner cannot mark no-show", () => {
  assert.throws(
    () =>
      canMarkNoShow(
        baseRow,
        "other",
        false
      ),
    /not_owner/
  );
});

void test("reliability labels map correctly", () => {
  assert.equal(deriveReliability(0, 0).label, "Unknown");
  assert.equal(deriveReliability(1, 5).label, "Mixed");
  assert.equal(deriveReliability(0, 2).label, "Reliable");
});
