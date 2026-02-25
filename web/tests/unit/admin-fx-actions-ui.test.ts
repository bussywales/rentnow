import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("admin system page mounts admin fx actions panel", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "system", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /AdminFxActions/);
  assert.match(source, /<AdminFxActions \/>/);
});

void test("admin fx actions component targets fetch-now route and includes helper copy", () => {
  const componentPath = path.join(process.cwd(), "components", "admin", "AdminFxActions.tsx");
  const source = fs.readFileSync(componentPath, "utf8");

  assert.match(source, /\/api\/admin\/fx\/fetch-now/);
  assert.match(source, /Fetch FX rates now/);
  assert.match(source, /Runs the daily FX fetch job immediately \(admin-only\)/);
});
