import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("legacy dashboard properties route redirects to host listings and preserves query params", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "properties", "page.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /buildQueryString/);
  assert.match(source, /new URLSearchParams\(\)/);
  assert.match(source, /redirect\(query \? `\/host\/listings\?\$\{query\}` : "\/host\/listings"\)/);
});
