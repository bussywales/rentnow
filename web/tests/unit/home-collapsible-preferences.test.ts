import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildHomeCollapsedStorageKey,
  parseCollapsedPreference,
  readCollapsedPreference,
  toggleCollapsedPreference,
  writeCollapsedPreference,
  type StorageLike,
} from "@/lib/home/collapsible";

function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
  };
}

void test("collapsible preferences default to collapsed when no saved value exists", () => {
  const storage = createMemoryStorage();
  assert.equal(parseCollapsedPreference(null, true), true);
  assert.equal(readCollapsedPreference(storage, "home:test:key", true), true);
});

void test("collapsible preferences can restore expanded state from storage", () => {
  const storage = createMemoryStorage({ "home:test:key": "0" });
  assert.equal(parseCollapsedPreference("0", true), false);
  assert.equal(readCollapsedPreference(storage, "home:test:key", true), false);
});

void test("toggle helper flips collapsed state and persists storage value", () => {
  const storage = createMemoryStorage();
  writeCollapsedPreference(storage, "home:test:key", true);
  assert.equal(readCollapsedPreference(storage, "home:test:key", false), true);

  const expanded = toggleCollapsedPreference(storage, "home:test:key", true);
  assert.equal(expanded, false);
  assert.equal(readCollapsedPreference(storage, "home:test:key", true), false);

  const collapsedAgain = toggleCollapsedPreference(storage, "home:test:key", false);
  assert.equal(collapsedAgain, true);
  assert.equal(readCollapsedPreference(storage, "home:test:key", false), true);
});

void test("home collapsible storage keys are scoped by role and user", () => {
  const landlordKey = buildHomeCollapsedStorageKey({
    role: "landlord",
    userId: "host_1",
    section: "workspace-tools",
    version: "v2",
  });
  const agentKey = buildHomeCollapsedStorageKey({
    role: "agent",
    userId: "agent_1",
    section: "workspace-tools",
    version: "v2",
  });

  assert.equal(landlordKey, "home:landlord:host_1:workspace-tools:collapsed:v2");
  assert.equal(agentKey, "home:agent:agent_1:workspace-tools:collapsed:v2");
  assert.notEqual(landlordKey, agentKey);
});

void test("home pages wire role-specific localStorage keys for collapsible sections", () => {
  const tenantPath = path.join(process.cwd(), "app", "tenant", "home", "page.tsx");
  const hostPath = path.join(process.cwd(), "app", "host", "page.tsx");
  const homePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const hostDashboardPath = path.join(process.cwd(), "components", "host", "HostDashboardContent.tsx");

  const tenantContents = fs.readFileSync(tenantPath, "utf8");
  const hostContents = fs.readFileSync(hostPath, "utf8");
  const homeContents = fs.readFileSync(homePath, "utf8");
  const hostDashboardContents = fs.readFileSync(hostDashboardPath, "utf8");

  assert.match(tenantContents, /home:tenant:getting-started:collapsed:v1/);
  assert.match(tenantContents, /home:tenant:insights:collapsed:v1/);
  assert.match(tenantContents, /HomeCollapsibleSection/);

  assert.match(hostContents, /home:host:getting-started:collapsed:v1/);
  assert.match(hostContents, /home:host:trust-status:collapsed:v1/);
  assert.match(hostContents, /HomeCollapsibleSection/);

  assert.match(homeContents, /buildHomeCollapsedStorageKey/);
  assert.match(homeContents, /section: "workspace-tools"/);
  assert.match(homeContents, /section: "getting-started"/);
  assert.match(homeContents, /section: "snapshot"/);
  assert.match(homeContents, /section: "analytics-preview"/);
  assert.match(homeContents, /section: "demand-alerts"/);
  assert.match(homeContents, /section: "ops-diagnostics"/);
  assert.match(homeContents, /version: "v2"/);
  assert.match(homeContents, /HomeCollapsibleSection/);
  assert.match(homeContents, /HostGettingStartedSection/);

  assert.match(hostDashboardContents, /panelKey="demand_alerts"/);
  assert.match(hostDashboardContents, /panelKey="analytics_preview"/);
  assert.match(hostDashboardContents, /HostHomePanel/);
});
