import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("commission hardening migration adds lock + timestamps", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260208200000_agent_commission_hardening.sql"
  );
  const contents = fs.readFileSync(migrationPath, "utf8");
  assert.ok(contents.includes("terms_locked"), "expected terms_locked column");
  assert.ok(contents.includes("void_reason"), "expected void_reason column");
  assert.ok(contents.includes("agent_commission_agreements_guard"), "expected guard trigger");
  assert.ok(contents.includes("Void reason required"), "expected void reason guard");
});

void test("commission agreement RLS restricts updates to owner", () => {
  const rlsPath = path.join(process.cwd(), "supabase", "rls_policies.sql");
  const contents = fs.readFileSync(rlsPath, "utf8");
  const updatePolicyIndex = contents.indexOf("agent commission agreements update");
  assert.ok(updatePolicyIndex >= 0, "expected update policy");
  const snippet = contents.slice(updatePolicyIndex, updatePolicyIndex + 240);
  assert.ok(snippet.includes("owner_agent_id = auth.uid()"), "expected owner-only update policy");
});
