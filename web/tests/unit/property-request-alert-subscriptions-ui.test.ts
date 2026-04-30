import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property request alert subscriptions manager exposes create and remove controls", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "components",
      "requests",
      "PropertyRequestAlertSubscriptionsManager.tsx"
    ),
    "utf8"
  );

  assert.match(source, /Property request alerts/);
  assert.match(source, /Create alert/);
  assert.match(source, /Current request alerts/);
  assert.match(source, /property-request-alert-subscriptions-manager/);
  assert.match(source, /property-request-alert-subscription-row/);
  assert.match(source, /Remove/);
});

