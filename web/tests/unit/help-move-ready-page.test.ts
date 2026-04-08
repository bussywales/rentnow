import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import HostServicesHelpPage from "@/app/help/host/services/page";
import MoveReadyServicesPlaybookPage from "@/app/help/admin/support-playbooks/move-ready-services/page";

void test("host move ready help page renders pilot scope and exclusions", () => {
  const html = renderToStaticMarkup(React.createElement(HostServicesHelpPage));
  assert.ok(html.includes("Move &amp; Ready Services is a vetted lead-routing pilot"));
  assert.ok(html.includes("What this does not do yet"));
  assert.ok(html.includes("No public provider browse"));
  assert.ok(html.includes("/host/services/new"));
});

void test("admin move ready playbook renders validation gates and escalation rules", () => {
  const html = renderToStaticMarkup(React.createElement(MoveReadyServicesPlaybookPage));
  assert.ok(html.includes("Daily operator checklist"));
  assert.ok(html.includes("Pilot validation gates"));
  assert.ok(html.includes("Escalate immediately when"));
  assert.ok(html.includes("go / iterate / pause"));
});
