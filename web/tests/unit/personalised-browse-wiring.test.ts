import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties page wires browse intent persistence client", () => {
  const pagePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");
  assert.match(contents, /<BrowseIntentClient/);
  assert.match(contents, /persistFilters=\{hasFilters\}/);
});

void test("home pages wire continue browsing CTA component", () => {
  const hostHomePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const tenantHomePath = path.join(process.cwd(), "app", "tenant", "home", "page.tsx");
  const hostHome = fs.readFileSync(hostHomePath, "utf8");
  const tenantHome = fs.readFileSync(tenantHomePath, "utf8");
  assert.match(hostHome, /<HomeBrowseCtaClient/);
  assert.match(tenantHome, /<HomeBrowseCtaClient/);
});

