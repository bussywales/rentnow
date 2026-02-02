import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BRAND_NAME, BRAND_SHORT_NAME } from "@/lib/brand";

const TARGET_FILES = [
  path.join(process.cwd(), "components", "layout", "MainNav.tsx"),
  path.join(process.cwd(), "components", "layout", "Footer.tsx"),
  path.join(process.cwd(), "app", "auth", "required", "page.tsx"),
];

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function extractStringLiterals(source: string) {
  const literals: string[] = [];
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === "'" || char === '"' || char === "`") {
      const quote = char;
      let j = i + 1;
      let value = "";
      while (j < source.length) {
        const current = source[j];
        if (current === "\\" && j + 1 < source.length) {
          value += source[j + 1];
          j += 2;
          continue;
        }
        if (current === quote) break;
        value += current;
        j += 1;
      }
      literals.push(value);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return literals;
}

void test("branding copy removes RentNow references from key UI surfaces", () => {
  const combined = TARGET_FILES.map(read).join("\n");
  const literalText = extractStringLiterals(combined).join("\n");
  const renderedText = `${BRAND_NAME}\n${BRAND_SHORT_NAME}\n${literalText}`.toLowerCase();

  assert.ok(!renderedText.includes("rentnow"), "did not expect RentNow branding in UI copy");
});
