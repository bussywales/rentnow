import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  shouldShowLegacyToolsBanner,
  WORKSPACE_LEGACY_BANNER_HIDDEN_KEY,
} from "@/lib/workspace/legacy-banner";

void test("legacy banner shows for agent on dashboard routes", () => {
  assert.equal(
    shouldShowLegacyToolsBanner({
      role: "agent",
      pathname: "/dashboard/leads",
      hidden: false,
    }),
    true
  );
});

void test("legacy banner does not show on host routes", () => {
  assert.equal(
    shouldShowLegacyToolsBanner({
      role: "agent",
      pathname: "/host/bookings",
      hidden: false,
    }),
    false
  );
});

void test("legacy banner stays hidden when local preference is set", () => {
  assert.equal(
    shouldShowLegacyToolsBanner({
      role: "admin",
      pathname: "/dashboard/messages",
      hidden: true,
    }),
    false
  );
});

void test("workspace shell and helper wire legacy banner storage key and render marker", () => {
  const shellSource = fs.readFileSync(
    path.join(process.cwd(), "components", "workspace", "WorkspaceShell.tsx"),
    "utf8"
  );
  const helperSource = fs.readFileSync(
    path.join(process.cwd(), "lib", "workspace", "legacy-banner.ts"),
    "utf8"
  );

  assert.match(shellSource, /workspace-legacy-banner/);
  assert.match(
    helperSource,
    new RegExp(WORKSPACE_LEGACY_BANNER_HIDDEN_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
  assert.match(helperSource, /pathname\.startsWith\("\/dashboard"\)/);
});
