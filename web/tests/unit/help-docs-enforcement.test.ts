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

const WATCH_ROOT_PREFIXES = ["web/app/", "web/components/", "web/lib/"];
const WATCH_AREA_KEYWORDS = [
  "saved-search",
  "saved-searches",
  "featured",
  "payments",
  "verification",
  "product-updates",
];

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

function isTemplateHelpDoc(file: string): boolean {
  return file.startsWith(HELP_DOCS_DIR) && /\/_TEMPLATE[^/]*\.md$/i.test(file);
}

function hasTodayHelpJustificationEntry(today: string): boolean {
  const fullPath = path.join(ROOT, HELP_NO_CHANGE_FILE);
  if (!existsSync(fullPath)) return false;
  const lines = readFileSync(fullPath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));

  return lines.some((line) => {
    if (!line.includes(today)) return false;
    if (line.length < 24) return false;
    const withoutDate = line.replace(today, "").trim();
    return withoutDate.length >= 8;
  });
}

function isWatchedFeatureFile(file: string): boolean {
  if (!WATCH_ROOT_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  const lower = file.toLowerCase();
  return WATCH_AREA_KEYWORDS.some((keyword) => lower.includes(keyword));
}

void test("code changes in key areas require help docs update or justification", () => {
  const changed = getChangedFiles();
  const today = new Date().toISOString().slice(0, 10);

  const keyAreaChanged = changed.filter((file) => isWatchedFeatureFile(file));

  if (keyAreaChanged.length === 0) {
    assert.ok(true, "No key-area code changes detected.");
    return;
  }

  const helpDocChanges = changed.filter(
    (file) =>
      file.startsWith(HELP_DOCS_DIR) &&
      !HELP_DOC_EXCLUDED.has(file) &&
      !isTemplateHelpDoc(file)
  );

  if (helpDocChanges.length > 0) {
    assert.ok(true, "Help docs updated for key-area changes.");
    return;
  }

  const noHelpFileChanged = changed.includes(HELP_NO_CHANGE_FILE);
  if (noHelpFileChanged && hasTodayHelpJustificationEntry(today)) {
    assert.ok(true, "No-help-change justification supplied.");
    return;
  }

  assert.fail(
    [
      "Key-area code changes were detected without corresponding help-doc updates.",
      `Changed key-area files:\n- ${keyAreaChanged.join("\n- ")}`,
      `Expected at least one change under ${HELP_DOCS_DIR} (excluding README/template)`,
      `or a same-day (${today}) justification entry in ${HELP_NO_CHANGE_FILE}.`,
    ].join("\n\n")
  );
});
