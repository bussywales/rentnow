import test from "node:test";
import assert from "node:assert/strict";
import { resolveBrandSocialLinks } from "@/lib/brand-socials";

void test("resolveBrandSocialLinks returns empty list when nothing is configured", () => {
  const links = resolveBrandSocialLinks({});
  assert.equal(links.length, 0);
});

void test("resolveBrandSocialLinks normalizes http links and whatsapp number", () => {
  const links = resolveBrandSocialLinks({
    instagram: "instagram.com/propatyhub",
    youtube: "https://youtube.com/@propatyhub",
    whatsapp: "234 801 234 5678",
  });

  assert.deepEqual(
    links.map((link) => link.platform),
    ["instagram", "youtube", "whatsapp"]
  );
  assert.equal(links[0]?.href, "https://instagram.com/propatyhub");
  assert.equal(links[1]?.href, "https://youtube.com/@propatyhub");
  assert.equal(links[2]?.href, "https://wa.me/2348012345678");
});

void test("resolveBrandSocialLinks drops invalid links", () => {
  const links = resolveBrandSocialLinks({
    tiktok: "not a valid url",
    whatsapp: "12345",
  });
  assert.equal(links.length, 0);
});
