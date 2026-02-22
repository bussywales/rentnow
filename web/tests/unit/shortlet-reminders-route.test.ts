import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  postShortletSendRemindersResponse,
  type InternalReminderDeps,
} from "@/app/api/internal/shortlet/send-reminders/route";

function makeRequest(secret?: string) {
  return new NextRequest("http://localhost/api/internal/shortlet/send-reminders", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : undefined,
  });
}

function createEmptyBookingsClient() {
  const bookingChain = {
    in() {
      return this;
    },
    lte() {
      return this;
    },
    gte() {
      return this;
    },
    order() {
      return this;
    },
    async range() {
      return { data: [], error: null };
    },
  };

  return {
    from(table: string) {
      if (table !== "shortlet_bookings") {
        throw new Error(`Unexpected table query: ${table}`);
      }
      return {
        select() {
          return bookingChain;
        },
      };
    },
    auth: {
      admin: {
        async getUserById() {
          return { data: { user: null } };
        },
      },
    },
  };
}

void test("shortlet reminders route rejects invalid cron secret", async () => {
  const deps: InternalReminderDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => createEmptyBookingsClient() as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-22T09:00:00.000Z"),
    sendEmail: async () => ({ ok: true }),
    createNotification: async () => ({ inserted: false, duplicate: false }),
    getSiteUrl: async () => "https://www.propatyhub.com",
  };

  const response = await postShortletSendRemindersResponse(makeRequest("wrong-secret"), deps);
  assert.equal(response.status, 403);
});

void test("shortlet reminders route returns stable count payload when no bookings are due", async () => {
  const deps: InternalReminderDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => createEmptyBookingsClient() as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-22T09:00:00.000Z"),
    sendEmail: async () => ({ ok: true }),
    createNotification: async () => ({ inserted: false, duplicate: false }),
    getSiteUrl: async () => "https://www.propatyhub.com",
  };

  const response = await postShortletSendRemindersResponse(makeRequest("cron-secret"), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sent, 0);
  assert.equal(body.skipped, 0);
  assert.equal(body.errorsCount, 0);
  assert.equal(Array.isArray(body.errors), true);
});
