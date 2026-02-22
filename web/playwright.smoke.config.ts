import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const resolvedBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const useLocalServer =
  resolvedBaseURL.includes("localhost") || resolvedBaseURL.includes("127.0.0.1");

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/e2e",
  testMatch: "**/*.smoke.spec.ts",
  reporter: [["line"]],
  fullyParallel: false,
  workers: 1,
  use: {
    ...(baseConfig.use || {}),
    baseURL: resolvedBaseURL,
  },
  ...(useLocalServer
    ? {
        webServer: {
          command: "npm run build && npm run start -- -p 3000",
          url: resolvedBaseURL,
          reuseExistingServer: true,
          timeout: 300_000,
        },
      }
    : {}),
});
