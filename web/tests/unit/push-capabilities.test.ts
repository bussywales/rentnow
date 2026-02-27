import test from "node:test";
import assert from "node:assert/strict";

import {
  getPushCapabilitySnapshot,
  isIosDevice,
  isStandaloneDisplayMode,
} from "../../lib/pwa/push-capabilities";

void test("isIosDevice detects iPhone/iPad user agents", () => {
  assert.equal(
    isIosDevice(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15"
    ),
    true
  );
  assert.equal(
    isIosDevice(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    ),
    false
  );
});

void test("isStandaloneDisplayMode respects standalone flag and media query", () => {
  assert.equal(isStandaloneDisplayMode({ standaloneFlag: true }), true);
  assert.equal(
    isStandaloneDisplayMode({
      matchMedia: () => ({ matches: true }),
    }),
    true
  );
  assert.equal(
    isStandaloneDisplayMode({
      standaloneFlag: false,
      matchMedia: () => ({ matches: false }),
    }),
    false
  );
});

void test("getPushCapabilitySnapshot reports install requirement on iOS when not standalone", () => {
  const capability = getPushCapabilitySnapshot({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15",
    serviceWorkerSupported: true,
    pushManagerSupported: true,
    notificationsSupported: true,
    standalone: false,
  });

  assert.equal(capability.supported, true);
  assert.equal(capability.requiresIosInstall, true);
  assert.equal(capability.isStandalone, false);
});

void test("getPushCapabilitySnapshot returns unsupported when browser capabilities are missing", () => {
  const capability = getPushCapabilitySnapshot({
    userAgent: "Mozilla/5.0 (Android 14)",
    serviceWorkerSupported: false,
    pushManagerSupported: false,
    notificationsSupported: true,
    standalone: false,
  });

  assert.equal(capability.supported, false);
  assert.equal(capability.requiresIosInstall, false);
});
