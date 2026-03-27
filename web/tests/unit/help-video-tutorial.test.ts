import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { HelpArticleRenderer } from "@/components/help/articles/HelpArticleRenderer";
import { readFileSync } from "node:fs";

void test("help article renderer supports thumbnail-first reusable YouTube embeds", () => {
  const html = renderToStaticMarkup(
    React.createElement(HelpArticleRenderer, {
      source: '<YouTube id="_jWHH5MQMAk" title="Admin Listings Registry" />',
    })
  );

  assert.ok(html.includes('data-testid="help-youtube-embed"'));
  assert.ok(html.includes('data-testid="help-youtube-preview"'));
  assert.ok(html.includes("https://i.ytimg.com/vi/_jWHH5MQMAk/hqdefault.jpg"));
  assert.ok(!html.includes("https://www.youtube.com/embed/_jWHH5MQMAk"));
  assert.ok(html.includes("Watch walkthrough"));
});

void test("help YouTube component keeps iframe loading behind explicit click state", () => {
  const source = readFileSync("components/help/articles/YouTube.tsx", "utf8");
  assert.match(source, /const \[isPlaying, setIsPlaying\] = useState\(false\)/);
  assert.match(source, /data-testid="help-youtube-preview"/);
  assert.match(source, /onClick=\{\(\) => setIsPlaying\(true\)\}/);
  assert.match(source, /https:\/\/www\.youtube\.com\/embed\/\$\{safeId\}\?autoplay=1&rel=0/);
});
