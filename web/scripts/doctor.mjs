import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const required = { major: 20, minor: 9, patch: 0 };
const detected = process.versions.node;

function parseVersion(version) {
  const [major, minor, patch] = version.split(".").map((part) => Number(part));
  return { major, minor, patch };
}

function isAtLeast(current, minimum) {
  if (current.major !== minimum.major) {
    return current.major > minimum.major;
  }
  if (current.minor !== minimum.minor) {
    return current.minor > minimum.minor;
  }
  return current.patch >= minimum.patch;
}

const current = parseVersion(detected);
if (!isAtLeast(current, required)) {
  console.error(
    `doctor: Node ${detected} detected; require >= ${required.major}.${required.minor}.${required.patch}`
  );
  process.exit(1);
}

console.log(`doctor: Node ${detected}`);

try {
  const npmVersion = execSync("npm --version", { encoding: "utf8" }).trim();
  console.log(`doctor: npm ${npmVersion}`);
} catch {
  console.warn("doctor: npm version unavailable");
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("doctor: WARN NEXT_PUBLIC_SUPABASE_URL is missing");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("doctor: WARN NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
}

const binName = process.platform === "win32" ? "playwright.cmd" : "playwright";
const playwrightBin = path.join(process.cwd(), "node_modules", ".bin", binName);
if (!fs.existsSync(playwrightBin)) {
  console.warn("doctor: WARN Playwright not found. Run `npx playwright install --with-deps`.");
}

console.log("doctor: OK");
