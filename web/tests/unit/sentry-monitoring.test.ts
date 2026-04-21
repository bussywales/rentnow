import test from "node:test";
import assert from "node:assert/strict";

import {
  captureClientBoundaryException,
  captureServerException,
  getSharedSentryOptions,
  isSentryEnabled,
  resolveSentryEnvironment,
  resolveSentryRelease,
} from "@/lib/monitoring/sentry";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
}

test.afterEach(() => {
  resetEnv();
});

void test("sentry helper disables reporting when no DSN is configured", () => {
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;

  assert.equal(isSentryEnabled("server"), false);
  assert.equal(isSentryEnabled("client"), false);
  assert.equal(getSharedSentryOptions("server").enabled, false);

  assert.doesNotThrow(() =>
    captureServerException(new Error("server boom"), {
      route: "/api/test",
      status: 500,
    })
  );
  assert.doesNotThrow(() =>
    captureClientBoundaryException(new Error("client boom"), {
      route: "/test",
      pathname: "/test",
    })
  );
});

void test("sentry helper resolves environment and release safely from env", () => {
  process.env.SENTRY_DSN = "https://server@example.ingest.sentry.io/123";
  process.env.NEXT_PUBLIC_SENTRY_DSN = "https://client@example.ingest.sentry.io/456";
  process.env.SENTRY_ENVIRONMENT = "production";
  process.env.SENTRY_RELEASE = "commit-sha-123";

  assert.equal(resolveSentryEnvironment(), "production");
  assert.equal(resolveSentryRelease(), "commit-sha-123");

  const serverOptions = getSharedSentryOptions("server");
  const clientOptions = getSharedSentryOptions("client");
  assert.equal(serverOptions.enabled, true);
  assert.equal(clientOptions.enabled, true);
  assert.equal(serverOptions.release, "commit-sha-123");
  assert.equal(clientOptions.environment, "production");
});
