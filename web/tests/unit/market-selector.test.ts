import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MARKET_OPTIONS } from "@/lib/market/market";

void test("market selector source updates context + cookie without hard reload", () => {
  const sourcePath = path.join(process.cwd(), "components", "layout", "MarketSelector.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /if \(!enabled\) return null/);
  assert.match(source, /dispatchMarketChanged/);
  assert.match(source, /setMarket\(/);
  assert.match(source, /document\.cookie =/);
  assert.doesNotMatch(source, /router\.refresh\(\)/);
  assert.doesNotMatch(source, /window\.location\.reload\(\)/);
});

void test("market options include NG, UK, CA, and US", () => {
  const labels = MARKET_OPTIONS.map((option) => option.label);
  const countries = MARKET_OPTIONS.map((option) => option.country);

  assert.ok(labels.includes("Nigeria"));
  assert.ok(labels.includes("United Kingdom"));
  assert.ok(labels.includes("Canada"));
  assert.ok(labels.includes("United States"));

  assert.ok(countries.includes("NG"));
  assert.ok(countries.includes("GB"));
  assert.ok(countries.includes("CA"));
  assert.ok(countries.includes("US"));
});
