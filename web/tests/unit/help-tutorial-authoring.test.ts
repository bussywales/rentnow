import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { HelpDoc } from "@/lib/help/docs";
import {
  coerceTutorialVisibility,
  composeHelpTutorialBody,
  extractYouTubeId,
  resolveTutorialMetaDescription,
  resolveTutorialSeoTitle,
} from "@/lib/help/tutorials";
import { mergeHelpDocs } from "@/lib/help/tutorials.server";

void test("YouTube helper accepts normal watch and short links", () => {
  assert.equal(extractYouTubeId("https://youtu.be/_jWHH5MQMAk"), "_jWHH5MQMAk");
  assert.equal(
    extractYouTubeId("https://www.youtube.com/watch?v=_jWHH5MQMAk"),
    "_jWHH5MQMAk"
  );
  assert.equal(extractYouTubeId("https://example.com/video"), null);
});

void test("tutorial body composer prepends the reusable YouTube embed", () => {
  const body = composeHelpTutorialBody({
    body: "## What this covers\n\n- Search\n- Filters",
    videoUrl: "https://youtu.be/_jWHH5MQMAk",
    videoTitle: "Listings registry tutorial",
  });

  assert.match(body, /<YouTube id="_jWHH5MQMAk" title="Listings registry tutorial" \/>/);
  assert.match(body, /## What this covers/);
});

void test("admin tutorials stay internal while public role tutorials stay public", () => {
  assert.equal(coerceTutorialVisibility("admin", "public"), "internal");
  assert.equal(coerceTutorialVisibility("tenant", "internal"), "public");
  assert.equal(coerceTutorialVisibility("agent", "public"), "public");
});

void test("tutorial seo helpers fall back to title and summary when explicit values are missing", () => {
  assert.equal(
    resolveTutorialSeoTitle({ title: "Tenant shortlist tutorial", seoTitle: null }),
    "Tenant shortlist tutorial"
  );
  assert.equal(
    resolveTutorialMetaDescription({
      summary: "Help tenants save and revisit promising homes.",
      metaDescription: "",
    }),
    "Help tenants save and revisit promising homes."
  );
});

void test("merged help docs preserve shipped file docs over authored slug collisions", () => {
  const fileDocs: HelpDoc[] = [
    {
      role: "admin",
      slug: "review-workflow",
      filename: "review-workflow.md",
      title: "Review workflow",
      description: "File doc",
      order: 1,
      updatedAt: "2026-03-26",
      sourcePath: "docs/help/admin/review-workflow.md",
      body: "File body",
    },
  ];
  const tutorialDocs: HelpDoc[] = [
    {
      role: "admin",
      slug: "review-workflow",
      filename: "review-workflow.tutorial",
      title: "Review workflow tutorial",
      description: "Tutorial doc",
      order: 999,
      updatedAt: "2026-03-26",
      sourcePath: "db:help_tutorials/1",
      body: "Tutorial body",
    },
  ];

  const merged = mergeHelpDocs(fileDocs, tutorialDocs);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.sourcePath, "docs/help/admin/review-workflow.md");
});

void test("tutorial authoring remains behind admin-only pages", async () => {
  const guardSource = readFileSync("lib/help/tutorial-authoring.server.ts", "utf8");
  assert.match(guardSource, /\/auth\/required\?redirect=\$\{encodeURIComponent\(redirectPath\)\}&reason=auth/);
  assert.match(guardSource, /\/forbidden\?reason=role/);

  await assert.doesNotReject(async () => import("@/app/admin/help/tutorials/page"));
  await assert.doesNotReject(async () => import("@/app/admin/help/tutorials/new/page"));
  await assert.doesNotReject(async () => import("@/app/admin/help/tutorials/[id]/page"));
});
