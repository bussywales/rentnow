import test from "node:test";
import assert from "node:assert/strict";
import { isShortletBookingPastRespondBy } from "@/lib/shortlet/shortlet.server";

const nowIso = "2026-02-17T12:00:00.000Z";

void test("isShortletBookingPastRespondBy prefers respond_by when present", () => {
  assert.equal(
    isShortletBookingPastRespondBy(
      {
        respond_by: "2026-02-17T11:00:00.000Z",
        expires_at: "2026-02-17T13:00:00.000Z",
      },
      nowIso
    ),
    true
  );
  assert.equal(
    isShortletBookingPastRespondBy(
      {
        respond_by: "2026-02-17T12:30:00.000Z",
        expires_at: "2026-02-17T11:00:00.000Z",
      },
      nowIso
    ),
    false
  );
});

void test("isShortletBookingPastRespondBy falls back to expires_at", () => {
  assert.equal(
    isShortletBookingPastRespondBy(
      {
        respond_by: null,
        expires_at: "2026-02-17T11:59:00.000Z",
      },
      nowIso
    ),
    true
  );
});

void test("isShortletBookingPastRespondBy returns false for invalid timestamps", () => {
  assert.equal(
    isShortletBookingPastRespondBy(
      {
        respond_by: "not-a-date",
        expires_at: null,
      },
      nowIso
    ),
    false
  );
  assert.equal(
    isShortletBookingPastRespondBy(
      {
        respond_by: null,
        expires_at: null,
      },
      nowIso
    ),
    false
  );
});
