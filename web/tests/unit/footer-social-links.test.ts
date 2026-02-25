import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FooterSocialLinks } from "@/components/layout/Footer";

void test("footer social section stays hidden when no links are configured", () => {
  const html = renderToStaticMarkup(React.createElement(FooterSocialLinks, { socialLinks: [] }));
  assert.equal(html, "");
});

void test("footer social section renders configured links", () => {
  const html = renderToStaticMarkup(
    React.createElement(FooterSocialLinks, {
      socialLinks: [
        { platform: "instagram", label: "Instagram", href: "https://instagram.com/propatyhub" },
        { platform: "whatsapp", label: "WhatsApp", href: "https://wa.me/2348000000000" },
      ],
    })
  );

  assert.match(html, /Follow us/);
  assert.match(html, /https:\/\/instagram\.com\/propatyhub/);
  assert.match(html, /https:\/\/wa\.me\/2348000000000/);
  assert.match(html, /footer-social-icon-instagram/);
  assert.match(html, /footer-social-icon-whatsapp/);
  assert.match(html, /aria-label="Follow us on Instagram"/);
  assert.match(html, /aria-label="Follow us on WhatsApp"/);
  assert.doesNotMatch(html, />IG</);
  assert.doesNotMatch(html, />WA</);
});
