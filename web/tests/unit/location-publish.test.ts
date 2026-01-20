import test from "node:test";
import assert from "node:assert/strict";
import { hasPinnedLocation } from "@/lib/properties/validation";

test("hasPinnedLocation accepts lat/lng", () => {
  assert.equal(hasPinnedLocation({ latitude: 1, longitude: 2 }), true);
});

test("hasPinnedLocation accepts place id + label", () => {
  assert.equal(
    hasPinnedLocation({ location_place_id: "pid", location_label: "Lagos" }),
    true
  );
});

test("hasPinnedLocation rejects missing", () => {
  assert.equal(hasPinnedLocation({}), false);
  assert.equal(hasPinnedLocation({ latitude: 1 }), false);
});
