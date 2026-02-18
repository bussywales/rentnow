import test from "node:test";
import assert from "node:assert/strict";
import {
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
