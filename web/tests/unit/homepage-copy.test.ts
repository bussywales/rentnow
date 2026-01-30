import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

void test("homepage copy is customer-first and removes tech stack references", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const smartSearchPath = path.join(
    process.cwd(),
    "components",
    "properties",
    "SmartSearchBox.tsx"
  );
  const pageContents = read(pagePath);
  const smartContents = read(smartSearchPath);
  const combined = `${pageContents}\n${smartContents}`;

  const extractStringLiterals = (source: string) => {
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
          if (current === quote) {
            break;
          }
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
  };

  const literalText = extractStringLiterals(combined).join("\n");
  const containsLiteral = (token: string) => literalText.includes(token);

  assert.ok(
    !containsLiteral("Tech stack"),
    "did not expect Tech stack copy on homepage"
  );
  assert.ok(
    !containsLiteral("Next.js"),
    "did not expect Next.js mention on homepage"
  );
  assert.ok(
    !containsLiteral("Supabase"),
    "did not expect Supabase mention on homepage"
  );
  assert.ok(
    !containsLiteral("OpenAI"),
    "did not expect OpenAI mention on homepage"
  );
});

void test("homepage trust block renders required copy", () => {
  const pagePath = path.join(process.cwd(), "app", "page.tsx");
  const contents = read(pagePath);

  assert.ok(contents.includes("Built for trust"), "expected trust block title");
  assert.ok(
    contents.includes("Verified hosts and agents"),
    "expected verified hosts bullet"
  );
  assert.ok(
    contents.includes("Secure in-app messaging"),
    "expected secure messaging bullet"
  );
  assert.ok(
    contents.includes("Admin-reviewed listings"),
    "expected admin-reviewed bullet"
  );
  assert.ok(
    contents.includes("No hidden fees or forced contact"),
    "expected no hidden fees bullet"
  );
});
