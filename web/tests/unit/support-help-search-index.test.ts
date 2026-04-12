import test from "node:test";
import assert from "node:assert/strict";
import {
  getSupportHelpIndexForTest,
  resetSupportHelpIndexForTest,
  searchSupportHelpDocs,
} from "@/lib/support/help-search";

test.beforeEach(() => {
  resetSupportHelpIndexForTest();
});

void test("support help index excludes admin-only help docs", async () => {
  const docs = await getSupportHelpIndexForTest();
  assert.ok(docs.length > 0);
  assert.equal(docs.some((doc) => doc.href.startsWith("/help/admin")), false);
});

void test("support help index includes support faq items from the live support surface", async () => {
  const docs = await getSupportHelpIndexForTest();
  assert.equal(docs.some((doc) => doc.id === "support-faq:reset-password" && doc.href === "/support"), true);
});

void test("support help search can find listing monetisation guidance", async () => {
  const results = await searchSupportHelpDocs("pay per listing plan upgrade", 6);
  assert.equal(results.some((item) => /\/help\/(landlord|agent)\/listing-monetisation$/.test(item.href)), true);
});

void test("support help search can find qr sign kit guidance", async () => {
  const results = await searchSupportHelpDocs("qr sign kit live listing", 6);
  assert.equal(results.some((item) => /\/help\/(landlord|agent)\/qr-sign-kit$/.test(item.href)), true);
});

void test("support help search can find the shared help and support usage guide", async () => {
  const results = await searchSupportHelpDocs("what does the help button do", 6);
  assert.equal(results.some((item) => item.href === "/help/troubleshooting/help-and-support"), true);
});
