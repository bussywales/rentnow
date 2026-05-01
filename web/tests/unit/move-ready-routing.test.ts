import test from "node:test";
import assert from "node:assert/strict";
import {
  assessMoveReadyRoutingReadiness,
  doesProviderAreaMatchRequest,
  filterEligibleMoveReadyProviders,
  getMoveReadyRoutingReadinessLabel,
  type MoveReadyProviderRecord,
} from "@/lib/services/move-ready.server";
import {
  deriveMoveReadyRequestProgress,
  getMoveReadyRequestProgressLabel,
} from "@/lib/services/move-ready";

void test("provider area matching requires exact market and respects optional city and area coverage", () => {
  assert.equal(
    doesProviderAreaMatchRequest(
      { market_code: "NG", city: "Lagos", area: null },
      { category: "end_of_tenancy_cleaning", marketCode: "NG", city: "Lagos", area: "Lekki" }
    ),
    true
  );
  assert.equal(
    doesProviderAreaMatchRequest(
      { market_code: "NG", city: "Abuja", area: null },
      { category: "end_of_tenancy_cleaning", marketCode: "NG", city: "Lagos", area: "Lekki" }
    ),
    false
  );
  assert.equal(
    doesProviderAreaMatchRequest(
      { market_code: "GB", city: null, area: null },
      { category: "end_of_tenancy_cleaning", marketCode: "NG", city: "Lagos", area: "Lekki" }
    ),
    false
  );
});

void test("eligible provider filtering stays narrow to approved active providers with the right category and area", () => {
  const providers: MoveReadyProviderRecord[] = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      business_name: "Ready Clean",
      contact_name: "Ada",
      email: "ada@example.com",
      phone: null,
      verification_state: "approved",
      provider_status: "active",
      move_ready_provider_categories: [{ category: "end_of_tenancy_cleaning" }],
      move_ready_provider_areas: [{ market_code: "NG", city: "Lagos", area: null }],
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      business_name: "Paused Fumigator",
      contact_name: "Bola",
      email: "bola@example.com",
      phone: null,
      verification_state: "approved",
      provider_status: "paused",
      move_ready_provider_categories: [{ category: "fumigation_pest_control" }],
      move_ready_provider_areas: [{ market_code: "NG", city: "Lagos", area: null }],
    },
  ];

  const eligible = filterEligibleMoveReadyProviders(providers, {
    category: "end_of_tenancy_cleaning",
    marketCode: "NG",
    city: "Lagos",
    area: "Lekki",
  });

  assert.equal(eligible.length, 1);
  assert.equal(eligible[0]?.business_name, "Ready Clean");
});

void test("routing readiness reports manual routing when no approved supplier matches the requested area", () => {
  const providers: MoveReadyProviderRecord[] = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      business_name: "Ready Clean",
      contact_name: "Ada",
      email: "ada@example.com",
      phone: null,
      verification_state: "approved",
      provider_status: "active",
      move_ready_provider_categories: [{ category: "end_of_tenancy_cleaning" }],
      move_ready_provider_areas: [{ market_code: "NG", city: "Lagos", area: "Ikeja" }],
    },
  ];

  const readiness = assessMoveReadyRoutingReadiness(providers, {
    category: "end_of_tenancy_cleaning",
    marketCode: "NG",
    city: "Lagos",
    area: "Lekki",
  });

  assert.deepEqual(readiness, {
    eligibleApprovedProviderCount: 0,
    status: "manual_routing_required",
    reason: "no_approved_suppliers_in_area",
  });
  assert.match(getMoveReadyRoutingReadinessLabel(readiness), /Needs manual routing/);
});

void test("routing readiness reports route-ready when approved suppliers fit category and geography", () => {
  const providers: MoveReadyProviderRecord[] = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      business_name: "Ready Clean",
      contact_name: "Ada",
      email: "ada@example.com",
      phone: null,
      verification_state: "approved",
      provider_status: "active",
      move_ready_provider_categories: [{ category: "end_of_tenancy_cleaning" }],
      move_ready_provider_areas: [{ market_code: "NG", city: "Lagos", area: null }],
    },
  ];

  const readiness = assessMoveReadyRoutingReadiness(providers, {
    category: "end_of_tenancy_cleaning",
    marketCode: "NG",
    city: "Lagos",
    area: "Lekki",
  });

  assert.equal(readiness.status, "route_ready");
  assert.equal(readiness.eligibleApprovedProviderCount, 1);
  assert.match(getMoveReadyRoutingReadinessLabel(readiness), /approved supplier/);
});

void test("request progress resolves awaiting operator decision when a provider responds positively", () => {
  const progress = deriveMoveReadyRequestProgress({
    requestStatus: "matched",
    matchedProviderCount: 2,
    eligibleApprovedProviderCount: 2,
    leads: [
      { routing_status: "accepted" },
      { routing_status: "sent" },
    ],
  });

  assert.equal(progress, "awaiting_operator_decision");
  assert.equal(getMoveReadyRequestProgressLabel(progress), "Awaiting operator decision");
});

void test("request progress resolves partially dispatched when not all eligible suppliers were routed yet", () => {
  const progress = deriveMoveReadyRequestProgress({
    requestStatus: "matched",
    matchedProviderCount: 1,
    eligibleApprovedProviderCount: 3,
    leads: [{ routing_status: "sent" }],
  });

  assert.equal(progress, "partially_dispatched");
});

void test("request progress resolves awarded and closed no match from final request statuses", () => {
  assert.equal(
    deriveMoveReadyRequestProgress({ requestStatus: "awarded", matchedProviderCount: 1, leads: [] }),
    "awarded"
  );
  assert.equal(
    deriveMoveReadyRequestProgress({ requestStatus: "closed_no_match", matchedProviderCount: 0, leads: [] }),
    "closed_no_match"
  );
});
