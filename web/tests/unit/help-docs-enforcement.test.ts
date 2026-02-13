import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "..");
const HELP_DOCS_DIR = "web/docs/help/";
const HELP_NO_CHANGE_FILE = "web/docs/help/_no-help-change.md";
const HELP_DOC_EXCLUDED = new Set([
  "web/docs/help/README.md",
  "web/docs/help/_TEMPLATE.md",
  HELP_NO_CHANGE_FILE,
]);

const KEY_AREA_PREFIXES = ["web/app/api/", "web/components/", "web/lib/", "web/supabase/"];

function gitDiffCommand(): string {
  try {
    execSync("git diff --name-only origin/main...HEAD", { cwd: ROOT, stdio: "ignore" });
    return "git diff --name-only origin/main...HEAD";
  } catch {
    try {
      execSync("git diff --name-only HEAD~1...HEAD", { cwd: ROOT, stdio: "ignore" });
      return "git diff --name-only HEAD~1...HEAD";
    } catch {
      throw new Error(
        "Unable to compute git diff for help-docs enforcement. Ensure origin/main or HEAD~1 is available."
      );
    }
  }
}

function getChangedFiles(): string[] {
  const output = execSync(gitDiffCommand(), { cwd: ROOT, encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasHelpJustificationEntry(): boolean {
  const fullPath = path.join(ROOT, HELP_NO_CHANGE_FILE);
  if (!existsSync(fullPath)) return false;
  const lines = readFileSync(fullPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));

  return lines.some((line) => /\d{4}-\d{2}-\d{2}/.test(line) && line.length >= 20);
}

void test("code changes in key areas require help docs update or justification", () => {
  const changed = getChangedFiles();

  const keyAreaChanged = changed.filter((file) =>
    KEY_AREA_PREFIXES.some((prefix) => file.startsWith(prefix))
  );

  if (keyAreaChanged.length === 0) {
    assert.ok(true, "No key-area code changes detected.");
    return;
  }

  const helpDocChanges = changed.filter(
    (file) => file.startsWith(HELP_DOCS_DIR) && !HELP_DOC_EXCLUDED.has(file)
  );

  if (helpDocChanges.length > 0) {
    assert.ok(true, "Help docs updated for key-area changes.");
    return;
  }

  const noHelpFileChanged = changed.includes(HELP_NO_CHANGE_FILE);
  if (noHelpFileChanged && hasHelpJustificationEntry()) {
    assert.ok(true, "No-help-change justification supplied.");
    return;
  }

  assert.fail(
    [
      "Key-area code changes were detected without corresponding help-doc updates.",
      `Changed key-area files:\n- ${keyAreaChanged.join("\n- ")}`,
      `Expected at least one change under ${HELP_DOCS_DIR} (excluding README/template)`,
      `or a dated justification entry in ${HELP_NO_CHANGE_FILE}.`,
    ].join("\n\n")
  );
});
