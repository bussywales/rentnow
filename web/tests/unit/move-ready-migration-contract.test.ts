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
