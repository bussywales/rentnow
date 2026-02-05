import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureUniqueSlug,
  resolveStorefrontAvailability,
  slugifyAgentName,
} from "@/lib/agents/agent-storefront";

void test("slugifyAgentName normalizes agent names", () => {
  assert.equal(slugifyAgentName("Jane Doe"), "jane-doe");
  assert.equal(slugifyAgentName("  Lagos & Co.  "), "lagos-co");
  assert.equal(slugifyAgentName(""), "");
  assert.equal(slugifyAgentName(undefined), "");
  assert.equal(slugifyAgentName(null), "");
});

void test("ensureUniqueSlug appends suffix when taken", () => {
  const existing = ["agent", "agent-2", "agent-3"];
  assert.equal(ensureUniqueSlug("agent", existing), "agent-4");
  assert.equal(ensureUniqueSlug("fresh", existing), "fresh");
  assert.equal(ensureUniqueSlug(undefined, existing), "agent-4");
});

void test("resolveStorefrontAvailability handles global and agent toggles", () => {
  const globalOff = resolveStorefrontAvailability({
    globalEnabled: false,
    agentFound: true,
    agentEnabled: true,
  });
  assert.deepEqual(globalOff, { available: false, reason: "global_disabled" });

  const agentOff = resolveStorefrontAvailability({
    globalEnabled: true,
    agentFound: true,
    agentEnabled: false,
  });
  assert.deepEqual(agentOff, { available: false, reason: "agent_disabled" });

  const missing = resolveStorefrontAvailability({
    globalEnabled: true,
    agentFound: false,
    agentEnabled: true,
  });
  assert.deepEqual(missing, { available: false, reason: "not_found" });

  const ok = resolveStorefrontAvailability({
    globalEnabled: true,
    agentFound: true,
    agentEnabled: true,
  });
  assert.deepEqual(ok, { available: true });
});
