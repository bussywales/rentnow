import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

const cwd = process.cwd();
loadEnvConfig(cwd);

const envFile = process.env.PLAYWRIGHT_ENV_FILE;
if (envFile) {
  const resolvedPath = path.isAbsolute(envFile) ? envFile : path.join(cwd, envFile);
  if (fs.existsSync(resolvedPath)) {
    const contents = fs.readFileSync(resolvedPath, "utf8");
    contents.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) return;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  }
}

const resolvedBaseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";
const isLocalBaseURL =
  resolvedBaseURL.includes("localhost") || resolvedBaseURL.includes("127.0.0.1");
const useLocalServer = !process.env.PLAYWRIGHT_BASE_URL && isLocalBaseURL;
const webServerEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => typeof value === "string")
) as Record<string, string>;

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  ...(useLocalServer
    ? {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120_000,
          env: {
            ...webServerEnv,
          },
        },
      }
    : {}),
  use: {
    baseURL: resolvedBaseURL,
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
