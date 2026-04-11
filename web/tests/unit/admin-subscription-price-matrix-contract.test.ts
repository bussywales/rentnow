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
  const page = read("app/admin/settings/billing/prices/page.tsx");

  assert.match(migration, /workflow_state/i);
  assert.match(migration, /subscription_price_book_audit_log/i);
  assert.match(migration, /draft_created/);
  assert.match(migration, /published/);

  assert.match(page, /Subscription pricing control plane/);
  assert.match(page, /pricing control plane/i);
  assert.match(page, /Publish-ready drafts/);
  assert.match(page, /Canonical pricing operating model/);
  assert.match(page, /Pricing playbook/);
});
