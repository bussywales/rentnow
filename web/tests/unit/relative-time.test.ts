import test from "node:test";
import assert from "node:assert/strict";
import { formatRelativeTime } from "@/lib/date/relative-time";

const NOW = new Date("2024-01-01T12:00:00.000Z");

void test("formats recent times relative to now", () => {
  assert.equal(formatRelativeTime("2024-01-01T11:00:00.000Z", NOW), "1 hour ago");
  assert.equal(formatRelativeTime("2023-12-31T12:00:00.000Z", NOW), "yesterday");
  assert.equal(formatRelativeTime("2023-12-29T12:00:00.000Z", NOW), "3 days ago");
});

void test("handles future and null inputs gracefully", () => {
  assert.equal(formatRelativeTime("2024-01-01T13:00:00.000Z", NOW), "in 1 hour");
  assert.equal(formatRelativeTime(null, NOW), "Just now");
});
