import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import AgentServicesHelpPage from "@/app/help/agent/services/page";
import HostServicesHelpPage from "@/app/help/host/services/page";
import MoveReadyServicesPlaybookPage from "@/app/help/admin/support-playbooks/move-ready-services/page";

void test("host move ready help page renders pilot scope and exclusions", () => {
  const html = renderToStaticMarkup(React.createElement(HostServicesHelpPage));
  assert.ok(html.includes("Move &amp; Ready Services is a vetted lead-routing pilot"));
  assert.ok(html.includes("What this does not do yet"));
  assert.ok(html.includes("No public provider browse"));
  assert.ok(html.includes("/host/services/new"));
});

void test("agent help surfaces move ready access without broadening scope", () => {
  const landingSource = fs.readFileSync(
    path.join(process.cwd(), "app", "help", "agent", "page.tsx"),
    "utf8"
  );
  const guideHtml = renderToStaticMarkup(React.createElement(AgentServicesHelpPage));

  assert.ok(landingSource.includes("Move &amp; Ready Services"));
  assert.ok(landingSource.includes("/help/agent/services"));
  assert.ok(guideHtml.includes("delegated portfolio"));
  assert.ok(guideHtml.includes("/host/services"));
  assert.ok(guideHtml.includes("Still a narrow pilot"));
});

void test("admin move ready playbook renders validation gates and escalation rules", () => {
  const html = renderToStaticMarkup(React.createElement(MoveReadyServicesPlaybookPage));
  assert.ok(html.includes("Daily operator checklist"));
  assert.ok(html.includes("Pilot validation gates"));
  assert.ok(html.includes("Escalate immediately when"));
  assert.ok(html.includes("go / iterate / pause"));
});
