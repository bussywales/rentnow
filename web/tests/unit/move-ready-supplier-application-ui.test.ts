import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("supplier application surface stays reviewed and non-directory", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "services", "providers", "apply", "page.tsx"),
    "utf8"
  );
  const formSource = fs.readFileSync(
    path.join(process.cwd(), "components", "services", "MoveReadySupplierApplicationForm.tsx"),
    "utf8"
  );

  assert.match(pageSource, /Curated supplier application/);
  assert.match(formSource, /Apply to join the curated supplier network/);
  assert.match(formSource, /Applications are reviewed before approval/);
  assert.match(formSource, /does not create a public listing/);
  assert.match(formSource, /move-ready-supplier-application-form/);
});

void test("admin services surfaces expose routing readiness and supplier intake controls", () => {
  const adminHubSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "services", "page.tsx"),
    "utf8"
  );
  const providerManagerSource = fs.readFileSync(
    path.join(process.cwd(), "components", "services", "AdminMoveReadyProviderManager.tsx"),
    "utf8"
  );
  const requestsSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "services", "requests", "page.tsx"),
    "utf8"
  );

  assert.match(adminHubSource, /Supplier application form/);
  assert.match(adminHubSource, /Requests with approved matching suppliers/);
  assert.match(adminHubSource, /Requests needing manual routing follow-up/);
  assert.match(providerManagerSource, /Pending supplier applications/);
  assert.match(providerManagerSource, /Approved and reviewed suppliers/);
  assert.match(requestsSource, /getMoveReadyRoutingReadinessLabel/);
});
