import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties page includes shortlet stay toggle", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");
  assert.match(source, /Stay type/);
  assert.match(source, /stay: isShortletStayOnly \? null : "shortlet"/);
});

void test("smart search keeps stay=shortlet when browsing", () => {
  const searchPath = path.join(process.cwd(), "components", "properties", "SmartSearchBox.tsx");
  const source = fs.readFileSync(searchPath, "utf8");
  assert.match(source, /currentStay === "shortlet"/);
  assert.match(source, /next\.set\("stay", "shortlet"\)/);
});
