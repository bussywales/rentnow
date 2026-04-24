import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const layoutPath = path.join(process.cwd(), "app", "layout.tsx");
const hideOnPathPath = path.join(process.cwd(), "components", "layout", "HideOnPath.tsx");

const layoutSource = fs.readFileSync(layoutPath, "utf8");
const hideOnPathSource = fs.readFileSync(hideOnPathPath, "utf8");

void test("root layout hides global chrome on the bootcamp route", () => {
  assert.match(layoutSource, /HIDE_GLOBAL_CHROME_PREFIXES = \["\/bootcamp"\]/);
  assert.match(layoutSource, /<HideOnPath hiddenPrefixes=\{\[\.\.\.HIDE_GLOBAL_CHROME_PREFIXES\]\}>[\s\S]*<MainNav/);
  assert.match(layoutSource, /<HideOnPath hiddenPrefixes=\{\[\.\.\.HIDE_GLOBAL_CHROME_PREFIXES\]\}>[\s\S]*<Footer/);
  assert.match(layoutSource, /<HideOnPath hiddenPrefixes=\{\[\.\.\.HIDE_GLOBAL_CHROME_PREFIXES\]\}>[\s\S]*<SupportWidget/);
  assert.match(layoutSource, /<HideOnPath hiddenPrefixes=\{\[\.\.\.HIDE_GLOBAL_CHROME_PREFIXES\]\}>[\s\S]*<GlassDock/);
});

void test("hide on path wrapper uses pathname prefix matching", () => {
  assert.match(hideOnPathSource, /usePathname/);
  assert.match(hideOnPathSource, /pathname === prefix/);
  assert.match(hideOnPathSource, /pathname\.startsWith/);
});
