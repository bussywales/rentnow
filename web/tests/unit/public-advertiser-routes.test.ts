import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("/u/[id] redirects to canonical /agents/[slug] when slug exists", () => {
  const pagePath = path.join(process.cwd(), "app", "u", "[id]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("permanentRedirect(`/agents/${slug}`)"),
    "expected /u/[id] to redirect to /agents/[slug]"
  );
});

void test("/agents/[slug] resolves advertiser slugs before storefront fallback", () => {
  const pagePath = path.join(process.cwd(), "app", "agents", "[slug]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes(".ilike(\"public_slug\""),
    "expected /agents/[slug] to resolve public_slug case-insensitively"
  );
  assert.ok(
    contents.includes("PublicAdvertiserProfilePage"),
    "expected /agents/[slug] to render the advertiser profile page"
  );
  assert.ok(
    contents.includes("getAgentStorefrontViewModel"),
    "expected /agents/[slug] to preserve storefront fallback behavior"
  );
  assert.ok(
    contents.includes("profile_slug_history"),
    "expected /agents/[slug] to check profile_slug_history redirects"
  );
  assert.ok(
    contents.includes("getPublicAdvertiserFromSlugHistory"),
    "expected /agents/[slug] to resolve old slugs from history"
  );
  assert.ok(
    contents.includes("permanentRedirect(`/agents/${historyLookup.advertiser.publicSlug}`)"),
    "expected old slug matches to redirect to canonical slug"
  );
  assert.ok(
    contents.includes("advertiserLookup?.status === \"non_public_role\""),
    "expected /agents/[slug] to treat non-agent/landlord advertiser slugs as not found"
  );
  assert.ok(
    contents.includes("notFound();"),
    "expected /agents/[slug] to return 404 for tenant slugs"
  );
});

void test("/u/[id] redirect is gated by storefront enabled state", () => {
  const pagePath = path.join(process.cwd(), "app", "u", "[id]", "page.tsx");
  const contents = fs.readFileSync(pagePath, "utf8");

  assert.ok(
    contents.includes("agent_storefront_enabled"),
    "expected /u/[id] to read agent_storefront_enabled before canonical redirect"
  );
  assert.ok(
    contents.includes("const storefrontEnabled"),
    "expected /u/[id] to gate redirect when storefront is disabled"
  );
});
