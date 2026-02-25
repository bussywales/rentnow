import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/agents mounts directory client with server-seeded verified results", () => {
  const pagePath = path.join(process.cwd(), "app", "agents", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /searchAgentsDirectory/);
  assert.match(source, /verifiedOnly:\s*true/);
  assert.match(source, /<AgentsDirectoryClient initialData=\{initialData\} \/>/);
});

void test("agents directory client performs debounced search and renders MVP states", () => {
  const clientPath = path.join(process.cwd(), "components", "agents", "AgentsDirectoryClient.tsx");
  const source = fs.readFileSync(clientPath, "utf8");

  assert.match(source, /REQUEST_DEBOUNCE_MS/);
  assert.match(source, /setTimeout\(async \(\) =>/);
  assert.match(source, /fetch\(`\/api\/agents\/search\?/);
  assert.match(source, /data-testid="agents-directory-page"/);
  assert.match(source, /data-testid="agents-directory-filters"/);
  assert.match(source, /data-testid="agents-directory-results"/);
  assert.match(source, /No verified agents yet/);
  assert.match(source, /href="\/properties"/);
  assert.match(source, /href="\/account\/verification"/);
});

void test("agent cards preserve public profile routing and verified trust signal", () => {
  const cardPath = path.join(process.cwd(), "components", "agents", "AgentCard.tsx");
  const source = fs.readFileSync(cardPath, "utf8");

  assert.match(source, /data-testid="agents-directory-card"/);
  assert.match(source, /View profile/);
  assert.match(source, /Verified/);
  assert.match(source, /href=\{agent\.href\}/);
});
