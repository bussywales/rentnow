import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPropertyPublicPath,
  buildPropertyPublicShareUrl,
  buildPropertyShareMeta,
  buildPropertyWhatsappShareUrl,
} from "@/lib/properties/public-share";

void test("buildPropertyPublicShareUrl composes /properties/[id] URLs", () => {
  const propertyId = "4f3471f3-df8f-4203-b19d-8555a751bf7f";
  assert.equal(
    buildPropertyPublicPath(propertyId),
    "/properties/4f3471f3-df8f-4203-b19d-8555a751bf7f"
  );
  assert.equal(
    buildPropertyPublicShareUrl(propertyId, "https://www.propatyhub.com/"),
    "https://www.propatyhub.com/properties/4f3471f3-df8f-4203-b19d-8555a751bf7f"
  );
});

void test("buildPropertyWhatsappShareUrl encodes message payload", () => {
  const url = buildPropertyWhatsappShareUrl("https://www.propatyhub.com/properties/abc123");
  assert.match(url, /^https:\/\/wa\.me\/\?text=/);
  assert.ok(url.includes(encodeURIComponent("https://www.propatyhub.com/properties/abc123")));
});

void test("buildPropertyShareMeta includes channel and surface", () => {
  const meta = buildPropertyShareMeta({
    channel: "copy",
    surface: "property_card",
  });
  assert.deepEqual(meta, {
    source: "public_share",
    channel: "copy",
    surface: "property_card",
  });
});
