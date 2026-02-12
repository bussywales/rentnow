import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const saveButtonPath = resolve(process.cwd(), "components/properties/SaveButton.tsx");

void test("save button keeps modal open state controlled locally", () => {
  const source = readFileSync(saveButtonPath, "utf8");
  assert.match(source, /const \[collectionsOpen, setCollectionsOpen\] = useState\(false\)/);
  assert.match(source, /if \(collectionsOpen \|\| collectionsLoading\) return/);
});

void test("save button prevents duplicate collection mutations and card click bubbling", () => {
  const source = readFileSync(saveButtonPath, "utf8");
  assert.match(source, /membershipMutationRef\.current \|\| createCollectionRef\.current/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /setCollectionsOpen\(true\)/);
});

