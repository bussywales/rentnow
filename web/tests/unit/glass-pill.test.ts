import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("GlassPill defines reusable glass variants with backdrop fallback-friendly classes", () => {
  const sourcePath = path.join(process.cwd(), "components", "ui", "GlassPill.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /variant\?: "light" \| "dark"/);
  assert.match(source, /backdrop-blur-md backdrop-saturate-150/);
  assert.match(source, /light: "border-white\/45 bg-white\/45 text-slate-900"/);
  assert.match(source, /dark: "border-white\/18 bg-slate-900\/48 text-white"/);
});
