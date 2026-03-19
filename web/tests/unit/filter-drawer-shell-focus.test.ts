import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const shellPath = path.join(process.cwd(), "components", "filters", "FilterDrawerShell.tsx");
const panelPath = path.join(process.cwd(), "components", "properties", "AdvancedSearchPanel.tsx");

void test("filter drawer shell keeps a ref to onClose so focus cleanup does not rerun on every parent rerender", () => {
  const source = fs.readFileSync(shellPath, "utf8");

  assert.match(source, /const onCloseRef = useRef\(onClose\)/);
  assert.match(source, /onCloseRef\.current = onClose/);
  assert.match(source, /onCloseRef\.current\(\)/);
  assert.match(source, /\}, \[open\]\)/);
  assert.doesNotMatch(source, /\}, \[onClose, open\]\)/);
});

void test("advanced search panel passes a stable close callback into the filter drawer", () => {
  const source = fs.readFileSync(panelPath, "utf8");

  assert.match(source, /const closeDrawer = useCallback\(\(\) => \{/);
  assert.match(source, /onClose=\{closeDrawer\}/);
  assert.doesNotMatch(source, /onClose=\{\(\) => setOpen\(false\)\}/);
  assert.match(source, /createApplyAndCloseAction\(\(\) => applyDraft\(draft\), closeDrawer\)/);
  assert.match(
    source,
    /createClearApplyAndCloseAction\(createDefaultDraft, setDraft, applyDraft, closeDrawer\)/
  );
});
