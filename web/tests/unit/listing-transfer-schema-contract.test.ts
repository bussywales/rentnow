import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = "/Users/olubusayoadewale/rentnow/web";
const schemaPath = path.join(repoRoot, "supabase", "schema.sql");
const migrationPath = path.join(repoRoot, "supabase", "migrations", "20260414124500_listing_ownership_transfers.sql");

void test("listing transfer schema keeps one pending request per listing and audit columns", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(schema, /CREATE TABLE public\.listing_transfer_requests/);
  assert.match(schema, /status IN \('pending', 'accepted', 'rejected', 'cancelled', 'expired'\)/);
  assert.match(schema, /accepted_by_user_id UUID REFERENCES public\.profiles/);
  assert.match(schema, /last_failure_code TEXT/);
  assert.match(migration, /idx_listing_transfer_requests_pending_property/);
});

void test("listing transfer completion updates canonical owner and owner-keyed long-term records", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /UPDATE public\.properties\s+SET owner_id = transfer_row\.to_owner_id/s);
  assert.match(migration, /UPDATE public\.listing_leads\s+SET owner_id = transfer_row\.to_owner_id/s);
  assert.match(migration, /UPDATE public\.message_threads\s+SET host_id = transfer_row\.to_owner_id/s);
});

void test("listing transfer completion blocks active shortlet bookings and consumes recipient entitlement when required", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(migration, /b\.status IN \('pending_payment', 'pending', 'confirmed'\)/);
  assert.match(migration, /'ACTIVE_SHORTLET_BOOKINGS'/);
  assert.match(migration, /FROM public\.listing_credits/);
  assert.match(migration, /INSERT INTO public\.listing_credit_consumptions/);
});

void test("listing credit consumptions no longer enforce one lifetime consumption per listing", () => {
  const schema = readFileSync(schemaPath, "utf8");
  const migration = readFileSync(migrationPath, "utf8");

  assert.doesNotMatch(schema, /UNIQUE \(listing_id\)/);
  assert.match(migration, /DROP CONSTRAINT IF EXISTS listing_credit_consumptions_listing_id_key/);
});
