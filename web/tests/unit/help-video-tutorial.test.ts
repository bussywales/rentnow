import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import { getHelpDocByRoleAndSlug } from "@/lib/help/docs";

void test("help article renderer supports reusable YouTube embeds", () => {
  const html = renderToStaticMarkup(
    React.createElement(HelpArticleRenderer, {
      source: '<YouTube id="_jWHH5MQMAk" title="Admin Listings Registry" />',
    })
  );

  assert.ok(html.includes('data-testid="help-youtube-embed"'));
  assert.ok(html.includes("https://www.youtube.com/embed/_jWHH5MQMAk"));
});

void test("admin listings registry video tutorial doc is available through admin help content", async () => {
  const doc = await getHelpDocByRoleAndSlug("admin", "admin-listings-registry-video-tutorial");
  assert.ok(doc, "expected admin listings registry tutorial doc");
  assert.equal(doc?.title, "Admin Listings Registry (Updated): Filters, Saved Views & Bulk Delete on PropatyHub");
  assert.match(doc?.body ?? "", /<YouTube id="_jWHH5MQMAk"/);
  assert.match(doc?.body ?? "", /Bulk permanent delete/);
});
