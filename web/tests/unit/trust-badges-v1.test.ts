import test from "node:test";
import assert from "node:assert/strict";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";
import { resolveExploreTrustBadges } from "@/lib/explore/explore-presentation";

function makeBaseProperty(): Property {
  return {
    ...mockProperties[0],
    owner_profile: null,
    status_updated_at: null,
    updated_at: undefined,
  };
}

void test("explore trust badges remain empty when no truth signals exist", () => {
  const property = makeBaseProperty();
  assert.deepEqual(resolveExploreTrustBadges(property), []);
});

void test("explore trust badges include verified only when verification signal exists", () => {
  const property = {
    ...makeBaseProperty(),
    owner_profile: {
      id: "owner-1",
      email_verified: true,
    },
  } as Property;

  assert.deepEqual(
    resolveExploreTrustBadges(property).map((badge) => badge.key),
    ["verified"]
  );
});

void test("explore trust badges include updated recently when update timestamp is fresh", () => {
  const now = new Date("2026-02-28T10:00:00.000Z");
  const property = {
    ...makeBaseProperty(),
    updated_at: "2026-02-24T09:00:00.000Z",
  };

  assert.deepEqual(
    resolveExploreTrustBadges(property, { now }).map((badge) => badge.key),
    ["updated_recently"]
  );
});

void test("explore trust badges include fast response when response time signal exists", () => {
  const property = {
    ...makeBaseProperty(),
    response_time_minutes: 45,
  } as Property;

  assert.deepEqual(
    resolveExploreTrustBadges(property).map((badge) => badge.key),
    ["fast_response"]
  );
});

void test("explore trust badges are capped to two items to prevent overlay clutter", () => {
  const now = new Date("2026-02-28T10:00:00.000Z");
  const property = {
    ...makeBaseProperty(),
    owner_profile: {
      id: "owner-2",
      email_verified: true,
    },
    updated_at: "2026-02-27T08:00:00.000Z",
    response_time_minutes: 20,
  } as Property;

  assert.deepEqual(
    resolveExploreTrustBadges(property, { now }).map((badge) => badge.key),
    ["verified", "updated_recently"]
  );
});
