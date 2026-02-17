import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("shortlet succeeded-payment trigger migration wires booking transition safety net", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260217180000_shortlet_payment_succeeded_trigger.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const normalized = sql.replace(/\s+/g, " ").toLowerCase();

  assert.match(normalized, /create or replace function public\.shortlet_apply_payment_succeeded_transition\(\)/);
  assert.match(
    normalized,
    /create trigger shortlet_payments_apply_payment_succeeded_transition after insert or update of status on public\.shortlet_payments/
  );
  assert.match(normalized, /when \(new\.status = 'succeeded'\)/);
  assert.match(normalized, /if tg_op = 'update' and coalesce\(old\.status, ''\) = 'succeeded' then return new;/);
  assert.match(normalized, /if booking_current_status <> 'pending_payment' then return new;/);
  assert.match(normalized, /when booking_mode = 'instant' then 'confirmed' else 'pending' end/);
  assert.match(
    normalized,
    /update public\.shortlet_bookings set status = next_status,[\s\S]*where id = new\.booking_id and status = 'pending_payment'/
  );
});
