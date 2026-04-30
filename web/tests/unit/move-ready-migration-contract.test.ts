import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("move ready services migration creates only the minimum lead-routing tables", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260408160000_move_ready_services.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /create table if not exists public\.move_ready_service_providers/);
  assert.match(sql, /create table if not exists public\.move_ready_provider_categories/);
  assert.match(sql, /create table if not exists public\.move_ready_provider_areas/);
  assert.match(sql, /create table if not exists public\.move_ready_requests/);
  assert.match(sql, /create table if not exists public\.move_ready_request_leads/);
  assert.match(sql, /category in \('end_of_tenancy_cleaning', 'fumigation_pest_control', 'minor_repairs_handyman'\)/);
  assert.match(sql, /status in \('submitted', 'matched', 'unmatched', 'closed'\)/);
  assert.match(sql, /routing_status in \('pending_delivery', 'sent', 'delivery_failed', 'accepted', 'declined'\)/);
  assert.doesNotMatch(sql, /payments?/);
  assert.doesNotMatch(sql, /booking/);
});

void test("move ready supplier application migration stays additive to the curated provider model", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260430170000_move_ready_supplier_applications.sql"
  );
  const sql = fs.readFileSync(filePath, "utf8").replace(/\s+/g, " ").toLowerCase();

  assert.match(sql, /alter table public\.move_ready_service_providers/);
  assert.match(sql, /add column if not exists verification_reference text/);
  assert.match(sql, /add column if not exists admin_notes text/);
  assert.match(sql, /add column if not exists approved_at timestamptz/);
  assert.match(sql, /add column if not exists rejected_at timestamptz/);
  assert.match(sql, /add column if not exists suspended_at timestamptz/);
  assert.match(sql, /create index if not exists move_ready_service_providers_email_idx/);
  assert.doesNotMatch(sql, /public supplier directory/);
});
