import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property create and update routes upsert shortlet_settings", () => {
  const createRoutePath = path.join(process.cwd(), "app", "api", "properties", "route.ts");
  const updateRoutePath = path.join(process.cwd(), "app", "api", "properties", "[id]", "route.ts");

  const createRoute = fs.readFileSync(createRoutePath, "utf8");
  const updateRoute = fs.readFileSync(updateRoutePath, "utf8");

  assert.match(createRoute, /\.from\("shortlet_settings"\)\.upsert\(/);
  assert.match(updateRoute, /\.from\("shortlet_settings"\)\.upsert\(/);
});
