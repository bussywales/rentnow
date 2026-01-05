import test from "node:test";
import assert from "node:assert/strict";

import {
  getMessagingPermission,
  getMessagingPermissionMessage,
} from "../../lib/messaging/permissions";

void test("tenant can message listing host when live", () => {
  const result = getMessagingPermission({
    senderRole: "tenant",
    senderId: "tenant-1",
    recipientId: "host-1",
    propertyOwnerId: "host-1",
    propertyPublished: true,
    isOwner: false,
    hasThread: false,
  });

  assert.equal(result.allowed, true);
});

void test("tenant blocked when listing is not live", () => {
  const result = getMessagingPermission({
    senderRole: "tenant",
    senderId: "tenant-1",
    recipientId: "host-1",
    propertyOwnerId: "host-1",
    propertyPublished: false,
    isOwner: false,
    hasThread: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "property_unavailable");
});

void test("host cannot start a new thread", () => {
  const result = getMessagingPermission({
    senderRole: "landlord",
    senderId: "host-1",
    recipientId: "tenant-1",
    propertyOwnerId: "host-1",
    propertyPublished: true,
    isOwner: true,
    hasThread: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "owner_cannot_start");
});

void test("self messaging is blocked", () => {
  const result = getMessagingPermission({
    senderRole: "tenant",
    senderId: "user-1",
    recipientId: "user-1",
    propertyOwnerId: "user-1",
    propertyPublished: true,
    isOwner: true,
    hasThread: false,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "self_message");
});

void test("permission copy returns a user-facing message", () => {
  const message = getMessagingPermissionMessage("owner_cannot_start");
  assert.ok(message.includes("reply"));
});
