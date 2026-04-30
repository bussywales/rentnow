import test from "node:test";
import assert from "node:assert/strict";
import {
  arePropertyRequestAlertSubscriptionCriteriaEqual,
  doesPropertyRequestMatchAlertSubscription,
  isPropertyRequestAlertEligibleRole,
} from "@/lib/requests/property-request-alert-subscriptions";
import type { PropertyRequest } from "@/lib/requests/property-requests";

const baseRequest: PropertyRequest = {
  id: "req-1",
  ownerUserId: "tenant-1",
  ownerRole: "tenant",
  intent: "rent",
  marketCode: "NG",
  currencyCode: "NGN",
  title: "2 bedroom apartment near Lekki",
  city: "Lagos",
  area: "Lekki",
  locationText: "Lekki Phase 1",
  budgetMin: 100000,
  budgetMax: 300000,
  propertyType: "apartment",
  bedrooms: 2,
  bathrooms: null,
  furnished: null,
  moveTimeline: "within_30_days",
  shortletDuration: null,
  notes: null,
  status: "open",
  publishedAt: "2026-04-30T12:00:00.000Z",
  expiresAt: "2026-05-30T12:00:00.000Z",
  extensionCount: 0,
  lastExpiryReminderForExpiresAt: null,
  createdAt: "2026-04-30T12:00:00.000Z",
  updatedAt: "2026-04-30T12:00:00.000Z",
};

void test("request alert eligible roles are agents and landlords only", () => {
  assert.equal(isPropertyRequestAlertEligibleRole("agent"), true);
  assert.equal(isPropertyRequestAlertEligibleRole("landlord"), true);
  assert.equal(isPropertyRequestAlertEligibleRole("tenant"), false);
  assert.equal(isPropertyRequestAlertEligibleRole("admin"), false);
});

void test("request alert criteria equality is case-insensitive for city and exact for the rest", () => {
  assert.equal(
    arePropertyRequestAlertSubscriptionCriteriaEqual(
      {
        role: "agent",
        marketCode: "NG",
        intent: "rent",
        propertyType: "apartment",
        city: "Lagos",
        bedroomsMin: 2,
      },
      {
        role: "agent",
        marketCode: "NG",
        intent: "rent",
        propertyType: "apartment",
        city: "lagos",
        bedroomsMin: 2,
      }
    ),
    true
  );
});

void test("request alert matching respects market intent property type city and bedrooms", () => {
  assert.equal(
    doesPropertyRequestMatchAlertSubscription(baseRequest, {
      marketCode: "NG",
      intent: "rent",
      propertyType: "apartment",
      city: "lagos",
      bedroomsMin: 2,
    }),
    true
  );

  assert.equal(
    doesPropertyRequestMatchAlertSubscription(baseRequest, {
      marketCode: "NG",
      intent: "buy",
      propertyType: null,
      city: null,
      bedroomsMin: null,
    }),
    false
  );
});

void test("request alert matching treats non-room requests as incompatible with bedroom minimum filters", () => {
  const landRequest: PropertyRequest = {
    ...baseRequest,
    propertyType: "land",
    bedrooms: null,
    title: "Land in Ibeju-Lekki",
  };

  assert.equal(
    doesPropertyRequestMatchAlertSubscription(landRequest, {
      marketCode: "NG",
      intent: "rent",
      propertyType: "land",
      city: "lagos",
      bedroomsMin: 1,
    }),
    false
  );
});

