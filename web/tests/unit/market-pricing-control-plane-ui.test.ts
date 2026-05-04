import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin market pricing page stays admin-only and renders the seeded control-plane warnings and tables", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "settings", "billing", "market-pricing", "page.tsx"),
    "utf8"
  );

  assert.match(source, /redirect\("\/auth\/required\?redirect=\/admin\/settings\/billing\/market-pricing/);
  assert.match(source, /profile\?\.role !== "admin"/);
  assert.match(source, /Market pricing control plane/);
  assert.match(source, /This page is currently a control-plane foundation/);
  assert.match(source, /Canada PAYG is not live\. Draft rows do not enable checkout\./);
  assert.match(source, /Market policy rows/);
  assert.match(source, /One-off price rows/);
  assert.match(source, /Listing entitlement rows/);
  assert.match(source, /Runtime source diagnostics/);
  assert.match(source, /data-testid="admin-market-pricing-page"/);
  assert.match(source, /data-testid="market-pricing-runtime-diagnostics"/);
});

void test("billing settings links to the market pricing control plane", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "app", "admin", "settings", "billing", "page.tsx"),
    "utf8"
  );

  assert.match(source, /href="\/admin\/settings\/billing\/market-pricing"/);
  assert.match(source, /Market pricing control plane/);
});
