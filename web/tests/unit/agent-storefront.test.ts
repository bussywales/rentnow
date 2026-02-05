import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureUniqueSlug,
  resolveStorefrontAccess,
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

void test("resolveStorefrontAccess handles availability reasons", () => {
  const globalOff = resolveStorefrontAccess({
    slug: "agent",
    globalEnabled: false,
    agentFound: true,
    agentRole: "agent",
    agentEnabled: true,
  });
  assert.deepEqual(globalOff, { ok: false, reason: "GLOBAL_DISABLED" });

  const missingSlug = resolveStorefrontAccess({
    slug: "   ",
    globalEnabled: true,
    agentFound: true,
    agentRole: "agent",
    agentEnabled: true,
  });
  assert.deepEqual(missingSlug, { ok: false, reason: "MISSING_SLUG" });

  const notFound = resolveStorefrontAccess({
    slug: "agent",
    globalEnabled: true,
    agentFound: false,
    agentRole: "agent",
    agentEnabled: true,
  });
  assert.deepEqual(notFound, { ok: false, reason: "NOT_FOUND" });

  const agentOff = resolveStorefrontAccess({
    slug: "agent",
    globalEnabled: true,
    agentFound: true,
    agentRole: "agent",
    agentEnabled: false,
  });
  assert.deepEqual(agentOff, { ok: false, reason: "AGENT_DISABLED" });

  const notAgent = resolveStorefrontAccess({
    slug: "agent",
    globalEnabled: true,
    agentFound: true,
    agentRole: "tenant",
    agentEnabled: true,
  });
  assert.deepEqual(notAgent, { ok: false, reason: "NOT_AGENT" });

  const ok = resolveStorefrontAccess({
    slug: "agent",
    globalEnabled: true,
    agentFound: true,
    agentRole: "agent",
    agentEnabled: true,
  });
  assert.deepEqual(ok, { ok: true });
});
