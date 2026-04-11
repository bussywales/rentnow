import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

void test("subscription price book migrations and admin surface support draft pricing control", () => {
  const migration = read("supabase/migrations/20260411180000_subscription_price_control_plane_v1.sql");
  const phase2Migration = read("supabase/migrations/20260411193000_subscription_price_control_plane_phase2.sql");
  const page = read("app/admin/settings/billing/prices/page.tsx");
  const controlPlane = read("components/admin/AdminSubscriptionPricingControlPlane.tsx");

  assert.match(migration, /workflow_state/i);
  assert.match(migration, /subscription_price_book_audit_log/i);
  assert.match(migration, /draft_created/);
  assert.match(migration, /published/);
  assert.match(phase2Migration, /stripe_price_created/);
  assert.match(phase2Migration, /stripe_price_invalidated/);

  assert.match(page, /Subscription pricing control plane/);
  assert.match(page, /pricing control plane/i);
  assert.match(page, /Publish-ready drafts/);
  assert.match(page, /Provider-backed runtime/);
  assert.match(page, /Canonical pricing operating model/);
  assert.match(page, /Provider-managed/);
  assert.match(page, /provider-backed runtime/);
  assert.match(page, /Full audit log/);
  assert.match(page, /Subscription pricing SOP/);
  assert.match(page, /How to use this page/);
  assert.match(page, /View history/);
  assert.match(page, /getSubscriptionControlStatusTone\(entry\.controlStatus\)/);
  assert.match(page, /Good status: Aligned/);
  assert.match(page, /getSubscriptionDiagnosticTone\("Aligned"\)/);
  assert.match(page, /getSubscriptionDiagnosticTone\(diagnostic\)/);
  assert.match(page, /categoryLabel} · {diagnostic}/);
  assert.match(page, /create and bind the Stripe recurring price/i);
  assert.match(controlPlane, /Latest 8 audit events only/);
  assert.match(controlPlane, /View full audit log/);
  assert.match(controlPlane, /View row history/);
  assert.match(controlPlane, /Create Stripe price/);
  assert.match(controlPlane, /Create replacement Stripe price/);
});
