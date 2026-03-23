import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("properties page uses ButtonLink for button-styled navigation actions", () => {
  const sourcePath = path.join(process.cwd(), "app", "properties", "page.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import \{ ButtonLink \} from "@\/components\/ui\/ButtonLink"/);
  assert.doesNotMatch(source, /<Link[\s\S]{0,120}<Button/);
  assert.match(source, /<ButtonLink href="\/dashboard\/saved-searches" size="sm" variant="secondary">/);
  assert.match(source, /<ButtonLink href="\/properties" size="sm">/);
  assert.match(source, /<ButtonLink href="\/dashboard\/properties\/new" variant="secondary">/);
});

void test("properties browse intent banner uses ButtonLink instead of nested Link and Button", () => {
  const sourcePath = path.join(process.cwd(), "components", "properties", "BrowseIntentClient.tsx");
  const source = fs.readFileSync(sourcePath, "utf8");

  assert.match(source, /import \{ ButtonLink \} from "@\/components\/ui\/ButtonLink"/);
  assert.doesNotMatch(source, /<Link[\s\S]{0,80}<Button/);
  assert.match(source, /<ButtonLink href=\{continueHref\} size="sm">/);
});
