import test from "node:test";
import assert from "node:assert/strict";
import {
  LISTING_TRANSFER_BLOCKING_SHORTLET_BOOKING_STATUSES,
  LISTING_TRANSFER_RECIPIENT_ROLES,
  isListingTransferExpired,
  resolveListingTransferRequiresEntitlement,
  resolveListingTransferStatusLabel,
} from "@/lib/properties/listing-ownership-transfer";

void test("listing transfer recipients stay restricted to landlord and agent roles", () => {
  assert.deepEqual(LISTING_TRANSFER_RECIPIENT_ROLES, ["landlord", "agent"]);
});

void test("listing transfer entitlement check only applies to live-cycle statuses", () => {
  assert.equal(resolveListingTransferRequiresEntitlement("draft"), false);
  assert.equal(resolveListingTransferRequiresEntitlement("changes_requested"), false);
  assert.equal(resolveListingTransferRequiresEntitlement("live"), true);
  assert.equal(resolveListingTransferRequiresEntitlement("expired"), true);
  assert.equal(resolveListingTransferRequiresEntitlement("paused_owner"), true);
});

void test("listing transfer expiry only triggers for pending requests past expires_at", () => {
  assert.equal(
    isListingTransferExpired({
      status: "pending",
      expiresAt: "2026-04-10T00:00:00.000Z",
      now: new Date("2026-04-11T00:00:00.000Z"),
    }),
    true
  );
  assert.equal(
    isListingTransferExpired({
      status: "accepted",
      expiresAt: "2026-04-10T00:00:00.000Z",
      now: new Date("2026-04-11T00:00:00.000Z"),
    }),
    false
  );
});

void test("listing transfer status labels remain explicit", () => {
  assert.equal(resolveListingTransferStatusLabel("pending"), "Pending transfer");
  assert.equal(resolveListingTransferStatusLabel("accepted"), "Transfer accepted");
  assert.equal(resolveListingTransferStatusLabel("rejected"), "Transfer rejected");
  assert.equal(resolveListingTransferStatusLabel("cancelled"), "Transfer cancelled");
  assert.equal(resolveListingTransferStatusLabel("expired"), "Transfer expired");
});

void test("listing transfer blocks active shortlet booking states in v1", () => {
  assert.deepEqual(LISTING_TRANSFER_BLOCKING_SHORTLET_BOOKING_STATUSES, [
    "pending_payment",
    "pending",
    "confirmed",
  ]);
});
