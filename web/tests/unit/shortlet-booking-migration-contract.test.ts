import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("shortlet create migration allows pending_payment and writes pending_payment at insert", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260217110000_shortlet_create_pending_payment.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8");
  const normalized = sql.replace(/\s+/g, " ").toLowerCase();

  assert.match(
    normalized,
    /check \(status in \('pending_payment', 'pending', 'confirmed', 'declined', 'cancelled', 'expired', 'completed'\)\)/
  );
  assert.match(normalized, /insert into public\.shortlet_bookings/);
  assert.match(normalized, /'pending_payment'/);
});
