#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");

const GUARDED_DIRECTORIES = [
  "app/admin",
  "components/admin",
  "app/explore",
  "app/explore-v2",
  "components/explore",
  "components/explore-v2",
  "app/home",
  "app/dashboard",
  "app/tenant/home",
  "components/dashboard",
  "components/home",
];

const ALLOWLIST = new Set(["components/ui/SafeImage.tsx"]);

const SOURCE_FILE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
]);

const NEXT_IMAGE_IMPORT_PATTERNS = [
  /\bfrom\s+["']next\/image["']/, 
  /\brequire\(\s*["']next\/image["']\s*\)/,
];

async function collectFilesRecursively(directoryPath) {
  const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const dirent of dirents) {
    const entryPath = path.join(directoryPath, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await collectFilesRecursively(entryPath)));
      continue;
    }

    if (!dirent.isFile()) {
      continue;
    }

    if (!SOURCE_FILE_EXTENSIONS.has(path.extname(dirent.name))) {
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

function normalizeRelativePath(filePath) {
  return path.relative(webRoot, filePath).split(path.sep).join("/");
}

async function findOffendingImports(filePath) {
  const relativePath = normalizeRelativePath(filePath);
  if (ALLOWLIST.has(relativePath)) {
    return [];
  }

  const source = await fs.readFile(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  const offenders = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const matchesImport = NEXT_IMAGE_IMPORT_PATTERNS.some((pattern) =>
      pattern.test(line)
    );
    if (!matchesImport) {
      continue;
    }

    offenders.push({
      file: `web/${relativePath}`,
      line: index + 1,
      importLine: line.trim(),
    });
  }

  return offenders;
}

async function main() {
  const allOffenders = [];

  for (const relativeDirectory of GUARDED_DIRECTORIES) {
    const absoluteDirectory = path.join(webRoot, relativeDirectory);
    try {
      const stats = await fs.stat(absoluteDirectory);
      if (!stats.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const files = await collectFilesRecursively(absoluteDirectory);
    for (const filePath of files) {
      const offenders = await findOffendingImports(filePath);
      allOffenders.push(...offenders);
    }
  }

  if (allOffenders.length === 0) {
    console.log("check:no-next-image passed");
    return;
  }

  for (const offender of allOffenders) {
    console.error(`${offender.file}:${offender.line}: ${offender.importLine}`);
  }
  console.error("Use SafeImage instead of next/image in guarded areas.");
  process.exit(1);
}

await main();
