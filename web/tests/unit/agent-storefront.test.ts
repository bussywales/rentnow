import test from "node:test";
import assert from "node:assert/strict";
import {
  ensureUniqueSlug,
  resolveAgentSlugBase,
  resolveLegacySlugRedirect,
  resolveStorefrontAccess,
  resolveStorefrontPublicOutcome,
  resolveStorefrontOwnerId,
  shouldEnsureAgentSlug,
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

void test("agent slug helpers keep slug stable and ensure when missing", () => {
  assert.equal(
    resolveAgentSlugBase({
      currentSlug: "stable-slug",
      displayName: "New Name",
      userId: "user-1234",
    }),
    "stable-slug"
  );
  assert.equal(
    resolveAgentSlugBase({
      currentSlug: null,
      displayName: "Jane Doe",
      userId: "user-1234",
    }),
    "jane-doe"
  );
  assert.equal(
    resolveAgentSlugBase({
      currentSlug: null,
      displayName: "",
      userId: "user-1234",
    }),
    "agent-user-123"
  );
  assert.equal(shouldEnsureAgentSlug({ enabled: true, slug: null }), true);
  assert.equal(shouldEnsureAgentSlug({ enabled: false, slug: null }), false);
});

void test("legacy slug redirect resolves to stored slug", () => {
  const redirect = resolveLegacySlugRedirect({
    requestedSlug: "jane-doe",
    profile: { agent_slug: "jane-co", display_name: "Jane Doe" },
  });
  assert.equal(redirect, "jane-co");
  const noRedirect = resolveLegacySlugRedirect({
    requestedSlug: "jane-co",
    profile: { agent_slug: "jane-co", display_name: "Jane Doe" },
  });
  assert.equal(noRedirect, null);
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

void test("resolveStorefrontPublicOutcome handles global disabled and ok", () => {
  const globalOff = resolveStorefrontPublicOutcome({
    ok: false,
    reason: "GLOBAL_DISABLED",
  });
  assert.deepEqual(globalOff, { ok: false, reason: "GLOBAL_DISABLED" });

  const ok = resolveStorefrontPublicOutcome({
    ok: true,
    reason: "OK",
  });
  assert.deepEqual(ok, { ok: true });
});

void test("resolveStorefrontPublicOutcome handles missing storefront rows", () => {
  assert.deepEqual(resolveStorefrontPublicOutcome(null), {
    ok: false,
    reason: "NOT_FOUND",
  });
});

void test("resolveStorefrontOwnerId prefers agent_user_id from public row", () => {
  const ownerId = resolveStorefrontOwnerId({ agent_user_id: "agent-123" });
  assert.equal(ownerId, "agent-123");
  assert.equal(resolveStorefrontOwnerId(null), "");
});
