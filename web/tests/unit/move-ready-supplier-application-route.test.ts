import test from "node:test";
import assert from "node:assert/strict";
import { postMoveReadySupplierApplicationResponse } from "@/app/api/services/providers/apply/route";

void test("supplier application route creates a pending paused provider application", async () => {
  const inserts: Array<{ table: string; payload: Record<string, unknown> | Array<Record<string, unknown>> }> = [];
  const analyticsEvents: string[] = [];

  const client = {
    from: (table: string) => {
      if (table === "move_ready_service_providers") {
        return {
          select: () => ({
            ilike: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            inserts.push({ table, payload });
            return {
              select: () => ({
                maybeSingle: async () => ({ data: { id: "provider-1" }, error: null }),
              }),
            };
          },
        };
      }

      if (table === "move_ready_provider_categories" || table === "move_ready_provider_areas") {
        return {
          insert: async (payload: Array<Record<string, unknown>>) => {
            inserts.push({ table, payload });
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const response = await postMoveReadySupplierApplicationResponse(
    new Request("http://localhost/api/services/providers/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: "Ready Clean",
        contactName: "Ada",
        email: "ada@example.com",
        phone: "0800123",
        verificationReference: "RC-1234",
        notes: "We handle turnovers.",
        categories: ["end_of_tenancy_cleaning"],
        serviceAreas: [{ marketCode: "NG", city: "Lagos", area: "Lekki" }],
      }),
    }) as never,
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => client as never,
      logProductAnalyticsEvent: async ({ eventName }: { eventName: string }) => {
        analyticsEvents.push(eventName);
        return { ok: true };
      },
      now: () => new Date("2026-04-30T12:00:00.000Z"),
    }
  );

  assert.equal(response.status, 200);
  const providerInsert = inserts.find((entry) => entry.table === "move_ready_service_providers");
  assert.equal(providerInsert?.payload.verification_state, "pending");
  assert.equal(providerInsert?.payload.provider_status, "paused");
  assert.equal(providerInsert?.payload.verification_reference, "RC-1234");
  assert.deepEqual(analyticsEvents, ["property_prep_supplier_application_submitted"]);
});

void test("supplier application route blocks duplicate active or pending applications by email", async () => {
  const client = {
    from: (table: string) => {
      if (table === "move_ready_service_providers") {
        return {
          select: () => ({
            ilike: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { id: "provider-1", verification_state: "pending", provider_status: "paused" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };

  const response = await postMoveReadySupplierApplicationResponse(
    new Request("http://localhost/api/services/providers/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessName: "Ready Clean",
        contactName: "Ada",
        email: "ada@example.com",
        categories: ["end_of_tenancy_cleaning"],
        serviceAreas: [{ marketCode: "NG", city: "Lagos", area: null }],
      }),
    }) as never,
    {
      hasServiceRoleEnv: () => true,
      createServiceRoleClient: () => client as never,
      logProductAnalyticsEvent: async () => ({ ok: true }),
      now: () => new Date(),
    }
  );

  assert.equal(response.status, 409);
});
