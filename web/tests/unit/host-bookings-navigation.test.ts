import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCanonicalHostBookingsHrefFromSearchParams,
  buildHostBookingsHref,
  isBookingsTargetFromLocation,
  resolveHostWorkspaceParam,
  resolveHostWorkspaceSectionFromLocation,
} from "@/lib/host/bookings-navigation";

void test("bookings target resolves from tab parameter", () => {
  assert.equal(
    isBookingsTargetFromLocation({ tab: "bookings", hash: null }),
    true
  );
  assert.equal(
    resolveHostWorkspaceSectionFromLocation("listings", {
      tab: "bookings",
      hash: null,
    }),
    "bookings"
  );
});

void test("bookings target resolves from section alias", () => {
  assert.equal(
    resolveHostWorkspaceParam({ tab: null, section: "bookings", hash: null }),
    "bookings"
  );
  assert.equal(
    resolveHostWorkspaceSectionFromLocation("listings", {
      tab: null,
      section: "bookings",
      hash: null,
    }),
    "bookings"
  );
});

void test("bookings target resolves from host-bookings hash", () => {
  assert.equal(
    isBookingsTargetFromLocation({ tab: null, hash: "#host-bookings" }),
    true
  );
  assert.equal(
    resolveHostWorkspaceSectionFromLocation("listings", {
      tab: null,
      hash: "#host-bookings",
    }),
    "bookings"
  );
});

void test("bookings target resolves from booking query param", () => {
  assert.equal(
    isBookingsTargetFromLocation({ tab: null, section: null, booking: "booking-id", hash: null }),
    true
  );
  assert.equal(
    resolveHostWorkspaceSectionFromLocation("listings", {
      tab: null,
      section: null,
      booking: "booking-id",
      hash: null,
    }),
    "bookings"
  );
});

void test("unknown tab keeps current section", () => {
  assert.equal(
    resolveHostWorkspaceSectionFromLocation("bookings", {
      tab: "all",
      hash: null,
    }),
    "bookings"
  );
  assert.equal(
    resolveHostWorkspaceSectionFromLocation("listings", {
      tab: "listings",
      hash: null,
    }),
    "listings"
  );
});

void test("canonical host bookings href builder targets /host/bookings", () => {
  assert.equal(
    buildHostBookingsHref({
      view: "awaiting",
      booking: "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea",
      hash: "host-bookings",
    }),
    "/host/bookings?view=awaiting&booking=6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea#host-bookings"
  );
});

void test("legacy host query params normalize to canonical host bookings path", () => {
  const href = buildCanonicalHostBookingsHrefFromSearchParams({
    tab: "bookings",
    view: "awaiting",
    booking: "6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea",
    utm_source: "notifications",
  });
  assert.equal(
    href,
    "/host/bookings?view=awaiting&booking=6fd8d9f3-f3df-4d6f-bd5f-e4b4f640e6ea&utm_source=notifications"
  );
});
