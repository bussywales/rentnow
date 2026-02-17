import test from "node:test";
import assert from "node:assert/strict";
import { buildProviderUnavailableResponse } from "@/app/api/shortlet/bookings/create/route";

void test("booking create provider-unavailable response returns 409 with code and reason", async () => {
  const response = buildProviderUnavailableResponse("both_providers_disabled");
  const payload = (await response.json()) as { error?: string; reason?: string };

  assert.equal(response.status, 409);
  assert.equal(payload.error, "SHORTLET_PAYMENT_PROVIDER_UNAVAILABLE");
  assert.equal(payload.reason, "both_providers_disabled");
});
