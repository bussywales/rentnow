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

function createFailingBookingsClient() {
  return {
    from(table: string) {
      if (table !== "shortlet_bookings") {
        throw new Error(`Unexpected table query: ${table}`);
      }
      return {
        select() {
          return {
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
              return { data: null, error: { message: "Unable to load bookings" } };
            },
          };
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
    startJobRun: async () => {},
    finishJobRun: async () => {},
    createJobRunKey: () => "run-test-1",
  };

  const response = await postShortletSendRemindersResponse(makeRequest("wrong-secret"), deps);
  assert.equal(response.status, 403);
});

void test("shortlet reminders route returns stable count payload when no bookings are due", async () => {
  const finishCalls: Array<{ status: string; meta?: Record<string, unknown> }> = [];
  const deps: InternalReminderDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => createEmptyBookingsClient() as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-22T09:00:00.000Z"),
    sendEmail: async () => ({ ok: true }),
    createNotification: async () => ({ inserted: false, duplicate: false }),
    getSiteUrl: async () => "https://www.propatyhub.com",
    startJobRun: async () => {},
    finishJobRun: async (input) => {
      finishCalls.push({ status: input.status, meta: input.meta });
    },
    createJobRunKey: () => "run-test-2",
  };

  const response = await postShortletSendRemindersResponse(makeRequest("cron-secret"), deps);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.sent, 0);
  assert.equal(body.skipped, 0);
  assert.equal(body.errorsCount, 0);
  assert.equal(Array.isArray(body.errors), true);
  assert.equal(body.runKey, "run-test-2");
  assert.equal(finishCalls.length, 1);
  assert.equal(finishCalls[0].status, "succeeded");
  assert.equal(finishCalls[0].meta?.sent, 0);
  assert.equal(finishCalls[0].meta?.scanned, 0);
});

void test("shortlet reminders route records failed run state when bookings query fails", async () => {
  const finishCalls: Array<{ status: string; error?: string | null }> = [];
  const deps: InternalReminderDeps = {
    hasServiceRoleEnv: () => true,
    createServiceRoleClient: () => createFailingBookingsClient() as never,
    getCronSecret: () => "cron-secret",
    now: () => new Date("2026-02-22T09:00:00.000Z"),
    sendEmail: async () => ({ ok: true }),
    createNotification: async () => ({ inserted: false, duplicate: false }),
    getSiteUrl: async () => "https://www.propatyhub.com",
    startJobRun: async () => {},
    finishJobRun: async (input) => {
      finishCalls.push({ status: input.status, error: input.error });
    },
    createJobRunKey: () => "run-test-3",
  };

  const response = await postShortletSendRemindersResponse(makeRequest("cron-secret"), deps);
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.error, "Unable to load bookings");
  assert.equal(body.runKey, "run-test-3");
  assert.equal(finishCalls.length, 1);
  assert.equal(finishCalls[0].status, "failed");
  assert.equal(finishCalls[0].error, "Unable to load bookings");
});
