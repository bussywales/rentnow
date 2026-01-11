import test from "node:test";
import assert from "node:assert/strict";

import {
  derivePushReadinessCta,
  derivePushReadinessRows,
} from "../../components/admin/AdminPushReadiness";

void test("push readiness rows reflect config and permission states", () => {
  const rows = derivePushReadinessRows({
    publicKeyPresent: false,
    privateKeyPresent: false,
    serviceWorkerAvailable: false,
    permission: "default",
    supported: true,
    hasSubscription: false,
    adminSubscriptionAvailable: true,
  });

  const publicKeyRow = rows.find((row) =>
    row.label.includes("VAPID public key")
  );
  const permissionRow = rows.find((row) =>
    row.label.includes("Notifications permission")
  );

  assert.equal(publicKeyRow?.value, "No");
  assert.equal(permissionRow?.value, "Default");
});

void test("push readiness rows reflect denied permission", () => {
  const rows = derivePushReadinessRows({
    publicKeyPresent: true,
    privateKeyPresent: true,
    serviceWorkerAvailable: true,
    permission: "denied",
    supported: true,
    hasSubscription: false,
    adminSubscriptionAvailable: true,
  });

  const permissionRow = rows.find((row) =>
    row.label.includes("Notifications permission")
  );

  assert.equal(permissionRow?.value, "Denied");
});

void test("push readiness CTA switches by state", () => {
  assert.equal(
    derivePushReadinessCta({
      supported: true,
      configured: true,
      permission: "default",
      serviceWorkerAvailable: true,
      hasSubscription: false,
    }).type,
    "enable"
  );

  assert.equal(
    derivePushReadinessCta({
      supported: true,
      configured: true,
      permission: "granted",
      serviceWorkerAvailable: true,
      hasSubscription: false,
    }).type,
    "create"
  );

  assert.equal(
    derivePushReadinessCta({
      supported: true,
      configured: true,
      permission: "granted",
      serviceWorkerAvailable: true,
      hasSubscription: true,
    }).type,
    "active"
  );

  assert.equal(
    derivePushReadinessCta({
      supported: true,
      configured: true,
      permission: "denied",
      serviceWorkerAvailable: true,
      hasSubscription: false,
    }).type,
    "denied"
  );
});
