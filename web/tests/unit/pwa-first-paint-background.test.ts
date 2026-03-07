import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("globals set deterministic light first-paint background", () => {
  const cssPath = path.join(process.cwd(), "app", "globals.css");
  const css = fs.readFileSync(cssPath, "utf8");

  assert.match(
    css,
    /html,\s*body\s*\{[\s\S]*background-color:\s*#f8fafc;/,
    "expected html/body first-paint background color"
  );
  assert.match(
    css,
    /html,\s*body\s*\{[\s\S]*overflow-x:\s*hidden;/,
    "expected html/body horizontal overflow lock"
  );
  assert.match(
    css,
    /html\s*\{[\s\S]*color-scheme:\s*light;/,
    "expected html color-scheme to be light"
  );
});
