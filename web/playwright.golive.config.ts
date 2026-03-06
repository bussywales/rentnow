import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const resolvedBaseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const useLocalServer =
  resolvedBaseURL.includes("localhost") || resolvedBaseURL.includes("127.0.0.1");

const goLiveSmokeSpecMatch = [
  "**/shortlets.desktop.map.smoke.spec.ts",
  "**/shortlets.mobile.smoke.spec.ts",
  "**/home.mobile.quicksearch.smoke.spec.ts",
  "**/mobile.nav.dock.smoke.spec.ts",
  "**/home.mobile.featured.smoke.spec.ts",
  "**/explore.labs.smoke.spec.ts",
  "**/explore.v2.smoke.spec.ts",
  "**/collections.mobile.smoke.spec.ts",
  "**/saved.mobile.smoke.spec.ts",
  "**/property.booking.calendar.smoke.spec.ts",
  "**/property.video.hero.smoke.spec.ts",
  "**/shortlet.payment-return.smoke.spec.ts",
  "**/host.bookings.smoke.spec.ts",
  "**/host.calendar.smoke.spec.ts",
  "**/internal.reminders.smoke.spec.ts",
  "**/push.api.auth.smoke.spec.ts",
  "**/support.widget.escalation.smoke.spec.ts",
  "**/admin.support.ops.smoke.spec.ts",
];

export default defineConfig({
  ...baseConfig,
  testDir: "./tests/e2e",
  testMatch: goLiveSmokeSpecMatch,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
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
