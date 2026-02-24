import test from "node:test";
import assert from "node:assert/strict";
import { buildSummaryFromBody, parseUpdateNote } from "@/lib/product-updates/update-notes";
import { resolveProductUpdateSummary } from "@/lib/product-updates/summary";

void test("buildSummaryFromBody skips section headings and uses first meaningful bullet line", () => {
  const body = [
    "## What changed",
    "",
    "- Restored the global updates bell in the top navigation.",
    "- Kept unread badge and role-aware filtering behavior.",
    "",
    "## Why it matters",
    "",
    "- Users can quickly scan new changes again.",
  ].join("\n");

  assert.equal(
    buildSummaryFromBody(body),
    "Restored the global updates bell in the top navigation."
  );
});

void test("parseUpdateNote respects explicit frontmatter summary", () => {
  const raw = [
    "---",
    'title: "Example update"',
    "audiences:",
    "  - HOST",
    "areas:",
    "  - Navigation",
    'summary: "Short summary from frontmatter."',
    "---",
    "",
    "## What changed",
    "",
    "- Body copy that should not replace explicit summary.",
  ].join("\n");

  const parsed = parseUpdateNote(raw);
  assert.equal(parsed.summary, "Short summary from frontmatter.");
});

void test("resolveProductUpdateSummary falls back to body when stored summary is heading-only", () => {
  const summary = "## What changed";
  const body = [
    "## What changed",
    "",
    "- Added a dedicated host listings manager route.",
  ].join("\n");

  assert.equal(
    resolveProductUpdateSummary(summary, body),
    "Added a dedicated host listings manager route."
  );
});

