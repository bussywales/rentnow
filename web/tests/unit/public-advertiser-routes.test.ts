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
    contents.includes(".eq(\"public_slug\""),
    "expected /agents/[slug] to resolve via profiles.public_slug"
  );
  assert.ok(
    contents.includes("PublicAdvertiserProfilePage"),
    "expected /agents/[slug] to render the advertiser profile page"
  );
  assert.ok(
    contents.includes("getAgentStorefrontViewModel"),
    "expected /agents/[slug] to preserve storefront fallback behavior"
  );
});
