import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property_videos RLS mirrors property ownership with delegation/admin", () => {
  const rlsPath = path.join(process.cwd(), "supabase", "rls_policies.sql");
  const contents = fs.readFileSync(rlsPath, "utf8");

  const policies = [
    "videos owner/admin read",
    "videos owner/admin insert",
    "videos owner/admin update",
    "videos owner/admin delete",
  ];
  policies.forEach((name) => {
    assert.ok(contents.includes(name), `expected ${name} policy`);
  });

  // Ensure delegation clause is present
  assert.ok(
    contents.includes("agent_delegations"),
    "expected delegation clause in property_videos policies"
  );

  // Ensure owner_id check is required
  assert.ok(
    contents.includes("pr.owner_id = auth.uid()"),
    "expected owner_id check in property_videos policies"
  );
});
