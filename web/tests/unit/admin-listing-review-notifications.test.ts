import test from "node:test";
import assert from "node:assert/strict";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import {
  formatListingIntentLabel,
  formatListingPropertyTypeLabel,
  notifyAdminsOfListingReviewSubmission,
} from "@/lib/admin/listing-review-notifications.server";

void test("listing review notifications only send to opted-in admins with email addresses", async () => {
  const sentTo: string[] = [];
  const result = await notifyAdminsOfListingReviewSubmission(
    {
      propertyId: "prop-1",
      listingTitle: "Ocean View Apartment",
      marketLabel: "NG",
      propertyTypeLabel: "Apartment",
      intentLabel: "Rent",
      ownerName: "Ada Agent",
      submittedAt: "2026-03-16T10:00:00.000Z",
    },
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => ({}) as ReturnType<typeof createServiceRoleClient>,
      getSiteUrl: async () => "https://www.propatyhub.com",
      loadOptedInAdminProfiles: async () => [
        {
          id: "admin-1",
          role: "admin",
          display_name: "Primary Admin",
          listing_review_email_enabled: true,
        },
        {
          id: "admin-2",
          role: "admin",
          display_name: "Skipped Admin",
          listing_review_email_enabled: true,
        },
      ],
      getAdminEmail: async (_client, userId) => (userId === "admin-1" ? "admin1@example.com" : null),
      sendEmail: async ({ to, subject, html }) => {
        sentTo.push(to);
        assert.equal(subject, "New listing submitted for review");
        assert.match(html, /Ocean View Apartment/);
        assert.match(html, /https:\/\/www\.propatyhub\.com\/admin\/review\/prop-1/);
        assert.match(html, /Ada Agent/);
        return { ok: true };
      },
    }
  );

  assert.deepEqual(sentTo, ["admin1@example.com"]);
  assert.deepEqual(result, {
    ok: true,
    attempted: 1,
    sent: 1,
    skipped: 1,
  });
});

void test("listing review notification helpers normalize intent and property labels", () => {
  assert.equal(formatListingIntentLabel("short_let"), "Shortlet");
  assert.equal(formatListingIntentLabel("sale"), "Buy");
  assert.equal(formatListingPropertyTypeLabel("semi_detached"), "Semi Detached");
});
