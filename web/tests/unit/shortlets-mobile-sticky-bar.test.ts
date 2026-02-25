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
  assert.ok(contents.includes('data-testid="shortlets-mobile-sticky-controls-row"'));
  assert.ok(contents.includes("whereSummary"));
  assert.ok(contents.includes("datesSummary"));
  assert.ok(contents.includes("guestsSummary"));
  assert.ok(contents.includes("Sort compact"));
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
