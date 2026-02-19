import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const skip = !url || !serviceRoleKey;

void test("property_images metadata columns and constraints are sane", async (t) => {
  if (skip) return t.skip("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");

  const supabase = createClient(url!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check column types
  const { data: cols, error: colsError } = await supabase
    .from("information_schema.columns")
    .select("column_name,data_type")
    .eq("table_schema", "public")
    .eq("table_name", "property_images")
    .in("column_name", [
      "bytes",
      "width",
      "height",
      "storage_path",
      "original_storage_path",
      "thumb_storage_path",
      "card_storage_path",
      "hero_storage_path",
    ]);
  assert.ifError(colsError ?? undefined);
  const map: Record<string, string> = {};
  cols?.forEach((row) => {
    map[row.column_name] = row.data_type;
  });
  assert.equal(map.bytes, "bigint", "bytes should be bigint");
  assert.equal(map.width, "integer", "width should be integer");
  assert.equal(map.height, "integer", "height should be integer");
  assert.equal(map.storage_path, "text", "storage_path should be text");
  assert.equal(map.original_storage_path, "text", "original_storage_path should be text");
  assert.equal(map.thumb_storage_path, "text", "thumb_storage_path should be text");
  assert.equal(map.card_storage_path, "text", "card_storage_path should be text");
  assert.equal(map.hero_storage_path, "text", "hero_storage_path should be text");

  // Check constraints exist and clauses are correct
  const { data: checks, error: checkError } = await supabase
    .from("information_schema.check_constraints")
    .select("constraint_name,check_clause")
    .ilike("constraint_name", "property_images%")
    .order("constraint_name", { ascending: true });
  assert.ifError(checkError ?? undefined);
  const clauses = (checks || []).map((c) => c.check_clause || "");
  const includes = (needle: string) => clauses.some((c) => c.toLowerCase().includes(needle.toLowerCase()));
  assert.ok(includes("width IS NULL OR width > 0"), "width positive check missing");
  assert.ok(includes("height IS NULL OR height > 0"), "height positive check missing");
  assert.ok(includes("bytes IS NULL OR bytes >= 0"), "bytes nonnegative check missing");
});
