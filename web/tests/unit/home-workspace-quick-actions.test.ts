import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("workspace quick actions include role-specific links for agent and landlord", () => {
  const componentPath = path.join(process.cwd(), "components", "home", "WorkspaceQuickActions.tsx");
  const source = fs.readFileSync(componentPath, "utf8");

  assert.match(source, /const AGENT_ACTIONS =/);
  assert.match(source, /href: "\/host\/leads"/);
  assert.match(source, /href: "\/dashboard\/messages"/);
  assert.match(source, /href: "\/profile\/clients"/);

  assert.match(source, /const LANDLORD_ACTIONS =/);
  assert.match(source, /href: "\/host\/bookings"/);
  assert.match(source, /href: "\/host\/calendar"/);
  assert.match(source, /href: "\/host\/earnings"/);
});

void test("home page wires role-aware today summary and quick actions component", () => {
  const pagePath = path.join(process.cwd(), "app", "home", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /getWorkspaceHomePrioritySummary/);
  assert.match(source, /heroPriorityParts/);
  assert.match(source, /<WorkspaceQuickActions role=\{role\} highlights=\{todayHighlights\} \/>/);
  assert.match(source, /role === "agent"/);
  assert.match(source, /role === "landlord"/);
});
