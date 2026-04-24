import test from "node:test";
import assert from "node:assert/strict";
import { buildOutcomeLearningSnapshot } from "@/lib/analytics/outcome-learning.server";

void test("outcome learning snapshot aggregates commercial, recovery, and local living signals", () => {
  const snapshot = buildOutcomeLearningSnapshot(
    [
      {
        event_name: "bootcamp_page_viewed",
        created_at: "2026-04-20T09:00:00.000Z",
        property_type: null,
        properties: { category: "bootcamp_launch", surface: "bootcamp_page" },
      },
      {
        event_name: "bootcamp_cta_clicked",
        created_at: "2026-04-20T09:10:00.000Z",
        property_type: null,
        properties: { action: "secure_your_spot", surface: "bootcamp_hero" },
      },
      {
        event_name: "bootcamp_cta_clicked",
        created_at: "2026-04-20T09:11:00.000Z",
        property_type: null,
        properties: { action: "join_pilot_cohort", surface: "bootcamp_final_cta" },
      },
      {
        event_name: "bootcamp_cta_clicked",
        created_at: "2026-04-20T09:12:00.000Z",
        property_type: null,
        properties: { action: "view_programme_roadmap", surface: "bootcamp_hero" },
      },
      {
        event_name: "bootcamp_faq_expanded",
        created_at: "2026-04-20T09:15:00.000Z",
        property_type: null,
        properties: { action: "need-experience", surface: "bootcamp_faq" },
      },
      {
        event_name: "filter_applied",
        created_at: "2026-04-20T10:00:00.000Z",
        property_type: null,
        properties: { commercialFilterUsed: true, surface: "properties_browse" },
      },
      {
        event_name: "result_clicked",
        created_at: "2026-04-20T10:05:00.000Z",
        property_type: "office",
        properties: { commercialFilterUsed: true, surface: "properties_browse" },
      },
      {
        event_name: "listing_limit_recovery_viewed",
        created_at: "2026-04-21T08:00:00.000Z",
        property_type: null,
        properties: { category: "listing_limit_recovery", surface: "listing_paywall_modal" },
      },
      {
        event_name: "listing_limit_recovery_cta_clicked",
        created_at: "2026-04-21T08:01:00.000Z",
        property_type: null,
        properties: { action: "view_plans", category: "listing_limit_recovery" },
      },
      {
        event_name: "listing_limit_recovery_cta_clicked",
        created_at: "2026-04-21T08:02:00.000Z",
        property_type: null,
        properties: { action: "manage_listings", category: "listing_limit_recovery" },
      },
      {
        event_name: "filter_applied",
        created_at: "2026-04-22T09:00:00.000Z",
        property_type: null,
        properties: { localLivingFilterUsed: true, surface: "properties_browse" },
      },
      {
        event_name: "listing_detail_section_viewed",
        created_at: "2026-04-22T09:05:00.000Z",
        property_type: "apartment",
        properties: { category: "local_living", hasLocalLivingDetails: true },
      },
    ],
    {
      windowDays: 14,
      now: new Date("2026-04-24T09:00:00.000Z"),
    }
  );

  assert.deepEqual(snapshot, {
    windowDays: 14,
    windowStart: "2026-04-10T09:00:00.000Z",
    bootcamp: {
      pageViews: 1,
      primaryCtaClicks: 2,
      roadmapClicks: 1,
      faqExpands: 1,
    },
    commercialDiscovery: {
      commercialFilterUses: 1,
      commercialResultClicks: 1,
    },
    listingLimitRecovery: {
      recoveryViews: 1,
      plansClicks: 1,
      manageListingsClicks: 1,
    },
    localLiving: {
      localLivingFilterUses: 1,
      localLivingSectionViews: 1,
    },
  });
});
