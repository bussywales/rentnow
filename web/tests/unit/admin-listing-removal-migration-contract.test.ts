import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("listing removal migration adds removed status", () => {
  const filePath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260320174500_properties_removed_status.sql"
  );
  const contents = fs.readFileSync(filePath, "utf8");

  assert.match(contents, /enumlabel = 'removed'/, "expected enum compatibility guard for removed");
  assert.match(contents, /'removed'/, "expected removed status in check constraint");
});
