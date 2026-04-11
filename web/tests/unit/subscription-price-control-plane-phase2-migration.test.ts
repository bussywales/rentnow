import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

void test("phase 2 pricing control plane migration extends audit events for Stripe price creation", () => {
  const sql = readFileSync(
    path.join(root, "supabase/migrations/20260411193000_subscription_price_control_plane_phase2.sql"),
    "utf8"
  );

  assert.match(sql, /subscription_price_book_audit_log_event_type_check/i);
  assert.match(sql, /stripe_price_created/i);
  assert.match(sql, /stripe_price_invalidated/i);
});
