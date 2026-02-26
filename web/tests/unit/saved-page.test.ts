import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("saved page renders local-first saved client", () => {
  const sourcePath = path.join(process.cwd(), "app", "saved", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /SavedPageClient/);
  assert.doesNotMatch(source, /redirect\(\"\/favourites\"\)/);
});

void test("saved page client includes sectioned list, bulk actions and empty-state suggestions", () => {
  const sourcePath = path.join(process.cwd(), "components", "saved", "SavedPageClient.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /data-testid="saved-page"/);
  assert.match(source, /SavedBulkActions/);
  assert.match(source, /SavedSection/);
  assert.match(source, /SavedEmptyState/);
  assert.match(source, /buildSavedSuggestions/);
  assert.match(source, /groupSavedItemsByKind/);
  assert.match(source, /clearSavedSection/);
  assert.match(source, /removeSavedItem/);
});

void test("tenant saved route redirects to canonical local saved page", () => {
  const sourcePath = path.join(process.cwd(), "app", "tenant", "saved", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /redirect\(\"\/saved\"\)/);
});
