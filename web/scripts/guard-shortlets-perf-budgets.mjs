#!/usr/bin/env node

/**
 * Usage:
 * - Default CI scope: node scripts/guard-shortlets-perf-budgets.mjs
 * - Custom root scope: node scripts/guard-shortlets-perf-budgets.mjs --root /abs/path/to/web
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultWebRoot = path.resolve(scriptDir, "..");

const SHORTLETS_GUARDED_SURFACES = [
  "components/shortlets/search/ShortletsSearchCardCarousel.tsx",
  "components/shortlets/search/ShortletsSearchListCard.tsx",
  "components/shortlets/search/ShortletsSearchShell.tsx",
];

const LOADING_PROFILE_FILE = "lib/images/loading-profile.ts";
const MAP_CLUSTERING_FILE = "lib/shortlet/map-clustering.ts";
const MAP_PERF_CONFIG_FILE = "lib/shortlet/map-perf-config.ts";

const MAX_SHORTLETS_PRIORITY_CAP = 6;
const MIN_CLUSTERING_THRESHOLD = 80;

const toPosix = (value) => value.split(path.sep).join("/");

function parseArgs(argv) {
  const options = {
    root: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") {
      options.root = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
}

function resolveLineNumber(content, matchIndex) {
  const prefix = content.slice(0, matchIndex);
  return prefix.split("\n").length;
}

function relativeForReport(webRoot, absolutePath) {
  return `web/${toPosix(path.relative(webRoot, absolutePath))}`;
}

function assertNoDirectEagerPriorityUsage(content) {
  const violations = [];
  const patterns = [
    {
      reason: "Direct Image priority=true is forbidden on guarded shortlets surfaces",
      regex: /<Image[^>]*\bpriority(?:\s*=\s*\{?\s*true\s*\}?)?/g,
    },
    {
      reason: 'Direct loading="eager" is forbidden on guarded shortlets surfaces',
      regex: /\bloading\s*=\s*["']eager["']/g,
    },
    {
      reason: 'Direct fetchPriority="high" is forbidden on guarded shortlets surfaces',
      regex: /\bfetchPriority\s*=\s*["']high["']/g,
    },
  ];

  for (const { reason, regex } of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (typeof match.index !== "number") continue;
      violations.push({
        lineNumber: resolveLineNumber(content, match.index),
        reason,
        match: match[0],
      });
    }
  }

  return violations;
}

function assertShortletsLoadingCap(content) {
  const match = content.match(
    /shortlets_list\s*:\s*{[\s\S]*?desktop\s*:\s*(\d+)[\s\S]*?mobile\s*:\s*(\d+)[\s\S]*?}/m
  );
  if (!match || typeof match.index !== "number") {
    return [
      {
        lineNumber: 1,
        reason: "Unable to find shortlets_list loading profile limits",
        match: "shortlets_list",
      },
    ];
  }

  const desktopLimit = Number.parseInt(match[1], 10);
  const mobileLimit = Number.parseInt(match[2], 10);
  const violations = [];

  if (!Number.isFinite(desktopLimit) || desktopLimit < 1 || desktopLimit > MAX_SHORTLETS_PRIORITY_CAP) {
    violations.push({
      lineNumber: resolveLineNumber(content, match.index),
      reason: `Desktop shortlets priority cap must be between 1 and ${MAX_SHORTLETS_PRIORITY_CAP}`,
      match: `desktop: ${match[1]}`,
    });
  }

  if (!Number.isFinite(mobileLimit) || mobileLimit < 1 || mobileLimit > MAX_SHORTLETS_PRIORITY_CAP) {
    violations.push({
      lineNumber: resolveLineNumber(content, match.index),
      reason: `Mobile shortlets priority cap must be between 1 and ${MAX_SHORTLETS_PRIORITY_CAP}`,
      match: `mobile: ${match[2]}`,
    });
  }

  return violations;
}

function assertClusteringThreshold(content) {
  const match = content.match(/const DEFAULT_CLUSTER_THRESHOLD\s*=\s*(\d+)/);
  if (!match || typeof match.index !== "number") {
    return [
      {
        lineNumber: 1,
        reason: "Unable to find DEFAULT_CLUSTER_THRESHOLD constant",
        match: "DEFAULT_CLUSTER_THRESHOLD",
      },
    ];
  }

  const threshold = Number.parseInt(match[1], 10);
  if (!Number.isFinite(threshold) || threshold < MIN_CLUSTERING_THRESHOLD) {
    return [
      {
        lineNumber: resolveLineNumber(content, match.index),
        reason: `Cluster threshold must stay >= ${MIN_CLUSTERING_THRESHOLD}`,
        match: match[0],
      },
    ];
  }

  return [];
}

function assertClusteringUsesSharedThreshold(content) {
  const sharedThresholdRegex = /options\?\.threshold\s*\?\?\s*SHORTLETS_CLUSTER_THRESHOLD/;
  const enabledRegex = /options\?\.enabled\s*\?\?\s*SHORTLETS_CLUSTER_ENABLED/;
  const violations = [];

  const thresholdMatch = content.match(sharedThresholdRegex);
  if (!thresholdMatch || typeof thresholdMatch.index !== "number") {
    violations.push({
      lineNumber: 1,
      reason: "Map clustering must use SHORTLETS_CLUSTER_THRESHOLD default",
      match: "options?.threshold ?? SHORTLETS_CLUSTER_THRESHOLD",
    });
  }

  const enabledMatch = content.match(enabledRegex);
  if (!enabledMatch || typeof enabledMatch.index !== "number") {
    violations.push({
      lineNumber: 1,
      reason: "Map clustering must use SHORTLETS_CLUSTER_ENABLED default",
      match: "options?.enabled ?? SHORTLETS_CLUSTER_ENABLED",
    });
  }

  return violations;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const webRoot = options.root ? path.resolve(process.cwd(), options.root) : defaultWebRoot;
  const violations = [];

  for (const relativePath of SHORTLETS_GUARDED_SURFACES) {
    const absolutePath = path.resolve(webRoot, relativePath);
    const content = await fs.readFile(absolutePath, "utf8");
    const file = relativeForReport(webRoot, absolutePath);
    for (const violation of assertNoDirectEagerPriorityUsage(content)) {
      violations.push({ file, ...violation });
    }
  }

  {
    const absolutePath = path.resolve(webRoot, LOADING_PROFILE_FILE);
    const content = await fs.readFile(absolutePath, "utf8");
    const file = relativeForReport(webRoot, absolutePath);
    for (const violation of assertShortletsLoadingCap(content)) {
      violations.push({ file, ...violation });
    }
  }

  {
    const absolutePath = path.resolve(webRoot, MAP_PERF_CONFIG_FILE);
    const content = await fs.readFile(absolutePath, "utf8");
    const file = relativeForReport(webRoot, absolutePath);
    for (const violation of assertClusteringThreshold(content)) {
      violations.push({ file, ...violation });
    }
  }

  {
    const absolutePath = path.resolve(webRoot, MAP_CLUSTERING_FILE);
    const content = await fs.readFile(absolutePath, "utf8");
    const file = relativeForReport(webRoot, absolutePath);
    for (const violation of assertClusteringUsesSharedThreshold(content)) {
      violations.push({ file, ...violation });
    }
  }

  if (violations.length > 0) {
    console.error("Shortlets perf budgets guard failed.");
    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.lineNumber} ${violation.reason}: ${violation.match}`
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log("Shortlets perf budgets guard passed.");
}

main().catch((error) => {
  console.error("guard:shortlets-perf failed", error);
  process.exitCode = 1;
});

