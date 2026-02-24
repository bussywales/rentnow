import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("support requests ops migration adds claim and resolve lifecycle columns", () => {
  const sqlPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260224131500_support_requests_claiming.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  assert.match(sql, /alter table public\.support_requests/i);
  assert.match(sql, /add column if not exists claimed_by uuid/i);
  assert.match(sql, /add column if not exists claimed_at timestamptz/i);
  assert.match(sql, /add column if not exists resolved_at timestamptz/i);
  assert.match(sql, /support_requests_claimed_by_idx/i);
});
