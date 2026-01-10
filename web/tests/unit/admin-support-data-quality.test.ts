import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const supportPagePath = path.join(process.cwd(), "app", "admin", "support", "page.tsx");

void test("admin support includes data quality block", () => {
  const contents = fs.readFileSync(supportPagePath, "utf8");

  assert.ok(contents.includes("Data quality"));
  assert.ok(contents.includes("Missing photos"));
  assert.ok(contents.includes("Not available"));
});

void test("data quality uses service role after admin guard", () => {
  const contents = fs.readFileSync(supportPagePath, "utf8");
  const guardIndex = contents.indexOf('profile?.role !== "admin"');
  const serviceIndex = contents.indexOf("const adminClient = createServiceRoleClient");

  assert.ok(guardIndex !== -1);
  assert.ok(serviceIndex !== -1);
  assert.ok(guardIndex < serviceIndex);
});
