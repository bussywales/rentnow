import test from "node:test";
import assert from "node:assert/strict";
import { resolveTripTimelineSteps } from "@/lib/shortlet/trip-timeline";

void test("request-mode booking with succeeded payment resolves to awaiting host approval", () => {
  const timeline = resolveTripTimelineSteps({
    bookingStatus: "pending",
    paymentStatus: "succeeded",
    bookingMode: "request",
    checkIn: "2026-03-20",
    checkOut: "2026-03-23",
    nowIso: "2026-03-10T09:00:00.000Z",
  });

  assert.equal(timeline.current, "awaiting_host_approval");
  assert.equal(
    timeline.steps.find((step) => step.key === "awaiting_host_approval")?.label,
    "Pending approval"
  );
  assert.equal(timeline.helperTitle, "Pending approval");
  assert.match(timeline.helperBody, /12 hours/i);
  assert.equal(
    timeline.steps.find((step) => step.key === "awaiting_host_approval")?.status,
    "current"
  );
});

void test("instant-mode confirmed booking resolves to upcoming before check-in", () => {
  const timeline = resolveTripTimelineSteps({
    bookingStatus: "confirmed",
    paymentStatus: "succeeded",
    bookingMode: "instant",
    checkIn: "2026-03-20",
    checkOut: "2026-03-23",
    nowIso: "2026-03-10T09:00:00.000Z",
  });

  assert.equal(timeline.current, "upcoming");
  assert.equal(timeline.helperTitle, "Confirmed");
});

void test("pending payment with succeeded payment stays in payment confirming instead of failed", () => {
  const timeline = resolveTripTimelineSteps({
    bookingStatus: "pending_payment",
    paymentStatus: "succeeded",
    bookingMode: "request",
    checkIn: "2026-03-20",
    checkOut: "2026-03-23",
    nowIso: "2026-03-10T09:00:00.000Z",
  });

  assert.equal(timeline.current, "payment_confirming");
});

void test("declined request adds terminal declined step", () => {
  const timeline = resolveTripTimelineSteps({
    bookingStatus: "declined",
    paymentStatus: "succeeded",
    bookingMode: "request",
    checkIn: "2026-03-20",
    checkOut: "2026-03-23",
    nowIso: "2026-03-10T09:00:00.000Z",
  });

  assert.equal(timeline.current, "declined");
  assert.equal(timeline.steps.at(-1)?.key, "declined");
  assert.equal(timeline.steps.at(-1)?.status, "current");
});
