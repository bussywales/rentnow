import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HostIdentityBlock } from "@/components/properties/HostIdentityBlock";

void test("host identity fallback never renders raw UUIDs", () => {
  const ownerId = "3b228727-f80a-4abc-b4d3-4de9916b1c34";
  const html = renderToStaticMarkup(
    createElement(HostIdentityBlock, {
      hostProfileIsPublicAdvertiser: false,
      ownerId,
      hostProfileHref: null,
      hostProfileName: null,
    })
  );

  assert.ok(html.includes("Host profile private"));
  assert.ok(html.includes("chosen not to display their profile publicly"));
  assert.equal(html.includes("Host ID"), false);
  assert.equal(html.includes("UUID"), false);
  assert.equal(html.includes("3b228727-f80a-4abc"), false);
});

void test("public host identity still links to advertiser profile without exposing fallback copy", () => {
  const html = renderToStaticMarkup(
    createElement(HostIdentityBlock, {
      hostProfileIsPublicAdvertiser: true,
      ownerId: "3b228727-f80a-4abc-b4d3-4de9916b1c34",
      hostProfileHref: "/u/host-123",
      hostProfileName: "Ada Homes",
    })
  );

  assert.ok(html.includes("Ada Homes"));
  assert.ok(html.includes('href="/u/host-123"'));
  assert.equal(html.includes("Host profile private"), false);
  assert.equal(html.includes("Host ID"), false);
});
