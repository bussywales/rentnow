import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("shortlet booking notes migration adds table and role-scoped policies", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260222162000_shortlet_booking_notes.sql"
  );
  const sql = fs.readFileSync(migrationPath, "utf8").toLowerCase();

  assert.ok(sql.includes("create table if not exists public.shortlet_booking_notes"));
  assert.ok(sql.includes("role text not null check (role in ('tenant', 'host'))"));
  assert.ok(sql.includes("topic text not null check (topic in ('check_in', 'question', 'arrival_time', 'other'))"));
  assert.ok(sql.includes("create policy \"shortlet booking notes tenant read own\""));
  assert.ok(sql.includes("create policy \"shortlet booking notes tenant insert own\""));
  assert.ok(sql.includes("create policy \"shortlet booking notes host read own listings\""));
  assert.ok(sql.includes("create policy \"shortlet booking notes admin read\""));
});
