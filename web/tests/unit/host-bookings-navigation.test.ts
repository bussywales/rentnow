import test from "node:test";
import assert from "node:assert/strict";
import {
  isBookingsTargetFromLocation,
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
