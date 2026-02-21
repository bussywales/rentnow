#!/usr/bin/env node

/**
 * Usage:
 * - Default CI scope: node scripts/guard-next-image-optimisation.mjs
 * - Custom root scope: node scripts/guard-next-image-optimisation.mjs --root /abs/path/to/web
 * - Custom path scope: node scripts/guard-next-image-optimisation.mjs --paths pathA,pathB
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultWebRoot = path.resolve(scriptDir, "..");

const defaultRelativePaths = [
  "next.config.ts",
  "components/shortlets/search/ShortletsSearchListCard.tsx",
  "components/shortlets/search/ShortletsSearchMap.client.tsx",
  "components/properties/PropertyImageCarousel.tsx",
  "components/properties/PropertyGallery.tsx",
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

async function resolveScanTargets(options, webRoot) {
  if (options.paths) {
    const entries = String(options.paths)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const targets = [];
    for (const entry of entries) {
      const absolutePath = path.isAbsolute(entry) ? entry : path.resolve(webRoot, entry);
      if (await pathExists(absolutePath)) targets.push(absolutePath);
    }
    return targets;
  }

  const targets = [];
  for (const relativePath of defaultRelativePaths) {
    const absolutePath = path.resolve(webRoot, relativePath);
    if (await pathExists(absolutePath)) targets.push(absolutePath);
  }
  return targets;
}

function resolveLineNumber(content, matchIndex) {
  const prefix = content.slice(0, matchIndex);
  return prefix.split("\n").length;
}

function relativeForReport(webRoot, absolutePath) {
  return `web/${toPosix(path.relative(webRoot, absolutePath))}`;
}

function checkNextConfig(content) {
  const match = content.match(/\bunoptimized\s*:\s*true\b/);
  if (!match || typeof match.index !== "number") return null;
  return {
    lineNumber: resolveLineNumber(content, match.index),
    reason: "Forbidden Next image fallback detected",
    match: match[0],
  };
}

function checkRawImgUsage(content) {
  const violations = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/<img(?=\s|>)/i);
    if (!match) continue;
    violations.push({
      lineNumber: index + 1,
      reason: "Raw <img> detected on guarded image surface",
      match: match[0],
    });
  }
  return violations;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const webRoot = options.root ? path.resolve(process.cwd(), options.root) : defaultWebRoot;
  const targets = await resolveScanTargets(options, webRoot);
  const violations = [];

  for (const absolutePath of targets) {
    const content = await fs.readFile(absolutePath, "utf8");
    const basename = path.basename(absolutePath).toLowerCase();

    if (basename.startsWith("next.config.")) {
      const violation = checkNextConfig(content);
      if (violation) {
        violations.push({
          file: relativeForReport(webRoot, absolutePath),
          ...violation,
        });
      }
      continue;
    }

    for (const violation of checkRawImgUsage(content)) {
      violations.push({
        file: relativeForReport(webRoot, absolutePath),
        ...violation,
      });
    }
  }

  if (violations.length > 0) {
    console.error("Next image optimisation guard failed.");
    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.lineNumber} ${violation.reason}: ${violation.match}`
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log("Next image optimisation guard passed.");
}

main().catch((error) => {
  console.error("guard:next-image-optimisation failed", error);
  process.exitCode = 1;
});
