import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";

const UPDATES_DIR = path.join(process.cwd(), "docs", "updates");
const ALLOWED_AUDIENCES = new Set(["TENANT", "HOST", "AGENT", "ADMIN"]);

function parseArrayValue(frontmatter: string, key: string): string[] | null {
  const lines = frontmatter.split("\n");
  const keyRegex = new RegExp(`^${key}:\\s*(.*)$`);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trimEnd();
    const match = line.match(keyRegex);
    if (!match) continue;

    const inlineValue = (match[1] ?? "").trim();
    if (inlineValue.startsWith("[") && inlineValue.endsWith("]")) {
      return inlineValue
        .slice(1, -1)
        .split(",")
        .map((value) => value.trim().replace(/^['"]|['"]$/g, ""))
        .filter(Boolean);
    }

    if (inlineValue.length > 0) {
      return null;
    }

    const values: string[] = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const raw = lines[next];
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (/^[a-zA-Z0-9_]+:\s*/.test(trimmed)) break;
      const itemMatch = trimmed.match(/^-\s*(.+)$/);
      if (!itemMatch) return null;
      values.push(itemMatch[1].trim().replace(/^['"]|['"]$/g, ""));
    }
    return values;
  }

  return null;
}

void test("update notes enforce required frontmatter contract", async () => {
  const entries = await fs.readdir(UPDATES_DIR);
  const markdownFiles = entries.filter((name) => name.endsWith(".md") && name !== "README.md");

  const failures: string[] = [];

  for (const filename of markdownFiles) {
    const fullPath = path.join(UPDATES_DIR, filename);
    const raw = await fs.readFile(fullPath, "utf8");
    const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*(\n|$)/);

    if (!match) {
      failures.push(`${filename}: missing YAML frontmatter delimiters (--- ... ---)`);
      continue;
    }

    const frontmatter = match[1];
    const hasTitle = /^title:\s*.+/m.test(frontmatter);
    if (!hasTitle) {
      failures.push(`${filename}: missing required frontmatter key "title"`);
    }

    const areas = parseArrayValue(frontmatter, "areas");
    if (!areas || areas.length === 0) {
      failures.push(`${filename}: "areas" must be a non-empty array`);
    }

    const audiences = parseArrayValue(frontmatter, "audiences");
    if (!audiences || audiences.length === 0) {
      failures.push(`${filename}: "audiences" must be a non-empty array`);
      continue;
    }

    const invalidAudiences = audiences.filter((audience) => !ALLOWED_AUDIENCES.has(audience));
    if (invalidAudiences.length) {
      failures.push(
        `${filename}: invalid audience value(s): ${invalidAudiences.join(", ")}. Allowed: TENANT, HOST, AGENT, ADMIN`
      );
    }
  }

  assert.equal(
    failures.length,
    0,
    `Update note frontmatter validation failed:\n${failures.join("\n")}`
  );
});
