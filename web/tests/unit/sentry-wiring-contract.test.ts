import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("next config wraps the app with Sentry build config", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf8");

  assert.match(source, /withSentryConfig/);
  assert.match(source, /release:/);
  assert.match(source, /SENTRY_AUTH_TOKEN/);
});

void test("instrumentation wires Sentry request error capture for Next runtimes", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "instrumentation.ts"), "utf8");

  assert.match(source, /await import\("\.\/sentry\.server\.config"\)/);
  assert.match(source, /await import\("\.\/sentry\.edge\.config"\)/);
  assert.match(source, /export const onRequestError = Sentry\.captureRequestError/);
});

void test("client instrumentation wires Sentry router transitions", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "instrumentation-client.ts"),
    "utf8"
  );

  assert.match(source, /Sentry\.init\(/);
  assert.match(source, /getSharedSentryOptions\("client"\)/);
  assert.match(source, /export const onRouterTransitionStart = Sentry\.captureRouterTransitionStart/);
});
