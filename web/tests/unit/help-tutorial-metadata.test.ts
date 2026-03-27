import test from "node:test";
import assert from "node:assert/strict";
import type { HelpDoc } from "@/lib/help/docs";
import { buildHelpDocMetadata } from "@/lib/help/metadata";

void test("public help metadata uses canonical route and indexable seo fields", () => {
  const doc: HelpDoc = {
    role: "tenant",
    slug: "tenant-shortlist-tutorial",
    filename: "tenant-shortlist-tutorial.tutorial",
    title: "Tenant shortlist tutorial",
    description: "Default summary",
    seoTitle: "Tenant shortlist tutorial | PropatyHub Help",
    metaDescription: "Learn how tenants save, review, and share shortlisted homes on PropatyHub.",
    order: 999,
    updatedAt: "2026-03-27",
    sourcePath: "db:help_tutorials/tutorial-1",
    body: "## What this covers",
  };

  const metadata = buildHelpDocMetadata({
    role: "tenant",
    slug: doc.slug,
    doc,
    baseUrl: "https://www.propatyhub.com",
  });

  assert.equal(metadata.title, "Tenant shortlist tutorial | PropatyHub Help");
  assert.equal(metadata.description, doc.metaDescription);
  assert.equal(
    metadata.alternates?.canonical,
    "https://www.propatyhub.com/help/tenant/tenant-shortlist-tutorial"
  );
  assert.equal(metadata.robots?.index, true);
  assert.equal(metadata.robots?.follow, true);
});

void test("internal help metadata stays non-indexable", () => {
  const doc: HelpDoc = {
    role: "admin",
    slug: "admin-listings-registry-video-tutorial",
    filename: "admin-listings-registry-video-tutorial.tutorial",
    title: "Admin Listings Registry (Updated): Filters, Saved Views & Bulk Delete on PropatyHub",
    description: "Internal admin tutorial for the listings registry.",
    seoTitle: "Should be ignored",
    metaDescription: "Should also be ignored for indexing posture.",
    order: 999,
    updatedAt: "2026-03-27",
    sourcePath: "db:help_tutorials/tutorial-2",
    body: "## What this covers",
  };

  const metadata = buildHelpDocMetadata({
    role: "admin",
    slug: doc.slug,
    doc,
    baseUrl: "https://www.propatyhub.com",
  });

  assert.equal(metadata.title, `${doc.title} · Admin Help · PropatyHub`);
  assert.equal(metadata.robots?.index, false);
  assert.equal(metadata.robots?.follow, false);
  assert.equal(metadata.alternates, undefined);
});
