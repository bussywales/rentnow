#!/usr/bin/env node

/**
 * Usage:
 * - Default CI scope: node scripts/guard-no-server-getsession.mjs
 * - Custom root scope: node scripts/guard-no-server-getsession.mjs --root /abs/path/to/web
 * - Custom path scope: node scripts/guard-no-server-getsession.mjs --paths pathA,pathB
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultWebRoot = path.resolve(scriptDir, "..");

const excludedRelativePaths = new Set([
  "app/auth/reset/page.tsx",
  "app/auth/confirm/page.tsx",
  "app/onboarding/page.tsx",
  "components/properties/PropertyStepper.tsx",
  "components/properties/PropertyForm.tsx",
]);

const ignoredDirNames = new Set(["node_modules", ".next", "tests", "scripts"]);
const sourceExtensions = new Set([".ts", ".tsx"]);

const forbiddenPatterns = [
  {
    reason: "Forbidden server getSession call detected",
    regex: /\b[a-zA-Z_$][\w$]*\.auth\.getSession\b/,
  },
  {
    reason: "Forbidden server getSession aliasing detected",
    regex:
      /\b(?:const|let|var)\s*\{\s*getSession(?:\s*:\s*[A-Za-z_$][\w$]*)?\s*\}\s*=\s*[A-Za-z_$][\w$]*\.auth\b/,
  },
  {
    reason: "Forbidden server getSession aliasing detected",
    regex:
      /\(\s*\{\s*getSession(?:\s*:\s*[A-Za-z_$][\w$]*)?\s*\}\s*=\s*[A-Za-z_$][\w$]*\.auth\s*\)/,
  },
  {
    reason: "Forbidden server getSession aliasing detected",
    regex: /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*[A-Za-z_$][\w$]*\.auth\.getSession\b/,
  },
  {
    reason: "Forbidden server getSession aliasing detected",
    regex: /\bgetSession\s*=\s*[A-Za-z_$][\w$]*\.auth\.getSession\b/,
  },
  {
    reason: "Forbidden server getSession bracket access detected",
    regex: /\.auth[^\n]*\[['"]getSession['"]\]/,
  },
];

const toPosix = (value) => value.split(path.sep).join("/");

function parseArgs(argv) {
  const options = {
    root: null,
    paths: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--paths") {
      options.paths = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }

  return options;
}

async function pathExists(absolutePath) {
  try {
    await fs.stat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

function isSourceFile(absolutePath) {
  return sourceExtensions.has(path.extname(absolutePath));
}

function isClientFilePath(absolutePath) {
  return path.basename(absolutePath).includes(".client.");
}

function isClientModule(content) {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    return (
      trimmed === '"use client";' ||
      trimmed === "'use client';" ||
      trimmed === '"use client"' ||
      trimmed === "'use client'"
    );
  }
  return false;
}

async function walkDirectory(dirPath, onFile, ignoreDirs = ignoredDirNames) {
  if (!(await pathExists(dirPath))) return;
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoreDirs.has(entry.name)) {
      continue;
    }
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(absolutePath, onFile, ignoreDirs);
      continue;
    }
    await onFile(absolutePath);
  }
}

async function collectDefaultCandidateFiles(webRoot) {
  const files = new Set();
  const addFileIfExists = async (absolutePath) => {
    if (await pathExists(absolutePath)) {
      files.add(absolutePath);
    }
  };

  const appRoot = path.join(webRoot, "app");
  await walkDirectory(appRoot, async (absolutePath) => {
    if (!isSourceFile(absolutePath)) return;
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
    if (!isSourceFile(absolutePath) || isClientFilePath(absolutePath)) return;
    files.add(absolutePath);
  });

  await addFileIfExists(path.join(webRoot, "middleware.ts"));
  await addFileIfExists(path.join(webRoot, "lib", "supabase", "middleware.ts"));

  return Array.from(files).filter((absolutePath) => {
    const relative = toPosix(path.relative(webRoot, absolutePath));
    return !excludedRelativePaths.has(relative);
  });
}

async function collectCustomPathFiles(pathsOption, webRoot) {
  const customPaths = String(pathsOption || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const files = new Set();
  const walkIgnore = new Set(["node_modules", ".next"]);

  for (const customPath of customPaths) {
    const absolutePath = path.isAbsolute(customPath)
      ? customPath
      : path.resolve(webRoot, customPath);
    if (!(await pathExists(absolutePath))) {
      continue;
    }
    const stats = await fs.stat(absolutePath);
    if (stats.isFile()) {
      if (isSourceFile(absolutePath)) files.add(absolutePath);
      continue;
    }
    await walkDirectory(
      absolutePath,
      async (childPath) => {
        if (isSourceFile(childPath)) files.add(childPath);
      },
      walkIgnore
    );
  }

  return Array.from(files);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const webRoot = options.root
    ? path.resolve(process.cwd(), options.root)
    : defaultWebRoot;

  const files = options.paths
    ? await collectCustomPathFiles(options.paths, webRoot)
    : await collectDefaultCandidateFiles(webRoot);
  const violations = [];

  for (const absolutePath of files) {
    if (isClientFilePath(absolutePath)) {
      continue;
    }

    const content = await fs.readFile(absolutePath, "utf8");
    if (isClientModule(content)) {
      continue;
    }

    const lines = content.split("\n");
    lines.forEach((line, index) => {
      forbiddenPatterns.forEach((pattern) => {
        const match = line.match(pattern.regex);
        if (!match) return;

        const relative = `web/${toPosix(path.relative(webRoot, absolutePath))}`;
        violations.push({
          file: relative,
          lineNumber: index + 1,
          reason: pattern.reason,
          match: match[0],
        });
      });
    });
  }

  if (violations.length > 0) {
    console.error("Server-side getSession usage is forbidden. Replace with getUser()-first auth.");
    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.lineNumber} ${violation.reason}: ${violation.match}`
      );
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
