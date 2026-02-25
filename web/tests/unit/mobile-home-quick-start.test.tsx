import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MobileQuickStartBar } from "@/components/home/MobileQuickStartBar";

void test("mobile quick-start renders search entry and category shortcuts", () => {
  const html = renderToStaticMarkup(React.createElement(MobileQuickStartBar));

  assert.match(html, /data-testid="mobile-quickstart"/);
  assert.match(html, /Quick start/);
  assert.match(html, /data-testid="mobile-quickstart-search"/);
  assert.match(html, /href="\/properties\?open=search"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-shortlets"/);
  assert.match(html, /href="\/shortlets"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-rent"/);
  assert.match(html, /href="\/properties\?intent=rent"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-sale"/);
  assert.match(html, /href="\/properties\?intent=sale"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-offplan"/);
  assert.match(html, /href="\/properties\?intent=off_plan"/);
  assert.match(html, /data-testid="mobile-quickstart-chip-all"/);
  assert.match(html, /href="\/properties"/);
  assert.match(html, /md:hidden/);
  assert.match(html, /sticky top-\[72px\] z-20/);
  assert.match(html, /snap-x snap-mandatory/);
  assert.match(html, /scrollbar-none/);
});

void test("public home mounts mobile quick-start before long-form hero content", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  const quickStartIndex = source.indexOf("<MobileQuickStartBar");
  const heroIndex = source.indexOf('<section className="relative overflow-hidden');

  assert.ok(quickStartIndex >= 0, "expected MobileQuickStartBar mount on public home");
  assert.ok(heroIndex >= 0, "expected hero section marker on public home");
  assert.ok(quickStartIndex < heroIndex, "expected quick-start block above hero section");
});
