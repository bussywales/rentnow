import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const shellPath = path.join(process.cwd(), "components", "shortlets", "search", "ShortletsSearchShell.tsx");
const stickyBarPath = path.join(
  process.cwd(),
  "components",
  "shortlets",
  "search",
  "ShortletsMobileStickyBar.tsx"
);

void test("shortlets mobile sticky bar component renders the compact control set", () => {
  const contents = fs.readFileSync(stickyBarPath, "utf8");

  assert.ok(contents.includes('data-testid="shortlets-compact-search-pill"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-bar"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-expanded"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-collapsed"'));
  assert.ok(contents.includes("whereSummary"));
  assert.ok(contents.includes("datesSummary"));
  assert.ok(contents.includes("guestsSummary"));
  assert.ok(contents.includes("Sort compact"));
  assert.ok(contents.includes('data-testid="shortlets-sticky-chip-sort"'));
  assert.ok(contents.includes('data-testid="shortlets-sticky-chip-sort-expanded"'));
  assert.ok(contents.includes("Filters"));
  assert.ok(contents.includes("Search"));
  assert.ok(contents.includes("rounded-2xl"));
  assert.ok(contents.includes("h-8"));
  assert.ok(contents.includes("scrollbar-none"));
  assert.equal(contents.includes("backdrop-blur"), false);
});

void test("shortlets shell mounts only one compact sticky bar component", () => {
  const contents = fs.readFileSync(shellPath, "utf8");

  const componentMatches = contents.match(/<ShortletsMobileStickyBar/g) ?? [];
  assert.equal(componentMatches.length, 1);
  assert.equal(contents.includes('data-testid="shortlets-compact-search-pill"'), false);
});

void test("shortlets mobile sticky bar keeps compact sizing constraints and avoids oversized overlays", () => {
  const stickyContents = fs.readFileSync(stickyBarPath, "utf8");
  const shellContents = fs.readFileSync(shellPath, "utf8");

  assert.ok(stickyContents.includes("top-[78px]"));
  assert.ok(stickyContents.includes("max-w-[760px]"));
  assert.ok(stickyContents.includes("px-2.5 py-2"));
  assert.ok(stickyContents.includes("h-8"));
  assert.ok(stickyContents.includes("railBaseClass"));
  assert.ok(stickyContents.includes("overflow-x-auto"));
  assert.ok(stickyContents.includes("WebkitOverflowScrolling"));
  assert.ok(stickyContents.includes("maskImage"));
  assert.ok(stickyContents.includes("WebkitMaskImage"));
  assert.equal(stickyContents.includes("rounded-full border border-slate-200 bg-white/95"), false);
  assert.ok(stickyContents.includes("motion-reduce:transition-none"));
  assert.ok(stickyContents.includes("flex-none"));

  const stickyTestIdMatches = stickyContents.match(/shortlets-compact-search-pill/g) ?? [];
  assert.equal(stickyTestIdMatches.length, 1);
  assert.ok(shellContents.includes('data-testid="shortlets-open-map"'));
});
