#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");

const excludedRelativePaths = new Set([
  "app/auth/reset/page.tsx",
  "app/auth/confirm/page.tsx",
  "app/onboarding/page.tsx",
  "components/properties/PropertyStepper.tsx",
  "components/properties/PropertyForm.tsx",
]);

const ignoredDirNames = new Set(["node_modules", ".next", "tests", "scripts"]);
const sourceExtensions = new Set([".ts", ".tsx"]);

const hasAuthGetSessionCall = (line) =>
  /\bsupabase\.auth\.getSession\s*\(/.test(line) ||
  /\bauth\.getSession\s*\(/.test(line) ||
  /\b[a-zA-Z_$][\w$]*auth[\w$]*\.getSession\s*\(/i.test(line);

const toPosix = (value) => value.split(path.sep).join("/");

async function walkDirectory(dirPath, onFile) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredDirNames.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, onFile);
      continue;
    }
    await onFile(absolutePath);
  }
}

async function collectCandidateFiles() {
  const files = new Set();
  const addFileIfExists = async (absolutePath) => {
    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isFile()) {
        files.add(absolutePath);
      }
    } catch {
      // ignore missing files
    }
  };

  const appRoot = path.join(webRoot, "app");
  await walkDirectory(appRoot, async (absolutePath) => {
    const ext = path.extname(absolutePath);
    if (!sourceExtensions.has(ext)) {
      return;
    }
    const relative = toPosix(path.relative(webRoot, absolutePath));
    if (relative.startsWith("app/api/")) {
      files.add(absolutePath);
      return;
    }
    if (relative.endsWith("/route.ts") || relative.endsWith("/route.tsx")) {
      files.add(absolutePath);
    }
  });

  const libRoot = path.join(webRoot, "lib");
  await walkDirectory(libRoot, async (absolutePath) => {
    const ext = path.extname(absolutePath);
    if (!sourceExtensions.has(ext)) {
      return;
    }
    const basename = path.basename(absolutePath);
    if (basename.includes(".client.")) {
      return;
    }
    files.add(absolutePath);
  });

  await addFileIfExists(path.join(webRoot, "middleware.ts"));
  await addFileIfExists(path.join(webRoot, "lib", "supabase", "middleware.ts"));

  return Array.from(files).filter((absolutePath) => {
    const relative = toPosix(path.relative(webRoot, absolutePath));
    return !excludedRelativePaths.has(relative);
  });
}

async function main() {
  const files = await collectCandidateFiles();
  const violations = [];

  for (const absolutePath of files) {
    const content = await fs.readFile(absolutePath, "utf8");
    const lines = content.split("\n");
    lines.forEach((line, index) => {
      if (!hasAuthGetSessionCall(line)) {
        return;
      }
      const relative = `web/${toPosix(path.relative(webRoot, absolutePath))}`;
      violations.push({
        file: relative,
        lineNumber: index + 1,
        line: line.trim(),
      });
    });
  }

  if (violations.length > 0) {
    console.error("Server-side getSession usage is forbidden. Replace with getUser()-first auth.");
    for (const violation of violations) {
      console.error(`${violation.file}:${violation.lineNumber} ${violation.line}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("No server-side getSession usage found.");
}

main().catch((error) => {
  console.error("guard:no-server-getsession failed", error);
  process.exitCode = 1;
});
