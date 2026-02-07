import test from "node:test";
import assert from "node:assert/strict";
import { consumeListingCredit } from "@/lib/billing/listing-credits.server";

const makeClient = (data: unknown, error: { message: string } | null = null) => ({
  rpc: async () => ({ data, error }),
});

void test("consumeListingCredit returns ok when consumed", async () => {
  const client = makeClient({
    ok: true,
    consumed: true,
    source: "payg",
    credit_id: "credit-1",
    idempotency_key: "idem-1",
  });

  const result = await consumeListingCredit({
    client: client as never,
    userId: "user",
    listingId: "listing",
    idempotencyKey: "idem-1",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.consumed, true);
    assert.equal(result.source, "payg");
  }
});

void test("consumeListingCredit returns no credits when rpc says no credits", async () => {
  const client = makeClient({
    ok: false,
    reason: "NO_CREDITS",
  });

  const result = await consumeListingCredit({
    client: client as never,
    userId: "user",
    listingId: "listing",
    idempotencyKey: "idem-2",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "NO_CREDITS");
  }
});

void test("consumeListingCredit treats already-consumed as ok", async () => {
  const client = makeClient({
    ok: true,
    consumed: false,
    already_consumed: true,
    source: "trial",
    credit_id: "credit-2",
    idempotency_key: "idem-3",
  });

  const result = await consumeListingCredit({
    client: client as never,
    userId: "user",
    listingId: "listing",
    idempotencyKey: "idem-3",
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.consumed, false);
    assert.equal(result.alreadyConsumed, true);
  }
});
