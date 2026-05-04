import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin market pricing page stays admin-only and renders the seeded control-plane warnings and tables", () => {
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "settings", "billing", "market-pricing", "page.tsx"),
    "utf8"
  );
  const editorSource = fs.readFileSync(
    path.join(process.cwd(), "components", "admin", "AdminMarketPricingControlPlaneEditor.tsx"),
    "utf8"
  );

  assert.match(pageSource, /redirect\("\/auth\/required\?redirect=\/admin\/settings\/billing\/market-pricing/);
  assert.match(pageSource, /profile\?\.role !== "admin"/);
  assert.match(pageSource, /Market pricing control plane/);
  assert.match(pageSource, /control-plane rows and audit history only/);
  assert.match(pageSource, /This page is currently a control-plane foundation/);
  assert.match(pageSource, /Canada PAYG is not live\. Draft rows do not enable checkout\./);
  assert.match(pageSource, /Enterprise pricing rows remain planning-only/);
  assert.match(pageSource, /Canada PAYG readiness resolver is available for validation only/);
  assert.match(pageSource, /Canada runtime diagnostics/);
  assert.match(pageSource, /Runtime gate/);
  assert.match(pageSource, /Resolver available/);
  assert.match(pageSource, /Checkout enabled/);
  assert.match(pageSource, /Stripe prep layer/);
  assert.match(pageSource, /Checkout creation/);
  assert.match(pageSource, /Canada session creation/);
  assert.match(pageSource, /BLOCKED BY DESIGN/);
  assert.match(pageSource, /Runtime source/);
  assert.match(pageSource, /Next activation prerequisites/);
  assert.match(pageSource, /gateEnabled \? "ON" : "OFF"/);
  assert.match(pageSource, /stripePrepLayerAvailable \? "AVAILABLE" : "UNAVAILABLE"/);
  assert.match(pageSource, /checkoutCreationEnabled \? "ENABLED" : "DISABLED"/);
  assert.match(pageSource, /data-testid="market-pricing-canada-runtime-diagnostics"/);
  assert.match(pageSource, /Runtime source diagnostics/);
  assert.match(pageSource, /AdminMarketPricingControlPlaneEditor/);
  assert.match(pageSource, /data-testid="admin-market-pricing-page"/);
  assert.match(pageSource, /data-testid="market-pricing-runtime-diagnostics"/);
  assert.match(pageSource, /data-testid="market-pricing-enterprise-planning-warning"/);
  assert.match(pageSource, /data-testid="market-pricing-canada-readiness-warning"/);

  assert.match(editorSource, /data-testid="market-pricing-control-plane-editor"/);
  assert.match(editorSource, /Market policy rows/);
  assert.match(editorSource, /One-off price rows/);
  assert.match(editorSource, /Listing entitlement rows/);
  assert.match(editorSource, /Role\/tier prices are control-plane rows only until runtime integration ships/);
  assert.match(editorSource, /Enterprise rows are planning-only until Enterprise runtime tier support is implemented/);
  assert.match(editorSource, />Role</);
  assert.match(editorSource, />Tier</);
  assert.match(editorSource, /market-policy-edit-button-\$\{row\.id\}/);
  assert.match(editorSource, /market-one-off-edit-button-\$\{row\.id\}/);
  assert.match(editorSource, /market-entitlement-edit-button-\$\{row\.id\}/);
  assert.match(editorSource, /runtime billing remains unchanged/i);
  assert.match(editorSource, /Canada may stay draft-edited here/);
});

void test("billing settings links to the market pricing control plane", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "settings", "billing", "page.tsx"),
    "utf8"
  );

  assert.match(source, /href="\/admin\/settings\/billing\/market-pricing"/);
  assert.match(source, /Market pricing control plane/);
});
