import test from "node:test";
import assert from "node:assert/strict";

import {
  MESSAGING_REASON_CODES,
  getMessagingPermission,
  getMessagingPermissionMessage,
  getMessagingReasonCta,
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
  assert.equal(result.code, "property_not_accessible");
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
  assert.equal(result.code, "conversation_not_allowed");
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
  assert.equal(result.code, "conversation_not_allowed");
});

void test("reason copy and CTA mapping are exhaustive", () => {
  for (const code of MESSAGING_REASON_CODES) {
    const message = getMessagingPermissionMessage(code);
    assert.equal(typeof message, "string");
    assert.ok(message.length > 0);
    const cta = getMessagingReasonCta(code);
    assert.ok(cta);
  }
});

void test("CTA routing is actionable for auth and onboarding", () => {
  const authCta = getMessagingReasonCta("not_authenticated");
  assert.equal(authCta?.href, "/auth/login");

  const onboardingCta = getMessagingReasonCta("onboarding_incomplete");
  assert.equal(onboardingCta?.href, "/onboarding");
});

void test("rate-limited CTA routes to support", () => {
  const cta = getMessagingReasonCta("rate_limited");
  assert.equal(cta?.href, "/support");
});
