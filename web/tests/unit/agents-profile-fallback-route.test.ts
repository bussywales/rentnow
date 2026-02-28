import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/agents/u/[id] redirects to canonical slug when available", () => {
  const pagePath = path.join(process.cwd(), "app", "agents", "u", "[id]", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /getOrCreatePublicSlug/);
  assert.match(source, /permanentRedirect\(`\/agents\/\$\{slug\}`\)/);
});

void test("/agents/u/[id] renders advertiser profile fallback by id", () => {
  const pagePath = path.join(process.cwd(), "app", "agents", "u", "[id]", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /<PublicAdvertiserProfilePage/);
  assert.match(source, /loginRedirectPath=\{`\/agents\/u\/\$\{advertiserId\}`\}/);
});
