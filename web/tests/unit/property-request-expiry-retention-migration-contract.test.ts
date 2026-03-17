import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260317101500_property_request_expiry_retention.sql"
);

void test("property request expiry retention migration adds reminder and extension tracking", async () => {
  const source = await fs.readFile(MIGRATION_PATH, "utf8");

  assert.match(source, /add column if not exists extension_count integer not null default 0/i);
  assert.match(source, /add column if not exists last_expiry_reminder_for_expires_at timestamptz null/i);
  assert.match(source, /property_requests_extension_count_check/i);
});
