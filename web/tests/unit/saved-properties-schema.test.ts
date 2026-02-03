import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("saved_properties schema includes uniqueness and indexes", () => {
  const schemaPath = path.join(process.cwd(), "supabase", "schema.sql");
  const contents = fs.readFileSync(schemaPath, "utf8");

  assert.ok(
    contents.includes("CREATE TABLE public.saved_properties"),
    "expected saved_properties table"
  );
  assert.ok(
    contents.includes("UNIQUE (user_id, property_id)"),
    "expected unique constraint on saved_properties"
  );
  assert.ok(
    contents.includes("idx_saved_properties_user_created_at"),
    "expected composite index on saved_properties (user_id, created_at)"
  );
});
