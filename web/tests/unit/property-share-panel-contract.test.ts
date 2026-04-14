import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panelPath = "/Users/olubusayoadewale/rentnow/web/components/properties/PropertySharePanel.tsx";
const modalPath = "/Users/olubusayoadewale/rentnow/web/components/properties/PropertySignKitModal.tsx";
const shareRoutePath = "/Users/olubusayoadewale/rentnow/web/app/api/share/property/route.ts";
const sharePagePath = "/Users/olubusayoadewale/rentnow/web/app/share/property/[token]/page.tsx";

void test("property share panel uses the sidebar as a launcher for the qr sign kit", () => {
  const source = readFileSync(panelPath, "utf8");
  assert.match(source, /Private tracked link/);
  assert.match(source, /QR sign kit/);
  assert.match(source, /Open sign kit/);
  assert.match(source, /Live listing safeguard/);
  assert.doesNotMatch(source, /Open QR sign kit/);
  assert.doesNotMatch(source, /xl:grid-cols-\[minmax\(0,1fr\)_240px\]/);
  assert.doesNotMatch(source, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/);
});

void test("property sign kit modal owns preview and export controls", () => {
  const source = readFileSync(modalPath, "utf8");
  assert.match(source, /property-sign-kit-modal/);
  assert.match(source, /previewOptions\.map/);
  assert.match(source, /onPreviewModeChange/);
  assert.match(source, /Export selected format/);
  assert.match(source, /Also export/);
  assert.match(source, /Copy tracked link/);
  assert.match(source, /Live listing safeguard/);
});

void test("share route gates sign kit generation to live listings", () => {
  const source = readFileSync(shareRoutePath, "utf8");
  assert.match(source, /purpose: z\.enum\(\["general", "sign_kit"\]\)\.optional\(\)/);
  assert.match(source, /QR sign kits are available only for live listings/);
  assert.match(source, /isPropertySignKitEligible/);
});

void test("property share page logs qr redirect analytics and preserves attribution params", () => {
  const source = readFileSync(sharePagePath, "utf8");
  assert.match(source, /qr_redirect_succeeded/);
  assert.match(source, /qr_redirect_inactive_listing/);
  assert.match(source, /share_channel: qrAttributed \? "qr" : null/);
  assert.match(source, /utm_campaign/);
});
