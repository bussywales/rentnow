import test from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  parseUpdateNote,
  resolveRequiredAudiencesFromPaths,
  type UpdateNoteAudience,
} from "@/lib/product-updates/update-notes";

const ROOT = path.resolve(process.cwd(), "..");

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
        "Unable to compute git diff. Ensure origin/main is available or provide at least one commit on this branch."
      );
    }
  }
}

function getChangedFiles(): string[] {
  const cmd = gitDiffCommand();
  const output = execSync(cmd, { cwd: ROOT, encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function isExcluded(pathname: string) {
  if (pathname.startsWith("web/tests/")) return true;
  if (pathname.endsWith(".test.ts") || pathname.endsWith(".spec.ts")) return true;
  if (pathname.startsWith("docs/")) return true;
  if (pathname.startsWith("web/docs/") && !pathname.startsWith("web/docs/updates/")) return true;
  if (pathname === "web/supabase/schema.sql") return true;
  if (pathname === "web/supabase/rls_policies.sql") return true;
  return false;
}

function detectHostRouteReferences(files: string[]): boolean {
  const regex = /(\/host\b|\/dashboard\b)/;
  for (const file of files) {
    if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
    const fullPath = path.join(ROOT, file);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    if (regex.test(content)) return true;
  }
  return false;
}

void test("user-visible changes require update notes", () => {
  const changed = getChangedFiles();
  const updateNoteChanges = changed.filter((file) => file.startsWith("web/docs/updates/"));
  const noUpdate = updateNoteChanges.find((file) => file.endsWith("NO_UPDATE.md"));

  const userVisible = changed.filter(
    (file) => !isExcluded(file) && !file.startsWith("web/docs/updates/")
  );

  if (userVisible.length === 0) {
    assert.ok(true, "No user-visible changes.");
    return;
  }

  if (noUpdate) {
    const content = readFileSync(path.join(ROOT, noUpdate), "utf8");
    const justification = content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");
    assert.ok(
      justification.length >= 12,
      "NO_UPDATE.md must include a short justification line."
    );
    return;
  }

  if (!updateNoteChanges.length) {
    assert.fail(
      "User-visible changes detected but no update note found in web/docs/updates/. Add a note or NO_UPDATE.md."
    );
  }

  const noteFiles = updateNoteChanges.filter(
    (file) => file.endsWith(".md") && !file.endsWith("README.md")
  );
  const audiences = new Set<UpdateNoteAudience>();
  for (const file of noteFiles) {
    if (file.endsWith("NO_UPDATE.md")) continue;
    const raw = readFileSync(path.join(ROOT, file), "utf8");
    const parsed = parseUpdateNote(raw);
    parsed.audiences.forEach((audience) => audiences.add(audience));
  }

  const required = new Set<UpdateNoteAudience>(resolveRequiredAudiencesFromPaths(userVisible));
  if (detectHostRouteReferences(userVisible)) {
    required.add("HOST");
  }

  const missing = Array.from(required).filter((audience) => !audiences.has(audience));
  assert.equal(
    missing.length,
    0,
    `Missing required audiences in update notes: ${missing.join(", ")}. ` +
      "Ensure web/docs/updates/*.md frontmatter includes these audiences."
  );
});
