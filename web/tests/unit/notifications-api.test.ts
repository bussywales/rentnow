import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import {
  getNotificationsResponse,
  type NotificationsRouteDeps,
} from "@/app/api/notifications/route";
import {
  postNotificationsMarkReadResponse,
  type NotificationsMarkReadDeps,
} from "@/app/api/notifications/mark-read/route";

const listRequest = () =>
  new NextRequest("http://localhost/api/notifications", {
    method: "GET",
  });

void test("notifications GET preserves auth failures", async () => {
  let listCalls = 0;
  const deps: NotificationsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireUser: async () =>
      ({
        ok: false,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      }) as Awaited<ReturnType<NotificationsRouteDeps["requireUser"]>>,
    listNotificationsForUser: async () => {
      listCalls += 1;
      return { data: [], error: null };
    },
    countUnreadForUser: async () => ({ unreadCount: 0, error: null }),
  };

  const response = await getNotificationsResponse(listRequest(), deps);

  assert.equal(response.status, 401);
  assert.equal(listCalls, 0);
});

void test("notifications GET returns latest rows and unread count", async () => {
  const deps: NotificationsRouteDeps = {
    hasServerSupabaseEnv: () => true,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "tenant-1" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<NotificationsRouteDeps["requireUser"]>>,
    listNotificationsForUser: async (_client, userId, limit) => {
      assert.equal(userId, "tenant-1");
      assert.equal(limit, 20);
      return {
        data: [
          {
            id: "n1",
            type: "shortlet_booking_request_sent",
            title: "Your booking request was sent",
            body: "2026-02-20 to 2026-02-22 · 2 nights · NGN 120,000.00",
            href: "/trips/booking-1",
            is_read: false,
            created_at: "2026-02-16T13:00:00.000Z",
          },
        ],
        error: null,
      };
    },
    countUnreadForUser: async (_client, userId) => {
      assert.equal(userId, "tenant-1");
      return { unreadCount: 1, error: null };
    },
  };

  const response = await getNotificationsResponse(listRequest(), deps);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.unreadCount, 1);
});

void test("mark-read route scopes update to authenticated user", async () => {
  let markUserId = "";
  let markIds: string[] | undefined;

  const deps: NotificationsMarkReadDeps = {
    hasServerSupabaseEnv: () => true,
    requireUser: async () =>
      ({
        ok: true,
        user: { id: "host-77" } as never,
        supabase: {} as never,
      }) as Awaited<ReturnType<NotificationsMarkReadDeps["requireUser"]>>,
    markNotificationsRead: async (_client, userId, ids) => {
      markUserId = userId;
      markIds = ids;
      return {
        updatedIds: ids ?? ["11111111-1111-4111-8111-111111111111"],
        error: null,
      };
    },
    countUnreadForUser: async (_client, userId) => {
      assert.equal(userId, "host-77");
      return { unreadCount: 2, error: null };
    },
  };

  const request = new NextRequest("http://localhost/api/notifications/mark-read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ids: ["11111111-1111-4111-8111-111111111111"],
    }),
  });

  const response = await postNotificationsMarkReadResponse(request, deps);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(markUserId, "host-77");
  assert.deepEqual(markIds, ["11111111-1111-4111-8111-111111111111"]);
  assert.equal(payload.unreadCount, 2);
});
