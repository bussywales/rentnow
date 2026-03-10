import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("app settings keys include listings auto-approve toggle", () => {
  const keysPath = path.join(process.cwd(), "lib", "settings", "app-settings-keys.ts");
  const source = fs.readFileSync(keysPath, "utf8");

  assert.match(source, /listingsAutoApproveEnabled:\s*"listings_auto_approve_enabled"/);
  assert.match(source, /exploreEnabled:\s*"explore_enabled"/);
  assert.match(source, /exploreV2TrustCueEnabled:\s*"explore_v2_trust_cue_enabled"/);
});

void test("app settings keys include brand social links", () => {
  const keysPath = path.join(process.cwd(), "lib", "settings", "app-settings-keys.ts");
  const source = fs.readFileSync(keysPath, "utf8");

  assert.match(source, /brandSocialInstagramUrl:\s*"brand_social_instagram_url"/);
  assert.match(source, /brandSocialYoutubeUrl:\s*"brand_social_youtube_url"/);
  assert.match(source, /brandSocialTiktokUrl:\s*"brand_social_tiktok_url"/);
  assert.match(source, /brandSocialFacebookUrl:\s*"brand_social_facebook_url"/);
  assert.match(source, /brandSocialWhatsappLink:\s*"brand_social_whatsapp_link"/);
});

void test("admin settings page loads listings auto-approve toggle data", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "settings", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /APP_SETTING_KEYS\.listingsAutoApproveEnabled/);
  assert.match(source, /APP_SETTING_KEYS\.exploreEnabled/);
  assert.match(source, /APP_SETTING_KEYS\.exploreV2TrustCueEnabled/);
});

void test("admin settings page loads brand social links section data", () => {
  const pagePath = path.join(process.cwd(), "app", "admin", "settings", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.match(source, /AdminSettingsBrandSocials/);
  assert.match(source, /APP_SETTING_KEYS\.brandSocialInstagramUrl/);
  assert.match(source, /APP_SETTING_KEYS\.brandSocialYoutubeUrl/);
  assert.match(source, /APP_SETTING_KEYS\.brandSocialTiktokUrl/);
  assert.match(source, /APP_SETTING_KEYS\.brandSocialFacebookUrl/);
  assert.match(source, /APP_SETTING_KEYS\.brandSocialWhatsappLink/);
});

void test("admin feature flags UI renders listings auto-approve label", () => {
  const uiPath = path.join(process.cwd(), "components", "admin", "AdminSettingsFeatureFlags.tsx");
  const source = fs.readFileSync(uiPath, "utf8");

  assert.match(source, /Listings auto-approve on submit/);
  assert.match(source, /APP_SETTING_KEYS\.listingsAutoApproveEnabled/);
  assert.match(source, /Explore feed availability/);
  assert.match(source, /APP_SETTING_KEYS\.exploreEnabled/);
  assert.match(source, /Explore V2 trust cue experiment/);
  assert.match(source, /APP_SETTING_KEYS\.exploreV2TrustCueEnabled/);
});

void test("admin brand socials UI renders social fields", () => {
  const uiPath = path.join(process.cwd(), "components", "admin", "AdminSettingsBrandSocials.tsx");
  const source = fs.readFileSync(uiPath, "utf8");

  assert.match(source, /Brand &amp; Socials/);
  assert.match(source, /Instagram URL/);
  assert.match(source, /YouTube URL/);
  assert.match(source, /TikTok URL/);
  assert.match(source, /Facebook URL/);
  assert.match(source, /WhatsApp link or number/);
});
