import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(process.cwd(), "app", "bootcamp", "page.tsx");
const contentPath = path.join(process.cwd(), "components", "bootcamp", "content.ts");
const heroPath = path.join(process.cwd(), "components", "bootcamp", "HeroSection.tsx");
const faqPath = path.join(process.cwd(), "components", "bootcamp", "FAQSection.tsx");
const overviewPath = path.join(process.cwd(), "components", "bootcamp", "ProgrammeOverviewSection.tsx");

const pageSource = fs.readFileSync(pagePath, "utf8");
const contentSource = fs.readFileSync(contentPath, "utf8");
const heroSource = fs.readFileSync(heroPath, "utf8");
const faqSource = fs.readFileSync(faqPath, "utf8");
const overviewSource = fs.readFileSync(overviewPath, "utf8");
const audienceSource = fs.readFileSync(
  path.join(process.cwd(), "components", "bootcamp", "AudienceSection.tsx"),
  "utf8"
);
const whySource = fs.readFileSync(
  path.join(process.cwd(), "components", "bootcamp", "WhyPropatyHubSection.tsx"),
  "utf8"
);
const finalCtaSource = fs.readFileSync(
  path.join(process.cwd(), "components", "bootcamp", "FinalCTASection.tsx"),
  "utf8"
);
const allRelevantSources = [
  pageSource,
  contentSource,
  heroSource,
  faqSource,
  audienceSource,
  whySource,
  finalCtaSource,
].join("\n");

void test("bootcamp page uses the exact required section component order", () => {
  const orderedComponents = [
    "<HeaderNav />",
    "<HeroSection />",
    "<WhyThisExistsSection />",
    "<AudienceSection />",
    "<ProgrammeOverviewSection />",
    "<HowItWorksSection />",
    "<AttendeeValueSection />",
    "<WhyPropatyHubSection />",
    "<FAQSection />",
    "<FinalCTASection />",
    "<BootcampFooter />",
  ];

  let lastIndex = -1;
  for (const marker of orderedComponents) {
    const nextIndex = pageSource.indexOf(marker);
    assert.ok(nextIndex > lastIndex, `expected ${marker} in the locked section order`);
    lastIndex = nextIndex;
  }
});

void test("bootcamp content file keeps the locked visible copy", () => {
  const requiredCopy = [
    "Practical Pathways Into Property Opportunity",
    "Bridging the Gap to Real Property Participation",
    "Who It Is For",
    "5-Day Bootcamp Overview",
    "How the Programme Works",
    "What Attendees Receive",
    "Why PropatyHub",
    "Start With Practical Guidance, Not Hype",
    "Join the Pilot Cohort",
    "© 2026 PropatyHub. All rights reserved.",
  ];

  for (const copy of requiredCopy) {
    assert.match(allRelevantSources, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

void test("bootcamp hero and faq keep the expected interactions", () => {
  assert.match(allRelevantSources, /Secure Your Spot/);
  assert.match(allRelevantSources, /View Programme Roadmap/);
  assert.match(allRelevantSources, /Practical focus, not hype/);
  assert.match(faqSource, /details/);
  assert.match(faqSource, /setOpenId/);
});

void test("bootcamp CTA destinations stay truthful and routed to support or roadmap", () => {
  assert.match(
    contentSource,
    /\/support\?category=general&source=bootcamp&message=.*PropatyHub%20Property%20Opportunity%20Bootcamp.*#support-form/
  );
  assert.match(
    contentSource,
    /\/support\?category=general&source=bootcamp&message=.*pricing.*PropatyHub%20Property%20Opportunity%20Bootcamp.*#support-form/
  );
  assert.match(contentSource, /BOOTCAMP_SECONDARY_CTA_HREF = "#programme-overview"/);
});

void test("bootcamp hero no longer duplicates the full five-day overview cards", () => {
  assert.match(heroSource, /bootcamp_hero_day_teaser/);
  assert.match(heroSource, /bootcamp_hero_overview_teaser/);
  assert.doesNotMatch(heroSource, /day\.title/);
  assert.doesNotMatch(heroSource, /day\.copy/);
  assert.match(overviewSource, /item\.title/);
  assert.match(overviewSource, /item\.copy/);
});
