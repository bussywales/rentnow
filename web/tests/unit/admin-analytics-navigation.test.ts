import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("analytics pages mount shared sibling navigation", () => {
  const marketplacePagePath = path.join(process.cwd(), "app", "admin", "analytics", "page.tsx");
  const marketplaceContents = fs.readFileSync(marketplacePagePath, "utf8");
  assert.ok(
    marketplaceContents.includes("<AdminAnalyticsSectionNav current=\"marketplace\" />"),
    "expected marketplace analytics page to render sibling nav"
  );

  const explorePagePath = path.join(process.cwd(), "app", "admin", "analytics", "explore", "page.tsx");
  const exploreContents = fs.readFileSync(explorePagePath, "utf8");
  assert.ok(
    exploreContents.includes("<AdminAnalyticsSectionNav current=\"explore\" />"),
    "expected explore analytics page to render sibling nav"
  );

  const exploreV2PagePath = path.join(
    process.cwd(),
    "app",
    "admin",
    "analytics",
    "explore-v2",
    "page.tsx"
  );
  const exploreV2Contents = fs.readFileSync(exploreV2PagePath, "utf8");
  assert.ok(
    exploreV2Contents.includes("<AdminAnalyticsSectionNav current=\"explore_v2\" />"),
    "expected explore v2 conversion page to render sibling nav"
  );

  const navComponentPath = path.join(
    process.cwd(),
    "components",
    "admin",
    "AdminAnalyticsSectionNav.tsx"
  );
  const navContents = fs.readFileSync(navComponentPath, "utf8");
  assert.ok(
    navContents.includes('href: "/admin/analytics"'),
    "expected marketplace analytics destination href"
  );
  assert.ok(
    navContents.includes('href: "/admin/analytics/explore"'),
    "expected explore analytics destination href"
  );
  assert.ok(
    navContents.includes('href: "/admin/analytics/explore-v2"'),
    "expected explore v2 conversion destination href"
  );
});
