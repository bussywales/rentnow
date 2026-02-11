import test from "node:test";
import assert from "node:assert/strict";
import {
  getPublicProfileUrl,
  getWhatsAppProfileShareUrl,
} from "@/lib/advertisers/public-share";

void test("getPublicProfileUrl builds /agents/[slug] URL", () => {
  const url = getPublicProfileUrl("https://www.propatyhub.com/", "xthetic-studio-limited");
  assert.equal(url, "https://www.propatyhub.com/agents/xthetic-studio-limited");
});

void test("getWhatsAppProfileShareUrl includes advertiser name when provided", () => {
  const url = getWhatsAppProfileShareUrl(
    "https://www.propatyhub.com",
    "xthetic-studio-limited",
    "Xthetic Studio Limited"
  );
  assert.match(url, /^https:\/\/wa\.me\/\?text=/);
  assert.ok(
    url.includes(
      encodeURIComponent(
        "Hi! View Xthetic Studio Limited's listings on PropatyHub: https://www.propatyhub.com/agents/xthetic-studio-limited"
      )
    )
  );
});

void test("getWhatsAppProfileShareUrl omits name when none provided", () => {
  const url = getWhatsAppProfileShareUrl(
    "https://www.propatyhub.com",
    "xthetic-studio-limited"
  );
  assert.ok(
    url.includes(
      encodeURIComponent(
        "Hi! View listings on PropatyHub: https://www.propatyhub.com/agents/xthetic-studio-limited"
      )
    )
  );
});
