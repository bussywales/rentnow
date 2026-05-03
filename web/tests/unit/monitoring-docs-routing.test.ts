import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DOC_ROOTS = [
  path.join(process.cwd(), "docs"),
  path.join(process.cwd(), "app", "help"),
] as const;

function collectMarkdownFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return collectMarkdownFiles(target);
    if (entry.isFile() && target.endsWith(".md")) return [target];
    return [];
  });
}

void test("active docs do not present deprecated /api/debug/env as a current diagnostics surface", () => {
  const markdownFiles = DOC_ROOTS.flatMap(collectMarkdownFiles);
  const offenders: string[] = [];

  for (const filePath of markdownFiles) {
    const contents = fs.readFileSync(filePath, "utf8");
    if (!contents.includes("/api/debug/env")) continue;

    const normalized = contents.toLowerCase();
    const isClearlyHistorical =
      normalized.includes("historical note") || normalized.includes("deprecated");

    if (!isClearlyHistorical) {
      offenders.push(path.relative(process.cwd(), filePath));
    }
  }

  assert.deepEqual(offenders, []);
});
