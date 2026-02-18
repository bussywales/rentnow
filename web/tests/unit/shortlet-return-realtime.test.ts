import test from "node:test";
import assert from "node:assert/strict";
import { resolveRealtimeBookingStatusUpdate } from "@/lib/shortlet/return-realtime";

void test("realtime booking update resolves a changed canonical status", () => {
  const nextStatus = resolveRealtimeBookingStatusUpdate({
    old: { status: "pending" },
    new: { status: "confirmed" },
  });
  assert.equal(nextStatus, "confirmed");
});

void test("realtime booking update ignores unchanged status", () => {
  const nextStatus = resolveRealtimeBookingStatusUpdate({
    old: { status: "pending" },
    new: { status: "pending" },
  });
  assert.equal(nextStatus, null);
});

void test("realtime booking update ignores invalid statuses", () => {
  const nextStatus = resolveRealtimeBookingStatusUpdate({
    old: { status: "pending" },
    new: { status: "processing" },
  });
  assert.equal(nextStatus, null);
});
