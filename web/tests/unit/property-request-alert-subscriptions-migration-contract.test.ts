import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

void test("property request alert subscriptions migration creates subscription and delivery tables", () => {
  const sql = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260430143000_property_request_alert_subscriptions.sql"
    ),
    "utf8"
  );

  assert.match(sql, /create table if not exists public\.property_request_alert_subscriptions/i);
  assert.match(sql, /create table if not exists public\.property_request_alert_deliveries/i);
  assert.match(sql, /constraint property_request_alert_deliveries_unique unique \(subscription_id, request_id, channel\)/i);
  assert.match(sql, /create policy "property request alert subscriptions owner insert"/i);
  assert.match(sql, /create policy "property request alert deliveries service write"/i);
  assert.match(sql, /using \(public\.is_admin\(\)\)/i);
  assert.doesNotMatch(sql, /public\.is_admin\(auth\.uid\(\)\)/i);
});
