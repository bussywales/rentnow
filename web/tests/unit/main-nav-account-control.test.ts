import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("main nav uses a compact profile control instead of a bulky text pill", () => {
  const filePath = path.join(process.cwd(), "components", "layout", "MainNav.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /aria-label="Open profile"/);
  assert.match(source, /title=\{accountLabel\}/);
  assert.match(source, /className="hidden h-10 w-10 items-center justify-center rounded-full/);
  assert.doesNotMatch(source, /rounded-lg border border-slate-200 px-3 py-1\.5 text-sm font-medium/);
});

void test("root layout provides lightweight account display data to the nav", () => {
  const filePath = path.join(process.cwd(), "app", "layout.tsx");
  const source = fs.readFileSync(filePath, "utf8");

  assert.match(source, /select\("full_name,display_name,business_name,avatar_url,role"\)/);
  assert.match(source, /initialAccountName=\{navInitialAccountName\}/);
  assert.match(source, /initialAccountAvatarUrl=\{navInitialAccountAvatarUrl\}/);
});
