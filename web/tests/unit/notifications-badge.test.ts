import test from "node:test";
import assert from "node:assert/strict";
import {
  countUnreadNotifications,
  resolveUnreadNotificationsCount,
} from "@/lib/notifications/badge";

void test("countUnreadNotifications counts only unread rows", () => {
  const rows = [
    { is_read: false },
    { is_read: true },
    { is_read: false },
    {},
  ];

  assert.equal(countUnreadNotifications(rows), 3);
});

void test("resolveUnreadNotificationsCount prefers API count when provided", () => {
  const rows = [{ is_read: false }, { is_read: false }, { is_read: true }];

  assert.equal(resolveUnreadNotificationsCount(rows, 5), 5);
  assert.equal(resolveUnreadNotificationsCount(rows, null), 2);
});
