import test from "node:test";
import assert from "node:assert/strict";

import { getPushConfigStatus } from "../../lib/push/config";

void test("push config reports missing keys when not configured", () => {
  const prevPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const prevAltPublic = process.env.VAPID_PUBLIC_KEY;
  const prevPrivate = process.env.VAPID_PRIVATE_KEY;

  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;

  const config = getPushConfigStatus();
  assert.equal(config.configured, false);
  assert.ok(config.missingKeys.includes("VAPID_PRIVATE_KEY"));
  assert.ok(
    config.missingKeys.includes("NEXT_PUBLIC_VAPID_PUBLIC_KEY") ||
      config.missingKeys.includes("VAPID_PUBLIC_KEY")
  );

  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = prevPublic;
  process.env.VAPID_PUBLIC_KEY = prevAltPublic;
  process.env.VAPID_PRIVATE_KEY = prevPrivate;
});

void test("push config is configured when both keys exist", () => {
  const prevPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const prevAltPublic = process.env.VAPID_PUBLIC_KEY;
  const prevPrivate = process.env.VAPID_PRIVATE_KEY;

  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "public-key";
  process.env.VAPID_PUBLIC_KEY = "";
  process.env.VAPID_PRIVATE_KEY = "private-key";

  const config = getPushConfigStatus();
  assert.equal(config.configured, true);
  assert.equal(config.missingKeys.length, 0);

  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = prevPublic;
  process.env.VAPID_PUBLIC_KEY = prevAltPublic;
  process.env.VAPID_PRIVATE_KEY = prevPrivate;
});
