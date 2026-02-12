import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { listUpdateNotes } from "@/lib/product-updates/update-notes.server";

const UPDATES_DIR = path.join(process.cwd(), "docs", "updates");
const FRONTMATTER_REGEX = /^---\s*\n[\s\S]*?\n---\s*(\n|$)/;

void test("docs/updates markdown files include frontmatter", async () => {
  const entries = await fs.readdir(UPDATES_DIR);
  const markdownFiles = entries.filter(
    (name) => name.endsWith(".md") && name !== "README.md" && name !== "_TEMPLATE.md"
  );

  for (const filename of markdownFiles) {
    const raw = await fs.readFile(path.join(UPDATES_DIR, filename), "utf8");
    assert.match(
      raw,
      FRONTMATTER_REGEX,
      `Missing frontmatter in docs/updates/${filename}`
    );
  }
});

void test("update notes importer lists invalid notes instead of crashing", async () => {
  const filename = "__invalid-import-note-test__.md";
  const fullPath = path.join(UPDATES_DIR, filename);
  await fs.writeFile(fullPath, "This note has no frontmatter.\n", "utf8");

  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const result = await listUpdateNotes();
    const invalid = result.invalidNotes.find((note) => note.filename === filename);
    assert.ok(invalid, "Expected invalid note to be listed");
    assert.match(invalid?.error ?? "", /frontmatter/i);
  } finally {
    console.error = originalConsoleError;
    await fs.unlink(fullPath).catch(() => undefined);
  }
});
