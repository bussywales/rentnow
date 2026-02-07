import test from "node:test";
import assert from "node:assert/strict";
import { filterLeadsByClientPage, canAccessClientPageInbox } from "@/lib/agents/client-page-inbox";

void test("filterLeadsByClientPage keeps only matching attributions", () => {
  const leads = [
    { id: "lead-1", lead_attributions: [{ client_page_id: "page-1" }] },
    { id: "lead-2", lead_attributions: [{ client_page_id: "page-2" }] },
    { id: "lead-3", lead_attributions: [] },
  ];

  const filtered = filterLeadsByClientPage(leads, "page-1");
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "lead-1");
});

void test("canAccessClientPageInbox gates by owner", () => {
  assert.equal(
    canAccessClientPageInbox({ viewerId: "agent-1", clientPageOwnerId: "agent-1" }),
    true
  );
  assert.equal(
    canAccessClientPageInbox({ viewerId: "agent-1", clientPageOwnerId: "agent-2" }),
    false
  );
});
